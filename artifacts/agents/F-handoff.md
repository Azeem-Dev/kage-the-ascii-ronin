# Agent F hand-off — Wildlife (art + deterministic behaviour)

No commit made; Claude reviews first. Branch state: inherited work reviewed and finished.

## What changed

- `src/assets/animals/birds.ts` — **fixed the inherited `sparrow does not animate` failure in the existing `assets.test.mjs`.** The old idle peck was a threshold on `sin(t*2.8+seed)`; at seed 17 both comparison frames (1.25 vs 3.7 s) landed in the same state with sub-cell hop, so the frames were byte-identical. Idle now uses a discrete, time-driven 4-beat whole-head peck cycle (`[0,3,1,2]`), and the crow's caw opens the beak on beat 2. The head/beak/tail move as one articulated piece — no row/column shearing.
- `src/game/wildlife.ts` — added `'run'` to `WildlifeAction` and use it for roaming `wild-horse`, so the authored gallop pose is actually exercised at runtime.
- `tests/wildlife.test.mjs` — added an assertion that wild horses use the gallop pose.
- `artifacts/agents/F-preview/index.html` — fixed three `present()` calls to pass the canvas 2D context the renderer requires (previously threw at runtime). Added `_diag.mjs` / `_bench.mjs` helper scripts (dev aids only).

Everything else in the inherited files was kept: `src/assets/animals/{quadrupeds,birds,firefly,index}.ts`, `src/assets/creatures.ts`, `src/game/wildlife.ts`, `tests/wildlife.test.mjs`.

## Assets — id, authored size, variants, suggested placement scale

All registered in `src/assets/animals/index.ts` → `ANIMALS` (catalog already imports it). Butterflies/bats/birds/moths are in `src/assets/creatures.ts` → `CREATURES`.

| asset id | authored W×H | anchor | variants | suggested scale | actions |
| --- | --- | --- | --- | --- | --- |
| `cow` | 208×106 | (104,98) | Holstein, Chestnut | **0.32** → 67×34 world | `idle` (graze + tail flick), `walk` |
| `buffalo` | 232×122 | (116,112) | Slate, Umber | **0.32** → 74×39 | `idle` (wallow), `walk` |
| `wild-horse` | 220×110 | (110,102) | Chestnut, Black, Dapple grey | **0.33** → 73×36 | `idle`, `walk`, **`run` (gallop)** |
| `goat` | 152×86 | (76,77) | Ochre, Charcoal, Ivory | **0.27** → 41×23 | `idle`, `walk` |
| `sheep` | 156×88 | (78,78) | Ivory, Black-faced, Chestnut | **0.27** → 42×24 | `idle`, `walk` |
| `deer` | 196×112 | (98,99) | Antlered stag, Doe | **0.32** → 63×36 | `idle` (alert, ears/antlers), `walk` |
| `sparrow` | 52×44 | (26,36) | Hedgerow, Grey, Rust | **0.11** → 6×5 | `idle` (peck), `walk` (hop), `fly` |
| `crow` | 80×58 | (40,50) | Blue sheen, Raven black | **0.13** → 10×8 | `idle` (peck/caw), `walk`, `fly` |
| `parrot` | 72×66 | (36,58) | Scarlet, Sapphire | **0.13** → 9×9 | `idle`, `walk`, `fly` |
| `vulture` | 160×80 | (80,70) | Slate, Brown | **0.20** → 32×16 (wingspan 32) | `fly` (separate finger feathers) |
| `firefly` | 20×20 | (10,18) | Foxfire, Warm gold | **0.12** → 2.4×2.4 | `fly`; `light` = `{x:0,y:-8,radius:18,color:[.72,1,.28]}` |
| `butterfly-blue` / `-pink` / `-purple` | 64×48 | (32,25) | 4 colour forms each | **0.20** → 13×10 | articulated wingbeat (`time`) |

Seed variation: plumage patches/noise, wool locks, mane/tail swish, wing spots, idle phase. All assets pass the existing determinism/seed/variant/animation checks.

## `Wildlife` API (`src/game/wildlife.ts`)

```ts
export type WildlifeAction = 'idle' | 'walk' | 'fly' | 'run';
export interface WildAnimal {
  id: string; assetId: string;
  x: number; y: number; z: number;       // world ground coords + height above ground
  facing: 'left' | 'right';
  action: WildlifeAction;
  variant: number; seed: number; scale: number;
}
export class Wildlife {
  constructor(worldSeed: number);
  readonly animals: readonly WildAnimal[]; // stable array, rebuilt each update
  update(dt: number, viewX: number, viewY: number, viewW: number, viewH: number,
         player: { x: number; y: number }, isNight: boolean): void;
}
export const WILDLIFE_CAPACITY; // 109 fixed slots (≤ 150)
```

