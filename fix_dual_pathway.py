#!/usr/bin/env python3
"""
Fix dual pathways section:
- Upside-down fork: single path at top splits into two going down
- No emojis or AI-style icons
- Responsive mobile + desktop
- CSS animations for path drawing
"""

js_path  = "src/dashboard/public/algioshy/assets/index-fbf653f9.js"
css_path = "src/dashboard/public/algioshy/assets/index-i6CxoHev.css"

# ── 1. JS replacement ──────────────────────────────────────────────────────────

with open(js_path, "r") as f:
    js = f.read()

# Old section: the full e.jsxs("div",{children:[h4, p, animated_div]}) block
old_section = (
    'e.jsxs("div",{children:[e.jsx("h4",{className:"font-bold text-[#1B2E6D] text-sm md:text-base mb-3",children:"Dual Pathways"}),e.jsx("p",{className:"text-xs md:text-sm text-gray-500 font-medium mb-4",children:"We offer a flexible dual pathway system that allows students to choose between an academic route focused on university preparation, and an applied pathway designed to build real-world skills and career readiness."}),e.jsxs("div",{className:"relative flex flex-col items-center py-4",children:[e.jsx("div",{className:"w-full flex justify-center mb-4",children:e.jsxs("svg",{viewBox:"0 0 300 120",className:"w-full max-w-[280px] h-auto",children:[e.jsx("path",{d:"M150 110 L150 60 Q150 40 130 30 L60 5",stroke:"#1B2E6D",strokeWidth:"4",fill:"none",strokeLinecap:"round",className:"animate-pulse",style:{animation:"drawPath 2s ease-in-out infinite alternate"}}),e.jsx("path",{d:"M150 110 L150 60 Q150 40 170 30 L240 5",stroke:"#C1272D",strokeWidth:"4",fill:"none",strokeLinecap:"round",className:"animate-pulse",style:{animation:"drawPath 2s ease-in-out infinite alternate",animationDelay:"0.5s"}}),e.jsx("circle",{cx:"150",cy:"110",r:"5",fill:"#1B2E6D"}),e.jsx("circle",{cx:"60",cy:"5",r:"5",fill:"#1B2E6D"}),e.jsx("circle",{cx:"240",cy:"5",r:"5",fill:"#C1272D"})]})}),e.jsxs("div",{className:"grid grid-cols-2 gap-3 w-full",children:[e.jsxs(a.div,{initial:{opacity:0,x:-20},whileInView:{opacity:1,x:0},viewport:{once:!0},transition:{delay:0.3},className:"bg-[#1B2E6D]/5 border border-[#1B2E6D]/20 rounded-xl p-3 text-center",children:[e.jsx("div",{className:"text-lg mb-1",children:"\\ud83c\\udf93"}),e.jsx("h5",{className:"font-bold text-[#1B2E6D] text-xs mb-1",children:"IG Cambridge"}),e.jsx("p",{className:"text-[10px] text-gray-500 leading-tight",children:"International academic pathway focused on university preparation and global qualifications."})]}),e.jsxs(a.div,{initial:{opacity:0,x:20},whileInView:{opacity:1,x:0},viewport:{once:!0},transition:{delay:0.5},className:"bg-[#C1272D]/5 border border-[#C1272D]/20 rounded-xl p-3 text-center",children:[e.jsx("div",{className:"text-lg mb-1",children:"\\ud83d\\udcbc"}),e.jsx("h5",{className:"font-bold text-[#C1272D] text-xs mb-1",children:"American Diploma"}),e.jsx("p",{className:"text-[10px] text-gray-500 leading-tight",children:"Applied pathway designed to build real-world skills, critical thinking, and career readiness."})]})]})]})]})'
)

