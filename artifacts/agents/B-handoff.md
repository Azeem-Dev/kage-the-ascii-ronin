# Agent B hand-off — buildings and settlement props

## Status

Complete. No commit made. Work is confined to `src/assets/buildings/**` plus this hand-off.

Files changed/added by this stream:

- `src/assets/buildings/parts.ts` — kept all inherited helpers and strict-TS fixes; appended shared `barrel`, `crate`, `pole`, `lantern` and `flame` helpers.
- `src/assets/buildings/settlementProps.ts` — new: the ten remaining assets and their definitions.
- `src/assets/buildings/index.ts` — registers `SETTLEMENT_PROPS` after the inherited `HOUSES`.
- `artifacts/agents/B-handoff.md` — this note.

`src/assets/buildings/houses.ts` was not edited.

## Registered asset ids and variants

All 15 entries in `BUILDINGS` are `category: 'Prop'`.

| id | variants |
| --- | --- |
| `hovel` | Intact / Collapsing / Fire pit — inherited, unchanged |
| `cottage` | Plain / Flower boxes / Lit at night — inherited, unchanged |
| `townhouse` | Blue shutters / Red / Green — inherited, unchanged |
| `manor` | Lord's manor / Merchant guild / Temple — inherited, unchanged |
| `tavern` | Busy / Quiet / Boarded up — inherited, unchanged |
| `market-stall` | Red-white fruit / Blue-white cloth / Green-yellow fish |
| `well` | Stone / Wooden / Mossy; all have a roof, rope, bucket and winding handle |
| `fence` | Wooden / Wattle / Iron; three posts across a 60-cell span |
| `cart` | Empty / Hay / Crates; two spoked wheels, plank bed and shafts |
| `haystack` | Fresh / Old / Pitchfork |
| `barrels` | Two barrels / Three and crate / Stacked crates |
| `lamp-post` | Iron / Wooden / Double |
| `campfire` | Small / Large / Embers |
| `banner` | Red / Blue / Tattered |
| `ruin-wall` | Low / High / Arch; seeded rubble and an open central passage |

Every generator is deterministic, responds to `seed`, and every variant changes the frame. `campfire` and `banner` change with `time` in all three variants; lantern panes also flicker subtly. Existing chimney smoke still animates. The inherited boarded tavern intentionally has no smoke.

## Footprints and lights

All footprint coordinates are asset-local cells relative to the anchor. All are finite, positive-radius circles.

| id | footprint |
| --- | --- |
| `market-stall` | 11 circles, radius 8, along the counter base |
| `well` | 5 circles, radius 15, across the well base |
| `fence` | 9 circles, radius 6, chained along the full fence length |
| `cart` | 3 circles: two wheel bases (radius 20) and the bed centre (radius 23) |
| `haystack` | 5 circles, radius 14, across the stack base |
| `barrels` | 5 circles, radius 15, across the group base |
| `lamp-post` | 1 base circle, radius 11 |
| `campfire` | 1 fire-ring blocking circle, radius 25 |
| `banner` | 1 pole-base circle, radius 8 |
| `ruin-wall` | 12 circles, radius 10, in left/right chains with the central passage open |

Required lights:

- `lamp-post`: `{ x: 0, y: -183, radius: 190, color: [1, .62, .26] }`
- `campfire`: `{ x: 0, y: -8, radius: 145, color: [1, .62, .26] }`

The inherited `cottage` and `tavern` lights were left untouched.

## Visual and runtime verification

- Reviewed isolated contact sheets for all ten new assets and all 30 new variants.
- Reviewed the running game in `?area=town`, `?area=village` and `?area=outskirts` at default zoom, 0.4× and 1.8×, plus night lighting.
- No browser page errors, console warnings or missing-asset warnings in those areas.
- Measured at 1920×1080 in headless Chrome: approximately 60 FPS in all three areas at default zoom and 0.4×. Normal samples were 60.04–60.17 FPS; wide samples were 60.04–60.17 FPS.
- Sampled both reference videos named in the brief and used their strong silhouette/value-contrast approach as the visual check.
- Canvas 2D only. No dependencies, WebGL or runtime image assets added.

## Tests

Final results with all Agent B changes in place:

- `npm test` — **PASS**. Asset suite reports **58 assets, 1,812 valid deterministic frames**; all physics, wind, particle, softbody and fixed-step tests pass.
- `npx tsc --noEmit -p .` — **PASS**. This also verifies the inherited `_u` and `_px` unused-variable fixes in `parts.ts`.

The earlier full-suite cloth-corner failure was in Agent D's foreign physics test and was fixed by that stream before this final run; Agent B did not edit it.

## Integration notes for Claude

1. `src/assets/catalog.ts` already imports `BUILDINGS` and spreads it into `ASSETS` in the current working tree. Keep that import/spread when committing; no additional catalog registration is needed.
2. Agent C's current placements already use these fixed ids and valid variants, including market goods, village fences/hay, town lamps/barrels/cart, outskirts ruins/fire and orc/goblin banners. They rendered without unknown-id warnings.
3. Footprints and lights are declarative fields on the assets; the existing world/collider and river-scene light paths consume them automatically. No renderer or `riverScene.ts` change was required.
4. Commit the buildings files together so `index.ts` never references a missing `settlementProps.ts`.

## Known weaknesses / follow-up

- The asset schema has one static footprint and one static light per id, not per variant. To keep `ruin-wall`'s arch doorway passable, all ruin variants now show a matching central base breach; the arch is simply the wider, dressed-stone version. Likewise, the double lamp uses one broad shared light pool rather than two independent lights.
- Market goods are paired with the three awning variants (fruit/cloth/fish), not independently mixable.
- Fine fruit, fish, emblem and straw details soften at the widest zoom; the large silhouettes and material/value blocks remain readable.
- Footprints are intentional approximations. A future collision playtest may adjust radii, especially the campfire ring and cart bed.
- No interiors, interactive market inventories, NPC behaviours or destructible fences are included in this asset stream.

## Inherited house confirmation

The five pre-existing house assets remain first in `BUILDINGS` ordering and retain their ids, variants, dimensions, anchors, footprints, lights and generators. `houses.ts` was not modified; only additive shared helpers were appended to `parts.ts`. Cottage, townhouse, manor and busy/quiet tavern smoke animation still changes with time, and the hovel fire-pit variant remains animated.
