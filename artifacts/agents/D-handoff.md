# Agent D hand-off — collision, gravity, wind, particles and soft bodies

Status: **complete; not yet integrated into `src/riverScene.ts`.** No commits, new dependencies, WebGL, or runtime image files. `src/riverScene.ts`, renderer, assets, game/world files, `package.json`, and other tests were not edited.

## Delivered files

- Modified: `src/engine/physics.ts`, `tests/physics.test.mjs`.
- Added by this stream: `src/engine/spatialHash.ts`, `src/engine/wind.ts`, `src/engine/particles.ts`, `src/engine/softbody.ts`, `src/engine/fixedStep.ts`.
- Pre-existing and untouched: `src/engine/loop.ts`, `src/engine/input.ts`.
- This continuation fixed an exact-anchor rounding edge case in `Cloth.setAnchorLine`, corrected the three requested sloppy tests, and corrected a fixed-stepper test that wrongly expected an update after only half a step.

World convention throughout: `x` right, `y` down the screen/depth, `z` up. Draw a world point at screen `(x, y - z)`.

## 1. `physics.ts` — static collision, bodies, gravity and jumping

### Small API

- `moveBody(body, dx, dy, speed, dt, obstacles, radius = 2)` — original signature preserved. Accelerated/friction-based top-down movement, circle/capsule collision, sliding, and anti-tunnelling substeps. `obstacles` may be an array or `SpatialHash`.
- `moveCore(...)` — lower-level shared movement core, with optional destination veto for ledge limits.
- `SolidBody` — `Body` plus `radius`, optional `mass` (default 1; `Infinity` = immovable), and optional `solid` (default true).
- `resolveBodies(bodies, obstacles?, iterations = 3)` — mass-weighted body separation, inward approach-velocity removal, optional re-resolution against statics after every iteration. Returns contacts resolved in the last iteration.
- `createBody3D(x, y, z = 0)` — creates `Body3D` with gravity/jump event fields.
- `jump(body, speed, opts?)` — jumps immediately when grounded or within coyote time; otherwise buffers the press. Returns whether it jumped immediately. Never double-jumps.
- `stepVertical(body, dt, opts?)` — gravity, ground following, coyote/buffer timers, landing and impact reporting.
- `moveBody3D(body, dx, dy, speed, dt, obstacles, radius = 2, opts?)` — horizontal movement plus vertical step in one call.
- `Physics3DOptions`: `gravity` (400), `stepHeight` (4), `coyoteTime` (0.1 s), `bufferTime` (0.1 s), `airControl` (0.35), `groundHeight(x, y)` (default flat ground).

Events are per simulation step: `landed` and `impact` reset in `stepVertical`; `impact` is downward speed at touchdown. `jumped` is set by `jump()` and must be cleared by the game after it handles the event. A buffered jump may fire on the same step as landing, so both events can be observed together.

### Usage

```ts
import {
  createBody3D, moveBody3D, resolveBodies, jump,
  type SolidBody,
} from './engine/physics.ts';

const player = Object.assign(createBody3D(0, 0), {
  radius: 2, mass: 80, solid: true,
});
const horse: SolidBody = {
  x: 20, y: 0, vx: 0, vy: 0, radius: 8, mass: 500, solid: true,
};
const bodies = [player, horse];

// Once per fixed step:
if (jumpPressed) jump(player, 150);
moveBody3D(player, inputX, inputY, 36, dt, colliderHash, 2, {
  groundHeight: terrainGroundHeight,
});
resolveBodies(bodies, colliderHash, 4);
if (player.landed && player.impact > 40) spawnLandingDust(player);
player.jumped = false;
```

For a custom horizontal controller, call `moveCore(...)` followed by `stepVertical(...)` instead of `moveBody3D(...)`.

### COLL-01 root cause and fix

The legacy resolver pushed a body out of each obstacle once, in array order. Escaping tree A could push it into tree B; a later obstacle could push it back into A. There was no final penetration re-check, so a click-to-move target behind a cluster could be reached while the body ended a frame inside geometry.

