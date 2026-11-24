import { GlyphShape } from '../shapes.ts';
import { noise, type AsciiAsset, type AsciiCell, type AssetOptions } from '../types.ts';

type BirdKind = 'sparrow' | 'crow' | 'parrot' | 'vulture';
type BirdAction = 'idle' | 'walk' | 'fly';

function actionOf(options: AssetOptions): BirdAction {
  const action: string = (options as AssetOptions & { action: string }).action;
  return action === 'fly' || action === 'walk' ? action : 'idle';
}

interface Plumage {
  body: readonly string[];
  wing: readonly string[];
  head: readonly string[];
  accent: readonly string[];
  beak: readonly string[];
}

const PLUMAGE: Record<BirdKind, readonly Plumage[]> = {
  sparrow: [
    { body: ['#57432f', '#8c6748', '#bb9065', '#ddbd8d'], wing: ['#302b27', '#514337', '#7c6048', '#a98562'], head: ['#4c3b30', '#765743', '#a27c59', '#c5a274'], accent: ['#ddd0ae', '#f0e3c4'], beak: ['#3c3328', '#756044', '#b39968'] },
    { body: ['#465056', '#6f7b7e', '#9aa3a0', '#c1c5b8'], wing: ['#293237', '#46545b', '#6f7f84', '#9ba8a6'], head: ['#3b464b', '#5e6c71', '#8c9999', '#b7beb3'], accent: ['#d8d5bd', '#f1e9d1'], beak: ['#36362f', '#6e6b55', '#aaa17b'] },
    { body: ['#6b3e2c', '#a15c3e', '#cb8157', '#e3aa78'], wing: ['#3a2d28', '#664638', '#97684e', '#c08d68'], head: ['#56382e', '#85513b', '#b67750', '#d69b6c'], accent: ['#ead7b6', '#f6e8ca'], beak: ['#352d27', '#6f5b43', '#ad9369'] },
  ],
  crow: [
    { body: ['#111a21', '#23333f', '#3b5363', '#637984'], wing: ['#101820', '#1d2c39', '#354b5b', '#587184'], head: ['#131c24', '#263641', '#435967', '#6c7e86'], accent: ['#264d70', '#3976a0', '#67a8c2', '#9bcbd1'], beak: ['#171e22', '#323d42', '#5d6c6c'] },
    { body: ['#1c2327', '#354149', '#56646a', '#7e8887'], wing: ['#151c22', '#29343c', '#46545d', '#6e7c82'], head: ['#1a2228', '#303c45', '#52616b', '#79878b'], accent: ['#34536b', '#507a93', '#7da2b1', '#a7c1c3'], beak: ['#1d2427', '#414b4c', '#747d76'] },
  ],
  parrot: [
    { body: ['#a6252d', '#d43c38', '#ed6650', '#ff9b72'], wing: ['#176343', '#2d8c59', '#52b86d', '#8bd68b'], head: ['#bd2930', '#e4473d', '#f26c52', '#ff9c76'], accent: ['#2455a0', '#347fd0', '#62b6e2', '#a4e1e8'], beak: ['#2b2927', '#5d5545', '#b29b68', '#e1c78e'] },
    { body: ['#1b5e9c', '#2c83c5', '#51a8db', '#82d0e5'], wing: ['#208451', '#3cac68', '#71ca7d', '#a7dfa0'], head: ['#2d4f9c', '#4777c4', '#72a6dc', '#acd4e7'], accent: ['#d49a24', '#efbf3e', '#ffe17a', '#fff0b0'], beak: ['#272927', '#575448', '#a79a72', '#d9c99b'] },
  ],
  vulture: [
    { body: ['#252a2b', '#414743', '#6a6c5d', '#96927b'], wing: ['#1c2427', '#343d3e', '#575e55', '#838371'], head: ['#4b4038', '#786451', '#a28b6c', '#c3ae8b'], accent: ['#794c43', '#a86d5c', '#ca9480'], beak: ['#343730', '#666858', '#a3a088'] },
    { body: ['#352e29', '#594a3b', '#887057', '#b09774'], wing: ['#292725', '#494039', '#74614e', '#a38a6b'], head: ['#6a5545', '#92755a', '#ba9b76', '#d6bd96'], accent: ['#8e5145', '#bd7560', '#dda28a'], beak: ['#37372f', '#6d6b55', '#aaa288'] },
  ],
};

