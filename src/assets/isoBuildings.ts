import { voxelHouse } from './voxel/voxelHouse.ts';
import { noise, type AsciiAsset, type AsciiCell, type AssetOptions } from './types.ts';

/**
 * Isometric buildings & directional settlement props for the 2.5D view.
 * Projection matches src/game/view.ts:
 *   screenX = X - Y,  screenY = (X + Y) / 3 - Z
 * Anchor is the footprint centre on the ground (Z = 0).
 */
export interface IsoHouseSpec {
  id: string;
  name: string;
  /** Half-length along world x and half-depth along world y. */
  a: number; b: number;
  /** Wall height and roof rise above the walls. */
  wall: number; rise: number;
  storeys: number;
  plaster: string; timber: string; stone: string;
  roof: string; window: string; door: string;
  thatch?: boolean;
  /** Shift world Y back from the legacy front-base anchor when placing. */
  shiftBack?: boolean;
  /** Half-extent used when projecting ground shadows. */
  shadowA?: number; shadowB?: number;
}

const hex = (c: string, f: number, add = 0) => '#' + [1, 3, 5].map(i =>
  Math.max(0, Math.min(255, Math.round(parseInt(c.slice(i, i + 2), 16) * f + add))).toString(16).padStart(2, '0')).join('');

export const shadeHex = hex;

export interface HouseTextures {
  facade: (u: number, v: number, length: number, seed: number, door: boolean) => [string, string] | null;
  roof: (X: number, Y: number, back: boolean) => [string, string];
}

export function variantPalette(s: IsoHouseSpec, variant: number): IsoHouseSpec {
  const v = ((Math.floor(variant) % 3) + 3) % 3;
  if (v === 0) return s;
  if (s.id === 'iso-townhouse') {
    return v === 1
      ? { ...s, plaster: '#d5c6a8', roof: '#475e7d', window: '#ffd884', door: '#7a2c24' }
      : { ...s, plaster: '#c8ccb0', roof: '#3d6346', window: '#ffe092', door: '#2e6338' };
  }
  if (s.id === 'iso-manor') {
    return v === 1
      ? { ...s, plaster: '#b8b6a8', roof: '#2d4b44', window: '#ffe59c' }
      : { ...s, plaster: '#dcded8', roof: '#4a6b8a', window: '#fff0b8' };
  }
  if (s.id === 'iso-cottage') {
    return v === 1
      ? { ...s, plaster: '#d4ccb8', timber: '#52402b', roof: '#a27b34' }
      : { ...s, plaster: '#e3d5b3', roof: '#8f6132', window: '#ffdf88' };
  }
  if (s.id === 'iso-hovel') {
    return v === 1
      ? { ...s, plaster: '#6e5237', roof: '#5a4a2a', window: '#665238' }
      : { ...s, plaster: '#856544', roof: '#7c6739', window: '#ffb952' };
  }
  return s;
}

