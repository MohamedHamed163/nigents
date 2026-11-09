#!/usr/bin/env python3
js = open('src/dashboard/public/algioshy/assets/index-fbf653f9.js').read()

old_cards = (
    'e.jsxs("div",{className:"grid sm:grid-cols-2 gap-6 md:gap-8 w-full max-w-3xl",children:['
    'e.jsxs(a.div,{initial:{opacity:0,y:24},whileInView:{opacity:1,y:0},viewport:{once:!0},transition:{delay:1.4,duration:.5,type:"spring",stiffness:60},'
    'className:"bg-white rounded-2xl p-7 md:p-9 border-t-4 border-[#1B2E6D] shadow-[0_4px_24px_rgba(27,46,109,.1)] hover:shadow-[0_8px_32px_rgba(27,46,109,.18)] hover:-translate-y-1 transition-all duration-300",'
    'children:['
    'e.jsx("h3",{className:"text-xl md:text-2xl font-black text-[#1B2E6D] mb-3",children:"IG Cambridge"}),'
    'e.jsx("p",{className:"text-sm md:text-base text-gray-500 leading-relaxed",children:"International academic track \u2014 university preparation & global qualifications."})'
    ']}),'
    'e.jsxs(a.div,{initial:{opacity:0,y:24},whileInView:{opacity:1,y:0},viewport:{once:!0},transition:{delay:1.7,duration:.5,type:"spring",stiffness:60},'
    'className:"bg-white rounded-2xl p-7 md:p-9 border-t-4 border-[#C1272D] shadow-[0_4px_24px_rgba(193,39,45,.08)] hover:shadow-[0_8px_32px_rgba(193,39,45,.16)] hover:-translate-y-1 transition-all duration-300",'
    'children:['
    'e.jsx("h3",{className:"text-xl md:text-2xl font-black text-[#C1272D] mb-3",children:"American Diploma"}),'
    'e.jsx("p",{className:"text-sm md:text-base text-gray-500 leading-relaxed",children:"Applied track \u2014 critical thinking, real-world skills & career readiness."})'
    ']})'
    ']})'
)

assert old_cards in js, "OLD CARDS NOT FOUND"

def bullet(color, text):
    return (
        'e.jsxs("div",{className:"flex items-start gap-2.5 text-sm text-gray-600 leading-relaxed",'
        'children:[e.jsx("div",{className:"w-1.5 h-1.5 rounded-full bg-[' + color + '] mt-[7px] shrink-0"}),'
        'e.jsx("span",{children:"' + text + '"})]})'
    )

def card(color, title, subtitle, bullets_list, delay):
    bullets_str = ','.join(bullet(color, t) for t in bullets_list)
    return (
        'e.jsxs(a.div,{initial:{opacity:0,y:24},whileInView:{opacity:1,y:0},'
        'viewport:{once:!0},transition:{delay:' + str(delay) + ',duration:.5,type:"spring",stiffness:60},'
        'className:"bg-white rounded-2xl p-7 md:p-9 border-t-4 border-[' + color + '] '
        'shadow-[0_4px_24px_rgba(27,46,109,.08)] hover:shadow-[0_8px_32px_rgba(27,46,109,.14)] '
        'hover:-translate-y-1 transition-all duration-300",children:['
        'e.jsx("h3",{className:"text-xl md:text-2xl font-black text-[' + color + '] mb-1",children:"' + title + '"}),'
        'e.jsx("p",{className:"text-xs font-semibold uppercase tracking-widest text-gray-400 mb-5",children:"' + subtitle + '"}),'
        'e.jsxs("div",{className:"flex flex-col gap-3",children:[' + bullets_str + ']})'
        ']})'
    )

ig_card = card(
    "#1B2E6D", "IG Cambridge", "Cambridge International Examinations",
    [
        "Cambridge IGCSE curriculum recognised by universities in 160+ countries",
        "Rigorous academic programme with a strong university-preparation focus",
        "Develops critical thinking, independent research and analytical skills",
        "Assessed through internationally benchmarked Cambridge examinations",
        "Grades 10\u201312 spanning sciences, humanities, languages and the arts",
    ],
    1.4
)

am_card = card(
    "#C1272D", "American Diploma", "US-Accredited High School Diploma",
    [
        "US-accredited diploma widely accepted by universities around the world",
        "Credit-based GPA system with integrated SAT / ACT preparation",
        "Broad curriculum encouraging exploration across multiple disciplines",
        "Emphasis on real-world application, leadership and career readiness",
        "Grades 10\u201312 with AP-level enrichment and honours opportunities",
    ],
    1.7
)

new_cards = (
    'e.jsxs("div",{className:"grid sm:grid-cols-2 gap-6 md:gap-8 w-full max-w-4xl",children:['
    + ig_card + ',' + am_card
    + ']})'
)

js = js.replace(old_cards, new_cards, 1)

ok = True
for o, c in [('(', ')'), ('[', ']'), ('{', '}')]:
    diff = js.count(o) - js.count(c)
    status = 'OK' if diff == 0 else f'IMBALANCED ({diff:+d})'
    print(f'  {o}/{c}: {js.count(o)}/{js.count(c)} -- {status}')
    if diff != 0:
        ok = False

if not ok:
    raise SystemExit('Bracket imbalance — aborting')

open('src/dashboard/public/algioshy/assets/index-fbf653f9.js', 'w').write(js)
print('Done')
