// ============================================================================
// Material Override System
// Defines materials with luminance-ordered glyph sets for rich 3D shading
// (from deepest shadow to specular highlight), matching high-detail ASCII ARPGs.
// ============================================================================

export enum Material {
  NONE = 0,
  GRASS = 1,
  WOOD = 2,
  STONE = 3,
  WATER = 4,
  BLOOD = 5,
  FIRE = 6,
  CLOTH = 7,
  FOLIAGE = 8,
  ROOF_TILES = 9,
  SHOJI = 10,
  MOON = 11,
  LANTERN = 12,
  TORII = 13,
  CLIFF = 14,
}

export enum Surface {
  FLAT = 0,
  VERTICAL = 1,
  HORIZONTAL = 2,
  SLOPE_LEFT = 3,
  SLOPE_RIGHT = 4,
  CYLINDER = 5,
}

export interface MaterialDef {
  name: string;
  glyphs: string[]; // Ordered from dark/sparse to bright/dense
  debugColor: string;
  useEdgeOverride: boolean;
}

export const MATERIAL_DEFS: Record<Material, MaterialDef> = {
  [Material.NONE]: {
    name: 'None',
    glyphs: [],
    debugColor: '#000000',
    useEdgeOverride: true,
  },
  [Material.GRASS]: {
    name: 'Grass',
    glyphs: [' ', ' ', '.', ',', "'", '"'],
    debugColor: '#1d8348',
    useEdgeOverride: false,
  },
  [Material.WOOD]: {
    name: 'Wood',
    glyphs: [' ', '░', '▒', '▓', '═', '║'],
    debugColor: '#873600',
    useEdgeOverride: true,
  },
  [Material.STONE]: {
    name: 'Stone',
    glyphs: [' ', '░', '▒', '▓', '█', '.', ':'],
    debugColor: '#7f8c8d',
    useEdgeOverride: false,
  },
  [Material.CLIFF]: {
    name: 'Cliff / High Ground',
    glyphs: [' ', '░', '▒', '▓', '█', 'x', '#'],
    debugColor: '#566573',
    useEdgeOverride: false,
  },
  [Material.WATER]: {
    name: 'Water',
    glyphs: [' ', ' ', '~', '≈', '-', '='],
    debugColor: '#2980b9',
    useEdgeOverride: false,
  },
  [Material.BLOOD]: {
    name: 'Blood',
    glyphs: [' ', '░', '▒', '▓', '█', '*'],
    debugColor: '#c0392b',
    useEdgeOverride: false,
  },
  [Material.FIRE]: {
    name: 'Fire',
    glyphs: ['.', ':', '*', '^', '!', 'o', 'O', '#', '@'],
    debugColor: '#e67e22',
    useEdgeOverride: false,
  },
  [Material.CLOTH]: {
    name: 'Cloth',
    glyphs: [' ', '░', '▒', '▓', '█'],
    debugColor: '#8e44ad',
    useEdgeOverride: false,
  },
  [Material.FOLIAGE]: {
    name: 'Foliage',
    glyphs: [' ', '░', '▒', '▓', '█', '%', '&'],
    debugColor: '#27ae60',
    useEdgeOverride: false,
  },
  [Material.ROOF_TILES]: {
    name: 'Roof Tiles',
    glyphs: [' ', '░', '▒', '▓', '/', '\\', '═'],
    debugColor: '#2c3e50',
    useEdgeOverride: true,
  },
  [Material.SHOJI]: {
    name: 'Shoji',
    glyphs: [' ', '░', '▒', '▓', '+', '|', '─'],
    debugColor: '#f1c40f',
    useEdgeOverride: true,
  },
  [Material.MOON]: {
    name: 'Moon',
    glyphs: ['*', 'o', 'O', '@', '█'],
    debugColor: '#fdfefe',
    useEdgeOverride: false,
  },
  [Material.LANTERN]: {
    name: 'Lantern',
    glyphs: ['*', 'O', '#', '@', '█'],
    debugColor: '#e74c3c',
    useEdgeOverride: false,
  },
  [Material.TORII]: {
    name: 'Torii',
    glyphs: [' ', '░', '▒', '▓', '║', '═'],
    debugColor: '#922b21',
    useEdgeOverride: true,
  },
};