/** Shared facade/roof textures for isometric houses. */
export function houseTextures(s: IsoHouseSpec): HouseTextures {
  const { b, wall: H } = s;
  const storeyH = H / s.storeys;

  const facade = (u: number, v: number, length: number, seed: number, door: boolean): [string, string] | null => {
    // Stone plinth at base
    if (v < 4.5) {
      const n = noise(Math.floor(u * .7), Math.floor(v), seed + 5);
      const mortar = Math.floor(u) % 6 === 0 || Math.floor(v) === 2;
      return [mortar ? '-' : n > .5 ? '#' : '=', hex(s.stone, mortar ? .75 : .9 + n * .18)];
    }
    // Eave shadow under the roof overhang
    const eave = v > H - 3 ? .58 : v > H - 5 ? .78 : 1;
    const storey = Math.floor(v / storeyH); const sv = v - storey * storeyH;
    if (sv < 1.5 && storey > 0) return ['=', hex(s.timber, eave)];
    if (Math.abs(u % 18) < 1.3 || u < 1.4 || u > length - 1.4) return ['|', hex(s.timber, eave)];
    const bay = Math.floor(u / 18); const bu = u - bay * 18;
    // Diagonal timber bracing on first/upper bays
    if (s.id !== 'iso-manor' && (bay + storey) % 2 === 0 && Math.abs((bu - 9) - (sv - storeyH * .5) * .6) < .8) {
      return ['/', hex(s.timber, .92 * eave)];
    }
    if (door && storey === 0 && Math.abs(u - length / 2) < 4.5 && sv < 16) {
      if (Math.abs(u - length / 2) > 3.6 || sv > 14.5) return ['|', hex(s.timber, .9)];
      return [sv % 4 < 1 ? '=' : '|', hex(s.door, .9 + noise(Math.floor(u), Math.floor(v), seed + 2) * .18)];
    }
    if (bu > 4.5 && bu < 13.5 && sv > storeyH * .3 && sv < storeyH * .3 + 9.5) {
      const lit = noise(bay, storey, seed) > .38;
      if (bu < 5.7 || bu > 12.3) return ['|', hex(s.timber, .95 * eave)];
      if (sv < storeyH * .3 + 1.2) return ['=', hex(s.stone, .95 * eave)];
      if (Math.abs(bu - 9) < .7 || Math.abs(sv - storeyH * .3 - 4.7) < .7) return ['+', hex(s.timber, eave)];
      return [lit ? '#' : '%', lit ? s.window : hex(s.window, .32)];
    }
    const n = noise(Math.floor(u), Math.floor(v), seed + 9);
    const tone = (.9 + n * .16) * eave;
    return [n > .82 ? ':' : n > .56 ? '.' : n > .3 ? '=' : '-', hex(s.plaster, tone)];
  };

  const roofCell = (X: number, Y: number, back: boolean): [string, string] => {
    if (Math.abs(Y) < 1.8) return ['=', hex(s.roof, back ? .95 : 1.28)];
    const row = Math.floor(Math.abs(Y) / 2.4);
    const n = noise(Math.floor(X), row, 77);
    const light = (back ? .68 : .98) * (1 - Math.abs(Y) / (b * 3.2)) + n * .12;
    if (Math.abs(Y) > b + 1.6) return ['=', hex(s.timber, back ? .8 : 1.05)];
    if (s.thatch) {
      const ragged = Math.abs(Y) > b + 1.2 && n < .35;
      if (ragged) return ['|', hex(s.roof, light * .7)];
      return [n > .55 ? '/' : n > .28 ? '\\' : '|', hex(s.roof, light)];
    }
    return [(Math.floor(X) + row * 2) % 4 === 0 ? '|' : row % 2 ? '=' : '#', hex(s.roof, light + (row % 2) * .06)];
  };
  return { facade, roof: roofCell };
}

// ------------------------------------------------------------------ Isometric settlement props

function isoRaster(w: number, h: number, ax: number, ay: number, draw: (put: (wx: number, wy: number, wz: number, g: string, c: string) => void) => void): AsciiCell[] {
  const grid = new Map<number, AsciiCell>();
  const put = (wx: number, wy: number, wz: number, glyph: string, color: string) => {
    const cx = Math.round(ax + (wx - wy));
    const cy = Math.round(ay + (wx + wy) / 3 - wz);
    if (cx < 0 || cy < 0 || cx >= w || cy >= h) return;
    grid.set(cy * w + cx, { x: cx, y: cy, glyph, color });
  };
  draw(put);
  return [...grid.values()];
}

function isoMarketStall(o: AssetOptions): AsciiCell[] {
  const v = ((Math.floor(o.variant) % 3) + 3) % 3;
  const stripeColors = [['#7d2925', '#aba192'], ['#244e7d', '#aba69a'], ['#356134', '#ad9948']][v];
  const a = 24; const b = 13; const w = 84; const h = 76; const ax = 42; const ay = 60;
  return isoRaster(w, h, ax, ay, put => {
    // Back posts
    for (let z = 0; z <= 34; z++) { put(-a, -b, z, '|', '#4a3222'); put(a, -b, z, '|', '#4a3222'); }
    // Counter box (side x=+a, front y=+b, top z=12)
    for (let z = 0; z <= 12; z++) for (let y = -b; y <= b; y++) put(a, y, z, z === 12 ? '=' : '#', z === 12 ? '#b59868' : '#583f2a');
    for (let z = 0; z <= 12; z++) for (let x = -a; x <= a; x++) put(x, b, z, z === 12 ? '=' : (x % 6 === 0 ? '|' : '#'), z === 12 ? '#c4a874' : '#735336');
    for (let y = -b; y <= b; y++) for (let x = -a; x <= a; x++) {
      const n = noise(Math.floor(x), Math.floor(y), o.seed + 5);
      const goods = v === 0 ? (n > .75 ? '*' : 'o') : v === 1 ? '#' : '=';
      const col = v === 0 ? (n < .35 ? '#cf4b36' : n < .7 ? '#e6ba43' : '#739846') : v === 1 ? (n > .5 ? '#3b6791' : '#dcd0b2') : '#8fa8aa';
      put(x, y, 13, Math.abs(x) < a - 2 && Math.abs(y) < b - 2 ? goods : '=', Math.abs(x) < a - 2 && Math.abs(y) < b - 2 ? col : '#b59868');
    }
    // Front posts
    for (let z = 0; z <= 27; z++) { put(-a, b, z, '|', '#5e422c'); put(a, b, z, '|', '#5e422c'); }
    // Sloped striped canopy
    for (let y = -b - 2; y <= b + 2; y++) for (let x = -a - 2; x <= a + 2; x++) {
      const u = (y + b + 2) / (2 * b + 4);
      const z = 35 - u * 8;
      const stripe = Math.floor((x + a + 2) / 6) & 1;
      put(x, y, z, y > b ? '=' : '#', hex(stripeColors[stripe], 1 - u * .15));
    }
  });
}

