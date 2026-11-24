import { GlyphShape } from '../shapes.ts';
import { noise, type AsciiCell } from '../types.ts';

/** Shared drawing helpers for buildings and settlement props.
 * Everything paints glyph cells in asset-local coordinates onto an `Art`. Colours are albedo. */
export type Pal = readonly string[];
export type Paint = readonly [string, string] | null;

export function hex(c: string): [number, number, number] {
  return [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
}
export function rgb(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
}
export function shade(c: string, f: number): string { const [r, g, b] = hex(c); return rgb(r * f, g * f, b * f); }
export function mix(a: string, b: string, t: number): string {
  const p = hex(a); const q = hex(b);
  return rgb(p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t, p[2] + (q[2] - p[2]) * t);
}
export function pick(p: Pal, v: number): string { return p[Math.max(0, Math.min(p.length - 1, Math.floor(v * p.length)))]; }
export function lerp(a: number, b: number, t: number): number { return a + (b - a) * t; }
export function clamp(v: number, lo = 0, hi = 1): number { return Math.max(lo, Math.min(hi, v)); }
/** Glyph from a density ramp (sparse -> dense) by value 0..1. */
export function ink(ramp: string, v: number): string { return ramp[Math.max(0, Math.min(ramp.length - 1, Math.floor(v * ramp.length)))]; }

export class Art {
  readonly s: GlyphShape;
  constructor(readonly w: number, readonly h: number, readonly seed: number, readonly time = 0) { this.s = new GlyphShape(w, h, seed); }
  put(x: number, y: number, g: string, c: string): void { this.s.cell(x, y, g, c); }
  n(x: number, y: number, k = 0): number { return noise(x, y, this.seed * 7 + k); }
  frame(): AsciiCell[] { return this.s.frame(); }
}

/** Fill the box x0..x1, y0..y1 (inclusive). f gets absolute x,y and u,v in 0..1 across the box. */
export function fill(a: Art, x0: number, y0: number, x1: number, y1: number,
  f: (x: number, y: number, u: number, v: number) => Paint, inside?: (x: number, y: number) => boolean): void {
  x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
  const dx = Math.max(1, x1 - x0); const dy = Math.max(1, y1 - y0);
  for (let y = Math.max(0, y0); y <= Math.min(a.h - 1, y1); y++) for (let x = Math.max(0, x0); x <= Math.min(a.w - 1, x1); x++) {
    if (inside && !inside(x, y)) continue;
    const p = f(x, y, (x - x0) / dx, (y - y0) / dy);
    if (p) a.put(x, y, p[0], p[1]);
  }
}

export function disc(a: Art, cx: number, cy: number, rx: number, ry: number, f: (x: number, y: number, d: number, nx: number, ny: number) => Paint): void {
  for (let y = Math.floor(cy - ry); y <= cy + ry; y++) for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
    const nx = (x - cx) / rx; const ny = (y - cy) / ry; const d = nx * nx + ny * ny;
    if (d > 1) continue;
    const p = f(x, y, d, nx, ny);
    if (p) a.put(x, y, p[0], p[1]);
  }
}

