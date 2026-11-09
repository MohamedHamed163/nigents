#!/usr/bin/env python3
"""
1. Remove chairman quote added to hero section
2. Move the existing chairman card (man image + quote) to right after the About section
"""

js_path = "src/dashboard/public/algioshy/assets/index-fbf653f9.js"

with open(js_path, "r") as f:
    js = f.read()

changes = 0

# ── 1. Remove the chairman quote that was added to the hero section ────────────
hero_chairman = (
    ',e.jsxs(a.div,{initial:{opacity:0,y:20},animate:{opacity:1,y:0},'
    'transition:{duration:.8,delay:.3,ease:"easeOut"},'
    'className:"flex items-start gap-3 mb-6 bg-white/8 backdrop-blur-sm border-l-2 border-[#C1272D] pl-4 py-3 rounded-r-xl max-w-xl",'
    'children:[e.jsxs("div",{children:['
    'e.jsx("p",{className:"text-white/85 text-sm md:text-base font-light leading-relaxed italic",'
    'children:"\u201cAt this critical stage of education, the right environment shapes not only academic success, but the future of each student. At Smart College, we go beyond curriculum \u2014 we develop confident, disciplined, and forward-thinking young leaders.\u201d"}),'
    'e.jsx("p",{className:"text-[#C1272D] text-xs font-bold uppercase tracking-widest mt-2",'
    'children:"\u2014 Mr. Tarek Algioshy, Chairman"})]})]}),'
)

if hero_chairman in js:
    js = js.replace(hero_chairman, ',', 1)
    changes += 1
    print("1. Hero chairman quote removed: OK")
else:
    # Try without the leading/trailing commas wrapper
    hero_chairman2 = (
        'e.jsxs(a.div,{initial:{opacity:0,y:20},animate:{opacity:1,y:0},'
        'transition:{duration:.8,delay:.3,ease:"easeOut"},'
        'className:"flex items-start gap-3 mb-6 bg-white/8 backdrop-blur-sm border-l-2 border-[#C1272D] pl-4 py-3 rounded-r-xl max-w-xl",'
        'children:[e.jsxs("div",{children:['
        'e.jsx("p",{className:"text-white/85 text-sm md:text-base font-light leading-relaxed italic",'
        'children:"\u201cAt this critical stage of education, the right environment shapes not only academic success, but the future of each student. At Smart College, we go beyond curriculum \u2014 we develop confident, disciplined, and forward-thinking young leaders.\u201d"}),'
        'e.jsx("p",{className:"text-[#C1272D] text-xs font-bold uppercase tracking-widest mt-2",'
        'children:"\u2014 Mr. Tarek Algioshy, Chairman"})]})]}),'
    )
    if hero_chairman2 in js:
        js = js.replace(hero_chairman2, '', 1)
        changes += 1
        print("1. Hero chairman quote removed (alt): OK")
    else:
        print("1. Hero chairman quote: NOT FOUND — probing")
        if 'Mr. Tarek Algioshy, Chairman' in js:
            idx = js.find('Mr. Tarek Algioshy, Chairman')
            print(f"   Found at {idx}")

# ── 2. Move chairman section: cut from after facilities, insert after about ────

# The chairman section (the full dark card with man image)
chairman_section_start = 'e.jsx("section",{className:"py-20 md:py-32 px-4 sm:px-6 max-w-[1400px] mx-auto bg-white",'
chairman_section_end = 'children:"Chairman"})]})]})]})]})})'

start_idx = js.find(chairman_section_start)
end_idx = js.find(chairman_section_end, start_idx)

if start_idx == -1 or end_idx == -1:
    print("2. Chairman section NOT FOUND")
    raise SystemExit(1)

end_full = end_idx + len(chairman_section_end)
chairman_block = js[start_idx:end_full]
print(f"2. Chairman section found ({len(chairman_block)} chars): OK")

# Remove from current position (it sits between facilities and why-choose-us)
# Before it is: ,   After it is: ,e.jsxs("section",{id:"why-choose-us"
old_at_current = ',' + chairman_block + ',e.jsxs("section",{id:"why-choose-us"'
new_at_current = ',e.jsxs("section",{id:"why-choose-us"'

if old_at_current in js:
    js = js.replace(old_at_current, new_at_current, 1)
    changes += 1
    print("3. Removed from original position: OK")
else:
    print("3. Could not remove from original position — trying alt")
    # Maybe there's no comma before
    old_at_current2 = chairman_block + ',e.jsxs("section",{id:"why-choose-us"'
    new_at_current2 = 'e.jsxs("section",{id:"why-choose-us"'
    if old_at_current2 in js:
        js = js.replace(old_at_current2, new_at_current2, 1)
        changes += 1
        print("3. Removed (alt): OK")
    else:
        print("3. ERROR — cannot remove chairman from original position")
        raise SystemExit(1)

# Insert after about section, right before academics section
# Junction: ),e.jsxs("section",{id:"academics"
old_junction = '),e.jsxs("section",{id:"academics"'
new_junction = '),' + chairman_block + ',e.jsxs("section",{id:"academics"'

if old_junction in js:
    js = js.replace(old_junction, new_junction, 1)
    changes += 1
    print("4. Inserted after About section: OK")
else:
    print("4. About-academics junction NOT FOUND")
    raise SystemExit(1)

# ── Bracket balance ───────────────────────────────────────────────────────────
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

print(f"\nDone — {changes} changes written")
