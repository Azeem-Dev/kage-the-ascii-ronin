import { noise, type AsciiCell } from './types.ts';

/** Reusable continuous terrain generator. Samples are world-anchored, so camera
 * movement and chunk boundaries cannot reseed the meadow or river banks. */
export function riverCenter(y: number): number {
  return 330 + Math.sin(y * .016) * 42 + Math.sin(y * .037) * 13;
}
export function riverWidth(y: number): number { return 39 + Math.sin(y * .022) * 7; }
export function waterDepth(x: number, y: number): number { return riverWidth(y) - Math.abs(x - riverCenter(y)); }

const GRASS = ['#182a28', '#213c33', '#2c4c3d', '#3d6350', '#557b60', '#779176'];
const WATER = ['#101d27', '#1b303c', '#2d4854', '#456470', '#6e8990', '#b2c3bd'];

interface Tile { n: number; depth: number; cluster: number }
const tileRows = new Map<string, Map<number, Tile>>();
let lastRow: Map<number, Tile> | undefined;
let lastY = NaN;
let lastSeed = NaN;
let tileCount = 0;

export function landscapeCell(x: number, y: number, time: number, seed: number): AsciiCell | null {
  if (y !== lastY || seed !== lastSeed || !lastRow) {
    const key = `${y},${seed}`;
    lastRow = tileRows.get(key);
    if (!lastRow) { lastRow = new Map(); tileRows.set(key, lastRow); }
    lastY = y; lastSeed = seed;
  }
  let tile = lastRow.get(x);
  if (!tile) {
    // Bounded cache for the demonstration. A chunk-owned cache replaces this
    // when streaming is introduced; eviction never changes deterministic data.
    if (tileCount >= 100000) { tileRows.clear(); tileCount = 0; tileRows.set(`${y},${seed}`, lastRow); }
    tile = { n: noise(x, y, seed), depth: waterDepth(x, y), cluster: noise(Math.floor(x / 7), Math.floor(y / 5), seed) };
    lastRow.set(x, tile); tileCount++;
  }
  const { n, depth, cluster } = tile;
  if (depth > 0) {
    const current = Math.sin(x * .53 + Math.sin(y * .063) * 2.8);
    if (n < .52) return null;
    const foam = current > .92 && n > .91;
    // Reference target: black depth with narrow, winding silver current traces,
    // not evenly illuminated horizontal wave stripes.
    return { x, y, glyph: foam ? ['o', '°', '*', ':'][Math.floor(n * 4) % 4] : n > .89 ? ',' : '.', color: WATER[foam ? 5 : current > .8 ? 2 : n > .8 ? 1 : 0] };
  }
  // Undercut banks: a genuinely dark side between water and the upper meadow.
  if (depth > -7) {
    if (n < .38) return null;
    return { x, y, glyph: n > .8 ? '/' : '|', color: depth > -3 ? '#18272b' : '#243d35' };
  }
  if (n < .17 + cluster * .13) return null;
  const wind = Math.sin(x * .055 + y * .07 - time * 1.6) + Math.sin(y * .025 + x * .09 + time * .6) * .4;
  const glyph = n > .987 ? '*' : n < .32 ? ',' : wind > .3 ? '/' : wind < -.3 ? '\\' : '|';
  const light = n * .36 + cluster * .2 + Math.sin(x * .018 + y * .008) * .18 + .22;
  const shade = Math.max(0, Math.min(GRASS.length - 1, Math.floor(light * GRASS.length)));
  return { x, y, glyph, color: n > .987 ? '#938d64' : GRASS[shade] };
}