// ---------------------------------------------------------------- roofs
export interface RoofSpec {
  kind: 'thatch' | 'shingle' | 'slate';
  yTop: number; yBot: number; topL: number; topR: number; botL: number; botR: number;
  pal: Pal; holes?: number; patches?: boolean;
}
export function roof(a: Art, r: RoofSpec): void {
  const span = r.yBot - r.yTop;
  const edges = (y: number) => { const v = (y - r.yTop) / span; return [lerp(r.topL, r.botL, v), lerp(r.topR, r.botR, v)] as const; };
  const inside = (x: number, y: number) => { const [l, rr] = edges(y); return x >= l && x <= rr; };
  fill(a, Math.min(r.topL, r.botL), r.yTop, Math.max(r.topR, r.botR), r.yBot, (x, y, _u, v) => {
    const [xl, xr] = edges(y); const u = (x - xl) / Math.max(1, xr - xl);
    const n = a.n(x, y, 1);
    let b = .84 - .3 * v - u * .1 + (n - .5) * .2;
    let g: string; let c: string;
    const dy = y - r.yTop;
    if (r.holes && a.n(Math.floor(x / 7), Math.floor(y / 7), 9) < r.holes && v > .15 && v < .9) return [n > .5 ? '|' : '/', shade(r.pal[0], .45)];
    if (r.kind === 'thatch') {
      if (dy % 10 < 2) b -= .2;
      g = n < .22 ? '|' : u < .5 ? '/' : '\\';
      if (r.patches && a.n(Math.floor(x / 14), Math.floor(y / 11), 5) > .8) { c = mix('#8c7040', '#5c6a3a', n); g = n > .5 ? '=' : 'x'; return [g, c]; }
    } else if (r.kind === 'shingle') {
      const row = Math.floor(dy / 5); const off = (row % 2) * 4; const col = (x + off) % 9;
      const id = a.n(row, Math.floor((x + off) / 9), 2);
      b += (id - .5) * .25;
      if (dy % 5 === 4) b -= .28;
      g = col === 0 ? '|' : '=';
      if (col === 0) b -= .3;
    } else {
      const row = Math.floor(dy / 6); const off = (row % 2) * 4; const col = (x + off) % 8;
      const id = a.n(row, Math.floor((x + off) / 8), 3);
      b += (id - .5) * .2;
      if (dy % 6 === 5) b -= .25;
      g = col === 0 ? '|' : '#';
      if (col === 0) b -= .25;
    }
    if (dy < 3) { b = .98; g = '#'; }
    if (y > r.yBot - 3) { b -= .3; g = '%'; }
    c = pick(r.pal, clamp(b));
    if (x < xl + 1.2 || x > xr - 1.2) { c = shade(r.pal[0], .6); g = '%'; }
    return [g, c];
  }, inside);
}

/** Dark soft shadow strip under an eave onto a wall. */
export function eaveShadow(a: Art, x0: number, x1: number, y: number, h = 5): void {
  fill(a, x0, y, x1, y + h - 1, (x, yy, _u, v) => {
    if (a.n(x, yy, 4) < v * .9) return null;
    return [v < .5 ? '%' : ':', mix('#1a1410', '#4a3d30', v)];
  });
}

// ---------------------------------------------------------------- walls
export function timberWall(a: Art, x0: number, y0: number, x1: number, y1: number, plaster: Pal, beam: string,
  o: { panel?: number; braces?: boolean; sill?: number; tone?: number } = {}): void {
  const panel = o.panel ?? 34; const sill = o.sill ?? 4;
  const beamAt = (x: number, y: number) => {
    if (x < x0 + 3 || x > x1 - 3 || y < y0 + 3 || y > y1 - sill) return true;
    const px = (x - x0 - 3) % panel; return px < 3;
  };
  fill(a, x0, y0, x1, y1, (x, y, u) => {
    const n = a.n(x, y, 6);
    if (beamAt(x, y)) return ['#', shade(beam, .85 + n * .3)];
    const b = (o.tone ?? .8) + (n - .5) * .18 - u * .1;
    return [n < .25 ? '+' : n < .6 ? '=' : 'o', pick(plaster, clamp(b))];
  });
  if (o.braces) {
    const panels = Math.floor((x1 - x0 - 3) / panel);
    for (let p = 0; p < panels; p++) {
      const px = x0 + 3 + p * panel + 3; const w = panel - 3;
      const down = p % 2 === 0;
      for (let t = 0; t <= 1; t += .01) {
        const bx = px + (down ? t : 1 - t) * (w - 1); const by = y0 + 4 + t * (y1 - sill - y0 - 5);
        a.put(bx, by, '#', shade(beam, 1)); a.put(bx + 1, by, '#', shade(beam, .9));
      }
    }
  }
}

