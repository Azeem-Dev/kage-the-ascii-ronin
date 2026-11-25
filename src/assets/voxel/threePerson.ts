import * as THREE from 'three';
import { noise, type AsciiCell, type AssetOptions } from '../types.ts';
import type { BodySpec } from '../people/body.ts';
import { personSpriteSize } from './voxelPerson.ts';
import { chooseGlyph } from './asciiGlyphs.ts';

/**
 * Characters as real three.js models, turned into glyph cells by an ASCII conversion pass.
 *
 * 1. A low-poly articulated humanoid is built from the BodySpec (legs, torso, arms, head,
 *    clothing, headwear, held items) with restrained local lighting.
 * 2. It is rendered into a small supersampled target with the game's isometric projection:
 *    screenX = X - Y, screenY = (X + Y) / 3 - Z.
 * 3. Colour is averaged over covered sub-pixels. A deterministic density/contour pass keeps
 *    limbs, garment hems and held items readable at the 0.25-0.5 scales used by the scene.
 * Model space is Y-up, +Z forward, X sideways; a basis change maps it into the game's Z-up world.
 */

const SS = 3;                       // supersampling per final cell
const POSE_CACHE_LIMIT = 240;
const MATERIAL_CACHE_LIMIT = 160;

let renderer: THREE.WebGLRenderer | null = null;
let failed = false;
function gl(): THREE.WebGLRenderer | null {
  if (failed) return null;
  if (renderer) return renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas: document.createElement('canvas'), antialias: false, alpha: true, powerPreference: 'low-power' });
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(1);
    renderer.toneMapping = THREE.NoToneMapping;
    return renderer;
  } catch { failed = true; return null; }
}

const matCache = new Map<string, THREE.Material>();
function mat(color: string, rough = .86, glow = false): THREE.Material {
  const key = `${color}|${rough}|${glow}`;
  const cached = matCache.get(key);
  if (cached) { matCache.delete(key); matCache.set(key, cached); return cached; }
  const material = glow
    ? new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide })
    : new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: .025, side: THREE.DoubleSide });
  matCache.set(key, material);
  if (matCache.size > MATERIAL_CACHE_LIMIT) {
    const oldest = matCache.keys().next().value as string | undefined;
    if (oldest !== undefined) { matCache.get(oldest)?.dispose(); matCache.delete(oldest); }
  }
  return material;
}

function shade(color: string, factor: number): string {
  return '#' + new THREE.Color(color).multiplyScalar(factor).getHexString();
}

interface Ring { y: number; rx: number; rz: number; x?: number; z?: number }
/** Closed elliptical loft. Rings may be supplied bottom-to-top. */
function loft(rings: readonly Ring[], segments = 12): THREE.BufferGeometry {
  const positions: number[] = [];
  const indices: number[] = [];
  for (const ring of rings) for (let i = 0; i < segments; i++) {
    const a = i / segments * Math.PI * 2;
    positions.push((ring.x ?? 0) + Math.cos(a) * ring.rx, ring.y, (ring.z ?? 0) + Math.sin(a) * ring.rz);
  }
  for (let j = 0; j < rings.length - 1; j++) for (let i = 0; i < segments; i++) {
    const a = j * segments + i;
    const b = j * segments + (i + 1) % segments;
    const c = (j + 1) * segments + i;
    const d = (j + 1) * segments + (i + 1) % segments;
    indices.push(a, c, b, b, c, d);
  }
  const bottom = positions.length / 3; positions.push(rings[0].x ?? 0, rings[0].y, rings[0].z ?? 0);
  const top = positions.length / 3; positions.push(rings[rings.length - 1].x ?? 0, rings[rings.length - 1].y, rings[rings.length - 1].z ?? 0);
  for (let i = 0; i < segments; i++) {
    const next = (i + 1) % segments;
    indices.push(bottom, i, next);
    const base = (rings.length - 1) * segments;
    indices.push(top, base + next, base + i);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

/** Curved cape/hair panel in model XY, with its back toward -Z. */
function capeGeometry(topWidth: number, bottomWidth: number, height: number, trail = 2): THREE.BufferGeometry {
  const geometry = new THREE.PlaneGeometry(1, 1, 4, 5);
  const p = geometry.getAttribute('position');
  for (let i = 0; i < p.count; i++) {
    const t = .5 - p.getY(i);
    p.setXYZ(i, p.getX(i) * (topWidth + (bottomWidth - topWidth) * t) * .5,
      p.getY(i) * height, -Math.sin(t * Math.PI) * 1.5 - t * t * trail);
  }
  geometry.computeVertexNormals();
  return geometry;
}

function bladeGeometry(length: number, width: number, depth = 1.4): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(0, length * .5);
  shape.lineTo(width * .5, length * .12);
  shape.lineTo(width * .34, -length * .5);
  shape.lineTo(-width * .34, -length * .5);
  shape.lineTo(-width * .5, length * .12);
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, steps: 1 });
  geometry.translate(0, 0, -depth * .5);
  return geometry;
}

