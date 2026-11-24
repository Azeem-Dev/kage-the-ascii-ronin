# Agent H-place — placement and collider hand-off

**Status:** complete for this pass. **No commit made.**

## Scope

- Edited only `src/game/worldChunks.ts` and `src/game/landmarks.ts`.
- Reviewed `src/game/colliders.ts`; its inherited scaled-trunk/footprint work was already correct, so this pass made no further collider edits.
- Used the current `src/assets/landscape.ts` read-only. No renderer, scene, catalog, asset, engine, package or test files were touched.

## What changed

### `src/game/worldChunks.ts`

- Added deterministic `dryBankX()` placement for the five starter river rocks. Starter rocks/moss now sit on dry banks, not mid-channel; invalid candidates are filtered out.
- Moved the starter willow off the camp–Silverleaf road to `(525, 278)` and moved `starter-moss-2` to `(178, 274)`.
- Increased the generated-prop road-edge margin from 9 to 14 units for trees, companions and rocks. This protects the travelled lane for a mounted body (radius 4), not just a walking body.
- Companion trees now also re-check settlement/spawn clearance.
- Increased Oakhollow's generated background clearance from 88 to 150 units so the village and fields read as open land.
- Rebalanced farmland background placement to `bush / bush / oak` with a much lower full-size-tree probability. Authored farm groves still supply deliberate shade trees.

### `src/game/landmarks.ts`

- Increased authored-grove road-edge clearance from 11 to 14 units.
- Added `clearOfArrival()` and applied it to river, lake and Ashfork reeds. Reeds may grow in shallow water, but not inside a hero or horse arrival bubble.
- Moved props whose real scaled footprints blocked a road centreline. Exact new positions:

| Prop(s) | New position(s) |
| --- | --- |
| `river-watchtower` | `(215, 225)` |
| `grave-0..3` | y `88 / 97 / 88 / 97` at existing x values |
| `forge-anvil` | `(170, 365)` |
| `camp-tent` | `(535, 205)` |
| `road-lamp-ford-w` | `(260, 236)` |
| `town-tavern` | `(825, 355)` |
| `town-well` | `(940, 190)` |
| `town-merchant-1/2` | `(880, 218)` / `(920, 218)` |
| `town-cart` | `(942, 274)` |
| `town-noble-3` | `(915, 250)` |
| `town-barrels-1` | `(934, 292)` |
| `town-lamp-0` | `(832, 258)` |
| `mud-hovel-2` | `(690, 405)` |
| `mud-hovel-3` | `(785, 395)` |
| `mud-hovel-4` | `(585, 240)` |
| `mud-hovel-5` | `(735, 260)` |
| `mud-fire` | `(735, 340)` |
| `vil-cart` | `(820, 30)` |
| `vil-peasant-2` | `(790, -78)` |
| `gob-goblin-1` | `(-52, 236)` |
| `orc-fire-1` | `(120, 680)` |
| `orc-banner-3` | `(146, 578)` |
| `orc-orc-3` | `(178, 680)` |
| `elf-lamp-3` | existing x, y `+18` |
| `elf-rock` | `(590, 684)` |

- Reduced/rebalanced the four Oakhollow groves to 4/5/4/3 proposed trees, scales `0.49–0.51`, with bushes mixed into three of the groves. The central village clearing remains open.

### `src/game/colliders.ts`

No additional edits. Verified that declared asset footprints take precedence, old `pine` and fallback trunks scale with placement, and footprint-less vegetation/flowers remain non-blocking. Agent E's footprint-declaring trees/shrubs use those declared footprints.

## Verified

- `npm test` — **PASS** on the final tree: 78 assets, 2,568 valid deterministic frames, river semantics, physics, colliders and engine performance tests.
- `npx tsc --noEmit -p .` — **PASS** on the final tree.
- Placement validator over 345 chunks (`cx -8..14`, `cy -4..10`), plus all authored props:
  - 496 authored + 2,005 generated props checked.
  - Unknown asset ids: **0**.
  - Non-reed props rooted in water: **0**.
  - Chunk regeneration mismatch: **0**.
  - Spawn collisions for hero radius 2, standing horse radius 6 and mounted radius 4: **0**.
  - Road-centreline blockers for body radius 2: **0**.
  - Road-centreline blockers for mounted body radius 4: **0**.
- Browser-checked at 1920×1080, DPR 1:
  - Oakhollow at default `0.80` zoom and fully zoomed out `0.40`.
  - Willow Encampment with `?debug=water`: the red mask follows the drawn river; only reeds occupy water. Tree canopies may overhang a bank, but their roots are dry.
  - No errors appeared in the captured console window.
- A full manual ride/walk through every region was **not** completed before the wrap-up request. The automated road-centreline and spawn checks cover every authored road segment and every region arrival point.

## Proposed start position for Claude

Use the Oakhollow village edge at **`(770, -22)`**. It is dry and clear for the hero, mounted body and standing horse; the horse arrives at `(797, -6)`.

Claude must change the default and `R` reset positions in `src/riverScene.ts` (currently the old riverbank start). The existing village lane passes nearby rather than through the exact point; extend its final segment in `landscape.ts` only if an on-road spawn is preferred.

No bridge prop was added. Road crossings remain the authored shallow fords; reeds are the only props intentionally placed in water.

## Performance notes

Observed in the live browser while other parallel agent game tabs were also open:

- Oakhollow, GPU path, default zoom: **1.54 FPS** over a 10.38 s steady rAF sample (16 frames; HUD fluctuated 1–3 FPS), 32 loaded chunks, 481×181 cells. Last-frame diagnostics were about 27.9 ms generation, 0.4 ms terrain and 20.5 ms blit.
- CPU fallback (`?gpu=0`), same viewport: **1.66 FPS** over 10.86 s (18 frames). Last-frame diagnostics were about 62.3 ms generation and 53.6 ms blit.
- Fully zoomed out: **84 loaded chunks**, matching the previous report. The first frame after the zoom/cache transition measured 8,443.9 ms generation and 134.7 ms terrain; this includes cache clearing/recompilation and is not a steady-state placement cost.

The 60 FPS target is **not verified/met** in this parallel-session measurement. The low rAF rate affected GPU and CPU paths and occurred with several other live game tabs, so it should not be attributed to chunk generation alone. Re-measure in an isolated browser after the parallel streams close.

## Foreign failures / remaining work

- The initial `npm test` blocker was Agent F's `sparrow does not animate` assertion in `src/assets/animals/birds.ts`. Agent F fixed it during this pass; the final full suite passes. **No persistent foreign test/type failures remain.**
- `src/assets/landscape.ts` is still foreign H-water work. This placement pass validates against its current wider river/lake/tributary; rerun the placement checks if that file changes again.
- Remaining outside this scope: apply the proposed spawn in `src/riverScene.ts`, complete a human walk/ride visual pass, and investigate/re-measure the live frame-rate target without competing agent tabs.
