import type { WorldProp } from './worldChunks.ts';
import { GROUND, riverCenter, riverWidth, roadDistance, waterDepth, groundAt } from '../assets/landscape.ts';
import { noise } from '../assets/types.ts';

/** Region/placement data only. Rendering and character definitions stay separate. */
export const LANDMARKS = [
  { key: 'Digit1', id: 'meadow', name: 'Prism Meadow', x: 450, y: 20, spawnX: 474, spawnY: 65 },
  { key: 'Digit2', id: 'camp', name: 'Willow Encampment', x: 485, y: 235, spawnX: 440, spawnY: 255 },
  { key: 'Digit3', id: 'crypt', name: 'Moonveil Crypt', x: 220, y: 65, spawnX: 200, spawnY: 112 },
  { key: 'Digit4', id: 'forge', name: 'Dwarven Forge', x: 185, y: 380, spawnX: 168, spawnY: 400 },
  { key: 'Digit5', id: 'town', name: 'Highmere', x: 900, y: 235, spawnX: 850, spawnY: 262 },
  { key: 'Digit6', id: 'outskirts', name: 'Mudgate', x: 700, y: 330, spawnX: 724, spawnY: 310 },
  { key: 'Digit7', id: 'village', name: 'Oakhollow', x: 760, y: -60, spawnX: 770, spawnY: -22 },
  { key: 'Digit8', id: 'goblins', name: 'Goblin Warren', x: -60, y: 222, spawnX: -15, spawnY: 238 },
  { key: 'Digit9', id: 'orcs', name: 'Orc Warband', x: 150, y: 640, spawnX: 205, spawnY: 625 },
  { key: 'Digit0', id: 'elves', name: 'Silverleaf Grove', x: 520, y: 620, spawnX: 560, spawnY: 648 },
] as const;

const prop = (id: string, assetId: string, x: number, y: number, scale: number, variant = 0, faction: WorldProp['faction'] = 'ambient'): WorldProp => ({ id, assetId, x, y, scale, variant, seed: id.length * 73, faction });

const BASE_PROPS: readonly WorldProp[] = [
  prop('river-watchtower', 'ruined-tower', 215, 225, .65),
  prop('camp-cat-girl', 'cat-girl', 476, 235, .25, 0, 'friendly'),
  prop('camp-cat-boy', 'cat-boy', 520, 257, .275, 0, 'friendly'),
  prop('camp-tent', 'tent', 535, 205, .8),
  prop('camp-lantern', 'lantern', 447, 222, .45),
  prop('camp-moth-1', 'moth', 443, 211, .13),
  prop('camp-moth-2', 'moth', 451, 215, .12, 1),
  prop('camp-armor', 'knight', 553, 240, .35, 1, 'friendly'),
  prop('crypt-gate', 'crypt-arch', 225, 42, .85),
  prop('crypt-vampire-girl', 'vampire-girl', 200, 69, .24, 0, 'hostile'),
  prop('crypt-vampire-boy', 'vampire-boy', 249, 82, .31, 0, 'hostile'),
  ...[0, 1, 2, 3].map(i => prop(`grave-${i}`, 'gravestone', 161 + i * 30, 88 + i % 2 * 9, .34)),
  ...[0, 1, 2, 3].map(i => prop(`crypt-bat-${i}`, 'bat', 180 + i * 24, 24 + i % 2 * 16, .25)),
  prop('forge-guardian', 'dwarf-guardian', 157, 382, .34, 0, 'friendly'),
  prop('forge-sentinel', 'dwarf-neutral', 204, 388, .33, 0, 'friendly'),
  prop('forge-anvil', 'anvil', 170, 365, .6),
  prop('forge-tent', 'tent', 141, 352, .7, 1),
  prop('forge-light', 'lantern', 218, 362, .48),
  prop('forge-bronze-armor', 'knight', 208, 350, .35, 2, 'friendly'),
  // Sword display sits west of the widened river and north of the Ashfork.
  ...['sword-long', 'sword-great', 'sword-rapier', 'sword-dagger', 'sword-sabre'].map((id, i) => prop(`forge-${id}`, id, 115 + i * 13, 405, .45, i % 2)),
  ...['butterfly-blue', 'butterfly-pink', 'butterfly-purple', 'butterfly-blue', 'butterfly-pink', 'butterfly-purple'].map((id, i) => {
    const y = 12 + i % 3 * 17;
    const x = Math.max(385 + i * 18, riverCenter(y) + riverWidth(y) + 12);
    return prop(`meadow-${id}-${i}`, id, x, y, .2);
  }),
  ...[0, 1, 2].map(i => prop(`meadow-bird-${i}`, 'bird', 398 + i * 35, -25 + i * 9, .25, i % 2)),
  prop('meadow-lantern', 'lantern', 466, 49, .4, 1),
  ...Array.from({ length: 16 }, (_, i) => {
    const y = -15 + (i * 23) % 90;
    const x = Math.max(390 + (i * 37) % 115, riverCenter(y) + riverWidth(y) + 12);
    return prop(`meadow-flower-${i}`, ['flowers-blue', 'flowers-pink', 'flowers-purple', 'flowers-gold'][i % 4], x, y, .35 + (i % 3) * .04);
  }),
  prop('camp-wildflowers', 'flowers-pink', 447, 268, .5),
  prop('forge-goldflowers', 'flowers-gold', 213, 405, .45),
];