`dt` is seconds (internally clamped to 0.1). All positions, view rect and player are in **world units**, same space as the camera. Same world seed + same input sequence → identical output; no globals, DOM or `Math.random()`.

Behaviour: cow/buffalo/sheep/goat herds graze and stay cohesive with local separation; wild horses roam and gallop; deer flee within 72 units; ground birds hop and fly away within 30 units (22 for parrots) then land; crows are restricted to Oakhollow fields and Mudgate; vultures circle at z≈94 over the orc camp (150,640); butterflies spawn only by day, fireflies only at night, near water/meadow/grove. All ground placement is gated on `groundAt` + `waterDepth` from `src/assets/landscape.ts`, so nothing walks into the river.

Measured: **0.013 ms average, 0.41 ms worst, 79 live peak** (`node artifacts/agents/F-preview/_bench.mjs`) — inside the ≤150 / <1 ms budget.

## Exactly how to wire it into `src/riverScene.ts`

1. `const wildlife = new Wildlife(worldSeed)` once at scene start.
2. Each frame, **after** the camera and `atmosphere` are updated and **before** the cell grid is filled:
   `wildlife.update(dt, camera.x, camera.y, viewWidthInWorldUnits, viewHeightInWorldUnits, { x: player.x, y: player.y }, atmosphere.isNight)`.
   Add the same world-space margin the renderer already uses so animals pop in off-screen (the system uses its own 96-unit margin).
3. Resolve `assetId` through the catalog map, then get a sprite with the existing cache:
   `cache.get(asset, { time: clock + (animal.seed % 5), seed: animal.seed, variant: animal.variant, facing: animal.facing, action: animal.action }, animal.scale, true)`.
   Pass `action` through verbatim — `wild-horse` may return `'run'`, which its asset supports.
4. **Draw order:** build a draw list of `{ animal, asset, drawY: animal.y - animal.z }`, sort by `drawY` ascending (painter's algorithm), then stamp. This lets a low-flying bird sort behind a taller foreground prop correctly.
5. **Height:** draw the anchor at **`y - z`** (screen cell Y = `animal.y - animal.z - camera.y`, then minus `placed.anchorY`). For `z === 0` stamp into `LAYER.actor` **with `groundY = animal.y`** so the renderer's contact shadow lands on the ground. For `z > 0` stamp into `LAYER.effect` (no ground shadow). For fireflies at night, also `addLight(cols, rows, x, y - z, radius * scale, .6, 1, .2)` — the asset already carries its own `light` field.
6. No other integration is needed: no new collisions, no footprint changes, nothing in `src/engine/**`.

The preview page implements this exact contract — see `renderHabitat()` in `artifacts/agents/F-preview/index.html` for copy-pasteable code.

## Tests / verification

- `npm test` — PASS (78 assets, 2568 frames, physics + colliders + wind + softbody + fixed stepper).
- `node tests/wildlife.test.mjs` — PASS (deterministic replay, bounded count, water safety, day/night insects, herd cohesion, bird flee, vulture circling, gallop).
- `npx tsc --noEmit -p .` — PASS. (During parallel work it briefly showed errors in G's `authored.ts`, H's `worldChunks.ts` and an in-progress `landscape.ts` `barDepth` rename; all were fixed by their owners before hand-off. Final run is clean — no foreign failures remain. If a rerun fails in a file outside F's scope, wait for that stream to settle rather than editing it.)
- Visual: preview page at `http://localhost:3000/artifacts/agents/F-preview/index.html` — close-up, full contact sheet and live habitat. Inspected **every animal at 0.25×, 0.36× and 0.60×**, idle/walk/fly/gallop, and confirmed frame-to-frame motion. Also loaded the real game (`?area=town`) to confirm no renderer regression.

**Claude must do:** add `&& node tests/wildlife.test.mjs` to the `test` script in `package.json` (I was forbidden from touching it).

## Known weaknesses

- Holstein cow / ivory sheep albedo is bright; under strong daytime lighting the body clips toward white and some internal form shading is lost. Easy to tone down their palette arrays if the owner wants more definition.
- At in-game scale (sparrow ≈ 6 world units, firefly ≈ 2) only the larger head bob / glow pulse reads; fine feather detail is intentionally omitted.
- Wildlife is deliberately not placed by Agent H's world files and not yet wired into `riverScene.ts` — placement around the camera is entirely runtime-owned by `Wildlife`.
