#!/usr/bin/env python3
"""
Three changes:
  1. Remove red stats bar (bg-[#C1272D] section after hero)
  2. Improve dual-pathway SVG — smoother cubic-bezier wires, top→down fork
  3. Why Choose Us — remove emoji icons, new card design with animations
"""

JS  = "src/dashboard/public/algioshy/assets/index-fbf653f9.js"
CSS = "src/dashboard/public/algioshy/assets/index-i6CxoHev.css"

with open(JS) as f:
    js = f.read()

original = js
changes = 0

# ══════════════════════════════════════════════════════════════════════════════
# 1. REMOVE RED STATS BAR
# ══════════════════════════════════════════════════════════════════════════════
old_stats = (
    'e.jsx("section",{className:"bg-[#C1272D] text-white relative z-20",'
    'children:e.jsx("div",{className:"max-w-[1400px] mx-auto px-6 py-10 md:py-16",'
    'children:e.jsx("div",{className:"grid grid-cols-2 md:grid-cols-4 gap-y-10 md:gap-y-0'
    ' gap-x-4 divide-x divide-white/20",children:Ae.map((s,m)=>e.jsxs(a.div,{'
    'initial:{opacity:0,y:20},whileInView:{opacity:1,y:0},viewport:{once:!0},'
    'transition:{delay:m*.1},className:"flex flex-col items-center justify-center'
    ' text-center px-4 first:pl-0",children:[e.jsx("div",{className:"text-4xl md:'
    'text-5xl font-black text-white mb-1",children:s.value}),e.jsx("div",'
    '{className:"text-[10px] md:text-xs uppercase tracking-widest font-medium'
    ' text-white/90",children:s.label})]},m))})})}'
)
if old_stats in js:
    js = js.replace(old_stats, '', 1)
    changes += 1
    print("1. Red stats bar removed: OK")
else:
    print("1. Red stats bar: NOT FOUND (trying shorter key)")
    # try shorter unique key
    short = (
        'e.jsx("section",{className:"bg-[#C1272D] text-white relative z-20",'
        'children:e.jsx("div",{className:"max-w-[1400px] mx-auto px-6 py-10 md:py-16"'
    )
    if short in js:
        # find full extent
        idx = js.find(short)
        # trace to find matching close
        depth = 0
        in_s = None
        i = idx
        while i < len(js):
            c = js[i]
            if in_s:
                if c == '\\': i += 2; continue
                if c == in_s: in_s = None
            elif c in '"\'`': in_s = c
            elif c in '({[': depth += 1
            elif c in ')}]':
                depth -= 1
                if depth == 0:
                    js = js[:idx] + js[i+1:]
                    changes += 1
                    print("  Removed with bracket-trace: OK")
                    break
            i += 1
    else:
        print("  Short key also not found — skipping")

