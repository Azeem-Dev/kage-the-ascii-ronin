import { RONIN } from './assets/ronin.ts';
import { ROCK } from './assets/rock.ts';
import { HORSE } from './assets/horse.ts';
import { ASSET_BY_ID } from './assets/catalog.ts';
import { CHARACTERS } from './assets/characters.ts';
import { waterDepth } from './assets/landscape.ts';
import { noise, type AsciiAsset } from './assets/types.ts';
import { WorldChunks } from './game/worldChunks.ts';
import { LANDMARKS, regionAt } from './game/landmarks.ts';
import { AssetRenderer, LAYER } from './render/assetRenderer.ts';
import { AssetCache, type PlacedSprite } from './render/assetCache.ts';
import { TerrainLayer } from './render/terrainLayer.ts';
import { GpuPresenter } from './render/gpuPresenter.ts';
import { CONFIG } from './config.ts';
import { moveBody, type Collider } from './engine/physics.ts';
import { collidersFor } from './game/colliders.ts';
import { Atmosphere } from './game/atmosphere.ts';
import { Weather, type Fire } from './game/weather.ts';
import { MOVERS, moverAt } from './game/townLife.ts';
import { Wildlife } from './game/wildlife.ts';
import { HOUSE_SPECS, ISO_BUILDINGS } from './assets/isoBuildings.ts';
import { ISO, inputToWorld, toScreenX, toScreenY, toWorldX, toWorldY, worldBounds } from './game/view.ts';
import './riverScene.css';

interface Instance { id: string; asset: AsciiAsset; x: number; y: number; seed: number; scale: number; variant: number }
interface Ripple { x: number; y: number; born: number }

/** A playable art scene, built from reusable assets rather than UI thumbnails.
 * This is the Phase 1 exploration foundation; combat and quests come later. */