The reproduction in `tests/physics.test.mjs` penetrates in **153/600** legacy runs and **0/600** fixed runs.

The fix:

1. Limits travel to at most 1 world unit per movement substep.
2. Gathers nearby static contacts, using the spatial hash when supplied.
3. Repeats contact resolution for up to six passes, preserving tangent velocity and removing only inward velocity.
4. Performs a final penetration re-check.
5. If a body is still jammed inside geometry but its substep start was clear, restores the last clear position and zeros velocity rather than accepting penetration.

`resolveBodies` also re-resolves pushed bodies against statics after each body-pair iteration, preventing an NPC from being shoved into a tree.

## 2. `spatialHash.ts` — static collider broad phase

### Small API

- `Collider = { x, y, radius }`.
- `Segment = { ax, ay, bx, by, radius }` — capsule/thick wall.
- `Obstacle = Collider | Segment`; `ObstacleSource` is the query interface accepted by movement.
- `new SpatialHash(cellSize = 32)`; `.build(items)` rebuilds and returns the hash; `.size` reports item count.
- `.query(x, y, r, out)` — clears/fills `out` with overlapping obstacles; query allocation is avoided by reusing `out` and per-item visit stamps.
- `closestOnObstacle(...)`, `overlapsCircle(...)`, `isSegment(...)` — standalone geometry helpers.

`build()` retains the supplied array by reference. Do not mutate that array afterward without rebuilding.

### Usage

```ts
import { SpatialHash } from './engine/spatialHash.ts';

const colliderHash = new SpatialHash(32).build(visibleColliders);
moveBody(player, dx, dy, speed, dt, colliderHash, playerRadius);

const nearby: Obstacle[] = [];
colliderHash.query(player.x, player.y, playerRadius + 8, nearby);
```

Build once when the visible chunk/prop set changes, not every frame. Cell size 24–32 is a reasonable starting point for the current world scale.

## 3. `wind.ts` — shared deterministic wind field

### Small API

- `new Wind(level = 'breeze', baseAngle = .35, seed = 7)`; level is `'calm' | 'breeze' | 'storm'` or a number.
- `.update(dt)` — advances `.time` and eases `.strength` toward `.target`.
- `.setLevel(level)` — changes the target strength; `WIND_LEVELS` exports calm 0.12, breeze 0.4, storm 1.
- `.atInto(out, x, y, t?)` — allocation-free sample; returns `out`. `WindSample = { x, y, strength }`.
- `.at(x, y, t?)` — allocating convenience wrapper; avoid in hot loops.
- Mutable field controls: `.baseAngle`, `.gustSpeed` (42), `.gustSize` (130), `.seed`.

One shared instance should be advanced once per fixed simulation step, then sampled by grass, banners, particles and soft bodies. Samples include a slowly turning base direction, travelling gust fronts and small-scale turbulence.

### Usage

```ts
import { Wind } from './engine/wind.ts';

const wind = new Wind('breeze');
const sample = { x: 0, y: 0, strength: 0 };

// Once per simulation step:
wind.update(dt);
if (atmosphere.rain > .6) wind.setLevel('storm');

// For any number of consumers, reuse the same output object:
wind.atInto(sample, x, y);
const bendX = sample.x;
const bendY = sample.y;
```

## 4. `particles.ts` — fixed-capacity particle pool

### Small API

- `ParticleKind`: numeric tags for `dust`, `leaf`, `spark`, `splash`, `rain`, `smoke`; `ParticleKindName` is the string union.
- `new ParticleSystem(capacity = 4096, seed = 1234567)`.
- `.emit(kind, x, y, z, count = 1, spread = 0)` — returns how many particles fit. New particles are dropped when full; the pool never grows.
- `.update(dt, wind?)` — drag, per-kind gravity/buoyancy, wind, flutter, bounce/friction, lifetime and rain-impact splashes. `dt` is capped at 0.1 s.
- `.forEach((x, y, z, kind, age01) => {})` — drawing iteration; `age01` is 0 at birth and approaches 1 at death.
- `.clear()`; `.count`; `.capacity`; `.rainSplashes` (default true).
- Public typed arrays: `x`, `y`, `z`, `vx`, `vy`, `vz`, `life`, `maxLife`, `kind`.

