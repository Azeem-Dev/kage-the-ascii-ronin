// ============================================================================
// KAGE: The ASCII Ronin — Main Entry Point
// Sets up Canvas, Glyph Atlas, Scene Buffer, ASCII Pass, and Game Loop
// ============================================================================

import { CONFIG } from './config.ts';
import { GameLoop } from './engine/loop.ts';
import { InputManager } from './engine/input.ts';
import { GlyphAtlas } from './render/glyphAtlas.ts';
import { SceneBuffer } from './render/sceneBuffer.ts';
import { AsciiPass } from './render/asciiPass.ts';
import { AsciiSceneRenderer } from './render/asciiScene.ts';
import { TestScene } from './game/testScene.ts';
import { DebugOverlay } from './ui/debugOverlay.ts';
import { startRiverScene } from './riverScene.ts';

function bootstrap(): void {
  const canvas = document.getElementById('ascii-canvas') as HTMLCanvasElement;
  if (!canvas) {
    throw new Error('Canvas element #ascii-canvas not found in DOM');
  }

  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) {
    throw new Error('Failed to acquire 2D context from #ascii-canvas');
  }
  ctx.imageSmoothingEnabled = false;

  // Initialize density
  let currentDensityKey: 'low' | 'medium' | 'high' = CONFIG.display.defaultDensity;
  let currentDensity = CONFIG.display.densities[currentDensityKey];
  let cols = currentDensity.cols;
  let rows = currentDensity.rows;

  // Set initial canvas resolution
  const cellW = CONFIG.display.cellWidth;
  const cellH = CONFIG.display.cellHeight;
  canvas.width = cols * cellW;
  canvas.height = rows * cellH;

  // CSS sizing for edge-to-edge fullscreen
  const applyCanvasStyle = () => {
    canvas.style.width = '100vw';
    canvas.style.height = '100vh';
    canvas.style.objectFit = 'fill';
  };
  applyCanvasStyle();
  window.addEventListener('resize', applyCanvasStyle);

  // 1. Initialize Glyph Atlas
  const atlas = new GlyphAtlas(cellW, cellH);

  // 2. Initialize Scene Buffer & ASCII Pass
  const sceneBuffer = new SceneBuffer(cols, rows, CONFIG.render.bufferScale);
  const asciiPass = new AsciiPass(cols, rows, atlas);
  const asciiScene = new AsciiSceneRenderer(cols, rows, atlas);

  // 3. Initialize Game Scene & Debug Overlay
  const testScene = new TestScene();
  const debugOverlay = new DebugOverlay();

  // Function to reconfigure density
  const setDensity = (key: 'low' | 'medium' | 'high') => {
    currentDensityKey = key;
    currentDensity = CONFIG.display.densities[key];
    cols = currentDensity.cols;
    rows = currentDensity.rows;

    canvas.width = cols * cellW;
    canvas.height = rows * cellH;
    ctx.imageSmoothingEnabled = false;
    applyCanvasStyle();

    sceneBuffer.resize(cols, rows);
    asciiPass.resize(cols, rows);
    asciiScene.resize(cols, rows);
  };

  // Support URL search params for automated testing and debug view captures
  const urlParams = new URLSearchParams(window.location.search);
  const viewParam = urlParams.get('view');
  if (viewParam === 'scene') {
    CONFIG.debug.showSceneBuffer = true;
  } else if (viewParam === 'material') {
    CONFIG.debug.showMaterialBuffer = true;
  }

  const rampParam = urlParams.get('ramp');
  if (rampParam !== null) {
    const rIdx = parseInt(rampParam, 10);
    if (!isNaN(rIdx) && rIdx >= 0 && rIdx < CONFIG.render.ramps.length) {
      CONFIG.render.activeRampIndex = rIdx;
    }
  }

  const densityParam = urlParams.get('density') as 'low' | 'medium' | 'high' | null;
  if (densityParam && CONFIG.display.densities[densityParam]) {
    setDensity(densityParam);
  }

  const zoomParam = Number.parseFloat(urlParams.get('zoom') ?? '');
  if (Number.isFinite(zoomParam) && zoomParam > 0) {
    testScene.adjustZoom(Math.log(zoomParam));
  }

  // 4. Initialize Input & Debug Hotkeys
  const input = new InputManager();

  // Mouse wheel zoom. Positive wheel delta zooms out, negative zooms in.
  canvas.addEventListener('wheel', (event) => {
    event.preventDefault();
    testScene.adjustZoom(-event.deltaY * 0.001);
  }, { passive: false });

  // F1: Toggle Raw Scene Buffer View
  input.registerDebugKey('F1', () => {
    CONFIG.debug.showSceneBuffer = !CONFIG.debug.showSceneBuffer;
    if (CONFIG.debug.showSceneBuffer) {
      CONFIG.debug.showMaterialBuffer = false;
    }
  });

  // F2: Toggle Material Buffer View
  input.registerDebugKey('F2', () => {
    CONFIG.debug.showMaterialBuffer = !CONFIG.debug.showMaterialBuffer;
    if (CONFIG.debug.showMaterialBuffer) {
      CONFIG.debug.showSceneBuffer = false;
    }
  });

  // F3: Toggle Stats Overlay
  input.registerDebugKey('F3', () => {
    CONFIG.debug.showStats = !CONFIG.debug.showStats;
  });

  // F4: Cycle Glyph Ramps
  input.registerDebugKey('F4', () => {
    CONFIG.render.activeRampIndex =
      (CONFIG.render.activeRampIndex + 1) % CONFIG.render.ramps.length;
  });

  // F11: Fullscreen Toggle
  input.registerDebugKey('F11', () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  });

  // Number keys 1, 2, 3 for rapid density testing
  input.registerDebugKey('Digit1', () => setDensity('low'));
  input.registerDebugKey('Digit2', () => setDensity('medium'));
  input.registerDebugKey('Digit3', () => setDensity('high'));

  // Camera zoom controls.
  input.registerDebugKey('Equal', () => testScene.adjustZoom(0.08));
  input.registerDebugKey('NumpadAdd', () => testScene.adjustZoom(0.08));
  input.registerDebugKey('Minus', () => testScene.adjustZoom(-0.08));
  input.registerDebugKey('NumpadSubtract', () => testScene.adjustZoom(-0.08));
  input.registerDebugKey('Digit0', () => testScene.resetZoom());

  // 5. Game Loop
  let accumulatedTime = 0;
  let logTimer = 0;

  const loop = new GameLoop({
    update: (dt: number) => {
      accumulatedTime += dt;
      logTimer += dt;
      if (logTimer >= 1.0) {
        console.log(`[PERF] FPS: ${loop.stats.fps} | Render: ${loop.stats.renderTimeMs.toFixed(2)}ms | Frame: ${loop.stats.frameTimeMs.toFixed(2)}ms`);
        logTimer = 0;
      }

      // Update player movement from WASD or arrow keys
      let moveX = 0;
      let moveY = 0;
      if (input.isKeyDown('KeyW') || input.isKeyDown('ArrowUp')) moveY -= 1;
      if (input.isKeyDown('KeyS') || input.isKeyDown('ArrowDown')) moveY += 1;
      if (input.isKeyDown('KeyA') || input.isKeyDown('ArrowLeft')) moveX -= 1;
      if (input.isKeyDown('KeyD') || input.isKeyDown('ArrowRight')) moveX += 1;

      if (moveX !== 0 && moveY !== 0) {
        moveX *= 0.7071;
        moveY *= 0.7071;
      }

      testScene.update(dt, moveX, moveY);
      input.endFrame();
    },
    render: (_interpolation: number) => {
      // Step A: Render the hidden low-res scene buffer
      testScene.render(sceneBuffer, accumulatedTime);

      // Step B: Debug view routing or full ASCII pass
      if (CONFIG.debug.showSceneBuffer) {
        // F1 View: Scaled raw scene buffer
        ctx.drawImage(sceneBuffer.canvas, 0, 0, canvas.width, canvas.height);
      } else if (CONFIG.debug.showMaterialBuffer) {
        // F2 View: Scaled material ID buffer
        sceneBuffer.updateDebugMaterialView();
        ctx.drawImage(sceneBuffer.debugMaterialCanvas, 0, 0, canvas.width, canvas.height);
      } else {
        // Visible View: Direct character-grid renderer. The hidden scene
        // buffer remains available for F1/F2 debugging, but final gameplay
        // art is authored as readable ASCII rather than pixel noise.
        asciiScene.render(ctx, testScene.player, accumulatedTime, testScene.getZoom(), testScene.lanternOn);
      }

      // Step C: Render in-game floating text & action hotbar
      testScene.renderUI(ctx, asciiPass, cols, rows, canvas.width, canvas.height);

      // Step D: Render telemetry HUD
      debugOverlay.render(ctx, loop.stats, cols, rows, canvas.width, canvas.height);
    },
  }, CONFIG.display.targetFps);

  loop.start();
}

window.addEventListener('DOMContentLoaded', () => {
  const mode = new URLSearchParams(window.location.search).get('mode');
  if (mode === 'game') bootstrap();
  // The isometric glyph game is the default; ?view=top keeps the old top-down view.
  else startRiverScene();
});