export function stoneFill(a: Art, x0: number, y0: number, x1: number, y1: number, pal: Pal,
  o: { mask?: (x: number, y: number) => boolean; moss?: number; course?: number; bw?: number; tone?: number } = {}): void {
  const course = o.course ?? 8; const bw = o.bw ?? 16;
  fill(a, x0, y0, x1, y1, (x, y, u) => {
    const row = Math.floor((y - y0) / course); const off = (row % 2) * (bw >> 1) + Math.floor(a.n(row, 0, 11) * 4);
    const col = Math.floor((x - x0 + off) / bw);
    const id = a.n(row, col, 12); const n = a.n(x, y, 13);
    const mortar = (x - x0 + off) % bw === 0 || (y - y0) % course === 0;
    if (mortar) return [n < .5 ? ':' : '.', shade(pal[0], .8)];
    const lit = ((y - y0) % course) < 2 ? .1 : 0;
    let b = (o.tone ?? .62) + (id - .5) * .38 + (n - .5) * .12 + lit - u * .14;
    let c = pick(pal, clamp(b));
    let g = n < .25 ? 'o' : n < .6 ? '#' : '%';
    if (o.moss && a.n(Math.floor(x / 3), Math.floor(y / 3), 14) * (1 - (y - y0) / Math.max(1, y1 - y0) * .5) > 1 - o.moss) { c = mix(c, '#4d7a3c', .7); g = n < .5 ? '&' : ';'; }
    return [g, c];
  }, o.mask);
}

// ---------------------------------------------------------------- openings
export interface DoorSpec { plank: Pal; frame: string; arched?: boolean; double?: boolean; bands?: boolean; handle?: string; boarded?: boolean; rag?: string }
export function door(a: Art, x: number, y: number, w: number, h: number, d: DoorSpec): void {
  const cx = x + (w - 1) / 2; const rad = w / 2;
  const inside = (px: number, py: number, pad: number) => {
    if (!d.arched) return px >= x - pad && px <= x + w - 1 + pad && py >= y - pad;
    if (py >= y + rad) return px >= x - pad && px <= x + w - 1 + pad;
    return (px - cx) ** 2 + (py - (y + rad)) ** 2 <= (rad + pad) ** 2;
  };
  fill(a, x - 3, y - 3, x + w + 2, y + h - 1, (px, py) => inside(px, py, 3) && !inside(px, py, 0) ? ['#', shade(d.frame, .8 + a.n(px, py, 15) * .3)] : null);
  if (d.rag) {
    fill(a, x, y, x + w - 1, y + h - 1, () => ['%', '#0d0a08']);
    fill(a, x + 1, y, x + w - 2, y + h - 1, (px, py, _u, v) => {
      const hem = h * (.82 + .16 * Math.sin(px * .9) * .5 + .1 * a.n(px, 0, 16));
      if (py - y > hem) return null;
      return [a.n(px, py, 17) < .5 ? '#' : '%', mix(d.rag!, '#2a1810', v * .45 + (Math.sin(px * .8 + py * .15) * .5 + .5) * .25)];
    });
    return;
  }
  fill(a, x, y, x + w - 1, y + h - 1, (px, py, u, v) => {
    const k = Math.floor((px - x) / 4); const n = a.n(k, py, 18);
    const seam = (px - x) % 4 === 0 || (d.double && Math.abs(px - cx) < .8);
    let b = .55 + (a.n(k, 3, 19) - .5) * .3 - u * .12 + (n - .5) * .08;
    if (seam) return ['|', shade(d.plank[0], .7)];
    if (d.bands && (Math.abs(v - .22) < .03 || Math.abs(v - .74) < .03)) return ['=', '#1f2226'];
    return [n < .3 ? '%' : '#', pick(d.plank, clamp(b))];
  }, (px, py) => inside(px, py, 0));
  const hy = y + h * .55;
  if (d.double) { a.put(cx - 3, hy, 'o', d.handle ?? '#b09a55'); a.put(cx + 3, hy, 'o', d.handle ?? '#b09a55'); }
  else { a.put(x + w - 6, hy, 'O', d.handle ?? '#a89a70'); a.put(x + w - 6, hy + 1, 'o', d.handle ?? '#a89a70'); }
  if (d.boarded) {
    for (const [dy, dx] of [[.25, 1], [.5, -1], [.72, 1]] as const) {
      const yy = y + h * dy;
      for (let px = x - 5; px < x + w + 5; px++) {
        const py = yy + (px - x) * .08 * dx;
        for (let t = 0; t < 4; t++) a.put(px, py + t, t === 0 ? '=' : '#', mix('#7a6a50', '#3b3126', t * .25 + a.n(px, t, 20) * .3));
      }
    }
  }
}