# New section:
#  - Heading stays
#  - Original subtitle text (no AI paraphrase)
#  - SVG: single dot at top → stem → forks left (navy) and right (red) → endpoint dots
#  - Paths animate via CSS stroke-dashoffset (dp-left / dp-right keyframes)
#  - Cards: colored dot indicator instead of emoji
new_section = (
    'e.jsxs("div",{children:['
      'e.jsx("h4",{className:"font-bold text-[#1B2E6D] text-sm md:text-base mb-2",children:"Dual Pathways"}),'
      'e.jsx("p",{className:"text-xs md:text-sm text-gray-500 font-medium mb-3",'
        'children:"IG (Cambridge International) & American Diploma \u2014 two rigorous academic tracks preparing students for top universities worldwide"}),'
      # SVG fork: top-to-bottom split
      'e.jsxs("svg",{viewBox:"0 0 300 150",className:"w-full h-auto max-w-[320px] sm:max-w-full mx-auto block mb-3",'
        'xmlns:"http://www.w3.org/2000/svg",children:['
          # Left branch: start top-center, stem down, curve-left, end bottom-left
          'e.jsx("path",{d:"M150 12 L150 62 Q148 88 108 105 L58 138",'
            'stroke:"#1B2E6D",strokeWidth:"3.5",fill:"none",'
            'strokeLinecap:"round",strokeLinejoin:"round",'
            'style:{strokeDasharray:"230",strokeDashoffset:"230",'
              'animation:"dpLeft 1.1s cubic-bezier(.4,0,.2,1) 0.2s forwards"}}),'
          # Right branch: start top-center, stem down, curve-right, end bottom-right
          'e.jsx("path",{d:"M150 12 L150 62 Q152 88 192 105 L242 138",'
            'stroke:"#C1272D",strokeWidth:"3.5",fill:"none",'
            'strokeLinecap:"round",strokeLinejoin:"round",'
            'style:{strokeDasharray:"230",strokeDashoffset:"230",'
              'animation:"dpRight 1.1s cubic-bezier(.4,0,.2,1) 0.5s forwards"}}),'
          # Entry dot at top
          'e.jsx("circle",{cx:"150",cy:"12",r:"6",fill:"#1B2E6D"}),'
          # Left endpoint dot
          'e.jsx("circle",{cx:"58",cy:"138",r:"5",fill:"#1B2E6D",'
            'style:{opacity:"0",animation:"dpFade 0.3s ease-out 1.1s forwards"}}),'
          # Right endpoint dot
          'e.jsx("circle",{cx:"242",cy:"138",r:"5",fill:"#C1272D",'
            'style:{opacity:"0",animation:"dpFade 0.3s ease-out 1.4s forwards"}})'
        ']}),'   # close svg children:[] and svg element
      # Two cards below — no emoji, colored dot as indicator
      'e.jsxs("div",{className:"grid grid-cols-2 gap-3 w-full",children:['
        'e.jsxs(a.div,{initial:{opacity:0,y:8},whileInView:{opacity:1,y:0},'
          'viewport:{once:!0},transition:{delay:1.2},'
          'className:"bg-[#1B2E6D]/5 border border-[#1B2E6D]/20 rounded-xl p-3",children:['
          'e.jsx("div",{className:"w-3 h-3 rounded-full bg-[#1B2E6D] mb-2"}),'
          'e.jsx("h5",{className:"font-bold text-[#1B2E6D] text-xs mb-1",children:"IG Cambridge"}),'
          'e.jsx("p",{className:"text-[10px] text-gray-500 leading-tight",'
            'children:"International academic pathway focused on university preparation and global qualifications."})'
        ']}),'  # close IG card
        'e.jsxs(a.div,{initial:{opacity:0,y:8},whileInView:{opacity:1,y:0},'
          'viewport:{once:!0},transition:{delay:1.5},'
          'className:"bg-[#C1272D]/5 border border-[#C1272D]/20 rounded-xl p-3",children:['
          'e.jsx("div",{className:"w-3 h-3 rounded-full bg-[#C1272D] mb-2"}),'
          'e.jsx("h5",{className:"font-bold text-[#C1272D] text-xs mb-1",children:"American Diploma"}),'
          'e.jsx("p",{className:"text-[10px] text-gray-500 leading-tight",'
            'children:"Applied pathway designed to build real-world skills, critical thinking, and career readiness."})'
        ']})' # close American Diploma card
      ']})' # close grid div
    ']})' # close outer container div
)

if old_section in js:
    js = js.replace(old_section, new_section, 1)
    print("Dual pathway section replaced: OK")
else:
    print("ERROR: old_section not found in file!")
    # Debug
    probe = 'children:"Dual Pathways"'
    if probe in js:
        idx = js.find(probe)
        print(f"  Found 'Dual Pathways' at char {idx}")
    raise SystemExit(1)

# ── 2. CSS: add new keyframes ─────────────────────────────────────────────────

with open(css_path, "r") as f:
    css = f.read()

new_keyframes = (
    "@keyframes dpLeft{from{stroke-dashoffset:230}to{stroke-dashoffset:0}}"
    "@keyframes dpRight{from{stroke-dashoffset:230}to{stroke-dashoffset:0}}"
    "@keyframes dpFade{from{opacity:0}to{opacity:1}}"
)

if "dpLeft" not in css:
    css += "\n" + new_keyframes + "\n"
    with open(css_path, "w") as f:
        f.write(css)
    print("CSS keyframes added: OK")
else:
    print("CSS keyframes already present")

# ── 3. Verify bracket balance ─────────────────────────────────────────────────

ok = True
for o, c in [("(", ")"), ("[", "]"), ("{", "}")]:
    diff = js.count(o) - js.count(c)
    status = "OK" if diff == 0 else f"IMBALANCED ({diff:+d})"
    print(f"  {o}/{c}: {js.count(o)}/{js.count(c)} — {status}")
    if diff != 0:
        ok = False

if not ok:
    print("\nBracket imbalance detected — aborting file write!")
    raise SystemExit(1)

with open(js_path, "w") as f:
    f.write(js)

print("\nJS file written: OK")
print(f"New section length: {len(new_section)} chars (was {len(old_section)})")
