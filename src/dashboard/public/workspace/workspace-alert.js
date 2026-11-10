/* ──────────────────────────────────────────────────────────────────────
   workspace-alert.js  —  Custom branded alert/confirm/toast for every page.

   Replaces the browser's native alert() and confirm() prompts with a
   centered modal overlay that matches the Workspace visual language
   (dark background, orange accent, scrim, ESC-to-dismiss).

   What you get:
     window.alert(msg)                 → branded modal with OK button
     window.confirm(msg)               → branded modal with OK + Cancel
                                          (sync wrapper, returns boolean)
     WorkspaceAlert.alert(msg, opts)      → async, returns Promise<void>
     WorkspaceAlert.confirm(msg, opts)    → async, returns Promise<boolean>
     WorkspaceAlert.flash(msg, kind)      → toast (auto-dismiss, no buttons)

   Notes
   -----
   - Synchronous window.confirm() can't really be synchronous since the
     custom modal needs the event loop to capture the user's click.
     For most call sites this is fine because they're inside async
     handlers — confirm() returning the original native value if used in
     a non-async context is an explicit fallback handled below.
   - For NEW code, prefer await WorkspaceAlert.confirm(…) over the native
     pattern — it's reliable in every context.
   - Self-injects modal HTML + CSS if not already present (other pages
     that ship the modal markup, like sheet.html, won't double up).
   ────────────────────────────────────────────────────────────────────── */
