import type { WorldProp } from './worldChunks.ts';
import { riverCenter, riverWidth } from '../assets/landscape.ts';

/** Region/placement data only. Rendering and character definitions stay separate. */
export const LANDMARKS = [
  { key: 'Digit1', id: 'meadow', name: 'Prism Meadow', x: 450, y: 20, spawnX: 474, spawnY: 65 },
  { key: 'Digit2', id: 'camp', name: 'Willow Encampment', x: 485, y: 235, spawnX: 440, spawnY: 255 },
  { key: 'Digit3', id: 'crypt', name: 'Moonveil Crypt', x: 220, y: 65, spawnX: 200, spawnY: 112 },
  { key: 'Digit4', id: 'forge', name: 'Dwarven Forge', x: 185, y: 380, spawnX: 175, spawnY: 415 },
] as const;

const prop = (id: string, assetId: string, x: number, y: number, scale: number, variant = 0, faction: WorldProp['faction'] = 'ambient'): WorldProp => ({ id, assetId, x, y, scale, variant, seed: id.length * 73, faction });

export const LANDMARK_PROPS: readonly WorldProp[] = [
  prop('river-watchtower', 'ruined-tower', 222, 239, .65),
  prop('camp-cat-girl', 'cat-girl', 476, 235, .25, 0, 'friendly'),
  prop('camp-cat-boy', 'cat-boy', 520, 257, .275, 0, 'friendly'),
  prop('camp-tent', 'tent', 511, 208, .8),
  prop('camp-lantern', 'lantern', 447, 222, .45),
  prop('camp-moth-1', 'moth', 443, 211, .13),
  prop('camp-moth-2', 'moth', 451, 215, .12, 1),
  prop('camp-armor', 'knight', 553, 240, .35, 1, 'friendly'),
  prop('crypt-gate', 'crypt-arch', 225, 42, .85),
  prop('crypt-vampire-girl', 'vampire-girl', 200, 69, .24, 0, 'hostile'),
  prop('crypt-vampire-boy', 'vampire-boy', 249, 82, .31, 0, 'hostile'),
  ...[0, 1, 2, 3].map(i => prop(`grave-${i}`, 'gravestone', 161 + i * 30, 102 + i % 2 * 9, .34)),
  ...[0, 1, 2, 3].map(i => prop(`crypt-bat-${i}`, 'bat', 180 + i * 24, 24 + i % 2 * 16, .25)),
  prop('forge-guardian', 'dwarf-guardian', 157, 382, .34, 0, 'friendly'),
  prop('forge-sentinel', 'dwarf-neutral', 204, 388, .33, 0, 'friendly'),
  prop('forge-anvil', 'anvil', 185, 365, .6),
  prop('forge-tent', 'tent', 141, 352, .7, 1),
  prop('forge-light', 'lantern', 218, 362, .48),
  prop('forge-bronze-armor', 'knight', 253, 358, .35, 2, 'friendly'),
  ...['sword-long', 'sword-great', 'sword-rapier', 'sword-dagger', 'sword-sabre'].map((id, i) => prop(`forge-${id}`, id, 227 + i * 15, 419, .45, i % 2)),
  ...['butterfly-blue', 'butterfly-pink', 'butterfly-purple', 'butterfly-blue', 'butterfly-pink', 'butterfly-purple'].map((id, i) => prop(`meadow-${id}-${i}`, id, 385 + i * 18, 12 + i % 3 * 17, .2)),
  ...[0, 1, 2].map(i => prop(`meadow-bird-${i}`, 'bird', 398 + i * 35, -25 + i * 9, .25, i % 2)),
  prop('meadow-lantern', 'lantern', 466, 49, .4, 1),
  ...Array.from({ length: 16 }, (_, i) => {
    const y = -15 + (i * 23) % 90;
    const x = Math.max(390 + (i * 37) % 115, riverCenter(y) + riverWidth(y) + 12);
    return prop(`meadow-flower-${i}`, ['flowers-blue', 'flowers-pink', 'flowers-purple', 'flowers-gold'][i % 4], x, y, .35 + (i % 3) * .04);
  }),
  prop('camp-wildflowers', 'flowers-pink', 447, 268, .5),
  prop('forge-goldflowers', 'flowers-gold', 213, 430, .45),
];

export function regionAt(x: number, y: number): string {
  const region = LANDMARKS.find(region => Math.hypot(x - region.x, y - region.y) < 108);
  return region?.name ?? 'Ashen Valley';
}
