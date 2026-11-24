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

export function landscapeCell(x: number, y: number, time: number, seed: number): AsciiCell | null {
  const n = noise(x, y, seed);
  const depth = waterDepth(x, y);
  if (depth > 0) {
    const flow = Math.sin(x * .2 + y * .17 - time * 1.7) * .45 + Math.sin(y * .3 - time * 2.3 + Math.sin(x * .12)) * .35;
    const streak = Math.sin(x * .7 + Math.sin(y * .1 - time) * 1.7);
    const light = (flow + 1) * .5;
    if (n < .24 && light < .7) return null;
    const foam = streak > .9 && flow > .32 && n > .76;
    return { x, y, glyph: foam ? ['o', '°', '*', ':'][Math.floor(n * 4) % 4] : light > .65 && n > .55 ? '-' : n > .8 ? ',' : '.', color: WATER[foam ? 5 : Math.max(0, Math.min(3, Math.floor(light * 4)))] };
  }
  // Undercut banks: a genuinely dark side between water and the upper meadow.
  if (depth > -7) {
    if (n < .38) return null;
    return { x, y, glyph: n > .8 ? '/' : '|', color: depth > -3 ? '#18272b' : '#243d35' };
  }
  const cluster = noise(Math.floor(x / 7), Math.floor(y / 5), seed);
  if (n < .17 + cluster * .13) return null;
  const wind = Math.sin(x * .055 + y * .07 - time * 1.6) + Math.sin(y * .025 + x * .09 + time * .6) * .4;
  const glyph = n > .987 ? '*' : n < .32 ? ',' : wind > .3 ? '/' : wind < -.3 ? '\\' : '|';
  const light = n * .36 + cluster * .2 + Math.sin(x * .018 + y * .008) * .18 + .22;
  const shade = Math.max(0, Math.min(GRASS.length - 1, Math.floor(light * GRASS.length)));
  return { x, y, glyph, color: n > .987 ? '#938d64' : GRASS[shade] };
}
