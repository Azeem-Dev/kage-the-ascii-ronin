import type { AsciiAsset, AssetOptions } from '../types.ts';
import { Art, chimney, circlesAlong, clamp, disc, door, eaveShadow, fill, hangingSign, lerp, mix, pick, roof, shade, smoke, steps, stoneFill, timberWall, windowPane, type Pal } from './parts.ts';

const PLASTER: Pal = ['#7e7461', '#a39878', '#c2b58f', '#ddd2ac'];
const STONE: Pal = ['#3c4044', '#5c6064', '#7e8285', '#a2a6a6'];
const WOOD: Pal = ['#2c1f14', '#4a3524', '#6c4e33', '#8c6a45'];
const THATCH: Pal = ['#4a3a20', '#6e5a30', '#917a42', '#b49c5c'];
const SHINGLE: Pal = ['#3e2a1f', '#5e4130', '#7e5a42', '#9c7656'];
const SLATE: Pal = ['#27313f', '#3d4d61', '#586d85', '#7b91a8'];

function def(id: string, name: string, w: number, h: number, ax: number, ay: number, variants: string[], description: string,
  generate: (o: AssetOptions) => import('../types.ts').AsciiCell[], extra: Partial<AsciiAsset> = {}): AsciiAsset {
  return { id, version: 1, name, category: 'Prop', description, width: w, height: h, anchor: { x: ax, y: ay }, variants, generate, ...extra };
}

// ------------------------------------------------------------------ hovel
function hovel(o: AssetOptions) {
  const a = new Art(170, 140, o.seed, o.time); const v = o.variant;
  const gy = 133;
  const mud: Pal = ['#241b14', '#3b2e22', '#58452f', '#76603f'];
  const thatch: Pal = ['#35291a', '#54442a', '#76653c', '#957f4a'];
  const top = (x: number) => 50 + (x - 6) * .1 + (v === 1 && x > 96 ? (x - 96) * .55 : 0);
  // wall of crooked planks
  fill(a, 20, 40, 148, gy, (x, y, _u, vv) => {
    const k = Math.floor((x - 20) / 6); const px = (x - 20) % 6;
    const kn = a.n(k, 1, 40);
    const bottom = gy - Math.floor(a.n(k, 2, 41) * 5);
    if (y > bottom) return null;
    if (v === 1 && x > 112 && a.n(k, 3, 42) < .55 + (x - 112) / 100) return null;
    const lean = Math.floor((kn - .5) * 3);
    if (px === 0) return ['|', '#120d09'];
    const b = .42 + kn * .38 + (a.n(x, y, 43) - .5) * .12 - vv * .06;
    const g = kn < .25 ? '/' : kn > .8 ? '\\' : '|';
    void lean;
    return [a.n(x, y, 44) < .3 ? g : '%', pick(mud, clamp(b))];
  }, (x, y) => y >= top(x) + 30);
  // holes
  for (const [hx, hy, rx, ry] of [[40, 100, 5, 8], [124, 108, 6, 5], [104, 92, 4, 4]] as const) {
    if (v === 1 && hx > 110) continue;
    disc(a, hx + Math.floor(a.n(1, 1, 45) * 4), hy, rx, ry, (_x, _y, d) => d > .72 ? ['x', '#3a2c1e'] : [d > .3 ? '%' : '#', '#080605']);
  }
  // roof (lean-to, tilted slab with overhang)
  fill(a, 4, 40, 166, 120, (x, y, u, vv) => {
    const dy = y - top(x); const n = a.n(x, y, 46);
    if (a.n(Math.floor(x / 12), Math.floor(y / 9), 47) > .84) return [n > .5 ? '=' : 'x', mix('#8a7440', '#4f5c34', n)];
    if (a.n(Math.floor(x / 10), Math.floor(y / 10), 48) < .09 && dy > 8 && dy < 36) return [n > .5 ? '|' : '/', '#16100a'];
    let b = .78 - vv * .04 - dy / 34 * .3 + (n - .5) * .26;
    if (dy % 9 < 2) b -= .2;
    if (dy < 3) b = .95;
    const g = n < .3 ? '|' : u < .5 ? '/' : '\\';
    let c = pick(thatch, clamp(b));
    if (dy > 32) { c = shade(thatch[0], .9); }
    return [dy > 32 || dy < 3 ? '%' : g, c];
  }, (x, y) => y >= top(x) && y <= top(x) + 34 && x >= 5 && x <= 165 && !(v === 1 && x > 140 && y > top(x) + 18));
  // ragged thatch hem
  for (let x = 6; x < 164; x += 3) { const l = 2 + Math.floor(a.n(x, 5, 49) * 6); for (let t = 0; t < l; t++) a.put(x, top(x) + 34 + t, '|', mix('#6a5836', '#2a2014', t / 7)); }
  // rag door
  door(a, 66, 88, 24, gy - 88, { plank: mud, frame: '#2a1f16', rag: '#7a4a3a' });
  // propped stick + bucket
  a.s.line(28, gy, 36, 84, '#4a3a28', '/'); a.s.line(29, gy, 37, 84, '#3a2c20', '/');
  fill(a, 148, gy - 12, 158, gy, (x, y, _u, vv) => ['#', shade('#5a4a38', .7 + a.n(x, y, 50) * .3 - vv * .2)], (x, y) => y > gy - 12 + (x - 148) * .15);
  if (v === 1) { // rubble and leaning beam
    for (let i = 0; i < 60; i++) {
      const rx = 108 + Math.floor(a.n(i, 1, 51) * 52); const ry = gy - Math.floor(a.n(i, 2, 52) * (12 - Math.abs(rx - 134) * .3));
      const c = a.n(i, 3, 53); a.put(rx, ry, c < .4 ? '#' : c < .7 ? 'x' : '%', c < .5 ? '#6a5640' : '#3e3228');
    }
    a.s.line(150, gy - 2, 118, 70, '#5a4632', '/'); a.s.line(151, gy - 2, 119, 70, '#40301f', '/'); a.s.line(152, gy - 2, 120, 70, '#2c2016', '/');
  }
  if (v === 2) { // fire pit
    const cx = 130; const cy = gy - 3;
    disc(a, cx, cy, 20, 6, (x, y, d) => d > .45 ? ['O', pick(['#4a4a46', '#6a6a64', '#8c8c84'], a.n(x, y, 54))] : ['x', '#1c140f']);
    for (let i = 0; i < 9; i++) {
      const f = Math.sin(o.time * 8 + i * 2.1) * .5 + .5; const h = 4 + f * 9 * (1 - Math.abs(i - 4) / 6);
      for (let t = 0; t < h; t++) a.put(cx - 8 + i * 2, cy - 1 - t, t > h - 3 ? '^' : '*', t > h - 3 ? '#ffd060' : '#e8742a');
    }
    for (let i = 0; i < 4; i++) a.put(cx - 6 + i * 4, cy, '%', '#ff9a40');
  }
  return a.frame();
}

