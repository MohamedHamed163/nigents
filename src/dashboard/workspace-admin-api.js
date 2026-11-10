/**
 * Workspace Admin API — user management + activity feed.
 * All routes require admin role via workspace-auth.js.
 */

const db = require('../database/connection');
const logger = require('../utils/logger');
const { requireAdmin, generateApiKey } = require('./workspace-auth');

const VALID_ROLES = ['admin', 'developer', 'designer', 'tester'];
const VALID_APPS  = ['workspace', 'tawazon', 'droop', 'quickin'];

/**
 * Normalise an `app_scope` payload from the admin form.
 * Accepts:
 *   - the string "*"  → access to every app
 *   - an array of app slugs → joined as CSV
 *   - a CSV string → cleaned, deduped, validated
 *   - empty/undefined → defaults to "workspace" for backwards compat
 * Returns a clean string ready for storage, or throws if the input contains
 * an unknown app slug.
 */
function normalizeAppScope(raw) {
  if (raw === undefined || raw === null || raw === '') return 'workspace';
  if (raw === '*') return '*';
  const arr = Array.isArray(raw) ? raw : String(raw).split(',');
  const clean = arr
    .map(s => String(s).trim().toLowerCase())
    .filter(Boolean);
  if (clean.length === 0) return 'workspace';
  if (clean.includes('*')) return '*';
  for (const a of clean) {
    if (!VALID_APPS.includes(a)) {
      const e = new Error(`Unknown app "${a}" in app_scope`);
      e.code = 'INVALID_APP_SCOPE';
      throw e;
    }
  }
  return Array.from(new Set(clean)).join(',');
}

