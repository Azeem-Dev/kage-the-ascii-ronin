import type { AsciiAsset, AsciiCell, AssetOptions } from '../types.ts';
import {
  Art, barrel, circlesAlong, clamp, crate, disc, fill, flame, lantern, mix, pick, pole,
  roof, shade, stoneFill, type Pal,
} from './parts.ts';

const WOOD: Pal = ['#241a12', '#463222', '#6d4e32', '#94704a'];
const LIGHT_WOOD: Pal = ['#3a2b1d', '#655039', '#927650', '#b59868'];
const STONE: Pal = ['#343a40', '#555e64', '#7c8588', '#a7aeaa'];
const DARK_STONE: Pal = ['#2b3034', '#454c50', '#686f70', '#8b918c'];
const IRON: Pal = ['#1c2228', '#303941', '#505e68', '#77848b'];
const WARM: readonly [number, number, number] = [1, .62, .26];

function def(id: string, name: string, w: number, h: number, ax: number, ay: number,
  variants: readonly string[], description: string, generate: (o: AssetOptions) => AsciiCell[],
  extra: Partial<AsciiAsset> = {}): AsciiAsset {
  return { id, version: 1, name, category: 'Prop', description, width: w, height: h, anchor: { x: ax, y: ay }, variants, generate, ...extra };
}

function variant3(v: number): number { return ((Math.floor(v) % 3) + 3) % 3; }
function finish(a: Art, o: AssetOptions): AsciiCell[] { return a.s.frame(o.facing === 'left'); }

// ------------------------------------------------------------------ market stall
function marketStall(o: AssetOptions): AsciiCell[] {
  const a = new Art(150, 130, o.seed, o.time);
  const v = variant3(o.variant);
  const awning = [
    ['#8e2e2b', '#e7ddd0'],
    ['#28578c', '#e8e4d8'],
    ['#3f713e', '#e0c75d'],
  ][v];
  const lean = (a.n(1, 1, 150) - .5) * 2;

  // Four legs and the broad counter are kept straight: this is skilled town craft.
  for (const x of [24, 126]) pole(a, x + lean, 39, 119, 3, WOOD, { noiseK: 151 });
  fill(a, 18, 88, 132, 119, (x, y, _u, vv) => {
    const seam = (x - 18) % 9 === 0;
    return [seam ? '|' : y > 113 ? '%' : '#', shade(WOOD[seam ? 1 : 2], .8 + a.n(x, y, 152) * .28 - vv * .18)];
  });
  fill(a, 15, 84, 135, 92, (x, y) => ['=', shade(LIGHT_WOOD[2], .78 + a.n(x, y, 153) * .3)]);
  a.s.line(17, 85, 133, 85, '#c1a578', '=');

  // Sloped striped canvas, with a scalloped valance facing the viewer.
  fill(a, 6, 27, 144, 66, (x, y) => {
    const stripe = Math.floor((x - 6) / 12);
    const front = 57 + (stripe % 2 === 0 ? 0 : 3);
    const back = 29 + (x < 20 || x > 130 ? 5 : 0);
    if (y < back || y > front) return null;
    const n = a.n(x, y, 154);
    const c = shade(awning[stripe % 2], .84 + (1 - (y - back) / Math.max(1, front - back)) * .17 + (n - .5) * .1);
    return [y > front - 2 ? '=' : x % 12 === 0 ? '|' : '#', c];
  });
  for (const x of [24, 126]) a.s.line(x, 65, x, 84, shade(WOOD[1], .9), '|');

  if (v === 0) {
    // Fruit: three overflowing baskets, with seeded produce placement.
    for (let b = 0; b < 3; b++) {
      const bx = 43 + b * 32 + Math.round((a.n(b, 1, 155) - .5) * 3);
      disc(a, bx, 88, 14, 7, (x, y, d, _nx, _ny) => [d > .62 ? '=' : '#', shade(WOOD[1 + (a.n(x, y, 156) > .5 ? 1 : 0)], .82 + a.n(x, y, 157) * .22)]);
      for (let i = 0; i < 15; i++) {
        const fx = bx + Math.round((a.n(i, b, 158) - .5) * 22);
        const fy = 77 + Math.round(a.n(i, b + 3, 159) * 8);
        const ripe = a.n(i, b + 6, 160);
        a.put(fx, fy, ripe > .76 ? '*' : 'o', ripe < .34 ? '#c94b36' : ripe < .68 ? '#e2b541' : '#729346');
      }
    }
  } else if (v === 1) {
    // Cloth: folded bolts in blue, cream and madder red.
    const cloth = ['#365f86', '#d7c9a4', '#9b4b42', '#53775b'];
    for (let row = 0; row < 3; row++) for (let i = 0; i < 3; i++) {
      const x = 29 + i * 34 + Math.round((a.n(i, row, 161) - .5) * 2);
      const y = 75 - row * 7;
      fill(a, x, y, x + 30, y + 7, (px, py, u) => [py === y + 6 ? '=' : u < .12 ? '|' : '#', shade(cloth[(i + row) % cloth.length], .82 + u * .14 + a.n(px, py, 162) * .08)]);
    }
  } else {
    // Fish: silver bodies and dark tails on a shallow wet tray.
    fill(a, 27, 79, 123, 93, (x, y) => [y > 89 ? '=' : '#', shade('#52656a', .75 + a.n(x, y, 163) * .3)]);
    for (let i = 0; i < 8; i++) {
      const fx = 34 + (i % 4) * 23 + Math.round((a.n(i, 1, 164) - .5) * 3);
      const fy = 82 + Math.floor(i / 4) * 8;
      const dir = i % 2 ? 1 : -1;
      a.s.line(fx - 6 * dir, fy, fx + 5 * dir, fy, '#b8c7c3', '=');
      a.put(fx + 6 * dir, fy, dir > 0 ? '>' : '<', '#788f91');
      a.put(fx - 1 * dir, fy - 1, '/', '#d7ded6');
      a.put(fx + 2 * dir, fy + 1, '#', '#8fa5a5');
    }
  }

  // Small hanging price tags make the counter read at game scale.
  for (const x of [38, 75, 112]) {
    a.s.line(x, 66, x, 73, '#3b3023', '|');
    a.put(x, 74, '#', '#d8c89d'); a.put(x, 75, '=', '#b8a276');
  }
  return finish(a, o);
}