const plant = (id: string, assetId: string, x: number, y: number, scale: number, variant = 0): WorldProp => ({
  id, assetId, x, y, scale, variant, seed: Math.floor(noise(x, y, 71) * 99999), faction: 'ambient',
});

const GROVE_CLEARANCE: Readonly<Record<string, number>> = {
  meadow: 72, camp: 108, crypt: 112, forge: 112, town: 172, outskirts: 132,
  village: 150, goblins: 104, orcs: 108, elves: 94,
};
const PLANTABLE_GROUND = new Set<number>([GROUND.LUSH, GROUND.FOREST, GROUND.FLOWER, GROUND.MEADOW, GROUND.ASH, GROUND.FORGE, GROUND.CRYPT, GROUND.SAND, GROUND.BANK]);
const canPlant = (x: number, y: number): boolean => {
  // Keep the full mounted lane usable, not merely the road's painted centre.
  if (waterDepth(x, y) > -13 || roadDistance(x, y) < 14) return false;
  if (LANDMARKS.some(region => Math.hypot(x - region.x, y - region.y) < GROVE_CLEARANCE[region.id])) return false;
  return PLANTABLE_GROUND.has(groundAt(x, y));
};

/** Reeds may grow in shallow water, but never in a hero/horse arrival bubble. */
const clearOfArrival = (x: number, y: number): boolean => !LANDMARKS.some(region =>
  Math.hypot(x - region.spawnX, y - region.spawnY) < 14 ||
  Math.hypot(x - region.spawnX - 27, y - region.spawnY - 16) < 14);

/** Authored groves do the visual work near the playable regions. Each is a
 * seeded irregular cluster, never an even ring or a uniform scatter. */
const grove = (id: string, x: number, y: number, rx: number, ry: number, count: number,
  species: readonly string[], scale: number, seed: number): WorldProp[] => {
  const result: WorldProp[] = [];
  for (let i = 0; i < count; i++) {
    const angle = noise(i, seed, 911) * Math.PI * 2;
    const radius = Math.sqrt(noise(i, seed, 912));
    const px = x + Math.cos(angle) * rx * radius;
    const py = y + Math.sin(angle) * ry * radius;
    if (!canPlant(px, py)) continue;
    const assetId = species[Math.floor(noise(i, seed, 913) * species.length) % species.length];
    result.push(plant(`${id}-${i}`, assetId, px, py, scale * (.9 + noise(i, seed, 914) * .18), (seed + i) % 2));
  }
  return result;
};

