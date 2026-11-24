import { ParticleKind, ParticleSystem } from '../engine/particles.ts';
import { Wind } from '../engine/wind.ts';
import { waterDepth } from '../assets/landscape.ts';
import { LAYER, type AssetRenderer, type Lighting } from '../render/assetRenderer.ts';

export type WeatherMode = 'clear' | 'rain' | 'storm' | 'snow' | 'firefall';
export const WEATHER_MODES: readonly WeatherMode[] = ['clear', 'rain', 'storm', 'snow', 'firefall'];

/** A building on fire, in world units (x, y = ground anchor; width/height of the building). */
export interface Fire { id: string; x: number; y: number; width: number; height: number }

/** Per-second spawn rates over the visible area at default zoom. */
const RATES: Record<WeatherMode, { rain: number; snow: number; ember: number; ash: number; wind: number }> = {
  clear: { rain: 0, snow: 0, ember: 0, ash: 0, wind: .2 },
  rain: { rain: 1100, snow: 0, ember: 0, ash: 0, wind: .45 },
  storm: { rain: 2600, snow: 0, ember: 0, ash: 0, wind: 1 },
  snow: { rain: 0, snow: 520, ember: 0, ash: 0, wind: .3 },
  firefall: { rain: 0, snow: 0, ember: 190, ash: 320, wind: .5 },
};

/**
 * Weather and fire as real particles: drops, flakes, embers and flames fall or rise
 * with gravity and the shared wind field, hit the ground, and are drawn as glyphs
 * at screen (x, y - z). Rain streaks along its motion; flames age from white-hot to red.
 */
export class Weather {
  mode: WeatherMode = 'clear';
  /** 0..1 snow lying on the ground and roofs (GPU whitens cells). */
  snowCover = 0;
  /** 0..1 lightning flash, decays fast. */
  flash = 0;
  readonly fires: Fire[] = [];
  readonly wind = new Wind('calm', .35, 11);
  private particles = new ParticleSystem(12000, 4242);
  get particleCount(): number { return this.particles.count; }
  private carry = { rain: 0, snow: 0, ember: 0, ash: 0 };
  private rng = 1;
  private g: Record<string, number[]>;

  constructor(renderer: AssetRenderer) {
    const ids = (pairs: [string, string][]) => pairs.map(([c, col]) => renderer.glyph(c, col));
    this.g = {
      rainFar: ids([['|', '#4a6a80'], ['/', '#4a6a80'], ['\\', '#4a6a80']]),
      rainNear: ids([['|', '#9cc0d6'], ['/', '#9cc0d6'], ['\\', '#9cc0d6']]),
      rainTrail: ids([['|', '#2f4a5e'], ['/', '#2f4a5e'], ['\\', '#2f4a5e']]),
      splash: ids([['o', '#b8d4e2'], ['.', '#7fa2b6'], ['°', '#d6ecf6']]),
      ring: ids([['(', '#6f93a6'], [')', '#6f93a6'], ['-', '#86a9bb']]),
      snow: ids([['*', '#f2f6ff'], ['+', '#dde7f6'], ['.', '#c6d4e8'], ["'", '#e8eefb']]),
      ember: ids([['*', '#ffd27a'], ["'", '#ff9a3c'], ['.', '#ff6a2a'], ['*', '#ffb347']]),
      ash: ids([['.', '#8a8682'], [',', '#6f6a66'], ["'", '#a29d97']]),
      flame: ids([['^', '#fff4c8'], ['A', '#ffd24a'], ['*', '#ff9a2a'], ['^', '#ff6a1e'], ["'", '#c8361a'], ['.', '#6a2a1a']]),
      smoke: ids([['~', '#55524f'], ['(', '#45423f'], ['.', '#3a3836'], ['~', '#6a6660']]),
      spark: ids([['.', '#ffe08a'], ['*', '#ffc04a']]),
      dust: ids([['.', '#a49b78']]),
      leaf: ids([['~', '#6f8f4a']]),
    };
  }

  private rand(): number { let s = this.rng; s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; this.rng = s || 1; return this.rng / 4294967296; }

  cycle(): WeatherMode { this.mode = WEATHER_MODES[(WEATHER_MODES.indexOf(this.mode) + 1) % WEATHER_MODES.length]; return this.mode; }

  toggleFire(fire: Fire): boolean {
    const i = this.fires.findIndex(f => f.id === fire.id);
    if (i >= 0) { this.fires.splice(i, 1); return false; }
    this.fires.push(fire); return true;
  }

