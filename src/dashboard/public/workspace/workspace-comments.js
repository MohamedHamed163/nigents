/* ──────────────────────────────────────────────────────────────────────────
   workspace-comments.js — adds a comments thread under every issue card.

   Hooks the existing brief.js render without touching it: watches the DOM
   for issue-card elements (matched via [id^="card-"]) and appends a
   .workspace-comments block under each one. Uses the existing fetch
   interceptor in workspace-multi-app.js (auto ?app= + auth key).

   Author identity comes from /api/workspace/me — if the key holder has a
   name, comments they post are attributed to them; otherwise "Anonymous".
   ────────────────────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  // ── Styles (injected once) ─────────────────────────────────────────────
  function injectCSS() {
    if (document.getElementById('workspace-comments-css')) return;
    var s = document.createElement('style');
    s.id = 'workspace-comments-css';
    s.textContent = [
      /* ── Container ───────────────────────────────────────────── */
      '.workspace-comments {',
      '  margin-top: 18px; padding-top: 18px;',
      '  border-top: 1px solid var(--border, #2a2a35);',
      '  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;',
      '}',
      /* ── Header ──────────────────────────────────────────────── */
      '.workspace-comments-head {',
      '  display: flex; align-items: center; gap: 10px;',
      '  margin-bottom: 14px;',
      '}',
      '.workspace-comments-head .bc-title {',
      '  font-size: 13px; font-weight: 700; color: var(--text-primary, #fff);',
      '  letter-spacing: -0.01em;',
      '}',
      '.workspace-comments-head .bc-count {',
      '  padding: 2px 9px; border-radius: 999px;',
      '  background: rgba(255,255,255,0.06); color: var(--text-secondary, #c0c0c0);',
      '  font-size: 11px; font-weight: 700; font-family: ui-monospace, monospace;',
      '  min-width: 22px; text-align: center;',
      '}',
      '.workspace-comments-head .bc-icon {',
      '  width: 16px; height: 16px; color: var(--accent-orange, #ff570a); opacity: 0.85;',
      '}',
      /* ── Comment row ─────────────────────────────────────────── */
      '.workspace-comment {',
      '  display: flex; gap: 12px; padding: 14px 0;',
      '  border-bottom: 1px solid rgba(255,255,255,0.05);',
      '  animation: bcSlideIn 0.25s ease both;',
      '}',
      '@keyframes bcSlideIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }',
      '.workspace-comment:last-of-type { border-bottom: none; }',
      '.workspace-comment .bc-avatar {',
      '  flex-shrink: 0; width: 36px; height: 36px; border-radius: 50%;',
      '  display: flex; align-items: center; justify-content: center;',
      '  font-weight: 800; font-size: 14px; text-transform: uppercase;',
      '  background: linear-gradient(135deg, var(--accent-orange, #ff570a) 0%, #ff7e35 100%);',
      '  color: #09080c;',
      '  box-shadow: 0 4px 12px -4px rgba(255,87,10,0.4);',
      '}',
      /* Vary avatar color by role */
      '.workspace-comment.role-developer .bc-avatar { background: linear-gradient(135deg, #5eb3ff 0%, #3d8fd9 100%); box-shadow: 0 4px 12px -4px rgba(94,179,255,0.4); }',
      '.workspace-comment.role-designer  .bc-avatar { background: linear-gradient(135deg, #a78bfa 0%, #8b6dd9 100%); box-shadow: 0 4px 12px -4px rgba(167,139,250,0.4); }',
      '.workspace-comment.role-tester    .bc-avatar { background: linear-gradient(135deg, #2ee6b8 0%, #1bbf95 100%); box-shadow: 0 4px 12px -4px rgba(46,230,184,0.4); }',
      '.workspace-comment .bc-body {',
      '  flex: 1; min-width: 0;',
      '}',
      '.workspace-comment .bc-meta {',
      '  display: flex; gap: 8px; align-items: center; flex-wrap: wrap;',
      '  margin-bottom: 6px;',
      '}',
      '.workspace-comment .bc-author {',
      '  font-weight: 700; font-size: 13.5px; color: var(--text-primary, #fff);',
      '  letter-spacing: -0.01em;',
      '}',
      '.workspace-comment .bc-role {',
      '  font-size: 9.5px; padding: 2px 7px; border-radius: 4px;',
      '  background: rgba(255,255,255,0.05); color: var(--text-muted, #888);',
      '  text-transform: uppercase; letter-spacing: 0.08em; font-weight: 800;',
      '}',
      '.workspace-comment .bc-role.role-admin     { background: rgba(255,87,10,0.18); color: var(--accent-orange, #ff570a); }',
      '.workspace-comment .bc-role.role-developer { background: rgba(94,179,255,0.15); color: #5eb3ff; }',
      '.workspace-comment .bc-role.role-designer  { background: rgba(167,139,250,0.18); color: #a78bfa; }',
      '.workspace-comment .bc-role.role-tester    { background: rgba(46,230,184,0.18); color: #2ee6b8; }',
      '.workspace-comment .bc-time {',
      '  font-size: 11px; color: var(--text-muted, #888); font-family: ui-monospace, monospace;',
      '  margin-left: auto;',
      '}',
      '.workspace-comment .bc-text {',
      '  font-size: 13.5px; line-height: 1.55; color: var(--text-primary, #e8e8ea);',
      '  white-space: pre-wrap; word-wrap: break-word;',
      '  padding: 10px 14px;',
      '  background: rgba(255,255,255,0.025);',
      '  border-radius: 10px;',
      '  border: 1px solid rgba(255,255,255,0.04);',
      '}',
      '.workspace-comment .bc-actions {',
      '  margin-top: 6px; display: flex; gap: 12px;',
      '  opacity: 0; transition: opacity 0.15s ease;',
      '}',
      '.workspace-comment:hover .bc-actions { opacity: 1; }',
      '.workspace-comment .bc-actions button {',
      '  background: none; border: none; padding: 2px 0;',
      '  font-size: 11px; color: var(--text-muted, #888); cursor: pointer;',
      '  font-weight: 600;',
      '  transition: color 0.15s;',
      '}',
      '.workspace-comment .bc-actions button:hover { color: var(--accent-orange, #ff570a); }',
      '.workspace-comment .bc-actions button.del:hover { color: #ff5566; }',
      /* "edited" pill next to the timestamp */
      '.workspace-comment .bc-edited-tag {',
      '  display: inline-block; margin-left: 6px;',
      '  padding: 1px 7px; border-radius: 999px;',
      '  background: rgba(255,255,255,0.06); color: var(--text-muted, #888);',
      '  font-family: ui-monospace, monospace; font-size: 10px; font-weight: 600;',
      '  letter-spacing: 0.04em;',
      '}',
      /* ── Inline edit mode ─────────────────────────────────────── */
      '.workspace-comment.editing .bc-text,',
      '.workspace-comment.editing .bc-actions { display: none; }',
      '.bc-edit-wrap {',
      '  background: rgba(255,87,10,0.05);',
      '  border: 1px solid rgba(255,87,10,0.35);',
      '  border-radius: 10px; overflow: hidden;',
      '  box-shadow: 0 0 0 4px rgba(255,87,10,0.06);',
      '  transition: border-color 0.2s, box-shadow 0.2s;',
      '}',
      '.bc-edit-wrap:focus-within {',
      '  border-color: rgba(255,87,10,0.6);',
      '  box-shadow: 0 0 0 4px rgba(255,87,10,0.1);',
      '}',
      '.bc-edit-wrap textarea {',
      '  width: 100%; min-height: 70px; max-height: 320px;',
      '  padding: 10px 14px 6px; background: transparent;',
      '  color: var(--text-primary, #fff);',
      '  border: none; outline: none; resize: vertical;',
      '  font: inherit; font-size: 13.5px; line-height: 1.55;',
      '  display: block;',
      '}',
      '.bc-edit-wrap .bc-edit-bar {',
      '  display: flex; align-items: center; justify-content: space-between;',
      '  padding: 6px 12px 8px; border-top: 1px solid rgba(255,87,10,0.18);',
      '  gap: 10px;',
      '}',
      '.bc-edit-wrap .bc-edit-hint {',
      '  font-size: 11px; color: var(--text-muted, #888);',
      '}',
      '.bc-edit-wrap .bc-edit-hint kbd {',
      '  display: inline-block; padding: 1px 6px; border-radius: 4px;',
      '  background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.08);',
      '  font-family: ui-monospace, monospace; font-size: 10px;',
      '  color: var(--text-secondary, #c0c0c0); margin: 0 2px;',
      '}',
      '.bc-edit-wrap .bc-edit-btns { display: flex; gap: 6px; }',
      '.bc-edit-wrap button {',
      '  border: none; cursor: pointer; padding: 5px 12px;',
      '  border-radius: 999px; font-size: 11px; font-weight: 700;',
      '  letter-spacing: 0.02em; transition: transform 0.12s, opacity 0.2s;',
      '}',
      '.bc-edit-wrap button.bc-save {',
      '  background: linear-gradient(135deg, var(--accent-orange, #ff570a) 0%, #ff7e35 100%);',
      '  color: #09080c; box-shadow: 0 3px 10px -3px rgba(255,87,10,0.5);',
      '}',
      '.bc-edit-wrap button.bc-save:disabled {',
      '  opacity: 0.4; cursor: not-allowed; background: rgba(255,255,255,0.08);',
      '  color: rgba(255,255,255,0.4); box-shadow: none;',
      '}',
      '.bc-edit-wrap button.bc-save:not(:disabled):hover { transform: translateY(-1px); }',
      '.bc-edit-wrap button.bc-cancel {',
      '  background: transparent; color: var(--text-muted, #888);',
      '  border: 1px solid rgba(255,255,255,0.1);',
      '}',
      '.bc-edit-wrap button.bc-cancel:hover { color: var(--text-primary, #fff); border-color: rgba(255,255,255,0.2); }',
      '.bc-edit-err {',
      '  padding: 6px 12px; background: rgba(248,113,113,0.08);',
      '  border-top: 1px solid rgba(248,113,113,0.3); color: #f87171;',
      '  font-size: 11.5px; font-weight: 600; display: none;',
      '}',
      '.bc-edit-err.show { display: block; }',
      /* ── Compose box ─────────────────────────────────────────── */
      '.workspace-comment-input {',
      '  display: flex; gap: 12px; margin-top: 18px;',
      '  align-items: flex-start;',
      '}',
      '.workspace-comment-input .bc-avatar {',
      '  flex-shrink: 0; width: 36px; height: 36px; border-radius: 50%;',
      '  display: flex; align-items: center; justify-content: center;',
      '  font-weight: 800; font-size: 14px; text-transform: uppercase;',
      '  background: linear-gradient(135deg, var(--accent-orange, #ff570a) 0%, #ff7e35 100%);',
      '  color: #09080c;',
      '  box-shadow: 0 4px 12px -4px rgba(255,87,10,0.4);',
      '  margin-top: 2px;',
      '}',
      '.workspace-comment-input .bc-compose-wrap {',
      '  flex: 1; min-width: 0;',
      '  background: rgba(255,255,255,0.025);',
      '  border: 1px solid rgba(255,255,255,0.08);',
      '  border-radius: 14px;',
      '  overflow: hidden;',
      '  transition: border-color 0.2s, box-shadow 0.2s, background 0.2s;',
      '}',
      '.workspace-comment-input .bc-compose-wrap:focus-within {',
      '  border-color: rgba(255,87,10,0.55);',
      '  background: rgba(255,87,10,0.04);',
      '  box-shadow: 0 0 0 4px rgba(255,87,10,0.08), 0 10px 30px -10px rgba(0,0,0,0.5);',
      '}',
      '.workspace-comment-input textarea {',
      '  width: 100%; min-height: 72px; max-height: 240px;',
      '  padding: 14px 16px 8px;',
      '  background: transparent; color: var(--text-primary, #fff);',
      '  border: none; outline: none;',
      '  font: inherit; font-size: 13.5px; line-height: 1.55;',
      '  resize: none;',
      '  display: block;',
      '}',
      '.workspace-comment-input textarea::placeholder {',
      '  color: rgba(255,255,255,0.3); font-style: italic;',
      '}',
      '.workspace-comment-input .bc-toolbar {',
      '  display: flex; align-items: center; justify-content: space-between;',
      '  padding: 8px 12px 10px 16px;',
      '  border-top: 1px solid rgba(255,255,255,0.04);',
      '  gap: 12px;',
      '}',
      '.workspace-comment-input .bc-hint {',
      '  font-size: 11px; color: var(--text-muted, #888);',
      '  display: flex; align-items: center; gap: 6px;',
      '}',
      '.workspace-comment-input .bc-hint kbd {',
      '  display: inline-block; padding: 1px 6px; border-radius: 4px;',
      '  background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.08);',
      '  font-family: ui-monospace, monospace; font-size: 10px;',
      '  color: var(--text-secondary, #c0c0c0); line-height: 1.4;',
      '}',
      '.workspace-comment-input .bc-author-tag { font-weight: 700; color: var(--text-secondary, #c0c0c0); }',
      '.workspace-comment-input button.bc-post-btn {',
      '  display: inline-flex; align-items: center; gap: 7px;',
      '  padding: 7px 16px; border-radius: 999px; border: none;',
      '  background: linear-gradient(135deg, var(--accent-orange, #ff570a) 0%, #ff7e35 100%);',
      '  color: #09080c; font-weight: 700; font-size: 12px;',
      '  cursor: pointer; letter-spacing: 0.01em;',
      '  box-shadow: 0 4px 14px -4px rgba(255,87,10,0.5);',
      '  transition: transform 0.12s ease, box-shadow 0.2s ease, opacity 0.2s;',
      '}',
      '.workspace-comment-input button.bc-post-btn svg { width: 12px; height: 12px; }',
      '.workspace-comment-input button.bc-post-btn:disabled {',
      '  opacity: 0.35; cursor: not-allowed; box-shadow: none;',
      '  background: rgba(255,255,255,0.08); color: rgba(255,255,255,0.4);',
      '}',
      '.workspace-comment-input button.bc-post-btn:not(:disabled):hover {',
      '  transform: translateY(-1px); box-shadow: 0 8px 22px -4px rgba(255,87,10,0.6);',
      '}',
      '.workspace-comment-input button.bc-post-btn:not(:disabled):active { transform: translateY(0); }',
      /* ── Empty state ─────────────────────────────────────────── */
      '.workspace-comments-empty {',
      '  padding: 22px 16px; text-align: center; font-size: 13px;',
      '  color: var(--text-muted, #888);',
      '  background: rgba(255,255,255,0.015);',
      '  border: 1px dashed rgba(255,255,255,0.08);',
      '  border-radius: 12px;',
      '}',
      '.workspace-comments-empty .bc-empty-icon {',
      '  font-size: 22px; display: block; margin-bottom: 6px; opacity: 0.4;',
      '}',
      /* ── Inline error ────────────────────────────────────────── */
      '.workspace-comments-err {',
      '  padding: 8px 14px; background: rgba(248,113,113,0.08);',
      '  border: 1px solid rgba(248,113,113,0.3); border-radius: 8px;',
      '  color: #f87171; font-size: 12px; margin: 8px 0 -2px; display: none;',
      '  font-weight: 600;',
      '}',
      '.workspace-comments-err.show { display: block; }',
      /* Mobile spacing tweaks */
      '@media (max-width: 600px) {',
      '  .workspace-comment .bc-time { margin-left: 0; }',
      '  .workspace-comment .bc-actions { opacity: 1; }',
      '  .workspace-comment-input .bc-toolbar { flex-wrap: wrap; }',
      '}',
    ].join('\n');
    document.head.appendChild(s);
  }

  // ── Utilities ──────────────────────────────────────────────────────────
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c];
    });
  }
  function fmtTime(s) {
    if (!s) return '';
    try {
      var d = new Date(s);
      var now = new Date();
      var diffSec = Math.floor((now - d) / 1000);
      if (diffSec < 60)  return diffSec + 's ago';
      if (diffSec < 3600) return Math.floor(diffSec / 60) + 'm ago';
      if (diffSec < 86400) return Math.floor(diffSec / 3600) + 'h ago';
      if (diffSec < 604800) return Math.floor(diffSec / 86400) + 'd ago';
      return d.toLocaleDateString(undefined, { month:'short', day:'numeric', year:'numeric' });
    } catch (_) { return s; }
  }
  function initial(name) {
    return String(name || '?').trim().charAt(0).toUpperCase() || '?';
  }

  // ── Author cache (1 fetch per page) ────────────────────────────────────
  var meCache = null;
  async function whoAmI() {
    if (meCache !== null) return meCache;
    try {
      var r = await fetch('/api/workspace/me');
      var j = await r.json();
      meCache = (j && j.success) ? j.user : null;
    } catch (_) { meCache = null; }
    return meCache;
  }

  // ── Render single comment row ──────────────────────────────────────────
  function renderComment(c, me) {
    var roleClass = c.user_role ? 'role-' + esc(c.user_role) : '';
    var canEdit = me && me.id && (Number(me.id) === Number(c.user_id) || me.role === 'admin');
    var editedTag = c.edited_at
      ? '<span class="bc-edited-tag" title="Last edited ' + esc(fmtTime(c.edited_at)) + '">edited</span>'
      : '';
    // Stash the raw body on the row as a data attribute so the inline editor
    // can restore exact text (including newlines) without re-fetching.
    return (
      '<div class="workspace-comment ' + roleClass + '" data-cid="' + c.id + '" data-body="' + esc(c.body) + '">' +
        '<div class="bc-avatar" title="' + esc(c.user_name || 'Anonymous') + '">' + esc(initial(c.user_name)) + '</div>' +
        '<div class="bc-body">' +
          '<div class="bc-meta">' +
            '<span class="bc-author">' + esc(c.user_name || 'Anonymous') + '</span>' +
            (c.user_role ? '<span class="bc-role ' + roleClass + '">' + esc(c.user_role) + '</span>' : '') +
            '<span class="bc-time">' + esc(fmtTime(c.created_at)) + editedTag + '</span>' +
          '</div>' +
          '<div class="bc-text">' + esc(c.body) + '</div>' +
          (canEdit
            ? '<div class="bc-actions">' +
                '<button data-act="edit">Edit</button>' +
                '<button data-act="del" class="del">Delete</button>' +
              '</div>'
            : ''
          ) +
        '</div>' +
      '</div>'
    );
  }

  // Reusable header markup
  function headerHtml(countLabel) {
    var chatIcon =
      '<svg class="bc-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
        '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>' +
      '</svg>';
    return (
      '<div class="workspace-comments-head">' +
        chatIcon +
        '<span class="bc-title">Discussion</span>' +
        '<span class="bc-count">' + esc(countLabel) + '</span>' +
      '</div>'
    );
  }

  // Detect if user is on a Mac to show ⌘ instead of Ctrl in the keyboard hint
  function shortcutKey() {
    try {
      var isMac = /Mac|iPhone|iPad|iPod/.test(navigator.platform) ||
                  /Mac/i.test((navigator.userAgentData && navigator.userAgentData.platform) || '');
      return isMac ? '⌘' : 'Ctrl';
    } catch (_) { return 'Ctrl'; }
  }

  // ── Build / refresh the comments block on one issue card ──────────────
  async function loadIssueComments(card) {
    var id = Number(card.dataset.id || (card.id || '').replace(/^card-/, ''));
    if (!id) return;
    var box = card.querySelector('.workspace-comments');
    if (!box) {
      box = document.createElement('div');
      box.className = 'workspace-comments';
      card.appendChild(box);
    }
    box.innerHTML = headerHtml('…') + '<div class="workspace-comments-list">Loading…</div>';

    var me = await whoAmI();
    var r, j;
    try {
      r = await fetch('/api/workspace/issues/' + id + '/comments');
      j = await r.json();
    } catch (e) {
      box.querySelector('.workspace-comments-list').innerHTML =
        '<div class="workspace-comments-empty">Failed to load comments.</div>';
      return;
    }
    var comments = (j && j.comments) || [];
    var listHtml = comments.length
      ? comments.map(function (c) { return renderComment(c, me); }).join('')
      : '<div class="workspace-comments-empty">' +
          '<span class="bc-empty-icon">💬</span>' +
          'No comments yet — be the first to weigh in.' +
        '</div>';

    var amName = (me && me.name) || 'Anonymous';
    var amInit = initial(amName);
    var roleTag = me && me.role ? ' (' + esc(me.role) + ')' : '';
    var sendIcon =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
        '<path d="M22 2 11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/>' +
      '</svg>';
    var inputHtml =
      '<div class="workspace-comment-input">' +
        '<div class="bc-avatar" title="' + esc(amName) + '">' + esc(amInit) + '</div>' +
        '<div class="bc-compose-wrap">' +
          '<textarea placeholder="Reply to this bug — drop context, suggestions, or a fix you tried…" maxlength="8000" rows="3"></textarea>' +
          '<div class="bc-toolbar">' +
            '<span class="bc-hint">' +
              '<kbd>' + shortcutKey() + '</kbd><kbd>Enter</kbd>' +
              '<span style="opacity:.6;">to post as</span>' +
              '<span class="bc-author-tag">' + esc(amName) + roleTag + '</span>' +
            '</span>' +
            '<button class="bc-post-btn" type="button" disabled>' +
              sendIcon + '<span>Post</span>' +
            '</button>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="workspace-comments-err"></div>';

    box.innerHTML =
      headerHtml(String(comments.length)) +
      '<div class="workspace-comments-list">' + listHtml + '</div>' +
      inputHtml;

    bindInteractions(box, id);
  }

  // ── Bind post / edit / delete actions on one box ──────────────────────
  function bindInteractions(box, issueId) {
    var ta   = box.querySelector('textarea');
    var btn  = box.querySelector('.bc-post-btn');
    var err  = box.querySelector('.workspace-comments-err');

    function showErr(msg) { err.textContent = msg; err.classList.add('show'); }
    function clearErr()   { err.textContent = ''; err.classList.remove('show'); }

    // Auto-resize textarea + keep Post button in sync with content
    function refreshState() {
      var hasContent = ta.value.trim().length > 0;
      btn.disabled = !hasContent;
      // Auto-grow up to max-height (CSS caps it at 240px)
      ta.style.height = 'auto';
      ta.style.height = Math.min(ta.scrollHeight, 240) + 'px';
    }
    ta.addEventListener('input', refreshState);
    refreshState();

    async function postComment() {
      var body = ta.value.trim();
      if (!body) { showErr('Type a comment first.'); return; }
      clearErr();
      var origLabel = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = '<span style="font-family:ui-monospace,monospace;font-size:11px;">posting…</span>';
      try {
        var r = await fetch('/api/workspace/issues/' + issueId + '/comments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ body: body }),
        });
        var j = await r.json();
        if (!j.success) {
          showErr(j.error || 'Failed to post');
          btn.disabled = false; btn.innerHTML = origLabel;
          return;
        }
        ta.value = '';
        // Re-render the comments list
        await loadIssueComments(box.parentElement);
      } catch (e) {
        showErr('Network error: ' + (e.message || ''));
        btn.disabled = false; btn.innerHTML = origLabel;
      }
    }

    btn.addEventListener('click', postComment);

    // Submit on ⌘/Ctrl + Enter
    ta.addEventListener('keydown', function (e) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        if (!btn.disabled) postComment();
      }
    });

    // Edit / delete on each comment
    box.querySelectorAll('.workspace-comment').forEach(function (row) {
      var cid = Number(row.dataset.cid);
      row.querySelectorAll('.bc-actions button').forEach(function (b) {
        b.addEventListener('click', async function () {
          var act = b.dataset.act;
          if (act === 'del') {
            // Use the custom modal when available; native confirm() as graceful fallback
            var ok = window.WorkspaceAlert
              ? await window.WorkspaceAlert.confirm('Delete this comment?', { title: 'Delete comment', danger: true, confirmText: 'Delete' })
              : confirm('Delete this comment?');
            if (!ok) return;
            var r = await fetch('/api/workspace/issues/' + issueId + '/comments/' + cid, { method: 'DELETE' });
            var j = await r.json();
            if (!j.success) {
              if (window.WorkspaceAlert) window.WorkspaceAlert.flash(j.error || 'Delete failed', 'error');
              else alert(j.error || 'Delete failed');
              return;
            }
            await loadIssueComments(box.parentElement);
          } else if (act === 'edit') {
            startInlineEdit(row, cid, issueId, box);
          }
        });
      });
    });
  }

  // ── Inline edit: swap the comment text for an editable textarea ───────
  function startInlineEdit(row, cid, issueId, box) {
    // Idempotent — don't double-open if user re-clicks Edit
    if (row.classList.contains('editing')) {
      var existing = row.querySelector('.bc-edit-wrap textarea');
      if (existing) existing.focus();
      return;
    }
    var bodyEl = row.querySelector('.bc-body');
    var textEl = row.querySelector('.bc-text');
    // Pull the original raw body off the data attribute so multi-line content
    // is preserved exactly. Falls back to whatever's rendered if absent.
    var original = row.dataset.body != null ? row.dataset.body : textEl.textContent;

    var wrap = document.createElement('div');
    wrap.className = 'bc-edit-wrap';
    wrap.innerHTML =
      '<textarea maxlength="8000"></textarea>' +
      '<div class="bc-edit-bar">' +
        '<span class="bc-edit-hint">' +
          '<kbd>' + shortcutKey() + '</kbd><kbd>Enter</kbd> save · ' +
          '<kbd>Esc</kbd> cancel' +
        '</span>' +
        '<span class="bc-edit-btns">' +
          '<button type="button" class="bc-cancel">Cancel</button>' +
          '<button type="button" class="bc-save">Save</button>' +
        '</span>' +
      '</div>' +
      '<div class="bc-edit-err"></div>';
    // Insert right after the text element so it visually replaces it
    textEl.insertAdjacentElement('afterend', wrap);
    row.classList.add('editing');

    var ta     = wrap.querySelector('textarea');
    var saveBt = wrap.querySelector('.bc-save');
    var cancBt = wrap.querySelector('.bc-cancel');
    var errEl  = wrap.querySelector('.bc-edit-err');
    ta.value = original;
    // Auto-grow + focus at end of text
    function autoGrow() {
      ta.style.height = 'auto';
      ta.style.height = Math.min(ta.scrollHeight, 320) + 'px';
    }
    autoGrow();
    ta.focus();
    try { ta.setSelectionRange(ta.value.length, ta.value.length); } catch (_) {}

    function refresh() {
      var v = ta.value.trim();
      saveBt.disabled = !v || v === original.trim();
    }
    refresh();
    ta.addEventListener('input', function () { autoGrow(); refresh(); errEl.classList.remove('show'); });

    function close() {
      row.classList.remove('editing');
      wrap.remove();
    }

    cancBt.addEventListener('click', close);

    async function save() {
      var next = ta.value.trim();
      if (!next) { errEl.textContent = 'Comment cannot be empty.'; errEl.classList.add('show'); return; }
      if (next === original.trim()) { close(); return; }
      var origLabel = saveBt.textContent;
      saveBt.disabled = true; saveBt.textContent = 'saving…';
      errEl.classList.remove('show');
      try {
        var r = await fetch('/api/workspace/issues/' + issueId + '/comments/' + cid, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ body: next }),
        });
        var j = await r.json();
        if (!j.success) {
          errEl.textContent = j.error || 'Edit failed';
          errEl.classList.add('show');
          saveBt.disabled = false; saveBt.textContent = origLabel;
          return;
        }
        // Re-render thread so the "edited" tag appears + the saved body shows
        await loadIssueComments(box.parentElement);
      } catch (e) {
        errEl.textContent = 'Network error: ' + (e.message || '');
        errEl.classList.add('show');
        saveBt.disabled = false; saveBt.textContent = origLabel;
      }
    }
    saveBt.addEventListener('click', save);

    // ⌘/Ctrl+Enter → save · Esc → cancel
    ta.addEventListener('keydown', function (e) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        if (!saveBt.disabled) save();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        close();
      }
    });
  }

  // ── Watch the issue list for new/re-rendered cards, attach comments ───
  var seen = new WeakSet();
  function scan(root) {
    var cards = (root || document).querySelectorAll('.issue-card[id^="card-"]');
    cards.forEach(function (card) {
      if (seen.has(card)) return;
      seen.add(card);
      loadIssueComments(card);
    });
  }

  function start() {
    injectCSS();
    scan(document);
    // brief.js re-renders the list whenever data reloads → MutationObserver
    var mo = new MutationObserver(function (mutations) {
      for (var i = 0; i < mutations.length; i++) {
        var m = mutations[i];
        if (m.addedNodes && m.addedNodes.length) {
          for (var j = 0; j < m.addedNodes.length; j++) {
            var n = m.addedNodes[j];
            if (n && n.nodeType === 1) {
              if (n.classList && n.classList.contains('issue-card')) {
                if (!seen.has(n)) { seen.add(n); loadIssueComments(n); }
              } else if (n.querySelectorAll) {
                scan(n);
              }
            }
          }
        }
      }
    });
    mo.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
