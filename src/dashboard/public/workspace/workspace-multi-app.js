/* ──────────────────────────────────────────────────────────────────────────
   workspace-multi-app.js — turns the Workspace UI into a multi-tenant workspace.

   Without touching any existing workspace page or API call, this:
   1. Resolves the current app from ?app=<slug> in URL (default 'workspace')
   2. Wraps window.fetch so EVERY /api/workspace/* request transparently
      carries ?app=<slug> — backend already scopes by it (Phase 2)
   3. Injects a small "App" pill in the page header so users can switch
      between Workspace / Tawazon / Droop / QuickIn without touching the URL

   Load order matters — include this BEFORE any other script that calls fetch.
   ────────────────────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  // ── 0. Client-side image compression (kills 413 errors at the source) ──
  // Any image > 600 KB is re-encoded to a max 2000-px-wide JPEG at 0.85
  // quality before it leaves the browser. PNG/GIF/WebP all flatten to JPEG
  // unless they're already small. Failure modes fall back to the original
  // file untouched, so nothing breaks if the canvas API is unavailable.
  var COMPRESS_THRESHOLD_BYTES = 600 * 1024;   // 600 KB
  var COMPRESS_MAX_DIMENSION   = 2000;          // px (longest edge)
  var COMPRESS_JPEG_QUALITY    = 0.85;

  function isCompressibleImage(file) {
    if (!file || !file.type) return false;
    return /^image\/(png|jpe?g|webp|gif)$/i.test(file.type)
      && typeof HTMLCanvasElement !== 'undefined'
      && file.size > COMPRESS_THRESHOLD_BYTES;
  }

  function compressImage(file) {
    return new Promise(function (resolve) {
      try {
        var url = URL.createObjectURL(file);
        var img = new Image();
        img.onload = function () {
          URL.revokeObjectURL(url);
          var w = img.naturalWidth, h = img.naturalHeight;
          if (!w || !h) return resolve(file);
          if (w > COMPRESS_MAX_DIMENSION || h > COMPRESS_MAX_DIMENSION) {
            var scale = Math.min(COMPRESS_MAX_DIMENSION / w, COMPRESS_MAX_DIMENSION / h);
            w = Math.round(w * scale);
            h = Math.round(h * scale);
          }
          var canvas = document.createElement('canvas');
          canvas.width = w; canvas.height = h;
          var ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, w, h);
          canvas.toBlob(function (blob) {
            if (!blob || blob.size >= file.size) return resolve(file); // keep smaller original
            // Rename to .jpg so the server knows what we sent
            var origName = (file.name || 'image').replace(/\.[^.]+$/, '');
            var newName  = origName + '-compressed.jpg';
            try {
              var compressed = new File([blob], newName, { type: 'image/jpeg', lastModified: Date.now() });
              resolve(compressed);
            } catch (_) {
              // Old browsers don't support the File constructor — fall back to a Blob
              blob.name = newName;
              resolve(blob);
            }
          }, 'image/jpeg', COMPRESS_JPEG_QUALITY);
        };
        img.onerror = function () { URL.revokeObjectURL(url); resolve(file); };
        img.src = url;
      } catch (_) {
        resolve(file);
      }
    });
  }

  /** Replace large images inside a FormData with compressed copies. */
  async function compressFormDataImages(fd) {
    if (typeof FormData === 'undefined' || !(fd instanceof FormData)) return fd;
    try {
      var entries = [];
      fd.forEach(function (value, key) { entries.push([key, value]); });
      var jobs = entries.map(async function (pair) {
        var key = pair[0], val = pair[1];
        if (val instanceof File && isCompressibleImage(val)) {
          pair[1] = await compressImage(val);
        }
        return pair;
      });
      var done = await Promise.all(jobs);
      // Rebuild the FormData so order + repeats are preserved
      var out = new FormData();
      done.forEach(function (p) { out.append(p[0], p[1]); });
      return out;
    } catch (_) {
      return fd; // never block the upload
    }
  }

  // ── 1. Resolve current app ─────────────────────────────────────────────
  var APPS = {
    workspace:      { label: 'Workspace',       color: '#ff570a' },
    tawazon:     { label: 'Tawazon',      color: '#19d59e' },
    droop:       { label: 'Droop',        color: '#ff3d5c' },
    quickin:     { label: 'QuickIn',      color: '#5B0F16' },
  };

  function getAppSlug() {
    try {
      var params = new URLSearchParams(window.location.search);
      var fromQuery = (params.get('app') || '').toLowerCase();
      if (fromQuery && APPS[fromQuery]) return fromQuery;
      // Path-based fallback: /tawazon/, /droop/
      var first = (window.location.pathname.split('/').filter(Boolean)[0] || '').toLowerCase();
      if (APPS[first]) return first;
    } catch (_) { /* ignore */ }
    return 'workspace';
  }

  var APP_SLUG = getAppSlug();
  var APP_META = APPS[APP_SLUG] || APPS.workspace;
  window.WORKSPACE_APP = APP_SLUG;
  window.WORKSPACE_APP_LABEL = APP_META.label;
  window.WORKSPACE_APP_COLOR = APP_META.color;

  // ── 2. fetch() interceptor ─────────────────────────────────────────────
  // For every request to /api/workspace/* :
  //   a) Add ?app=<slug> (if not already present)
  //   b) Add x-workspace-edit-key header from localStorage.workspace_edit_key
  //      (if a key is set AND no key is already on the request)
  //   This makes the Excel upload and any other call that didn't manually
  //   thread the key through still get auth'd correctly.
  function isWorkspaceApi(urlStr) {
    return typeof urlStr === 'string' && urlStr.indexOf('/api/workspace/') !== -1;
  }
  function storedKey() {
    try { return localStorage.getItem('workspace_edit_key') || ''; } catch (_) { return ''; }
  }
  var originalFetch = window.fetch ? window.fetch.bind(window) : null;
  if (originalFetch) {
    window.fetch = async function (input, init) {
      var targetUrl = '';     // captured for the response interceptor below
      var sentKey   = '';     // the key value we ended up sending (if any)

      // Compress images BEFORE injecting headers so the multipart body is
      // already shrunk by the time it leaves the browser.
      try {
        var probeUrl =
          (typeof input === 'string' ? input : (input && input.url) || '');
        if (probeUrl && probeUrl.indexOf('/media/upload') !== -1 &&
            init && init.body instanceof FormData) {
          init.body = await compressFormDataImages(init.body);
        }
      } catch (_) { /* upload still works without compression */ }

      try {
        var urlStr;
        if (typeof input === 'string') urlStr = input;
        else if (input && input.url)    urlStr = input.url;
        else                            urlStr = '';

        if (isWorkspaceApi(urlStr)) {
          // (a) inject ?app=<slug>
          var u = new URL(urlStr, window.location.origin);
          if (!u.searchParams.has('app')) {
            u.searchParams.set('app', APP_SLUG);
          }
          var newUrl = u.pathname + u.search + u.hash;
          targetUrl = u.pathname;

          // (b) inject x-workspace-edit-key header if a key is stored
          var key = storedKey();
          if (key) {
            sentKey = key;
            init = init || {};
            // Don't clobber a header that's already there
            var existingHeaders = init.headers || (input && input.headers) || {};
            var keyAlready = false;
            try {
              if (existingHeaders instanceof Headers) {
                keyAlready = existingHeaders.has('x-workspace-edit-key');
              } else if (typeof existingHeaders === 'object') {
                for (var h in existingHeaders) {
                  if (String(h).toLowerCase() === 'x-workspace-edit-key') { keyAlready = true; break; }
                }
              }
            } catch (_) { /* ignore */ }
            if (!keyAlready) {
              // Convert headers to a plain object so we can extend it safely
              var headerObj = {};
              if (existingHeaders instanceof Headers) {
                existingHeaders.forEach(function (v, k) { headerObj[k] = v; });
              } else if (existingHeaders && typeof existingHeaders === 'object') {
                for (var hk in existingHeaders) headerObj[hk] = existingHeaders[hk];
              }
              headerObj['x-workspace-edit-key'] = key;
              init.headers = headerObj;
            }
          }

          if (typeof input === 'string') {
            input = newUrl;
          } else {
            try { input = new Request(newUrl, init || input); } catch (_) { /* fall back */ }
          }
        }
      } catch (_) { /* never block a fetch on our wrapper failing */ }

      // Response interceptor: if the SERVER rejected our stored key (401 / 403
      // on /api/workspace/me specifically), clear it so subsequent page loads
      // don't keep firing failed requests. Other endpoints get a softer touch:
      // on 401 we just drop the key. We never throw — the caller still sees
      // the original Response object.
      return originalFetch(input, init).then(function (resp) {
        try {
          if (sentKey && resp && (resp.status === 401 || (resp.status === 403 && targetUrl.endsWith('/api/workspace/me')))) {
            try { localStorage.removeItem('workspace_edit_key'); } catch (_) {}
            // Surface a small flash so the user knows why the UI went anonymous
            try {
              if (!document.getElementById('workspace-key-evicted-toast')) {
                var t = document.createElement('div');
                t.id = 'workspace-key-evicted-toast';
                t.textContent = 'Your edit key was rejected by the server — re-enter it to make changes.';
                t.style.cssText = 'position:fixed;bottom:18px;left:50%;transform:translateX(-50%);z-index:10000;background:#141116;color:#fff;border:1px solid #ff570a;padding:10px 18px;border-radius:10px;font:13px/1.4 -apple-system,BlinkMacSystemFont,sans-serif;box-shadow:0 8px 30px rgba(0,0,0,0.5);max-width:90vw;';
                document.body && document.body.appendChild(t);
                setTimeout(function () { t.remove(); }, 6000);
              }
            } catch (_) {}
          }
        } catch (_) {}
        return resp;
      });
    };
  }

  // ── 3a. Apply per-app accent colour + page title
  // For non-Workspace apps we override the orange accent vars used throughout
  // brief.css so headings / buttons / pills carry that app's brand.
  function applyAppBranding() {
    if (APP_SLUG === 'workspace') return; // leave Workspace's orange untouched
    var c  = APP_META.color;
    var c2 = APP_META.color;
    // Inject a top-of-document <style> override (specific enough to beat
    // the workspace-theme defaults). We only flip the accent — text/bg stay.
    var s = document.createElement('style');
    s.id = 'workspace-multi-app-theme';
    s.textContent =
      ':root, body.workspace-theme {' +
        '--accent-orange:' + c + ' !important;' +
        '--accent-orange-2:' + c + ' !important;' +
      '}' +
      // Common spots that hardcode the orange hex
      '[style*="#ff570a"], [style*="#FF570A"] { color:' + c + ' !important; }' +
      // The Workspace blue "Workspace" word in the top-left → swap to per-app colour + label
      '.workspace-mark .vb-name { color:' + c + ' !important; }';
    document.documentElement.appendChild(s);

    // Rewrite the page <title> to lead with the app label
    try {
      if (document.title && document.title.indexOf('Workspace') !== -1) {
        document.title = document.title.replace(/Workspace/g, APP_META.label);
      } else if (document.title) {
        document.title = APP_META.label + ' — ' + document.title;
      }
    } catch (_) {}
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyAppBranding);
  } else {
    applyAppBranding();
  }

  // ── 3b. Replace "Workspace" text labels with the app name after render
  function replaceWorkspaceText() {
    if (APP_SLUG === 'workspace') return;
    try {
      // 1) The top-left vb-name (often set to "Workspace" by sheet.html inline)
      var vb = document.querySelector('.logo-block.workspace-mark .vb-name');
      if (vb && /^Workspace\b/.test((vb.textContent || '').trim())) {
        vb.textContent = APP_META.label;
      }
      // 2) The "Workspace hub" link in the sheet topnav
      document.querySelectorAll('.workspace-sheet-topnav a').forEach(function (a) {
        if ((a.textContent || '').trim() === '← Workspace hub') {
          a.textContent = '← ' + APP_META.label + ' hub';
        }
      });
      // 3) Visible "Workspace" in headings (e.g. h1/h2 with the word)
      ['h1','h2','h3'].forEach(function (tag) {
        document.querySelectorAll(tag).forEach(function (el) {
          if (el.dataset.workspaceRenamed === '1') return;
          var t = el.textContent || '';
          if (/^Workspace\b/.test(t.trim())) {
            el.textContent = t.replace(/^Workspace\b/, APP_META.label);
            el.dataset.workspaceRenamed = '1';
          }
        });
      });
    } catch (_) { /* ignore */ }
  }
  // Run once on load + observe DOM mutations so dynamically-rendered titles
  // (brief.js sets vb-name later) are also caught.
  function watchAndReplace() {
    replaceWorkspaceText();
    var seenChanges = 0;
    var mo = new MutationObserver(function () {
      seenChanges++;
      replaceWorkspaceText();
      // After a settling period, disconnect to avoid forever loops
      if (seenChanges > 50) mo.disconnect();
    });
    mo.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
    // Hard cap — observer dies after 8 seconds regardless
    setTimeout(function () { mo.disconnect(); }, 8000);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', watchAndReplace);
  } else {
    watchAndReplace();
  }

  // ── 3c. App-switcher pill — inserted into the page after DOMContentLoaded
  function injectSwitcher() {
    if (document.getElementById('workspace-app-switch')) return;
    var bar = document.createElement('div');
    bar.id = 'workspace-app-switch';
    bar.setAttribute('role', 'navigation');
    bar.setAttribute('aria-label', 'App switcher');
    bar.style.cssText = [
      'position:fixed', 'top:12px', 'right:14px', 'z-index:9999',
      'display:flex', 'align-items:center', 'gap:8px',
      'padding:6px 10px', 'background:#141116', 'border:1px solid #2a2a35',
      'border-radius:999px', 'font-family:-apple-system,BlinkMacSystemFont,sans-serif',
      'font-size:12px', 'color:#a0a0a0',
      'box-shadow:0 8px 20px -8px rgba(0,0,0,0.5)',
    ].join(';');

    var dot = document.createElement('span');
    dot.style.cssText = 'display:inline-block;width:10px;height:10px;border-radius:50%;background:' + APP_META.color + ';flex-shrink:0;';
    bar.appendChild(dot);

    var label = document.createElement('span');
    label.style.cssText = 'font-weight:700;color:#fff;font-size:12px;';
    label.textContent = APP_META.label;
    bar.appendChild(label);

    var sel = document.createElement('select');
    sel.setAttribute('aria-label', 'Switch app');
    sel.style.cssText = [
      'background:transparent', 'border:none', 'color:#a0a0a0',
      'font:inherit', 'cursor:pointer', 'outline:none',
      'padding:2px 4px', 'margin-left:2px',
    ].join(';');
    Object.keys(APPS).forEach(function (slug) {
      var opt = document.createElement('option');
      opt.value = slug;
      opt.textContent = '↻ ' + APPS[slug].label;
      opt.style.color = '#000';
      if (slug === APP_SLUG) opt.selected = true;
      sel.appendChild(opt);
    });
    sel.addEventListener('change', function () {
      var next = sel.value;
      if (!APPS[next] || next === APP_SLUG) return;
      // Preserve path, replace ?app= with the new slug, drop other state
      var u = new URL(window.location.href);
      u.searchParams.set('app', next);
      // Drop sheet-specific params so we don't try to load a sheet from
      // the wrong app
      u.searchParams.delete('slug');
      u.searchParams.delete('sheet');
      window.location.href = u.pathname + u.search;
    });
    bar.appendChild(sel);

    var hubLink = document.createElement('a');
    hubLink.href = '/apps/';
    hubLink.textContent = 'Apps hub ↗';
    hubLink.style.cssText = 'color:#666;text-decoration:none;font-size:11px;margin-left:6px;border-left:1px solid #2a2a35;padding-left:10px;';
    bar.appendChild(hubLink);

    document.body.appendChild(bar);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectSwitcher);
  } else {
    injectSwitcher();
  }

  // ── 4. Expose helper for any handcrafted code that needs the slug ──
  window.workspaceCurrentApp = function () { return APP_SLUG; };
  window.workspaceAppUrl = function (path) {
    var u = new URL(path, window.location.origin);
    if (!u.searchParams.has('app')) u.searchParams.set('app', APP_SLUG);
    return u.toString();
  };

  // ═════════════════════════════════════════════════════════════════════════
  //  5. Quick-Add-Issue FAB + modal — works on every sheet page across all apps
  //     Combines title / description / priority / criteria / image upload /
  //     URL attachments into ONE submit, so users don't have to: create issue
  //     → click into it → attach media as a 3-step ritual.
  // ═════════════════════════════════════════════════════════════════════════
  function onSheetPage() {
    var p = window.location.pathname || '';
    if (p.indexOf('/workspace/sheet.html') === -1 && p.indexOf('/workspace/sheet') === -1) return false;
    try { return !!new URLSearchParams(window.location.search).get('slug'); }
    catch (_) { return false; }
  }

  function injectQuickAddStyles() {
    if (document.getElementById('workspace-qa-styles')) return;
    var c = APP_META.color;
    var s = document.createElement('style');
    s.id = 'workspace-qa-styles';
    s.textContent = [
      '.bqa-fab{position:fixed;right:22px;bottom:24px;z-index:9998;display:inline-flex;align-items:center;gap:10px;padding:14px 20px;background:' + c + ';color:#000;border:none;border-radius:999px;font:700 14px/1 -apple-system,BlinkMacSystemFont,sans-serif;letter-spacing:0.02em;cursor:pointer;box-shadow:0 10px 30px -6px rgba(0,0,0,0.6),0 0 0 1px rgba(255,255,255,0.05);transition:transform 0.15s,box-shadow 0.2s}',
      '.bqa-fab:hover{transform:translateY(-2px);box-shadow:0 14px 38px -6px rgba(0,0,0,0.7)}',
      '.bqa-fab:active{transform:translateY(0)}',
      '.bqa-fab svg{width:18px;height:18px}',
      '.bqa-bg{position:fixed;inset:0;background:rgba(5,5,8,0.75);backdrop-filter:blur(6px);z-index:9999;display:none;align-items:center;justify-content:center;padding:20px;font-family:-apple-system,BlinkMacSystemFont,sans-serif}',
      '.bqa-bg.open{display:flex}',
      '.bqa-modal{background:#141116;border:1px solid #2a2a35;border-radius:16px;width:100%;max-width:640px;max-height:92vh;overflow-y:auto;padding:28px 30px;color:#fff;box-shadow:0 40px 100px -20px rgba(0,0,0,0.7);position:relative;animation:bqaIn 0.18s ease-out}',
      '@keyframes bqaIn{from{opacity:0;transform:translateY(8px) scale(0.98)}to{opacity:1;transform:translateY(0) scale(1)}}',
      '.bqa-modal h2{font:800 22px/1.2 inherit;margin:0 0 4px;letter-spacing:-0.01em;color:#fff}',
      '.bqa-modal h2 .bqa-app{color:' + c + '}',
      '.bqa-modal .bqa-sub{font-size:13px;color:#a0a0a0;margin-bottom:22px}',
      '.bqa-close{position:absolute;top:14px;right:16px;width:32px;height:32px;border:none;border-radius:8px;background:rgba(255,255,255,0.06);color:#a0a0a0;font:700 18px/1 inherit;cursor:pointer;transition:all 0.15s}',
      '.bqa-close:hover{background:rgba(255,71,71,0.15);color:#ff4747}',
      '.bqa-field{margin-bottom:14px}',
      '.bqa-field label{display:block;font:700 11px/1 inherit;color:#888;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:6px}',
      '.bqa-field input,.bqa-field textarea,.bqa-field select{width:100%;background:#0a0a0d;color:#fff;border:1px solid #2a2a35;border-radius:8px;padding:11px 13px;font:inherit;font-size:14px;outline:none;transition:border 0.15s}',
      '.bqa-field input:focus,.bqa-field textarea:focus,.bqa-field select:focus{border-color:' + c + '}',
      '.bqa-field textarea{min-height:90px;resize:vertical}',
      '.bqa-row{display:grid;grid-template-columns:1fr 1fr;gap:12px}',
      '.bqa-drop{position:relative;border:2px dashed #2a2a35;border-radius:10px;padding:18px;text-align:center;color:#888;font-size:13px;cursor:pointer;transition:all 0.15s;background:#0a0a0d}',
      '.bqa-drop:hover,.bqa-drop.over{border-color:' + c + ';background:rgba(255,255,255,0.02);color:#fff}',
      '.bqa-drop input{position:absolute;inset:0;opacity:0;cursor:pointer}',
      '.bqa-drop .bqa-drop-hint{font-size:12px;color:#666;margin-top:4px}',
      '.bqa-files{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}',
      '.bqa-file-tile{position:relative;width:60px;height:60px;border-radius:8px;background:#1a1a20;border:1px solid #2a2a35;display:flex;align-items:center;justify-content:center;overflow:hidden;font-size:10px;color:#888;text-align:center}',
      '.bqa-file-tile img{width:100%;height:100%;object-fit:cover}',
      '.bqa-file-tile button{position:absolute;top:-4px;right:-4px;width:18px;height:18px;border-radius:50%;background:#ff4747;color:#fff;border:none;font:700 11px/1 inherit;cursor:pointer;line-height:1}',
      '.bqa-urls{display:flex;flex-direction:column;gap:6px;margin-top:6px}',
      '.bqa-url-row{display:flex;gap:6px}',
      '.bqa-url-row input{flex:1}',
      '.bqa-url-row button{padding:0 12px;background:rgba(255,255,255,0.04);border:1px solid #2a2a35;border-radius:8px;color:#888;font:inherit;font-size:13px;cursor:pointer}',
      '.bqa-url-row button:hover{color:#ff4747;border-color:#ff4747}',
      '.bqa-url-add{display:inline-block;margin-top:8px;background:none;border:1px dashed #2a2a35;color:#888;border-radius:6px;padding:5px 10px;font-size:12px;cursor:pointer;font:inherit;font-size:12px}',
      '.bqa-url-add:hover{color:' + c + ';border-color:' + c + '}',
      '.bqa-actions{display:flex;gap:10px;justify-content:flex-end;margin-top:20px;padding-top:16px;border-top:1px solid #2a2a35}',
      '.bqa-btn{padding:10px 20px;border-radius:8px;font:700 13px/1 inherit;cursor:pointer;border:none;transition:transform 0.1s,box-shadow 0.2s}',
      '.bqa-btn-ghost{background:transparent;border:1px solid #2a2a35;color:#fff}',
      '.bqa-btn-ghost:hover{border-color:#888}',
      '.bqa-btn-primary{background:' + c + ';color:#000;letter-spacing:0.02em}',
      '.bqa-btn-primary:hover{transform:translateY(-1px);box-shadow:0 6px 20px -4px ' + c + '}',
      '.bqa-btn:disabled{opacity:0.5;cursor:not-allowed}',
      '.bqa-msg{padding:10px 14px;border-radius:8px;font-size:13px;margin-bottom:14px;display:none}',
      '.bqa-msg.show{display:block}',
      '.bqa-msg.err{background:rgba(255,71,71,0.1);border:1px solid rgba(255,71,71,0.4);color:#ff8a8a}',
      '.bqa-msg.ok{background:rgba(25,213,158,0.1);border:1px solid rgba(25,213,158,0.4);color:#5eead4}',
      '.bqa-progress{position:absolute;left:0;right:0;bottom:0;height:3px;background:rgba(255,255,255,0.05);border-radius:0 0 16px 16px;overflow:hidden;display:none}',
      '.bqa-progress.show{display:block}',
      '.bqa-progress-bar{height:100%;background:' + c + ';width:0%;transition:width 0.25s}',
      '@media (max-width:600px){.bqa-fab{right:14px;bottom:14px;padding:12px 16px;font-size:13px}.bqa-modal{padding:22px 20px}.bqa-row{grid-template-columns:1fr}}',
    ].join('\n');
    document.head.appendChild(s);
  }

  function buildQuickAddUI() {
    if (document.querySelector('.bqa-fab')) return;
    injectQuickAddStyles();

    // ── FAB ──
    var fab = document.createElement('button');
    fab.className = 'bqa-fab';
    fab.title = 'Add a new issue';
    fab.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">' +
        '<path d="M12 5v14M5 12h14"/></svg>' +
      '<span>Add issue</span>';
    document.body.appendChild(fab);

    // ── Modal ──
    var bg = document.createElement('div');
    bg.className = 'bqa-bg';
    bg.innerHTML =
      '<div class="bqa-modal" role="dialog" aria-modal="true" aria-labelledby="bqa-title">' +
        '<button class="bqa-close" type="button" aria-label="Close">×</button>' +
        '<h2 id="bqa-title">New issue · <span class="bqa-app">' + APP_META.label + '</span></h2>' +
        '<p class="bqa-sub" id="bqa-sub">on <span id="bqa-sheet-name">this sheet</span></p>' +
        '<div class="bqa-msg" id="bqa-msg"></div>' +
        '<div class="bqa-field">' +
          '<label for="bqa-title-i">Title</label>' +
          '<input id="bqa-title-i" type="text" maxlength="500" placeholder="Short, action-oriented (e.g. ‘Fix login button on iPad landscape’)" />' +
        '</div>' +
        '<div class="bqa-row">' +
          '<div class="bqa-field">' +
            '<label for="bqa-priority">Priority</label>' +
            '<select id="bqa-priority">' +
              '<option value="high">High</option>' +
              '<option value="medium" selected>Medium</option>' +
              '<option value="low">Low</option>' +
            '</select>' +
          '</div>' +
          '<div class="bqa-field">' +
            '<label for="bqa-module">Module (optional)</label>' +
            '<input id="bqa-module" type="text" maxlength="255" placeholder="auth / dashboard / …" />' +
          '</div>' +
        '</div>' +
        '<div class="bqa-field">' +
          '<label for="bqa-prompt">Description / prompt</label>' +
          '<textarea id="bqa-prompt" placeholder="What needs to be fixed? Steps to reproduce, expected vs actual…"></textarea>' +
        '</div>' +
        '<div class="bqa-field">' +
          '<label for="bqa-criteria">Acceptance criteria (one per line)</label>' +
          '<textarea id="bqa-criteria" placeholder="- Button stays centred at all viewport widths&#10;- Tap target is at least 44 × 44 px"></textarea>' +
        '</div>' +
        '<div class="bqa-field">' +
          '<label>Screenshots / images</label>' +
          '<label class="bqa-drop" id="bqa-drop">' +
            '<input type="file" id="bqa-files" accept="image/png,image/jpeg,image/gif,image/webp" multiple />' +
            '<div><strong>Click or drop images here</strong></div>' +
            '<div class="bqa-drop-hint">JPEG / PNG / GIF / WebP · up to 12 files · 8 MB each</div>' +
          '</label>' +
          '<div class="bqa-files" id="bqa-files-preview"></div>' +
        '</div>' +
        '<div class="bqa-field">' +
          '<label>Reference URLs (optional)</label>' +
          '<div class="bqa-urls" id="bqa-urls">' +
            '<div class="bqa-url-row"><input type="url" placeholder="https://figma.com/… or screenshot URL" /><button type="button" class="bqa-url-rm">✕</button></div>' +
          '</div>' +
          '<button type="button" class="bqa-url-add" id="bqa-url-add">+ Add another URL</button>' +
        '</div>' +
        '<div class="bqa-actions">' +
          '<button type="button" class="bqa-btn bqa-btn-ghost" id="bqa-cancel">Cancel</button>' +
          '<button type="button" class="bqa-btn bqa-btn-primary" id="bqa-save">Create issue</button>' +
        '</div>' +
        '<div class="bqa-progress" id="bqa-progress"><div class="bqa-progress-bar" id="bqa-progress-bar"></div></div>' +
      '</div>';
    document.body.appendChild(bg);

    // ── Wire up ──
    var $ = function (id) { return document.getElementById(id); };
    var pickedFiles = []; // accumulator (input type=file resets each click, so we keep state)
    function setMsg(text, ok) {
      var m = $('bqa-msg');
      if (!text) { m.classList.remove('show', 'ok', 'err'); m.textContent = ''; return; }
      m.textContent = text;
      m.className = 'bqa-msg show ' + (ok ? 'ok' : 'err');
    }
    function open() {
      // Try to fill in the sheet name from the page header / title
      try {
        var sheetName = (document.getElementById('brief-title') || {}).textContent || '';
        if (sheetName && sheetName !== 'Loading…') {
          $('bqa-sheet-name').textContent = sheetName;
        } else {
          var slug = new URLSearchParams(window.location.search).get('slug') || '';
          $('bqa-sheet-name').textContent = slug || 'this sheet';
        }
      } catch (_) {}
      pickedFiles = [];
      $('bqa-title-i').value = '';
      $('bqa-prompt').value = '';
      $('bqa-criteria').value = '';
      $('bqa-module').value = '';
      $('bqa-priority').value = 'medium';
      $('bqa-files').value = '';
      $('bqa-files-preview').innerHTML = '';
      $('bqa-urls').innerHTML = '<div class="bqa-url-row"><input type="url" placeholder="https://figma.com/… or screenshot URL" /><button type="button" class="bqa-url-rm">✕</button></div>';
      wireUrlRows();
      setMsg('');
      $('bqa-progress').classList.remove('show');
      bg.classList.add('open');
      setTimeout(function () { $('bqa-title-i').focus(); }, 30);
    }
    function close() { bg.classList.remove('open'); }
    fab.addEventListener('click', open);
    $('bqa-cancel').addEventListener('click', close);
    bg.querySelector('.bqa-close').addEventListener('click', close);
    bg.addEventListener('click', function (e) { if (e.target === bg) close(); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && bg.classList.contains('open')) close();
    });

    // File picker (click + drag/drop)
    var drop = $('bqa-drop');
    function renderFilePreviews() {
      var wrap = $('bqa-files-preview');
      wrap.innerHTML = '';
      pickedFiles.forEach(function (f, idx) {
        var tile = document.createElement('div');
        tile.className = 'bqa-file-tile';
        tile.title = f.name + ' · ' + Math.round(f.size / 1024) + ' KB';
        var rm = document.createElement('button');
        rm.type = 'button';
        rm.textContent = '×';
        rm.addEventListener('click', function () { pickedFiles.splice(idx, 1); renderFilePreviews(); });
        var img = document.createElement('img');
        img.src = URL.createObjectURL(f);
        tile.appendChild(img);
        tile.appendChild(rm);
        wrap.appendChild(tile);
      });
    }
    $('bqa-files').addEventListener('change', function (e) {
      var list = Array.prototype.slice.call(e.target.files || []);
      pickedFiles = pickedFiles.concat(list).slice(0, 12);
      renderFilePreviews();
      e.target.value = '';
    });
    ['dragenter', 'dragover'].forEach(function (ev) {
      drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add('over'); });
    });
    ['dragleave', 'drop'].forEach(function (ev) {
      drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove('over'); });
    });
    drop.addEventListener('drop', function (e) {
      var list = Array.prototype.slice.call((e.dataTransfer && e.dataTransfer.files) || []);
      list = list.filter(function (f) { return /^image\//.test(f.type); });
      pickedFiles = pickedFiles.concat(list).slice(0, 12);
      renderFilePreviews();
    });

    // URL row management
    function wireUrlRows() {
      $('bqa-urls').querySelectorAll('.bqa-url-rm').forEach(function (b) {
        b.onclick = function () {
          var row = b.closest('.bqa-url-row');
          var all = $('bqa-urls').querySelectorAll('.bqa-url-row');
          if (all.length > 1) row.remove(); else row.querySelector('input').value = '';
        };
      });
    }
    $('bqa-url-add').addEventListener('click', function () {
      var row = document.createElement('div');
      row.className = 'bqa-url-row';
      row.innerHTML = '<input type="url" placeholder="https://…" /><button type="button" class="bqa-url-rm">✕</button>';
      $('bqa-urls').appendChild(row);
      wireUrlRows();
      row.querySelector('input').focus();
    });
    wireUrlRows();

    // ── Submit ──
    $('bqa-save').addEventListener('click', async function () {
      var btn = $('bqa-save');
      var slug = new URLSearchParams(window.location.search).get('slug');
      if (!slug) { setMsg('No sheet slug detected in the URL.'); return; }
      var title = $('bqa-title-i').value.trim();
      var prompt_text = $('bqa-prompt').value.trim();
      if (!title)       { setMsg('Title is required.'); $('bqa-title-i').focus(); return; }
      if (!prompt_text) { setMsg('Description / prompt is required.'); $('bqa-prompt').focus(); return; }
      var priority = $('bqa-priority').value;
      var module_  = $('bqa-module').value.trim();
      var criteria = $('bqa-criteria').value.split('\n')
        .map(function (s) { return s.replace(/^[-*]\s*/, '').trim(); })
        .filter(Boolean);
      var urls = [];
      $('bqa-urls').querySelectorAll('input').forEach(function (i) {
        var v = i.value.trim();
        if (v && /^https?:\/\//i.test(v)) urls.push(v);
      });

      btn.disabled = true;
      btn.textContent = 'Saving…';
      setMsg('');
      var progress = $('bqa-progress');
      var bar = $('bqa-progress-bar');
      progress.classList.add('show');
      var totalSteps = 1 + (pickedFiles.length > 0 ? 1 : 0) + urls.length;
      var stepDone = 0;
      function tick() { stepDone++; bar.style.width = Math.min(100, Math.round(stepDone / totalSteps * 100)) + '%'; }

      try {
        // 1) Create the issue (fetch interceptor adds ?app= and x-workspace-edit-key)
        var createRes = await fetch('/api/workspace/sheets/' + encodeURIComponent(slug) + '/issues', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title:        title,
            prompt_text:  prompt_text,
            priority:     priority,
            module:       module_ || null,
            criteria:     criteria,
            tags:         [],
          }),
        });
        var created = await createRes.json();
        if (!createRes.ok || !created.success) {
          throw new Error(created && created.error || ('Server ' + createRes.status));
        }
        var issueId = created.id;
        tick();

        // 2) Attach files in parallel (if any)
        if (pickedFiles.length > 0) {
          var fd = new FormData();
          pickedFiles.forEach(function (f) { fd.append('files', f); });
          var upRes = await fetch('/api/workspace/issues/' + issueId + '/media/upload', {
            method: 'POST',
            body:   fd,
          });
          var upData = await upRes.json();
          if (!upRes.ok || !upData.success) {
            // Don't fail the whole flow — issue is saved, just warn about files
            setMsg('Issue created, but file upload failed: ' + (upData.error || upRes.status) + '. You can still attach files later.', false);
            // Continue to URLs anyway
          }
          tick();
        }

        // 3) Attach URLs one by one (the API takes them individually)
        for (var i = 0; i < urls.length; i++) {
          try {
            await fetch('/api/workspace/issues/' + issueId + '/media/url', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ url: urls[i] }),
            });
          } catch (_) { /* keep going */ }
          tick();
        }

        bar.style.width = '100%';
        setMsg('Issue created! Reloading…', true);
        setTimeout(function () { window.location.reload(); }, 700);
      } catch (e) {
        setMsg(e.message || 'Failed to create issue.');
        btn.disabled = false;
        btn.textContent = 'Create issue';
        progress.classList.remove('show');
      }
    });
  }

  function bootQuickAdd() {
    if (!onSheetPage()) return;
    buildQuickAddUI();
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootQuickAdd);
  } else {
    bootQuickAdd();
  }
})();
