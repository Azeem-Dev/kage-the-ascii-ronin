// ============================================================================
// Shared World Model
// Single source of truth for elevation, traversal, collision, projection and
// major prop placement. Both movement and rendering consume these definitions.
// ============================================================================

export interface WorldPoint {
  x: number;
  y: number;
  z: number;
}

export interface ScreenPoint {
  x: number;
  y: number;
}

export type SurfaceKind = 'ground' | 'stairs' | 'plateau' | 'building';

export interface SurfaceSample {
  kind: SurfaceKind;
  z: number;
  walkable: boolean;
}

const PLATEAU_ELEVATION = 24;

export const WORLD = {
  bounds: { minX: 24, maxX: 376, minY: 36, maxY: 208 },

  plateau: {
    elevation: PLATEAU_ELEVATION,
    points: [
      { x: 230, y: 72, z: PLATEAU_ELEVATION },
      { x: 360, y: 116, z: PLATEAU_ELEVATION },
      { x: 252, y: 182, z: PLATEAU_ELEVATION },
      { x: 122, y: 122, z: PLATEAU_ELEVATION },
    ],
  },

  stairs: {
    start: { x: 164, y: 181, z: 0 },
    end: { x: 205, y: 162, z: PLATEAU_ELEVATION },
    width: 18,
    steps: 7,
  },

  building: {
    floorZ: PLATEAU_ELEVATION,
    footprint: [
      { x: 198, y: 115, z: PLATEAU_ELEVATION },
      { x: 254, y: 134, z: PLATEAU_ELEVATION },
      { x: 312, y: 114, z: PLATEAU_ELEVATION },
      { x: 254, y: 100, z: PLATEAU_ELEVATION },
    ],
    wallHeight: 34,
    roofHeight: 52,
  },

  pond: { x: 335, y: 188, z: 0, rx: 44, ry: 20 },

  torii: {
    left: { x: 205, y: 153, z: PLATEAU_ELEVATION },
    right: { x: 265, y: 176, z: PLATEAU_ELEVATION },
    height: 44,
  },

  lantern: { x: 240, y: 119, z: PLATEAU_ELEVATION },

  trees: [
    { x: 350, y: 83, z: 0, scale: 1.0 },
    { x: 45, y: 65, z: 0, scale: 0.9 },
    { x: 68, y: 199, z: 0, scale: 0.85 },
    { x: 372, y: 196, z: 0, scale: 0.95 },
    { x: 330, y: 139, z: 0, scale: 0.7 },
  ],
} as const;

export function projectBase(point: WorldPoint): ScreenPoint {
  return { x: point.x, y: point.y - point.z };
}

export function pointInPolygon(x: number, y: number, points: readonly WorldPoint[]): boolean {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const a = points[i];
    const b = points[j];
    const intersects = ((a.y > y) !== (b.y > y)) &&
      (x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x);
    if (intersects) inside = !inside;
  }
  return inside;
}

export function sampleSurface(x: number, y: number): SurfaceSample {
  if (pointInPolygon(x, y, WORLD.plateau.points)) {
    return { kind: 'plateau', z: WORLD.plateau.elevation, walkable: true };
  }

  const start = WORLD.stairs.start;
  const end = WORLD.stairs.end;
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const t = Math.max(0, Math.min(1, ((x - start.x) * dx + (y - start.y) * dy) / (dx * dx + dy * dy)));
  const closestX = start.x + dx * t;
  const closestY = start.y + dy * t;
  if (Math.hypot(x - closestX, y - closestY) <= WORLD.stairs.width) {
    return { kind: 'stairs', z: start.z + (end.z - start.z) * t, walkable: true };
  }

  if (pointInPolygon(x, y, WORLD.building.footprint)) {
    return { kind: 'building', z: WORLD.building.floorZ, walkable: false };
  }

  return { kind: 'ground', z: 0, walkable: true };
}

export function canWalk(x: number, y: number): boolean {
  const surface = sampleSurface(x, y);
  if (!surface.walkable) return false;
  if (x < WORLD.bounds.minX || x > WORLD.bounds.maxX || y < WORLD.bounds.minY || y > WORLD.bounds.maxY) return false;

  const pond = WORLD.pond;
  const pondDistance = ((x - pond.x) / pond.rx) ** 2 + ((y - pond.y) / pond.ry) ** 2;
  if (pondDistance < 1) return false;

  for (const pillar of [WORLD.torii.left, WORLD.torii.right]) {
    if (Math.hypot(x - pillar.x, y - pillar.y) < 5) return false;
  }
  for (const tree of WORLD.trees) {
    if (Math.hypot(x - tree.x, y - tree.y) < 5 * tree.scale) return false;
  }
  return true;
}

export function depthOf(point: WorldPoint): number {
  return point.y + point.x * 0.12 + point.z * 0.04;
}