const GROVE_PROPS: readonly WorldProp[] = [
  // River valley: broad willow canopies, silver birch and reedy clearings.
  ...grove('valley-willow-n', 245, 70, 38, 58, 10, ['willow', 'willow', 'birch'], .58, 101),
  ...grove('valley-willow-camp', 470, 325, 34, 55, 9, ['willow', 'birch', 'oak'], .56, 102),
  ...grove('valley-willow-s', 240, 485, 42, 38, 9, ['willow', 'birch'], .55, 103),
  ...grove('valley-willow-elf', 465, 535, 30, 42, 7, ['willow', 'birch'], .54, 104),
  // Open meadow: separated oak clumps with light between them.
  ...grove('meadow-oak-w', 405, 5, 40, 35, 8, ['oak', 'oak', 'birch'], .56, 111),
  ...grove('meadow-oak-n', 565, -5, 38, 32, 7, ['oak', 'birch'], .54, 112),
  ...grove('meadow-oak-lake', 405, 145, 35, 40, 7, ['oak', 'oak', 'birch'], .55, 113),
  ...grove('meadow-oak-east', 620, 170, 38, 35, 8, ['oak', 'birch'], .55, 114),
  // Dense dark forest, deliberately distinct from the open start.
  ...grove('forest-goblin-n', -30, -70, 105, 105, 36, ['pine', 'pine', 'cypress'], .6, 121),
  ...grove('forest-crypt-w', 20, 60, 55, 60, 18, ['pine', 'cypress', 'pine'], .59, 122),
  ...grove('forest-town-ne', 1045, -15, 90, 85, 28, ['pine', 'cypress', 'pine'], .6, 123),
  // Sakura ring around Silverleaf, outside the lamp circle and central clearing.
  ...grove('sakura-sw', 425, 550, 34, 38, 9, ['cherry', 'cherry', 'willow'], .55, 131),
  ...grove('sakura-se', 615, 570, 34, 38, 9, ['cherry', 'cherry', 'birch'], .54, 132),
  ...grove('sakura-s', 565, 715, 36, 32, 9, ['cherry', 'cherry', 'willow'], .55, 133),
  ...grove('sakura-w', 410, 665, 32, 36, 8, ['cherry', 'birch'], .54, 134),
  // Oakhollow: a few shade trees and low hedges, not a forest around the fields.
  ...grove('farm-oak-sw', 610, -155, 30, 25, 4, ['oak', 'oak', 'bush'], .5, 141),
  ...grove('farm-oak-ne', 925, -145, 35, 30, 5, ['oak', 'oak', 'birch'], .51, 142),
  ...grove('farm-oak-east', 920, -5, 35, 25, 4, ['oak', 'oak', 'bush'], .5, 143),
  ...grove('farm-oak-west', 600, 45, 25, 30, 3, ['oak', 'birch', 'bush'], .49, 144),
  // Burnt/dead land around the orcs and Mudgate.
  ...grove('dead-orc-s', 65, 715, 45, 30, 10, ['dead-tree', 'dead-tree', 'rock'], .54, 151),
  ...grove('dead-orc-se', 245, 715, 40, 35, 10, ['dead-tree', 'dead-tree', 'cypress'], .55, 152),
  ...grove('dead-orc-w', 50, 560, 35, 30, 8, ['dead-tree', 'dead-tree'], .52, 153),
  ...grove('dead-orc-e', 265, 565, 30, 35, 8, ['dead-tree', 'dead-tree'], .54, 154),
  ...grove('dead-mud-sw', 580, 230, 30, 25, 6, ['dead-tree', 'dead-tree', 'bush'], .5, 155),
  ...grove('dead-mud-se', 820, 415, 35, 25, 7, ['dead-tree', 'dead-tree', 'bush'], .52, 156),
  ...grove('dead-forge-w', 90, 295, 30, 35, 7, ['dead-tree', 'cypress'], .53, 157),
];

const REED_PROPS: readonly WorldProp[] = [
  ...Array.from({ length: 58 }, (_, i) => {
    const y = -175 + i * 17;
    const side = noise(i, 2, 301) > .5 ? 1 : -1;
    const x = riverCenter(y) + side * (riverWidth(y) - 1 - noise(i, 3, 302) * 4);
    return plant(`reed-river-${i}`, 'reeds', x, y, .3 + noise(i, 4, 303) * .12, i % 3);
  }).filter(p => roadDistance(p.x, p.y) > 5 && clearOfArrival(p.x, p.y)),
  ...Array.from({ length: 28 }, (_, i) => {
    const angle = i / 28 * Math.PI * 2 + noise(i, 5, 304) * .12;
    const radius = .94 + noise(i, 6, 305) * .1;
    return plant(`reed-lake-${i}`, 'reeds', 575 + Math.cos(angle) * 82 * radius, 98 + Math.sin(angle) * 52 * radius, .3 + noise(i, 7, 306) * .1, i % 3);
  }).filter(p => clearOfArrival(p.x, p.y)),
  ...Array.from({ length: 20 }, (_, i) => {
    const x = -100 + i * 23;
    const centre = 416 + (x + 120) * .035 + Math.sin((x + 120) * .025) * 3;
    const side = i % 2 ? 1 : -1;
    return plant(`reed-ashfork-${i}`, 'reeds', x, centre + side * (8 + i / 20 * 7), .3 + noise(i, 8, 307) * .1, i % 3);
  }).filter(p => roadDistance(p.x, p.y) > 5 && clearOfArrival(p.x, p.y)),
];

