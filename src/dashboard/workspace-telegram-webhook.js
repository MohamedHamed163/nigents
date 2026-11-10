/**
 * GitLab pipeline → Telegram webhook bridge.
 *
 * Endpoint:
 *   POST /api/webhooks/gitlab/pipeline?app=<slug>
 *
 * GitLab posts pipeline events here; we verify the secret token, format
 * a message, and forward to Telegram. Per-app routing supported.
 *
 * Environment variables:
 *   TELEGRAM_BOT_TOKEN           — required, the bot's HTTP API token
 *   TELEGRAM_CHAT_ID             — global default chat (channel/group id)
 *   TELEGRAM_CHAT_ID_<APP>       — per-app override (e.g. TELEGRAM_CHAT_ID_TAWAZON)
 *   GITLAB_WEBHOOK_SECRET        — required, GitLab "Secret token" field
 *   TELEGRAM_FOREVER_PARSE_MODE  — 'Markdown' (default) or 'MarkdownV2' or 'HTML'
 *
 * Set these in your nigents .env file, then add the webhook in
 * GitLab → Settings → Webhooks with URL:
 *   https://nigents.com/api/webhooks/gitlab/pipeline?app=tawazon
 * and trigger: ✅ Pipeline events only.
 */

const https  = require('https');
const logger = require('../utils/logger');

// Simple in-memory dedup so we don't double-send when GitLab retries
const SEEN = new Map(); // key: `${pipeline_id}:${status}` → timestamp
const SEEN_TTL_MS = 10 * 60 * 1000;

function dedupKey(payload) {
  const pid = payload?.object_attributes?.id || payload?.pipeline?.id || '';
  const st  = payload?.object_attributes?.status || '';
  return `${pid}:${st}`;
}

function alreadySent(key) {
  const now = Date.now();
  // Sweep expired
  for (const [k, t] of SEEN) {
    if (now - t > SEEN_TTL_MS) SEEN.delete(k);
  }
  return SEEN.has(key);
}

function markSent(key) {
  SEEN.set(key, Date.now());
}