function eye(s: GlyphShape, x: number, y: number, pale = false): void {
  s.cell(x, y, 'O', '#0c1519');
  s.cell(x - 1, y - 1, pale ? '*' : '.', pale ? '#f1d79c' : '#d7e1d1');
}

function feet(s: GlyphShape, x: number, hipY: number, ground: number, phase: number, palette: readonly string[], moving: boolean): void {
  const step = moving ? Math.sin(phase) : 0;
  for (const side of [-1, 1]) {
    const fx = x + side * 4 + step * side * 2;
    s.line(x + side * 3, hipY, fx, ground - 2, palette[1], '|');
    s.line(fx, ground - 2, fx - 3, ground, palette[2], '\\');
    s.line(fx, ground - 2, fx + 3, ground, palette[2], '/');
  }
}

function groundPose(s: GlyphShape, o: AssetOptions, kind: Exclude<BirdKind, 'vulture'>, p: Plumage): void {
  const action = actionOf(o);
  const moving = action === 'walk';
  const phase = o.time * (moving ? 8 : 2.2) + o.seed % 7;
  const hop = moving ? Math.max(0, Math.sin(phase)) * 3.2 : Math.max(0, Math.sin(phase)) * .45;
  const dims = kind === 'sparrow' ? { cx: 24, cy: 24, rx: 12, ry: 9, hx: 37, hy: 17, ground: 36 }
    : kind === 'crow' ? { cx: 35, cy: 34, rx: 18, ry: 12, hx: 53, hy: 22, ground: 50 }
      : { cx: 31, cy: 41, rx: 13, ry: 17, hx: 44, hy: 21, ground: 58 };
  const { cx, cy, rx, ry, hx, hy, ground } = dims;
  // Discrete whole-head peck poses. Time-driven (not seed-driven) so two frames
  // 2.45s apart always land on different beats; the head/beak/tail move as one
  // articulated piece, never by shearing a row or column sideways.
  const beat = Math.floor(o.time * 2.6) % 4;
  const peck = !moving ? [0, 3, 1, 2][beat] : 0;
  feet(s, cx, cy + ry - 2 + hop, ground, phase, p.beak, moving);
  if (kind === 'parrot') {
    s.polygon([[cx - 7, cy + 8 + hop], [cx - 20, ground - 1], [cx - 9, ground - 3], [cx + 1, cy + 14 + hop]], p.accent, .86, '.,:;|x#');
    s.polygon([[cx - 2, cy + 11 + hop], [cx - 8, ground - 1], [cx + 3, ground - 2], [cx + 8, cy + 11 + hop]], p.body, .82);
  } else {
    const tail = kind === 'sparrow' ? 17 : 28;
    s.polygon([[cx - rx + 3, cy - 3 + hop], [cx - rx - tail, cy - 8 + hop], [cx - rx - tail + 3, cy + 5 + hop], [cx - rx + 5, cy + 7 + hop]], p.wing, .82, '.,:;|x#');
    s.line(cx - rx - tail + 2, cy - 5 + hop, cx - rx + 3, cy + 2 + hop, p.accent[0], '/');
  }
  s.ellipse(cx, cy + hop, rx, ry, p.body, .92);
  s.ellipse(cx - 2, cy + 1 + hop, rx * .68, ry * .72, p.wing, .9);
  for (let i = 0; i < (kind === 'sparrow' ? 4 : 6); i++) {
    s.line(cx - rx * .55 + i * 2, cy - 3 + hop + i * .8, cx - rx * .7 + i * 2, cy + 6 + hop, p.head[i % p.head.length], i % 2 ? '/' : '\\');
  }
  const headX = hx + peck * .5, headY = hy + hop + peck;
  s.ellipse(headX, headY, kind === 'sparrow' ? 7 : kind === 'crow' ? 9 : 8, kind === 'sparrow' ? 7 : 8, p.head, .94);
  if (kind === 'parrot') {
    s.ellipse(headX - 1, headY - 5, 6, 3, p.accent, .9);
    s.polygon([[headX + 5, headY - 3 + peck], [headX + 16, headY + 2 + peck], [headX + 9, headY + 8 + peck], [headX + 4, headY + 3 + peck]], p.beak, .96, '.:;x#');
    s.polygon([[headX + 6, headY + 4 + peck], [headX + 13, headY + 3 + peck], [headX + 8, headY + 9 + peck]], [p.beak[1]], .8);
    eye(s, headX + 3, headY - 1 + peck, true);
  } else {
    const open = kind === 'crow' && !moving && beat === 2;
    s.polygon([[headX + 6, headY - 2 + peck], [headX + (kind === 'sparrow' ? 13 : 18), headY + 1 + peck], [headX + 6, headY + 3 + peck]], p.beak, .92, '.:;x#');
    if (open) s.polygon([[headX + 6, headY + 3 + peck], [headX + 14, headY + 3 + peck], [headX + 7, headY + 8 + peck]], ['#682e2d', '#a85348', '#d08a72'], .88);
    eye(s, headX + 3, headY - 2 + peck);
    s.cell(headX - 1, headY - 6, '^', p.body[2]);
  }
}

