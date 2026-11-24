import { noise, type AsciiCell } from './types.ts';

/** Reusable continuous terrain generator. Samples are world-anchored, so camera
 * movement and chunk boundaries cannot reseed the meadow or river banks. */
export function riverCenter(y: number): number {
  return 330 + Math.sin(y * .016) * 42 + Math.sin(y * .037) * 13;
}
export function riverWidth(y: number): number { return 39 + Math.sin(y * .022) * 7; }
export function waterDepth(x: number, y: number): number { return riverWidth(y) - Math.abs(x - riverCenter(y)); }

const GRASS = ['#182a28', '#213c33', '#2c4c3d', '#3d6350', '#557b60', '#779176'];
const MEADOW = ['#294c45', '#3d7258', '#559363', '#7cb67a', '#b1ca8a', '#d2d6a0'];
const AUTUMN = ['#433d32', '#68523b', '#896b43', '#b28c54', '#c6a76e', '#d7c098'];
const CRYPT = ['#252e41', '#37465c', '#4d6374', '#738798', '#9babc0', '#b6c1d1'];
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
  const meadow = Math.hypot(x - 430, (y - 20) * 1.1) < 120;
  const forge = Math.hypot(x - 185, y - 380) < 125;
  const crypt = Math.hypot(x - 220, y - 65) < 115;
  const camp = Math.hypot((x - 485) * .85, y - 235);
  const clearing = camp < 57 || Math.hypot((x - 185) * .9, (y - 380) * .8) < 50 || Math.hypot(x - 220, y - 65) < 34 || Math.hypot(x - 222, y - 239) < 24;
  const path = Math.abs(x - (190 + Math.sin(y * .025) * 20)) < 5 || (Math.abs(y - (250 + Math.sin(x * .025) * 7)) < 4 && x > 380 && x < 560);
  if (clearing || path) return n < .28 ? null : { x, y, glyph: n > .96 ? 'o' : n > .82 ? ',' : '.', color: crypt ? '#526071' : forge ? '#7c664b' : '#5c5c47' };
  const patch = Math.sin(x * .038 + Math.sin(y * .024) * 2) * .5 + Math.cos(y * .048 + x * .013) * .35;
  if (n < .36 + Math.max(0, -patch) * .3) return n > .18 ? null : { x, y, glyph: '.', color: '#2b3834' };
  const wind = Math.sin(x * .055 + y * .07 - time * .7) + Math.sin(y * .025 + x * .09) * .4;
  const flower = meadow && n > .94;
  const glyph = flower ? ['*', '+', ':'][Math.floor(n * 70) % 3] : n < .5 ? "'" : wind > .25 ? '/' : wind < -.25 ? '\\' : '|';
  const light = n * .35 + cluster * .16 + patch * .16 + .23;
  const palette = meadow ? MEADOW : forge ? AUTUMN : crypt ? CRYPT : GRASS;
  const shade = Math.max(0, Math.min(palette.length - 1, Math.floor(light * palette.length)));
  return { x, y, glyph, color: flower ? ['#a4a0df', '#d99abb', '#dfc488'][Math.floor(n * 99) % 3] : palette[shade] };
}
