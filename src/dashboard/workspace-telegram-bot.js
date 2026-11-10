/* ──────────────────────────────────────────────────────────────────────────
 * workspace-telegram-bot.js
 *
 * Handles INCOMING messages from the Telegram bot (the other direction from
 * workspace-telegram-webhook.js, which only sends outbound alerts). When a user
 * in a registered chat types a command — /sprint, /sprints, /overdue, /help —
 * the bot replies with formatted live data from the database.
 *
 * SETUP (one-time per environment)
 * --------------------------------
 *   Set the webhook URL on Telegram so they POST updates to us:
 *     curl "https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://nigents.com/api/webhooks/telegram/bot"
 *   Verify with:
 *     curl "https://api.telegram.org/bot<TOKEN>/getWebhookInfo"
 *
 * MAPPING CHATS TO APPS
 * ---------------------
 *   The same TELEGRAM_CHAT_ID_<APP> env vars used by the outbound alerts
 *   double as the reverse lookup. If an incoming message comes from chat
 *   12345 and TELEGRAM_CHAT_ID_TAWAZON=12345, the bot treats commands
 *   in that chat as being about the Tawazon app.
 *
 * COMMANDS
 * --------
 *   /sprint              Active sprint summary (or most recent if none active)
 *   /sprints             List the 5 most recent sprints + their status
 *   /overdue             All overdue tasks in the app, grouped by assignee
 *   /late                Latest 5 late-reasons across all sprints
 *   /help                List of available commands
 * ────────────────────────────────────────────────────────────────────────── */

'use strict';

const https  = require('https');
const db     = require('../database/connection');
const logger = require('./workspace-logger');

const APP_LABELS = {
  workspace:      'Workspace',
  tawazon:     'Tawazon',
  droop:       'Droop',
  quickin:     'QuickIn',
};

const KNOWN_APPS = Object.keys(APP_LABELS);

