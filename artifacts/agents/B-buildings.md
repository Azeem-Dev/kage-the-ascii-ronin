# Agent B — Buildings and settlement props

Read `artifacts/agents/README.md` first. You edit only `src/assets/buildings/**`.
Register every asset in the `BUILDINGS` array in `src/assets/buildings/index.ts`.

## Goal

Buildings and props that make convincing towns (rich), villages (modest) and
outskirts (poor), drawn as a **front three-quarter view**: we see the front wall
and the roof slope above it, like the existing tent/crypt arch/tower.

## Shared helpers first

`src/assets/buildings/parts.ts`: reusable drawing helpers built on `GlyphShape`:
roof (thatch `/\\\\` strokes, wooden shingles `=`, slate `#` rows, with a lit
ridge and darker eaves), timber-frame wall (plaster fill + dark beams), stone wall
(irregular blocks with mortar lines via `noise`), door (planks, frame, handle),
window (frame + shutters; lit windows use warm `#ffd27a`-ish glyphs), chimney
(+ optional smoke: a few drifting `.` `°` cells using `time`), steps, sign board.

## Assets (ids are fixed — Agent C places them by these ids)

| id | Description | Variants |
| --- | --- | --- |
| `hovel` | Poor lean-to: crooked planks, patched thatch, rag door, holes | intact / collapsing / with fire pit |
| `cottage` | Village house: timber frame, thatch roof, door, two windows, chimney | plain / flower boxes / lit at night |
| `townhouse` | Two-storey town house: stone ground floor, timber upper floor, shingle roof | blue shutters / red / green |
| `manor` | Rich: stone, slate roof, symmetrical windows, grand door, banners | lord's manor / merchant guild / temple-like |
| `tavern` | Two storeys, hanging sign, lit windows, barrels by the door | busy / quiet / boarded up |
| `market-stall` | Wooden stall with striped awning and goods (fruit, cloth, fish) | red-white / blue-white / green-yellow awning |
| `well` | Stone well with roof and bucket | stone / wooden / mossy |
| `fence` | Fence segment (~60 cells wide), posts + rails | wooden / wattle / iron (rich) |
| `cart` | Hand cart or hay wagon | empty / hay / crates |
| `haystack` | Round haystack | fresh / old / with pitchfork |
| `barrels` | Group of barrels and crates | 2 barrels / 3 + crate / stacked crates |
| `lamp-post` | Iron town lamp post (light source) | iron / wooden / double |
| `campfire` | Fire ring with logs; flickering flames using `time` (light source) | small / large / embers |
| `banner` | Tall pole with a cloth banner moving in wind | red / blue / tattered (orc) |
| `ruin-wall` | Broken stone wall fragment with rubble | low / high / with arch |

`category: 'Prop'` for all. Props do not need to animate, except `campfire`,
`banner` and chimney smoke, which should.

## Footprints and lights (important)

- Every building/blocking prop must define `footprint`: circles in **asset-local
  cells relative to the anchor** (x right, y down) along its base, e.g. a cottage
  140 cells wide → a row of circles of radius ~10 across the base. Leave the
  doorway blocked (no interiors yet). Fences: a chain along their length.
  Tall-grass-like or flat things (none here) get no footprint.
- Light sources (`lamp-post`, `campfire`, lit `tavern`/`cottage` windows) set
  `light: { x, y, radius, color: [r, g, b] }` (local cells from anchor, colour 0..1,
  e.g. `[1, .62, .26]` warm). The renderer turns that into real light at night.

## Quality bar

- Rich vs poor obvious at a glance (straight lines, stone, colour, glass windows vs
  crooked planks, holes, rags, mud-brown).
- Roofs must read as roofs: clear ridge line, overhanging eaves, texture direction.
- Big clean value contrast: lit roof, mid wall, dark door/windows (unless lit).
- Look at the reference video `motivation/Alongside writing the logic...mp4` for
  props, and `motivation/snapgram.io_wng8vz6wi6a5.mp4` for buildings/towers.

## How to look at your work

`npm run dev`; Agent C will place your ids in the town/village/outskirts areas
(`?area=town`, `?area=village`, `?area=outskirts`). Until then, the game skips
unknown ids with a console warning, so you can work independently.