function axeGeometry(): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(0, -7); shape.lineTo(10, -10); shape.lineTo(15, -3);
  shape.lineTo(13, 7); shape.lineTo(0, 9); shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: 2.4, bevelEnabled: false, steps: 1 });
  geometry.translate(0, 0, -1.2);
  return geometry;
}

function shieldGeometry(radius: number): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(-radius * .86, radius * .72); shape.lineTo(radius * .86, radius * .72);
  shape.lineTo(radius * .9, -radius * .12); shape.lineTo(0, -radius);
  shape.lineTo(-radius * .9, -radius * .12); shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: 1.6, bevelEnabled: false, steps: 1 });
  geometry.translate(0, 0, -.8);
  return geometry;
}

function build(sp: BodySpec, o: AssetOptions): THREE.Group {
  const root = new THREE.Group();
  const add = (parent: THREE.Object3D, geo: THREE.BufferGeometry, color: string, x = 0, y = 0, z = 0, rough = .86, glow = false): THREE.Mesh => {
    const mesh = new THREE.Mesh(geo, mat(color, rough, glow));
    mesh.position.set(x, y, z); mesh.frustumCulled = false; parent.add(mesh); return mesh;
  };
  const cyl = (rt: number, rb: number, h: number, seg = 10) => new THREE.CylinderGeometry(rt, rb, h, seg);
  const sph = (r: number, ws = 12, hs = 8) => new THREE.SphereGeometry(r, ws, hs);
  const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);

  const H = sp.height; const sh = sp.shoulder;
  const walking = o.action === 'walk' || o.action === 'run';
  const running = o.action === 'run';
  const ph = o.time * (running ? 8.2 : 6.5);
  const swing = walking ? Math.sin(ph) : 0;
  const bob = walking ? Math.abs(Math.sin(ph)) * (running ? 2 : 1.4) : (.5 + .5 * Math.sin(o.time * 2.9)) * 1.2;
  const bodyBob = bob * .55;
  const legsH = Math.round(H * sp.legs);
  const hipY = legsH + bob * .15;
  const goblin = sp.ears === 'long' && sp.earSize >= 1.4;
  const orc = sp.tusks >= 1.4 || sp.shoulder >= 24;
  const dwarf = sp.shoulder >= 20 && sp.height <= 96;
  const headR = sp.head * (goblin ? 1.06 : dwarf ? 1.05 : 1);
  const headY = H - headR + bob;
  const neckY = H - headR * 2 + 1 + bodyBob;
  const lean = sp.hunch * (goblin ? 10 : 8);
  const skirted = sp.legsKind === 'skirt' || sp.legsKind === 'robe' || (sp.torso === 'robe' && sp.legsKind !== 'trousers');
  const robe = sp.legsKind === 'robe' || sp.torso === 'robe';
  const lr = Math.max(2.8, sh * .2) * (dwarf ? 1.08 : goblin ? .9 : orc ? 1.08 : 1);
  const bootH = sp.boots ? Math.max(4, Math.round(H * .09)) : 0;

  /* legs: tapered thighs/calves, a distinct ankle and a forward boot toe */
  if (!skirted) for (const side of [-1, 1]) {
    const piv = new THREE.Group(); piv.position.set(side * sh * .37, hipY, 0); root.add(piv);
    piv.rotation.x = swing * side * (running ? .9 : .72);
    const legC = sp.legsKind === 'bare' || sp.legsKind === 'loin' ? sp.skin : sp.legsColor;
    add(piv, loft([
      { y: -legsH, rx: lr * .82, rz: lr * .86 },
      { y: -legsH * .58, rx: lr * .94, rz: lr * .96 },
      { y: -legsH * .2, rx: lr * 1.08, rz: lr * 1.04 },
      { y: 0, rx: lr * 1.04, rz: lr * 1.02 },
    ], 9), legC);
    if (sp.boots) add(piv, loft([
      { y: -legsH, rx: lr * .9, rz: lr * .94 },
      { y: -legsH + bootH, rx: lr * 1.06, rz: lr * 1.08 },
    ], 9), sp.boots, 0, 0, 0, .78);
    if (sp.wraps) for (const y of [-legsH * .3, -legsH * .43]) add(piv, cyl(lr * 1.04, lr * 1.04, 2.6, 9), sp.wraps, 0, y, 0, .95);
    const foot = add(piv, sph(1), sp.boots ?? shade(sp.skin, .88), 0, -legsH + 1.7, lr * 1.05, .8);
    foot.scale.set(lr * 1.02, 2.1, lr * 1.5);
  } else {
    const hem = robe ? H * .055 : Math.max(H * .16, legsH * Math.max(.16, sp.hem));
    const top = hipY + 5;
    const color = robe ? sp.torsoColor : sp.legsColor;
    add(root, loft([
      { y: hem, rx: sh * (1.08 + sp.belly * .05), rz: sh * .76 + sp.belly * .4, x: lean * .2 },
      { y: hem + 3, rx: sh * (1.02 + sp.belly * .04), rz: sh * .72 + sp.belly * .35, x: lean * .25 },
      { y: top - 4, rx: sh * .68 + sp.belly * .5, rz: sh * .5 + sp.belly * .3, x: lean * .35 },
      { y: top, rx: sh * .64 + sp.belly * .45, rz: sh * .48 + sp.belly * .28, x: lean * .35 },
    ], 14), color, 0, bodyBob * .35, lean * .25);
    if (sp.trim && robe) add(root, cyl(sh * (1.08 + sp.belly * .05), sh * (1.08 + sp.belly * .05), 2.4, 14), sp.trim, lean * .2, hem + 1.2 + bodyBob * .35, lean * .25).scale.z = .7;
    if (sp.boots) for (const side of [-1, 1]) {
      const foot = add(root, sph(1), sp.boots, side * sh * .32 + swing * side * 2, 1.7, lr * 1.2, .8);
      foot.scale.set(lr, 2, lr * 1.45);
    }
  }

  const waistW = sh * .66 + sp.belly * 1.05;
  const chestW = sh * .94;
  const depth = sh * .54 + sp.belly * .45;
  const torsoBottom = hipY - 4;
  const torsoTop = neckY + 1;
  const tH = torsoTop - torsoBottom;
  const tc = sp.torso === 'bare' ? sp.skin : sp.torsoColor;
  const torsoC = sp.torso === 'chain' ? '#879397' : sp.torso === 'vest' && sp.under ? sp.under : tc;

  /* torso: waist, rib cage, sloping shoulders and a narrow neck opening */
  add(root, loft([
    { y: torsoBottom, rx: waistW * 1.02, rz: depth * .88, z: lean * .08 },
    { y: torsoBottom + tH * .22, rx: waistW, rz: depth, z: lean * .18 },
    { y: torsoBottom + tH * .62, rx: chestW, rz: depth, z: lean * .42 },
    { y: torsoBottom + tH * .84, rx: chestW * .96, rz: depth * .82, z: lean * .56 },
    { y: torsoTop, rx: sh * .34, rz: sh * .27, z: lean * .65 },
  ], 14), torsoC, 0, bodyBob, 0);
  const shoulders = add(root, sph(1), torsoC, 0, neckY - 5 + bodyBob, lean * .5);
  shoulders.scale.set(sh * 1.02, 4.2, depth * .72);
  const hips = add(root, sph(1), torsoC, lean * .15, hipY - 1 + bodyBob * .3, lean * .2);
  hips.scale.set(waistW * 1.06, 4.5, depth * .92);

  /* garment hems give tunics/coats a human outline instead of a bare cylinder */
  if (!skirted && (sp.torso === 'tunic' || sp.torso === 'vest' || sp.torso === 'coat' || sp.legsKind === 'loin')) {
    const top = hipY + 3;
    const share = sp.torso === 'coat' ? .58 : sp.legsKind === 'loin' ? .36 : Math.max(.14, sp.hem);
    const bottom = hipY + legsH * share;
    const flare = sp.torso === 'coat' ? sh * .26 : sp.legsKind === 'loin' ? sh * .08 : sh * .13;
    const color = sp.legsKind === 'loin' ? sp.legsColor : tc;
    add(root, loft([
      { y: bottom, rx: waistW + flare, rz: depth + flare * .35, x: lean * .12 },
      { y: bottom + 2.5, rx: waistW + flare * .88, rz: depth + flare * .25, x: lean * .16 },
      { y: top - 2, rx: waistW, rz: depth, x: lean * .25 },
      { y: top, rx: waistW * .97, rz: depth * .97, x: lean * .25 },
    ], 12), color, 0, bodyBob * .3, 0);
    if (sp.trim && (sp.torso === 'coat' || sp.torso === 'tunic')) add(root, cyl(waistW + flare, waistW + flare, 2.2, 12), sp.trim, lean * .12, bottom + 1.1 + bodyBob * .3, 0).scale.z = (depth + flare * .35) / (waistW + flare);
    if (sp.ragged > .5) for (let i = 0; i < 3; i++) {
      const x = (noise(i, 4, o.seed) - .5) * waistW;
      add(root, box(1.5, 4 + noise(i, 8, o.seed) * 4, 1.2), shade(color, .76), x, bottom - 2, depth * .72);
    }
  }

  if (sp.torso === 'vest') for (const side of [-1, 1]) {
    const panel = add(root, box(waistW * .36, tH * .84, 1.4), tc, side * waistW * .43 + lean * .35, torsoBottom + tH * .51 + bodyBob, depth * .94 + lean * .3, .78);
    panel.rotation.z = side * .035;
  }
  if (sp.plates) {
    add(root, box(chestW * 1.28, tH * .48, 1.8), sp.plates, lean * .42, torsoBottom + tH * .66 + bodyBob, depth * .96 + lean * .3, .42);
    add(root, box(chestW * 1.05, tH * .19, 1.6), shade(sp.plates, .78), lean * .2, torsoBottom + tH * .28 + bodyBob, depth * .96 + lean * .2, .48);
  }
  if (sp.tabard) {
    add(root, capeGeometry(chestW * .62, chestW * .78, H * .36, -.6), sp.tabard, lean * .3, hipY + H * .015 + bodyBob * .4, depth + 1.2 + lean * .2);
    if (sp.crest) {
      const crest = add(root, sph(2.6, 8, 6), sp.crest, lean * .35, torsoBottom + tH * .73 + bodyBob, depth + 2.5);
      crest.scale.set(1, 1.25, .45);
    }
  }
  if (sp.apron) add(root, capeGeometry(chestW * .72, chestW * .9, H * .32, -.4), sp.apron, lean * .25, hipY - H * .02 + bodyBob * .4, depth + 1.5);
  if (sp.belt || sp.rope) {
    const beltColor = sp.rope ? '#a18a5d' : sp.belt!;
    const belt = add(root, cyl(waistW * 1.04, waistW * 1.04, sp.rope ? 1.8 : 2.8, 14), beltColor, lean * .2, hipY + 1.3 + bodyBob * .3, 0, .9);
    belt.scale.z = depth / waistW;
    if (!sp.rope) add(root, box(3.2, 3, 1.4), sp.gold ? '#d8b85b' : '#a99a72', lean * .2, hipY + 1.3 + bodyBob * .3, depth + 1);
  }
  if (sp.sash) {
    const sash = add(root, box(chestW * 1.85, 3.2, 1.5), sp.sash, lean * .35, torsoBottom + tH * .48 + bodyBob, depth + 1.2, .88);
    sash.rotation.z = -.72;
  }
  if (sp.pouch) add(root, sph(3.1, 9, 7), sp.pouch, waistW * .72, hipY - 3 + bodyBob * .3, depth * .42, .92);
  if (sp.furCollar) {
    const collar = add(root, new THREE.TorusGeometry(chestW * .73, 3, 7, 14), sp.furCollar, lean * .5, neckY - 2 + bodyBob, lean * .4, .98);
    collar.rotation.x = Math.PI / 2; collar.scale.y = depth / chestW;
  }
  if (sp.trim && sp.gold && sp.torso !== 'bare') add(root, cyl(chestW * .72, chestW * .78, 2.2, 12), sp.trim, lean * .55, neckY - 5 + bodyBob, lean * .4).scale.z = .72;
  if (sp.patches) for (let i = 0; i < sp.patches * 2; i++) {
    const color = sp.patchColors[i % sp.patchColors.length];
    add(root, box(4.2, 5.2, 1.1), color, (noise(i, 1, o.seed) - .5) * chestW * 1.25 + lean * .3,
      hipY + 7 + noise(i, 2, o.seed) * Math.max(4, neckY - hipY - 15) + bodyBob, depth * .98);
  }
  if (sp.cloak) {
    const cloak = add(root, capeGeometry(chestW * 2.05, chestW * 2.65, neckY - H * .05, 3), sp.cloak, lean * .45, (neckY + H * .05) * .5 + bodyBob * .5, -depth - 2 - lean * .35, .94);
    cloak.rotation.x = -.04;
    if (sp.cloakTrim) add(root, box(chestW * 2.5, 2.6, 1.2), sp.cloakTrim, lean * .45, H * .05 + 1.3 + bodyBob * .5, -depth - 5, .88);
  }

  /* arms: shoulder caps, tapered sleeves, cuffs and readable hands */
  const armLen = H * sp.arm; const ar = Math.max(3.1, sh * .2);
  const sleeveC = sp.sleeves === 'none' || sp.torso === 'bare' ? sp.skin : torsoC;
  const forearmC = sp.sleeves === 'long' && sp.torso !== 'bare' ? sleeveC : sp.skin;
  let heldPivot: THREE.Object3D | null = null;
  for (const side of [-1, 1]) {
    const piv = new THREE.Group(); piv.position.set(side * (sh * .98 + 1.4), neckY - 4 + bodyBob, lean * .5); root.add(piv);
    const idle = Math.sin(o.time * 1.9 + side) * .055;
    piv.rotation.x = walking ? -swing * side * (running ? .62 : .45) : idle;
    if (sp.reach && side === 1) piv.rotation.x = -.95;
    piv.rotation.z = side * .075;
    const cap = add(piv, sph(1), sleeveC, 0, -armLen * .06, 0);
    cap.scale.set(ar * 1.3, ar * 1.25, ar * 1.2);
    add(piv, cyl(ar * 1.08, ar * .92, armLen * .5, 9), sleeveC, 0, -armLen * .25);
    const elbow = new THREE.Group(); elbow.position.set(0, -armLen * .5, 0); piv.add(elbow);
    elbow.rotation.x = walking ? -.22 - Math.max(0, swing * side) * .28 : -.1;
    add(elbow, cyl(ar * .92, ar * .78, armLen * .5, 9), forearmC, 0, -armLen * .25);
    if (sp.sleeves === 'rolled') add(elbow, cyl(ar * 1.16, ar * 1.12, 2.8, 9), sleeveC, 0, -.5);
    if (sp.wraps && side === 1) for (const y of [-armLen * .16, -armLen * .29]) add(elbow, cyl(ar * .96, ar * .96, 2.4, 8), sp.wraps, 0, y);
    const hand = new THREE.Group(); hand.position.set(0, -armLen * .52, 0); elbow.add(hand);
    const palm = add(hand, sph(1), sp.skin); palm.scale.set(ar * .9, ar * 1.08, ar * .82);
    if (side === 1) heldPivot = hand;
    if (side === -1 && sp.shield) {
      add(hand, shieldGeometry(sh * .64), sp.shield, -1, -armLen * .12, 3.2, .72);
      add(hand, sph(2.5, 8, 6), '#c8c4b0', -1, -armLen * .12, 4.8, .45).scale.z = .55;
    }
  }
  if (heldPivot) addHeld(heldPivot);

  function addHeld(hand: THREE.Object3D): void {
    const wood = sp.heldColor; const metal = sp.heldAccent;
    const g = new THREE.Group(); hand.add(g);
    switch (sp.held) {
      case 'spear': add(g, cyl(1, 1, H * .95, 6), wood, 0, H * .3); add(g, bladeGeometry(11, 4.4), metal, 0, H * .78 + 5, 0, .35); break;
      case 'staff': add(g, cyl(1.5, 1.5, H * 1.0, 6), wood, 0, H * .3); add(g, sph(3.6, 9, 7), metal, 0, H * .82, 0, .4); break;
      case 'axe': add(g, cyl(1.3, 1.3, 46, 6), wood, 0, 10); add(g, axeGeometry(), metal, 0, 26, 0, .38); break;
      case 'club': add(g, cyl(1.8, 1.4, 30, 6), wood, 0, 12); add(g, sph(5, 8, 6), wood, 0, 27); break;
      case 'hammer': add(g, cyl(1.5, 1.5, 30, 6), wood, 0, 10); add(g, box(10, 7, 7), metal, 0, 26, 0, .4); break;
      case 'pick': add(g, cyl(1.4, 1.4, 44, 6), wood, 0, 6); add(g, box(19, 2.6, 2.6), metal, 0, 28, 0, .4); break;
      case 'pitchfork': add(g, cyl(1.2, 1.2, H * .95, 6), wood, 0, H * .3); for (const d of [-5, 0, 5]) add(g, bladeGeometry(11, 2.6, 1), metal, d, H * .8, 0, .4); add(g, box(11, 1.4, 1.4), metal, 0, H * .74); break;
      case 'bow': { const t = add(g, new THREE.TorusGeometry(24, 1.15, 6, 18, Math.PI * .95), wood, 0, 6, -4); t.rotation.z = Math.PI / 2 - Math.PI * .475; t.rotation.y = Math.PI / 2; break; }
      case 'dagger': add(g, bladeGeometry(12, 4, 1.8), metal, 0, 6, 2, .35); add(g, box(5, 2, 2.4), wood, 0, 1, 2); break;
      case 'cup': add(g, cyl(3.2, 2.4, 5, 9), metal, 0, 3, 2, .5); break;
      case 'basket': add(g, cyl(8, 6, 8, 10), wood, 0, -3, 5); add(g, new THREE.TorusGeometry(7.5, .8, 5, 12), shade(wood, .72), 0, .8, 5).rotation.x = Math.PI / 2; break;
      case 'lantern': add(g, cyl(.5, .5, 8, 5), '#2e2a26', 0, -4); add(g, cyl(3.4, 3.4, 7, 8), '#ffd27a', 0, -11, 0, .5, true); break;
      default: break;
    }
  }

  /* neck and head: jawed loft, broad cheek plane, brow and one readable face */
  add(root, cyl(headR * .4, headR * .48, 5, 9), sp.skin, lean * .65, neckY + 1.5 + bodyBob * .45, lean * .55);
  const head = new THREE.Group(); head.position.set(0, headY, lean + (sp.hunch > .3 ? 3 : 0)); root.add(head);
  add(head, loft([
    { y: -headR * 1.02, rx: headR * .36, rz: headR * .4 },
    { y: -headR * .72, rx: headR * .66, rz: headR * .62 },
    { y: -headR * .18, rx: headR * .86, rz: headR * .84 },
    { y: headR * .36, rx: headR * .9, rz: headR * .88 },
    { y: headR * .8, rx: headR * .74, rz: headR * .73 },
    { y: headR * .99, rx: headR * .28, rz: headR * .31 },
  ], 14), sp.skin);
  const cheek = add(head, sph(1, 12, 8), shade(sp.skin, 1.05), 0, -headR * .06, headR * .77);
  cheek.scale.set(headR * .64, headR * .53, headR * .18);
  add(head, sph(1.1 + sp.nose * .65, 8, 6), shade(sp.skin, .98), 0, -headR * .12, headR * .94).scale.set(.82, 1.25, 1.15);
  for (const side of [-1, 1]) {
    add(head, sph(.95, 8, 6), sp.eyes, side * headR * .34, headR * .13, headR * .87).scale.set(1, .8, .55);
    add(head, sph(.55, 7, 5), '#14100e', side * headR * .34, headR * .13, headR * .93).scale.set(1, .9, .5);
    if (sp.brow || orc) {
      const brow = add(head, box(headR * .38, 1 + sp.brow * .9, 1.2), shade(sp.hairColor, .78), side * headR * .35, headR * .34, headR * .88);
      brow.rotation.z = side * .08;
    }
    if (sp.ears === 'round') add(head, sph(1.6, 8, 6), sp.skin, side * headR * .86, 0, -.2).scale.set(.6, 1.1, .85);
    else {
      const len = (sp.ears === 'long' ? 11 : 6.5) * sp.earSize * .9;
      const ear = add(head, new THREE.ConeGeometry(1.6, len, 6), sp.skin, side * (headR * .85 + len * .4), len * (sp.ears === 'long' ? .08 : .3), -.5);
      ear.rotation.z = -side * (Math.PI / 2 - (sp.ears === 'long' ? .15 : .7));
    }
    if (sp.tusks) add(head, new THREE.ConeGeometry(.9, 2 + sp.tusks * 1.4, 5), '#eee6cf', side * headR * .3, -headR * .55, headR * .82);
  }
  if (!sp.beard && sp.headwear !== 'bandage') add(head, box(headR * .28, .75, .8), shade(sp.skin, .55), 0, -headR * .45, headR * .79);

  const hasHardHat = ['helm', 'skullhelm', 'hood'].includes(sp.headwear);
  if (sp.hair !== 'none' && !hasHardHat) {
    const hair = add(head, new THREE.SphereGeometry(headR * 1.04, 14, 9, 0, Math.PI * 2, 0, Math.PI * (sp.hair === 'long' ? .62 : .54)), sp.hairColor, 0, headR * .16, -headR * .12);
    hair.scale.set(.9, .86, .96);
    if (sp.hair === 'long') {
      const back = add(head, capeGeometry(headR * 1.65, headR * 2.15, headR * 2.35, 1), sp.hairColor, 0, -headR * .72, -headR * .72, .92);
      back.rotation.x = -.03;
    }
    if (sp.hair === 'tied') {
      const tail = add(head, cyl(1.5, 1, headR * 1.25, 7), sp.hairColor, 0, -headR * .64, -headR * 1.08);
      tail.rotation.x = -.45;
    }
  }
  if (sp.beard !== 'none') {
    const length = sp.beard === 'short' ? 5 : sp.beard === 'long' ? 16 : 14;
    add(head, loft([
      { y: -headR * .55 - length, rx: headR * .12, rz: headR * .16, z: headR * .6 },
      { y: -headR * .55 - length * .4, rx: headR * .4, rz: headR * .32, z: headR * .63 },
      { y: -headR * .42, rx: headR * .56, rz: headR * .4, z: headR * .61 },
    ], 9), sp.beardColor, 0, 0, 0, .96);
    if (sp.beard === 'braided') for (const side of [-1, 1]) {
      const braid = add(head, cyl(1.2, .8, length * .75, 6), shade(sp.beardColor, .82), side * headR * .23, -headR * .55 - length * .55, headR * .82);
      braid.rotation.z = side * .08;
    }
  }

  const hw = sp.headwear; const hc = sp.headColor; const ha = sp.headAccent;
  if (hw === 'hood') {
    const hood = add(head, new THREE.SphereGeometry(headR * 1.18, 14, 10, Math.PI * .5 + .75, Math.PI * 2 - 1.5), hc, 0, 0, -headR * .12, .94);
    hood.scale.set(.95, 1.05, 1);
    add(head, capeGeometry(headR * 1.8, headR * 2.5, headR * 1.65, 1), hc, 0, -headR * 1.15, -headR * .65, .94);
  }
  if (hw === 'helm' || hw === 'skullhelm') {
    const helm = add(head, new THREE.SphereGeometry(headR * 1.08, 14, 9, 0, Math.PI * 2, 0, Math.PI * .62), hc, 0, headR * .12, 0, .42);
    helm.scale.set(.9, 1, .98);
    add(head, cyl(headR * .91, headR * .96, 2.3, 12), shade(hc, .82), 0, headR * .06, 0, .48).scale.z = .95;
    if (hw === 'helm') add(head, box(1.6, headR * .8, 1.4), ha, 0, -headR * .05, headR * .98, .4);
    if (sp.crest) add(head, box(1.8, 8, headR * 1.3), sp.crest, 0, headR * 1.18, 0, .75);
  }
  if (hw === 'cap') {
    const cap = add(head, new THREE.SphereGeometry(headR * 1.06, 12, 8, 0, Math.PI * 2, 0, Math.PI * .5), hc, 0, headR * .22, 0, .92);
    cap.scale.set(.9, .78, 1);
    add(head, box(headR * 1.35, 1.5, headR * .9), hc, headR * .22, headR * .2, headR * .65, .92);
  }
  if (hw === 'straw') {
    add(head, cyl(headR * 2.1, headR * 2.1, 1.4, 16), hc, 0, headR * .64, 0, .96).scale.z = .94;
    add(head, cyl(headR * .78, headR * .95, headR * .7, 12), hc, 0, headR * .98, 0, .96);
  }
  if (hw === 'feather') {
    const cap = add(head, new THREE.SphereGeometry(headR * 1.06, 12, 8, 0, Math.PI * 2, 0, Math.PI * .5), hc, 0, headR * .25, 0, .92);
    cap.scale.set(.9, .78, 1);
    const feather = add(head, capeGeometry(2.2, .5, headR * 2.1, 0), ha, headR * .75, headR * 1.35, -headR * .35, .9);
    feather.rotation.z = -.48;
  }
  if (hw === 'crown') {
    add(head, cyl(headR * .86, headR * .86, 2.6, 12), '#f0c640', 0, headR * .78, 0, .35);
    for (let i = 0; i < 7; i++) {
      const a = i / 7 * Math.PI * 2;
      add(head, new THREE.ConeGeometry(1.05, 5.5, 5), '#f0c640', Math.cos(a) * headR * .78, headR * 1.08, Math.sin(a) * headR * .78, .35);
    }
  }
  if (hw === 'circlet') add(head, new THREE.TorusGeometry(headR * .88, .8, 6, 16), ha, 0, headR * .46, 0, .32).rotation.x = Math.PI / 2;
  if (hw === 'scarf' || hw === 'bandage') {
    add(head, cyl(headR * .94, headR * .94, headR * (hw === 'bandage' ? .62 : .45), 14), hc, 0, headR * (hw === 'bandage' ? .15 : .32), 0, .98).scale.z = 1.04;
    add(head, capeGeometry(headR * .8, headR * 1.15, headR * 1.5, .5), hc, -headR * .65, -headR * .45, -headR * .65, .98).rotation.z = .18;
  }
  if (hw === 'lamp') {
    const cap = add(head, new THREE.SphereGeometry(headR * 1.04, 12, 8, 0, Math.PI * 2, 0, Math.PI * .5), hc, 0, headR * .25, 0, .8);
    cap.scale.set(.9, .78, 1);
    add(head, sph(2.4, 8, 6), '#fff2b0', 0, headR * .52, headR * 1.04, .5, true);
  }
  return root;
}

