import { noise, type AsciiAsset, type AsciiCell } from './types.ts';

/** Isometric buildings for `?view=iso`: a box with two visible walls (front y=+b,
 * side x=+a) and a gabled roof whose ridge runs along world x. Everything is
 * rasterised in screen cells with the same projection as src/game/view.ts:
 *   screenX = X - Y,  screenY = (X + Y) / 3 - Z
 * so the art lines up with the isometric ground exactly. Sizes are world units
 * at scale 1; the anchor is the footprint centre on the ground. */
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
}

const hex = (c: string, f: number, add = 0) => '#' + [1, 3, 5].map(i =>
  Math.max(0, Math.min(255, Math.round(parseInt(c.slice(i, i + 2), 16) * f + add))).toString(16).padStart(2, '0')).join('');

export interface HouseTextures {
  /** Wall texture at (u along the wall, v height); door only on the main front. */
  facade: (u: number, v: number, length: number, seed: number, door: boolean) => [string, string] | null;
  /** Roof texture at local (X along ridge, Y across it). */
  roof: (X: number, Y: number, back: boolean) => [string, string];
}

/** Shared facade/roof textures (used by the isometric sprite and the 3D ray-caster). */
export function houseTextures(s: IsoHouseSpec): HouseTextures {
  const { b, wall: H } = s;
  const storeyH = H / s.storeys;

  /** Facade texture at (u along the wall, v height), before face shading. */
  const facade = (u: number, v: number, length: number, seed: number, door: boolean): [string, string] | null => {
    if (v < 3) return [noise(Math.floor(u), Math.floor(v), 5) > .5 ? '#' : '=', s.stone];
    const storey = Math.floor(v / storeyH); const sv = v - storey * storeyH;
    if (sv < 1.2 && storey > 0) return ['=', s.timber];                                 // floor beam
    if (Math.abs(u % 16) < 1.3 || u < 1.3 || u > length - 1.3) return ['|', s.timber];  // posts and corners
    const bay = Math.floor(u / 16); const bu = u - bay * 16;
    if (door && storey === 0 && Math.abs(u - length / 2) < 3.5 && sv < 13) return [sv > 11 ? '-' : '|', s.door];
    if (bu > 4.5 && bu < 11.5 && sv > storeyH * .32 && sv < storeyH * .32 + 8) {
      const lit = noise(bay, storey, seed) > .45;
      if (Math.abs(bu - 8) < .7 || Math.abs(sv - storeyH * .32 - 4) < .6) return ['+', s.timber]; // window cross
      return [lit ? '#' : '%', lit ? s.window : hex(s.window, .35)];
    }
    const n = noise(Math.floor(u), Math.floor(v), seed + 9);
    return [n > .8 ? ':' : n > .55 ? '.' : n > .3 ? '=' : '-', hex(s.plaster, .92 + n * .12)];
  };

  const roofCell = (X: number, Y: number, back: boolean): [string, string] => {
    if (Math.abs(Y) < 1.6) return ['=', hex(s.roof, back ? .9 : 1.25)];                // ridge cap
    const row = Math.floor(Math.abs(Y) / 2.2);
    const n = noise(Math.floor(X), row, 77);
    const light = (back ? .62 : .95) * (1 - Math.abs(Y) / (b * 3)) + n * .1;
    if (s.thatch) return [n > .5 ? '/' : n > .25 ? '\\' : '|', hex(s.roof, light)];
    return [(Math.floor(X) + row * 2) % 4 === 0 ? '|' : row % 2 ? '=' : '-', hex(s.roof, light + (row % 2) * .05)];
  };
  return { facade, roof: roofCell };
}

export const shadeHex = hex;

