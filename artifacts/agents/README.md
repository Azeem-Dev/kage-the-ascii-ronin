# KAGE agent work streams — shared rules

Four agents work in parallel. Each owns a set of files and must not edit anything
else. Claude reviews every change before it is merged into the game.

| Brief | Owner | Files you may edit |
| --- | --- | --- |
| `A-people.md` | Agent A | `src/assets/people/**` only |
| `B-buildings.md` | Agent B | `src/assets/buildings/**` only |
| `C-world.md` | Agent C | `src/assets/landscape.ts`, `src/game/landmarks.ts`, `src/game/worldChunks.ts`, `src/game/colliders.ts`, `src/assets/flora.ts` |
| `D-physics.md` | Agent D | `src/engine/**`, `tests/physics.test.mjs`, new `tests/*.test.mjs` |

Do **not** touch: `src/render/**`, `src/riverScene.ts`, `src/assets/catalog.ts`,
`src/assets/types.ts`, `src/assets/shapes.ts`, tests (except Agent D), `package.json`,
and `src/engine/**` (except Agent D).
If you need a change there, write it in your hand-off note instead.

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

## Definition of done (every stream)

1. `npm test` passes (it validates every asset: bounds, glyph/colour format,
   determinism, seed affects output, non-Prop assets animate with `time`).
2. `npx tsc --noEmit -p .` passes (strict TypeScript, no unused variables).
3. No new dependencies. No WebGL. No image files at runtime.
4. Run `npm run dev` and look at your work in the game (see your brief for how).
5. Write a hand-off note at `artifacts/agents/<your-letter>-handoff.md`: asset ids,
   what each variant is, known weaknesses, anything you needed outside your files.
