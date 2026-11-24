// Verlet soft bodies: Chain (hair, tails, mane, banner cords) and Cloth (capes, banners, tent flaps).
// World is top-down: x right, y down the screen, z = height. Screen position of a point = (x, y - z).
// Pinned points follow an anchor the game moves every frame; the rest lags, swings and settles.
import type { WindLike, WindSample } from './wind.ts';

/** Vertical-ish capsule of the wearer in world coordinates (a-b axis, radius). Points stay outside. */
export interface Capsule { ax: number; ay: number; az: number; bx: number; by: number; bz: number; radius: number }

export interface SoftBodyOptions {
  /** pull down the screen (+y), units/s^2 */ gravityY?: number;
  /** sag toward the ground (-z), units/s^2 */ gravityZ?: number;
  /** wind acceleration per unit wind strength, units/s^2 */ windForce?: number;
  /** velocity kept per 1/60 s step */ damping?: number;
  /** relaxation passes per step */ iterations?: number;
  /** points never sink below this height */ floor?: number;
  /** 0..1 how much wind flutters individual points */ flutter?: number;
}

export class SoftBody {
  readonly n: number;
  readonly x: Float64Array; readonly y: Float64Array; readonly z: Float64Array;
  readonly ox: Float64Array; readonly oy: Float64Array; readonly oz: Float64Array;
  readonly inv: Float64Array; // 0 = pinned
  /** constraints: first `ftl` are the ordered "leader" links, first `visible` are drawn as segments */
  protected ca: Int32Array = new Int32Array(0); protected cb: Int32Array = new Int32Array(0); protected rest: Float64Array = new Float64Array(0);
  protected ftl = 0; protected visible = 0;
  gravityY: number; gravityZ: number; windForce: number; damping: number; iterations: number; floor: number; flutter: number;
  /** wearer collision shapes (set each frame, e.g. torso + legs) */
  colliders: Capsule[] = [];
  protected placed = false;
  private sample: WindSample = { x: 0, y: 0, strength: 0 };
  private clock = 0;

  constructor(n: number, o: SoftBodyOptions = {}) {
    this.n = n;
    this.x = new Float64Array(n); this.y = new Float64Array(n); this.z = new Float64Array(n);
    this.ox = new Float64Array(n); this.oy = new Float64Array(n); this.oz = new Float64Array(n);
    this.inv = new Float64Array(n).fill(1);
    this.gravityY = o.gravityY ?? 60; this.gravityZ = o.gravityZ ?? 120; this.windForce = o.windForce ?? 90;
    this.damping = o.damping ?? .985; this.iterations = o.iterations ?? 5; this.floor = o.floor ?? 0; this.flutter = o.flutter ?? 1;
  }

  protected setConstraints(pairs: number[][], rest: number[], ftl: number, visible: number): void {
    this.ca = Int32Array.from(pairs.map(p => p[0])); this.cb = Int32Array.from(pairs.map(p => p[1]));
    this.rest = Float64Array.from(rest); this.ftl = ftl; this.visible = visible;
  }

  protected setPoint(i: number, x: number, y: number, z: number): void { this.x[i] = x; this.y[i] = y; this.z[i] = z; }

  /** Move every point by (dx, dy, dz) without adding velocity (use after a teleport / scene change). */
  translate(dx: number, dy: number, dz = 0): void {
    for (let i = 0; i < this.n; i++) { this.x[i] += dx; this.y[i] += dy; this.z[i] += dz; this.ox[i] += dx; this.oy[i] += dy; this.oz[i] += dz; }
  }

  /** Remove all velocity (previous = current). */
  settle(): void { for (let i = 0; i < this.n; i++) { this.ox[i] = this.x[i]; this.oy[i] = this.y[i]; this.oz[i] = this.z[i]; } }

  /** Step the simulation. dt is clamped to 1/30; large steps are split in two. `wind` is optional. */
  update(dt: number, wind?: WindLike | null): void {
    if (!(dt > 0)) return;
    if (dt > 1 / 30) dt = 1 / 30;
    const sub = dt > 1 / 50 ? 2 : 1; const h = dt / sub;
    this.clock += dt;
    const t = wind ? wind.time : this.clock;
    const s = this.sample; const n = this.n;
    const damp = Math.pow(this.damping, h * 60);
    for (let k = 0; k < sub; k++) {
      for (let i = 0; i < n; i++) {
        if (this.inv[i] === 0) continue;
        let ax = 0; let ay = this.gravityY; let az = -this.gravityZ;
        if (wind) {
          wind.atInto(s, this.x[i], this.y[i], t);
          const f = this.windForce;
          ax += s.x * f; ay += s.y * f;
          const flap = Math.sin(t * 6 + i * .9) * s.strength * f * .25 * this.flutter;
          az += flap + s.strength * f * .1;
        }
        const vx = (this.x[i] - this.ox[i]) * damp; const vy = (this.y[i] - this.oy[i]) * damp; const vz = (this.z[i] - this.oz[i]) * damp;
        this.ox[i] = this.x[i]; this.oy[i] = this.y[i]; this.oz[i] = this.z[i];
        this.x[i] += vx + ax * h * h; this.y[i] += vy + ay * h * h; this.z[i] += vz + az * h * h;
      }
      for (let it = 0; it < this.iterations; it++) { this.relax(); this.collide(); }
      this.leaders();
      this.collide();
    }
  }

