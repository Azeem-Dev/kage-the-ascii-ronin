import { GlyphShape } from '../shapes.ts';
import { noise, type AsciiAsset, type AsciiCell, type AssetOptions } from '../types.ts';

type Kind = 'cow' | 'buffalo' | 'horse' | 'goat' | 'sheep' | 'deer';

/** `fly`/`run` are runtime extensions used by wildlife and the preview. The shared
 * AssetOptions union deliberately remains untouched while the renderer is reviewed. */
function actionOf(options: AssetOptions): string {
  return (options as AssetOptions & { action: string }).action;
}

interface Coat {
  body: readonly string[];
  dark: readonly string[];
  head: readonly string[];
  hoof: readonly string[];
}

const COATS: Record<Kind, readonly Coat[]> = {
  cow: [
    { body: ['#d7d4bd', '#eee9d6', '#fff7df'], dark: ['#161c20', '#30383b', '#566064', '#8c9692'], head: ['#23292b', '#424b4c', '#78817c', '#b6b8a8'], hoof: ['#171b1d', '#3c403d', '#777364'] },
    { body: ['#533522', '#815336', '#ad7450', '#d09a6b'], dark: ['#35251e', '#5a3b29', '#866044', '#b38762'], head: ['#4b2e22', '#79503a', '#ad7958', '#d2a17b'], hoof: ['#211d1b', '#4a4035', '#89765e'] },
  ],
  buffalo: [
    { body: ['#202526', '#343c3b', '#59615a', '#898777'], dark: ['#141b1d', '#263032', '#46514e', '#727b70'], head: ['#242827', '#41443d', '#6f6d5e', '#9e947a'], hoof: ['#151918', '#343832', '#6e6957'] },
    { body: ['#2c2623', '#4a3a30', '#756049', '#a08363'], dark: ['#1d1b1b', '#342b27', '#594739', '#826b54'], head: ['#2e2825', '#544337', '#876b52', '#b1916d'], hoof: ['#191817', '#3e352d', '#75624c'] },
  ],
  horse: [
    { body: ['#5c2f20', '#914a2e', '#bd7045', '#e0a16c'], dark: ['#38251f', '#593527', '#8d5137', '#bc7d57'], head: ['#593023', '#8d4930', '#c0774e', '#e2aa76'], hoof: ['#211e1d', '#47423b', '#847b68'] },
    { body: ['#171c22', '#2c343c', '#4a555e', '#7f8586'], dark: ['#11161b', '#202a32', '#3c4750', '#67717a'], head: ['#1a2026', '#303b43', '#58656d', '#8e9695'], hoof: ['#141719', '#34383a', '#73746c'] },
    { body: ['#777d7c', '#a4aaa4', '#c7cbc0', '#e5e3d3'], dark: ['#515b5e', '#768183', '#a3aaa4', '#c9ccc1'], head: ['#646f72', '#8e9895', '#bcc1b7', '#dcdacb'], hoof: ['#292d2e', '#515554', '#93958a'] },
  ],
  goat: [
    { body: ['#765438', '#aa7d4e', '#d0a873', '#e8ca99'], dark: ['#4b382a', '#725239', '#a17a52', '#caa878'], head: ['#62462f', '#956941', '#c79560', '#e0b780'], hoof: ['#25221f', '#4a4337', '#857862'] },
    { body: ['#333a3b', '#505b5b', '#7b8580', '#a7aaa0'], dark: ['#242b2d', '#3f494b', '#64706d', '#92988e'], head: ['#2c3232', '#4b5350', '#788079', '#a8a99b'], hoof: ['#1d2222', '#40443e', '#7d7c6d'] },
    { body: ['#aaa48f', '#d1c9ad', '#e8dfc5', '#f5ecd5'], dark: ['#6e6d60', '#989680', '#c1b99e', '#e0d6bb'], head: ['#8c8877', '#b6ad93', '#d9cbae', '#eee2c6'], hoof: ['#2d2d28', '#565348', '#938b76'] },
  ],
  sheep: [
    { body: ['#aaa38e', '#d2c8ab', '#e9dfc4', '#f5ecd6'], dark: ['#787567', '#a39c86', '#c9c0a4', '#e4dac0'], head: ['#353a37', '#565c54', '#848579', '#b0aa96'], hoof: ['#242724', '#46483f', '#7b7969'] },
    { body: ['#4b4d49', '#70716a', '#99988a', '#bcb7a4'], dark: ['#303531', '#50564f', '#7c8175', '#aaa696'], head: ['#222827', '#3c4440', '#667068', '#969a89'], hoof: ['#1c2221', '#3d423b', '#74786b'] },
    { body: ['#876345', '#b0855d', '#d0ac7f', '#e6cba4'], dark: ['#594532', '#826144', '#ad8963', '#d2b38c'], head: ['#4b4036', '#76614e', '#a78d6e', '#cfb693'], hoof: ['#27241f', '#50483b', '#8b7d67'] },
  ],
  deer: [
    { body: ['#6e452b', '#9d6840', '#c28d5d', '#dfb780'], dark: ['#453226', '#6c4c35', '#987252', '#c39c73'], head: ['#67432e', '#93613f', '#bf8a5c', '#dbb483'], hoof: ['#211f1d', '#413b32', '#776b58'] },
    { body: ['#8b7354', '#b1976d', '#cfb88d', '#e5d3ac'], dark: ['#584d3e', '#7e6b52', '#aa9471', '#cdb996'], head: ['#6e5c46', '#947c5c', '#bba17a', '#dbc5a0'], hoof: ['#25231f', '#484137', '#817564'] },
  ],
};

