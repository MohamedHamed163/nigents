/**
 * Workspace Build Distribution API — upload/download APK, IPA, ZIP builds per platform.
 */

const fs   = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const db   = require('../database/connection');
const logger = require('../utils/logger');
const { requireUser, requireAdmin, resolveUser } = require('./workspace-auth');
const { logAction } = require('./workspace-logger');

const BUILDS_DIR  = path.join(__dirname, 'public', 'workspace', 'builds');
const MAX_BUILD_SIZE = 200 * 1024 * 1024; // 200 MB

const VALID_PLATFORMS    = ['android', 'ios', 'web', 'backend'];
const VALID_ENVIRONMENTS = ['dev', 'staging', 'production'];
const ALLOWED_EXTS       = ['.apk', '.ipa', '.zip', '.aab', '.tar', '.gz', '.dmg'];
const VALID_APPS         = ['workspace', 'tawazon', 'droop', 'quickin'];

/** Read ?app= / body.app / x-workspace-app — clean + default to 'workspace' */
function extractAppSlug(req) {
  const raw = (req.query && req.query.app) ||
              (req.body  && req.body.app)  ||
              (req.headers && req.headers['x-workspace-app']) || 'workspace';
  const s = String(raw).toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 64) || 'workspace';
  return s;
}

/** Inline copy of workspace-api userHasAppAccess (avoids circular require) */
function userHasAppAccess(user, appSlug) {
  if (!user) return false;
  if (user.role === 'admin') return true;
  const scope = String(user.app_scope || 'workspace').trim();
  if (scope === '*') return true;
  return scope.split(',').map(s => s.trim().toLowerCase()).includes(String(appSlug).toLowerCase());
}

// Ensure base builds directory exists
if (!fs.existsSync(BUILDS_DIR)) {
  fs.mkdirSync(BUILDS_DIR, { recursive: true });
}