  private relax(): void {
    const { ca, cb, rest, x, y, z, inv } = this;
    for (let c = 0; c < ca.length; c++) {
      const a = ca[c]; const b = cb[c];
      const w = inv[a] + inv[b]; if (w === 0) continue;
      const dx = x[b] - x[a]; const dy = y[b] - y[a]; const dz = z[b] - z[a];
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz); if (d < 1e-9) continue;
      const k = (d - rest[c]) / d / w;
      x[a] += dx * k * inv[a]; y[a] += dy * k * inv[a]; z[a] += dz * k * inv[a];
      x[b] -= dx * k * inv[b]; y[b] -= dy * k * inv[b]; z[b] -= dz * k * inv[b];
    }
  }

  /** Follow-the-leader pass: leaders (ordered from the pinned end) get their exact length. */
  private leaders(): void {
    const { ca, cb, rest, x, y, z, inv } = this;
    for (let c = 0; c < this.ftl; c++) {
      const a = ca[c]; const b = cb[c];
      if (inv[b] === 0) continue;
      const dx = x[b] - x[a]; const dy = y[b] - y[a]; const dz = z[b] - z[a];
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (d < 1e-9) { z[b] = z[a] - rest[c]; continue; }
      const k = rest[c] / d;
      x[b] = x[a] + dx * k; y[b] = y[a] + dy * k; z[b] = z[a] + dz * k;
    }
  }

  private collide(): void {
    const caps = this.colliders;
    for (let i = 0; i < this.n; i++) {
      if (this.inv[i] === 0) continue;
      for (let c = 0; c < caps.length; c++) {
        const q = caps[c];
        const sx = q.bx - q.ax; const sy = q.by - q.ay; const sz = q.bz - q.az;
        const len2 = sx * sx + sy * sy + sz * sz;
        const px = this.x[i] - q.ax; const py = this.y[i] - q.ay; const pz = this.z[i] - q.az;
        let t = len2 > 1e-12 ? (px * sx + py * sy + pz * sz) / len2 : 0;
        t = t < 0 ? 0 : t > 1 ? 1 : t;
        const cx = q.ax + sx * t; const cy = q.ay + sy * t; const cz = q.az + sz * t;
        let dx = this.x[i] - cx; let dy = this.y[i] - cy; let dz = this.z[i] - cz;
        const d2 = dx * dx + dy * dy + dz * dz;
        if (d2 >= q.radius * q.radius) continue;
        const d = Math.sqrt(d2);
        if (d < 1e-9) { dx = 0; dy = 1; dz = 0; } else { dx /= d; dy /= d; dz /= d; }
        this.x[i] = cx + dx * q.radius; this.y[i] = cy + dy * q.radius; this.z[i] = cz + dz * q.radius;
      }
      if (this.z[i] < this.floor) {
        this.z[i] = this.floor;
        this.ox[i] += (this.x[i] - this.ox[i]) * .5; this.oy[i] += (this.y[i] - this.oy[i]) * .5;  // ground friction
      }
    }
  }

  /** Total kinetic-like energy (sum of squared per-step displacement); ~0 when settled. */
  energy(): number {
    let e = 0;
    for (let i = 0; i < this.n; i++) { const dx = this.x[i] - this.ox[i]; const dy = this.y[i] - this.oy[i]; const dz = this.z[i] - this.oz[i]; e += dx * dx + dy * dy + dz * dz; }
    return e;
  }

  /** Largest relative length error over all constraints (0.05 = 5%). */
  maxStretch(): number {
    let m = 0;
    for (let c = 0; c < this.ca.length; c++) {
      const a = this.ca[c]; const b = this.cb[c];
      const d = Math.hypot(this.x[b] - this.x[a], this.y[b] - this.y[a], this.z[b] - this.z[a]);
      m = Math.max(m, Math.abs(d - this.rest[c]) / this.rest[c]);
    }
    return m;
  }

  /** World coordinates. Screen position is (x, y - z). */
  forEachPoint(cb: (x: number, y: number, z: number, index: number) => void): void {
    for (let i = 0; i < this.n; i++) cb(this.x[i], this.y[i], this.z[i], i);
  }

  forEachSegment(cb: (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, index: number) => void): void {
    for (let c = 0; c < this.visible; c++) {
      const a = this.ca[c]; const b = this.cb[c];
      cb(this.x[a], this.y[a], this.z[a], this.x[b], this.y[b], this.z[b], c);
    }
  }
}

