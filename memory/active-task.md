# Active task

Build a full-screen playable ASCII open world using reusable assets. The user explicitly rejected a workshop/dashboard and in-app approval controls: show the running game and receive feedback in conversation. Preserve the legacy scene at `?mode=game`. Update both master prompts and leave a DeepSeek handoff.

References: originally ten videos, now 22 in `motivation/`; all sampled at four timestamps. Additional references include Moonlit Cave, a furry spider, Obsidian Paladin and layered animated creatures. Quality targets: detailed silhouettes, fine shaded glyphs, animated vegetation/water. Underlying reference renderer technology is unknown.

Implemented: native glyph contracts, ronin/pine/rock/horse definitions, grass/water generators, full-screen river exploration, deterministic chunk loading/eviction, walking/wading, horse mounting (E), zoom 0.25–5 (wheel or +/-), pause, robe variants and reset. Workshop files removed. User dislikes the current character and horse art; an art revision is still needed.

Current delivered baseline: 33 reusable definitions, including an authored plated knight/horse, six catfolk/vampire/dwarf characters, butterflies/birds/bats/moths, swords, flowers and a ruined tower. Four named areas use distinct terrain/clearings and shared placement data. H selects playable appearances; V selects palettes; 1-4 visits areas. T/N/L/C and pointer buttons control rain/day-night/insects/cycle. Acceleration, friction, sliding circle contacts, visible body deformation, grass disturbance and downstream foam/ripples are implemented.

Optimization verified: original wide-view baseline 5.49 FPS; latest headless Chrome 157 test at 1866x900, zoom 0.25: 56.52 idle / 56.64 moving FPS, p95 20.9 / 27.0ms. Tree hiding by zoom was removed. Static/animated caches are separate; terrain scrolls its cache and samples only exposed strips; glyph rasterization reuses one scratch canvas; output uses dirty cells. These are local test measurements, not a blanket 60 FPS guarantee.

Validation: `npm test` passed 33 assets / 912 deterministic frame combinations plus cache/chunk/physics checks; `npm run build` passed; scene/world/performance browser scripts passed. Current evidence is in `artifacts/preview/`, with latest `final-*` screenshots and `optimization-performance.json`.

Remaining: user visual acceptance is not established. Refine dedicated walk/riding animation if requested; current motion deforms authored glyph art. No enemy AI/combat, inventory/equipping, quests, saves, audio or traversable tower heights. Water is analytic advection, not a fluid solver. HUD health is decorative. See `artifacts/DEEPSEEK_HANDOFF.md` and the identical master prompts for continuation.

`AIOS.md` and `skills/README.md` are absent. Legacy unused imports were removed. Do not recreate the rejected workshop or per-asset approval UI.