// ------------------------------------------------------------------ well
function well(o: AssetOptions): AsciiCell[] {
  const a = new Art(130, 170, o.seed, o.time);
  const v = variant3(o.variant);
  const masonry: Pal = v === 1 ? LIGHT_WOOD : v === 2 ? ['#333c36', '#526052', '#77816b', '#9ca087'] : STONE;
  roof(a, { kind: 'shingle', yTop: 22, yBot: 61, topL: 52, topR: 78, botL: 13, botR: 117, pal: v === 1 ? WOOD : ['#332b22', '#574834', '#806a4b', '#a28a60'] });
  // Uprights and the crossbar sit behind the well head.
  for (const x of [31, 99]) pole(a, x, 51, 158, v === 1 ? 4 : 3, v === 1 ? WOOD : masonry, { noiseK: 170 + v });
  a.s.line(31, 63, 99, 63, shade(masonry[1], .9), '=');
  a.s.line(32, 64, 98, 64, shade(masonry[0], .9), '=');

  // Deep opening first, then a ring of masonry/staves in front of it.
  disc(a, 65, 128, 28, 13, (_x, _y, d) => [d > .7 ? ':' : '%', d > .7 ? '#273338' : '#0e1519']);
  disc(a, 65, 139, 38, 25, (x, y, d, nx, ny) => {
    if (d < .42) return null;
    const n = a.n(x, y, 175 + v);
    if (v === 1) {
      const stave = (x - 27) % 7 === 0;
      return [stave ? '|' : d > .84 ? '%' : '#', pick(masonry, clamp(.68 - nx * .25 - ny * .1 + (n - .5) * .15))];
    }
    const moss = v === 2 && a.n(Math.floor(x / 4), Math.floor(y / 4), 178) > .69;
    return [moss ? '&' : n < .35 ? 'o' : '#', moss ? mix('#4d6b3e', '#7b8c55', n) : pick(masonry, clamp(.7 - nx * .22 - ny * .1 + (n - .5) * .17))];
  });
  disc(a, 65, 128, 37, 15, (x, y, d, nx, _ny) => {
    if (d < .43) return null;
    const n = a.n(x, y, 180);
    const moss = v === 2 && nx < -.25 && a.n(Math.floor(x / 3), Math.floor(y / 3), 181) > .6;
    return [d > .82 ? '=' : moss ? '&' : '#', moss ? '#68804b' : shade(masonry[2], .77 + (1 - nx) * .12 + (n - .5) * .14)];
  });
  // Two iron hoops make the wooden version unmistakable.
  if (v === 1) {
    for (const yy of [136, 151]) a.s.line(31, yy, 99, yy, '#34383b', '=');
  }

  // Bucket, rope and winding handle.
  a.s.line(83, 64, 83, 106, '#b5a77f', '|');
  a.s.line(84, 65, 84, 106, '#6e6249', '|');
  a.s.line(76, 107, 83, 100, '#a19572', '/');
  a.s.line(83, 100, 91, 107, '#a19572', '\\');
  fill(a, 75, 105, 92, 124, (x, y, u, vv) => {
    if (y < 105 + Math.abs(u - .5) * 7) return null;
    return [x === 75 || x === 92 || y > 121 ? '=' : '#', shade(WOOD[1], .76 + a.n(x, y, 182) * .25 - vv * .12)];
  });
  a.s.line(76, 116, 91, 116, '#35383a', '=');
  a.s.line(101, 128, 111, 128, '#34383b', '=');
  a.s.line(111, 128, 111, 142, '#34383b', '|');
  a.put(108, 143, 'o', '#8e7043');
  return finish(a, o);
}

