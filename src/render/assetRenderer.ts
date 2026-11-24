import type { AsciiCell } from '../assets/types.ts';

/** Shared native-glyph renderer for reusable world instances.
 * Glyphs are cached individually; animation changes placement, never rasterizes
 * the whole asset. Preview zoom enlarges the same cells used at gameplay size.
 */
export class AssetRenderer {
  private cache = new Map<string, HTMLCanvasElement>();
  private pixelCache = new Map<string, Map<string, Uint32Array>>();
  private output: ImageData | null = null;
  constructor(readonly cellWidth = 7, readonly cellHeight = 10) {}

  draw(ctx: CanvasRenderingContext2D, cells: readonly AsciiCell[], x: number, y: number, scale = 1): void {
    ctx.imageSmoothingEnabled = false;
    for (const cell of cells) {
      const key = `${cell.glyph}:${cell.color}`;
      let glyph = this.cache.get(key);
      if (!glyph) {
        glyph = document.createElement('canvas');
        glyph.width = this.cellWidth;
        glyph.height = this.cellHeight;
        const g = glyph.getContext('2d');
        if (!g) throw new Error('Cannot create glyph cache');
        g.font = `${this.cellHeight}px "Courier New", monospace`;
        g.textAlign = 'center';
        g.textBaseline = 'alphabetic';
        g.fillStyle = cell.color;
        g.fillText(cell.glyph, this.cellWidth / 2, this.cellHeight * .82);
        this.cache.set(key, glyph);
      }
      ctx.drawImage(glyph, Math.round(x + cell.x * this.cellWidth * scale), Math.round(y + cell.y * this.cellHeight * scale), this.cellWidth * scale, this.cellHeight * scale);
    }
  }

  /** Full game scene: one framebuffer upload rather than a draw call per cell. */
  grid(ctx: CanvasRenderingContext2D, cells: readonly AsciiCell[], cols: number, rows: number): void {
    const width = cols * this.cellWidth;
    const height = rows * this.cellHeight;
    if (!this.output || this.output.width !== width || this.output.height !== height) this.output = ctx.createImageData(width, height);
    const pixels = new Uint32Array(this.output.data.buffer);
    pixels.fill(0xff100b07);
    // Last cell wins: this provides proper transparent asset layering before
    // glyph rasterization, without rectangular backgrounds around objects.
    for (const cell of cells) {
      const x = Math.round(cell.x); const y = Math.round(cell.y);
      if (x < 0 || y < 0 || x >= cols || y >= rows) continue;
      let colorCache = this.pixelCache.get(cell.color);
      if (!colorCache) { colorCache = new Map(); this.pixelCache.set(cell.color, colorCache); }
      let glyph = colorCache.get(cell.glyph);
      if (!glyph) {
        const tile = document.createElement('canvas'); tile.width = this.cellWidth; tile.height = this.cellHeight;
        const g = tile.getContext('2d', { willReadFrequently: true });
        if (!g) throw new Error('Cannot cache glyph');
        g.fillStyle = '#070b10'; g.fillRect(0, 0, tile.width, tile.height);
        g.font = `${this.cellHeight}px "Courier New", monospace`; g.textAlign = 'center';
        g.fillStyle = cell.color; g.fillText(cell.glyph, this.cellWidth / 2, this.cellHeight * .82);
        glyph = new Uint32Array(g.getImageData(0, 0, tile.width, tile.height).data.buffer);
        colorCache.set(cell.glyph, glyph);
      }
      const dx = x * this.cellWidth;
      const dy = y * this.cellHeight;
      for (let row = 0; row < this.cellHeight; row++) {
        const start = (dy + row) * width + dx;
        const source = row * this.cellWidth;
        if (this.cellWidth === 4) {
          pixels[start] = glyph[source]; pixels[start + 1] = glyph[source + 1];
          pixels[start + 2] = glyph[source + 2]; pixels[start + 3] = glyph[source + 3];
        } else for (let col = 0; col < this.cellWidth; col++) pixels[start + col] = glyph[source + col];
      }
    }
    ctx.putImageData(this.output, 0, 0);
  }
}
