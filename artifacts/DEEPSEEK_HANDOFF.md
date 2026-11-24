# DeepSeek continuation

## Outcome and current scope

The project now opens a playable ASCII world at `/`, built from 33 reusable asset
definitions. It has deterministic streamed terrain/props, four authored regions,
seven playable character appearances, horse mounting, collision/sliding/friction,
grass disturbance, directional river foam/ripples, rain/insect controls, day/night
and local glyph lighting. The old scene is at `?mode=game`.

This is a foundation, not a completed open-world RPG. The latest user focus is
visual quality: readable anatomy, beautiful varied vegetation/lighting, convincing
flow, coherent zoom and responsive animation. Keep showing the running game.

## User corrections that must persist

- No approval/rejection dashboard. The user reviews screenshots/running gameplay
  in conversation. The earlier workshop implementation was removed.
- The player is now a knight; do not revert to the early cartoon ronin.
- The first procedural horse and character were rejected. Their replacements use
  detailed source art baked offline into glyph JSON. Never draw those PNGs directly.
- The user rejected disappearing/reappearing trees across zoom. Do not thin or
  hide trees based on zoom. Coarse sampling must remain world-aligned.
- The user reported about 5 FPS and flickering. Do not restore full per-frame
  terrain generation, globally synchronized tree regeneration or tiny bitmap zoom.
- Requested content includes catfolk, vampire female/male, dwarf/neutral, flying
  wildlife, different swords/armor, flowers, light insects and controllable weather.

## Authoritative files

- `src/assets/types.ts`: local glyph-cell contract, deterministic noise/validation.
- `src/assets/catalog.ts`: all 33 definitions and ID lookup.
- `src/assets/art/*.json`, `authored.ts`, `knight.ts`, `horse.ts`, `characters.ts`:
  authored glyph data and limited procedural articulation.
- `creatures.ts`, `equipment.ts`, `flora.ts`, `props.ts`, `tower.ts`: reusable content.
- `src/render/assetRenderer.ts`: glyph IDs, native-size tiles, local illumination,
  typed sprite stamping and dirty-cell output.
- `src/render/assetCache.ts`: separate bounded static and animated sprite caches.
- `src/render/terrainLayer.ts`: cached stable world-aligned ground and sparse water animation.
- `src/game/worldChunks.ts`, `landmarks.ts`: deterministic streaming and authored placement.
- `src/assets/landscape.ts`: terrain colors, clearings/paths, banks and river shape.
- `src/engine/physics.ts`: accelerated circle-body movement with contacts/substeps.
- `src/game/atmosphere.ts`: downstream foam, rain, insects and cycle state.
- `src/riverScene.ts`: current integration/controller; split further as behavior grows.
- Both master prompts: updated six-phase roadmap. `ASSET_CATALOG.md`: content inventory.

## Commands and evidence

- `npm run dev -- --host 127.0.0.1` serves on port 3000 in this workspace.
- `npm test`: generator, bounds, variants, deterministic frames, chunk regeneration,
  bounded chunk windows, cache reuse, stable coarse terrain and physics contacts.
- `npm run build`: strict TypeScript plus Vite production bundle.
- Browser scripts: `tests/scene.browser.mjs`, `tests/world.browser.mjs`,
  `tests/performance.browser.mjs`. Start Vite first. They accept an optional absolute
  path to a Playwright module if Playwright is not installed in this repository.
- This machine's existing module:
  `C:/Users/HP/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs`.
- Screenshots and measured reports: `artifacts/preview/`. Prefer `final-*` and the
  latest optimization report; earlier snapshots show superseded artwork/UI.
- Original same-browser wide-zoom baseline was 5.49 FPS. Caching/dirty-cell fixes
  now measure 56.52 idle / 56.64 moving FPS in headless Chrome 157 at 1866x900,
  zoom 0.25, after content/lighting expansion. Moving p95 is 27.0ms and worst
  frame 32.1ms. Read `optimization-performance.json`; not a blanket hardware guarantee.

## Known limitations / incomplete gameplay

- Authored body/limb motion is 2D glyph deformation, not a complete multi-direction
  skeletal animation set. Riding poses still need dedicated art/animation.
- The horse/knight art was materially replaced, but user aesthetic acceptance is
  not established. Do not claim reference-level fidelity or user approval.
- Swords are distinct reusable display assets. Inventory, attachments, equipping,
  attacks, enemy AI, health/damage, quests, loot, saves and audio are still missing.
- Hostile vampire placement is metadata, not behavior. HUD health is decorative.
- The ruined tower is visual; no walkable upper floor or elevation traversal yet.
- Collision uses circles; arches/doors need authored compound footprints.
- Water is analytic visual advection with wakes, not a fluid simulation.
- Sun/moon lighting recolors glyphs plus an overall display brightness filter;
  there is no geometry-aware shadow casting. Weather settings are not persisted.
- Area keys 1-4 and H character switching are development shortcuts.
- Not a blanket 60 FPS guarantee. Benchmark moving/wide/rain cases after changes.

## Single next action

Open the current world with the user and review **one normal-zoom moving sequence**
of the knight beside the river/horse. Capture feedback on anatomy, gait, grass and
flow, then implement the smallest focused art/animation correction before adding
combat or inventory. Do not restart scaffolding or recreate the removed workshop.
