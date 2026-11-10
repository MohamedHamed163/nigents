/**
 * Workspace issue images: uploads under public/workspace/uploads + URL entries in issue_media JSON.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const db = require('../database/connection');
const logger = require('../utils/logger');
// Use the shared multi-tenant auth (env admin key, legacy edit secret, AND
// DB-stored workspace_users rows with per-app scope). The previous hand-rolled
// requireWorkspaceEdit only recognised WORKSPACE_EDIT_SECRET — so media uploads
// silently 403'd for every admin and per-app key. Switching to the shared
// helper unblocks uploads on every app workspace.
const { requireUser, resolveUser } = require('./workspace-auth');

// Alias preserved for the rest of the module (no other code changes needed).
const requireWorkspaceEdit = requireUser;

/** Same scope check as workspace-api.js — inline copy avoids a circular require. */
function userHasAppAccess(user, appSlug) {
  if (!user) return false;
  if (user.role === 'admin') return true;
  const scope = String(user.app_scope || 'workspace').trim();
  if (scope === '*') return true;
  return scope.split(',').map(s => s.trim().toLowerCase()).includes(String(appSlug).toLowerCase());
}

/** Resolve which app an issue belongs to via its sheet. Null if not found. */
async function lookupIssueApp(issueId) {
  try {
    const rows = await db.query(
      `SELECT s.app_slug FROM workspace_issues i
       JOIN workspace_sheets s ON s.slug = i.sheet_slug
       WHERE i.id = ? LIMIT 1`,
      [issueId]
    );
    if (rows.length) return String(rows[0].app_slug || 'workspace');
  } catch (_) { /* table may not have app_slug yet on first deploy */ }
  return null;
}

/** Enforce per-app scope for a media mutation on issueId. Returns true if OK to proceed. */
async function gateAppScope(req, res, issueId) {
  await resolveUser(req); // make sure req.workspaceUser is populated
  const app = await lookupIssueApp(issueId);
  if (!app) return true; // pre-migration / unknown issue → trust the auth layer
  if (req.workspaceUser && !userHasAppAccess(req.workspaceUser, app)) {
    res.status(403).json({ success: false, error: `Your key has no access to app "${app}"` });
    return false;
  }
  return true;
}

const UPLOAD_DIR = path.join(__dirname, 'public', 'workspace', 'uploads');
const MAX_MEDIA_PER_ISSUE = 24;
// Per-file limit raised from 8 MB → 25 MB so full-resolution Retina /
// Android-XL screenshots upload cleanly. Combined with multer's `files: 12`
// limit, a single upload caps at ~300 MB which still fits comfortably under
// the deployed Express body limit (raised to 25 MB JSON / per-file multipart
// streamed by multer) and any sane proxy limit.
const MAX_FILE_BYTES = 25 * 1024 * 1024;
const MAX_URL_LEN = 2048;

function publicBaseUrl(req) {
  if (!req || typeof req.get !== 'function') return '';
  const xf = String(req.headers['x-forwarded-proto'] || '')
    .split(',')[0]
    .trim();
  const proto = xf || req.protocol || 'http';
  const host = req.get('host');
  if (!host) return '';
  return `${proto}://${host}`;
}

function mergeAttachmentsField(existing, urlToAdd) {
  const u = String(urlToAdd || '').trim().slice(0, MAX_URL_LEN);
  if (!u) return existing != null ? String(existing) : null;
  const e = existing != null ? String(existing).trim() : '';
  if (!e) return u;
  if (e.includes(u)) return e;
  return `${e}; ${u}`;
}

function ensureUploadDir() {
  try {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  } catch (e) {
    logger.warn('[Workspace media] mkdir uploads:', e.message);
  }
}

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

function randomId() {
  return crypto.randomUUID();
}

function normalizeMediaItem(raw) {
  if (!raw || typeof raw !== 'object') return null;
  if (raw.kind === 'url' && raw.url) {
    const u = String(raw.url).trim().slice(0, MAX_URL_LEN);
    if (!/^https?:\/\//i.test(u)) return null;
    return { id: raw.id || randomId(), kind: 'url', url: u };
  }
  if (raw.kind === 'upload' && raw.path) {
    const p = String(raw.path).trim();
    if (!/^\/workspace\/uploads\/[a-zA-Z0-9._-]+$/.test(p)) return null;
    return {
      id: raw.id || randomId(),
      kind: 'upload',
      path: p,
      name: raw.name ? String(raw.name).slice(0, 255) : '',
    };
  }
  return null;
}

function normalizeMediaArray(arr) {
  if (!Array.isArray(arr)) return [];
  const out = [];
  for (const x of arr) {
    const n = normalizeMediaItem(x);
    if (n) out.push(n);
    if (out.length >= MAX_MEDIA_PER_ISSUE) break;
  }
  return out;
}

function fsPathForUpload(webPath) {
  const base = String(webPath).replace(/^\/workspace\/uploads\//, '');
  if (!base || base.includes('..') || base.includes('/') || base.includes('\\')) {
    return null;
  }
  return path.join(UPLOAD_DIR, base);
}

function deleteUploadedFilesForIssueRow(row) {
  const media = parseJsonField(row.issue_media, []);
  for (const m of media) {
    if (m && m.kind === 'upload' && m.path) {
      const fp = fsPathForUpload(m.path);
      if (fp) {
        try {
          if (fs.existsSync(fp)) fs.unlinkSync(fp);
        } catch (e) {
          logger.warn('[Workspace media] unlink:', e.message);
        }
      }
    }
  }
}

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      ensureUploadDir();
      cb(null, UPLOAD_DIR);
    },
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname || '').toLowerCase();
      const allowed = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
      const safeExt = allowed.includes(ext) ? ext : '.bin';
      cb(null, `${Date.now()}-${randomId()}${safeExt}`);
    },
  }),
  limits: { fileSize: MAX_FILE_BYTES, files: 12 },
  fileFilter: (req, file, cb) => {
    const ok = /^image\/(jpeg|png|gif|webp)$/i.test(file.mimetype);
    cb(ok ? null : new Error('Only JPEG, PNG, GIF, and WebP images are allowed'), ok);
  },
});

