#!/usr/bin/env python3
"""
v4:
 1. Hero logo: move DOWN (below buttons) via order-last + smaller bottom margin
 2. Pathway: add road-emergence animation (blue + red forks grow OUT of trunk)
 3. Fix white-on-white text in pathway:
    - SVG labels: light blue/red → deep blue/red fills
    - Card sub inline colors: light tints → deep readable shades
    - Card titles pw-title-blue/red → deep blue/red via CSS override
 4. Responsiveness tweaks (SVG scaling, cards grid, hero spacing)
"""

import re

JS_PATH  = 'src/dashboard/public/algioshy/assets/index-fbf653f9.js'
CSS_PATH = 'src/dashboard/public/algioshy/assets/index-i6CxoHev.css'

with open(JS_PATH, 'r', encoding='utf-8') as f:
    js = f.read()

orig_js = len(js)
changes = []

# ─── 1. Hero logo: add order-last + reduce big top margin ─────────────────
old_logo = (
    'e.jsx(a.img,{src:w,alt:"Smart College",'
    'initial:{opacity:0,scale:.8,y:20},animate:{opacity:1,scale:1,y:0},'
    'transition:{duration:1,delay:.3,ease:"easeOut"},'
    'className:"w-[200px] sm:w-[240px] md:w-[280px] lg:w-[320px] h-auto object-contain mx-auto mb-8 md:mb-10 drop-shadow-[0_15px_45px_rgba(193,39,45,0.45)]"})'
)
new_logo = (
    'e.jsx(a.img,{src:w,alt:"Smart College",'
    'initial:{opacity:0,scale:.8,y:20},animate:{opacity:1,scale:1,y:0},'
    'transition:{duration:1,delay:.6,ease:"easeOut"},'
    'className:"order-last w-[150px] sm:w-[180px] md:w-[210px] lg:w-[240px] h-auto object-contain mx-auto mt-10 md:mt-14 mb-0 drop-shadow-[0_10px_35px_rgba(193,39,45,0.35)] opacity-95"})'
)
if old_logo in js:
    js = js.replace(old_logo, new_logo, 1)
    changes.append('1. Hero logo → order-last (below buttons), smaller, mt-10 md:mt-14')
else:
    print('WARNING: hero logo #4 pattern not found')

# ─── 2a. Fix SVG text label fills (light → deep) ──────────────────────────
js = js.replace(
    'textAnchor:"middle",fill:"#93c5fd",fontSize:"19",fontWeight:"800"',
    'textAnchor:"middle",fill:"#1d4ed8",fontSize:"19",fontWeight:"800"', 1
)
js = js.replace(
    'textAnchor:"middle",fill:"#fca5a5",fontSize:"19",fontWeight:"800"',
    'textAnchor:"middle",fill:"#b91c1c",fontSize:"19",fontWeight:"800"', 1
)
# sublabel under main labels (rgba 0.60 tints)
js = js.replace(
    'fill:"rgba(147,197,253,0.60)"',
    'fill:"rgba(29,78,216,0.85)"', 1
)
js = js.replace(
    'fill:"rgba(252,165,165,0.60)"',
    'fill:"rgba(185,28,28,0.85)"', 1
)
changes.append('2a. SVG label fills → deep blue #1d4ed8 / deep red #b91c1c')

# ─── 2b. Fix card pw-card-sub inline colors (light → deep) ────────────────
js = js.replace(
    'pw-card-sub",style:{color:"rgba(147,197,253,0.7)"',
    'pw-card-sub",style:{color:"rgba(29,78,216,0.9)"', 1
)
js = js.replace(
    'pw-card-sub",style:{color:"rgba(252,165,165,0.7)"',
    'pw-card-sub",style:{color:"rgba(185,28,28,0.9)"', 1
)
changes.append('2b. Card sublabel colors → deep readable blue/red')

# ─── 2c. Add emerging-road stroke paths (stroke-dashoffset loop) ──────────
# Insert after existing sweeps, before fog rect
# Anchor: the pw-sweep-r closing, then fog rect
sweep_r_end = 'strokeDasharray:"10 90",className:"pw-sweep-r"}),'
fog_rect = 'e.jsx("rect",{x:"0",y:"0",width:"1000",height:"640",fill:"url(#pw7Fog)"}),'

emerge = (
    # Trunk emerge (light grey, sets up)
    'e.jsx("path",{d:"M 500 38 L 500 275",'
    'stroke:"rgba(15,23,42,0.55)",strokeWidth:"3",strokeLinecap:"round",fill:"none",'
    'pathLength:"100",strokeDasharray:"100 100",className:"pw-emerge-t"}),'
    # Left fork emerge (deep blue, grows out of trunk)
    'e.jsx("path",{d:"M 500 275 C 458 370 278 500 68 598",'
    'stroke:"#2563eb",strokeWidth:"4",strokeLinecap:"round",fill:"none",'
    'pathLength:"100",strokeDasharray:"100 100",className:"pw-emerge-l"}),'
    # Right fork emerge (deep red, grows out of trunk)
    'e.jsx("path",{d:"M 500 275 C 542 370 722 500 932 598",'
    'stroke:"#dc2626",strokeWidth:"4",strokeLinecap:"round",fill:"none",'
    'pathLength:"100",strokeDasharray:"100 100",className:"pw-emerge-r"}),'
)

