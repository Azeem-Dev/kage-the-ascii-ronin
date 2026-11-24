import { RONIN } from './assets/ronin.ts';
import { PINE } from './assets/pine.ts';
import { ROCK } from './assets/rock.ts';
import { HORSE } from './assets/horse.ts';
import { ASSET_BY_ID } from './assets/catalog.ts';
import { CHARACTERS } from './assets/characters.ts';
import { riverCenter, waterDepth } from './assets/landscape.ts';
import type { AsciiAsset } from './assets/types.ts';
import { WorldChunks } from './game/worldChunks.ts';
import { LANDMARKS, regionAt } from './game/landmarks.ts';
import { AssetRenderer } from './render/assetRenderer.ts';
import { AssetCache, type PlacedSprite } from './render/assetCache.ts';
import { TerrainLayer } from './render/terrainLayer.ts';
import { CONFIG } from './config.ts';
import { moveBody } from './engine/physics.ts';
import { Atmosphere } from './game/atmosphere.ts';
import './riverScene.css';

interface Instance { id: string; asset: AsciiAsset; x: number; y: number; seed: number; scale: number; variant: number }
interface Ripple { x: number; y: number; born: number }

/** A playable art scene, built from reusable assets rather than UI thumbnails.
 * This is the Phase 1 exploration foundation; combat and quests come later. */
