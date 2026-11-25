# KAGE: The ASCII Ronin — guide for Claude Code

ASCII open-world browser game. Vite + TypeScript, Canvas 2D only (no WebGL).
Owner: Azeem. Goal: a cohesive, colourful, playable ASCII open world matching
the reference videos in `motivation/`, built from reusable glyph assets.

## Commands

- `npm run dev` → http://localhost:3000 (`?area=<id>` jumps to a region, `?mode=game` = legacy scene)
- `npm test` → asset + physics tests (Node). `npx tsc --noEmit -p .` → strict type check.
- Browser tests (`tests/*.browser.mjs`) need Playwright; on this PC pass
  `C:/Users/HP/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs`
  as the first argument, with the dev server running.
- Git on Windows uses CRLF; work happens on branch **`render-v2`** (main untouched).

## Architecture (live path)

`src/main.ts` → `startRiverScene()` in `src/riverScene.ts` (game loop, input, camera,
HUD, pause screen, minimap). The legacy pipeline (`SceneBuffer`, `AsciiPass`,
`asciiScene.ts`, `testScene.ts`) only serves `?mode=game` and is a deletion candidate.

- **Assets** (`src/assets/`): `AsciiAsset.generate(options) → AsciiCell[]` (glyph + `#rrggbb`
  in asset-local cells, `anchor` = ground contact). Drawn with `GlyphShape` (`shapes.ts`).
  Optional `footprint` (collision circles) and `light` (light source) on the asset.
  Registry: `catalog.ts` (includes `people/index.ts` PEOPLE and `buildings/index.ts` BUILDINGS).
- **Renderer** (`src/render/assetRenderer.ts`, rewritten this session):
  ids → per-cell layers (ground/prop/actor/effect) → lighting pass (ambient + sun/moon,
  projected cast shadows from `stamp(..., groundY)`, `contactShadow`, `addLight`,
  rim light on silhouettes, dark halo around actors, saturation) → per-cell fg/bg colour
  → glyph alpha masks tinted per cell → dirty-cell blit with scroll shifting.
  `compile()` downsamples sprites by averaging colour and ink weight (no letter soup).
  Glyphs rasterize at devicePixelRatio. Zoom range 0.4–1.8 (`config.ts`).
- **Lighting per frame**: `applyLighting()` in riverScene from `atmosphere.daylight`.
- **Terrain**: `landscape.ts` `landscapeCell()` → `terrainLayer.ts` (cached, world-aligned).
- **World**: `game/worldChunks.ts` (deterministic chunks), `game/landmarks.ts` (regions,
  placed props), `game/colliders.ts` (footprints). Unknown asset ids are skipped with a warning.
- **Physics**: `engine/physics.ts` `moveBody()` (circle sliding). The standing horse has an
  interim collider in riverScene (to be replaced by body-vs-body physics).

## Current work: four parallel agent streams (DeepSeek via opencode)

Briefs: `artifacts/agents/README.md` (shared rules, scale table, done-criteria) and
`A-people.md`, `B-buildings.md`, `C-world.md`, `D-physics.md`. Each agent owns specific
files only; each writes `artifacts/agents/<letter>-handoff.md` when done and does not commit.
Launcher: `scripts/run-agents.ps1`. Sonnet agents started the work and were stopped
part-way (usage limits); partial files exist in `src/assets/people/`, `src/assets/buildings/`,
`src/engine/` and the world files.

### Your job as reviewer (keep it token-efficient)

For each finished stream:
1. Read its hand-off note; `git diff --stat` + skim the changed files it owns.
   Reject edits outside its owned files.
2. `npx tsc --noEmit -p .` and `npm test` must pass.
3. Look at it in the running game (dev server, `?area=town|village|outskirts|goblins|orcs|elves`
   or number keys 1–9/0), at default zoom and fully zoomed out/in. One or two screenshots.
4. Either commit it on `render-v2` (one commit per stream) or write a short fix list
   back to the user to paste into that agent.

### Integration you must do yourself (not delegated)

- **Agent D physics** → wire into `src/riverScene.ts` following `D-handoff.md`: spatial hash
  for colliders, body-vs-body (horse/NPCs replace the interim horse collider), jump on Space
  with gravity (draw at `y - z`), wind field driving grass/rain/banners, particles (dust on
  footsteps/landing, splashes in water, sparks/smoke at campfires, leaves), Verlet hair/cape
  chains on the player and horse mane/tail, fixed-step simulation.
- People are currently static placements; NPC behaviour/AI is not started.
- Add any new test files to the `npm test` script in `package.json`.

## Direction change (2026-11-24): Three.js + Capacitor