function isoFence(o: AssetOptions): AsciiCell[] {
  const v = ((Math.floor(o.variant) % 3) + 3) % 3;
  const col = v === 2 ? '#5a6872' : v === 1 ? '#786644' : '#725236';
  const dark = v === 2 ? '#343c44' : '#422e1d';
  const a = 24; const w = 56; const h = 38; const ax = 28; const ay = 28;
  return isoRaster(w, h, ax, ay, put => {
    for (const x of [-a, 0, a]) for (let z = 0; z <= 16; z++) put(x, 0, z, z === 16 ? '^' : '|', dark);
    if (v === 2) {
      for (let x = -a + 3; x < a; x += 3) for (let z = 2; z <= 14; z++) put(x, 0, z, z === 14 ? '^' : '|', col);
    }
    for (const rz of [6, 12]) for (let x = -a; x <= a; x++) put(x, 0, rz, '=', col);
  });
}

function isoRuinWall(o: AssetOptions): AsciiCell[] {
  const v = ((Math.floor(o.variant) % 3) + 3) % 3;
  const stone = v === 1 ? '#5b6268' : '#787d6f';
  const side = hex(stone, .78);
  const a = 32; const b = 5; const w = 80; const h = 72; const ax = 40; const ay = 56;
  return isoRaster(w, h, ax, ay, put => {
    for (let x = -a; x <= a; x++) {
      const jag = Math.floor(noise(Math.floor(x / 3), 1, o.seed + 30) * 8);
      const topZ = (v === 0 ? 18 : 28) - jag - (Math.abs(x) > 26 ? 5 : 0);
      for (let z = 0; z <= topZ; z++) {
        // Breach/arch doorway in the middle
        if (Math.abs(x) < 9 && (v !== 2 ? z < 11 : z < 18 - (x * x) * .08)) continue;
        const n = noise(x, z, o.seed + 31);
        const moss = v === 2 && n > .72;
        const g = z >= topZ - 1 ? '=' : n > .6 ? '#' : '%';
        for (let y = -b; y <= b; y++) {
          if (y === b || x === a || z >= topZ - 1) put(x, y, z, g, moss ? '#657a49' : (x === a ? side : hex(stone, .8 + n * .25)));
        }
      }
    }
  });
}

function isoTent(o: AssetOptions): AsciiCell[] {
  const v = ((Math.floor(o.variant) % 3) + 3) % 3;
  const main = v === 1 ? '#6b4832' : '#4a6b5e';
  const a = 24; const b = 18; const ridge = 30; const w = 96; const h = 70; const ax = 48; const ay = 52;
  return isoRaster(w, h, ax, ay, put => {
    for (let y = -b; y <= b; y++) for (let x = -a; x <= a; x++) {
      const z = ridge * (1 - Math.abs(y) / b);
      const n = noise(x, y, o.seed + 41);
      const back = y < 0;
      put(x, y, z, Math.abs(y) < 1.5 ? '=' : (n > .6 ? '#' : ':'), hex(main, back ? .7 : .95 + n * .12));
    }
    // Front gable opening
    for (let y = -b; y <= b; y++) {
      const gz = ridge * (1 - Math.abs(y) / b);
      for (let z = 0; z <= gz; z++) {
        const open = Math.abs(y) < 7 && z < 16;
        put(a, y, z, open ? '%' : '|', open ? '#101820' : hex(main, .78));
      }
    }
  });
}

function isoWell(o: AssetOptions): AsciiCell[] {
  const v = ((Math.floor(o.variant) % 3) + 3) % 3;
  const stone = v === 1 ? '#7d5f3e' : v === 2 ? '#596957' : '#7b8285';
  const w = 64; const h = 72; const ax = 32; const ay = 56;
  return isoRaster(w, h, ax, ay, put => {
    const r = 12;
    for (let z = 0; z <= 12; z++) for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) {
      const d = Math.hypot(x, y);
      if (d > r) continue;
      if (z === 12 && d < r - 3) { put(x, y, 10, '~', '#101b24'); continue; }
      if (d >= r - 3) put(x, y, z, z === 12 ? '=' : '#', hex(stone, .8 + (x < 0 ? .15 : -.1)));
    }
    for (let z = 12; z <= 34; z++) { put(-10, 0, z, '|', '#5a3f28'); put(10, 0, z, '|', '#5a3f28'); }
    for (let y = -13; y <= 13; y++) for (let x = -14; x <= 14; x++) {
      const z = 44 - Math.abs(y) * .85;
      put(x, y, z, Math.abs(y) < 1.5 ? '=' : '#', hex('#6e5334', y < 0 ? .75 : 1.0));
    }
  });
}

