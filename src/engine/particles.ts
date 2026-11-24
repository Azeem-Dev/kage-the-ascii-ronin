// Pooled particle system: fixed-size typed arrays, no per-frame allocation.
// World is top-down: x right, y down the screen, z = height. Draw at screen (x, y - z).
import type { WindLike, WindSample } from './wind.ts';

export const ParticleKind = { dust: 0, leaf: 1, spark: 2, splash: 3, rain: 4, smoke: 5 } as const;
export type ParticleKindName = keyof typeof ParticleKind;
export const KIND_COUNT = 6;

interface KindDef {
  gravity: number;      // units/s^2 downward (negative = buoyant)
  dragXY: number; dragZ: number;   // pull toward the wind velocity (xy) / toward rest (z), 1/s
  wind: number;         // wind velocity per unit wind strength (units/s)
  restitution: number; friction: number;
  lifeMin: number; lifeMax: number;
  speed: number;        // initial horizontal speed scale
  vzMin: number; vzMax: number;
  flutter: number;      // sideways wobble acceleration (leaves)
  dieOnGround: boolean;
}
// order must match ParticleKind
const DEFS: KindDef[] = [
  /* dust   */ { gravity: 30, dragXY: 3, dragZ: 3, wind: 20, restitution: 0, friction: 6, lifeMin: .4, lifeMax: .8, speed: 10, vzMin: 6, vzMax: 16, flutter: 0, dieOnGround: false },
  /* leaf   */ { gravity: 22, dragXY: 1.8, dragZ: 2.8, wind: 42, restitution: .2, friction: 5, lifeMin: 4, lifeMax: 8, speed: 6, vzMin: 0, vzMax: 8, flutter: 40, dieOnGround: false },
  /* spark  */ { gravity: -14, dragXY: 1.2, dragZ: 1, wind: 38, restitution: .3, friction: 3, lifeMin: .5, lifeMax: 1.2, speed: 8, vzMin: 20, vzMax: 45, flutter: 0, dieOnGround: false },
  /* splash */ { gravity: 260, dragXY: 2, dragZ: .2, wind: 4, restitution: .15, friction: 8, lifeMin: .35, lifeMax: .6, speed: 14, vzMin: 40, vzMax: 80, flutter: 0, dieOnGround: false },
  /* rain   */ { gravity: 60, dragXY: .5, dragZ: .3, wind: 30, restitution: 0, friction: 0, lifeMin: 3, lifeMax: 3.5, speed: 0, vzMin: -140, vzMax: -110, flutter: 0, dieOnGround: true },
  /* smoke  */ { gravity: -10, dragXY: 1, dragZ: 1.2, wind: 48, restitution: 0, friction: 2, lifeMin: 1.5, lifeMax: 3, speed: 4, vzMin: 8, vzMax: 16, flutter: 0, dieOnGround: false },
];

const MAX_SPLASHES_PER_UPDATE = 256;

export class ParticleSystem {
  readonly capacity: number;
  count = 0;
  readonly x: Float32Array; readonly y: Float32Array; readonly z: Float32Array;
  readonly vx: Float32Array; readonly vy: Float32Array; readonly vz: Float32Array;
  readonly life: Float32Array; readonly maxLife: Float32Array;
  readonly kind: Uint8Array;
  /** rain splashes happening on the ground: emitted as `splash` particles (set false to disable) */
  rainSplashes = true;
  private rng: number;
  private sample: WindSample = { x: 0, y: 0, strength: 0 };
  private time = 0;
  private splashX = new Float32Array(MAX_SPLASHES_PER_UPDATE); private splashY = new Float32Array(MAX_SPLASHES_PER_UPDATE);

  constructor(capacity = 4096, seed = 1234567) {
    this.capacity = capacity;
    this.x = new Float32Array(capacity); this.y = new Float32Array(capacity); this.z = new Float32Array(capacity);
    this.vx = new Float32Array(capacity); this.vy = new Float32Array(capacity); this.vz = new Float32Array(capacity);
    this.life = new Float32Array(capacity); this.maxLife = new Float32Array(capacity);
    this.kind = new Uint8Array(capacity);
    this.rng = (seed >>> 0) || 1;
  }

  private rand(): number {
    let s = this.rng; s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; this.rng = s;
    return s / 4294967296;
  }

