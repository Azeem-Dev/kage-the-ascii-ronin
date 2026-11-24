import { GlyphShape } from '../shapes.ts';
import { noise, type AsciiCell, type AssetOptions } from '../types.ts';

/* ------------------------------------------------------------------ colour */
type RGB = [number, number, number];
const toRgb = (h: string): RGB => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const toHex = (c: RGB) => '#' + c.map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
export function mix(a: string, b: string, t: number): string {
  const x = toRgb(a); const y = toRgb(b);
  return toHex([x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t]);
}
/** Five albedo tones from one base colour, dark to light. */
export function tones(base: string): string[] {
  return [mix(base, '#000000', .52), mix(base, '#000000', .26), base, mix(base, '#ffffff', .24), mix(base, '#ffffff', .46)];
}
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const RAMP = ':;+=ox#%@';
const METAL = '+=oxO#%@';
const FUR = ';%&#@';
export const GOLD = '#f0c640';

/* --------------------------------------------------------------------- pen */
type Fn = (x: number, y: number) => number;
export class Pen {
  constructor(private s: GlyphShape, private seed: number) {}
  put(x: number, y: number, glyph: string, color: string): void { this.s.cell(x, y, glyph, color); }
  dot(x: number, y: number, l: number, pal: readonly string[], ramp = RAMP): void {
    const xi = Math.round(x); const yi = Math.round(y);
    const v = clamp(l + (noise(xi, yi, this.seed) - .5) * .16, .04, .99);
    this.s.cell(xi, yi, ramp[Math.floor(v * ramp.length)], pal[Math.floor(v * pal.length)]);
  }
  fill(x0: number, y0: number, x1: number, y1: number, fn: Fn, pal: readonly string[], ramp = RAMP): void {
    for (let y = Math.floor(y0); y <= Math.ceil(y1); y++) for (let x = Math.floor(x0); x <= Math.ceil(x1); x++) {
      const l = fn(x, y); if (l >= 0) this.dot(x, y, l, pal, ramp);
    }
  }
  ellipse(cx: number, cy: number, rx: number, ry: number, pal: readonly string[], b = 1, ramp = RAMP, clip?: (x: number, y: number) => boolean): void {
    this.fill(cx - rx - 1, cy - ry - 1, cx + rx + 1, cy + ry + 1, (x, y) => {
      const nx = (x - cx) / rx; const ny = (y - cy) / ry; const d = nx * nx + ny * ny;
      if (d > 1 || (clip && !clip(x, y))) return -1;
      return b * (.34 + .5 * Math.sqrt(1 - d) - .2 * nx - .1 * ny);
    }, pal, ramp);
  }
  capsule(x0: number, y0: number, x1: number, y1: number, r: number, pal: readonly string[], b = 1, ramp = RAMP): void {
    const dx = x1 - x0; const dy = y1 - y0; const l2 = dx * dx + dy * dy || 1;
    this.fill(Math.min(x0, x1) - r - 1, Math.min(y0, y1) - r - 1, Math.max(x0, x1) + r + 1, Math.max(y0, y1) + r + 1, (x, y) => {
      const t = clamp(((x - x0) * dx + (y - y0) * dy) / l2, 0, 1);
      const px = x0 + dx * t; const py = y0 + dy * t;
      const dist = Math.hypot(x - px, y - py); if (dist > r) return -1;
      const n = dist / r;
      return b * (.38 + .46 * Math.sqrt(1 - n * n) - .18 * (x - px) / r);
    }, pal, ramp);
  }
  rows(y0: number, y1: number, span: (y: number) => [number, number], pal: readonly string[], b = 1, ramp = RAMP, clip?: (x: number, y: number) => boolean): void {
    for (let y = Math.round(y0); y <= Math.round(y1); y++) {
      const [l, r] = span(y); const half = Math.max(.5, (r - l) / 2); const c = (l + r) / 2;
      for (let x = Math.ceil(l); x <= Math.floor(r); x++) {
        if (clip && !clip(x, y)) continue;
        const n = (x - c) / half;
        this.dot(x, y, b * (.44 + .4 * Math.sqrt(Math.max(0, 1 - n * n)) - .15 * n), pal, ramp);
      }
    }
  }
  poly(pts: readonly (readonly [number, number])[], pal: readonly string[], b = 1, ramp = RAMP, clip?: (x: number, y: number) => boolean): void {
    const xs = pts.map(p => p[0]); const ys = pts.map(p => p[1]);
    const minX = Math.min(...xs); const maxX = Math.max(...xs);
    this.fill(minX, Math.min(...ys), maxX, Math.max(...ys), (x, y) => {
      let inside = false;
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const a = pts[i]; const c = pts[j];
        if ((a[1] > y) !== (c[1] > y) && x < (c[0] - a[0]) * (y - a[1]) / (c[1] - a[1]) + a[0]) inside = !inside;
      }
      if (!inside || (clip && !clip(x, y))) return -1;
      return b * (.76 - (x - minX) / Math.max(1, maxX - minX) * .3);
    }, pal, ramp);
  }
  line(x0: number, y0: number, x1: number, y1: number, color: string, glyph: string, width = 1): void {
    const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    for (let i = 0; i <= steps; i++) {
      const x = x0 + (x1 - x0) * i / steps; const y = y0 + (y1 - y0) * i / steps;
      for (let k = 0; k < width; k++) this.s.cell(x + k, y, glyph, color);
    }
  }
}