function flightPose(s: GlyphShape, o: AssetOptions, kind: Exclude<BirdKind, 'vulture'>, p: Plumage): void {
  const phase = o.time * (kind === 'sparrow' ? 15 : kind === 'crow' ? 10 : 9) + o.seed % 5;
  const flap = Math.sin(phase);
  if (kind === 'sparrow') {
    s.polygon([[19, 19], [3, 15], [1, 20], [13, 25], [23, 24]], p.wing, .86);
    s.polygon([[22, 19], [15, 3 + flap * 6], [21, 7 + flap * 8], [29, 17], [33, 23], [28, 24]], p.wing, .84, '.,:;|x#');
    s.ellipse(25, 21, 12, 7, p.body, .94);
    s.ellipse(37, 15, 7, 6, p.head, .94);
    s.polygon([[43, 14], [53, 17], [43, 19]], p.beak, .94);
    s.polygon([[25, 18], [31, 28 - flap * 7], [26, 36 - flap * 8], [20, 26]], p.accent, .88, '.,:;|x#');
    for (let i = 0; i < 4; i++) s.line(26 + i * 2, 22, 24 + i * 2, 33 - flap * 7, p.head[i % 4], i % 2 ? '/' : '\\');
    eye(s, 40, 13);
  } else if (kind === 'crow') {
    s.polygon([[29, 30], [7, 27], [2, 32], [14, 37], [31, 36]], p.wing, .84);
    s.polygon([[33, 30], [18, 10 + flap * 8], [25, 13 + flap * 10], [38, 26], [46, 37], [39, 38]], p.wing, .88, '.,:;|x#');
    s.ellipse(37, 33, 18, 8, p.body, .94);
    s.ellipse(54, 25, 9, 7, p.head, .94);
    s.polygon([[61, 23], [75, 27], [61, 30]], p.beak, .94);
    s.polygon([[37, 29], [46, 46 - flap * 8], [39, 53 - flap * 8], [29, 37]], p.accent, .92, '.,:;|x#');
    for (let i = 0; i < 6; i++) s.line(35 + i * 2, 33, 37 + i * 2, 48 - flap * 7, i % 2 ? p.accent[1] : p.wing[2], i % 2 ? '/' : '\\');
    eye(s, 57, 23);
  } else {
    s.polygon([[25, 43], [10, 57], [18, 60], [32, 50]], p.accent, .86);
    s.polygon([[31, 44], [25, 60], [31, 59], [38, 48]], p.body, .88);
    s.polygon([[24, 35], [6, 16 + flap * 7], [13, 18 + flap * 9], [31, 32], [39, 43], [33, 43]], p.wing, .9, '.,:;|x#');
    s.ellipse(33, 40, 13, 16, p.body, .94);
    s.ellipse(45, 22, 8, 8, p.head, .94);
    s.polygon([[50, 18], [65, 24], [56, 31], [49, 27]], p.beak, .96, '.:;x#');
    s.polygon([[33, 34], [42, 53 - flap * 9], [34, 59 - flap * 9], [25, 42]], p.accent, .94, '.,:;|x#');
    for (let i = 0; i < 6; i++) s.line(30 + i * 2, 39, 32 + i * 2, 54 - flap * 8, p.body[Math.min(3, i % 4)], i % 2 ? '/' : '\\');
    eye(s, 48, 19, true);
    s.cell(44, 15, '^', p.accent[2]);
  }
}

