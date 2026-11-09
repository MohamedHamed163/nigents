#!/usr/bin/env python3
"""Apply remaining AlGioshy edits: chairman text update, dual pathway animation, academics enrichment."""

filepath = "src/dashboard/public/algioshy/assets/index-fbf653f9.js"

with open(filepath, "r") as f:
    content = f.read()

original = content
changes = 0

# 1. Replace Chairman's Message with new text from client
old_chairman = (
    "At Smart College, we believe education shapes not just careers, but character. "
    "Our mission is to nurture principled leaders who combine academic excellence with "
    "integrity, creativity, and a sense of responsibility toward their community. "
    "We have built an institution where every student is challenged, supported, and "
    "inspired to reach their full potential. Welcome to a school that truly cares "
    "about your child\u2019s future."
)
new_chairman = (
    "At this critical stage of education, the right environment shapes not only "
    "academic success, but the future of each student. At Smart College, we go "
    "beyond curriculum \u2014 we develop confident, disciplined, and forward-thinking "
    "individuals ready for university and beyond. Our focus is on excellence, "
    "critical thinking, and real-world readiness. We are committed to guiding "
    "every student through these pivotal years with purpose, support, and high "
    "standards. We welcome you to be part of a school that stands for ambition, "
    "integrity, and excellence."
)
if old_chairman in content:
    content = content.replace(old_chairman, new_chairman, 1)
    changes += 1
    print("1. Chairman message updated: DONE")
else:
    print("1. Chairman message: NOT FOUND")

# 2. Replace Dual Pathways section with animated splitting roads design
old_dual = (
    'e.jsx("h4",{className:"font-bold text-[#1B2E6D] text-sm md:text-base",'
    'children:"Dual Pathways"}),'
    'e.jsx("p",{className:"text-xs md:text-sm text-gray-500 font-medium",'
    'children:"IG (Cambridge International) & American Diploma -- two rigorous '
    'academic tracks preparing students for top universities worldwide"})'
)
# New dual pathway with animated two-road split SVG + descriptions
new_dual = (
    'e.jsx("h4",{className:"font-bold text-[#1B2E6D] text-sm md:text-base mb-3",'
    'children:"Dual Pathways"}),'
    'e.jsx("p",{className:"text-xs md:text-sm text-gray-500 font-medium mb-4",'
    'children:"We offer a flexible dual pathway system that allows students to choose '
    'between an academic route focused on university preparation, and an applied pathway '
    'designed to build real-world skills and career readiness."}),'
    # Animated road split container
    'e.jsxs("div",{className:"relative flex flex-col items-center py-4",children:['
    # SVG splitting road
    'e.jsx("div",{className:"w-full flex justify-center mb-4",children:'
    'e.jsxs("svg",{viewBox:"0 0 300 120",className:"w-full max-w-[280px] h-auto",children:['
    'e.jsx("path",{d:"M150 110 L150 60 Q150 40 130 30 L60 5",'
    'stroke:"#1B2E6D",strokeWidth:"4",fill:"none",strokeLinecap:"round",'
    'className:"animate-pulse",style:{animation:"drawPath 2s ease-in-out infinite alternate"}}),'
    'e.jsx("path",{d:"M150 110 L150 60 Q150 40 170 30 L240 5",'
    'stroke:"#C1272D",strokeWidth:"4",fill:"none",strokeLinecap:"round",'
    'className:"animate-pulse",style:{animation:"drawPath 2s ease-in-out infinite alternate",animationDelay:"0.5s"}}),'
    'e.jsx("circle",{cx:"150",cy:"110",r:"5",fill:"#1B2E6D"}),'
    'e.jsx("circle",{cx:"60",cy:"5",r:"5",fill:"#1B2E6D"}),'
    'e.jsx("circle",{cx:"240",cy:"5",r:"5",fill:"#C1272D"})'
    ']})}),'
    # Two pathway cards side by side
    'e.jsxs("div",{className:"grid grid-cols-2 gap-3 w-full",children:['
    'e.jsxs(a.div,{initial:{opacity:0,x:-20},whileInView:{opacity:1,x:0},'
    'viewport:{once:!0},transition:{delay:0.3},'
    'className:"bg-[#1B2E6D]/5 border border-[#1B2E6D]/20 rounded-xl p-3 text-center",children:['
    'e.jsx("div",{className:"text-lg mb-1",children:"\\ud83c\\udf93"}),'
    'e.jsx("h5",{className:"font-bold text-[#1B2E6D] text-xs mb-1",children:"IG Cambridge"}),'
    'e.jsx("p",{className:"text-[10px] text-gray-500 leading-tight",'
    'children:"International academic pathway focused on university preparation and global qualifications."})'
    ']}),'
    'e.jsxs(a.div,{initial:{opacity:0,x:20},whileInView:{opacity:1,x:0},'
    'viewport:{once:!0},transition:{delay:0.5},'
    'className:"bg-[#C1272D]/5 border border-[#C1272D]/20 rounded-xl p-3 text-center",children:['
    'e.jsx("div",{className:"text-lg mb-1",children:"\\ud83d\\udcbc"}),'
    'e.jsx("h5",{className:"font-bold text-[#C1272D] text-xs mb-1",children:"American Diploma"}),'
    'e.jsx("p",{className:"text-[10px] text-gray-500 leading-tight",'
    'children:"Applied pathway designed to build real-world skills, critical thinking, and career readiness."})'
    ']})'
    ']})'
    ']})'
)
if old_dual in content:
    content = content.replace(old_dual, new_dual, 1)
    changes += 1
    print("2. Dual Pathways animated roads: DONE")
