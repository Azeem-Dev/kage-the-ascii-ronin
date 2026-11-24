# MASTER PROMPT — "KAGE: The ASCII Ronin" (2D ASCII Samurai Action Game)

## ROLE
You are a senior game engineer and technical artist. Build a complete, polished, browser-based 2D action game whose entire visual output is rendered as colored ASCII glyphs. Work in phases, verify each phase in the browser (take screenshots), and do not move to the next phase until the acceptance criteria pass.

## HARD CONSTRAINTS
- NO 3D. No Three.js, no WebGL, no Babylon, no raymarching, no 3D models. Only HTML5 Canvas 2D.
- Stack: Vite + TypeScript (strict). No game engine. Zero runtime dependencies except optional Howler.js for audio (or plain WebAudio).
- Everything visible on screen in gameplay is drawn as monospace characters on a grid. No raw sprites/pixels reach the final screen (UI menus may use ASCII box-drawing too).
- Target 60 FPS on a mid-range laptop at 1920×1080. Fixed-timestep game loop (60 Hz update, interpolated render).
- Clean architecture: /src/engine (loop, input, ecs-lite, camera, audio), /src/render (scene buffer, ascii pass, lighting, particles), /src/game (player, enemies, combat, levels, ai), /src/ui, /src/data (levels as JSON/TS).