export interface WindowSpec { lit?: boolean; shutter?: string; box?: boolean; frame?: string; glass?: string; boarded?: boolean; round?: boolean; cross?: boolean }
export function windowPane(a: Art, x: number, y: number, w: number, h: number, o: WindowSpec): void {
  const frame = o.frame ?? '#d8d0b8';
  const lit = o.lit;
  if (o.shutter) {
    const sw = Math.max(5, Math.round(w * .38));
    for (const side of [-1, 1]) {
      const sx = side < 0 ? x - sw - 2 : x + w + 2;
      fill(a, sx, y - 2, sx + sw - 1, y + h + 1, (px, py, _u, v) => {
        const slat = Math.floor((py - y) / 3) % 2;
        const n = a.n(px, py, 21);
        return [(px - sx) % 3 === 0 ? '|' : slat ? '=' : '#', shade(o.shutter!, .72 + (n - .5) * .3 + (slat ? .1 : 0) - v * .1)];
      });
    }
  }
  fill(a, x - 2, y - 2, x + w + 1, y + h + 1, (px, py) => ['#', shade(frame, .8 + a.n(px, py, 22) * .25)], (_px, py) => !o.round || py >= y - 2);
  fill(a, x, y, x + w - 1, y + h - 1, (px, py, u, v) => {
    const n = a.n(px, py, 23);
    if (o.cross !== false && (Math.abs(u - .5) * w < .8 || Math.abs(v - .5) * h < .8)) return ['#', shade(frame, .55)];
    if (lit) {
      const b = .85 + (n - .5) * .14 - v * .12 + Math.sin(u * 3) * .04;
      return [n < .2 ? '%' : '#', mix('#ffb84a', '#ffe9a8', clamp(b - .35))];
    }
    const glass = o.glass ?? '#1c2733';
    const glint = (px - x + (py - y)) % 11 === 0 ? .55 : 0;
    return [glint ? '/' : n < .5 ? '%' : '#', mix(glass, '#5d7a96', glint + (1 - v) * .12 + n * .06)];
  }, o.round ? (px, py) => {
    const cx = x + (w - 1) / 2; if (py >= y + w / 2) return true;
    return (px - cx) ** 2 + (py - (y + w / 2)) ** 2 <= (w / 2) ** 2;
  } : undefined);
  fill(a, x - 4, y + h + 2, x + w + 3, y + h + 4, (px, py) => ['=', shade(frame, .62 + a.n(px, py, 24) * .15)]);
  if (o.boarded) {
    for (const dy of [.15, .5, .78]) {
      const yy = y + h * dy;
      for (let px = x - 5; px < x + w + 5; px++) {
        const py = yy + (px - x) * (dy > .4 ? -.07 : .07);
        for (let t = 0; t < 4; t++) a.put(px, py + t, t === 0 ? '=' : '#', mix('#7a6a50', '#33291f', t * .25 + a.n(px, t, 25) * .3));
      }
    }
  }
  if (o.box) {
    fill(a, x - 5, y + h + 3, x + w + 4, y + h + 11, (px, py, _u, v) => ['#', shade('#6b4a2c', .7 + a.n(px, py, 26) * .4 - v * .3)]);
    for (let px = x - 4; px < x + w + 4; px++) {
      const n = a.n(px, 1, 27);
      for (let t = 0; t < 4 + Math.floor(n * 4); t++) {
        const colr = n < .3 ? '#e0607a' : n < .55 ? '#f0d050' : n < .8 ? '#d890e0' : '#e87040';
        a.put(px, y + h + 2 - t, t > 3 ? '*' : '&', t > 3 ? colr : mix('#3c7a3a', '#56a04a', a.n(px, t, 28)));
      }
    }
  }
}

