import * as THREE from 'three';
import { ASSET_BY_ID } from '../assets/catalog.ts';
import type { AsciiAsset } from '../assets/types.ts';
import { noise } from '../assets/types.ts';
import { GROUND, groundAt, roadDistance, waterDepth } from '../assets/landscape.ts';
import { CONFIG } from '../config.ts';
import { moveBody, type Body } from '../engine/physics.ts';
import type { Collider } from '../engine/physics.ts';
import { collidersFor } from '../game/colliders.ts';
import { LANDMARKS, regionAt } from '../game/landmarks.ts';
import { CHUNK_SIZE, generateChunk, type WorldProp } from '../game/worldChunks.ts';
import { AsciiPass } from './asciiPass.ts';
import { buildHorse, buildSamurai, type Rig } from './characters3d.ts';

/*
 * KAGE 3D prototype (?mode=3d).
 * World units are the same as the 2D game: x right, y "down the map" (here: +Z), height = Y.
 * The scene renders to a small target and an ASCII pass turns it into coloured glyphs.
 */

const TERRAIN_SIZE = 1500;
const TERRAIN_SEGMENTS = 214; // ~7 units per vertex
const RECENTRE_DISTANCE = 220;
const PROP_RADIUS = 720;

const GROUND_COLORS: Record<number, number> = {
  [GROUND.LUSH]: 0x3f6b2c, [GROUND.FOREST]: 0x2b4a24, [GROUND.FLOWER]: 0x4d7a33, [GROUND.DIRT]: 0x7a5a36,
  [GROUND.COBBLE]: 0x6d7378, [GROUND.FARM]: 0x8a7a3a, [GROUND.MUD]: 0x5a4a38, [GROUND.SAND]: 0xa89868,
  [GROUND.WATER]: 0x1d3a4a, [GROUND.TOWN]: 0x4f7a3a, [GROUND.WARREN]: 0x5a5236, [GROUND.ASH]: 0x4a3e38,
  [GROUND.CLEAR]: 0x4a7a34, [GROUND.MEADOW]: 0x557f33, [GROUND.FORGE]: 0x55473c, [GROUND.CRYPT]: 0x3d4440,
  [GROUND.BANK]: 0x4a4430,
};

function smooth(x: number, y: number, seed: number): number {
  const ix = Math.floor(x); const iy = Math.floor(y); const fx = x - ix; const fy = y - iy;
  const sx = fx * fx * (3 - 2 * fx); const sy = fy * fy * (3 - 2 * fy);
  const a = noise(ix, iy, seed); const b = noise(ix + 1, iy, seed);
  const c = noise(ix, iy + 1, seed); const d = noise(ix + 1, iy + 1, seed);
  return (a + (b - a) * sx) * (1 - sy) + (c + (d - c) * sx) * sy;
}

/** Deterministic ground height: river carved down, gentle hills, flat roads and towns. */
export function groundHeight(x: number, y: number): number {
  const depth = waterDepth(x, y);
  if (depth > 0) return -Math.min(9, 1.5 + depth * .3);
  let flat = Math.min(1, Math.max(0, (roadDistance(x, y) - 6) / 30));
  for (const l of LANDMARKS) {
    const d = Math.hypot(x - l.x, y - l.y);
    if (d < 170) flat = Math.min(flat, Math.max(0, (d - 90) / 80));
  }
  const bank = Math.max(0, 1 - -depth / 24);
  const hills = (smooth(x / 140, y / 140, 3) - .45) * 34 + (smooth(x / 45, y / 45, 9) - .5) * 6;
  return hills * flat - bank * 3;
}

