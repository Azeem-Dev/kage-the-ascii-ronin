# Agent C — World: colourful terrain, regions and placement

Read `artifacts/agents/README.md` first. You edit only:
`src/assets/landscape.ts`, `src/game/landmarks.ts`, `src/game/worldChunks.ts`,
`src/game/colliders.ts`, `src/assets/flora.ts`.

## Goal

Turn the uniform dark grass into a varied, **colourful** world, and add populated
places. The new renderer lights and shades everything, so terrain colours should be
the ground's own colour (albedo), not pre-darkened.

## 1. Terrain (`landscape.ts`)

`landscapeCell(x, y, time, seed)` returns one glyph cell per world cell, or `null`.
- **Never return `null` for land**: return `{ glyph: ' ', color: <ground colour> }`
  for bare cells. The renderer uses a cell's colour as a dim background fill, so a
  space with a colour paints ground; `null` leaves a black hole.
- Ground types (each with its own 5–6 colour palette, glyph set and density):
  lush meadow (greens with yellow-green highlights, clumps), flower fields
  (dense blue/pink/purple/gold dots), dirt road (warm brown, sparse `.,` and ruts),
  cobblestone (grey/blue-grey `o O 0 =` blocks with dark joints), farmland
  (straight crop rows: wheat = gold `| ! '` rows, cabbage = green `o` rows),
  mud/outskirts (brown-grey, puddles), forest floor (dark green/brown, needles),
  sand/riverbank.
- Use large-scale noise for patches so it never looks like a repeated texture.
  Keep glyph choices **stable** over time (only wind may change grass direction;
  never reseed per frame — that causes flicker).
- Keep the river functions (`riverCenter`, `riverWidth`, `waterDepth`) and their
  signatures; other code depends on them. Water colours may become richer.

## 2. Regions (`landmarks.ts`)

Add landmarks (keep the existing four). Suggested positions (world units; the
existing map spans roughly x 100–600, y -50–450):

| id | key | Name | Where | Character |
| --- | --- | --- | --- | --- |
| `town` | Digit5 | Highmere (rich town) | x≈900, y≈230 | cobbled square, manor, townhouses, tavern, market, lamp posts, nobles, merchants, guards |
| `outskirts` | Digit6 | Mudgate (poor outskirts) | x≈700, y≈330 | mud, hovels, ruin walls, campfire, beggars, peasants |
| `village` | Digit7 | Oakhollow (farm village) | x≈760, y≈-60 | cottages, fields, haystacks, carts, well, fences, farmers, peasants |
| `goblins` | Digit8 | Goblin warren | x≈-60, y≈220 | ruin walls, campfire, banner (tattered), goblins |
| `orcs` | Digit9 | Orc warband | x≈150, y≈640 | campfire, banners, barrels, orcs |
| `elves` | Digit0 | Silverleaf grove | x≈520, y≈620 | flower field, lamp posts (wooden), elves |

Connect regions with dirt roads in `landscape.ts`. Each region needs `spawnX/spawnY`
on open ground. `?area=<id>` and the number keys then work automatically.

## 3. Placement (`LANDMARK_PROPS`)

Use these asset ids from Agents A and B (they may not exist yet; the game skips
unknown ids with a warning until they do):
people `goblin orc elf dwarf-townsfolk peasant beggar farmer merchant noble guard`;
buildings `hovel cottage townhouse manor tavern market-stall well fence cart
haystack barrels lamp-post campfire banner ruin-wall`; existing `pine rock tent
lantern flowers-* butterfly-* bird`.
- Lay out streets/plazas deliberately: buildings face the road, a market square in
  town, fields in rows around the village, a scattered messy camp in the outskirts.
- Use the `variant` field to mix versions; `faction`: townsfolk `friendly`, goblins
  and orcs `hostile`, animals `ambient`.
- Scales: see the table in README.md.
- In `worldChunks.ts`, keep procedural trees out of settlements and roads, and add
  variety outside them (more flowers, rocks, groups of trees).

## 4. Colliders (`colliders.ts`)

Assets may now declare `footprint` (handled automatically). Keep existing cases.
Make sure roads and doorways between buildings stay walkable (hero radius 2,
mounted 4).

## Rules

- Everything deterministic: same seed → same world, including after chunk reload.
- Keep `npm test` passing (it includes river and collider checks).
- Do not change exported function signatures other files use (`regionAt`,
  `LANDMARKS`, `LANDMARK_PROPS`, `generateChunk`, `WorldChunks`, `riverCenter`,
  `riverWidth`, `waterDepth`, `landscapeCell`, `collidersFor`).

## How to look at your work

`npm run dev`, open `http://localhost:3000/?area=town` (or village, outskirts, …),
or press the number keys. Mouse wheel zooms (0.4–1.8). Check zoomed out too.
