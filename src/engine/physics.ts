export interface Body { x: number; y: number; vx: number; vy: number }
export interface Collider { x: number; y: number; radius: number }

/** Accelerated top-down motion with friction, circle contacts and axis sliding.
 * Substeps keep fast mounted movement from tunnelling through narrow trunks. */
export function moveBody(body: Body, dx: number, dy: number, speed: number, dt: number, obstacles: readonly Collider[], radius = 2): void {
  const length = Math.hypot(dx, dy);
  const blend = 1 - Math.exp(-dt * (length ? 12 : 16));
  body.vx += ((length ? dx / length * speed : 0) - body.vx) * blend;
  body.vy += ((length ? dy / length * speed : 0) - body.vy) * blend;
  if (!length && Math.hypot(body.vx, body.vy) < .1) { body.vx = 0; body.vy = 0; }
  const steps = Math.max(1, Math.ceil(Math.hypot(body.vx, body.vy) * dt / 1.2));
  for (let i = 0; i < steps; i++) {
    let x = body.x + body.vx * dt / steps;
    let y = body.y + body.vy * dt / steps;
    for (const obstacle of obstacles) {
      const dx = x - obstacle.x; const dy = y - obstacle.y;
      const distance = Math.hypot(dx, dy); const contact = radius + obstacle.radius;
      if (distance >= contact) continue;
      const nx = distance > .0001 ? dx / distance : -1;
      const ny = distance > .0001 ? dy / distance : 0;
      x = obstacle.x + nx * contact; y = obstacle.y + ny * contact;
      // Remove only inward velocity. Preserve its tangent for natural sliding.
      const inward = body.vx * nx + body.vy * ny;
      if (inward < 0) { body.vx -= inward * nx; body.vy -= inward * ny; }
    }
    body.x = x; body.y = y;
  }
}
