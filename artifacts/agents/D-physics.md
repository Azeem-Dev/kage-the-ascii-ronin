# Agent D — Physics: collision, gravity, air and particles

Read `artifacts/agents/README.md` first. You edit only `src/engine/**` and
`tests/physics.test.mjs` (you may add `tests/*.test.mjs` files for your modules
and must add them to your hand-off note so Claude wires them into `npm test`).
You do **not** edit `src/riverScene.ts`; Claude integrates your modules. Give
every module a small, documented API and a usage example in your hand-off note.

The world is **top-down**: `x` right, `y` down the screen (depth), and you are
adding `z` = height above the ground. One world unit = one glyph cell at zoom 1.
The knight is 41 units tall; walk 22, run 36, ride 55, gallop 85 units/s.

## 1. Collision (`physics.ts`, new `spatialHash.ts`)

Current: `moveBody(body, dx, dy, speed, dt, obstacles, radius)` — circle body vs
circle obstacles with substeps and sliding. Keep this signature working.
- **Bug COLL-01**: users report clicking to move lets the player pass through trees.
  Reproduce in a test first (several obstacles close together, target behind them,
  `dt` up to 0.05). Likely causes: resolving obstacles one by one pushes the body
  into another one; no re-check after the push. Fix so the body never ends inside
  any obstacle (iterate resolution until stable, max a few passes).
- Add `SpatialHash` for colliders (towns will have hundreds of circles): build
  once when the visible chunk set changes, query nearby cells per substep.
- Add body-vs-body collision for moving characters (NPCs push apart, the player
  cannot walk through them), with mass so a horse pushes a goblin, not vice versa.
- Optional segment/capsule colliders for long walls and fences
  (`{ ax, ay, bx, by, radius }`), same sliding behaviour.

## 2. Gravity and height (`physics.ts` or new `body3d.ts`)

- Extend bodies with optional `z` and `vz`. Gravity ~ 400 units/s². `jump(body,
  speed)` only when grounded (z === 0). Landing sets `z = 0`, `vz = 0`, and
  reports an impact speed so the game can spawn dust.
- Coyote time (~0.1 s) and jump buffering (~0.1 s) so jumping feels good.
- A `groundHeight(x, y)` hook (function passed in; default 0) so future hills and
  tower floors can raise the ground. Bodies cannot walk up a step higher than
  `stepHeight` (default 4) but can jump onto it.
- While airborne, horizontal control is reduced (air control ~0.35) and friction
  is lower.

## 3. Air / wind (`wind.ts`)

One shared wind field so grass, banners, cloth, smoke, rain and particles agree:
- `wind.update(dt)`; `wind.at(x, y, t) -> { x, y, strength }` = slowly turning base
  direction + travelling gusts (deterministic noise, use `noise` from
  `src/assets/types.ts`) that sweep across the world as visible fronts.
- Settable base strength (calm / breeze / storm) so rain level can drive it.
- Cheap: called for thousands of cells per frame; avoid allocation in `at`
  (offer `atInto(out, x, y, t)` writing into a reused object).

## 4. Particles (`particles.ts`)

Pooled particle system (fixed-size typed arrays, no per-frame allocation):
- Fields: x, y, z, vx, vy, vz, life, maxLife, kind.
- Physics: gravity on z, air drag, wind force (scaled per kind), ground bounce with
  restitution + friction, settle and fade.
- Kinds with sensible defaults: `dust` (footsteps/landing, low, short), `leaf`
  (falls slowly, flutters, strongly wind-driven), `spark` (campfire: rises, wind
  bends it, dies fast), `splash` (water: up then down, short), `rain` (fast,
  angled by wind, splashes on ground impact), `smoke` (rises, expands, wind-driven).
- `emit(kind, x, y, z, count, spread)`, `update(dt, wind)`, and
  `forEach((x, y, z, kind, age01) => void)` for drawing. The game will draw a
  particle at screen `(x, y - z)` with a glyph/colour chosen by kind and age;
  suggest a glyph/colour table in your hand-off note.

## 5. Fixed timestep (`loop.ts` or new `fixedStep.ts`)

Helper that runs simulation at a fixed 60 Hz with an accumulator and returns the
interpolation alpha, capping catch-up steps (no spiral of death after a tab
switch). Pause must stop accumulation.

## Tests (required)

Extend `tests/physics.test.mjs` (keep existing checks passing):
- no penetration with many tightly packed obstacles at all speeds / dt up to 0.05
- the COLL-01 reproduction
- body-vs-body separation and mass ratio
- jump: apex height ≈ v²/(2g), lands at z = 0, cannot double-jump, coyote time works
- particles: count never exceeds pool size, all particles die, no NaN
- wind: deterministic for the same (x, y, t)
- spatial hash returns the same contacts as brute force on random scenes

Performance target: 2,000 particles + 500 colliders + 30 bodies under 2 ms per
frame in Node (measure and report).

## 6. Hair and cloth (`softbody.ts`) — requested by the user

Currently capes, hair, banners and tails are static art with at most a sine wobble.
Build a small Verlet soft-body module the game can attach to characters:
- `Chain` (hair strands, ponytails, horse mane/tail, banner cords) and `Cloth`
  (capes, banners, tent flaps): point masses + distance constraints, a few
  constraint iterations per step, damping.
- Pinned points follow an anchor the game moves every frame (shoulders, head,
  horse neck); the rest lags, swings and settles. Forces: gravity (pulls down the
  screen, i.e. +y, plus a little +z sag), wind from `wind.ts`, and the anchor's
  own motion (inertia when the character starts, stops, turns, jumps).
- Simple collision with the wearer: keep points outside an ellipse/capsule for
  the body so a cape does not pass through the legs.
- Output: `forEachPoint` / `forEachSegment` in world coordinates so the game can
  draw strands as glyphs (`| / \ ~ ' ,`) chosen by segment angle, coloured by the
  wearer's hair/cloth palette. Suggest the glyph-by-angle table in your note.
- Budget: 40 chains × 12 points + 6 cloths × 8×10 points under 1 ms per frame.
- Tests: no NaN, pinned points exactly follow anchors, length stays within ±5%
  under strong wind, settles when anchor stops (energy decays).

## 7. Bodies the player must not walk through

The user can walk through the horse. Claude adds an interim collider for the horse
in `riverScene.ts`; your body-vs-body system (section 1) should replace it: every
character and animal (horse, NPCs, enemies) is a body with radius and mass, and
the player collides with them unless mounted.