// ── Telegram sender ───────────────────────────────────────────────────────
function telegramSend(chatId, text, { token, parseMode, replyMarkup } = {}) {
  return new Promise((resolve, reject) => {
    if (!token) return reject(new Error('TELEGRAM_BOT_TOKEN not set'));
    if (!chatId) return reject(new Error('No chat_id configured for this app'));
    const body = JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: parseMode || 'Markdown',
      disable_web_page_preview: true,
      reply_markup: replyMarkup,
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
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve({ ok: true, raw: buf });
        } else {
          reject(new Error(`Telegram ${res.statusCode}: ${buf}`));
        }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ── Message formatter ─────────────────────────────────────────────────────
function durationLabel(ms) {
  if (!ms || ms <= 0) return null;
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return rem ? `${m}m ${rem}s` : `${m}m`;
}

// MarkdownV1-safe escape (no underscores in URL text etc.) — minimal
function md(text) {
  return String(text == null ? '' : text)
    .replace(/[\*\_\[\]`]/g, (c) => '\\' + c);
}

function statusBadge(status) {
  switch ((status || '').toLowerCase()) {
    case 'success':   return '✅ *passed*';
    case 'failed':    return '❌ *failed*';
    case 'canceled':  return '⚠️ *canceled*';
    case 'skipped':   return '⏭ *skipped*';
    case 'manual':    return '✋ *manual*';
    case 'pending':   return '⏳ *pending*';
    case 'running':   return '▶️ *running*';
    default:          return `*${md(status || 'unknown')}*`;
  }
}

function buildMessage(payload, appLabel) {
  const o = payload.object_attributes || payload.pipeline || {};
  const proj = payload.project || {};
  const user = payload.user || {};
  const commit = payload.commit || {};
  const builds = Array.isArray(payload.builds) ? payload.builds : [];
  const failedJob = builds.find(b => (b.status || '').toLowerCase() === 'failed');

  const lines = [];
  lines.push(`${statusBadge(o.status)} — *${md(appLabel)}* pipeline [#${o.id}](${o.url || `${proj.web_url || ''}/-/pipelines/${o.id}`})`);
  if (proj.path_with_namespace) lines.push(`📦 \`${md(proj.path_with_namespace)}\``);
  if (o.ref)        lines.push(`🌿 branch: \`${md(o.ref)}\``);
  if (commit.id)    lines.push(`🔧 commit: \`${md(String(commit.id).slice(0, 8))}\` — ${md((commit.title || commit.message || '').slice(0, 90))}`);
  if (user.name || user.username) lines.push(`👤 author: ${md(user.name || user.username)}`);

  const dur = durationLabel(
    o.duration ? o.duration * 1000 : (o.finished_at && o.created_at ? (new Date(o.finished_at) - new Date(o.created_at)) : null)
  );
  if (dur) lines.push(`⏱ duration: ${dur}`);

  if (failedJob) {
    lines.push('');
    lines.push(`💥 failed job: \`${md(failedJob.name || '')}\` (stage: \`${md(failedJob.stage || '')}\`)`);
    if (failedJob.id && proj.web_url) {
      lines.push(`[Open job log](${proj.web_url}/-/jobs/${failedJob.id})`);
    }
  }

  return lines.join('\n');
}

function buildButtons(payload) {
  const o = payload.object_attributes || payload.pipeline || {};
  const proj = payload.project || {};
  const url = o.url || (proj.web_url ? `${proj.web_url}/-/pipelines/${o.id}` : null);
  if (!url) return undefined;
  return {
    inline_keyboard: [[{ text: 'Open pipeline ↗', url }]],
  };
}

// ── Per-app chat resolver ─────────────────────────────────────────────────
function resolveChatId(appSlug) {
  if (appSlug) {
    const envKey = `TELEGRAM_CHAT_ID_${String(appSlug).toUpperCase()}`;
    if (process.env[envKey] && process.env[envKey].trim()) return process.env[envKey].trim();
  }
  return (process.env.TELEGRAM_CHAT_ID || '').trim();
}

function getBotToken() {
  return (process.env.TELEGRAM_BOT_TOKEN || '').trim();
}

function getWebhookSecret() {
  return (process.env.GITLAB_WEBHOOK_SECRET || '').trim();
}

// ── Route registration ────────────────────────────────────────────────────
const APP_LABELS = {
  workspace:      'Workspace',
  tawazon:     'Tawazon',
  droop:       'Droop',
  quickin:     'QuickIn',
};

function registerTelegramWebhookRoutes(app) {
  // Health probe — visible to anyone, returns whether the webhook is configured
  app.get('/api/webhooks/gitlab/pipeline/health', (req, res) => {
    res.json({
      ok: true,
      configured: {
        bot_token:       !!getBotToken(),
        webhook_secret:  !!getWebhookSecret(),
        default_chat:    !!process.env.TELEGRAM_CHAT_ID,
        per_app_chats:   ['WORKSPACE', 'TAWAZON', 'DROOP', 'QUICKIN']
          .reduce((m, app) => { m[app] = !!process.env[`TELEGRAM_CHAT_ID_${app}`]; return m; }, {}),
      },
    });
  });

  app.post('/api/webhooks/gitlab/pipeline', async (req, res) => {
    // 1. Verify secret
    const secret = getWebhookSecret();
    if (!secret) {
      logger.warn('[TelegramWebhook] GITLAB_WEBHOOK_SECRET not configured — rejecting all webhooks');
      return res.status(503).json({ ok: false, error: 'Webhook not configured on server' });
    }
    const sent = String(req.headers['x-gitlab-token'] || '').trim();
    if (sent !== secret) {
      logger.warn('[TelegramWebhook] Bad/missing X-Gitlab-Token (ip=%s)', req.ip);
      return res.status(401).json({ ok: false, error: 'Invalid secret token' });
    }

    // 2. Confirm event kind
    const payload = req.body || {};
    const kind = String(req.headers['x-gitlab-event'] || payload.object_kind || '').toLowerCase();
    if (!kind.includes('pipeline')) {
      // Quietly ignore anything that isn't a pipeline event
      return res.json({ ok: true, ignored: true, reason: `kind=${kind}` });
    }

    // 3. Resolve app
    const appSlugRaw = (req.query && req.query.app) || (payload.app) || 'workspace';
    const appSlug = String(appSlugRaw).toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 64) || 'workspace';
    const appLabel = APP_LABELS[appSlug] || appSlug;

    // 4. Filter terminal states only
    const status = String((payload.object_attributes || payload.pipeline || {}).status || '').toLowerCase();
    const TERMINAL = ['success', 'failed', 'canceled', 'manual', 'skipped'];
    if (!TERMINAL.includes(status)) {
      return res.json({ ok: true, ignored: true, reason: `status=${status}` });
    }

    // 5. De-dup
    const dKey = dedupKey(payload);
    if (alreadySent(dKey)) {
      return res.json({ ok: true, ignored: true, reason: 'duplicate' });
    }

    // 6. Format + send
    try {
      const token  = getBotToken();
      const chatId = resolveChatId(appSlug);
      if (!token)  return res.status(503).json({ ok: false, error: 'TELEGRAM_BOT_TOKEN missing' });
      if (!chatId) return res.status(503).json({ ok: false, error: `No chat_id configured for app "${appSlug}"` });

      const text = buildMessage(payload, appLabel);
      const replyMarkup = buildButtons(payload);
      const sendRes = await telegramSend(chatId, text, { token, parseMode: 'Markdown', replyMarkup });
      markSent(dKey);
      logger.info('[TelegramWebhook] sent app=%s status=%s pipeline=%s',
        appSlug, status, (payload.object_attributes || {}).id);
      res.json({ ok: true, app: appSlug, status, sent: true, telegram: sendRes });
    } catch (e) {
      logger.error('[TelegramWebhook] send failed: %s', e.message);
      res.status(502).json({ ok: false, error: e.message });
    }
  });

  logger.info('[TelegramWebhook] routes registered: POST /api/webhooks/gitlab/pipeline');
}

// ── Lightweight notification helper for non-pipeline events ──────────────
// Used by other Workspace modules (e.g. late-reason workflow) to ping the same
// per-app channel without re-implementing the HTTPS plumbing.
async function notifyApp(appSlug, text, { replyMarkup, parseMode } = {}) {
  const token  = getBotToken();
  const chatId = resolveChatId(appSlug);
  if (!token || !chatId) {
    return { ok: false, reason: !token ? 'no-bot-token' : 'no-chat-id' };
  }
  try {
    const res = await telegramSend(chatId, text, { token, parseMode: parseMode || 'Markdown', replyMarkup });
    return { ok: true, raw: res };
  } catch (e) {
    logger.error('[TelegramWebhook] notifyApp failed: %s', e.message);
    return { ok: false, error: e.message };
  }
}

module.exports = { registerTelegramWebhookRoutes, notifyApp };
