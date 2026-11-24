import { RONIN } from './assets/ronin.ts';
import { PINE } from './assets/pine.ts';
import { ROCK } from './assets/rock.ts';
import { landscapeCell, riverCenter, waterDepth } from './assets/landscape.ts';
import type { AsciiAsset, AsciiCell } from './assets/types.ts';
import { AssetRenderer } from './render/assetRenderer.ts';
import './riverScene.css';

interface Instance { asset: AsciiAsset; x: number; y: number; seed: number; scale: number; variant: number }
interface Ripple { x: number; y: number; born: number }

/** A playable art scene, built from reusable assets rather than UI thumbnails.
 * This is the Phase 1 demonstration; streaming, combat and quests come later. */
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
  let zoom = 1.25;
  let cols = 0; let rows = 0;
  let cameraX = 0; let cameraY = 0;
  let time = 0; let paused = false; let last = performance.now();
  let target: { x: number; y: number } | null = null;
  let rippleTimer = 0;
  let ripples: Ripple[] = [];
  let frames = 0; let fps = 0; let fpsTime = performance.now();
  const instances: Instance[] = [
    { asset: PINE, x: 184, y: 205, seed: 8, scale: .65, variant: 0 },
    { asset: PINE, x: 450, y: 144, seed: 22, scale: .8, variant: 1 },
    { asset: PINE, x: 500, y: 286, seed: 47, scale: .82, variant: 0 },
    { asset: PINE, x: 168, y: 330, seed: 79, scale: .7, variant: 0 },
    { asset: PINE, x: 440, y: 370, seed: 51, scale: .72, variant: 1 },
    { asset: PINE, x: 240, y: 120, seed: 62, scale: .62, variant: 0 },
    ...[130, 187, 270, 335, 390].map((y, index) => ({ asset: ROCK, x: riverCenter(y) + (index % 2 ? 17 : -15), y, seed: index + 11, scale: .7 + index % 2 * .2, variant: 0 })),
    { asset: ROCK, x: 398, y: 185, seed: 91, scale: .7, variant: 1 },
    { asset: ROCK, x: 205, y: 258, seed: 86, scale: .8, variant: 1 },
  ];
  const staticFrames = new Map<Instance, AsciiCell[]>();
  function size(): void {
    cols = Math.ceil(innerWidth / (4 * zoom)); rows = Math.ceil(innerHeight / (6 * zoom));
    canvas.width = cols * 4; canvas.height = rows * 6;
  }
  size();
  addEventListener('resize', size);
  addEventListener('keydown', event => {
    if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) event.preventDefault();
    keys.add(event.code);
    if (event.repeat) return;
    if (event.code === 'KeyP') paused = !paused;
    if (event.code === 'KeyV') hero.variant = (hero.variant + 1) % RONIN.variants.length;
    if (event.code === 'KeyR') { hero.x = riverCenter(230) + 69; hero.y = 230; target = null; zoom = 1.25; size(); }
  });
  addEventListener('keyup', event => keys.delete(event.code));
  addEventListener('blur', () => { keys.clear(); target = null; });
  canvas.addEventListener('wheel', event => { event.preventDefault(); zoom = Math.max(.7, Math.min(2.4, zoom * Math.exp(-event.deltaY * .001))); size(); }, { passive: false });
  canvas.addEventListener('pointerdown', event => {
    target = { x: cameraX + event.clientX / innerWidth * cols, y: cameraY + event.clientY / innerHeight * rows };
  });

  function place(cells: AsciiCell[], asset: AsciiAsset, source: readonly AsciiCell[], x: number, y: number, scale: number): void {
    for (const cell of source) {
      cells.push({ x: Math.round(x - cameraX + (cell.x - asset.anchor.x) * scale), y: Math.round(y - cameraY + (cell.y - asset.anchor.y) * scale), glyph: cell.glyph, color: cell.color });
    }
  }
  function shadow(cells: AsciiCell[], x: number, y: number, rx: number, ry: number): void {
    for (let sy = -ry; sy <= ry; sy++) for (let sx = -rx; sx <= rx; sx++) {
      if ((sx / rx) ** 2 + (sy / ry) ** 2 < 1) cells.push({ x: Math.round(x + sx - cameraX), y: Math.round(y + sy - cameraY), glyph: '.', color: '#111d20' });
    }
  }
  function tick(now: number): void {
    if (!ctx) return;
    const renderStart = performance.now();
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
        const speed = (keys.has('ShiftLeft') || keys.has('ShiftRight') ? 36 : 22) * (waterDepth(hero.x, hero.y) > 0 ? .55 : 1);
        const nx = Math.max(100, Math.min(560, hero.x + mx / length * speed * dt));
        const ny = Math.max(85, Math.min(430, hero.y + my / length * speed * dt));
        const blocked = instances.some(instance => Math.hypot((nx - instance.x) / (instance.asset === PINE ? 3 : 8), (ny - instance.y) / 3) < 1);
        if (!blocked) { hero.x = nx; hero.y = ny; }
        if (mx) hero.facing = mx > 0 ? 'right' : 'left';
      }
      if (hero.moving && waterDepth(hero.x, hero.y) > 0) {
        rippleTimer += dt;
        if (rippleTimer > .15) { ripples.push({ x: hero.x, y: hero.y, born: time }); rippleTimer = 0; }
      }
      ripples = ripples.filter(ripple => time - ripple.born < 2.2);
    }
    // Camera and terrain use the same integer world-cell origin for stable detail.
    cameraX = Math.round(hero.x - cols * .61); cameraY = Math.round(hero.y - rows * .62);
    const cells: AsciiCell[] = [];
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
      const cell = landscapeCell(x + cameraX, y + cameraY, time, 17);
      if (cell) { cell.x = x; cell.y = y; cells.push(cell); }
    }
    const terrainEnd = performance.now();
    // Persistent river rocks disturb the current even when the actor is still.
    for (const instance of instances.filter(i => i.asset === ROCK && waterDepth(i.x, i.y) > 0)) {
      for (let i = 0; i < 40; i++) {
        const age = (time * 5 + i * 1.7) % 30;
        cells.push({ x: Math.round(instance.x + Math.sin(i * 2.8 + age * .07) * (4 + age * .2) - cameraX), y: Math.round(instance.y + age * .8 - cameraY), glyph: i % 3 ? 'o' : '.', color: age > 20 ? '#4b6973' : '#8ea7aa' });
      }
    }
    for (const ripple of ripples) {
      const age = time - ripple.born; const radius = age * 7;
      for (let i = 0; i < 44; i++) {
        const a = i * Math.PI / 22;
        cells.push({ x: Math.round(ripple.x + Math.cos(a) * radius * 1.6 - cameraX), y: Math.round(ripple.y + Math.sin(a) * radius * .45 - cameraY), glyph: i % 4 ? '-' : 'o', color: age < .8 ? '#a8beba' : '#48646e' });
      }
    }
    const draws: { y: number; draw: () => void }[] = [];
    for (const instance of instances) {
      const height = instance.asset.height * instance.scale;
      const width = instance.asset.width * instance.scale;
      if (instance.x + width < cameraX || instance.x - width > cameraX + cols || instance.y < cameraY || instance.y - height > cameraY + rows) continue;
      draws.push({ y: instance.y, draw: () => {
        shadow(cells, instance.x + 4, instance.y + 1, instance.asset === PINE ? 18 : 10, 3);
        let source = staticFrames.get(instance);
        if (!source || instance.asset === PINE) {
          source = instance.asset.generate({ time, seed: instance.seed, variant: instance.variant, action: 'idle', facing: 'right' });
          if (instance.asset !== PINE) staticFrames.set(instance, source);
        }
        place(cells, instance.asset, source, instance.x, instance.y, instance.scale);
      } });
    }
    draws.push({ y: hero.y, draw: () => {
      shadow(cells, hero.x, hero.y + 1, 10, 2);
      place(cells, RONIN, RONIN.generate({ time, seed: 17, variant: hero.variant, action: hero.moving ? 'walk' : 'idle', facing: hero.facing }), hero.x, hero.y, .5);
    } });
    draws.sort((a, b) => a.y - b.y).forEach(item => item.draw());
    const generationEnd = performance.now();
    renderer.grid(ctx, cells, cols, rows);
    canvas.dataset.generateMs = (generationEnd - renderStart).toFixed(1);
    canvas.dataset.terrainMs = (terrainEnd - renderStart).toFixed(1);
    canvas.dataset.blitMs = (performance.now() - generationEnd).toFixed(1);
    frames++;
    if (now - fpsTime > 750) {
      fps = Math.round(frames * 1000 / (now - fpsTime)); frames = 0; fpsTime = now;
      const stats = document.getElementById('world-stats'); if (stats) stats.textContent = `${cols}×${rows} GLYPHS / ${fps} FPS`;
    }
    const location = document.getElementById('world-location'); if (location) location.textContent = waterDepth(hero.x, hero.y) > 0 ? 'WADING · RIVER CURRENT' : 'RIVERBANK · WIND MEADOW';
    const state = document.getElementById('world-state'); if (state) state.textContent = `${paused ? 'PAUSED' : 'RONIN'} · ${RONIN.variants[hero.variant].toUpperCase()}`;
    // Read-only diagnostics used by browser smoke tests and future tooling.
    canvas.dataset.playerX = hero.x.toFixed(2); canvas.dataset.playerY = hero.y.toFixed(2); canvas.dataset.time = time.toFixed(2);
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}
