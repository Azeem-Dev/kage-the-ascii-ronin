// Uniform-grid spatial hash for static colliders (circles and capsule segments).
// Build once when the visible chunk set changes; query per physics substep.
// Import-free so it can be loaded on its own.

export interface Collider { x: number; y: number; radius: number }
/** Capsule / thick line: segment a-b inflated by radius. Use for walls and fences. */
export interface Segment { ax: number; ay: number; bx: number; by: number; radius: number }
export type Obstacle = Collider | Segment;
/** Anything moveBody can query for nearby obstacles (SpatialHash implements it). */
export interface ObstacleSource { query(x: number, y: number, r: number, out: Obstacle[]): Obstacle[] }

export function isSegment(o: Obstacle): o is Segment { return (o as Segment).bx !== undefined; }

/** Closest point on the obstacle's core (circle centre or segment) to (x, y). Writes into out. */
export function closestOnObstacle(o: Obstacle, x: number, y: number, out: { x: number; y: number }): void {
  if (!isSegment(o)) { out.x = o.x; out.y = o.y; return; }
  const sx = o.bx - o.ax; const sy = o.by - o.ay;
  const len2 = sx * sx + sy * sy;
  let t = len2 > 1e-12 ? ((x - o.ax) * sx + (y - o.ay) * sy) / len2 : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  out.x = o.ax + sx * t; out.y = o.ay + sy * t;
}

const probe = { x: 0, y: 0 };
/** Does the circle (x, y, r) overlap the obstacle (touching does not count). */
export function overlapsCircle(o: Obstacle, x: number, y: number, r: number): boolean {
  closestOnObstacle(o, x, y, probe);
  const dx = x - probe.x; const dy = y - probe.y; const reach = r + o.radius;
  return dx * dx + dy * dy < reach * reach;
}

export class SpatialHash implements ObstacleSource {
  private cells = new Map<number, number[]>();
  private items: readonly Obstacle[] = [];
  private stamp = new Uint32Array(0);
  private queryId = 0;
  readonly cellSize: number;
  constructor(cellSize = 32) { this.cellSize = cellSize; }

  get size(): number { return this.items.length; }

  private key(cx: number, cy: number): number { return (cx + 32768) * 65536 + (cy + 32768); }

  /** (Re)build from a list. The array is kept by reference; do not mutate it afterwards without rebuilding. */
  build(items: readonly Obstacle[]): this {
    this.items = items; this.cells.clear();
    this.stamp = new Uint32Array(items.length); this.queryId = 0;
    const inv = 1 / this.cellSize;
    for (let i = 0; i < items.length; i++) {
      const o = items[i];
      let minX: number, maxX: number, minY: number, maxY: number;
      if (isSegment(o)) { minX = Math.min(o.ax, o.bx); maxX = Math.max(o.ax, o.bx); minY = Math.min(o.ay, o.by); maxY = Math.max(o.ay, o.by); }
      else { minX = maxX = o.x; minY = maxY = o.y; }
      const cx0 = Math.floor((minX - o.radius) * inv); const cx1 = Math.floor((maxX + o.radius) * inv);
      const cy0 = Math.floor((minY - o.radius) * inv); const cy1 = Math.floor((maxY + o.radius) * inv);
      for (let cx = cx0; cx <= cx1; cx++) for (let cy = cy0; cy <= cy1; cy++) {
        const k = this.key(cx, cy);
        const cell = this.cells.get(k);
        if (cell) cell.push(i); else this.cells.set(k, [i]);
      }
    }
    return this;
  }

  /** Obstacles overlapping the circle (x, y, r). Clears and fills `out` (no allocation) and returns it. */
  query(x: number, y: number, r: number, out: Obstacle[]): Obstacle[] {
    out.length = 0;
    if (++this.queryId >= 0xfffffff0) { this.stamp.fill(0); this.queryId = 1; }
    const inv = 1 / this.cellSize;
    const cx0 = Math.floor((x - r) * inv); const cx1 = Math.floor((x + r) * inv);
    const cy0 = Math.floor((y - r) * inv); const cy1 = Math.floor((y + r) * inv);
    for (let cx = cx0; cx <= cx1; cx++) for (let cy = cy0; cy <= cy1; cy++) {
      const cell = this.cells.get(this.key(cx, cy));
      if (!cell) continue;
      for (let k = 0; k < cell.length; k++) {
        const i = cell[k];
        if (this.stamp[i] === this.queryId) continue;
        this.stamp[i] = this.queryId;
        const o = this.items[i];
        if (overlapsCircle(o, x, y, r)) out.push(o);
      }
    }
    return out;
  }
}
