# Active task

Build a full-screen playable ASCII open world using reusable assets. The user explicitly rejected a workshop/dashboard and in-app approval controls: show the running game and receive feedback in conversation. Preserve the legacy scene at `?mode=game`. Update both master prompts and leave a DeepSeek handoff.

References: originally ten videos, now 22 in `motivation/`; all sampled at four timestamps. Additional references include Moonlit Cave, a furry spider, Obsidian Paladin and layered animated creatures. Quality targets: detailed silhouettes, fine shaded glyphs, animated vegetation/water. Underlying reference renderer technology is unknown.

Implemented: native glyph contracts, ronin/pine/rock/horse definitions, grass/water generators, full-screen river exploration, deterministic chunk loading/eviction, walking/wading, horse mounting (E), zoom 0.25–5 (wheel or +/-), pause, robe variants and reset. Workshop files removed. User dislikes the current character and horse art; an art revision is still needed.

CURRENT PRIORITY: user reports severe flickering and ~5 FPS at wide zoom. Reproduce and optimize before further art additions. Causes found: synchronized pine regeneration, full terrain generation and per-cell pixel copies every frame, coarse samples not aligned to world coordinates, dense wind glyph changes. Replacing with cached terrain/static sprites and dirty-cell rendering. Final validation pending.

`AIOS.md` and `skills/README.md` are absent. Legacy unused imports were removed so the build passed earlier. Current source is being changed; rerun tests/build/browser checks after optimization.
