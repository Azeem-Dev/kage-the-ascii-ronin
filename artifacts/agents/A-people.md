# Agent A — People: races and townsfolk

Read `artifacts/agents/README.md` first. You edit only `src/assets/people/**`.
Register every asset in the `PEOPLE` array in `src/assets/people/index.ts`.

## Goal

Distinct, readable characters for towns, villages and wild areas. Each must be
recognisable **by silhouette alone** at ~40 world units tall, before colour.

## Build a reusable body builder first

`src/assets/people/body.ts`: one function that draws a standing figure from a spec,
so every character shares proportions, shading and animation. Suggested spec:

- proportions: height, shoulder width, head size, belly, hunch (0..1), leg length
- skin colour palette (3–4 tones dark→light); ears: `round | pointed | long-goblin`
- face: eyes (small bright cells), nose, tusks (orc), beard (none/short/long/braided)
- hair: none / short / long / tied, colour palette
- clothing layers: tunic/shirt, trousers/skirt/robe/gown, belt, cloak/cape,
  armour plates, apron, rags (torn hem: ragged bottom edge using seeded noise)
- headwear: none / hood / straw hat / feathered cap / helm / crown / circlet
- held item: none / spear / axe / bow / staff / pitchfork / cup / coin pouch / basket
- animation: `action: 'idle'` = breathing (chest/shoulders 1 cell, every ~2 s),
  `action: 'walk'` = alternating legs and counter-swinging arms over `time`.
  Feet stay on the anchor row. Must differ between `time: 1.25` and `time: 3.7`.
- `facing: 'left'` must mirror (use `GlyphShape.frame(true)`).

Draw in this order so overlaps are right: back arm, cape, legs, torso, belt,
front arm, held item, head, hair, headwear.

## Assets to deliver (ids are fixed — Agent C places them by these ids)

| id | Description | Variants (≥3 each) |
| --- | --- | --- |
| `goblin` | Small, hunched, green/olive skin, huge pointed ears, yellow eyes, ragged loincloth, crude dagger or spear | grunt / archer / shaman with bone staff |
| `orc` | Big, broad, grey-green skin, tusks, heavy brow, scrap armour plates and furs, axe | warrior / brute (bare-chested) / chieftain (skull helm, cape) |
| `elf` | Tall, slender, pointed ears, long flowing hair, elegant robes or leaf armour, bow or staff | ranger (green/brown) / mage (silver/blue) / noble (white/gold) |
| `dwarf-townsfolk` | Short, wide, big braided beard, leather apron or chain shirt, hammer or pick | smith / miner (lamp helmet) / merchant |
| `peasant` | Poor, patched brown/grey tunic, rope belt, bare feet or wraps, bent posture | man / woman with headscarf / old |
| `beggar` | Very poor, hunched or sitting, layered rags, hood, holding a cup | hooded / bandaged / child-sized |
| `farmer` | Straw hat, rolled sleeves, pitchfork or basket | man / woman / boy |
| `merchant` | Well fed, colourful vest, sash, coin pouch, cap | spice seller / cloth seller / fishmonger |
| `noble` | Rich: fur-trimmed coat or long gown, jewellery (bright gold/gem cells), feathered hat or circlet, upright posture | lord / lady / young heir |
| `guard` | Chainmail, tabard with a colour crest, helmet, spear and shield | town guard / captain / night watch with lantern |

Each asset: `category: 'Character'`, a good `name` and `description`, `variants`
names, `width`/`height`/`anchor` (anchor = bottom-centre between the feet).

## Quality bar

- Poor vs rich must be obvious at a glance: rich = saturated colours, gold accents,
  upright, clean edges, long garments; poor = desaturated browns/greys, patches,
  ragged hems, hunched.
- Races must differ in **shape**, not just colour (goblin ears and hunch, orc bulk
  and tusks, elf height and hair, dwarf width and beard).
- Strong value contrast between skin, clothes and hair (they will be shrunk).
- Compare against the knight (`src/assets/knight.ts` + `art/knight.json`): it is
  the current quality baseline.

## How to look at your work

`npm run dev`, then open `http://localhost:3000/`. Press **H** to cycle playable
characters — temporarily you may add your assets to a local test array, but do not
commit edits outside your folder. Easiest: ask Agent C / Claude to place one of
each in a test area, or write a small preview note listing ids for review.
