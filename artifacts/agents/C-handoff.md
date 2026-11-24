# Agent C hand-off — World, terrain, regions and placement

## Status

Reviewed and retained the previous Agent C implementation. No commits, dependencies, WebGL, or runtime image files were added.

Files changed by this review:

- `src/game/landmarks.ts`: moved the Mudgate spawn to a clear road position and removed one misplaced townhouse that intruded into Mudgate.
- `src/assets/landscape.ts`, `src/game/worldChunks.ts`, `src/game/colliders.ts`, `src/assets/flora.ts`: reviewed and retained unchanged.

Final verification:

- `npx tsc --noEmit -p .` — PASS.
- `npm test` — PASS, including assets, river/collider checks, determinism, physics, softbody and fixed-step tests.
- `LANDMARK_PROPS` — 208 placements, 208 unique placement IDs, 54 distinct referenced asset IDs.
- Missing referenced assets at final hand-off — none.
- Browser check — Highmere at default and zoomed-out views, Oakhollow, and Mudgate rendered without console errors; sampled telemetry was 59–60 FPS in the 1536×770 browser pane.

## New regions

The four original regions remain unchanged. Six regions were added:

| id | key | Name | Center | Spawn |
| --- | --- | --- | --- | --- |
| `town` | `Digit5` | Highmere | `(900, 235)` | `(850, 262)` |
| `outskirts` | `Digit6` | Mudgate | `(700, 330)` | `(724, 310)` |
| `village` | `Digit7` | Oakhollow | `(760, -60)` | `(770, -22)` |
| `goblins` | `Digit8` | Goblin Warren | `(-60, 222)` | `(-15, 238)` |
| `orcs` | `Digit9` | Orc Warband | `(150, 640)` | `(205, 625)` |
| `elves` | `Digit0` | Silverleaf Grove | `(520, 620)` | `(560, 648)` |

All ten regions, including the original four, have a sampled dirt/cobble road connection. Every hero spawn and the game's mounted-horse offset `(spawnX + 27, spawnY + 16)` are on non-water ground and clear of current colliders for radii 2 and 4 respectively.

## Terrain work retained

`src/assets/landscape.ts` now provides:

- Lush meadow greens with stable clumps and wind-only sway.
- Dense flower fields using blue, pink, purple, gold, cream and coral blooms.
- Warm dirt roads with sparse gravel and ruts.
- Grey/blue-grey cobblestone with staggered blocks and dark joints.
- Farmland with straight wheat and cabbage rows separated by furrows.
- Brown-grey Mudgate mud with dark puddles.
- Dark green/brown forest floor with needle and litter glyphs.
- Sand and a distinct darker riverbank band; water colours were also enriched.
- Highmere town grass/lawns and cobbled plaza/streets.
- Goblin warren ground and Orc ash/ember ground.

Additional retained behaviour:

- Hand-placed road network with a 16-unit spatial grid for `roadDistance`.
- Large-scale woodland/flower noise and smooth tint fields.
- World-anchored, deterministic terrain sampling.
- Land never returns `null`; bare ground is a coloured space. Only water may return `null`.
- `riverCenter`, `riverWidth` and `waterDepth` signatures are unchanged.

## Placement work retained

`src/game/landmarks.ts` contains deliberate settlement layouts:

- Highmere: manor, townhouses, tavern, market stalls, well, carts, barrels, lamps, fences, nobles, merchants, guards and townsfolk.
- Mudgate: hovels, ruin walls, campfire, beggars, peasants, carts, barrels, fences and rocks.
- Oakhollow: cottages around a well, fenced lanes, carts, haystacks, farmers, peasants, flowers and birds.
- Goblin Warren: ruin walls, tattered banners, campfire, barrels, tent, rocks and hostile goblins.
- Orc Warband: campfires, banners, barrels, tent, rocks and hostile orcs.
- Silverleaf Grove: lamp ring, flower ring, elves, butterflies, bird and rock.

