#!/usr/bin/env python3
"""
v5 — Complete pathway section aesthetic overhaul (CSS only):
 • Revert section to rich DARK theme (SVG road was built for dark bg)
 • Premium deep-navy gradient background
 • Section heading: vibrant gradient clip text
 • Emerge animations: bigger, brighter, stronger glow
 • Cards: glass morphism dark with vivid accent borders
 • Responsive polish
 • Fix list item colors for dark bg
 • Remove white-bg-v2 and v4 overrides — replace entirely
"""

import re

CSS_PATH = 'src/dashboard/public/algioshy/assets/index-i6CxoHev.css'

with open(CSS_PATH, 'r', encoding='utf-8') as f:
    css = f.read()

# ── Strip every custom block we've added across v1–v4 ───────────────────
for marker in [
    r'\n/\* pw-white-bg \*/[\s\S]*?(?=\n/\*|\Z)',
    r'\n/\* pw-white-v2 \*/[\s\S]*?(?=\n/\*|\Z)',
    r'\n/\* pw-v4-emerge \*/[\s\S]*?(?=\n/\*|\Z)',
]:
    css = re.sub(marker, '', css)

v5 = r"""
/* ── pw-v5: premium dark pathway ─────────────────────────────────────── */

/* ── Section background: deep-space navy gradient ── */
.pw-section {
  background:
    radial-gradient(ellipse 80% 55% at 50% 0%,  rgba(37,99,235,0.12) 0%, transparent 65%),
    radial-gradient(ellipse 60% 40% at 50% 100%, rgba(220,38,38,0.10) 0%, transparent 60%),
    linear-gradient(170deg, #060b1a 0%, #0b1535 35%, #080e26 65%, #040811 100%) !important;
  position: relative;
}
/* subtle star-dust overlay */
.pw-section::before {
  content: "";
  position: absolute; inset: 0; z-index: 0; pointer-events: none;
  background-image:
    radial-gradient(1.5px 1.5px at 12% 18%, rgba(255,255,255,0.25) 0%, transparent 100%),
    radial-gradient(1px   1px   at 34% 6%,  rgba(255,255,255,0.18) 0%, transparent 100%),
    radial-gradient(2px   2px   at 58% 22%, rgba(200,200,255,0.15) 0%, transparent 100%),
    radial-gradient(1px   1px   at 77% 9%,  rgba(255,255,255,0.20) 0%, transparent 100%),
    radial-gradient(1.5px 1.5px at 89% 28%, rgba(255,255,255,0.12) 0%, transparent 100%),
    radial-gradient(1px   1px   at 6%  42%, rgba(200,220,255,0.15) 0%, transparent 100%),
    radial-gradient(1px   1px   at 93% 55%, rgba(255,200,200,0.12) 0%, transparent 100%);
}

/* ── Section head z-index above star overlay ── */
.pw-head { z-index: 2; position: relative; }
.pw-road-wrap { z-index: 2; position: relative; }
.pw-cards-grid { z-index: 2; position: relative; }

/* ── Typography ── */
.pw-section .pw-label {
  color: rgba(180, 155, 255, 0.72);
  letter-spacing: 0.3em; font-weight: 700;
}
.pw-section .pw-title {
  background: linear-gradient(135deg, #f0efff 0%, #b8b4e8 50%, #9290d0 100%);
  -webkit-background-clip: text; -webkit-text-fill-color: transparent;
  background-clip: text;
  text-shadow: none !important;
  letter-spacing: -2px;
}
.pw-section .pw-sub {
  color: rgba(160, 170, 215, 0.82);
}

/* ── SVG road: restore full premium glow on dark ── */
.pw-road-svg {
  filter:
    drop-shadow(0 50px 90px rgba(0, 0, 16, 0.8))
    drop-shadow(0  0px 80px rgba(59, 130, 246, 0.22))
    drop-shadow(0  0px 60px rgba(220, 38, 38, 0.12)) !important;
}

/* ── Cards: glass morphism on dark ── */
.pw-section .pw-card {
  background: linear-gradient(145deg,
    rgba(255,255,255,0.05) 0%,
    rgba(255,255,255,0.02) 100%) !important;
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
}
.pw-section .pw-card-blue {
  border: 1px solid rgba(59, 130, 246, 0.30) !important;
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,0.06),
    0 8px 32px -8px rgba(37, 99, 235, 0.18) !important;
}
.pw-section .pw-card-red {
  border: 1px solid rgba(220, 38, 38, 0.28) !important;
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,0.06),
    0 8px 32px -8px rgba(185, 28, 28, 0.18) !important;
}
.pw-section .pw-card-blue:hover {
  transform: translateY(-8px) !important;
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,0.08),
    0 28px 56px -16px rgba(37,99,235,0.45),
    0  0px 40px     rgba(59,130,246,0.20) !important;
  border-color: rgba(96,165,250,0.55) !important;
}
.pw-section .pw-card-red:hover {
  transform: translateY(-8px) !important;
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,0.08),
    0 28px 56px -16px rgba(185,28,28,0.45),
    0  0px 40px     rgba(220,38,38,0.20) !important;
  border-color: rgba(248,113,113,0.55) !important;
}

/* ── Card titles: vivid pastel on dark ── */
.pw-section .pw-title-blue { color: #7eb8fc !important; }
.pw-section .pw-title-red  { color: #fc8a8a !important; }

/* ── Card sub label: deep-vivid on dark ── */
/* inline style already set; also protect via CSS for un-inline children */
.pw-section .pw-card-sub { opacity: 1 !important; }

/* ── List bullets: keep #b0c4d8 (already correct on dark) ── */

/* ── pw-dash: keep dark-visible dashes ── */
.pw-dash {
  animation: pwDash 0.85s linear infinite !important;
  stroke: rgba(255,255,255,0.55) !important;
  stroke-width: 2 !important;
}

/* ── pw-hl: restore white highlight lines on dark road ── */
.pw-hl { stroke: rgba(255,255,255,0.30) !important; }

/* ── pw-split-dot: vivid white pulse ── */
.pw-split-dot {
  fill: rgba(255,255,255,0.92) !important;
  filter: drop-shadow(0 0 8px rgba(255,255,255,0.8));
}

/* ── SVG text labels ── */
.pw-svg-text { display: none; }
@media (min-width: 700px) {
  .pw-svg-text { display: block; }
}

/* ── Sweep animations: vivid on dark ── */
.pw-sweep-t, .pw-sweep-l, .pw-sweep-r {
  filter: drop-shadow(0 0 10px currentColor);
  mix-blend-mode: screen;
}
.pw-sweep-t { animation: pwSweep 3.0s cubic-bezier(.55,.1,.45,.9) infinite; }
.pw-sweep-l { animation: pwSweep 3.8s cubic-bezier(.55,.1,.45,.9) infinite 0.6s; }
.pw-sweep-r { animation: pwSweep 3.8s cubic-bezier(.55,.1,.45,.9) infinite 2.1s; }

/* ── ROAD EMERGE: fork roads grow out of trunk, looping ── */
.pw-emerge-t, .pw-emerge-l, .pw-emerge-r {
  opacity: 0;
  stroke-linecap: round;
}
.pw-emerge-t {
  filter: drop-shadow(0 0  8px rgba(230,240,255,0.6));
  animation: pwEmergeT 5.6s cubic-bezier(.45,.05,.3,1.0) infinite;
}
.pw-emerge-l {
  stroke: #3b82f6 !important;   /* vivid blue */
  stroke-width: 6 !important;
  filter: drop-shadow(0 0 16px rgba(59,130,246,0.9)) drop-shadow(0 0 40px rgba(37,99,235,0.5));
  animation: pwEmergeF 5.6s cubic-bezier(.45,.05,.3,1.0) infinite 0.85s;
}
.pw-emerge-r {
  stroke: #ef4444 !important;   /* vivid red */
  stroke-width: 6 !important;
  filter: drop-shadow(0 0 16px rgba(239,68,68,0.9)) drop-shadow(0 0 40px rgba(220,38,38,0.5));
  animation: pwEmergeF 5.6s cubic-bezier(.45,.05,.3,1.0) infinite 0.85s;
}

@keyframes pwEmergeT {
  0%   { stroke-dashoffset: 100; opacity: 0; }
  6%   { opacity: 0.9; }
  28%, 55% { stroke-dashoffset: 0; opacity: 0.9; }
  78%  { opacity: 0.9; }
  94%, 100% { stroke-dashoffset: 100; opacity: 0; }
}
@keyframes pwEmergeF {
  0%, 14%  { stroke-dashoffset: 100; opacity: 0; }
  22%      { opacity: 1; }
  46%, 68% { stroke-dashoffset: 0; opacity: 1; }
  85%      { opacity: 1; }
  97%, 100% { stroke-dashoffset: 100; opacity: 0; }
}

/* ── Responsive ── */
@media (max-width: 700px) {
  .pw-section .pw-title { font-size: clamp(26px, 7vw, 38px); letter-spacing: -1px; }
  .pw-road-svg { max-height: 280px; }
  .pw-cards-grid { grid-template-columns: 1fr !important; padding: 12px 14px 44px; gap: 14px; }
  .pw-emerge-l, .pw-emerge-r { stroke-width: 7 !important; }
}
@media (min-width: 701px) and (max-width: 1024px) {
  .pw-road-svg { max-height: 420px; }
  .pw-cards-grid { gap: 16px; }
}
"""

css = css.rstrip() + '\n' + v5

with open(CSS_PATH, 'w', encoding='utf-8') as f:
    f.write(css)

print('v5 CSS written — premium dark theme + road emerge + glass cards')
