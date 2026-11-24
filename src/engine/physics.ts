import { closestOnObstacle, overlapsCircle, type Obstacle, type ObstacleSource } from './spatialHash.ts';
export type { Collider, Segment, Obstacle, ObstacleSource } from './spatialHash.ts';
export { SpatialHash } from './spatialHash.ts';
import type { Collider } from './spatialHash.ts';

export interface Body { x: number; y: number; vx: number; vy: number; z?: number; vz?: number }

const MAX_PASSES = 6;
const MAX_STEP = 1;           // max distance (units) a body travels per substep
const QUERY_MARGIN = 4;       // extra reach when querying a SpatialHash around a substep
const scratch: Obstacle[] = [];
const near = { x: 0, y: 0 };

function penetrates(list: readonly Obstacle[], x: number, y: number, radius: number): boolean {
  for (let i = 0; i < list.length; i++) {
    const o = list[i];
    closestOnObstacle(o, x, y, near);
    const dx = x - near.x; const dy = y - near.y; const contact = radius + o.radius - 1e-3;
    if (dx * dx + dy * dy < contact * contact) return true;
  }
  return false;
}

/** Push the circle out of every obstacle, repeating until stable (fixes COLL-01: pushing out of one
 * obstacle used to push the body into the next one). Writes the result into `pos`. Returns true if it
 * ended clear of all obstacles. Removes inward velocity from `body` on each contact. */
function resolve(body: Body, pos: { x: number; y: number }, list: readonly Obstacle[], radius: number, fx: number, fy: number): void {
  let x = pos.x; let y = pos.y;
  for (let pass = 0; pass < MAX_PASSES; pass++) {
    let moved = false;
    for (let i = 0; i < list.length; i++) {
      const o = list[i];
      closestOnObstacle(o, x, y, near);
      const dx = x - near.x; const dy = y - near.y;
      const contact = radius + o.radius;
      const d2 = dx * dx + dy * dy;
      if (d2 >= contact * contact) continue;
      const distance = Math.sqrt(d2);
      let nx: number; let ny: number;
      if (distance > 1e-6) { nx = dx / distance; ny = dy / distance; } else { nx = fx; ny = fy; }
      x = near.x + nx * (contact + 1e-4); y = near.y + ny * (contact + 1e-4);
      moved = true;
      // Remove only inward velocity. Preserve its tangent for natural sliding.
      const inward = body.vx * nx + body.vy * ny;
      if (inward < 0) { body.vx -= inward * nx; body.vy -= inward * ny; }
    }
    if (!moved) break;
  }
  pos.x = x; pos.y = y;
}

const pos = { x: 0, y: 0 };

function obstaclesNear(obstacles: readonly Obstacle[] | ObstacleSource, x: number, y: number, r: number): readonly Obstacle[] {
  return 'query' in obstacles ? obstacles.query(x, y, r, scratch) : obstacles;
}

/** Shared motion core. `blocked` (optional) vetoes a destination (used for step-height limits). */
export function moveCore(body: Body, dx: number, dy: number, speed: number, dt: number, obstacles: readonly Obstacle[] | ObstacleSource,
  radius: number, accel: number, friction: number, blocked?: (x: number, y: number) => boolean): void {
  const length = Math.hypot(dx, dy);
  const blend = 1 - Math.exp(-dt * (length ? accel : friction));
  body.vx += ((length ? dx / length * speed : 0) - body.vx) * blend;
  body.vy += ((length ? dy / length * speed : 0) - body.vy) * blend;
  if (!length && Math.hypot(body.vx, body.vy) < .1) { body.vx = 0; body.vy = 0; }
  const steps = Math.max(1, Math.ceil(Math.hypot(body.vx, body.vy) * dt / MAX_STEP));
  const h = dt / steps;
  for (let i = 0; i < steps; i++) {
    const ox = body.x; const oy = body.y;
    let x = ox + body.vx * h; let y = oy + body.vy * h;
    if (blocked && blocked(x, y)) {
      if (!blocked(x, oy)) { y = oy; body.vy = 0; }
      else if (!blocked(ox, y)) { x = ox; body.vx = 0; }
      else { x = ox; y = oy; body.vx = 0; body.vy = 0; }
    }
    const list = obstaclesNear(obstacles, x, y, radius + Math.hypot(x - ox, y - oy) + QUERY_MARGIN);
    if (list.length) {
      const speedNow = Math.hypot(body.vx, body.vy);
      const fx = speedNow > 1e-6 ? -body.vx / speedNow : -1; const fy = speedNow > 1e-6 ? -body.vy / speedNow : 0;
      pos.x = x; pos.y = y;
      resolve(body, pos, list, radius, fx, fy);
      x = pos.x; y = pos.y;
      // Jammed between obstacles: stay where we were (known clear) instead of ending inside one.
      if (penetrates(list, x, y, radius) && !penetrates(list, ox, oy, radius)) { x = ox; y = oy; body.vx = 0; body.vy = 0; }
    }
    body.x = x; body.y = y;
  }
}

