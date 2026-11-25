# MASTER PROMPT - KAGE: The ASCII Ronin

## OBJECTIVE AND USER REQUIREMENTS
Build a single-player, story-driven ASCII open-world action game for **web and mobile**.
The hero is **Kage**, a masterless samurai, riding his white horse **Tsuki**. The story, cast,
regions, quests and endings are in `docs/STORY.md`; follow it. The world holds towns, villages,
outskirts, goblins, orcs, elves and dwarves, with rich and poor people.

Show progress inside the full-screen running game, not a dashboard; the owner rejected in-app
approval/rejection controls. Read `CLAUDE.md`, `docs/STORY.md` and `ISSUES.md` before starting;
inspect existing code and preserve user edits.

## DIRECTION (owner-approved 2026-11-25): real 3D models + one ASCII pass
The owner compared the old glyph-sprite game with the proof scene at `/proof.html` and chose the
proof: **"very much better than our previous game"**. That is now the game we build.

How it works (`src/proof/`):
- **three.js scene** of real low-poly 3D models (glTF), lit at night: moon `DirectionalLight` with
  shadows, warm `PointLight`s at lamps/windows/fires, black `FogExp2`, black background.
- **Fixed isometric orthographic camera** (`camDir = (1, .82, 1)`), snapped to whole glyph cells.
- The scene renders into a HalfFloat target at half resolution; **one GPU ASCII pass**
  (`ascii.ts`) turns it into glyph cells: glyph density from brightness, edge glyphs at
  silhouettes, colour from the lit scene, black where there is no light.
- **Models:** free CC0 packs only (KayKit by Kay Lousberg, Quaternius, Kenney, Poly Pizza CC0).
  Files go in `public/proof/models/<pack>/`; every pack gets a line in `CREDITS.txt` with
  author, licence and URL. Never use a model whose licence you cannot confirm.
  (`three/Horse.glb` is unconfirmed: replace it.)
- Same code ships to iOS/Android later through **Capacitor**.

The old glyph-sprite game at `/` (`src/riverScene.ts`, `src/render/**`, `src/assets/**`) is frozen:
do not extend it. Reuse from it only plain logic: `docs/STORY.md`, region names and layout ideas
in `src/game/landmarks.ts`, physics in `src/engine/`.

