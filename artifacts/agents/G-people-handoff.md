# G-people hand-off — faces and playable characters

## What changed

### `src/assets/characters.ts` (rewritten)
The six playable characters (`cat-girl`, `cat-boy`, `vampire-girl`, `vampire-boy`,
`dwarf-guardian`, `dwarf-neutral`) no longer render their baked painting through
`authoredFrame`. Their faces were 1–2-cell features that averaged into noise at the
game's 0.24–0.34× placement scale; I first tried masking/replacing only the head,
but that produced a bright boxy lump that did not read as a face. They are now drawn
with the same `drawPerson` glyph-body builder as the townsfolk, so each face is one
skin mass under a single hair/helm silhouette with one broad glint.

- Ids, names, descriptions, three variants (`Original`, `Moonlit`, `Bronze`), canvas
  widths/heights (96×161, 96×146, 96×174, 96×133, 96×87, 96×91) and anchors are
  preserved. Generated cells are shifted by the baked anchor offset (−2 rows).
- Distinct silhouettes: catfolk pointed ears + long/short hair, cloak, dagger or bow;
  vampires long/swept dark hair, coat + fur collar, cape, dagger; dwarf guardian broad
  build, braided copper beard, plate mantle, axe; dwarf sentinel closed teal helm/hood,
  chain shirt, hammer.
- Variants swap outfit/palette and apply the established cool/warm tint. Seed affects
  glyph noise; `time` drives the shared idle/walk animation.

### `src/assets/people/body.ts` (inherited, reviewed and kept unchanged)
The inherited edits were kept: paired tiny eyes/blink removed in favour of one broad
cheek/glow highlight (goblin keeps one yellow eye), broad jaw shading, larger hair
silhouette, race builds (hunched goblin, bulky orc, slim elf, broad short-legged dwarf),
cloth folds/ragged threads and simplified bandage wraps. The ten people ids, their
three variants and A-handoff canvas sizes are untouched. No other source file was edited.

### Preview scripts (new, untracked artifacts only)
`artifacts/agents/G-preview/{heads,chars,people,stats}.mjs` plus generated HTML/PNG
contact sheets at `characters.ts` game scales (0.36× and 0.25×) and game screenshots
in `artifacts/agents/G-preview/`.

## Verified

- `npx tsc --noEmit -p .`: PASS (strict, no unused locals/parameters).
- `npm test`: PASS — 78 assets / 2,568 frames valid, deterministic, animated, seed+
  variant sensitive; all physics/engine tests green.
- `artifacts/agents/G-preview/check.mjs`: PASS — 18 owned assets (10 people + 6
  characters + horse + knight), 648 frames valid/deterministic/animated with seed and
  variant effects.
- Visual review: all 30 people variants at 0.36× (gallery `people.html`) — goblin,
  orc, elf and dwarf race builds and poor/rich outfits read distinctly; all six
  characters at 0.36× and 0.25× (`chars.html`) — heads, glints and silhouettes read.
- Live dev server: `?area=town`, `?area=village`, `?area=outskirts`, `?area=goblins`,
  `?area=orcs`, `?area=elves`, plus camp/forge/crypt, at default zoom and zoomed in;
  no render errors, placements still hold. Screenshots in `artifacts/agents/G-preview/`.

## Foreign failures

None at the time of hand-off. The previously reported `sparrow does not animate`
failure in Agent F's `src/assets/animals/birds.ts` no longer reproduces; the full
`npm test` passes. I did not edit any file owned by another stream (`authored.ts`,
`horse.ts`, `src/render/**`, `src/riverScene.ts`, world files, tests, package.json).

## What remains / known weaknesses

- The baked art JSON files are untouched but now unused by these six characters. If
  Claude prefers the painted bodies, the head-only overlay route was tried and
  rejected visually; a hybrid would need a smaller, lower-contrast head.
- The procedural figures approximate the baked traits: no animated tail, curved
  blade or detailed embroidery. The hero is placed at `29 / asset.height` by
  `riverScene.ts` (≈0.18 for the 161-tall cat-girl), so its single glint is about one
  cell at that scale; changing that placement scale is outside my files.
- Variant 3 tint fallthrough mirrors the old animator's fixed colours.
- No commit was made; Claude reviews first.