// ------------------------------------------------------------------ fence
function fence(o: AssetOptions): AsciiCell[] {
  const a = new Art(80, 74, o.seed, o.time);
  const v = variant3(o.variant);
  const base = 66;
  const posts = [10, 40, 70];
  const wood: Pal = v === 1 ? ['#2b2419', '#4d432d', '#74613e', '#978055'] : WOOD;

  for (let i = 0; i < posts.length; i++) {
    const x = posts[i];
    const top = (v === 2 ? 6 : 12) + Math.round(a.n(i, 1, 190) * 3);
    if (v === 2) {
      pole(a, x, top + 8, base, 3, IRON, { noiseK: 191, iron: true });
      fill(a, x - 5, base - 5, x + 5, base, (px, py) => ['#', shade(IRON[1], .72 + a.n(px, py, 192) * .3)]);
      a.s.polygon([[x - 4, top + 9], [x, top], [x + 4, top + 9]], IRON, .92, '.,:;+=x#');
    } else {
      pole(a, x, top, base, v === 0 ? 3 : 4, wood, { noiseK: 193 + i });
      fill(a, x - 5, base - 4, x + 5, base, (px, py) => ['#', shade(wood[0], .76 + a.n(px, py, 194) * .28)]);
      a.put(x, top - 2, v === 0 ? '^' : 'x', shade(wood[2], .9));
    }
  }

  if (v === 2) {
    // Rich iron: upright spears, two rails and restrained gold-coloured finials.
    for (let x = 15; x <= 66; x += 6) {
      const top = 21 + Math.round(a.n(x, 1, 195) * 3);
      pole(a, x, top + 4, 62, 1, IRON, { noiseK: 196, iron: true });
      a.put(x, top, '^', shade(IRON[3], .9));
    }
    for (const y of [31, 55]) {
      a.s.line(10, y, 70, y, IRON[2], '=');
      a.s.line(10, y + 2, 70, y + 2, IRON[0], '=');
    }
  } else if (v === 0) {
    // Wooden: two thick, slightly weathered rails.
    for (const y of [34, 53]) {
      fill(a, 10, y, 70, y + 5, (x, yy) => [yy === y || yy === y + 5 ? '=' : (x + yy) % 11 === 0 ? '|' : '#', shade(wood[1], .78 + a.n(x, yy, 197) * .3 - (yy - y) * .035)]);
    }
  } else {
    // Wattle: forked uprights woven with thin, irregular hazel rods.
    for (let x = 13; x < 69; x += 5) {
      const top = 19 + Math.round(a.n(x, 2, 198) * 8);
      a.s.line(x, 62, x + (x % 10 ? 2 : -2), top, shade(wood[1], .82 + a.n(x, 3, 199) * .25), x % 2 ? '/' : '\\');
    }
    for (const y of [28, 41, 54, 63]) {
      a.s.line(11, y, 69, y + Math.round((a.n(y, 1, 200) - .5) * 3), shade(wood[2], .84), '=');
      a.s.line(11, y + 2, 69, y + 2, shade(wood[0], .92), '=');
    }
  }
  return finish(a, o);
}