## VISUAL REFERENCE AND TARGET
- Reference: [Instagram reel — playable high ground](https://www.instagram.com/reel/Dfk50iWBdPZ/). Supplied video: `snapgram.io_wng8vz6wi6a5.mp4` (about 32 seconds). The local download is not a bundled project asset.
- Observed reference features: dense, tiny colored glyphs forming a tall ruined tower; visible top surfaces, vertical walls, stairs and rooftop characters; muted grey stone and green vegetation against very dark surroundings; small bright combat effects.
- Match the architectural volume, fine character texture, readable silhouettes and elevated oblique composition. Adapt these qualities to feudal Japan and Kage's existing combat design. The reference does not add an MMORPG or multiplayer requirement.
- The video's underlying rendering technology is unknown. Our implementation remains Canvas 2D with simulated height and depth.
- Phase 1 visual benchmark: a raised Japanese gatehouse on a tall stone foundation, visible stairs and an upper landing, layered roofs, irregular foliage, one lantern and one clearly readable ronin silhouette. Show both top and side faces. A flat village scene is insufficient to validate the target.

## THE CORE TECHNIQUE (most important — get this right first)
Two-stage rendering pipeline:

1. **Scene Buffer (hidden, low-res):** An offscreen canvas at the character-grid resolution × small factor (start with 2×). Draw the world with layered 2D polygons, gradients and procedural material detail. Use a consistent elevated 3/4 oblique projection showing top and side faces. Represent ground position and height separately; project height into a vertical screen offset. Draw foundations, walls, stairs, landings, roofs, foliage and actors in an explicit occlusion order. Ground y-sorting alone is insufficient for tall structures and actors on upper surfaces. Keep surface ownership/elevation available for depth decisions — still pure 2D.

2. **ASCII Pass (visible):** For each grid cell, sample the buffer region → compute average color + luminance + edge direction (Sobel on luminance).
   - Luminance → density ramp: ` .,:;-=+*cxoO#%@` (configurable).
   - Strong edges override with directional glyphs: `| / — \` so roof lines, fences and walls read crisply.
   - Material override channel: draw a second hidden "material/ID buffer" where each material has a code (grass, wood, stone, water, blood, fire, cloth, foliage). Materials can force their own glyph sets: grass `"'`,.`, foliage `&%*`, water `~≈`, rain `|/`, blood `▓▒░ *`, fire `^*'`, wood planks `=≡`, roof tiles `/\^`.
   - Fine glyph density is essential: at 1920×1080, start High near 320×180 cells and tune for legibility and measured performance; this is a starting point, not a proven optimum. Preserve glyph aspect ratio through font selection and cell sizing. Lower presets may reduce detail but must preserve silhouettes and depth.
   - Use stable, seeded material variation anchored to world surfaces: irregular stone courses, cracks, moss clusters, timber grain and layered leaves. Avoid uniform repeating glyph tiles and frame-random texture shimmer. Reserve continuous glyph changes for intentional animation.
   - Glyph color = sampled color with restrained brightness/saturation adjustment. Use near-black blue/green backgrounds and subtle cell tint. Preserve deep shadows; avoid a uniform bright CRT wash. Distinguish lit top faces from darker side faces and contact shadows before sampling.
   - Performance: pre-render all glyphs × a quantized palette (e.g. 64 colors) into a glyph atlas canvas once; blit with drawImage. Never call fillText per cell per frame.
   - Debug keys: F1 = toggle raw scene buffer view, F2 = material buffer view, F3 = FPS/cell stats, F4 = cycle glyph ramps.

## ART DIRECTION
- Composition: architecture must read as a solid volume even at thumbnail size. Use tall foundations, overlapping roof tiers, stairs, recesses and foliage silhouettes. Keep surrounding terrain subdued so the raised structure and actors dominate.
- Texture: fine grey stone glyphs with broken, irregular edges and clustered moss; darker vertical faces; sparse highlights along rooflines, stair edges and exposed corners. Use material-specific character variation without turning every surface into equal-density noise.
- Mood: feudal Japan at night, moonlit, rain and mist. Mostly desaturated blue/grey/green glyphs; warm amber light from paper lanterns and shoji windows; red reserved ONLY for blood, torii gates and danger.
- 2D lighting: a light map (radial gradients from lanterns, torches, moon direction) multiplied into the scene buffer before the ASCII pass, so glyphs near light become denser and warmer. Flickering lanterns.
- Atmosphere layers: subtle drifting fog (scrolling noise), rain (falling `|` and `/` glyphs, splash `.` `°` on impact), falling sakura petals `✿ ·` in some levels, fireflies. Keep weather behind the visual hierarchy: it must not obscure architecture, stairs, characters or attack telegraphs.
- Characters stay readable at small size: strong silhouettes, the player has a distinct color accent (e.g. white headband/katana glint).

## GAMEPLAY
Genre: tight, deliberate samurai action (think Sekiro/Ghost of Tsushima combat ideas in a 2D top-down form). Few enemies, every fight matters.

**Player — the ronin "Kage":**
- WASD / left stick move, Shift dash (i-frames, stamina cost).
- J / X: light slash (3-hit combo). K / Y: heavy slash.
- L / RB: parry/deflect — tight window (~150 ms) = perfect deflect, builds enemy "posture" damage.
- Hold I / LT then release: Iaijutsu quick-draw — a charged single strike that kills instantly when the enemy's posture is broken.
- Health, Stamina, and a Posture bar for enemies (break posture → finisher).
- Hit-stop (2–4 frames), screen shake, slash arcs drawn as glyph trails `─═━`, sparks `*+'` on deflect, blood glyph splatter that stays on the ground for the level.

**Enemies (data-driven, finite-state-machine AI):**
1. Ashigaru spearman — slow, long poke, easy to read.
2. Ronin swordsman — mirrors the player: feints, deflects, punishes spam.
3. Archer — keeps distance, telegraphed with a glyph aim line.
4. Kitsune spirit (yokai) — teleports in fog, swaps glyphs to make it hard to see.
5. Boss: Oni of the Burnt Shrine — big multi-phase fight, fire glyphs, area attacks with clear telegraphs (flashing red cells before impact).
All attacks have a visible wind-up (enemy glyphs brighten / a `!` appears above the head).

**Stealth (light):** Crouch in tall grass `"` to hide, assassinate unaware enemies from behind.

**Levels (3 for v1):**
1. Rain-soaked village at night (tutorial, lanterns, houses with glowing windows).
2. Bamboo forest in fog (stealth focus, kitsune).
3. Burnt mountain shrine (torii gates, boss).
Tile/level data in TypeScript/JSON so new levels are easy to add. Simple scrolling camera with smooth follow and slight look-ahead.
Include walkable raised landings and stairs in the village. Model elevation, surface connections and collision explicitly so actors can climb stairs and stand on upper surfaces without walking through walls or attacking across disconnected heights. This traversal begins in Phase 2; Phase 1 only demonstrates the visual depth with a static actor.

**Story hook (minimal):** A masterless ronin hunts the oni that burned his clan's shrine. Short ASCII-text dialogue boxes, typewriter effect, no cutscenes.

## UI (all ASCII)
- Title screen: big ASCII-art "KAGE" logo built from the same pipeline (render text into the buffer, ASCII-ize it), rain in the background, "Press Enter".
- HUD: health/stamina as glyph bars `[████░░░░]`, small and in the corner. Enemy posture bar above the enemy.
- Pause menu, death screen ("死" kanji rendered big in glyphs), level-complete screen.
- Settings: glyph ramp choice, grid density (Low/Med/High cell count), screen shake on/off, volume.

## AUDIO
WebAudio: rain loop, wind, katana unsheathe/clash/slice, footsteps on wood vs grass, a low taiko drum during combat that fades out after. Use placeholder synthesized sounds if no assets; structure the code so real files can be swapped in.

## BUILD PHASES (verify each in the browser with screenshots before continuing)
**Phase 1 — ASCII renderer and architectural depth:** Vite+TS setup, scene/material buffers, ASCII pass with glyph atlas, and the static raised gatehouse benchmark defined above. Include a ronin silhouette for scale, stone stairs, foliage and restrained lantern lighting. Debug toggles F1–F4.
✅ Accept: fine individual glyphs are visible at native resolution; gatehouse, stone foundation, stairs, upper landing and ronin remain recognizable at thumbnail size; top and side faces read distinctly; overlaps show convincing height; roof/stair edges use directional glyphs without flattening material texture. Capture native-resolution ASCII and raw-buffer screenshots from the same composition. Measure sustained performance at High density at 1920×1080 against the 60 FPS target and report actual grid size, browser and hardware; do not claim the target passed without measurement.

**Phase 2 — World, elevation & atmosphere:** tilemap with surface heights and stair connections, depth-aware drawing order, camera, light map with flicker, rain, fog, petals.
✅ Accept: move a readable placeholder actor from village ground up the stairs to the gatehouse landing and back; walls block movement; upper/lower actors occlude correctly; camera motion preserves stable material texture; lighting and weather maintain the dark reference mood without masking silhouettes or traversal routes.

**Phase 3 — Player & combat core:** movement, dash, combo, parry, iaijutsu, stamina, hit-stop, shake, blood decals. A training dummy.
✅ Accept: combat feels responsive; parry window works; effects read clearly in glyphs.

**Phase 4 — Enemies & AI:** all 4 enemy types, telegraphs, posture system, stealth assassinations.

**Phase 5 — Levels, boss, UI, audio:** 3 levels, Oni boss, all menus, dialogue, sound.

**Phase 6 — Polish & performance:** profile and optimize (dirty-cell updates, typed arrays for buffers), gamepad support, settings persistence in localStorage, `npm run build` produces a static deployable /dist.

## CODE QUALITY RULES
- Strict TypeScript, no `any`. Small focused modules. All tunables (speeds, windows, damage, colors, ramps) in a single `config.ts`.
- Comment the ASCII pipeline thoroughly; it's the heart of the project.
- After every phase: summarize what was built, list known issues, and show a screenshot.

Start with Phase 1 only. Produce the implementation plan first.