  /** viewX/Y/W/H: the visible world rectangle. */
  update(dt: number, viewX: number, viewY: number, viewW: number, viewH: number): void {
    const rate = RATES[this.mode];
    this.wind.setLevel(rate.wind);
    this.wind.update(dt);
    // Rates scale with the visible area so density looks the same at any zoom.
    const area = (viewW * viewH) / (480 * 270);
    const spawn = (key: keyof typeof this.carry, kind: number, perSecond: number, zMin: number, zMax: number) => {
      this.carry[key] += perSecond * area * dt;
      while (this.carry[key] >= 1) {
        this.carry[key]--;
        const z = zMin + this.rand() * (zMax - zMin);
        // Spawn above and up-wind of the view so drops fall *into* it.
        this.particles.emit(kind, viewX - 40 + this.rand() * (viewW + 80), viewY - 20 + this.rand() * (viewH + z + 40), z, 1, 0);
      }
    };
    spawn('rain', ParticleKind.rain, rate.rain, 40, 130);
    spawn('snow', ParticleKind.snow, rate.snow, 30, 110);
    spawn('ember', ParticleKind.ember, rate.ember, 40, 120);
    spawn('ash', ParticleKind.ash, rate.ash, 30, 110);
    // Fires: flames lick up the walls and roof, smoke and sparks rise above.
    for (const f of this.fires) {
      if (f.x < viewX - 200 || f.x > viewX + viewW + 200 || f.y < viewY - 50 || f.y > viewY + viewH + 300) continue;
      const scale = Math.max(.6, f.width / 70);
      const burst = (kind: number, perSecond: number, zLo: number, zHi: number, spread: number) => {
        let n = perSecond * scale * dt; while (n > 0) { if (n < 1 && this.rand() > n) break; n--;
          this.particles.emit(kind, f.x + (this.rand() - .5) * f.width * spread, f.y - this.rand() * 6, f.height * (zLo + this.rand() * (zHi - zLo)), 1, 0); }
      };
      burst(ParticleKind.flame, 140, 0, .85, .8);
      burst(ParticleKind.smoke, 16, .7, 1, .5);
      burst(ParticleKind.spark, 10, .6, 1, .6);
    }
    this.particles.update(dt, this.wind);
    this.snowCover = this.mode === 'snow' ? Math.min(.85, this.snowCover + dt / 45) : Math.max(0, this.snowCover - dt / 30);
    this.flash = Math.max(0, this.flash - dt * 4.5);
    if (this.mode === 'storm' && this.rand() < dt * .16) this.flash = .7 + this.rand() * .3;
  }

  /** Sky and light per mode: firefall burns red, snow goes pale and soft, storms darken. */
  tint(l: Lighting): void {
    if (this.mode === 'firefall') { l.ambient = [l.ambient[0] * 1.3 + .08, l.ambient[1] * .72, l.ambient[2] * .55]; l.sunColor = [1, .55, .35]; }
    else if (this.mode === 'snow') { l.ambient = [l.ambient[0] * 1.08 + .05, l.ambient[1] * 1.1 + .05, l.ambient[2] * 1.18 + .07]; l.saturation *= .8; }
    else if (this.mode === 'storm') { l.ambient = l.ambient.map(v => v * .7) as [number, number, number]; l.sun *= .4; }
    else if (this.mode === 'rain') { l.ambient = l.ambient.map(v => v * .86) as [number, number, number]; l.sun *= .7; }
    if (this.flash > 0) { const f = this.flash; l.ambient = [l.ambient[0] + f * .8, l.ambient[1] + f * .85, l.ambient[2] + f]; }
  }

  /** Firelight: the caller adds these as point lights (x, y world, z height; flickering strength 0..1). */
  lights(time: number): { x: number; y: number; z: number; radius: number; strength: number }[] {
    return this.fires.map((f, i) => ({ x: f.x, y: f.y, z: f.height * .4, radius: 70 + f.width * .9, strength: .85 + Math.sin(time * 11 + i) * .1 + Math.sin(time * 23 + i * 3) * .06 }));
  }

  draw(ids: Uint32Array, layers: Uint8Array, cols: number, rows: number, camX: number, camY: number, step: number,
    toCell?: (x: number, y: number, z: number) => [number, number]): void {
    const g = this.g; const useLayers = layers.length === ids.length;
    const put = (sx: number, sy: number, id: number) => {
      const x = Math.round(sx); const y = Math.round(sy);
      if (x < 0 || y < 0 || x >= cols || y >= rows) return;
      const i = y * cols + x; ids[i] = id; if (useLayers) layers[i] = LAYER.effect;
    };
    const p = this.particles;
    for (let i = 0; i < p.count; i++) {
      const kind = p.kind[i]; const x = p.x[i]; const y = p.y[i]; const z = p.z[i];
      const [sx, sy] = toCell ? toCell(x, y, z) : [(x - camX) / step, (y - z - camY) / step];
      if (sx < -2 || sy < -2 || sx > cols + 2 || sy > rows + 2) continue;
      const age = 1 - p.life[i] / p.maxLife[i];
      switch (kind) {
        case ParticleKind.rain: {
          // Streak along the motion: slope picks |, / or \, near drops are brighter and longer.
          const slope = p.vx[i] / Math.max(1, -p.vz[i]);
          const dir = slope > .18 ? 2 : slope < -.18 ? 1 : 0;
          const near = z > 85;
          put(sx, sy, (near ? g.rainNear : g.rainFar)[dir]);
          put(sx - slope, sy - 1, g.rainTrail[dir]);
          if (near) put(sx - slope * 2, sy - 2, g.rainTrail[dir]);
          break;
        }
        case ParticleKind.splash:
          if (waterDepth(x, y) > 0) { put(sx - 1, sy, g.ring[0]); put(sx + 1, sy, g.ring[1]); if (age > .4) put(sx, sy, g.ring[2]); }
          else put(sx, sy, g.splash[age < .3 ? 2 : age < .6 ? 0 : 1]);
          break;
        case ParticleKind.snow: put(sx, sy, g.snow[z > 60 ? (i & 1) : z > 20 ? 1 + (i % 2) * 2 : 2]); break;
        case ParticleKind.ember: put(sx, sy, g.ember[(i + Math.floor(age * 30)) % 4]); break;
        case ParticleKind.ash: put(sx, sy, g.ash[i % 3]); break;
        case ParticleKind.flame: put(sx, sy, g.flame[Math.min(5, Math.floor(age * 6))]); break;
        case ParticleKind.smoke: put(sx, sy, g.smoke[Math.min(3, Math.floor(age * 4))]); break;
        case ParticleKind.spark: put(sx, sy, g.spark[i & 1]); break;
        case ParticleKind.dust: put(sx, sy, g.dust[0]); break;
        case ParticleKind.leaf: put(sx, sy, g.leaf[0]); break;
      }
    }
  }
}