function vulture(s: GlyphShape, o: AssetOptions, p: Plumage): void {
  const action = actionOf(o);
  const phase = o.time * (action === 'idle' ? 1.4 : action === 'walk' ? 3.2 : 4.8) + o.seed % 11;
  const flap = Math.sin(phase) * (action === 'idle' ? 4 : 13);
  const finger = (side: number) => {
    for (let i = 0; i < 6; i++) {
      const rootX = 80 + side * (18 + i * 6), rootY = 34 + i * 1.6;
      const tipX = 80 + side * (25 + i * 7), tipY = 21 + i * 5 + flap * (1 - i * .08);
      s.line(rootX, rootY, tipX, tipY, p.wing[Math.min(3, i % 4)], side > 0 ? '\\' : '/');
    }
  };
  // Far wing, body, then near wing; each wing is a separately posed feathered piece.
  s.polygon([[76, 35], [48, 19 + flap * .7], [15, 14 + flap], [24, 25 + flap], [12, 31 + flap], [42, 42], [72, 43]], p.wing, .8, '.,:;|x#');
  finger(-1);
  s.polygon([[73, 33], [29, 49], [18, 62], [37, 57], [70, 43]], p.wing, .88, '.,:;|x#');
  s.ellipse(80, 43, 12, 20, p.body, .9);
  s.ellipse(82, 27, 8, 12, p.head, .82);
  s.ellipse(85, 17, 7, 6, p.accent, .86);
  s.polygon([[89, 16], [101, 19], [90, 22]], p.beak, .92);
  eye(s, 88, 16);
  s.polygon([[83, 35], [113, 18 - flap * .7], [145, 14 - flap], [136, 25 - flap], [148, 31 - flap], [118, 42], [87, 43]], p.wing, .94, '.,:;|x#');
  finger(1);
  for (let i = 0; i < 7; i++) {
    const x = 72 + i * 3;
    s.line(x, 51, x - 2 + noise(i, 2, o.seed) * 4, 65, p.body[i % 4], i % 2 ? '/' : '\\');
  }
}

function generate(options: AssetOptions, kind: BirdKind): AsciiCell[] {
  const p = PLUMAGE[kind][options.variant % PLUMAGE[kind].length];
  if (kind === 'vulture') {
    const s = new GlyphShape(160, 80, options.seed);
    vulture(s, options, p);
    return s.frame(options.facing === 'left');
  }
  const dims = kind === 'sparrow' ? [52, 44, 26, 36] : kind === 'crow' ? [80, 58, 40, 50] : [72, 66, 36, 58];
  const [width, height] = dims;
  const s = new GlyphShape(width, height, options.seed);
  if (actionOf(options) === 'fly') flightPose(s, options, kind, p);
  else groundPose(s, options, kind, p);
  return s.frame(options.facing === 'left');
}

export const SPARROW: AsciiAsset = {
  id: 'sparrow', name: 'Hedgerow sparrow', version: 2, category: 'Creature',
  description: 'Tiny brown sparrow with ground pecks, alternating hops and separate fluttering wing poses.',
  width: 52, height: 44, anchor: { x: 26, y: 36 }, variants: ['Hedgerow', 'Grey', 'Rust'],
  generate: o => generate(o, 'sparrow'),
};
export const CROW: AsciiAsset = {
  id: 'crow', name: 'Blue-sheen crow', version: 2, category: 'Creature',
  description: 'Large black crow with an iridescent wing patch, hopping feet, opening caw and slow strong wingbeats.',
  width: 80, height: 58, anchor: { x: 40, y: 50 }, variants: ['Blue sheen', 'Raven black'],
  generate: o => generate(o, 'crow'),
};
export const PARROT: AsciiAsset = {
  id: 'parrot', name: 'Silverleaf parrot', version: 2, category: 'Creature',
  description: 'Bright hooked-beak parrot with a long tail, perched idle and broad red, green and blue flight wings.',
  width: 72, height: 66, anchor: { x: 36, y: 58 }, variants: ['Scarlet', 'Sapphire'],
  generate: o => generate(o, 'parrot'),
};
export const VULTURE: AsciiAsset = {
  id: 'vulture', name: 'Orc carrion vulture', version: 2, category: 'Creature',
  description: 'High-circling vulture with a thirty-unit spread, separated primary feathers and a bald pink head.',
  width: 160, height: 80, anchor: { x: 80, y: 70 }, variants: ['Slate', 'Brown'],
  generate: o => generate(o, 'vulture'),
};