Rain uses `dieOnGround`: impact removes the raindrop and emits a `splash` particle (about one splash per three impacts, capped at 256 candidate impacts/update). Ground is currently flat `z = 0`.

### Usage

```ts
import { ParticleKind, ParticleSystem } from './engine/particles.ts';

const particles = new ParticleSystem(4096);
particles.emit('dust', player.x, player.y, 1, 3, 1.5);
particles.emit(ParticleKind.splash, player.x, player.y, 0, 5, 2);
particles.update(dt, wind);

particles.forEach((x, y, z, kind, age01) => {
  drawParticleGlyph(x, y - z, kind, age01);
});
```

For correct depth sorting, feed particle draws into the existing actor/prop draw ordering or a preallocated bucket. `forEach` itself does not allocate, but allocating a new draw object/array per particle would erase that benefit.

### Suggested particle glyph/colour table

Colours are albedo-style hex values for the glyph renderer. Fade with `alpha = 1 - age01`; if the draw path has no per-glyph alpha, blend toward the local background or omit the oldest particles instead.

| Kind | `age01` | Glyph | Colour | Note |
| --- | --- | --- | --- | --- |
| dust | 0–0.33 | `'` | `#b9a47b` | fresh kicked-up mote |
| dust | 0.33–0.67 | `.` | `#968667` | spreading |
| dust | 0.67–1 | `,` | `#6f6352` | sparse/fading |
| leaf | 0–0.33 | `,` | `#84ad4d` | bright leaf |
| leaf | 0.33–0.67 | `;` | `#62883b` | tumbling |
| leaf | 0.67–1 | `.` | `#476b30` | dull/fading |
| spark | 0–0.2 | `*` | `#fff1a3` | hottest |
| spark | 0.2–0.6 | `+` | `#ffb347` | cooling |
| spark | 0.6–1 | `.` | `#d95b32` | ember/fading |
| splash | 0–0.25 | `^` | `#b7ecf5` | impact crown |
| splash | 0.25–0.65 | `/` | `#65b8d4` | droplet arc |
| splash | 0.65–1 | `.` | `#407e9d` | fading |
| rain | all | `\|` or `/\` | `#7d9ab7` | choose slash from wind direction; keep alpha around 0.65 |
| smoke | 0–0.25 | `o` | `#b8b4a8` | dense young puff |
| smoke | 0.25–0.6 | `O` | `#96958f` | expanding |
| smoke | 0.6–1 | `.` | `#737571` | thinning/fading |

For smoke, position at `(x, y - z)` and optionally add a small age-scaled spread when drawing. Keep colours consistent with the existing night lighting rather than painting shadows into particle colours.

## 5. `softbody.ts` — Verlet chains and cloth

### Small API

- `new Chain(points, segmentLength, options?)` — point 0 pinned; intended for hair, ponytails, horse mane/tail and cords.
- `new Cloth(cols, rows, width, height, options?)` — top row pinned; intended for capes, banners and tent flaps.
- `.setAnchor(x, y, z)` / `.setAnchorLine(ax, ay, az, bx, by, bz)` — move pinned points. The first call lays the body out hanging from the anchor(s).
- `.update(dt, wind?)` — Verlet integration, damping, distance constraints, follow-the-leader chain pass, wearer collision and floor contact. `dt` is capped at 1/30 and larger steps split in two.
- `.colliders: Capsule[]` — world-space wearer capsules; update these as the wearer moves.
- `.forEachPoint(cb)` / `.forEachSegment(cb)` — world-coordinate output. Cloth segments omit structural diagonals; constraints still use them for shear stability.
- `.translate(dx, dy, dz?)`, `.settle()`, `.energy()`, `.maxStretch()`.
- Public point arrays: `x`, `y`, `z`, `n`; inverse-weight array `inv` (0 = pinned).
- `SoftBodyOptions`: `gravityY` (60), `gravityZ` (120), `windForce` (90), `damping` (.985), `iterations` (Chain 5 / Cloth 8), `floor` (0), `flutter` (1).
- `segmentGlyph(x0, y0, z0, x1, y1, z1)` — glyph from the on-screen segment angle.

