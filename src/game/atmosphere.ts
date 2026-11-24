import { noise } from '../assets/types.ts';
import { riverCenter, riverWidth } from '../assets/landscape.ts';
import { AssetRenderer } from '../render/assetRenderer.ts';

export class Atmosphere {
  rain = 0;
  insects = true;
  daylight = .15;
  cycle = true;
  constructor(private renderer: AssetRenderer) {}

  update(dt: number): void { if (this.cycle) this.daylight = (this.daylight + dt / 300) % 1; }
  get brightness(): number { return .86 + (Math.sin(this.daylight * Math.PI * 2) * .5 + .5) * .6; }

  render(ids: Uint32Array, cols: number, rows: number, cameraX: number, cameraY: number, step: number, time: number): void {
    const put = (x: number, y: number, glyph: string, color: string) => {
      x = Math.round(x); y = Math.round(y);
      if (x >= 0 && y >= 0 && x < cols && y < rows) ids[y * cols + x] = this.renderer.glyph(glyph, color);
    };
    // Analytic downstream advection. Trails travel with the river's changing
    // centerline instead of swapping symbols in stationary screen locations.
    const first = Math.floor(cameraY / 512) - 1;
    const last = Math.floor((cameraY + rows * step) / 512) + 1;
    for (let block = first; block <= last; block++) for (let i = 0; i < 96; i++) {
      const y = block * 512 + ((i * 71.37 + time * 18) % 512);
      if (y < cameraY - 10 || y > cameraY + rows * step + 10) continue;
      const lane = (noise(i, block, 117) - .5) * 1.65;
      for (let tail = 0; tail < 5; tail++) {
        const py = y - tail * 1.4;
        const px = riverCenter(py) + lane * riverWidth(py) + Math.sin(py * .11 + i) * 1.2;
        put((px - cameraX) / step, (py - cameraY) / step, tail === 0 ? (i % 3 ? 'o' : '°') : tail < 3 ? ':' : '.', tail === 0 ? '#b6d1d0' : tail < 3 ? '#6f9fa9' : '#344f63');
      }
    }
    for (let i = 0; i < (this.rain === 2 ? 230 : this.rain === 1 ? 75 : 0); i++) {
      const x = (i * 73 + Math.floor(time * 10)) % cols;
      const y = (i * 47 + Math.floor(time * 45)) % rows;
      put(x, y, '/', '#65889b');
      if (this.rain === 2) put(x - 1, y + 1, '/', '#3e5d74');
    }
    if (this.insects) for (let i = 0; i < 16; i++) {
      const x = cols * (.15 + noise(i, 5, 72) * .7) + Math.sin(time * .6 + i) * 5;
      const y = rows * (.15 + noise(i, 7, 72) * .7) + Math.cos(time * .7 + i) * 3;
      put(x, y, Math.sin(time * 2 + i) > .2 ? '*' : '.', i % 3 ? '#b2bb78' : '#cebd8a');
    }
  }
}