else:
    print("2. Dual Pathways: NOT FOUND - trying partial match")
    # Try simpler match
    simple_old = 'children:"IG (Cambridge International) & American Diploma -- two rigorous academic tracks preparing students for top universities worldwide"'
    if simple_old in content:
        print("   Found simpler match, applying...")
        simple_new = (
            'children:"We offer a flexible dual pathway system that allows students to choose '
            'between an academic route focused on university preparation, and an applied pathway '
            'designed to build real-world skills and career readiness."'
        )
        content = content.replace(simple_old, simple_new, 1)
        changes += 1
        print("2b. Dual Pathways text updated: DONE")

# 3. Enrich academics section - find existing academics content and expand
old_academics_heading = 'children:"Academic Programmes"'
if old_academics_heading in content:
    print("3. Academics section found")
else:
    print("3. Academics heading not found, checking alternatives...")

# Look for the academics section subtitle and enrich it
old_acad_desc = 'children:"Shaping future leaders through excellence in education, character development, and global perspective."'
new_acad_desc = 'children:"Shaping future leaders through a comprehensive curriculum spanning Sciences, Mathematics, English Language & Literature, Arabic Studies, Social Sciences, ICT, and the Arts. Our teaching approach emphasises critical thinking, project-based learning, and continuous assessment to ensure every student reaches their full potential."'
if old_acad_desc in content:
    content = content.replace(old_acad_desc, new_acad_desc, 1)
    changes += 1
    print("3. Academics description enriched: DONE")
else:
    print("3. Academics description: NOT FOUND")

# 4. Add CSS animation for the road paths (inject into the page via style tag in the HTML)
css_filepath = "src/dashboard/public/algioshy/assets/index-i6CxoHev.css"
try:
    with open(css_filepath, "r") as f:
        css = f.read()
    road_animation = """
@keyframes drawPath{0%{stroke-dashoffset:200;opacity:.3}100%{stroke-dashoffset:0;opacity:1}}
svg path[style*="drawPath"]{stroke-dasharray:200}
"""
    if "drawPath" not in css:
        css += road_animation
        with open(css_filepath, "w") as f:
            f.write(css)
        changes += 1
        print("4. Road animation CSS added: DONE")
    else:
        print("4. Road animation CSS: already exists")
except Exception as ex:
    print(f"4. CSS update failed: {ex}")

# Verify bracket balance
opens = content.count("(") + content.count("[") + content.count("{")
closes = content.count(")") + content.count("]") + content.count("}")
print(f"\nBracket balance: opens={opens}, closes={closes}, diff={opens - closes}")
print(f"Parentheses: ( = {content.count('(')}, ) = {content.count(')')}, diff = {content.count('(') - content.count(')')}")
print(f"Brackets: [ = {content.count('[')}, ] = {content.count(']')}, diff = {content.count('[') - content.count(']')}")
print(f"Braces: {{ = {content.count('{')}, }} = {content.count('}')}, diff = {content.count('{') - content.count('}')}")

print(f"\nTotal changes: {changes}")

if content != original:
    with open(filepath, "w") as f:
        f.write(content)
    print("JS file written successfully!")
else:
    print("No JS changes were made!")
