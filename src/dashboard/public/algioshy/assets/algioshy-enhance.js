/* ──────────────────────────────────────────────────────────────────
   algioshy-enhance.js
   Post-hydration vanilla enhancements for nigents.com/algioshy/
   • Dual-path: toggle between Design A (SVG road — original),
                Design B (Parallax Image Tiles), Design C (Glass Split)
   • Facilities: toggle between Mode A (Big Grid),
                 Mode B (Circular Carousel), Mode C (Alternating Story)
   No framework — runs via DOMContentLoaded + MutationObserver fallback.
   ────────────────────────────────────────────────────────────────── */
(function () {
  "use strict";

  // ── Base asset path (served under /algioshy/) ──
  var ASSET = "/algioshy/assets/";

  // ── Facility dataset: hashed URLs match bundle ──
  // Client-ordered: Lab → Computer → Classroom (placeholder) → Theatre →
  //                 Outdoor Stage → Tennis Court → Gym → Cafeteria.
  var FACILITIES = [
    { key: "science",  name: "Science Lab",        tag: "STEM",            img: "fac-science-DMZXust2.jpg",
      desc: "Fully equipped chemistry, biology, and physics stations with fume hoods and digital sensors — where theory becomes experiment." },
    { key: "ict",      name: "Computer Lab",       tag: "Technology",      img: "fac-ict-BXXFkeU2.jpg",
      desc: "30 high-spec workstations running the latest creative and STEM software — where code, 3D models, and real-world problems meet." },
    { key: "classroom",name: "Classroom",          tag: "Learning",        img: "fac-classroom.jpg",
      desc: "Modern learning spaces designed for active collaboration, individual focus, and every learning style." },
    { key: "stage",    name: "Outdoor Stage",      tag: "Events",          img: "fac-stage-SQ4dLa0B.jpg",
      desc: "An open-air amphitheater for assemblies, cultural events, and student showcases — under the Egyptian sun or a canopy of stars." },
    { key: "padel",    name: "Tennis Court",       tag: "Athletics",       img: "fac-padel-CkgtBhRF.jpg",
      desc: "Professional-grade courts for tennis, padel, and racquet sports — every student, every sport, every day." },
    { key: "gym",      name: "Fitness Gym",        tag: "Wellness",        img: "fac-gym-5iabxBS4.jpg",
      desc: "Modern cardio and strength equipment with certified coaches — students train like athletes and learn discipline that transfers to the classroom." },
    { key: "cafeteria",name: "Cafeteria",          tag: "Community",       img: "fac-cafeteria-Cs0CFksF.jpg",
      desc: "Nutritionist-designed menus, allergy-aware kitchens, and a bright seating hall where students build the soft skills that matter most." }
  ];

  // ── Utility: wait until a selector exists ──
  function whenReady(selector, cb, timeout) {
    timeout = timeout || 15000;
    var start = Date.now();
    (function tick() {
      var el = document.querySelector(selector);
      if (el) { cb(el); return; }
      if (Date.now() - start > timeout) return;
      requestAnimationFrame(tick);
    })();
  }

  function h(tag, props, children) {
    var el = document.createElement(tag);
    if (props) {
      for (var k in props) {
        if (k === "className") el.className = props[k];
        else if (k === "style") el.setAttribute("style", props[k]);
        else if (k === "html")  el.innerHTML = props[k];
        else if (k.indexOf("on") === 0) el.addEventListener(k.slice(2).toLowerCase(), props[k]);
        else el.setAttribute(k, props[k]);
      }
    }
    if (children) {
      (Array.isArray(children) ? children : [children]).forEach(function (c) {
        if (c == null) return;
        el.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
      });
    }
    return el;
  }

  // ═════════════════════════════════════════════════════════════════
  //  DUAL-PATHWAY ENHANCEMENT
  // ═════════════════════════════════════════════════════════════════
  function enhancePathways(section) {
    if (section.dataset.algEnhanced === "1") return;
    section.dataset.algEnhanced = "1";

    // Store original Design A content (default active is now C — Glass Split)
    var originalChildren = Array.from(section.children);
    var originalWrap = h("div", { className: "alg-variant", "data-variant": "A" });
    originalChildren.forEach(function (child) {
      if (!child.classList || !child.classList.contains("alg-toggle-bar")) {
        originalWrap.appendChild(child);
      }
    });
    section.innerHTML = "";

    // Toggle bar
    var toggleBar = h("div", { className: "alg-toggle-bar", role: "tablist" });
    var variants = [
      { key: "A", label: "Road Map" },
      { key: "B", label: "Parallax Tiles" },
      { key: "C", label: "Glass Split" }
    ];
    var buttons = {};
    variants.forEach(function (v) {
      var btn = h("button", {
        className: "alg-toggle-btn" + (v.key === "C" ? " active" : ""),
        "data-variant": v.key,
        type: "button"
      }, v.label);
      btn.addEventListener("click", function () { switchVariant(v.key); });
      buttons[v.key] = btn;
      toggleBar.appendChild(btn);
    });

    // Variant B — Parallax Image Tiles
    var variantB = h("div", { className: "alg-variant", "data-variant": "B", html:
      '<div class="pwv-b-wrap">' +
        '<div class="pwv-b-tile left">' +
          '<div class="pwv-b-tile-inner">' +
            '<div class="pwv-b-kicker">IGCSE · A-Levels</div>' +
            '<div class="pwv-b-title">IGCSE Pathway</div>' +
            '<div class="pwv-b-desc">A globally recognized curriculum accepted by 2,000+ universities worldwide. Ideal for students aiming at top-tier international admissions across the UK, Europe, and the Gulf.</div>' +
            '<a class="pwv-b-cta" href="#admissions">Explore IGCSE →</a>' +
          '</div>' +
        '</div>' +
        '<div class="pwv-b-tile right">' +
          '<div class="pwv-b-tile-inner">' +
            '<div class="pwv-b-kicker">American Diploma · GPA · SAT</div>' +
            '<div class="pwv-b-title">American Diploma</div>' +
            '<div class="pwv-b-desc">A flexible, GPA-based curriculum with SAT preparation, built for students targeting North American and AUC-style admissions pathways.</div>' +
            '<a class="pwv-b-cta" href="#admissions">Explore Diploma →</a>' +
          '</div>' +
        '</div>' +
      '</div>'
    });

    // Variant C — Glass Morphism Split (DEFAULT)
    var variantC = h("div", { className: "alg-variant active", "data-variant": "C", html:
      '<div class="pwv-c-wrap">' +
        '<div class="pwv-c-stage">' +
          '<div class="pwv-c-panel left" data-tilt>' +
            '<span class="pwv-c-badge">Track One</span>' +
            '<h3 class="pwv-c-title">IGCSE</h3>' +
            '<p class="pwv-c-sub">A world-class curriculum where rigor meets curiosity. Graduates enter top-tier universities across the UK, Europe, and the Gulf.</p>' +
            '<div class="pwv-c-stats">' +
              '<div class="pwv-c-stat"><div class="pwv-c-stat-num">2000+</div><div class="pwv-c-stat-lbl">Universities</div></div>' +
              '<div class="pwv-c-stat"><div class="pwv-c-stat-num">160</div><div class="pwv-c-stat-lbl">Countries</div></div>' +
            '</div>' +
          '</div>' +
          '<div class="pwv-c-orb">OR</div>' +
          '<div class="pwv-c-panel right" data-tilt>' +
            '<span class="pwv-c-badge">Track Two</span>' +
            '<h3 class="pwv-c-title">American Diploma</h3>' +
            '<p class="pwv-c-sub">Flexible GPA-based assessment paired with SAT preparation — the direct line to North American and AUC-style admissions.</p>' +
            '<div class="pwv-c-stats">' +
              '<div class="pwv-c-stat"><div class="pwv-c-stat-num">GPA</div><div class="pwv-c-stat-lbl">Based</div></div>' +
              '<div class="pwv-c-stat"><div class="pwv-c-stat-num">SAT</div><div class="pwv-c-stat-lbl">Prep Ready</div></div>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>'
    });

    section.appendChild(toggleBar);
    section.appendChild(originalWrap);
    section.appendChild(variantB);
    section.appendChild(variantC);

    // ── Inject mobile-only pathway visual (CSS hides on desktop) ──
    // Portrait vertical Y-split: trunk at top → two diverging paths to
    // IGCSE (blue) and American Diploma (red) badges at bottom.
    var mobileViz = document.createElement("div");
    mobileViz.className = "pw-mobile-viz";
    mobileViz.innerHTML = [
      '<svg class="pw-mobile-road" viewBox="0 0 320 280" preserveAspectRatio="xMidYMid meet" aria-hidden="true">',
        '<defs>',
          '<linearGradient id="pwm-blue" x1="0" y1="0" x2="0" y2="1">',
            '<stop offset="0" stop-color="#93c5fd"/>',
            '<stop offset="1" stop-color="#1e40af"/>',
          '</linearGradient>',
          '<linearGradient id="pwm-red" x1="0" y1="0" x2="0" y2="1">',
            '<stop offset="0" stop-color="#fca5a5"/>',
            '<stop offset="1" stop-color="#991b1b"/>',
          '</linearGradient>',
          '<radialGradient id="pwm-top-glow" cx="0.5" cy="0.5" r="0.5">',
            '<stop offset="0" stop-color="rgba(255,255,255,0.35)"/>',
            '<stop offset="1" stop-color="rgba(255,255,255,0)"/>',
          '</radialGradient>',
        '</defs>',
        // Top soft halo behind starting dot
        '<circle cx="160" cy="28" r="36" fill="url(#pwm-top-glow)"/>',
        // Trunk (top node to split point)
        '<line class="pw-mobile-trunk" x1="160" y1="28" x2="160" y2="110" stroke="rgba(255,255,255,0.75)" stroke-width="4" stroke-linecap="round"/>',
        // Split-center node
        '<circle cx="160" cy="110" r="6" fill="rgba(255,255,255,0.55)"/>',
        // Left diverging path (IGCSE)
        '<path class="pw-mobile-path-l" d="M 160 110 Q 120 170 52 232" stroke="url(#pwm-blue)" stroke-width="6" fill="none" stroke-linecap="round"/>',
        // Right diverging path (American Diploma)
        '<path class="pw-mobile-path-r" d="M 160 110 Q 200 170 268 232" stroke="url(#pwm-red)"  stroke-width="6" fill="none" stroke-linecap="round"/>',
        // Left end badge
        '<g class="pw-mobile-badge">',
          '<circle class="pw-mobile-end-l" cx="52"  cy="232" r="14" fill="#3b82f6" color="#3b82f6"/>',
          '<circle cx="52" cy="232" r="5" fill="#fff"/>',
        '</g>',
        // Right end badge
        '<g class="pw-mobile-badge">',
          '<circle class="pw-mobile-end-r" cx="268" cy="232" r="14" fill="#ef4444" color="#ef4444"/>',
          '<circle cx="268" cy="232" r="5" fill="#fff"/>',
        '</g>',
        // Top start dot — represents "student"
        '<circle cx="160" cy="28"  r="10" fill="#fff"/>',
        '<circle cx="160" cy="28"  r="4" fill="#C1272D"/>',
        // Walker silhouette travels down trunk and randomly forks
        '<g class="pw-mobile-walker">',
          '<circle cx="0" cy="-8"  r="3.5" fill="rgba(255,255,255,0.95)"/>',
          '<rect   x="-3" y="-4"  width="6" height="10" rx="2" fill="rgba(255,255,255,0.85)"/>',
          '<animateMotion dur="4.2s" repeatCount="indefinite" path="M 160 28 L 160 110 Q 120 170 52 232" rotate="auto"/>',
        '</g>',
        // Labels
        '<text class="pw-mobile-label" x="52"  y="262" text-anchor="middle" fill="rgba(255,255,255,0.92)" font-size="13">IGCSE</text>',
        '<text class="pw-mobile-label" x="268" y="262" text-anchor="middle" fill="rgba(255,255,255,0.92)" font-size="13">American</text>',
      '</svg>'
    ].join("");
    // Place the mobile viz inside the original wrapper so it sits
    // where the desktop SVG lives (variant A only).
    var roadWrap = originalWrap.querySelector(".pw-road-wrap");
    if (roadWrap) roadWrap.appendChild(mobileViz);
    else originalWrap.insertBefore(mobileViz, originalWrap.firstChild);

    function switchVariant(key) {
      Object.keys(buttons).forEach(function (k) {
        buttons[k].classList.toggle("active", k === key);
      });
      section.querySelectorAll(":scope > .alg-variant").forEach(function (v) {
        v.classList.toggle("active", v.dataset.variant === key);
      });
    }

    // Panel tilt for Variant C
    variantC.querySelectorAll("[data-tilt]").forEach(function (panel) {
      panel.addEventListener("mousemove", function (e) {
        var r = panel.getBoundingClientRect();
        var x = (e.clientX - r.left) / r.width - 0.5;
        var y = (e.clientY - r.top) / r.height - 0.5;
        panel.style.transform =
          "rotateY(" + (x * 10) + "deg) rotateX(" + (-y * 8) + "deg) translateZ(30px)";
      });
      panel.addEventListener("mouseleave", function () {
        panel.style.transform = "";
      });
    });
  }

  // ═════════════════════════════════════════════════════════════════
  //  FACILITIES ENHANCEMENT
  // ═════════════════════════════════════════════════════════════════
  function enhanceFacilities(section) {
    if (section.dataset.algEnhanced === "1") return;
    section.dataset.algEnhanced = "1";

    // Wrap original children into Mode A-original container
    var originalHead = null;
    var originalBody = h("div", { className: "fac-orig-body" });
    // Keep only the <h2>/<p> heading block; swap the rest for our 3 modes
    var children = Array.from(section.children);
    children.forEach(function (c) {
      // heuristic: heading block is the first ~2 nodes
      if (!originalHead && (c.tagName === "DIV" || c.tagName === "H2")) {
        originalHead = c; // preserve first
      } else {
        originalBody.appendChild(c);
      }
    });

    section.innerHTML = "";
    if (originalHead) section.appendChild(originalHead);

    // Detect light bg on section (facilities is bg-[#EEF0F8])
    var isLight = /bg-\[#EEF0F8\]|bg-slate-|bg-gray-|bg-white/.test(section.className || "");

    // Toggle bar
    var toggleBar = h("div", { className: "alg-toggle-bar" + (isLight ? " light" : ""), role: "tablist" });
    var modes = [
      { key: "A", label: "Big Grid" },
      { key: "B", label: "Circular Carousel" },
      { key: "C", label: "Alternating Story" }
    ];
    var buttons = {};
    modes.forEach(function (m) {
      var btn = h("button", {
        className: "alg-toggle-btn" + (m.key === "A" ? " active" : ""),
        "data-mode": m.key,
        type: "button"
      }, m.label);
      btn.addEventListener("click", function () { switchMode(m.key); });
      buttons[m.key] = btn;
      toggleBar.appendChild(btn);
    });

    // ── Mode A: Big Grid ──
    var modeA = h("div", { className: "alg-variant active", "data-mode": "A" });
    var grid = h("div", { className: "fac-a-grid" });
    FACILITIES.forEach(function (f) {
      var imgHtml = f.img
        ? '<div class="fac-a-img" style="background-image:url(' + ASSET + f.img + ')"></div>'
        : '<div class="fac-a-img fac-placeholder"><span>Photo to be added</span></div>';
      grid.appendChild(h("div", { className: "fac-a-card", html:
        imgHtml +
        '<div class="fac-a-overlay"></div>' +
        '<div class="fac-a-body">' +
          '<div class="fac-a-name">' + f.name + '</div>' +
          '<div class="fac-a-desc">' + f.desc + '</div>' +
        '</div>'
      }));
    });
    modeA.appendChild(grid);

    // ── Mode B: Circular Carousel ──
    var modeB = h("div", { className: "alg-variant", "data-mode": "B" });
    var cWrap = h("div", { className: "fac-b-wrap" });
    var stage = h("div", { className: "fac-b-stage" });
    FACILITIES.forEach(function (f, i) {
      var imgHtml = f.img
        ? '<div class="fac-b-img" style="background-image:url(' + ASSET + f.img + ')"></div>'
        : '<div class="fac-b-img fac-placeholder"><span>Photo to be added</span></div>';
      stage.appendChild(h("div", {
        className: "fac-b-card",
        "data-index": String(i),
        html:
          imgHtml +
          '<div class="fac-b-gradient"></div>' +
          '<div class="fac-b-body">' +
            '<div class="fac-b-name">' + f.name + '</div>' +
            '<div class="fac-b-desc">' + f.desc + '</div>' +
          '</div>'
      }));
    });
    var prev = h("button", { className: "fac-b-arrow prev", type: "button", "aria-label": "Previous" }, "‹");
    var next = h("button", { className: "fac-b-arrow next", type: "button", "aria-label": "Next" }, "›");
    var dots = h("div", { className: "fac-b-dots" });
    FACILITIES.forEach(function (_, i) {
      var d = h("div", { className: "fac-b-dot", "data-index": String(i) });
      d.addEventListener("click", function () { goTo(i); });
      dots.appendChild(d);
    });
    cWrap.appendChild(prev);
    cWrap.appendChild(next);
    cWrap.appendChild(stage);
    cWrap.appendChild(dots);
    modeB.appendChild(cWrap);

    var current = 0;
    var autoTimer = null;
    function mod(n, m) { return ((n % m) + m) % m; }
    function render() {
      var cards = stage.querySelectorAll(".fac-b-card");
      var dotEls = dots.querySelectorAll(".fac-b-dot");
      var n = cards.length;
      cards.forEach(function (card, i) {
        card.classList.remove("pos-center", "pos-left", "pos-right",
          "pos-far-left", "pos-far-right", "pos-hidden");
        var offset = mod(i - current, n);
        if (offset > n / 2) offset -= n;
        if (offset === 0)       card.classList.add("pos-center");
        else if (offset === -1) card.classList.add("pos-left");
        else if (offset === 1)  card.classList.add("pos-right");
        else if (offset === -2) card.classList.add("pos-far-left");
        else if (offset === 2)  card.classList.add("pos-far-right");
        else                     card.classList.add("pos-hidden");
      });
      dotEls.forEach(function (d, i) { d.classList.toggle("active", i === current); });
    }
    function goTo(i) { current = mod(i, FACILITIES.length); render(); resetAuto(); }
    function nextCard() { goTo(current + 1); }
    function prevCard() { goTo(current - 1); }
    function resetAuto() {
      if (autoTimer) clearInterval(autoTimer);
      autoTimer = setInterval(function () {
        if (modeB.classList.contains("active")) nextCard();
      }, 4200);
    }
    prev.addEventListener("click", prevCard);
    next.addEventListener("click", nextCard);

    // Touch swipe on stage
    var touchStartX = 0, touchDeltaX = 0, touching = false;
    stage.addEventListener("touchstart", function (e) {
      if (!e.touches || !e.touches[0]) return;
      touching = true;
      touchStartX = e.touches[0].clientX;
      touchDeltaX = 0;
    }, { passive: true });
    stage.addEventListener("touchmove", function (e) {
      if (!touching || !e.touches || !e.touches[0]) return;
      touchDeltaX = e.touches[0].clientX - touchStartX;
    }, { passive: true });
    stage.addEventListener("touchend", function () {
      if (!touching) return;
      touching = false;
      if (Math.abs(touchDeltaX) > 40) {
        if (touchDeltaX < 0) nextCard(); else prevCard();
      }
    });
    render();

    // ── Mode C: Alternating Story ──
    var modeC = h("div", { className: "alg-variant", "data-mode": "C" });
    var cwrap = h("div", { className: "fac-c-wrap" + (isLight ? " light" : "") });
    FACILITIES.forEach(function (f, i) {
      var imgHtml = f.img
        ? '<div class="fac-c-img" style="background-image:url(' + ASSET + f.img + ')"></div>'
        : '<div class="fac-c-img fac-placeholder"><span>Photo to be added</span></div>';
      cwrap.appendChild(h("div", {
        className: "fac-c-row" + (i % 2 ? " flip" : ""),
        html:
          '<div class="fac-c-img-wrap">' +
            imgHtml +
          '</div>' +
          '<div class="fac-c-text">' +
            '<span class="fac-c-num">' + String(i + 1).padStart(2, "0") + ' · ' + f.tag + '</span>' +
            '<h3 class="fac-c-title">' + f.name + '</h3>' +
            '<p class="fac-c-desc">' + f.desc + '</p>' +
            '<div class="fac-c-meta">' +
              '<span class="fac-c-chip">Campus Facility</span>' +
              '<span class="fac-c-chip">Grades 10-11-12</span>' +
            '</div>' +
          '</div>'
      }));
    });
    modeC.appendChild(cwrap);

    // IntersectionObserver for Mode C reveal
    var io = ("IntersectionObserver" in window) ? new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          e.target.classList.add("in-view");
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.15 }) : null;

    section.appendChild(toggleBar);
    section.appendChild(modeA);
    section.appendChild(modeB);
    section.appendChild(modeC);

    if (io) modeC.querySelectorAll(".fac-c-row").forEach(function (r) { io.observe(r); });
    resetAuto();

    function switchMode(key) {
      Object.keys(buttons).forEach(function (k) {
        buttons[k].classList.toggle("active", k === key);
      });
      section.querySelectorAll(":scope > .alg-variant").forEach(function (v) {
        v.classList.toggle("active", v.dataset.mode === key);
      });
      if (key === "C" && io) {
        modeC.querySelectorAll(".fac-c-row:not(.in-view)").forEach(function (r) { io.observe(r); });
      }
    }
  }

  // ═════════════════════════════════════════════════════════════════
  //  HERO INTRO — universal: growing logo + streamed slogan
  //  Desktop runs immediately on load.
  //  Mobile waits until the welcome popup (fixed.inset-0.z-[9999]) is
  //  dismissed, then triggers.
  // ═════════════════════════════════════════════════════════════════
  var _heroIntroDone = false;

  // Streamed-text renderer — wraps each WORD in a nowrap container and
  // each char in a span with staggered delay. Words break naturally;
  // letters within a word stay together (no mid-word truncation).
  function streamInto(el, text, baseDelayMs, stepMs) {
    if (!el || el.dataset.streamed) return;
    el.dataset.streamed = "1";
    el.textContent = "";
    var step = stepMs || 35;
    var charIdx = 0;
    var words = text.split(" ");
    for (var w = 0; w < words.length; w++) {
      var wordEl = document.createElement("span");
      wordEl.className = "amh-word";
      for (var c = 0; c < words[w].length; c++) {
        var s = document.createElement("span");
        s.className = "amh-ch";
        s.textContent = words[w][c];
        s.style.animationDelay = (baseDelayMs + charIdx * step) + "ms";
        wordEl.appendChild(s);
        charIdx++;
      }
      el.appendChild(wordEl);
      // Space between words — normal whitespace so words can wrap
      if (w < words.length - 1) {
        var sp = document.createElement("span");
        sp.className = "amh-ch amh-space";
        sp.textContent = " ";
        sp.style.animationDelay = (baseDelayMs + charIdx * step) + "ms";
        el.appendChild(sp);
        charIdx++;
      }
    }
  }

  // Mobile-only overlay (unchanged layout, but start-class gated)
  function buildMobileOverlay(hero) {
    if (hero.querySelector(".alg-mobile-hero")) return;
    hero.classList.add("alg-mobile-hero-active");
    var wrap = document.createElement("div");
    wrap.className = "alg-mobile-hero";
    wrap.innerHTML = [
      '<div class="amh-logo-stage">',
        '<img class="amh-logo" src="/algioshy/hero-shield.png?v=15" alt="Smart College"/>',
      '</div>',
      '<h1 class="amh-slogan" aria-label="Shaping Futures, Empowering Minds">',
        '<span class="amh-line amh-line-1"></span>',
        '<span class="amh-line amh-line-2"></span>',
      '</h1>',
      '<p class="amh-sub">Welcome to a distinguished educational destination where excellence is defined.</p>'
    ].join("");
    hero.appendChild(wrap);
  }

  // Desktop: wrap the existing React h1 characters into streamed spans.
  // The h1 contains text "Shaping Futures, " + <br> + <span>Empowering Minds</span>.
  function streamDesktopH1(hero) {
    var h1 = hero.querySelector(".alg-hero-content h1");
    if (!h1 || h1.dataset.streamedDesktop) return;
    h1.dataset.streamedDesktop = "1";

    // Preserve the red serif span for "Empowering Minds"
    var redSpan = h1.querySelector("span");
    var redText = redSpan ? redSpan.textContent.trim() : "Empowering Minds";

    // Wipe original children; rebuild with streamed spans
    h1.innerHTML = "";
    var line1 = document.createElement("span");
    line1.className = "amh-line amh-line-1 amh-line-desktop";
    h1.appendChild(line1);
    h1.appendChild(document.createElement("br"));
    var line2 = document.createElement("span");
    line2.className = "amh-line amh-line-2 amh-line-desktop";
    h1.appendChild(line2);

    streamInto(line1, "Shaping Futures,", 400, 40);
    streamInto(line2, redText, 1100, 40);
    h1.classList.add("amh-h1-streamed");
  }

  // Kick off animations for either viewport
  function runHeroIntro(hero) {
    if (_heroIntroDone) return;
    _heroIntroDone = true;
    hero.classList.add("amh-start");
    if (window.innerWidth > 900) {
      streamDesktopH1(hero);
    } else {
      // Re-fill the mobile streaming text (already built earlier; might need content now)
      var l1 = hero.querySelector(".alg-mobile-hero .amh-line-1");
      var l2 = hero.querySelector(".alg-mobile-hero .amh-line-2");
      if (l1) streamInto(l1, "Shaping Futures,", 2400, 35);
      if (l2) streamInto(l2, "Empowering Minds", 3100, 35);
    }
  }

  // Watch for welcome-popup removal; triggers intro when popup is gone
  function waitForPopupThenRun(hero) {
    function popupStillPresent() {
      // Fullscreen overlay modal with z-[9999] (from the React bundle)
      var els = document.querySelectorAll('[class*="z-[9999]"][class*="fixed"][class*="inset-0"]');
      return els.length > 0;
    }
    if (!popupStillPresent()) { runHeroIntro(hero); return; }

    var mo = new MutationObserver(function () {
      if (!popupStillPresent()) {
        mo.disconnect();
        runHeroIntro(hero);
      }
    });
    mo.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["class","style"] });

    // Safety: force-run after 30s even if popup never dismisses
    setTimeout(function () { mo.disconnect(); runHeroIntro(hero); }, 30000);
  }

  function enhanceMobileHero() {
    var hero = document.querySelector(".alg-hero-white");
    if (!hero) return;

    if (window.innerWidth <= 900) {
      buildMobileOverlay(hero);
      // Mobile: wait for the React welcome popup to be dismissed
      waitForPopupThenRun(hero);
    } else {
      // Desktop: start immediately — no popup on desktop
      runHeroIntro(hero);
    }

    // Handle viewport flips (rotate / resize past breakpoint)
    window.addEventListener("resize", function () {
      var isMobile = window.innerWidth <= 900;
      if (isMobile && !hero.querySelector(".alg-mobile-hero")) {
        buildMobileOverlay(hero);
        if (_heroIntroDone) { /* replay streaming on fresh overlay */ _heroIntroDone = false; waitForPopupThenRun(hero); }
      }
      if (!isMobile) {
        hero.classList.remove("alg-mobile-hero-active");
        var el = hero.querySelector(".alg-mobile-hero");
        if (el) el.remove();
        streamDesktopH1(hero);
      }
    });
  }

  // ═════════════════════════════════════════════════════════════════
  //  v15 — Map strip, desktop logo stage, footer icon upgrades
  // ═════════════════════════════════════════════════════════════════
  var MAPS_URL = "https://maps.app.goo.gl/g3GT18uEnfzAqCNM9";

  function injectMapStrip() {
    if (document.querySelector(".alg-map-strip")) return;
    var strip = document.createElement("div");
    strip.className = "alg-map-strip";
    strip.innerHTML =
      '<a href="' + MAPS_URL + '" target="_blank" rel="noopener">' +
        '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">' +
          '<path d="M12 2C7.6 2 4 5.6 4 10c0 5.5 7.1 11.4 7.4 11.7.2.2.4.3.6.3s.4-.1.6-.3C12.9 21.4 20 15.5 20 10c0-4.4-3.6-8-8-8zm0 11a3 3 0 110-6 3 3 0 010 6z"/>' +
        '</svg>' +
        '<span class="alg-map-strip-text">Heliopolis, Cairo — View on Google Maps</span>' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
          '<path d="M7 17L17 7M7 7h10v10"/>' +
        '</svg>' +
      '</a>';
    document.body.insertBefore(strip, document.body.firstChild);
  }

  function injectDesktopLogoStage(hero) {
    if (window.matchMedia("(max-width: 900px)").matches) return;
    if (!hero || hero.dataset.logoStage === "1") return;
    hero.dataset.logoStage = "1";
    var stage = document.createElement("div");
    stage.className = "alg-desktop-logo-stage";
    // v19 — full stacked hero: slogan ABOVE, zoom-in logo in MIDDLE, welcome
    // paragraph + CTAs BELOW. The original React hero content is hidden on
    // desktop via CSS so these are the only visible elements.
    // Persisted layout choice: "center" (stacked) or "left" (asymmetric)
    var saved = null;
    try { saved = localStorage.getItem("alg.hero.layout"); } catch (e) {}
    var layout = saved === "center" ? "center" : "left";  // default Split
    stage.setAttribute("data-layout", layout);
    stage.innerHTML =
      '<div class="alg-hero-toggle" role="tablist" aria-label="Hero layout">' +
        '<button type="button" role="tab" class="alg-hero-toggle-btn" data-layout="center"' +
        (layout === "center" ? ' aria-selected="true"' : '') + '>' +
          '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="3" y="2" width="10" height="2" rx="1"/><circle cx="8" cy="8" r="2.5"/><rect x="3" y="12" width="10" height="2" rx="1"/></svg>' +
          'Stacked</button>' +
        '<button type="button" role="tab" class="alg-hero-toggle-btn" data-layout="left"' +
        (layout === "left" ? ' aria-selected="true"' : '') + '>' +
          '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="2" y="3" width="6" height="1.6" rx="0.8"/><rect x="2" y="6" width="5" height="1.6" rx="0.8"/><rect x="2" y="11" width="4" height="1.6" rx="0.8"/><circle cx="12" cy="8" r="3"/></svg>' +
          'Split</button>' +
      '</div>' +
      '<h1 class="alg-desktop-slogan">' +
        '<span class="alg-desktop-slogan-line" data-stream="Shaping Futures,"></span>' +
        '<span class="alg-desktop-slogan-accent" data-stream="Empowering Minds"></span>' +
      '</h1>' +
      '<div class="alg-desktop-logo-wrap">' +
        '<div class="alg-desktop-logo-disc"></div>' +
        '<img class="alg-desktop-logo-img" ' +
          'src="/algioshy/hero-shield.png?v=19" ' +
          'alt="Smart College" />' +
      '</div>' +
      '<p class="alg-desktop-welcome">' +
        'Welcome to a distinguished educational destination where excellence is defined. ' +
        'We seamlessly nurture academic distinction, creativity, and character.' +
      '</p>' +
      '<div class="alg-desktop-ctas">' +
        '<a class="alg-desktop-cta alg-desktop-cta-primary" href="#admissions">Start Admission</a>' +
        '<a class="alg-desktop-cta alg-desktop-cta-ghost" href="#discover">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
            'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ' +
            'style="width:14px;height:14px;margin-right:8px">' +
            '<polygon points="5 3 19 12 5 21 5 3"/></svg>' +
          'Discover School</a>' +
      '</div>';
    hero.appendChild(stage);

    // Streamed slogan — split text into letter spans with staggered delays.
    // Uses CSS custom prop --d (per-letter delay) which the CSS keyframe reads.
    var streams = stage.querySelectorAll("[data-stream]");
    streams.forEach(function (el, sIdx) {
      var txt = el.getAttribute("data-stream") || "";
      var lineBase = sIdx * 0.45; // each line starts after the previous
      el.innerHTML = "";
      for (var i = 0; i < txt.length; i++) {
        var ch = txt[i];
        var s = document.createElement("span");
        s.className = "alg-stream-char";
        s.textContent = ch === " " ? "\u00A0" : ch;
        s.style.setProperty("--d", (lineBase + i * 0.035) + "s");
        el.appendChild(s);
      }
    });

    // Layout toggle: flip data-layout + persist + replay the shield zoom
    var toggleBtns = stage.querySelectorAll(".alg-hero-toggle-btn");
    toggleBtns.forEach(function (btn) {
      btn.addEventListener("click", function () {
        var next = btn.getAttribute("data-layout");
        if (!next || stage.getAttribute("data-layout") === next) return;
        stage.setAttribute("data-layout", next);
        try { localStorage.setItem("alg.hero.layout", next); } catch (e) {}
        toggleBtns.forEach(function (b) {
          if (b.getAttribute("data-layout") === next) {
            b.setAttribute("aria-selected", "true");
          } else {
            b.removeAttribute("aria-selected");
          }
        });
        // Replay the shield zoom-in so the new layout feels fresh
        var img = stage.querySelector(".alg-desktop-logo-img");
        if (img) {
          img.classList.remove("alg-replay");
          // force reflow so animation restarts
          void img.offsetWidth;
          img.classList.add("alg-replay");
        }
      });
    });
  }

  // Official TikTok logo (from https://commons.wikimedia.org/wiki/File:Tiktok_icon.svg)
  var TIKTOK_SVG =
    '<svg viewBox="0 0 96 96" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" ' +
    'style="width:1.4em;height:1.4em;display:inline-block;vertical-align:middle">' +
      '<rect width="96" height="96" rx="21" fill="black"/>' +
      '<path fill="white" d="M73.31 25.7456C72.785 25.4743 72.274 25.1769 71.7788 24.8545C70.3389 23.9025 69.0186 22.7808 67.8465 21.5135C64.9139 18.158 63.8186 14.7538 63.4151 12.3705H63.4313C63.0943 10.3921 63.2337 9.11214 63.2547 9.11214H49.8974V60.7624C49.8974 61.4558 49.8974 62.1412 49.8682 62.8185C49.8682 62.9027 49.8601 62.9805 49.8553 63.0712C49.8553 63.1085 49.8553 63.1474 49.8472 63.1863C49.8472 63.196 49.8472 63.2057 49.8472 63.2154C49.7064 65.0686 49.1123 66.8588 48.1173 68.4286C47.1222 69.9983 45.7566 71.2994 44.1407 72.2175C42.4565 73.1757 40.5517 73.6782 38.614 73.6757C32.3906 73.6757 27.3468 68.6011 27.3468 62.334C27.3468 56.0669 32.3906 50.9923 38.614 50.9923C39.7921 50.9912 40.9629 51.1766 42.083 51.5415L42.0992 37.9412C38.6989 37.502 35.2444 37.7722 31.9538 38.7348C28.6631 39.6975 25.6077 41.3317 22.9802 43.5343C20.678 45.5346 18.7425 47.9214 17.2608 50.5872C16.6969 51.5594 14.5695 55.4658 14.3119 61.8058C14.1499 65.4044 15.2306 69.1326 15.7458 70.6734V70.7058C16.0699 71.6132 17.3256 74.7094 19.372 77.3197C21.0221 79.4135 22.9716 81.2527 25.1579 82.7783V82.7459L25.1903 82.7783C31.6567 87.1724 38.8263 86.884 38.8263 86.884C40.0674 86.8338 44.2249 86.884 48.9463 84.6464C54.183 82.1658 57.1642 78.47 57.1642 78.47C59.0688 76.2618 60.5832 73.7452 61.6426 71.0282C62.8513 67.8509 63.2547 64.0401 63.2547 62.5171V35.1155C63.4168 35.2127 65.5749 36.6401 65.5749 36.6401C65.5749 36.6401 68.6842 38.633 73.5352 39.9309C77.0155 40.8544 81.7045 41.0488 81.7045 41.0488V27.7887C80.0615 27.9669 76.7255 27.4485 73.31 25.7456Z"/>' +
    '</svg>';

  // WhatsApp glyph (svgrepo artwork) on a rounded brand-green tile — for the footer socials row
  var WHATSAPP_SVG =
    '<svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" ' +
    'style="width:1.4em;height:1.4em;display:inline-block;vertical-align:middle">' +
      '<rect width="32" height="32" rx="8" fill="#25D366"/>' +
      '<g fill="#ffffff" transform="translate(4 4) scale(1.5)">' +
        '<path d="M11.42 9.49c-.19-.09-1.1-.54-1.27-.61s-.29-.09-.42.1-.48.6-.59.73-.21.14-.4 0a5.13 5.13 0 0 1-1.49-.92 5.25 5.25 0 0 1-1-1.29c-.11-.18 0-.28.08-.38s.18-.21.28-.32a1.39 1.39 0 0 0 .18-.31.38.38 0 0 0 0-.33c0-.09-.42-1-.58-1.37s-.3-.32-.41-.32h-.4a.72.72 0 0 0-.5.23 2.1 2.1 0 0 0-.65 1.55A3.59 3.59 0 0 0 5 8.2 8.32 8.32 0 0 0 8.19 11c.44.19.78.3 1.05.39a2.53 2.53 0 0 0 1.17.07 1.93 1.93 0 0 0 1.26-.88 1.67 1.67 0 0 0 .11-.88c-.05-.07-.17-.12-.36-.21z"/>' +
        '<path d="M13.29 2.68A7.36 7.36 0 0 0 8 .5a7.44 7.44 0 0 0-6.41 11.15l-1 3.85 3.94-1a7.4 7.4 0 0 0 3.55.9H8a7.44 7.44 0 0 0 5.29-12.72zM8 14.12a6.12 6.12 0 0 1-3.15-.87l-.22-.13-2.34.61.62-2.28-.14-.23a6.18 6.18 0 0 1 9.6-7.65 6.12 6.12 0 0 1 1.81 4.37A6.19 6.19 0 0 1 8 14.12z"/>' +
      '</g>' +
    '</svg>';

  // Standalone WhatsApp glyph (white paths only) for use inside the floating green circle
  var WHATSAPP_GLYPH_SVG =
    '<svg viewBox="0 0 16 16" fill="#ffffff" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
      '<path d="M11.42 9.49c-.19-.09-1.1-.54-1.27-.61s-.29-.09-.42.1-.48.6-.59.73-.21.14-.4 0a5.13 5.13 0 0 1-1.49-.92 5.25 5.25 0 0 1-1-1.29c-.11-.18 0-.28.08-.38s.18-.21.28-.32a1.39 1.39 0 0 0 .18-.31.38.38 0 0 0 0-.33c0-.09-.42-1-.58-1.37s-.3-.32-.41-.32h-.4a.72.72 0 0 0-.5.23 2.1 2.1 0 0 0-.65 1.55A3.59 3.59 0 0 0 5 8.2 8.32 8.32 0 0 0 8.19 11c.44.19.78.3 1.05.39a2.53 2.53 0 0 0 1.17.07 1.93 1.93 0 0 0 1.26-.88 1.67 1.67 0 0 0 .11-.88c-.05-.07-.17-.12-.36-.21z"/>' +
      '<path d="M13.29 2.68A7.36 7.36 0 0 0 8 .5a7.44 7.44 0 0 0-6.41 11.15l-1 3.85 3.94-1a7.4 7.4 0 0 0 3.55.9H8a7.44 7.44 0 0 0 5.29-12.72zM8 14.12a6.12 6.12 0 0 1-3.15-.87l-.22-.13-2.34.61.62-2.28-.14-.23a6.18 6.18 0 0 1 9.6-7.65 6.12 6.12 0 0 1 1.81 4.37A6.19 6.19 0 0 1 8 14.12z"/>' +
    '</svg>';

  var MAPPIN_SVG =
    '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" ' +
    'class="w-4 h-4 md:w-5 md:h-5 text-[#C1272D] shrink-0 mt-0.5" ' +
    'style="color:#C1272D">' +
      '<path d="M12 2C7.6 2 4 5.6 4 10c0 5.5 7.1 11.4 7.4 11.7.2.2.4.3.6.3s.4-.1.6-.3C12.9 21.4 20 15.5 20 10c0-4.4-3.6-8-8-8zm0 11a3 3 0 110-6 3 3 0 010 6z"/>' +
    '</svg>';

  // v17 — Inject an embedded Google Maps iframe just before the footer.
  // Uses Google's public maps-embed endpoint (no API key) with the school
  // street address as the query. Keeps the clickable "view larger map"
  // text link beneath.
  function injectMapEmbed() {
    if (document.querySelector(".alg-map-embed")) return;
    var footer = document.querySelector("footer");
    if (!footer) return;
    var section = document.createElement("section");
    section.className = "alg-map-embed";
    section.setAttribute("aria-label", "School location map");
    section.innerHTML =
      '<div class="alg-map-inner">' +
        '<div class="alg-map-head">' +
          '<h2>Find Us</h2>' +
          '<p>22 Of Othman Ibn Affan, El-Bostan, Heliopolis, Cairo</p>' +
        '</div>' +
        '<div class="alg-map-frame">' +
          '<iframe ' +
            'src="https://www.google.com/maps?q=22+Of+Othman+Ibn+Affan,+El-Bostan,+Heliopolis,+Cairo&output=embed" ' +
            'width="100%" height="420" style="border:0" ' +
            'loading="lazy" referrerpolicy="no-referrer-when-downgrade" ' +
            'allowfullscreen title="Smart College School — Heliopolis, Cairo"></iframe>' +
        '</div>' +
        '<a class="alg-map-cta" href="' + MAPS_URL + '" target="_blank" rel="noopener">' +
          'Open in Google Maps' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
            'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ' +
            'style="width:1em;height:1em;vertical-align:middle;margin-left:6px">' +
            '<path d="M7 17L17 7M7 7h10v10"/>' +
          '</svg>' +
        '</a>' +
      '</div>';
    footer.parentNode.insertBefore(section, footer);
  }

  function fixTiktokAndAddress() {
    // TikTok: find <a href="*tiktok*"> and replace its "TK" text with the SVG.
    // v19 fix — earlier version used a TreeWalker which skipped the <a> root
    // when it had only a text node child, so "TK" never got replaced. Handle
    // the anchor itself first, then fall back to descendants.
    var tikLinks = document.querySelectorAll('a[href*="tiktok.com"], a[title="TikTok"]');
    tikLinks.forEach(function (a) {
      if (a.dataset.tikIcon === "1") return;
      var target = null;
      if (a.children.length === 0 && (a.textContent || "").trim() === "TK") {
        target = a;
      } else {
        var walker = document.createTreeWalker(a, NodeFilter.SHOW_ELEMENT);
        var node;
        while ((node = walker.nextNode())) {
          if (node.children.length === 0 && (node.textContent || "").trim() === "TK") {
            target = node;
            break;
          }
        }
      }
      if (target) {
        target.innerHTML = TIKTOK_SVG;
        target.style.display = "inline-flex";
        target.style.alignItems = "center";
        target.style.justifyContent = "center";
        target.classList.add("alg-social-tiktok");
      }
      a.classList.add("alg-social-icon");
      a.dataset.tikIcon = "1";
    });

    // Tag the other footer social icons + address link for consistent styling
    var socials = document.querySelectorAll(
      'a[href*="instagram.com"], a[href*="facebook.com"], a[href*="maps.app.goo.gl"], a[href*="google.com/maps"]'
    );
    socials.forEach(function (a) { a.classList.add("alg-social-icon"); });

    // v36 — Inject WhatsApp icon into the footer social row, next to tiktok.
    injectFooterWhatsApp();

    // Address: find the <li> / container containing the street text and replace
    // its first <svg> with the enriched map-pin SVG.
    var textNodes = document.querySelectorAll("li, p, div, span");
    for (var i = 0; i < textNodes.length; i++) {
      var el = textNodes[i];
      if (el.dataset && el.dataset.addressPin === "1") continue;
      var txt = el.textContent || "";
      if (txt.indexOf("Othman Ibn Affan") !== -1 && txt.length < 200) {
        var svg = el.querySelector("svg");
        if (svg) {
          var wrap = document.createElement("span");
          wrap.innerHTML = MAPPIN_SVG;
          svg.parentNode.replaceChild(wrap.firstChild, svg);
        }
        if (el.dataset) el.dataset.addressPin = "1";
      }
    }
  }

  // v36 — WhatsApp icon as a sibling of the TikTok link in the footer socials row.
  function injectFooterWhatsApp() {
    var waHref = "https://wa.me/" + SCHOOL_INFO.whatsapp.replace("+", "");
    // Skip if already injected anywhere on the page.
    if (document.querySelector('a.alg-wa-social[data-alg-wa="1"]')) return;

    var tikLink = document.querySelector('a[href*="tiktok.com"], a[title="TikTok"]');
    if (!tikLink || !tikLink.parentNode) return;

    var wa = document.createElement("a");
    wa.href = waHref;
    wa.target = "_blank";
    wa.rel = "noopener noreferrer";
    wa.setAttribute("aria-label", "Chat on WhatsApp");
    wa.setAttribute("title", "WhatsApp");
    // Copy the TikTok link's className so layout matches the existing row.
    wa.className = (tikLink.className ? tikLink.className + " " : "") +
                   "alg-social-icon alg-wa-social";
    wa.dataset.algWa = "1";
    wa.style.display = "inline-flex";
    wa.style.alignItems = "center";
    wa.style.justifyContent = "center";
    wa.innerHTML = WHATSAPP_SVG;
    tikLink.parentNode.insertBefore(wa, tikLink.nextSibling);
  }

  // v36 — Floating WhatsApp button anchored to the right side of the viewport.
  function injectFloatingWhatsApp() {
    if (document.querySelector(".alg-wa-float")) return;
    var waHref = "https://wa.me/" + SCHOOL_INFO.whatsapp.replace("+", "");
    var btn = document.createElement("a");
    btn.href = waHref;
    btn.target = "_blank";
    btn.rel = "noopener noreferrer";
    btn.className = "alg-wa-float";
    btn.setAttribute("aria-label", "Chat on WhatsApp");
    btn.setAttribute("title", "WhatsApp");
    btn.innerHTML = WHATSAPP_GLYPH_SVG +
      '<span class="alg-wa-float-pulse" aria-hidden="true"></span>';
    document.body.appendChild(btn);
  }

  // v41 — "Discover School" 3D mode. The React bundle lazy-loads a
  // BuildingScene (Three.js r3f) when the Discover button is clicked. Our
  // sticky chrome (admissions bar, WhatsApp float, hero address) was covering
  // the scene and its "Back" control, making the feature feel broken on mobile.
  // Strategy:
  //   • Intercept clicks on any element whose label contains "Discover School"
  //     and add `body.alg-3d-mode` so CSS can hide overlays.
  //   • Watch for the React back button (text "Back" with class top-4 left-4)
  //     to appear/disappear via MutationObserver and toggle the class
  //     idempotently — covers the case where React mounts the scene without
  //     our click having fired (e.g. deep-link or replay).
  //   • On enter, inject a prominent dismiss X at the top-right that clicks
  //     the React back button to unmount the scene cleanly.
  //   • Push `#discover` to the URL on enter and clear it on exit so the mode
  //     is shareable/back-button-aware.
  var alg3DInstalled = false;
  function install3DMode() {
    if (alg3DInstalled) return;
    alg3DInstalled = true;

    function findReactBack() {
      var btns = document.querySelectorAll("button");
      for (var i = 0; i < btns.length; i++) {
        var b = btns[i];
        var cls = (typeof b.className === "string" ? b.className : "") || "";
        var txt = (b.textContent || "").trim();
        // The React back button is `top-4 left-4` with text "Back" — also
        // covers the "3D Model Unavailable → Back to Site" fallback button.
        if (/\btop-4\b/.test(cls) && /\bleft-4\b/.test(cls) && /Back/i.test(txt)) return b;
        if (txt === "<- Back to Site" || /^\s*Back to Site\s*$/i.test(txt)) return b;
      }
      return null;
    }

    function enter3DMode() {
      if (document.body.classList.contains("alg-3d-mode")) return;
      document.body.classList.add("alg-3d-mode");
      try { if (location.hash !== "#discover") history.replaceState(null, "", "#discover"); } catch (e) {}
      ensureDismissBtn();
    }

    function exit3DMode() {
      if (!document.body.classList.contains("alg-3d-mode")) return;
      document.body.classList.remove("alg-3d-mode");
      try { if (location.hash === "#discover") history.replaceState(null, "", location.pathname + location.search); } catch (e) {}
      var dx = document.getElementById("alg-3d-dismiss");
      if (dx) dx.remove();
    }

    function ensureDismissBtn() {
      if (document.getElementById("alg-3d-dismiss")) return;
      var btn = document.createElement("button");
      btn.id = "alg-3d-dismiss";
      btn.type = "button";
      btn.className = "alg-3d-dismiss";
      btn.setAttribute("aria-label", "Dismiss 3D view");
      btn.innerHTML =
        '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" ' +
          'stroke="currentColor" stroke-width="2.2" stroke-linecap="round" ' +
          'stroke-linejoin="round" aria-hidden="true">' +
          '<line x1="18" y1="6" x2="6" y2="18"/>' +
          '<line x1="6" y1="6" x2="18" y2="18"/>' +
        '</svg>';
      btn.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        var rb = findReactBack();
        if (rb) rb.click();
        exit3DMode();
      });
      document.body.appendChild(btn);
    }

    // Delegated click handler — catches the button even after React re-renders.
    document.addEventListener("click", function (e) {
      var el = e.target;
      // Walk up a few levels for icon-inside-button targeting.
      for (var hops = 0; el && hops < 4; hops++, el = el.parentElement) {
        if (!el.textContent) continue;
        if (/Discover School/i.test((el.textContent || "").trim())) {
          // Let the React onClick fire normally; then flip mode after paint.
          setTimeout(enter3DMode, 60);
          setTimeout(enter3DMode, 300);
          return;
        }
      }
    }, true);

    // Reconcile on DOM mutation — React may mount the back button later, and
    // clicking it (either React back or our dismiss) tears down the scene.
    var obs = new MutationObserver(function () {
      var rb = findReactBack();
      if (rb) enter3DMode();
      else if (document.body.classList.contains("alg-3d-mode")) exit3DMode();
    });
    obs.observe(document.body, { childList: true, subtree: true });

    // Reflect initial state — support hash-based deep-link to 3D view.
    if (location.hash === "#discover") enter3DMode();
  }

  // v22 — Fixed bottom admissions bar. Mirrors the text from the mobile
  // "Admissions Open 2025-26" popup and is always available (desktop +
  // mobile) until the user closes it. Dismissal persists in localStorage.
  function injectAdmissionsBar() {
    if (document.querySelector(".alg-adm-bar")) return;
    // v33: location pill added — clear any prior dismissal so
    // returning visitors see the new bar once.
    try {
      if (localStorage.getItem("alg.admBar.seenVer") !== "v33") {
        localStorage.removeItem("alg.admBar.dismissed");
        localStorage.setItem("alg.admBar.seenVer", "v33");
      }
    } catch (e) {}
    var dismissed = false;
    try { dismissed = localStorage.getItem("alg.admBar.dismissed") === "1"; } catch (e) {}
    if (dismissed) return;

    var bar = document.createElement("div");
    bar.className = "alg-adm-bar";
    bar.setAttribute("role", "region");
    bar.setAttribute("aria-label", "Admissions announcement");
    bar.innerHTML =
      '<div class="alg-adm-bar-inner">' +
        '<div class="alg-adm-bar-text">' +
          '<span class="alg-adm-bar-kicker">Admissions' +
            ' <span class="alg-adm-bar-year">2026-2027</span></span>' +
          '<span class="alg-adm-bar-sub">Grades 10 &middot; 11 &middot; 12</span>' +
        '</div>' +
        '<a class="alg-adm-bar-addr" href="' + SCHOOL_INFO.maps + '" ' +
          'target="_blank" rel="noopener noreferrer" ' +
          'aria-label="Open school location in Google Maps">' +
          '<svg class="alg-adm-bar-addr-pin" viewBox="0 0 24 24" width="14" height="14" ' +
            'fill="none" stroke="currentColor" stroke-width="2" ' +
            'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
            '<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>' +
            '<circle cx="12" cy="10" r="3"/>' +
          '</svg>' +
          '<span>' + SCHOOL_INFO.addressShort + '</span>' +
        '</a>' +
        '<div class="alg-adm-bar-ctas">' +
          '<a class="alg-adm-bar-cta alg-adm-bar-cta-primary" href="#admissions">Apply Now</a>' +
          '<a class="alg-adm-bar-cta alg-adm-bar-cta-ghost" href="#book-visit">Book a Visit</a>' +
        '</div>' +
        '<button type="button" class="alg-adm-bar-close" aria-label="Dismiss admissions bar">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
            'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
            '<line x1="18" y1="6" x2="6" y2="18"/>' +
            '<line x1="6" y1="6" x2="18" y2="18"/>' +
          '</svg>' +
        '</button>' +
      '</div>';
    document.body.appendChild(bar);

    // Mark <body> so other fixed elements (footer ribbons, back-to-top
    // buttons, etc.) can lift above the bar if needed.
    document.body.classList.add("alg-adm-bar-active");

    bar.querySelector(".alg-adm-bar-close").addEventListener("click", function () {
      bar.classList.add("alg-adm-bar-closing");
      try { localStorage.setItem("alg.admBar.dismissed", "1"); } catch (e) {}
      setTimeout(function () {
        bar.remove();
        document.body.classList.remove("alg-adm-bar-active");
      }, 280);
    });
  }

  // ═════════════════════════════════════════════════════════════════
  //  v32 — SCHOOL_INFO + address/book-visit/transportation/active-campus
  // ═════════════════════════════════════════════════════════════════
  var SCHOOL_INFO = {
    addressShort: "Heliopolis, Cairo",
    addressFull:  "22 Othman Ibn Affan St., El-Bostan, Heliopolis, Cairo",
    addressAr:    "\u0662\u0662 \u0634 \u0639\u062B\u0645\u0627\u0646 \u0627\u0628\u0646 \u0639\u0641\u0627\u0646\u060C \u0627\u0644\u0628\u0633\u062A\u0627\u0646\u060C \u0645\u0635\u0631 \u0627\u0644\u062C\u062F\u064A\u062F\u0629\u060C \u0627\u0644\u0642\u0627\u0647\u0631\u0629",
    maps:         "https://maps.app.goo.gl/g3GT18uEnfzAqCNM9?g_st=iw",
    email:        "Info@smartcollegeschool.com",
    phone1:       "01036323222",
    phone2:       "01035533221",
    whatsapp:     "+201036323222"
  };

  var ALG_PIN_SVG = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>';

  function injectHeroAddress() {
    function attach(p) {
      if (!p || p.dataset.algAddr === "1") return;
      p.dataset.algAddr = "1";
      var box = h("div", { className: "alg-hero-address" });
      var a = h("a", { href: SCHOOL_INFO.maps, target: "_blank",
        rel: "noopener noreferrer", className: "alg-hero-address-link" });
      a.innerHTML = ALG_PIN_SVG + '<span>' + SCHOOL_INFO.addressShort + '</span>';
      box.appendChild(a);
      if (p.parentNode) p.parentNode.insertBefore(box, p.nextSibling);
    }
    // Desktop hero paragraph
    whenReady(".alg-hero-white p", attach);
    // Mobile hero paragraph (overlay built by buildMobileOverlay)
    whenReady(".alg-mobile-hero .amh-sub", attach);
  }

  var algPopupObsInstalled = false;
  function injectPopupAddress() {
    if (algPopupObsInstalled) return;
    algPopupObsInstalled = true;

    function patchPopupText(root) {
      // Replace "2025-26" in year with "2026-27" wrapped in a nowrap span.
      // Also normalize "Grades 10-11-12" → "Grades 10 · 11 · 12".
      var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null, false);
      var textNodes = [];
      var tn;
      while ((tn = walker.nextNode())) textNodes.push(tn);
      textNodes.forEach(function (node) {
        var v = node.nodeValue || "";
        if (v.indexOf("2025-26") !== -1) {
          var parent = node.parentNode;
          var idx = v.indexOf("2025-26");
          var frag = document.createDocumentFragment();
          if (idx > 0) frag.appendChild(document.createTextNode(v.slice(0, idx)));
          var span = document.createElement("span");
          span.style.whiteSpace = "nowrap";
          span.textContent = "2026-27";
          frag.appendChild(span);
          if (idx + 7 < v.length) frag.appendChild(document.createTextNode(v.slice(idx + 7)));
          parent.replaceChild(frag, node);
        } else if (v.indexOf("Grades 10-11-12") !== -1) {
          node.nodeValue = v.replace("Grades 10-11-12", "Grades 10 \u00b7 11 \u00b7 12");
        }
      });
    }

    function tryInject(overlay) {
      if (overlay.dataset.algAddr === "1") return;

      // Anchor on the APPLY NOW / BOOK A VISIT buttons — these are unique
      // to the admissions popup and avoid the v32 bug where we landed inside
      // a tiny `.bg-white` decorative icon.
      var applyBtn = null;
      var btns = overlay.querySelectorAll("a, button");
      for (var i = 0; i < btns.length; i++) {
        var t = (btns[i].textContent || "").toUpperCase();
        if (t.indexOf("APPLY NOW") !== -1 || t.indexOf("BOOK A VISIT") !== -1) {
          applyBtn = btns[i];
          break;
        }
      }
      if (!applyBtn) return;

      // Walk up from the CTA to find the card container (holds the heading too).
      var card = applyBtn.parentElement;
      while (card && card !== overlay) {
        var txt = card.textContent || "";
        if (txt.indexOf("SMART COLLEGE") !== -1 || txt.indexOf("Admissions") !== -1) break;
        card = card.parentElement;
      }
      if (!card || card === overlay) card = applyBtn.parentElement;

      overlay.dataset.algAddr = "1";

      // Fix the year + grades text INSIDE the popup.
      patchPopupText(card);

      // Insert the address button at the end of the card (after CTAs).
      var box = h("div", { className: "alg-popup-address" });
      var a = h("a", { href: SCHOOL_INFO.maps, target: "_blank",
        rel: "noopener noreferrer", className: "alg-popup-address-link" });
      a.innerHTML = ALG_PIN_SVG + '<span>' + SCHOOL_INFO.addressShort + '</span>';
      box.appendChild(a);
      card.appendChild(box);

      // v38 — hide any pre-existing close button hovering at the card's top-left
      // (React-rendered or leftover from older enhance versions). We only want
      // our own top-right X (.alg-popup-close-v33) to show.
      try {
        var cardBox = card.getBoundingClientRect();
        var candidateBtns = overlay.querySelectorAll("button, a");
        for (var cb = 0; cb < candidateBtns.length; cb++) {
          var bx = candidateBtns[cb];
          if (bx.classList.contains("alg-popup-close-v33")) continue;
          if (bx.classList.contains("alg-popup-address")) continue;
          var btxt = (bx.textContent || "").trim().toUpperCase();
          // Skip the primary CTAs and the location button.
          if (btxt.indexOf("APPLY") !== -1 ||
              btxt.indexOf("BOOK A VISIT") !== -1 ||
              btxt.indexOf("HELIOPOLIS") !== -1) continue;
          var r = bx.getBoundingClientRect();
          if (r.width === 0 || r.height === 0) continue;
          // Small icon-only control parked near the card's top-left corner.
          var smallIcon = r.width < 64 && r.height < 64;
          var nearTopLeft = (r.top < cardBox.top + 80) &&
                            (r.left < cardBox.left + 80);
          if (smallIcon && nearTopLeft) bx.style.display = "none";
        }
      } catch (err) { /* ignore measurement failures */ }

      // Add an in-card close X anchored to the top-right corner of the card.
      if (!card.querySelector(".alg-popup-close-v33")) {
        // Ensure the card is a positioning context so absolute placement sticks.
        var cs = window.getComputedStyle(card);
        if (cs.position === "static") card.style.position = "relative";
        var closeBtn = h("button", { type: "button",
          className: "alg-popup-close-v33", "aria-label": "Close popup" });
        closeBtn.innerHTML =
          '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" ' +
            'stroke="currentColor" stroke-width="2.2" stroke-linecap="round" ' +
            'stroke-linejoin="round" aria-hidden="true">' +
            '<line x1="18" y1="6" x2="6" y2="18"/>' +
            '<line x1="6" y1="6" x2="18" y2="18"/>' +
          '</svg>';
        closeBtn.addEventListener("click", function (e) {
          e.preventDefault();
          e.stopPropagation();
          overlay.style.display = "none";
        });
        card.appendChild(closeBtn);
      }
    }

    var sel = '[class*="z-[9999]"][class*="fixed"][class*="inset-0"]';
    var obs = new MutationObserver(function (mutations) {
      for (var i = 0; i < mutations.length; i++) {
        var added = mutations[i].addedNodes;
        for (var j = 0; j < added.length; j++) {
          var n = added[j];
          if (n.nodeType !== 1) continue;
          var hit = (n.matches && n.matches(sel)) ? n
                  : (n.querySelector ? n.querySelector(sel) : null);
          if (hit) tryInject(hit);
        }
      }
    });
    obs.observe(document.body, { childList: true, subtree: true });

    // If the popup is already mounted when enhance.js boots, catch it now.
    var existing = document.querySelector(sel);
    if (existing) tryInject(existing);
  }

  function injectBookVisitForm() {
    whenReady("footer#contact", function (footer) {
      if (document.getElementById("book-visit")) return;
      var section = h("section", { id: "book-visit", className: "alg-book-visit" });
      var form = h("form", { className: "alg-book-visit-form", novalidate: "true" });
      var fields = [
        { name: "name",   label: "Student name",   type: "text", required: true },
        { name: "parent", label: "Parent name",    type: "text", required: true },
        { name: "phone",  label: "Phone",          type: "tel",  required: true },
        { name: "date",   label: "Preferred date", type: "date", required: true }
      ];
      fields.forEach(function (f) {
        var row = h("label", { className: "alg-bv-row" });
        row.appendChild(h("span", { className: "alg-bv-label" }, f.label));
        var props = { name: f.name, type: f.type, className: "alg-bv-input" };
        if (f.required) props.required = "required";
        row.appendChild(h("input", props));
        form.appendChild(row);
      });
      var gradeRow = h("label", { className: "alg-bv-row" });
      gradeRow.appendChild(h("span", { className: "alg-bv-label" }, "Grade"));
      gradeRow.appendChild(h("select",
        { name: "grade", required: "required", className: "alg-bv-input" }, [
          h("option", { value: "" }, "Select grade"),
          h("option", { value: "10" }, "Grade 10"),
          h("option", { value: "11" }, "Grade 11"),
          h("option", { value: "12" }, "Grade 12")
        ]));
      form.appendChild(gradeRow);
      var msgRow = h("label", { className: "alg-bv-row" });
      msgRow.appendChild(h("span", { className: "alg-bv-label" }, "Message (optional)"));
      msgRow.appendChild(h("textarea", { name: "message", rows: "3", className: "alg-bv-input" }));
      form.appendChild(msgRow);
      form.appendChild(h("button", { type: "submit", className: "alg-bv-submit" }, "Request Visit"));

      form.addEventListener("submit", function (e) {
        e.preventDefault();
        var fd = new FormData(form);
        var data = { name: fd.get("name") || "", parent: fd.get("parent") || "",
          phone: fd.get("phone") || "", date: fd.get("date") || "",
          grade: fd.get("grade") || "", message: fd.get("message") || "", ts: Date.now() };
        var body = "Student: " + data.name + "\nParent: " + data.parent +
                   "\nPhone: " + data.phone + "\nDate: " + data.date +
                   "\nGrade: " + data.grade + "\nMessage: " + data.message;
        var mailto = "mailto:" + SCHOOL_INFO.email +
          "?subject=" + encodeURIComponent("Visit request \u2014 " + data.name) +
          "&body=" + encodeURIComponent(body);
        var wa = "https://wa.me/" + SCHOOL_INFO.whatsapp.replace("+", "") +
          "?text=" + encodeURIComponent(body);
        try {
          var key = "alg.bookVisit.submissions";
          var arr = JSON.parse(localStorage.getItem(key) || "[]");
          arr.push(data);
          localStorage.setItem(key, JSON.stringify(arr));
        } catch (err) {}

        // ── Send to admin backend (fire-and-forget, non-blocking UI) ──
        try {
          var apiPayload = {
            parent_name:    data.parent,
            child_name:     data.name,
            grade:          data.grade,
            phone:          data.phone,
            preferred_date: data.date,
            notes:          data.message
          };
          fetch("admin/api/submit-visit.php", {
            method:      "POST",
            credentials: "same-origin",
            headers:     { "Content-Type": "application/json" },
            body:        JSON.stringify(apiPayload)
          }).catch(function () { /* graceful: email/WA fallback still works */ });
        } catch (err) {}

        var success = h("div", { className: "alg-book-visit-success" }, [
          h("p", { className: "alg-bv-thanks" }, "Thank you — your request was received. You can also share it directly:"),
          h("div", { className: "alg-bv-actions" }, [
            h("a", { href: mailto, className: "alg-bv-btn alg-bv-btn-email" }, "Email"),
            h("a", { href: wa, target: "_blank", rel: "noopener noreferrer",
                     className: "alg-bv-btn alg-bv-btn-wa" }, "WhatsApp")
          ])
        ]);
        form.parentNode.replaceChild(success, form);
      });

      section.appendChild(h("h2", { className: "alg-book-visit-heading" }, "Book a Visit"));
      section.appendChild(h("p", { className: "alg-book-visit-sub" },
        "Schedule a tour and meet our team. We will confirm by email or WhatsApp."));
      section.appendChild(form);
      footer.parentNode.insertBefore(section, footer);
    });
  }

  function swapWhyChooseCards() {
    whenReady("#why-choose-us", function (root) {
      var heads = root.querySelectorAll("h3");
      for (var i = 0; i < heads.length; i++) {
        var hd = heads[i];
        if ((hd.textContent || "").trim() !== "School Transportation") continue;
        var card = hd.closest("div[class*='border']") || hd.parentNode;
        if (card && card.dataset.algActiveCampus === "1") continue;
        if (card) card.dataset.algActiveCampus = "1";
        hd.textContent = "Active Campus";
        var sib = hd.nextElementSibling;
        while (sib && sib.tagName !== "P") sib = sib.nextElementSibling;
        if (sib) {
          sib.textContent = "A dynamic campus where learning extends beyond the classroom" +
            " \u2014 sports, performing arts, creative studios, and community spaces" +
            " activated by a continuously evolving calendar of events and experiences.";
        }
        if (!card) continue;
        var all = card.querySelectorAll("[style]");
        for (var k = 0; k < all.length; k++) {
          var s = all[k].getAttribute("style") || "";
          if (s.indexOf("#C1272D") !== -1 || s.toLowerCase().indexOf("rgb(193") !== -1) {
            all[k].setAttribute("style",
              s.replace(/#C1272D/gi, "#1B2E6D").replace(/rgb\(193[^)]*\)/gi, "#1B2E6D"));
          }
        }
      }
    });
  }

  function injectTransportationStrip() {
    whenReady("#why-choose-us", function (why) {
      if (document.getElementById("transportation")) return;
      var section = h("section", { id: "transportation", className: "alg-transport" });
      var wrap = h("div", { className: "alg-transport-inner" });
      wrap.appendChild(h("h2", { className: "alg-transport-kicker" }, "TRANSPORTATION"));
      var grid = h("div", { className: "alg-transport-grid" });
      var left = h("div", { className: "alg-transport-art" });
      left.innerHTML =
        '<svg viewBox="0 0 400 240" width="100%" height="auto" aria-hidden="true" role="img">' +
          '<defs>' +
            '<linearGradient id="algBusBody" x1="0" y1="0" x2="0" y2="1">' +
              '<stop offset="0%" stop-color="#2A4196"/>' +
              '<stop offset="55%" stop-color="#1B2E6D"/>' +
              '<stop offset="100%" stop-color="#14224F"/>' +
            '</linearGradient>' +
            '<linearGradient id="algBusWin" x1="0" y1="0" x2="0" y2="1">' +
              '<stop offset="0%" stop-color="#D9E6F5"/>' +
              '<stop offset="100%" stop-color="#8FB1D4"/>' +
            '</linearGradient>' +
          '</defs>' +
          // ground shadow
          '<ellipse cx="200" cy="220" rx="160" ry="7" fill="#0e1a40" opacity="0.18"/>' +
          // bus body silhouette
          '<path d="M 30 95 L 30 188 Q 30 198 40 198 L 352 198 Q 370 198 370 180 L 370 140 ' +
            'Q 370 130 362 125 L 336 112 Q 329 108 325 101 L 308 72 Q 300 58 282 58 ' +
            'L 50 58 Q 30 58 30 78 Z" fill="url(#algBusBody)"/>' +
          // roof highlight
          '<path d="M 35 63 Q 35 60 40 60 L 283 60 Q 295 60 302 70 L 315 92 L 35 92 Z" ' +
            'fill="#ffffff" opacity="0.08"/>' +
          // side windows
          '<rect x="48"  y="76" width="42" height="32" rx="4" fill="url(#algBusWin)"/>' +
          '<rect x="96"  y="76" width="42" height="32" rx="4" fill="url(#algBusWin)"/>' +
          '<rect x="144" y="76" width="42" height="32" rx="4" fill="url(#algBusWin)"/>' +
          '<rect x="192" y="76" width="42" height="32" rx="4" fill="url(#algBusWin)"/>' +
          '<rect x="240" y="76" width="42" height="32" rx="4" fill="url(#algBusWin)"/>' +
          // window highlights
          '<rect x="50"  y="78" width="10" height="28" rx="2" fill="#ffffff" opacity="0.45"/>' +
          '<rect x="98"  y="78" width="10" height="28" rx="2" fill="#ffffff" opacity="0.45"/>' +
          '<rect x="146" y="78" width="10" height="28" rx="2" fill="#ffffff" opacity="0.45"/>' +
          '<rect x="194" y="78" width="10" height="28" rx="2" fill="#ffffff" opacity="0.45"/>' +
          '<rect x="242" y="78" width="10" height="28" rx="2" fill="#ffffff" opacity="0.45"/>' +
          // slanted windshield
          '<path d="M 305 76 Q 315 76 320 84 L 335 108 L 345 108 Q 345 76 325 76 Z" ' +
            'fill="url(#algBusWin)"/>' +
          '<path d="M 308 78 L 318 86 L 328 104 L 320 104 Z" fill="#ffffff" opacity="0.4"/>' +
          // driver silhouette
          '<circle cx="322" cy="94" r="4.5" fill="#14224F" opacity="0.55"/>' +
          '<path d="M 315 108 Q 322 99 329 108 Z" fill="#14224F" opacity="0.55"/>' +
          // yellow safety stripe
          '<rect x="30" y="124" width="340" height="11" fill="#F8C53D"/>' +
          '<rect x="30" y="135" width="340" height="2"  fill="#C9941A"/>' +
          // SMART COLLEGE badge on the side
          '<rect x="88" y="148" width="134" height="26" rx="4" fill="#ffffff"/>' +
          '<rect x="88" y="148" width="134" height="26" rx="4" fill="none" ' +
            'stroke="#C1272D" stroke-width="1.2" opacity="0.55"/>' +
          '<text x="155" y="166" font-family="-apple-system, system-ui, \'Helvetica Neue\', sans-serif" ' +
            'font-size="11" font-weight="800" letter-spacing="1.4" ' +
            'text-anchor="middle" fill="#1B2E6D">SMART COLLEGE</text>' +
          // door
          '<rect x="236" y="118" width="38" height="76" rx="3" fill="#0d1938"/>' +
          '<rect x="239" y="122" width="32" height="32" rx="2" fill="url(#algBusWin)"/>' +
          '<rect x="239" y="158" width="32" height="32" rx="2" fill="url(#algBusWin)"/>' +
          '<line x1="255" y1="122" x2="255" y2="190" stroke="#0d1938" ' +
            'stroke-width="1" opacity="0.55"/>' +
          '<rect x="252" y="154" width="3" height="6" fill="#0d1938"/>' +
          // front grille
          '<rect x="330" y="140" width="28" height="20" rx="3" fill="#0d1938"/>' +
          '<line x1="334" y1="146" x2="354" y2="146" stroke="#2A4196" stroke-width="1"/>' +
          '<line x1="334" y1="150" x2="354" y2="150" stroke="#2A4196" stroke-width="1"/>' +
          '<line x1="334" y1="154" x2="354" y2="154" stroke="#2A4196" stroke-width="1"/>' +
          // front bumper
          '<rect x="340" y="162" width="30" height="16" rx="4" fill="#c9cfd9"/>' +
          '<rect x="340" y="162" width="30" height="3"  rx="2" fill="#ffffff" opacity="0.55"/>' +
          // headlight
          '<ellipse cx="360" cy="128" rx="6" ry="5" fill="#FFE680"/>' +
          '<ellipse cx="360" cy="128" rx="3" ry="2.5" fill="#ffffff"/>' +
          // side mirror
          '<rect x="300" y="66" width="3"  height="12" fill="#0d1938"/>' +
          '<rect x="293" y="54" width="11" height="14" rx="2" fill="#1B2E6D"/>' +
          '<rect x="295" y="56" width="7"  height="6"  rx="1" fill="url(#algBusWin)"/>' +
          // folded stop-sign arm
          '<rect x="24" y="150" width="6" height="18" fill="#C1272D"/>' +
          '<polygon points="14,159 26,153 26,165" fill="#C1272D"/>' +
          '<text x="20" y="162" font-family="sans-serif" font-size="5.5" font-weight="800" ' +
            'text-anchor="middle" fill="#ffffff">STOP</text>' +
          // wheel wells
          '<circle cx="85"  cy="196" r="26" fill="#0d1938"/>' +
          '<circle cx="310" cy="196" r="26" fill="#0d1938"/>' +
          // tires + hubs
          '<circle cx="85"  cy="196" r="22" fill="#1a1a2e"/>' +
          '<circle cx="85"  cy="196" r="14" fill="#4a5468"/>' +
          '<circle cx="85"  cy="196" r="8"  fill="#c9cfd9"/>' +
          '<circle cx="85"  cy="196" r="3"  fill="#14224F"/>' +
          '<circle cx="310" cy="196" r="22" fill="#1a1a2e"/>' +
          '<circle cx="310" cy="196" r="14" fill="#4a5468"/>' +
          '<circle cx="310" cy="196" r="8"  fill="#c9cfd9"/>' +
          '<circle cx="310" cy="196" r="3"  fill="#14224F"/>' +
          // spokes
          '<line x1="85"  y1="184" x2="85"  y2="208" stroke="#14224F" stroke-width="2" stroke-linecap="round"/>' +
          '<line x1="73"  y1="196" x2="97"  y2="196" stroke="#14224F" stroke-width="2" stroke-linecap="round"/>' +
          '<line x1="310" y1="184" x2="310" y2="208" stroke="#14224F" stroke-width="2" stroke-linecap="round"/>' +
          '<line x1="298" y1="196" x2="322" y2="196" stroke="#14224F" stroke-width="2" stroke-linecap="round"/>' +
          // motion lines
          '<line x1="4"  y1="108" x2="22" y2="108" stroke="#1B2E6D" stroke-width="2.5" stroke-linecap="round" opacity="0.25"/>' +
          '<line x1="0"  y1="128" x2="24" y2="128" stroke="#1B2E6D" stroke-width="2.5" stroke-linecap="round" opacity="0.25"/>' +
          '<line x1="8"  y1="148" x2="22" y2="148" stroke="#1B2E6D" stroke-width="2.5" stroke-linecap="round" opacity="0.25"/>' +
        '</svg>';
      grid.appendChild(left);
      grid.appendChild(h("div", { className: "alg-transport-copy" }, [
        h("h3", { className: "alg-transport-h3" }, "Comprehensive transportation services"),
        h("p", { className: "alg-transport-p" },
          "Comprehensive transportation services are available, ensuring a seamless" +
          " and secure journey for our students.")
      ]));
      wrap.appendChild(grid);
      section.appendChild(wrap);
      if (why.parentNode) why.parentNode.insertBefore(section, why.nextSibling);
    });
  }

  // ═════════════════════════════════════════════════════════════════
  //  Reorder: About (School Introduction) BEFORE Chairman section
  // ═════════════════════════════════════════════════════════════════
  function reorderAboutBeforeChairman() {
    whenReady("#about", function (about) {
      if (about.dataset.algReordered === "1") return;
      // Chairman section is the one containing the Tarek AlGioshy image
      var chairmanImg = document.querySelector('img[alt*="Chairman" i], img[alt*="Tarek" i]');
      if (!chairmanImg) return;
      var chairmanSection = chairmanImg.closest("section");
      if (!chairmanSection) return;
      // Only reorder if chairman currently appears BEFORE about
      var pos = about.compareDocumentPosition(chairmanSection);
      var isChairmanBefore = !!(pos & Node.DOCUMENT_POSITION_PRECEDING);
      if (!isChairmanBefore) {
        about.dataset.algReordered = "1";
        return;
      }
      // Swap: move chairman to appear right after about
      if (about.parentNode && chairmanSection.parentNode) {
        about.parentNode.insertBefore(chairmanSection, about.nextSibling);
        about.dataset.algReordered = "1";
      }
    });
  }

  // ═════════════════════════════════════════════════════════════════
  //  BOOT — wait for React to mount, then enhance
  // ═════════════════════════════════════════════════════════════════
  function boot() {
    // v16: map strip removed per user request
    whenReady("#pathways", enhancePathways);
    whenReady("#facilities", enhanceFacilities);
    whenReady(".alg-hero-white", function (hero) {
      injectDesktopLogoStage(hero);
      enhanceMobileHero();
    });
    // Footer icons — wait until footer with tiktok link appears
    whenReady('a[href*="tiktok.com"]', fixTiktokAndAddress);
    // Google Maps embed section before footer
    whenReady('footer', injectMapEmbed);
    // Admissions bar — inject as soon as body is ready (runs once)
    injectAdmissionsBar();

    // Remove any previously-injected transportation section (cache safety)
    (function removeTransport() {
      var t = document.getElementById("transportation");
      if (t && t.parentNode) t.parentNode.removeChild(t);
      // Also remove any stray nav link pointing to it
      document.querySelectorAll('a[href="#transportation"]').forEach(function (a) {
        if (a.parentNode) a.parentNode.removeChild(a);
      });
    })();

    // Reorder: School Introduction (#about) must appear BEFORE the
    // Chairman section. React currently renders chairman → about.
    reorderAboutBeforeChairman();

    // v32 — address / book-visit / active-campus (transportation removed)
    injectHeroAddress();
    injectPopupAddress();
    injectBookVisitForm();
    swapWhyChooseCards();
    // injectTransportationStrip(); // removed per client request

    // v36 — floating WhatsApp button (right side, always visible)
    injectFloatingWhatsApp();

    // v41 — Discover-School 3D mode: hide chrome + add prominent dismiss.
    install3DMode();

    // Mutation observer fallback for late re-renders
    var obs = new MutationObserver(function () {
      var p = document.getElementById("pathways");
      var f = document.getElementById("facilities");
      if (p) enhancePathways(p);
      if (f) enhanceFacilities(f);
      enhanceMobileHero();
      var hero = document.querySelector(".alg-hero-white");
      if (hero) injectDesktopLogoStage(hero);
      fixTiktokAndAddress();
      injectMapEmbed();
      // v32 re-runs (all idempotent; transportation removed)
      injectHeroAddress();
      injectBookVisitForm();
      swapWhyChooseCards();
      reorderAboutBeforeChairman();
      // injectTransportationStrip(); // removed per client request
      // v36 re-runs
      injectFloatingWhatsApp();
    });
    obs.observe(document.body, { childList: true, subtree: true });
    // Stop observing after 20s — enhancement is idempotent
    setTimeout(function () { obs.disconnect(); }, 20000);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();

/* ════════════════════════════════════════════════════════════════════
   v25 — BUILD MODE
   Live theme editor overlay: 4 presets + per-section text/background
   controls (solid OR gradient with angle + 2 stops). Exports as JSON
   (source of truth, round-trips) or CSS (preview). Choice persists in
   localStorage at alg.buildMode.v1. All drawer nodes are marked
   data-alg-build-ui="1" so they're easy to distinguish from page DOM.
   ════════════════════════════════════════════════════════════════════ */
(function algBuildMode() {
  var SECTIONS = [
    { id: "hero",       label: "Hero",                    selector: ".alg-hero-white" },
    { id: "nav",        label: "Navigation",              selector: "nav.alg-nav-light, nav[class*='fixed w-full z-40']" },
    { id: "pathways",   label: "Pathways",                selector: "#pathways" },
    { id: "academics",  label: "Academics (stages)",      selector: "#academics" },
    { id: "facilities", label: "Facilities",              selector: "#facilities" },
    { id: "admissions", label: "Admissions CTA",          selector: "#admissions" },
    { id: "footer",     label: "Footer",                  selector: "footer#contact" },
    { id: "body",       label: "Page body",               selector: "main" }
  ];

  // Some sections have full-bleed inline gradients or absolute-positioned
  // overlay divs (e.g. #admissions has a bg-gradient-to-br overlay and an
  // inline style gradient on the section itself; #academics carries a
  // Tailwind bg-[#162354] class). When a user customizes those sections,
  // we must hide those overlays so the picked color/gradient actually
  // shows through. Keyed by section id.
  var OVERLAY_SELECTORS = {
    admissions: '#admissions > div.absolute.inset-0, #admissions div[class*="bg-gradient-to-br"]',
    academics:  '#academics > div.absolute.inset-0',
    hero:       '.alg-hero-white > div[class*="bg-gradient"], .alg-hero-white > div.absolute.inset-0[class*="bg-"]',
    // v30.1: footer has an absolute "Map Coming Soon" panel on the
    // right 1/3 (bg-[#162354] with a gradient fade) that bleeds a
    // navy/pink tint through the white flip. Hide it when customized.
    footer:     'footer#contact > div.absolute.inset-y-0, footer#contact > div[class*="absolute"][class*="inset-y-0"]'
  };

  var SWATCHES = ["#ffffff","#f4f6fb","#0e1a40","#1B2E6D","#0a1128","#C1272D","#F5F1E8","#111111"];
  var GRAD_ANGLES = [90, 135, 180, 45];

  var PRESETS = {
    // v30: "default" now means all sections white with navy text. The
    // Chairman/About section (#about) is NOT in SECTIONS so it's left
    // with its native styling. `body` is white-bg-only (no text color)
    // so #about children don't inherit navy that would clash with its
    // own dark styling.
    "default": {
      hero:       { text:"#0e1a40", bg:{type:"solid",color:"#ffffff"} },
      nav:        { text:"#0e1a40", bg:{type:"solid",color:"#ffffff"} },
      pathways:   { text:"#0e1a40", bg:{type:"solid",color:"#ffffff"} },
      academics:  { text:"#0e1a40", bg:{type:"solid",color:"#ffffff"} },
      facilities: { text:"#0e1a40", bg:{type:"solid",color:"#ffffff"} },
      admissions: { text:"#0e1a40", bg:{type:"solid",color:"#ffffff"} },
      footer:     { text:"#0e1a40", bg:{type:"solid",color:"#ffffff"} },
      body:       {                 bg:{type:"solid",color:"#ffffff"} }
    },
    "originalDark": {},
    "allNavy": {
      hero:       { text:"#ffffff", bg:{type:"gradient",angle:135,stops:["#0a1128","#162354"]} },
      nav:        { text:"#ffffff", bg:{type:"solid",color:"#0e1a40"} },
      pathways:   { text:"#ffffff", bg:{type:"gradient",angle:180,stops:["#0e1a40","#1B2E6D"]} },
      academics:  { text:"#ffffff", bg:{type:"gradient",angle:135,stops:["#162354","#0e1a40"]} },
      facilities: { text:"#ffffff", bg:{type:"gradient",angle:180,stops:["#1B2E6D","#0e1a40"]} },
      admissions: { text:"#ffffff", bg:{type:"gradient",angle:135,stops:["#162354","#0e1a40"]} },
      footer:     { text:"#ffffff", bg:{type:"solid",color:"#0a1128"} },
      body:       { text:"#ffffff", bg:{type:"solid",color:"#0e1a40"} }
    },
    "allWhite": {
      hero:       { text:"#0e1a40", bg:{type:"solid",color:"#ffffff"} },
      nav:        { text:"#0e1a40", bg:{type:"solid",color:"#ffffff"} },
      pathways:   { text:"#0e1a40", bg:{type:"solid",color:"#ffffff"} },
      academics:  { text:"#0e1a40", bg:{type:"solid",color:"#ffffff"} },
      facilities: { text:"#0e1a40", bg:{type:"solid",color:"#ffffff"} },
      admissions: { text:"#0e1a40", bg:{type:"solid",color:"#ffffff"} },
      footer:     { text:"#0e1a40", bg:{type:"solid",color:"#ffffff"} },
      body:       { text:"#0e1a40", bg:{type:"solid",color:"#ffffff"} }
    },
    "heroNavyRestWhite": {
      hero:       { text:"#ffffff", bg:{type:"gradient",angle:135,stops:["#0a1128","#162354"]} },
      nav:        { text:"#0e1a40", bg:{type:"solid",color:"#ffffff"} },
      pathways:   { text:"#0e1a40", bg:{type:"solid",color:"#ffffff"} },
      academics:  { text:"#0e1a40", bg:{type:"solid",color:"#ffffff"} },
      facilities: { text:"#0e1a40", bg:{type:"solid",color:"#ffffff"} },
      admissions: { text:"#0e1a40", bg:{type:"solid",color:"#ffffff"} },
      footer:     { text:"#0e1a40", bg:{type:"solid",color:"#ffffff"} },
      body:       { text:"#0e1a40", bg:{type:"solid",color:"#ffffff"} }
    }
  };

  var LS_KEY = "alg.buildMode.v1";

  function loadState() {
    try {
      var raw = localStorage.getItem(LS_KEY);
      if (raw) {
        var s = JSON.parse(raw);
        // v30: legacy users on empty default (no customizations) get
        // promoted to the new white baseline so returning visitors
        // see the refreshed look. Custom states are preserved.
        if (s && s.preset === "default" && (!s.sections || !Object.keys(s.sections).length)) {
          s.sections = JSON.parse(JSON.stringify(PRESETS.default));
        }
        return s;
      }
    } catch (e) {}
    return { preset:"default", sections: JSON.parse(JSON.stringify(PRESETS.default)), open:false };
  }
  function saveState() {
    try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch (e) {}
  }
  var state = loadState();

  // Luminance 0..1 from hex — used to decide whether to hide the React
  // navy overlay divs inside the hero.
  function luminance(hex) {
    var h = (hex || "#ffffff").replace("#","");
    if (h.length === 3) h = h.split("").map(function(c){return c+c;}).join("");
    var r = parseInt(h.slice(0,2),16);
    var g = parseInt(h.slice(2,4),16);
    var b = parseInt(h.slice(4,6),16);
    if (isNaN(r) || isNaN(g) || isNaN(b)) return 1;
    return (0.299*r + 0.587*g + 0.114*b) / 255;
  }
  function firstStop(bg) {
    if (!bg) return null;
    if (bg.type === "solid") return bg.color;
    return (bg.stops && bg.stops[0]) || "#ffffff";
  }

  // Build the CSS rules for the current state.
  function buildRules(st) {
    var out = [];
    // Prefix boosts specificity (html body …) so rules beat static
    // !important rules already in enhance.css (e.g. footer#contact
    // gradient, #academics bg-[#162354] Tailwind class).
    var BOOST = "html body ";
    SECTIONS.forEach(function (sec) {
      var s = st.sections[sec.id];
      if (!s) return;
      var boosted = sec.selector.split(",").map(function(p){ return BOOST + p.trim(); }).join(", ");
      var decls = [];
      if (s.bg) {
        if (s.bg.type === "solid") {
          decls.push("background:" + s.bg.color + " !important");
          decls.push("background-color:" + s.bg.color + " !important");
          decls.push("background-image:none !important");
        } else if (s.bg.type === "gradient") {
          var stops = (s.bg.stops || []).filter(Boolean).join(", ");
          if (stops) {
            decls.push("background:linear-gradient(" + (s.bg.angle || 135) + "deg, " + stops + ") !important");
            decls.push("background-color:" + (s.bg.stops[0] || "#ffffff") + " !important");
          }
        }
      }
      if (s.text) decls.push("color:" + s.text + " !important");
      if (decls.length) out.push(boosted + " { " + decls.join("; ") + "; }");

      // If this section has inner overlay divs (absolute-positioned
      // gradient washes baked into the React bundle), hide them when
      // the user has customized the bg — otherwise the overlay covers
      // the picked color/gradient.
      if (s.bg && OVERLAY_SELECTORS[sec.id]) {
        out.push(OVERLAY_SELECTORS[sec.id] + " { display: none !important; background: none !important; }");
      }

      // Text color cascade via inherit — flips every typographic child
      // that isn't marked as an intentional accent.
      if (s.text) {
        out.push(
          boosted +
          " :is(h1,h2,h3,h4,h5,h6,p,li,span,a,strong,em,button)" +
          ":not([data-alg-accent])" +
          ":not(.alg-desktop-slogan-accent)" +
          ":not(.amh-h1-accent)" +
          ":not([class*='text-[#C1272D]'])" +
          ":not([class*='text-[#c1272d]'])" +
          " { color: inherit !important; }"
        );
        // Flip Tailwind text-white/xx utility shades too (used heavily
        // in #academics and #admissions when base was navy).
        out.push(
          boosted +
          " .text-white, " + boosted + " [class*='text-white/'] " +
          "{ color: inherit !important; }"
        );
      }
    });

    // Derived: kill/show the React navy overlay divs based on hero lum
    var heroBg = st.sections.hero && st.sections.hero.bg;
    if (heroBg) {
      var lum = luminance(firstStop(heroBg));
      var sel = '.alg-hero-white div[style*="#0a1128"], .alg-hero-white div[style*="#162354"], .alg-hero-white div[style*="linear-gradient(135deg"]';
      if (lum > 0.55) {
        out.push(sel + " { display: none !important; }");
      } else {
        out.push(sel + " { display: block !important; }");
      }
    }
    return out.join("\n");
  }

  function applyState() {
    var styleEl = document.getElementById("alg-build-style");
    if (!styleEl) {
      styleEl = document.createElement("style");
      styleEl.id = "alg-build-style";
      styleEl.setAttribute("data-alg-build-ui", "1");
      document.head.appendChild(styleEl);
    }
    styleEl.textContent = buildRules(state);
    saveState();
  }

  // ── Toast notification ─────────────────────────────────────────────
  function toast(msg) {
    var t = document.createElement("div");
    t.className = "alg-bm-toast";
    t.setAttribute("data-alg-build-ui", "1");
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(function(){ t.classList.add("out"); }, 1600);
    setTimeout(function(){ t.remove(); }, 2000);
  }

  // ── Color swatch row with "custom..." native picker ────────────────
  function makeSwatchRow(current, onPick) {
    var row = document.createElement("div");
    row.className = "alg-bm-swatches";
    row.setAttribute("data-alg-build-ui", "1");
    SWATCHES.forEach(function (hex) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "alg-bm-swatch" + (hex.toLowerCase() === (current||"").toLowerCase() ? " selected" : "");
      b.style.background = hex;
      b.title = hex;
      b.setAttribute("data-alg-build-ui", "1");
      b.addEventListener("click", function(){ onPick(hex); });
      row.appendChild(b);
    });
    var custom = document.createElement("input");
    custom.type = "color";
    custom.className = "alg-bm-color-input";
    custom.value = current || "#ffffff";
    custom.title = "Custom color";
    custom.setAttribute("data-alg-build-ui", "1");
    custom.addEventListener("input", function(){ onPick(custom.value); });
    row.appendChild(custom);
    return row;
  }

  var presetBtns = [];
  function updatePresetButtons() {
    presetBtns.forEach(function (b) {
      b.classList.toggle("selected", b.dataset.preset === state.preset);
    });
  }

  function buildSectionEditor(sec) {
    var wrap = document.createElement("details");
    wrap.className = "alg-bm-sec";
    wrap.setAttribute("data-alg-build-ui", "1");
    var summary = document.createElement("summary");
    summary.setAttribute("data-alg-build-ui", "1");
    summary.textContent = sec.label;
    wrap.appendChild(summary);
    var body = document.createElement("div");
    body.className = "alg-bm-sec-body";
    body.setAttribute("data-alg-build-ui", "1");
    wrap.appendChild(body);

    var s = state.sections[sec.id] || {};

    // Text color
    var textRow = document.createElement("div");
    textRow.className = "alg-bm-row";
    textRow.setAttribute("data-alg-build-ui", "1");
    textRow.innerHTML = '<label data-alg-build-ui="1">Text color</label>';
    textRow.appendChild(makeSwatchRow(s.text || "#0e1a40", function(v){
      state.sections[sec.id] = state.sections[sec.id] || {};
      state.sections[sec.id].text = v;
      state.preset = "custom";
      applyState();
      updatePresetButtons();
    }));
    body.appendChild(textRow);

    // Background
    var bgRow = document.createElement("div");
    bgRow.className = "alg-bm-row";
    bgRow.setAttribute("data-alg-build-ui", "1");
    bgRow.innerHTML = '<label data-alg-build-ui="1">Background</label>';
    body.appendChild(bgRow);

    var tabs = document.createElement("div");
    tabs.className = "alg-bm-bg-tabs";
    tabs.setAttribute("data-alg-build-ui", "1");
    var solidBtn = document.createElement("button");
    solidBtn.type = "button"; solidBtn.textContent = "Solid";
    solidBtn.setAttribute("data-alg-build-ui", "1");
    var gradBtn = document.createElement("button");
    gradBtn.type = "button"; gradBtn.textContent = "Gradient";
    gradBtn.setAttribute("data-alg-build-ui", "1");
    tabs.appendChild(solidBtn); tabs.appendChild(gradBtn);
    body.appendChild(tabs);

    var solidPanel = document.createElement("div");
    solidPanel.setAttribute("data-alg-build-ui", "1");
    var gradPanel = document.createElement("div");
    gradPanel.setAttribute("data-alg-build-ui", "1");
    body.appendChild(solidPanel);
    body.appendChild(gradPanel);

    function refreshBg() {
      var s = state.sections[sec.id] || {};
      var bg = s.bg || { type:"solid", color:"#ffffff" };
      solidBtn.classList.toggle("selected", bg.type === "solid");
      gradBtn.classList.toggle("selected", bg.type === "gradient");
      solidPanel.hidden = bg.type !== "solid";
      gradPanel.hidden = bg.type !== "gradient";
      solidPanel.innerHTML = "";
      gradPanel.innerHTML = "";
      if (bg.type === "solid") {
        solidPanel.appendChild(makeSwatchRow(bg.color, function(v){
          state.sections[sec.id] = state.sections[sec.id] || {};
          state.sections[sec.id].bg = { type:"solid", color:v };
          state.preset = "custom";
          applyState(); updatePresetButtons();
        }));
      } else {
        var angleRow = document.createElement("div");
        angleRow.className = "alg-bm-angle";
        angleRow.setAttribute("data-alg-build-ui", "1");
        var lbl = document.createElement("label");
        lbl.textContent = "Angle"; lbl.setAttribute("data-alg-build-ui", "1");
        angleRow.appendChild(lbl);
        GRAD_ANGLES.forEach(function (a) {
          var chip = document.createElement("button");
          chip.type = "button";
          chip.textContent = a + "°";
          chip.className = "alg-bm-chip" + (bg.angle === a ? " selected" : "");
          chip.setAttribute("data-alg-build-ui", "1");
          chip.addEventListener("click", function(){
            state.sections[sec.id].bg.angle = a;
            state.preset = "custom";
            applyState(); refreshBg(); updatePresetButtons();
          });
          angleRow.appendChild(chip);
        });
        var customAngle = document.createElement("input");
        customAngle.type = "number"; customAngle.min = 0; customAngle.max = 360;
        customAngle.value = bg.angle;
        customAngle.className = "alg-bm-angle-input";
        customAngle.setAttribute("data-alg-build-ui", "1");
        customAngle.addEventListener("input", function(){
          var v = parseInt(customAngle.value, 10);
          if (isNaN(v)) return;
          state.sections[sec.id].bg.angle = v;
          state.preset = "custom";
          applyState(); updatePresetButtons();
        });
        angleRow.appendChild(customAngle);
        gradPanel.appendChild(angleRow);

        ["Stop 1","Stop 2"].forEach(function (label, idx) {
          var row = document.createElement("div");
          row.className = "alg-bm-row";
          row.setAttribute("data-alg-build-ui", "1");
          var l = document.createElement("label");
          l.textContent = label; l.setAttribute("data-alg-build-ui","1");
          row.appendChild(l);
          row.appendChild(makeSwatchRow((bg.stops && bg.stops[idx]) || "#ffffff", function(v){
            state.sections[sec.id].bg.stops = state.sections[sec.id].bg.stops || ["#ffffff","#ffffff"];
            state.sections[sec.id].bg.stops[idx] = v;
            state.preset = "custom";
            applyState(); updatePresetButtons();
          }));
          gradPanel.appendChild(row);
        });
      }
    }

    solidBtn.addEventListener("click", function(){
      state.sections[sec.id] = state.sections[sec.id] || {};
      var cur = state.sections[sec.id].bg;
      state.sections[sec.id].bg = { type:"solid", color: (cur && cur.color) || (cur && cur.stops && cur.stops[0]) || "#ffffff" };
      state.preset = "custom";
      applyState(); refreshBg(); updatePresetButtons();
    });
    gradBtn.addEventListener("click", function(){
      state.sections[sec.id] = state.sections[sec.id] || {};
      var cur = state.sections[sec.id].bg;
      var stops = (cur && cur.stops) || [(cur && cur.color) || "#0e1a40", "#1B2E6D"];
      state.sections[sec.id].bg = { type:"gradient", angle: (cur && cur.angle) || 135, stops: stops };
      state.preset = "custom";
      applyState(); refreshBg(); updatePresetButtons();
    });

    refreshBg();
    return wrap;
  }

  function fallbackCopy(text) {
    var ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed"; ta.style.opacity = "0";
    ta.setAttribute("data-alg-build-ui", "1");
    document.body.appendChild(ta); ta.select();
    try { document.execCommand("copy"); } catch (e) {}
    ta.remove();
  }
  // Flash "Copied!" label on the button itself so the user gets
  // direct, in-place confirmation (in addition to the toast).
  function flashCopied(btn) {
    if (!btn) return;
    if (btn.dataset.bmOrig == null) btn.dataset.bmOrig = btn.textContent;
    btn.textContent = "Copied!";
    btn.classList.add("alg-bm-copied");
    btn.disabled = true;
    clearTimeout(btn._bmTimer);
    btn._bmTimer = setTimeout(function () {
      btn.textContent = btn.dataset.bmOrig;
      btn.classList.remove("alg-bm-copied");
      btn.disabled = false;
    }, 1600);
  }

  function copyText(text, label, btn) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(
        function(){ toast(label + " copied"); flashCopied(btn); },
        function(){ fallbackCopy(text); toast(label + " copied"); flashCopied(btn); }
      );
    } else {
      fallbackCopy(text);
      toast(label + " copied");
      flashCopied(btn);
    }
  }

  function buildDrawer() {
    // Toggle button (bottom-left, lifted when admissions bar is active)
    var toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "alg-bm-toggle";
    toggle.setAttribute("aria-label", "Open Build Mode");
    toggle.setAttribute("data-alg-build-ui", "1");
    toggle.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" data-alg-build-ui="1">' +
        '<path d="M12 19l7-7 3 3-7 7-3-3z"/>' +
        '<path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/>' +
        '<path d="M2 2l7.586 7.586"/><circle cx="11" cy="11" r="2"/>' +
      '</svg>';
    document.body.appendChild(toggle);

    var drawer = document.createElement("aside");
    drawer.className = "alg-bm-drawer";
    drawer.setAttribute("data-alg-build-ui", "1");
    drawer.setAttribute("aria-hidden", "true");

    drawer.innerHTML =
      '<header class="alg-bm-header" data-alg-build-ui="1">' +
        '<h2 data-alg-build-ui="1">Build Mode</h2>' +
        '<button type="button" class="alg-bm-close" aria-label="Close Build Mode" data-alg-build-ui="1">&times;</button>' +
      '</header>' +
      '<div class="alg-bm-body" data-alg-build-ui="1">' +
        '<section data-alg-build-ui="1">' +
          '<h3 data-alg-build-ui="1">Preset</h3>' +
          '<div class="alg-bm-preset-grid" data-alg-build-ui="1"></div>' +
        '</section>' +
        '<section data-alg-build-ui="1">' +
          '<h3 data-alg-build-ui="1">Sections</h3>' +
          '<div class="alg-bm-section-editors" data-alg-build-ui="1"></div>' +
        '</section>' +
        '<section class="alg-bm-actions" data-alg-build-ui="1">' +
          '<button type="button" class="alg-bm-action alg-bm-copy-json" data-alg-build-ui="1">Copy Config (JSON)</button>' +
          '<button type="button" class="alg-bm-action alg-bm-copy-css" data-alg-build-ui="1">Copy CSS (preview)</button>' +
          '<button type="button" class="alg-bm-action alg-bm-reset" data-alg-build-ui="1">Reset</button>' +
        '</section>' +
      '</div>';
    document.body.appendChild(drawer);

    // Presets
    var presetWrap = drawer.querySelector(".alg-bm-preset-grid");
    [
      { id:"default",            label:"Default (White)" },
      { id:"originalDark",       label:"Original Dark (site)" },
      { id:"allNavy",            label:"All Navy Gradient" },
      { id:"allWhite",           label:"All White" },
      { id:"heroNavyRestWhite",  label:"Hero Navy · Rest White" }
    ].forEach(function (p) {
      var b = document.createElement("button");
      b.type = "button";
      b.textContent = p.label;
      b.dataset.preset = p.id;
      b.className = "alg-bm-preset";
      b.setAttribute("data-alg-build-ui", "1");
      b.addEventListener("click", function(){
        state.preset = p.id;
        state.sections = JSON.parse(JSON.stringify(PRESETS[p.id] || {}));
        applyState();
        rebuildSections();
        updatePresetButtons();
        toast("Applied: " + p.label);
      });
      presetBtns.push(b);
      presetWrap.appendChild(b);
    });

    // Section editors
    var secList = drawer.querySelector(".alg-bm-section-editors");
    function rebuildSections() {
      secList.innerHTML = "";
      SECTIONS.forEach(function (sec) {
        secList.appendChild(buildSectionEditor(sec));
      });
    }
    rebuildSections();

    // Actions
    drawer.querySelector(".alg-bm-copy-json").addEventListener("click", function(e){
      copyText(JSON.stringify(state, null, 2), "JSON", e.currentTarget);
    });
    drawer.querySelector(".alg-bm-copy-css").addEventListener("click", function(e){
      copyText(buildRules(state), "CSS", e.currentTarget);
    });
    drawer.querySelector(".alg-bm-reset").addEventListener("click", function(){
      state = { preset:"default", sections:{}, open:true };
      applyState();
      rebuildSections();
      updatePresetButtons();
      toast("Reset to default");
    });
    drawer.querySelector(".alg-bm-close").addEventListener("click", function(){
      drawer.classList.remove("open");
      drawer.setAttribute("aria-hidden", "true");
      state.open = false; saveState();
    });

    toggle.addEventListener("click", function(){
      var open = !drawer.classList.contains("open");
      drawer.classList.toggle("open", open);
      drawer.setAttribute("aria-hidden", open ? "false" : "true");
      state.open = open; saveState();
    });

    if (state.open) {
      drawer.classList.add("open");
      drawer.setAttribute("aria-hidden", "false");
    }
    updatePresetButtons();
  }

  // Boot — apply persisted state ASAP so page never "flashes" the
  // default theme when the client had a custom look saved.
  applyState();
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", buildDrawer);
  } else {
    buildDrawer();
  }
})();
