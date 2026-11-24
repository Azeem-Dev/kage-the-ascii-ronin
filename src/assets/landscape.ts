import { noise, type AsciiCell } from './types.ts';

/** Continuous, world-anchored terrain. The renderer, physics and minimap all
 * sample the same water function, so a shore can never disagree between them. */
export function riverCenter(y: number): number {
  return 330 + Math.sin(y * .014) * 46 + Math.sin(y * .033 + .6) * 16;
}

/** Main-river half-width. Wide bends stay below 100 units so the old semantic
 * check (centre + 100 is dry) remains true. */
export function riverWidth(y: number): number {
  return 56 + Math.sin(y * .014 - .7) * 8 + Math.sin(y * .041 + 1) * 6;
}

const LAKE_X = 575, LAKE_Y = 98, LAKE_RX = 82, LAKE_RY = 52, LAKE_DEPTH = 52;
const TRIB_MIN_X = -120, TRIB_MAX_X = 380;
const tributaryCenter = (x: number): number => 416 + (x + 120) * .035 + Math.sin((x + 120) * .025) * 3;
const tributaryWidth = (x: number): number => 10 + (x - TRIB_MIN_X) / (TRIB_MAX_X - TRIB_MIN_X) * 12;

/** Sand-bar profile: flat dry sand inside q<0.55, then a smooth shallow ramp
 *  that rejoins the surrounding river depth at q=1.6. Kept tiny and inline so
 *  the per-cell water test stays cheap. */
function barDepth(river: number, q: number): number {
  const SAND = -3;
  if (q < .55) return SAND;
  const t = (q - .55) / 1.05;
  const s = t * t * (3 - 2 * t);
  return SAND * (1 - s) + river * s;
}

// River terms are memoised per row. Terrain scans rows, while prop generation
// jumps around; both paths still pay for the trigonometric centreline once.
let waterRowY = NaN, waterRowCenter = 0, waterRowWidth = 0, waterRowLakeDy = 0;

/** Positive signed depth for every water body: main river, Ashfork tributary
 * and Mirrorlake. Sand bars cut through the main channel; road fords shallow it. */
export function waterDepth(x: number, y: number): number {
  if (y !== waterRowY) {
    waterRowY = y;
    waterRowCenter = riverCenter(y);
    waterRowWidth = riverWidth(y);
    waterRowLakeDy = (y - LAKE_Y) / LAKE_RY;
  }
  let depth = waterRowWidth - Math.abs(x - waterRowCenter);
  // Two broad, shallow road crossings remain water (and therefore stay red in
  // debug mode), but are slow enough to wade rather than swim.
  if (Math.abs(y - 250) < 14 || Math.abs(y - 655) < 16) depth *= .22;

  if (x >= TRIB_MIN_X && x <= TRIB_MAX_X) {
    const branch = tributaryWidth(x) - Math.abs(y - tributaryCenter(x));
    if (branch > depth) depth = branch;
  }
  if (Math.abs(waterRowLakeDy) < 1.04 && Math.abs(x - LAKE_X) < LAKE_RX * 1.04) {
    const dx = (x - LAKE_X) / LAKE_RX;
    const q = dx * dx + waterRowLakeDy * waterRowLakeDy;
    if (q < 1.0816) {
      const lake = (1 - Math.sqrt(q)) * LAKE_DEPTH;
      if (lake > depth) depth = lake;
    }
  }

  // Elongated sand bars: a dry, walkable sand core (depth -3) ringed by a
  // shallow band that blends back into the channel. They read as real islands
  // in both the ground texture and the debug-water mask, not darker water.
  if (y > 250 && y < 370 && Math.abs(x - waterRowCenter + 10) < 24) {
    const dx = (x - waterRowCenter + 10) / 18, dy = (y - 310) / 46;
    const q = dx * dx + dy * dy;
    if (q < 1.6) depth = barDepth(depth, q);
  }
  if (y > -140 && y < 30 && Math.abs(x - waterRowCenter - 16) < 28) {
    const dx = (x - waterRowCenter - 16) / 22, dy = (y + 55) / 65;
    const q = dx * dx + dy * dy;
    if (q < 1.6) depth = barDepth(depth, q);
  }
  return depth;
}

