#!/usr/bin/env python3
"""
Clean redesign of Dual Pathways section.
1. Remove old cramped widget from About section (using exact block extraction)
2. Insert proper standalone section before Chairman card
"""

js_path = "src/dashboard/public/algioshy/assets/index-fbf653f9.js"

with open(js_path, "r") as f:
    js = f.read()

assert '\n' in js, "File should have multiple lines"
assert 'Dual Pathways' in js, "File must contain Dual Pathways"

# ── 1. Extract old dp block using exact bracket counting ─────────────────────
START_MARKER = ',e.jsxs("div",{className:"flex items-center gap-4",children:[e.jsx("div",{className:"w-10 h-10 md:w-12 md:h-12 rounded-full bg-[#EEF0F8] flex items-center justify-center shrink-0 shadow-sm"'

idx = js.find(START_MARKER)
assert idx != -1, f"START_MARKER not found"
assert js[:idx].count('\n') == 96, f"Should be on line 97 (0-indexed 96), got line {js[:idx].count(chr(10))+1}"

# Count brackets with entered-flag to find exact end of this block
i = idx
depth = 0
entered = False
while i < len(js):
    ch = js[i]
    if ch in '([{':
        depth += 1; entered = True
    elif ch in ')]}':
        depth -= 1
    if entered and depth == 0:
        block_end = i + 1
        break
    i += 1
else:
    raise RuntimeError("Could not find end of dp block")

old_dp_block = js[idx:block_end]
assert len(old_dp_block) > 100, f"Block too short: {len(old_dp_block)}"
assert old_dp_block.count('(') == old_dp_block.count(')'), "Block parens imbalanced"
assert old_dp_block.count('[') == old_dp_block.count(']'), "Block brackets imbalanced"
assert old_dp_block.count('{') == old_dp_block.count('}'), "Block braces imbalanced"
print(f"1. Old dp block found: {len(old_dp_block)} chars, starting at {idx}: OK")

# ── 2. Build new standalone section ─────────────────────────────────────────
EM = "\u2014"  # em dash

