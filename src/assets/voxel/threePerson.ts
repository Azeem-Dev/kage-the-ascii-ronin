import * as THREE from 'three';
import { noise, type AsciiCell, type AssetOptions } from '../types.ts';
import type { BodySpec } from '../people/body.ts';
import { personSpriteSize } from './voxelPerson.ts';

/**
 * Characters as real three.js models, turned into glyph cells by an ASCII conversion pass.
 *
 * 1. A low-poly articulated humanoid is built from the BodySpec (legs, torso, arms, head,
 *    clothing, headwear, held items) with real lighting.
 * 2. It is rendered into a small offscreen target with a custom orthographic matrix that is
 *    exactly the game's isometric projection: screenX = X - Y, screenY = (X + Y) / 3 - Z.
 * 3. The image is converted to cells: colour from the lit pixels, glyph density from
 *    brightness, dark outlines on silhouettes.
 * Model space is Y-up, +Z forward, X sideways; a basis change maps it into the game's Z-up world.
 */

const SS = 3;                       // supersampling per cell
const RAMP = ['.', ':', ';', 'o', 'x', 'X', '#', '%', '@'];

let renderer: THREE.WebGLRenderer | null = null;
let failed = false;
function gl(): THREE.WebGLRenderer | null {
  if (failed) return null;
  if (renderer) return renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas: document.createElement('canvas'), antialias: false, alpha: true, powerPreference: 'low-power' });
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(1);
    return renderer;
  } catch { failed = true; return null; }
}

const matCache = new Map<string, THREE.Material>();
function mat(color: string, rough = .82, glow = false): THREE.Material {
  const key = `${color}|${rough}|${glow}`;
  let m = matCache.get(key);
  if (!m) {
    m = glow ? new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide }) : new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: .05, side: THREE.DoubleSide });
    matCache.set(key, m);
  }
  return m;
}