# ══════════════════════════════════════════════════════════════════════════════
# 2. IMPROVE DUAL PATHWAY SVG  (replace the svg + cards block)
# ══════════════════════════════════════════════════════════════════════════════
old_dp = (
    'e.jsxs("div",{children:['
    'e.jsx("h4",{className:"font-bold text-[#1B2E6D] text-sm md:text-base mb-2",'
    'children:"Dual Pathways"}),'
    'e.jsx("p",{className:"text-xs md:text-sm text-gray-500 font-medium mb-3",'
    'children:"IG (Cambridge International) & American Diploma \u2014 two rigorous'
    ' academic tracks preparing students for top universities worldwide"}),'
    'e.jsxs("svg",{viewBox:"0 0 300 150",className:"w-full h-auto max-w-[320px]'
    ' sm:max-w-full mx-auto block mb-3",xmlns:"http://www.w3.org/2000/svg",children:['
    'e.jsx("path",{d:"M150 12 L150 62 Q148 88 108 105 L58 138",'
    'stroke:"#1B2E6D",strokeWidth:"3.5",fill:"none",'
    'strokeLinecap:"round",strokeLinejoin:"round",'
    'style:{strokeDasharray:"230",strokeDashoffset:"230",'
    'animation:"dpLeft 1.1s cubic-bezier(.4,0,.2,1) 0.2s forwards"}}),'
    'e.jsx("path",{d:"M150 12 L150 62 Q152 88 192 105 L242 138",'
    'stroke:"#C1272D",strokeWidth:"3.5",fill:"none",'
    'strokeLinecap:"round",strokeLinejoin:"round",'
    'style:{strokeDasharray:"230",strokeDashoffset:"230",'
    'animation:"dpRight 1.1s cubic-bezier(.4,0,.2,1) 0.5s forwards"}}),'
    'e.jsx("circle",{cx:"150",cy:"12",r:"6",fill:"#1B2E6D"}),'
    'e.jsx("circle",{cx:"58",cy:"138",r:"5",fill:"#1B2E6D",'
    'style:{opacity:"0",animation:"dpFade 0.3s ease-out 1.1s forwards"}}),'
    'e.jsx("circle",{cx:"242",cy:"138",r:"5",fill:"#C1272D",'
    'style:{opacity:"0",animation:"dpFade 0.3s ease-out 1.4s forwards"}})'
    ']}),'
    'e.jsxs("div",{className:"grid grid-cols-2 gap-3 w-full",children:['
    'e.jsxs(a.div,{initial:{opacity:0,y:8},whileInView:{opacity:1,y:0},'
    'viewport:{once:!0},transition:{delay:1.2},'
    'className:"bg-[#1B2E6D]/5 border border-[#1B2E6D]/20 rounded-xl p-3",children:['
    'e.jsx("div",{className:"w-3 h-3 rounded-full bg-[#1B2E6D] mb-2"}),'
    'e.jsx("h5",{className:"font-bold text-[#1B2E6D] text-xs mb-1",children:"IG Cambridge"}),'
    'e.jsx("p",{className:"text-[10px] text-gray-500 leading-tight",'
    'children:"International academic pathway focused on university preparation and global qualifications."})'
    ']}),'
    'e.jsxs(a.div,{initial:{opacity:0,y:8},whileInView:{opacity:1,y:0},'
    'viewport:{once:!0},transition:{delay:1.5},'
    'className:"bg-[#C1272D]/5 border border-[#C1272D]/20 rounded-xl p-3",children:['
    'e.jsx("div",{className:"w-3 h-3 rounded-full bg-[#C1272D] mb-2"}),'
    'e.jsx("h5",{className:"font-bold text-[#C1272D] text-xs mb-1",children:"American Diploma"}),'
    'e.jsx("p",{className:"text-[10px] text-gray-500 leading-tight",'
    'children:"Applied pathway designed to build real-world skills, critical thinking, and career readiness."})'
    ']})]})]})'
)