interface Bands { top: THREE.Color; mid: THREE.Color; low: THREE.Color }
const bandCache = new Map<string, Bands>();
/** The asset's own glyph palette, averaged into top / middle / bottom bands. */
function bands(asset: AsciiAsset, variant: number): Bands {
  const key = `${asset.id}:${variant}`;
  const cached = bandCache.get(key);
  if (cached) return cached;
  const sums = [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]];
  for (const cell of asset.generate({ time: 0, seed: 1, variant, action: 'idle', facing: 'right' })) {
    if (cell.glyph === ' ') continue;
    const band = cell.y < asset.height * .32 ? 0 : cell.y < asset.height * .66 ? 1 : 2;
    const s = sums[band];
    s[0] += parseInt(cell.color.slice(1, 3), 16); s[1] += parseInt(cell.color.slice(3, 5), 16); s[2] += parseInt(cell.color.slice(5, 7), 16); s[3]++;
  }
  const toColor = (s: number[], fallback: number) => s[3] ? new THREE.Color().setRGB(s[0] / s[3] / 255, s[1] / s[3] / 255, s[2] / s[3] / 255, THREE.SRGBColorSpace) : new THREE.Color(fallback);
  const result = { top: toColor(sums[0], 0x777777), mid: toColor(sums[1], 0x777777), low: toColor(sums[2], 0x555555) };
  bandCache.set(key, result);
  return result;
}

const materialCache = new Map<string, THREE.MeshStandardMaterial>();
function material(color: THREE.Color | number, opts: { emissive?: number; flat?: boolean } = {}): THREE.MeshStandardMaterial {
  const c = color instanceof THREE.Color ? color : new THREE.Color(color);
  const key = `${c.getHexString()}:${opts.emissive ?? 0}:${opts.flat ? 1 : 0}`;
  let m = materialCache.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color: c, roughness: .9, metalness: 0, flatShading: opts.flat ?? true });
    if (opts.emissive) { m.emissive = new THREE.Color(opts.emissive); m.emissiveIntensity = 2.2; }
    materialCache.set(key, m);
  }
  return m;
}
function mesh(geometry: THREE.BufferGeometry, mat: THREE.Material, x = 0, y = 0, z = 0): THREE.Mesh {
  const m = new THREE.Mesh(geometry, mat);
  m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true;
  return m;
}

const BUILDINGS = new Set(['hovel', 'cottage', 'townhouse', 'manor', 'tavern']);
const LIGHT_PROPS = new Set(['campfire', 'lamp-post', 'lantern']);

interface PlacedProp { object: THREE.Object3D; colliders: Collider[]; light?: THREE.Vector3 }

