import { noise, type AsciiAsset, type AsciiCell, type AssetOptions } from '../types.ts';
import type { IsoHouseSpec } from '../isoBuildings.ts';
import { VoxelGrid, renderVoxels, tint } from './voxel.ts';

/** House as a real voxel model: stone foundation, half-timbered walls with relief,
 * windows with sills, a door with steps, a shingled or thatched gable roof with
 * eaves, and a chimney. Long axis is world X; the door faces +Y (visible). */
export function buildHouse(s: IsoHouseSpec, seed: number, ruined: boolean): VoxelGrid {
  const { a, b, wall, rise } = s;
  const eave = 3;
  const g = new VoxelGrid(a + eave + 3, b + eave + 3, Math.ceil(wall + rise + 16));
  const foundation = 4;
  const storeyH = wall / s.storeys;
  const bays = Math.max(2, Math.round((a * 2) / 17));
  const bayW = (a * 2) / bays;
  const sideBays = Math.max(1, Math.round((b * 2) / 17));
  const sideW = (b * 2) / sideBays;

  const stoneAt = (x: number, _y: number, z: number) => {
    const row = Math.floor(z / 2.6);
    const n = noise(Math.floor((x + (row % 2) * 3) / 5), row, seed + 3);
    return tint(s.stone, .74 + n * .34);
  };
  const plasterAt = (x: number, _y: number, z: number) => {
    const n = noise(x >> 1, z >> 1, seed + 5);
    const streak = noise(x, Math.floor(z / 9), seed + 6) * .06;
    return tint(s.plaster, .94 + n * .1 - streak - (z < foundation + 5 ? .06 : 0));
  };
  const timberAt = (x: number, z: number) => tint(s.timber, .8 + noise(x, z, seed + 8) * .35);

  // Facade pattern on a wall plane. u runs along the wall (0..length), v is height.
  // Returns [colour, protrudes, emissive].
  type Tex = { c: string; out: boolean; glow?: boolean };
  const facade = (u: number, v: number, length: number, bayLen: number, doorBay: number, front: boolean, x: number, y: number): Tex => {
    if (v < foundation) return { c: stoneAt(x, y, v), out: false };
    const bay = Math.min(Math.floor(u / bayLen), Math.round(length / bayLen) - 1);
    const lu = u - bay * bayLen;
    const post = lu < 1.6 || lu > bayLen - 1.6;
    const storey = Math.floor((v - foundation) / Math.max(1, storeyH - 1));
    const lv = (v - foundation) - storey * (storeyH - 1);
    const beam = lv < 1.8 || (storey >= s.storeys - 1 && v > wall - 2.2);
    if (v >= wall - .5) return { c: plasterAt(x, y, v), out: false };
    // door
    if (front && storey === 0 && bay === doorBay) {
      const du = lu - bayW / 2; const dv = v - foundation;
      if (Math.abs(du) < 5.2 && dv < 21) {
        const frame = Math.abs(du) > 4 || dv > 19;
        if (frame) return { c: timberAt(x, v), out: true };
        const plank = Math.floor((du + 6) / 2.2);
        const handle = Math.abs(du - 2.6) < .9 && Math.abs(dv - 10) < 1;
        return handle ? { c: '#d4b45a', out: true } : { c: tint(s.door, .82 + noise(plank, 1, seed + 20) * .3), out: false };
      }
    }
    // windows
    if (!(front && storey === 0 && bay === doorBay) || false) {
      const wu = lu - bayLen / 2; const wv = lv - (storey === 0 ? 11 : 9);
      const ww = 4.6; const wh = 6.2;
      if (Math.abs(wu) < ww + 1.2 && Math.abs(wv) < wh + 1.2 && lv > 2) {
        if (Math.abs(wu) < ww && Math.abs(wv) < wh) {
          const lit = noise(bay + storey * 7, front ? 1 : 2, seed + 40) > .35;
          const mullion = Math.abs(wu) < .7 || Math.abs(wv) < .7;
          if (mullion) return { c: timberAt(x, v), out: false };
          return lit ? { c: s.window, out: false, glow: true } : { c: tint(s.window, .28), out: false };
        }
        // frame + sill sticks out
        return { c: timberAt(x, v), out: wv < -wh + .2 || Math.abs(wu) >= ww };
      }
    }
    if (post || beam) return { c: timberAt(x, v), out: true };
    // diagonal brace in the lower bay corners
    const dg = lu - (lv - 2);
    if (lv > 2 && lv < storeyH - 3 && Math.abs(dg - 1) < 1.1 && lu < bayLen * .28) return { c: timberAt(x, v), out: false };
    return { c: plasterAt(x, y, v), out: false };
  };

  const doorBay = Math.floor(bays / 2);

  // Walls up to the underside of the roof.
  const roofTop = (y: number) => wall + rise * (1 - Math.abs(y + .5) / (b + eave + .5));
  for (let x = -a; x < a; x++) for (let y = -b; y < b; y++) {
    const top = Math.floor(roofTop(y) - 2);
    for (let z = 0; z <= top; z++) {
      let c: string;
      const edgeFront = y >= b - 1; const edgeSide = x >= a - 1;
      if (z < foundation) c = stoneAt(x, y, z);
      else if (edgeFront) c = facade(x + a, z, a * 2, bayW, doorBay, true, x, y).c;
      else if (edgeSide) c = facade(y + b, z, b * 2, sideW, -1, false, x, y).c;
      else c = plasterAt(x, y, z);
      const tex = edgeFront ? facade(x + a, z, a * 2, bayW, doorBay, true, x, y) : edgeSide ? facade(y + b, z, b * 2, sideW, -1, false, x, y) : null;
      g.set(x, y, z, c, !!tex?.glow);
    }
  }
  // Relief: timbers, sills and frames protrude one voxel from the front and side faces.
  for (let x = -a; x < a; x++) for (let z = foundation; z < wall; z++) {
    const t = facade(x + a, z, a * 2, bayW, doorBay, true, x, b - 1);
    if (t.out) g.set(x, b, z, t.c);
  }
  for (let y = -b; y < b; y++) for (let z = foundation; z < wall + rise * .6; z++) {
    if (z >= wall && Math.abs(y) > (b + eave) * (1 - (z - wall) / rise)) continue;
    const t = z >= wall ? { c: plasterAt(a, y, z), out: false } : facade(y + b, z, b * 2, sideW, -1, false, a - 1, y);
    if (t.out) g.set(a, y, z, t.c);
  }
  // Door steps.
  const doorX = Math.round(-a + doorBay * bayW + bayW / 2);
  g.box(doorX - 6, doorX + 6, b, b + 2, 0, 2, (x, y, z) => stoneAt(x, y, z));
  g.box(doorX - 7, doorX + 7, b + 2, b + 3, 0, 1, (x, y, z) => stoneAt(x, y, z));

  // Roof: shell above the wall with overhanging eaves and gable fill.
  const roofBase = s.roof;
  for (let x = -a - eave; x < a + eave; x++) for (let y = -b - eave; y < b + eave; y++) {
    const top = roofTop(y);
    const z1 = Math.floor(top);
    for (let z = Math.max(0, Math.floor(top - 2.6)); z <= z1; z++) {
      if (ruined && noise(Math.floor(x / 5), Math.floor(y / 4), seed + 9) < .22) continue;
      if (Math.abs(y + .5) < 1.6 && z >= z1 - 1) { g.set(x, y, z, tint(roofBase, 1.3)); continue; }
      const slope = Math.abs(y + .5);
      const row = Math.floor(slope / 2.3);
      const n = noise(x, row, seed + 11);
      let c: string;
      if (s.thatch) c = tint(roofBase, .72 + noise(x, Math.floor(slope), seed + 12) * .5 + (noise(x >> 1, row, seed + 13) > .7 ? .12 : 0));
      else c = tint(roofBase, .84 + ((Math.floor(x / 3) + row) % 2) * .13 + n * .16);
      g.set(x, y, z, c);
    }
  }
  // Gable infill below the roof on the +X end (already walls) and a round gable window.
  if (rise > 12) for (let y = -2; y <= 2; y++) for (let z = 0; z < 5; z++) {
    if (Math.hypot(y, z - 2) < 2.6) g.set(a - 1, y, wall + rise * .3 + z, s.window, true);
  }
  // Chimney.
  if (s.id !== 'iso-hovel') {
    const cx = Math.round(a * .5); const cy = Math.round(-b * .35);
    g.box(cx - 3, cx + 4, cy - 3, cy + 4, wall * .8, wall + rise + 9, (x, y, z) => stoneAt(x, y, z));
    g.box(cx - 4, cx + 5, cy - 4, cy + 5, wall + rise + 9, wall + rise + 11, tint(s.stone, 1.12));
    g.box(cx - 2, cx + 3, cy - 2, cy + 3, wall + rise + 10, wall + rise + 11, '#161210');
  }
  return g;
}

