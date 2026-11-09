#!/usr/bin/env python3
"""
Multi-fix:
1. Hero image → new_logo.jpg
2. About section images → images-2.jpg / images-3.jpg
3. Chairman quote after Shaping Futures eyebrow div
4. Dual pathway font bigger
5. Remove Later button from mobile popup
"""

js_path = "src/dashboard/public/algioshy/assets/index-fbf653f9.js"

with open(js_path, "r") as f:
    js = f.read()

changes = 0

# ── 1. Hero image ─────────────────────────────────────────────────────────────
old = 'de="/algioshy/assets/hero-BZHTKrWe.jpg"'
new = 'de="/algioshy/assets/new_logo.jpg"'
if old in js:
    js = js.replace(old, new, 1); changes += 1; print("1. Hero image: OK")
else:
    print("1. Hero image: NOT FOUND")

# ── 2. About images ───────────────────────────────────────────────────────────
old2 = 'me="/algioshy/assets/about-main-D3prQ46N.jpg"'
new2 = 'me="/algioshy/assets/images-2.jpg"'
if old2 in js:
    js = js.replace(old2, new2, 1); changes += 1; print("2. About main image: OK")
else:
    print("2. About main image: NOT FOUND")

old3 = 'xe="/algioshy/assets/about-overlay-BMtrtmfD.jpg"'
new3 = 'xe="/algioshy/assets/images-3.jpg"'
if old3 in js:
    js = js.replace(old3, new3, 1); changes += 1; print("3. About overlay image: OK")
else:
    print("3. About overlay image: NOT FOUND")

# ── 4. Chairman quote — insert after Shaping Futures eyebrow div, before h1 ──
# The eyebrow div ends with: ...children:"Shaping Futures. Empowering Minds"})]}),
# followed by: e.jsxs(a.h1,{...
old_eyebrow_end = (
    'children:"Shaping Futures. Empowering Minds"})]})'
    ',e.jsxs(a.h1,'
)
chairman_block = (
    'e.jsxs(a.div,{'
      'initial:{opacity:0,y:20},animate:{opacity:1,y:0},'
      'transition:{duration:.8,delay:.3,ease:"easeOut"},'
      'className:"flex items-start gap-3 mb-6 bg-white/8 backdrop-blur-sm border-l-2 border-[#C1272D] pl-4 py-3 rounded-r-xl max-w-xl",'
      'children:['
        'e.jsxs("div",{children:['
          'e.jsx("p",{className:"text-white/85 text-sm md:text-base font-light leading-relaxed italic",'
            'children:"\u201cAt this critical stage of education, the right environment shapes not only academic success, but the future of each student. At Smart College, we go beyond curriculum \u2014 we develop confident, disciplined, and forward-thinking young leaders.\u201d"}),'
          'e.jsx("p",{className:"text-[#C1272D] text-xs font-bold uppercase tracking-widest mt-2",'
            'children:"\u2014 Mr. Tarek Algioshy, Chairman"})'
        ']})'
      ']}'
    '),'
)
new_eyebrow_end = (
    'children:"Shaping Futures. Empowering Minds"})]})'
    ',' + chairman_block +
    'e.jsxs(a.h1,'
)
if old_eyebrow_end in js:
    js = js.replace(old_eyebrow_end, new_eyebrow_end, 1); changes += 1; print("4. Chairman quote: OK")
else:
    print("4. Chairman quote: NOT FOUND — checking probe")
    probe = 'Shaping Futures. Empowering Minds'
    if probe in js:
        idx = js.find(probe)
        print(f"  Found probe at {idx}")

# ── 5. Dual pathway font bigger ───────────────────────────────────────────────
old5a = 'className:"font-bold text-[#1B2E6D] text-sm md:text-base mb-2",children:"Dual Pathways"'
new5a = 'className:"font-bold text-[#1B2E6D] text-base md:text-lg mb-2",children:"Dual Pathways"'
if old5a in js:
    js = js.replace(old5a, new5a, 1); changes += 1; print("5. Dual pathway h4 font: OK")
else:
    print("5. Dual pathway h4 font: NOT FOUND")

old5b = 'className:"text-xs md:text-sm text-gray-500 font-medium mb-4",children:"IG (Cambridge International)'
new5b = 'className:"text-sm md:text-base text-gray-500 font-medium mb-4",children:"IG (Cambridge International)'
if old5b in js:
    js = js.replace(old5b, new5b, 1); changes += 1; print("6. Dual pathway p font: OK")
else:
    print("6. Dual pathway p font: NOT FOUND")

# ── 6. Remove Later button from mobile popup ─────────────────────────────────
old6 = ',e.jsx("button",{onClick:t,className:"px-4 py-3.5 text-[11px] font-semibold text-white/45 uppercase tracking-widest border border-white/15 hover:border-white/30 transition-colors",children:"Later"})'
new6 = ''
if old6 in js:
    js = js.replace(old6, new6, 1); changes += 1; print("7. Later button removed: OK")
else:
    print("7. Later button: NOT FOUND — trying alt")
    # Try without the leading comma
    old6b = 'e.jsx("button",{onClick:t,className:"px-4 py-3.5 text-[11px] font-semibold text-white/45 uppercase tracking-widest border border-white/15 hover:border-white/30 transition-colors",children:"Later"})'
    if old6b in js:
        js = js.replace(old6b, '', 1); changes += 1; print("  Later button (alt): OK")

# ── Bracket balance ───────────────────────────────────────────────────────────
ok = True
for o, c in [("(", ")"), ("[", "]"), ("{", "}")]:
    diff = js.count(o) - js.count(c)
    status = "OK" if diff == 0 else f"IMBALANCED ({diff:+d})"
    print(f"  {o}/{c}: {js.count(o)}/{js.count(c)} — {status}")
    if diff != 0:
        ok = False

if not ok:
    print(f"\nBracket imbalance — aborting! ({changes} changes applied before abort)")
    raise SystemExit(1)

with open(js_path, "w") as f:
    f.write(js)

print(f"\nDone — {changes} changes written to JS file")
