import { RONIN } from './assets/ronin.ts';
import { PINE } from './assets/pine.ts';
import { ROCK } from './assets/rock.ts';
import { HORSE } from './assets/horse.ts';
import { riverCenter, waterDepth } from './assets/landscape.ts';
import type { AsciiAsset } from './assets/types.ts';
import { WorldChunks } from './game/worldChunks.ts';
import { AssetRenderer } from './render/assetRenderer.ts';
import { AssetCache, type PlacedSprite } from './render/assetCache.ts';
import { TerrainLayer } from './render/terrainLayer.ts';
import { CONFIG } from './config.ts';
import './riverScene.css';

interface Instance { id: string; asset: AsciiAsset; x: number; y: number; seed: number; scale: number; variant: number }
interface Ripple { x: number; y: number; born: number }

/** A playable art scene, built from reusable assets rather than UI thumbnails.
 * This is the Phase 1 exploration foundation; combat and quests come later. */
export function startRiverScene(): void {
  document.title = 'KAGE / The whispering river';
  document.documentElement.className = 'river-view';
  document.body.innerHTML = `<main class="river-game"><canvas id="world-canvas" aria-label="Playable ASCII river scene. Move with WASD or tap the ground."></canvas><div class="world-vignette"></div><header class="world-hud"><div><span class="world-kicker">KAGE / VISUAL FOUNDATION</span><h1>The whispering river</h1><p>Wind through the reeds. Moonlight on the current.</p></div><div class="world-region">ASHEN VALLEY<br><span id="world-state">RONIN · IVORY</span></div></header><div class="world-bottom"><div class="world-health">KAGE <span>[━━━━━━━━━━━━]</span><small id="world-location">RIVERBANK</small></div><div class="world-controls"><span>WASD</span> move <span>SHIFT</span> run <span>WHEEL</span> zoom <span>V</span> robe <span>P</span> pause <span>R</span> reset<br><small>Click / tap to walk · Reusable character, pines, stone, grass & water</small></div><span class="world-telemetry" id="world-stats"></span></div></main>`;
  const canvas = document.getElementById('world-canvas') as HTMLCanvasElement;
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) throw new Error('Canvas 2D is required');
  const renderer = new AssetRenderer(4, 6);
  const keys = new Set<string>();
  const hero = { x: riverCenter(230) + 69, y: 230, facing: 'right' as 'left' | 'right', moving: false, variant: 0 };
  const horse = { x: hero.x + 27, y: hero.y + 16, facing: 'right' as 'left' | 'right' };
  let mounted = false;
  let zoom = CONFIG.exploration.defaultZoom;
  let detailStep = 1;
  let cols = 0; let rows = 0;
  let cameraX = 0; let cameraY = 0;
  let time = 0; let paused = false; let last = performance.now();
  let target: { x: number; y: number } | null = null;
  let rippleTimer = 0;
  let ripples: Ripple[] = [];
  let frames = 0; let fps = 0; let fpsTime = performance.now();
  const world = new WorldChunks();
  const assetCache = new AssetCache(renderer);
  const terrain = new TerrainLayer(renderer);
  const shadowId = renderer.glyph('.', '#111d20');
  const wakeIds = ['#8ea7aa', '#4b6973', '#a8beba', '#48646e'].map(color => ['o', '.', '-'].map(glyph => renderer.glyph(glyph, color)));
  let lastProps: ReturnType<WorldChunks['around']> | null = null;
  let instances: Instance[] = [];
  function size(): void {
    // Coarser distant samples bound framebuffer work at the widest zoom.
    detailStep = Math.max(1, Math.ceil(.8 / zoom));
    cols = Math.ceil(innerWidth / (4 * zoom * detailStep)); rows = Math.ceil(innerHeight / (6 * zoom * detailStep));
    if (canvas.width !== cols * 4) canvas.width = cols * 4;
    if (canvas.height !== rows * 6) canvas.height = rows * 6;
    assetCache.clear();
  }
  size();
  addEventListener('resize', size);
  addEventListener('keydown', event => {
    if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) event.preventDefault();
    keys.add(event.code);
    if (event.repeat) return;
    if (event.code === 'KeyP') paused = !paused;
    if (event.code === 'KeyV') hero.variant = (hero.variant + 1) % RONIN.variants.length;
    if (event.code === 'KeyE' && !paused) {
      if (mounted) { mounted = false; hero.x = horse.x + 18; hero.y = horse.y; }
      else if (Math.hypot(hero.x - horse.x, hero.y - horse.y) < 36) { mounted = true; hero.x = horse.x; hero.y = horse.y; target = null; }
    }
    if (event.code === 'KeyR') { hero.x = riverCenter(230) + 69; hero.y = 230; horse.x = hero.x + 27; horse.y = hero.y + 16; mounted = false; target = null; zoom = CONFIG.exploration.defaultZoom; size(); }
    if (['Minus', 'NumpadSubtract', 'Equal', 'NumpadAdd'].includes(event.code)) {
      zoom = Math.max(CONFIG.exploration.minimumZoom, Math.min(CONFIG.exploration.maximumZoom, zoom * (event.code === 'Minus' || event.code === 'NumpadSubtract' ? .8 : 1.25))); size();
    }
  });
  addEventListener('keyup', event => keys.delete(event.code));
  addEventListener('blur', () => { keys.clear(); target = null; });
  canvas.addEventListener('wheel', event => { event.preventDefault(); zoom = Math.max(CONFIG.exploration.minimumZoom, Math.min(CONFIG.exploration.maximumZoom, zoom * Math.exp(-event.deltaY * CONFIG.exploration.zoomSensitivity))); size(); }, { passive: false });
  canvas.addEventListener('pointerdown', event => {
    target = { x: cameraX + event.clientX / innerWidth * cols * detailStep, y: cameraY + event.clientY / innerHeight * rows * detailStep };
  });

  function place(ids: Uint32Array, compiled: PlacedSprite, x: number, y: number): void {
    renderer.stamp(ids, cols, rows, compiled.sprite, (x - cameraX) / detailStep - compiled.anchorX, (y - cameraY) / detailStep - compiled.anchorY);
  }
  function plot(ids: Uint32Array, x: number, y: number, id: number): void {
    const sx = Math.round((x - cameraX) / detailStep); const sy = Math.round((y - cameraY) / detailStep);
    if (sx >= 0 && sy >= 0 && sx < cols && sy < rows) ids[sy * cols + sx] = id;
  }
  function shadow(ids: Uint32Array, x: number, y: number, rx: number, ry: number): void {
    for (let sy = -ry; sy <= ry; sy += detailStep) for (let sx = -rx; sx <= rx; sx += detailStep) {
      if ((sx / rx) ** 2 + (sy / ry) ** 2 < 1) plot(ids, x + sx, y + sy, shadowId);
    }
  }
  function tick(now: number): void {
    if (!ctx) return;
    const renderStart = performance.now();
    const props = world.around(hero.x, hero.y, cols * detailStep, rows * detailStep);
    if (props !== lastProps) {
      lastProps = props;
      instances = props.map(prop => ({ ...prop, asset: prop.assetId === 'pine' ? PINE : ROCK }));
    }
    const dt = Math.min(.05, (now - last) / 1000); last = now;
    if (!paused) {
      time += dt;
      let mx = Number(keys.has('KeyD') || keys.has('ArrowRight')) - Number(keys.has('KeyA') || keys.has('ArrowLeft'));
      let my = Number(keys.has('KeyS') || keys.has('ArrowDown')) - Number(keys.has('KeyW') || keys.has('ArrowUp'));
      if (mx || my) target = null;
      if (target && !mx && !my) {
        const dx = target.x - hero.x; const dy = target.y - hero.y;
        if (Math.hypot(dx, dy) < 1) target = null;
        else { mx = dx; my = dy; }
      }
      const length = Math.hypot(mx, my);
      hero.moving = length > 0;
      if (length) {
        const running = keys.has('ShiftLeft') || keys.has('ShiftRight');
        const speed = (mounted ? running ? CONFIG.exploration.gallopSpeed : CONFIG.exploration.rideSpeed : running ? CONFIG.exploration.runSpeed : CONFIG.exploration.walkSpeed) * (waterDepth(hero.x, hero.y) > 0 ? .55 : 1);
        const nx = hero.x + mx / length * speed * dt;
        const ny = hero.y + my / length * speed * dt;
        const blocked = instances.some(instance => Math.hypot((nx - instance.x) / (instance.asset === PINE ? 3 : 8), (ny - instance.y) / 3) < 1);
        if (!blocked) { hero.x = nx; hero.y = ny; }
        if (mx) hero.facing = mx > 0 ? 'right' : 'left';
      }
      if (mounted) { horse.x = hero.x; horse.y = hero.y; horse.facing = hero.facing; }
      if (hero.moving && waterDepth(hero.x, hero.y) > 0) {
        rippleTimer += dt;
        if (rippleTimer > .15) { ripples.push({ x: hero.x, y: hero.y, born: time }); rippleTimer = 0; }
      }
      ripples = ripples.filter(ripple => time - ripple.born < 2.2);
    }
    // Coarse terrain always samples the same WORLD lattice. Moving one world
    // unit must not replace every distant grass/stone sample with random detail.
    cameraX = Math.floor((hero.x - cols * detailStep * .61) / detailStep) * detailStep;
    cameraY = Math.floor((hero.y - rows * detailStep * .62) / detailStep) * detailStep;
    const ids = renderer.begin(terrain.get(cameraX, cameraY, cols, rows, detailStep, time));
    const terrainEnd = performance.now();
    for (const instance of instances) {
      if (instance.asset !== ROCK || waterDepth(instance.x, instance.y) <= 0) continue;
      for (let i = 0; i < 18; i++) {
        const age = (time * 5 + i * 1.7) % 30;
        plot(ids, instance.x + Math.sin(i * 2.8 + age * .07) * (4 + age * .2), instance.y + age * .8, wakeIds[age > 20 ? 1 : 0][i % 3 ? 0 : 1]);
      }
    }
    for (const ripple of ripples) {
      const age = time - ripple.born; const radius = age * 7;
      for (let i = 0; i < 32; i++) {
        const a = i * Math.PI / 16;
        plot(ids, ripple.x + Math.cos(a) * radius * 1.6, ripple.y + Math.sin(a) * radius * .45, wakeIds[age < .8 ? 2 : 3][i % 4 ? 2 : 0]);
      }
    }
    const draws: { y: number; draw: () => void }[] = [];
    for (const instance of instances) {
      const height = instance.asset.height * instance.scale;
      const width = instance.asset.width * instance.scale;
      if (instance.x + width < cameraX || instance.x - width > cameraX + cols * detailStep || instance.y < cameraY || instance.y - height > cameraY + rows * detailStep) continue;
      // Distant LOD remains deterministic; static foliage never flashes between
      // independently rounded regeneration frames.
      if (detailStep > 1 && instance.asset === PINE && instance.seed % detailStep !== 0) continue;
      draws.push({ y: instance.y, draw: () => {
        shadow(ids, instance.x + 4, instance.y + 1, instance.asset === PINE ? 18 : 10, 3);
        const compiled = assetCache.get(instance.asset, { time: 0, seed: instance.seed, variant: instance.variant, action: 'idle', facing: 'right' }, instance.scale / detailStep);
        place(ids, compiled, instance.x, instance.y);
      } });
    }
    const actorOptions = { time, seed: 17, variant: hero.variant, action: hero.moving ? 'walk' as const : 'idle' as const, facing: hero.facing };
    draws.push({ y: horse.y, draw: () => {
      shadow(ids, horse.x, horse.y, 24, 3);
      place(ids, assetCache.get(HORSE, { ...actorOptions, seed: 31, variant: 0, action: mounted && hero.moving ? 'walk' : 'idle', facing: horse.facing }, .55 / detailStep, true), horse.x, horse.y);
      if (mounted) place(ids, assetCache.get(RONIN, { ...actorOptions, action: 'idle' }, .38 / detailStep, true), hero.x - (hero.facing === 'right' ? 2 : -2), hero.y - 14);
    } });
    if (!mounted) draws.push({ y: hero.y, draw: () => {
      shadow(ids, hero.x, hero.y + 1, 10, 2);
      place(ids, assetCache.get(RONIN, actorOptions, .5 / detailStep, true), hero.x, hero.y);
    } });
    draws.sort((a, b) => a.y - b.y).forEach(item => item.draw());
    const generationEnd = performance.now();
    renderer.present(ctx, ids, cols, rows);
    canvas.dataset.generateMs = (generationEnd - renderStart).toFixed(1);
    canvas.dataset.terrainMs = (terrainEnd - renderStart).toFixed(1);
    canvas.dataset.blitMs = (performance.now() - generationEnd).toFixed(1);
    canvas.dataset.changedCells = String(renderer.changedCells);
    frames++;
    if (now - fpsTime > 750) {
      fps = Math.round(frames * 1000 / (now - fpsTime)); frames = 0; fpsTime = now;
      const stats = document.getElementById('world-stats'); if (stats) stats.textContent = `${world.loadedCount} CHUNKS / ${cols}×${rows} / ${fps} FPS`;
    }
    const location = document.getElementById('world-location'); if (location) location.textContent = waterDepth(hero.x, hero.y) > 0 ? 'WADING · RIVER CURRENT' : 'RIVERBANK · WIND MEADOW';
    const state = document.getElementById('world-state'); if (state) state.textContent = `${paused ? 'PAUSED' : 'RONIN'} · ${RONIN.variants[hero.variant].toUpperCase()}`;
    // Read-only diagnostics used by browser smoke tests and future tooling.
    canvas.dataset.playerX = hero.x.toFixed(2); canvas.dataset.playerY = hero.y.toFixed(2); canvas.dataset.time = time.toFixed(2);
    canvas.dataset.loadedChunks = String(world.loadedCount);
    canvas.dataset.zoom = zoom.toFixed(2);
    canvas.dataset.mounted = String(mounted);
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}