Cloth anchor endpoints are assigned directly rather than interpolated at `u = 1`, so pinned corners match the caller's anchors exactly despite floating-point interpolation rounding.

### Usage

```ts
import { Chain, Cloth, segmentGlyph } from './engine/softbody.ts';

const tail = new Chain(12, 2.5);
tail.setAnchor(horse.x - 10, horse.y, 22);

const cape = new Cloth(6, 8, 16, 22);
cape.setAnchorLine(player.x - 8, player.y, 34, player.x + 8, player.y, 34);
cape.colliders[0] = {
  ax: player.x, ay: player.y, az: 2,
  bx: player.x, by: player.y, bz: 30, radius: 6,
};

// Once per fixed step, after moving the anchor and wearer collider:
tail.update(dt, wind);
cape.update(dt, wind);

cape.forEachSegment((x0, y0, z0, x1, y1, z1) => {
  plotGlyph((x0 + x1) * .5, (y0 + y1 - z0 - z1) * .5,
    segmentGlyph(x0, y0, z0, x1, y1, z1), capeColour);
});
```

After a teleport, move the whole body with `translate(...)` and call `settle()` so it does not fling across the map. For normal walking, moving the pin naturally creates inertia.

### Glyph-by-angle table for hair/cloth

`segmentGlyph` computes `dx = x1 - x0`, `dy = (y1 - z1) - (y0 - z0)`, then `theta = atan2(abs(dx), dy)` in degrees. Theta 0 points down the screen; 180 points up.

| On-screen angle | Glyph |
| --- | --- |
| 0° ≤ theta < 24° | `\|` |
| 24° ≤ theta < 66° | `/` when `dx * dy < 0`, otherwise `\` |
| 66° ≤ theta < 114° | `~` |
| 114° ≤ theta < 156° | `/` when `dx * dy < 0`, otherwise `\` |
| 156° ≤ theta ≤ 180° | `'` |

A zero-length segment returns `\|`. Use the wearer's hair/cloth palette for segment colour and interpolate additional glyphs along long segments if one glyph per constraint looks too sparse.

## 6. `fixedStep.ts` — 60 Hz accumulator

### Small API

- `new FixedStepper(hz = 60, maxSteps = 5, maxFrame = .25)`.
- `.advance(frameSeconds, update)` — clamps frame time, runs zero or more fixed updates, drops excess backlog after the hard step cap, and returns interpolation alpha.
- `.paused` — when true, no time accumulates and no update runs; alpha keeps its previous value.
- `.reset()` — clears accumulator and last-step count.
- Diagnostics/state: `.step` (seconds), `.maxFrame`, `.maxSteps`, `.accumulator`, `.alpha`, `.lastSteps`, `.dropped`.

### Usage

```ts
import { FixedStepper } from './engine/fixedStep.ts';

const fixed = new FixedStepper(60, 5, .25);

function renderFrame(now: number) {
  const frameSeconds = (now - last) / 1000;
  last = now;
  fixed.paused = paused;
  const alpha = fixed.advance(frameSeconds, simulate); // simulate(dt)
  render(alpha);
}
```

Use **one** accumulator. The older `GameLoop` in `src/engine/loop.ts` is untouched and still useful independently, but it has no hard catch-up step cap or pause API; do not run both accumulators around the same simulation. Actual interpolated rendering requires saving previous/current body positions and using `alpha`; the helper only returns alpha.

`src/engine/input.ts` remains unchanged. `InputManager.isKeyJustPressed(code)` / `endFrame()` can support Space jumping if the scene adopts it; the current `riverScene.ts` uses its own key set.

## 7. COLL-01 and integration checklist for `src/riverScene.ts`

No changes were made to this file. Suggested integration order:

