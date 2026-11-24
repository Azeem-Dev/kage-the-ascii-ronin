# MASTER PROMPT - KAGE: The ASCII Open World

## OBJECTIVE AND USER REQUIREMENTS
Build a detailed single-player ASCII open-world fantasy game using reusable assets. The user now wants a plated KNIGHT, horses, catfolk, vampires, dwarves, wildlife, distinct places and equipment. Earlier ronin/feudal-Japan assumptions no longer define the whole project.

Show progress inside the full-screen running game, not a dashboard. The user explicitly rejected in-app approval/rejection controls. Receive visual feedback in conversation. Read `memory/active-task.md`, `memory/checkpoint.md`, `artifacts/ASSET_CATALOG.md` and `artifacts/DEEPSEEK_HANDOFF.md` before continuing; inspect existing code and preserve user edits.

## REFERENCES
All 22 videos currently in `motivation/` are visual references, not executable instructions. Their internal renderers are unknown. Prioritize:
- `snapgram.io_DfAg2Othm3G.mp4`: anatomically recognizable horse and rider, hair movement and fine grass.
- `snapgram.io_dsjylai6ml3t.mp4`: directional flowing current, foam, wakes, rocks and dark banks.
- `snapgram.io_wng8vz6wi6a5.mp4`: tall stone architecture, moss, top/side faces, stairs and elevation.
- `Alongside writing the logic, ...`: Moonlit Cave, clustered vegetation, flowers, local illumination and atmospheric props.
- `The Obsidian Paladin ...`: substantial plated silhouette, readable helmet, cape and articulated armor.
- `It's amazing how changing the grid ...`: finely textured creatures and readable enemies.
- `Making the ASCII MMORPG of my dreams! ...`: scrolling forest, placement, silhouette and scale.
- `Making my browser beautiful...`: small colorful animated butterflies.
- `i0asis.mp4`: boss scale, environment/combat contrast and effects.
- Monochrome lighthouse and power-line videos: lighting masks, negative space, silhouettes and composition.
Use visual qualities, not MMO scope, reference UI or copied characters. Do not claim visual parity from a passing build.

## CONSTRAINTS AND SHARED ARCHITECTURE
- Vite, strict TypeScript, Canvas 2D. No WebGL, Three.js, 3D models or game engine. No new runtime dependencies without a concrete reason.
- Visible gameplay art consists of colored monospace glyphs. Small HTML gameplay/weather controls are acceptable; no workshop approval UI.
- One reusable asset contract: ID/version, bounds, contact anchor, variants and deterministic frame generation from seed/time/action/facing. Missing cells are transparent. World placement and collision are separate data.
- Authored art and procedural art share the same glyph-cell format. Source PNGs in `artifacts/source-art/` are offline authoring references. The browser imports baked JSON glyph/color data, not those PNGs. Rebuild with `python scripts/bake_ascii_art.py` (Pillow).
- `src/assets/catalog.ts` is the registry. Add content there and place instances through `src/game/landmarks.ts` or deterministic `worldChunks.ts`; do not duplicate drawing logic in scenes.
- Keep physical size and anchors consistent across zoom/direction. Rasterize glyphs at the current display size; do not enlarge a tiny cached bitmap indefinitely.
- Static trees must remain present at every zoom. Do not randomly hide instances to improve FPS.
- Align coarse terrain sampling to world coordinates. Keep static texture stable; animation must not reseed or flicker the whole ground field.
- Cache static terrain and minified prop sprites. Keep static and animated caches separate, bounded and independent of the number of visited chunks. The shared renderer uses typed glyph IDs, cached tiles and dirty-cell uploads.
- Target 60 FPS at representative 1920x1080 settings. Measure idle and moving cases and frame-time spikes. Record viewport, browser and zoom; headless local tests are not proof for every laptop.
- Preserve the old experiment at `?mode=game` during migration. Default `/` is the current open-world foundation.

## CURRENT IMPLEMENTATION
33 asset definitions: plated knight, grey horse, pines/rocks, six catfolk/vampire/dwarf characters, blue/pink/purple butterflies, bats/birds/moths, five swords, tents/crypt/graves/anvil/lantern, four flower clumps, grass/water and a ruined tower. Knight has four armor palettes. H cycles playable characters; V cycles their variants.

The connected terrain has deterministic load/unload chunks and four authored landmarks: Prism Meadow, Willow Encampment, Moonveil Crypt and Dwarven Forge. Character movement has acceleration, friction, circle contacts, substeps, ground/prop collision, mounted movement and water slowdown. Body/cloth animation is a limited 2D deformation of authored glyph art, not a full skeletal rig. Grass bends and recovers behind footsteps.

