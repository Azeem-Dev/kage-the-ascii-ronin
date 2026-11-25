# MASTER PROMPT - KAGE: The ASCII Ronin

## OBJECTIVE AND USER REQUIREMENTS
Build a single-player, story-driven ASCII open-world action game for **web and mobile**.
The hero is **Kage**, a masterless samurai, riding his white horse **Tsuki**. The world is
drawn in coloured glyphs in an **isometric 2.5D view**: objects are real 3D models (three.js)
converted to ASCII by brightness, so it reads as ASCII but has true volume, lighting and depth.

The story, cast, regions, quests and endings are in `docs/STORY.md`; follow it. The world
holds towns, villages, outskirts, goblins, orcs, elves and dwarves, with rich and poor people.

Show progress inside the full-screen running game, not a dashboard. The owner rejected
in-app approval/rejection controls. Receive visual feedback in conversation. Read
`CLAUDE.md`, `docs/STORY.md` and `ISSUES.md` before continuing; inspect existing code and
preserve user edits.

## VISUAL TARGET (owner-confirmed 2026-11-25)
Sources: the videos in `motivation/` and the frame sheets in
`artifacts/preview/motivation-review/*.jpg` (one sheet per clip). Study the sheets before any
visual work. What we must match:
1. **Near-black world.** Darkness is the canvas; light reveals things (moonbeams, lamps,
   windows, a light pool around the player). Most of the screen is dark.
2. **Fine glyphs that read as texture.** At normal zoom you see shapes and light, not letters.
   Letters are legible only when zoomed far in.
3. **Grass = individual thin blades.** Long green strokes in varied tones, dense in patches,
   swaying in wind, small purple flowers; moonbeams turn blades pale cyan-white. Roads, paving
   and stone are a separate, calmer surface.
4. **3D models → ASCII.** Characters and creatures (spider, goldfish, jellyfish, knight in the
   clips) are lit 3D models converted to glyphs: dense where lit, sparse in shadow, rim light on
   edges, clear colour regions.
5. **One clear subject.** The player is the brightest, cleanest thing on screen.
6. **Colour with purpose.** One colour per kind of thing: green foliage, purple flowers, warm
   window/lamp/fire light, people brighter than their surroundings; everything else dark and cool.
7. **Atmosphere.** Swaying grass, rain, drifting specks, glints, haze; depth without clutter.

### Rejected by the owner (do not repeat)
- Full 3D perspective scenes (twice: "blurred", "things look stupid", "very shitty").
- Flat hand-drawn glyph sprites, uniform glyph fills, busy stripe textures.
- Uniform mid-tone scenes where nothing separates ("can't differentiate").
- Blurring glyphs into solid pixel art ("became more shitty").
- A blurred/smooth ground ("looks like marble") and sparse random tufts instead of blade grass.
- Oversized glyph cells when zoomed in (max zoom is now 1.0).

## TECHNOLOGY (current, 2026-11-25)
- Vite + strict TypeScript; **three.js** for GPU work. Isometric projection everywhere:
  `screenX = X - Y`, `screenY = (X + Y) / 3 - Z` (`src/game/view.ts`).
- **Pipeline:** world → per-cell glyph ids + layers (`src/render/assetRenderer.ts`, CPU) →
  lighting/shading per cell → **three.js presenter** (`src/render/gpuPresenter.ts`) draws glyphs
  from an atlas and does the look: brightness-driven glyph density, procedural blade grass on
  open ground, paved ground kept readable, cool night grade with protected greens and warm
  lights, haze, light pool around the player, water reflections, snow, lightning, bloom.
- **Characters:** three.js articulated models built from `BodySpec`
  (`src/assets/voxel/threePerson.ts`), rendered offscreen with the exact isometric matrix and
  converted to glyph cells (colour from lit pixels, glyph by brightness, silhouette outlines).
  Poses are quantised and cached. Registered at startup in `riverScene.ts`; Node tests fall back
  to the voxel figure (`voxelPerson.ts`) because tests cannot import `three`.
- **Buildings:** voxel models ray-marched at final on-screen resolution
  (`src/assets/voxel/voxel.ts`, `voxelHouse.ts`): normals, AO, cast shadow, outlines, lit windows.
  Planned: move to three.js models like the characters.
- Assets may implement `generateAt(options, scale)` to render directly at final size (no
  averaging/blur); `AssetCache` uses it when present.
- **Capacitor** packages the same build for iOS/Android later. No React Native.
- Keep and reuse: terrain sampling (`src/assets/landscape.ts`), regions and placements
  (`src/game/landmarks.ts`, `worldChunks.ts`), colliders, physics in `src/engine/`.