const buildStorage = multer.diskStorage({
  destination(req, file, cb) {
    const platform = String(req.body.platform || 'android').toLowerCase();
    const dir = path.join(BUILDS_DIR, platform);
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename(req, file, cb) {
    const ext  = path.extname(file.originalname).toLowerCase();
    const base = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`;
    cb(null, base);
  },
});

const buildUpload = multer({
  storage: buildStorage,
  limits:  { fileSize: MAX_BUILD_SIZE },
  fileFilter(req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ALLOWED_EXTS.includes(ext)) return cb(null, true);
    cb(new Error(`Only ${ALLOWED_EXTS.join(', ')} files are allowed`));
  },
});

function registerWorkspaceBuildsRoutes(app) {
  // ── List builds ────────────────────────────────────────────────────────────
  app.get('/api/workspace/builds', async (req, res) => {
    try {
      const appSlug  = extractAppSlug(req);
      const platform = req.query.platform || null;
      const where  = platform ? 'WHERE app_slug = ? AND platform = ?' : 'WHERE app_slug = ?';
      const params = platform ? [appSlug, platform] : [appSlug];
      const rows   = await db.query(
        `SELECT id, platform, environment, version, build_number, file_name,
                file_size, changelog, uploaded_by_name, download_count, created_at,
                COALESCE(app_slug, 'workspace') AS app_slug
         FROM workspace_builds ${where}
         ORDER BY created_at DESC LIMIT 200`,
        params
      );
      res.json({ success: true, app: appSlug, builds: rows });
    } catch (e) {
      logger.error('[WorkspaceBuilds] list:', e.message);
      res.status(500).json({ success: false, error: e.message });
    }
  });

  // ── Upload build ───────────────────────────────────────────────────────────
  app.post('/api/workspace/builds', requireUser, buildUpload.single('file'), async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ success: false, error: 'No file uploaded' });

      const appSlug = extractAppSlug(req);
      if (!VALID_APPS.includes(appSlug)) {
        fs.unlinkSync(req.file.path);
        return res.status(400).json({ success: false, error: `Unknown app "${appSlug}"` });
      }
      // Per-app scope check
      if (req.workspaceUser && !userHasAppAccess(req.workspaceUser, appSlug)) {
        fs.unlinkSync(req.file.path);
        return res.status(403).json({ success: false, error: `Your key has no access to app "${appSlug}"` });
      }

      const platform    = String(req.body.platform    || 'android').toLowerCase();
      const environment = String(req.body.environment || 'dev').toLowerCase();
      const version     = String(req.body.version     || '').trim() || null;
      const buildNumber = req.body.build_number ? parseInt(req.body.build_number, 10) : null;
      const changelog   = String(req.body.changelog   || '').trim() || null;

      if (!VALID_PLATFORMS.includes(platform)) {
        fs.unlinkSync(req.file.path);
        return res.status(400).json({ success: false, error: `Invalid platform. Use: ${VALID_PLATFORMS.join(', ')}` });
      }
      if (!VALID_ENVIRONMENTS.includes(environment)) {
        fs.unlinkSync(req.file.path);
        return res.status(400).json({ success: false, error: `Invalid environment. Use: ${VALID_ENVIRONMENTS.join(', ')}` });
      }

      const user = req.workspaceUser;
      // Relative web path  e.g. /workspace/builds/android/...
      const relPath = `/workspace/builds/${platform}/${req.file.filename}`;

      const result = await db.query(
        `INSERT INTO workspace_builds
           (app_slug, platform, environment, version, build_number, file_path, file_name,
            file_size, changelog, uploaded_by_id, uploaded_by_name)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          appSlug,
          platform, environment, version, buildNumber || null,
          relPath, req.file.originalname, req.file.size,
          changelog,
          user ? user.id   : null,
          user ? user.name : 'Unknown',
        ]
      );

      const user2 = await resolveUser(req);
      req.workspaceUser = req.workspaceUser || user2;
      await logAction(req, {
        action:      'build.uploaded',
        entityType:  'build',
        entityId:    String(result.insertId),
        entityTitle: `${platform} ${version || ''}`.trim(),
        sheetSlug:   null,
        metadata:    { platform, environment, version },
      });

      res.json({
        success: true,
        build: {
          id:           result.insertId,
          platform,
          environment,
          version,
          build_number: buildNumber,
          file_name:    req.file.originalname,
          file_size:    req.file.size,
          file_path:    relPath,
          changelog,
          uploaded_by_name: user ? user.name : 'Unknown',
          download_count: 0,
        },
      });
    } catch (e) {
      logger.error('[WorkspaceBuilds] upload:', e.message);
      if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      res.status(500).json({ success: false, error: e.message });
    }
  });

  // ── Download build (increments counter) ───────────────────────────────────
  app.get('/api/workspace/builds/:id/download', async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      const [row] = await db.query('SELECT * FROM workspace_builds WHERE id = ?', [id]);
      if (!row) return res.status(404).json({ success: false, error: 'Build not found' });

      const fullPath = path.join(__dirname, 'public', row.file_path.replace(/^\/workspace\/builds\//, 'workspace/builds/'));
      if (!fs.existsSync(fullPath)) {
        return res.status(404).json({ success: false, error: 'File missing from disk' });
      }

      // Increment download counter async
      db.query('UPDATE workspace_builds SET download_count = download_count + 1 WHERE id = ?', [id])
        .catch(e => logger.warn('[WorkspaceBuilds] download count:', e.message));

      res.download(fullPath, row.file_name || path.basename(row.file_path));
    } catch (e) {
      logger.error('[WorkspaceBuilds] download:', e.message);
      res.status(500).json({ success: false, error: e.message });
    }
  });

  // ── Delete build ───────────────────────────────────────────────────────────
  app.delete('/api/workspace/builds/:id', requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      const [row] = await db.query('SELECT * FROM workspace_builds WHERE id = ?', [id]);
      if (!row) return res.status(404).json({ success: false, error: 'Build not found' });
      // Per-app scope check (admins pass anyway via requireAdmin, but kept for clarity)
      const rowApp = String(row.app_slug || 'workspace');
      if (req.workspaceUser && !userHasAppAccess(req.workspaceUser, rowApp)) {
        return res.status(403).json({ success: false, error: `Your key has no access to app "${rowApp}"` });
      }

      // Delete file
      try {
        const fullPath = path.join(__dirname, 'public', row.file_path.replace(/^\/workspace\/builds\//, 'workspace/builds/'));
        if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
      } catch (fe) {
        logger.warn('[WorkspaceBuilds] file delete:', fe.message);
      }

      await db.query('DELETE FROM workspace_builds WHERE id = ?', [id]);

      await logAction(req, {
        action:     'build.deleted',
        entityType: 'build',
        entityId:   String(id),
        entityTitle: `${row.platform} ${row.version || ''}`.trim(),
      });

      res.json({ success: true });
    } catch (e) {
      logger.error('[WorkspaceBuilds] delete:', e.message);
      res.status(500).json({ success: false, error: e.message });
    }
  });

  // ── Designs: list ─────────────────────────────────────────────────────────
  app.get('/api/workspace/designs', async (req, res) => {
    try {
      const appSlug  = extractAppSlug(req);
      const platform = req.query.platform || null;
      const where    = platform ? 'WHERE app_slug = ? AND platform = ?' : 'WHERE app_slug = ?';
      const params   = platform ? [appSlug, platform] : [appSlug];
      const rows     = await db.query(
        `SELECT id, title, platform, figma_url, description, version,
                uploaded_by_id, sort_order, created_at, updated_at,
                COALESCE(app_slug, 'workspace') AS app_slug
         FROM workspace_designs ${where}
         ORDER BY sort_order ASC, created_at DESC`,
        params
      );
      res.json({ success: true, app: appSlug, designs: rows });
    } catch (e) {
      logger.error('[WorkspaceDesigns] list:', e.message);
      res.status(500).json({ success: false, error: e.message });
    }
  });

  // ── Designs: create ───────────────────────────────────────────────────────
  app.post('/api/workspace/designs', requireUser, async (req, res) => {
    try {
      const appSlug = extractAppSlug(req);
      if (!VALID_APPS.includes(appSlug)) {
        return res.status(400).json({ success: false, error: `Unknown app "${appSlug}"` });
      }
      if (req.workspaceUser && !userHasAppAccess(req.workspaceUser, appSlug)) {
        return res.status(403).json({ success: false, error: `Your key has no access to app "${appSlug}"` });
      }
      const title     = String(req.body.title     || '').trim();
      const platform  = String(req.body.platform  || '').trim() || null;
      const figmaUrl  = String(req.body.figma_url || '').trim() || null;
      const desc      = String(req.body.description || '').trim() || null;
      const version   = String(req.body.version   || '').trim() || null;
      const sortOrder = parseInt(req.body.sort_order || '0', 10);

      if (!title)    return res.status(400).json({ success: false, error: 'title is required' });
      if (!figmaUrl) return res.status(400).json({ success: false, error: 'figma_url is required' });

      const user = req.workspaceUser;
      const result = await db.query(
        `INSERT INTO workspace_designs (app_slug, title, platform, figma_url, description, version, uploaded_by_id, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [appSlug, title, platform, figmaUrl, desc, version, user ? user.id : null, sortOrder]
      );

      await logAction(req, {
        action:     'design.added',
        entityType: 'design',
        entityId:   String(result.insertId),
        entityTitle: title,
        metadata:   { platform, version },
      });

      res.json({ success: true, id: result.insertId });
    } catch (e) {
      logger.error('[WorkspaceDesigns] create:', e.message);
      res.status(500).json({ success: false, error: e.message });
    }
  });

  // ── Designs: update ───────────────────────────────────────────────────────
  app.patch('/api/workspace/designs/:id', requireUser, async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      const [cur] = await db.query('SELECT app_slug FROM workspace_designs WHERE id = ?', [id]);
      if (cur) {
        const rowApp = String(cur.app_slug || 'workspace');
        if (req.workspaceUser && !userHasAppAccess(req.workspaceUser, rowApp)) {
          return res.status(403).json({ success: false, error: `Your key has no access to app "${rowApp}"` });
        }
      }
      const allowed = ['title', 'platform', 'figma_url', 'description', 'version', 'sort_order'];
      const updates = {};
      for (const k of allowed) {
        if (req.body[k] !== undefined) updates[k] = req.body[k];
      }
      if (!Object.keys(updates).length) return res.status(400).json({ success: false, error: 'Nothing to update' });
      const sets = Object.keys(updates).map(k => `${k} = ?`).join(', ');
      await db.query(`UPDATE workspace_designs SET ${sets} WHERE id = ?`, [...Object.values(updates), id]);
      res.json({ success: true });
    } catch (e) {
      logger.error('[WorkspaceDesigns] update:', e.message);
      res.status(500).json({ success: false, error: e.message });
    }
  });

  // ── Designs: delete ───────────────────────────────────────────────────────
  app.delete('/api/workspace/designs/:id', requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      const [row] = await db.query('SELECT title, app_slug FROM workspace_designs WHERE id = ?', [id]);
      if (!row) return res.status(404).json({ success: false, error: 'Design not found' });
      // Per-app scope check (admins pass anyway via requireAdmin)
      const rowApp = String(row.app_slug || 'workspace');
      if (req.workspaceUser && !userHasAppAccess(req.workspaceUser, rowApp)) {
        return res.status(403).json({ success: false, error: `Your key has no access to app "${rowApp}"` });
      }
      await db.query('DELETE FROM workspace_designs WHERE id = ?', [id]);
      await logAction(req, {
        action: 'design.deleted', entityType: 'design',
        entityId: String(id), entityTitle: row.title,
      });
      res.json({ success: true });
    } catch (e) {
      logger.error('[WorkspaceDesigns] delete:', e.message);
      res.status(500).json({ success: false, error: e.message });
    }
  });
}

module.exports = { registerWorkspaceBuildsRoutes };