const ROAD_MARKER_PROPS: readonly WorldProp[] = [
  prop('road-marker-camp', 'banner', 548, 242, .42, 1),
  prop('road-lamp-camp', 'lamp-post', 535, 278, .42, 1),
  prop('road-marker-ford-e', 'banner', 414, 238, .4, 1),
  prop('road-lamp-ford-w', 'lamp-post', 260, 236, .42, 1),
  prop('road-marker-ashfork-e', 'banner', 205, 407, .38, 1),
  prop('road-lamp-ashfork-w', 'lamp-post', 155, 447, .4, 1),
  prop('road-marker-ford-s-w', 'banner', 270, 642, .4, 1),
  prop('road-marker-ford-s-e', 'banner', 440, 628, .4, 1),
  prop('road-marker-village', 'banner', 724, -18, .42, 1),
  prop('road-lamp-village', 'lamp-post', 716, -34, .42, 1),
  prop('road-marker-mudgate', 'banner', 766, 310, .42, 2),
  prop('road-lamp-mudgate', 'lamp-post', 776, 334, .4, 0),
];

/** Settlement placement. Buildings stand with their bases beside the streets and face them. */
const P = (id: string, assetId: string, x: number, y: number, scale: number, variant = 0, faction: WorldProp['faction'] = 'ambient') => prop(id, assetId, x, y, scale, variant, faction);
const ring = (n: number, cx: number, cy: number, rx: number, ry: number, f: (i: number, x: number, y: number) => WorldProp) => Array.from({ length: n }, (_, i) => f(i, cx + Math.cos(i / n * 6.283) * rx, cy + Math.sin(i / n * 6.283) * ry));

const TOWN_PROPS: readonly WorldProp[] = [
  // Manor closes the north end of the avenue.
  P('town-manor', 'manor', 900, 150, .7),
  ...[0, 1].map(i => P(`town-guard-gate-${i}`, 'guard', 880 + i * 40, 168, .36, i, 'friendly')),
  P('town-noble-1', 'noble', 872, 186, .37, 0, 'friendly'), P('town-noble-2', 'noble', 936, 192, .37, 1, 'friendly'),
  // North terrace of townhouses (west and east of the manor).
  P('town-house-n1', 'townhouse', 735, 204, .6, 0), P('town-house-n2', 'townhouse', 1010, 204, .6, 1), P('town-house-n3', 'townhouse', 1100, 204, .6, 2),
  // South row flanking the avenue: tavern west, merchant house east.
  P('town-tavern', 'tavern', 825, 355, .7, 0), P('town-house-s1', 'townhouse', 995, 312, .6, 2),
  P('town-house-s3', 'townhouse', 1085, 312, .6, 0),
  // Market square. Wide footprints sit beside, never across, the two streets.
  P('town-well', 'well', 940, 190, .5, 0),
  P('town-stall-1', 'market-stall', 862, 222, .45, 0), P('town-stall-2', 'market-stall', 938, 222, .45, 1),
  P('town-stall-3', 'market-stall', 864, 256, .45, 2), P('town-stall-4', 'market-stall', 936, 256, .45, 0),
  P('town-barrels-1', 'barrels', 934, 292, .4, 1), P('town-cart', 'cart', 942, 274, .45, 2),
  P('town-merchant-1', 'merchant', 880, 218, .36, 0, 'friendly'), P('town-merchant-2', 'merchant', 920, 218, .36, 1, 'friendly'), P('town-merchant-3', 'merchant', 868, 268, .36, 2, 'friendly'),
  P('town-noble-3', 'noble', 915, 250, .37, 2, 'friendly'),
  P('town-guard-w', 'guard', 782, 246, .36, 0, 'friendly'), P('town-guard-e', 'guard', 1030, 246, .36, 1, 'friendly'),
  P('town-townsfolk-1', 'dwarf-townsfolk', 960, 272, .33, 0, 'friendly'), P('town-townsfolk-2', 'dwarf-townsfolk', 830, 252, .33, 1, 'friendly'),
  P('town-peasant-1', 'peasant', 1000, 252, .36, 0, 'friendly'),
  // Lamps along the avenues.
  ...[[832, 258], [950, 248], [850, 214], [950, 214], [790, 248], [1010, 248], [888, 290], [912, 190]].map(([x, y], i) => P(`town-lamp-${i}`, 'lamp-post', x, y, .5, i % 2)),
  P('town-fence-1', 'fence', 1070, 270, .5, 2), P('town-fence-2', 'fence', 1120, 270, .5, 2),
  ...[0, 1, 2, 3, 4, 5].map(i => P(`town-flowers-${i}`, ['flowers-pink', 'flowers-gold', 'flowers-blue'][i % 3], 780 + i * 56, 330 + (i % 2) * 22, .4)),
];

