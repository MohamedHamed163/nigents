#!/usr/bin/env python3
"""
Fix dual pathway: replace CSS page-load animations with Framer Motion
whileInView + pathLength so they only trigger when scrolled into view.
"""

js_path = "src/dashboard/public/algioshy/assets/index-fbf653f9.js"

with open(js_path, "r") as f:
    js = f.read()

# ── Old SVG block (CSS animation, fires on page mount) ────────────────────────
old_svg = (
    'e.jsxs("svg",{viewBox:"0 0 320 170",className:"w-full h-auto mx-auto block mb-4",'
    'xmlns:"http://www.w3.org/2000/svg",children:['
    'e.jsx("circle",{cx:"160",cy:"14",r:"6",fill:"#1B2E6D"}),'
    'e.jsx("line",{x1:"160",y1:"20",x2:"160",y2:"58",stroke:"#1B2E6D",strokeWidth:"3",'
    'strokeLinecap:"round",style:{strokeDasharray:"40",strokeDashoffset:"40",'
    'animation:"dpStem 0.4s ease-out 0.1s forwards"}}),'
    'e.jsx("path",{d:"M160 58 C160 90 80 110 55 148",stroke:"#1B2E6D",strokeWidth:"3",'
    'fill:"none",strokeLinecap:"round",strokeLinejoin:"round",'
    'style:{strokeDasharray:"200",strokeDashoffset:"200",'
    'animation:"dpWire 0.9s cubic-bezier(.33,1,.68,1) 0.5s forwards"}}),'
    'e.jsx("path",{d:"M160 58 C160 90 240 110 265 148",stroke:"#C1272D",strokeWidth:"3",'
    'fill:"none",strokeLinecap:"round",strokeLinejoin:"round",'
    'style:{strokeDasharray:"200",strokeDashoffset:"200",'
    'animation:"dpWire 0.9s cubic-bezier(.33,1,.68,1) 0.8s forwards"}}),'
    'e.jsx("circle",{cx:"55",cy:"148",r:"5",fill:"#1B2E6D",'
    'style:{opacity:"0",animation:"dpFade 0.3s ease-out 1.3s forwards"}}),'
    'e.jsx("circle",{cx:"265",cy:"148",r:"5",fill:"#C1272D",'
    'style:{opacity:"0",animation:"dpFade 0.3s ease-out 1.6s forwards"}}),'
    'e.jsx("text",{x:"20",y:"168",fontSize:"10",fill:"#1B2E6D",fontWeight:"700",'
    'style:{opacity:"0",animation:"dpFade 0.4s ease-out 1.4s forwards"},children:"IG Cambridge"}),'
    'e.jsx("text",{x:"185",y:"168",fontSize:"10",fill:"#C1272D",fontWeight:"700",'
    'style:{opacity:"0",animation:"dpFade 0.4s ease-out 1.7s forwards"},children:"Amer. Diploma"})'
    ']})'
)

# ── New SVG block (Framer Motion whileInView + pathLength) ────────────────────
# a.line / a.path / a.circle = motion.line / motion.path / motion.circle
# pathLength 0→1 triggers stroke-dashoffset animation natively in Framer Motion
# viewport:{once:!0} ensures it fires once when scrolled into view, not on mount
new_svg = (
    'e.jsxs("svg",{viewBox:"0 0 320 170",className:"w-full h-auto mx-auto block mb-4",'
    'xmlns:"http://www.w3.org/2000/svg",children:['
    # Static entry dot at top
    'e.jsx("circle",{cx:"160",cy:"14",r:"6",fill:"#1B2E6D"}),'
    # Stem — motion.line, pathLength 0→1 on scroll
    'e.jsx(a.line,{x1:"160",y1:"20",x2:"160",y2:"58",'
    'stroke:"#1B2E6D",strokeWidth:"3",strokeLinecap:"round",'
    'initial:{pathLength:0},whileInView:{pathLength:1},'
    'viewport:{once:!0},transition:{duration:0.4,ease:"easeOut",delay:0.1}}),'
    # Left wire — motion.path
    'e.jsx(a.path,{d:"M160 58 C160 90 80 110 55 148",'
    'stroke:"#1B2E6D",strokeWidth:"3",fill:"none",'
    'strokeLinecap:"round",strokeLinejoin:"round",'
    'initial:{pathLength:0},whileInView:{pathLength:1},'
    'viewport:{once:!0},transition:{duration:0.9,ease:[.33,1,.68,1],delay:0.5}}),'
    # Right wire — motion.path
    'e.jsx(a.path,{d:"M160 58 C160 90 240 110 265 148",'
    'stroke:"#C1272D",strokeWidth:"3",fill:"none",'
    'strokeLinecap:"round",strokeLinejoin:"round",'
    'initial:{pathLength:0},whileInView:{pathLength:1},'
    'viewport:{once:!0},transition:{duration:0.9,ease:[.33,1,.68,1],delay:0.8}}),'
    # Left endpoint dot — motion.circle opacity fade
    'e.jsx(a.circle,{cx:"55",cy:"148",r:"5",fill:"#1B2E6D",'
    'initial:{opacity:0},whileInView:{opacity:1},'
    'viewport:{once:!0},transition:{duration:0.3,delay:1.3}}),'
    # Right endpoint dot
    'e.jsx(a.circle,{cx:"265",cy:"148",r:"5",fill:"#C1272D",'
    'initial:{opacity:0},whileInView:{opacity:1},'
    'viewport:{once:!0},transition:{duration:0.3,delay:1.6}}),'
    # Left text label
    'e.jsx(a.text,{x:"20",y:"168",fontSize:"10",fill:"#1B2E6D",fontWeight:"700",'
    'initial:{opacity:0},whileInView:{opacity:1},'
    'viewport:{once:!0},transition:{duration:0.4,delay:1.4},children:"IG Cambridge"}),'
    # Right text label
    'e.jsx(a.text,{x:"185",y:"168",fontSize:"10",fill:"#C1272D",fontWeight:"700",'
    'initial:{opacity:0},whileInView:{opacity:1},'
    'viewport:{once:!0},transition:{duration:0.4,delay:1.7},children:"Amer. Diploma"})'
    ']})'
)

if old_svg in js:
    js = js.replace(old_svg, new_svg, 1)
    print("Dual pathway SVG: scroll-triggered animation applied OK")
else:
    print("ERROR: old_svg not found!")
    # Debug probe
    probe = 'dpStem 0.4s ease-out'
    if probe in js:
        idx = js.find(probe)
        print(f"  Found probe at {idx}")
    raise SystemExit(1)

# ── Bracket balance check ─────────────────────────────────────────────────────
ok = True
for o, c in [("(", ")"), ("[", "]"), ("{", "}")]:
    diff = js.count(o) - js.count(c)
    status = "OK" if diff == 0 else f"IMBALANCED ({diff:+d})"
    print(f"  {o}/{c}: {js.count(o)}/{js.count(c)} — {status}")
    if diff != 0:
        ok = False

if not ok:
    print("Bracket imbalance — aborting!")
    raise SystemExit(1)

with open(js_path, "w") as f:
    f.write(js)

print("\nJS file written OK")
