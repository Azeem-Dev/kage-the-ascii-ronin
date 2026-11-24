# Verified checkpoint - 2026-11-24

## Goal and scope

Reusable detailed ASCII assets inside a playable open world. User feedback is in
conversation, not an approval app. Latest requests included better knight/horse,
more characters/creatures/equipment/places, collision and body/grass motion,
flowing water, flowers, lighting, controllable rain/insects/day-night and better
zoom/performance.

## Current state

- Default `/`: streamed river world. Existing Vite server is on `127.0.0.1:3000`.
- `?area=meadow|camp|crypt|forge` opens authored areas; `?mode=game` is legacy.
- Registry has 33 definitions; seven character appearances are playable with H.
- Source PNGs are only authoring references. Runtime uses JSON glyph art and
  procedural glyph definitions through the same contract/renderer.
- No zoom-dependent tree removal. Native-size glyph rasterization on zoom.
- Terrain caching, static/animated sprite caching, reused raster context and
  dirty-cell framebuffer output replace the expensive full regeneration path.
- Gameplay remains a foundation; complete RPG systems are not implemented.

## Evidence

| Check | Result |
| --- | --- |
| `npm test` | Passed: 33 assets, 912 valid deterministic frames, variant/seed/animation checks; cache/chunk invariants; collision, sliding, friction |
| `npm run build` | Passed: strict TypeScript and Vite production output |
| `tests/scene.browser.mjs` | Passed: full-screen scene, movement/wading, pause, palette, zoom, mobile tap, legacy route |
| `tests/world.browser.mjs` | Passed after latest renderer changes: tree zoom round-trip, character switch, grass trail, rain states, daylight/insects, all four regions, mounting, mobile; no page errors |
| `tests/performance.browser.mjs` | Passed: same wide idle/moving case, stable grass pixels, bounded dirty cells, zoom limits, mount/dismount, pause; no page errors |

Playwright is available via the existing system runtime, not a new repo dependency:
`C:/Users/HP/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs`.
Each browser script accepts this absolute path as its first argument; start Vite first.

Latest benchmark: headless Chrome 157, 1866x900, zoom 0.25: **56.52 idle / 56.64
moving FPS**, p95 20.9/27.0ms, worst moving frame 32.1ms. Original same-case
baseline: 5.49 FPS and 373.8ms worst frame. Report:
`artifacts/preview/optimization-performance.json`. The release 1920x1080 hardware
target and sustained gameplay with future combat have not been validated.

## Known limits and next action

Current art is not declared user-approved. Walking/riding uses approximate 2D
glyph deformation. Hostile NPCs have placement metadata but no enemy behavior.
Weapons are display assets; health HUD is decorative. No quests/inventory/saves,
audio, geometry-aware shadow casting, fluid solver or tower elevation traversal.
See `artifacts/DEEPSEEK_HANDOFF.md` for authoritative files and constraints.

Next: review one normal-zoom moving knight/horse/river sequence with the user,
then address the most specific visual feedback before extending gameplay.