// ------------------------------------------------------------------ cottage
function cottage(o: AssetOptions) {
  const a = new Art(200, 200, o.seed, o.time); const v = o.variant;
  const gy = 192;
  // wall
  timberWall(a, 28, 104, 172, gy, PLASTER, '#3e2a1a', { panel: 36, braces: true });
  // stone plinth
  stoneFill(a, 28, gy - 9, 172, gy, STONE, { course: 5, bw: 10 });
  // roof
  roof(a, { kind: 'thatch', yTop: 42, yBot: 112, topL: 66, topR: 134, botL: 12, botR: 188, pal: THATCH, patches: v === 0 && a.n(1, 1, 60) > .5 });
  chimney(a, 138, 26, 70, 18, STONE);
  eaveShadow(a, 30, 170, 113, 5);
  for (const wx of [48, 126]) windowPane(a, wx, 126, 28, 30, { lit: v === 2, shutter: v === 1 ? '#5a7d4c' : '#6b4c32', box: v === 1, frame: '#e2d8b8' });
  door(a, 86, 134, 28, gy - 134, { plank: WOOD, frame: '#3a2818', bands: true });
  steps(a, 80, 120, gy + 6, 1, STONE);
  if (v === 2) { // warm light spill at the door and lantern
    a.put(122, 150, 'O', '#ffd27a'); a.put(122, 151, '#', '#ffb84a');
  }
  smoke(a, 147, 22, 14, 22);
  return a.frame();
}