1. **Fixed-step shell**
   - Create one `FixedStepper`.
   - In the animation callback, always advance `last`, set `fixed.paused = paused`, and call `fixed.advance(...)`.
   - Move `time`, atmosphere, input-derived movement, world simulation, particles, soft bodies and event handling into the fixed update callback. Keep camera/render/minimap work in the render callback.
   - On reset/area teleport, clear relevant event/distance state and call `fixed.reset()`.

2. **Spatial hash for statics**
   - At the existing `props !== lastProps` refresh, after rebuilding `colliders`, call `colliderHash.build(colliders)`.
   - Replace array `colliders` arguments to movement/resolution with `colliderHash`. Keep the array only as the build source or for brute-force diagnostics.

3. **Real character/animal bodies**
   - Extend `hero` with `createBody3D(...)` while retaining render metadata (`facing`, `moving`, `variant`).
   - Give the horse `x/y/vx/vy`, `radius`, `mass` and optionally `z/vz` via `createBody3D`.
   - Suggested starting values: player radius 2 / mass 80; horse radius 8 / mass 500. Tune the horse circle against its 0.48-scale artwork.
   - Delete the interim five-circle horse collider at the current movement call. Add every horse/NPC/enemy to one `SolidBody[]` and call `resolveBodies(bodies, colliderHash, 3–4)` after movement.
   - Add radius/mass to future NPC spawns so they participate automatically. NPC AI itself is not part of this stream.

4. **Mounted riding and `solid:false`**
   - The horse remains a normal solid body with its normal radius/mass.
   - Set `hero.solid = false` while mounted. `resolveBodies` then ignores the rider both as a contact source and target, avoiding self-collision with the horse.
   - Drive the horse with `moveBody3D(...)` while mounted; after body resolution, copy the horse's resolved `x/y` (and `z` if used) to the rider's render state. Use ride/gallop speed on the horse.
   - On dismount, choose a clear side position, restore `hero.solid = true`, and resolve once before accepting input. Never leave the rider ghost after dismount.

5. **Jumping and height**
   - On a non-repeated Space keydown, call `jump(activeBody, 150)` once. Airborne presses buffer automatically.
   - Use `moveBody3D(..., { groundHeight, stepHeight: 4 })`. A flat `groundHeight: () => 0` is valid until terrain elevation is exposed.
   - Draw actors at `y - z`; keep contact shadows at ground `y`. For the mounted rider, retain the existing seat offset above the horse.
   - Handle `landed`/`impact` for landing dust and clear `jumped` after handling it. Sort airborne draws by screen depth if needed.

6. **One wind field**
   - Create one `Wind`; update it once per fixed step and drive weather level through `setLevel(...)`.
   - Reuse one `WindSample` for grass/reeds, banners, rain, particles and soft bodies. Keep world sampling deterministic; never reseed per rendered cell/frame.
   - The existing atmosphere rain renderer can remain, but new wind-driven effects must sample the same field.

7. **Particle event hooks**
   - Existing `stepDistance` footstep trigger: emit 2–4 `dust` at the foot, `z ≈ 1`, spread 1–2, only on land.
   - `body.landed`: emit landing dust scaled by `impact`; add horse hoof dust on landing/footsteps.
   - Wading/footsteps and rain over water: emit `splash` at the water surface. Current rain auto-splashes on every flat-ground impact; set `particles.rainSplashes = false` if splashes must be water-only, then emit them from gameplay water checks/events.
   - Campfires/braziers: use small per-fire emission accumulators for continuous `spark` and `smoke`; avoid unbounded emit calls every substep.
   - Trees/autumn weather: periodically emit `leaf` with deterministic emitters/rates.
   - Rain: emit above the visible world at a rate tied to rain intensity; the pool bounds the cost. Draw at `(x, y - z)` using the table above.

8. **Hair, cape, mane and tail**
   - Player: a small `Chain` for ponytail/hair plus a `Cloth` cape anchored at the shoulders.
   - Horse: tail `Chain`, plus short mane chains anchored along the neck. Mirror anchors with facing.
   - Update anchors and wearer capsules before each soft-body update. Mounted hair/cape should follow the horse/seat anchor.
   - Draw `forEachSegment` with `segmentGlyph` and the wearer's palette; draw points/segments at `y - z`.
   - On teleport/reset, use `translate(...)` + `settle()` rather than injecting a huge anchor velocity.