function isoPropAsset(id: string, name: string, w: number, h: number, ax: number, ay: number,
  variants: string[], footprint: { x: number; y: number; radius: number }[], gen: (o: AssetOptions) => AsciiCell[]): AsciiAsset {
  return { id, version: 1, name, category: 'Prop', description: `Isometric ${name.toLowerCase()}.`, width: w, height: h, anchor: { x: ax, y: ay }, variants, generate: gen, footprint };
}

export const HOUSE_SPECS: Readonly<Record<string, IsoHouseSpec>> = {
  townhouse: ({ id: 'iso-townhouse', name: 'Townhouse', a: 42, b: 25, wall: 64, rise: 30, storeys: 2,
    plaster: '#d9c9a6', timber: '#5b3a22', stone: '#8d8679', roof: '#9a3f2c', window: '#ffd27a', door: '#6e4426', shiftBack: true }),
  manor: ({ id: 'iso-manor', name: 'Manor', a: 66, b: 35, wall: 92, rise: 38, storeys: 3,
    plaster: '#c9c2b2', timber: '#4a4038', stone: '#7d7a72', roof: '#3f4d6b', window: '#ffe39a', door: '#5a3a26', shiftBack: true }),
  tavern: ({ id: 'iso-tavern', name: 'Tavern', a: 54, b: 30, wall: 60, rise: 32, storeys: 2,
    plaster: '#cfa96f', timber: '#4f3220', stone: '#857563', roof: '#6c4a2b', window: '#ffc35c', door: '#7a4a24', shiftBack: true }),
  cottage: ({ id: 'iso-cottage', name: 'Cottage', a: 34, b: 23, wall: 38, rise: 26, storeys: 1,
    plaster: '#e0d6ba', timber: '#6b4a2c', stone: '#8a8270', roof: '#b9913f', window: '#ffd27a', door: '#7a5230', thatch: true, shiftBack: true }),
  hovel: ({ id: 'iso-hovel', name: 'Hovel', a: 25, b: 18, wall: 28, rise: 17, storeys: 1,
    plaster: '#7d5d3c', timber: '#3e2a18', stone: '#5e5244', roof: '#6f5b31', window: '#d9a248', door: '#3a2616', thatch: true, shiftBack: true }),
};

export const ISO_BUILDINGS: Readonly<Record<string, AsciiAsset>> = {
  ...Object.fromEntries(Object.entries(HOUSE_SPECS).map(([k, s]) => [k, voxelHouse(s, variantPalette)])),
  'market-stall': isoPropAsset('iso-market-stall', 'Market stall', 84, 76, 42, 60, ['Red-white', 'Blue-white', 'Green-yellow'],
    [{ x: -16, y: 0, radius: 11 }, { x: 0, y: 0, radius: 11 }, { x: 16, y: 0, radius: 11 }], isoMarketStall),
  fence: isoPropAsset('iso-fence', 'Fence segment', 56, 38, 28, 28, ['Wooden', 'Wattle', 'Iron'],
    [{ x: -18, y: 0, radius: 4 }, { x: 0, y: 0, radius: 4 }, { x: 18, y: 0, radius: 4 }], isoFence),
  'ruin-wall': isoPropAsset('iso-ruin-wall', 'Ruin wall', 80, 72, 40, 56, ['Low', 'High', 'Arch'],
    [{ x: -24, y: 0, radius: 7 }, { x: -14, y: 0, radius: 6 }, { x: 14, y: 0, radius: 6 }, { x: 24, y: 0, radius: 7 }], isoRuinWall),
  tent: isoPropAsset('iso-tent', 'Ranger tent', 96, 70, 48, 52, ['Canvas', 'Hide', 'Moss'],
    [{ x: -16, y: 0, radius: 14 }, { x: 0, y: 0, radius: 16 }, { x: 16, y: 0, radius: 14 }], isoTent),
  well: isoPropAsset('iso-well', 'Village well', 64, 72, 32, 56, ['Stone', 'Wooden', 'Mossy'],
    [{ x: 0, y: 0, radius: 13 }], isoWell),
};
