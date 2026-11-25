# Agent J — the open world of Kaigen (FIRST PRIORITY)

You own `src/proof/world.ts`, new files under `src/proof/world/**`, and new model packs under
`public/proof/models/**` (plus their `CREDITS.txt` lines). Read `artifacts/agents/README.md`
(round 3), `artifacts/CLAUDE_MASTER_PROMPT.md` and **all of `docs/STORY.md`** first.

## The owner's words
- "This isn't exactly open world, neither does it have any story / direction. Let's first make
  the open world."
- "These models look bad, not samurai."

Right now `/proof.html` is one hand-placed fantasy village (cartoon KayKit houses in a ring)
on an empty plane. Your job: turn it into a **large, walkable open world** that follows the
story's map and looks like a **feudal-Japan-inspired samurai world** (the land of Kaigen),
rendered through the existing ASCII pass.

## 1. World map from the story (`docs/STORY.md`)
Build these places, connected by roads/paths so you can walk from one to the next, each a few
hundred metres apart (world units = metres; the hero is ~1.8 tall):
- **Riverbank** — the start (Act I wake-up). A river with a ferry landing (**Oyuki's ferry**).
- **The hill** where the castle should be — now a **castle ruin** / empty foundation
  (the Blank erased it).
- **The Crypt** — a stone entrance in a hillside or forest (Nameless Knight boss later).
- **The Forge** — Brann's smithy, smoke and fire glow.
- **Mudgate** — poor outskirts: shacks, mud, fences, a few lamps.
- **Highmere** — the town: walls/gate, streets, market, a noble's estate, lamps and windows lit.
- **Goblin Warren**, **Orc Warband camp**, **Silverleaf** (elf forest) — rougher placeholders
  are fine for now, but each must be recognisable as its own place.
Between them: fields, forests, bamboo groves, rice paddies, rocks, streams, bridges, shrines,
stone lanterns, torii gates on paths. Mark "the Blank" with a few erased patches: bare black
ground where something is missing (a well, a bridge).

Write the layout as data (`src/proof/world/map.ts`: region centres, radius, road polylines,
what spawns where) so it can be edited and extended. Same seed → same world.

## 2. Streaming so it can be big
Chunks (e.g. 32×32 m) generated from the map + seed, loaded around the camera target and
unloaded behind it. Instance repeated models (trees, rocks, grass, fences) per chunk. The scene
must stay small however far you walk. Terrain can stay mostly flat for now; gentle hills are a
bonus (actors walk at y = 0 unless you give Claude a `heightAt(x, z)` in the hand-off).

## 3. Assets that fit a samurai world
The current KayKit pack is chunky big-head cartoon medieval Europe: the owner rejected it.
- Find **CC0** assets with Japanese / feudal-East-Asian architecture and nature (wooden houses
  with curved tiled roofs, shrines, pagodas, torii, stone lanterns, bamboo, pines, cherry trees,
  bridges, fences, carts). Search Quaternius, Kenney, Poly Pizza (CC0 filter), OpenGameArt
  (CC0), itch.io (CC0). **Confirm the licence on the source page** and record it in
  `CREDITS.txt`; if you cannot confirm it, don't use it.
- Prefer believable proportions and clean low-poly shapes; they read best in ASCII.
- Where no CC0 model exists, **build it from three.js primitives in code** (a torii, a stone
  lantern, a paper-wall house with a curved roof made of extruded shapes are all easy) — this is
  often better than a mismatched model.
- KayKit models may remain only where they fit (rocks, barrels, crates). **Not its trees: the
  owner says "trees look bad"** (stacked green cones that become flat glyph triangles). Trees
  need real silhouettes in ASCII: visible trunks and branches, broken leaf clusters with gaps the
  moon shines through, varied shapes (Japanese black pine, cedar, maple, cherry, bamboo
  clumps). A good option is to generate them in code (trunk/branch tubes + instanced leaf-card
  clusters, seeded) so every tree differs; or a CC0 nature pack with that kind of shape.
- Keep the models directory under ~60 MB; keep only files you use.

## 4. Look and light (coordinate with Agent I, who owns the ASCII pass)
- Night: moon + warm pools at lamps, windows, the forge, campfires. Most of the screen dark.
- Grass: calmer — slow travelling gusts, clear patches with bare dark ground between, 2–3
  related greens.
- Tag meshes `mesh.userData.look = 'grass' | 'foliage' | 'stone' | 'wood' | 'roof' | 'ground' |
  'light' | 'water'` (import from `src/proof/look/categories.ts` once Agent I creates it).
- Snap the moon shadow camera to shadow-map texels to stop shadow shimmer.

## 5. Colliders
Implement `colliders()`: circles for buildings, trunks, rocks, solid props, plus the river
(except bridges/ferry). Return only those near the camera target (the list is read every frame).

## 6. Performance
≥ 55 FPS at 1920×1080 on the owner's Iris Xe while walking (GPU flags — master prompt "HOW TO
TEST"). Bounded point lights (pool near the camera). Never hide or thin trees for FPS.

## Acceptance (hand-off with numbers and screenshots in `artifacts/agents/J-shots/`)
- A screenshot of every place listed in section 1, at default zoom, plus Tab-off (raw 3D) views.
- A walk from the riverbank through the ferry/bridge to Mudgate and Highmere: time taken, FPS.
- Same seed reload → identical start screenshot.
- Tell Claude what `main.ts` needs: start position, a debug teleport list (keys 1–9 to jump to
  places, like the old game), `heightAt` if you add hills.
- `World` interface unchanged except as above (ask in the hand-off for any change).
