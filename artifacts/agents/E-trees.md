# Agent E — Trees, bushes and plants

**You own:** `src/assets/trees/**` (new assets; register them in `src/assets/trees/index.ts`
→ `TREES`), `src/assets/pine.ts`, `src/assets/flora.ts`.
Everything else is read-only (see README). Agent H places your trees in the world; agree on
ids by using exactly the ids below.

## Why

The owner: *"make trees etc and everything better"*, *"the environment still looks shit"*,
*"all forest?"*. Today the world has one tree (`pine`, a soft dark-green blob) repeated
everywhere, plus small flower clumps. Trees are the biggest shapes on screen after
buildings, so they decide how the environment looks.

## Target look (study first)

Open `artifacts/preview/reference-frames/ref-grid.jpg` and the videos in `motivation/`
(by Ansenjeo, "Making the ASCII MMORPG of my dreams"). Note:

- Trees read as **layered clumps of foliage** with clear lit tops (moonlit/sunlit side,
  brighter, denser glyphs) and dark undersides/gaps between clumps — not one flat blob.
- **Visible trunks and branches** between and below the clumps; roots flaring at the base.
- Foliage edges are **broken and leafy** (sparse glyphs `'`, `,`, `.`, `*` at the rim),
  never a smooth ellipse outline.
- Colour: cool greens, blue-greens and olive at night; a few warm/autumn variants.

## Assets to make

Author big (see README scale table: a tree is 90–200 world units tall, authored ~200–320
cells, placed at 0.45–0.7). Each needs ≥ 3 visibly different variants, seed variation,
and gentle wind sway with `time` (whole canopy leans a little; outer leaves flutter more;
trunk never moves). Give each a `footprint` (trunk circle only — canopies don't block).

| id | What |
| --- | --- |
| `oak` | Broad, rounded, multi-clump crown, thick trunk, visible branches. Variants: summer, dense, autumn (orange/red) |
| `willow` | Drooping curtain of strands (`|`, `'`, `:`) down to the ground; for riverbanks |
| `birch` | Slim white/grey trunk with dark marks, light airy crown |
| `cypress` | Tall narrow dark column (Japanese/Mediterranean feel) |
| `cherry` | Sakura: pink/white blossom clumps, dark trunk; variant with falling-petal cells |
| `dead-tree` | Bare twisted branches, for Mudgate/orcs/crypt |
| `bush` | Low round shrubs, 3 sizes / colours (incl. berry bush) |
| `reeds` | Tall riverbank reeds/cattails cluster, sways strongly |
| `fern` | Forest-floor fern clump |

Also **improve `pine`** (keep id, size and anchor): layered tiers of needles, darker
underside per tier, visible trunk, snowy-tip variant optional. Keep it deterministic.

## Done when

1. `npm test` and `npx tsc --noEmit -p .` pass.
2. In the game (`npm run dev`), temporarily place a row of your trees in a test spot or
   use the existing pine placements (`?area=meadow`, `?area=crypt`, `?area=elves`), and
   look at default zoom, fully zoomed out (wheel) and in. Trees must stay readable as
   *trees* at 0.4× zoom — big clear masses, not noise. (Remove any temporary placement.)
3. `artifacts/agents/E-handoff.md`: ids, variants, authored size, **suggested placement
   scale** for each, footprints, and which biome each suits (for Agent H).
