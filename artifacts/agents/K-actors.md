# Agent K — hero, horse, people

You own `src/proof/actors.ts`, new files under `src/proof/actors/**`, and new model packs under
`public/proof/models/**` (plus their `CREDITS.txt` lines). Read `artifacts/agents/README.md`
(round 3), `artifacts/CLAUDE_MASTER_PROMPT.md` and the hero/horse descriptions in
`docs/STORY.md` first.

**Run after Agent J's open world is in** (the owner wants the open world first). The owner says
the current models "look bad, not samurai": KayKit characters are chunky big-head cartoon
fantasy. Find **CC0** human rigs with believable proportions (Quaternius, Kenney, Poly Pizza
CC0, OpenGameArt CC0, or a CC0 Mixamo-compatible base — confirm the licence on the source page)
and dress them for a feudal-Japan-inspired world (kimono/hakama, straw hats, armour plates,
katana, spears). Primitive meshes attached to bones are fine where no model exists.

Current actors: KayKit `Rogue_Hooded` hero (WASD, Shift run, Walking_A/Running_A/Idle), a Knight
walking a circle, a Barbarian and a Mage standing, and a static three.js example horse
(licence unconfirmed — must go).

## Do this
1. **Kage the hero.** Make him read as a samurai at default zoom: straw hat (a wide flat cone
   attached to the head bone), pale cape, dark clothes, katana. Recolour materials and attach
   simple meshes to bones of a CC0 rig (KayKit Adventurers/Rogue rigs are fine). Set
   `root.userData.subject = true` and tag meshes `userData.look = 'cloth' | 'skin' | 'metal'`
   (names from `src/proof/look/categories.ts` once Agent I creates it) so the look pass can make
   him the brightest, cleanest thing on screen.
2. **Collision.** Use the `colliders` argument of `update()`: the hero and NPCs slide around
   circles (buildings, trees, rocks) instead of walking through them.
3. **Tsuki the horse.** Replace `three/Horse.glb` with a confirmed CC0 animated horse
   (e.g. Quaternius "Ultimate Animated Animal Pack" / "Animated Animals" — check the licence),
   white/pale. Idle, walk and gallop animations. **E** near the horse mounts / dismounts; when
   mounted the hero sits on the saddle and the horse moves with WASD (Shift gallops). Delete
   `public/proof/models/three/` and its CREDITS line when replaced. (The E key: read it from
   `keydown` inside your module, or ask Claude in the hand-off to pass it from `main.ts`.)
4. **Townsfolk.** 6–10 people around the square and village who walk between seeded points,
   idle, and turn to face the hero when he is close. Use KayKit character packs (Adventurers,
   Skeletons, etc.) and recolours for rich and poor people. Keep animation mixers cheap: update
   far-away NPCs less often.
5. **Feet on the ground.** No sliding: scale walk/run animation speed with movement speed.

## Acceptance
- Screenshots of the hero (on foot and mounted) at default zoom and zoomed in, in
  `artifacts/agents/K-shots/`; he must be recognisable as hat + cape + blade in ASCII.
- Collision demonstrated (walking into a building stops/slides).
- FPS at 1920×1080 while walking with all NPCs on screen.
- `Actors` interface unchanged; anything `main.ts` must do goes in your hand-off note.
