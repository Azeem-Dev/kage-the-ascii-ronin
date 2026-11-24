# Agent F — Wildlife: birds, insects, livestock and wild animals

**You own:** `src/assets/animals/**` (new assets; register in `src/assets/animals/index.ts`
→ `ANIMALS`), `src/assets/creatures.ts` (existing butterflies, bats, birds, moths — improve
them), and a new behaviour module `src/game/wildlife.ts`.
Everything else is read-only. Claude wires `wildlife.ts` into `src/riverScene.ts`.

## Why

The owner asked for *"butterflies + light bugs + sparrows + crows + parrots + vultures +
cows + horses + buffaloes etc"*. The world feels empty: a few static birds and butterflies.

## Assets to make

Each: ≥ 2 variants (colour/breed), seed variation, and **real animation frames with
`time` and `action`** (`idle`, `walk`, and for birds a flying cycle). Do NOT fake motion
by shearing columns sideways — that made the horse's leg look doubled. Move whole limbs
or wings as pieces (draw each pose).

| id | Size (world units) | Notes |
| --- | --- | --- |
| `cow` | ~32 tall, ~60 long | Black-white / brown; idle = grazing head-down, tail flick; walk = 4 legs |
| `buffalo` | ~40 tall, ~70 long | Dark, heavy, curved horns; wallow idle |
| `wild-horse` | ~36 tall, ~70 long | Chestnut, black, grey; mane/tail sway; walk + gallop |
| `goat` / `sheep` | ~20 tall | Herd animals for villages |
| `deer` | ~34 tall | Forest; alert idle (head up) |
| `sparrow` | ~4 | Hops on ground; flutter flight |
| `crow` | ~7 | Black with blue sheen; hops, caws (beak open), flaps |
| `parrot` | ~8 | Bright red/green/blue; elves' grove |
| `vulture` | ~10, wingspan ~30 | Circles high above (big spread wings); for orcs/Mudgate |
| `firefly` | 1–2 cells | Glowing yellow-green (author as bright effect colours); night |
| butterflies | improve existing | Wing-beat frames, 4+ colour variants |

Shading: author albedo (README). Animals are drawn as actors (bright, with a rim) so give
them clear dark/light part contrast (body vs legs vs head).

## Behaviour (`src/game/wildlife.ts`)

Export a small deterministic system Claude can call each frame, for example:

```ts
export interface WildAnimal { id: string; assetId: string; x: number; y: number; z: number; facing: 'left' | 'right'; action: 'idle' | 'walk' | 'fly'; variant: number; seed: number; scale: number }
export class Wildlife {
  constructor(seed: number);
  /** Spawn/despawn around the view; update movement. */
  update(dt: number, viewX: number, viewY: number, viewW: number, viewH: number, player: { x: number; y: number }, isNight: boolean): void;
  readonly animals: readonly WildAnimal[];
}
```

Behaviours: herds of cows/buffalo/sheep graze in meadows and farmland (slow wander, stay
together, never walk into water); wild horses roam open land; deer in forest edges and
flee the player; birds hop on the ground and **fly away when the player comes close**,
crows gather near Mudgate/fields, vultures circle (z high) over the orc camp; butterflies
by day over flowers, fireflies at night near water and the meadow. Use
`groundAt`/`waterDepth` from `src/assets/landscape.ts` to pick habitat. Same inputs →
same result (seeded). Keep it cheap (≤ ~150 animals live, < 1 ms per update).

## Done when

1. `npm test`, `npx tsc --noEmit -p .` pass. Add `tests/wildlife.test.mjs` (deterministic,
   animals never placed in water except birds in the air, bounded count) and say in your
   hand-off that it needs adding to `package.json` (Claude does that).
2. Look at every animal animating, at game size. You can't place them in the world (Agent H
   owns placement), so make a preview page `artifacts/agents/F-preview/index.html` that
   imports your assets and `Wildlife` and draws them with the game renderer at scales 0.25,
   0.36 and 0.6, idle/walk/fly. Open it at
   `http://localhost:3000/artifacts/agents/F-preview/index.html` with `npm run dev` running.
   This page is a dev aid only; nothing in `src/` may import it.
3. `artifacts/agents/F-handoff.md`: ids, sizes, suggested scales, the `Wildlife` API and
   exactly how to wire it into the render loop (draw order, `z` → draw at `y - z`).