function lights(scene: THREE.Scene): void {
  // The scene renderer lights the finished glyph cells again. Keep this pass
  // close to neutral albedo so faces and coloured cloth never clip to white.
  scene.add(new THREE.HemisphereLight(0xa9bdd6, 0x3a3836, 2.8));
  const key = new THREE.DirectionalLight(0xfff0dc, 4.6); key.position.set(-32, 58, 75); scene.add(key);
  const fill = new THREE.DirectionalLight(0x7d9cd0, 1.9); fill.position.set(75, 12, 42); scene.add(fill);
  const rim = new THREE.DirectionalLight(0xaecbff, 2.2); rim.position.set(-55, -42, 48); scene.add(rim);
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
    target = new THREE.WebGLRenderTarget(PW, PH, { depthBuffer: true });
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

  const buf = new Uint8Array(PW * PH * 4);
  r.setRenderTarget(target);
  try {
    r.setClearColor(0x000000, 0);
    r.clear();
    r.render(scene, camera);
    r.readRenderTargetPixels(target, 0, 0, PW, PH, buf);
  } finally {
    r.setRenderTarget(null);
    scene.remove(holder);
    holder.traverse(obj => { if ((obj as THREE.Mesh).geometry) (obj as THREE.Mesh).geometry.dispose(); });
  }

  // Average colour over covered sub-pixels, but retain any cell touched by a
  // thin limb or prop. No random glyph noise and no black silhouette stroke.
  const full = SS * SS;
  const cover = new Float32Array(W * Hc);
  const cr = new Float32Array(W * Hc); const cg = new Float32Array(W * Hc); const cb = new Float32Array(W * Hc);
  for (let py = 0; py < PH; py++) {
    const cy = Math.floor((PH - 1 - py) / SS);
    for (let px = 0; px < PW; px++) {
      const i = (py * PW + px) * 4; const a = buf[i + 3]; if (!a) continue;
      const c = cy * W + Math.floor(px / SS);
      cover[c] += a / 255; cr[c] += buf[i] * a / 255; cg[c] += buf[i + 1] * a / 255; cb[c] += buf[i + 2] * a / 255;
    }
  }
  const toSrgb = (v: number) => Math.max(0, Math.min(255, Math.round(255 * Math.pow(Math.min(1, v / 255), 1 / 2.2))));
  const hex = (r8: number, g8: number, b8: number) => '#' + [r8, g8, b8].map(v => v.toString(16).padStart(2, '0')).join('');
  const solid = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < Hc && cover[y * W + x] >= full * .18;
  const outR = new Float32Array(W * Hc); const outG = new Float32Array(W * Hc); const outB = new Float32Array(W * Hc);
  const lum = new Float32Array(W * Hc);
  for (let y = 0; y < Hc; y++) for (let x = 0; x < W; x++) {
    const c = y * W + x;
    if (cover[c] < full * .18) continue;
    const r8 = toSrgb(cr[c] / cover[c]); const g8 = toSrgb(cg[c] / cover[c]); const b8 = toSrgb(cb[c] / cover[c]);
    outR[c] = r8; outG[c] = g8; outB[c] = b8;
    lum[c] = (.299 * r8 + .587 * g8 + .114 * b8) / 255;
  }
  const cells: AsciiCell[] = [];
  for (let y = 0; y < Hc; y++) for (let x = 0; x < W; x++) {
    const c = y * W + x;
    if (!solid(x, y)) continue;
    const left = x > 0 && solid(x - 1, y) ? lum[c - 1] : 0;
    const right = x + 1 < W && solid(x + 1, y) ? lum[c + 1] : 0;
    const up = y > 0 && solid(x, y - 1) ? lum[c - W] : 0;
    const down = y + 1 < Hc && solid(x, y + 1) ? lum[c + W] : 0;
    const boundary = (x === 0 || !solid(x - 1, y) ? 1 : 0)
      + (x + 1 === W || !solid(x + 1, y) ? 1 : 0)
      + (y === 0 || !solid(x, y - 1) ? 1 : 0)
      + (y + 1 === Hc || !solid(x, y + 1) ? 1 : 0);
    const glyph = chooseGlyph(x, y, lum[c], Math.min(1, .22 + lum[c] * .78), (right - left) * 1.45, (down - up) * 1.45, boundary);
    cells.push({ x, y, glyph, color: hex(outR[c], outG[c], outB[c]) });
  }
  return { cells, width: W, height: Hc };
}

