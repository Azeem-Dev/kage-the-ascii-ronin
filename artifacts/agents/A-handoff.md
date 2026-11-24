# Agent A hand-off — People

## Delivered

Registered all ten fixed ids in `src/assets/people/index.ts`, with three variants each (30 total). `personAsset.ts` maps each named variant to a `BodySpec`, enforces a shared canvas, supplies a bottom-centre anchor and a small foot collision circle, and delegates animation/mirroring to the inherited `drawPerson`. No dependencies, WebGL, runtime images, world edits or commits were added.

The inherited `body.ts` was left intact, including its periodic blink cue. The final asset test exercises every people asset at `time: 1.25` and `time: 3.7`, so the blink and the rest of the idle/walk animation are verified.

## Assets, variants and authored size

Heights below are feet-to-crown figure heights in authored cells, excluding spears, staves, pitchforks and other held items. All variants of one id share the listed canvas; child/shorter variants stand on the same anchor row.

| id | Variants | Canvas W×H | Figure height(s) | Suggested placement scale for the brief's world-height band |
| --- | --- | --- | --- | --- |
| `goblin` | `Grunt` (ragged tunic, dagger); `Archer` (scavenged vest, bow); `Shaman` (tied hair, bone-topped staff) | 105×100 | 74 | 0.39–0.43 → about 29–32 units |
| `orc` | `Warrior` (mail/plates, fur, axe, shield); `Brute` (bare chest, long beard, axe); `Chieftain` (skull helm, cape, tabard, axe, shield) | 129×150 | 132 | 0.38–0.42 → about 50–56 units |
| `elf` | `Ranger` (green/brown leaf-style plates, cloak, bow); `Mage` (silver hair, blue robe, staff); `Noble` (white/gold robe, circlet) | 97×150 | 126 | 0.33–0.37 → about 42–47 units |
| `dwarf-townsfolk` | `Smith` (chain shirt, leather apron, hammer); `Miner` (patched clothes, lamp helmet, pick); `Merchant` (red vest, sash, pouch, cap) | 109×106 | 88 | 0.33–0.36 → about 29–32 units |
| `peasant` | `Man` (patched brown tunic); `Woman` (patched tunic/skirt, headscarf); `Elder` (shorter, deeply stooped, wraps, grey beard) | 97×140 | 116 / 116 / 112 | 0.35–0.40 → about 40–46 units for adults |
| `beggar` | `Hooded` (hood, layered rags, cup); `Bandaged` (head/arm wraps, cup); `Child` (short, scarf, oversized cup) | 97×140 | 116 / 116 / 72 | Adults 0.35–0.40; child is intentionally about 26 units at 0.36 |
| `farmer` | `Man` (straw hat, pitchfork); `Woman` (straw hat, skirt, basket); `Boy` (short, straw hat, pitchfork) | 97×140 | 116 / 116 / 76 | Adults 0.35–0.40; boy is intentionally about 27 units at 0.36 |
| `merchant` | `Spice seller` (orange vest, red sash); `Cloth seller` (teal vest, basket); `Fishmonger` (blue vest, pale apron, basket) | 97×140 | 116 | 0.35–0.40 → about 41–46 units |
| `noble` | `Lord` (burgundy/gold coat, fur, feathered hat); `Lady` (purple/gold gown, circlet); `Young heir` (shorter blue/gold coat, feathered hat) | 97×140 | 118 / 118 / 108 | 0.35–0.39 → about 41–46 units for adults |
| `guard` | `Town guard` (blue tabard, spear, shield); `Captain` (crimson/gold tabard, cape, spear, shield); `Night watch` (dark tabard, shield, lantern) | 97×140 | 116 | 0.35–0.40 → about 41–46 units |

The orc canvas was widened from the planned 121 to 129 cells and the dwarf canvas from 101 to 109 so the axe/pick heads remain inside the frame through the walk cycle. This does not change figure height or placement scale.

## Validation

- `node tests/assets.test.mjs` immediately after registration: **PASS — 48 assets, 1,452 valid deterministic frames**.
- Final `npm test`: **PASS — 58 assets, 1,812 valid deterministic frames**, plus all physics/engine tests green. The higher totals include Agent B's concurrently added buildings.
- Final `npx tsc --noEmit -p .`: **PASS**.
- `git diff --check -- src/assets/people`: clean (only Git's informational LF→CRLF warning).

## Visual review

Reviewed a 30-variant glyph gallery and live `?area=town`, `?area=village`, and `?area=goblins` captures at 1280×720. The live race shapes and poor/rich clothing contrast remain readable. Headless live samples reported 36–54 FPS while other agent streams were active; this was a sanity check, not the required formal 1920×1080 benchmark.

## Known weaknesses / integration notes

1. **Night-watch lantern light is not declared.** `AsciiAsset.light` is per-asset, but only `guard` variant 2 carries the lantern; adding it to the asset would light the town guard and captain too. The lantern is visibly rendered, including its warm glyph halo, but does not illuminate terrain. The game should attach an instance-level, variant-aware light only for variant 2. For a right-facing idle guard its approximate anchor-relative lantern position is `{ x: 22, y: -57 }` (mirror `x` when facing left), with a warm colour such as `[1, 0.72, 0.32]` and an authored radius around 24–32 cells. The hand/lantern moves slightly with breathing and walking, so this should be updated from the actor or kept as a small stable offset.
2. **Footprints are also per-asset.** The beggar child uses the same 4.5-cell foot circle as the adults. If child collision needs to be narrower, the world/physics layer needs a variant-aware radius rather than a second asset id.
3. Beggars are hunched standing figures, not sitting; the brief allows either. The body builder has no sit pose yet.
4. The fishmonger is distinguished by a cool vest, pale apron and basket, but the shared basket contains generic produce rather than fish-specific glyphs.
5. People remain static placements until NPC behaviour/AI is implemented outside this stream. Held items can extend above the listed figure height, so placement scale should be based on the heights above, not canvas height.