  clear(): void { this.count = 0; }

  /** Emit `count` particles around (x, y, z) within `spread` units. Returns how many fit in the pool
   * (the rest are dropped; the pool never grows). */
  emit(kind: number | ParticleKindName, x: number, y: number, z: number, count = 1, spread = 0): number {
    const k = typeof kind === 'number' ? kind : ParticleKind[kind];
    const def = DEFS[k];
    let made = 0;
    for (; made < count && this.count < this.capacity; made++) {
      const i = this.count++;
      const a = this.rand() * 6.283185307; const r = Math.sqrt(this.rand()) * spread;
      this.x[i] = x + Math.cos(a) * r; this.y[i] = y + Math.sin(a) * r; this.z[i] = z;
      const b = this.rand() * 6.283185307; const sp = def.speed * (.3 + .7 * this.rand());
      this.vx[i] = Math.cos(b) * sp; this.vy[i] = Math.sin(b) * sp;
      this.vz[i] = def.vzMin + (def.vzMax - def.vzMin) * this.rand();
      const life = def.lifeMin + (def.lifeMax - def.lifeMin) * this.rand();
      this.life[i] = life; this.maxLife[i] = life; this.kind[i] = k;
    }
    return made;
  }

  update(dt: number, wind?: WindLike | null): void {
    if (dt <= 0) return;
    if (dt > .1) dt = .1;
    this.time += dt;
    const t = wind ? wind.time : this.time;
    const s = this.sample; let splashes = 0;
    for (let i = this.count - 1; i >= 0; i--) {
      const def = DEFS[this.kind[i]];
      let life = this.life[i] - dt;
      if (life <= 0) { this.remove(i); continue; }
      this.life[i] = life;
      let x = this.x[i]; let y = this.y[i]; let z = this.z[i];
      let vx = this.vx[i]; let vy = this.vy[i]; let vz = this.vz[i];
      let wx = 0; let wy = 0;
      if (wind) { wind.atInto(s, x, y, t); wx = s.x * def.wind; wy = s.y * def.wind; }
      vx += (wx - vx) * def.dragXY * dt; vy += (wy - vy) * def.dragXY * dt;
      if (def.flutter) {
        const ph = t * 5 + i * 1.7;
        vx += Math.sin(ph) * def.flutter * dt; vy += Math.cos(ph * .83) * def.flutter * dt * .6;
      }
      vz += (-def.gravity - vz * def.dragZ) * dt;
      x += vx * dt; y += vy * dt; z += vz * dt;
      if (z <= 0 && vz < 0) {
        z = 0;
        if (def.dieOnGround) {
          if (this.rainSplashes && splashes < MAX_SPLASHES_PER_UPDATE) { this.splashX[splashes] = x; this.splashY[splashes] = y; splashes++; }
          this.remove(i); continue;
        }
        vz = -vz * def.restitution; if (vz < 3) vz = 0;
        const f = Math.max(0, 1 - def.friction * dt); vx *= f; vy *= f;
      } else if (z < 0) z = 0;
      this.x[i] = x; this.y[i] = y; this.z[i] = z; this.vx[i] = vx; this.vy[i] = vy; this.vz[i] = vz;
    }
    // spawn splashes after the loop so swap-removal order is never disturbed (about 1 in 3 rain drops)
    for (let k = 0; k < splashes; k += 3) this.emit(ParticleKind.splash, this.splashX[k], this.splashY[k], 0, 1, .5);
  }

  private remove(i: number): void {
    const last = --this.count;
    if (i === last) return;
    this.x[i] = this.x[last]; this.y[i] = this.y[last]; this.z[i] = this.z[last];
    this.vx[i] = this.vx[last]; this.vy[i] = this.vy[last]; this.vz[i] = this.vz[last];
    this.life[i] = this.life[last]; this.maxLife[i] = this.maxLife[last]; this.kind[i] = this.kind[last];
  }

  /** age01: 0 = just born, 1 = about to die. Draw at screen (x, y - z). */
  forEach(cb: (x: number, y: number, z: number, kind: number, age01: number) => void): void {
    for (let i = 0; i < this.count; i++) cb(this.x[i], this.y[i], this.z[i], this.kind[i], 1 - this.life[i] / this.maxLife[i]);
  }
}