export function startRiverScene(): void {
  document.title = 'KAGE / The whispering river';
  document.documentElement.className = 'river-view';
  document.body.innerHTML = `<main class="river-game"><canvas id="world-canvas" aria-label="Playable ASCII river scene. Move with WASD or tap the ground."></canvas><div class="world-vignette"></div><header class="world-hud"><div><span class="world-kicker">KAGE / VISUAL FOUNDATION</span><h1>The whispering river</h1><p>Wind through the reeds. Moonlight on the current.</p></div><div class="world-region">ASHEN VALLEY<br><span id="world-state">KNIGHT · WEATHERED STEEL</span></div></header><div class="world-bottom"><div class="world-health">KAGE <span>[━━━━━━━━━━━━]</span><small id="world-location">RIVERBANK</small></div><div class="world-controls"><span>WASD</span> move <span>SHIFT</span> run <span>WHEEL</span> zoom <span>H</span> character <span>V</span> armor <span>E</span> ride <span>P</span> pause <span>R</span> reset<br><small>1 Meadow / 2 Camp / 3 Crypt / 4 Forge · Click ground to walk</small></div><span class="world-telemetry" id="world-stats"></span></div></main>`;
  const canvas = document.getElementById('world-canvas') as HTMLCanvasElement;
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) throw new Error('Canvas 2D is required');
  const renderer = new AssetRenderer(4, 6);
  const atmosphere = new Atmosphere(renderer);
  const keys = new Set<string>();
  const playable = [RONIN, ...CHARACTERS];
  let playerIndex = 0;
  const hero = { x: riverCenter(230) + 69, y: 230, vx: 0, vy: 0, facing: 'right' as 'left' | 'right', moving: false, variant: 0 };
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
  let footsteps: { x: number; y: number; born: number; direction: number }[] = [];
  let stepDistance = 0;
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
    renderer.resizeGlyphs(Math.max(4, Math.round(4 * zoom * detailStep)), Math.max(6, Math.round(6 * zoom * detailStep)));
    if (canvas.width !== cols * renderer.cellWidth) canvas.width = cols * renderer.cellWidth;
    if (canvas.height !== rows * renderer.cellHeight) canvas.height = rows * renderer.cellHeight;
    assetCache.clear();
  }
  size();
  const weatherPanel = document.createElement('div');
  weatherPanel.className = 'world-weather';
  weatherPanel.innerHTML = '<button id="toggle-rain">Rain: off [T]</button><button id="toggle-day">Day / night [N]</button><button id="toggle-insects">Insects: on [L]</button><button id="toggle-cycle">Cycle: on [C]</button>';
  document.querySelector('.river-game')?.append(weatherPanel);
  const toggleWeather = (code: string) => {
    if (code === 'KeyT') atmosphere.rain = (atmosphere.rain + 1) % 3;
    if (code === 'KeyL') atmosphere.insects = !atmosphere.insects;
    if (code === 'KeyN') { atmosphere.daylight = atmosphere.brightness > 1.1 ? .75 : .2; atmosphere.cycle = false; }
    if (code === 'KeyC') atmosphere.cycle = !atmosphere.cycle;
    document.getElementById('toggle-rain')!.textContent = `Rain: ${['off', 'light', 'storm'][atmosphere.rain]} [T]`;
    document.getElementById('toggle-insects')!.textContent = `Insects: ${atmosphere.insects ? 'on' : 'off'} [L]`;
    document.getElementById('toggle-cycle')!.textContent = `Cycle: ${atmosphere.cycle ? 'on' : 'off'} [C]`;
  };
  for (const [id, code] of [['toggle-rain', 'KeyT'], ['toggle-day', 'KeyN'], ['toggle-insects', 'KeyL'], ['toggle-cycle', 'KeyC']]) document.getElementById(id)!.onclick = () => toggleWeather(code);
  const requestedArea = new URLSearchParams(location.search).get('area');
  const initialArea = LANDMARKS.find(area => area.id === requestedArea);
  if (initialArea) { hero.x = initialArea.spawnX; hero.y = initialArea.spawnY; horse.x = hero.x + 27; horse.y = hero.y + 16; }
  addEventListener('resize', size);
  addEventListener('keydown', event => {
    if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) event.preventDefault();
    keys.add(event.code);
    if (event.repeat) return;
    toggleWeather(event.code);
    const destination = LANDMARKS.find(area => area.key === event.code);
    if (destination) { hero.x = destination.spawnX; hero.y = destination.spawnY; hero.vx = 0; hero.vy = 0; horse.x = hero.x + 27; horse.y = hero.y + 16; target = null; mounted = false; }
    if (event.code === 'KeyP') paused = !paused;
    if (event.code === 'KeyV') hero.variant = (hero.variant + 1) % playable[playerIndex].variants.length;
    if (event.code === 'KeyH') { playerIndex = (playerIndex + 1) % playable.length; hero.variant = 0; }
    if (event.code === 'KeyE' && !paused) {
      if (mounted) { mounted = false; hero.x = horse.x + 18; hero.y = horse.y; }
      else if (Math.hypot(hero.x - horse.x, hero.y - horse.y) < 36) { mounted = true; hero.x = horse.x; hero.y = horse.y; target = null; }
    }
    if (event.code === 'KeyR') { hero.x = riverCenter(230) + 69; hero.y = 230; hero.vx = 0; hero.vy = 0; horse.x = hero.x + 27; horse.y = hero.y + 16; mounted = false; target = null; zoom = CONFIG.exploration.defaultZoom; size(); }
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
      instances = props.map(prop => {
        const asset = ASSET_BY_ID.get(prop.assetId);
        if (!asset) throw new Error(`Unknown world asset ${prop.assetId}`);
        return { ...prop, asset };
      });
    }
    const dt = Math.min(.05, (now - last) / 1000); last = now;
    if (!paused) {
      time += dt;
      atmosphere.update(dt);
      let mx = Number(keys.has('KeyD') || keys.has('ArrowRight')) - Number(keys.has('KeyA') || keys.has('ArrowLeft'));
      let my = Number(keys.has('KeyS') || keys.has('ArrowDown')) - Number(keys.has('KeyW') || keys.has('ArrowUp'));
      if (mx || my) target = null;
      if (target && !mx && !my) {
        const dx = target.x - hero.x; const dy = target.y - hero.y;
        if (Math.hypot(dx, dy) < 1) target = null;
        else { mx = dx; my = dy; }
      }
      const length = Math.hypot(mx, my);
      const running = keys.has('ShiftLeft') || keys.has('ShiftRight');
      const speed = (mounted ? running ? CONFIG.exploration.gallopSpeed : CONFIG.exploration.rideSpeed : running ? CONFIG.exploration.runSpeed : CONFIG.exploration.walkSpeed) * (waterDepth(hero.x, hero.y) > 0 ? .55 : 1);
      const oldX = hero.x; const oldY = hero.y;
      const colliders = instances.filter(instance => instance.asset === PINE || instance.asset === ROCK || instance.asset.category === 'Prop').map(instance => ({ x: instance.x, y: instance.y, radius: instance.asset === PINE ? 3 : instance.asset.category === 'Prop' ? instance.asset.width * instance.scale * .12 : 6 }));
      moveBody(hero, mx, my, speed, dt, colliders, mounted ? 4 : 2);
      hero.moving = Math.hypot(hero.x - oldX, hero.y - oldY) > .01;
      if (length && mx) hero.facing = mx > 0 ? 'right' : 'left';
      stepDistance += Math.hypot(hero.x - oldX, hero.y - oldY);
      if (stepDistance > (mounted ? 4 : 2.5)) {
        stepDistance = 0;
        footsteps.push({ x: hero.x, y: hero.y, born: time, direction: Math.sign(hero.vx) || 1 });
      }
      footsteps = footsteps.filter(step => time - step.born < 1.8).slice(-32);
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
    for (const step of footsteps) {
      if (waterDepth(step.x, step.y) > 0) continue;
      const age = time - step.born;
      for (let i = -4; i <= 4; i++) {
        plot(ids, step.x + i, step.y + Math.abs(i) * .3, renderer.glyph(age < .65 ? '_' : step.direction > 0 ? '/' : '\\', age < .65 ? '#7a986f' : '#3e6049'));
      }
      if (age < .4) plot(ids, step.x - step.direction * age * 4, step.y - age * 4, renderer.glyph('.', '#a49b78'));
    }
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
    let visibleTrees = 0;
    for (const instance of instances) {
      const height = instance.asset.height * instance.scale;
      const width = instance.asset.width * instance.scale;
      if (instance.x + width < cameraX || instance.x - width > cameraX + cols * detailStep || instance.y < cameraY || instance.y - height > cameraY + rows * detailStep) continue;
      if (instance.asset === PINE) visibleTrees++;
      // Distant LOD remains deterministic; static foliage never flashes between
      // independently rounded regeneration frames.
      draws.push({ y: instance.y, draw: () => {
        const flying = instance.asset.category === 'Creature';
        if (!flying) shadow(ids, instance.x + 4, instance.y + 1, instance.asset === PINE ? 18 : 10, 3);
        const compiled = assetCache.get(instance.asset, { time: flying ? time + instance.seed % 5 : 0, seed: instance.seed, variant: instance.variant, action: 'idle', facing: 'right' }, instance.scale / detailStep, flying);
        place(ids, compiled, instance.x + (flying ? Math.sin(time * .7 + instance.seed) * 6 : 0), instance.y + (flying ? Math.cos(time * .9 + instance.seed) * 3 : 0));
      } });
    }
    const actorOptions = { time, seed: 17, variant: hero.variant, action: hero.moving ? 'walk' as const : 'idle' as const, facing: hero.facing };
    draws.push({ y: horse.y, draw: () => {
      shadow(ids, horse.x, horse.y, 24, 3);
      place(ids, assetCache.get(HORSE, { ...actorOptions, seed: 31, variant: 0, action: mounted && hero.moving ? 'walk' : 'idle', facing: horse.facing }, .48 / detailStep, true), horse.x, horse.y);
      if (mounted) place(ids, assetCache.get(playable[playerIndex], { ...actorOptions, action: 'idle' }, 29 / playable[playerIndex].height / detailStep, true), hero.x - (hero.facing === 'right' ? 2 : -2), hero.y - 14 + (hero.moving ? Math.abs(Math.sin(time * 6)) : 0));
    } });
    if (!mounted) draws.push({ y: hero.y, draw: () => {
      shadow(ids, hero.x, hero.y + 1, 10, 2);
      const asset = playable[playerIndex];
      place(ids, assetCache.get(asset, actorOptions, (asset.id.startsWith('dwarf') ? 30 : 41) / asset.height / detailStep, true), hero.x, hero.y);
    } });
    draws.sort((a, b) => a.y - b.y).forEach(item => item.draw());
    const daytime = atmosphere.brightness > 1.1;
    renderer.illuminate(ids, cols, rows, (hero.x - (daytime ? 45 : 30) - cameraX) / detailStep, (hero.y - 35 - cameraY) / detailStep, (daytime ? 75 : 60) / detailStep, daytime);
    for (const lamp of instances.filter(instance => instance.asset.id === 'lantern')) renderer.illuminate(ids, cols, rows, (lamp.x - cameraX) / detailStep, (lamp.y - 6 - cameraY) / detailStep, 23 / detailStep, true);
    const generationEnd = performance.now();
    atmosphere.render(ids, cols, rows, cameraX, cameraY, detailStep, time);
    renderer.present(ctx, ids, cols, rows);
    canvas.style.filter = `brightness(${atmosphere.brightness.toFixed(2)}) saturate(1.18)`;
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
    const state = document.getElementById('world-state'); if (state) state.textContent = `${paused ? 'PAUSED' : playable[playerIndex].name.toUpperCase()} · ${playable[playerIndex].variants[hero.variant].toUpperCase()}`;
    const region = document.querySelector('.world-region'); if (region?.firstChild) region.firstChild.textContent = regionAt(hero.x, hero.y).toUpperCase();
    // Read-only diagnostics used by browser smoke tests and future tooling.
    canvas.dataset.playerX = hero.x.toFixed(2); canvas.dataset.playerY = hero.y.toFixed(2); canvas.dataset.time = time.toFixed(2);
    canvas.dataset.loadedChunks = String(world.loadedCount);
    canvas.dataset.zoom = zoom.toFixed(2);
    canvas.dataset.mounted = String(mounted);
    canvas.dataset.rain = String(atmosphere.rain);
    canvas.dataset.footsteps = String(footsteps.length);
    canvas.dataset.actorMoving = String(hero.moving);
    canvas.dataset.playerAsset = playable[playerIndex].id;
    canvas.dataset.visibleTrees = String(visibleTrees);
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}