function build(sp: BodySpec, o: AssetOptions): THREE.Group {
  const root = new THREE.Group();
  const add = (parent: THREE.Object3D, geo: THREE.BufferGeometry, color: string, x = 0, y = 0, z = 0, rough = .82, glow = false): THREE.Mesh => {
    const m = new THREE.Mesh(geo, mat(color, rough, glow));
    m.position.set(x, y, z); m.frustumCulled = false; parent.add(m); return m;
  };
  const cyl = (rt: number, rb: number, h: number, seg = 12) => new THREE.CylinderGeometry(rt, rb, h, seg);
  const sph = (r: number, ws = 14, hs = 10) => new THREE.SphereGeometry(r, ws, hs);
  const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);

  const H = sp.height; const sh = sp.shoulder;
  const walk = o.action === 'walk' || o.action === 'run';
  const ph = o.time * 6.5;
  const swing = walk ? Math.sin(ph) : 0;
  const bob = walk ? Math.abs(Math.sin(ph)) * 1.4 : (.5 + .5 * Math.sin(o.time * 2.9)) * 1.2;
  const legsH = Math.round(H * sp.legs);
  const hipY = legsH;
  const headR = sp.head;
  const headY = H - headR + bob;
  const neckY = H - headR * 2 + 1 + bob;
  const lean = sp.hunch * 6;
  const skirted = sp.legsKind === 'skirt' || sp.legsKind === 'robe' || (sp.torso === 'robe' && sp.legsKind !== 'trousers');
  const lr = sh * .27;
  const seedTone = (c: string) => c;

  /* legs */
  const bootH = sp.boots ? Math.round(H * .09) : 0;
  if (!skirted) {
    for (const side of [-1, 1]) {
      const piv = new THREE.Group(); piv.position.set(side * sh * .42, hipY + bob * .2, 0); root.add(piv);
      piv.rotation.x = swing * side * .75;
      const legC = sp.legsKind === 'bare' || sp.legsKind === 'loin' ? sp.skin : sp.legsColor;
      add(piv, cyl(lr * 1.05, lr * .85, legsH - bootH, 10), legC, 0, -(legsH + bootH) / 2);
      if (sp.boots) add(piv, cyl(lr * .95, lr * 1.12, bootH + 1, 10), sp.boots, 0, -legsH + bootH / 2);
      add(piv, box(lr * 1.7, 3, lr * 3), sp.boots ? sp.boots : sp.skin, 0, -legsH + 1.5, lr * .9);
    }
  } else {
    const robe = sp.legsKind === 'robe' || sp.torso === 'robe';
    const hem = robe ? H * .05 : H * .2;
    const c = robe ? sp.torsoColor : sp.legsColor;
    const top = hipY + 6;
    const cone = add(root, cyl(sh * .66 + sp.belly * .6, sh * 1.12 + sp.belly * .6, top - hem, 16), c, 0, (top + hem) / 2 + bob * .3);
    cone.scale.z = .72;
    if (sp.boots) for (const side of [-1, 1]) add(root, box(lr * 1.6, 3, lr * 3.2), sp.boots, side * sh * .32, 1.5, lr * 1.2 + swing * side * 3);
  }

  /* torso */
  const tc = sp.torso === 'bare' ? sp.skin : sp.torsoColor;
  const waistW = sh * .66 + sp.belly * 1.2; const chestW = sh * .92; const depth = sh * .52 + sp.belly * .5;
  const tBottom = hipY - 3; const tH = neckY + 1 - tBottom;
  const torso = add(root, cyl(chestW, waistW, tH, 16), tc, 0, tBottom + tH / 2 + bob * .6, lean * .3);
  torso.scale.z = depth / chestW;
  const shoulders = add(root, sph(chestW * .98, 16, 8), tc, 0, neckY - 3 + bob * .8, lean * .5);
  shoulders.scale.set(1, .26, depth / chestW);
  if (sp.torso === 'vest' && sp.under) { const v = add(root, cyl(chestW * .94, waistW * .94, tH * .98, 16), sp.under, 0, tBottom + tH / 2 + bob * .6, lean * .3 - .6); v.scale.z = depth / chestW; torso.visible = true; add(root, box(chestW * .8, tH * .86, 1.4), sp.torsoColor, 0, tBottom + tH / 2 + bob * .6, depth * .96 + lean * .3); }
  if (sp.plates) add(root, box(chestW * 1.4, tH * .5, 2.2), sp.plates, 0, tBottom + tH * .66 + bob * .6, depth * .94 + lean * .3);
  if (sp.tabard) add(root, box(chestW * .8, H * .34, 1.6), sp.tabard, 0, hipY + H * .02 + bob * .4, depth * .95 + lean * .2);
  if (sp.apron) add(root, box(chestW * 1.0, H * .3, 1.6), sp.apron, 0, hipY + H * .02 + bob * .4, depth * .95);
  if (sp.belt) { const b = add(root, cyl(waistW * 1.04, waistW * 1.04, 2.6, 16), sp.belt, 0, hipY + 1.5 + bob * .3); b.scale.z = depth / waistW; }
  if (sp.sash) { const s = add(root, box(chestW * 1.9, 3, 1.8), sp.sash, 0, neckY - tH * .45 + bob * .6, depth + 1.2); s.rotation.z = .85; }
  if (sp.pouch) add(root, sph(2.8), sp.pouch, waistW + 1, hipY - 2, depth * .3);
  if (sp.furCollar) { const f = add(root, new THREE.TorusGeometry(chestW * .78, 3.2, 8, 16), sp.furCollar, 0, neckY - 1.5 + bob * .8, lean * .4); f.rotation.x = Math.PI / 2; f.scale.y = depth / chestW; }
  if (sp.cloak) {
    const cl = add(root, box(chestW * 2.1, neckY - H * .05, 1.8), sp.cloak, 0, (neckY + H * .05) / 2 + bob * .5, -depth - 2 - lean * .4);
    cl.rotation.x = -.06;
  }
  if (sp.patches) for (let i = 0; i < sp.patches * 3; i++) {
    const pc = sp.patchColors[i % sp.patchColors.length];
    add(root, box(5, 6, 1.2), pc, (noise(i, 1, o.seed & 3) - .5) * chestW * 1.4, hipY + 6 + noise(i, 2, o.seed & 3) * (neckY - hipY - 14), depth * .96);
  }

  /* arms */
  const armLen = H * sp.arm; const ar = Math.max(2.4, sh * .17);
  const sleeveC = sp.sleeves === 'none' ? sp.skin : tc;
  const forearmC = sp.sleeves === 'long' ? tc : sp.skin;
  let heldPivot: THREE.Object3D | null = null;
  for (const side of [-1, 1]) {
    const piv = new THREE.Group(); piv.position.set(side * (chestW + 1.6), neckY - 3 + bob * .8, lean * .5); root.add(piv);
    const idle = Math.sin(o.time * 1.9 + side) * .06;
    piv.rotation.x = walk ? -swing * side * .42 : idle;
    if (sp.reach && side === 1) piv.rotation.x = -.95;
    piv.rotation.z = side * .06;
    add(piv, cyl(ar * 1.05, ar * .9, armLen * .5, 10), sleeveC, 0, -armLen * .25);
    const elbow = new THREE.Group(); elbow.position.set(0, -armLen * .5, 0); piv.add(elbow);
    elbow.rotation.x = walk ? -.25 - Math.max(0, swing * side) * .3 : -.12;
    add(elbow, cyl(ar * .9, ar * .8, armLen * .5, 10), forearmC, 0, -armLen * .25);
    const hand = new THREE.Group(); hand.position.set(0, -armLen * .52, 0); elbow.add(hand);
    add(hand, sph(ar * 1.0), sp.skin);
    if (side === 1) heldPivot = hand;
    if (side === -1 && sp.shield) { const sd = add(hand, cyl(sh * .66, sh * .66, 2, 18), sp.shield, -2, armLen * .1, 3); sd.rotation.z = Math.PI / 2; add(hand, sph(2.4), '#c8c4b0', -3.5, armLen * .1, 3); }
  }
  if (heldPivot) addHeld(heldPivot);

  function addHeld(hand: THREE.Object3D): void {
    const wood = sp.heldColor; const metal = sp.heldAccent;
    const g = new THREE.Group(); hand.add(g);
    switch (sp.held) {
      case 'spear': add(g, cyl(1, 1, H * .95, 6), wood, 0, H * .3); add(g, new THREE.ConeGeometry(2.2, 11, 8), metal, 0, H * .78 + 5); break;
      case 'staff': add(g, cyl(1.5, 1.5, H * 1.0, 6), wood, 0, H * .3); add(g, sph(3.6), metal, 0, H * .82); break;
      case 'axe': add(g, cyl(1.3, 1.3, 46, 6), wood, 0, 10); add(g, box(2, 14, 16), metal, 0, 26, 6); break;
      case 'club': add(g, cyl(1.8, 1.4, 30, 6), wood, 0, 12); add(g, sph(5), wood, 0, 27); break;
      case 'hammer': add(g, cyl(1.5, 1.5, 30, 6), wood, 0, 10); add(g, box(9, 8, 8), metal, 0, 26); break;
      case 'pick': add(g, cyl(1.4, 1.4, 44, 6), wood, 0, 6); add(g, box(18, 2.6, 2.6), metal, 0, 28); break;
      case 'pitchfork': add(g, cyl(1.2, 1.2, H * .95, 6), wood, 0, H * .3); for (const d of [-5, 0, 5]) add(g, cyl(.8, .8, 12, 5), metal, d, H * .8); add(g, box(11, 1.4, 1.4), metal, 0, H * .74); break;
      case 'bow': { const t = add(g, new THREE.TorusGeometry(24, 1.1, 6, 20, Math.PI * .95), wood, 0, 6, -4); t.rotation.z = Math.PI / 2 - Math.PI * .475; t.rotation.y = Math.PI / 2; break; }
      case 'dagger': add(g, box(1.4, 10, 2.4), metal, 0, 6, 2); break;
      case 'cup': add(g, cyl(3.2, 2.4, 5, 10), metal, 0, 3, 2); break;
      case 'basket': add(g, cyl(8, 6, 8, 12), wood, 0, -3, 5); break;
      case 'lantern': add(g, cyl(.5, .5, 8, 5), '#2e2a26', 0, -4); add(g, cyl(3.4, 3.4, 7, 8), '#ffd27a', 0, -11, 0, .5, true); break;
      default: break;
    }
  }

  /* head */
  const head = new THREE.Group(); head.position.set(0, headY, lean + (sp.hunch > .3 ? 3 : 0)); root.add(head);
  add(root, cyl(headR * .42, headR * .5, 5, 10), sp.skin, 0, neckY + .5 + bob * .8, lean);
  const skull = add(head, sph(headR, 18, 14), sp.skin); skull.scale.set(.84, 1, .92);
  add(head, sph(1.0 + sp.nose * .8), sp.skin, 0, -headR * .12, headR * .9).scale.set(.9, 1.3, 1.3);
  for (const side of [-1, 1]) {
    add(head, sph(1.2), sp.eyes, side * headR * .36, headR * .1, headR * .8);
    add(head, sph(.7), '#14100e', side * headR * .36, headR * .1, headR * .93);
    if (sp.brow) add(head, box(headR * .34, .7 + sp.brow * .5, 1.2), sp.hairColor, side * headR * .36, headR * .3, headR * .84);
    if (sp.ears === 'round') add(head, sph(1.6), sp.skin, side * headR * .86, 0, -1).scale.set(.6, 1.2, .9);
    else {
      const len = (sp.ears === 'long' ? 11 : 6.5) * sp.earSize * .9;
      const e = add(head, new THREE.ConeGeometry(1.6, len, 6), sp.skin, side * (headR * .85 + len * .4), len * (sp.ears === 'long' ? .08 : .3), -1);
      e.rotation.z = -side * (Math.PI / 2 - (sp.ears === 'long' ? .15 : .7));
    }
    if (sp.tusks) { const t = add(head, new THREE.ConeGeometry(.9, 2 + sp.tusks * 1.4, 5), '#eee6cf', side * headR * .3, -headR * .5 + 1, headR * .8); t.rotation.x = 0; }
  }
  const hasHardHat = ['helm', 'skullhelm', 'hood'].includes(sp.headwear);
  if (sp.hair !== 'none' && !hasHardHat) {
    const hair = add(head, new THREE.SphereGeometry(headR * 1.05, 18, 12, 0, Math.PI * 2, 0, Math.PI * (sp.hair === 'long' ? .68 : .56)), sp.hairColor, 0, headR * .02, -headR * .12);
    hair.scale.set(.88, 1, .96);
    if (sp.hair === 'long') add(head, box(headR * 1.5, headR * 1.7, 2.2), sp.hairColor, 0, -headR * .4, -headR * .8);
    if (sp.hair === 'tied') add(head, cyl(1.4, 1, headR * 1.2, 6), sp.hairColor, 0, -headR * .6, -headR * 1.05);
  }
  if (sp.beard !== 'none') {
    const bl = sp.beard === 'short' ? 5 : sp.beard === 'long' ? 15 : 13;
    const bd = add(head, new THREE.ConeGeometry(headR * .62, bl, 10), sp.beardColor, 0, -headR * .55 - bl * .4, headR * .45);
    bd.rotation.x = Math.PI; bd.scale.z = .75;
  }
  const hw = sp.headwear; const hc = sp.headColor; const ha = sp.headAccent;
  if (hw === 'hood') { const h = add(head, new THREE.SphereGeometry(headR * 1.18, 18, 14, Math.PI * .5 + .75, Math.PI * 2 - 1.5), hc, 0, 0, -headR * .12); h.scale.set(.95, 1.05, 1); }
  if (hw === 'helm' || hw === 'skullhelm') {
    const hm = add(head, new THREE.SphereGeometry(headR * 1.08, 18, 12, 0, Math.PI * 2, 0, Math.PI * .62), hc, 0, headR * .12, 0, .4); hm.scale.set(.9, 1, .98);
    if (hw === 'helm') add(head, box(1.6, headR * .8, 1.4), ha, 0, -headR * .05, headR * .98);
    if (sp.crest) add(head, box(1.6, 8, headR * 1.4), sp.crest, 0, headR * 1.1, 0);
  }
  if (hw === 'cap') { const c = add(head, new THREE.SphereGeometry(headR * 1.06, 16, 10, 0, Math.PI * 2, 0, Math.PI * .5), hc, 0, headR * .2, 0); c.scale.set(.9, .8, 1); }
  if (hw === 'straw') { add(head, cyl(headR * 2.1, headR * 2.1, 1.2, 20), hc, 0, headR * .62, 0); add(head, cyl(headR * .8, headR * .95, headR * .7, 14), hc, 0, headR * .95, 0); }
  if (hw === 'feather') { add(head, new THREE.SphereGeometry(headR * 1.06, 16, 10, 0, Math.PI * 2, 0, Math.PI * .5), hc, 0, headR * .25, 0); const f = add(head, cyl(.5, .5, headR * 1.8, 5), ha, headR * .55, headR * 1.5, -headR * .5); f.rotation.z = -.5; }
  if (hw === 'crown') { for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2; add(head, new THREE.ConeGeometry(1, 5, 5), '#f0c640', Math.cos(a) * headR * .8, headR * .98, Math.sin(a) * headR * .8); } add(head, new THREE.TorusGeometry(headR * .8, .9, 6, 18), '#f0c640', 0, headR * .75, 0).rotation.x = Math.PI / 2; }
  if (hw === 'circlet') add(head, new THREE.TorusGeometry(headR * .88, .7, 6, 18), ha, 0, headR * .45, 0).rotation.x = Math.PI / 2;
  if (hw === 'scarf' || hw === 'bandage') add(head, cyl(headR * .92, headR * .92, headR * .5, 16), hc, 0, headR * .3, 0).scale.z = 1.04;
  if (hw === 'lamp') { add(head, new THREE.SphereGeometry(headR * 1.04, 16, 10, 0, Math.PI * 2, 0, Math.PI * .5), hc, 0, headR * .25, 0); add(head, sph(2.2), '#fff2b0', 0, headR * .5, headR * 1.05, .5, true); }

  seedTone('');
  return root;
}