// ---------------------------------------------------------------- chimney, smoke, steps, sign
export function chimney(a: Art, x: number, yTop: number, yBot: number, w: number, pal: Pal): void {
  stoneFill(a, x, yTop, x + w - 1, yBot, pal, { course: 6, bw: 10, tone: .5 });
  fill(a, x - 2, yTop - 3, x + w + 1, yTop, (px, py) => ['#', shade(pal[Math.min(pal.length - 1, 2)], .8 + a.n(px, py, 29) * .3)]);
  fill(a, x + 2, yTop - 2, x + w - 3, yTop - 1, () => ['%', '#12100e']);
}
export function smoke(a: Art, cx: number, y: number, count = 14, rise = 46): void {
  for (let i = 0; i < count; i++) {
    const t = (a.time * .25 + i / count) % 1;
    const px = cx + Math.sin(t * 7 + i * 1.7) * (2 + t * 5) + t * 9;
    const py = y - t * rise;
    const g = t < .35 ? 'o' : t < .65 ? '°' : '.';
    const v = 150 - t * 50 + a.n(i, 0, 30) * 25;
    a.put(px, py, g, rgb(v, v, v + 6));
    if (t < .6) a.put(px + 1, py, g === 'o' ? '.' : ',', rgb(v - 10, v - 10, v - 4));
  }
}
export function steps(a: Art, x0: number, x1: number, yBottom: number, count: number, pal: Pal): void {
  for (let i = 0; i < count; i++) {
    const inset = (count - 1 - i) * 3;
    const y = yBottom - (i + 1) * 4 + 1;
    fill(a, x0 + inset - (count - 1 - i) * 0, y, x1 - inset, y + 3, (px, py, _u, v) => {
      const n = a.n(px, py, 31);
      return [v < .3 ? '=' : n < .5 ? '#' : '%', pick(pal, clamp(.7 - v * .35 + (n - .5) * .15))];
    });
  }
}
/** Hanging sign: iron bracket from x0 to board, board with simple pictogram colour. */
export function hangingSign(a: Art, wallX: number, y: number, boardW: number, boardH: number, colour: string, mark: string): void {
  const bx = wallX - boardW - 6;
  a.s.line(wallX, y, bx - 2, y, '#25272b', '=');
  a.s.line(wallX, y + 1, bx - 2, y + 1, '#25272b', '=');
  a.s.line(wallX, y + 8, wallX - 14, y + 1, '#25272b', '/');
  for (const cxx of [bx + 3, bx + boardW - 3]) for (let t = 2; t < 8; t++) a.put(cxx, y + t, '|', '#3a3a3a');
  fill(a, bx, y + 8, bx + boardW, y + 8 + boardH, (px, py, u, v) => {
    const n = a.n(px, py, 32);
    if (px < bx + 2 || px > bx + boardW - 2 || py < y + 10 || py > y + 6 + boardH) return ['#', '#2e2016'];
    const dx = (u - .5); const dy = (v - .5);
    if (mark === 'mug' && Math.abs(dx) < .22 && Math.abs(dy) < .25) return ['O', '#e6dcb0'];
    if (mark === 'mug' && dx > .2 && dx < .34 && Math.abs(dy) < .14) return ['o', '#e6dcb0'];
    return [n < .5 ? '#' : '%', shade(colour, .8 + n * .3)];
  });
}