/** Hair strand / ponytail / mane / tail / banner cord: `points` masses in a line, point 0 pinned. */
export class Chain extends SoftBody {
  constructor(points: number, segmentLength: number, o: SoftBodyOptions = {}) {
    super(points, o);
    const pairs: number[][] = []; const rest: number[] = [];
    for (let i = 0; i + 1 < points; i++) { pairs.push([i, i + 1]); rest.push(segmentLength); }
    this.setConstraints(pairs, rest, pairs.length, pairs.length);
    this.inv[0] = 0;
    for (let i = 0; i < points; i++) this.setPoint(i, 0, 0, -i * segmentLength);
    this.settle();
  }

  /** Move the pinned root. The first call also places the whole chain hanging from it. */
  setAnchor(x: number, y: number, z: number): void {
    if (!this.placed) { this.placed = true; this.translate(x - this.x[0], y - this.y[0], z - this.z[0]); return; }
    this.x[0] = x; this.y[0] = y; this.z[0] = z; this.ox[0] = x; this.oy[0] = y; this.oz[0] = z;
  }
}

/** Cape / banner / tent flap: cols x rows grid, top row pinned along an anchor line. */
export class Cloth extends SoftBody {
  readonly cols: number; readonly rows: number; private cellW: number; private cellH: number;
  constructor(cols: number, rows: number, width: number, height: number, o: SoftBodyOptions = {}) {
    super(cols * rows, { iterations: 8, ...o });
    this.cols = cols; this.rows = rows;
    this.cellW = width / Math.max(1, cols - 1); this.cellH = height / Math.max(1, rows - 1);
    const pairs: number[][] = []; const rest: number[] = [];
    const id = (c: number, r: number) => r * cols + c;
    for (let r = 0; r + 1 < rows; r++) for (let c = 0; c < cols; c++) { pairs.push([id(c, r), id(c, r + 1)]); rest.push(this.cellH); }
    const vertical = pairs.length;
    for (let r = 1; r < rows; r++) for (let c = 0; c + 1 < cols; c++) { pairs.push([id(c, r), id(c + 1, r)]); rest.push(this.cellW); }
    const visible = pairs.length;
    const diag = Math.hypot(this.cellW, this.cellH);
    for (let r = 0; r + 1 < rows; r++) for (let c = 0; c + 1 < cols; c++) {
      pairs.push([id(c, r), id(c + 1, r + 1)]); rest.push(diag);
      pairs.push([id(c + 1, r), id(c, r + 1)]); rest.push(diag);
    }
    this.setConstraints(pairs, rest, vertical, visible);
    for (let c = 0; c < cols; c++) this.inv[id(c, 0)] = 0;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) this.setPoint(id(c, r), (c - (cols - 1) / 2) * this.cellW, 0, -r * this.cellH);
    this.settle();
  }

  /** Pin the top row along the line a -> b (shoulders, banner pole). First call lays the cloth out hanging. */
  setAnchorLine(ax: number, ay: number, az: number, bx: number, by: number, bz: number): void {
    const { cols, rows } = this;
    for (let c = 0; c < cols; c++) {
      // Keep endpoints exact: interpolation at u = 1 can round a few ULPs away from b.
      const x = c === 0 ? ax : c === cols - 1 ? bx : ax + (bx - ax) * c / (cols - 1);
      const y = c === 0 ? ay : c === cols - 1 ? by : ay + (by - ay) * c / (cols - 1);
      const z = c === 0 ? az : c === cols - 1 ? bz : az + (bz - az) * c / (cols - 1);
      if (!this.placed) {
        for (let r = 0; r < rows; r++) { const i = r * cols + c; this.setPoint(i, x, y, z - r * this.cellH); }
      } else { this.x[c] = x; this.y[c] = y; this.z[c] = z; }
      this.ox[c] = this.x[c]; this.oy[c] = this.y[c]; this.oz[c] = this.z[c];
    }
    if (!this.placed) { this.placed = true; this.settle(); }
  }
}

/** Pick a glyph for a strand segment from its on-screen direction (screen = (x, y - z)).
 * Mostly vertical -> '|', diagonals -> '/' or '\\', near-horizontal -> '~', pointing up -> "'". */
export function segmentGlyph(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number): string {
  const dx = x1 - x0; const dy = (y1 - z1) - (y0 - z0);
  const deg = Math.atan2(Math.abs(dx), dy) * 57.29578; // 0 = straight down, 90 = sideways, 180 = straight up
  if (deg < 24) return '|';
  if (deg < 66) return dx * dy < 0 ? '/' : '\\';
  if (deg < 114) return '~';
  if (deg < 156) return dx * dy < 0 ? '/' : '\\';
  return "'";
}