function limb(s: GlyphShape, hipX: number, hipY: number, ground: number, phase: number, palette: readonly string[], width: number, stride: number, lift: number, hoof: readonly string[]): void {
  const step = Math.sin(phase);
  const footX = hipX + step * stride;
  const footY = ground - Math.max(0, Math.cos(phase)) * lift;
  const kneeX = hipX + step * stride * .35 + width * .7;
  const kneeY = (hipY + footY) * .5 + lift * .12;
  const ankleX = footX - step * stride * .12;
  const ankleY = footY - 4;
  s.polygon([[hipX - width, hipY], [hipX + width, hipY], [kneeX + width * .65, kneeY], [kneeX - width * .65, kneeY]], palette, .76, '.:;|x#');
  s.polygon([[kneeX - width * .6, kneeY - 1], [kneeX + width * .6, kneeY - 1], [ankleX + width * .45, ankleY], [ankleX - width * .45, ankleY]], palette, .72, '.:;|x#');
  s.polygon([[ankleX - width * .55, ankleY - 1], [ankleX + width * .5, ankleY - 1], [footX + width * .9, footY], [footX - width * .9, footY]], hoof, .82, '.:;x#');
}

function patch(s: GlyphShape, cx: number, cy: number, rx: number, ry: number, px: number, py: number, prx: number, pry: number, palette: readonly string[], seed: number): void {
  for (let y = Math.floor(py - pry); y <= Math.ceil(py + pry); y++) for (let x = Math.floor(px - prx); x <= Math.ceil(px + prx); x++) {
    if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 > .96) continue;
    if (((x - px) / prx) ** 2 + ((y - py) / pry) ** 2 > 1) continue;
    const n = noise(x, y, seed);
    const light = .78 - (x - px) / Math.max(1, prx) * .2 - (y - cy) / ry * .15;
    const k = Math.max(0, Math.min(palette.length - 1, Math.floor((light + (n - .5) * .2) * palette.length)));
    s.cell(x, y, '.,:;+=x#%@'[Math.min(9, Math.floor((light + n * .15) * 9))], palette[k]);
  }
}

function tail(s: GlyphShape, x: number, y: number, sway: number, length: number, palette: readonly string[], thick = 3): void {
  const midX = x - length * .45, midY = y + length * .35 + sway * .25;
  const tipX = x - length, tipY = y + length * .72 + sway;
  s.polygon([[x, y - thick], [midX, midY - thick], [tipX, tipY - thick * .5], [tipX + 1, tipY + thick], [midX + 1, midY + thick], [x, y + thick]], palette, .72, '.:;|x#');
  s.ellipse(tipX, tipY, thick * 1.4, thick * 1.8, palette, .78);
}