export function circlesAlong(ax: number, ay: number, xFrom: number, xTo: number, y: number, r: number, spacing = 1.5): { x: number; y: number; radius: number }[] {
  const out: { x: number; y: number; radius: number }[] = [];
  const count = Math.max(1, Math.ceil((xTo - xFrom) / (r * spacing)));
  for (let i = 0; i <= count; i++) out.push({ x: Math.round(lerp(xFrom, xTo, i / count) - ax), y: Math.round(y - ay), radius: r });
  return out;
}

// ---------------------------------------------------------------- settlement prop pieces
/** A bulged wooden barrel. `base` is the bottom centre; the visible top is drawn last. */
export function barrel(a: Art, cx: number, base: number, rx: number, h: number, pal: Pal,
  o: { hoop?: string; noiseK?: number; damp?: boolean } = {}): void {
  const cy = base - h / 2;
  const k = o.noiseK ?? 100;
  disc(a, cx, cy, rx, h / 2, (x, y, d, nx, ny) => {
    const n = a.n(x, y, k);
    const v = (y - (base - h)) / h;
    const hoop = Math.abs(v - .24) < .045 || Math.abs(v - .76) < .045;
    const stave = (x - cx + Math.floor(h / 9)) % 7 === 0;
    if (d > .84) return ['%', shade(pal[0], .72 + n * .22)];
    if (hoop) return ['=', shade(o.hoop ?? '#30343a', .78 + n * .3)];
    const wet = o.damp && v > .72 ? .72 : 1;
    return [stave ? '|' : n < .38 ? '#' : '%', shade(pick(pal, clamp(.7 - nx * .24 - ny * .12 + (n - .5) * .16)), wet)];
  });
  disc(a, cx, base - h + 2, rx * .79, Math.max(3, h * .09), (x, y, d, nx, _ny) => {
    const n = a.n(x, y, k + 1);
    if (d > .72) return ['=', shade(pal[1], .75 + n * .25)];
    return [nx < -.2 ? '=' : 'o', shade(pal[2], .74 + n * .24 - nx * .08)];
  });
  a.put(cx, base - h + Math.round(h * .53), 'o', shade(pal[0], .62));
}

/** Plank crate with a dark frame and two broad diagonal braces. */
export function crate(a: Art, x: number, y: number, w: number, h: number, pal: Pal,
  o: { noiseK?: number; brace?: string } = {}): void {
  const k = o.noiseK ?? 110;
  fill(a, x, y, x + w - 1, y + h - 1, (px, py, u, v) => {
    const n = a.n(px, py, k);
    const edge = px < x + 3 || px > x + w - 4 || py < y + 3 || py > y + h - 4;
    const plank = (py - y) % 7 === 0;
    return [edge ? '#' : plank ? '=' : n < .45 ? '#' : '%', edge ? shade(pal[0], .72 + n * .22) : pick(pal, clamp(.62 + (n - .5) * .2 - v * .08 - u * .06))];
  });
  const inset = 4;
  a.s.line(x + inset, y + inset, x + w - 1 - inset, y + h - 1 - inset, o.brace ?? shade(pal[1], .92), '/');
  a.s.line(x + inset, y + h - 1 - inset, x + w - 1 - inset, y + inset, o.brace ?? shade(pal[0], 1.05), '\\');
  for (const [px, py] of [[x + 2, y + 2], [x + w - 3, y + 2], [x + 2, y + h - 3], [x + w - 3, y + h - 3]] as const) a.put(px, py, 'o', '#25211c');
}