## 8. Verification and measured performance

All commands passed on Windows / Node v24.12.0:

- `node tests/physics.test.mjs` — all existing and extended blocks pass.
- `npm test` — assets and physics pass. The latest run reported **58 assets / 1,812 valid deterministic frames**; an earlier run reported 38 / 1,092 while parallel streams were still registering assets.
- `npx tsc --noEmit -p .` — clean, no output.

Measured with `performance.now()` in Node after warm-up (480 workload frames, 60 soft-body warm-up frames, 300 measured frames):

| Workload | Measured | Budget |
| --- | --- | --- |
| ~2,395 rain particles + 500 static colliders (450 circles, 50 capsules) + 31 bodies | **0.152–0.416 ms/frame** across passing `npm test` runs; 0.156 standalone. Latest: 0.416 under parallel agent load | < 2 ms |
| 40 chains × 12 points + 6 cloths × 8×10 points | **0.258–0.552 ms/frame** across passing runs; 0.257 standalone. Latest: 0.552 under parallel agent load | < 1 ms |

The main workload moves the player and 10 NPCs per frame and resolves all 31 bodies. Budgets were not loosened. These are simulation-only Node measurements, not a Canvas/renderer or 1920×1080 browser FPS certification.

### Test coverage

`tests/physics.test.mjs` now covers:

- Legacy movement, all approach angles, walk/run/ride/gallop speeds, `dt` through 0.05, sliding, passable gaps, arch/tent/vegetation semantics.
- COLL-01 reproduction and fix, dense static packs through array and hash, capsule blocking/sliding.
- Spatial hash == brute force over 40 random scenes.
- Body separation, 10:1 mass response, immovable bodies, horse blocking, mounted ghosts, static re-resolution.
- Jump apex/landing/impact, no double jump, buffering, coyote, step height, reduced air control.
- Wind determinism/seeds, `atInto`, level easing and spatial gust variation.
- Pool bounds, all six particle kinds with/without wind, death, splashes, finite state and nonnegative `z`.
- Exact chain/cloth anchors, capsule collision using closest-point distance, finite points, ≤5% chain stretch, ≤20% cloth tear guard, settling energy.
- Segment glyph membership for several segment configurations.
- Fixed-step counts, alpha, catch-up cap/backlog drop, pause and fresh post-pause accumulation.
- Both performance budgets.

**No new `tests/*.test.mjs` files were added.** Everything lives in the already-wired `tests/physics.test.mjs`; `package.json` needs no change.

## 9. Known weaknesses / follow-up

- `resolveBodies` is O(n²). It is fast for the tested 31 bodies, but hundreds of moving NPCs will need a dynamic body broad phase.
- The static jam fallback guarantees the tested feasible scenes stay clear, but contradictory/overlapping static collider placement can still force a body to stop.
- Vertical physics supports a scalar `groundHeight` and step limit, not ceilings, arbitrary platform sides, slope normals or multi-floor collision. A high obstacle represented as both a wall collider and raised ground will still block horizontal movement while airborne; elevated walkable surfaces should use the ground hook.
- Particles assume flat `z = 0` ground and do not know terrain/water. Water-only rain splashes and raised-ground bounce need either gameplay-driven emission or a future ground/impact callback.
- A full particle pool drops new emissions rather than recycling by priority. Callers must balance emission rates; invalid numeric particle kinds are not validated.
- Wind is deterministic for the same state/seed/time, but changing `baseAngle` while leaving `time` unchanged will not refresh its cached direction until time advances.
- Soft bodies have no self-collision or actual tearing. Cloth tear guard is a constraint-error test, not a destructive cloth simulation. Wearer capsules and anchors must be updated by the integrator. Collision after the chain follow-the-leader pass can alter exact segment length in heavily constrained configurations.
- Full interpolation requires previous/current render snapshots; only alpha is supplied.
- NPC behaviour/AI and all `riverScene.ts` wiring remain future integration work. Browser FPS at 1920×1080 must be measured after wiring and visual review.