/** Accelerated top-down motion with friction, circle/capsule contacts and axis sliding.
 * Substeps keep fast mounted movement from tunnelling through narrow trunks. Obstacles may be an array
 * or a SpatialHash (preferred for hundreds of colliders). */
export function moveBody(body: Body, dx: number, dy: number, speed: number, dt: number, obstacles: readonly Obstacle[] | ObstacleSource, radius = 2): void {
  moveCore(body, dx, dy, speed, dt, obstacles, radius, 12, 16);
}

// ---------------------------------------------------------------------------------------------
// Body vs body (characters, animals, enemies) with mass.

export interface SolidBody extends Body {
  radius: number;
  /** kg-ish. Heavier bodies push lighter ones. Infinity = immovable. Default 1. */
  mass?: number;
  /** false = ignored (e.g. a rider while mounted). Default true. */
  solid?: boolean;
}

/** Separate overlapping bodies. The overlap is shared by inverse mass (a horse moves a goblin ~10x more
 * than the goblin moves the horse) and approach velocity along the contact normal is removed. If
 * `obstacles` is given every pushed body is re-resolved against static obstacles afterwards, so bodies
 * cannot be shoved into trees. Returns the number of contacts resolved in the last iteration. */
export function resolveBodies(bodies: readonly SolidBody[], obstacles?: readonly Obstacle[] | ObstacleSource, iterations = 3): number {
  let contacts = 0;
  for (let it = 0; it < iterations; it++) {
    contacts = 0;
    for (let i = 0; i < bodies.length; i++) {
      const a = bodies[i]; if (a.solid === false) continue;
      for (let j = i + 1; j < bodies.length; j++) {
        const b = bodies[j]; if (b.solid === false) continue;
        const dx = a.x - b.x; const dy = a.y - b.y; const contact = a.radius + b.radius;
        const d2 = dx * dx + dy * dy;
        if (d2 >= contact * contact) continue;
        const ma = a.mass ?? 1; const mb = b.mass ?? 1;
        const ia = ma === Infinity ? 0 : 1 / ma; const ib = mb === Infinity ? 0 : 1 / mb;
        const sum = ia + ib; if (sum === 0) continue;
        const distance = Math.sqrt(d2);
        const nx = distance > 1e-6 ? dx / distance : 1; const ny = distance > 1e-6 ? dy / distance : 0;
        const push = contact - distance + 1e-4;
        a.x += nx * push * ia / sum; a.y += ny * push * ia / sum;
        b.x -= nx * push * ib / sum; b.y -= ny * push * ib / sum;
        const approach = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
        if (approach < 0) {
          const j2 = -approach / sum;
          a.vx += nx * j2 * ia; a.vy += ny * j2 * ia;
          b.vx -= nx * j2 * ib; b.vy -= ny * j2 * ib;
        }
        contacts++;
      }
    }
    if (obstacles) {
      for (const body of bodies) {
        if (body.solid === false) continue;
        const list = obstaclesNear(obstacles, body.x, body.y, body.radius + QUERY_MARGIN * 2);
        if (!list.length) continue;
        pos.x = body.x; pos.y = body.y;
        resolve(body, pos, list, body.radius, 1, 0);
        body.x = pos.x; body.y = pos.y;
      }
    }
    if (!contacts) break;
  }
  return contacts;
}

