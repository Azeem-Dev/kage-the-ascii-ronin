import { noise } from '../assets/types.ts';
import { riverCenter, waterDepth } from '../assets/landscape.ts';

export interface WorldProp {
  id: string;
  assetId: 'pine' | 'rock';
  x: number;
  y: number;
  seed: number;
  scale: number;
  variant: number;
}
export interface WorldChunk { x: number; y: number; props: readonly WorldProp[] }
export const CHUNK_SIZE = 96;

const STARTER_PROPS: readonly WorldProp[] = [
  ...[[184, 205, 8, .65, 0], [450, 144, 22, .8, 1], [500, 286, 47, .82, 0], [168, 330, 79, .7, 0], [440, 370, 51, .72, 1], [240, 120, 62, .62, 0]].map(([x, y, seed, scale, variant], i) => ({ id: `starter-pine-${i}`, assetId: 'pine' as const, x, y, seed, scale, variant })),
  ...[130, 187, 270, 335, 390].map((y, i) => ({ id: `starter-river-rock-${i}`, assetId: 'rock' as const, x: riverCenter(y) + (i % 2 ? 17 : -15), y, seed: i + 11, scale: .7 + i % 2 * .2, variant: 0 })),
  { id: 'starter-moss-1', assetId: 'rock', x: 398, y: 185, seed: 91, scale: .7, variant: 1 },
  { id: 'starter-moss-2', assetId: 'rock', x: 205, y: 258, seed: 86, scale: .8, variant: 1 },
];

/** Chunk content is data, not draw calls. Regenerating an evicted chunk must
 * produce identical IDs, placement, variants and seeds, including at negatives. */
export function generateChunk(cx: number, cy: number): WorldChunk {
  const props: WorldProp[] = STARTER_PROPS.filter(p => Math.floor(p.x / CHUNK_SIZE) === cx && Math.floor(p.y / CHUNK_SIZE) === cy);
  for (let i = 0; i < 3; i++) {
    const seed = Math.floor(noise(cx * 7 + i, cy, 729) * 99999);
    const y = cy * CHUNK_SIZE + 14 + noise(cx, cy * 5 + i, 331) * 67;
    let x = cx * CHUNK_SIZE + 12 + noise(cx * 3 + i, cy, 109) * 72;
    const assetId = i < 2 ? 'pine' : 'rock';
    if (assetId === 'rock' && riverCenter(y) >= cx * CHUNK_SIZE && riverCenter(y) < (cx + 1) * CHUNK_SIZE) x = riverCenter(y) + (noise(cx, cy, 57) - .5) * 30;
    // Keep the authored starting clearing intact; its surroundings are generated.
    if (x >= 145 && x <= 530 && y >= 100 && y <= 400) continue;
    if (assetId === 'pine' && waterDepth(x, y) > -12) continue;
    props.push({ id: `${cx}:${cy}:${i}`, assetId, x, y, seed, scale: assetId === 'pine' ? .55 + noise(cx + i, cy, 81) * .3 : .6 + noise(cx, cy + i, 24) * .3, variant: seed % 2 });
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
