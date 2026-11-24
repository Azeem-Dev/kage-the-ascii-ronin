# Agent H — World: big rivers, environment, towns and villages

**You own:** `src/assets/landscape.ts`, `src/game/landmarks.ts`, `src/game/worldChunks.ts`,
`src/game/colliders.ts`.
Read-only everything else. Use tree ids from Agent E (`oak`, `willow`, `birch`, `cypress`,
`cherry`, `dead-tree`, `bush`, `reeds`, `fern`) and building/people ids already in the
catalog. Unknown ids are skipped with a warning, so you can place E's ids before they exist.

## Why

The owner: *"all forest? no city? no village?"*, *"make big rivers etc"*, *"the environment
still looks shit"*. The settlements exist (keys 5–0) but the start and most of the map is
the same dark meadow with one kind of tree; there is one narrow river.

## Tasks

1. **Big rivers and water.** Make the main river much wider in places (wide slow bends,
   shallows with sand bars and islands), add at least one tributary that joins it and a
   lake. Keep `riverCenter(y)`, `riverWidth(y)` and `waterDepth(x, y)` exported with the
   same signatures — the renderer (water mask, reflections), physics (wading) and
   atmosphere (foam on the main river) use them. `waterDepth` must cover ALL water
   (river + tributary + lake) and stay cheap (it runs per terrain cell). Banks: sand,
   pebbles, reeds (Agent E `reeds`), mud. Add bridges/fords where roads cross water
   (a ford can be shallow water; a bridge can be placed props — say in your hand-off if
   you need a bridge asset).
2. **Biomes with identity**, each with its own ground texture and tree mix: river valley
   (willow, reeds, birch), meadow (oak clumps, flowers, open grass), dark forest (pine,
   fern, dense), sakura grove near the elves (cherry), farmland around Oakhollow (fields,
   hedges/bush, scattered oak), burnt/dead land around the orcs and Mudgate (dead-tree,
   ash, mud). Fewer, bigger, deliberate tree groups with clearings — not uniform noise.
3. **Ground texture.** Ground should be dark with variety (the GPU renderer already sways
   `| / \ !` grass glyphs in the wind and lights them). Use more empty dark cells, patches,
   paths, flowers in clusters; no uniform carpet of the same glyph.
4. **Settlements visible and reachable.** Roads that clearly lead from the start towards
   the village and town; the village and Mudgate visible from nearby; signposts or banners
   at road forks (placed props). Propose (in the hand-off) a better start position near a
   village edge — Claude changes the spawn in `riverScene.ts`.
5. Determinism: same world every load; chunks regenerate identically; nothing placed in
   water except bridges/reeds; spawns stay clear.

## Done when

1. `npm test` and `npx tsc --noEmit -p .` pass.
2. In the game: walk/ride from the start to each region (keys 1–0 also jump), look at
   default zoom and fully zoomed out. Check water with `?debug=water` (water cells tinted
   red) — the mask must match the drawn water.
3. `artifacts/agents/H-handoff.md`: map of regions/rivers (coordinates), new placements,
   proposed spawn, performance notes (terrain sampling cost).