// ---------------------------------------------------------------------------------------------
// Gravity, jumping, step height.

export interface Body3D extends Body {
  z: number; vz: number;
  grounded: boolean;
  /** seconds left in which a jump is still allowed after walking off an edge */
  coyote: number;
  /** seconds left on a buffered jump press; pendingJump is its speed */
  jumpBuffer: number; pendingJump: number;
  /** events: landed/impact are reset every step; `jumped` is set by jump() (also when a buffered press fires) and cleared by the game after it spawns dust */
  jumped: boolean; landed: boolean; impact: number;
}

export interface Physics3DOptions {
  gravity?: number;        // default 400 units/s^2
  stepHeight?: number;     // default 4: highest ledge walkable without jumping
  coyoteTime?: number;     // default 0.1 s
  bufferTime?: number;     // default 0.1 s
  airControl?: number;     // default 0.35
  groundHeight?: (x: number, y: number) => number; // default 0
}

export const GRAVITY = 400;

export function createBody3D(x: number, y: number, z = 0): Body3D {
  return { x, y, vx: 0, vy: 0, z, vz: 0, grounded: z === 0, coyote: 0, jumpBuffer: 0, pendingJump: 0, jumped: false, landed: false, impact: 0 };
}

/** Jump now if grounded or inside the coyote window (returns true). Otherwise the press is buffered
 * for `bufferTime` and fires on landing (returns false). Never double-jumps. */
export function jump(body: Body3D, speed: number, opts: Physics3DOptions = {}): boolean {
  if (body.grounded || body.coyote > 0) {
    body.vz = speed; body.grounded = false; body.coyote = 0; body.jumpBuffer = 0; body.jumped = true;
    return true;
  }
  body.jumpBuffer = opts.bufferTime ?? .1; body.pendingJump = speed;
  return false;
}

/** Vertical integration: gravity, jump buffer/coyote, landing and ground-following. Call once per step
 * after the horizontal move. Sets body.landed / body.impact (downward speed at touchdown). */
export function stepVertical(body: Body3D, dt: number, opts: Physics3DOptions = {}): void {
  const g = opts.gravity ?? GRAVITY; const stepHeight = opts.stepHeight ?? 4;
  const ground = opts.groundHeight ? opts.groundHeight(body.x, body.y) : 0;
  body.landed = false; body.impact = 0;
  if (body.jumpBuffer > 0) {
    body.jumpBuffer -= dt;
    if (body.jumpBuffer > 0 && (body.grounded || body.coyote > 0)) jump(body, body.pendingJump, opts);
  }
  if (body.grounded) {
    const drop = body.z - ground;
    if (drop <= stepHeight + 1e-9) { body.z = ground; body.vz = 0; }
    else { body.grounded = false; body.coyote = opts.coyoteTime ?? .1; body.vz = 0; }  // walked off a ledge
  }
  if (!body.grounded) {
    if (body.coyote > 0) body.coyote -= dt;
    body.z += body.vz * dt - .5 * g * dt * dt;
    body.vz -= g * dt;
    if (body.z <= ground && body.vz <= 0) {
      body.impact = -body.vz; body.z = ground; body.vz = 0; body.grounded = true; body.landed = true; body.coyote = 0;
      if (body.jumpBuffer > 0) jump(body, body.pendingJump, opts);
    }
  }
}

/** Horizontal move with air control + ledge blocking, then vertical step. One call per body per step. */
export function moveBody3D(body: Body3D, dx: number, dy: number, speed: number, dt: number, obstacles: readonly Obstacle[] | ObstacleSource,
  radius = 2, opts: Physics3DOptions = {}): void {
  const stepHeight = opts.stepHeight ?? 4; const gh = opts.groundHeight;
  const air = body.grounded ? 1 : (opts.airControl ?? .35);
  const blocked = gh ? (x: number, y: number) => gh(x, y) - body.z > stepHeight : undefined;
  // airborne: weaker steering and much lower friction (momentum carries)
  moveCore(body, dx, dy, speed, dt, obstacles, radius, 12 * air, body.grounded ? 16 : 1.5, blocked);
  stepVertical(body, dt, opts);
}

export type { Collider as PhysicsCollider };
export { overlapsCircle };