/** Ground classes, exported so world generation can keep props off roads/fields. */
export const GROUND = { LUSH: 0, FOREST: 1, FLOWER: 2, DIRT: 3, COBBLE: 4, FARM: 5, MUD: 6, SAND: 7, WATER: 8, TOWN: 9, WARREN: 10, ASH: 11, CLEAR: 12, MEADOW: 13, FORGE: 14, CRYPT: 15, BANK: 16 } as const;

const LUSH = ['#1d3829', '#294a31', '#3a6039', '#527a43', '#70964f', '#91ad61'];
const VALLEY = ['#20372d', '#2d4938', '#405b40', '#59704a', '#75875a', '#96a16d'];
const MEADOW = ['#294c45', '#3d7258', '#559363', '#7cb67a', '#b1ca8a', '#d2d6a0'];
const AUTUMN = ['#433d32', '#68523b', '#896b43', '#b28c54', '#c6a76e', '#d7c098'];
const CRYPT = ['#252e41', '#37465c', '#4d6374', '#738798', '#9babc0', '#b6c1d1'];
const WATER = ['#101d27', '#1b303c', '#2d4854', '#456470', '#6e8990', '#b2c3bd'];
const FOREST = ['#111c17', '#19291e', '#243a25', '#344e2c', '#486137', '#5d7040'];
const TOWNGRASS = ['#2b5a38', '#3a7041', '#4d8749', '#64a057', '#82b86a', '#a0c986'];
const DIRT = ['#4b3b29', '#60492f', '#7a5e3d', '#8f7249', '#a38859', '#b99f74'];
const COBBLE = ['#3d4655', '#4f5b6b', '#657285', '#7d8a9b', '#97a3b2', '#b0bac6'];
const MUD = ['#2e2720', '#43382c', '#584936', '#6d5a43', '#7d6a52', '#8d7b64'];
const SAND = ['#6b5d45', '#8a7855', '#a58e62', '#bda476', '#d1ba8c', '#dfcda4'];
const WARREN = ['#1f291b', '#2c3a22', '#3b4c2b', '#4d5f34', '#5f7040', '#74834f'];
const ASH = ['#201a18', '#2f2623', '#3f332d', '#554239', '#6e5648', '#85685a'];
const WHEAT = ['#8c6d28', '#a8862f', '#c4a23c', '#d9b94c', '#e8cb62', '#f2dc82'];
const CABBAGE = ['#2f6a3a', '#3c8244', '#4f9a4f', '#68b25c', '#86c870', '#a6d98b'];
const FURROW = ['#33271b', '#45331f', '#573f26'];
const BLOOMS = ['#6ea2e6', '#e68fb8', '#a982e0', '#ecc85c', '#f0e8d4', '#ee7f8c'];
const PETALS = ['#6f394d', '#945269', '#b97386', '#d997aa', '#e9b4c2', '#f2d2d8'];