function eye(s: GlyphShape, x: number, y: number): void {
  s.cell(x, y, 'O', '#101719'); s.cell(x - 1, y - 1, '.', '#d7decb');
}

function cow(s: GlyphShape, o: AssetOptions, coat: Coat): void {
  const moving = actionOf(o) !== 'idle';
  const phase = o.time * (moving ? 5.4 : 1.2);
  const bob = moving ? Math.sin(phase * 2) * 1.2 : Math.sin(o.time * 1.4) * .45;
  const cy = 53 + bob;
  const grazing = !moving;
  const drop = grazing ? 20 + Math.sin(o.time * .85 + o.seed) * 3 : 0;
  const headX = grazing ? 179 : 180, headY = (grazing ? 55 : 31) + bob + (grazing ? drop : 0);
  const ground = 98;
  // Diagonal pairs, drawn as complete articulated limbs. Far legs use the dark coat.
  for (let i = 0; i < 4; i++) {
    const x = [55, 142, 55, 142][i];
    limb(s, x, cy + 17, ground, phase + (i === 0 || i === 3 ? Math.PI : 0), i < 2 ? coat.dark : coat.body, i < 2 ? 4 : 5, moving ? 11 : 0, moving ? 6 : 0, coat.hoof);
  }
  tail(s, 40, cy - 9, Math.sin(o.time * 2.2 + o.seed) * 8, 30, coat.dark, 2.6);
  s.ellipse(101, cy, 62, 27, coat.body, .95);
  s.ellipse(78, cy + 9, 38, 17, coat.body, .78);
  if (o.variant === 0) {
    const spots = [[72, 39, 19, 13], [117, 65, 23, 12], [139, 43, 14, 17], [99, 43, 12, 10]] as const;
    spots.forEach((p, i) => patch(s, 101, cy, 61, 26, p[0] + Math.round(noise(i, 2, o.seed) * 5 - 2), p[1] + cy - 53, p[2], p[3], coat.dark, o.seed + i * 19));
  } else {
    patch(s, 101, cy, 61, 26, 103, cy + 16, 42, 10, coat.dark, o.seed + 71);
  }
  if (grazing) {
    s.polygon([[140, cy - 6], [157, 59 + drop * .35], [177, 66 + drop * .45], [165, 78 + drop * .5], [147, 67 + drop * .3], [132, cy + 13]], coat.head, .84);
    s.ellipse(headX, headY, 17, 10, coat.head, .86);
    s.ellipse(193, headY + 7, 9, 6, o.variant === 0 ? ['#8d7e75', '#c2ad9d', '#dfc6b4'] : coat.dark, .88);
    s.polygon([[166, headY - 8], [153, headY - 15], [160, headY + 1]], coat.dark, .78);
    s.polygon([[171, headY - 8], [176, headY - 17], [180, headY - 5]], coat.head, .82);
    s.line(167, headY - 7, 158, headY - 14, '#d6c9a3', '/');
    s.line(172, headY - 7, 176, headY - 15, '#d6c9a3', '\\');
    s.cell(195, headY + 5, 'o', '#332c2b'); s.cell(197, headY + 7, '.', '#171c1e');
    eye(s, 181, headY - 3);
  } else {
    s.polygon([[142, cy - 7], [161, 17 + bob], [177, 24 + bob], [169, 53 + bob], [150, 58 + bob], [135, cy + 10]], coat.head, .88);
    s.ellipse(headX, headY, 17, 12, coat.head, .92);
    s.ellipse(194, headY + 5, 9, 7, o.variant === 0 ? ['#8d7e75', '#c2ad9d', '#dfc6b4'] : coat.dark, .9);
    s.polygon([[166, 23 + bob], [153, 15 + bob], [160, 29 + bob]], coat.dark, .8);
    s.polygon([[171, 22 + bob], [177, 12 + bob], [181, 27 + bob]], coat.head, .85);
    s.line(166, 23 + bob, 157, 17 + bob, '#d6c9a3', '/');
    s.line(172, 22 + bob, 176, 15 + bob, '#d6c9a3', '\\');
    s.cell(195, headY + 3, 'o', '#332c2b'); s.cell(197, headY + 5, '.', '#171c1e');
    eye(s, 183, headY - 2);
  }
}