// ------------------------------------------------------------------ townhouse
function townhouse(o: AssetOptions) {
  const a = new Art(210, 250, o.seed, o.time); const v = o.variant;
  const gy = 242;
  const sh = ['#2f64a8', '#a63a32', '#3f8248'][v];
  const plaster: Pal = v === 1 ? ['#8a7a66', '#ae9e82', '#cdbf9c', '#e6dab8'] : v === 2 ? ['#7a8068', '#9fa586', '#c0c6a2', '#dcdfbc'] : PLASTER;
  stoneFill(a, 26, 174, 184, gy, STONE, { course: 8, bw: 18 });
  timberWall(a, 20, 108, 190, 176, plaster, '#33231a', { panel: 40, braces: false, sill: 7 });
  // jetty joists
  fill(a, 20, 172, 190, 180, (x, y, _u, vv) => [(x % 6 < 2) ? '|' : '#', shade('#3a2a1c', .8 + a.n(x, y, 61) * .3 - vv * .3)]);
  roof(a, { kind: 'shingle', yTop: 50, yBot: 114, topL: 70, topR: 140, botL: 8, botR: 202, pal: SHINGLE });
  chimney(a, 148, 32, 80, 18, STONE);
  eaveShadow(a, 22, 188, 115, 5);
  for (const wx of [46, 138]) windowPane(a, wx, 128, 26, 34, { shutter: sh, frame: '#e2d8b8' });
  windowPane(a, 92, 128, 26, 34, { frame: '#e2d8b8', shutter: undefined });
  windowPane(a, 42, 196, 26, 30, { frame: '#cfc9b8', glass: '#22303c', box: v === 2 });
  windowPane(a, 142, 196, 26, 30, { frame: '#cfc9b8', glass: '#22303c' });
  door(a, 90, 192, 32, gy - 192, { plank: v === 0 ? ['#16304e', '#24507f', '#3a73aa'] : v === 1 ? ['#4a1512', '#7a2a24', '#a8483c'] : ['#173a1c', '#2c6234', '#4a8a52'], frame: '#c9c1a6', bands: true });
  steps(a, 82, 130, gy + 6, 2, STONE);
  smoke(a, 157, 28, 14, 24);
  return a.frame();
}