export function voxelHouse(base: IsoHouseSpec, palette: (s: IsoHouseSpec, variant: number) => IsoHouseSpec): AsciiAsset {
  const { a, b, wall: H } = base;
  const probe = buildHouse(base, 1, false);
  const probeSprite = renderVoxels(probe);
  const footprint: { x: number; y: number; radius: number }[] = [];
  for (let x = -a + b * .6; x <= a - b * .6 + .01; x += b * .6) footprint.push({ x, y: 0, radius: b * .88 });
  return {
    id: base.id, version: 3, name: base.name, category: 'Prop',
    description: `Voxel ${base.name.toLowerCase()} for the isometric view.`,
    width: probeSprite.width, height: probeSprite.height, anchor: probeSprite.anchor,
    variants: ['Standard', 'Weathered', 'Warm'],
    generate: (o: AssetOptions): AsciiCell[] => {
      const spec = palette(base, o.variant);
      const ruined = base.id === 'iso-hovel' && (o.variant % 3) === 1;
      return renderVoxels(buildHouse(spec, o.seed + o.variant * 31, ruined)).cells;
    },
    footprint,
    light: base.id === 'iso-hovel' ? undefined : { x: 0, y: -Math.round(H * .4), radius: Math.round((a + b) * 1.15), color: [1, .64, .28] },
  };
}
