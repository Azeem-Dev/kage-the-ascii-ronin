/** Asset coordinates are local character cells; anchor is the ground contact point.
 * Transparent cells are absent. Frames contain glyphs, never hidden pixel art.
 * World placement, collision and camera transforms belong to asset instances.
 */
export interface AsciiCell {
  x: number;
  y: number;
  glyph: string;
  color: string;
}

export interface AssetOptions {
  time: number;
  seed: number;
  variant: number;
  facing: 'left' | 'right';
  action: 'idle' | 'walk' | 'sit' | 'run' | 'fly';
}

export interface AsciiAsset {
  id: string;
  version: number;
  name: string;
  category: 'Character' | 'Vegetation' | 'Terrain' | 'Creature' | 'Equipment' | 'Prop';
  description: string;
  width: number;
  height: number;
  anchor: { x: number; y: number };
  variants: readonly string[];
  generate: (options: AssetOptions) => AsciiCell[];
  /** Optional renderer that draws straight at the final on-screen scale (cells per source unit),
   * so detail is sampled, not averaged down. Cells are in the scaled grid; anchor = round(anchor * scale). */
  generateAt?: (options: AssetOptions, scale: number) => { cells: AsciiCell[]; width: number; height: number };
  /** Optional ground footprint in asset-local cells, relative to the anchor
   * (x right, y down). Each circle blocks movement once scaled into the world. */
  footprint?: readonly { x: number; y: number; radius: number }[];
  /** Optional light source in asset-local cells relative to the anchor; colour is 0..1 RGB. */
  light?: { x: number; y: number; radius: number; color: readonly [number, number, number] };
}

/** Deterministic spatial noise: animation must never reseed static texture. */
export function noise(x: number, y: number, seed: number): number {
  let n = Math.imul(x + 713, 374761393) ^ Math.imul(y + 197, 668265263) ^ Math.imul(seed, 144269);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

export function validateFrame(asset: AsciiAsset, cells: readonly AsciiCell[]): void {
  for (const cell of cells) {
    if (!Number.isInteger(cell.x) || !Number.isInteger(cell.y) || cell.x < 0 || cell.y < 0 || cell.x >= asset.width || cell.y >= asset.height) {
      throw new Error(`${asset.id}: cell outside asset bounds (${cell.x}, ${cell.y})`);
    }
    if (Array.from(cell.glyph).length !== 1 || !/^#[0-9a-f]{6}$/i.test(cell.color)) {
      throw new Error(`${asset.id}: invalid glyph or color`);
    }
  }
}
