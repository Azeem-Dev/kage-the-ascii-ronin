# MASTER PROMPT - KAGE: The ASCII Open World

## OBJECTIVE AND CURRENT PRIORITY
Build a browser-based open-world ASCII action game, starting with detailed reusable visual assets demonstrated together in a full-screen playable game view. Show progress in the running scene so the user can give feedback in conversation. Do not build approval buttons, review forms or an asset-workshop dashboard.

Read `memory/active-task.md` and `artifacts/DEEPSEEK_HANDOFF.md` before changing code. Inspect the existing implementation before replacing anything. Preserve user edits. Do not assume an implemented candidate is visually approved.

## REFERENCE MATERIAL
All ten videos in `motivation/` are visual references, not implementation instructions. Their underlying rendering techniques are unknown.
- `i0asis.mp4`: large creature silhouettes, boss combat, terrain, lighting and effects.
- `snapgram.io_wng8vz6wi6a5.mp4`: tall architecture, stairs, rooftop traversal and visual depth.
- `snapgram.io_DfAg2Othm3G.mp4`: detailed characters, horse, grass and animated hair.
- `snapgram.io_dsjylai6ml3t.mp4`: flowing water, foam, banks and reflections/highlights.
- `snapgram.io_16u8lb6kj1o9.mp4`: monochrome world and local illumination masks.
- `snapgram.io_2zuaptu2d87t.mp4`: layered architectural study and snowfall.
- `snapgram.io_3czvsvhu3yic.mp4`: animated forms, flowing tentacles and color variation.
- `snapgram.io_bs9g7k2yhz70.mp4`: strong silhouettes, restrained palette and atmospheric composition.
- `snapgram.io_2wlfwmjgrxwm.mp4` and `snapgram.io_w29xqu2rt6ps.mp4`: fine glyph density, shaded forms and character-art presentation.
Aim for detailed, recognizable, shaded objects made of fine glyphs, with stable textures and purposeful animation. Translate the style into feudal Japan: a ronin, mountain pines, bamboo, villages, shrines and waterways. References do not require multiplayer, MMO networking or copying their UI.

## HARD CONSTRAINTS
- Vite + strict TypeScript; HTML5 Canvas 2D. No WebGL, Three.js, 3D models or game engine.
- Gameplay art consists of colored monospace glyphs. HTML controls are allowed in the development workshop.
- No new runtime dependencies without a concrete need. Keep asset generation independent of browser APIs.
- Target 60 FPS at 1920x1080 for the eventual representative world scene. Measure actual browser/hardware/grid settings; never infer performance from a successful build.
- One asset contract and renderer shared by asset definitions and the playable world. Do not author a second independent copy of each asset inside a scene renderer.
- Build iteratively. Run relevant checks and capture browser screenshots. User feedback in conversation is separate from automated technical validation. Do not implement approval workflows in the app.

## REUSABLE ASSET ARCHITECTURE
An asset definition has a stable ID, version, category, local cell bounds, ground/contact anchor, variants and a frame generator. Generator inputs include time, deterministic seed, variant, direction and action. Output cells specify local x/y, one glyph and a color. Missing cells are transparent.

Support two forms through this common contract:
1. Authored frames/layers for characters, equipment, buildings and distinctive props.
2. Deterministic procedural generators for vegetation, ground cover, water, weather and flexible details.

World placement is an instance containing an asset ID, position, elevation, seed, variant and animation state. Keep collision footprints and gameplay behavior separate from visual cell data. Never bake camera coordinates or scene placement into reusable definitions. Missing symbols, invalid bounds and malformed palettes should fail visibly during development.

Cache rasterized glyphs and reuse them when composing frames. The scene renderer caches glyph pixels and composites one CPU framebuffer for upload. Transparent cells are omitted; later instances overwrite earlier cells in depth order. Do not silently fall back to spaces. Match font metrics and cell aspect ratio; avoid stretching the final canvas to arbitrary viewport proportions. Keep world scale consistent across assets and display densities.

Directly authored/generated glyphs are the primary asset path. The old scene-buffer/Sobel/material conversion modules remain legacy experiments; they are optional future tools for specific needs, not a mandatory parallel render pass. Do not spend each normal game frame rendering the hidden legacy scene.

Use stable seeded texture anchored to assets/world surfaces. Separate static detail from animated layers. Avoid random flicker, identical filled ellipses for every tree, and one uniform character across large surfaces. Lighting should eventually affect glyph color/density coherently while preserving silhouettes.

## PRESENTATION AND FEEDBACK
- Open `/` for the full-screen playable river demonstration. The old scene remains at `?mode=game` for comparison.
- Show the assets as part of the environment, as in the reference videos. No dashboard, cards, approve/reject buttons, review storage or review export.
- Controls: WASD/arrows move, Shift runs, mouse wheel zooms, V switches robe variant, P pauses animation/movement, R resets position/zoom, click/tap walks toward a point.
- Screenshot the actual game scene for discussion. The user gives feedback in conversation, and the developer refines the asset definitions.
- Make the running scene visually substantial: shaded character form, layered clothing, hair motion, dense coherent grass, dark cut banks, water highlights/wakes, depth-sorted rocks and trees.
- Keep this a reusable asset foundation: character, pine, rock and landscape definitions are independent modules. Scene instances set position, scale, seed and variant.