/* -------------------------------------------------------------------- spec */
export type EarKind = 'round' | 'pointed' | 'long';
export type BeardKind = 'none' | 'short' | 'long' | 'braided';
export type HairKind = 'none' | 'short' | 'long' | 'tied';
export type HeadWear = 'none' | 'hood' | 'straw' | 'feather' | 'helm' | 'skullhelm' | 'crown' | 'circlet' | 'cap' | 'scarf' | 'lamp' | 'bandage';
export type Held = 'none' | 'spear' | 'axe' | 'club' | 'bow' | 'staff' | 'pitchfork' | 'cup' | 'basket' | 'hammer' | 'pick' | 'dagger' | 'lantern';
export type Torso = 'bare' | 'tunic' | 'vest' | 'chain' | 'robe' | 'coat';
export type Legs = 'trousers' | 'skirt' | 'loin' | 'bare' | 'robe';

export interface BodySpec {
  /** Canvas size; width must be odd so the figure mirrors around its anchor. */
  W: number; H: number;
  /** Feet to crown, in cells. */
  height: number;
  /** Half-width of the shoulders. */
  shoulder: number;
  /** Vertical head radius. */
  head: number;
  belly: number;
  /** 0..1 forward stoop. */
  hunch: number;
  /** Leg share of the height. */
  legs: number;
  arm: number;
  skin: string;
  ears: EarKind; earSize: number;
  eyes: string; nose: number; brow: number; tusks: number;
  beard: BeardKind; beardColor: string;
  hair: HairKind; hairColor: string;
  torso: Torso; torsoColor: string; trim?: string; under?: string;
  sleeves: 'none' | 'short' | 'long' | 'rolled';
  legsKind: Legs; legsColor: string; hem: number;
  boots?: string; wraps?: string;
  ragged: number; patches: number; patchColors: readonly string[];
  belt?: string; rope?: boolean; sash?: string; pouch?: string; apron?: string;
  cloak?: string; cloakTrim?: string; furCollar?: string; plates?: string;
  tabard?: string; crest?: string; gold: boolean;
  headwear: HeadWear; headColor: string; headAccent: string;
  held: Held; heldColor: string; heldAccent: string;
  shield?: string; reach: boolean; bones: boolean;
}

export const BASE: BodySpec = {
  W: 97, H: 140, height: 116, shoulder: 17, head: 11, belly: 1, hunch: 0, legs: .46, arm: .34,
  skin: '#d9a77c', ears: 'round', earSize: 1, eyes: '#e8f0f0', nose: 1, brow: 0, tusks: 0,
  beard: 'none', beardColor: '#5a4128', hair: 'short', hairColor: '#4a3320',
  torso: 'tunic', torsoColor: '#6a5a46', sleeves: 'long', legsKind: 'trousers', legsColor: '#4a4036', hem: .16,
  ragged: 0, patches: 0, patchColors: ['#7a6446', '#5d6a55', '#8a7a5a'],
  gold: false, headwear: 'none', headColor: '#6a5a46', headAccent: '#c9b27a',
  held: 'none', heldColor: '#6b4a2b', heldAccent: '#aab4ba', reach: false, bones: false,
};
export const spec = (p: Partial<BodySpec>): BodySpec => ({ ...BASE, ...p });
export { RAMP, METAL, FUR, clamp };