function buildProp(prop: WorldProp, asset: AsciiAsset): PlacedProp | null {
  const s = prop.scale; const w = asset.width * s; const h = asset.height * s;
  const c = bands(asset, prop.variant);
  const group = new THREE.Group();
  const id = asset.id;
  let light: THREE.Vector3 | undefined;
  if (asset.category === 'Creature' || id.startsWith('flowers')) return null;
  if (id === 'pine') {
    group.add(mesh(new THREE.CylinderGeometry(w * .04, w * .06, h * .3, 6), material(0x4a3222), 0, h * .15, 0));
    for (let i = 0; i < 3; i++) {
      const r = w * (.42 - i * .1); const ch = h * (.38 - i * .05);
      group.add(mesh(new THREE.ConeGeometry(r, ch, 7), material(i === 2 ? c.top : c.mid), 0, h * (.25 + i * .2) + ch / 2, 0));
    }
  } else if (id === 'rock') {
    const r = w * .28;
    const m = mesh(new THREE.DodecahedronGeometry(r, 0), material(c.mid), 0, r * .35, 0);
    m.scale.set(1, .65, .9); m.rotation.y = prop.seed;
    group.add(m);
  } else if (asset.category === 'Character') {
    const hgt = h * .82;
    group.add(mesh(new THREE.CylinderGeometry(hgt * .09, hgt * .11, hgt * .45, 6), material(c.low), 0, hgt * .225, 0));
    group.add(mesh(new THREE.CylinderGeometry(hgt * .1, hgt * .13, hgt * .38, 6), material(c.mid), 0, hgt * .62, 0));
    group.add(mesh(new THREE.SphereGeometry(hgt * .09, 8, 6), material(c.top), 0, hgt * .9, 0));
    group.rotation.y = (prop.seed % 7) - 3;
  } else if (BUILDINGS.has(id)) {
    // Footprint follows the asset; heights are human-scale (Kage is ~40 tall).
    // 2D sprite heights include a fake-perspective roof, so they are not used directly.
    const bw = w * .8; const bd = w * .55;
    const storeys = id === 'manor' || id === 'townhouse' ? 2 : id === 'tavern' ? 1.6 : 1;
    const wallH = Math.min(h * .42, 28 * storeys); const roofH = Math.min(h * .3, Math.min(bw, bd) * .3, 34);
    group.add(mesh(new THREE.BoxGeometry(bw, wallH, bd), material(c.mid), 0, wallH / 2, 0));
    const roof = mesh(new THREE.ConeGeometry(Math.hypot(bw, bd) * .56, roofH, 4), material(c.top), 0, wallH + roofH / 2, 0);
    roof.rotation.y = Math.PI / 4; roof.scale.set(1, 1, bd / bw * 1.05);
    group.add(roof);
    // Warm windows: a lit band on the front face.
    group.add(mesh(new THREE.BoxGeometry(bw * .7, wallH * .18, 1), material(0x2a1a08, { emissive: 0xffa040 }), 0, wallH * .55, bd / 2 + .3));
  } else if (id === 'tent') {
    const th = Math.min(h * .7, 42);
    const m = mesh(new THREE.ConeGeometry(w * .42, th, 4), material(c.mid), 0, th / 2, 0);
    m.rotation.y = Math.PI / 4; group.add(m);
  } else if (id === 'ruined-tower') {
    group.add(mesh(new THREE.CylinderGeometry(w * .28, w * .33, h * .85, 8), material(c.mid), 0, h * .425, 0));
  } else if (LIGHT_PROPS.has(id)) {
    if (id === 'campfire') {
      group.add(mesh(new THREE.CylinderGeometry(w * .25, w * .3, 3, 8), material(0x3a3532), 0, 1.5, 0));
      group.add(mesh(new THREE.ConeGeometry(w * .14, h * .5, 6), material(0x401000, { emissive: 0xff6a1a }), 0, h * .25 + 2, 0));
      light = new THREE.Vector3(0, 10, 0);
    } else {
      const pole = id === 'lamp-post' ? Math.min(h * .85, 52) : Math.min(h * .5, 14);
      group.add(mesh(new THREE.CylinderGeometry(1, 1.4, pole, 6), material(0x2a2a2e), 0, pole / 2, 0));
      group.add(mesh(new THREE.BoxGeometry(5, 6, 5), material(0x402000, { emissive: 0xffb050 }), 0, pole + 3, 0));
      light = new THREE.Vector3(0, pole + 3, 0);
    }
  } else {
    // Generic prop: a block in the asset's own colours.
    const bw = w * .75; const bh = Math.min(h * .55, 45);
    group.add(mesh(new THREE.BoxGeometry(bw, bh * .7, Math.max(4, w * .35)), material(c.low), 0, bh * .35, 0));
    group.add(mesh(new THREE.BoxGeometry(bw * .9, bh * .3, Math.max(3, w * .3)), material(c.top), 0, bh * .85, 0));
  }
  const groundY = groundHeight(prop.x, prop.y);
  group.position.set(prop.x, groundY, prop.y);
  return { object: group, colliders: collidersFor({ x: prop.x, y: prop.y, scale: s, asset }), light: light?.add(group.position) };
}