const OUTSKIRTS_PROPS: readonly WorldProp[] = [
  P('mud-hovel-1', 'hovel', 655, 360, .55, 0), P('mud-hovel-2', 'hovel', 690, 405, .55, 1), P('mud-hovel-3', 'hovel', 785, 395, .5, 2),
  P('mud-hovel-4', 'hovel', 585, 240, .5, 1), P('mud-hovel-5', 'hovel', 735, 260, .55, 0),
  P('mud-ruin-1', 'ruin-wall', 690, 280, .5, 0), P('mud-ruin-2', 'ruin-wall', 618, 330, .5, 1), P('mud-ruin-3', 'ruin-wall', 778, 340, .45, 2),
  P('mud-fire', 'campfire', 735, 340, .5, 0),
  P('mud-beggar-1', 'beggar', 688, 350, .34, 0, 'friendly'), P('mud-beggar-2', 'beggar', 718, 352, .34, 1, 'friendly'), P('mud-beggar-3', 'beggar', 640, 306, .34, 2, 'friendly'),
  P('mud-peasant-1', 'peasant', 676, 342, .36, 1, 'friendly'), P('mud-peasant-2', 'peasant', 726, 338, .36, 2, 'friendly'),
  P('mud-barrels', 'barrels', 676, 380, .4, 0), P('mud-cart', 'cart', 640, 372, .45, 0), P('mud-fence', 'fence', 765, 380, .45, 1),
  P('mud-rock-1', 'rock', 626, 296, .5), P('mud-rock-2', 'rock', 770, 312, .5, 1),
];

const VILLAGE_PROPS: readonly WorldProp[] = [
  P('vil-well', 'well', 758, -50, .5, 0),
  P('vil-cottage-1', 'cottage', 705, -66, .55, 1), P('vil-cottage-2', 'cottage', 812, -66, .55, 0), P('vil-cottage-3', 'cottage', 735, -98, .55, 2), P('vil-cottage-4', 'cottage', 786, -100, .55, 1),
  P('vil-cart', 'cart', 820, 30, .45, 1), P('vil-barrels', 'barrels', 730, -42, .4, 1),
  P('vil-hay-1', 'haystack', 892, -52, .5, 0), P('vil-hay-2', 'haystack', 635, -48, .5, 1), P('vil-hay-3', 'haystack', 905, -108, .5, 2),
  ...[0, 1, 2, 3].map(i => P(`vil-fence-w-${i}`, 'fence', 640 + i * 24, -18, .45, 0)),
  ...[0, 1, 2, 3].map(i => P(`vil-fence-e-${i}`, 'fence', 826 + i * 24, -18, .45, 0)),
  P('vil-farmer-1', 'farmer', 680, -98, .36, 0, 'friendly'), P('vil-farmer-2', 'farmer', 850, -100, .36, 1, 'friendly'), P('vil-farmer-3', 'farmer', 680, -48, .36, 2, 'friendly'), P('vil-farmer-4', 'farmer', 770, -146, .36, 0, 'friendly'),
  P('vil-peasant-1', 'peasant', 745, -36, .36, 0, 'friendly'), P('vil-peasant-2', 'peasant', 790, -78, .36, 2, 'friendly'),
  P('vil-lamp', 'lamp-post', 740, -26, .5, 1), P('vil-flowers-1', 'flowers-gold', 800, -28, .4), P('vil-flowers-2', 'flowers-pink', 720, -80, .35),
  ...[0, 1, 2].map(i => P(`vil-bird-${i}`, 'bird', 700 + i * 55, -135 - i * 8, .25, i % 2)),
];