function registerWorkspaceAdminRoutes(app) {
  // ── List all users ────────────────────────────────────────────────────────
  app.get('/api/workspace/admin/users', requireAdmin, async (req, res) => {
    try {
      // Optional filter: ?app=<slug> shows only users with access to that app
      const appFilter = req.query.app ? String(req.query.app).toLowerCase() : null;
      const rows = await db.query(
        `SELECT id, name, role,
                CONCAT(LEFT(api_key, 10), '••••••••') AS key_preview,
                COALESCE(app_scope, 'workspace') AS app_scope,
                is_active, created_at
         FROM workspace_users
         ORDER BY created_at DESC`
      );
      const out = appFilter
        ? rows.filter(u => {
            const sc = String(u.app_scope || 'workspace');
            return sc === '*' || sc.split(',').map(s => s.trim()).includes(appFilter);
          })
        : rows;
      res.json({ success: true, users: out, valid_apps: VALID_APPS });
    } catch (e) {
      logger.error('[WorkspaceAdmin] list users:', e.message);
      res.status(500).json({ success: false, error: e.message });
    }
  });

  // ── Create user ───────────────────────────────────────────────────────────
  app.post('/api/workspace/admin/users', requireAdmin, async (req, res) => {
    try {
      const name = String(req.body.name || '').trim();
      const role = String(req.body.role || 'developer').trim();

      if (!name) return res.status(400).json({ success: false, error: 'name is required' });
      if (!VALID_ROLES.includes(role)) {
        return res.status(400).json({ success: false, error: `role must be one of: ${VALID_ROLES.join(', ')}` });
      }

      let appScope;
      try { appScope = normalizeAppScope(req.body.app_scope); }
      catch (e) { return res.status(400).json({ success: false, error: e.message }); }

      // Admins always get '*' regardless of payload
      if (role === 'admin') appScope = '*';

      const apiKey = generateApiKey();
      const adminUser = req.workspaceUser;

      let result;
      try {
        result = await db.query(
          `INSERT INTO workspace_users (name, role, api_key, app_scope, created_by) VALUES (?, ?, ?, ?, ?)`,
          [name, role, apiKey, appScope, adminUser ? adminUser.id : null]
        );
      } catch (e) {
        if (/Unknown column 'app_scope'/i.test(e.message)) {
          // Column not yet migrated — fall back to legacy insert
          result = await db.query(
            `INSERT INTO workspace_users (name, role, api_key, created_by) VALUES (?, ?, ?, ?)`,
            [name, role, apiKey, adminUser ? adminUser.id : null]
          );
        } else { throw e; }
      }

      // Return the full key exactly once
      res.json({
        success: true,
        user: {
          id: result.insertId,
          name,
          role,
          app_scope: appScope,
          api_key: apiKey,   // Only time the full key is returned
          is_active: 1,
        },
        warning: 'Save this key — it will never be shown again.',
      });
    } catch (e) {
      logger.error('[WorkspaceAdmin] create user:', e.message);
      if (e.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({ success: false, error: 'A user with that key already exists (collision — retry).' });
      }
      res.status(500).json({ success: false, error: e.message });
    }
  });

  // ── Update user (name / role / is_active) ─────────────────────────────────
  app.patch('/api/workspace/admin/users/:id', requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (!id) return res.status(400).json({ success: false, error: 'invalid id' });

      const updates = {};
      if (req.body.name  !== undefined) updates.name      = String(req.body.name).trim();
      if (req.body.role  !== undefined) {
        const r = String(req.body.role).trim();
        if (!VALID_ROLES.includes(r)) return res.status(400).json({ success: false, error: 'invalid role' });
        updates.role = r;
      }
      if (req.body.is_active !== undefined) updates.is_active = req.body.is_active ? 1 : 0;
      if (req.body.app_scope !== undefined) {
        try { updates.app_scope = normalizeAppScope(req.body.app_scope); }
        catch (e) { return res.status(400).json({ success: false, error: e.message }); }
      }

      if (Object.keys(updates).length === 0) {
        return res.status(400).json({ success: false, error: 'Nothing to update' });
      }

      const sets  = Object.keys(updates).map(k => `${k} = ?`).join(', ');
      const vals  = [...Object.values(updates), id];
      await db.query(`UPDATE workspace_users SET ${sets} WHERE id = ?`, vals);
      res.json({ success: true });
    } catch (e) {
      logger.error('[WorkspaceAdmin] update user:', e.message);
      res.status(500).json({ success: false, error: e.message });
    }
  });

  // ── Deactivate (soft-delete) user ─────────────────────────────────────────
  app.delete('/api/workspace/admin/users/:id', requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (!id) return res.status(400).json({ success: false, error: 'invalid id' });
      await db.query(`UPDATE workspace_users SET is_active = 0 WHERE id = ?`, [id]);
      res.json({ success: true });
    } catch (e) {
      logger.error('[WorkspaceAdmin] deactivate user:', e.message);
      res.status(500).json({ success: false, error: e.message });
    }
  });

  // ── Rotate API key ────────────────────────────────────────────────────────
  app.post('/api/workspace/admin/users/:id/rotate-key', requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (!id) return res.status(400).json({ success: false, error: 'invalid id' });
      const newKey = generateApiKey();
      await db.query(`UPDATE workspace_users SET api_key = ? WHERE id = ?`, [newKey, id]);
      res.json({
        success: true,
        api_key: newKey,
        warning: 'Save this key — it will never be shown again.',
      });
    } catch (e) {
      logger.error('[WorkspaceAdmin] rotate key:', e.message);
      res.status(500).json({ success: false, error: e.message });
    }
  });

  // ── Activity feed ─────────────────────────────────────────────────────────
  app.get('/api/workspace/admin/activity', requireAdmin, async (req, res) => {
    try {
      const page      = Math.max(1, parseInt(req.query.page  || '1', 10));
      const limit     = Math.min(200, Math.max(1, parseInt(req.query.limit || '50', 10)));
      const offset    = (page - 1) * limit;
      const userId    = req.query.user_id  ? parseInt(req.query.user_id,  10) : null;
      const sheetSlug = req.query.sheet_slug || null;
      const action    = req.query.action     || null;
      const dateFrom  = req.query.date_from  || null;
      const dateTo    = req.query.date_to    || null;

      const conditions = [];
      const params     = [];

      if (userId)    { conditions.push('user_id = ?');    params.push(userId); }
      if (sheetSlug) { conditions.push('sheet_slug = ?'); params.push(sheetSlug); }
      if (action)    { conditions.push('action = ?');     params.push(action); }
      if (dateFrom)  { conditions.push('created_at >= ?');params.push(dateFrom); }
      if (dateTo)    { conditions.push('created_at <= ?');params.push(dateTo + ' 23:59:59'); }

      const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

      const [total] = await db.query(`SELECT COUNT(*) AS c FROM workspace_activity_log ${where}`, params);
      const rows    = await db.query(
        `SELECT id, user_id, user_name, user_role, action, entity_type, entity_id,
                entity_title, sheet_slug, metadata, ip_address, created_at
         FROM workspace_activity_log ${where}
         ORDER BY created_at DESC LIMIT ? OFFSET ?`,
        [...params, limit, offset]
      );

      res.json({
        success: true,
        total: total.c,
        page,
        limit,
        rows,
      });
    } catch (e) {
      logger.error('[WorkspaceAdmin] activity feed:', e.message);
      res.status(500).json({ success: false, error: e.message });
    }
  });

  // ── Resolve own user identity (for UI login display) ─────────────────────
  app.get('/api/workspace/me', async (req, res) => {
    // Use workspace-auth resolveUser lazily
    const { resolveUser } = require('./workspace-auth');
    const user = await resolveUser(req);
    if (!user) return res.status(401).json({ success: false, error: 'Unauthenticated' });
    res.json({
      success: true,
      user: {
        id:        user.id,
        name:      user.name,
        role:      user.role,
        app_scope: user.app_scope || 'workspace',   // ← needed by the multi-app workspace UI
      },
    });
  });

  // ── Notifications: list ───────────────────────────────────────────────────
  app.get('/api/workspace/notifications', async (req, res) => {
    try {
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit || '50', 10)));
      let rows = [];
      try {
        rows = await db.query(
          `SELECT id, type, title, message, entity_type, entity_id,
                  sheet_slug, triggered_by_name, read_by, created_at
           FROM workspace_notifications
           ORDER BY created_at DESC LIMIT ?`,
          [limit]
        );
      } catch (tableErr) {
        // Table may not exist yet on older deployments — return empty gracefully
        logger.warn('[WorkspaceAdmin] notifications table not ready: %s', tableErr.message);
        return res.json({ success: true, notifications: [] });
      }
      const { resolveUser } = require('./workspace-auth');
      const user    = await resolveUser(req);
      const userId  = user ? String(user.id) : null;
      const result  = (rows || []).map(r => {
        let readBy = {};
        try {
          readBy = (typeof r.read_by === 'string') ? JSON.parse(r.read_by || '{}') : (r.read_by || {});
        } catch (_) {}
        return {
          ...r,
          read_by:    readBy,
          is_read:    userId ? !!readBy[userId] : false,
          navigateTo: buildNavigateTo(r),
        };
      });
      res.json({ success: true, notifications: result });
    } catch (e) {
      logger.error('[WorkspaceAdmin] notifications list:', e.message);
      res.status(500).json({ success: false, error: e.message });
    }
  });

  // ── Notifications: mark all read ─────────────────────────────────────────
  app.post('/api/workspace/notifications/read-all', async (req, res) => {
    try {
      const { resolveUser } = require('./workspace-auth');
      const user = await resolveUser(req);
      if (!user) return res.status(401).json({ success: false, error: 'Unauthenticated' });

      const userId  = String(user.id);
      const nowIso  = new Date().toISOString();
      // Update read_by JSON for all rows not yet read by this user
      await db.query(
        `UPDATE workspace_notifications
         SET read_by = JSON_SET(COALESCE(read_by, '{}'), ?, ?)
         WHERE JSON_VALUE(read_by, ?) IS NULL`,
        [`$.${userId}`, nowIso, `$.${userId}`]
      );
      res.json({ success: true });
    } catch (e) {
      logger.error('[WorkspaceAdmin] mark-read:', e.message);
      res.status(500).json({ success: false, error: e.message });
    }
  });
}

/** Build navigate-to URL from notification row */
function buildNavigateTo(row) {
  const { entity_type, entity_id, sheet_slug } = row;
  if (entity_type === 'issue' && sheet_slug) {
    return `/workspace/sheet.html?slug=${sheet_slug}#issue-${entity_id}`;
  }
  if (entity_type === 'sheet' && sheet_slug) {
    return `/workspace/sheet.html?slug=${sheet_slug}`;
  }
  if (entity_type === 'build')  return '/workspace/builds.html';
  if (entity_type === 'design') return '/workspace/designs.html';
  return '/workspace/';
}

module.exports = { registerWorkspaceAdminRoutes };