export function isoHouse(s: IsoHouseSpec): AsciiAsset {
  const { a, b, wall: H, rise: R } = s;
  const top = Math.ceil((a + b) / 3 + H + R) + 2;
  const halfW = Math.ceil(a + b) + 3;
  const width = halfW * 2 + 1;
  const height = top + Math.ceil((a + b) / 3) + 2;
  const { facade, roof: roofCell } = houseTextures(s);

  const cells: AsciiCell[] = [];
  for (let cy = 0; cy < height; cy++) for (let cx = 0; cx < width; cx++) {
    const sx = cx - halfW + .5; const sy = cy - top + .5;
    let hit: [string, string] | null = null;
    // Painter's order, back to front: back roof, side wall + gable, front wall, front roof.
    const backDen = 2 / 3 - R / b;
    if (backDen > .05) {
      const Y = (sy - sx / 3 + H + R) / backDen; const X = sx + Y;
      if (Y >= -b - 2 && Y <= 0 && X >= -a - 2 && X <= a + 2) hit = roofCell(X, Y, true);
    }
    {
      const Y = a - sx; const z = (a + Y) / 3 - sy;
      const gable = H + R * (1 - Math.abs(Y) / b);
      if (Y >= -b && Y <= b && z >= 0 && z <= gable) {
        const [g, c] = z <= H ? facade(Y + b, z, 2 * b, 31, false)! : (Math.hypot(Y, z - H - R * .45) < 3 ? ['o', s.window] : ['=', s.plaster]);
        hit = [g, hex(c, .66)];                                   // side faces away from the light
      }
    }
    {
      const X = sx + b; const z = (X + b) / 3 - sy;
      if (X >= -a && X <= a && z >= 0 && z <= H) hit = facade(X + a, z, 2 * a, 13, true);
    }
    {
      const Y = (sy - sx / 3 + H + R) / (2 / 3 + R / b); const X = sx + Y;
      if (Y >= 0 && Y <= b + 3 && X >= -a - 2 && X <= a + 2) hit = roofCell(X, Y, false);
    }
    if (hit) cells.push({ x: cx, y: cy, glyph: hit[0], color: hit[1] });
  }

  // Ground footprint: a row of circles along world x covering the whole box.
  const footprint: { x: number; y: number; radius: number }[] = [];
  for (let x = -a + b * .6; x <= a - b * .6 + .01; x += b * .6) footprint.push({ x, y: 0, radius: b * .95 });

  return {
    id: s.id, version: 1, name: s.name, category: 'Prop',
    description: `Isometric ${s.name.toLowerCase()} for the 2.5D view.`,
    width, height, anchor: { x: halfW, y: top },
    variants: ['default'],
    generate: () => cells,
    footprint,
  };
}

/** Building asset id → isometric replacement, and how far its old anchor (the
 * front base) sits in front of the new one (the footprint centre). */
export const HOUSE_SPECS: Readonly<Record<string, IsoHouseSpec>> = {
  townhouse: ({ id: 'iso-townhouse', name: 'Townhouse', a: 38, b: 24, wall: 54, rise: 26, storeys: 2,
    plaster: '#d9c9a6', timber: '#5b3a22', stone: '#8d8679', roof: '#9a3f2c', window: '#ffd27a', door: '#6e4426' }),
  manor: ({ id: 'iso-manor', name: 'Manor', a: 62, b: 34, wall: 78, rise: 34, storeys: 3,
    plaster: '#c9c2b2', timber: '#4a4038', stone: '#7d7a72', roof: '#3f4d6b', window: '#ffe39a', door: '#5a3a26' }),
  tavern: ({ id: 'iso-tavern', name: 'Tavern', a: 52, b: 30, wall: 52, rise: 30, storeys: 2,
    plaster: '#cfa96f', timber: '#4f3220', stone: '#857563', roof: '#6c4a2b', window: '#ffc35c', door: '#7a4a24' }),
  cottage: ({ id: 'iso-cottage', name: 'Cottage', a: 30, b: 22, wall: 28, rise: 24, storeys: 1,
    plaster: '#e0d6ba', timber: '#6b4a2c', stone: '#8a8270', roof: '#b9913f', window: '#ffd27a', door: '#7a5230', thatch: true }),
  hovel: ({ id: 'iso-hovel', name: 'Hovel', a: 24, b: 18, wall: 20, rise: 15, storeys: 1,
    plaster: '#7d5d3c', timber: '#3e2a18', stone: '#5e5244', roof: '#6f5b31', window: '#d9a248', door: '#3a2616', thatch: true }),
};

export const ISO_BUILDINGS: Readonly<Record<string, AsciiAsset>> = Object.fromEntries(Object.entries(HOUSE_SPECS).map(([k, s]) => [k, isoHouse(s)]));