The owner chose to move from the Canvas 2D glyph renderer to **Three.js** (3D scene
rendered through a GPU ASCII shader), shipped to web via Vite and to iOS/Android via
**Capacitor**. This replaces the "No WebGL" rule below. Keep: terrain sampling, world
chunks/regions, colliders and `src/engine/` physics (already x/y/z). Replace: the
renderer and 2D glyph sprites (characters become low-poly models or billboards).
**Update (same day): the owner rejected the 3D look** ("blurred", "things look stupid",
"the 2D was very good"). A second try (perspective camera over the glyph renderer) was also
rejected ("things look very shitty"): flat sprites don't survive a perspective camera.
**Both 3D experiments were deleted (2026-11-25).** The owner chose **isometric 2.5D**, now the
default at `/` (`src/game/view.ts`; `?view=top` = old top-down). Buildings are drawn as
isometric boxes with walls and roofs (`src/assets/isoBuildings.ts`); scenery in front of the
hero gets a see-through window. Don't start another 3D attempt without the owner asking.
Mobile: touch controls (joystick / tap-to-move), quality levels, 30–60 FPS on mid phones.
Story and hero (a samurai): `docs/STORY.md`.

## Round 2 agent streams (art) — started 2026-11-24

Owner runs opencode in parallel: `scripts\run-agents.ps1` now defaults to E, F, G, H.
Briefs: `artifacts/agents/E-trees.md`, `F-wildlife.md`, `G-characters.md`, `H-world.md`
(shared rules and what the owner rejected/liked: `artifacts/agents/README.md`, "Round 2").
Registries `src/assets/trees/index.ts` (TREES) and `src/assets/animals/index.ts` (ANIMALS)
are wired into `catalog.ts`. Claude's integration after review: wire `src/game/wildlife.ts`
into `riverScene.ts`, add `tests/wildlife.test.mjs` to `npm test`, apply H's proposed spawn.

Current 2D stack (since the 3D rejection): GPU drawing via `src/render/gpuPresenter.ts`
(bloom, water reflections, snow cover, lightning), particle weather in
`src/game/weather.ts` (T cycles, B burns nearest building), swaying grass strands in
`src/render/terrainLayer.ts`.

## NEW DIRECTION (2026-11-25, latest) — 3D models + one ASCII pass at `/proof.html`

The owner compared the old game with `/proof.html` and chose the proof ("very much better").
Code: `src/proof/` (`main.ts` + `assets.ts` Claude's; `ascii.ts` Agent I; `world.ts` Agent J;
`actors.ts` Agent K). Models: `public/proof/models/` + `CREDITS.txt` (CC0 only; `three/Horse.glb`
unconfirmed, replace). Owner feedback on it: too noisy ("going to vomit"), models "not samurai"
(KayKit cartoon), "isn't open world, no story/direction": **open world first**. Spec:
`artifacts/CLAUDE_MASTER_PROMPT.md`; agent briefs round 3 in `artifacts/agents/README.md`
(`I-look.md`, `J-world.md`, `K-actors.md`); launcher defaults to J and I. The old glyph game at
`/` is frozen. Playwright here needs `channel: 'chrome'` plus the GPU flags for real FPS.
Claude's role: review each hand-off (owned files only, tsc + tests, screenshots + measured FPS
in the running page), then commit or return a fix list.

## Visual target and look pipeline (2026-11-25) — old glyph game, now frozen

Full spec, rejected approaches and phases: `artifacts/CLAUDE_MASTER_PROMPT.md` (identical to
`CHATGPT_MASTER_PROMPT.md`). Reference frame sheets: `artifacts/preview/motivation-review/*.jpg`.
Target: near-black world revealed by light, fine glyphs read as texture, blade grass, 3D models
converted to ASCII, one bright subject, colour per category, rain/specks/haze.

- Characters: three.js models → glyph cells (`src/assets/voxel/threePerson.ts`), registered in
  `riverScene.ts`; Node tests use the voxel fallback (`voxelPerson.ts`).
- Houses: voxel models ray-marched at final size (`voxel.ts`, `voxelHouse.ts`).
- `AsciiAsset.generateAt(options, scale)` renders at final size; `AssetCache` prefers it.
- Presenter shader does blade grass, paved ground, cool grade, light pool, haze.
- Open problems: FPS below target (move CPU shade/blit to GPU), scan-line stripes at 3×5 px
  cells, hero/horse/trees/animals/stalls still flat sprites.

## Rules the owner has set

- Show results in the running game; no approval dashboards or per-asset review UIs.
- Never hide or thin trees by zoom. Keep world sampling deterministic (no flicker).
- No runtime image files; assets end up as glyph cells. (WebGL/three.js is now allowed and used:
  the owner asked for "3d models as base + ascii shader above".)
- Must hold ~60 FPS at 1920×1080, including zoomed out. Measure, don't assume.
- Owner wants: better engine, colourful environment, many large assets (goblins, orcs,
  elves, dwarves, towns, villages, outskirts, poor and rich people), physics
  (collision, gravity, air/wind, hair and cloth). Open backlog: `ISSUES.md`.

## Session log (2026-11-24, claude.ai session)

- Fixed startup crash (zero-size canvas killed the render loop).
- New lit renderer, DPR-crisp glyphs, density-preserving downsampling, zoom 0.4–1.8,
  removed CSS brightness filter, horse collision, footprint/light asset fields, agent briefs.
- Commits on `render-v2`: `12d59d0` (renderer + briefs), `904bd68` (launcher).
- Verified visually in the browser at default, 0.4× and 1.8× zoom, 57–60 FPS in the pane.
  Not yet verified at 1920×1080 with the browser test scripts.
