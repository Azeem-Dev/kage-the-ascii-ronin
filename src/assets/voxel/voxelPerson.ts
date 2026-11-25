import { noise, type AsciiCell, type AssetOptions } from '../types.ts';
import type { BodySpec } from '../people/body.ts';
import { VoxelGrid, renderVoxels, tint } from './voxel.ts';

/** Voxel humanoid built from a BodySpec. Local axes: f = forward, s = sideways, z = up.
 * Facing right looks toward world +X, facing left toward world +Y; both are visible
 * faces in the isometric view, so the front of the figure is always shown. */

function sizes(sp: BodySpec) {
  const hs = Math.ceil(sp.shoulder * 1.35 + 16);
  const hf = Math.ceil(sp.shoulder * .95 + 16);
  return { hs, hf, nz: Math.ceil(sp.height + 34) };
}

export function personSpriteSize(sp: BodySpec): { width: number; height: number; anchor: { x: number; y: number } } {
  const { hs, hf, nz } = sizes(sp);
  const halfW = hs + hf;
  const anchorY = nz + Math.ceil(halfW / 3);
  return { width: halfW * 2 + 1, height: anchorY + Math.ceil(halfW / 3) + 1, anchor: { x: halfW, y: anchorY } };
}

export function buildPerson(sp: BodySpec, o: AssetOptions, sizeSpec: BodySpec = sp): VoxelGrid {
  const { hs, hf, nz } = sizes(sizeSpec);
  const right = o.facing !== 'left';
  const g = new VoxelGrid(right ? hf : hs, right ? hs : hf, nz);
  const put = (f: number, s: number, z: number, c: string, glow = false) => {
    if (right) g.set(Math.floor(f), Math.floor(s), Math.floor(z), c, glow);
    else g.set(Math.floor(s), Math.floor(f), Math.floor(z), c, glow);
  };
  const ell = (cf: number, cs: number, cz: number, rf: number, rs: number, rz: number, color: string | ((f: number, s: number, z: number) => string)) => {
    for (let z = Math.floor(cz - rz); z <= Math.ceil(cz + rz); z++) for (let s = Math.floor(cs - rs); s <= Math.ceil(cs + rs); s++) for (let f = Math.floor(cf - rf); f <= Math.ceil(cf + rf); f++) {
      const d = ((f + .5 - cf) / rf) ** 2 + ((s + .5 - cs) / rs) ** 2 + ((z + .5 - cz) / rz) ** 2;
      if (d > 1) continue;
      put(f, s, z, typeof color === 'string' ? color : color(f, s, z));
    }
  };
  const seg = (f0: number, s0: number, z0: number, f1: number, s1: number, z1: number, r: number, c: string) => {
    const n = Math.ceil(Math.max(Math.abs(f1 - f0), Math.abs(s1 - s0), Math.abs(z1 - z0)) * 1.5) + 1;
    for (let i = 0; i <= n; i++) { const t = i / n; ell(f0 + (f1 - f0) * t, s0 + (s1 - s0) * t, z0 + (z1 - z0) * t, r, r, r, c); }
  };
  const tone = (c: string, x: number, z: number, k = .16) => tint(c, 1 - k / 2 + noise(Math.floor(x), Math.floor(z), 11 + (o.seed & 3) * 5) * k);

  const H = sp.height; const sh = sp.shoulder;
  const walk = o.action === 'walk' || o.action === 'run';
  const ph = o.time * 6.5;
  const swing = walk ? Math.sin(ph) : 0;
  const bob = walk ? Math.abs(Math.sin(ph)) * 1.4 : (.5 + .5 * Math.sin(o.time * 2.9)) * 1.6;
  const legsH = Math.round(H * sp.legs);
  const hipZ = legsH;
  const headR = sp.head;
  const headZ = H - headR + bob;
  const neckZ = H - headR * 2 + 1 + bob;
  const skirted = sp.legsKind === 'skirt' || sp.legsKind === 'robe' || sp.torso === 'robe' && sp.legsKind !== 'trousers';
  const lean = sp.hunch * 7;
  const lr = sh * .27;                       // leg radius

  /* ---- legs ---- */
  const bootH = sp.boots ? Math.round(H * .09) : 0;
  const legC = (z: number, x: number) => z < bootH ? tone(sp.boots!, x, z) : sp.legsKind === 'bare' || sp.legsKind === 'loin' ? tone(sp.skin, x, z, .1) : tone(sp.legsColor, x, z);
  if (!skirted) for (const side of [-1, 1]) {
    const sw = swing * side * 9;
    for (let z = 0; z < hipZ; z++) {
      const t = 1 - z / hipZ;               // 1 at the hip, 0 at the foot
      const lift = walk && sw > 0 ? Math.max(0, Math.sin(ph) * side) * 2.2 * (1 - t) : 0;
      ell(sw * t, side * sh * .42, z + .5 + lift, lr * (z < bootH ? 1.15 : .95 + t * .2), lr, .9, tone(legC(z, side * 7) as string, z, side, .1));
    }
    // foot
    ell(sw * 0 + lr * .8 + (walk ? sw * .15 : 0), side * sh * .42, 1.8, lr * 1.7, lr * 1.05, 1.8, sp.boots ? tint(sp.boots, .85) : tint(sp.skin, .9));
  } else {
    const hem = sp.legsKind === 'robe' || sp.torso === 'robe' ? H * .06 : H * .2;
    const c = sp.legsKind === 'robe' || sp.torso === 'robe' ? sp.torsoColor : sp.legsColor;
    for (let z = Math.floor(hem); z < hipZ + 4; z++) {
      const t = (hipZ + 4 - z) / (hipZ + 4 - hem);
      const w = sh * (.62 + t * .5) + sp.belly * .6;
      ell(swing * 2 * t, 0, z + .5, w * .78, w, .9, tone(c, z, 3));
    }
    if (sp.boots) for (const side of [-1, 1]) ell(lr * 1.2 + swing * side * 3, side * sh * .35, 1.6, lr * 1.7, lr, 1.6, tint(sp.boots, .85));
  }

  /* ---- torso ---- */
  const tc = sp.torso === 'bare' ? sp.skin : sp.torsoColor;
  const waistW = sh * .66 + sp.belly * 1.2; const chestW = sh * .92;
  const depth = sh * .5 + sp.belly * .5;
  const torsoBottom = hipZ - 3;
  for (let z = torsoBottom; z <= neckZ + 1; z++) {
    const t = (z - torsoBottom) / Math.max(1, neckZ + 1 - torsoBottom);
    const w = waistW + (chestW - waistW) * Math.min(1, t * 1.5) * (t > .85 ? 1 - (t - .85) * 3 : 1);
    const d = depth * (.85 + .25 * Math.sin(t * 3));
    const off = lean * t;
    let c = tone(tc, z, 5, .14);
    if (sp.torso === 'vest' && sp.under && Math.abs(0) < 1) c = tone(sp.under, z, 6);
    ell(off, 0, z + .5, d, w, .85, c);
  }
  if (sp.torso === 'vest') for (let z = torsoBottom + 3; z <= neckZ - 2; z++) {  // vest panels over the shirt
    for (const side of [-1, 1]) ell(depth * .85 + lean * (z - torsoBottom) / (neckZ - torsoBottom), side * waistW * .55, z + .5, 1.2, waistW * .38, .8, tone(sp.torsoColor, z, side));
  }
  if (sp.plates) for (let z = Math.round(hipZ + 6); z <= neckZ - 1; z++) ell(depth * .95 + lean * .5, 0, z + .5, 1.5, chestW * .8, .8, tone(sp.plates, z, 2, .22));
  if (sp.tabard) for (let z = Math.round(hipZ - H * .16); z <= neckZ - 2; z++) ell(depth * .9 + 1 + lean * (z - hipZ > 0 ? .5 : 0), 0, z + .5, 1.2, chestW * .42, .8, tone(sp.tabard, z, 8, .1));
  if (sp.apron) for (let z = Math.round(hipZ - H * .17); z <= neckZ - 6; z++) ell(depth * .9 + 1, 0, z + .5, 1.2, chestW * .5, .8, tone(sp.apron, z, 9, .12));
  if (sp.belt) for (let s = -waistW; s <= waistW; s++) ell(0, s, hipZ + 1.5, depth + .9, 1.1, 1.2, sp.belt);
  if (sp.sash) for (let i = 0; i < 18; i++) { const t = i / 17; ell(depth + 1 + lean * .5, -chestW * .8 + t * chestW * 1.5, neckZ - 2 - t * (neckZ - hipZ - 4), 1.4, 1.7, 1.7, sp.sash); }
  if (sp.pouch) ell(depth * .4, waistW + 1, hipZ - 3, 2.8, 2.2, 3, sp.pouch);
  if (sp.furCollar) ell(0, 0, neckZ - 1, depth + 3, chestW * .95, 3.2, tone(sp.furCollar, 2, 2, .3));
  if (sp.cloak) {
    for (let z = Math.round(H * .05); z <= neckZ; z++) {
      const t = (z - H * .05) / (neckZ - H * .05);
      ell(-depth - 2 - (1 - t) * 3 - lean * t * .5, 0, z + .5, 1.6, chestW * (1.05 + (1 - t) * .25), .85, tone(sp.cloak, z, 4, .16));
    }
  }
  // Ragged hems and patches.
  if (sp.patches) for (let i = 0; i < sp.patches * 3; i++) {
    const pc = sp.patchColors[i % sp.patchColors.length];
    ell(depth * .9, (noise(i, 1, o.seed) - .5) * chestW * 1.3, hipZ + 4 + noise(i, 2, o.seed) * (neckZ - hipZ - 8), 1.4, 3.2, 2.8, pc);
  }

  /* ---- arms ---- */
  const armLen = H * sp.arm;
  const sleeve = sp.sleeves;
  for (const side of [-1, 1]) {
    const sw = walk ? -swing * side * 8 : Math.sin(o.time * 1.9 + side) * 1.8;
    const sx = side * (chestW + 1.8);
    const z0 = neckZ - 3;
    const handF = sw + (sp.reach && side === 1 ? 6 : 0) + lean * .7;
    const handZ = z0 - armLen + (sp.reach && side === 1 ? 7 : 0);
    const mid = 0.5;
    const elbowF = handF * .4; const elbowZ = z0 - armLen * mid;
    const ar = Math.max(2.4, sh * .17);
    const sleeveC = sleeve === 'none' ? sp.skin : tone(tc, 2, side);
    seg(0, sx, z0, elbowF, sx + side * .6, elbowZ, ar, sleeve === 'none' ? sp.skin : sleeveC);
    seg(elbowF, sx + side * .6, elbowZ, handF, sx + side * 1.2, handZ + 1.5, ar * .9, sleeve === 'long' ? sleeveC : tint(sp.skin, .95));
    ell(handF, sx + side * 1.2, handZ, ar * .95, ar * .9, ar * .9, tint(sp.skin, .93));
    if (side === 1) drawHeld(handF, sx + side * 1.2, handZ);
    if (side === -1 && sp.shield) {
      ell(handF + 3, sx - 3, z0 - armLen * .55, 2, sh * .62, sh * .75, tone(sp.shield, 3, 3, .2));
      ell(handF + 4.6, sx - 3, z0 - armLen * .55, .9, sh * .22, sh * .22, '#c8c4b0');
    }
  }

  function drawHeld(hf: number, hs2: number, hz: number): void {
    const wood = sp.heldColor; const metal = sp.heldAccent;
    switch (sp.held) {
      case 'spear': seg(hf, hs2, hz - 38, hf, hs2, H + 28, 1.1, wood); seg(hf, hs2, H + 28, hf, hs2, H + 40, 1.9, metal); break;
      case 'staff': seg(hf, hs2, 0, hf, hs2, H + 14, 1.5, wood); ell(hf, hs2, H + 17, 3.6, 3.6, 3.6, metal); break;
      case 'axe': seg(hf, hs2, hz - 22, hf, hs2, hz + 24, 1.3, wood); ell(hf + 1, hs2, hz + 20, 2, 9, 7, metal); break;
      case 'club': seg(hf, hs2, hz - 6, hf + 6, hs2, hz + 24, 2, wood); ell(hf + 7, hs2, hz + 25, 4.6, 4.6, 6, wood); break;
      case 'hammer': seg(hf, hs2, hz - 10, hf, hs2, hz + 20, 1.5, wood); ell(hf, hs2, hz + 22, 5, 8.5, 5, metal); break;
      case 'pick': seg(hf, hs2, hz - 18, hf, hs2, hz + 26, 1.4, wood); seg(hf, hs2 - 9, hz + 25, hf, hs2 + 9, hz + 25, 1.5, metal); break;
      case 'pitchfork': seg(hf, hs2, hz - 38, hf, hs2, H + 14, 1.2, wood); for (const d of [-5, 0, 5]) seg(hf, hs2 + d, H + 12, hf, hs2 + d, H + 24, 1, metal); seg(hf, hs2 - 5, H + 13, hf, hs2 + 5, H + 13, 1, metal); break;
      case 'bow': for (let i = 0; i <= 24; i++) { const a = (i / 24 - .5) * Math.PI * .95; ell(hf + Math.cos(a) * 5 - 5, hs2, hz + 4 + Math.sin(a) * 28, 1.2, 1.2, 1.2, wood); } break;
      case 'dagger': seg(hf, hs2, hz, hf + 8, hs2, hz + 7, 1, metal); break;
      case 'cup': ell(hf + 3, hs2, hz + 3, 3, 3, 3.4, metal); break;
      case 'basket': ell(hf + 5, hs2 + 2, hz - 1, 7, 8, 5, tone(wood, 5, 5, .3)); break;
      case 'lantern': seg(hf, hs2, hz - 1, hf + 3, hs2, hz - 8, .8, '#2e2a26'); ell(hf + 3, hs2, hz - 12, 3, 3, 4.5, '#ffd27a'); g.set(right ? hf + 3 : hs2, right ? hs2 : hf + 3, hz - 12, '#fff2b0', true); break;
      default: break;
    }
  }

  /* ---- neck and head ---- */
  ell(lean, 0, neckZ + 1, headR * .42, headR * .45, 3, tone(sp.skin, 3, 3, .08));
  const hf2 = lean + (sp.hunch > .3 ? 3 : 0);
  ell(hf2, 0, headZ, headR * .92, headR * .84, headR, (f, s, z) => tone(sp.skin, f + s, z, .09));
  // Face: nose, brow, eyes.
  ell(hf2 + headR * .88, 0, headZ - headR * .12, 1.2 + sp.nose * .8, 1.3, 1.8 + sp.nose * .6, tint(sp.skin, .93));
  for (const side of [-1, 1]) {
    ell(hf2 + headR * .8, side * headR * .36, headZ + headR * .12, .9, 1.2, 1.2, sp.eyes);
    ell(hf2 + headR * .86, side * headR * .36, headZ + headR * .12, .5, .7, .8, '#14100e');
    if (sp.brow) ell(hf2 + headR * .78, side * headR * .36, headZ + headR * .3, 1.2, 2, .6 + sp.brow * .4, tint(sp.hairColor, .8));
  }
  // Ears.
  for (const side of [-1, 1]) {
    if (sp.ears === 'round') ell(hf2 - 1, side * (headR * .84 + .6), headZ, 1.2, 1.3, 2.4, tint(sp.skin, .95));
    else {
      const len = (sp.ears === 'long' ? 11 : 6.5) * sp.earSize * .85;
      seg(hf2 - 1, side * headR * .8, headZ + 1, hf2 - 2, side * (headR * .8 + len), headZ + len * (sp.ears === 'long' ? .15 : .7), 1.1, tint(sp.skin, .95));
    }
  }
  // Tusks.
  if (sp.tusks) for (const side of [-1, 1]) seg(hf2 + headR * .8, side * headR * .3, headZ - headR * .5, hf2 + headR * .85, side * headR * .34, headZ - headR * .5 + 2 + sp.tusks, .9, '#eee6cf');
  // Hair.
  if (sp.hair !== 'none' && !['helm', 'skullhelm', 'hood'].includes(sp.headwear)) {
    ell(hf2 - headR * .12, 0, headZ + headR * .25, headR * .98, headR * .9, headR * .8, (f, s, z) => tone(sp.hairColor, f + z, s, .3));
    if (sp.hair === 'long') for (let z = Math.round(headZ - headR * 1.1); z <= headZ; z++) ell(hf2 - headR * .75, 0, z + .5, 1.8, headR * .78, .8, tone(sp.hairColor, z, 4, .3));
    if (sp.hair === 'tied') seg(hf2 - headR * .9, 0, headZ + headR * .1, hf2 - headR * 1.3, 0, headZ - headR * .9, 1.7, sp.hairColor);
  }
  // Beard.
  if (sp.beard !== 'none') {
    const bl = sp.beard === 'short' ? 4 : sp.beard === 'long' ? 14 : 12;
    for (let k = 0; k <= bl; k++) ell(hf2 + headR * .6 - k * .1, 0, headZ - headR * .6 - k * .9, 2.6 + (sp.beard === 'braided' ? 0 : 1 - k * .04), headR * .6 * (1 - k / (bl * 1.6)), .9, tone(sp.beardColor, k, 3, .3));
  }
  // Headwear.
  const hw = sp.headwear; const hc = sp.headColor; const ha = sp.headAccent;
  const topZ = headZ + headR * .55;
  if (hw === 'hood') ell(hf2 - 1.2, 0, headZ + 1, headR * 1.12, headR * 1.05, headR * 1.12, (f, s, z) => (f > hf2 + headR * .55 && Math.abs(s) < headR * .6 && z < headZ + headR * .5 && z > headZ - headR * .7) ? tint(sp.skin, .9) : tone(hc, f + s, z, .2));
  if (hw === 'helm' || hw === 'skullhelm') {
    ell(hf2, 0, headZ + headR * .22, headR * 1.05, headR * .95, headR * .85, (f, s, z) => tone(hc, f + s, z, .12));
    if (hw === 'helm') seg(hf2 + headR * .95, 0, headZ + headR * .4, hf2 + headR * .95, 0, headZ - headR * .35, 1.1, ha);
    if (sp.crest) ell(hf2, 0, headZ + headR * 1.1, 1.3, 1.3, 4.5, sp.crest);
  }
  if (hw === 'cap') ell(hf2, 0, headZ + headR * .35, headR * 1.02, headR * .95, headR * .72, tone(hc, 3, 3, .2));
  if (hw === 'straw') { ell(hf2, 0, topZ + 1, headR * 2.1, headR * 2.1, 1, tone(hc, 1, 2, .3)); ell(hf2, 0, topZ + 3.5, headR * .9, headR * .9, headR * .55, tone(hc, 4, 4, .3)); }
  if (hw === 'feather') { ell(hf2, 0, headZ + headR * .35, headR * 1.05, headR * .98, headR * .65, hc); seg(hf2 - 3, headR * .4, headZ + headR * .9, hf2 - 9, headR * .9, headZ + headR * 2.2, .9, ha); }
  if (hw === 'crown') { for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; const px = hf2 + Math.cos(a) * headR * .85; const py = Math.sin(a) * headR * .8; ell(px, py, topZ + 1.5, 1, 1, 1, '#f0c640'); if (i % 2 === 0) seg(px, py, topZ + 2, px, py, topZ + 6, .9, '#f0c640'); } }
  if (hw === 'circlet') for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; ell(hf2 + Math.cos(a) * headR * .9, Math.sin(a) * headR * .85, headZ + headR * .5, .8, .8, .8, ha); }
  if (hw === 'scarf' || hw === 'bandage') ell(hf2, 0, headZ + headR * .2, headR * .96, headR * .9, headR * .3, tone(hc, 3, 3, .25));
  if (hw === 'lamp') { ell(hf2, 0, headZ + headR * .45, headR * 1.02, headR * .95, headR * .6, hc); g.set(right ? Math.floor(hf2 + headR) : 0, right ? 0 : Math.floor(hf2 + headR), Math.floor(headZ + headR * .5), '#fff2b0', true); }
  return g;
}