`src/game/worldChunks.ts` retains seven deterministic procedural slots per chunk, region/road/field exclusions, woodland-weighted trees, small groves, river rocks and flowers. `src/game/colliders.ts` and `src/assets/flora.ts` were already sufficient and were not changed.

## Placement fixes

Previous agent fixes retained:

- Town well: `(900, 238)` → `(900, 218)`, keeping the crossroad intersection open.
- Lamp posts moved off the vertical cobble street: `(900, 290)` → `(888, 290)` and `(900, 190)` → `(912, 190)`.

Review fixes made now:

- Mudgate spawn: `(735, 345)` → `(724, 310)`. The old hero point was clear, but the mounted-horse offset overlapped `mud-hovel-3`; the new spawn is on the incoming dirt road and both bodies are clear.
- Removed `town-house-s2` at `(725, 312)`. It was inside Mudgate, overlapped the incoming road corridor and blocked the original spawn area. Five other townhouses remain, so the rich-town brief is still satisfied.

## Asset IDs referenced by `LANDMARK_PROPS`

All IDs below resolve in `ASSET_BY_ID` at final hand-off.

### Existing world, character, equipment and flora IDs (29)

`anvil`, `bat`, `bird`, `butterfly-blue`, `butterfly-pink`, `butterfly-purple`, `cat-boy`, `cat-girl`, `crypt-arch`, `dwarf-guardian`, `dwarf-neutral`, `flowers-blue`, `flowers-gold`, `flowers-pink`, `flowers-purple`, `gravestone`, `knight`, `lantern`, `moth`, `rock`, `ruined-tower`, `sword-dagger`, `sword-great`, `sword-long`, `sword-rapier`, `sword-sabre`, `tent`, `vampire-boy`, `vampire-girl`.

### People IDs (10)

`beggar`, `dwarf-townsfolk`, `elf`, `farmer`, `goblin`, `guard`, `merchant`, `noble`, `orc`, `peasant`.

### Building IDs (5)

`cottage`, `hovel`, `manor`, `tavern`, `townhouse`.

### Settlement prop IDs (10)

`banner`, `barrels`, `campfire`, `cart`, `fence`, `haystack`, `lamp-post`, `market-stall`, `ruin-wall`, `well`.

During the initial review, the ten people IDs and ten settlement-prop IDs above were still missing while Agents A/B were working. They all landed before final verification. The five building IDs were already present.

## Determinism and verification results

- Repeated `generateChunk` output was byte-identical for `(-4,7)`, `(-1,-2)`, `(0,0)`, `(3,-3)`, `(9,2)` and `(-9,-8)`, including after interleaved generation of other chunks.
- `WorldChunks.around()` returned identical props after distant travel, eviction and reload.
- 15,488 sampled land cells across `x=-180..1150`, `y=-200..750` returned non-null, single-glyph, valid-colour cells.
- Terrain samples were unchanged after interleaved calls with different coordinates, times and seeds.
- All ten hero and mounted-horse spawn clearance checks passed.
- A mounted-radius grid path exists from the camp-side road at `(620,268)` into Highmere at `(900,235)`. Some individual prop footprints clip road edges, but local bypasses keep the route traversable.

## Known weaknesses / outside-file follow-ups

- `src/riverScene.ts` still shows the old control hint `1 Meadow / 2 Camp / 3 Crypt / 4 Forge`. The number-key handler already supports all ten regions; only the HUD text needs updating to mention `5–0`.
- Some market props and Mudgate hovels clip road edges. They do not block the verified mounted route, but a future placement pass could move them farther from the road centre.
- Performance was sampled in a 1536×770 browser pane, not at the owner's 1920×1080 target.
- People remain static placements; NPC behaviour/AI is not part of this stream.
- Agent D's cloth test failed during the initial review at `tests/physics.test.mjs:344`, but Agent D's later fix landed and the final full suite passes.
- No changes outside Agent C's owned source files were needed or made, apart from this required hand-off note.