export function start3d(): void {
  document.getElementById('ascii-canvas')?.style.setProperty('display', 'none');
  const container = document.getElementById('game-container') ?? document.body;
  const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(2, devicePixelRatio || 1));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;touch-action:none';
  container.append(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x05080d);
  scene.fog = new THREE.Fog(0x0a1018, 700, 1500);
  const camera = new THREE.PerspectiveCamera(34, 1, 5, 3000);
  const hemi = new THREE.HemisphereLight(0x5a7099, 0x14180c, .9);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xaabfff, 2.2);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -420, right: 420, top: 420, bottom: -420, near: 10, far: 1600 });
  sun.shadow.bias = -.0008; sun.shadow.normalBias = 1.2;
  scene.add(sun, sun.target);

  // Terrain: one vertex-coloured heightfield that re-centres on the player.
  const terrainGeometry = new THREE.PlaneGeometry(TERRAIN_SIZE, TERRAIN_SIZE, TERRAIN_SEGMENTS, TERRAIN_SEGMENTS);
  terrainGeometry.rotateX(-Math.PI / 2);
  terrainGeometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(terrainGeometry.attributes.position.count * 3), 3));
  const terrain = new THREE.Mesh(terrainGeometry, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true }));
  terrain.receiveShadow = true;
  scene.add(terrain);
  const basePositions = Float32Array.from(terrainGeometry.attributes.position.array as Float32Array);
  const water = new THREE.Mesh(new THREE.PlaneGeometry(TERRAIN_SIZE, TERRAIN_SIZE), new THREE.MeshStandardMaterial({ color: 0x0c2433, roughness: .15, metalness: .3, transparent: true, opacity: .88 }));
  water.rotation.x = -Math.PI / 2; water.receiveShadow = true;
  scene.add(water);
  const tmp = new THREE.Color();
  function buildTerrain(cx: number, cz: number): void {
    const pos = terrainGeometry.attributes.position as THREE.BufferAttribute;
    const col = terrainGeometry.attributes.color as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const x = basePositions[i * 3] + cx; const z = basePositions[i * 3 + 2] + cz;
      pos.setXYZ(i, x, groundHeight(x, z), z);
      tmp.setHex(GROUND_COLORS[groundAt(x, z)] ?? 0x3f6b2c);
      const v = .82 + noise(Math.floor(x / 7), Math.floor(z / 7), 41) * .36;
      col.setXYZ(i, tmp.r * v, tmp.g * v, tmp.b * v);
    }
    pos.needsUpdate = true; col.needsUpdate = true;
    terrainGeometry.computeVertexNormals();
    terrainGeometry.computeBoundingSphere();
    water.position.set(cx, -1.4, cz);
  }

  // Props from the same deterministic chunks and landmarks as the 2D game.
  const props = new Map<string, PlacedProp>();
  let colliders: Collider[] = [];
  let lightSpots: THREE.Vector3[] = [];
  const warned = new Set<string>();
  function updateProps(cx: number, cz: number): void {
    const keep = new Set<string>();
    const r = Math.ceil(PROP_RADIUS / CHUNK_SIZE);
    const ox = Math.floor(cx / CHUNK_SIZE); const oz = Math.floor(cz / CHUNK_SIZE);
    for (let gx = ox - r; gx <= ox + r; gx++) for (let gz = oz - r; gz <= oz + r; gz++) {
      for (const prop of generateChunk(gx, gz).props) {
        if (Math.hypot(prop.x - cx, prop.y - cz) > PROP_RADIUS) continue;
        keep.add(prop.id);
        if (props.has(prop.id)) continue;
        const asset = ASSET_BY_ID.get(prop.assetId);
        if (!asset) { if (!warned.has(prop.assetId)) { warned.add(prop.assetId); console.warn(`3D: unknown asset ${prop.assetId}`); } continue; }
        const placed = buildProp(prop, asset);
        if (!placed) continue;
        scene.add(placed.object);
        props.set(prop.id, placed);
      }
    }
    for (const [id, placed] of props) if (!keep.has(id)) { scene.remove(placed.object); props.delete(id); }
    colliders = [...props.values()].flatMap(p => p.colliders);
    lightSpots = [...props.values()].flatMap(p => p.light ? [p.light] : []);
  }

  // Warm point lights: a fixed pool given to the nearest light sources.
  const lampPool = Array.from({ length: 8 }, () => { const l = new THREE.PointLight(0xff9a48, 0, 110, 1); scene.add(l); return l; });

  // Player and horse.
  const params = new URLSearchParams(location.search);
  const start = LANDMARKS.find(l => l.id === params.get('area')) ?? LANDMARKS[1];
  const hero: Body = { x: start.spawnX, y: start.spawnY, vx: 0, vy: 0 };
  const horseBody = { x: start.spawnX + 27, y: start.spawnY + 16, facing: 0 };
  const samurai: Rig = buildSamurai();
  const horse: Rig = buildHorse();
  scene.add(samurai.root, horse.root);
  let mounted = false; let facing = 0; let walkPhase = 0;

  // Input: keyboard, a touch joystick and buttons.
  const keys = new Set<string>();
  addEventListener('keydown', e => {
    keys.add(e.code);
    if (e.code === 'KeyE') toggleMount();
    if (e.code === 'KeyN') night = !night;
    const jump = LANDMARKS.find(l => l.key === e.code);
    if (jump) { hero.x = jump.spawnX; hero.y = jump.spawnY; horseBody.x = hero.x + 27; horseBody.y = hero.y + 16; mounted = false; }
  });
  addEventListener('keyup', e => keys.delete(e.code));
  let distance = 340;
  renderer.domElement.addEventListener('wheel', e => { e.preventDefault(); distance = Math.min(1100, Math.max(140, distance * (1 + e.deltaY * .001))); }, { passive: false });
  function toggleMount(): void {
    if (mounted) { mounted = false; horseBody.x = hero.x + 14; horseBody.y = hero.y; hero.x -= 12; return; }
    if (Math.hypot(horseBody.x - hero.x, horseBody.y - hero.y) < 60) { mounted = true; hero.x = horseBody.x; hero.y = horseBody.y; }
  }
  let night = true;
  const hud = document.createElement('div');
  hud.style.cssText = 'position:fixed;left:16px;top:12px;color:#cfe0e8;font:12px/1.5 Consolas,monospace;letter-spacing:.08em;text-shadow:0 0 4px #000;pointer-events:none;white-space:pre';
  container.append(hud);
  const stick = { active: false, id: -1, ox: 0, oy: 0, x: 0, y: 0 };
  const pad = document.createElement('div');
  pad.style.cssText = 'position:fixed;left:24px;bottom:24px;width:120px;height:120px;border-radius:50%;border:1px solid #ffffff33;background:#ffffff0d;touch-action:none';
  const knob = document.createElement('div');
  knob.style.cssText = 'position:absolute;left:40px;top:40px;width:40px;height:40px;border-radius:50%;background:#ffffff40';
  pad.append(knob);
  const rideButton = document.createElement('button');
  rideButton.textContent = 'RIDE';
  rideButton.style.cssText = 'position:fixed;right:24px;bottom:40px;width:72px;height:72px;border-radius:50%;border:1px solid #ffffff44;background:#ffffff14;color:#dde;font:12px Consolas,monospace;touch-action:none';
  rideButton.addEventListener('pointerdown', e => { e.preventDefault(); toggleMount(); });
  if (matchMedia('(pointer: coarse)').matches) container.append(pad, rideButton);
  pad.addEventListener('pointerdown', e => { stick.active = true; stick.id = e.pointerId; const r = pad.getBoundingClientRect(); stick.ox = r.left + 60; stick.oy = r.top + 60; pad.setPointerCapture(e.pointerId); });
  pad.addEventListener('pointermove', e => {
    if (!stick.active || e.pointerId !== stick.id) return;
    const dx = e.clientX - stick.ox; const dy = e.clientY - stick.oy; const len = Math.min(50, Math.hypot(dx, dy)) / (Math.hypot(dx, dy) || 1);
    stick.x = dx * len / 50; stick.y = dy * len / 50;
    knob.style.transform = `translate(${dx * len}px,${dy * len}px)`;
  });
  const release = () => { stick.active = false; stick.x = stick.y = 0; knob.style.transform = ''; };
  pad.addEventListener('pointerup', release); pad.addEventListener('pointercancel', release);

  // ASCII output.
  const ascii = new AsciiPass(renderer);
  function resize(): void {
    renderer.setSize(innerWidth, innerHeight, false);
    camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
    ascii.resize(innerWidth, innerHeight, renderer.getPixelRatio());
  }
  addEventListener('resize', resize); resize();

  let centre = { x: Infinity, z: Infinity };
  let last = performance.now(); let frames = 0; let fps = 0; let fpsTime = last; let time = 0;
  function tick(now: number): void {
    const dt = Math.min(.05, (now - last) / 1000); last = now; time += dt;
    if (Math.hypot(hero.x - centre.x, hero.y - centre.z) > RECENTRE_DISTANCE) {
      centre = { x: Math.round(hero.x / 28) * 28, z: Math.round(hero.y / 28) * 28 };
      buildTerrain(centre.x, centre.z);
      updateProps(centre.x, centre.z);
    }
    // Movement uses the shared 2D physics (circle colliders, sliding).
    let mx = Number(keys.has('KeyD') || keys.has('ArrowRight')) - Number(keys.has('KeyA') || keys.has('ArrowLeft')) + stick.x;
    let my = Number(keys.has('KeyS') || keys.has('ArrowDown')) - Number(keys.has('KeyW') || keys.has('ArrowUp')) + stick.y;
    const run = keys.has('ShiftLeft') || keys.has('ShiftRight') || Math.hypot(stick.x, stick.y) > .9;
    const e = CONFIG.exploration;
    const speed = (mounted ? run ? e.gallopSpeed : e.rideSpeed : run ? e.runSpeed : e.walkSpeed) * (waterDepth(hero.x, hero.y) > 0 ? .55 : 1);
    const obstacles = mounted ? colliders : colliders.concat([-24, -12, 0, 12, 24].map(o => ({ x: horseBody.x + Math.sin(horseBody.facing) * o, y: horseBody.y + Math.cos(horseBody.facing) * o, radius: 6 })));
    const ox = hero.x; const oy = hero.y;
    moveBody(hero, mx, my, speed, dt, obstacles, mounted ? 5 : 3);
    const moved = Math.hypot(hero.x - ox, hero.y - oy);
    if (moved > .02) { const target = Math.atan2(hero.x - ox, hero.y - oy); facing += Math.atan2(Math.sin(target - facing), Math.cos(target - facing)) * Math.min(1, dt * 12); }
    walkPhase += moved * (mounted ? .09 : .22);
    if (mounted) { horseBody.x = hero.x; horseBody.y = hero.y; horseBody.facing = facing; }

    const hy = groundHeight(hero.x, hero.y);
    const horseY = groundHeight(horseBody.x, horseBody.y);
    horse.root.position.set(horseBody.x, horseY, horseBody.y);
    horse.root.rotation.y = horseBody.facing;
    horse.animate(mounted ? walkPhase : 0, mounted && moved > .02 ? 1 : 0, time);
    samurai.root.position.set(hero.x, mounted ? horseY + 27 : Math.max(hy, -3), hero.y);
    samurai.root.rotation.y = facing;
    samurai.animate(walkPhase, !mounted && moved > .02 ? 1 : 0, time, mounted);

    // Camera: high three-quarter view looking down, like the references.
    const target = new THREE.Vector3(hero.x, hy + 12, hero.y);
    camera.position.set(target.x, target.y + distance * .93, target.z + distance * .37);
    camera.lookAt(target);

    // Moonlight or daylight; the light follows the player so shadows stay sharp.
    hemi.intensity = night ? .55 : 1.4;
    hemi.color.setHex(night ? 0x4a6290 : 0xbfd6ff);
    sun.color.setHex(night ? 0x9fb6ff : 0xffe7c2);
    sun.intensity = night ? 1.7 : 3.4;
    sun.position.set(target.x - 320, 520, target.z - 180);
    sun.target.position.copy(target);
    const nearest = lightSpots.map(p => ({ p, d: (p.x - hero.x) ** 2 + (p.z - hero.y) ** 2 })).sort((a, b) => a.d - b.d);
    lampPool.forEach((l, i) => {
      const spot = nearest[i];
      if (!spot) { l.intensity = 0; return; }
      l.position.copy(spot.p);
      l.intensity = (night ? 180 : 40) * (1 + Math.sin(time * 9 + i) * .06);
    });

    ascii.render(scene, camera);
    frames++;
    if (now - fpsTime > 500) { fps = Math.round(frames * 1000 / (now - fpsTime)); frames = 0; fpsTime = now; }
    hud.textContent = `KAGE  ·  3D PROTOTYPE\n${regionAt(hero.x, hero.y).toUpperCase()}\n${fps} FPS  ${ascii.cols}×${ascii.rows}\n\nWASD move  SHIFT run  E ride  N day/night  WHEEL zoom  1–0 regions`;
    renderer.domElement.dataset.fps = String(fps);
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}