## CONSTRAINTS
- Performance: 60 FPS at 1920×1080 on desktop; 30–60 FPS on mid-range phones with quality
  levels. Measure, don't assume: record device, browser, resolution, idle and moving cases.
  **Current state: below target** (44–80 ms/frame headless after moving to 3×5 px cells); the
  CPU shade + blit steps must move to the GPU.
- Mobile first-class: touch controls, safe areas, portrait and landscape, pause on background.
- Never hide or thin trees for FPS. World sampling and placements stay deterministic
  (no flicker, no reseeding); screen-space effects must be world-anchored (`camCell`).
- Keep caches and loaded chunks bounded. No new dependencies beyond three.js and Capacitor
  without a concrete reason.
- Every visual change: screenshot it in the running game at default zoom (and zoomed out/in)
  and judge it against the VISUAL TARGET before reporting.

## CURRENT IMPLEMENTATION (branch `main`, uncommitted work as of 2026-11-25)
- Default start: Highmere town square; default zoom 0.8, range 0.4–1.0; glyph cells ≥ 3×5 px.
- Ground: near-black with procedural blade grass, moonbeams and flowers; paved cells keep
  their glyphs and a lighter surface.
- People: three.js models for all ten `PEOPLE` types (goblin, orc, elf, dwarf, peasant, beggar,
  farmer, merchant, noble, guard) with walk/idle animation and per-race features.
- Houses: five voxel house types (townhouse, manor, tavern, cottage, hovel) at 0.8 scale.
- Still old flat sprites: hero (knight/ronin), horse, trees, animals, market stalls, props.
- Known defects: frame rate below target; horizontal scan-line stripes on trees at 3×5 cells;
  people slightly large next to houses; the hero does not yet stand out enough.
- Physics engine built and tested but not wired into the game; no NPC AI, combat, quests or saves.

## CONTROLS
WASD/arrows move; Shift runs/gallops; click/tap sets a destination. E mounts/dismounts.
Wheel or +/- zooms; R resets. H/V change character/variant (dev). P pauses. T weather, N
day/night, L insects, C cycle, B fire. Number keys 1–9/0 and `?area=<id>` jump to regions (dev).
Planned: Space jump, attack/parry, touch equivalents.

## PHASES
### Phase 1 - Look and performance (in progress)
Move per-cell shading and blit to the GPU to reach 60 FPS with fine glyphs; fix scan-line
stripes; hero and horse as three.js models with a strong rim light; houses, trees, animals,
stalls and props as three.js models with the same glyph conversion; rain, drifting specks,
glints. Acceptance: screenshots that match the VISUAL TARGET point by point, owner sign-off,
measured FPS at 1920×1080.

### Phase 2 - Hero, horse and physics
Kage per `docs/STORY.md` (topknot, pale cape, dark armour, red cord, straw hat, katana);
walk/run/ride/jump/draw-cut. Wire `src/engine/`: body-vs-body collision, jump and gravity,
wind on grass and banners, particles (dust, splashes, sparks), Verlet hair and cape.
Acceptance: hero reads as hat + cape + blade at every zoom; planted feet; no penetration.

### Phase 3 - World and regions
All ten regions with buildings, props and people as models; elevation, stairs, high ground and
occlusion; lights at night. Acceptance: deterministic world, bounded chunks, every region
reachable by road, FPS targets held.

### Phase 4 - Story systems
Dialogue, quests, choices and an ally roster driving the endings; the Blank (erasure visuals:
glyphs thin `#` → `+` → `.` → empty); Inkblade restoring ground; Brushstroke collection;
save/load; NPC schedules. Acceptance: Act I playable start to finish; saves survive reloads.

### Phase 5 - Combat and enemies
Data-driven enemies (Blank wisps, Nameless Knight, goblins, orcs, the Unwritten) with
detection, windups, attacks and death; light/heavy cuts, parry, dodge, stamina, hit-stop,
ink-slash effects; mounted combat for the Act III battle.
Acceptance: behaviour tests for timings and damage; responsive on touch and keyboard.

### Phase 6 - Release
Menus, HUD, audio, gamepad, settings, accessibility, quality presets. Static web build and
Capacitor iOS/Android builds. Report remaining gaps. Do not deploy or publish to stores
without the owner's authorisation.

## CONTINUATION RULES
Keep both master prompts identical. Update `CLAUDE.md` and hand-off notes with exact
evidence, the owner's current feedback, rejected approaches and remaining work. Do not
restore the removed workshop UI, hide trees for FPS, or claim full physics, fluid simulation,
visual parity or game completion. Tests: `npx tsc --noEmit -p .` and `npm test`; then check in
the browser. A task notification's exit code can come from a pipe (`| tail`), not the test:
read the test output itself.