function buffalo(s: GlyphShape, o: AssetOptions, coat: Coat): void {
  const moving = actionOf(o) !== 'idle';
  const phase = o.time * (moving ? 4 : 1.1);
  const wallow = !moving;
  const cy = (wallow ? 65 : 61) + (moving ? Math.sin(phase * 2) * 1.2 : Math.sin(o.time * 1.2) * .6);
  const ground = wallow ? 110 : 112;
  const headY = wallow ? 79 + Math.sin(o.time * .9) * 2 : 62;
  for (let i = 0; i < 4; i++) {
    const x = [55, 151, 52, 154][i];
    limb(s, x, cy + 19, ground, phase + (i === 0 || i === 3 ? Math.PI : 0), i < 2 ? coat.dark : coat.body, i < 2 ? 6 : 7, moving ? 10 : 0, moving ? 6 : 0, coat.hoof);
  }
  tail(s, 38, cy - 8, Math.sin(o.time * 1.8) * 5, 35, coat.dark, 3);
  s.ellipse(108, cy, 72, 32, coat.body, .82);
  s.ellipse(133, cy - 15, 34, 27, coat.body, .9);
  s.ellipse(86, cy + 12, 40, 20, coat.body, .72);
  s.polygon([[151, cy - 14], [170, headY - 20], [192, headY - 6], [185, headY + 16], [159, headY + 18], [145, cy + 12]], coat.head, .82);
  s.ellipse(185, headY + 4, 20, 15, coat.head, .88);
  s.ellipse(201, headY + 9, 10, 8, coat.dark, .76);
  // Broad curved horns are complete tapered pieces, not displaced rows.
  s.polygon([[173, headY - 11], [163, headY - 24], [181, headY - 30], [198, headY - 24], [206, headY - 13], [198, headY - 17], [187, headY - 21], [177, headY - 16]], ['#514d40', '#92866b', '#c5b693', '#e0d1ad'], .9, '.:;x#');
  s.polygon([[179, headY + 2], [164, headY + 12], [177, headY + 17], [194, headY + 13], [203, headY + 3], [194, headY + 6], [184, headY + 9], [175, headY + 7]], ['#49463c', '#82765f', '#b8a788', '#d8c7a6'], .82, '.:;x#');
  s.polygon([[170, headY - 12], [151, headY - 18], [159, headY - 4]], coat.dark, .76);
  s.polygon([[183, headY - 13], [192, headY - 23], [195, headY - 10]], coat.head, .8);
  eye(s, 187, headY - 1);
  s.cell(204, headY + 8, 'o', '#181b1b'); s.cell(201, headY + 13, '.', '#756f61');
  for (let i = 0; i < 7; i++) s.line(84 + i * 11, cy + 19, 87 + i * 11, cy + 25, coat.dark[1], ',');
}

