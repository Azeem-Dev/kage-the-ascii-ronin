import { noise, type AsciiCell } from './types.ts';

/** Rasterize local mathematical shapes directly into shaded glyph cells.
 * This is asset authoring, not a hidden bitmap or a scene-specific sprite.
 */
export class GlyphShape {
  private cells = new Map<number, AsciiCell>();
  constructor(readonly width: number, readonly height: number, private seed: number) {}

  cell(x: number, y: number, glyph: string, color: string): void {
    x = Math.round(x); y = Math.round(y);
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return;
    this.cells.set(y * this.width + x, { x, y, glyph, color });
  }

  private shade(x: number, y: number, light: number, palette: readonly string[], ramp: string): void {
    const n = noise(x, y, this.seed);
    const value = Math.max(.08, Math.min(.99, light + (n - .5) * .14));
    this.cell(x, y, ramp[Math.min(ramp.length - 1, Math.floor(value * ramp.length))], palette[Math.min(palette.length - 1, Math.floor(value * palette.length))]);
  }

  ellipse(cx: number, cy: number, rx: number, ry: number, palette: readonly string[], brightness = 1, ramp = '.,:;+=oxO#%@'): void {
    for (let y = Math.floor(cy - ry); y <= cy + ry; y++) for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
      const nx = (x - cx) / rx; const ny = (y - cy) / ry;
      const d = nx * nx + ny * ny;
      if (d > 1) continue;
      const normal = Math.sqrt(1 - d);
      this.shade(x, y, brightness * (.25 + .5 * normal - .23 * nx - .12 * ny), palette, ramp);
    }
  }

  polygon(points: readonly (readonly [number, number])[], palette: readonly string[], brightness = .8, ramp = '.,:;+=oxO#%@'): void {
    const minX = Math.floor(Math.min(...points.map(p => p[0])));
    const maxX = Math.ceil(Math.max(...points.map(p => p[0])));
    const minY = Math.floor(Math.min(...points.map(p => p[1])));
    const maxY = Math.ceil(Math.max(...points.map(p => p[1])));
    for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
      let inside = false;
      for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
        const a = points[i]; const b = points[j];
        if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
      }
      if (inside) {
        const fold = Math.sin(x * .85 + y * .09) * .09;
        this.shade(x, y, brightness * (.9 - (x - minX) / Math.max(1, maxX - minX) * .35 + fold), palette, ramp);
      }
    }
  }

  line(x0: number, y0: number, x1: number, y1: number, color: string, glyph = '/'): void {
    const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    for (let i = 0; i <= steps; i++) this.cell(x0 + (x1 - x0) * i / steps, y0 + (y1 - y0) * i / steps, glyph, color);
  }

  frame(flip = false): AsciiCell[] {
    return [...this.cells.values()].map(cell => flip ? { ...cell, x: this.width - 1 - cell.x, glyph: ({ '/': '\\', '\\': '/' }[cell.glyph] ?? cell.glyph) } : cell);
  }

  resizedFrame(width: number, height: number, flip = false): AsciiCell[] {
    const cells: AsciiCell[] = [];
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const source = this.cells.get(Math.floor(y * this.height / height) * this.width + Math.floor(x * this.width / width));
      if (source) cells.push({ ...source, x: flip ? width - 1 - x : x, y, glyph: flip ? ({ '/': '\\', '\\': '/' }[source.glyph] ?? source.glyph) : source.glyph });
    }
    return cells;
  }
}