/** Hand-placed dirt roads and cobbled streets: [halfWidth, kind(0 dirt/1 cobble), ...x,y pairs]. */
const ROAD_DEFS: readonly (readonly number[])[] = [
  // camp -> Mudgate -> Highmere
  [3, 0, 440, 250, 500, 246, 560, 258, 620, 268, 660, 300, 700, 322, 745, 300, 790, 268, 830, 244, 860, 235],
  // junction -> Oakhollow; the final lane meets the proposed village-edge spawn.
  [3, 0, 620, 268, 640, 200, 670, 120, 715, 50, 745, 0, 742, -8, 752, -32, 778, -42, 820, -58],
  // meadow link
  [2.5, 0, 470, 60, 478, 140, 490, 222],
  // ford west to the watchtower and the crypt/forge road
  [3, 0, 440, 250, 345, 250, 300, 252, 260, 248, 222, 247, 192, 250],
  // crypt -> forge
  [3, 0, 197, 112, 180, 160, 171, 200, 180, 230, 190, 250, 200, 290, 209, 330, 195, 365, 185, 388],
  // forge -> orc warband, crossing the Ashfork at a shallow ford
  [3, 0, 185, 388, 178, 450, 165, 520, 158, 590, 152, 622],
  // crypt -> goblin warren
  [2.5, 0, 197, 112, 150, 140, 95, 170, 40, 200, -10, 218, -40, 222],
  // camp -> Silverleaf
  [3, 0, 487, 250, 495, 320, 505, 400, 500, 480, 515, 550, 520, 596],
  // orcs -> elves (fords the main river)
  [3, 0, 156, 648, 240, 665, 330, 655, 420, 640, 500, 628],
  // Mudgate's market lane makes the settlement readable from the main road.
  [2.5, 0, 700, 322, 700, 350, 730, 370],
  // Oakhollow main street and Mudgate lane: houses line these in rows.
  [3, 0, 640, -58, 820, -58, 920, -58],
  [2.5, 0, 600, 385, 700, 385, 820, 385],
  // Highmere streets (cobble)
  // High Street (north), Market Row (south) and the avenue up to the manor.
  // (Spread ×1.4 around (900, 235) to match TOWN_SPREAD in landmarks.ts.)
  [5, 1, 718, 235, 860, 235, 900, 235, 960, 235, 1152, 235],
  [5, 1, 816, 396, 900, 396, 960, 396, 1152, 396],
  [5, 1, 900, 74, 900, 235, 900, 396],
];
const SEG = 10;
const segs: number[] = [];
let rbMinX = 1e9, rbMaxX = -1e9, rbMinY = 1e9, rbMaxY = -1e9;
for (const def of ROAD_DEFS) {
  const hw = def[0], kind = def[1];
  for (let i = 2; i + 3 < def.length; i += 2) {
    const x1 = def[i], y1 = def[i + 1], x2 = def[i + 2], y2 = def[i + 3];
    const pad = hw + 4;
    segs.push(x1, y1, x2, y2, hw, kind, Math.min(x1, x2) - pad, Math.max(x1, x2) + pad, Math.min(y1, y2) - pad, Math.max(y1, y2) + pad);
    rbMinX = Math.min(rbMinX, x1 - pad, x2 - pad); rbMaxX = Math.max(rbMaxX, x1 + pad, x2 + pad);
    rbMinY = Math.min(rbMinY, y1 - pad, y2 - pad); rbMaxY = Math.max(rbMaxY, y1 + pad, y2 + pad);
  }
}
const SEGS = new Float64Array(segs);
let roadKind = 0;
let roadAcross = 0;

// Uniform grid: each 16-unit cell lists only the segments that can reach it.
const GRID = 16;
const gx0 = Math.floor(rbMinX / GRID), gy0 = Math.floor(rbMinY / GRID);
const gw = Math.floor(rbMaxX / GRID) - gx0 + 1, gh = Math.floor(rbMaxY / GRID) - gy0 + 1;
const grid: Int32Array[] = new Array(gw * gh).fill(null as unknown as Int32Array);
{
  const lists: number[][] = Array.from({ length: gw * gh }, () => []);
  for (let i = 0; i < SEGS.length; i += SEG) {
    const c0 = Math.floor(SEGS[i + 6] / GRID) - gx0, c1 = Math.floor(SEGS[i + 7] / GRID) - gx0;
    const r0 = Math.floor(SEGS[i + 8] / GRID) - gy0, r1 = Math.floor(SEGS[i + 9] / GRID) - gy0;
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) lists[r * gw + c].push(i);
  }
  lists.forEach((l, i) => { if (l.length) grid[i] = Int32Array.from(l); });
}

/** Signed distance from (x,y) to the nearest road edge (negative = on the road). */
export function roadDistance(x: number, y: number): number {
  const c = Math.floor(x / GRID) - gx0, r = Math.floor(y / GRID) - gy0;
  if (c < 0 || r < 0 || c >= gw || r >= gh) return 99;
  const list = grid[r * gw + c];
  if (!list) return 99;
  let best = 99;
  for (let k = 0; k < list.length; k++) {
    const i = list[k];
    if (x < SEGS[i + 6] || x > SEGS[i + 7] || y < SEGS[i + 8] || y > SEGS[i + 9]) continue;
    const x1 = SEGS[i], y1 = SEGS[i + 1], dx = SEGS[i + 2] - x1, dy = SEGS[i + 3] - y1;
    let t = ((x - x1) * dx + (y - y1) * dy) / (dx * dx + dy * dy);
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const px = x - x1 - dx * t, py = y - y1 - dy * t;
    const d = Math.sqrt(px * px + py * py);
    const e = d - SEGS[i + 4];
    if (e < best) { best = e; roadKind = SEGS[i + 5]; roadAcross = d; }
  }
  return best;
}