# New dual pathway: cubic-bezier curves for smoother wires, cleaner design
new_dp = (
    'e.jsxs("div",{children:['
      'e.jsx("h4",{className:"font-bold text-[#1B2E6D] text-sm md:text-base mb-2",'
        'children:"Dual Pathways"}),'
      'e.jsx("p",{className:"text-xs md:text-sm text-gray-500 font-medium mb-4",'
        'children:"IG (Cambridge International) & American Diploma \u2014 two rigorous academic tracks preparing students for top universities worldwide"}),'
      # SVG: 320×170, cubic-bezier curves, animated wire drawing
      'e.jsxs("svg",{viewBox:"0 0 320 170",className:"w-full h-auto mx-auto block mb-4",'
        'xmlns:"http://www.w3.org/2000/svg",children:['
          # Entry circle — top centre
          'e.jsx("circle",{cx:"160",cy:"14",r:"6",fill:"#1B2E6D"}),'
          # Short vertical stem (shared by both paths)
          'e.jsx("line",{x1:"160",y1:"20",x2:"160",y2:"58",'
            'stroke:"#1B2E6D",strokeWidth:"3",strokeLinecap:"round",'
            'style:{strokeDasharray:"40",strokeDashoffset:"40",'
              'animation:"dpStem 0.4s ease-out 0.1s forwards"}}),'
          # Left wire: cubic bezier — stem end → curves to bottom-left
          # C cx1 cy1, cx2 cy2, x y
          'e.jsx("path",{d:"M160 58 C160 90 80 110 55 148",'
            'stroke:"#1B2E6D",strokeWidth:"3",fill:"none",'
            'strokeLinecap:"round",strokeLinejoin:"round",'
            'style:{strokeDasharray:"200",strokeDashoffset:"200",'
              'animation:"dpWire 0.9s cubic-bezier(.33,1,.68,1) 0.5s forwards"}}),'
          # Right wire: cubic bezier — stem end → curves to bottom-right
          'e.jsx("path",{d:"M160 58 C160 90 240 110 265 148",'
            'stroke:"#C1272D",strokeWidth:"3",fill:"none",'
            'strokeLinecap:"round",strokeLinejoin:"round",'
            'style:{strokeDasharray:"200",strokeDashoffset:"200",'
              'animation:"dpWire 0.9s cubic-bezier(.33,1,.68,1) 0.8s forwards"}}),'
          # Left endpoint circle
          'e.jsx("circle",{cx:"55",cy:"148",r:"5",fill:"#1B2E6D",'
            'style:{opacity:"0",animation:"dpFade 0.3s ease-out 1.3s forwards"}}),'
          # Right endpoint circle
          'e.jsx("circle",{cx:"265",cy:"148",r:"5",fill:"#C1272D",'
            'style:{opacity:"0",animation:"dpFade 0.3s ease-out 1.6s forwards"}}),'
          # Left label inside SVG
          'e.jsx("text",{x:"20",y:"168",fontSize:"10",fill:"#1B2E6D",fontWeight:"700",'
            'style:{opacity:"0",animation:"dpFade 0.4s ease-out 1.4s forwards"},'
            'children:"IG Cambridge"}),'
          # Right label inside SVG
          'e.jsx("text",{x:"185",y:"168",fontSize:"10",fill:"#C1272D",fontWeight:"700",'
            'style:{opacity:"0",animation:"dpFade 0.4s ease-out 1.7s forwards"},'
            'children:"Amer. Diploma"})'
        ']}),'
      # Two cards — colored left-border style, no emoji
      'e.jsxs("div",{className:"grid grid-cols-2 gap-3 w-full",children:['
        'e.jsxs(a.div,{initial:{opacity:0,y:10},whileInView:{opacity:1,y:0},'
          'viewport:{once:!0},transition:{delay:1.4},'
          'className:"border-l-2 border-[#1B2E6D] pl-3 py-1",children:['
          'e.jsx("h5",{className:"font-bold text-[#1B2E6D] text-xs mb-1",children:"IG Cambridge"}),'
          'e.jsx("p",{className:"text-[10px] text-gray-500 leading-snug",'
            'children:"International academic track — university preparation & global qualifications."})'
        ']}),'
        'e.jsxs(a.div,{initial:{opacity:0,y:10},whileInView:{opacity:1,y:0},'
          'viewport:{once:!0},transition:{delay:1.7},'
          'className:"border-l-2 border-[#C1272D] pl-3 py-1",children:['
          'e.jsx("h5",{className:"font-bold text-[#C1272D] text-xs mb-1",children:"American Diploma"}),'
          'e.jsx("p",{className:"text-[10px] text-gray-500 leading-snug",'
            'children:"Applied track — critical thinking, real-world skills & career readiness."})'
        ']})'
      ']})'
    ']})'
)

