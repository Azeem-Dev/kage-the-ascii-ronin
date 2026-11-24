/** Townsfolk and carts that travel back and forth along the streets.
 * Positions are a pure function of time, so they are deterministic and cost
 * nothing to simulate. Paths follow the road centrelines in landscape.ts. */

export interface Mover {
  id: string;
  kind: 'walker' | 'cart';
  assetId: string;
  /** Polyline as x,y pairs in world units. */
  path: readonly number[];
  speed: number;
  scale: number;
  variant: number;
  /** Start offset along the route (0..1) so movers sharing a street spread out. */
  offset: number;
  /** Seconds idling at each end (shopping, chatting, unloading). */
  pause: number;
  /** Cart driver's asset id. */
  driver?: string;
}

export interface MoverState { x: number; y: number; dirX: number; dirY: number; facing: 'left' | 'right'; moving: boolean }

const lengths = new WeakMap<Mover, number[]>();
function segmentLengths(m: Mover): number[] {
  let list = lengths.get(m);
  if (!list) {
    list = [];
    for (let i = 0; i + 3 < m.path.length; i += 2) list.push(Math.hypot(m.path[i + 2] - m.path[i], m.path[i + 3] - m.path[i + 1]));
    lengths.set(m, list);
  }
  return list;
}

export function moverAt(m: Mover, time: number): MoverState {
  const PAUSE = m.pause;
  const segs = segmentLengths(m);
  const total = segs.reduce((a, b) => a + b, 0);
  const leg = total / m.speed;
  const cycle = 2 * (leg + PAUSE);
  const t = ((time + m.offset * cycle) % cycle + cycle) % cycle;
  let s: number; let forward: boolean; let moving = true;
  if (t < leg) { s = t * m.speed; forward = true; }
  else if (t < leg + PAUSE) { s = total; forward = true; moving = false; }
  else if (t < 2 * leg + PAUSE) { s = total - (t - leg - PAUSE) * m.speed; forward = false; }
  else { s = 0; forward = false; moving = false; }
  let i = 0;
  while (i < segs.length - 1 && s > segs[i]) { s -= segs[i]; i++; }
  const u = segs[i] ? Math.min(1, s / segs[i]) : 0;
  const x1 = m.path[i * 2], y1 = m.path[i * 2 + 1], x2 = m.path[i * 2 + 2], y2 = m.path[i * 2 + 3];
  const sdx = (x2 - x1) * (forward ? 1 : -1);
  const sdy = (y2 - y1) * (forward ? 1 : -1);
  const len = Math.hypot(sdx, sdy) || 1;
  const dirX = sdx / len; const dirY = sdy / len;
  // Screen-horizontal direction determines left/right sprite facing in iso (screenX = wx - wy).
  const screenDX = dirX - dirY;
  const facing = screenDX > .01 ? 'right' : screenDX < -.01 ? 'left' : forward ? 'right' : 'left';
  return { x: x1 + (x2 - x1) * u, y: y1 + (y2 - y1) * u, dirX, dirY, facing, moving };
}

/** Asset heights so every species ends up a believable person height (≈50 units, dwarves ≈36). */
const HEIGHT: Readonly<Record<string, number>> = {
  peasant: 140, farmer: 140, merchant: 140, noble: 140, guard: 140, beggar: 140,
  'cat-girl': 161, 'cat-boy': 146, elf: 150, 'dwarf-townsfolk': 106, 'dwarf-neutral': 91,
};
const walker = (id: string, assetId: string, path: number[], speed: number, variant: number, offset: number, pause: number): Mover =>
  ({ id, kind: 'walker', assetId, path, speed, variant, offset, pause,
    scale: (assetId.startsWith('dwarf') ? 36 : 50) / (HEIGHT[assetId] ?? 140) });
const cart = (id: string, path: number[], speed: number, offset: number, driver: string): Mover =>
  ({ id, kind: 'cart', assetId: 'cart', path, speed, scale: .42, variant: 0, offset, pause: 12, driver });

import { townPoint } from './landmarks.ts';
const town = (m: Mover): Mover => ({ ...m, path: m.path.flatMap((v, i) => i % 2 ? [] : townPoint(v, m.path[i + 1])) });
const TOWN_IDS = /^hm-/;

const AUTHORED: readonly Mover[] = [
  // Highmere: High Street (y=235), the avenue (x=900), the bazaar aisle and Market Row (y=350).
  // Each walker has an errand: from a doorstep to a stall or gate, a long stop, then home.
  // Few of them, different peoples, so each one reads as a person rather than noise.
  // Highmere is a human town: different trades and clothing variants give the variety.
  walker('hm-shopper', 'peasant', [790, 240, 840, 240, 840, 300], 7, 1, 0, 14),         // house n1 -> west stall
  walker('hm-lady', 'noble', [1010, 240, 1010, 300], 6, 2, .5, 18),                      // house n2 -> east stall
  walker('hm-patrol', 'guard', [780, 246, 1070, 246], 5, 0, .25, 6),                      // guard walks the street
  walker('hm-drinker', 'farmer', [940, 345, 940, 360, 1040, 360], 6, 2, .7, 16),         // tavern door -> house s1
  cart('hm-cart', [770, 238, 960, 238], 9, .2, 'merchant'),                               // delivery to the bazaar
  // Oakhollow: a farmer to the well and back; a cart down to the trade road.
  walker('oh-farmer', 'farmer', [740, -54, 700, -40], 5, 0, 0, 20),
  cart('oh-cart', [745, 0, 715, 50, 670, 120, 640, 200, 620, 268], 9, .6, 'farmer'),
  // Mudgate: one beggar shuffling between the fire and the lane.
  walker('mg-beggar', 'beggar', [700, 389, 735, 345], 3, 1, .1, 25),
];
/** Highmere paths are authored at the compact size and spread like its buildings. */
export const MOVERS: readonly Mover[] = AUTHORED.map(m => TOWN_IDS.test(m.id) ? town(m) : m);
