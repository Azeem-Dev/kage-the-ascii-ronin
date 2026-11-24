# Agent G — Characters, faces and animation

**You own:** `src/assets/people/**`, `src/assets/characters.ts`, `src/assets/horse.ts`,
`src/assets/authored.ts`.
Read-only: `src/assets/knight.ts` and other baked art data (you may read it, not rewrite it).

## Why

The owner: *"our character faces look stupid"*, *"other than knight other characters look
stupid overall"*, *"animations like horse movement, air etc look stupid"*. The knight
(baked from real art) is the only figure that reads well.

## What is wrong today

- **Faces:** eyes/mouth are 1–2 cell details. Characters are drawn at 0.3–0.4× scale, so
  those details average into noise. At game size a face must be: a skin-tone mass, a clear
  hair/helmet/hood silhouette, and at most one highlight (cheek/nose) — no tiny eyes
  unless the figure is large enough to keep them (check at 0.36× and 0.25×).
- **People (`people/body.ts`):** one generic stiff body for everyone; similar proportions,
  flat clothing. Needs real silhouettes: shoulders, waist, clothing folds and drape,
  distinct hats/hoods/hair, poor vs rich clearly different at a glance, race shapes
  (goblin hunched with big ears, orc massive, elf tall and slim, dwarf broad and short).
- **Animation:** `authored.ts` fakes motion by shifting rows/columns sideways. Replace it
  with **pose-based** animation: whole limbs move as pieces around joints (hip, knee,
  shoulder). The horse leg fix already moves each whole leg (see `legCentres`) — build on
  that: proper walk (4-beat) and **gallop** cycles for the horse (action `walk` vs
  running), mane and tail that trail and settle, head bob. The knight/ronin cape should
  trail behind when moving and settle when idle, rooted at the shoulders.
- Movement should read at 60 FPS: smooth, no popping between poses, feet planted while
  in contact with the ground (no sliding or floating).

## Scope

1. Redo `people/body.ts` (keep the ten ids, three variants each and canvas sizes from
   `A-handoff.md` so world placements still fit) with the rules above.
2. Faces for all people and the playable characters in `characters.ts`
   (cat folk, vampires, dwarves) — readable at game size.
3. Horse: walk + gallop + idle (breathing, tail swish, head dip), mane/tail motion.
4. Knight: better cape/body motion in `authored.ts` without editing the baked art.

## Done when

1. `npm test` and `npx tsc --noEmit -p .` pass.
2. In the game: `?area=town`, `?area=village`, `?area=outskirts`, `?area=goblins`,
   `?area=orcs`, `?area=elves` at default zoom and zoomed in. Walk and ride (E, Shift to
   gallop). Characters must read as distinct people from a distance; the horse must not
   show doubled or detached legs in any frame.
3. `artifacts/agents/G-handoff.md`: what changed, before/after notes, any engine needs.