// ------------------------------------------------------------------ cart
function cartWheel(a: Art, cx: number, cy: number, r: number): void {
  disc(a, cx, cy, r, r, (x, y, d, nx, _ny) => {
    const n = a.n(x, y, 210);
    return [d > .78 ? '=' : d > .64 ? '|' : '#', d > .78 ? '#252728' : shade(WOOD[1], .64 + n * .28 - nx * .08)];
  });
  for (let i = 0; i < 10; i++) {
    const ang = i * Math.PI * 2 / 10;
    a.s.line(cx, cy, cx + Math.cos(ang) * r * .77, cy + Math.sin(ang) * r * .77, shade(WOOD[2], .9), i % 2 ? '/' : '\\');
  }
  disc(a, cx, cy, 5, 5, (x, y, d) => [d > .5 ? '=' : '#', shade(IRON[1], .82 + a.n(x, y, 211) * .22)]);
}

function cart(o: AssetOptions): AsciiCell[] {
  const a = new Art(150, 108, o.seed, o.time);
  const v = variant3(o.variant);
  // Shafts and wheels are behind the bed.
  a.s.line(121, 68, 147, 82, WOOD[1], '='); a.s.line(121, 71, 147, 85, WOOD[0], '=');
  a.s.line(120, 79, 146, 94, WOOD[1], '='); a.s.line(120, 82, 146, 97, WOOD[0], '=');
  cartWheel(a, 42, 80, 22); cartWheel(a, 111, 80, 22);
  fill(a, 25, 74, 128, 87, (x, y) => [(x - 25) % 10 === 0 ? '|' : '#', shade(WOOD[1], .72 + a.n(x, y, 212) * .3 - (y - 74) * .025)]);
  // Open bed and its back/side boards.
  fill(a, 30, 53, 124, 77, (x, y, _u, vv) => [y < 57 ? '=' : (x - 30) % 9 === 0 ? '|' : '#', shade(WOOD[1], .65 + a.n(x, y, 213) * .28 - vv * .08)]);
  fill(a, 32, 57, 121, 73, (x, y) => [(x - 32) % 9 === 0 ? '|' : y > 69 ? '=' : ':', shade(WOOD[0], .78 + a.n(x, y, 214) * .22)]);
  a.s.line(28, 52, 126, 52, shade(WOOD[3], .9), '=');
  a.s.line(28, 77, 128, 77, shade(WOOD[2], .9), '=');
  for (const x of [31, 67, 103, 122]) a.s.line(x, 53, x, 78, shade(WOOD[0], .9), '|');

  if (v === 1) {
    // A high loose hay load with directional straw marks.
    fill(a, 33, 43, 120, 68, (x, y, _u, vv) => {
      const top = 45 + Math.abs(x - 76) * .12 + Math.round(a.n(Math.floor(x / 5), 1, 215) * 4);
      if (y < top) return null;
      const n = a.n(x, y, 216);
      return [n < .22 ? '|' : (x + y) % 4 === 0 ? '/' : n > .78 ? '*' : '#', pick(['#594a28', '#8a743b', '#b59a50', '#d2b766'], clamp(.78 - vv * .26 + (n - .5) * .28))];
    });
    for (let i = 0; i < 16; i++) {
      const x = 38 + Math.round(a.n(i, 1, 217) * 78); const y = 48 + Math.round(a.n(i, 2, 218) * 15);
      a.put(x, y, '/', '#d7c274');
    }
  } else if (v === 2) {
    crate(a, 39, 46, 34, 31, LIGHT_WOOD, { noiseK: 219 });
    crate(a, 79, 49, 34, 28, WOOD, { noiseK: 220 });
    crate(a, 59, 30, 31, 25, LIGHT_WOOD, { noiseK: 221 });
  }
  return finish(a, o);
}