## BUILD PHASES
### Phase 1 - Reusable ASCII assets in a playable scene (CURRENT)
Build the shared asset contract, deterministic procedural/shape authoring and cached glyph renderer. Demonstrate a shaded ronin, mountain pines, stones, dense animated grass and a flowing river together in a full-screen walkable scene. Add robe variants, hair/cloth motion, actor movement, zoom, pause and wakes while wading. Keep generators reusable outside this scene.
Acceptance: assets render without runtime errors; seeds repeat exactly; variants differ; applicable animations change over time; generated cells stay in bounds; character silhouette/feet remain readable; camera movement preserves world-anchored texture; depth sorting allows walking behind props; river movement creates wakes; desktop/mobile controls work. Run `npm test`, `npm run build`, and browser movement/pause/zoom checks; save game screenshots. Report actual performance and visual limitations. User feedback happens in conversation, not through app UI. Do not claim reference-level quality from tests alone.

### Phase 2 - Approved reusable asset library
Refine Phase 1 candidates against the reference videos and user feedback. Add authored character animation clips (idle, multi-frame walk and facing directions), layered equipment/cloth, several tree silhouettes, grass/flower variants, rocks, soil/path patches, bamboo and a lantern. Add building modules: foundation, wall, roof, stair, fence and torii. Expand the catalog incrementally and show new candidates directly in the running scene. Do not add review import/export or approval controls.
Acceptance: the user has reviewed the starter assets in conversation; each has a stable anchor, documented scale and version; animation contact points remain stable; silhouettes work at gameplay size; no unknown glyphs or scene-specific placement in asset definitions. Validate layering and transparent cutouts.

### Phase 3 - World composition and map data
Create a small composition sandbox using the approved catalog. Store asset instances and terrain data separately from rendering. Add a shared camera/projection, placement selection, save/load map JSON, consistent scale, collision footprints and depth-aware occlusion. Include a raised gatehouse with stone foundations, stairs, foliage and one ronin as an architectural benchmark.
Acceptance: the same definitions can be instantiated in different maps; multiple instances share definitions while keeping independent seeds/state; save/load preserves placement; actors can move behind/in front of props; elevation and stairs align with visible surfaces. Test data round trips and collision boundaries. Do not use unrelated hardcoded coordinate copies for drawing and traversal.

### Phase 4 - Open-world exploration foundation
Expand the sandbox into connected village, bamboo forest and mountain shrine regions. Add chunked world data, load/unload around the camera, stable coordinates/seeds across chunk boundaries, smooth camera follow and player movement, elevation-aware collision/traversal, interactions and persistent world changes. Add restrained rain, fog, lantern light and water animation through reusable systems.
Acceptance: cross chunk boundaries without seams, regenerated texture or lost state; returning to an area restores changes; offscreen work is culled; memory does not grow without bound; movement and occlusion remain coherent around stairs/buildings. Profile a representative populated region against the frame budget.

### Phase 5 - Combat, inhabitants and progression
Implement stamina, dash with invulnerability frames, light combo, heavy slash, a tight parry window and charged iaijutsu. Use reusable character animation/effect definitions for slash trails, sparks, blood, hit-stop and screen shake. Add data-driven spearman, swordsman, archer and kitsune behavior, readable telegraphs, enemy posture, stealth and a multi-phase Oni boss. Add NPC interaction, short dialogue, basic quests and persistent progression across connected regions.
Acceptance: test combat timings, damage/posture, stamina and death/recovery; prevent attacks across disconnected elevations; telegraphs stay legible in dense scenery; state survives region changes; confirm feel in the browser. Keep the focus on a playable single-player open world.

### Phase 6 - Presentation, polish and release validation
Add title/pause/death/settings screens, glyph HUD, synthesized or replaceable audio, gamepad support and settings persistence. Tune font metrics, material shading, local lighting, weather, accessibility and performance. Profile generation, culling, glyph caching and upload costs before optimizing. Add detail/density settings without changing physical proportions.
Acceptance: build outputs a static deployable `dist`; verify a full exploration/combat/save/reload flow; measure sustained FPS at the actual target settings; report remaining limitations and reference mismatches. Show game screenshots and summarize the latest user feedback. Do not deploy externally without authorization.

## CODE ORGANIZATION AND HANDOFF
- `src/assets/`: reusable contracts, authored definitions and procedural generators.
- `src/render/assetRenderer.ts`: shared cell-to-canvas renderer.
- `src/riverScene.ts` and `src/riverScene.css`: full-screen playable asset demonstration.
- `src/assets/landscape.ts`: continuous world-anchored meadow and river sampling.
- `src/engine/`: loop, input, camera, audio and later streaming infrastructure.
- `src/game/` and later `src/data/`: gameplay, world instances and region data.
- `tests/`: deterministic generator checks and playable-scene browser checks.
- `artifacts/preview/`: current game screenshots; `artifacts/DEEPSEEK_HANDOFF.md`: continuation details.

Strict TypeScript, no `any`. Keep shared engine settings in configuration, asset-specific palettes/geometry with their definitions, and gameplay tunables in data. Preserve existing work; migrate legacy code only as replacements are verified. Keep both master prompt files identical, maintain active-task/checkpoint notes, and distinguish tests passed, visual checks performed, user feedback and remaining work.

Continue Phase 1 from the existing implementation. Show the user the running scene and gather feedback before expanding to Phase 2. Do not recreate the removed workshop/approval UI. Do not restart scaffolding or treat later phases as already authorized for immediate implementation.
