# KAGE agent work streams — shared rules

Agents work in parallel. Each owns a set of files and must not edit anything
else. Claude reviews every change before it is merged into the game.

## Round 3 (current, 2026-11-25) — 3D models + one ASCII pass (`/proof.html`)

The owner chose the 3D-models-plus-ASCII proof over the old glyph game. Read
`artifacts/CLAUDE_MASTER_PROMPT.md` first, especially "THE OWNER'S CURRENT VERDICT" and
"VISUAL TARGET". **Rounds 1–2 below describe the old pipeline; it is frozen. Ignore their
"rejected 3D look" note: that was perspective 3D without a calm ASCII pass.**

| Brief | Owner | Files you may edit |
| --- | --- | --- |
| `I-look.md` | Agent I | `src/proof/ascii.ts`, new files under `src/proof/look/**` |
| `J-world.md` (**first priority: the open world**) | Agent J | `src/proof/world.ts`, new files under `src/proof/world/**`, new model packs under `public/proof/models/**` (+ `CREDITS.txt` lines) |
| `K-actors.md` (after J) | Agent K | `src/proof/actors.ts`, new files under `src/proof/actors/**`, new model packs under `public/proof/models/**` (+ `CREDITS.txt` lines) |

Claude owns `proof.html`, `src/proof/main.ts`, `src/proof/assets.ts`, `package.json`,
`CLAUDE.md`, the master prompts. Do **not** edit anything under `src/` outside your row, and do
not change the exported interfaces (`AsciiPass`, `World`, `Collider`, `Actors`) — if you need a
change there or in `main.ts`, write it in your hand-off note and Claude does it.

Rules for every round-3 agent:
- Only CC0 models with a confirmed licence. Add one line per pack to
  `public/proof/models/CREDITS.txt` (author, licence, URL). Keep only the files you use.
- Seeded random only for anything placed in the world (no `Math.random()` in layout).
- Test in the running page with a real GPU (master prompt, "HOW TO TEST"). Report measured
  FPS at 1920×1080 while walking, and before/after screenshots saved in
  `artifacts/agents/<letter>-shots/`.
- `npx tsc --noEmit -p .` and `npm test` pass. Do not commit; write
  `artifacts/agents/<letter>-handoff.md`: what changed, files, numbers, screenshots, open issues,
  anything Claude must wire.

## Round 2 (frozen old pipeline) — art: environment, wildlife, characters, world

| Brief | Owner | Files you may edit |
| --- | --- | --- |
| `E-trees.md` | Agent E | `src/assets/trees/**`, `src/assets/pine.ts`, `src/assets/flora.ts` |
| `F-wildlife.md` | Agent F | `src/assets/animals/**`, `src/assets/creatures.ts`, `src/game/wildlife.ts`, new `tests/wildlife.test.mjs`, `artifacts/agents/F-preview/**` |
| `G-characters.md` | Agent G | `src/assets/people/**`, `src/assets/characters.ts`, `src/assets/horse.ts`, `src/assets/authored.ts` |
| `H-world.md` | Agent H | `src/assets/landscape.ts`, `src/game/landmarks.ts`, `src/game/worldChunks.ts`, `src/game/colliders.ts` |

Do **not** touch: `src/render/**`, `src/riverScene.ts`, `src/assets/catalog.ts`,
`src/assets/types.ts`, `src/assets/shapes.ts`, `src/engine/**`, `src/three/**`,
existing tests, `package.json`. New assets register through your folder's `index.ts`
(already wired into the catalog). If you need a change elsewhere, write it in your
hand-off note — Claude does it.

