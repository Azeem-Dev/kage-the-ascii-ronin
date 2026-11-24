// ============================================================================
// Debug Overlay & Telemetry HUD
// Renders ASCII-style diagnostic information and hotkey shortcuts
// ============================================================================

import { CONFIG } from '../config.ts';
import { LoopStats } from '../engine/loop.ts';

export class DebugOverlay {
  public render(
    ctx: CanvasRenderingContext2D,
    stats: LoopStats,
    cols: number,
    rows: number,
    _canvasW: number,
    _canvasH: number
  ): void {
    if (!CONFIG.debug.showStats) return;

    const densityKey = Object.entries(CONFIG.display.densities).find(
      ([, v]) => v.cols === cols && v.rows === rows
    )?.[0] ?? 'custom';

    const activeRamp = CONFIG.render.ramps[CONFIG.render.activeRampIndex];

    const lines: string[] = [
      '╔═[ KAGE ASCII ENGINE — TELEMETRY ]═════════════════════════════════╗',
      `║ FPS: ${String(stats.fps).padStart(3)} | Frame: ${stats.frameTimeMs.toFixed(1)}ms | Render: ${stats.renderTimeMs.toFixed(1)}ms          ║`,
      `║ Grid: ${densityKey.toUpperCase()} (${cols}x${rows}) | Cells: ${(cols * rows).toLocaleString()} | Scale: ${CONFIG.render.bufferScale}x   ║`,
      `║ Ramp [F4]: ${activeRamp.name.padEnd(20)} [${activeRamp.chars.substring(0, 10)}...] ║`,
      `║ F1: Scene Buffer [${CONFIG.debug.showSceneBuffer ? 'ON ' : 'OFF'}] | F2: Material Buffer [${CONFIG.debug.showMaterialBuffer ? 'ON ' : 'OFF'}]         ║`,
      `║ Keys: [1] Low [2] Med [3] High | F3: Toggle HUD                   ║`,
      '╚═══════════════════════════════════════════════════════════════════╝',
    ];

    ctx.save();
    ctx.font = '12px "Cascadia Code", "Fira Code", monospace';
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';

    const boxX = 16;
    const boxY = 16;
    const lineHeight = 16;
    const boxW = 560;
    const boxH = lines.length * lineHeight + 12;

    // Semi-transparent dark background backing
    ctx.fillStyle = 'rgba(2, 5, 10, 0.88)';
    ctx.fillRect(boxX - 4, boxY - 4, boxW, boxH);
    ctx.strokeStyle = '#2d5a7b';
    ctx.lineWidth = 1;
    ctx.strokeRect(boxX - 4, boxY - 4, boxW, boxH);

    // Glowing cyan/amber terminal text
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (i === 0 || i === lines.length - 1) {
        ctx.fillStyle = '#4aa3df';
      } else if (line.includes('FPS')) {
        ctx.fillStyle = stats.fps >= 55 ? '#64dd17' : '#ffd600';
      } else if (line.includes('Keys:')) {
        ctx.fillStyle = '#e67e22';
      } else {
        ctx.fillStyle = '#b0bec5';
      }
      ctx.fillText(line, boxX, boxY + i * lineHeight);
    }

    ctx.restore();
  }
}