function lights(scene: THREE.Scene): void {
  scene.add(new THREE.HemisphereLight(0x9db4d8, 0x3a3836, 2.8).translateZ(1));
  const key = new THREE.DirectionalLight(0xfff0dc, 4.6); key.position.set(-32, 58, 75); scene.add(key);
  const fill = new THREE.DirectionalLight(0x7d9cd0, 1.9); fill.position.set(85, 10, 30); scene.add(fill);
  const rim = new THREE.DirectionalLight(0xaecbff, 2.2); rim.position.set(-60, -60, 50); scene.add(rim);
}

let scene: THREE.Scene | null = null;
let target: THREE.WebGLRenderTarget | null = null;
let targetW = 0; let targetH = 0;

/** Render one pose and convert to glyph cells. Returns null if WebGL is unavailable. */
export function threePersonAt(sp: BodySpec, o: AssetOptions, sizeSpec: BodySpec, cpu: number): { cells: AsciiCell[]; width: number; height: number } | null {
  const r = gl(); if (!r) return null;
  const size = personSpriteSize(sizeSpec);
  const baseHalf = (size.width - 1) / 2;
  const ax = Math.round(baseHalf * cpu); const ay = Math.round(size.anchor.y * cpu);
  const W = Math.round(baseHalf * 2 * cpu) + 1;
  const Hc = ay + Math.round(((size.height - 1 - size.anchor.y)) * cpu) + 1;
  const PW = W * SS; const PH = Hc * SS;

  if (!scene) { scene = new THREE.Scene(); lights(scene); }
  if (!target || targetW !== PW || targetH !== PH) {
    target?.dispose();
    target = new THREE.WebGLRenderTarget(PW, PH, { samples: 4, depthBuffer: true });
    targetW = PW; targetH = PH;
  }

  // Basis change model(x side, y up, z forward) -> world (X, Y, Z-up).
  const model = build(sp, o);
  const holder = new THREE.Group();
  holder.matrixAutoUpdate = false;
  holder.matrix.makeBasis(
    o.facing === 'left' ? new THREE.Vector3(-1, 0, 0) : new THREE.Vector3(0, 1, 0),
    new THREE.Vector3(0, 0, 1),
    o.facing === 'left' ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0));
  holder.add(model);
  scene.add(holder);

  const camera = new THREE.Camera();
  const D = 400;
  camera.projectionMatrix.set(
    2 * cpu / W, -2 * cpu / W, 0, 2 * ax / W - 1,
    -2 * cpu / (3 * Hc), -2 * cpu / (3 * Hc), 2 * cpu / Hc, 1 - 2 * ay / Hc,
    -1 / D, -1 / D, -.67 / D, 0,
    0, 0, 0, 1);
  camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();

  r.setRenderTarget(target);
  r.setClearColor(0x000000, 0);
  r.clear();
  r.render(scene, camera);
  const buf = new Uint8Array(PW * PH * 4);
  r.readRenderTargetPixels(target, 0, 0, PW, PH, buf);
  r.setRenderTarget(null);
  scene.remove(holder);
  holder.traverse(obj => { if ((obj as THREE.Mesh).geometry) (obj as THREE.Mesh).geometry.dispose(); });

  // ASCII conversion: per cell, average lit colour over covered sub-pixels.
  const cover = new Float32Array(W * Hc); const cr = new Float32Array(W * Hc); const cg = new Float32Array(W * Hc); const cb = new Float32Array(W * Hc);
  for (let py = 0; py < PH; py++) {
    const cy = Math.floor((PH - 1 - py) / SS);
    for (let px = 0; px < PW; px++) {
      const i = (py * PW + px) * 4; const a = buf[i + 3]; if (!a) continue;
      const c = cy * W + Math.floor(px / SS);
      cover[c] += a / 255; cr[c] += buf[i]; cg[c] += buf[i + 1]; cb[c] += buf[i + 2];
    }
  }
  const full = SS * SS;
  const toSrgb = (v: number) => Math.max(0, Math.min(255, Math.round(255 * Math.pow(Math.min(1, v / 255), 1 / 2.2))));
  const hex = (r8: number, g8: number, b8: number) => '#' + [r8, g8, b8].map(v => v.toString(16).padStart(2, '0')).join('');
  const solid = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < Hc && cover[y * W + x] / full > .28;
  const cells: AsciiCell[] = [];
  for (let y = 0; y < Hc; y++) for (let x = 0; x < W; x++) {
    const c = y * W + x;
    if (cover[c] / full <= .28) continue;
    const sumA = cover[c] * 255;
    let r8 = toSrgb(cr[c] / sumA * 255); let g8 = toSrgb(cg[c] / sumA * 255); let b8 = toSrgb(cb[c] / sumA * 255);
    const edge = !solid(x + 1, y) || !solid(x - 1, y) || !solid(x, y + 1) || !solid(x, y - 1);
    if (edge) { r8 = Math.round(r8 * .55); g8 = Math.round(g8 * .55); b8 = Math.round(b8 * .6); }
    const lum = (.299 * r8 + .587 * g8 + .114 * b8) / 255;
    const pos = Math.max(0, Math.min(RAMP.length - 1, lum * (RAMP.length - 1) * 1.25 + (noise(x, y, 7) - .5) * .8));
    cells.push({ x, y, glyph: RAMP[Math.round(pos)], color: hex(r8, g8, b8) });
  }
  return { cells, width: W, height: Hc };
}

