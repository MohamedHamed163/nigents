/**
 * Workspace fix-brief API — sheets + issues in MySQL (Nigents).
 * GET is public. Mutations require a valid Workspace user key (or legacy WORKSPACE_EDIT_SECRET).
 */

const db = require('../database/connection');
const logger = require('../utils/logger');
const { normalizeMediaArray, deleteUploadedFilesForIssueRow } = require('./workspace-issue-media');
const { requireUser, resolveUser } = require('./workspace-auth');
const { logAction } = require('./workspace-logger');

// Legacy alias so existing callers keep working
const requireWorkspaceEdit = requireUser;

function parseJsonField(raw, fallback) {
  if (raw == null || raw === '') return fallback;
  if (Array.isArray(raw)) return raw;
  try {
    const v = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return Array.isArray(v) ? v : fallback;
  } catch {
    return fallback;
  }
}

async function ensureWorkspaceTables() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS workspace_sheets (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      slug VARCHAR(64) NOT NULL UNIQUE,
      label VARCHAR(255) NOT NULL,
      platform_line VARCHAR(255) NULL,
      brief_title VARCHAR(500) NOT NULL,
      brief_subtitle TEXT,
      meta_date VARCHAR(128) NULL,
      meta_to VARCHAR(255) NULL,
      meta_from VARCHAR(255) NULL,
      status_label VARCHAR(128) NULL,
      sort_order INT NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  await db.query(`
    CREATE TABLE IF NOT EXISTS workspace_issues (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      sheet_slug VARCHAR(64) NOT NULL,
      sort_order INT NOT NULL DEFAULT 0,
      module VARCHAR(255) NULL,
      issue_type VARCHAR(128) NULL,
      sheet_status VARCHAR(128) NULL,
      attachments TEXT NULL,
      title VARCHAR(512) NOT NULL,
      priority ENUM('high','medium','low') NOT NULL DEFAULT 'medium',
      tags JSON,
      prompt_text MEDIUMTEXT NOT NULL,
      criteria JSON,
      issue_media JSON,
      is_done TINYINT(1) NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_workspace_sheet_sort (sheet_slug, sort_order)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  await db.query(`
    CREATE TABLE IF NOT EXISTS workspace_ai_roadmap (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      sort_order INT NOT NULL DEFAULT 0,
      priority VARCHAR(32) NOT NULL DEFAULT 'P2',
      title VARCHAR(512) NOT NULL,
      description MEDIUMTEXT,
      how_to MEDIUMTEXT,
      what_we_need MEDIUMTEXT,
      collaborate MEDIUMTEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_ai_roadmap_sort (sort_order)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  // ── Users ──────────────────────────────────────────────────────────────────
  await db.query(`
    CREATE TABLE IF NOT EXISTS workspace_users (
      id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      name        VARCHAR(255) NOT NULL,
      role        ENUM('admin','developer','designer','tester') NOT NULL DEFAULT 'developer',
      api_key     VARCHAR(64)  NOT NULL UNIQUE,
      is_active   TINYINT(1)   NOT NULL DEFAULT 1,
      created_by  INT UNSIGNED NULL,
      created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // ── Activity log ───────────────────────────────────────────────────────────
  await db.query(`
    CREATE TABLE IF NOT EXISTS workspace_activity_log (
      id           BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      user_id      INT UNSIGNED NULL,
      user_name    VARCHAR(255) NULL,
      user_role    VARCHAR(32)  NULL,
      action       VARCHAR(64)  NOT NULL,
      entity_type  VARCHAR(32)  NULL,
      entity_id    VARCHAR(64)  NULL,
      entity_title VARCHAR(512) NULL,
      sheet_slug   VARCHAR(64)  NULL,
      metadata     JSON         NULL,
      ip_address   VARCHAR(45)  NULL,
      created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_bal_created  (created_at),
      INDEX idx_bal_user     (user_id),
      INDEX idx_bal_sheet    (sheet_slug)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // ── Notifications ──────────────────────────────────────────────────────────
  await db.query(`
    CREATE TABLE IF NOT EXISTS workspace_notifications (
      id                BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      type              VARCHAR(64)  NULL,
      title             VARCHAR(512) NULL,
      message           TEXT         NULL,
      entity_type       VARCHAR(32)  NULL,
      entity_id         VARCHAR(64)  NULL,
      sheet_slug        VARCHAR(64)  NULL,
      triggered_by_id   INT UNSIGNED NULL,
      triggered_by_name VARCHAR(255) NULL,
      read_by           JSON         NULL,
      created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_bn_created (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // ── Builds ─────────────────────────────────────────────────────────────────
  await db.query(`
    CREATE TABLE IF NOT EXISTS workspace_builds (
      id               INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      platform         ENUM('android','ios','web','backend') NOT NULL,
      environment      ENUM('dev','staging','production')    NOT NULL DEFAULT 'dev',
      version          VARCHAR(32)  NULL,
      build_number     INT UNSIGNED NULL,
      file_path        VARCHAR(512) NOT NULL,
      file_name        VARCHAR(255) NULL,
      file_size        BIGINT UNSIGNED NULL,
      changelog        TEXT         NULL,
      uploaded_by_id   INT UNSIGNED NULL,
      uploaded_by_name VARCHAR(255) NULL,
      download_count   INT UNSIGNED NOT NULL DEFAULT 0,
      created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_bb_platform (platform, created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // ── Designs ────────────────────────────────────────────────────────────────
  await db.query(`
    CREATE TABLE IF NOT EXISTS workspace_designs (
      id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      title           VARCHAR(255) NOT NULL,
      platform        VARCHAR(64)  NULL,
      figma_url       VARCHAR(1024) NULL,
      description     TEXT          NULL,
      version         VARCHAR(32)   NULL,
      uploaded_by_id  INT UNSIGNED  NULL,
      sort_order      INT           NOT NULL DEFAULT 0,
      created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS workspace_canvas_positions (
      id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      issue_id   BIGINT UNSIGNED NOT NULL,
      sheet_slug VARCHAR(64) NOT NULL,
      x          FLOAT NOT NULL DEFAULT 0,
      y          FLOAT NOT NULL DEFAULT 0,
      UNIQUE KEY uq_cp_issue (issue_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  await db.query(`
    CREATE TABLE IF NOT EXISTS workspace_dependencies (
      id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      from_issue_id   BIGINT UNSIGNED NOT NULL,
      to_issue_id     BIGINT UNSIGNED NOT NULL,
      sheet_slug      VARCHAR(64) NOT NULL,
      created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_dep (from_issue_id, to_issue_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  logger.info('[Workspace] Tables ensured (including users, activity_log, notifications, builds, designs, canvas)');
}

/** Add Excel / bug-tracker columns on existing deployments (CREATE IF NOT EXISTS skips new columns). */
async function ensureWorkspaceIssueExtraColumns() {
  const table = 'workspace_issues';
  const cols = [
    ['module', 'VARCHAR(255) NULL'],
    ['issue_type', 'VARCHAR(128) NULL'],
    ['sheet_status', 'VARCHAR(128) NULL'],
    ['attachments', 'TEXT NULL'],
    ['issue_media', 'JSON NULL'],
  ];
  for (const [name, def] of cols) {
    const chk = await db.query(
      `SELECT COUNT(*) AS c FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
      [table, name]
    );
    if (Number(chk[0].c) === 0) {
      await db.query(`ALTER TABLE workspace_issues ADD COLUMN ${name} ${def}`);
      logger.info('[Workspace] Added column workspace_issues.%s', name);
    }
  }
}

/**
 * Multi-app migration: add `app_slug` to workspace_sheets and `app_scope` to workspace_users
 * so the same Workspace backend can serve Tawazon, Droop, QuickIn, etc.
 *
 * - app_slug on workspace_sheets identifies which app a sheet belongs to.
 *   Existing rows are migrated to 'workspace'. New apps get their own value.
 * - app_scope on workspace_users is a comma-separated list of app slugs the user
 *   may edit, or '*' for any app. Existing users default to 'workspace'.
 */
async function ensureMultiAppColumns() {
  // workspace_sheets.app_slug
  const sheetsCol = await db.query(
    `SELECT COUNT(*) AS c FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'workspace_sheets' AND COLUMN_NAME = 'app_slug'`
  );
  if (Number(sheetsCol[0].c) === 0) {
    await db.query(`ALTER TABLE workspace_sheets ADD COLUMN app_slug VARCHAR(64) NOT NULL DEFAULT 'workspace'`);
    await db.query(`UPDATE workspace_sheets SET app_slug='workspace' WHERE app_slug IS NULL OR app_slug=''`);
    logger.info('[Workspace] Added workspace_sheets.app_slug + back-filled existing rows to "workspace"');
  }
  // Composite index for fast per-app listings
  try {
    await db.query(`CREATE INDEX idx_workspace_sheets_app_sort ON workspace_sheets (app_slug, sort_order)`);
  } catch (e) { /* index already exists */ }

  // workspace_users.app_scope (CSV of slugs, or '*')
  const usersCol = await db.query(
    `SELECT COUNT(*) AS c FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'workspace_users' AND COLUMN_NAME = 'app_scope'`
  );
  if (Number(usersCol[0].c) === 0) {
    await db.query(`ALTER TABLE workspace_users ADD COLUMN app_scope VARCHAR(255) NOT NULL DEFAULT 'workspace'`);
    await db.query(`UPDATE workspace_users SET app_scope='*' WHERE role='admin'`);
    logger.info('[Workspace] Added workspace_users.app_scope (admins → "*", others → "workspace")');
  }

  // Phase 5: app_slug on builds / designs / ai_roadmap so they scope per-app
  const phase5Tables = ['workspace_builds', 'workspace_designs', 'workspace_ai_roadmap'];
  for (const tableName of phase5Tables) {
    const exists = await db.query(
      `SELECT COUNT(*) AS c FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = 'app_slug'`,
      [tableName]
    );
    if (Number(exists[0].c) === 0) {
      await db.query(`ALTER TABLE ${tableName} ADD COLUMN app_slug VARCHAR(64) NOT NULL DEFAULT 'workspace'`);
      await db.query(`UPDATE ${tableName} SET app_slug='workspace' WHERE app_slug IS NULL OR app_slug=''`);
      try { await db.query(`CREATE INDEX idx_${tableName}_app ON ${tableName} (app_slug)`); } catch (_) {}
      logger.info('[Workspace] Added %s.app_slug + back-filled to "workspace"', tableName);
    }
  }
}

/**
 * Resolve the target app for a request. Reads ?app= from query, body.app, or
 * x-workspace-app header. Falls back to 'workspace' for backwards compatibility.
 */
function extractAppSlug(req) {
  const raw =
    (req && req.query && req.query.app) ||
    (req && req.body  && req.body.app)  ||
    (req && req.headers && req.headers['x-workspace-app']) ||
    'workspace';
  return String(raw).toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 64) || 'workspace';
}

const VALID_APPS = ['workspace', 'tawazon', 'droop', 'quickin'];

function isValidAppSlug(s) {
  return VALID_APPS.includes(String(s || '').toLowerCase());
}

/** Tracks Excel import runs so a mistaken target sheet can be reverted in one step. */
async function ensureWorkspaceExcelImportBatchesTable() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS workspace_excel_import_batches (
      id CHAR(36) NOT NULL PRIMARY KEY,
      sheet_slug VARCHAR(64) NOT NULL,
      issue_ids JSON NOT NULL,
      issue_count INT UNSIGNED NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_workspace_excel_batch_sheet (sheet_slug)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

async function ensureWorkspaceSmartImportBatchesTable() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS workspace_smart_import_batches (
      id CHAR(36) NOT NULL PRIMARY KEY,
      issue_ids JSON NOT NULL,
      breakdown JSON NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

/**
 * Phase 1 — Sprint planning tables + issue columns.
 * Idempotent: safe to run on every boot. Pre-existing Workspace data is
 * untouched; new fields default to NULL / 'backlog'.
 */
async function ensureSprintTables() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS workspace_sprints (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      app_slug VARCHAR(64) NOT NULL DEFAULT 'workspace',
      name VARCHAR(255) NOT NULL,
      goal TEXT NULL,
      status ENUM('planning','active','completed','cancelled') NOT NULL DEFAULT 'planning',
      start_date DATE NULL,
      end_date DATE NULL,
      capacity_points INT UNSIGNED NULL,
      created_by INT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      closed_at TIMESTAMP NULL,
      INDEX idx_workspace_sprints_app_status (app_slug, status),
      INDEX idx_workspace_sprints_dates (start_date, end_date)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  await db.query(`
    CREATE TABLE IF NOT EXISTS workspace_sprint_issues (
      sprint_id INT UNSIGNED NOT NULL,
      issue_id BIGINT UNSIGNED NOT NULL,
      added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      added_by INT NULL,
      PRIMARY KEY (sprint_id, issue_id),
      INDEX idx_bsi_issue (issue_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // Additive columns on workspace_issues — checked one-by-one so re-runs are no-ops
  const issueCols = [
    ['assignee_id',      'INT NULL'],
    ['estimate_points',  'TINYINT UNSIGNED NULL'],
    ['start_date',       'DATE NULL'],   // planned start (Batch: late-reason workflow)
    ['due_date',         'DATE NULL'],   // planned end / deadline
    ['state',            "ENUM('backlog','todo','in_progress','in_review','done','cancelled') NOT NULL DEFAULT 'backlog'"],
    ['started_at',       'TIMESTAMP NULL'],
    ['completed_at',     'TIMESTAMP NULL'],
    ['overdue_notified_at', 'TIMESTAMP NULL'], // last time admin was pinged for this overdue item — prevents spam
  ];
  for (const [name, def] of issueCols) {
    const chk = await db.query(
      `SELECT COUNT(*) AS c FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'workspace_issues' AND COLUMN_NAME = ?`,
      [name]
    );
    if (Number(chk[0].c) === 0) {
      await db.query(`ALTER TABLE workspace_issues ADD COLUMN ${name} ${def}`);
      logger.info('[Workspace] Added column workspace_issues.%s', name);
    }
  }
  // Index for "issues by assignee / by state" queries
  try { await db.query(`CREATE INDEX idx_workspace_issues_assignee ON workspace_issues (assignee_id)`); } catch (_) {}
  try { await db.query(`CREATE INDEX idx_workspace_issues_state ON workspace_issues (state)`); } catch (_) {}

  // Phase 2.1 — Issue comments
  await db.query(`
    CREATE TABLE IF NOT EXISTS workspace_issue_comments (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      issue_id BIGINT UNSIGNED NOT NULL,
      app_slug VARCHAR(64) NOT NULL DEFAULT 'workspace',
      user_id INT NULL,
      user_name VARCHAR(255) NULL,
      user_role VARCHAR(32) NULL,
      body MEDIUMTEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      edited_at TIMESTAMP NULL,
      INDEX idx_bic_issue_created (issue_id, created_at),
      INDEX idx_bic_app (app_slug)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // Batch: late-reason workflow — assignee explains why a task slipped past due_date.
  // Admin sees these as a thread on the issue + receives a Telegram alert per submission.
  await db.query(`
    CREATE TABLE IF NOT EXISTS workspace_issue_late_reasons (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      issue_id BIGINT UNSIGNED NOT NULL,
      app_slug VARCHAR(64) NOT NULL DEFAULT 'workspace',
      user_id INT NULL,
      user_name VARCHAR(255) NULL,
      user_role VARCHAR(32) NULL,
      old_due_date DATE NULL,
      new_due_date DATE NULL,
      reason MEDIUMTEXT NOT NULL,
      submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_bilr_issue (issue_id, submitted_at),
      INDEX idx_bilr_app (app_slug)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

const DEFAULT_SHEETS = [
  {
    slug: 'android',
    label: 'Workspace',
    platform_line: 'Android Application',
    brief_title: 'Android App — Developer Fix Brief',
    brief_subtitle: 'Add Android issues below. Each issue contains a developer prompt with requirements and acceptance criteria.',
    meta_date: null,
    meta_to: 'Android Developer',
    meta_from: 'Project Manager',
    status_label: 'Draft',
    sort_order: 1,
  },
  {
    slug: 'ios',
    label: 'Workspace',
    platform_line: 'iOS Application',
    brief_title: 'iOS App — Developer Fix Brief',
    brief_subtitle: 'Add iOS issues below. Use the same prompt + criteria pattern as Android.',
    meta_date: null,
    meta_to: 'iOS Developer',
    meta_from: 'Project Manager',
    status_label: 'Draft',
    sort_order: 2,
  },
  {
    slug: 'web',
    label: 'Workspace',
    platform_line: 'Web Application',
    brief_title: 'Web App — Developer Fix Brief',
    brief_subtitle: 'Track web front-end and client issues here.',
    meta_date: null,
    meta_to: 'Web Developer',
    meta_from: 'Project Manager',
    status_label: 'Draft',
    sort_order: 3,
  },
  {
    slug: 'backend',
    label: 'Workspace',
    platform_line: 'Backend / API',
    brief_title: 'Backend — Developer Fix Brief',
    brief_subtitle: 'API, services, and server-side fixes.',
    meta_date: null,
    meta_to: 'Backend Developer',
    meta_from: 'Project Manager',
    status_label: 'Draft',
    sort_order: 4,
  },
];

async function seedSheetsIfEmpty() {
  const rows = await db.query('SELECT COUNT(*) AS c FROM workspace_sheets');
  const c = rows[0] && rows[0].c;
  if (c > 0) return;
  for (const s of DEFAULT_SHEETS) {
    await db.query(
      `INSERT INTO workspace_sheets (slug, label, platform_line, brief_title, brief_subtitle, meta_date, meta_to, meta_from, status_label, sort_order)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [
        s.slug,
        s.label,
        s.platform_line,
        s.brief_title,
        s.brief_subtitle,
        s.meta_date,
        s.meta_to,
        s.meta_from,
        s.status_label,
        s.sort_order,
      ]
    );
  }
  logger.info('[Workspace] Seeded default sheets');
}

/**
 * Default sheet templates per app. Workspace is unchanged; new apps each
 * get 3 starter sheets (Web / Mobile / Backend) so users can immediately
 * file issues without configuring anything.
 */
const APP_SHEET_TEMPLATES = {
  tawazon: [
    { slug: 'tawazon-web',     platform: 'Web',     order: 1 },
    { slug: 'tawazon-mobile',  platform: 'Mobile',  order: 2 },
    { slug: 'tawazon-backend', platform: 'Backend', order: 3 },
  ],
  droop: [
    { slug: 'droop-web',     platform: 'Web',     order: 1 },
    { slug: 'droop-mobile',  platform: 'Mobile',  order: 2 },
    { slug: 'droop-backend', platform: 'Backend', order: 3 },
  ],
  quickin: [
    { slug: 'quickin-web',     platform: 'Web',     order: 1 },
    { slug: 'quickin-mobile',  platform: 'Mobile',  order: 2 },
    { slug: 'quickin-backend', platform: 'Backend', order: 3 },
  ],
};

const APP_LABELS = {
  workspace:      'Workspace',
  tawazon:     'Tawazon',
  droop:       'Droop',
  quickin:     'QuickIn',
};

/** Seed starter sheets for the new sister-apps. Idempotent — runs every boot. */
async function seedNewAppSheets() {
  for (const [appSlug, sheets] of Object.entries(APP_SHEET_TEMPLATES)) {
    const label = APP_LABELS[appSlug];
    for (const s of sheets) {
      const existing = await db.query(
        'SELECT slug FROM workspace_sheets WHERE slug = ? LIMIT 1',
        [s.slug]
      );
      if (existing.length > 0) continue;
      await db.query(
        `INSERT INTO workspace_sheets
           (slug, app_slug, label, platform_line, brief_title, brief_subtitle,
            meta_date, meta_to, meta_from, status_label, sort_order)
         VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
        [
          s.slug, appSlug, label, `${s.platform} Application`,
          `${label} — ${s.platform} Developer Fix Brief`,
          `Track ${s.platform.toLowerCase()} issues here. Use the same prompt + criteria pattern as the other sheets.`,
          null, `${s.platform} Developer`, 'Project Manager',
          'Draft', s.order,
        ]
      );
      logger.info('[Workspace] Seeded sheet %s for app %s', s.slug, appSlug);
    }
  }
}

async function initWorkspaceData() {
  try {
    await ensureWorkspaceTables();
    await ensureWorkspaceIssueExtraColumns();
    await ensureWorkspaceExcelImportBatchesTable();
    await ensureWorkspaceSmartImportBatchesTable();
    await ensureMultiAppColumns();    // adds app_slug + app_scope columns
    await ensureSprintTables();       // Phase 1: sprints + sprint_issues + assignee/state/estimate columns
    await seedSheetsIfEmpty();
    await seedNewAppSheets();         // seeds default sheets for the 3 new apps
  } catch (e) {
    logger.error('[Workspace] Init failed:', e.message);
  }
}

function rowToIssue(r) {
  return {
    id: r.id,
    sort_order: r.sort_order,
    module: r.module != null ? r.module : null,
    issue_type: r.issue_type != null ? r.issue_type : null,
    sheet_status: r.sheet_status != null ? r.sheet_status : null,
    attachments: r.attachments != null ? r.attachments : null,
    title: r.title,
    priority: r.priority,
    tags: parseJsonField(r.tags, []),
    prompt_text: r.prompt_text,
    criteria: parseJsonField(r.criteria, []),
    issue_media: normalizeMediaArray(parseJsonField(r.issue_media, [])),
    is_done: !!r.is_done,
    // Phase 1 sprint fields
    sheet_slug:        r.sheet_slug || null,
    assignee_id:       r.assignee_id != null ? Number(r.assignee_id) : null,
    assignee_name:     r.assignee_name || null,
    estimate_points:   r.estimate_points != null ? Number(r.estimate_points) : null,
    start_date:        r.start_date || null,
    due_date:          r.due_date || null,
    state:             r.state || 'backlog',
    started_at:        r.started_at || null,
    completed_at:      r.completed_at || null,
    sheet_label:       r.sheet_label || null,
    sheet_platform:    r.sheet_platform || null,
  };
}

function rowToRoadmap(r) {
  return {
    id: r.id,
    sort_order: r.sort_order,
    priority: r.priority,
    title: r.title,
    description: r.description || '',
    how_to: r.how_to || '',
    what_we_need: r.what_we_need || '',
    collaborate: r.collaborate || '',
  };
}

/**
 * Returns true if the user can edit data for the given app.
 * - admins always pass
 * - env/legacy admin keys always pass
 * - named users must list the app in their app_scope CSV (or have '*')
 */
function userHasAppAccess(user, appSlug) {
  if (!user) return false;
  if (user.role === 'admin') return true;
  const scope = String(user.app_scope || 'workspace').trim();
  if (scope === '*') return true;
  return scope.split(',').map(s => s.trim().toLowerCase()).includes(String(appSlug).toLowerCase());
}

/** Resolve the app a sheet belongs to (cached per request would be nicer; small queries here). */
async function lookupSheetApp(sheetSlug) {
  const rows = await db.query('SELECT app_slug FROM workspace_sheets WHERE slug = ? LIMIT 1', [sheetSlug]);
  return rows.length ? String(rows[0].app_slug || 'workspace') : null;
}

/** Resolve the app a single issue belongs to (via its sheet). */
async function lookupIssueApp(issueId) {
  const rows = await db.query(
    `SELECT s.app_slug FROM workspace_issues i
     JOIN workspace_sheets s ON s.slug = i.sheet_slug
     WHERE i.id = ? LIMIT 1`, [issueId]
  );
  return rows.length ? String(rows[0].app_slug || 'workspace') : null;
}

function registerWorkspaceRoutes(app) {
  app.get('/api/workspace/sheets', async (req, res) => {
    try {
      const appSlug = extractAppSlug(req);
      const rows = await db.query(
        `SELECT slug, app_slug, label, platform_line, brief_title, brief_subtitle, sort_order
         FROM workspace_sheets
         WHERE app_slug = ?
         ORDER BY sort_order ASC, slug ASC`,
        [appSlug]
      );
      res.json({ success: true, app: appSlug, sheets: rows });
    } catch (e) {
      logger.error('[Workspace] list sheets:', e.message);
      res.status(500).json({ success: false, error: e.message });
    }
  });

  // ── List all apps that have at least one sheet (for app switchers) ────────
  app.get('/api/workspace/apps', async (req, res) => {
    try {
      const rows = await db.query(
        `SELECT app_slug, COUNT(*) AS sheet_count
         FROM workspace_sheets GROUP BY app_slug ORDER BY app_slug ASC`
      );
      res.json({
        success: true,
        apps: rows.map(r => ({
          slug: r.app_slug,
          label: APP_LABELS[r.app_slug] || r.app_slug,
          sheet_count: Number(r.sheet_count),
        })),
      });
    } catch (e) {
      logger.error('[Workspace] list apps:', e.message);
      res.status(500).json({ success: false, error: e.message });
    }
  });

  app.post('/api/workspace/sheets', requireWorkspaceEdit, async (req, res) => {
    try {
      const appSlug = extractAppSlug(req);
      if (!isValidAppSlug(appSlug)) {
        return res.status(400).json({ success: false, error: `Unknown app "${appSlug}"` });
      }
      // Auth scope check
      const user = req.workspaceUser;
      if (user && !userHasAppAccess(user, appSlug)) {
        return res.status(403).json({ success: false, error: `Your key has no access to app "${appSlug}"` });
      }
      const {
        slug,
        label,
        platform_line,
        brief_title,
        brief_subtitle,
        meta_date,
        meta_to,
        meta_from,
        status_label,
        sort_order,
      } = req.body || {};
      if (!slug || !label || !brief_title) {
        return res.status(400).json({ success: false, error: 'slug, label, and brief_title are required' });
      }
      const clean = String(slug)
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, '-')
        .replace(/-+/g, '-');
      await db.query(
        `INSERT INTO workspace_sheets (slug, app_slug, label, platform_line, brief_title, brief_subtitle, meta_date, meta_to, meta_from, status_label, sort_order)
         VALUES (?,?,?,?,?,?,?,?,?,?,?)
         ON DUPLICATE KEY UPDATE
         app_slug=VALUES(app_slug), label=VALUES(label), platform_line=VALUES(platform_line), brief_title=VALUES(brief_title),
         brief_subtitle=VALUES(brief_subtitle), meta_date=VALUES(meta_date), meta_to=VALUES(meta_to),
         meta_from=VALUES(meta_from), status_label=VALUES(status_label), sort_order=VALUES(sort_order)`,
        [
          clean,
          appSlug,
          label,
          platform_line || null,
          brief_title,
          brief_subtitle || null,
          meta_date || null,
          meta_to || null,
          meta_from || null,
          status_label || 'Draft',
          Number(sort_order) || 99,
        ]
      );
      res.json({ success: true, slug: clean, app: appSlug });
    } catch (e) {
      logger.error('[Workspace] create sheet:', e.message);
      res.status(500).json({ success: false, error: e.message });
    }
  });

  app.get('/api/workspace/sheets/:slug', async (req, res) => {
    try {
      const slug = String(req.params.slug || '').toLowerCase();
      const sheets = await db.query('SELECT * FROM workspace_sheets WHERE slug = ? LIMIT 1', [slug]);
      if (!sheets.length) {
        return res.status(404).json({ success: false, error: 'Sheet not found' });
      }
      const sheet = sheets[0];
      const issues = await db.query(
        'SELECT * FROM workspace_issues WHERE sheet_slug = ? ORDER BY sort_order ASC, id ASC',
        [slug]
      );
      res.json({
        success: true,
        sheet: {
          slug: sheet.slug,
          label: sheet.label,
          platform_line: sheet.platform_line,
          brief_title: sheet.brief_title,
          brief_subtitle: sheet.brief_subtitle,
          meta_date: sheet.meta_date,
          meta_to: sheet.meta_to,
          meta_from: sheet.meta_from,
          status_label: sheet.status_label,
        },
        issues: issues.map(rowToIssue),
      });
    } catch (e) {
      logger.error('[Workspace] get sheet:', e.message);
      res.status(500).json({ success: false, error: e.message });
    }
  });

  app.post('/api/workspace/sheets/:slug/issues', requireWorkspaceEdit, async (req, res) => {
    try {
      const slug = String(req.params.slug || '').toLowerCase();
      const sh = await db.query('SELECT slug, app_slug FROM workspace_sheets WHERE slug=?', [slug]);
      if (!sh.length) {
        return res.status(404).json({ success: false, error: 'Sheet not found' });
      }
      // Enforce per-app scope: user must have access to this sheet's app
      const sheetApp = String(sh[0].app_slug || 'workspace');
      if (req.workspaceUser && !userHasAppAccess(req.workspaceUser, sheetApp)) {
        return res.status(403).json({ success: false, error: `Your key has no access to app "${sheetApp}"` });
      }
      const {
        title,
        priority,
        tags,
        prompt_text,
        criteria,
        sort_order,
        module,
        issue_type,
        sheet_status,
        attachments,
        issue_media,
      } = req.body || {};
      if (!title || !prompt_text) {
        return res.status(400).json({ success: false, error: 'title and prompt_text required' });
      }
      const pri = ['high', 'medium', 'low'].includes(priority) ? priority : 'medium';
      const maxRows = await db.query(
        'SELECT COALESCE(MAX(sort_order),0)+1 AS n FROM workspace_issues WHERE sheet_slug=?',
        [slug]
      );
      const ord = Number(sort_order) || maxRows[0].n;
      const mediaJson = JSON.stringify(normalizeMediaArray(Array.isArray(issue_media) ? issue_media : []));
      const r = await db.query(
        `INSERT INTO workspace_issues (sheet_slug, sort_order, module, issue_type, sheet_status, attachments, title, priority, tags, prompt_text, criteria, issue_media, is_done)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,0)`,
        [
          slug,
          ord,
          module != null ? String(module).slice(0, 255) : null,
          issue_type != null ? String(issue_type).slice(0, 128) : null,
          sheet_status != null ? String(sheet_status).slice(0, 128) : null,
          attachments != null ? String(attachments) : null,
          title,
          pri,
          JSON.stringify(Array.isArray(tags) ? tags : []),
          prompt_text,
          JSON.stringify(Array.isArray(criteria) ? criteria : []),
          mediaJson,
        ]
      );
      await resolveUser(req);
      logAction(req, {
        action: 'issue.created', entityType: 'issue',
        entityId: String(r.insertId), entityTitle: title, sheetSlug: slug,
        metadata: { priority: pri },
      }).catch(() => {});
      res.json({ success: true, id: r.insertId });
    } catch (e) {
      logger.error('[Workspace] add issue:', e.message);
      res.status(500).json({ success: false, error: e.message });
    }
  });

  app.post('/api/workspace/sheets/:slug/issues/batch-delete', requireWorkspaceEdit, async (req, res) => {
    try {
      const slug = String(req.params.slug || '').toLowerCase();
      const rawIds = (req.body && req.body.ids) || [];
      if (!Array.isArray(rawIds) || rawIds.length === 0) {
        return res.status(400).json({ success: false, error: 'body.ids must be a non-empty array of issue ids' });
      }
      const ids = [...new Set(rawIds.map((x) => Number(x)).filter((n) => n > 0))];
      if (!ids.length) {
        return res.status(400).json({ success: false, error: 'No valid numeric ids' });
      }
      const sh = await db.query('SELECT slug FROM workspace_sheets WHERE slug=?', [slug]);
      if (!sh.length) {
        return res.status(404).json({ success: false, error: 'Sheet not found' });
      }
      const ph = ids.map(() => '?').join(',');
      const found = await db.query(
        `SELECT * FROM workspace_issues WHERE sheet_slug=? AND id IN (${ph})`,
        [slug, ...ids]
      );
      if (!found.length) {
        return res.json({ success: true, deleted: 0, ids: [] });
      }
      for (const row of found) {
        deleteUploadedFilesForIssueRow(row);
      }
      const delIds = found.map((r) => r.id);
      const ph2 = delIds.map(() => '?').join(',');
      await db.query(`DELETE FROM workspace_issues WHERE sheet_slug=? AND id IN (${ph2})`, [slug, ...delIds]);
      logger.info('[Workspace] batch-delete slug=%s count=%d', slug, delIds.length);
      res.json({ success: true, deleted: delIds.length, ids: delIds });
    } catch (e) {
      logger.error('[Workspace] batch-delete:', e.message);
      res.status(500).json({ success: false, error: e.message });
    }
  });

  app.patch('/api/workspace/issues/:id/migrate', requireWorkspaceEdit, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const target = String((req.body && req.body.sheet_slug) || '').toLowerCase().trim();
      if (!target) {
        return res.status(400).json({ success: false, error: 'sheet_slug is required' });
      }
      const cur = await db.query('SELECT id, sheet_slug FROM workspace_issues WHERE id=?', [id]);
      if (!cur.length) {
        return res.status(404).json({ success: false, error: 'Issue not found' });
      }
      const fromSlug = cur[0].sheet_slug;
      if (fromSlug === target) {
        return res.status(400).json({ success: false, error: 'Issue is already on that sheet' });
      }
      const sh = await db.query('SELECT slug FROM workspace_sheets WHERE slug=?', [target]);
      if (!sh.length) {
        return res.status(404).json({ success: false, error: 'Target sheet not found' });
      }
      const maxRows = await db.query(
        'SELECT COALESCE(MAX(sort_order),0)+1 AS n FROM workspace_issues WHERE sheet_slug=?',
        [target]
      );
      const ord = Number(maxRows[0].n) || 1;
      await db.query('UPDATE workspace_issues SET sheet_slug=?, sort_order=? WHERE id=?', [target, ord, id]);
      logger.info('[Workspace] migrated issue %s to sheet %s', id, target);
      res.json({ success: true, id, sheet_slug: target, previous_sheet_slug: fromSlug });
    } catch (e) {
      logger.error('[Workspace] migrate issue:', e.message);
      res.status(500).json({ success: false, error: e.message });
    }
  });

  app.patch('/api/workspace/issues/:id', requireWorkspaceEdit, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const body = req.body || {};
      const cur = await db.query('SELECT * FROM workspace_issues WHERE id=?', [id]);
      if (!cur.length) {
        return res.status(404).json({ success: false, error: 'Issue not found' });
      }
      // Enforce per-app scope via this issue's sheet
      const sheetApp = await lookupIssueApp(id);
      if (sheetApp && req.workspaceUser && !userHasAppAccess(req.workspaceUser, sheetApp)) {
        return res.status(403).json({ success: false, error: `Your key has no access to app "${sheetApp}"` });
      }
      const row = cur[0];
      const title = body.title != null ? body.title : row.title;
      const priority = ['high', 'medium', 'low'].includes(body.priority) ? body.priority : row.priority;
      const prompt_text = body.prompt_text != null ? body.prompt_text : row.prompt_text;
      const tags = body.tags != null ? JSON.stringify(body.tags) : row.tags;
      const criteria = body.criteria != null ? JSON.stringify(body.criteria) : row.criteria;
      const sort_order = body.sort_order != null ? Number(body.sort_order) : row.sort_order;
      const is_done = body.is_done != null ? (body.is_done ? 1 : 0) : row.is_done;
      const module =
        body.module !== undefined ? (body.module ? String(body.module).slice(0, 255) : null) : row.module;
      const issue_type =
        body.issue_type !== undefined
          ? body.issue_type
            ? String(body.issue_type).slice(0, 128)
            : null
          : row.issue_type;
      const sheet_status =
        body.sheet_status !== undefined
          ? body.sheet_status
            ? String(body.sheet_status).slice(0, 128)
            : null
          : row.sheet_status;
      const attachments =
        body.attachments !== undefined
          ? body.attachments
            ? String(body.attachments)
            : null
          : row.attachments;
      let issue_media;
      if (body.issue_media !== undefined) {
        issue_media = JSON.stringify(normalizeMediaArray(body.issue_media));
      } else if (row.issue_media == null) {
        issue_media = null;
      } else if (typeof row.issue_media === 'string') {
        issue_media = row.issue_media;
      } else {
        issue_media = JSON.stringify(row.issue_media);
      }
      await db.query(
        `UPDATE workspace_issues SET title=?, priority=?, prompt_text=?, tags=?, criteria=?, sort_order=?, is_done=?,
         module=?, issue_type=?, sheet_status=?, attachments=?, issue_media=? WHERE id=?`,
        [
          title,
          priority,
          prompt_text,
          tags,
          criteria,
          sort_order,
          is_done,
          module,
          issue_type,
          sheet_status,
          attachments,
          issue_media,
          id,
        ]
      );
      // Determine which action to log
      let loggedAction = 'issue.updated';
      if (body.is_done != null && row.is_done !== is_done) {
        loggedAction = is_done ? 'issue.status.done' : 'issue.status.open';
      } else if (body.sheet_status === 'in_progress') {
        loggedAction = 'issue.status.in_progress';
      }
      await resolveUser(req);
      logAction(req, {
        action: loggedAction, entityType: 'issue',
        entityId: String(id), entityTitle: title, sheetSlug: row.sheet_slug,
        metadata: { priority, is_done },
      }).catch(() => {});
      res.json({ success: true });
    } catch (e) {
      logger.error('[Workspace] patch issue:', e.message);
      res.status(500).json({ success: false, error: e.message });
    }
  });

  app.delete('/api/workspace/issues/:id', requireWorkspaceEdit, async (req, res) => {
    try {
      const id = Number(req.params.id);
      // Enforce per-app scope before deleting
      const sheetApp = await lookupIssueApp(id);
      if (sheetApp && req.workspaceUser && !userHasAppAccess(req.workspaceUser, sheetApp)) {
        return res.status(403).json({ success: false, error: `Your key has no access to app "${sheetApp}"` });
      }
      const cur = await db.query('SELECT * FROM workspace_issues WHERE id=?', [id]);
      if (cur.length) {
        deleteUploadedFilesForIssueRow(cur[0]);
      }
      await db.query('DELETE FROM workspace_issues WHERE id=?', [id]);
      const deleted = cur[0] || {};
      await resolveUser(req);
      logAction(req, {
        action: 'issue.deleted', entityType: 'issue',
        entityId: String(id), entityTitle: deleted.title || '', sheetSlug: deleted.sheet_slug || null,
      }).catch(() => {});
      res.json({ success: true });
    } catch (e) {
      logger.error('[Workspace] delete issue:', e.message);
      res.status(500).json({ success: false, error: e.message });
    }
  });

  app.delete('/api/workspace/sheets/:slug/issues', requireWorkspaceEdit, async (req, res) => {
    try {
      const slug = String(req.params.slug || '').toLowerCase();
      const sh = await db.query('SELECT slug FROM workspace_sheets WHERE slug=?', [slug]);
      if (!sh.length) {
        return res.status(404).json({ success: false, error: 'Sheet not found' });
      }
      const toClear = await db.query('SELECT * FROM workspace_issues WHERE sheet_slug=?', [slug]);
      for (const row of toClear) {
        deleteUploadedFilesForIssueRow(row);
      }
      const result = await db.query('DELETE FROM workspace_issues WHERE sheet_slug=?', [slug]);
      const deleted = result.affectedRows != null ? result.affectedRows : 0;
      res.json({ success: true, deleted });
    } catch (e) {
      logger.error('[Workspace] delete all issues:', e.message);
      res.status(500).json({ success: false, error: e.message });
    }
  });

  app.get('/api/workspace/ai-roadmap', async (req, res) => {
    try {
      const appSlug = extractAppSlug(req);
      const rows = await db.query(
        'SELECT * FROM workspace_ai_roadmap WHERE app_slug = ? ORDER BY sort_order ASC, id ASC',
        [appSlug]
      );
      res.json({ success: true, app: appSlug, items: rows.map(rowToRoadmap) });
    } catch (e) {
      logger.error('[Workspace] ai-roadmap list:', e.message);
      res.status(500).json({ success: false, error: e.message });
    }
  });

  app.post('/api/workspace/ai-roadmap', requireWorkspaceEdit, async (req, res) => {
    try {
      const appSlug = extractAppSlug(req);
      if (req.workspaceUser && !userHasAppAccess(req.workspaceUser, appSlug)) {
        return res.status(403).json({ success: false, error: `Your key has no access to app "${appSlug}"` });
      }
      const { title, priority, description, how_to, what_we_need, collaborate, sort_order } = req.body || {};
      if (!title || !String(title).trim()) {
        return res.status(400).json({ success: false, error: 'title required' });
      }
      const pri = String(priority || 'P2').slice(0, 32);
      const maxRows = await db.query(
        'SELECT COALESCE(MAX(sort_order),0)+1 AS n FROM workspace_ai_roadmap WHERE app_slug = ?',
        [appSlug]
      );
      const ord = Number(sort_order) || maxRows[0].n;
      const r = await db.query(
        `INSERT INTO workspace_ai_roadmap (app_slug, sort_order, priority, title, description, how_to, what_we_need, collaborate)
         VALUES (?,?,?,?,?,?,?,?)`,
        [
          appSlug,
          ord,
          pri,
          String(title).slice(0, 512),
          description != null ? String(description) : null,
          how_to != null ? String(how_to) : null,
          what_we_need != null ? String(what_we_need) : null,
          collaborate != null ? String(collaborate) : null,
        ]
      );
      res.json({ success: true, id: r.insertId, app: appSlug });
    } catch (e) {
      logger.error('[Workspace] ai-roadmap create:', e.message);
      res.status(500).json({ success: false, error: e.message });
    }
  });

  app.patch('/api/workspace/ai-roadmap/:id', requireWorkspaceEdit, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const body = req.body || {};
      const cur = await db.query('SELECT * FROM workspace_ai_roadmap WHERE id=?', [id]);
      if (!cur.length) {
        return res.status(404).json({ success: false, error: 'Item not found' });
      }
      // Enforce scope against the row's app
      const rowApp = String(cur[0].app_slug || 'workspace');
      if (req.workspaceUser && !userHasAppAccess(req.workspaceUser, rowApp)) {
        return res.status(403).json({ success: false, error: `Your key has no access to app "${rowApp}"` });
      }
      const row = cur[0];
      const title = body.title != null ? String(body.title).slice(0, 512) : row.title;
      const priority = body.priority != null ? String(body.priority).slice(0, 32) : row.priority;
      const description = body.description !== undefined ? body.description : row.description;
      const how_to = body.how_to !== undefined ? body.how_to : row.how_to;
      const what_we_need = body.what_we_need !== undefined ? body.what_we_need : row.what_we_need;
      const collaborate = body.collaborate !== undefined ? body.collaborate : row.collaborate;
      const sort_order = body.sort_order != null ? Number(body.sort_order) : row.sort_order;
      await db.query(
        `UPDATE workspace_ai_roadmap SET title=?, priority=?, description=?, how_to=?, what_we_need=?, collaborate=?, sort_order=? WHERE id=?`,
        [title, priority, description, how_to, what_we_need, collaborate, sort_order, id]
      );
      res.json({ success: true });
    } catch (e) {
      logger.error('[Workspace] ai-roadmap patch:', e.message);
      res.status(500).json({ success: false, error: e.message });
    }
  });

  app.delete('/api/workspace/ai-roadmap/:id', requireWorkspaceEdit, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const cur = await db.query('SELECT app_slug FROM workspace_ai_roadmap WHERE id=?', [id]);
      if (cur.length) {
        const rowApp = String(cur[0].app_slug || 'workspace');
        if (req.workspaceUser && !userHasAppAccess(req.workspaceUser, rowApp)) {
          return res.status(403).json({ success: false, error: `Your key has no access to app "${rowApp}"` });
        }
      }
      await db.query('DELETE FROM workspace_ai_roadmap WHERE id=?', [id]);
      res.json({ success: true });
    } catch (e) {
      logger.error('[Workspace] ai-roadmap delete:', e.message);
      res.status(500).json({ success: false, error: e.message });
    }
  });

  app.delete('/api/workspace/ai-roadmap', requireWorkspaceEdit, async (req, res) => {
    try {
      const appSlug = extractAppSlug(req);
      if (req.workspaceUser && !userHasAppAccess(req.workspaceUser, appSlug)) {
        return res.status(403).json({ success: false, error: `Your key has no access to app "${appSlug}"` });
      }
      const r = await db.query('DELETE FROM workspace_ai_roadmap WHERE app_slug = ?', [appSlug]);
      res.json({ success: true, deleted: r.affectedRows || 0, app: appSlug });
    } catch (e) {
      logger.error('[Workspace] ai-roadmap clear:', e.message);
      res.status(500).json({ success: false, error: e.message });
    }
  });

  app.delete('/api/workspace/sheets/:slug', requireWorkspaceEdit, async (req, res) => {
    try {
      const slug = String(req.params.slug || '').toLowerCase();
      // Per-app scope check before any destruction
      const sheetApp = await lookupSheetApp(slug);
      if (!sheetApp) return res.status(404).json({ success: false, error: 'Sheet not found' });
      if (req.workspaceUser && !userHasAppAccess(req.workspaceUser, sheetApp)) {
        return res.status(403).json({ success: false, error: `Your key has no access to app "${sheetApp}"` });
      }
      const sheetIssues = await db.query('SELECT * FROM workspace_issues WHERE sheet_slug=?', [slug]);
      for (const row of sheetIssues) {
        deleteUploadedFilesForIssueRow(row);
      }
      // Drop comments + canvas positions + dependencies tied to those issues
      const issueIds = sheetIssues.map(r => r.id);
      if (issueIds.length) {
        const ph = issueIds.map(() => '?').join(',');
        try { await db.query(`DELETE FROM workspace_issue_comments WHERE issue_id IN (${ph})`, issueIds); } catch (_) {}
        try { await db.query(`DELETE FROM workspace_canvas_positions WHERE issue_id IN (${ph})`, issueIds); } catch (_) {}
        try { await db.query(`DELETE FROM workspace_dependencies WHERE from_issue_id IN (${ph}) OR to_issue_id IN (${ph})`, [...issueIds, ...issueIds]); } catch (_) {}
        try { await db.query(`DELETE FROM workspace_sprint_issues WHERE issue_id IN (${ph})`, issueIds); } catch (_) {}
      }
      await db.query('DELETE FROM workspace_issues WHERE sheet_slug=?', [slug]);
      await db.query('DELETE FROM workspace_sheets WHERE slug=?', [slug]);
      logAction(req, {
        action: 'sheet.deleted', entityType: 'sheet',
        entityId: slug, entityTitle: slug, sheetSlug: slug,
        metadata: { app: sheetApp, issues_removed: issueIds.length },
      }).catch(() => {});
      res.json({ success: true, deleted_issues: issueIds.length, app: sheetApp });
    } catch (e) {
      logger.error('[Workspace] delete sheet:', e.message);
      res.status(500).json({ success: false, error: e.message });
    }
  });
}

function registerCanvasRoutes(app) {
  // GET /api/workspace/canvas?slug= — issues + positions + edges
  app.get('/api/workspace/canvas', async (req, res) => {
    const { slug } = req.query;
    if (!slug) return res.json({ success: false, error: 'slug required' });
    try {
      const issues = await db.query(
        `SELECT i.id, i.title, i.priority, i.is_done, i.sheet_status,
                COALESCE(cp.x, -1) AS x, COALESCE(cp.y, -1) AS y
         FROM workspace_issues i
         LEFT JOIN workspace_canvas_positions cp ON cp.issue_id = i.id
         WHERE i.sheet_slug = ?
         ORDER BY i.sort_order, i.id`,
        [slug]
      );
      const edges = await db.query(
        `SELECT id, from_issue_id, to_issue_id FROM workspace_dependencies WHERE sheet_slug = ?`,
        [slug]
      );
      const sheets = await db.query(
        `SELECT slug, label, platform_line FROM workspace_sheets ORDER BY sort_order, id`
      );
      res.json({ success: true, issues, edges, sheets });
    } catch (e) {
      res.json({ success: false, error: e.message });
    }
  });

  // POST /api/workspace/canvas/position — upsert node position
  app.post('/api/workspace/canvas/position', requireUser, async (req, res) => {
    const { issue_id, sheet_slug, x, y } = req.body;
    try {
      await db.query(
        `INSERT INTO workspace_canvas_positions (issue_id, sheet_slug, x, y)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE x=VALUES(x), y=VALUES(y)`,
        [issue_id, sheet_slug, x, y]
      );
      res.json({ success: true });
    } catch (e) {
      res.json({ success: false, error: e.message });
    }
  });

  // POST /api/workspace/canvas/edges — create dependency edge
  app.post('/api/workspace/canvas/edges', requireUser, async (req, res) => {
    const { from_issue_id, to_issue_id, sheet_slug } = req.body;
    if (from_issue_id === to_issue_id) return res.json({ success: false, error: 'Cannot depend on itself' });
    try {
      const result = await db.query(
        `INSERT IGNORE INTO workspace_dependencies (from_issue_id, to_issue_id, sheet_slug)
         VALUES (?, ?, ?)`,
        [from_issue_id, to_issue_id, sheet_slug]
      );
      res.json({ success: true, id: result.insertId });
    } catch (e) {
      res.json({ success: false, error: e.message });
    }
  });

  // DELETE /api/workspace/canvas/edges/:id — remove edge
  app.delete('/api/workspace/canvas/edges/:id', requireUser, async (req, res) => {
    try {
      await db.query(`DELETE FROM workspace_dependencies WHERE id = ?`, [req.params.id]);
      res.json({ success: true });
    } catch (e) {
      res.json({ success: false, error: e.message });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════
  //  SPRINT ROUTES (Phase 1)
  // ═══════════════════════════════════════════════════════════════════════
  const VALID_STATES = ['backlog','todo','in_progress','in_review','done','cancelled'];
  const VALID_SPRINT_STATUS = ['planning','active','completed','cancelled'];

  // ── List sprints for the current app ──────────────────────────────────
  app.get('/api/workspace/sprints', async (req, res) => {
    try {
      const appSlug = extractAppSlug(req);
      const status = req.query.status ? String(req.query.status).toLowerCase() : null;
      const where = status && VALID_SPRINT_STATUS.includes(status)
        ? 'WHERE app_slug = ? AND status = ?' : 'WHERE app_slug = ?';
      const params = status && VALID_SPRINT_STATUS.includes(status)
        ? [appSlug, status] : [appSlug];
      const rows = await db.query(
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
         ${where}
         ORDER BY (s.status='active') DESC, s.start_date DESC, s.id DESC`,
        params
      );
      res.json({ success: true, app: appSlug, sprints: rows });
    } catch (e) {
      logger.error('[Workspace sprints] list:', e.message);
      res.status(500).json({ success: false, error: e.message });
    }
  });

  // ── Get sprint detail with issues ─────────────────────────────────────
  app.get('/api/workspace/sprints/:id', async (req, res) => {
    try {
      const id = Number(req.params.id);
      const sprints = await db.query('SELECT * FROM workspace_sprints WHERE id = ? LIMIT 1', [id]);
      if (!sprints.length) return res.status(404).json({ success: false, error: 'Sprint not found' });
      const sprint = sprints[0];
      const issues = await db.query(
        `SELECT i.*, u.name AS assignee_name, u.role AS assignee_role,
                s.label AS sheet_label, s.platform_line AS sheet_platform,
                (SELECT COUNT(*) FROM workspace_issue_comments c WHERE c.issue_id = i.id) AS comment_count,
                (SELECT COUNT(*) FROM workspace_issue_late_reasons lr WHERE lr.issue_id = i.id) AS late_reason_count
         FROM workspace_sprint_issues si
         JOIN workspace_issues i ON i.id = si.issue_id
         LEFT JOIN workspace_users u ON u.id = i.assignee_id
         LEFT JOIN workspace_sheets s ON s.slug = i.sheet_slug
         WHERE si.sprint_id = ?
         ORDER BY FIELD(i.state,'backlog','todo','in_progress','in_review','done','cancelled'),
                  i.priority='high' DESC, i.id ASC`,
        [id]
      );
      // rowToIssue already passes through assignee_name / sheet_label / sheet_platform;
      // it doesn't know about assignee_role, comment_count or late_reason_count, so layer them in.
      const issuesOut = issues.map((row) => ({
        ...rowToIssue(row),
        assignee_role:     row.assignee_role || null,
        comment_count:     Number(row.comment_count || 0),
        late_reason_count: Number(row.late_reason_count || 0),
      }));
      res.json({ success: true, sprint, issues: issuesOut });
    } catch (e) {
      logger.error('[Workspace sprints] get:', e.message);
      res.status(500).json({ success: false, error: e.message });
    }
  });

  // ── Create sprint ─────────────────────────────────────────────────────
  app.post('/api/workspace/sprints', requireUser, async (req, res) => {
    try {
      const appSlug = extractAppSlug(req);
      if (req.workspaceUser && !userHasAppAccess(req.workspaceUser, appSlug)) {
        return res.status(403).json({ success: false, error: `Your key has no access to app "${appSlug}"` });
      }
      const b = req.body || {};
      const name = String(b.name || '').trim();
      if (!name) return res.status(400).json({ success: false, error: 'name is required' });
      const status = VALID_SPRINT_STATUS.includes(b.status) ? b.status : 'planning';
      const r = await db.query(
        `INSERT INTO workspace_sprints (app_slug, name, goal, status, start_date, end_date, capacity_points, created_by)
         VALUES (?,?,?,?,?,?,?,?)`,
        [appSlug, name, b.goal || null, status,
         b.start_date || null, b.end_date || null,
         b.capacity_points ? Number(b.capacity_points) : null,
         (req.workspaceUser && req.workspaceUser.id) || null]
      );
      logAction(req, { action: 'sprint.created', entityType: 'sprint',
        entityId: String(r.insertId), entityTitle: name, metadata: { app: appSlug } }).catch(() => {});
      res.json({ success: true, id: r.insertId, app: appSlug });
    } catch (e) {
      logger.error('[Workspace sprints] create:', e.message);
      res.status(500).json({ success: false, error: e.message });
    }
  });

  // ── Update sprint (rename, dates, status, capacity) ───────────────────
  app.patch('/api/workspace/sprints/:id', requireUser, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const cur = await db.query('SELECT app_slug FROM workspace_sprints WHERE id = ?', [id]);
      if (!cur.length) return res.status(404).json({ success: false, error: 'Sprint not found' });
      const sprintApp = String(cur[0].app_slug || 'workspace');
      if (req.workspaceUser && !userHasAppAccess(req.workspaceUser, sprintApp)) {
        return res.status(403).json({ success: false, error: `Your key has no access to app "${sprintApp}"` });
      }
      const b = req.body || {};
      const updates = [];
      const args = [];
      if (b.name !== undefined)            { updates.push('name = ?');            args.push(String(b.name).trim()); }
      if (b.goal !== undefined)            { updates.push('goal = ?');            args.push(b.goal || null); }
      if (b.start_date !== undefined)      { updates.push('start_date = ?');      args.push(b.start_date || null); }
      if (b.end_date !== undefined)        { updates.push('end_date = ?');        args.push(b.end_date || null); }
      if (b.capacity_points !== undefined) { updates.push('capacity_points = ?'); args.push(b.capacity_points ? Number(b.capacity_points) : null); }
      if (b.status !== undefined && VALID_SPRINT_STATUS.includes(b.status)) {
        updates.push('status = ?'); args.push(b.status);
        if (b.status === 'completed' || b.status === 'cancelled') updates.push('closed_at = NOW()');
      }
      if (!updates.length) return res.status(400).json({ success: false, error: 'Nothing to update' });
      args.push(id);
      await db.query(`UPDATE workspace_sprints SET ${updates.join(', ')} WHERE id = ?`, args);
      res.json({ success: true });
    } catch (e) {
      logger.error('[Workspace sprints] patch:', e.message);
      res.status(500).json({ success: false, error: e.message });
    }
  });

  // ── Delete sprint (does NOT delete the issues, just unlinks them) ─────
  app.delete('/api/workspace/sprints/:id', requireUser, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const cur = await db.query('SELECT app_slug FROM workspace_sprints WHERE id = ?', [id]);
      if (!cur.length) return res.status(404).json({ success: false, error: 'Sprint not found' });
      const sprintApp = String(cur[0].app_slug || 'workspace');
      if (req.workspaceUser && !userHasAppAccess(req.workspaceUser, sprintApp)) {
        return res.status(403).json({ success: false, error: `Your key has no access to app "${sprintApp}"` });
      }
      await db.query('DELETE FROM workspace_sprint_issues WHERE sprint_id = ?', [id]);
      await db.query('DELETE FROM workspace_sprints WHERE id = ?', [id]);
      res.json({ success: true });
    } catch (e) {
      logger.error('[Workspace sprints] delete:', e.message);
      res.status(500).json({ success: false, error: e.message });
    }
  });

  // ── Add issues to a sprint (single or batch) ──────────────────────────
  app.post('/api/workspace/sprints/:id/issues', requireUser, async (req, res) => {
    try {
      const sprintId = Number(req.params.id);
      const cur = await db.query('SELECT app_slug FROM workspace_sprints WHERE id = ?', [sprintId]);
      if (!cur.length) return res.status(404).json({ success: false, error: 'Sprint not found' });
      const sprintApp = String(cur[0].app_slug || 'workspace');
      if (req.workspaceUser && !userHasAppAccess(req.workspaceUser, sprintApp)) {
        return res.status(403).json({ success: false, error: `Your key has no access to app "${sprintApp}"` });
      }
      // Accept any of: { issue_ids: [1,2,3] } | { issue_id: 1 } | { issue_ids: 1 }
      // (the original `a || b ? [...] : []` was an operator-precedence trap
      // that dropped the array half of issue_ids entirely)
      const body = req.body || {};
      let rawIds;
      if (Array.isArray(body.issue_ids))         rawIds = body.issue_ids;
      else if (body.issue_ids != null)           rawIds = [body.issue_ids];
      else if (body.issue_id != null)            rawIds = [body.issue_id];
      else                                       rawIds = [];
      const clean = [...new Set(rawIds.map(x => Number(x)).filter(n => n > 0))];
      if (!clean.length) {
        return res.status(400).json({
          success: false,
          error: 'issue_ids required: send { "issue_ids": [123, 456] } or { "issue_id": 123 }',
        });
      }
      const userId = (req.workspaceUser && req.workspaceUser.id) || null;
      let added = 0;
      for (const iid of clean) {
        try {
          await db.query(
            `INSERT IGNORE INTO workspace_sprint_issues (sprint_id, issue_id, added_by) VALUES (?,?,?)`,
            [sprintId, iid, userId]
          );
          added++;
        } catch (_) {}
      }
      res.json({ success: true, added, total_requested: clean.length });
    } catch (e) {
      logger.error('[Workspace sprints] add issues:', e.message);
      res.status(500).json({ success: false, error: e.message });
    }
  });

  // ── Remove an issue from a sprint ─────────────────────────────────────
  app.delete('/api/workspace/sprints/:id/issues/:issueId', requireUser, async (req, res) => {
    try {
      const sprintId = Number(req.params.id);
      const issueId  = Number(req.params.issueId);
      const cur = await db.query('SELECT app_slug FROM workspace_sprints WHERE id = ?', [sprintId]);
      if (!cur.length) return res.status(404).json({ success: false, error: 'Sprint not found' });
      const sprintApp = String(cur[0].app_slug || 'workspace');
      if (req.workspaceUser && !userHasAppAccess(req.workspaceUser, sprintApp)) {
        return res.status(403).json({ success: false, error: `Your key has no access to app "${sprintApp}"` });
      }
      await db.query('DELETE FROM workspace_sprint_issues WHERE sprint_id = ? AND issue_id = ?', [sprintId, issueId]);
      res.json({ success: true });
    } catch (e) {
      logger.error('[Workspace sprints] remove issue:', e.message);
      res.status(500).json({ success: false, error: e.message });
    }
  });

  // ── Assign / un-assign / change state / set estimate / due date ───────
  app.patch('/api/workspace/issues/:id/assign', requireUser, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const sheetApp = await lookupIssueApp(id);
      if (!sheetApp) return res.status(404).json({ success: false, error: 'Issue not found' });
      if (req.workspaceUser && !userHasAppAccess(req.workspaceUser, sheetApp)) {
        return res.status(403).json({ success: false, error: `Your key has no access to app "${sheetApp}"` });
      }
      const b = req.body || {};
      const updates = [];
      const args = [];
      if (b.assignee_id !== undefined) {
        updates.push('assignee_id = ?');
        args.push(b.assignee_id ? Number(b.assignee_id) : null);
      }
      if (b.estimate_points !== undefined) {
        const ep = b.estimate_points === null || b.estimate_points === '' ? null : Number(b.estimate_points);
        updates.push('estimate_points = ?'); args.push(ep);
      }
      if (b.start_date !== undefined) {
        updates.push('start_date = ?'); args.push(b.start_date || null);
      }
      if (b.due_date !== undefined) {
        updates.push('due_date = ?'); args.push(b.due_date || null);
      }
      if (b.state !== undefined && VALID_STATES.includes(b.state)) {
        updates.push('state = ?'); args.push(b.state);
        // Auto-stamp lifecycle timestamps
        if (b.state === 'in_progress') updates.push('started_at = COALESCE(started_at, NOW())');
        if (b.state === 'done')        { updates.push('completed_at = NOW()'); updates.push('is_done = 1'); }
        if (b.state !== 'done' && b.state !== 'cancelled') updates.push('is_done = 0');
      }
      if (!updates.length) return res.status(400).json({ success: false, error: 'Nothing to update' });
      args.push(id);
      await db.query(`UPDATE workspace_issues SET ${updates.join(', ')} WHERE id = ?`, args);
      res.json({ success: true });
    } catch (e) {
      logger.error('[Workspace issues] assign:', e.message);
      res.status(500).json({ success: false, error: e.message });
    }
  });

  // ── Lite user list for assignee picker (no keys exposed) ──────────────
  app.get('/api/workspace/users-lite', async (req, res) => {
    try {
      const appSlug = extractAppSlug(req);
      // Return all active users whose scope includes the current app or '*'.
      // For pre-app_scope schemas, fall back to active users.
      let rows;
      try {
        rows = await db.query(
          `SELECT id, name, role, COALESCE(app_scope,'workspace') AS app_scope
           FROM workspace_users WHERE is_active = 1 ORDER BY name ASC`
        );
      } catch (_) {
        rows = await db.query(
          `SELECT id, name, role FROM workspace_users WHERE is_active = 1 ORDER BY name ASC`
        );
      }
      const filtered = rows.filter(u => {
        const sc = String(u.app_scope || 'workspace');
        return sc === '*' || sc.split(',').map(s => s.trim()).includes(appSlug);
      });
      res.json({ success: true, app: appSlug, users: filtered });
    } catch (e) {
      logger.error('[Workspace users-lite]:', e.message);
      res.status(500).json({ success: false, error: e.message });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════
  //  ISSUE COMMENTS (Phase 2.1)
  // ═══════════════════════════════════════════════════════════════════════

  // ── List comments for an issue (public read — anyone can see) ─────────
  app.get('/api/workspace/issues/:id/comments', async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!id) return res.status(400).json({ success: false, error: 'invalid id' });
      const rows = await db.query(
        `SELECT id, issue_id, user_id, user_name, user_role, body,
                created_at, edited_at
         FROM workspace_issue_comments
         WHERE issue_id = ?
         ORDER BY created_at ASC, id ASC`,
        [id]
      );
      res.json({ success: true, issue_id: id, comments: rows });
    } catch (e) {
      logger.error('[Workspace comments] list:', e.message);
      res.status(500).json({ success: false, error: e.message });
    }
  });

  // ── Add a comment (requires user; scoped by issue's app) ──────────────
  app.post('/api/workspace/issues/:id/comments', requireUser, async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!id) return res.status(400).json({ success: false, error: 'invalid id' });
      // Per-app scope check via the issue's sheet
      const sheetApp = await lookupIssueApp(id);
      if (!sheetApp) return res.status(404).json({ success: false, error: 'Issue not found' });
      if (req.workspaceUser && !userHasAppAccess(req.workspaceUser, sheetApp)) {
        return res.status(403).json({ success: false, error: `Your key has no access to app "${sheetApp}"` });
      }
      const body = String((req.body && req.body.body) || '').trim();
      if (!body) return res.status(400).json({ success: false, error: 'body required' });
      if (body.length > 8000) return res.status(400).json({ success: false, error: 'body too long (max 8000 chars)' });
      const u = req.workspaceUser || {};
      const r = await db.query(
        `INSERT INTO workspace_issue_comments (issue_id, app_slug, user_id, user_name, user_role, body)
         VALUES (?,?,?,?,?,?)`,
        [id, sheetApp, u.id || null, u.name || 'Anonymous', u.role || null, body]
      );
      logAction(req, {
        action: 'comment.added', entityType: 'comment',
        entityId: String(r.insertId), entityTitle: body.slice(0, 80),
        metadata: { issue_id: id, app: sheetApp },
      }).catch(() => {});
      res.json({
        success: true,
        comment: {
          id: r.insertId, issue_id: id, user_id: u.id || null,
          user_name: u.name || 'Anonymous', user_role: u.role || null,
          body, created_at: new Date().toISOString(), edited_at: null,
        },
      });
    } catch (e) {
      logger.error('[Workspace comments] post:', e.message);
      res.status(500).json({ success: false, error: e.message });
    }
  });

  // ── Edit own comment (admins can edit any) ────────────────────────────
  app.patch('/api/workspace/issues/:id/comments/:cid', requireUser, async (req, res) => {
    try {
      const id  = Number(req.params.id);
      const cid = Number(req.params.cid);
      if (!id || !cid) return res.status(400).json({ success: false, error: 'invalid id' });
      const rows = await db.query('SELECT * FROM workspace_issue_comments WHERE id = ? AND issue_id = ?', [cid, id]);
      if (!rows.length) return res.status(404).json({ success: false, error: 'Comment not found' });
      const row = rows[0];
      const u = req.workspaceUser || {};
      const isOwner = u.id && Number(u.id) === Number(row.user_id);
      if (!isOwner && u.role !== 'admin') {
        return res.status(403).json({ success: false, error: 'Only the author or an admin can edit this comment' });
      }
      // App-scope check via the row's app
      if (req.workspaceUser && !userHasAppAccess(req.workspaceUser, String(row.app_slug || 'workspace'))) {
        return res.status(403).json({ success: false, error: 'No access to this app' });
      }
      const body = String((req.body && req.body.body) || '').trim();
      if (!body) return res.status(400).json({ success: false, error: 'body required' });
      if (body.length > 8000) return res.status(400).json({ success: false, error: 'body too long' });
      await db.query('UPDATE workspace_issue_comments SET body = ?, edited_at = NOW() WHERE id = ?', [body, cid]);
      res.json({ success: true });
    } catch (e) {
      logger.error('[Workspace comments] patch:', e.message);
      res.status(500).json({ success: false, error: e.message });
    }
  });

  // ── Delete own comment (admins can delete any) ────────────────────────
  app.delete('/api/workspace/issues/:id/comments/:cid', requireUser, async (req, res) => {
    try {
      const id  = Number(req.params.id);
      const cid = Number(req.params.cid);
      if (!id || !cid) return res.status(400).json({ success: false, error: 'invalid id' });
      const rows = await db.query('SELECT * FROM workspace_issue_comments WHERE id = ? AND issue_id = ?', [cid, id]);
      if (!rows.length) return res.json({ success: true });
      const row = rows[0];
      const u = req.workspaceUser || {};
      const isOwner = u.id && Number(u.id) === Number(row.user_id);
      if (!isOwner && u.role !== 'admin') {
        return res.status(403).json({ success: false, error: 'Only the author or an admin can delete this comment' });
      }
      await db.query('DELETE FROM workspace_issue_comments WHERE id = ?', [cid]);
      res.json({ success: true });
    } catch (e) {
      logger.error('[Workspace comments] delete:', e.message);
      res.status(500).json({ success: false, error: e.message });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════
  //  LATE-REASON WORKFLOW
  //  When a task passes its due_date, the assignee is required to file a
  //  reason. Admin receives a Telegram alert per submission.
  // ═══════════════════════════════════════════════════════════════════════
  // Lazy-load Telegram helper to avoid require-cycles
  let _telegramNotify = null;
  function getTelegramNotify() {
    if (_telegramNotify !== null) return _telegramNotify;
    try {
      _telegramNotify = require('./workspace-telegram-webhook').notifyApp || null;
    } catch (_) { _telegramNotify = null; }
    return _telegramNotify;
  }

  // ── List late-reason history for an issue (public read) ──────────────
  app.get('/api/workspace/issues/:id/late-reasons', async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!id) return res.status(400).json({ success: false, error: 'invalid id' });
      const rows = await db.query(
        `SELECT id, issue_id, user_id, user_name, user_role,
                old_due_date, new_due_date, reason, submitted_at
         FROM workspace_issue_late_reasons
         WHERE issue_id = ?
         ORDER BY submitted_at DESC, id DESC`,
        [id]
      );
      res.json({ success: true, issue_id: id, reasons: rows });
    } catch (e) {
      logger.error('[Workspace late-reason] list:', e.message);
      res.status(500).json({ success: false, error: e.message });
    }
  });

  // ── Submit a late reason (assignee or admin) ─────────────────────────
  app.post('/api/workspace/issues/:id/late-reason', requireUser, async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!id) return res.status(400).json({ success: false, error: 'invalid id' });
      // Pull the issue + scope-check
      const rows = await db.query(
        'SELECT id, sheet_slug, title, assignee_id, due_date FROM workspace_issues WHERE id = ?', [id]
      );
      if (!rows.length) return res.status(404).json({ success: false, error: 'Issue not found' });
      const issue = rows[0];
      const sheetApp = await lookupIssueApp(id);
      if (!sheetApp) return res.status(404).json({ success: false, error: 'Issue app not resolvable' });
      const u = req.workspaceUser || {};
      if (!userHasAppAccess(u, sheetApp)) {
        return res.status(403).json({ success: false, error: `Your key has no access to app "${sheetApp}"` });
      }
      // Only the assignee or an admin can file a reason
      const isAssignee = issue.assignee_id && Number(u.id) === Number(issue.assignee_id);
      const isAdmin    = u.role === 'admin';
      if (!isAssignee && !isAdmin) {
        return res.status(403).json({ success: false, error: 'Only the assignee or an admin can submit a late reason' });
      }
      const b = req.body || {};
      const reason = String(b.reason || '').trim();
      if (!reason) return res.status(400).json({ success: false, error: 'reason required' });
      if (reason.length > 4000) return res.status(400).json({ success: false, error: 'reason too long (max 4000 chars)' });
      const newDue = b.new_due_date ? String(b.new_due_date).slice(0, 10) : null;

      const r = await db.query(
        `INSERT INTO workspace_issue_late_reasons
           (issue_id, app_slug, user_id, user_name, user_role, old_due_date, new_due_date, reason)
         VALUES (?,?,?,?,?,?,?,?)`,
        [id, sheetApp, u.id || null, u.name || 'Anonymous', u.role || null,
         issue.due_date || null, newDue, reason]
      );
      // If a new ETA was provided, roll the issue's due_date forward
      if (newDue) {
        await db.query('UPDATE workspace_issues SET due_date = ? WHERE id = ?', [newDue, id]);
      }
      logAction(req, {
        action: 'issue.late-reason', entityType: 'issue',
        entityId: String(id), entityTitle: issue.title || '',
        metadata: { app: sheetApp, reason_id: r.insertId, new_due_date: newDue },
      }).catch(() => {});

      // Fire Telegram alert to the app's channel (admin reads it there)
      const notify = getTelegramNotify();
      if (notify) {
        const appLabel = sheetApp.charAt(0).toUpperCase() + sheetApp.slice(1);
        const lines = [
          `⏰ *Late-reason filed* — *${appLabel}*`,
          `🔖 issue #${id}: _${String(issue.title || '').slice(0, 120).replace(/[*_`[\]]/g, ' ')}_`,
          `👤 by: ${(u.name || 'Anonymous').replace(/[*_`[\]]/g, ' ')}${u.role ? ' (' + u.role + ')' : ''}`,
          issue.due_date ? `📅 was due: ${issue.due_date}` : null,
          newDue ? `📅 new ETA: *${newDue}*` : null,
          '',
          `> ${reason.slice(0, 600).replace(/\n/g, '\n> ')}`,
        ].filter(Boolean);
        notify(sheetApp, lines.join('\n')).catch(() => {});
      }
      res.json({
        success: true,
        reason: {
          id: r.insertId, issue_id: id,
          user_id: u.id || null, user_name: u.name || 'Anonymous', user_role: u.role || null,
          old_due_date: issue.due_date || null, new_due_date: newDue,
          reason, submitted_at: new Date().toISOString(),
        },
        new_due_date: newDue,
      });
    } catch (e) {
      logger.error('[Workspace late-reason] post:', e.message);
      res.status(500).json({ success: false, error: e.message });
    }
  });

  // ── Admin overdue dashboard — every open issue past its due_date ─────
  //   GET /api/workspace/overdue?app=<slug>
  //   Anyone with access can read, but it's primarily for admins.
  app.get('/api/workspace/overdue', async (req, res) => {
    try {
      const appSlug = extractAppSlug(req);
      // Scope check: user must have access to this app
      if (req.workspaceUser && !userHasAppAccess(req.workspaceUser, appSlug)) {
        return res.status(403).json({ success: false, error: `Your key has no access to app "${appSlug}"` });
      }
      // Pull every non-done issue whose due_date < today, joined with assignee + sheet
      const rows = await db.query(
        `SELECT i.id, i.title, i.priority, i.state, i.due_date, i.start_date,
                i.estimate_points, i.sheet_slug,
                u.id AS assignee_id, u.name AS assignee_name, u.role AS assignee_role,
                s.label AS sheet_label, s.platform_line AS sheet_platform,
                DATEDIFF(CURDATE(), i.due_date) AS days_overdue,
                (SELECT COUNT(*) FROM workspace_issue_late_reasons lr WHERE lr.issue_id = i.id) AS reason_count,
                (SELECT MAX(submitted_at) FROM workspace_issue_late_reasons lr WHERE lr.issue_id = i.id) AS last_reason_at
         FROM workspace_issues i
         LEFT JOIN workspace_users u  ON u.id = i.assignee_id
         LEFT JOIN workspace_sheets s ON s.slug = i.sheet_slug
         WHERE COALESCE(s.app_slug, 'workspace') = ?
           AND i.due_date IS NOT NULL
           AND i.due_date < CURDATE()
           AND (i.state IS NULL OR i.state NOT IN ('done', 'cancelled'))
           AND i.is_done = 0
         ORDER BY i.due_date ASC, i.priority='high' DESC, i.id ASC`,
        [appSlug]
      );
      res.json({ success: true, app: appSlug, count: rows.length, issues: rows });
    } catch (e) {
      logger.error('[Workspace overdue]:', e.message);
      res.status(500).json({ success: false, error: e.message });
    }
  });

  // ── Burndown snapshot — daily timeline of remaining points ──────────
  // Handles every sprint status:
  //   active     → start_date  → min(end_date, today)
  //   completed  → start_date  → closed_at (or end_date if closed_at missing)
  //   planning   → returns flat line at total_points (no work tracked yet)
  //   cancelled  → start_date  → closed_at (or end_date), shorter line
  // For the IDEAL line, the frontend uses sprint.end_date so the chart
  // visualises "where we'd be if we shipped linearly."
  app.get('/api/workspace/sprints/:id/burndown', async (req, res) => {
    try {
      const id = Number(req.params.id);
      const sprints = await db.query('SELECT * FROM workspace_sprints WHERE id = ?', [id]);
      if (!sprints.length) return res.status(404).json({ success: false, error: 'Sprint not found' });
      const s = sprints[0];
      const issues = await db.query(
        `SELECT i.id, i.estimate_points, i.completed_at, i.is_done, i.state
         FROM workspace_sprint_issues si JOIN workspace_issues i ON i.id = si.issue_id
         WHERE si.sprint_id = ?`, [id]
      );
      const totalPoints = issues.reduce((a, i) => a + (Number(i.estimate_points) || 1), 0);

      // Pick the END of the timeline based on sprint status
      const now = new Date();
      let timelineEnd;
      if (s.status === 'completed' || s.status === 'cancelled') {
        // Sprint is closed — chart ends at when it actually closed.
        // Fall back to end_date, then to NOW if neither is set.
        timelineEnd = s.closed_at ? new Date(s.closed_at)
                    : s.end_date  ? new Date(s.end_date)
                    : now;
      } else if (s.status === 'active') {
        // Live sprint — chart ends at today (or end_date if we're past it)
        timelineEnd = s.end_date && new Date(s.end_date) < now
                    ? new Date(s.end_date)
                    : now;
      } else {
        // Planning — show just today as a single point so the chart isn't empty
        timelineEnd = now;
      }

      // START of the timeline
      const startDate = s.start_date ? new Date(s.start_date) : new Date(s.created_at);

      // Iterate day by day from start to end (inclusive)
      const days = [];
      let d = new Date(startDate); d.setHours(0,0,0,0);
      const stop = new Date(timelineEnd); stop.setHours(0,0,0,0);
      // Safety: don't loop forever if start > stop (misconfigured dates)
      if (d.getTime() > stop.getTime()) {
        days.push({
          date: stop.toISOString().slice(0, 10),
          remaining: totalPoints,
          completed: 0,
        });
      } else {
        while (d.getTime() <= stop.getTime()) {
          const dayStr = d.toISOString().slice(0, 10);
          // "Completed by end of day d" — anything completed_at < d+1
          const endOfDay = new Date(d.getTime() + 86400000);
          const completedPoints = issues
            .filter((i) => i.completed_at && new Date(i.completed_at) < endOfDay)
            .reduce((a, i) => a + (Number(i.estimate_points) || 1), 0);
          days.push({
            date: dayStr,
            remaining: Math.max(0, totalPoints - completedPoints),
            completed: completedPoints,
          });
          d = new Date(d.getTime() + 86400000);
        }
      }
      res.json({
        success: true,
        sprint: {
          id: s.id, name: s.name, status: s.status,
          start_date: s.start_date, end_date: s.end_date,
          closed_at: s.closed_at,
          capacity_points: s.capacity_points,
        },
        total_points: totalPoints,
        days,
      });
    } catch (e) {
      logger.error('[Workspace sprints] burndown:', e.message);
      res.status(500).json({ success: false, error: e.message });
    }
  });
}

module.exports = {
  registerWorkspaceRoutes,
  registerCanvasRoutes,
  ensureWorkspaceTables,
  initWorkspaceData,
};
