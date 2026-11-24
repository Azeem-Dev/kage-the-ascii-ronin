# MASTER PROMPT — "KAGE: The ASCII Ronin" (2D ASCII Samurai Action Game)

## ROLE
You are a senior game engineer and technical artist. Build a complete, polished, browser-based 2D action game whose entire visual output is rendered as colored ASCII glyphs. Work in phases, verify each phase in the browser (take screenshots), and do not move to the next phase until the acceptance criteria pass.

## HARD CONSTRAINTS
- NO 3D. No Three.js, no WebGL, no Babylon, no raymarching, no 3D models. Only HTML5 Canvas 2D.
- Stack: Vite + TypeScript (strict). No game engine. Zero runtime dependencies except optional Howler.js for audio (or plain WebAudio).
- Everything visible on screen in gameplay is drawn as monospace characters on a grid. No raw sprites/pixels reach the final screen (UI menus may use ASCII box-drawing too).
- Target 60 FPS on a mid-range laptop at 1920×1080. Fixed-timestep game loop (60 Hz update, interpolated render).
- Clean architecture: /src/engine (loop, input, ecs-lite, camera, audio), /src/render (scene buffer, ascii pass, lighting, particles), /src/game (player, enemies, combat, levels, ai), /src/ui, /src/data (levels as JSON/TS).

## THE CORE TECHNIQUE (most important — get this right first)
Two-stage rendering pipeline:

1. **Scene Buffer (hidden, low-res):** An offscreen canvas at the character-grid resolution × small factor (e.g. grid 200×112 cells → buffer 400×224 px). Draw the world here with simple 2D shapes, gradients and tiny procedural pixel-art: ground, walls, roofs, trees, lanterns, characters. Use a 3/4 top-down oblique view (like classic Zelda / the screenshot reference) with y-sorting for depth — still pure 2D.

2. **ASCII Pass (visible):** For each grid cell, sample the buffer region → compute average color + luminance + edge direction (Sobel on luminance).
   - Luminance → density ramp: ` .,:;-=+*cxoO#%@` (configurable).
   - Strong edges override with directional glyphs: `| / — \` so roof lines, fences and walls read crisply.
   - Material override channel: draw a second hidden "material/ID buffer" where each material has a code (grass, wood, stone, water, blood, fire, cloth, foliage). Materials can force their own glyph sets: grass `"'`,.`, foliage `&%*`, water `~≈`, rain `|/`, blood `▓▒░ *`, fire `^*'`, wood planks `=≡`, roof tiles `/\^`.
   - Glyph color = sampled color, with saturation/brightness boost and a slight dark background tint per cell (not pure black) for that glowing CRT look.
   - Performance: pre-render all glyphs × a quantized palette (e.g. 64 colors) into a glyph atlas canvas once; blit with drawImage. Never call fillText per cell per frame.
   - Debug keys: F1 = toggle raw scene buffer view, F2 = material buffer view, F3 = FPS/cell stats, F4 = cycle glyph ramps.

## ART DIRECTION
- Mood: feudal Japan at night, moonlit, rain and mist. Mostly desaturated blue/grey/green glyphs; warm amber light from paper lanterns and shoji windows; red reserved ONLY for blood, torii gates and danger.
- 2D lighting: a light map (radial gradients from lanterns, torches, moon direction) multiplied into the scene buffer before the ASCII pass, so glyphs near light become denser and warmer. Flickering lanterns.
- Atmosphere layers: drifting fog (scrolling noise), rain (falling `|` and `/` glyphs, splash `.` `°` on impact), falling sakura petals `✿ ·` in some levels, fireflies.
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

**Story hook (minimal):** A masterless ronin hunts the oni that burned his clan's shrine. Short ASCII-text dialogue boxes, typewriter effect, no cutscenes.

## UI (all ASCII)
- Title screen: big ASCII-art "KAGE" logo built from the same pipeline (render text into the buffer, ASCII-ize it), rain in the background, "Press Enter".
- HUD: health/stamina as glyph bars `[████░░░░]`, small and in the corner. Enemy posture bar above the enemy.
- Pause menu, death screen ("死" kanji rendered big in glyphs), level-complete screen.
- Settings: glyph ramp choice, grid density (Low/Med/High cell count), screen shake on/off, volume.

## AUDIO
WebAudio: rain loop, wind, katana unsheathe/clash/slice, footsteps on wood vs grass, a low taiko drum during combat that fades out after. Use placeholder synthesized sounds if no assets; structure the code so real files can be swapped in.

## BUILD PHASES (verify each in the browser with screenshots before continuing)
**Phase 1 — ASCII renderer:** Vite+TS setup, scene buffer, ASCII pass with glyph atlas, a static test scene (house, fence, tree, lantern, moon). Debug toggles F1–F4.
✅ Accept: scene clearly readable as ASCII, roof/fence edges use directional glyphs, ≥60 FPS at High density.

**Phase 2 — World & atmosphere:** tilemap, y-sorting, camera, light map with flicker, rain, fog, petals.
✅ Accept: walk a placeholder dot around the village; lighting and weather look like the reference mood.

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
