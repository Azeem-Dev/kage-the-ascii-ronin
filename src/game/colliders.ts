import type { Collider } from '../engine/physics.ts';

/** The subset of a placed world instance needed to derive its ground footprint. */
export interface ColliderSource {
  x: number;
  y: number;
  scale: number;
  asset: { id: string; category: string; width: number; footprint?: readonly { x: number; y: number; radius: number }[] };
}

/** Ground footprint of a placed prop, in world units (sprite units x scale).
 * Footprints follow the drawn art, so arches keep an opening between their
 * pillars and a tent blocks its whole base rather than a single central post.
 * Offsets are measured from the asset's ground anchor (props.ts: x = 48). */
export function collidersFor(item: ColliderSource): Collider[] {
  const { x, y, scale, asset } = item;
  // Assets that declare their own footprint (buildings, fences, carts) use it directly.
  if (asset.footprint) return asset.footprint.map(c => ({ x: x + c.x * scale, y: y + c.y * scale, radius: Math.max(1.5, c.radius * scale) }));
  switch (asset.id) {
    // Trees block only their trunk. Agent E's assets declare their own
    // footprints (handled above); these are fallbacks and cover the old pine.
    case 'pine': return [{ x, y, radius: Math.max(2, 3 * scale) }];
    case 'oak': return [{ x, y, radius: Math.max(3, 12 * scale) }];
    case 'willow': return [{ x, y, radius: Math.max(3, 10 * scale) }];
    case 'birch': return [{ x, y, radius: Math.max(2, 6 * scale) }];
    case 'cypress': return [{ x, y, radius: Math.max(3, 7 * scale) }];
    case 'cherry': return [{ x, y, radius: Math.max(3, 9 * scale) }];
    case 'dead-tree': return [{ x, y, radius: Math.max(3, 8 * scale) }];
    case 'bush': return [{ x, y, radius: Math.max(2, 5 * scale) }];
    case 'fern': return [{ x, y, radius: Math.max(1.5, 2 * scale) }];
    case 'reeds': return [{ x, y, radius: Math.max(1.5, 3 * scale) }];
    case 'rock': return [{ x, y, radius: 6 }];
    case 'crypt-arch': {
      // Two pillars (sprite x 10-20 and 76-86); the 56-unit doorway between stays open.
      const radius = Math.max(3, 5.5 * scale);
      return [-33, 33].map(offset => ({ x: x + offset * scale, y, radius }));
    }
    case 'tent': {
      // Triangular base spans sprite x 10-86: a chain of overlapping circles.
      const radius = Math.max(4, 7 * scale);
      return [-30, -20, -10, 0, 10, 20, 30].map(offset => ({ x: x + offset * scale, y, radius }));
    }
    case 'gravestone': return [{ x, y, radius: Math.max(3, 18 * scale) }];
    case 'anvil': return [{ x, y, radius: Math.max(4, 18 * scale) }];
    case 'lantern': return [{ x, y, radius: Math.max(2, 5 * scale) }];
    default:
      return asset.category === 'Prop' ? [{ x, y, radius: asset.width * scale * .12 }] : [];
  }
}