const poseMemo = new Map<string, { cells: AsciiCell[]; width: number; height: number }>();

/** Cached, pose-quantised render (12 walk steps, 8 idle breaths). Null when WebGL is unavailable. */
export function personModelAt(sp: BodySpec, o: AssetOptions, sizeSpec: BodySpec, scale: number): { cells: AsciiCell[]; width: number; height: number } | null {
  const walking = o.action === 'walk' || o.action === 'run';
  const step = walking ? Math.round(o.time * (o.action === 'run' ? 8.2 : 6.5) / (Math.PI * 2) * 12) % 12 : Math.round(o.time * 2.9 / (Math.PI * 2) * 8) % 8;
  const q: AssetOptions = { ...o, time: walking ? step / 12 * Math.PI * 2 / (o.action === 'run' ? 8.2 : 6.5) : step / 8 * Math.PI * 2 / 2.9 };
  // Include the complete body/size specs: concatenated colour strings collided
  // between outfits, and omitting plates/trim/belts reused the wrong model.
  const key = JSON.stringify([sp, sizeSpec, o.seed, o.variant, o.facing, o.action, step, scale]);
  const hit = poseMemo.get(key);
  if (hit) { poseMemo.delete(key); poseMemo.set(key, hit); return hit; }
  const out = threePersonAt(sp, q, sizeSpec, scale);
  if (!out) return null;
  poseMemo.set(key, out);
  if (poseMemo.size > POSE_CACHE_LIMIT) poseMemo.delete(poseMemo.keys().next().value!);
  return out;
}
