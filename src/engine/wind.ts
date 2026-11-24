// One shared wind field: slowly turning base direction + gust fronts sweeping across the world.
// Import-free, deterministic (same state + same (x, y, t) -> same result), allocation-free in atInto.

export interface WindSample { x: number; y: number; strength: number }
/** What particles / soft bodies need from a wind field. */
export interface WindLike { time: number; atInto(out: WindSample, x: number, y: number, t?: number): WindSample }

function hash(ix: number, iy: number, seed: number): number {
  let n = Math.imul(ix + 713, 374761393) ^ Math.imul(iy + 197, 668265263) ^ Math.imul(seed, 144269);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}
/** Smooth value noise in 0..1 */
function vnoise(x: number, y: number, seed: number): number {
  const ix = Math.floor(x); const iy = Math.floor(y);
  const fx = x - ix; const fy = y - iy;
  const u = fx * fx * (3 - 2 * fx); const v = fy * fy * (3 - 2 * fy);
  const a = hash(ix, iy, seed); const b = hash(ix + 1, iy, seed);
  const c = hash(ix, iy + 1, seed); const d = hash(ix + 1, iy + 1, seed);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

export const WIND_LEVELS = { calm: .12, breeze: .4, storm: 1 } as const;

export class Wind {
  /** simulated seconds (advanced by update) */
  time = 0;
  /** current base strength, eased toward `target`; ~0 calm, .4 breeze, 1 storm (gusts reach ~1.6x) */
  strength: number;
  target: number;
  /** mean direction in radians (0 = +x, PI/2 = +y i.e. down the screen) */
  baseAngle: number;
  /** how fast gust fronts travel along the wind (units/s) and their spacing (units) */
  gustSpeed = 42; gustSize = 130;
  seed: number;
  private cachedT = NaN; private cachedCos = 1; private cachedSin = 0;

  constructor(level: number | keyof typeof WIND_LEVELS = 'breeze', baseAngle = .35, seed = 7) {
    this.target = this.strength = typeof level === 'number' ? level : WIND_LEVELS[level];
    this.baseAngle = baseAngle; this.seed = seed;
  }

  /** Change the base strength (number, or 'calm' | 'breeze' | 'storm'); it eases in over a few seconds. */
  setLevel(level: number | keyof typeof WIND_LEVELS): void { this.target = typeof level === 'number' ? level : WIND_LEVELS[level]; }

  update(dt: number): void {
    this.time += dt;
    this.strength += (this.target - this.strength) * (1 - Math.exp(-dt * .6));
  }

  /** Wind at world (x, y) at time t (default: this.time) written into `out`. */
  atInto(out: WindSample, x: number, y: number, t: number = this.time): WindSample {
    if (t !== this.cachedT) {
      const a = this.baseAngle + (vnoise(t * .035, 0, this.seed) - .5) * 1.8;
      this.cachedT = t; this.cachedCos = Math.cos(a); this.cachedSin = Math.sin(a);
    }
    const c = this.cachedCos; const s = this.cachedSin;
    // gust fronts: noise advected along the wind direction, stretched across it
    const along = x * c + y * s; const across = -x * s + y * c;
    const front = vnoise((along - t * this.gustSpeed) / this.gustSize, across / (this.gustSize * 2.2), this.seed + 11);
    const gust = front < .42 ? 0 : front > .78 ? 1 : ((front - .42) / .36) ** 2 * (3 - 2 * (front - .42) / .36);
    const turb = vnoise(x / 14 + t * .7, y / 14 - t * .5, this.seed + 23) - .5;
    let strength = this.strength * (.55 + 1.05 * gust + .4 * turb);
    if (strength < 0) strength = 0;
    // turbulence swings the direction a little (cos/sin of small angle approximated)
    const k = turb * .5;
    out.x = (c - s * k) * strength; out.y = (s + c * k) * strength; out.strength = strength;
    return out;
  }

  /** Allocating convenience wrapper; hot paths should use atInto. */
  at(x: number, y: number, t: number = this.time): WindSample { return this.atInto({ x: 0, y: 0, strength: 0 }, x, y, t); }
}