// ── Telegram send wrapper ───────────────────────────────────────────────
function telegramSend(chatId, text, { token, parseMode, disableWebPreview } = {}) {
  return new Promise((resolve, reject) => {
    if (!token)  return reject(new Error('TELEGRAM_BOT_TOKEN not set'));
    if (!chatId) return reject(new Error('chat_id missing'));
    const body = JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: parseMode || 'Markdown',
      disable_web_page_preview: disableWebPreview !== false,
    });
    const req = https.request({
      method: 'POST',
      hostname: 'api.telegram.org',
      path: `/bot${token}/sendMessage`,
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
    }, (res) => {
      let buf = '';
      res.on('data', (c) => { buf += c; });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) resolve({ ok: true, raw: buf });
        else reject(new Error(`Telegram ${res.statusCode}: ${buf}`));
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ── Helpers ─────────────────────────────────────────────────────────────
function getBotToken() { return (process.env.TELEGRAM_BOT_TOKEN || '').trim(); }

// Reverse-lookup chat_id → app_slug using the per-app env vars
function resolveAppFromChatId(chatId) {
  const idStr = String(chatId);
  for (const app of KNOWN_APPS) {
    const envKey = `TELEGRAM_CHAT_ID_${app.toUpperCase()}`;
    if (String(process.env[envKey] || '').trim() === idStr) return app;
  }
  // Fall back to the global TELEGRAM_CHAT_ID → treat as "workspace" by default
  if (String(process.env.TELEGRAM_CHAT_ID || '').trim() === idStr) return 'workspace';
  return null;
}

// MarkdownV1-safe escape for user-supplied text
function md(text) {
  return String(text == null ? '' : text).replace(/[*_`[\]]/g, (c) => '\\' + c);
}

function fmtDate(dateLike) {
  if (!dateLike) return '—';
  try {
    const d = (dateLike instanceof Date) ? dateLike : new Date(dateLike);
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch (_) { return String(dateLike); }
}

function daysBetween(a, b) {
  const oneDay = 86400000;
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / oneDay);
}

function daysLeftLabel(endDate) {
  if (!endDate) return '';
  const d = daysBetween(new Date(), endDate);
  if (d < 0)  return `${Math.abs(d)}d overdue`;
  if (d === 0) return 'due today';
  return `${d}d left`;
}

// ── Command handlers ────────────────────────────────────────────────────

async function cmdSprint(db, appSlug) {
  // Active sprint (or most recent if none active) + its key stats
  const sprints = await db.query(
    `SELECT s.*,
            (SELECT COUNT(*) FROM workspace_sprint_issues WHERE sprint_id = s.id) AS issue_count,
            (SELECT COALESCE(SUM(i.estimate_points),0) FROM workspace_sprint_issues si
             JOIN workspace_issues i ON i.id = si.issue_id WHERE si.sprint_id = s.id) AS total_points,
            (SELECT COALESCE(SUM(i.estimate_points),0) FROM workspace_sprint_issues si
             JOIN workspace_issues i ON i.id = si.issue_id
             WHERE si.sprint_id = s.id AND (i.state = 'done' OR i.is_done = 1)) AS done_points,
            (SELECT COUNT(*) FROM workspace_sprint_issues si
             JOIN workspace_issues i ON i.id = si.issue_id
             WHERE si.sprint_id = s.id
               AND i.due_date IS NOT NULL AND i.due_date < CURDATE()
               AND (i.state IS NULL OR i.state NOT IN ('done','cancelled'))
               AND i.is_done = 0) AS overdue_count
     FROM workspace_sprints s
     WHERE s.app_slug = ?
     ORDER BY (s.status='active') DESC, s.start_date DESC, s.id DESC
     LIMIT 1`,
    [appSlug]
  );
  if (!sprints.length) {
    return `📋 *${APP_LABELS[appSlug]}* — no sprints yet.\n\nCreate one at https://nigents.com/example/sprints.html?app=${appSlug}`;
  }
  const s = sprints[0];
  const pct = s.total_points > 0
    ? Math.round((Number(s.done_points) / Number(s.total_points)) * 100)
    : 0;
  const lines = [];
  lines.push(`*${md(APP_LABELS[appSlug])}* — ${s.status === 'active' ? '🏃 active sprint' : '📦 latest sprint'}`);
  lines.push('');
  lines.push(`📌 *${md(s.name)}*`);
  if (s.goal) lines.push(`🎯 ${md(s.goal)}`);
  lines.push('');
  if (s.start_date && s.end_date) {
    lines.push(`📅 ${fmtDate(s.start_date)} → ${fmtDate(s.end_date)}  _(${daysLeftLabel(s.end_date)})_`);
  }
  if (s.capacity_points) {
    lines.push(`📊 capacity: *${s.capacity_points}* pts · planned: *${s.total_points}* pts`);
  } else {
    lines.push(`📊 planned: *${s.total_points}* pts`);
  }
  lines.push(`✅ completed: *${s.done_points}* / ${s.total_points} pts  (*${pct}%*)`);
  lines.push(`📦 issues: *${s.issue_count}* total`);
  if (Number(s.overdue_count) > 0) {
    lines.push(`⚠️ *${s.overdue_count} overdue* — use /overdue for details`);
  }
  lines.push('');
  lines.push(`[Open in dashboard ↗](https://nigents.com/example/sprints.html?app=${appSlug}&sprint=${s.id})`);
  return lines.join('\n');
}

async function cmdSprints(db, appSlug) {
  const sprints = await db.query(
    `SELECT s.*,
            (SELECT COUNT(*) FROM workspace_sprint_issues WHERE sprint_id = s.id) AS issue_count,
            (SELECT COALESCE(SUM(i.estimate_points),0) FROM workspace_sprint_issues si
             JOIN workspace_issues i ON i.id = si.issue_id
             WHERE si.sprint_id = s.id AND (i.state = 'done' OR i.is_done = 1)) AS done_points,
            (SELECT COALESCE(SUM(i.estimate_points),0) FROM workspace_sprint_issues si
             JOIN workspace_issues i ON i.id = si.issue_id WHERE si.sprint_id = s.id) AS total_points
     FROM workspace_sprints s
     WHERE s.app_slug = ?
     ORDER BY (s.status='active') DESC, s.start_date DESC, s.id DESC
     LIMIT 5`,
    [appSlug]
  );
  if (!sprints.length) {
    return `📋 *${APP_LABELS[appSlug]}* — no sprints yet.`;
  }
  const statusIcon = { active: '🏃', planning: '📝', completed: '✅', cancelled: '❌' };
  const lines = [`*${md(APP_LABELS[appSlug])}* — last 5 sprints`, ''];
  sprints.forEach((s) => {
    const icon = statusIcon[s.status] || '•';
    const pts = s.total_points > 0 ? `${s.done_points}/${s.total_points} pts` : '—';
    lines.push(`${icon} *${md(s.name)}*`);
    lines.push(`   ${pts} · ${s.issue_count} issues · ${fmtDate(s.start_date)}`);
  });
  lines.push('');
  lines.push(`[Open dashboard ↗](https://nigents.com/example/sprints.html?app=${appSlug})`);
  return lines.join('\n');
}

async function cmdOverdue(db, appSlug) {
  const rows = await db.query(
    `SELECT i.id, i.title, i.priority, i.due_date,
            u.name AS assignee_name,
            DATEDIFF(CURDATE(), i.due_date) AS days_overdue
     FROM workspace_issues i
     LEFT JOIN workspace_users u ON u.id = i.assignee_id
     LEFT JOIN workspace_sheets s ON s.slug = i.sheet_slug
     WHERE COALESCE(s.app_slug,'workspace') = ?
       AND i.due_date IS NOT NULL AND i.due_date < CURDATE()
       AND (i.state IS NULL OR i.state NOT IN ('done','cancelled'))
       AND i.is_done = 0
     ORDER BY i.due_date ASC, i.priority='high' DESC
     LIMIT 15`,
    [appSlug]
  );
  if (!rows.length) {
    return `✅ *${APP_LABELS[appSlug]}* — no overdue tasks. Nice work.`;
  }
  const lines = [`⚠️ *${md(APP_LABELS[appSlug])}* — ${rows.length} overdue task${rows.length === 1 ? '' : 's'}`, ''];
  rows.forEach((r) => {
    const prio = r.priority === 'high' ? '🔴 ' : r.priority === 'low' ? '🔵 ' : '🟡 ';
    const owner = r.assignee_name ? ` · ${md(r.assignee_name)}` : ' · _unassigned_';
    lines.push(`${prio}#${r.id} ${md(String(r.title || '').slice(0, 70))}`);
    lines.push(`   ${r.days_overdue}d late · due ${fmtDate(r.due_date)}${owner}`);
  });
  return lines.join('\n');
}

async function cmdLate(db, appSlug) {
  const rows = await db.query(
    `SELECT lr.id, lr.issue_id, lr.reason, lr.new_due_date, lr.submitted_at,
            lr.user_name, i.title
     FROM workspace_issue_late_reasons lr
     JOIN workspace_issues i ON i.id = lr.issue_id
     WHERE lr.app_slug = ?
     ORDER BY lr.submitted_at DESC
     LIMIT 5`,
    [appSlug]
  );
  if (!rows.length) {
    return `📝 *${APP_LABELS[appSlug]}* — no late-reasons filed yet.`;
  }
  const lines = [`📝 *${md(APP_LABELS[appSlug])}* — last 5 late-reasons`, ''];
  rows.forEach((r) => {
    lines.push(`#${r.issue_id}: ${md(String(r.title || '').slice(0, 60))}`);
    lines.push(`   by *${md(r.user_name)}* · ${fmtDate(r.submitted_at)}${r.new_due_date ? ` · new ETA *${r.new_due_date}*` : ''}`);
    lines.push(`   _"${md(String(r.reason).slice(0, 140))}${r.reason.length > 140 ? '…' : ''}"_`);
    lines.push('');
  });
  return lines.join('\n').trim();
}

// ── /all — cross-app overview: every project + its active sprint ─────
// Loops over every known app and reports its active sprint (if any) +
// total sprint count + overdue count. One short block per app. This is
// the high-altitude "what's going on across the whole org" view.
async function cmdAll(db) {
  const rows = await db.query(
    `SELECT s.id, s.app_slug, s.name, s.status, s.start_date, s.end_date,
            (SELECT COUNT(*) FROM workspace_sprint_issues WHERE sprint_id = s.id) AS issue_count,
            (SELECT COALESCE(SUM(i.estimate_points),0) FROM workspace_sprint_issues si
             JOIN workspace_issues i ON i.id = si.issue_id WHERE si.sprint_id = s.id) AS total_points,
            (SELECT COALESCE(SUM(i.estimate_points),0) FROM workspace_sprint_issues si
             JOIN workspace_issues i ON i.id = si.issue_id
             WHERE si.sprint_id = s.id AND (i.state = 'done' OR i.is_done = 1)) AS done_points
     FROM workspace_sprints s
     ORDER BY s.app_slug ASC, (s.status='active') DESC, s.start_date DESC`
  );
  // Aggregate per app
  const byApp = {};
  KNOWN_APPS.forEach((a) => { byApp[a] = { active: null, total: 0, planning: 0, completed: 0, cancelled: 0 }; });
  rows.forEach((s) => {
    const slug = String(s.app_slug || 'workspace').toLowerCase();
    if (!byApp[slug]) byApp[slug] = { active: null, total: 0, planning: 0, completed: 0, cancelled: 0 };
    byApp[slug].total += 1;
    byApp[slug][s.status] = (byApp[slug][s.status] || 0) + 1;
    if (s.status === 'active' && !byApp[slug].active) byApp[slug].active = s;
  });
  // Overdue counts per app (single grouped query)
  const overdueRows = await db.query(
    `SELECT COALESCE(sh.app_slug,'workspace') AS app_slug, COUNT(*) AS n
     FROM workspace_issues i
     LEFT JOIN workspace_sheets sh ON sh.slug = i.sheet_slug
     WHERE i.due_date IS NOT NULL AND i.due_date < CURDATE()
       AND (i.state IS NULL OR i.state NOT IN ('done','cancelled'))
       AND i.is_done = 0
     GROUP BY app_slug`
  );
  const overdueByApp = {};
  overdueRows.forEach((r) => { overdueByApp[r.app_slug] = Number(r.n) || 0; });

  const totalSprints = rows.length;
  const totalActive  = rows.filter((r) => r.status === 'active').length;
  const totalOverdue = overdueRows.reduce((a, r) => a + (Number(r.n) || 0), 0);

  const lines = [];
  lines.push(`*All projects — workspace overview*`);
  lines.push(`📦 ${totalSprints} sprints across ${KNOWN_APPS.length} apps · 🏃 ${totalActive} active · ⚠️ ${totalOverdue} overdue tasks`);
  lines.push('');

  KNOWN_APPS.forEach((slug) => {
    const data = byApp[slug];
    const label = APP_LABELS[slug];
    const overdue = overdueByApp[slug] || 0;

    lines.push(`*${md(label)}*`);
    if (data.active) {
      const s = data.active;
      const pct = s.total_points > 0
        ? Math.round((Number(s.done_points) / Number(s.total_points)) * 100)
        : 0;
      lines.push(`  🏃 ${md(s.name)} — ${s.done_points}/${s.total_points} pts (${pct}%)`);
      if (s.end_date) lines.push(`  📅 ${daysLeftLabel(s.end_date)}`);
    } else if (data.total > 0) {
      lines.push(`  no active sprint (${data.planning || 0} planning, ${data.completed || 0} completed)`);
    } else {
      lines.push(`  _no sprints yet_`);
    }
    if (data.total > 0) {
      lines.push(`  📊 ${data.total} sprint${data.total === 1 ? '' : 's'} total${overdue > 0 ? ` · ⚠️ ${overdue} overdue` : ''}`);
    }
    lines.push('');
  });

  lines.push('Use /sprints all for the full list of sprints across every app.');
  return lines.join('\n').trim();
}

// ── /sprints all — every sprint in every app, sorted by recency ──────
async function cmdAllSprints(db) {
  const rows = await db.query(
    `SELECT s.id, s.app_slug, s.name, s.status, s.start_date, s.end_date,
            (SELECT COUNT(*) FROM workspace_sprint_issues WHERE sprint_id = s.id) AS issue_count,
            (SELECT COALESCE(SUM(i.estimate_points),0) FROM workspace_sprint_issues si
             JOIN workspace_issues i ON i.id = si.issue_id WHERE si.sprint_id = s.id) AS total_points,
            (SELECT COALESCE(SUM(i.estimate_points),0) FROM workspace_sprint_issues si
             JOIN workspace_issues i ON i.id = si.issue_id
             WHERE si.sprint_id = s.id AND (i.state = 'done' OR i.is_done = 1)) AS done_points
     FROM workspace_sprints s
     ORDER BY (s.status='active') DESC, s.start_date DESC, s.id DESC
     LIMIT 20`
  );
  if (!rows.length) return `📋 No sprints in any app yet.`;
  const statusIcon = { active: '🏃', planning: '📝', completed: '✅', cancelled: '❌' };
  const lines = [`*All sprints — every project, 20 most recent*`, ''];

  // Group by app for readability
  const byApp = {};
  rows.forEach((s) => {
    const slug = String(s.app_slug || 'workspace').toLowerCase();
    if (!byApp[slug]) byApp[slug] = [];
    byApp[slug].push(s);
  });
  KNOWN_APPS.forEach((slug) => {
    const list = byApp[slug] || [];
    if (!list.length) return;
    lines.push(`*${md(APP_LABELS[slug])}* (${list.length})`);
    list.forEach((s) => {
      const icon = statusIcon[s.status] || '•';
      const pts = s.total_points > 0 ? `${s.done_points}/${s.total_points} pts` : '—';
      lines.push(`  ${icon} ${md(s.name)} — ${pts} · ${s.issue_count} issues`);
    });
    lines.push('');
  });
  return lines.join('\n').trim();
}

function cmdHelp(appSlug) {
  return [
    `*Workspace Bot — ${md(APP_LABELS[appSlug])}*`,
    '',
    'This-app commands:',
    '/sprint — active sprint summary',
    '/sprints — last 5 sprints in this app',
    '/overdue — overdue tasks in this app',
    '/late — last 5 late-reasons filed',
    '',
    'Cross-app commands (every project):',
    '/all — every project + its active sprint at a glance',
    '/sprints all — every sprint across every app',
    '',
    '/help — this list',
    '',
    `📍 dashboard: https://nigents.com/example/sprints.html?app=${appSlug}`,
  ].join('\n');
}

// ── Route registration ──────────────────────────────────────────────────
function registerTelegramBotRoutes(app) {
  // Health probe — anyone can hit, returns whether the bot is configured
  app.get('/api/webhooks/telegram/bot/health', (req, res) => {
    res.json({
      ok: true,
      bot_token: !!getBotToken(),
      registered_chats: KNOWN_APPS.reduce((m, slug) => {
        const k = `TELEGRAM_CHAT_ID_${slug.toUpperCase()}`;
        m[slug] = !!process.env[k];
        return m;
      }, {}),
    });
  });

  // The webhook Telegram POSTs to whenever a user messages the bot
  app.post('/api/webhooks/telegram/bot', async (req, res) => {
    // ALWAYS respond 200 to Telegram so they don't retry indefinitely
    // even if we hit an error processing the update.
    res.json({ ok: true });

    try {
      const update = req.body || {};
      const msg = update.message || update.edited_message || update.channel_post;
      if (!msg || !msg.text) return;

      const chatId = msg.chat && msg.chat.id;
      const text   = String(msg.text || '').trim();
      if (!chatId || !text.startsWith('/')) return;

      const token = getBotToken();
      if (!token) {
        logger.warn('[TelegramBot] TELEGRAM_BOT_TOKEN not set — ignoring command');
        return;
      }

      const appSlug = resolveAppFromChatId(chatId);
      if (!appSlug) {
        await telegramSend(chatId,
          `⚠️ This chat isn't registered with Workspace yet.\n\n` +
          `Ask the admin to set one of these on the server:\n` +
          KNOWN_APPS.map((a) => `  \`TELEGRAM_CHAT_ID_${a.toUpperCase()}=${chatId}\``).join('\n'),
          { token, disableWebPreview: true }
        ).catch(() => {});
        return;
      }

      // Parse the command — strip @botname suffix and lowercase
      const parts  = text.split(/\s+/);
      const cmd    = parts[0].toLowerCase().replace(/@[\w_]+$/, '');
      const arg1   = String(parts[1] || '').toLowerCase();
      // "/sprint all" or "/sprints all" → cross-app variants
      const wantAll = arg1 === 'all' || arg1 === '*';
      let reply;
      try {
        switch (cmd) {
          case '/sprint':
            reply = wantAll ? await cmdAll(db) : await cmdSprint(db, appSlug);
            break;
          case '/sprints':
            reply = wantAll ? await cmdAllSprints(db) : await cmdSprints(db, appSlug);
            break;
          case '/all':
          case '/projects':
          case '/apps':
            reply = await cmdAll(db);
            break;
          case '/overdue':
          case '/over':
            reply = await cmdOverdue(db, appSlug);
            break;
          case '/late':
          case '/reasons':
            reply = await cmdLate(db, appSlug);
            break;
          case '/help':
          case '/start':
            reply = cmdHelp(appSlug);
            break;
          default:
            // Silently ignore unknown commands so the bot doesn't spam
            return;
        }
      } catch (e) {
        logger.error('[TelegramBot] command %s failed: %s', cmd, e.message);
        reply = `❌ Sorry — command failed: ${e.message}`;
      }

      try {
        await telegramSend(chatId, reply, { token, disableWebPreview: false });
      } catch (sendErr) {
        logger.error('[TelegramBot] send to chat %s failed: %s', chatId, sendErr.message);
      }
    } catch (e) {
      logger.error('[TelegramBot] webhook handler: %s', e.message);
    }
  });

  logger.info && logger.info('[TelegramBot] routes registered: POST /api/webhooks/telegram/bot');
}

// Exported so other modules (e.g. the main Nigents bot in src/bot.js) can
// reuse the same sprint commands without duplicating the SQL/formatting.
module.exports = {
  registerTelegramBotRoutes,
  // Command renderers — return a Markdown string ready to send
  cmdSprint,
  cmdSprints,
  cmdOverdue,
  cmdLate,
  cmdAll,
  cmdAllSprints,
  // Constants useful for callers wanting to drive the same command set
  KNOWN_APPS,
  APP_LABELS,
};