const memo = new Map<string, { cells: AsciiCell[]; width: number; height: number }>();

/** Poses are quantised (12 walk steps, 8 idle breaths) and cached: a figure is rendered once per pose and scale. */
export function personAt(sp: BodySpec, o: AssetOptions, sizeSpec: BodySpec, scale: number): { cells: AsciiCell[]; width: number; height: number } {
  const walking = o.action === 'walk' || o.action === 'run';
  const step = walking ? Math.round(o.time * 6.5 / (Math.PI * 2) * 12) % 12 : Math.round(o.time * 2.9 / (Math.PI * 2) * 8) % 8;
  const q: AssetOptions = { ...o, time: walking ? step / 12 * Math.PI * 2 / 6.5 : step / 8 * Math.PI * 2 / 2.9 };
  const key = `${sp.skin}${sp.torsoColor}${sp.legsColor}${sp.headwear}${sp.held}${sp.hairColor}${sp.cloak ?? ''}${sp.tabard ?? ''}${sp.apron ?? ''}${sp.shoulder}${sp.height}|${sizeSpec.shoulder}|${sp.patches ? o.seed : o.seed & 3}|${o.facing}|${o.action}|${step}|${scale.toFixed(2)}`;
  const hit = memo.get(key);
  if (hit) { memo.delete(key); memo.set(key, hit); return hit; }
  const r = renderVoxels(buildPerson(sp, q, sizeSpec), { ambient: .6, cellsPerUnit: scale });
  const out = { cells: r.cells, width: r.width, height: r.height };
  memo.set(key, out);
  if (memo.size > 200) memo.delete(memo.keys().next().value!);
  return out;
}

export function personCells(sp: BodySpec, o: AssetOptions, sizeSpec: BodySpec = sp): AsciiCell[] {
  return personAt(sp, o, sizeSpec, 1).cells;
}

export type PersonModelRenderer = (sp: BodySpec, o: AssetOptions, sizeSpec: BodySpec, scale: number) => { cells: AsciiCell[]; width: number; height: number } | null;
let modelRenderer: PersonModelRenderer | null = null;
/** The browser build registers the three.js model renderer here; Node tests fall back to the voxel figure. */
export function setPersonModelRenderer(fn: PersonModelRenderer | null): void { modelRenderer = fn; }
export function personModel(sp: BodySpec, o: AssetOptions, sizeSpec: BodySpec, scale: number) {
  return modelRenderer?.(sp, o, sizeSpec, scale) ?? personAt(sp, o, sizeSpec, scale);
}