if sweep_r_end + fog_rect in js:
    js = js.replace(sweep_r_end + fog_rect, sweep_r_end + emerge + fog_rect, 1)
    changes.append('2c. Added 3 road-emerge strokes (trunk + blue L + red R)')
else:
    print('WARNING: emerge insertion anchor not found')

# ─── Verify JS ──────────────────────────────────────────────────────────────
op = js.count('('); cp = js.count(')')
ob = js.count('{'); cb = js.count('}')
oq = js.count('['); cq = js.count(']')
print(f'Parens {op}/{cp} Braces {ob}/{cb} Brackets {oq}/{cq}')
assert op == cp and ob == cb and oq == cq

with open(JS_PATH, 'w', encoding='utf-8') as f:
    f.write(js)

# ─── 3. CSS: emerge keyframes, white-bg text fixes, responsive ─────────────
with open(CSS_PATH, 'r', encoding='utf-8') as f:
    css = f.read()

# Drop any previous v3 block for idempotency
css = re.sub(r'\n/\* pw-v4-emerge \*/[\s\S]*?(?=\n/\*|\Z)', '', css)

v4_css = (
    '\n/* pw-v4-emerge */\n'
    # Deep readable card title colors on white bg (override pastel originals)
    '.pw-section .pw-title-blue{color:#1d4ed8 !important}\n'
    '.pw-section .pw-title-red{color:#b91c1c !important}\n'
    # Ensure any white-ish text within section becomes dark on white bg
    '.pw-section .text-white{color:#0f172a !important}\n'
    '.pw-section [class*="text-white/"]{color:#475569 !important}\n'
    # Emerge paths — roads drawing from split point outward, looping
    '.pw-emerge-t,.pw-emerge-l,.pw-emerge-r{filter:drop-shadow(0 2px 6px currentColor);opacity:0}\n'
    '.pw-emerge-t{animation:pwEmergeT 5.4s cubic-bezier(.4,.0,.2,1) infinite}\n'
    '.pw-emerge-l{animation:pwEmergeF 5.4s cubic-bezier(.4,.0,.2,1) infinite .9s}\n'
    '.pw-emerge-r{animation:pwEmergeF 5.4s cubic-bezier(.4,.0,.2,1) infinite .9s}\n'
    '@keyframes pwEmergeT{'
      '0%{stroke-dashoffset:100;opacity:0}'
      '8%{opacity:.85}'
      '30%,55%{stroke-dashoffset:0;opacity:.85}'
      '75%{opacity:.85}'
      '92%{opacity:0}'
      '100%{stroke-dashoffset:100;opacity:0}'
    '}\n'
    '@keyframes pwEmergeF{'
      '0%,12%{stroke-dashoffset:100;opacity:0}'
      '18%{opacity:1}'
      '42%,72%{stroke-dashoffset:0;opacity:1}'
      '88%{opacity:1}'
      '96%,100%{stroke-dashoffset:100;opacity:0}'
    '}\n'
    # On desktop show SVG labels (they were hidden on mobile via earlier rule)
    '@media (min-width:700px){.pw-svg-text{display:block}}\n'
    # Responsive tightenings
    '@media (max-width:700px){'
      '.pw-section .pw-title{font-size:clamp(24px,7vw,36px)}'
      '.pw-road-svg{max-height:300px}'
      '.pw-cards-grid{padding:12px 14px 40px}'
      '.pw-emerge-l,.pw-emerge-r{stroke-width:5}'
    '}\n'
    # Light-mode glow for emerge (works nicely over white bg)
    '.pw-emerge-l{filter:drop-shadow(0 0 10px rgba(37,99,235,0.55))}\n'
    '.pw-emerge-r{filter:drop-shadow(0 0 10px rgba(220,38,38,0.55))}\n'
    '.pw-emerge-t{filter:drop-shadow(0 0 6px rgba(15,23,42,0.35))}\n'
)
css = css.rstrip() + '\n' + v4_css
with open(CSS_PATH, 'w', encoding='utf-8') as f:
    f.write(css)
changes.append('3. CSS: emerge keyframes + white-bg text overrides + responsive')

print(f'\nApplied:')
for c in changes:
    print(f'  - {c}')
print(f'\nJS size: {orig_js} → {len(js)} ({len(js)-orig_js:+d})')