// ------------------------------------------------------------------ haystack
function haystack(o: AssetOptions): AsciiCell[] {
  const a = new Art(120, 104, o.seed, o.time);
  const v = variant3(o.variant);
  const pal: Pal = v === 1 ? ['#3e3825', '#625936', '#887747', '#aa9357'] : ['#4f4527', '#7e6c35', '#aa9148', '#ceb461'];
  const rx = 44 + Math.round(a.n(1, 1, 230) * 4);
  const ry = v === 1 ? 37 : 42;
  const cy = 94 - ry;
  disc(a, 60, cy, rx, ry, (x, y, _d, nx, ny) => {
    const n = a.n(x, y, 231);
    const band = Math.abs(ny - .05) < .055 || Math.abs(ny - .48) < .05;
    if (band) return ['=', shade('#3f3825', .82 + n * .22)];
    const straw = (x + Math.floor(y * .7)) % 5 === 0;
    return [straw ? '/' : n < .18 ? '|' : n > .82 ? '*' : '#', pick(pal, clamp(.76 - ny * .17 - nx * .09 + (n - .5) * .25))];
  });
  // A bound top keeps the round mass from reading as a featureless yellow blob.
  a.s.line(57, cy - ry + 5, 64, cy - ry + 2, '#6a5931', '=');
  if (v === 1) {
    for (let i = 0; i < 20; i++) {
      const x = 27 + Math.round(a.n(i, 1, 232) * 66); const y = 48 + Math.round(a.n(i, 2, 233) * 35);
      a.put(x, y, a.n(i, 3, 234) > .5 ? 'x' : ':', shade(pal[0], .82));
    }
  } else {
    for (let i = 0; i < 24; i++) {
      const x = 22 + Math.round(a.n(i, 1, 235) * 76); const y = 28 + Math.round(a.n(i, 2, 236) * 58);
      a.put(x, y, a.n(i, 3, 237) > .55 ? '*' : '/', '#ddc777');
    }
  }
  if (v === 2) {
    // Pitchfork planted deeply in the stack.
    a.s.line(27, 94, 38, 23, '#685239', '|'); a.s.line(29, 94, 40, 23, '#3d3022', '|');
    a.s.line(31, 24, 46, 24, '#8a8271', '=');
    for (const x of [32, 38, 44]) a.s.line(x, 24, x - 2, 37, '#777b75', '|');
  }
  return finish(a, o);
}

// ------------------------------------------------------------------ barrels and crates
function barrels(o: AssetOptions): AsciiCell[] {
  const a = new Art(120, 108, o.seed, o.time);
  const v = variant3(o.variant);
  if (v === 0) {
    barrel(a, 31 + Math.round(a.n(1, 1, 240)), 99, 22, 53, WOOD, { noiseK: 241, damp: true });
    barrel(a, 83 + Math.round(a.n(1, 2, 242)), 99, 23, 58, WOOD, { noiseK: 243 });
  } else if (v === 1) {
    barrel(a, 22, 99, 18, 46, WOOD, { noiseK: 244, damp: true });
    barrel(a, 60, 99, 20, 51, WOOD, { noiseK: 245 });
    barrel(a, 92, 83, 18, 43, LIGHT_WOOD, { noiseK: 246 });
    crate(a, 86, 42, 28, 32, WOOD, { noiseK: 247 });
  } else {
    crate(a, 12, 65, 42, 35, WOOD, { noiseK: 248 });
    crate(a, 64, 65, 42, 35, WOOD, { noiseK: 249 });
    crate(a, 38, 29, 42, 35, LIGHT_WOOD, { noiseK: 250 });
    a.s.line(52, 63, 66, 37, '#3b3024', '=');
  }
  return finish(a, o);
}

// ------------------------------------------------------------------ lamp post
function lampPost(o: AssetOptions): AsciiCell[] {
  const a = new Art(90, 230, o.seed, o.time);
  const v = variant3(o.variant);
  const cx = 45;
  const wood = v === 1;
  const pal: Pal = wood ? WOOD : IRON;
  stoneFill(a, 34, 207, 56, 220, DARK_STONE, { course: 5, bw: 10, tone: .56 });
  fill(a, 38, 201, 52, 209, (x, y, u, vv) => ['#', pick(pal, clamp(.56 + (1 - Math.abs(u - .5)) * .2 - vv * .12 + (a.n(x, y, 260) - .5) * .12))]);
  pole(a, cx, wood ? 67 : 49, 205, wood ? 5 : 3, pal, { noiseK: 261 + v, iron: !wood });
  for (const y of [197, 205]) a.s.line(cx - 8, y, cx + 8, y, shade(pal[1], .9), '=');

  if (v === 0) {
    lantern(a, cx, 30, 15, 21, o.time);
    a.s.line(cx - 20, 56, cx + 20, 56, IRON[1], '=');
    for (const x of [cx - 18, cx + 18]) a.s.line(x, 56, x - Math.sign(x - cx) * 4, 42, IRON[0], '/');
  } else if (v === 1) {
    // Wooden village lamp: chunky bracket, smaller shade and visible grain.
    a.s.line(cx, 68, cx + 27, 57, WOOD[1], '=');
    a.s.line(cx + 27, 57, cx + 27, 44, WOOD[0], '|');
    lantern(a, cx + 27, 34, 13, 18, o.time);
    a.put(cx - 1, 62, 'o', '#a79261');
  } else {
    // Rich double lamp: symmetrical crossbar and two independently lit panes.
    a.s.line(17, 55, 73, 55, IRON[2], '=');
    a.s.line(18, 59, 72, 59, IRON[0], '=');
    a.s.line(cx, 43, cx, 55, IRON[1], '|');
    lantern(a, 25, 35, 13, 18, o.time);
    lantern(a, 65, 35, 13, 18, o.time + .4);
    a.put(cx, 42, 'O', '#c5a85c');
  }
  return finish(a, o);
}