**What the owner rejected (do not repeat):** a 3D-model look (Three.js meshes through an
ASCII filter: "blurred", "stupid"); tiny facial details that turn to noise; fake animation
by shearing rows/columns sideways (it doubled the horse's front leg); evenly spaced,
synchronized particles ("too organized"); one repeated tree; "all forest".
**What the owner liked:** the 2D hand-made glyph art, the knight, dark night scenes with a
bright lit subject, water glints, the reference videos in `motivation/` (Ansenjeo).

### How the picture is made now (round 2)

- The game is 2D glyph art (`src/riverScene.ts`). Each frame the CPU decides every cell's
  glyph and lit colours (`src/render/assetRenderer.ts`), then **Three.js draws it on the
  GPU** (`src/render/gpuPresenter.ts`): crisp glyphs, bloom on bright cells (fire, lamps,
  glints, white horse), water reflections, snow cover, lightning. `?gpu=0` = old CPU path.
- Props get **volume shading** (dark at the base, lit toward the top) and cast shadows;
  actors stay bright with a dark side/top halo. So author clean albedo and strong shapes.
- Grass glyphs `| / \ !` in the terrain sway in the wind automatically.
- Weather (`T`): clear, rain, storm, snow, firefall. `B` sets a building on fire.
- Keys 1–0 jump between regions; `?area=<id>` in the URL; `?debug=water` tints water.

## Round 1 (done, merged)

| Brief | Owner | Files |
| --- | --- | --- |
| `A-people.md` | Agent A | `src/assets/people/**` |
| `B-buildings.md` | Agent B | `src/assets/buildings/**` |
| `C-world.md` | Agent C | world files |
| `D-physics.md` | Agent D | `src/engine/**` |

## How the game works (read before writing art)

- Everything on screen is a grid of **glyph cells**: one character + one colour
  (`{ x, y, glyph, color }`, colour `#rrggbb`, glyph exactly one character).
  See `src/assets/types.ts` (`AsciiAsset`, `AsciiCell`, `noise`, `validateFrame`).
- An asset is a pure function `generate({ time, seed, variant, facing, action })`
  that returns cells in **asset-local coordinates** (0..width-1, 0..height-1).
  `anchor` is the ground-contact point (feet / base of a wall).
- Draw with `GlyphShape` (`src/assets/shapes.ts`): `ellipse`, `polygon`, `line`,
  `cell`, then `frame(flip)`. `ellipse`/`polygon` already shade with a glyph ramp
  (`.,:;+=oxO#%@`) and a palette from dark to light. Look at `pine.ts`,
  `props.ts`, `creatures.ts`, `tower.ts` for working examples.
- The renderer (new, `src/render/assetRenderer.ts`) **lights the scene for you**:
  sun/moon direction, cast shadows from every prop, rim light on silhouettes,
  lantern light, day/night colour. So:
  - Author **albedo** colours (the material's own colour, mid-brightness). Do not
    paint ground shadows or night darkness into an asset.
  - Do shade *form* inside the asset (lighter top/left, darker underside, folds),
    and use glyph **density** for form: sparse glyphs (`.,:;'`) for thin/dim parts,
    dense glyphs (`#%@O0X`) for solid, bright parts.
  - Leave transparent cells out of the frame; never fill a rectangle background.
- Assets are drawn **smaller than authored** (usually 0.25–0.6×). The renderer
  averages colours when shrinking, so author generously (big, clean shapes,
  strong value contrast between parts). Tiny 1-cell details disappear.
- `variant` = visibly different version (palette/outfit/state). `seed` = small
  natural variation (noise, accessory placement). Both must change the output.

## Scale reference (world units; the knight is 41 tall)

| Thing | World height | Typical authored height → placement scale |
| --- | --- | --- |
| Human / elf | 41–46 | 120 cells → scale 0.34–0.38 |
| Dwarf / goblin | 28–32 | 90 cells → 0.33 |
| Orc | 50–56 | 140 cells → 0.38 |
| Cottage | 90–110 | 180 cells → 0.55 |
| Manor / tavern | 140–180 | 220 cells → 0.7 |
| Tree (oak, willow) | 120–200 | 260–320 cells → 0.5–0.65 |
| Pine / cypress | 140–220 | 300 cells → 0.6 |
| Bush / reeds | 15–40 | 60–100 cells → 0.35 |
| Cow / horse | 32–36 tall, 60–70 long | 100×190 cells → 0.35 |
| Buffalo | ~40 tall, ~70 long | 110×200 cells → 0.36 |
| Small bird | 4–8 | 24–40 cells → 0.2 |

## Definition of done (every stream)

1. `npm test` passes (it validates every asset: bounds, glyph/colour format,
   determinism, seed affects output, non-Prop assets animate with `time`).
2. `npx tsc --noEmit -p .` passes (strict TypeScript, no unused variables).
3. No new dependencies. No WebGL. No image files at runtime.
4. Run `npm run dev` and look at your work in the game (see your brief for how).
5. Write a hand-off note at `artifacts/agents/<your-letter>-handoff.md`: asset ids,
   what each variant is, known weaknesses, anything you needed outside your files.
