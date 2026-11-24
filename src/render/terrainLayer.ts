import { landscapeCell, waterDepth } from '../assets/landscape.ts';
import { noise } from '../assets/types.ts';
import { AssetRenderer } from './assetRenderer.ts';

/** Immutable ground texture with a small animated water overlay. Sampling is
 * anchored to the WORLD lattice, never to a fractional camera origin. */
export class TerrainLayer {
  private key = '';
  private base = new Uint32Array(0);
  private animated = new Uint32Array(0);
  private water: { index: number; x: number; y: number; color: string }[] = [];
  private tick = -1;

  constructor(private renderer: AssetRenderer) {}

  get(x: number, y: number, cols: number, rows: number, step: number, time: number): Uint32Array {
    const key = `${x}:${y}:${cols}:${rows}:${step}`;
    if (key !== this.key) {
      this.key = key; this.tick = -1;
      this.base = new Uint32Array(cols * rows);
      this.animated = new Uint32Array(cols * rows);
      this.water = [];
      for (let sy = 0; sy < rows; sy++) for (let sx = 0; sx < cols; sx++) {
        const wx = x + sx * step; const wy = y + sy * step;
        const cell = landscapeCell(wx, wy, 0, 17);
        if (!cell) continue;
        const index = sy * cols + sx;
        this.base[index] = this.renderer.glyph(cell.glyph, cell.color);
        // Only sparse highlights animate. Water retains fixed brightness and
        // occupancy, so a current cannot flash an entire river band on/off.
        if (waterDepth(wx, wy) > 0 && noise(wx, wy, 97) > .88) this.water.push({ index, x: wx, y: wy, color: cell.color });
      }
    }
    const tick = Math.floor(time * 6);
    if (tick !== this.tick) {
      this.tick = tick;
      this.animated.set(this.base);
      for (const sample of this.water) {
        const phase = Math.sin(sample.x * .13 + sample.y * .17 - tick * .18);
        this.animated[sample.index] = this.renderer.glyph(phase > .7 ? 'o' : phase < -.5 ? ',' : '.', phase > .7 ? '#8fa9ad' : sample.color);
      }
    }
    return this.animated;
  }
}