const GOBLIN_PROPS: readonly WorldProp[] = [
  P('gob-fire', 'campfire', -60, 226, .55, 1),
  P('gob-ruin-1', 'ruin-wall', -92, 196, .55, 1), P('gob-ruin-2', 'ruin-wall', -30, 190, .5, 2), P('gob-ruin-3', 'ruin-wall', -100, 252, .5, 0),
  P('gob-banner-1', 'banner', -66, 200, .5, 2), P('gob-banner-2', 'banner', -24, 242, .45, 2),
  ...[[-82, 224], [-52, 236], [-62, 248], [-84, 246], [-46, 206], [-68, 214]].map(([x, y], i) => P(`gob-goblin-${i}`, 'goblin', x, y, .33, i % 3, 'hostile')),
  P('gob-barrels', 'barrels', -104, 226, .4, 0), P('gob-tent', 'tent', -108, 188, .65, 1), P('gob-rock', 'rock', -20, 262, .5, 1),
];

const ORC_PROPS: readonly WorldProp[] = [
  P('orc-fire-1', 'campfire', 120, 680, .6, 1), P('orc-fire-2', 'campfire', 118, 618, .45, 0),
  P('orc-banner-1', 'banner', 98, 640, .6, 2), P('orc-banner-2', 'banner', 204, 644, .6, 2), P('orc-banner-3', 'banner', 146, 578, .55, 2),
  P('orc-barrels-1', 'barrels', 186, 672, .45, 1), P('orc-barrels-2', 'barrels', 108, 676, .45, 0), P('orc-tent', 'tent', 112, 592, .8, 1),
  ...[[132, 660], [172, 640], [150, 630], [178, 680], [120, 640], [150, 676]].map(([x, y], i) => P(`orc-orc-${i}`, 'orc', x, y, .38, i % 3, 'hostile')),
  P('orc-rock-1', 'rock', 210, 680, .8), P('orc-rock-2', 'rock', 92, 670, .7, 1),
];

const ELF_PROPS: readonly WorldProp[] = [
  ...ring(7, 520, 620, 48, 30, (i, x, y) => P(`elf-lamp-${i}`, 'lamp-post', x, y + (i === 3 ? 18 : 0), .5, 1)),
  ...[[500, 612], [542, 622], [520, 640], [488, 640]].map(([x, y], i) => P(`elf-elf-${i}`, 'elf', x, y, .36, i % 3, 'friendly')),
  ...ring(10, 520, 625, 60, 38, (i, x, y) => P(`elf-flowers-${i}`, ['flowers-blue', 'flowers-pink', 'flowers-purple', 'flowers-gold'][i % 4], x, y + 8, .38 + (i % 3) * .05)),
  ...[0, 1, 2, 3].map(i => P(`elf-butterfly-${i}`, ['butterfly-blue', 'butterfly-pink', 'butterfly-purple', 'butterfly-blue'][i], 490 + i * 20, 596 + i % 2 * 24, .2)),
  P('elf-bird', 'bird', 560, 580, .25, 1), P('elf-rock', 'rock', 590, 684, .55, 1),
];

const WORLD_PROPS: readonly WorldProp[] = [
  ...TOWN_PROPS, ...OUTSKIRTS_PROPS, ...VILLAGE_PROPS, ...GOBLIN_PROPS, ...ORC_PROPS, ...ELF_PROPS,
  ...GROVE_PROPS, ...REED_PROPS, ...ROAD_MARKER_PROPS,
];
export const LANDMARK_PROPS: readonly WorldProp[] = [...BASE_PROPS, ...WORLD_PROPS];

export function regionAt(x: number, y: number): string {
  const region = LANDMARKS.find(region => Math.hypot(x - region.x, y - region.y) < (region.id === 'town' ? 150 : 108));
  if (region) return region.name;
  if (waterDepth(x, y) > 0) {
    if (x > 490 && x < 660 && y > 45 && y < 150) return 'Mirrorlake';
    if (x < riverCenter(y) && y > 395 && y < 455) return 'Ashfork';
    return 'Whispering River';
  }
  return 'Ashen Valley';
}