function horse(s: GlyphShape, o: AssetOptions, coat: Coat): void {
  const action = actionOf(o);
  const running = action === 'run';
  const moving = action !== 'idle';
  const phase = o.time * (running ? 9.5 : moving ? 6.2 : 1.5);
  const bob = moving ? -Math.max(0, Math.sin(phase * 2)) * (running ? 5 : 2) : Math.sin(o.time * 1.3) * .55;
  const cy = 54 + bob;
  const ground = 102;
  for (let i = 0; i < 4; i++) {
    const x = [51, 143, 55, 147][i];
    const offset = running ? [0, Math.PI * .7, Math.PI * 1.25, Math.PI * .35][i] : phase + (i === 0 || i === 3 ? Math.PI : 0);
    limb(s, x, cy + 15, ground, offset, i < 2 ? coat.dark : coat.body, i < 2 ? 4 : 5, moving ? (running ? 24 : 14) : 0, moving ? (running ? 15 : 8) : 0, coat.hoof);
  }
  const swish = Math.sin(o.time * 2.4 + o.seed) * (running ? 13 : 8);
  s.polygon([[44, cy - 7], [28, cy - 1 + swish * .2], [14, cy + 19 + swish], [23, cy + 31 + swish], [31, cy + 12], [46, cy + 3]], coat.dark, .82, '.:;|x#');
  s.ellipse(103, cy, 59, 23, coat.body, .92);
  s.ellipse(79, cy + 7, 34, 17, coat.body, .8);
  s.polygon([[142, cy - 10], [157, 20 + bob], [171, 15 + bob], [179, 31 + bob], [164, 57 + bob], [145, 62 + bob], [134, cy + 12]], coat.body, .93);
  s.polygon([[157, 20 + bob], [174, 13 + bob], [193, 21 + bob], [202, 30 + bob], [192, 39 + bob], [172, 35 + bob], [164, 53 + bob]], coat.head, .92);
  s.ellipse(194, 31 + bob, 12, 8, coat.head, .86);
  s.ellipse(201, 34 + bob, 6, 5, coat.dark, .74);
  s.polygon([[169, 19 + bob], [163, 7 + bob], [177, 15 + bob]], coat.head, .9);
  s.polygon([[181, 17 + bob], [188, 8 + bob], [188, 23 + bob]], coat.dark, .84);
  // Mane and forelock move as overlapping whole tapered locks.
  for (let i = 0; i < 7; i++) {
    const x = 151 + i * 3.1, y = 21 + i * 4.6 + bob;
    const wind = Math.sin(o.time * 3 + i * .7 + o.seed) * (running ? 4 : 2);
    s.polygon([[x, y], [x + 11, y - 2], [x + 5 + wind, y + 13], [x - 1 + wind, y + 9]], coat.dark, .88, '.:;|x#');
  }
  s.polygon([[169, 17 + bob], [175, 7 + bob], [184, 13 + bob], [177, 22 + bob]], coat.dark, .9);
  eye(s, 183, 23 + bob);
  s.cell(204, 33 + bob, 'o', '#242223');
  s.line(163, 49 + bob, 169, 58 + bob, coat.dark[2], '|');
}

function goat(s: GlyphShape, o: AssetOptions, coat: Coat): void {
  const moving = actionOf(o) !== 'idle';
  const phase = o.time * (moving ? 7 : 1.5);
  const bob = moving ? Math.sin(phase * 2) * 1.4 : Math.sin(o.time * 1.6) * .45;
  const cy = 48 + bob;
  for (let i = 0; i < 4; i++) limb(s, [42, 99, 45, 103][i], cy + 14, 77, phase + (i === 0 || i === 3 ? Math.PI : 0), i < 2 ? coat.dark : coat.body, 3, moving ? 8 : 0, moving ? 5 : 0, coat.hoof);
  tail(s, 32, cy - 7, Math.sin(o.time * 3.1) * 5, 15, coat.body, 2);
  s.ellipse(73, cy, 44, 18, coat.body, .9);
  s.polygon([[102, cy - 9], [116, 22 + bob], [130, 28 + bob], [122, 49 + bob], [105, 53 + bob], [96, cy + 10]], coat.head, .88);
  s.ellipse(124, 29 + bob, 14, 10, coat.head, .9);
  s.ellipse(135, 32 + bob, 7, 5, coat.dark, .78);
  s.polygon([[115, 23 + bob], [103, 14 + bob], [109, 30 + bob]], coat.dark, .8);
  s.polygon([[124, 22 + bob], [134, 13 + bob], [132, 29 + bob]], coat.head, .85);
  const twitch = Math.sin(o.time * 2.7 + o.seed) * 2;
  s.line(117, 22 + bob, 111, 10 + bob + twitch, '#d1c39c', '/');
  s.line(112, 12 + bob + twitch, 107, 8 + bob + twitch, '#d1c39c', '\\');
  s.line(127, 22 + bob, 133, 10 + bob - twitch, '#d1c39c', '\\');
  s.line(132, 12 + bob - twitch, 138, 9 + bob - twitch, '#d1c39c', '/');
  s.polygon([[124, 36 + bob], [127, 49 + bob], [121, 44 + bob]], coat.dark, .85);
  eye(s, 129, 27 + bob);
  s.cell(139, 31 + bob, 'o', '#242525');
}