/** Straight timber or iron pole with a lit left edge and grain/oxidation noise. */
export function pole(a: Art, cx: number, yTop: number, yBottom: number, rx: number, pal: Pal,
  o: { noiseK?: number; iron?: boolean } = {}): void {
  fill(a, cx - rx, yTop, cx + rx, yBottom, (x, y, u, _v) => {
    const n = a.n(x, y, o.noiseK ?? 120);
    const edge = u < .16 || u > .86;
    const g = o.iron ? (n < .22 ? ':' : '#') : (x === cx && y % 13 < 5 ? '|' : n < .3 ? '/' : '#');
    return [g, pick(pal, clamp(edge ? .88 : .48 + u * .25 + (n - .5) * .16))];
  });
}

/** Warm lantern housing. The caller supplies the matching asset-level light. */
export function lantern(a: Art, cx: number, cy: number, rx: number, ry: number, time = 0): void {
  const flicker = .92 + Math.sin(time * 7.1 + cx * .13) * .05 + Math.sin(time * 11.3 + cy) * .03;
  // Hanging cap and little finial.
  a.s.line(cx, cy - ry - 7, cx, cy - ry - 2, '#282b30', '|');
  fill(a, cx - rx - 3, cy - ry - 2, cx + rx + 3, cy - ry + 2, (x, y, u) => ['#', shade('#34383d', .78 + (1 - Math.abs(u - .5)) * .4 + a.n(x, y, 124) * .12)]);
  // Dark metal cage around the luminous panes.
  fill(a, cx - rx, cy - ry + 3, cx + rx, cy + ry, (x, y, u, v) => {
    const edge = x < cx - rx + 2 || x > cx + rx - 2 || y < cy - ry + 5 || y > cy + ry - 2 || Math.abs(u - .5) < .07;
    const n = a.n(x, y, 125);
    if (edge) return ['#', shade('#30343a', .72 + n * .3)];
    return [v < .3 && n > .45 ? '%' : '#', mix('#e8892c', '#fff0ad', clamp((.4 + (1 - v) * .35 + (n - .5) * .12) * flicker))];
  });
  fill(a, cx - rx - 2, cy + ry + 1, cx + rx + 2, cy + ry + 4, (x, y) => ['=', shade('#30343a', .74 + a.n(x, y, 126) * .3)]);
}

/** Deterministic layered flames. `height` is the tallest tongue, not the ring size. */
export function flame(a: Art, cx: number, base: number, height: number, time: number,
  o: { noiseK?: number; embers?: boolean } = {}): void {
  const k = o.noiseK ?? 130;
  const tongues = o.embers ? 4 : 7;
  for (let i = 0; i < tongues; i++) {
    const spread = (i / Math.max(1, tongues - 1) - .5) * Math.max(8, height * .7);
    const wave = Math.sin(time * (o.embers ? 4.2 : 8.3) + i * 2.17 + a.seed * .01);
    const h = Math.max(2, Math.round(height * (o.embers ? .18 + .18 * (wave * .5 + .5) : .48 + (wave * .5 + .5) * .52) * (1 - Math.abs(spread) / Math.max(9, height))));
    for (let t = 0; t < h; t++) {
      const y = base - 1 - t;
      const bend = Math.round(Math.sin(time * 5.4 + t * .47 + i) * t * .09 + wave * t * .04);
      const width = t > h - 3 ? 1 : t > h * .55 ? 2 : 3;
      for (let w = -width; w <= width; w++) {
        const edge = Math.abs(w) === width;
        const col = edge ? '#d94b20' : t > h * .68 ? '#ffd15b' : t > h * .32 ? '#ff8b2d' : '#f45b22';
        a.put(cx + spread + bend + w, y, edge ? '/' : t > h * .7 ? '^' : '*', col);
      }
    }
  }
  // Independent seed texture keeps the coal bed from looking like a flat icon.
  for (let i = 0; i < 20; i++) {
    const x = cx + Math.round((a.n(i, 1, k) - .5) * Math.max(12, height));
    const y = base - Math.round(a.n(i, 2, k + 1) * 4);
    a.put(x, y, a.n(i, 3, k + 2) > .55 ? 'o' : 'x', a.n(i, 4, k + 3) > .5 ? '#ff9a38' : '#8f2f1c');
  }
}
