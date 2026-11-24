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

  // Grass strands, stored flat for speed: world position, 6 ids (stem \ | /, tip \ | /), tip flag.
  private grassCount = 0;
  private grassX = new Float32Array(0);
  private grassY = new Float32Array(0);
  private grassIds = new Uint32Array(0);
  private grassTip = new Uint8Array(0);
  private lighter = new Map<string, string>();
  /** Ids of empty ground (spaces), where a grass tip may grow. */
  private blankIds = new Set<number>();

  constructor(private renderer: AssetRenderer) {}

  /** The unanimated ground of the last get() (no water glints or grass sway). Must never change with time. */
  get stable(): Uint32Array { return this.base; }

  private ensureGrass(capacity: number): void {
    if (this.grassX.length >= capacity) return;
    const grow = <T extends Float32Array | Uint32Array | Uint8Array>(old: T, size: number, make: (n: number) => T): T => { const a = make(size); a.set(old.subarray(0, Math.min(old.length, size)) as never); return a; };
    this.grassX = grow(this.grassX, capacity, n => new Float32Array(n));
    this.grassY = grow(this.grassY, capacity, n => new Float32Array(n));
    this.grassIds = grow(this.grassIds, capacity * 6, n => new Uint32Array(n));
    this.grassTip = grow(this.grassTip, capacity, n => new Uint8Array(n));
  }

  /** Brighter tip colour for a blade (sunlit end of the strand). */
  private tipColor(color: string): string {
    let c = this.lighter.get(color);
    if (!c) {
      const ch = (i: number) => Math.min(255, Math.round(parseInt(color.slice(i, i + 2), 16) * 1.38 + 14)).toString(16).padStart(2, '0');
      c = `#${ch(1)}${ch(3)}${ch(5)}`; this.lighter.set(color, c);
    }
    return c;
  }

  /** x, y, step are in SCREEN units. toWorldX/Y map a screen point to the world
   * point to sample (identity for top-down, inverse projection for isometric).
   * The mapping is linear, so whole-cell camera shifts still reuse cached cells. */
  get(x: number, y: number, cols: number, rows: number, step: number, time: number,
    toWorldX: (sx: number, sy: number) => number = sx => sx, toWorldY: (sx: number, sy: number) => number = (_sx, sy) => sy): Uint32Array {
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
      // Grass strands keep their world position; drop the ones that scrolled out.
      this.ensureGrass(cols * rows);
      let kept = 0;
      if (shift) {
        for (let r = 0; r < this.grassCount; r++) {
          const sx = (this.grassX[r] - x) / step; const sy = (this.grassY[r] - y) / step;
          if (sx < 0 || sy < 0 || sx >= cols || sy >= rows) continue;
          if (kept !== r) {
            this.grassX[kept] = this.grassX[r]; this.grassY[kept] = this.grassY[r]; this.grassTip[kept] = this.grassTip[r];
            this.grassIds.copyWithin(kept * 6, r * 6, r * 6 + 6);
          }
          kept++;
        }
      }
      this.grassCount = kept;
      const sampleCell = (sx: number, sy: number) => {
        // Screen-space position (grass strands are tracked in this space).
        const px = x + sx * step; const py = y + sy * step;
        const wx = toWorldX(px, py); const wy = toWorldY(px, py);
        const index = sy * cols + sx;
        if (waterDepth(wx, wy) > 0) this.waterMask[index] = 1;
        const cell = landscapeCell(wx, wy, 0, 17);
        if (!cell) return;
        this.base[index] = this.renderer.glyph(cell.glyph, cell.color);
        if (cell.glyph === ' ') this.blankIds.add(this.base[index]);
        // Grass, wheat and undergrowth stems become swaying strands.
        if ((cell.glyph === '|' || cell.glyph === '/' || cell.glyph === '\\' || cell.glyph === '!') && this.grassCount < this.grassX.length) {
          const r = this.grassCount++; const o = r * 6; const tip = this.tipColor(cell.color);
          this.grassX[r] = px; this.grassY[r] = py;
          this.grassIds[o] = this.renderer.glyph('\\', cell.color); this.grassIds[o + 1] = this.renderer.glyph(cell.glyph === '!' ? '!' : '|', cell.color); this.grassIds[o + 2] = this.renderer.glyph('/', cell.color);
          this.grassIds[o + 3] = this.renderer.glyph('`', tip); this.grassIds[o + 4] = this.renderer.glyph("'", tip); this.grassIds[o + 5] = this.renderer.glyph(',', tip);
          // About half the stems are tall: they grow a bright tip into the cell above.
          this.grassTip[r] = noise(Math.round(wx * 2), Math.round(wy * 2), 131) > .45 ? 1 : 0;
        }
        // Only sparse highlights animate. Water retains fixed brightness and
        // occupancy, so a current cannot flash an entire river band on/off.
        if (waterDepth(wx, wy) > 0 && noise(Math.round(wx * 2), Math.round(wy * 2), 97) > .88) this.water.push({ index, x: wx, y: wy, color: cell.color });
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
    const tick = Math.floor(time * 10);
    if (tick !== this.tick) {
      this.tick = tick;
      this.animated.set(this.base);
      for (const sample of this.water) {
        const phase = Math.sin(sample.x * .13 + sample.y * .17 - tick * .108);
        this.animated[sample.index] = this.renderer.glyph(phase > .7 ? 'o' : phase < -.5 ? ',' : '.', phase > .7 ? '#8fa9ad' : sample.color);
      }
      // Wind: gusts roll across the meadow as waves; each strand leans \ | / and its tip follows.
      const o = this.origin!; const t = tick / 10;
      for (let r = 0; r < this.grassCount; r++) {
        const wx = this.grassX[r]; const wy = this.grassY[r];
        const sx = Math.round((wx - o.x) / o.step); const sy = Math.round((wy - o.y) / o.step);
        const i = sy * o.cols + sx;
        const wave = (wx * .9 + wy * .4) * .035 - t * 1.7;
        const lean = Math.sin(wave) * .55 + Math.sin(wave * .31 - t * .4) * .3 + Math.sin(wx * .21 + wy * .05 - t * 2.9) * .2;
        const k = lean > .3 ? 2 : lean < -.3 ? 0 : 1;
        this.animated[i] = this.grassIds[r * 6 + k];
        if (this.grassTip[r] && sy > 0) {
          // The tip sits above the stem and shifts with the lean, only into empty ground.
          const j = i - o.cols + (k === 2 ? 1 : k === 0 ? -1 : 0);
          if (j >= 0 && sx + (k - 1) >= 0 && sx + (k - 1) < o.cols && (this.base[j] === 0 || this.blankIds.has(this.base[j]))) this.animated[j] = this.grassIds[r * 6 + 3 + k];
        }
      }
    }
    return this.animated;
  }
}
