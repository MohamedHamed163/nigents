/**
 * Workspace per-user key authentication middleware.
 *
 * Keys are resolved in this order:
 *  1. WORKSPACE_ADMIN_KEY env var  →  superadmin (role='admin'), works even before DB is seeded
 *  2. workspace_users.api_key      →  named user with stored role
 *
 * Backwards-compat: the legacy WORKSPACE_EDIT_SECRET still passes as a generic 'developer'
 * so existing integrations keep working until migrated.
 */

const crypto = require('crypto');
const db = require('../database/connection');
const logger = require('../utils/logger');

/** Read key env vars fresh each call — handles late dotenv loading and avoids stale cached values */
function getAdminKey()  { return (process.env.WORKSPACE_ADMIN_KEY  || '').trim().replace(/^["']|["']$/g, ''); }
function getLegacyKey() { return (process.env.WORKSPACE_EDIT_SECRET || '').trim().replace(/^["']|["']$/g, ''); }

/** Extract the raw key string from header / query / body */
function extractKey(req) {
  return (
    (req.headers && req.headers['x-workspace-edit-key']) ||
    (req.query   && req.query.editKey) ||
    (req.body    && req.body.editKey) ||
    ''
  );
}

/**
 * Resolve a key to a user object { id, name, role } or null.
 * Result is cached on req.workspaceUser after first call.
 */
async function resolveUser(req) {
  if (req.workspaceUser !== undefined) return req.workspaceUser;

  const key = String(extractKey(req) || '').trim();
  if (!key) {
    req.workspaceUser = null;
    return null;
  }

  // 1. Env-var admin key (works even with empty DB)
  const ADMIN_KEY  = getAdminKey();
  const LEGACY_KEY = getLegacyKey();

  if (ADMIN_KEY && key === ADMIN_KEY) {
    req.workspaceUser = { id: 0, name: 'Admin', role: 'admin', api_key: '[env]', app_scope: '*' };
    return req.workspaceUser;
  }

  // 2. Legacy single secret — Workspace-scoped developer for backwards compat
  if (LEGACY_KEY && key === LEGACY_KEY) {
    req.workspaceUser = { id: -1, name: 'Developer', role: 'developer', api_key: '[legacy]', app_scope: 'workspace' };
    return req.workspaceUser;
  }

  // 3. DB lookup — include app_scope so per-app authorisation works
  try {
    const rows = await db.query(
      `SELECT id, name, role, api_key,
              COALESCE(app_scope, 'workspace') AS app_scope
       FROM workspace_users WHERE api_key = ? AND is_active = 1 LIMIT 1`,
      [key]
    );
    if (rows && rows.length > 0) {
      req.workspaceUser = rows[0];
      return req.workspaceUser;
    }
  } catch (e) {
    // app_scope column may not exist on first deploy — retry without it
    if (/Unknown column 'app_scope'/i.test(e.message)) {
      try {
        const rows = await db.query(
          'SELECT id, name, role, api_key FROM workspace_users WHERE api_key = ? AND is_active = 1 LIMIT 1',
          [key]
        );
        if (rows && rows.length > 0) {
          req.workspaceUser = { ...rows[0], app_scope: 'workspace' };
          return req.workspaceUser;
        }
      } catch (e2) {
        logger.warn('[WorkspaceAuth] DB lookup fallback failed: %s', e2.message);
      }
    } else {
      logger.warn('[WorkspaceAuth] DB lookup failed: %s', e.message);
    }
  }

  req.workspaceUser = null;
  return null;
}

/** Express middleware — requires any valid user */
async function requireUser(req, res, next) {
  const user = await resolveUser(req);
  if (!user) {
    if (!getAdminKey() && !getLegacyKey()) return next(); // open mode — no keys configured
    return res.status(403).json({ success: false, error: 'Invalid or missing Workspace key.' });
  }
  next();
}

/** Express middleware — requires admin role */
async function requireAdmin(req, res, next) {
  const user = await resolveUser(req);
  if (!user) {
    if (!getAdminKey() && !getLegacyKey()) return next(); // open mode
    return res.status(403).json({ success: false, error: 'Invalid or missing Workspace key.' });
  }
  if (user.role !== 'admin') {
    return res.status(403).json({ success: false, error: 'Admin access required.' });
  }
  next();
}

/** Generate a cryptographically random API key */
function generateApiKey() {
  return 'bk_' + crypto.randomBytes(24).toString('hex');
}

module.exports = { resolveUser, requireUser, requireAdmin, extractKey, generateApiKey };
