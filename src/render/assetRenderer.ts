import type { AsciiCell } from '../assets/types.ts';

/** Background of an empty cell: CSS form for 2D text, ABGR form for pixel buffers. */
const BACKGROUND_CSS = '#070b10';
const BACKGROUND_PIXEL = 0xff100b07;

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
  private definitions: { glyph: string; color: string }[] = [{ glyph: ' ', color: BACKGROUND_CSS }];
  /** (glyph id, warm, band) -> lit glyph id. Numeric keys: no per-cell string allocation. */
  private lit = new Map<number, number>();
  private previous = new Uint32Array(0);
  private previousCols = 0;
  private previousRows = 0;
  private previousCellWidth = 0;
  private previousCellHeight = 0;
  private working = new Uint32Array(0);
  private output: ImageData | null = null;
  private outputPixels = new Uint32Array(0);
  private dirtyTiles = new Uint8Array(0);
  private scrollCanvas: HTMLCanvasElement | null = null;
  private rasterCanvas: HTMLCanvasElement | null = null;
  private rasterContext: CanvasRenderingContext2D | null = null;
  changedCells = 0;
  constructor(public cellWidth = 4, public cellHeight = 6) {
    const empty = new Uint32Array(cellWidth * cellHeight);
    empty.fill(BACKGROUND_PIXEL);
    this.tiles.push(empty);
  }

  resizeGlyphs(width: number, height: number): void {
    if (width === this.cellWidth && height === this.cellHeight) return;
    this.cellWidth = width; this.cellHeight = height;
    this.tiles = new Array(this.definitions.length);
    this.output = null;
  }

  private tile(id: number): Uint32Array {
    if (this.tiles[id]) return this.tiles[id];
    const { glyph, color } = this.definitions[id];
    if (!this.rasterCanvas) {
      this.rasterCanvas = document.createElement('canvas');
      this.rasterContext = this.rasterCanvas.getContext('2d', { willReadFrequently: true });
    }
    const tile = this.rasterCanvas;
    if (tile.width !== this.cellWidth) tile.width = this.cellWidth;
    if (tile.height !== this.cellHeight) tile.height = this.cellHeight;
    const ctx = this.rasterContext;
    if (!ctx) throw new Error('Cannot cache glyph');
    ctx.fillStyle = BACKGROUND_CSS; ctx.fillRect(0, 0, tile.width, tile.height);
    ctx.font = `${this.cellHeight}px "Courier New", monospace`; ctx.textAlign = 'center';
    ctx.fillStyle = color; ctx.fillText(glyph, this.cellWidth / 2, this.cellHeight * .82);
    const pixels = new Uint32Array(ctx.getImageData(0, 0, tile.width, tile.height).data.buffer);
    this.tiles[id] = pixels;
    return pixels;
  }

  glyph(glyph: string, color: string): number {
    let colors = this.lookup.get(color);
    if (!colors) { colors = new Map(); this.lookup.set(color, colors); }
    const found = colors.get(glyph);
    if (found !== undefined) return found;
    const id = this.definitions.length;
    this.definitions.push({ glyph, color });
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

  /** Local light changes existing glyph colors, never draws a raw pixel glow. */
  illuminate(ids: Uint32Array, cols: number, rows: number, x: number, y: number, radius: number, warm: boolean): void {
    const warmBit = warm ? 1 : 0;
    const minX = Math.max(0, Math.floor(x - radius)); const maxX = Math.min(cols - 1, Math.ceil(x + radius));
    const minY = Math.max(0, Math.floor(y - radius * .7)); const maxY = Math.min(rows - 1, Math.ceil(y + radius * .7));
    for (let py = minY; py <= maxY; py++) for (let px = minX; px <= maxX; px++) {
      const dist = Math.sqrt(((px - x) / radius) ** 2 + ((py - y) / (radius * .7)) ** 2);
      const band = Math.floor((1 - dist) * 4);
      const original = ids[py * cols + px];
      if (!original || band < 1) continue;
      const key = (original * 2 + warmBit) * 8 + band;
      let id = this.lit.get(key);
      if (id === undefined) {
        const def = this.definitions[original];
        const rgb = [1, 3, 5].map(i => parseInt(def.color.slice(i, i + 2), 16));
        const tint = warm ? [17, 12, 3] : [5, 12, 19];
        const color = '#' + rgb.map((c, i) => Math.min(255, Math.round(c * (1 + band * .11) + tint[i] * band)).toString(16).padStart(2, '0')).join('');
        id = this.glyph(def.glyph, color); this.lit.set(key, id);
      }
      ids[py * cols + px] = id;
    }
  }

  private shift2D(
    buffer: Uint32Array,
    width: number,
    height: number,
    dx: number,
    dy: number,
    fill: number
  ): void {
    if (dx === 0 && dy === 0) return;
    if (Math.abs(dx) >= width || Math.abs(dy) >= height) {
      buffer.fill(fill);
      return;
    }

    if (dy > 0) {
      buffer.copyWithin(dy * width, 0, (height - dy) * width);
      buffer.fill(fill, 0, dy * width);
    } else if (dy < 0) {
      buffer.copyWithin(0, -dy * width, height * width);
      buffer.fill(fill, (height + dy) * width, height * width);
    }

    for (let row = 0; row < height; row++) {
      const start = row * width;
      if (dx > 0) {
        buffer.copyWithin(start + dx, start, start + width - dx);
        buffer.fill(fill, start, start + dx);
      } else if (dx < 0) {
        buffer.copyWithin(start, start - dx, start + width);
        buffer.fill(fill, start + width + dx, start + width);
      }
    }
  }

  private scrollDisplayedCanvas(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    dx: number,
    dy: number
  ): void {
    if (dx === 0 && dy === 0) return;
    if (!this.scrollCanvas) this.scrollCanvas = document.createElement('canvas');
    if (this.scrollCanvas.width !== width || this.scrollCanvas.height !== height) {
      this.scrollCanvas.width = width;
      this.scrollCanvas.height = height;
    }
    const scrollCtx = this.scrollCanvas.getContext('2d', { alpha: false });
    if (!scrollCtx) return;
    scrollCtx.imageSmoothingEnabled = false;
    scrollCtx.drawImage(ctx.canvas, 0, 0);
    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = BACKGROUND_CSS;
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(this.scrollCanvas, dx, dy);
    ctx.restore();
  }

  present(
    ctx: CanvasRenderingContext2D,
    ids: Uint32Array,
    cols: number,
    rows: number,
    scrollX = 0,
    scrollY = 0
  ): void {
    const width = cols * this.cellWidth; const height = rows * this.cellHeight;
    const resized = !this.output || this.output.width !== width || this.output.height !== height;
    const tileSize = 64;
    const tileCols = Math.ceil(cols / tileSize);
    const tileRows = Math.ceil(rows / tileSize);
    if (this.dirtyTiles.length !== tileCols * tileRows) this.dirtyTiles = new Uint8Array(tileCols * tileRows);
    let fullRedraw = resized;

    if (resized) {
      this.output = ctx.createImageData(width, height);
      this.outputPixels = new Uint32Array(this.output.data.buffer);
      this.previous = new Uint32Array(ids.length); this.previous.fill(0xffffffff);
      this.previousCols = cols; this.previousRows = rows;
      this.previousCellWidth = this.cellWidth; this.previousCellHeight = this.cellHeight;
    } else {
      const canScroll = this.previous.length === ids.length &&
        this.previousCols === cols && this.previousRows === rows &&
        this.previousCellWidth === this.cellWidth && this.previousCellHeight === this.cellHeight;
      if (canScroll) {
        this.shift2D(this.previous, cols, rows, scrollX, scrollY, 0xffffffff);
        this.shift2D(
          this.outputPixels,
          width,
          height,
          scrollX * this.cellWidth,
          scrollY * this.cellHeight,
          BACKGROUND_PIXEL
        );
        this.scrollDisplayedCanvas(
          ctx,
          width,
          height,
          scrollX * this.cellWidth,
          scrollY * this.cellHeight
        );
      } else {
        fullRedraw = true;
        this.previous.fill(0xffffffff);
        this.outputPixels.fill(BACKGROUND_PIXEL);
      }
    }
    this.dirtyTiles.fill(fullRedraw ? 1 : 0);
    this.changedCells = 0;
    for (let i = 0; i < ids.length; i++) {
      const id = ids[i];
      if (this.previous[i] === id) continue;
      this.previous[i] = id; this.changedCells++;
      const cellX = i % cols;
      const cellY = Math.floor(i / cols);
      this.dirtyTiles[Math.floor(cellY / tileSize) * tileCols + Math.floor(cellX / tileSize)] = 1;
      const dx = cellX * this.cellWidth; const dy = cellY * this.cellHeight;
      const tile = this.tile(id);
      for (let y = 0; y < this.cellHeight; y++) {
        const dst = (dy + y) * width + dx; const src = y * this.cellWidth;
        for (let x = 0; x < this.cellWidth; x++) this.outputPixels[dst + x] = tile[src + x];
      }
    }
    if (!this.changedCells || !this.output) return;
    if (fullRedraw) {
      ctx.putImageData(this.output, 0, 0);
      return;
    }
    for (let ty = 0; ty < tileRows; ty++) {
      for (let tx = 0; tx < tileCols; tx++) {
        if (!this.dirtyTiles[ty * tileCols + tx]) continue;
        const dirtyX = tx * tileSize * this.cellWidth;
        const dirtyY = ty * tileSize * this.cellHeight;
        const dirtyW = Math.min(tileSize, cols - tx * tileSize) * this.cellWidth;
        const dirtyH = Math.min(tileSize, rows - ty * tileSize) * this.cellHeight;
        ctx.putImageData(this.output, 0, 0, dirtyX, dirtyY, dirtyW, dirtyH);
      }
    }
  }
}
