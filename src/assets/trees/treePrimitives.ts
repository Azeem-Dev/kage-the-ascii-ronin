import { noise } from '../types.ts';
import { GlyphShape } from '../shapes.ts';

/** Dark underside -> mid leaf -> lit crown -> broken rim. */
export type LeafPalette = readonly [string, string, string, string];

export interface ClumpOptions {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  palette: LeafPalette;
  seed: number;
  phase?: number;
  /** Canopy sway in authored cells. The trunk is drawn separately and never moves. */
  sway?: number;
  time?: number;
  density?: number;
  lightness?: number;
}

/**
 * A deliberately irregular leaf mass. Lobes, holes and sparse outer cells keep
 * the silhouette leafy after the renderer minifies it; it must not collapse into
 * one smooth ellipse at the minimum zoom.
 */
export function foliageClump(s: GlyphShape, options: ClumpOptions): void {
  const { cx, cy, rx, ry, palette, seed } = options;
  const time = options.time ?? 0;
  const phase = options.phase ?? 0;
  const sway = options.sway ?? 0;
  const density = options.density ?? .88;
  const lightness = options.lightness ?? 1;
  const marginX = rx + 6;
  const marginY = ry + 5;
  const lean = Math.sin(time * .75 + phase) * sway;
  const centerX = cx + lean;
  const centerY = cy + Math.cos(time * .5 + phase) * sway * .12;

  for (let y = Math.floor(centerY - marginY); y <= Math.ceil(centerY + marginY); y++) {
    for (let x = Math.floor(centerX - marginX); x <= Math.ceil(centerX + marginX); x++) {
      const nx = (x - centerX) / rx;
      const ny = (y - centerY) / ry;
      const angle = Math.atan2(ny, nx);
      const d = nx * nx + ny * ny;
      const lobes = .91 + Math.sin(angle * 5 + phase) * .075 + Math.sin(angle * 9 - phase * .7) * .045;
      const n = noise(x, y, seed);
      const boundary = lobes + (n - .5) * .16;
      if (d > boundary + .12) continue;

      // Small transparent cuts, especially underneath, separate overlapping clumps.
      const underside = ny > .25 ? .07 : .025;
      if (n < underside || (d > .7 && n < .1)) continue;
      if (d > .7 && n > density) continue;

      const rim = Math.max(0, (d - .62) / .42);
      const flutter = rim * Math.sin(time * 2 + x * .17 + y * .11 + phase) * .7;
      const px = Math.round(x + flutter);
      const py = Math.round(y + rim * Math.cos(time * 1.5 + y * .13 + phase) * .35);
      if (d > boundary) {
        // A few detached leaves, never a regular outline of dots.
        if (n < .76) continue;
        s.cell(px, py, n > .93 ? '*' : n > .86 ? "'" : '.', palette[rim > .65 ? 3 : 2]);
        continue;
      }

      const light = (.34 + (1 - ny) * .24 - nx * .12 + (n - .5) * .16) * lightness;
      const shade = Math.max(0, Math.min(3, Math.floor(light * 4)));
      const glyphs = shade === 0 ? ":;'" : shade === 1 ? ';+x' : shade === 2 ? '*xO' : 'O#%';
      const glyph = glyphs[Math.floor(n * glyphs.length) % glyphs.length];
      s.cell(px, py, rim > .72 && n < .58 ? "'" : glyph, palette[shade]);
    }
  }
}

export interface TrunkOptions {
  x: number;
  y: number;
  topX: number;
  topY: number;
  baseWidth: number;
  topWidth: number;
  palette: readonly string[];
  seed: number;
  roots?: number;
}

/** Tapered, bent trunk with bark scratches and flared roots. All coordinates are static. */
export function drawTrunk(s: GlyphShape, options: TrunkOptions): void {
  const { x, y, topX, topY, baseWidth, topWidth, palette, seed } = options;
  const dx = topX - x;
  const dy = topY - y;
  const length = Math.max(1, Math.hypot(dx, dy));
  const nx = -dy / length;
  const ny = dx / length;
  const lower = baseWidth * .5;
  const upper = topWidth * .5;
  const bendX = x + dx * .45 + nx * baseWidth * .12;
  const bendY = y + dy * .45 + ny * baseWidth * .12;
  s.polygon([
    [x - nx * lower, y - ny * lower], [x + nx * lower, y + ny * lower],
    [bendX + nx * upper * 1.5, bendY + ny * upper * 1.5],
    [topX + nx * upper, topY + ny * upper], [topX - nx * upper, topY - ny * upper],
    [bendX - nx * upper * 1.5, bendY - ny * upper * 1.5],
  ], palette, .78, '.:;|x#');

  const marks = Math.max(3, Math.floor(length / 18));
  for (let i = 0; i < marks; i++) {
    const t = .12 + noise(i, 2, seed) * .8;
    const mx = x + dx * t;
    const my = y + dy * t;
    const offset = (noise(i, 7, seed) - .5) * baseWidth * (1 - t * .65);
    const color = palette[i % 2];
    s.line(mx + nx * offset, my + ny * offset, mx + nx * offset + dx * .035, my + ny * offset + dy * .035, color, i % 3 === 0 ? '/' : '|');
  }

  const rootSpread = options.roots ?? baseWidth * 1.45;
  const sides = [-1, 1];
  for (const side of sides) {
    const rootX = x + side * rootSpread * (.82 + noise(side, 9, seed) * .25);
    s.polygon([
      [x + side * lower * .55, y - 3], [x + side * lower * 1.05, y + 1],
      [rootX + side * 3, y + 3], [rootX, y + 5],
      [x + side * lower * .2, y + 2],
    ], palette, .57, '.:;|');
  }
}

/** A tapered branch. Main branches remain fixed; callers can animate only outer twigs. */
export function drawBranch(
  s: GlyphShape,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  width: number,
  palette: readonly string[],
  seed: number,
): void {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const length = Math.max(1, Math.hypot(dx, dy));
  const nx = -dy / length;
  const ny = dx / length;
  const w = width * .5;
  const tip = Math.max(.55, width * .16);
  s.polygon([
    [x0 + nx * w, y0 + ny * w], [x1 + nx * tip, y1 + ny * tip],
    [x1 - nx * tip, y1 - ny * tip], [x0 - nx * w, y0 - ny * w],
  ], palette, .69, '.:;|x');
  s.line(x0 + nx * w * .45, y0 + ny * w * .45, x1, y1, palette[palette.length - 1], dx * dy < 0 ? '/' : '\\');
  if (width > 3) s.line(x0 - nx * w * .25, y0 - ny * w * .25, x1, y1 + .5, palette[0], '|');
  // Tiny seed-dependent forks make repeated placements less identical.
  if (width > 4 && noise(seed, x1, y1) > .42) {
    const side = noise(seed, y1, x0) > .5 ? 1 : -1;
    s.line(x1 - dx * .2, y1 - dy * .2, x1 + side * width * 1.4, y1 - width * 1.2, palette[1], '/');
  }
}

/** Stable per-placement jitter, in authored cells. */
export function variation(value: number, seed: number, amount: number): number {
  return (noise(value, seed, 811) - .5) * amount;
}