const FIELDS: readonly (readonly number[])[] = [
  // x0, y0, x1, y1, crop (0 wheat, 1 cabbage)
  [645, -125, 712, -78, 0], [645, -70, 712, -25, 1], [815, -125, 885, -78, 0], [815, -70, 885, -25, 1], [725, -165, 800, -125, 1], [800, -165, 870, -135, 0],
];

function vnoise(px: number, py: number, seed: number): number {
  const x0 = Math.floor(px), y0 = Math.floor(py);
  const fx = px - x0, fy = py - y0;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  const a = noise(x0, y0, seed), b = noise(x0 + 1, y0, seed), c = noise(x0, y0 + 1, seed), d = noise(x0 + 1, y0 + 1, seed);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

// Smooth tint field on an 8-unit lattice. The four corner hashes are memoised for
// the current lattice cell, so a row scan re-hashes only once every 8 columns.
let tLx = 1e9, tLy = 1e9, tA = 0, tB = 0, tC = 0, tD = 0, tSeed = -1;
function tint(x: number, y: number, seed: number, cell = 8): number {
  const px = x / cell, py = y / cell;
  const lx = Math.floor(px), ly = Math.floor(py);
  if (lx !== tLx || ly !== tLy || seed !== tSeed) { tLx = lx; tLy = ly; tSeed = seed; tA = noise(lx, ly, seed); tB = noise(lx + 1, ly, seed); tC = noise(lx, ly + 1, seed); tD = noise(lx + 1, ly + 1, seed); }
  const fx = px - lx, fy = py - ly;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  return tA + (tB - tA) * u + (tC - tA) * v + (tA - tB - tC + tD) * u * v;
}

// Macro fields are sampled on a 4x4 block lattice and memoised in a direct-mapped
// cache. They create broad clearings/patches rather than per-cell static noise.
const MACRO = 8192;
const mTagX = new Int32Array(MACRO).fill(0x7fffffff), mTagY = new Int32Array(MACRO).fill(0x7fffffff), mForest = new Float32Array(MACRO), mFlower = new Float32Array(MACRO);
function macro(x: number, y: number): number {
  const bx = Math.floor(x / 4), by = Math.floor(y / 4);
  const i = ((Math.imul(bx, 73856093) ^ Math.imul(by, 19349663)) >>> 0) & (MACRO - 1);
  if (mTagX[i] !== bx || mTagY[i] !== by) {
    mTagX[i] = bx; mTagY[i] = by;
    mForest[i] = vnoise(bx * 4 / 30, by * 4 / 30, 20); mFlower[i] = vnoise(bx * 4 / 17, by * 4 / 17, 29);
  }
  return i;
}

export const BIOME = { VALLEY: 0, MEADOW: 1, FOREST: 2, SAKURA: 3, FARMLAND: 4, WASTE: 5, FORGE: 6, CRYPT: 7, TOWN: 8 } as const;

/** Broad biome identity used by both ground texture and deterministic prop mixes. */
export function biomeAt(x: number, y: number): number {
  if (x > 590 && x < 820 && y > 245 && y < 425) return BIOME.WASTE;
  if (x > 45 && x < 270 && y > 550 && y < 745) return BIOME.WASTE;
  if (x > 430 && x < 630 && y > 545 && y < 725) return BIOME.SAKURA;
  if (x > 600 && x < 940 && y > -205 && y < 20) return BIOME.FARMLAND;
  if (x > 735 && x < 1130 && y > 70 && y < 400) return BIOME.TOWN;
  if ((x < 100 && y < 130) || (x > 965 && y < 100)) return BIOME.FOREST;
  if (Math.hypot(x - 185, y - 380) < 125) return BIOME.FORGE;
  if (Math.hypot(x - 220, y - 65) < 125) return BIOME.CRYPT;
  if (waterDepth(x, y) > -34) return BIOME.VALLEY;
  const i = macro(x, y);
  return mForest[i] > .57 ? BIOME.FOREST : BIOME.MEADOW;
}

/** Large-scale woodland density 0..1. Biome identity, not uniform hash noise,
 * decides whether a chunk is open meadow, dense pine forest or dead woodland. */
export function forestDensity(x: number, y: number): number {
  const n = vnoise(x / 42, y / 42, 20);
  switch (biomeAt(x, y)) {
    case BIOME.FOREST: return .68 + n * .3;
    case BIOME.SAKURA: return .38 + n * .25;
    case BIOME.CRYPT: return .3 + n * .25;
    case BIOME.VALLEY: return .22 + n * .22;
    case BIOME.WASTE: return .12 + n * .16;
    case BIOME.FORGE: return .16 + n * .18;
    case BIOME.TOWN: return .02 + n * .06;
    case BIOME.FARMLAND: return .04 + n * .1;
    default: return .08 + n * .2;
  }
}

let fieldCrop = 0;
function classify(x: number, y: number, n: number, depth: number): number {
  if (depth > 0) return GROUND.WATER;
  const rd = roadDistance(x, y);
  if (rd < (n - .5) * 1.4) return roadKind === 1 ? GROUND.COBBLE : GROUND.DIRT;
  if (depth > -7 && depth > -6 + (n - .5) * 4) return depth > -2.2 ? GROUND.BANK : GROUND.SAND;
  const rag = (n - .5) * 14;
  // Highmere plaza and lawns.
  if (x > 700 && x < 1100) {
    const tx = (x - 900) / 56, ty = (y - 235) / 34;
    if (tx * tx + ty * ty < 1 + (n - .5) * .08) return GROUND.COBBLE;
  }
  if (x > 600 && x < 900 && y > -175 && y < -15) {
    for (const f of FIELDS) if (x >= f[0] && x <= f[2] && y >= f[1] && y <= f[3]) { fieldCrop = f[4]; return GROUND.FARM; }
  }
  if (x > 610 && x < 790 && y > 250 && y < 410) { const dx = x - 700, dy = (y - 330) * 1.1; if (Math.sqrt(dx * dx + dy * dy) + rag < 76) return GROUND.MUD; }
  if (x < 20) { const dx = x + 60, dy = y - 222; if (Math.sqrt(dx * dx + dy * dy) + rag < 64) return GROUND.WARREN; }
  if (y > 540 && y < 730) {
    if (x > 60 && x < 240) { const dx = x - 150, dy = y - 640; if (Math.sqrt(dx * dx + dy * dy) + rag < 72) return GROUND.ASH; }
    else if (x > 440 && x < 600) { const dx = x - 520, dy = y - 620; if (Math.sqrt(dx * dx + dy * dy) + rag < 68) return GROUND.FLOWER; }
  }
  if (x > 750 && x < 1050 && y > 90 && y < 380) { const dx = (x - 900) * .8, dy = y - 235; if (Math.sqrt(dx * dx + dy * dy) + rag < 118) return GROUND.TOWN; }
  // Oakhollow's green and the smaller authored clearings stay unobstructed.
  if (Math.hypot(x - 760, y + 60) + rag < 104) return GROUND.CLEAR;
  if (x > 60 && x < 600 && y > -110 && y < 520) {
    const cx = (x - 485) * .85, cy = y - 235, fx = (x - 185) * .9, fy = (y - 380) * .8, ox = x - 222, oy = y - 239;
    const cdx = x - 220, cdy = y - 65;
    if (cx * cx + cy * cy < 3249 || fx * fx + fy * fy < 2500 || cdx * cdx + cdy * cdy < 1156 || ox * ox + oy * oy < 576) return GROUND.CLEAR;
    const mx = x - 430, my = (y - 20) * 1.1;
    if (mx * mx + my * my < 14400) return GROUND.MEADOW;
  }
  const biome = biomeAt(x, y);
  if (biome === BIOME.WASTE) return GROUND.ASH;
  if (biome === BIOME.FORGE) return GROUND.FORGE;
  if (biome === BIOME.CRYPT) return GROUND.CRYPT;
  if (biome === BIOME.FOREST) return GROUND.FOREST;
  if (biome === BIOME.SAKURA) return GROUND.FLOWER;
  const i = macro(x, y);
  if (biome === BIOME.MEADOW) return mFlower[i] + (n - .5) * .08 > .76 ? GROUND.FLOWER : GROUND.MEADOW;
  if (mForest[i] + (n - .5) * .1 > .63) return GROUND.FOREST;
  if (mFlower[i] + (n - .5) * .08 > .76) return GROUND.FLOWER;
  return GROUND.LUSH;
}

/** Ground class at a world position (same rules the terrain uses). */
export function groundAt(x: number, y: number, seed = 17): number {
  return classify(x, y, noise(x, y, seed), waterDepth(x, y));
}

// Row cache: wind trig once per row. Column cache: wind trig once per column.
let rowY = NaN, rowT = NaN, rowSin = 0, rowCos = 1;
const COLS = 4096;
const colTag = new Float64Array(COLS).fill(NaN), colSin = new Float32Array(COLS), colCos = new Float32Array(COLS);
const pick = (palette: readonly string[], light: number): string => palette[light <= 0 ? 0 : light >= .999 ? palette.length - 1 : Math.floor(light * palette.length)];

export function landscapeCell(x: number, y: number, time: number, seed: number): AsciiCell | null {
  if (y !== rowY || time !== rowT) {
    rowY = y; rowT = time;
    const phase = y * .07 - time * .7; rowSin = Math.sin(phase); rowCos = Math.cos(phase);
  }
  const depth = waterDepth(x, y);
  const n = noise(x, y, seed);
  const kind = classify(x, y, n, depth);
  switch (kind) {
    case GROUND.WATER: {
      const current = Math.sin(x * .53 + Math.sin(y * .063) * 2.8 - time * .35);
      if (n < .54) return null;
      const foam = depth < 4 && current > .72 && n > .86;
      const light = depth > 24 ? 0 : depth > 10 ? 1 : 2;
      return { x, y, glyph: foam ? ['o', '°', '*', ':'][Math.floor(n * 4) % 4] : n > .91 ? ',' : '.', color: WATER[foam ? 5 : current > .8 ? Math.min(4, light + 2) : light] };
    }
    case GROUND.BANK: return { x, y, glyph: n > .88 ? 'o' : n > .68 ? ',' : n > .52 ? "'" : ' ', color: n > .5 ? '#35463b' : '#263a34' };
    case GROUND.SAND: return { x, y, glyph: n < .5 ? ' ' : n > .93 ? 'o' : n > .76 ? ',' : '.', color: pick(SAND, n * .45 + (depth + 7) * .06) };
    case GROUND.DIRT: {
      const rut = Math.abs(roadAcross - 1.5) < .55;
      return { x, y, glyph: rut ? ':' : n < .56 ? ' ' : n > .95 ? 'o' : n > .82 ? ',' : '.', color: pick(DIRT, rut ? .05 : n * .55 + .2) };
    }
    case GROUND.COBBLE: {
      const bx = Math.floor(x / 4 + (Math.floor(y / 3) & 1) * .5), by = Math.floor(y / 3);
      const joint = (((x + ((by & 1) * 2)) % 4 + 4) % 4 === 0) || ((y % 3 + 3) % 3 === 0);
      if (joint) return { x, y, glyph: n > .6 ? '.' : ' ', color: COBBLE[0] };
      const b = noise(bx, by, seed + 3);
      return { x, y, glyph: b > .75 ? 'O' : b > .5 ? '0' : b > .25 ? 'o' : '=', color: pick(COBBLE, .25 + b * .6 + n * .1) };
    }
    case GROUND.FARM: {
      const row = Math.floor(y / 3);
      if (row & 1) return { x, y, glyph: n > .82 ? '.' : ' ', color: FURROW[Math.floor(n * 3) % 3] };
      if (fieldCrop === 0) return { x, y, glyph: n > .7 ? '!' : n > .34 ? '|' : "'", color: pick(WHEAT, .3 + n * .7) };
      return { x, y, glyph: n > .74 ? 'O' : n > .42 ? 'o' : ' ', color: pick(CABBAGE, .15 + n * .85) };
    }
    case GROUND.MUD: {
      const m = tint(x, y, seed + 5);
      if (m > .82) return { x, y, glyph: n > .6 ? ':' : ' ', color: n > .6 ? '#53636a' : '#35434a' };
      return { x, y, glyph: n < .58 ? ' ' : n > .94 ? 'o' : n > .8 ? ',' : '.', color: pick(MUD, m * .8 + n * .2) };
    }
    case GROUND.WARREN: {
      const m = tint(x, y, seed + 5);
      return { x, y, glyph: n < .5 ? ' ' : n > .92 ? '"' : n > .72 ? ',' : "'", color: pick(WARREN, m * .7 + n * .3) };
    }
    case GROUND.ASH: {
      const m = tint(x, y, seed + 5);
      const ember = n > .988;
      return { x, y, glyph: ember ? '*' : n < .58 ? ' ' : n > .86 ? '|' : n > .72 ? ':' : ',', color: ember ? '#e0733a' : pick(ASH, m * .75 + n * .25) };
    }
    case GROUND.FOREST: {
      const m = tint(x, y, seed + 5);
      return { x, y, glyph: n < .56 ? ' ' : n > .93 ? '`' : n > .84 ? '/' : n > .76 ? '\\' : ',', color: pick(FOREST, m * .75 + n * .25) };
    }
    case GROUND.FLOWER: {
      const c = noise(Math.floor(x / 3), Math.floor(y / 3), seed + 7);
      const m = tint(x, y, seed + 5);
      if (biomeAt(x, y) === BIOME.SAKURA) {
        if (n > .44 && c > .18) return { x, y, glyph: n > .9 ? '*' : n > .72 ? '.' : ',', color: PETALS[Math.floor(c * 6) % 6] };
        return { x, y, glyph: n < .35 ? ' ' : "'", color: pick(VALLEY, .2 + m * .45) };
      }
      if (n > .54 && c > .12) return { x, y, glyph: n > .9 ? '*' : n > .76 ? 'o' : ':', color: BLOOMS[Math.floor(c * 6) % 6] };
      return { x, y, glyph: n < .42 ? ' ' : "'", color: pick(LUSH, .25 + m * .5) };
    }
    case GROUND.TOWN: {
      const m = tint(x, y, seed + 5);
      return { x, y, glyph: n < .64 ? ' ' : n > .93 ? '"' : "'", color: pick(TOWNGRASS, m * .7 + n * .3) };
    }
    case GROUND.CLEAR: {
      const crypt = Math.hypot(x - 220, y - 65) < 115, forge = Math.hypot(x - 185, y - 380) < 125;
      return { x, y, glyph: n < .4 ? ' ' : n > .97 ? 'o' : n > .86 ? ',' : '.', color: crypt ? '#526071' : forge ? '#7c664b' : '#5c5c47' };
    }
    default: {
      const biome = biomeAt(x, y);
      const palette = kind === GROUND.MEADOW ? MEADOW : kind === GROUND.FORGE ? AUTUMN : kind === GROUND.CRYPT ? CRYPT : biome === BIOME.VALLEY ? VALLEY : LUSH;
      const m = tint(x, y, seed + 5);
      const light = n * .28 + m * .62 + .06;
      let glyph: string;
      let color = pick(palette, light);
      if (n < .36 || (m < .22 && n < .72)) glyph = ' ';
      else if (kind === GROUND.MEADOW && n > .95) { glyph = ['*', '+', ':'][Math.floor(n * 70) % 3]; color = ['#a4a0df', '#d99abb', '#dfc488'][Math.floor(n * 99) % 3]; }
      else if (n < .53) glyph = "'";
      else {
        const i = (x & (COLS - 1));
        if (colTag[i] !== x) { colTag[i] = x; colSin[i] = Math.sin(x * .055); colCos[i] = Math.cos(x * .055); }
        const wind = colSin[i] * rowCos + colCos[i] * rowSin;
        glyph = wind > .3 ? '/' : wind < -.3 ? '\\' : '|';
      }
      return { x, y, glyph, color };
    }
  }
}