// ------------------------------------------------------------------ campfire
function campfire(o: AssetOptions): AsciiCell[] {
  const a = new Art(110, 88, o.seed, o.time);
  const v = variant3(o.variant);
  const cx = 55; const cy = 75;
  const rx = v === 1 ? 36 : v === 0 ? 26 : 30;
  disc(a, cx, cy, rx - 4, 8, (_x, _y, d) => [d > .55 ? 'x' : '%', d > .55 ? '#2a211b' : '#110e0c']);
  disc(a, cx, cy, rx, 11, (x, y, d, nx, _ny) => {
    if (d < .48) return null;
    const n = a.n(x, y, 270 + v);
    return [d > .82 ? 'O' : n < .35 ? 'x' : '#', pick(v === 2 ? DARK_STONE : STONE, clamp(.65 - nx * .12 + (n - .5) * .24))];
  });
  // Charred logs cross under the flame bed.
  const log = v === 2 ? '#2c211b' : '#4a2d1d';
  a.s.line(cx - 18, cy - 2, cx + 18, cy + 3, log, '=');
  a.s.line(cx - 17, cy + 3, cx + 18, cy - 3, shade(log, .72), '=');
  a.s.line(cx - 19, cy - 1, cx + 17, cy + 2, '#8a4a27', '/');
  flame(a, cx, cy - 2, v === 0 ? 25 : v === 1 ? 43 : 12, o.time, { noiseK: 274 + v, embers: v === 2 });
  // Rising sparks use wrapped time, so animation is continuous and deterministic.
  for (let i = 0; i < (v === 2 ? 10 : 7); i++) {
    const t = (o.time * (v === 2 ? .34 : .52) + a.n(i, 1, 280)) % 1;
    const x = cx + Math.round(Math.sin(t * 8 + i * 2.3) * (3 + t * 12) + (a.n(i, 2, 281) - .5) * 7);
    const y = cy - 8 - Math.round(t * (v === 2 ? 35 : 54));
    a.put(x, y, t > .72 ? '.' : '*', t > .72 ? '#b45c32' : '#ffd066');
  }
  return finish(a, o);
}