if old_dp in js:
    js = js.replace(old_dp, new_dp, 1)
    changes += 1
    print("2. Dual pathway SVG improved: OK")
else:
    print("2. Dual pathway: NOT FOUND — check old_dp string")

# ══════════════════════════════════════════════════════════════════════════════
# 3. WHY CHOOSE US — new card design, no emoji
# ══════════════════════════════════════════════════════════════════════════════
old_why = (
    'e.jsxs("section",{id:"why-choose-us",className:"py-24 md:py-32 px-6 max-w-[1400px]'
    ' mx-auto bg-white",children:[e.jsx("h2",{className:"text-3xl md:text-4xl font-black'
    ' text-[#1B2E6D] text-center mb-4",children:"Why Choose Smart College?"}),'
    'e.jsx("p",{className:"text-gray-500 text-center max-w-2xl mx-auto mb-12 text-sm'
    ' md:text-base",children:"A school defined by academic rigour, character development,'
    ' and a commitment to preparing students for the world\\u2019s best universities."}),'
    'e.jsxs("div",{className:"grid sm:grid-cols-2 lg:grid-cols-3 gap-8",children:['
    'e.jsxs(a.div,{initial:{opacity:0,y:20},whileInView:{opacity:1,y:0},viewport:{once:!0},'
    'className:"bg-[#F8F9FC] rounded-2xl p-8 text-center",children:[e.jsx("div",'
    '{className:"w-14 h-14 mx-auto mb-4 rounded-full bg-[#C1272D]/10 flex items-center'
    ' justify-center text-2xl",children:"\\ud83c\\udfaf"}),e.jsx("h3",{className:"font-bold'
    ' text-[#1B2E6D] mb-2",children:"Academic Excellence"}),e.jsx("p",{className:"text-gray-500'
    ' text-sm",children:"Dual pathways \\u2014 IG Cambridge & American Diploma \\u2014'
    ' rigorous curricula preparing students for top global universities."})]}),e.jsxs(a.div,'
    '{initial:{opacity:0,y:20},whileInView:{opacity:1,y:0},viewport:{once:!0},className:'
    '"bg-[#F8F9FC] rounded-2xl p-8 text-center",children:[e.jsx("div",{className:"w-14'
    ' h-14 mx-auto mb-4 rounded-full bg-[#C1272D]/10 flex items-center justify-center'
    ' text-2xl",children:"\\ud83e\\udd1d"}),e.jsx("h3",{className:"font-bold text-[#1B2E6D]'
    ' mb-2",children:"Character & Integrity"}),e.jsx("p",{className:"text-gray-500 text-sm",'
    'children:"We build principled leaders \\u2014 students who combine knowledge with'
    ' responsibility, creativity with discipline."})]}),e.jsxs(a.div,{initial:{opacity:0,'
    'y:20},whileInView:{opacity:1,y:0},viewport:{once:!0},className:"bg-[#F8F9FC]'
    ' rounded-2xl p-8 text-center",children:[e.jsx("div",{className:"w-14 h-14 mx-auto'
    ' mb-4 rounded-full bg-[#C1272D]/10 flex items-center justify-center text-2xl",'
    'children:"\\ud83c\\udf0d"}),e.jsx("h3",{className:"font-bold text-[#1B2E6D] mb-2",'
    'children:"Global Pathways"}),e.jsx("p",{className:"text-gray-500 text-sm",children:'
    '"International standards with local values \\u2014 students graduate ready for'
    ' universities in the UK, US, Canada, and beyond."})]}),e.jsxs(a.div,{initial:{opacity:0,'
    'y:20},whileInView:{opacity:1,y:0},viewport:{once:!0},className:"bg-[#F8F9FC] rounded-2xl'
    ' p-8 text-center",children:[e.jsx("div",{className:"w-14 h-14 mx-auto mb-4 rounded-full'
    ' bg-[#C1272D]/10 flex items-center justify-center text-2xl",children:"\\ud83c\\udfeb"}),'
    'e.jsx("h3",{className:"font-bold text-[#1B2E6D] mb-2",children:"Expert Faculty"}),'
    'e.jsx("p",{className:"text-gray-500 text-sm",children:"Experienced educators passionate'
    ' about their subjects and dedicated to each student\\u2019s individual growth and'
    ' success."})]}),e.jsxs(a.div,{initial:{opacity:0,y:20},whileInView:{opacity:1,y:0},'
    'viewport:{once:!0},className:"bg-[#F8F9FC] rounded-2xl p-8 text-center",children:['
    'e.jsx("div",{className:"w-14 h-14 mx-auto mb-4 rounded-full bg-[#C1272D]/10 flex'
    ' items-center justify-center text-2xl",children:"\\ud83d\\ude95"}),e.jsx("h3",'
    '{className:"font-bold text-[#1B2E6D] mb-2",children:"School Transportation"}),'
    'e.jsx("p",{className:"text-gray-500 text-sm",children:"Smart College provides safe'
    ' and reliable bus transportation across Cairo \\u2014 ensuring students arrive on time'
    ' and return home safely every day."})]}),e.jsxs(a.div,{initial:{opacity:0,y:20},'
    'whileInView:{opacity:1,y:0},viewport:{once:!0},className:"bg-[#F8F9FC] rounded-2xl'
    ' p-8 text-center",children:[e.jsx("div",{className:"w-14 h-14 mx-auto mb-4 rounded-full'
    ' bg-[#C1272D]/10 flex items-center justify-center text-2xl",children:"\\ud83c\\udfc6"}),'
    'e.jsx("h3",{className:"font-bold text-[#1B2E6D] mb-2",children:"Proven Results"}),'
    'e.jsx("p",{className:"text-gray-500 text-sm",children:"Our graduates consistently earn'
    ' places at the world\\u2019s leading universities \\u2014 a record of achievement built'
    ' year after year."})]})]})]})'
)