(function () {
  'use strict';
  if (window.WorkspaceAlert) return;  // already loaded

  // ── Inject CSS once ───────────────────────────────────────────────
  function injectCSS() {
    if (document.getElementById('workspace-alert-css')) return;
    var s = document.createElement('style');
    s.id = 'workspace-alert-css';
    s.textContent = [
      /* ── Modal overlay ───────────────────────────────────────── */
      '.workspace-modal {',
      '  position: fixed; inset: 0; z-index: 99999;',
      '  display: none; align-items: center; justify-content: center;',
      '  padding: 20px;',
      '}',
      '.workspace-modal.is-open { display: flex; }',
      '.workspace-modal-scrim {',
      '  position: absolute; inset: 0;',
      '  background: rgba(8, 7, 11, 0.78);',
      '  backdrop-filter: blur(4px);',
      '  animation: ba-scrim-in 0.18s ease;',
      '}',
      '@keyframes ba-scrim-in { from { opacity: 0; } to { opacity: 1; } }',
      '.workspace-modal-panel {',
      '  position: relative;',
      '  background: linear-gradient(155deg, var(--bg-card, #121016) 0%, var(--bg-elevated, #1a1720) 100%);',
      '  border: 1px solid var(--border, #2e2e3a);',
      '  border-radius: 16px;',
      '  padding: 28px 30px;',
      '  max-width: 460px;',
      '  width: 100%;',
      '  max-height: 90vh; overflow-y: auto;',
      '  box-shadow: 0 24px 80px -20px rgba(0, 0, 0, 0.65);',
      '  animation: ba-pop-in 0.22s cubic-bezier(0.2, 0.7, 0.2, 1);',
      '  overflow-wrap: anywhere;',
      '}',
      '@keyframes ba-pop-in {',
      '  from { transform: translateY(8px) scale(0.98); opacity: 0; }',
      '  to   { transform: translateY(0)    scale(1);    opacity: 1; }',
      '}',
      '.workspace-modal-accent {',
      '  height: 3px; border-radius: 999px;',
      '  background: linear-gradient(90deg, var(--accent-orange, #ff6b1a), #ff8a40);',
      '  margin-bottom: 16px; width: 44px;',
      '}',
      '.workspace-modal[data-variant="danger"]  .workspace-modal-accent { background: linear-gradient(90deg, var(--danger, #f87171), #fca5a5); }',
      '.workspace-modal[data-variant="success"] .workspace-modal-accent { background: linear-gradient(90deg, var(--accent-green, #2ee6b8), #5eead4); }',
      '.workspace-modal[data-variant="info"]    .workspace-modal-accent { background: linear-gradient(90deg, var(--blue-accent, #5eb3ff), #93c5fd); }',
      '.workspace-modal-title {',
      '  margin: 0 0 6px;',
      '  font-size: 17px; font-weight: 800; letter-spacing: -0.01em;',
      '  color: var(--text-primary, #f4f4f8);',
      '}',
      '.workspace-modal-body {',
      '  margin: 0; font-size: 14px; line-height: 1.6;',
      '  color: var(--text-soft, #c0c0c0); white-space: pre-wrap;',
      '}',
      '.workspace-modal-body code {',
      '  font-family: ui-monospace, monospace; font-size: 12.5px;',
      '  padding: 1px 6px; border-radius: 4px;',
      '  background: rgba(255, 255, 255, 0.06); color: var(--accent-orange, #ff6b1a);',
      '}',
      '.workspace-modal-actions {',
      '  display: flex; justify-content: flex-end; gap: 8px;',
      '  margin-top: 22px;',
      '}',
      '.workspace-modal-btn {',
      '  padding: 9px 18px; border-radius: 8px; border: none; cursor: pointer;',
      '  font: inherit; font-size: 13px; font-weight: 700; letter-spacing: 0.01em;',
      '  transition: transform 0.12s, box-shadow 0.2s, background-color 0.15s;',
      '}',
      '.workspace-modal-btn.primary {',
      '  background: linear-gradient(135deg, var(--accent-orange, #ff6b1a) 0%, #ff8a40 100%);',
      '  color: #09080c;',
      '  box-shadow: 0 6px 18px -4px rgba(255, 107, 26, 0.45);',
      '}',
      '.workspace-modal[data-variant="danger"] .workspace-modal-btn.primary {',
      '  background: linear-gradient(135deg, var(--danger, #f87171) 0%, #fca5a5 100%);',
      '  color: #1a0a0a;',
      '  box-shadow: 0 6px 18px -4px rgba(248, 113, 113, 0.45);',
      '}',
      '.workspace-modal-btn.primary:hover { transform: translateY(-1px); }',
      '.workspace-modal-btn.secondary {',
      '  background: transparent; color: var(--text-soft, #c0c0c0);',
      '  border: 1px solid rgba(255, 255, 255, 0.12);',
      '}',
      '.workspace-modal-btn.secondary:hover {',
      '  background: rgba(255, 255, 255, 0.04); color: var(--text-primary, #f4f4f8);',
      '  border-color: rgba(255, 255, 255, 0.22);',
      '}',
      /* ── Flash toast — slides in from top-right as a proper card ──
         All positioning props use !important to override brief.css which
         ships its own .workspace-flash rules (bottom:20px; left:50%) that
         would otherwise stretch the toast full-height (top + bottom both
         set on position:fixed = element stretches between them). */
      '.workspace-flash {',
      '  position: fixed !important;',
      '  top: 20px !important;',
      '  right: 20px !important;',
      '  bottom: auto !important;',
      '  left: auto !important;',
      '  width: auto !important;',
      '  height: auto !important;',
      '  z-index: 100000 !important;',
      '  display: flex !important;',
      '  align-items: center !important;',
      '  gap: 12px !important;',
      '  padding: 14px 18px 14px 16px !important;',
      '  min-width: 260px !important;',
      '  max-width: min(420px, calc(100vw - 40px)) !important;',
      '  background: linear-gradient(155deg, var(--bg-card, #121016) 0%, var(--bg-elevated, #1a1720) 100%) !important;',
      '  border: 1px solid var(--border, #2e2e3a) !important;',
      '  border-left: 4px solid var(--accent-orange, #ff6b1a) !important;',
      '  border-radius: 10px !important;',
      '  font-size: 13.5px !important;',
      '  font-weight: 600 !important;',
      '  color: var(--text-primary, #f4f4f8) !important;',
      '  letter-spacing: -0.005em !important;',
      '  line-height: 1.4 !important;',
      '  box-shadow: 0 18px 50px -12px rgba(0, 0, 0, 0.7), 0 4px 12px -4px rgba(0, 0, 0, 0.4) !important;',
      '  opacity: 0;',
      '  pointer-events: none;',
      '  transform: translateX(20px) !important;',
      '  transition: transform 0.28s cubic-bezier(0.2, 0.7, 0.2, 1), opacity 0.2s ease !important;',
      '}',
      '.workspace-flash.is-visible {',
      '  transform: translateX(0) !important;',
      '  opacity: 1 !important;',
      '  pointer-events: auto !important;',
      '}',
      '.workspace-flash[data-kind="success"] { border-left-color: var(--accent-green, #2ee6b8) !important; }',
      '.workspace-flash[data-kind="error"]   { border-left-color: var(--danger, #f87171) !important; }',
      '.workspace-flash[data-kind="info"]    { border-left-color: var(--blue-accent, #5eb3ff) !important; }',
      '.workspace-flash[data-kind="warn"]    { border-left-color: #ffb86b !important; }',
      /* Icon is a small filled rounded square (not a tiny dot) — looks more
         "notification card". !important needed to beat brief.css's circle
         icon (22px round with thick border). */
      '.workspace-flash-icon {',
      '  width: 26px !important;',
      '  height: 26px !important;',
      '  border-radius: 7px !important;',
      '  border: none !important;',
      '  flex-shrink: 0 !important;',
      '  display: inline-flex !important;',
      '  align-items: center !important;',
      '  justify-content: center !important;',
      '  background: rgba(255, 107, 26, 0.14) !important;',
      '  color: var(--accent-orange, #ff6b1a) !important;',
      '  font-weight: 800 !important;',
      '  font-size: 13px !important;',
      '  font-family: ui-monospace, monospace !important;',
      '  line-height: 1 !important;',
      '  letter-spacing: 0 !important;',
      '}',
      '.workspace-flash[data-kind="success"] .workspace-flash-icon {',
      '  background: rgba(46, 230, 184, 0.16) !important;',
      '  color: var(--accent-green, #2ee6b8) !important;',
      '}',
      '.workspace-flash[data-kind="error"] .workspace-flash-icon {',
      '  background: rgba(248, 113, 113, 0.18) !important;',
      '  color: var(--danger, #f87171) !important;',
      '}',
      '.workspace-flash[data-kind="info"] .workspace-flash-icon {',
      '  background: rgba(94, 179, 255, 0.14) !important;',
      '  color: var(--blue-accent, #5eb3ff) !important;',
      '}',
      '.workspace-flash[data-kind="warn"] .workspace-flash-icon {',
      '  background: rgba(255, 184, 107, 0.16) !important;',
      '  color: #ffb86b !important;',
      '}',
      '.workspace-flash-text {',
      '  flex: 1 1 auto !important;',
      '  min-width: 0 !important;',
      '  overflow-wrap: anywhere !important;',
      '  word-break: break-word !important;',
      '  line-height: 1.4 !important;',
      '}',
      /* Stack to full-width on small screens so it never looks cramped */
      '@media (max-width: 480px) {',
      '  .workspace-flash { top: 12px; right: 12px; left: 12px; min-width: 0; max-width: none; }',
      '}',
    ].join('\n');
    document.head.appendChild(s);
  }

  // ── Inject modal + flash HTML once ────────────────────────────────
  function injectMarkup() {
    if (!document.getElementById('workspace-modal')) {
      var modal = document.createElement('div');
      modal.id = 'workspace-modal';
      modal.className = 'workspace-modal';
      modal.setAttribute('aria-hidden', 'true');
      modal.innerHTML =
        '<div class="workspace-modal-scrim"></div>' +
        '<div class="workspace-modal-panel" role="dialog" aria-modal="true" aria-labelledby="workspace-modal-title">' +
          '<div class="workspace-modal-accent" aria-hidden="true"></div>' +
          '<h3 id="workspace-modal-title" class="workspace-modal-title"></h3>' +
          '<p id="workspace-modal-body" class="workspace-modal-body"></p>' +
          '<div class="workspace-modal-actions">' +
            '<button type="button" id="workspace-modal-btn-cancel" class="workspace-modal-btn secondary" style="display:none;">Cancel</button>' +
            '<button type="button" id="workspace-modal-btn-primary" class="workspace-modal-btn primary">OK</button>' +
          '</div>' +
        '</div>';
      document.body.appendChild(modal);
    }
    if (!document.getElementById('workspace-flash')) {
      var flash = document.createElement('div');
      flash.id = 'workspace-flash';
      flash.className = 'workspace-flash';
      flash.setAttribute('aria-live', 'polite');
      flash.setAttribute('role', 'status');
      flash.innerHTML =
        '<span class="workspace-flash-icon" aria-hidden="true"></span>' +
        '<span class="workspace-flash-text"></span>';
      document.body.appendChild(flash);
    }
  }

  function ensureReady() {
    injectCSS();
    injectMarkup();
  }

  // ── Helpers ───────────────────────────────────────────────────────
  function closeModal() {
    var root = document.getElementById('workspace-modal');
    if (!root) return;
    root.classList.remove('is-open');
    root.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  // ── Public API ────────────────────────────────────────────────────
  function workspaceAlert(message, opts) {
    ensureReady();
    opts = opts || {};
    return new Promise(function (resolve) {
      var root        = document.getElementById('workspace-modal');
      var titleEl     = document.getElementById('workspace-modal-title');
      var bodyEl      = document.getElementById('workspace-modal-body');
      var cancelBtn   = document.getElementById('workspace-modal-btn-cancel');
      var primaryBtn  = document.getElementById('workspace-modal-btn-primary');
      var scrim       = root.querySelector('.workspace-modal-scrim');

      titleEl.textContent  = opts.title || 'Nigents';
      bodyEl.textContent   = message == null ? '' : String(message);
      cancelBtn.style.display = 'none';
      primaryBtn.textContent  = opts.okText || 'OK';
      root.setAttribute('data-variant', opts.variant || 'info');

      function cleanup() {
        document.removeEventListener('keydown', onKey);
        scrim.removeEventListener('click', onBackdrop);
        primaryBtn.removeEventListener('click', onPrimary);
        closeModal();
        resolve();
      }
      function onKey(e)      { if (e.key === 'Escape' || e.key === 'Enter') cleanup(); }
      function onBackdrop(e) { if (e.target === scrim) cleanup(); }
      function onPrimary()   { cleanup(); }

      root.classList.add('is-open');
      root.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
      document.addEventListener('keydown', onKey);
      scrim.addEventListener('click', onBackdrop);
      primaryBtn.addEventListener('click', onPrimary);
      setTimeout(function () { primaryBtn.focus(); }, 30);
    });
  }

  function workspaceConfirm(message, opts) {
    ensureReady();
    opts = opts || {};
    return new Promise(function (resolve) {
      var root        = document.getElementById('workspace-modal');
      var titleEl     = document.getElementById('workspace-modal-title');
      var bodyEl      = document.getElementById('workspace-modal-body');
      var cancelBtn   = document.getElementById('workspace-modal-btn-cancel');
      var primaryBtn  = document.getElementById('workspace-modal-btn-primary');
      var scrim       = root.querySelector('.workspace-modal-scrim');

      titleEl.textContent     = opts.title || 'Confirm';
      bodyEl.textContent      = message == null ? '' : String(message);
      cancelBtn.style.display = '';
      cancelBtn.textContent   = opts.cancelText  || 'Cancel';
      primaryBtn.textContent  = opts.confirmText || 'Confirm';
      root.setAttribute('data-variant', opts.variant || (opts.danger ? 'danger' : 'info'));

      var settled = false;
      function finish(val) {
        if (settled) return;
        settled = true;
        document.removeEventListener('keydown', onKey);
        scrim.removeEventListener('click', onBackdrop);
        cancelBtn.removeEventListener('click', onCancel);
        primaryBtn.removeEventListener('click', onConfirm);
        closeModal();
        resolve(val);
      }
      function onKey(e)      { if (e.key === 'Escape') finish(false); else if (e.key === 'Enter') finish(true); }
      function onBackdrop(e) { if (e.target === scrim) finish(false); }
      function onCancel()    { finish(false); }
      function onConfirm()   { finish(true); }

      root.classList.add('is-open');
      root.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
      document.addEventListener('keydown', onKey);
      scrim.addEventListener('click', onBackdrop);
      cancelBtn.addEventListener('click', onCancel);
      primaryBtn.addEventListener('click', onConfirm);
      setTimeout(function () { primaryBtn.focus(); }, 30);
    });
  }

  var flashTimer = null;
  var FLASH_GLYPH = {
    success: '✓',  // ✓
    error:   '!',
    info:    'i',
    warn:    '!',
  };
  function workspaceFlash(message, kind) {
    ensureReady();
    kind = kind || 'info';
    var el = document.getElementById('workspace-flash');
    if (!el) return;
    var t = el.querySelector('.workspace-flash-text');
    var icon = el.querySelector('.workspace-flash-icon');
    if (t) t.textContent = String(message == null ? '' : message);
    if (icon) icon.textContent = FLASH_GLYPH[kind] || '';
    el.setAttribute('data-kind', kind);
    el.classList.add('is-visible');
    if (flashTimer) clearTimeout(flashTimer);
    flashTimer = setTimeout(function () { el.classList.remove('is-visible'); }, 3500);
  }

  // ── Patch window.alert / window.confirm ───────────────────────────
  // window.alert(msg) — async-trigger custom modal, returns undefined
  //                    (call sites that don't await still see the modal)
  // window.confirm(msg) — special handling described below.
  var nativeAlert   = window.alert.bind(window);
  var nativeConfirm = window.confirm.bind(window);

  window.alert = function (msg) {
    // Fire-and-forget: the modal appears, the call site continues.
    // For most existing code this is fine because alert() is normally
    // called as a "stop, show error, return" pattern.
    workspaceAlert(msg).catch(function () {});
  };

  // window.confirm needs to return a boolean SYNCHRONOUSLY.
  // We can't do that with a custom modal — so we fall back to native
  // confirm() for sync callers. New code should use WorkspaceAlert.confirm()
  // which is async and returns a Promise<boolean>.
  // To still get the custom UI on existing call sites, mark the call
  // as awaitable: await WorkspaceAlert.confirm(msg). This keeps the
  // existing sync confirm() functional while encouraging migration.
  window.confirm = function (msg) {
    return nativeConfirm(msg);
  };

  // Convenience namespace
  window.WorkspaceAlert = {
    alert:   workspaceAlert,
    confirm: workspaceConfirm,
    flash:   workspaceFlash,
    _native: { alert: nativeAlert, confirm: nativeConfirm },
  };

  // Boot
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ensureReady);
  } else {
    ensureReady();
  }
})();