/* ------------------------------------------------------------------ figure */
export function drawPerson(sp: BodySpec, o: AssetOptions): AsciiCell[] {
  const s = new GlyphShape(sp.W, sp.H, o.seed);
  const pen = new Pen(s, o.seed);
  const cx = (sp.W - 1) / 2; const gy = sp.H - 1;
  const walk = o.action === 'walk';
  const ph = o.time * 6.5;
  const stepS = walk ? Math.sin(ph) : 0; const stepC = walk ? Math.cos(ph) : 0;
  const breath = walk ? .5 + .5 * Math.sin(ph * 2) : .5 + .5 * Math.sin(o.time * 2.9);
  const bob = walk ? -Math.abs(stepS) * 1.8 : 0;
  const sway = Math.sin(o.time * 1.9);

  /* Race builds are derived from the authored spec so every existing id keeps
   * its canvas, anchor and silhouette family while reading differently at 0.3x. */
  const goblin = sp.ears === 'long' && sp.earSize >= 1.4;
  const orc = sp.tusks >= 1.4 || sp.shoulder >= 24;
  const elf = sp.ears === 'pointed' && sp.tusks === 0 && sp.height >= 118 && sp.shoulder <= 14;
  const dwarf = sp.shoulder >= 20 && sp.height <= 96;
  const bulk = orc ? 1.22 : dwarf ? 1.18 : goblin ? .9 : elf ? .86 : 1;
  const legShare = dwarf ? sp.legs * .82 : goblin ? sp.legs * .84 : elf ? Math.min(.56, sp.legs + .05) : sp.legs;
  const headScale = goblin ? 1.12 : orc ? 1.06 : dwarf ? 1.14 : elf ? .96 : 1;
  const hunch = goblin ? Math.min(1, sp.hunch + .2) : sp.hunch;

  const skin = tones(sp.skin);
  const legLen = sp.height * legShare;
  const hipY = gy - legLen + bob;
  const hr = sp.head * headScale; const rx = hr * .9;
  const fwd = hunch * sp.shoulder * .85;
  const hcy = gy - sp.height + 1 + bob + hr + hunch * hr * .55;
  const hcx = cx + fwd + hunch * 2;
  const shY = hcy + hr * .8 - breath * 1.4;
  const torsoLen = hipY - shY;
  const tOf = (y: number) => clamp((y - shY) / torsoLen, 0, 1);
  const xs = (y: number) => cx + fwd * .9 * (1 - tOf(y));
  const garment = tones(sp.torsoColor);
  const robe = sp.torso === 'robe';
  const coat = sp.torso === 'coat';
  const hw = (y: number) => {
    const t = tOf(y);
    let w = sp.shoulder * (1 - .13 * t) + sp.belly * Math.sin(Math.PI * clamp((t - .08) / .92, 0, 1)) + (t < .7 ? breath * 1.2 : 0);
    if (y > hipY) w += (y - hipY) * (robe ? .26 : coat ? .17 : sp.torso === 'tunic' || sp.torso === 'vest' ? .1 : 0);
    return w * bulk;
  };
  const hemY = robe ? gy - 3 : coat ? hipY + legLen * .62 : sp.torso === 'bare' ? hipY + 2 : hipY + legLen * sp.hem;
  const armR = Math.max(3.2, sp.shoulder * .2) * (orc ? 1.3 : dwarf ? 1.16 : goblin ? .9 : 1);
  const hipHalf = sp.shoulder * .4 * bulk;
  const armLen = sp.height * sp.arm * (goblin ? 1.12 : elf ? 1.06 : 1);
  const rag = (x: number, y: number, k = 1) => noise(x, y, o.seed + 7) < sp.ragged * .22 * k;

  /* hand positions are computed first: held items need them */
  const hands = ([-1, 1] as const).map(side => {
    const k = side === -1 ? 1 : -1;
    const sx = xs(shY + armR) + side * (hw(shY + armR) - armR * .55);
    const sy = shY + armR;
    let hx = cx + side * (hw(hipY) + armR + 1.5) + k * stepS * 3.2 + side * Math.sin(o.time * 2.9) * .4 + (side === 1 ? fwd * .5 : fwd * .3);
    let hy = sy + armLen * .92 - Math.max(0, k * stepC) * 2.6 - breath * .8;
    if (side === 1 && sp.reach) { hx = hcx + hr * 1.8; hy = shY + armLen * .5 + Math.sin(o.time * 2) * .6; }
    else if (side === 1 && sp.held !== 'none') { hx = cx + hw(hipY) + armR + 4 + fwd * .4 + stepS * 1.5; hy = shY + armLen * .82 - Math.abs(stepS); }
    return { sx, sy, hx, hy };
  });

  const arm = (side: 0 | 1) => {
    const h = hands[side]; const sd = side === 0 ? -1 : 1;
    const reach = sp.reach && side === 1;
    const ex = (h.sx + h.hx) / 2 + sd * 1.8 + (reach ? 4 : 0); const ey = (h.sy + h.hy) / 2 + (reach ? 5 : 0);
    const sleeveTone = sp.torso === 'bare' ? skin : sp.torso === 'chain' ? tones('#8d979c') : garment;
    const sleeved = sp.sleeves !== 'none' && sp.torso !== 'bare';
    const lower = sp.sleeves === 'long' && sleeved ? sleeveTone : skin;
    const upper = sleeved ? sleeveTone : skin;
    pen.capsule(h.sx, h.sy, ex, ey, armR, upper, .95);
    pen.capsule(ex, ey, h.hx, h.hy, armR * .92, lower, .95);
    if (sp.wraps && side === 1) pen.capsule(ex, ey, h.hx, h.hy - 2, armR * .96, tones(sp.wraps), .95);
    if (sp.sleeves === 'rolled') pen.ellipse(ex, ey, armR + .6, 1.7, sleeveTone, .85);
    pen.ellipse(h.hx, h.hy + 1, armR * .85, armR * .85, skin, 1);
  };

  /* 1. back arm, cloak */
  arm(0);
  if (sp.cloak) {
    const cl = tones(sp.cloak);
    const span = (y: number): [number, number] => {
      const t = (y - shY) / (gy - 4 - shY); const w = hw(shY) + 3 + t * (sp.shoulder * .55);
      const off = fwd * (1 - t) * .5 - (walk ? stepS * 1.5 : 0) * t + sway * .9 * t;
      return [cx + off - w, cx + off + w];
    };
    pen.rows(shY - 1, gy - 4, span, cl, .9, RAMP, (x, y) => !rag(x, y, y > gy - 14 ? 3 : 0));
    if (sp.cloakTrim) pen.rows(gy - 7, gy - 4, span, tones(sp.cloakTrim), .9);
  }

  /* 2. legs */
  const legPal = sp.legsKind === 'trousers' ? tones(sp.legsColor) : skin;
  for (const side of [-1, 1]) {
    const k = side === -1 ? 1 : -1;
    const hx = cx + side * hipHalf + fwd * .15; const fx = hx + k * stepS * sp.shoulder * .22;
    const lift = Math.max(0, k * stepC) * 3.5;
    const fy = gy - 1.6 - lift;
    const lr = Math.max(3.4, sp.shoulder * .26) * (orc ? 1.28 : dwarf ? 1.12 : goblin ? .9 : elf ? .88 : 1);
    pen.capsule(hx, hipY, fx, fy - 2, lr, legPal, .95);
    if (sp.boots) pen.capsule(hx + (fx - hx) * .62, hipY + (fy - 2 - hipY) * .62, fx, fy - 1, lr * 1.04, tones(sp.boots), .95);
    else if (sp.wraps) pen.capsule(hx + (fx - hx) * .7, hipY + (fy - 2 - hipY) * .7, fx, fy - 1, lr * 1.02, tones(sp.wraps), .9);
    pen.ellipse(fx + 1.4, fy, lr * 1.12 + 1, 1.9, sp.boots ? tones(sp.boots) : skin, 1);
  }
  if (sp.legsKind === 'skirt' || sp.legsKind === 'robe') {
    const pal = tones(sp.legsColor); const end = sp.legsKind === 'robe' ? gy - 3 : hipY + legLen * .62;
    pen.rows(hipY - 3, end, y => {
      const w = sp.shoulder * .78 + sp.belly + (y - hipY) * (sp.legsKind === 'robe' ? .3 : .24);
      const sw = (walk ? stepS * 1.6 : sway * .6) * Math.max(0, (y - hipY) / legLen);
      return [cx + sw - w, cx + sw + w];
    }, pal, .95, RAMP, (x, y) => !(y > end - 4 && rag(x, y, 4)));
  }
  if (sp.legsKind === 'loin') {
    const pal = tones(sp.legsColor);
    pen.rows(hipY - 2, hipY + legLen * .4, y => { const t = (y - hipY) / (legLen * .4); const w = hipHalf * 1.7 * (1 - t * .55); return [cx + fwd * .15 - w, cx + fwd * .15 + w]; }, pal, .95, RAMP, (x, y) => !rag(x, y, y > hipY + legLen * .3 ? 5 : 1));
  }

  /* 3. torso and its layers */
  const chain = sp.torso === 'chain';
  const topPal = sp.torso === 'bare' ? skin : chain ? tones('#8d979c') : garment;
  const ragHem = sp.ragged > 0 ? 4 : 0;
  pen.rows(shY, hemY, y => [xs(y) - hw(y), xs(y) + hw(y)], topPal, chain ? 1.05 : .98, chain ? METAL : RAMP, (x, y) => !(y > hemY - 3 && rag(x, y, ragHem)));
  if (chain) for (let y = Math.round(shY); y <= hemY; y++) for (let x = Math.round(xs(y) - hw(y)); x <= xs(y) + hw(y); x++) if (((x >> 1) + y) % 3 === 0) pen.put(x, y, 'o', '#c6cfd2');
  if (sp.torso === 'bare') {
    for (let y = Math.round(shY + 12); y < hipY - 4; y += 4) pen.line(xs(y) - 6, y, xs(y) + 6, y, skin[1], ':');
    pen.line(cx + fwd * .4, shY + 8, cx + fwd * .2, hipY - 4, skin[0], ':', 1);
    pen.ellipse(xs(shY + 12) - sp.shoulder * .4, shY + 12, sp.shoulder * .38, 5, skin, 1.12);
    pen.ellipse(xs(shY + 12) + sp.shoulder * .4, shY + 12, sp.shoulder * .38, 5, skin, 1.12);
  }
  if (sp.torso === 'vest' && sp.under) {
    pen.rows(shY + 2, hipY, y => [xs(y) - hw(y) * .3, xs(y) + hw(y) * .3], tones(sp.under), 1);
    pen.line(xs(shY + 4), shY + 4, xs(hipY), hipY, garment[0], '|', 1);
    for (let y = Math.round(shY + 10); y < hipY - 3; y += 6) pen.put(xs(y), y, 'o', sp.gold ? GOLD : garment[3]);
  }
  if ((robe || coat || sp.torso === 'tunic') && sp.trim) {
    const tr = tones(sp.trim);
    pen.rows(hemY - 3, hemY, y => [xs(y) - hw(y), xs(y) + hw(y)], tr, 1, RAMP, (x, y) => !rag(x, y, ragHem));
    if (robe || coat) pen.rows(shY + 2, hemY - 4, y => [xs(y) - 1.4, xs(y) + 1.4], tr, 1);
    pen.ellipse(xs(shY + 1), shY + 1, hw(shY) * .75, 3, tr, 1, FUR);
  }
  for (let i = 0; i < sp.patches; i++) {
    const py = shY + 8 + noise(i, 3, o.seed) * (hemY - shY - 16); const px = xs(py) + (noise(i, 9, o.seed) - .5) * hw(py) * 1.1;
    const pc = tones(sp.patchColors[i % sp.patchColors.length]);
    pen.rows(py, py + 6, () => [px - 4, px + 4], pc, .9);
    pen.line(px - 4, py, px + 4, py, pc[0], ':'); pen.line(px - 4, py + 6, px + 4, py + 6, pc[0], ':');
  }
  if (sp.plates) {
    const pl = tones(sp.plates);
    pen.poly([[xs(shY + 4) - hw(shY + 4) * .62, shY + 6], [xs(shY + 4) + hw(shY + 4) * .5, shY + 4], [xs(shY + 4) + hw(shY + 4) * .55, shY + 20], [xs(shY + 4) - hw(shY + 4) * .45, shY + 24]], pl, 1, METAL);
    pen.rows(hipY - 16, hipY - 4, y => [xs(y) - hw(y) * .55 + (y - hipY) * .2, xs(y) + hw(y) * .6], tones(mix(sp.plates, '#6b4a32', .5)), .95, METAL);
    for (const [px, py] of [[-.4, 8], [.35, 8], [-.3, 20]] as const) pen.put(xs(shY + py) + px * hw(shY), shY + py, 'o', '#cfc7b6');
    for (const side of [-1, 1]) pen.ellipse(xs(shY + 3) + side * (hw(shY) - 1), shY + 4, armR + 2.5, 5, pl, 1, METAL);
  }
  if (sp.apron) {
    const ap = tones(sp.apron); const end = hipY + legLen * .5;
    pen.rows(shY + 10, end, y => { const t = (y - shY) / (end - shY); const w = hw(shY + 10) * (.5 + .22 * t); return [xs(y) - w, xs(y) + w]; }, ap, .9, RAMP, (x, y) => !rag(x, y, y > end - 8 ? 3 : 0));
    pen.line(xs(shY + 9) - hw(shY) * .8, shY + 3, xs(shY + 11) - hw(shY) * .4, shY + 12, ap[0], '/');
  }
  if (sp.tabard) {
    const tb = tones(sp.tabard);
    pen.rows(shY + 2, hipY + legLen * .55, y => { const w = hw(shY + 8) * .56; return [xs(y) - w + sway * .3, xs(y) + w + sway * .3]; }, tb, 1);
    if (sp.crest) { pen.ellipse(xs(shY + 14), shY + 15, 5.4, 6, tones(sp.crest), 1.1, '#%@'); pen.put(xs(shY + 14), shY + 15, '+', tb[0]); }
  }
  if (sp.sash) { const sa = tones(sp.sash); for (let i = 0; i < 4; i++) pen.line(xs(shY + 2) - hw(shY) + 2, shY + 3 + i, xs(hipY) + hw(hipY) - 2, hipY - 2 + i, sa[2 + (i & 1)], '#', 1); }
  if (sp.belt || sp.rope) {
    const bp = sp.rope ? tones('#b09a6a') : tones(sp.belt as string); const by = hipY - 2;
    pen.rows(by - 1, by + 1, y => [xs(y) - hw(y) - .3, xs(y) + hw(y) + .3], bp, 1, sp.rope ? ':;/' : RAMP);
    if (!sp.rope) pen.ellipse(xs(by) + fwd * .1, by, 2.4, 2, tones(GOLD), 1.1, METAL);
    else { pen.put(xs(by) + 3, by + 2, '|', '#a48f62'); pen.put(xs(by) + 4, by + 4, '|', '#a48f62'); }
  }
  if (sp.pouch) { pen.ellipse(xs(hipY) - hw(hipY) + 3, hipY + 5, 3.8, 4.4, tones(sp.pouch), 1); pen.put(xs(hipY) - hw(hipY) + 3, hipY + 1, '$', GOLD); }
  if (sp.furCollar) pen.ellipse(xs(shY + 1), shY + 2, hw(shY) * 1.02, 4.4, tones(sp.furCollar), 1, FUR);
  if (sp.gold && sp.torso !== 'bare') {
    for (let i = -3; i <= 3; i++) pen.put(xs(shY + 3) + i * 2.2, shY + 7 - Math.abs(i), 'o', GOLD);
    pen.ellipse(xs(shY + 11), shY + 11, 2.2, 2.4, tones('#e04050'), 1.2, METAL); pen.put(xs(shY + 11), shY + 11, '*', '#ffffff');
  }

  // Clothing reads as cloth, not a flat block: a few broad vertical folds that
  // survive 0.25x, and asymmetric hanging threads on cheap, ragged garments.
  if (robe || coat || sp.torso === 'tunic' || sp.torso === 'vest') {
    const fold = garment[1];
    for (const f of [-.66, -.24, .3, .7]) {
      const fy0 = shY + 9; const fy1 = Math.min(hemY - 2, hipY + legLen * sp.hem);
      if (fy1 <= fy0) continue;
      pen.line(xs(fy0) + f * hw(fy0), fy0, xs(fy1) + f * hw(fy1), fy1, fold, ':', 1);
    }
  }
  if (sp.ragged > .4 || sp.rope) {
    for (let i = 0; i < 3; i++) {
      const tx = xs(hemY) + (noise(i, 21, o.seed) - .5) * hw(hemY) * 1.7;
      pen.line(tx, hemY - 3, tx + (noise(i, 22, o.seed) - .5) * 6, hemY + 2 + noise(i, 23, o.seed) * 4, garment[0], ':', 1);
    }
  }

  /* 4. front arm and held item */
  arm(1);
  const gx = hands[1].hx; const gripY = hands[1].hy;
  const wood = tones(sp.heldColor); const steel = tones(sp.heldAccent);
  const H = sp.height;
  const tilt = walk ? stepS * 1.2 : 0;
  const shaft = (x0: number, y0: number, x1: number, y1: number, w = 2) => {
    const st = Math.max(Math.abs(y1 - y0), 1);
    for (let i = 0; i <= st; i++) { const x = x0 + (x1 - x0) * i / st; const y = y0 + (y1 - y0) * i / st; for (let k = 0; k < w; k++) pen.dot(x + k, y, .5 + .3 * (1 - k), wood); }
  };
  switch (sp.held) {
    case 'spear': case 'pitchfork': {
      const top = gy - H - 4; const tx = gx + tilt * .5; shaft(gx - tilt, gy, tx, top);
      if (sp.held === 'spear') pen.poly([[tx - 3, top + 2], [tx + 1, top - 15], [tx + 4, top + 2]], steel, 1.05, METAL);
      else { for (const d of [-4, 1, 6]) pen.line(gx + d + tilt * .5, top + 3, gx + d + tilt * .5, top - 9, steel[3], '|', 1); pen.line(gx - 4 + tilt * .5, top + 3, gx + 6 + tilt * .5, top + 3, steel[2], '=', 1); }
      break; }
    case 'staff': {
      const top = gy - H - 6; shaft(gx, gy, gx + tilt * .3, top, 2);
      if (sp.bones) {
        pen.ellipse(gx + 1, top - 5, 5.2, 5.6, tones('#d9d2bc'), 1.05, METAL); pen.put(gx - 1, top - 5, '@', '#2a2420'); pen.put(gx + 3, top - 5, '@', '#2a2420');
        pen.line(gx - 1, top - 1, gx + 3, top - 1, '#6a6050', ':', 1);
        for (const [bx, by] of [[-5, 2], [6, 0], [-4, 8]] as const) pen.line(gx + bx, top + by, gx + bx + 3, top + by - 3, '#d9d2bc', '/', 1);
        pen.ellipse(gx + 1, top - 5, 8, 8, tones('#6ccf6a'), .5, '.', (x, y) => noise(x, y, o.seed + Math.floor(o.time * 3)) > .86);
      } else { pen.ellipse(gx + 1, top - 3, 3.8, 5, steel, 1.1, METAL); pen.put(gx + 1, top - 4, '*', '#ffffff'); }
      break; }
    case 'axe': case 'club': case 'hammer': case 'pick': {
      const len = sp.held === 'club' ? H * .5 : H * .56; const topY = gripY - len * .5 + 4; const bot = gripY + len * .5;
      const tx = gx + (sp.held === 'axe' ? 2 : 3) + tilt; shaft(gx - 1, bot, tx, topY, 2);
      if (sp.held === 'axe') pen.poly([[tx, topY - 2], [tx + 14, topY - 10], [tx + 17, topY + 8], [tx, topY + 8]], steel, 1.05, METAL);
      if (sp.held === 'club') pen.capsule(tx, topY + 2, tx + 1, topY - 12, 6.5, wood, 1);
      if (sp.held === 'hammer') pen.rows(topY - 6, topY + 4, () => [tx - 7, tx + 8], steel, 1.05, METAL);
      if (sp.held === 'pick') pen.poly([[tx - 13, topY + 4], [tx - 6, topY - 2], [tx + 8, topY - 2], [tx + 15, topY + 4], [tx + 8, topY + 1], [tx - 6, topY + 1]], steel, 1.05, METAL);
      break; }
    case 'bow': {
      const half = H * .26;
      for (let i = -half; i <= half; i++) { const t = i / half; pen.dot(gx + 9 - t * t * 6, gripY + i, .65, wood); pen.dot(gx + 10 - t * t * 6, gripY + i, .5, wood); }
      pen.line(gx + 3, gripY - half, gx + 3, gripY + half, '#d8d4c4', '|', 1);
      break; }
    case 'cup': {
      pen.poly([[gx - 4, gripY - 8], [gx + 5, gripY - 8], [gx + 3, gripY + 1], [gx - 2, gripY + 1]], wood, 1.05);
      pen.put(gx, gripY - 8, '-', '#2a2018'); break; }
    case 'basket': {
      pen.ellipse(gx + 2, gripY + 8, 10, 7, wood, 1.05, '#=#x');
      for (let i = 0; i < 5; i++) pen.put(gx - 4 + i * 3 + noise(i, 1, o.seed) * 2, gripY + 2 - noise(i, 2, o.seed) * 3, 'o', ['#c0442e', '#d8a02a', '#7a9a3a'][i % 3]);
      pen.line(gx - 7, gripY + 4, gx, gripY - 3, wood[0], '/', 1); pen.line(gx + 10, gripY + 4, gx + 3, gripY - 3, wood[0], '\\', 1); break; }
    case 'dagger': {
      pen.poly([[gx - 2 + tilt, gripY - 3], [gx + 1 + tilt, gripY - 20], [gx + 3 + tilt, gripY - 3]], steel, 1.05, METAL); pen.rows(gripY - 4, gripY - 2, () => [gx - 4, gx + 5], wood, 1); break; }
    case 'lantern': {
      const ly = gripY + 8; pen.ellipse(gx, ly, 11, 11, tones('#ffcf6a'), .9, '.', (x, y) => noise(x, y, o.seed + 3) > .78);
      pen.line(gx, gripY, gx, ly - 5, '#4a4038', '|', 1);
      pen.rows(ly - 5, ly + 5, () => [gx - 4, gx + 4], tones('#ffcf6a'), 1.15, '%@#');
      pen.line(gx - 5, ly - 5, gx + 5, ly - 5, '#4a4038', '=', 1); pen.line(gx - 5, ly + 6, gx + 5, ly + 6, '#4a4038', '=', 1); break; }
    default: break;
  }
  if (sp.shield) {
    const sx = hands[0].hx - 2; const sy = hands[0].hy - 12; const sh = tones(sp.shield);
    pen.poly([[sx - 11, sy - 14], [sx + 11, sy - 14], [sx + 11, sy + 6], [sx, sy + 24], [sx - 11, sy + 6]], sh, 1.0, RAMP);
    pen.line(sx - 11, sy - 14, sx + 11, sy - 14, '#c4ccce', '=', 1); pen.line(sx, sy - 13, sx, sy + 22, '#aab2b4', '|', 1);
    pen.ellipse(sx, sy - 2, 3.4, 3.4, tones('#aab2b4'), 1.1, METAL);
  }

  /* 5. head */
  const hair = tones(sp.hairColor);
  const face = hcx + 1;
  const faceOpen = (x: number, y: number) => ((x - hcx) / (rx * .8)) ** 2 + ((y - (hcy + hr * .18)) / (hr * .78)) ** 2 > 1;
  if (sp.hair === 'long' && sp.headwear !== 'hood') {
    const len = sp.height * .34;
    pen.rows(hcy - hr * .3, hcy + len, y => { const t = Math.max(0, (y - hcy) / len); const w = rx + 3 + t * 3; const off = sway * .8 * t - (walk ? stepS : 0) * t; return [hcx + off - w, hcx + off + w]; }, hair, .95, RAMP, (x, y) => !(Math.abs(x - hcx) < rx * .5 && y > hcy + hr * .6 && y < shY + 10) || y < hcy);
  }
  if (sp.hair === 'tied') pen.capsule(hcx - rx - 1, hcy, hcx - rx - 5 - sway * 2, hcy + hr * 1.6, 2.4, hair, .95);
  const earY = hcy + 1 + Math.sin(o.time * 2.3) * (sp.ears === 'long' ? .9 : 0);
  for (const side of [-1, 1]) {
    const ex = hcx + side * (rx - 1); const e = sp.earSize;
    if (sp.ears === 'round') pen.ellipse(hcx + side * (rx + .5), earY, 1.8 * e, 2.8 * e, skin, .9);
    else if (sp.ears === 'pointed') pen.poly([[ex, earY + 3], [ex + side * 3 * e, earY - 2], [ex + side * 8.5 * e, earY - 9 * e], [ex + side * 5.5 * e, earY + 1], [ex + side, earY + 5]], skin, .95);
    else pen.poly([[ex, earY + 4], [ex + side * 4, earY - 1], [ex + side * 12 * e, earY - 6 * e], [ex + side * 17 * e, earY - 13 * e], [ex + side * 16 * e, earY - 3 * e], [ex + side * 9 * e, earY + 5 * e], [ex + side * 2, earY + 7]], skin, .95);
    if (sp.ears !== 'round') pen.line(ex + side * 3, earY + 1, ex + side * 7 * e, earY - 4 * e, mix(sp.skin, '#b04040', .4), side > 0 ? '/' : '\\', 1);
    if (sp.gold) pen.put(ex + side * 1.5, earY + 4, 'o', GOLD);
  }
  if (sp.headwear === 'hood') pen.ellipse(hcx, hcy - 1, rx + 5, hr + 5, tones(sp.headColor), .92);
  pen.ellipse(hcx, hcy, rx, hr, skin, 1.04);
  // Broad form shading: a shaded jaw under a lit cheek, visible after downsampling.
  pen.ellipse(face, hcy + hr * .42, rx * .78, hr * .44, skin.map(c => mix(c, '#000000', .14)), .9, RAMP, (_x, y) => y > hcy + hr * .12);
  if (sp.hair !== 'none' && sp.headwear !== 'hood' && sp.headwear !== 'scarf') {
    const cut = sp.hair === 'short' ? .1 : .26;
    pen.ellipse(hcx, hcy - hr * .16, rx + 2.2, hr * 1.18, hair, 1.06, ':;+=oxO#%@', (x, y) => y < hcy - hr * cut + Math.abs(x - hcx) * .14);
  }
  // ONE highlight. A pair of 1-cell eyes averages into noise at 0.25-0.36x;
  // a single broad cheek/nose glint (or the goblin's lone eye) remains readable.
  const glowing = sp.eyes === '#f2d23a';
  const hlColor = glowing ? sp.eyes : mix(sp.skin, '#ffffff', .58);
  const hlPal = [hlColor, hlColor, hlColor, hlColor, hlColor];
  pen.ellipse(face + rx * .12, hcy - hr * .06, rx * .24, hr * .18, hlPal, 1.18, 'oO#%@');
  if (sp.tusks) for (const side of [-1, 1]) pen.poly([[face + side * rx * .5 - 1.4, hcy + hr * .7], [face + side * rx * .5 + 1.4, hcy + hr * .7], [face + side * rx * .5 + side * .5, hcy + hr * .7 - 3 - sp.tusks * 3]], tones('#e8e0c8'), 1.1, METAL);
  if (sp.beard !== 'none') {
    const bd = tones(sp.beardColor);
    if (sp.beard === 'short') pen.ellipse(face, hcy + hr * .72, rx * .78, hr * .58, bd, 1, RAMP, (_x, y) => y > hcy + hr * .3);
    else {
      const len = sp.beard === 'braided' ? torsoLen * .72 : torsoLen * .6; const top = hcy + hr * .25;
      pen.rows(top, hcy + hr + len, y => { const t = clamp((y - top) / (hr + len), 0, 1); const w = rx * .92 * (1 - t * .55) + (t < .2 ? 1 : 0); const off = sway * .6 * t; return [face + off - w, face + off + w]; }, bd, 1, RAMP, (x, y) => !(y < hcy + hr * .55 && Math.abs(x - face) < rx * .55 && y > hcy + hr * .38));
      if (sp.beard === 'braided') {
        for (let y = Math.round(hcy + hr + 2); y < hcy + hr + len; y += 3) for (const bx of [-5, 5]) { pen.put(face + bx - 1, y, 'S', bd[3]); pen.put(face + bx, y + 1, 'S', bd[1]); }
        for (const bx of [-5, 5]) pen.put(face + bx, hcy + hr + len - 1, 'o', GOLD);
        pen.ellipse(face, hcy + hr + len * .45, 4.5, 2, tones(GOLD), 1, METAL);
      }
      pen.line(face - 3, hcy + hr * .62, face + 3, hcy + hr * .62, '#2a1810', '-', 1);
    }
  }
  const hc = tones(sp.headColor); const ha = tones(sp.headAccent);
  switch (sp.headwear) {
    case 'hood':
      pen.ellipse(hcx, hcy - 1, rx + 4, hr + 4, hc, .92, RAMP, (x, y) => !faceOpen(x, y) || y < hcy - hr * .5);
      pen.rows(hcy + hr * .5, shY + 9, y => { const t = (y - hcy) / (shY + 9 - hcy); return [hcx - rx - 4 - t * 6, hcx + rx + 4 + t * 6]; }, hc, .85, RAMP, (x, y) => !faceOpen(x, y) && (y > hcy + hr * .9 || Math.abs(x - hcx) > rx * .8) && !(y < shY + 2 && Math.abs(x - hcx) < rx * .7));
      break;
    case 'straw':
      pen.ellipse(hcx, hcy - hr * .78, rx * .86, hr * .62, hc, 1.05, ':;/\\#');
      pen.ellipse(hcx, hcy - hr * .42, rx * 2.35, hr * .36, hc, 1.05, ':;/\\#', (x, y) => !(y > hcy - hr * .42 + 1 && noise(x, y, 4) < .12));
      pen.rows(hcy - hr * .62, hcy - hr * .5, () => [hcx - rx * .8, hcx + rx * .8], ha, .8);
      break;
    case 'feather': case 'cap':
      pen.ellipse(hcx, hcy - hr * .62, rx + 2.2, hr * .6, hc, 1, RAMP, (_x, y) => y < hcy - hr * .3);
      pen.ellipse(hcx + 3, hcy - hr * .42, rx * 1.5, hr * .22, hc, 1.05);
      if (sp.headwear === 'feather') { pen.line(hcx + rx - 2, hcy - hr * .8, hcx + rx + 6, hcy - hr * 1.9, ha[3], '/', 2); pen.line(hcx + rx - 4, hcy - hr * 1.1, hcx + rx + 10, hcy - hr * 1.7 + 3, ha[2], '~', 1); pen.put(hcx + rx - 2, hcy - hr * .78, 'o', GOLD); }
      break;
    case 'helm': case 'lamp':
      pen.ellipse(hcx, hcy - hr * .4, rx + 2, hr * .9, hc, 1.05, METAL, (_x, y) => y < hcy + hr * .05);
      pen.rows(hcy - hr * .6, hcy + hr * .5, () => [face - 1, face + 1], hc, 1.1, METAL);
      pen.rows(hcy - hr * .15, hcy + hr * .5, () => [hcx - rx - 1, hcx - rx + 2], hc, .9, METAL);
      pen.rows(hcy - hr * .15, hcy + hr * .5, () => [hcx + rx - 2, hcx + rx + 1], hc, .9, METAL);
      pen.line(hcx - rx - 2, hcy - hr * .15, hcx + rx + 2, hcy - hr * .15, ha[1], '=', 1);
      if (sp.headwear === 'lamp') { pen.ellipse(face + 1, hcy - hr * .6, 8, 8, tones('#ffd460'), .8, '.', (x, y) => noise(x, y, o.seed + 5) > .8); pen.ellipse(face + 1, hcy - hr * .6, 3.2, 3, tones('#ffe28a'), 1.2, '%@#'); }
      else if (sp.headAccent !== sp.headColor) pen.poly([[hcx - rx, hcy - hr * 1.2], [hcx + rx + 4, hcy - hr * 1.7 + sway], [hcx + rx + 3, hcy - hr * 1.0], [hcx - rx, hcy - hr * 1.0]], ha, 1, RAMP);
      break;
    case 'skullhelm': {
      const bone = tones('#d8d0b6');
      pen.ellipse(hcx, hcy - hr * .35, rx + 2.5, hr * .98, bone, 1.05, METAL, (_x, y) => y < hcy + hr * .1);
      pen.rows(hcy - hr * .4, hcy - hr * .15, () => [hcx - rx * .9, hcx + rx * .9], tones('#3a3228'), .7);
      for (const side of [-1, 1]) {
        pen.poly([[hcx + side * (rx + 1), hcy - hr * .6], [hcx + side * (rx + 9), hcy - hr * 1.1], [hcx + side * (rx + 14), hcy - hr * 2.2], [hcx + side * (rx + 9), hcy - hr * 1.0], [hcx + side * (rx + 3), hcy - hr * .1]], bone, .95, METAL);
        pen.put(hcx + side * rx * .45 + 1, hcy - hr * .26, '@', '#1a1410');
      }
      for (let x = -3; x <= 3; x += 2) pen.put(hcx + x + 1, hcy + hr * .08, '^', '#ece4cc');
      break; }
    case 'crown': {
      const g = tones(GOLD);
      pen.rows(hcy - hr * .95, hcy - hr * .55, () => [hcx - rx * .95, hcx + rx * .95], g, 1.05, METAL);
      for (let i = -2; i <= 2; i++) pen.poly([[hcx + i * rx * .42 - 2, hcy - hr * .95], [hcx + i * rx * .42, hcy - hr * 1.5], [hcx + i * rx * .42 + 2, hcy - hr * .95]], g, 1.1, METAL);
      for (let i = -1; i <= 1; i++) pen.put(hcx + i * rx * .5 + 1, hcy - hr * .72, '*', i ? '#e04050' : '#40a0e0');
      break; }
    case 'circlet':
      pen.line(hcx - rx + 1, hcy - hr * .5, hcx + rx - 1, hcy - hr * .5, GOLD, '=', 2);
      pen.ellipse(face, hcy - hr * .52, 1.9, 2.4, tones('#5ec8ff'), 1.2, METAL); pen.put(face, hcy - hr * .52, '*', '#ffffff'); break;
    case 'scarf':
      pen.ellipse(hcx, hcy - 1, rx + 2.6, hr + 2.4, hc, .98, RAMP, (x, y) => !faceOpen(x, y) || y < hcy - hr * .4);
      pen.capsule(hcx - rx - 1, hcy + hr * .5, hcx - rx - 5 - sway * 1.5, hcy + hr * 1.5, 2.6, hc, .95);
      pen.line(hcx - rx + 1, hcy + hr * .8, hcx + rx - 1, hcy + hr * .8, ha[3], '~', 1); break;
    case 'bandage': {
      const bw = tones('#e6dcc4'); const ink = tones('#b0a384');
      pen.ellipse(hcx, hcy - hr * .5, rx + 1.4, hr * .62, bw, 1, RAMP, (_x, y) => y < hcy - hr * .1);
      for (let y = Math.round(hcy - hr * 1.1); y < hcy; y += 3) pen.line(hcx - rx - 1, y, hcx + rx + 1, y + 1, ink[1], '-', 1);
      // A single broad wrap across the face: no tiny eye detail at game scale.
      pen.rows(hcy - hr * .12, hcy + hr * .14, () => [hcx - rx * .9, hcx + rx * .9], bw, 1.02);
      pen.line(hcx - rx, hcy - hr * .18, hcx + rx, hcy - hr * .18, ink[1], '=', 1);
      pen.capsule(hcx - rx - 1, hcy + hr * .2, hcx - rx - 4, hcy + hr * .9 + sway, 1.8, bw, .95); break; }
    default: break;
  }
  return s.frame(o.facing === 'left');
}