# Helper: build one Why Choose card
# accent: 'navy' | 'red'  — alternates for visual rhythm
# num: '01'–'06'
# title: string  desc: string  delay: float  accent_color: '#1B2E6D' | '#C1272D'
def card(num, title, desc, delay, accent):
    light = "#EEF0F8" if accent == "#1B2E6D" else "#FDF1F1"
    return (
        f'e.jsxs(a.div,{{initial:{{opacity:0,y:30}},whileInView:{{opacity:1,y:0}},'
        f'viewport:{{once:!0,margin:"-60px"}},transition:{{delay:{delay},duration:0.5,type:"spring",stiffness:60}},'
        f'className:"group relative bg-white rounded-2xl p-7 shadow-[0_2px_16px_rgba(0,0,0,.07)]'
        f' border border-gray-100 hover:shadow-[0_8px_32px_rgba(0,0,0,.12)]'
        f' hover:-translate-y-1 transition-all duration-300 overflow-hidden",children:['
          # Accent bar top
          f'e.jsx("div",{{className:"absolute top-0 left-0 right-0 h-[3px]",'
            f'style:{{background:"{accent}"}}}}),'
          # Number badge
          f'e.jsx("div",{{className:"inline-flex items-center justify-center w-9 h-9 rounded-full mb-5 text-xs font-black tracking-wider",'
            f'style:{{background:"{light}",color:"{accent}"}},children:"{num}"}})'
          ','
          # Title
          f'e.jsx("h3",{{className:"font-bold text-[#1B2E6D] text-base mb-3 leading-tight",children:"{title}"}})'
          ','
          # Desc
          f'e.jsx("p",{{className:"text-gray-500 text-sm leading-relaxed",children:"{desc}"}})'
        f']}}'
        f')'
    )

