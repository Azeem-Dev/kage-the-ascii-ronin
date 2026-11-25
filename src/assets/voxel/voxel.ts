import type { AsciiCell } from '../types.ts';

/**
 * Voxel models rendered into glyph cells for the isometric view.
 *
 * Projection matches src/game/view.ts: screenX = X - Y, screenY = (X + Y) / 3 - Z.
 * The viewer sits at +X, +Y, +Z, so the visible faces are +X, +Y and the top.
 * Each screen cell is ray-marched through the grid, shaded from a smooth surface
 * normal, ambient occlusion and a cast shadow toward the light, then outlined at
 * silhouettes and depth edges. The glyph is chosen from the lit brightness.
 */

const SOLID = 1 << 24;
const EMISSIVE = 1 << 25;
const RGB = 0xffffff;

export type Rgb = readonly [number, number, number];

export function parseHex(c: string): Rgb {
  return [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
}
export function toHex(r: number, g: number, b: number): string {
  const q = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return '#' + q(r) + q(g) + q(b);
}
/** Multiply a #rrggbb colour. */
export function tint(c: string, f: number, add = 0): string {
  const [r, g, b] = parseHex(c);
  return toHex(r * f + add, g * f + add, b * f + add);
}

export class VoxelGrid {
  readonly data: Uint32Array;
  /** Grid covers X in [-hx, hx), Y in [-hy, hy), Z in [0, nz). */
  constructor(readonly hx: number, readonly hy: number, readonly nz: number) {
    this.data = new Uint32Array(hx * 2 * hy * 2 * nz);
  }
  get nx(): number { return this.hx * 2; }
  get ny(): number { return this.hy * 2; }
  private idx(x: number, y: number, z: number): number {
    return ((z * this.ny) + (y + this.hy)) * this.nx + (x + this.hx);
  }
  inside(x: number, y: number, z: number): boolean {
    return x >= -this.hx && x < this.hx && y >= -this.hy && y < this.hy && z >= 0 && z < this.nz;
  }
  set(x: number, y: number, z: number, color: string, emissive = false): void {
    x = Math.floor(x); y = Math.floor(y); z = Math.floor(z);
    if (!this.inside(x, y, z)) return;
    const [r, g, b] = parseHex(color);
    this.data[this.idx(x, y, z)] = SOLID | (emissive ? EMISSIVE : 0) | (r << 16) | (g << 8) | b;
  }
  clear(x: number, y: number, z: number): void {
    x = Math.floor(x); y = Math.floor(y); z = Math.floor(z);
    if (this.inside(x, y, z)) this.data[this.idx(x, y, z)] = 0;
  }
  get(x: number, y: number, z: number): number {
    return this.inside(x, y, z) ? this.data[this.idx(x, y, z)] : 0;
  }
  solid(x: number, y: number, z: number): boolean { return this.get(x, y, z) !== 0; }

  /** Fill an axis-aligned box [x0,x1) x [y0,y1) x [z0,z1); colour may vary per voxel (null skips). */
  box(x0: number, x1: number, y0: number, y1: number, z0: number, z1: number,
    color: string | ((x: number, y: number, z: number) => string | null)): void {
    for (let z = Math.floor(z0); z < Math.ceil(z1); z++) for (let y = Math.floor(y0); y < Math.ceil(y1); y++) for (let x = Math.floor(x0); x < Math.ceil(x1); x++) {
      const c = typeof color === 'string' ? color : color(x, y, z);
      if (c) this.set(x, y, z, c);
    }
  }
  /** Filled ellipsoid. */
  ellipsoid(cx: number, cy: number, cz: number, rx: number, ry: number, rz: number,
    color: string | ((x: number, y: number, z: number) => string | null)): void {
    for (let z = Math.floor(cz - rz); z <= Math.ceil(cz + rz); z++) for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const d = ((x + .5 - cx) / rx) ** 2 + ((y + .5 - cy) / ry) ** 2 + ((z + .5 - cz) / rz) ** 2;
      if (d > 1) continue;
      const c = typeof color === 'string' ? color : color(x, y, z);
      if (c) this.set(x, y, z, c);
    }
  }
  /** Vertical cylinder. */
  cylinder(cx: number, cy: number, z0: number, z1: number, r: number,
    color: string | ((x: number, y: number, z: number) => string | null)): void {
    for (let z = Math.floor(z0); z < Math.ceil(z1); z++) for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
      if ((x + .5 - cx) ** 2 + (y + .5 - cy) ** 2 > r * r) continue;
      const c = typeof color === 'string' ? color : color(x, y, z);
      if (c) this.set(x, y, z, c);
    }
  }
}

export interface VoxelRenderOptions {
  /** Direction towards the light in world space (need not be normalised). */
  light?: readonly [number, number, number];
  /** Ambient strength 0..1. */
  ambient?: number;
}

export interface VoxelSprite {
  width: number; height: number; anchor: { x: number; y: number };
  cells: AsciiCell[];
}

/** Brightness ramp: sparse in shade, dense when lit. */
const RAMP = ['.', ':', ';', 'o', 'x', 'X', '#', '%', '@'];