function sheep(s: GlyphShape, o: AssetOptions, coat: Coat): void {
  const moving = actionOf(o) !== 'idle';
  const phase = o.time * (moving ? 5.8 : 1.4);
  const bob = moving ? Math.sin(phase * 2) * 1.1 : Math.sin(o.time * 1.5) * .4;
  const cy = 48 + bob;
  for (let i = 0; i < 4; i++) limb(s, [43, 101, 46, 104][i], cy + 16, 78, phase + (i === 0 || i === 3 ? Math.PI : 0), i < 2 ? coat.dark : coat.head, 3.5, moving ? 7 : 0, moving ? 4 : 0, coat.hoof);
  tail(s, 31, cy - 5, Math.sin(o.time * 2.8) * 4, 12, coat.body, 3);
  s.ellipse(74, cy, 46, 24, coat.body, .88);
  // Seed-placed wool locks give the fleece a hand-shaped, irregular silhouette.
  for (let i = 0; i < 16; i++) {
    const a = i / 16 * Math.PI * 2;
    const x = 74 + Math.cos(a) * (34 + noise(i, 1, o.seed) * 8);
    const y = cy + Math.sin(a) * (16 + noise(i, 2, o.seed) * 6);
    s.ellipse(x, y, 8 + noise(i, 3, o.seed) * 3, 7 + noise(i, 4, o.seed) * 3, coat.body, .82 + noise(i, 5, o.seed) * .2, '.,:;+=x#');
  }
  s.polygon([[106, cy - 8], [118, 35 + bob], [130, 40 + bob], [124, 57 + bob], [108, 57 + bob], [99, cy + 10]], coat.head, .84);
  s.ellipse(124, 42 + bob, 13, 15, coat.head, .86);
  s.ellipse(134, 51 + bob, 7, 5, coat.dark, .74);
  s.polygon([[114, 33 + bob], [102, 25 + bob], [108, 42 + bob]], coat.dark, .78);
  s.polygon([[125, 32 + bob], [138, 27 + bob], [134, 41 + bob]], coat.head, .82);
  eye(s, 129, 40 + bob);
  s.cell(138, 50 + bob, 'o', '#242827');
}

function deer(s: GlyphShape, o: AssetOptions, coat: Coat): void {
  const moving = actionOf(o) !== 'idle';
  const phase = o.time * (moving ? 7.2 : 1.3);
  const bob = moving ? Math.sin(phase * 2) * 1.2 : Math.sin(o.time * 1.2) * .35;
  const cy = 52 + bob;
  for (let i = 0; i < 4; i++) limb(s, [57, 130, 60, 134][i], cy + 14, 99, phase + (i === 0 || i === 3 ? Math.PI : 0), i < 2 ? coat.dark : coat.body, 3, moving ? 14 : 0, moving ? 8 : 0, coat.hoof);
  tail(s, 46, cy - 7, Math.sin(o.time * 3) * 4, 15, coat.body, 2.5);
  s.ellipse(96, cy, 53, 20, coat.body, .9);
  patch(s, 96, cy, 52, 19, 60, cy + 5, 14, 12, ['#b9b9a5', '#d9d7bd', '#eee7cf'], o.seed + 17);
  for (let i = 0; i < 9; i++) {
    const x = 68 + i * 7;
    if (noise(i, 9, o.seed) > .48) s.cell(x, cy - 11 + Math.sin(i) * 4, '.', coat.body[2]);
  }
  s.polygon([[133, cy - 7], [145, 22 + bob], [158, 15 + bob], [164, 36 + bob], [151, 57 + bob], [134, cy + 12]], coat.head, .9);
  s.ellipse(157, 18 + bob, 17, 10, coat.head, .92);
  s.ellipse(172, 21 + bob, 8, 5, coat.dark, .8);
  const ear = Math.sin(o.time * 2.2 + o.seed) * 2;
  s.polygon([[149, 14 + bob], [137, 4 + bob + ear], [143, 20 + bob]], coat.head, .9);
  s.polygon([[158, 12 + bob], [163, 1 + bob - ear], [167, 16 + bob]], coat.dark, .88);
  s.polygon([[143, 10 + bob + ear], [141, 7 + bob + ear], [145, 14 + bob + ear]], ['#9b7564', '#cda58c'], .9);
  eye(s, 164, 16 + bob);
  s.cell(177, 21 + bob, 'o', '#1d2020');
  if (o.variant === 0) {
    const antler = ['#7c715c', '#a99a79', '#d1c19a', '#e5d7b5'];
    s.line(151, 12 + bob, 146, 1 + bob, antler[2], '|');
    s.line(146, 5 + bob, 137, 1 + bob, antler[2], '\\');
    s.line(147, 8 + bob, 152, 2 + bob, antler[1], '/');
    s.line(160, 11 + bob, 164, 1 + bob, antler[2], '|');
    s.line(163, 5 + bob, 171, 2 + bob, antler[1], '/');
    s.line(162, 7 + bob, 157, 1 + bob, antler[1], '\\');
  }
}