export function startRiverScene(): void {
  document.title = 'KAGE / The whispering river';
  document.documentElement.className = 'river-view';
  document.body.innerHTML = `<main class="river-game"><canvas id="world-canvas" aria-label="Playable ASCII river scene. Move with WASD or tap the ground."></canvas><div class="world-vignette"></div><header class="world-hud"><div><span class="world-kicker">KAGE / VISUAL FOUNDATION</span><h1>The whispering river</h1><p>Wind through the reeds. Moonlight on the current.</p></div><div class="world-region">ASHEN VALLEY<br><span id="world-state">KNIGHT · WEATHERED STEEL</span></div></header><div class="world-bottom"><div class="world-health">KAGE <span>[━━━━━━━━━━━━]</span><small id="world-location">RIVERBANK</small></div><div class="world-controls"><span>WASD</span> move <span>SHIFT</span> run <span>WHEEL</span> zoom <span>H</span> character <span>V</span> armor <span>E</span> ride <span>P</span> pause <span>R</span> reset<br><small>1 Meadow 2 Camp 3 Crypt 4 Forge 5 Town 6 Mudgate 7 Village 8 Goblins 9 Orcs 0 Elves · T weather · B fire · Click to walk</small></div><span class="world-telemetry" id="world-stats"></span></div></main>`;
  const canvas = document.getElementById('world-canvas') as HTMLCanvasElement;
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) throw new Error('Canvas 2D is required');
  const renderer = new AssetRenderer(4, 6);
  // GPU drawing (Three.js) with bloom; ?gpu=0 or a missing WebGL falls back to the CPU blit.
  // The 2D canvas stays on top, invisible, so clicks, wheel and test datasets keep working.
  let gpu: GpuPresenter | null = null;
  if (new URLSearchParams(location.search).get('gpu') !== '0') {
    try {
      gpu = new GpuPresenter();
      gpu.canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;image-rendering:pixelated;pointer-events:none';
      canvas.before(gpu.canvas);
      canvas.style.position = 'relative'; canvas.style.opacity = '0';
    } catch (error) { console.warn('WebGL unavailable, using CPU renderer', error); gpu = null; }
  }
  const atmosphere = new Atmosphere(renderer);
  const weather = new Weather(renderer);
  const wildlife = new Wildlife(1337);
  const BURNABLE = new Set(['hovel', 'cottage', 'townhouse', 'manor', 'tavern', 'tent', 'market-stall', 'haystack', 'cart']);
  const TREE_IDS = new Set(['pine', 'oak', 'willow', 'birch', 'cypress', 'cherry', 'dead-tree']);
  const GIANT_TREES = new Set(['oak', 'willow', 'birch', 'cypress', 'cherry', 'dead-tree']);
  const TALL_PROPS = new Set(['lamp-post', 'banner']);
  const baseId = (id: string) => id.replace(/^iso-/, '');
  /** Fire footprint from the building's drawn size (2D sprite heights include the roof). */
  const fireFor = (i: { id: string; x: number; y: number; scale: number; asset: AsciiAsset }): Fire => {
    const spec = HOUSE_SPECS[baseId(i.asset.id)];
    if (spec) return { id: i.id, x: i.x, y: i.y, width: (spec.a + spec.b) * i.scale * .9, height: (spec.wall + spec.rise) * i.scale * .85 };
    return { id: i.id, x: i.x, y: i.y, width: i.asset.width * i.scale * .75, height: i.asset.height * i.scale * .8 };
  };
  let mudgateLit = false; const keys = new Set<string>();
  const playable = [RONIN, ...CHARACTERS];
  let playerIndex = 0;
  const hero = { x: 770, y: -22, vx: 0, vy: 0, facing: 'right' as 'left' | 'right', moving: false, variant: 0 };
  const horse = { x: hero.x + 27, y: hero.y + 16, facing: 'right' as 'left' | 'right' };
  let mounted = false;
  let zoom = CONFIG.exploration.defaultZoom;
  let detailStep = 1;
  let cols = 0; let rows = 0;
  let cameraX = 0; let cameraY = 0;
  let lastCameraX = NaN; let lastCameraY = NaN;
  let lastCols = 0; let lastRows = 0; let lastDetailStep = 0;
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
  const wakeIds = ['#8ea7aa', '#4b6973', '#a8beba', '#48646e'].map(color => ['o', '.', '-'].map(glyph => renderer.glyph(glyph, color)));
  let lastProps: ReturnType<WorldChunks['around']> | null = null;
  let instances: Instance[] = [];
  // Derived from `instances` only when the chunk window changes, not every frame.
  let colliders: Collider[] = [];
  let lanterns: Instance[] = [];
  const missingAssets = new Set<string>();
  let riverRocks: Instance[] = [];
  const footstepIds = {
    fresh: renderer.glyph('_', '#7a986f'),
    right: renderer.glyph('/', '#3e6049'),
    left: renderer.glyph('\\', '#3e6049'),
    dust: renderer.glyph('.', '#a49b78'),
  };
  // Text/filter writes only when the value changes: avoids per-frame DOM and style invalidation.
  const lastText = new Map<string, string>();
  const setText = (node: Node | null | undefined, key: string, value: string) => {
    if (!node || lastText.get(key) === value) return;
    lastText.set(key, value); node.textContent = value;
  };
  let lastFilter = 'reset'; let lastDiagnostics = -Infinity;
  function size(): void {
    // Coarser distant samples bound framebuffer work at the widest zoom.
    detailStep = Math.max(1, Math.ceil(.8 / zoom));
    // Glyphs are rasterized at device pixels so they stay crisp on scaled displays.
    const dpr = Math.max(1, Math.min(2, devicePixelRatio || 1));
    renderer.resizeGlyphs(Math.max(4, Math.round(4 * zoom * detailStep * dpr)), Math.max(6, Math.round(6 * zoom * detailStep * dpr)));
    cols = Math.max(1, Math.ceil(innerWidth * dpr / renderer.cellWidth)); rows = Math.max(1, Math.ceil(innerHeight * dpr / renderer.cellHeight));
    if (canvas.width !== cols * renderer.cellWidth) canvas.width = cols * renderer.cellWidth;
    if (canvas.height !== rows * renderer.cellHeight) canvas.height = rows * renderer.cellHeight;
    assetCache.clear();
  }
  size();
  const weatherPanel = document.createElement('div');
  weatherPanel.className = 'world-weather';
  weatherPanel.innerHTML = '<button id="toggle-rain">Rain: off [T]</button><button id="toggle-day">Day / night [N]</button><button id="toggle-insects">Insects: on [L]</button><button id="toggle-cycle">Cycle: on [C]</button>';
  document.querySelector('.river-game')?.append(weatherPanel);

  // --- Pause screen (UI-01): an ASCII modal; simulation stops while it is open. ---
  const pauseScreen = document.createElement('div');
  pauseScreen.className = 'world-pause';
  pauseScreen.hidden = true;
  pauseScreen.setAttribute('role', 'dialog');
  pauseScreen.setAttribute('aria-label', 'Game paused');
  pauseScreen.innerHTML = `<pre>╔════════════════════════════════════╗
║                                    ║
║        K   A   G   E               ║
║        ~ the ascii ronin ~         ║
║                                    ║
║              PAUSED                ║
║                                    ║
╚════════════════════════════════════╝</pre><div class="world-pause-menu"><button id="pause-resume">▶ Resume <kbd>P / Esc</kbd></button><button id="pause-restart">↺ Restart <kbd>R</kbd></button><button id="pause-rain">☂ Rain <kbd>T</kbd></button><button id="pause-day">☀ Day / night <kbd>N</kbd></button></div>`;
  document.querySelector('.river-game')?.append(pauseScreen);
  const setPaused = (value: boolean) => {
    paused = value; pauseScreen.hidden = !value;
    if (value) { keys.clear(); target = null; (document.getElementById('pause-resume') as HTMLElement | null)?.focus(); }
    // `last` is refreshed every frame, so resuming cannot produce a large time step.
  };

  // --- Minimap (UI-02): explored terrain, landmarks and the player. ---
  const MAP_W = 144; const MAP_H = 100;
  const MAP_SCALE = 2.5;       // world units per map pixel
  const EXPLORE_CELL = 16;     // fog-of-war granularity in world units
  const EXPLORE_RADIUS = 7;    // cells revealed around the player
  const minimap = document.createElement('canvas');
  minimap.className = 'world-minimap'; minimap.width = MAP_W; minimap.height = MAP_H;
  minimap.setAttribute('aria-label', 'Minimap');
  document.querySelector('.river-game')?.append(minimap);
  const mapCtx = minimap.getContext('2d');
  const mapImage = mapCtx?.createImageData(MAP_W, MAP_H);
  const mapPixels = mapImage ? new Uint32Array(mapImage.data.buffer) : null;
  const explored = new Set<number>();
  const exploreKey = (cx: number, cy: number) => (cx + 4096) * 8192 + (cy + 4096);
  let exploreCx = NaN; let exploreCy = NaN; let lastMapDraw = -Infinity;
  function drawMinimap(now: number): void {
    const cx = Math.floor(hero.x / EXPLORE_CELL); const cy = Math.floor(hero.y / EXPLORE_CELL);
    if (cx !== exploreCx || cy !== exploreCy) {
      exploreCx = cx; exploreCy = cy;
      for (let dy = -EXPLORE_RADIUS; dy <= EXPLORE_RADIUS; dy++) for (let dx = -EXPLORE_RADIUS; dx <= EXPLORE_RADIUS; dx++) {
        if (dx * dx + dy * dy <= EXPLORE_RADIUS * EXPLORE_RADIUS) explored.add(exploreKey(cx + dx, cy + dy));
      }
    }
    if (!mapCtx || !mapImage || !mapPixels || now - lastMapDraw < 250) return; // ~4 Hz is plenty
    lastMapDraw = now;
    for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
      const wx = hero.x + (x - MAP_W / 2) * MAP_SCALE; const wy = hero.y + (y - MAP_H / 2) * MAP_SCALE;
      // ABGR pixels: unexplored / water / land.
      mapPixels[y * MAP_W + x] = !explored.has(exploreKey(Math.floor(wx / EXPLORE_CELL), Math.floor(wy / EXPLORE_CELL))) ? 0xff120f0b
        : waterDepth(wx, wy) > 0 ? 0xff9a7f3f : 0xff2f4026;
    }
    mapCtx.putImageData(mapImage, 0, 0);
    mapCtx.font = '8px "Courier New", monospace'; mapCtx.textAlign = 'center';
    for (const area of LANDMARKS) {
      const mx = MAP_W / 2 + (area.x - hero.x) / MAP_SCALE; const my = MAP_H / 2 + (area.y - hero.y) / MAP_SCALE;
      if (mx < 4 || my < 8 || mx > MAP_W - 4 || my > MAP_H - 2) continue;
      mapCtx.fillStyle = '#e8c46a'; mapCtx.fillText(area.key.replace('Digit', ''), mx, my + 3);
    }
    mapCtx.fillStyle = '#ffffff';
    mapCtx.fillRect(MAP_W / 2 - 1, MAP_H / 2 - 1, 3, 3);
    mapCtx.fillStyle = '#ff6a4a';
    mapCtx.fillRect(MAP_W / 2 + (hero.facing === 'right' ? 2 : -3), MAP_H / 2, 1, 1);
  }
  const toggleWeather = (code: string) => {
    if (code === 'KeyT') weather.cycle();
    if (code === 'KeyL') atmosphere.insects = !atmosphere.insects;
    if (code === 'KeyN') { atmosphere.daylight = atmosphere.brightness > 1.1 ? .75 : .2; atmosphere.cycle = false; }
    if (code === 'KeyC') atmosphere.cycle = !atmosphere.cycle;
    document.getElementById('toggle-rain')!.textContent = `Weather: ${weather.mode} [T]`;
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
    if (event.code === 'KeyP' || event.code === 'Escape') setPaused(!paused);
    if (event.code === 'KeyB') {
      // Set the nearest building alight (or put it out).
      const near = instances.filter(i => BURNABLE.has(baseId(i.asset.id))).sort((a, b) => Math.hypot(a.x - hero.x, a.y - hero.y) - Math.hypot(b.x - hero.x, b.y - hero.y))[0];
      if (near && Math.hypot(near.x - hero.x, near.y - hero.y) < 160) weather.toggleFire(fireFor(near));
    }
    if (event.code === 'KeyV') hero.variant = (hero.variant + 1) % playable[playerIndex].variants.length;
    if (event.code === 'KeyH') { playerIndex = (playerIndex + 1) % playable.length; hero.variant = 0; }
    if (event.code === 'KeyE' && !paused) {
      if (mounted) { mounted = false; hero.x = horse.x; hero.y = horse.y + 10; }
      else if (Math.hypot(hero.x - horse.x, hero.y - horse.y) < 36) { mounted = true; hero.x = horse.x; hero.y = horse.y; target = null; }
    }
    if (event.code === 'KeyR') { hero.x = 770; hero.y = -22; hero.vx = 0; hero.vy = 0; horse.x = hero.x + 27; horse.y = hero.y + 16; mounted = false; target = null; zoom = CONFIG.exploration.defaultZoom; size(); }
    if (['Minus', 'NumpadSubtract', 'Equal', 'NumpadAdd'].includes(event.code)) {
      zoom = Math.max(CONFIG.exploration.minimumZoom, Math.min(CONFIG.exploration.maximumZoom, zoom * (event.code === 'Minus' || event.code === 'NumpadSubtract' ? .8 : 1.25))); size();
    }
  });
  addEventListener('keyup', event => keys.delete(event.code));
  addEventListener('blur', () => { keys.clear(); target = null; });
  canvas.addEventListener('wheel', event => { event.preventDefault(); zoom = Math.max(CONFIG.exploration.minimumZoom, Math.min(CONFIG.exploration.maximumZoom, zoom * Math.exp(-event.deltaY * CONFIG.exploration.zoomSensitivity))); size(); }, { passive: false });
  document.getElementById('pause-resume')!.onclick = () => setPaused(false);
  document.getElementById('pause-restart')!.onclick = () => { setPaused(false); window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyR' })); };
  document.getElementById('pause-rain')!.onclick = () => toggleWeather('KeyT');
  document.getElementById('pause-day')!.onclick = () => toggleWeather('KeyN');
  canvas.addEventListener('pointerdown', event => {
    if (paused) return;
    const px = cameraX + event.clientX / innerWidth * cols * detailStep; const py = cameraY + event.clientY / innerHeight * rows * detailStep;
    target = { x: toWorldX(px, py), y: toWorldY(px, py) };
  });

  // All drawing helpers take WORLD positions and project them (top-down or isometric).
  /** Painter's-order key: screen depth of a world ground point. */
  const depth = (x: number, y: number) => toScreenY(x, y);
  const cellX = (x: number, y: number) => (toScreenX(x, y) - cameraX) / detailStep;
  const cellY = (x: number, y: number) => (toScreenY(x, y) - cameraY) / detailStep;
  const sprite = (asset: AsciiAsset, options: Parameters<AssetCache['get']>[1], scale: number, animated = false) => assetCache.get(asset, options, scale, animated);
  /** lift = height above the ground point, straight up the screen (riders, birds). */
  function place(ids: Uint32Array, compiled: PlacedSprite, x: number, y: number, layer: number = LAYER.prop, castShadow = true, lift = 0): void {
    const sx = cellX(x, y); const sy = cellY(x, y) - lift / detailStep;
    // Scenery standing in front of the hero gets a see-through window around them.
    const hole = undefined;
    renderer.stamp(ids, cols, rows, compiled.sprite, sx - compiled.anchorX, sy - compiled.anchorY, layer, castShadow ? sy : undefined, hole);
  }
  /** Window (in cells) around the hero that scenery in front of them leaves open. */
  // (seeThrough crater cutout disabled so buildings render solid)
  function plot(ids: Uint32Array, x: number, y: number, id: number): void {
    const sx = Math.round(cellX(x, y)); const sy = Math.round(cellY(x, y));
    if (sx >= 0 && sy >= 0 && sx < cols && sy < rows) ids[sy * cols + sx] = id;
  }
  function shadow(_ids: Uint32Array, x: number, y: number, rx: number, ry: number): void {
    renderer.contactShadow(cols, rows, cellX(x, y), cellY(x, y), Math.max(1, rx * .7 / detailStep), Math.max(1, ry / detailStep));
  }
  function light(x: number, y: number, lift: number, radius: number, r: number, g: number, b: number): void {
    renderer.addLight(cols, rows, cellX(x, y), cellY(x, y) - lift / detailStep, radius, r, g, b);
  }
  /** 1 at noon, 0 at midnight. */
  function dayFactor(): number { return Math.sin(atmosphere.daylight * Math.PI * 2) * .5 + .5; }
  /** Time of day drives ambient colour, sun/moon strength and shadow direction. */
  function applyLighting(): void {
    const d = dayFactor();
    const dusk = Math.max(0, 1 - Math.abs(d - .45) / .25); // warm band around sunrise/sunset
    const mix = (night: number, day: number) => night + (day - night) * d;
    const angle = atmosphere.daylight * Math.PI * 2;
    renderer.lighting = {
      ambient: [mix(.24, .58) + dusk * .1, mix(.28, .6) + dusk * .02, mix(.48, .62) - dusk * .08],
      sun: mix(.22, .68),
      sunColor: d > .5 ? [1, .94 - dusk * .15, .82 - dusk * .3] : [.55, .68, 1],
      shadowX: Math.cos(angle) * (d > .5 ? .7 : -.5),
      shadowY: .16 + (1 - Math.abs(Math.cos(angle))) * .12,
      saturation: .92 + d * .12,
    };
    weather.tint(renderer.lighting);
  }
  function tick(now: number): void {
    if (!ctx) return;
    const renderStart = performance.now();
    const props = world.around(hero.x, hero.y, cols * detailStep, rows * detailStep);
    if (props !== lastProps) {
      lastProps = props;
      // Placements may reference assets that are still being built; skip them (warn once).
      instances = props.flatMap(prop => {
        const asset = ASSET_BY_ID.get(prop.assetId);
        if (!asset) { if (!missingAssets.has(prop.assetId)) { missingAssets.add(prop.assetId); console.warn(`World placement skipped: unknown asset "${prop.assetId}"`); } return []; }
        // Isometric view swaps flat front-view buildings and boxy props for aligned 2.5D versions.
        // House anchors move back from the old front-base point to the footprint centre.
        const iso = ISO ? ISO_BUILDINGS[prop.assetId] : undefined;
        if (iso) {
          const spec = HOUSE_SPECS[prop.assetId];
          const scale = spec ? (prop.id.startsWith('town-') ? 1.15 : 1) : prop.assetId === 'market-stall' ? .72 : .85;
          return [{ ...prop, asset: iso, scale, y: spec?.shiftBack ? prop.y - spec.b * .92 * scale : prop.y }];
        }
        // Keep oversized 300-cell trees and 230-cell lamp/banner poles proportional to the 41-cell hero.
        const scale = GIANT_TREES.has(prop.assetId) ? prop.scale * .40 : TALL_PROPS.has(prop.assetId) ? prop.scale * .44 : prop.scale;
        return [{ ...prop, asset, scale }];
      });
      colliders = instances.flatMap(collidersFor);
      lanterns = instances.filter(instance => instance.asset.id === 'lantern' || instance.asset.light);
      riverRocks = instances.filter(instance => instance.asset === ROCK && waterDepth(instance.x, instance.y) > 0);
      // Story set-piece: one Mudgate hovel is already burning when you arrive.
      const hovel = mudgateLit ? undefined : instances.find(instance => instance.id === 'mud-hovel-2');
      if (hovel) { weather.toggleFire(fireFor(hovel)); mudgateLit = true; }
    }
    const dt = Math.min(.05, (now - last) / 1000); last = now;
    if (!paused) {
      time += dt;
      atmosphere.update(dt);
      // Keys are screen directions; in isometric view they turn into world diagonals.
      let [mx, my] = inputToWorld(
        Number(keys.has('KeyD') || keys.has('ArrowRight')) - Number(keys.has('KeyA') || keys.has('ArrowLeft')),
        Number(keys.has('KeyS') || keys.has('ArrowDown')) - Number(keys.has('KeyW') || keys.has('ArrowUp')));
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
      // Interim: the standing horse is solid along its body (Agent D's body-vs-body system will replace this).
      const obstacles = mounted ? colliders : colliders.concat([-24, -12, 0, 12, 24].map(offset => ({ x: horse.x + offset, y: horse.y - 1, radius: 5 })));
      moveBody(hero, mx, my, speed, dt, obstacles, mounted ? 4 : 2);
      hero.moving = Math.hypot(hero.x - oldX, hero.y - oldY) > .01;
      const screenDX = toScreenX(mx, my);
      if (length && Math.abs(screenDX) > .01) hero.facing = screenDX > 0 ? 'right' : 'left';
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
    cameraX = Math.floor((toScreenX(hero.x, hero.y) - cols * detailStep * (ISO ? .5 : .61)) / detailStep) * detailStep;
    cameraY = Math.floor((toScreenY(hero.x, hero.y) - rows * detailStep * (ISO ? .6 : .62)) / detailStep) * detailStep;
    const viewWorld = worldBounds(cameraX, cameraY, cols * detailStep, rows * detailStep);
    applyLighting();
    const ids = renderer.begin(terrain.get(cameraX, cameraY, cols, rows, detailStep, time, toWorldX, toWorldY));
    const terrainEnd = performance.now();
    for (const step of footsteps) {
      if (waterDepth(step.x, step.y) > 0) continue;
      const age = time - step.born;
      const stepId = age < .65 ? footstepIds.fresh : step.direction > 0 ? footstepIds.right : footstepIds.left;
      const sx = cellX(step.x, step.y); const sy = cellY(step.x, step.y);
      for (let i = -3; i <= 3; i++) {
        const px = Math.round(sx + i); const py = Math.round(sy + Math.abs(i) * .25);
        if (px >= 0 && py >= 0 && px < cols && py < rows) ids[py * cols + px] = stepId;
      }
      if (age < .4) plot(ids, step.x - step.direction * age * 4, step.y - age * 4, footstepIds.dust);
    }
    // Stone wakes: the current parts around the stone; foam forms at its flanks and drifts
    // downstream at its own speed and wander, breaking up at random. No shared timer, so no marching lines.
    for (const instance of riverRocks) {
      const radius = 7 * instance.scale + 3;
      for (let i = 0; i < 14; i++) {
        const seed = instance.seed * 31 + i * 7;
        const speed = 6 + noise(seed, 1, 211) * 9;           // units per second, per fleck
        const length = 26 + noise(seed, 2, 211) * 30;        // how far it drifts before re-forming
        const travel = (time * speed + noise(seed, 3, 211) * length) % length;
        const cycle = Math.floor((time * speed + noise(seed, 3, 211) * length) / length);
        if (noise(seed, cycle, 212) < .3) continue;           // some cycles leave no foam: broken, natural
        const side = i % 2 ? 1 : -1;
        const spread = .12 + noise(seed, cycle, 213) * .25;
        const drift = Math.sin(time * (.8 + noise(seed, 4, 211)) + seed) * 1.6;
        const x = instance.x + side * (radius * .8 + travel * spread) + drift;
        const y = instance.y + radius * .3 + travel;
        if (waterDepth(x, y) <= 0) continue;
        const fresh = travel < length * .35;
        plot(ids, x, y, wakeIds[fresh ? 0 : 1][noise(seed, cycle, 214) > .6 ? 1 : 0]);
      }
    }
    for (const ripple of ripples) {
      const age = time - ripple.born; const radius = age * 7;
      const rx = ISO ? radius : radius * 1.6; const ry = ISO ? radius : radius * .45;
      for (let i = 0; i < 32; i++) {
        const a = i * Math.PI / 16;
        plot(ids, ripple.x + Math.cos(a) * rx, ripple.y + Math.sin(a) * ry, wakeIds[age < .8 ? 2 : 3][i % 4 ? 2 : 0]);
      }
    }
    const draws: { y: number; draw: () => void }[] = [];
    const at = (x: number, y: number) => ({ y: depth(x, y) });
    let visibleTrees = 0;
    for (const instance of instances) {
      const height = instance.asset.height * instance.scale;
      const width = instance.asset.width * instance.scale;
      const ax = instance.asset.anchor.x * instance.scale;
      const ay = instance.asset.anchor.y * instance.scale;
      const ix = toScreenX(instance.x, instance.y); const iy = toScreenY(instance.x, instance.y);
      if (ix + (width - ax) < cameraX || ix - ax > cameraX + cols * detailStep || iy + (height - ay) < cameraY || iy - ay > cameraY + rows * detailStep) continue;
      const isTree = TREE_IDS.has(instance.asset.id);
      if (isTree) visibleTrees++;
      const houseSpec = HOUSE_SPECS[baseId(instance.asset.id)];
      // Distant LOD remains deterministic; static foliage never flashes between
      // independently rounded regeneration frames.
      draws.push({
        ...at(instance.x, instance.y), draw: () => {
          const flying = instance.asset.category === 'Creature';
          if (!flying) {
            if (houseSpec) {
              const sa = (houseSpec.a + houseSpec.b) * instance.scale * .85;
              const sb = (houseSpec.a + houseSpec.b) * instance.scale * .3;
              shadow(ids, instance.x + renderer.lighting.shadowX * 14, instance.y + renderer.lighting.shadowY * 14, sa, sb);
            } else {
              shadow(ids, instance.x + 3, instance.y + 1, isTree ? 12 : 8, isTree ? 3.5 : 2.5);
            }
          }
          const compiled = sprite(instance.asset, { time: flying ? time + instance.seed % 5 : 0, seed: instance.seed, variant: instance.variant, action: 'idle', facing: 'right' }, instance.scale / detailStep, flying);
          place(ids, compiled, instance.x + (flying ? Math.sin(time * .7 + instance.seed) * 6 : 0), instance.y, flying ? LAYER.effect : LAYER.prop, !flying && !houseSpec, flying ? -Math.cos(time * .9 + instance.seed) * 3 : 0);
        }
      });
    }
    // Hero and horse actor rendering
    const actorOptions = { time, seed: 17, variant: hero.variant, action: hero.moving ? 'walk' as const : 'idle' as const, facing: hero.facing };
    draws.push({
      ...at(horse.x, horse.y), draw: () => {
        shadow(ids, horse.x, horse.y, 24, 3);
        place(ids, sprite(HORSE, { ...actorOptions, seed: 31, variant: 0, action: mounted && hero.moving ? 'walk' : 'idle', facing: horse.facing }, .48 / detailStep, true), horse.x, horse.y, LAYER.actor); // always an actor: prop base-darkening made its legs vanish (looked like floating)
        if (mounted) place(ids, sprite(playable[playerIndex], { ...actorOptions, action: 'sit' as const }, (playable[playerIndex].id.startsWith('dwarf') ? 30 : 41) / playable[playerIndex].height / detailStep, true), hero.x - (hero.facing === 'right' ? 2 : -2), hero.y, LAYER.actor, false, 15 - (hero.moving ? Math.abs(Math.sin(time * 6)) * .6 : 0));
      }
    });
    // Townsfolk and carts walking the streets (positions are a pure function of time).
    const viewRight = cameraX + cols * detailStep; const viewBottom = cameraY + rows * detailStep;
    // Wildlife (Agent F): herds, birds, butterflies, fireflies around the camera.
    wildlife.update(paused ? 0 : dt, viewWorld.x, viewWorld.y, viewWorld.w, viewWorld.h, hero, dayFactor() < .35);
    for (const animal of wildlife.animals) {
      const asset = ASSET_BY_ID.get(animal.assetId);
      if (!asset) continue;
      const airborne = animal.z > 0;
      // Herds graze in the countryside, never in the streets.
      if (!airborne && LANDMARKS.some(r => (r.id === 'town' || r.id === 'village' || r.id === 'outskirts') && Math.hypot(animal.x - r.x, animal.y - r.y) < (r.id === 'town' ? 260 : 150))) continue;
      draws.push({
        ...at(animal.x, animal.y), draw: () => {
          if (!airborne) shadow(ids, animal.x, animal.y, 8 * animal.scale / .3, 2);
          place(ids, sprite(asset, { time: time + animal.seed % 5, seed: animal.seed, variant: animal.variant, facing: animal.facing, action: animal.action }, animal.scale / detailStep, true),
            animal.x, animal.y, airborne ? LAYER.effect : LAYER.actor, !airborne, animal.z);
          if (asset.id === 'firefly') light(animal.x, animal.y, animal.z, 4, .6, 1, .2);
        }
      });
    }
    for (const mover of MOVERS) {
      const asset = ASSET_BY_ID.get(mover.assetId);
      if (!asset) continue;
      const state = moverAt(mover, time);
      const msx = toScreenX(state.x, state.y); const msy = toScreenY(state.x, state.y);
      if (msx < cameraX - 80 || msx > viewRight + 80 || msy < cameraY - 10 || msy - 60 > viewBottom) continue;
      const options = { time: time + mover.offset * 7, seed: 41, variant: mover.variant, action: state.moving ? 'walk' as const : 'idle' as const, facing: state.facing };
      if (mover.kind === 'walker') {
        draws.push({
          ...at(state.x, state.y), draw: () => {
            shadow(ids, state.x, state.y, 9, 2);
            place(ids, sprite(asset, options, mover.scale / detailStep, true), state.x, state.y, LAYER.actor);
          }
        });
      } else {
        // A small horse pulls the cart; the horse walks ahead along the road vector.
        const hx = state.x + state.dirX * 32; const hy = state.y + state.dirY * 32;
        draws.push({
          ...at(state.x, state.y), draw: () => {
            shadow(ids, state.x, state.y, 20, 3);
            // Driver first, a little behind the cart, so the cart hides the legs and they read as seated.
            const driver = ASSET_BY_ID.get(mover.driver ?? 'peasant');
            if (driver) place(ids, sprite(driver, { ...options, action: 'idle', facing: state.facing }, .34 / detailStep, true), state.x + (state.facing === 'right' ? 6 : -6), state.y, LAYER.actor, false, 9);
            place(ids, sprite(asset, { ...options, action: 'idle' }, mover.scale / detailStep, true), state.x, state.y, LAYER.actor);
            shadow(ids, hx, hy, 16, 2.5);
            place(ids, sprite(HORSE, { ...options, seed: 33 }, .3 / detailStep, true), hx, hy, LAYER.actor);
          }
        });
      }
    }
    if (!mounted) draws.push({
      ...at(hero.x, hero.y), draw: () => {
        shadow(ids, hero.x, hero.y, 11, 2.5);
        const asset = playable[playerIndex];
        place(ids, sprite(asset, actorOptions, (asset.id.startsWith('dwarf') ? 30 : 41) / asset.height / detailStep, true), hero.x, hero.y, LAYER.actor);
      }
    });
    draws.sort((a, b) => a.y - b.y).forEach(item => item.draw());
    // Lights: lanterns glow at all times and dominate at night; the hero carries a faint light after dusk.
    const night = 1 - dayFactor();
    for (const lamp of lanterns) {
      const glow = .35 + night;
      if (!lamp.asset.light) { light(lamp.x, lamp.y, 6, (34 + night * 26) / detailStep, .95 * glow, .58 * glow, .24 * glow); continue; }
      const src = lamp.asset.light;
      const [r, g, b] = src.color;
      // Light offsets are sprite-space: x along the screen, y up the sprite.
      renderer.addLight(cols, rows, cellX(lamp.x, lamp.y) + src.x * lamp.scale / detailStep, cellY(lamp.x, lamp.y) + src.y * lamp.scale / detailStep, src.radius * lamp.scale * (.7 + night * .5) / detailStep, r * glow, g * glow, b * glow);
    }
    if (night > .35) light(hero.x, hero.y, 18, 46 / detailStep, .35 * night, .3 * night, .22 * night);
    // Firelight from burning buildings.
    for (const fl of weather.lights(time)) light(fl.x, fl.y, fl.z, fl.radius / detailStep, 1.15 * fl.strength, .55 * fl.strength, .2 * fl.strength);
    const generationEnd = performance.now();
    atmosphere.rain = 0; // replaced by particle weather
    atmosphere.render(ids, cols, rows, cameraX, cameraY, detailStep, time,
      (x, y) => [cellX(x, y), cellY(x, y)], viewWorld.y, viewWorld.y + viewWorld.h);
    if (!paused) weather.update(dt, viewWorld.x, viewWorld.y, viewWorld.w, viewWorld.h);
    weather.draw(ids, renderer.layers, cols, rows, cameraX, cameraY, detailStep,
      (x, y, z) => [cellX(x, y), cellY(x, y) - z / detailStep]);
    canvas.dataset.atmosMs = (performance.now() - generationEnd).toFixed(1);
    const canScroll = lastCols === cols && lastRows === rows && lastDetailStep === detailStep && Number.isFinite(lastCameraX);
    const scrollX = canScroll ? -Math.round((cameraX - lastCameraX) / detailStep) : 0;
    const scrollY = canScroll ? -Math.round((cameraY - lastCameraY) / detailStep) : 0;
    if (gpu) {
      renderer.prepare(ids, cols, rows); gpu.present(renderer, cols, rows, terrain.waterMask, time, 1 - dayFactor(),
        { snowCover: weather.snowCover, flash: weather.flash, camCellX: cameraX / detailStep, camCellY: cameraY / detailStep });
    }
    else renderer.present(ctx, ids, cols, rows, scrollX, scrollY);
    lastCameraX = cameraX; lastCameraY = cameraY;
    lastCols = cols; lastRows = rows; lastDetailStep = detailStep;
    if (lastFilter) { lastFilter = ''; canvas.style.filter = ''; }
    canvas.dataset.generateMs = (generationEnd - renderStart).toFixed(1);
    canvas.dataset.terrainMs = (terrainEnd - renderStart).toFixed(1);
    canvas.dataset.blitMs = (performance.now() - generationEnd).toFixed(1);
    canvas.dataset.changedCells = String(renderer.changedCells);
    canvas.dataset.shadeMs = renderer.shadeMs.toFixed(1);
    canvas.dataset.putMs = (performance.now() - renderer.putStart).toFixed(1);
    frames++;
    if (now - fpsTime > 750) {
      fps = Math.round(frames * 1000 / (now - fpsTime)); frames = 0; fpsTime = now;
      setText(document.getElementById('world-stats'), 'stats', `${world.loadedCount} CHUNKS / ${cols}×${rows} / ${fps} FPS`);
    }
    setText(document.getElementById('world-location'), 'location', waterDepth(hero.x, hero.y) > 0 ? 'WADING · RIVER CURRENT' : 'RIVERBANK · WIND MEADOW');
    setText(document.getElementById('world-state'), 'state', `${paused ? 'PAUSED' : playable[playerIndex].name.toUpperCase()} · ${playable[playerIndex].variants[hero.variant].toUpperCase()}`);
    setText(document.querySelector('.world-region')?.firstChild, 'region', regionAt(hero.x, hero.y).toUpperCase());
    // Read-only diagnostics for browser smoke tests; ~20 Hz avoids per-frame attribute churn.
    if (now - lastDiagnostics > 50) {
      lastDiagnostics = now;
      canvas.dataset.playerX = hero.x.toFixed(2); canvas.dataset.playerY = hero.y.toFixed(2); canvas.dataset.time = time.toFixed(2);
      canvas.dataset.loadedChunks = String(world.loadedCount);
      canvas.dataset.zoom = zoom.toFixed(2);
      canvas.dataset.mounted = String(mounted);
      canvas.dataset.rain = String(atmosphere.rain);
      canvas.dataset.weather = weather.mode;
      canvas.dataset.particles = String(weather.particleCount);
      canvas.dataset.fires = weather.fires.map(f => `${f.id}@${Math.round(f.x)},${Math.round(f.y)}`).join(' ');
      canvas.dataset.footsteps = String(footsteps.length);
      canvas.dataset.actorMoving = String(hero.moving);
      canvas.dataset.playerAsset = playable[playerIndex].id;
      canvas.dataset.visibleTrees = String(visibleTrees);
    }
    drawMinimap(now);
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}