cards_data = [
    ("01", "Academic Excellence",
     "Dual pathways \u2014 IG Cambridge & American Diploma \u2014 rigorous curricula preparing students for top global universities.",
     0.0, "#1B2E6D"),
    ("02", "Character & Integrity",
     "We build principled leaders \u2014 students who combine knowledge with responsibility, creativity with discipline.",
     0.1, "#C1272D"),
    ("03", "Global Pathways",
     "International standards with local values \u2014 students graduate ready for universities in the UK, US, Canada, and beyond.",
     0.2, "#1B2E6D"),
    ("04", "Expert Faculty",
     "Experienced educators passionate about their subjects and dedicated to each student\u2019s individual growth and success.",
     0.3, "#C1272D"),
    ("05", "School Transportation",
     "Smart College provides safe and reliable bus transportation across Cairo \u2014 ensuring students arrive on time and return home safely every day.",
     0.4, "#1B2E6D"),
    ("06", "Proven Results",
     "Our graduates consistently earn places at the world\u2019s leading universities \u2014 a record of achievement built year after year.",
     0.5, "#C1272D"),
]

cards_str = ",".join(card(*d) for d in cards_data)

new_why = (
    'e.jsxs("section",{id:"why-choose-us",'
    'className:"py-24 md:py-32 px-6 max-w-[1400px] mx-auto bg-white",children:['
      # Heading
      'e.jsxs("div",{className:"text-center mb-14",children:['
        'e.jsx("span",{className:"inline-block text-[#C1272D] text-xs font-bold uppercase tracking-[0.2em] mb-3",children:"Why Smart College"}),'
        'e.jsx("h2",{className:"text-3xl md:text-4xl lg:text-5xl font-black text-[#1B2E6D] mb-4",children:"Why Choose Smart College?"}),'
        'e.jsx("p",{className:"text-gray-500 max-w-2xl mx-auto text-sm md:text-base leading-relaxed",'
          'children:"A school defined by academic rigour, character development, and a commitment to preparing students for the world\u2019s best universities."})'
      ']}),'
      # Cards grid
      f'e.jsxs("div",{{className:"grid sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8",children:[{cards_str}]}}'
      ')'
    ']})'
)

if old_why in js:
    js = js.replace(old_why, new_why, 1)
    changes += 1
    print("3. Why Choose Us rebuilt: OK")
else:
    print("3. Why Choose Us: NOT FOUND (will try without inner spaces)")
    # try to find it more simply
    probe = 'id:"why-choose-us"'
    if probe in js:
        print(f"   Found id probe at char {js.find(probe)}")
    else:
        print("   id not found either")

# ══════════════════════════════════════════════════════════════════════════════
# 4. CSS — add dpStem and dpWire keyframes
# ══════════════════════════════════════════════════════════════════════════════
with open(CSS) as f:
    css = f.read()

new_css = (
    "@keyframes dpStem{from{stroke-dashoffset:40}to{stroke-dashoffset:0}}"
    "@keyframes dpWire{from{stroke-dashoffset:200}to{stroke-dashoffset:0}}"
)
if "dpStem" not in css:
    css += "\n" + new_css + "\n"
    with open(CSS, "w") as f:
        f.write(css)
    print("4. CSS dpStem/dpWire keyframes added: OK")
else:
    print("4. CSS keyframes already present")

# ══════════════════════════════════════════════════════════════════════════════
# 5. Verify brackets
# ══════════════════════════════════════════════════════════════════════════════
ok = True
for o, c in [("(", ")"), ("[", "]"), ("{", "}")]:
    diff = js.count(o) - js.count(c)
    status = "OK" if diff == 0 else f"IMBALANCED ({diff:+d})"
    print(f"  {o}/{c}: {js.count(o)}/{js.count(c)} — {status}")
    if diff != 0:
        ok = False

if not ok:
    print("\nIMBALANCE — aborting!")
    raise SystemExit(1)

with open(JS, "w") as f:
    f.write(js)

print(f"\nDone — {changes}/3 changes applied")
