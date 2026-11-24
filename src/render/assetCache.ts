import type { AsciiAsset, AssetOptions } from '../assets/types.ts';
import { AssetRenderer, type GlyphSprite } from './assetRenderer.ts';

export interface PlacedSprite { sprite: GlyphSprite; anchorX: number; anchorY: number }

/** Store already minified sprites, not thousands of source cells per tree.
 * Static props never regenerate on a global animation clock. */
export class AssetCache {
  private entries = new Map<string, PlacedSprite>();
  constructor(private renderer: AssetRenderer) {}
  clear(): void { this.entries.clear(); }
  get(asset: AsciiAsset, options: AssetOptions, scale: number, animated = false): PlacedSprite {
    // Common 4pi cycle preserves the half/integer frequencies used by actors.
    const frame = animated ? Math.floor((options.time % (Math.PI * 4)) * 8) : 0;
    const key = `${asset.id}:${asset.version}:${options.seed}:${options.variant}:${options.action}:${options.facing}:${scale}:${frame}`;
    const cached = this.entries.get(key);
    if (cached) return cached;
    const source = asset.generate({ ...options, time: frame / 8 });
    const entry = {
      sprite: this.renderer.compile(source, asset.width, asset.height, scale),
      anchorX: Math.round((options.facing === 'left' ? asset.width - 1 - asset.anchor.x : asset.anchor.x) * scale),
      anchorY: Math.round(asset.anchor.y * scale),
    };
    if (this.entries.size >= 768) this.entries.delete(this.entries.keys().next().value!);
    this.entries.set(key, entry);
    return entry;
  }
}