// ------------------------------------------------------------------ banner
function banner(o: AssetOptions): AsciiCell[] {
  const a = new Art(100, 240, o.seed, o.time);
  const v = variant3(o.variant);
  const colour = v === 0 ? '#a72f35' : v === 1 ? '#315f91' : '#67302c';
  const trim = v === 0 ? '#d6ae52' : v === 1 ? '#d9d5b5' : '#b39762';
  const phase = a.seed * .013;

  // The attached edge is fixed; the free edge and folds travel with time.
  for (let y = 37; y <= 148; y++) for (let col = 0; col <= 45; col++) {
    const u = col / 45; const vv = (y - 37) / 111;
    const tattered = v === 2;
    const bottom = tattered ? 126 + Math.floor(a.n(Math.floor(col / 4), 1, 290) * 14) - (u > .38 && u < .62 ? 12 : 0) : 144 - (u > .36 && u < .64 ? 19 : 0);
    if (y > bottom) continue;
    if (tattered && u > .45 && a.n(Math.floor(col / 5), Math.floor(y / 6), 291) < .13) continue;
    const wave = Math.sin(o.time * 2.5 - y * .075 + phase) * u * 4;
    const x = Math.round(53 + col + wave);
    const fold = Math.sin(u * 18 + o.time * 2.2 + y * .025);
    const n = a.n(col, Math.floor(y / 3), 292);
    let glyph = fold > .55 ? '#' : fold < -.45 ? '|' : n < .25 ? '%' : '#';
    let c = shade(colour, .77 + (fold * .5 + .5) * .24 + (n - .5) * .12 - vv * .08);
    if (col < 3 || y > bottom - 3) { glyph = '='; c = shade(trim, .9); }
    // A bold faction mark remains readable after renderer downsampling.
    if (v === 0 && Math.abs(u - .53) < .18 && Math.abs(vv - .43) < .16 && Math.abs(u - .53) + Math.abs(vv - .43) < .2) { glyph = '#'; c = trim; }
    if (v === 1 && Math.abs(u - .53) + Math.abs(vv - .43) < .18) { glyph = 'O'; c = trim; }
    if (v === 2 && u > .32 && u < .74 && vv > .32 && vv < .6) {
      const skull = Math.abs(u - .53) < .16 && Math.abs(vv - .44) < .12;
      const teeth = vv > .51 && vv < .6 && Math.abs(u - .53) < .1;
      if (skull || teeth) { glyph = skull ? 'O' : '#'; c = '#d4c69c'; }
    }
    a.put(x, y, glyph, c);
  }
  // Pole, brackets, finial and rope tie.
  pole(a, 50, 17, 224, 3, WOOD, { noiseK: 293 });
  fill(a, 45, 213, 55, 227, (x, y) => ['#', shade(WOOD[0], .72 + a.n(x, y, 294) * .3)]);
  a.s.line(48, 33, 56, 33, shade(trim, .9), '=');
  a.s.line(48, 39, 56, 39, shade(trim, .8), '=');
  a.s.polygon([[45, 19], [50, 6], [55, 19]], IRON, .9, '.,:;+=x#');
  a.put(50, 4, 'O', '#c0a35e');
  return finish(a, o);
}

// ------------------------------------------------------------------ ruin wall
function ruinWall(o: AssetOptions): AsciiCell[] {
  const a = new Art(180, 150, o.seed, o.time);
  const v = variant3(o.variant);
  const pal: Pal = v === 0 ? ['#343632', '#53574e', '#767a6b', '#9b9c87'] : v === 1 ? DARK_STONE : ['#3d403b', '#62665c', '#858878', '#a7a791'];
  const base = 139;
  const topAt = (x: number) => {
    const jag = Math.floor(a.n(Math.floor(x / 7), 1, 300) * 15);
    return (v === 0 ? 76 : v === 1 ? 27 : 22) + jag + (Math.abs(x - 90) > 74 && v !== 0 ? 9 : 0);
  };
  const inArch = (x: number, y: number) => {
    if (v !== 2) return false;
    if (y >= 100) return x >= 70 && x <= 110;
    return ((x - 90) / 21) ** 2 + ((y - 100) / 28) ** 2 <= 1;
  };
  const mask = (x: number, y: number) => {
    if (x < 8 || x > 172 || y < topAt(x) || y > base || inArch(x, y)) return false;
    // The shared footprint has one central passage. Low/high ruins show a matching
    // collapsed base breach; the arch variant widens it into a full doorway.
    if (v !== 2 && y > 117 && x >= 78 && x <= 102) return false;
    // Seed-stable chips and missing blocks break the silhouette without flicker.
    if (y < topAt(x) + 17 && a.n(Math.floor(x / 6), Math.floor(y / 7), 301) < .14) return false;
    if (v === 1 && a.n(Math.floor(x / 11), Math.floor(y / 10), 302) < .035 && y < 113) return false;
    return true;
  };
  stoneFill(a, 8, 20, 172, base, pal, { mask, course: 9, bw: 18, moss: v === 2 ? .26 : .12, tone: .58 });
  // Lit broken capstones.
  for (let x = 10; x < 171; x += 3) {
    const y = topAt(x);
    if (mask(x, y)) a.put(x, y, '=', shade(pal[2], .9 + a.n(x, 1, 303) * .16));
  }
  if (v === 2) {
    // Highlight the arch ring while keeping the passage physically open.
    disc(a, 90, 100, 23, 29, (x, y, d) => y <= 101 && d > .76 && d < 1.08 ? ['%', shade(pal[3], .82 + a.n(x, y, 304) * .18)] : null);
    for (const x of [67, 111]) fill(a, x, 99, x + 4, base, (px, py) => [py % 9 === 0 ? '=' : '#', shade(pal[2], .72 + a.n(px, py, 305) * .22)]);
  }
  // Rubble is seeded and kept out of the arch doorway.
  for (let i = 0; i < 48; i++) {
    const x = 8 + Math.round(a.n(i, 1, 306) * 164);
    if (v === 2 && x > 64 && x < 116) continue;
    const spread = Math.abs(x - 90) / 82;
    const y = base + 1 - Math.round(a.n(i, 2, 307) * (3 + spread * 7));
    const n = a.n(i, 3, 308);
    a.put(x, y, n < .35 ? 'x' : n < .7 ? '#' : '%', pick(pal, clamp(.42 + n * .48)));
    if (n > .72) a.put(x + 1, y - 1, '=', shade(pal[2], .86));
  }
  return finish(a, o);
}

