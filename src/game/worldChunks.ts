import { noise } from '../assets/types.ts';
import { BIOME, biomeAt, forestDensity, GROUND, groundAt, riverCenter, riverWidth, roadDistance, waterDepth } from '../assets/landscape.ts';
import { LANDMARK_PROPS, LANDMARKS } from './landmarks.ts';

export interface WorldProp {
  id: string;
  assetId: string;
  x: number;
  y: number;
  seed: number;
  scale: number;
  variant: number;
  faction?: 'friendly' | 'hostile' | 'ambient';
}
export interface WorldChunk { x: number; y: number; props: readonly WorldProp[] }
export const CHUNK_SIZE = 96;

/** Pick a deterministic dry bank position, moving far enough inland that a
 *  mounted rider clears both the water and the road. NaN drops a rare blocked
 *  candidate rather than allowing a starter prop to stand in the channel. */
function dryBankX(y: number, side: number): number {
  for (const extra of [18, 26, 36, 48]) {
    const x = riverCenter(y) + side * (riverWidth(y) + extra);
    if (waterDepth(x, y) < -10 && roadDistance(x, y) > 14) return x;
  }
  return NaN;
}

/** A handful of hand-picked trees and bank rocks that anchor the opening view.
 *  Roots stay dry; rocks deliberately do not become mid-channel obstacles. */
const STARTER_PROPS: readonly WorldProp[] = [
  ...([
    [184, 205, 8, .62, 0, 'cypress'],    // crypt approach
    [450, 144, 22, .56, 1, 'oak'],       // meadow west of Mirrorlake
    [525, 278, 47, .58, 0, 'willow'],    // valley east bank, clear of the elf road
    [168, 330, 79, .55, 0, 'dead-tree'], // burnt road to the forge
    [440, 370, 51, .56, 1, 'oak'],       // open grass east of the river
    [240, 120, 62, .54, 0, 'willow'],    // north river bend
  ] as const).map(([x, y, seed, scale, variant, assetId], i) => ({ id: `starter-tree-${i}`, assetId, x, y, seed, scale, variant })),
  ...[130, 187, 270, 335, 390].map((y, i) => ({
    id: `starter-river-rock-${i}`, assetId: 'rock' as const,
    x: dryBankX(y, i % 2 ? -1 : 1), y, seed: i + 11, scale: .7 + i % 2 * .2, variant: 0,
  })).filter(p => Number.isFinite(p.x) && waterDepth(p.x, p.y) < -9 && roadDistance(p.x, p.y) > 14),
  { id: 'starter-moss-1', assetId: 'rock', x: dryBankX(165, 1), y: 165, seed: 91, scale: .7, variant: 1 },
  { id: 'starter-moss-2', assetId: 'rock', x: 178, y: 274, seed: 86, scale: .8, variant: 1 },
].filter(p => Number.isFinite(p.x) && waterDepth(p.x, p.y) < -9 && roadDistance(p.x, p.y) > 14);

/** Background tree species per biome. Empty = settlement, keep it clear. */
const TREE_MIX: Readonly<Record<number, readonly string[]>> = {
  [BIOME.VALLEY]: ['willow', 'birch', 'willow'],
  [BIOME.MEADOW]: ['oak', 'oak', 'birch'],
  [BIOME.FOREST]: ['pine', 'pine', 'cypress', 'fern'],
  [BIOME.SAKURA]: ['cherry', 'cherry', 'birch'],
  [BIOME.FARMLAND]: ['bush', 'bush', 'oak'],
  [BIOME.WASTE]: ['dead-tree', 'dead-tree', 'bush'],
  [BIOME.FORGE]: ['dead-tree', 'cypress', 'bush'],
  [BIOME.CRYPT]: ['cypress', 'pine', 'fern'],
  [BIOME.TOWN]: [],
};
const PLANTABLE = new Set<number>([GROUND.LUSH, GROUND.FOREST, GROUND.FLOWER, GROUND.MEADOW, GROUND.ASH, GROUND.FORGE, GROUND.CRYPT]);

/** Region centres and their arrival points stay unobstructed; authored groves
 *  in landmarks.ts supply the dense tree cover around them. */
function clearOfSettlements(x: number, y: number): boolean {
  for (const r of LANDMARKS) {
    const clearance = r.id === 'town' ? 180 : r.id === 'village' ? 150 : 88;
    if (Math.hypot(x - r.x, y - r.y) < clearance) return false;
    if (Math.hypot(x - r.spawnX, y - r.spawnY) < 42) return false;
  }
  return true;
}

/** Chunk content is data, not draw calls. Regenerating an evicted chunk must
 *  produce identical IDs, placement, variants and seeds, including at negatives. */