## THE OWNER'S CURRENT VERDICT ON THE PROOF (fix this first)
"I feel like I am going to vomit, but this is very much better than our previous game."
The direction is right; the picture is **too noisy and too busy**. Measured on the owner's PC
(Intel Iris Xe, 1600×900): ~16% of screen pixels change every frame while walking; 0.7% when
standing still; 30–53 FPS. What makes it nauseating, in order:
1. **Letter soup.** The brightness ramp contains letters (`ixnoesCOQ`) and the edge test fires
   inside grass, so busy areas read as random `u x z T o C G` and `|/-\` confetti.
2. **Rainbow confetti.** Colour is normalised to full saturation even in dim cells, so every
   dark blade is a vivid green/blue/red dot. Dim things must be dim and nearly grey.
3. **No calm surfaces.** Grass, trees, roofs and ground all use the same ramp; nothing is quiet.
   Foliage turns into repeating `+=+=` columns.
4. **Everything flickers under motion.** Glyphs on thin geometry (blades, leaves) flip every
   frame as the hero walks and the wind blows.
5. **No single subject.** The hero is not clearly the brightest, cleanest thing on screen.

Two more owner notes on the proof (same day):
- **"These models look bad, not samurai."** KayKit is chunky big-head cartoon medieval Europe.
  The world is **Kaigen**, a feudal-Japan-inspired fantasy land: wooden houses with curved tiled
  roofs, shrines, torii, stone lanterns, bamboo, pines, rice paddies, bridges; people in
  kimono/hakama, straw hats, armour; believable proportions. Goblins/orcs/elves/dwarves exist
  but live in their own regions.
- **"This isn't exactly open world, neither does it have any story / direction. Let's first make
  the open world."** One village on an empty plane is not the game. Next comes a large walkable
  world laid out from the story's map (riverbank start, ferry, castle-ruin hill, Crypt, Forge,
  Mudgate, Highmere, Goblin Warren, Orc Warband, Silverleaf), streamed in chunks.

## VISUAL TARGET (owner-confirmed 2026-11-25)
Sources: videos in `motivation/`, frame sheets in `artifacts/preview/motivation-review/*.jpg`.
Study the sheets before any visual work.
1. **Near-black world.** Darkness is the canvas; light reveals things (moon, lamps, windows, a
   light pool around the player). Most of the screen is black.
2. **Fine glyphs that read as texture.** At normal zoom you see shapes and light, not letters.
3. **Grass = thin blades.** Calm strokes in a few related greens, patchy, swaying slowly; small
   purple flowers; roads and stone are a separate, quieter surface.
4. **3D models → ASCII.** Dense glyphs where lit, sparse in shadow, clean silhouettes, clear
   colour regions.
5. **One clear subject.** The player is the brightest, cleanest thing on screen.
6. **Colour with purpose.** One colour family per kind of thing: green foliage, purple flowers,
   warm lamp/window/fire light, people brighter than surroundings; the rest dark and cool.
7. **Atmosphere without clutter.** Fireflies, specks, rain, haze; depth, never noise.

### Rejected by the owner (do not repeat)
- 3D with a perspective camera / smooth 3D shading without the ASCII pass ("blurred", "stupid").
- Flat hand-drawn glyph sprites; the old glyph-sprite pipeline in general ("engine is shit").
- Uniform mid-tone scenes where nothing separates ("can't differentiate").
- Blurring glyphs into solid pixel art; a smooth "marble" ground; sparse random tufts.
- Noisy letter soup and saturated confetti ("going to vomit").
- Chunky cartoon fantasy models (KayKit style) for the main world and people ("not samurai").
- A single hand-placed scene presented as the game ("isn't exactly open world").

## TECHNOLOGY AND FILES
- Vite + strict TypeScript, three.js r170 (`three/examples/jsm/...` loaders/utils allowed).
  No other new dependencies without a concrete reason in the hand-off note.
- `proof.html` → `src/proof/main.ts`: renderer, camera (cell-snapped), input, loop, HUD.
- `src/proof/assets.ts`: cached glTF loading, `place()` for static models, `character()` for
  skinned models with `AnimationMixer`, `play()` cross-fades clips.
- `src/proof/ascii.ts`: the ASCII pass (`AsciiPass` interface).
- `src/proof/world.ts`: lights, ground, roads, grass, flowers, fireflies, buildings, trees,
  rocks, props; `colliders()` for obstacles (`World` interface).
- `src/proof/actors.ts`: hero, townsfolk, horse (`Actors` interface).
- Models in `public/proof/models/`, credits in `public/proof/models/CREDITS.txt`.

## CONSTRAINTS
- **Performance:** ≥ 55 FPS at 1920×1080 on the owner's Intel Iris Xe laptop GPU (Chrome,
  ANGLE D3D11), while walking. Mobile later: 30–60 FPS with quality levels. Measure, don't assume.
- **Calm picture:** standing still < 1% of pixels change per frame; nothing flickers that is not
  actually moving.
- **Determinism:** world layout from seeded random only (no `Math.random()` in placement);
  the same place looks the same every visit.
- Never hide or thin trees to gain FPS. Keep loaded models and caches bounded.
- Every visual change: screenshot the running page at default zoom, zoomed in and zoomed out;
  judge it against the VISUAL TARGET and the verdict above before reporting.

## HOW TO TEST
- `npm run dev` → http://localhost:3000/proof.html. Tab toggles ASCII on/off; `[` `]` glyph
  size; wheel zoom; WASD move, Shift run; `?nosnap` disables camera snapping (comparison only).
- `npx tsc --noEmit -p .` and `npm test` must pass.
- Browser checks with Playwright (see `CLAUDE.md` for the path on this PC); launch with
  `channel: 'chrome'` and args `--enable-gpu --use-angle=d3d11 --ignore-gpu-blocklist`, or the
  FPS is meaningless. The page sets `body.dataset.ready = '1'` when loaded and
  `body.dataset.fps` twice a second.

## PHASES
### Phase 1 - Open world + calm look (now; run in parallel)
**Open world first (Agent J):** a large seeded world from the story's map, streamed in chunks,
connected by roads, in a feudal-Japan-inspired style (CC0 models or three.js primitives built
in code); colliders; night lighting. Acceptance: walk from the riverbank to Mudgate and
Highmere; screenshot of every place; FPS while walking.
**Calm look (Agent I):** fix the five verdict problems. Symbol-only glyph sets; colour
saturation follows brightness; edges from depth/normals, not luminance noise; per-category
glyph sets; temporal stability; hero emphasis. Acceptance: owner says it no longer makes them
sick; measured FPS and pixel-change numbers.

### Phase 2 - Story direction
A reason to walk: the Act I path from `docs/STORY.md` as a guided route (wake on the riverbank,
ferry, hill with the missing castle, Crypt, Forge), simple on-screen objective text, place names
when entering a region.

### Phase 3 - Hero, horse and people (Agent K, after the world)
Kage as a samurai (hat, cape, katana; recolour/attach parts to CC0 rigs), CC0 horse with
gallop, mount/dismount (E), townsfolk that wander and react, goblins/orcs/elves/dwarves from
CC0 rigs. Collision with buildings and each other.

### Phase 4 - Story systems
Dialogue (Oyuki at the ferry first), quests, choices, allies, the Blank erasure effect (glyphs thinning `#`→`+`→`.`→ empty
in the ASCII pass), save/load, NPC schedules. Acceptance: Act I playable start to finish.

### Phase 5 - Combat
Light/heavy cuts, parry, dodge, stamina, hit-stop, ink-slash effects; enemies with detection,
windups, attacks and death; mounted combat.

### Phase 6 - Release
Make the 3D+ASCII game the page at `/`; delete the old pipeline. Menus, audio, touch controls,
gamepad, settings, quality presets, Capacitor builds. No deploy or store upload without the
owner's authorisation.

## WORKING MODEL
Parallel opencode agents each own specific files (`artifacts/agents/README.md`, round 3) and
never commit. Claude reviews each hand-off: diff limited to owned files, type check and tests
pass, screenshots and measured numbers checked in the running page, then commits or returns a
fix list.

## CONTINUATION RULES
Keep both master prompts identical. Update `CLAUDE.md` and hand-off notes with exact evidence,
the owner's current feedback, rejected approaches and remaining work. Never claim visual parity,
FPS or completion without measured numbers and screenshots. A command's exit code can come
from a pipe (`| tail`), not the test: read the test output itself.
