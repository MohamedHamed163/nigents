/* ──────────────────────────────────────────────────────────────────────
   workspace-howto.js — Lazy-renders mermaid flow diagrams inside any
   <details class="workspace-howto"> on the page.

   Strategy
   --------
   1. Load mermaid from a CDN once (skipped if already loaded).
   2. Pre-initialize mermaid with the Workspace dark-orange theme.
   3. Wait for the user to expand a howto block. Only THEN run mermaid
      against the inner .mermaid element. This avoids rendering work
      for users who never expand the panel, and dodges the "hidden
      element has zero dimensions" issue with mermaid when a <details>
      is closed.
   4. Render once per panel (tracked via dataset.rendered).

   Used by /workspace/sprints.html, sheet.html, builds.html, designs.html.
   ────────────────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  var MERMAID_CDN = 'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js';
  var loadingPromise = null;

  function loadMermaid() {
    if (window.mermaid) return Promise.resolve(window.mermaid);
    if (loadingPromise) return loadingPromise;
    loadingPromise = new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = MERMAID_CDN;
      s.async = true;
      s.onload = function () {
        if (!window.mermaid) {
          reject(new Error('mermaid loaded but window.mermaid missing'));
          return;
        }
        try {
          window.mermaid.initialize({
            startOnLoad: false,   // we render manually on toggle
            theme: 'base',
            themeVariables: {
              background:            '#08070b',
              primaryColor:          '#1a1720',
              primaryTextColor:      '#f4f4f8',
              primaryBorderColor:    '#ff6b1a',
              secondaryColor:        '#121016',
              tertiaryColor:         '#2e2e3a',
              lineColor:             '#71717f',
              textColor:             '#f4f4f8',
              mainBkg:               '#1a1720',
              secondBkg:             '#121016',
              tertiaryBkg:           '#2e2e3a',
              nodeBorder:            '#ff6b1a',
              clusterBkg:            '#121016',
              clusterBorder:         '#2e2e3a',
              edgeLabelBackground:   '#08070b',
              fontFamily:            'inherit',
              fontSize:              '12px',
            },
            flowchart: { curve: 'basis', useMaxWidth: true, htmlLabels: true },
            sequence:  { useMaxWidth: true, mirrorActors: false },
            state:     { useMaxWidth: true },
          });
        } catch (e) {
          reject(e); return;
        }
        resolve(window.mermaid);
      };
      s.onerror = function () { reject(new Error('Failed to load mermaid from CDN')); };
      document.head.appendChild(s);
    });
    return loadingPromise;
  }

  async function renderInside(det) {
    if (det.dataset.rendered === '1') return;
    det.dataset.rendered = '1';
    var el = det.querySelector('.mermaid');
    if (!el) return;
    // Show a tiny loading hint while mermaid downloads (first panel only)
    var diagramBox = det.querySelector('.howto-diagram');
    var loader = null;
    if (diagramBox && !window.mermaid) {
      loader = document.createElement('div');
      loader.className = 'howto-loading';
      loader.textContent = 'loading diagram…';
      diagramBox.insertBefore(loader, el);
    }
    try {
      var mermaid = await loadMermaid();
      // mermaid 11: run({ nodes }) re-processes a specific element
      if (mermaid.run) {
        await mermaid.run({ nodes: [el] });
      } else if (mermaid.init) {
        // fallback to legacy API
        mermaid.init(undefined, el);
      }
    } catch (e) {
      if (el) el.innerHTML = '<div class="howto-loading" style="color:#f87171;">Failed to load diagram (' + (e.message || 'unknown') + ')</div>';
      det.dataset.rendered = '0'; // allow retry
    } finally {
      if (loader && loader.parentNode) loader.parentNode.removeChild(loader);
    }
  }

  function attachAll() {
    document.querySelectorAll('details.workspace-howto').forEach(function (det) {
      // Pre-attach a toggle listener; render on first open
      det.addEventListener('toggle', function () {
        if (det.open) renderInside(det);
      });
      // If a page chose to render the howto already-open (rare), render now
      if (det.open) renderInside(det);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', attachAll);
  } else {
    attachAll();
  }
})();