const poseMemo = new Map<string, { cells: AsciiCell[]; width: number; height: number }>();

/** Cached, pose-quantised render (12 walk steps, 8 idle breaths). Null when WebGL is unavailable. */
export function personModelAt(sp: BodySpec, o: AssetOptions, sizeSpec: BodySpec, scale: number): { cells: AsciiCell[]; width: number; height: number } | null {
  const walking = o.action === 'walk' || o.action === 'run';
  const step = walking ? Math.round(o.time * 6.5 / (Math.PI * 2) * 12) % 12 : Math.round(o.time * 2.9 / (Math.PI * 2) * 8) % 8;
  const q: AssetOptions = { ...o, time: walking ? step / 12 * Math.PI * 2 / 6.5 : step / 8 * Math.PI * 2 / 2.9 };
  const key = `${sp.skin}${sp.torsoColor}${sp.legsColor}${sp.headwear}${sp.held}${sp.hairColor}${sp.cloak ?? ''}${sp.tabard ?? ''}${sp.apron ?? ''}${sp.shoulder}${sp.height}|${sizeSpec.shoulder}|${o.seed & 3}|${o.facing}|${o.action}|${step}|${scale.toFixed(2)}`;
  const hit = poseMemo.get(key);
  if (hit) { poseMemo.delete(key); poseMemo.set(key, hit); return hit; }
  const out = threePersonAt(sp, q, sizeSpec, scale);
  if (!out) return null;
  poseMemo.set(key, out);
  if (poseMemo.size > 240) poseMemo.delete(poseMemo.keys().next().value!);
  return out;
}
