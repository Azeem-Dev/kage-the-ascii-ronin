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
  private origin: { x: number; y: number; cols: number; rows: number; step: number } | null = null;
  private spare = new Uint32Array(0);
  /** 1 where the cell is river water (same layout as the returned ids); used by the GPU water shader. */
  waterMask = new Uint8Array(0);
  private spareMask = new Uint8Array(0);

  constructor(private renderer: AssetRenderer) {}

  get(x: number, y: number, cols: number, rows: number, step: number, time: number): Uint32Array {
    const key = `${x}:${y}:${cols}:${rows}:${step}`;
    if (key !== this.key) {
      this.key = key; this.tick = -1;
      const old = this.origin;
      const dx = old ? (x - old.x) / step : 0; const dy = old ? (y - old.y) / step : 0;
      const shift = old && old.cols === cols && old.rows === rows && old.step === step && Number.isInteger(dx) && Number.isInteger(dy) && Math.abs(dx) < cols && Math.abs(dy) < rows;
      const previous = this.base;
      this.base = this.spare.length === cols * rows ? this.spare : new Uint32Array(cols * rows);
      this.base.fill(0);
      this.spare = previous;
      const previousMask = this.waterMask;
      this.waterMask = this.spareMask.length === cols * rows ? this.spareMask : new Uint8Array(cols * rows);
      this.waterMask.fill(0);
      this.spareMask = previousMask;
      if (this.animated.length !== cols * rows) this.animated = new Uint32Array(cols * rows);
      const start = Math.max(0, -dx); const end = Math.min(cols, cols - dx);
      if (shift) {
        for (let sy = 0; sy < rows; sy++) {
          const srcY = sy + dy;
          if (srcY >= 0 && srcY < rows) {
            this.base.set(previous.subarray(srcY * cols + start + dx, srcY * cols + end + dx), sy * cols + start);
            this.waterMask.set(previousMask.subarray(srcY * cols + start + dx, srcY * cols + end + dx), sy * cols + start);
          }
        }
        this.water = this.water.flatMap(sample => {
          const sx = sample.index % cols - dx; const sy = Math.floor(sample.index / cols) - dy;
          return sx >= 0 && sy >= 0 && sx < cols && sy < rows ? [{ ...sample, index: sy * cols + sx }] : [];
        });
      } else this.water = [];
      const sampleCell = (sx: number, sy: number) => {
        const wx = x + sx * step; const wy = y + sy * step;
        const index = sy * cols + sx;
        if (waterDepth(wx, wy) > 0) this.waterMask[index] = 1;
        const cell = landscapeCell(wx, wy, 0, 17);
        if (!cell) return;
        this.base[index] = this.renderer.glyph(cell.glyph, cell.color);
        // Only sparse highlights animate. Water retains fixed brightness and
        // occupancy, so a current cannot flash an entire river band on/off.
        if (waterDepth(wx, wy) > 0 && noise(wx, wy, 97) > .88) this.water.push({ index, x: wx, y: wy, color: cell.color });
      };
      for (let sy = 0; sy < rows; sy++) {
        if (!shift || sy + dy < 0 || sy + dy >= rows) for (let sx = 0; sx < cols; sx++) sampleCell(sx, sy);
        else {
          for (let sx = 0; sx < start; sx++) sampleCell(sx, sy);
          for (let sx = end; sx < cols; sx++) sampleCell(sx, sy);
        }
      }
      this.origin = { x, y, cols, rows, step };
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