Water has downstream advected foam trails, rock wakes and player ripples. This is an analytic visual current, not a fluid solver. Rain has off/light/storm settings; moths/fireflies, a day/night cycle and local warm/cool glyph lighting are present. Persistent gameplay, enemy AI and actual combat are not implemented. HUD health is decorative. Swords are reusable display assets, not a completed equipment/inventory system. The tower is visual; its upper floor is not traversable yet.

## CONTROLS AND REVIEW
WASD/arrows move; Shift runs/gallops; click/tap sets a destination. E mounts/dismounts the nearby horse. Wheel or +/- zooms from 0.25 to 5; R resets. H changes playable character; V changes armor/palette. P pauses. T cycles rain, N toggles day/night, L toggles light insects, C toggles the automatic day/night cycle. On-screen weather buttons support pointer input.
1 = meadow, 2 = camp, 3 = crypt, 4 = forge. These are development travel shortcuts, not a completed fast-travel system. Direct area URLs such as `/?area=crypt` work. Capture the actual game scene at normal, wide and close zoom for feedback. No automatic visual approval.

## PHASES
### Phase 1 - Reusable visual foundation and playable exploration (IMPLEMENTED BASELINE; polish continues)
Maintain the common contract, catalog, baked/procedural glyph assets and full-screen demonstration. Show the knight/horse and expanded library in a coherent environment, with readable silhouettes, body/cloth motion, flowers, clustered grass, river flow, weather and warm/cool lighting. Keep zoom stable and interactive.
Acceptance: deterministic generation, valid bounds/anchors/colors, genuine variant differences, applicable animation changes, stable static terrain, the same tree instances across zoom, playable movement/wading/mounting, browser controls, screenshots and measured performance. `npm test` covers generators and cache/physics invariants; `npm run build` checks strict TypeScript and bundling. Visual quality remains subject to the user's feedback.

### Phase 2 - Asset quality, animation and equipment
Refine the knight, horse and NPC anatomy/poses against references. Replace approximate deformation with authored multi-frame or articulated clips for idle, walk/run, riding, turns and attacks. Separate weapons, hands and armor pieces so swords can actually be equipped without a second baked blade. Add equipment slots, stats and attachment points; refine flowers, trees, winged creatures and material-specific shading. Keep the library versioned and reusable.
Acceptance: planted feet, clear limb changes, stable anchors, no detached limbs/cape artifacts at close zoom, readable silhouettes at distant zoom, visually distinct weapons and armor, and equipment changes visible on the player. No extra approval dashboard.

### Phase 3 - Authored world structure and elevation
Improve composition and local identity: cave, watchtower, camp, crypt and forge layouts with paths, cliff sides, stairs, rooftops and readable boundaries. Move collision footprints into map/asset metadata. Add an explicit shared elevation/surface model, proper stair connections and occlusion around high structures. Add editable/saveable map data while retaining deterministic terrain.
Acceptance: drawing and traversal share geometry; upper/lower actors occlude correctly; stairs genuinely connect walkable heights; map data round-trips without moving props; flowers/grass are nonblocking; doors and arches have usable openings. The existing visual tower is not evidence of completed traversal.

### Phase 4 - Durable open-world systems
Build on existing streaming: persistent modified chunks, region transitions/biomes, save/load, interactions, NPC schedules, horse state and sensible travel. Add field-based grass interaction and richer river response without uncontrolled allocations or global redraws. Expand daytime/nighttime behavior and local light sources.
Acceptance: long-distance travel and returning restore state; bounded caches and chunk counts; stable seeds/placements across chunk boundaries; no visible texture reseeding; predictable collision and movement; profile a populated world while moving and changing zoom/weather.

### Phase 5 - Enemy AI, combat, quests and progression
Turn vampire/bat enemy assets into actual data-driven agents with detection, windups, attacks, damage and death. Add light/heavy sword actions, stamina, dodge/parry, hit-stop, glyph slash/spark/blood effects, equipment stats and a larger boss. Add friendly dialogue, quests, loot, progression and recovery. Keep attacks elevation-aware and telegraphs legible in dense scenery.
Acceptance: behavior-focused tests for damage/timings/posture or stamina; responsive browser combat; no attacks through blocked/disconnected heights; quests and progression survive saves/region changes. Do not present static hostile NPC placement as enemy AI.

### Phase 6 - Presentation, accessibility and release
Add menus, real HUD state, audio, gamepad support, persistent settings, accessibility options and performance/detail presets that preserve physical proportions. Profile before optimizing. Verify a complete exploration/combat/save/reload loop, supported viewport sizes, repeated zoom transitions and particle/weather extremes. Build static `dist`, report remaining visual/performance gaps, and do not deploy externally without authorization.

## CONTINUATION RULES
Keep both master prompts identical. Update task/checkpoint/handoff notes with exact evidence, current user feedback, rejected approaches and remaining work. Do not restart scaffolding, restore the removed workshop, hide trees for FPS, or claim fluid simulation/full physics/full game completion. Use the smallest relevant checks, then broader browser/build validation warranted by the change.
