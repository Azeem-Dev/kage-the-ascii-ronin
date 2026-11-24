import { noise } from '../assets/types.ts';
import { riverCenter, riverWidth } from '../assets/landscape.ts';
import { AssetRenderer, LAYER } from '../render/assetRenderer.ts';

export class Atmosphere {
  rain = 0;
  insects = true;
  daylight = .15;
  cycle = true;
  // Glyph ids resolved once; the per-frame loops below must not do string lookups.
  private readonly ids: {
    crest: number; crestAlt: number; mid: number; tail: number;
    rain: number; rainTrail: number; fly: [number, number]; flyDim: [number, number];
  };
  constructor(private renderer: AssetRenderer) {
    this.ids = {
      crest: renderer.glyph('o', '#b6d1d0'), crestAlt: renderer.glyph('°', '#b6d1d0'),
      mid: renderer.glyph(':', '#6f9fa9'), tail: renderer.glyph('.', '#344f63'),
      rain: renderer.glyph('/', '#65889b'), rainTrail: renderer.glyph('/', '#3e5d74'),
      fly: [renderer.glyph('*', '#b2bb78'), renderer.glyph('*', '#cebd8a')],
      flyDim: [renderer.glyph('.', '#b2bb78'), renderer.glyph('.', '#cebd8a')],
    };
  }

  update(dt: number): void { if (this.cycle) this.daylight = (this.daylight + dt / 300) % 1; }
  get brightness(): number { return .86 + (Math.sin(this.daylight * Math.PI * 2) * .5 + .5) * .6; }

  /** `toCell` maps a world point to a cell (default: top-down camera); `worldTop/worldBottom`
   * bound the world rows that can be on screen (the isometric view sees a taller band). */
  render(ids: Uint32Array, cols: number, rows: number, cameraX: number, cameraY: number, step: number, time: number,
    toCell?: (x: number, y: number) => [number, number], worldTop = cameraY, worldBottom = cameraY + rows * step): void {
    const g = this.ids;
    const layers = this.renderer.layers.length === ids.length ? this.renderer.layers : null;
    const put = (x: number, y: number, id: number) => {
      x = Math.round(x); y = Math.round(y);
      if (x >= 0 && y >= 0 && x < cols && y < rows) { const i = y * cols + x; if (layers && layers[i] >= LAYER.prop) return; ids[i] = id; if (layers) layers[i] = LAYER.effect; }
    };
    // Analytic downstream advection. Trails travel with the river's changing
    // centerline instead of swapping symbols in stationary screen locations.
    const first = Math.floor(worldTop / 512) - 1;
    const last = Math.floor(worldBottom / 512) + 1;
    for (let block = first; block <= last; block++) for (let i = 0; i < 96; i++) {
      // Each foam streak has its own speed, start and length, and wanders across the current,
      // so streaks never move as one evenly spaced grid.
      const speed = 12 + noise(i, block, 118) * 16;
      const y = block * 512 + ((noise(i, block, 119) * 512 + time * speed) % 512);
      if (y < worldTop - 10 || y > worldBottom + 10) continue;
      const lane = (noise(i, block, 117) - .5) * 1.65 + Math.sin(time * .3 + i * 1.3) * .08;
      const tails = 2 + Math.floor(noise(i, block, 120) * 4);
      for (let tail = 0; tail < tails; tail++) {
        const py = y - tail * 1.4;
        const px = riverCenter(py) + lane * riverWidth(py) + Math.sin(py * .11 + i * 2.3) * (.8 + noise(i, block, 121) * 1.6);
        const [cx, cy] = toCell ? toCell(px, py) : [(px - cameraX) / step, (py - cameraY) / step];
        put(cx, cy, tail === 0 ? (i % 3 ? g.crest : g.crestAlt) : tail < 3 ? g.mid : g.tail);
      }
    }
    for (let i = 0; i < (this.rain === 2 ? 230 : this.rain === 1 ? 75 : 0); i++) {
      const x = (i * 73 + Math.floor(time * 10)) % cols;
      const y = (i * 47 + Math.floor(time * 45)) % rows;
      put(x, y, g.rain);
      if (this.rain === 2) put(x - 1, y + 1, g.rainTrail);
    }
    if (this.insects) for (let i = 0; i < 16; i++) {
      const x = cols * (.15 + noise(i, 5, 72) * .7) + Math.sin(time * .6 + i) * 5;
      const y = rows * (.15 + noise(i, 7, 72) * .7) + Math.cos(time * .7 + i) * 3;
      put(x, y, (Math.sin(time * 2 + i) > .2 ? g.fly : g.flyDim)[i % 3 ? 0 : 1]);
    }
  }
}