new_dp_section = (
    'e.jsxs("section",{id:"pathways",className:"py-16 md:py-24 px-6 bg-[#F8F9FC]",children:['
      'e.jsx("div",{className:"max-w-[1400px] mx-auto",children:'
        'e.jsxs("div",{className:"flex flex-col items-center",children:['
          # Eyebrow
          'e.jsxs(a.div,{initial:{opacity:0,y:16},whileInView:{opacity:1,y:0},'
            'viewport:{once:!0},transition:{duration:.6},'
            'className:"flex items-center gap-3 mb-4",children:['
            'e.jsx("div",{className:"w-8 h-0.5 bg-[#C1272D]"}),'
            'e.jsx("span",{className:"text-[#C1272D] uppercase tracking-[0.2em] text-xs font-bold",'
              'children:"Academic Pathways"})]}),'
          # Heading
          'e.jsx(a.h2,{initial:{opacity:0,y:16},whileInView:{opacity:1,y:0},'
            'viewport:{once:!0},transition:{duration:.6,delay:.1},'
            'className:"text-3xl sm:text-4xl md:text-5xl font-black text-[#1B2E6D] text-center mb-4",'
            'children:"Dual Pathways"}),'
          # Subtitle
          'e.jsx(a.p,{initial:{opacity:0,y:12},whileInView:{opacity:1,y:0},'
            'viewport:{once:!0},transition:{duration:.6,delay:.15},'
            'className:"text-base md:text-lg text-gray-500 font-medium text-center max-w-2xl mb-10 md:mb-14 leading-relaxed",'
            f'children:"IG (Cambridge International) & American Diploma {EM} two rigorous academic tracks preparing students for top universities worldwide"}}),'
          # SVG wrapper (animated fade-in)
          'e.jsxs(a.div,{initial:{opacity:0},whileInView:{opacity:1},'
            'viewport:{once:!0},transition:{duration:.4,delay:.2},'
            'className:"w-full max-w-xs sm:max-w-sm md:max-w-md mx-auto mb-10 md:mb-14",children:['
            'e.jsxs("svg",{viewBox:"0 0 360 190",className:"w-full h-auto",'
              'xmlns:"http://www.w3.org/2000/svg",children:['
              'e.jsx("circle",{cx:"180",cy:"14",r:"7",fill:"#1B2E6D"}),'
              'e.jsx(a.line,{x1:"180",y1:"21",x2:"180",y2:"66",'
                'stroke:"#1B2E6D",strokeWidth:"3.5",strokeLinecap:"round",'
                'initial:{pathLength:0},whileInView:{pathLength:1},'
                'viewport:{once:!0},transition:{duration:.4,ease:"easeOut",delay:.3}}),'
              'e.jsx(a.path,{d:"M180 66 C180 105 90 128 52 168",'
                'stroke:"#1B2E6D",strokeWidth:"3.5",fill:"none",'
                'strokeLinecap:"round",strokeLinejoin:"round",'
                'initial:{pathLength:0},whileInView:{pathLength:1},'
                'viewport:{once:!0},transition:{duration:1.0,ease:[.33,1,.68,1],delay:.7}}),'
              'e.jsx(a.path,{d:"M180 66 C180 105 270 128 308 168",'
                'stroke:"#C1272D",strokeWidth:"3.5",fill:"none",'
                'strokeLinecap:"round",strokeLinejoin:"round",'
                'initial:{pathLength:0},whileInView:{pathLength:1},'
                'viewport:{once:!0},transition:{duration:1.0,ease:[.33,1,.68,1],delay:1.0}}),'
              'e.jsx(a.circle,{cx:"52",cy:"168",r:"6",fill:"#1B2E6D",'
                'initial:{opacity:0},whileInView:{opacity:1},'
                'viewport:{once:!0},transition:{duration:.3,delay:1.6}}),'
              'e.jsx(a.circle,{cx:"308",cy:"168",r:"6",fill:"#C1272D",'
                'initial:{opacity:0},whileInView:{opacity:1},'
                'viewport:{once:!0},transition:{duration:.3,delay:1.9}}),'
              'e.jsx(a.text,{x:"4",y:"188",fontSize:"12",fill:"#1B2E6D",fontWeight:"700",'
                'initial:{opacity:0},whileInView:{opacity:1},'
                'viewport:{once:!0},transition:{duration:.4,delay:1.7},'
                'children:"IG Cambridge"}),'
              'e.jsx(a.text,{x:"218",y:"188",fontSize:"12",fill:"#C1272D",fontWeight:"700",'
                'initial:{opacity:0},whileInView:{opacity:1},'
                'viewport:{once:!0},transition:{duration:.4,delay:2.0},'
                'children:"American Diploma"})'
            ']})' # close svg children + svg element
          ']}),' # close a.div wrapper + comma
          # Two cards
          'e.jsxs("div",{className:"grid sm:grid-cols-2 gap-6 md:gap-8 w-full max-w-3xl",children:['
            # IG Cambridge card
            'e.jsxs(a.div,{initial:{opacity:0,y:24},whileInView:{opacity:1,y:0},'
              'viewport:{once:!0},transition:{delay:1.4,duration:.5,type:"spring",stiffness:60},'
              'className:"bg-white rounded-2xl p-7 md:p-9 border-t-4 border-[#1B2E6D] '
                'shadow-[0_4px_24px_rgba(27,46,109,.1)] hover:shadow-[0_8px_32px_rgba(27,46,109,.18)] '
                'hover:-translate-y-1 transition-all duration-300",children:['
              'e.jsx("div",{className:"w-10 h-10 rounded-full bg-[#1B2E6D]/10 flex items-center justify-center mb-4",'
                'children:e.jsx("div",{className:"w-4 h-4 rounded-full bg-[#1B2E6D]"})}),'
              'e.jsx("h3",{className:"text-xl md:text-2xl font-black text-[#1B2E6D] mb-3",'
                'children:"IG Cambridge"}),'
              f'e.jsx("p",{{className:"text-sm md:text-base text-gray-500 leading-relaxed",'
                f'children:"International academic track {EM} university preparation & global qualifications."}})'
            ']}),'
            # American Diploma card
            'e.jsxs(a.div,{initial:{opacity:0,y:24},whileInView:{opacity:1,y:0},'
              'viewport:{once:!0},transition:{delay:1.7,duration:.5,type:"spring",stiffness:60},'
              'className:"bg-white rounded-2xl p-7 md:p-9 border-t-4 border-[#C1272D] '
                'shadow-[0_4px_24px_rgba(193,39,45,.08)] hover:shadow-[0_8px_32px_rgba(193,39,45,.16)] '
                'hover:-translate-y-1 transition-all duration-300",children:['
              'e.jsx("div",{className:"w-10 h-10 rounded-full bg-[#C1272D]/10 flex items-center justify-center mb-4",'
                'children:e.jsx("div",{className:"w-4 h-4 rounded-full bg-[#C1272D]"})}),'
              'e.jsx("h3",{className:"text-xl md:text-2xl font-black text-[#C1272D] mb-3",'
                'children:"American Diploma"}),'
              f'e.jsx("p",{{className:"text-sm md:text-base text-gray-500 leading-relaxed",'
                f'children:"Applied track {EM} critical thinking, real-world skills & career readiness."}})'
            ']})' # close American Diploma card
          ']})'  # close grid div
        ']})' # close flex col items-center
      '})' # close max-w div
    ']})'  # close section
)

# Verify new section has no newlines (critical to avoid corrupting file line structure)
assert '\n' not in new_dp_section, "new_dp_section must not contain newlines"
print(f"2. New section built ({len(new_dp_section)} chars): OK")

# ── 3. Apply both changes to JS ──────────────────────────────────────────────

# Step A: Remove old dp block (replacing with empty string)
assert js.count(old_dp_block) == 1, "old_dp_block must appear exactly once"
js = js.replace(old_dp_block, '', 1)
print("3. Old dp block removed: OK")

# Step B: Insert new section before chairman section
CHAIRMAN_ANCHOR = 'e.jsx("section",{className:"py-20 md:py-32 px-4 sm:px-6 max-w-[1400px] mx-auto bg-white"'
assert CHAIRMAN_ANCHOR in js, "Chairman anchor not found"
js = js.replace(CHAIRMAN_ANCHOR, new_dp_section + ',' + CHAIRMAN_ANCHOR, 1)
print("4. New section inserted before chairman: OK")

# ── 4. Verify ────────────────────────────────────────────────────────────────
for o, c in [('(', ')'), ('[', ']'), ('{', '}')]:
    diff = js.count(o) - js.count(c)
    status = "OK" if diff == 0 else f"IMBALANCED ({diff:+d})"
    print(f"  {o}/{c}: {js.count(o)}/{js.count(c)} — {status}")
    assert diff == 0, f"Bracket imbalance in {o}/{c}"

with open(js_path, 'w') as f:
    f.write(js)

print("\nDone — JS written OK")
