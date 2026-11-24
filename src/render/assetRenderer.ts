import type { AsciiCell } from '../assets/types.ts';

export interface GlyphSprite {
  width: number;
  height: number;
  ids: Uint32Array;
}

/** Cached glyph tiles + typed cell grids. Static layers are baked once; each
 * frame only changed cells copy their tiny glyph bitmap into the framebuffer.
 * Zero per-frame getImageData, font rasterization or per-cell string lookups.
 */
export class AssetRenderer {
  private lookup = new Map<string, Map<string, number>>();
  private tiles: Uint32Array[] = [];
  private previous = new Uint32Array(0);
  private working = new Uint32Array(0);
  private output: ImageData | null = null;
  private outputPixels = new Uint32Array(0);
  changedCells = 0;
  constructor(readonly cellWidth = 4, readonly cellHeight = 6) {
    const empty = new Uint32Array(cellWidth * cellHeight);
    empty.fill(0xff100b07);
    this.tiles.push(empty);
  }

  glyph(glyph: string, color: string): number {
    let colors = this.lookup.get(color);
    if (!colors) { colors = new Map(); this.lookup.set(color, colors); }
    const found = colors.get(glyph);
    if (found !== undefined) return found;
    const tile = document.createElement('canvas');
    tile.width = this.cellWidth; tile.height = this.cellHeight;
    const ctx = tile.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('Cannot cache glyph');
    ctx.fillStyle = '#070b10'; ctx.fillRect(0, 0, tile.width, tile.height);
    ctx.font = `${this.cellHeight}px "Courier New", monospace`; ctx.textAlign = 'center';
    ctx.fillStyle = color; ctx.fillText(glyph, this.cellWidth / 2, this.cellHeight * .82);
    const id = this.tiles.length;
    this.tiles.push(new Uint32Array(ctx.getImageData(0, 0, tile.width, tile.height).data.buffer));
    colors.set(glyph, id);
    return id;
  }

  /** Minify once, not thousands of source cells on every world frame. */
  compile(cells: readonly AsciiCell[], width: number, height: number, scale: number): GlyphSprite {
    const w = Math.max(1, Math.ceil(width * scale) + 1);
    const h = Math.max(1, Math.ceil(height * scale) + 1);
    const ids = new Uint32Array(w * h);
    for (const cell of cells) {
      const x = Math.round(cell.x * scale); const y = Math.round(cell.y * scale);
      if (x >= 0 && y >= 0 && x < w && y < h) ids[y * w + x] = this.glyph(cell.glyph, cell.color);
    }
    return { width: w, height: h, ids };
  }

  stamp(target: Uint32Array, cols: number, rows: number, sprite: GlyphSprite, x: number, y: number): void {
    x = Math.round(x); y = Math.round(y);
    const minX = Math.max(0, -x); const maxX = Math.min(sprite.width, cols - x);
    const minY = Math.max(0, -y); const maxY = Math.min(sprite.height, rows - y);
    for (let sy = minY; sy < maxY; sy++) {
      const src = sy * sprite.width;
      const dst = (y + sy) * cols + x;
      for (let sx = minX; sx < maxX; sx++) {
        const id = sprite.ids[src + sx];
        if (id) target[dst + sx] = id;
      }
    }
  }

  begin(base: Uint32Array): Uint32Array {
    if (this.working.length !== base.length) this.working = new Uint32Array(base.length);
    this.working.set(base);
    return this.working;
  }

  present(ctx: CanvasRenderingContext2D, ids: Uint32Array, cols: number, rows: number): void {
    const width = cols * this.cellWidth; const height = rows * this.cellHeight;
    const resized = !this.output || this.output.width !== width || this.output.height !== height;
    if (resized) {
      this.output = ctx.createImageData(width, height);
      this.outputPixels = new Uint32Array(this.output.data.buffer);
      this.previous = new Uint32Array(ids.length); this.previous.fill(0xffffffff);
    }
    this.changedCells = 0;
    for (let i = 0; i < ids.length; i++) {
      const id = ids[i];
      if (this.previous[i] === id) continue;
      this.previous[i] = id; this.changedCells++;
      const tile = this.tiles[id];
      const dx = i % cols * this.cellWidth; const dy = Math.floor(i / cols) * this.cellHeight;
      for (let y = 0; y < this.cellHeight; y++) {
        const dst = (dy + y) * width + dx; const src = y * this.cellWidth;
        for (let x = 0; x < this.cellWidth; x++) this.outputPixels[dst + x] = tile[src + x];
      }
    }
    if (this.changedCells && this.output) ctx.putImageData(this.output, 0, 0);
  }
}