const wallFoot = (ax: number, ay: number, x0: number, x1: number, y: number, r: number) => circlesAlong(ax, ay, x0, x1, y, r, 1.35);

export const SETTLEMENT_PROPS: readonly AsciiAsset[] = [
  def('market-stall', 'Market stall', 150, 130, 75, 122, ['Red-white fruit', 'Blue-white cloth', 'Green-yellow fish'],
    'Timber market counter with a striped scalloped awning and variant-specific fruit, cloth or fish goods.', marketStall,
    { footprint: wallFoot(75, 122, 23, 127, 116, 8) }),
  def('well', 'Village well', 130, 170, 65, 162, ['Stone', 'Wooden', 'Mossy'],
    'Roofed well with a dark opening, masonry or stave ring, rope, bucket and winding handle.', well,
    { footprint: wallFoot(65, 162, 34, 96, 156, 15) }),
  def('fence', 'Fence segment', 80, 74, 40, 66, ['Wooden', 'Wattle', 'Iron'],
    'A sixty-cell-wide three-post fence with wooden rails, woven wattle or rich iron spears.', fence,
    { footprint: wallFoot(40, 66, 10, 70, 63, 6) }),
  def('cart', 'Hand cart', 150, 108, 75, 100, ['Empty', 'Hay', 'Crates'],
    'Two spoked-wheel cart with a plank bed, long shafts and an empty, hay or stacked-crate load.', cart,
    { footprint: [{ x: -33, y: -20, radius: 20 }, { x: 0, y: -15, radius: 23 }, { x: 36, y: -20, radius: 20 }] }),
  def('haystack', 'Haystack', 120, 104, 60, 96, ['Fresh', 'Old', 'Pitchfork'],
    'Round bound haystack with directional straw texture; old hay darkens and the third variant holds a pitchfork.', haystack,
    { footprint: wallFoot(60, 96, 25, 95, 92, 14) }),
  def('barrels', 'Barrels and crates', 120, 108, 60, 100, ['Two barrels', 'Three and crate', 'Stacked crates'],
    'Grouped bulged barrels with iron hoops or a neat stack of braced wooden crates.', barrels,
    { footprint: wallFoot(60, 100, 20, 100, 96, 15) }),
  def('lamp-post', 'Town lamp', 90, 230, 45, 218, ['Iron', 'Wooden', 'Double'],
    'Settlement lamp with iron, wooden or double lantern variants and a warm asset-level light.', lampPost,
    { footprint: [{ x: 0, y: -4, radius: 11 }], light: { x: 0, y: -183, radius: 190, color: WARM } }),
  def('campfire', 'Campfire', 110, 88, 55, 80, ['Small', 'Large', 'Embers'],
    'Stone fire ring with crossed logs, deterministic flickering flames, rising sparks and warm light.', campfire,
    { footprint: [{ x: 0, y: -4, radius: 25 }], light: { x: 0, y: -8, radius: 145, color: WARM } }),
  def('banner', 'War banner', 100, 240, 50, 232, ['Red', 'Blue', 'Tattered'],
    'Tall faction pole with a large time-driven cloth banner, bold emblem and a ragged orc variant.', banner,
    { footprint: [{ x: 0, y: -5, radius: 8 }] }),
  def('ruin-wall', 'Ruin wall', 180, 150, 90, 142, ['Low', 'High', 'Arch'],
    'Weathered broken stone wall with seeded rubble, a central base breach and a wider unobstructed arch doorway.', ruinWall,
    { footprint: [...wallFoot(90, 142, 10, 68, 137, 10), ...wallFoot(90, 142, 112, 170, 137, 10)] }),
];