function generate(options: AssetOptions, kind: Kind): AsciiCell[] {
  const dimensions: Record<Kind, readonly [number, number, number, number]> = {
    cow: [208, 106, 104, 98], buffalo: [232, 122, 116, 112], horse: [220, 110, 110, 102],
    goat: [152, 86, 76, 77], sheep: [156, 88, 78, 78], deer: [196, 112, 98, 99],
  };
  const [width, height] = dimensions[kind];
  const s = new GlyphShape(width, height, options.seed);
  const coats = COATS[kind];
  const coat = coats[options.variant % coats.length];
  if (kind === 'cow') cow(s, options, coat);
  else if (kind === 'buffalo') buffalo(s, options, coat);
  else if (kind === 'horse') horse(s, options, coat);
  else if (kind === 'goat') goat(s, options, coat);
  else if (kind === 'sheep') sheep(s, options, coat);
  else deer(s, options, coat);
  return s.frame(options.facing === 'left');
}

const meta = (id: string, name: string, kind: Kind, description: string, width: number, height: number, anchorX: number, anchorY: number, variants: readonly string[], scaleFootprint: number): AsciiAsset => ({
  id, name, version: 2, category: 'Creature', description, width, height, anchor: { x: anchorX, y: anchorY }, variants,
  footprint: [{ x: -scaleFootprint, y: 1, radius: scaleFootprint * .75 }, { x: 0, y: 1, radius: scaleFootprint }, { x: scaleFootprint, y: 1, radius: scaleFootprint * .75 }],
  generate: options => generate(options, kind),
});

export const COW = meta('cow', 'Holstein cow', 'cow', 'Black-and-white dairy cow with clipped patches, a grazing neck pose, flicking tail and four articulated legs.', 208, 106, 104, 98, ['Holstein', 'Chestnut'], 42);
export const BUFFALO = meta('buffalo', 'Mire buffalo', 'buffalo', 'Heavy dark buffalo with a shoulder hump, broad curved horns and a low wallowing idle.', 232, 122, 116, 112, ['Slate', 'Umber'], 47);
export const WILD_HORSE = meta('wild-horse', 'Wild steppe horse', 'horse', 'Lean wild horse with layered mane locks, a jointed swishing tail, walk and runtime gallop poses.', 220, 110, 110, 102, ['Chestnut', 'Black', 'Dapple grey'], 44);
export const GOAT = meta('goat', 'Hill goat', 'goat', 'Small sure-footed goat with swept horns, a beard and quick independent leg poses.', 152, 86, 76, 77, ['Ochre', 'Charcoal', 'Ivory'], 25);
export const SHEEP = meta('sheep', 'Fleece sheep', 'sheep', 'Round fleece sheep with irregular seeded wool locks and a dark, expressive face.', 156, 88, 78, 78, ['Ivory', 'Black-faced', 'Chestnut'], 27);
export const DEER = meta('deer', 'Alert forest deer', 'deer', 'Slender deer with an upright alert neck, twitching ears, pale rump and optional branching antlers.', 196, 112, 98, 99, ['Antlered stag', 'Doe'], 38);
