# MASTER PROMPT - KAGE: The ASCII Ronin

## OBJECTIVE AND USER REQUIREMENTS
Build a single-player, story-driven ASCII open-world action game for **web and mobile**.
The hero is **Kage**, a masterless samurai, riding his white horse **Tsuki**. The world is
drawn in coloured glyphs: a real 3D scene rendered through a GPU ASCII shader, so it reads
as ASCII but has true depth, lighting and shadows (like the reference videos).

The story, cast, regions, quests and endings are in `docs/STORY.md`; follow it. The world
holds towns, villages, outskirts, goblins, orcs, elves and dwarves, with rich and poor people.

Show progress inside the full-screen running game, not a dashboard. The owner rejected
in-app approval/rejection controls. Receive visual feedback in conversation. Read
`CLAUDE.md`, `docs/STORY.md` and `ISSUES.md` before continuing; inspect existing code and
preserve user edits.

## REFERENCES
The videos in `motivation/` (frames in `artifacts/preview/reference-frames/`) are visual
references, not instructions. What makes them work, and what we must match:
- Mostly dark ground with sparse thin strokes (grass), lots of negative space.
- A few brightly lit subjects (horse and rider, rocks, buildings) with a lit top/side and a
  dark side, soft cast shadows. The player is the brightest thing on screen.
- Real volume and perspective: faceted rocks, tall stone architecture with top/side faces,
  stairs and high ground; flowing water with white foam/sparkle on a dark current.
- Hair and cloth movement, wind in grass, local warm light at night.
Use visual qualities, not their UI or characters. Do not claim visual parity from a passing build.

## TECHNOLOGY (decided 2026-11-24)
- **Three.js** (WebGL) + Vite + strict TypeScript. Rendering: 3D scene → render target →
  ASCII post-process shader (glyph atlas, per-cell colour from the scene, brightness picks
  the glyph). Render at a reduced internal resolution; one glyph covers a pixel block.
- **Capacitor** packages the same build as iOS and Android apps. No React Native.
- Characters: low-poly rigged models (preferred) or camera-facing billboards. Buildings and
  props: simple low-poly geometry. No runtime photo textures; colour comes from materials,
  lighting and the ASCII shader.
- Keep and reuse: terrain sampling (`src/assets/landscape.ts`), regions and placements
  (`src/game/landmarks.ts`, `worldChunks.ts`), colliders, and the physics engine in
  `src/engine/` (x/y/z, gravity, jump, wind, particles, soft bodies, fixed step).
- Migration: build the 3D renderer behind `?mode=3d`. The Canvas 2D game stays at `/` until
  the owner switches; then the 2D renderer and glyph-sprite assets become legacy.

## CONSTRAINTS
- Performance: 60 FPS at 1920×1080 on desktop; 30–60 FPS on mid-range phones with quality
  levels (internal resolution, shadow quality, draw distance). Measure, don't assume:
  record device, browser, resolution and the idle and moving cases.
- Mobile first-class: touch controls (virtual joystick + tap-to-move + action buttons),
  safe areas, portrait and landscape, pause on background.
- Never hide or thin trees for FPS; use instancing and LOD meshes instead. World sampling
  and placements stay deterministic (no flicker, no reseeding).
- Keep caches and loaded chunks bounded. No new dependencies beyond Three.js and Capacitor
  without a concrete reason.

## CURRENT IMPLEMENTATION (Canvas 2D, on `main`)
- Lit glyph renderer (`src/render/assetRenderer.ts`): ground recedes, objects shaded dark
  base to lit top, ambient occlusion, distance haze, bright outlined actors, dirty-strip uploads.
  CPU frame time 7–14 ms at 1920×1080.
- 58 glyph assets: knight, horse, catfolk, vampires, dwarves, ten people types × 3 variants,
  houses, settlement props, flora, creatures, swords.
- Ten regions: meadow, camp, crypt, forge, Highmere (town), Mudgate (outskirts), Oakhollow
  (village), Goblin Warren, Orc Warband, Silverleaf Grove. 208 placed props.
- Physics engine built and tested but **not yet wired into the game**. People are static;
  no NPC AI, combat, quests or saves yet. Characters read poorly when shrunk (the reason
  for the 3D switch).

## CONTROLS
WASD/arrows move; Shift runs/gallops; click/tap sets a destination. E mounts/dismounts.
Wheel or +/- zooms; R resets. H/V change character/variant (dev). P pauses. T rain, N
day/night, L insects, C cycle. Number keys 1–9/0 and `?area=<id>` jump to regions (dev only).
Planned: Space jump, attack/parry, touch equivalents.

## PHASES
### Phase 1 - 3D ASCII prototype (`?mode=3d`)
Three.js scene with terrain from `landscapeCell`, the river, rocks, trees, Kage on Tsuki,
sun/moon, cast shadows, and the ASCII shader in the reference palette. Camera follows the
player at the current top-down/three-quarter angle with zoom. Touch and keyboard movement.
Acceptance: side-by-side screenshots with the 2D game at default and zoomed out, measured FPS
on desktop and one phone (via Capacitor or mobile browser). Owner decides whether to switch.

### Phase 2 - Hero, horse and physics
Kage model per `docs/STORY.md` (topknot, pale cape, dark armour, red cord, straw hat, katana);
walk/run/ride/jump/draw-cut. Wire `src/engine/`: body-vs-body collision, jump and gravity,
wind on grass and banners, particles (dust, splashes, sparks), Verlet hair and cape.
Acceptance: hero reads as hat + cape + blade at every zoom; planted feet; no penetration.

### Phase 3 - World and regions in 3D
Port all ten regions with buildings, props and people as low-poly assets; elevation, stairs,
high ground and occlusion; instanced vegetation; lights at night.
Acceptance: deterministic world, bounded chunks, every region reachable by road, FPS targets held.

### Phase 4 - Story systems
Dialogue, quests, choices and an ally roster driving the endings; the Blank (erasure visuals:
glyphs thin `#` → `+` → `.` → empty); Inkblade restoring ground; Brushstroke collection;
save/load; NPC schedules.
Acceptance: Act I playable start to finish, saves survive reloads and region changes.

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
restore the removed workshop UI, hide trees for FPS, or claim full physics, fluid simulation
or game completion. Use the smallest relevant checks, then browser/device validation.