// ------------------------------------------------------------------ manor
function banner(a: Art, x: number, y0: number, h: number, colour: string, trim: string): void {
  fill(a, x - 1, y0 - 3, x + 13, y0 - 1, (px, py) => ['=', shade('#caa44a', .8 + a.n(px, py, 70) * .3)]);
  fill(a, x, y0, x + 12, y0 + h, (px, py, u, vv) => {
    const n = a.n(px, py, 71);
    const edge = u < .1 || u > .9;
    const tail = py - y0 > h - 6 && Math.abs(u - .5) < (py - (y0 + h - 6)) / 14;
    if (tail) return null;
    if (Math.abs(u - .5) < .2 && Math.abs(vv - .4) < .12) return ['#', trim];
    return [n < .3 ? '%' : '#', shade(edge ? trim : colour, .8 + n * .3 - vv * .15)];
  });
}
function manor(o: AssetOptions) {
  const a = new Art(300, 270, o.seed, o.time); const v = o.variant;
  const gy = 262;
  const stone: Pal = v === 2 ? ['#6a6e74', '#9498a0', '#bcbfc4', '#dcdedf'] : v === 1 ? ['#4a4a46', '#6d6c64', '#908e82', '#b4b2a0'] : ['#3a3e44', '#585c64', '#7a7f86', '#9fa4a8'];
  const slate: Pal = v === 2 ? ['#3d5c78', '#5c84a4', '#84acc8', '#aacce0'] : v === 1 ? ['#233a36', '#35574f', '#4c7a6e', '#6c9c8e'] : SLATE;
  const flag = v === 0 ? '#9a2630' : v === 1 ? '#2f6a4a' : '#e4e0d4';
  const trim = v === 0 ? '#d2aa48' : v === 1 ? '#d2aa48' : '#8aa4c4';
  stoneFill(a, 36, 126, 264, gy, stone, { course: 9, bw: 20, tone: .6 });
  fill(a, 36, 126, 264, 131, (x, y) => ['=', shade(stone[2], .8 + a.n(x, y, 72) * .3)]);
  fill(a, 36, 184, 264, 187, (x, y) => ['=', shade(stone[2], .75 + a.n(x, y, 73) * .3)]);
  // main roof + central gable porch block
  roof(a, { kind: 'slate', yTop: 54, yBot: 132, topL: 84, topR: 216, botL: 18, botR: 282, pal: slate });
  eaveShadow(a, 38, 262, 133, 6);
  chimney(a, 62, 44, 98, 20, stone); chimney(a, 218, 44, 98, 20, stone);
  smoke(a, 71, 40, 10, 22);
  // central porch
  stoneFill(a, 110, 100, 190, gy, stone, { course: 9, bw: 20, tone: .72 });
  a.s.polygon([[100, 102], [150, 62], [200, 102]], slate, .95, '#=+x%#');
  fill(a, 100, 62, 200, 104, (x, y) => {
    const t = (y - 62) / 40; const hw = t * 50 + 2;
    if (Math.abs(x - 150) > hw) return null;
    const n = a.n(x, y, 74); const row = Math.floor((y - 62) / 5);
    const dark = (y - 62) % 5 === 4;
    let b = .78 - t * .15 - (x - 100) / 100 * .1 + (a.n(row, Math.floor(x / 8), 75) - .5) * .2 - (dark ? .26 : 0);
    if (Math.abs(x - 150) > hw - 1.5 || y > 102) return ['%', shade(slate[0], .7)];
    return ['#', pick(slate, clamp(b + (n - .5) * .08))];
  });
  fill(a, 100, 62, 200, 66, (x, y) => Math.abs(x - 150) < (y - 62 + 2) * 1.2 ? ['=', '#d6d8da'] : null);
  // pediment emblem
  if (v === 2) { // temple: round window and spire cross
    disc(a, 150, 84, 9, 9, (x, y, d) => d > .6 ? ['#', '#d8dadc'] : ['#', mix('#8aa8c8', '#e8f0ff', a.n(x, y, 76))]);
    for (let t = 0; t < 22; t++) a.put(150, 62 - t, '#', '#d8d0a8');
    for (let t = -5; t <= 5; t++) a.put(150 + t, 48, '#', '#d8d0a8');
  } else disc(a, 150, 86, 7, 7, (x, y, d) => d > .55 ? ['#', trim] : ['%', shade(flag, .85 + a.n(x, y, 77) * .2)]);
  // columns
  for (const cx of [116, 176]) fill(a, cx, 110, cx + 9, gy - 8, (x, y, u) => ['|', pick(['#7e8286', '#a8aaac', '#d0d2d2', '#a0a2a4'], clamp(u * .9 + .1 + (a.n(x, y, 78) - .5) * .1))]);
  fill(a, 112, 104, 190, 111, (x, y) => ['=', shade('#c4c6c6', .8 + a.n(x, y, 79) * .25)]);
  // door
  door(a, 132, 168, 36, gy - 168, { plank: ['#2a1810', '#4a2c1c', '#6c4430'], frame: '#c4c6c4', arched: true, double: true, bands: true, handle: '#d2aa48' });
  steps(a, 108, 192, gy + 6, 3, stone);
  // windows
  for (const wx of [50, 90, 200, 240]) {
    windowPane(a, wx, 140, 22, 34, { frame: '#d8d6cc', glass: '#1e2c3c', round: true });
    windowPane(a, wx, 206, 22, 34, { frame: '#d8d6cc', glass: '#1e2c3c' });
  }
  windowPane(a, 139, 118, 22, 0 + 28, { frame: '#d8d6cc', glass: '#1e2c3c' });
  // banners on the porch
  banner(a, 96, 148, 52, flag, trim); banner(a, 192, 148, 52, flag, trim);
  void lerp;
  return a.frame();
}