function hash(x: number, y: number, s: number): number {
  let n = Math.imul(x + 713, 374761393) ^ Math.imul(y + 197, 668265263) ^ Math.imul(s, 144269);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

export function renderVoxels(grid: VoxelGrid, opts: VoxelRenderOptions = {}): VoxelSprite {
  const { hx, hy, nz } = grid;
  const L0 = opts.light ?? [-.32, .58, .75];
  const ll = Math.hypot(L0[0], L0[1], L0[2]);
  const L: [number, number, number] = [L0[0] / ll, L0[1] / ll, L0[2] / ll];
  const ambient = opts.ambient ?? .5;

  // Screen extents of the grid.
  const halfW = hx + hy;
  const anchorX = halfW;
  const top = nz + Math.ceil((hx + hy) / 3);
  const anchorY = top;
  const width = halfW * 2 + 1;
  const height = anchorY + Math.ceil((hx + hy) / 3) + 1;

  const hit = new Int32Array(width * height).fill(-1);   // voxel value or -1
  const depth = new Float32Array(width * height);
  const nrm = new Float32Array(width * height * 3);
  const shade = new Float32Array(width * height);
  const hpos = new Float32Array(width * height * 3);

  for (let cy = 0; cy < height; cy++) for (let cx = 0; cx < width; cx++) {
    const u = cx - anchorX; const v = cy - anchorY;
    const i = cy * width + cx;
    // Clip the ray to the grid box: X, Y and Z must all lie inside it.
    const sHi = Math.min(2 * hx - u, 2 * hy + u, 3 * (v + nz)) - .01;
    const sLo = Math.max(-2 * hx - u, -2 * hy + u, 3 * v);
    for (let s = sHi; s >= sLo; s -= 1) {
      const X = (s + u) / 2; const Y = (s - u) / 2; const Z = s / 3 - v;
      const val = grid.get(Math.floor(X), Math.floor(Y), Math.floor(Z));
      if (!val) continue;
      hit[i] = val; depth[i] = s;
      hpos[i * 3] = X; hpos[i * 3 + 1] = Y; hpos[i * 3 + 2] = Z;
      break;
    }
  }

  // Normals, shadows and lighting per hit cell.
  for (let i = 0; i < width * height; i++) {
    if (hit[i] < 0) continue;
    const X = hpos[i * 3]; const Y = hpos[i * 3 + 1]; const Z = hpos[i * 3 + 2];
    const ix = Math.floor(X); const iy = Math.floor(Y); const iz = Math.floor(Z);
    let nx = 0, ny = 0, nzv = 0;
    for (let dz = -1; dz <= 1; dz++) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy && !dz) continue;
      if (grid.solid(ix + dx, iy + dy, iz + dz)) { nx -= dx; ny -= dy; nzv -= dz; }
    }
    let len = Math.hypot(nx, ny, nzv);
    if (len < .001) { nx = 0; ny = 0; nzv = 1; len = 1; }
    nx /= len; ny /= len; nzv /= len;
    // Surfaces must face the viewer.
    if (nx + ny + nzv < -.2) { nx = -nx; ny = -ny; nzv = -nzv; }
    nrm[i * 3] = nx; nrm[i * 3 + 1] = ny; nrm[i * 3 + 2] = nzv;

    const diff = Math.max(0, nx * L[0] + ny * L[1] + nzv * L[2]);
    const fill = Math.max(0, nx * .85 + ny * .1 + nzv * .3) * .3;
    // Ambient occlusion: how much solid sits just off the surface.
    let occ = 0;
    const px = X + nx * 1.6; const py = Y + ny * 1.6; const pz = Z + nzv * 1.6;
    for (let dz = -1; dz <= 1; dz++) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (grid.solid(Math.floor(px) + dx * 2, Math.floor(py) + dy * 2, Math.floor(pz) + dz * 2)) occ++;
    }
    const ao = 1 - Math.min(1, occ / 14) * .55;
    // Cast shadow toward the light.
    let shadow = 1;
    for (let t = 1.5; t < 26; t += 1) {
      if (grid.solid(Math.floor(X + L[0] * t + nx * .6), Math.floor(Y + L[1] * t + ny * .6), Math.floor(Z + L[2] * t + nzv * .6))) { shadow = .45; break; }
    }
    const hemi = ambient + .12 * nzv;
    shade[i] = (hemi + diff * .72 * shadow + fill) * ao;
  }

  const cells: AsciiCell[] = [];
  const at = (cx: number, cy: number) => (cx < 0 || cy < 0 || cx >= width || cy >= height) ? -1 : hit[cy * width + cx];
  for (let cy = 0; cy < height; cy++) for (let cx = 0; cx < width; cx++) {
    const i = cy * width + cx;
    const val = hit[i];
    if (val < 0) continue;
    const emissive = (val & EMISSIVE) !== 0;
    const base = val & RGB;
    let r = (base >> 16) & 255; let g = (base >> 8) & 255; let b = base & 255;
    let k = shade[i];
    if (emissive) k = 1.25;
    // Warm light, cool shadow.
    const warm = Math.max(0, Math.min(1, (k - .45) / .6));
    r *= k * (.86 + warm * .22); g *= k * (.92 + warm * .12); b *= k * (1.08 - warm * .2);
    // Silhouette and depth-edge outlines separate shapes at any zoom.
    let edge = 0;
    const neighbours: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (const [dx, dy] of neighbours) {
      const n = at(cx + dx, cy + dy);
      if (n < 0) { edge = Math.max(edge, 2); continue; }
      if (Math.abs(depth[(cy + dy) * width + cx + dx] - depth[i]) > 7) edge = Math.max(edge, 1);
    }
    if (!emissive) { if (edge === 2) { r *= .5; g *= .5; b *= .55; } else if (edge === 1) { r *= .78; g *= .78; b *= .82; } }
    const lum = (.299 * r + .587 * g + .114 * b) / 255;
    const rampPos = Math.max(0, Math.min(RAMP.length - 1, lum * (RAMP.length - 1) * 1.15 + (hash(cx, cy, 7) - .5) * .9));
    const glyph = emissive ? '@' : RAMP[Math.round(rampPos)];
    cells.push({ x: cx, y: cy, glyph, color: toHex(r, g, b) });
  }
  return { width, height, anchor: { x: anchorX, y: anchorY }, cells };
}