function registerWorkspaceIssueMediaRoutes(app) {
  ensureUploadDir();

  app.post(
    '/api/workspace/issues/:id/media/upload',
    requireWorkspaceEdit,
    (req, res, next) => {
      upload.array('files', 12)(req, res, (err) => {
        if (err) {
          return res.status(400).json({ success: false, error: err.message || 'Upload failed' });
        }
        next();
      });
    },
    async (req, res) => {
      try {
        const id = Number(req.params.id);
        // Per-app scope check (cleans up any uploaded files on rejection)
        if (!(await gateAppScope(req, res, id))) {
          for (const f of req.files || []) { try { fs.unlinkSync(f.path); } catch {} }
          return;
        }
        const rows = await db.query('SELECT id, issue_media, attachments FROM workspace_issues WHERE id=?', [id]);
        if (!rows.length) {
          for (const f of req.files || []) {
            try {
              fs.unlinkSync(f.path);
            } catch {
              /* ignore */
            }
          }
          return res.status(404).json({ success: false, error: 'Issue not found' });
        }
        let media = normalizeMediaArray(parseJsonField(rows[0].issue_media, []));
        let attachments = rows[0].attachments != null ? String(rows[0].attachments) : null;
        const base = publicBaseUrl(req);
        const files = req.files || [];
        if (!files.length) {
          return res.status(400).json({ success: false, error: 'No files (use multipart field name "files")' });
        }
        for (const f of files) {
          if (media.length >= MAX_MEDIA_PER_ISSUE) {
            try {
              fs.unlinkSync(f.path);
            } catch {
              /* ignore */
            }
            continue;
          }
          const webPath = `/workspace/uploads/${path.basename(f.path)}`;
          media.push({
            id: randomId(),
            kind: 'upload',
            path: webPath,
            name: f.originalname || path.basename(f.path),
          });
          if (base) {
            attachments = mergeAttachmentsField(attachments, `${base}${webPath}`);
          }
        }
        await db.query('UPDATE workspace_issues SET issue_media=?, attachments=? WHERE id=?', [
          JSON.stringify(media),
          attachments,
          id,
        ]);
        res.json({ success: true, issue_media: media, attachments });
      } catch (e) {
        logger.error('[Workspace media] upload:', e.message);
        res.status(500).json({ success: false, error: e.message });
      }
    }
  );

  app.post('/api/workspace/issues/:id/media/url', requireWorkspaceEdit, async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!(await gateAppScope(req, res, id))) return;
      const urlRaw = (req.body && req.body.url) || '';
      const url = String(urlRaw).trim().slice(0, MAX_URL_LEN);
      if (!url || !/^https?:\/\//i.test(url)) {
        return res.status(400).json({ success: false, error: 'Valid http(s) URL required' });
      }
      const rows = await db.query('SELECT id, issue_media, attachments FROM workspace_issues WHERE id=?', [id]);
      if (!rows.length) {
        return res.status(404).json({ success: false, error: 'Issue not found' });
      }
      let media = normalizeMediaArray(parseJsonField(rows[0].issue_media, []));
      if (media.length >= MAX_MEDIA_PER_ISSUE) {
        return res.status(400).json({ success: false, error: `Maximum ${MAX_MEDIA_PER_ISSUE} media items per issue` });
      }
      media.push({ id: randomId(), kind: 'url', url });
      const attachments = mergeAttachmentsField(rows[0].attachments, url);
      await db.query('UPDATE workspace_issues SET issue_media=?, attachments=? WHERE id=?', [
        JSON.stringify(media),
        attachments,
        id,
      ]);
      res.json({ success: true, issue_media: media, attachments });
    } catch (e) {
      logger.error('[Workspace media] url:', e.message);
      res.status(500).json({ success: false, error: e.message });
    }
  });

  app.delete('/api/workspace/issues/:id/media/:mediaId', requireWorkspaceEdit, async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!(await gateAppScope(req, res, id))) return;
      const mediaId = String(req.params.mediaId || '').trim();
      const rows = await db.query('SELECT id, issue_media FROM workspace_issues WHERE id=?', [id]);
      if (!rows.length) {
        return res.status(404).json({ success: false, error: 'Issue not found' });
      }
      let media = normalizeMediaArray(parseJsonField(rows[0].issue_media, []));
      const item = media.find((m) => m.id === mediaId);
      if (!item) {
        return res.status(404).json({ success: false, error: 'Media item not found' });
      }
      if (item.kind === 'upload' && item.path) {
        const fp = fsPathForUpload(item.path);
        if (fp) {
          try {
            if (fs.existsSync(fp)) fs.unlinkSync(fp);
          } catch (e) {
            logger.warn('[Workspace media] unlink:', e.message);
          }
        }
      }
      media = media.filter((m) => m.id !== mediaId);
      await db.query('UPDATE workspace_issues SET issue_media=? WHERE id=?', [JSON.stringify(media), id]);
      res.json({ success: true, issue_media: media });
    } catch (e) {
      logger.error('[Workspace media] delete item:', e.message);
      res.status(500).json({ success: false, error: e.message });
    }
  });
}

module.exports = {
  registerWorkspaceIssueMediaRoutes,
  deleteUploadedFilesForIssueRow,
  normalizeMediaArray,
  MAX_MEDIA_PER_ISSUE,
};