export function generateChunk(cx: number, cy: number): WorldChunk {
  const props: WorldProp[] = [...STARTER_PROPS, ...LANDMARK_PROPS].filter(p => Math.floor(p.x / CHUNK_SIZE) === cx && Math.floor(p.y / CHUNK_SIZE) === cy);
  const baseX = cx * CHUNK_SIZE, baseY = cy * CHUNK_SIZE;
  const CANDIDATES = 6;
  for (let i = 0; i < CANDIDATES; i++) {
    const seed = Math.floor(noise(cx * 7 + i, cy, 729) * 99999);
    const x = baseX + 8 + noise(cx * 3 + i, cy, 109) * (CHUNK_SIZE - 16);
    const y = baseY + 8 + noise(cx, cy * 5 + i, 331) * (CHUNK_SIZE - 16);
    // The last slot is a bank rock. A 14-unit road-edge margin keeps the
    // largest scaled trunk plus a mounted body out of the travelled lane.
    const isRock = i === CANDIDATES - 1;
    if (waterDepth(x, y) > -9 || roadDistance(x, y) < 14 || !clearOfSettlements(x, y)) continue;
    const ground = groundAt(x, y);
    if (isRock) {
      if (ground !== GROUND.SAND && ground !== GROUND.LUSH && ground !== GROUND.FOREST && ground !== GROUND.ASH) continue;
      props.push({ id: `${cx}:${cy}:${i}`, assetId: 'rock', x, y, seed, scale: .55 + noise(cx, cy + i, 24) * .35, variant: seed % 2 });
      continue;
    }
    if (!PLANTABLE.has(ground)) continue;
    const biome = biomeAt(x, y);
    const mix = TREE_MIX[biome];
    if (!mix || mix.length === 0) continue;
    // Biome identity and macro density, not a uniform hash, decide tree cover.
    // Farmland stays deliberately open: hedges are common, full-size oaks rare.
    const density = biome === BIOME.FARMLAND ? .04 + forestDensity(x, y) * .35 : .16 + forestDensity(x, y) * .72;
    if (noise(cx * 5 + i, cy, 601) > density) continue;
    const assetId = mix[Math.floor(noise(cx * 3 + i, cy, 913) * mix.length) % mix.length];
    const scale = .5 + noise(cx + i, cy, 81) * .18;
    props.push({ id: `${cx}:${cy}:${i}`, assetId, x, y, seed, scale, variant: seed % 2 });
    // One companion now and then makes a small grove, never an even ring.
    if (seed % 3 !== 0) continue;
    const gx = x + (noise(cx, cy + i, 77) - .5) * 16;
    const gy = y + (noise(cx + i, cy, 83) - .5) * 14;
    if (waterDepth(gx, gy) > -9 || roadDistance(gx, gy) < 14 || !clearOfSettlements(gx, gy) || !PLANTABLE.has(groundAt(gx, gy))) continue;
    props.push({ id: `${cx}:${cy}:${i}g`, assetId, x: gx, y: gy, seed: seed + 5, scale: scale * .9, variant: (seed + 1) % 2 });
  }
  // Flowers appear in loose clusters on meadow ground, clear of roads and spawns.
  for (let i = 0; i < 3; i++) {
    const seed = Math.floor(noise(cx * 11 + i, cy, 811) * 99999);
    const x = baseX + 6 + noise(cx + i, cy * 3, 417) * (CHUNK_SIZE - 12);
    const y = baseY + 6 + noise(cx * 2, cy + i, 419) * (CHUNK_SIZE - 12);
    if (waterDepth(x, y) > -6 || roadDistance(x, y) < 6 || !clearOfSettlements(x, y)) continue;
    const ground = groundAt(x, y);
    if (ground !== GROUND.FLOWER && ground !== GROUND.MEADOW && ground !== GROUND.LUSH) continue;
    const assetId = ['flowers-blue', 'flowers-pink', 'flowers-purple', 'flowers-gold'][seed % 4];
    props.push({ id: `${cx}:${cy}:f${i}`, assetId, x, y, seed, scale: .28 + noise(cx, cy + i, 73) * .12, variant: seed % 2 });
  }
  return { x: cx, y: cy, props };
}

export class WorldChunks {
  private loaded = new Map<string, WorldChunk>();
  private windowKey = '';
  private windowProps: readonly WorldProp[] = [];
  get loadedCount(): number { return this.loaded.size; }

  around(x: number, y: number, cols: number, rows: number): readonly WorldProp[] {
    // Extra margin admits tall trees whose roots are just below the viewport.
    const minX = Math.floor((x - cols * .65 - 70) / CHUNK_SIZE);
    const maxX = Math.floor((x + cols * .45 + 70) / CHUNK_SIZE);
    const minY = Math.floor((y - rows * .65 - 20) / CHUNK_SIZE);
    const maxY = Math.floor((y + rows * .45 + 100) / CHUNK_SIZE);
    const windowKey = `${minX}:${maxX}:${minY}:${maxY}`;
    if (windowKey === this.windowKey) return this.windowProps;
    const props: WorldProp[] = [];
    for (const [key, chunk] of this.loaded) {
      if (chunk.x < minX || chunk.x > maxX || chunk.y < minY || chunk.y > maxY) this.loaded.delete(key);
    }
    for (let cy = minY; cy <= maxY; cy++) for (let cx = minX; cx <= maxX; cx++) {
      const key = `${cx}:${cy}`;
      let chunk = this.loaded.get(key);
      if (!chunk) { chunk = generateChunk(cx, cy); this.loaded.set(key, chunk); }
      props.push(...chunk.props);
    }
    this.windowKey = windowKey;
    this.windowProps = props;
    return props;
  }
}