// ------------------------------------------------------------------ tavern
function tavern(o: AssetOptions) {
  const a = new Art(280, 260, o.seed, o.time); const v = o.variant;
  const gy = 252; const boarded = v === 2;
  const plaster: Pal = boarded ? ['#4e4a40', '#6a6556', '#847e6a', '#a09882'] : ['#8a7658', '#b09a74', '#cdb88e', '#e6d8ac'];
  const beam = boarded ? '#241a12' : '#3c2818';
  timberWall(a, 40, 116, 240, 178, plaster, beam, { panel: 40, braces: true, sill: 6 });
  stoneFill(a, 40, 178, 240, gy, boarded ? ['#34363a', '#4a4d50', '#64676a', '#808382'] : STONE, { course: 8, bw: 18, tone: .55 });
  fill(a, 34, 174, 246, 181, (x, y, _u, vv) => [(x % 6 < 2) ? '|' : '#', shade('#3a2a1c', .8 + a.n(x, y, 80) * .3 - vv * .3)]);
  roof(a, { kind: 'shingle', yTop: 52, yBot: 122, topL: 86, topR: 194, botL: 14, botR: 266, pal: boarded ? ['#2a2420', '#3e3630', '#554a40', '#6c5e50'] : ['#4a2a22', '#703e30', '#96563f', '#b87450'], holes: boarded ? .15 : 0 });
  eaveShadow(a, 42, 238, 123, 5);
  chimney(a, 196, 34, 88, 20, STONE);
  if (!boarded) smoke(a, 206, 30, v === 0 ? 16 : 7, 26);
  const lit = (i: number) => v === 0 || (v === 1 && i % 2 === 0);
  [[58, 134], [118, 134], [178, 134]].forEach(([x, y], i) => windowPane(a, x, y, 28, 30, { lit: lit(i), shutter: boarded ? undefined : '#3a5a3c', boarded }));
  [[50, 196], [204, 196]].forEach(([x, y], i) => windowPane(a, x, y, 28, 32, { lit: lit(i + 1), frame: '#cfc3a8', boarded }));
  door(a, 108, 192, 42, gy - 192, { plank: boarded ? ['#1e1812', '#30261c', '#463a2c'] : ['#2a1a10', '#4a2e1c', '#6c4630'], frame: '#c9bda0', double: true, bands: true, boarded });
  steps(a, 98, 160, gy + 6, 2, STONE);
  if (!boarded) { // lantern by the door
    fill(a, 94, 190, 98, 200, (x, y) => ['#', mix('#ffb84a', '#fff0b0', a.n(x, y, 81))]);
    fill(a, 93, 188, 99, 189, () => ['=', '#2a2a2c']);
  }
  hangingSign(a, 40, 128, 26, 30, boarded ? '#4a3c30' : '#6b3a22', 'mug');
  if (v === 2) { // broken sign and sagging
    for (let i = 0; i < 12; i++) a.put(24 + a.n(i, 0, 82) * 6, 154 + i, '|', '#201812');
  }
  // barrels by the door
  const barrels = v === 2 ? 1 : v === 0 ? 3 : 2;
  for (let i = 0; i < barrels; i++) {
    const bx = 168 + i * 22 - (i === 2 ? 11 : 0); const by = gy - (i === 2 ? 26 : 0);
    disc(a, bx, by - 15, 12, 17, (x, y, _d, nx) => {
      const n = a.n(x, y, 83); const hoop = Math.abs((y - (by - 15)) % 12) < 1.2;
      return [hoop ? '=' : (x + y) % 5 === 0 ? '|' : '#', hoop ? '#33343a' : pick(WOOD, clamp(.62 - nx * .3 + (n - .5) * .15))];
    });
  }
  return a.frame();
}

const wallFoot = (ax: number, ay: number, x0: number, x1: number, y: number, r: number) => circlesAlong(ax, ay, x0, x1, y, r, 1.4);

export const HOUSES: readonly AsciiAsset[] = [
  def('hovel', 'Hovel', 170, 140, 85, 133, ['Intact', 'Collapsing', 'Fire pit'], 'Poor crooked-plank lean-to with patched thatch, holes and a rag door.', hovel,
    { footprint: wallFoot(85, 133, 26, 144, 125, 9) }),
  def('cottage', 'Cottage', 200, 200, 100, 192, ['Plain', 'Flower boxes', 'Lit at night'], 'Village timber-frame cottage with thatch roof, chimney and two windows.', cottage,
    { footprint: wallFoot(100, 192, 34, 166, 182, 10), light: { x: 0, y: -45, radius: 110, color: [1, .66, .3] } }),
  def('townhouse', 'Townhouse', 210, 250, 105, 242, ['Blue shutters', 'Red', 'Green'], 'Two-storey town house, stone ground floor, jettied timber upper floor, shingle roof.', townhouse,
    { footprint: wallFoot(105, 242, 32, 178, 232, 11) }),
  def('manor', 'Manor', 300, 270, 150, 262, ["Lord's manor", 'Merchant guild', 'Temple'], 'Rich stone hall with slate roof, symmetrical windows, grand arched door and banners.', manor,
    { footprint: wallFoot(150, 262, 42, 258, 250, 13) }),
  def('tavern', 'Tavern', 280, 260, 140, 252, ['Busy', 'Quiet', 'Boarded up'], 'Two-storey inn with hanging sign, lit windows and barrels by the door.', tavern,
    { footprint: wallFoot(140, 252, 46, 236, 242, 12), light: { x: 0, y: -80, radius: 150, color: [1, .64, .28] } }),
];
