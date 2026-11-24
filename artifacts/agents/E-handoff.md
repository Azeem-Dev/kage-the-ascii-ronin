# Agent E hand-off — trees, bushes and plants

## Delivered

Registered nine new assets through `src/assets/trees/index.ts` (`TREES`) and rewrote `pine` without changing its id, authored dimensions or anchor. All art is deterministic glyph cells; there are no runtime images, dependencies, renderer edits or world-placement edits.

Shared authoring helpers live in `src/assets/trees/treePrimitives.ts`: irregular broken-edge foliage clumps, tapered trunks, bark marks, flared roots and branches. Canopies sway from `time`; trunks stay fixed. `src/assets/flora.ts` is unchanged (the four existing flower assets remain registered).

## Asset / placement contract

Scales below are suggested **placement scales** (authored cells → world units). Footprints are asset-local circles relative to the anchor; canopies never block movement. `collidersFor()` already consumes these footprints, so no engine change is needed.

| id | variants (index: name) | authored size; anchor | suggested scale | footprint (x, y, radius) | suited biomes / use |
| --- | --- | --- | --- | --- | --- |
| `oak` | 0 Summer; 1 Dense; 2 Autumn | 300×300; (150,286) | .50–.62 | (0,-2,12) | Meadow, farmland, Oakhollow, forest edges; v2 seasonal accent |
| `willow` | 0 River; 1 Silver; 2 Autumn | 300×320; (150,306) | .52–.62 | (0,-2,10) | Riverbanks, lush valley, Willow Encampment |
| `birch` | 0 Spring; 1 Pale; 2 Autumn | 260×300; (130,286) | .48–.60 | (0,-2,6) | Woodland, meadow edges, Silverleaf accents |
| `cypress` | 0 Cypress; 1 Night; 2 Slender | 220×330; (110,316) | .52–.65 | (0,-2,7) | Crypt, forge, elves, Mediterranean/Japanese groves |
| `cherry` | 0 Pink sakura; 1 White sakura; 2 Petal fall | 300×300; (150,286) | .50–.62 | (0,-2,9) | Silverleaf, sakura grove, ornamental village planting |
| `dead-tree` | 0 Bare; 1 Ancient; 2 Frosted | 280×300; (140,286) | .48–.60 | (0,-2,8) | Mudgate, orc waste, crypt, burnt road |
| `pine` | 0 Forest; 1 Moonlit; 2 Snowy tips | 110×110; (54,104) — unchanged | 1.20–1.45 mature; .70–.85 understory | (0,-1,6) | Woodland, crypt, mountain; v2 cold/snow accent |
| `bush` | 0 Small leafy; 1 Berry; 2 Large autumn | 110×80; (55,74) | .35–.50 | (0,-1,5) | Farmland, meadow, waste, forest edge |
| `reeds` | 0 River reeds; 1 Cattails; 2 Dry reeds | 120×110; (60,104) | .30–.42 | (0,-1,3) | Riverbank, pond edge, lush ground |
| `fern` | 0 Forest; 1 Silver; 2 Autumn | 110×80; (55,74) | .35–.45 | (0,-1,2) | Forest floor, crypt, elves |

`pine` is intentionally compact because the brief required keeping its 110×110 authored size. At the old .55–.85 scales it reads as a small/understory pine; use the mature scale above when it should match the 140–220-unit tree scale table. Version bumped to 3 so existing sprite caches invalidate.

## Verification

- Scoped E validation: **PASS — 14 owned assets, 456 deterministic animated frames**, all variants/seeds/facing/actions, bounds, colour/glyph format, animation, variants, seeds and new-asset footprints.
- `npx tsc --noEmit -p .`: **PASS** on the final rerun (strict, no output).
- `npm test`: **PASS — 78 assets, 2,568 valid deterministic frames**, plus the complete physics suite. Earlier in-progress foreign failures (`sparrow` animation and H's missing `riverWidth` import) cleared on rerun; no foreign files were edited.
- Browser: inspected the real running game at meadow, crypt and elves, at default 0.8×, minimum 0.4× and maximum 1.8×. Also rendered every variant of all ten families in a browser-only injected preview row (no repo placement changes). At 0.4× the broadleaf crowns, willow curtains, birch trunks, cypress columns, sakura colours, bare branches, pine tiers, shrubs, reeds and ferns remain distinct. No page errors in the clean variant preview.

## Integration notes / known weaknesses

1. **Vegetation animation is not currently visible in the live scene.** `src/riverScene.ts` passes `time: 0` and `animated: false` for non-creature props. The assets implement sway/petal fall correctly, but Claude must opt vegetation into the animated cache (or supply a wind time) to display it. Measure the cache/performance cost before enabling globally.
2. `riverScene.ts` only counts `instance.asset === PINE` in `visibleTrees` and only gives pines the large generic shadow. New tree ids therefore are omitted from that diagnostic and receive the smaller generic prop shadow. This is outside E ownership; consider using the `TREES` registry/category there.
3. Dense crowns intentionally become raw glyph texture at 1.8×; the minified 0.4× view is the readability target and passed. Dead trees are deliberately dark at night; the frosted variant is the most legible.
4. No temporary placements were left behind. Preview scripts/screenshots were written only to the approved temp directory. No commit was made.
