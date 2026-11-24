# Agent H-water — hand-off (water / terrain half of `H-world.md`)

**Scope honoured:** only `src/assets/landscape.ts` was edited. I did not touch
`landmarks.ts`, `worldChunks.ts`, `colliders.ts`, render/riverScene, catalogs,
engine, tests or package.json. No commit.

## What I did

The inherited `landscape.ts` already carried the big river, Mirrorlake, the
Ashfork tributary, fords, biome ground and roads. I reviewed all of it, verified
it end to end, and made one correctness fix:

- **Sand bars are now genuine dry sand islands.** The previous code capped depth
  at `+12` inside the ellipses, so the bar centres were shallow *water* despite
  the comment claiming dry islands. Added a tiny `barDepth()` profile: flat
  `depth = -3` sand core for elliptical `q < 0.55`, smoothstep ramp back to the
  ambient river depth at `q = 1.6`. The core classifies as `GROUND.SAND`, is
  walkable (`waterDepth <= 0`), produces a real hole in the debug-water mask,
  and stays shallower than the `<= -9` tree-planting cutoff so no tree spawns on
  a bar. Guards widened to cover the full ellipse.

Everything else inherited was kept: `riverCenter`/`riverWidth` meanders, the
per-row water memoisation, the lake ellipse, the tributary with its ford, the
two road fords, the 16 `GROUND` classes, 9 biomes, road/field/clearing rules and
the `landscapeCell` palettes (sand, pebbles, mud, forest, flowers, ash, etc.).

## Water map (world coordinates)

| Feature | Location | Notes |
| --- | --- | --- |
| Main river | centre `x ≈ 330 + 46·sin(.014y) + 16·sin(.033y+.6)`, half-width `≈ 56 ± 14` | spans roughly `x 265…400`; dry at `centre + 100` for every `y` |
| Ashfork tributary | `x ∈ [-120, 380]`, `y ≈ 416 + .035(x+120) + 3·sin(.025(x+120))`, half-width 10→22 | joins the main river near `(380, 433)`; shallow ford at `x ≈ 165` |
| Mirrorlake | centre `(575, 98)`, radii `(82, 52)`, max depth 52 | standing oval east of the river |
| Sand bar 1 | centre `(riverCenter(310) − 10, 310)`, radii `(18, 46)` | dry sand island in mid-channel |
| Sand bar 2 | centre `(riverCenter(−55) + 16, −55)`, radii `(22, 65)` | dry sand island in the north bend |
| Road fords | `y ≈ 250` and `y ≈ 655` | depth × 0.22, still `> 0` so they stay water in debug mode |

`waterDepth` exports unchanged (`riverCenter`, `riverWidth`, `waterDepth`
signatures preserved). It returns one signed number covering all three bodies:
positive = water, negative = dry (with sand/bank band in `(-7, 0)`). Cost: one
row-memoised centre/width/lake-dy, one or two cheap branch/lake tests, and a
sine only inside the tributary x-band. Microbenchmark: a 180×136-cell row scan
calling `waterDepth` **and** `landscapeCell` averages **6.1 ms/frame** in Node;
in-game telemetry stayed at 60 FPS at 1536×770 and at 0.40× zoom.

## Verification

- `npx tsc --noEmit -p .` — **PASS**
- `npm test` — **PASS** (78 assets, 2568 frames, river semantics, determinism,
  chunk regeneration, physics). No new tests added.
- Independent landscape validator also passed all of the above plus: exact
  assertions from `tests/assets.test.mjs` lines 45–50, water coverage over
  `x −200…1200 / y −260…820` (main ~27.9k, tributary ~4.1k, lake ~3.3k samples),
  lake/ford/sandbar depth checks, determinism after 2000 cache-scrambling
  calls, and all 17 ground kinds + all 9 biomes reachable.
- **In-game** (dev server, 2D default path): default zoom, 0.40× fully zoomed
  out, 1.80× fully zoomed in, plus `?area=forge` (Ashfork), `?area=meadow`
  (main river) with `?debug=water`. The red mask traces exactly the dark water
  areas; shadowed forest is not tinted; reeds standing in water are not tinted
  (shader skips prop layers, expected). Sand bars show as tan islands with the
  red mask cut out. No flicker between loads or camera shifts.

## Foreign failures seen during the run (not mine)

- `sparrow does not animate` in Agent F's `src/assets/animals/birds.ts` blocked
  `npm test` early in the session.
- `riverWidth is not defined` in Agent H-place's `src/game/worldChunks.ts`
  (`dryBankX`) blocked both `tsc` and the browser game for a while.

Both were fixed by their owning streams while I worked; final `npm test` and
`tsc` are clean. If either reappears, it is not in my files.

## Notes for Claude

- Mirrorlake is a standalone oval; it does not physically connect to the river.
  The brief only asked for a lake, so I left it. Joining it would need a short
  channel in `waterDepth` — easy if the owner wants one.
- The tributary's west end (`x = -120`) starts at full 10-unit width rather than
  tapering to a spring. It is off the usual play area; taper only if visible.
- Reeds on the banks come from Agent E's `reeds` asset via `worldChunks.ts`;
  I place no props, as instructed.
- My diagnostic images (top-down natural + debug-mask maps) are at
  `C:/Users/Lenovo ThinkBook/AppData/Local/Temp/opencode/map-natural.png` and
  `map-debug.png` if useful during review.
