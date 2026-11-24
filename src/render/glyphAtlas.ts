// ============================================================================
// Glyph Atlas & Quantized Color Palette Generator
// Pre-renders every glyph × 64 quantized colors onto an offscreen canvas
// Eliminates fillText from the render loop entirely for pure drawImage blitting
// ============================================================================

import { CONFIG } from '../config.ts';
import { MATERIAL_DEFS } from '../game/materials.ts';

// Precomputed 256-entry lookup table mapping 0..255 byte -> 0..3 palette channel index
const QUANT_LUT = new Uint8Array(256);
const PALETTE_LEVELS = CONFIG.render.paletteLevels; // [18, 75, 160, 255]

// Initialize the quantization LUT: nearest distance to palette levels
for (let v = 0; v < 256; v++) {
  let bestDist = 9999;
  let bestIdx = 0;
  for (let i = 0; i < PALETTE_LEVELS.length; i++) {
    const dist = Math.abs(v - PALETTE_LEVELS[i]);
    if (dist < bestDist) {
      bestDist = dist;
      bestIdx = i;
    }
  }
  QUANT_LUT[v] = bestIdx;
}

// Build color table: 64 colors (4x4x4)
export interface QuantizedColor {
  r: number;
  g: number;
  b: number;
  css: string;
  bgCss: string;
}

export const PALETTE_64: QuantizedColor[] = [];
for (let rIdx = 0; rIdx < 4; rIdx++) {
  for (let gIdx = 0; gIdx < 4; gIdx++) {
    for (let bIdx = 0; bIdx < 4; bIdx++) {
      const r = PALETTE_LEVELS[rIdx];
      const g = PALETTE_LEVELS[gIdx];
      const b = PALETTE_LEVELS[bIdx];
      // Glowing text color
      const css = `rgb(${r},${g},${b})`;
      // Faint CRT phosphor background tint
      const bgR = Math.round(4 + r * 0.12);
      const bgG = Math.round(6 + g * 0.12);
      const bgB = Math.round(10 + b * 0.12);
      const bgCss = `rgb(${bgR},${bgG},${bgB})`;
      PALETTE_64.push({ r, g, b, css, bgCss });
    }
  }
}

/**
 * Fast mapping of raw RGB to quantized 6-bit color index (0..63)
 */
export function quantizeRGB(r: number, g: number, b: number): number {
  const rIdx = QUANT_LUT[Math.min(255, Math.max(0, r))];
  const gIdx = QUANT_LUT[Math.min(255, Math.max(0, g))];
  const bIdx = QUANT_LUT[Math.min(255, Math.max(0, b))];
  return (rIdx << 4) | (gIdx << 2) | bIdx;
}

export class GlyphAtlas {
  public canvas: HTMLCanvasElement;
  public ctx: CanvasRenderingContext2D;
  public cellWidth: number;
  public cellHeight: number;
  public glyphList: string[];
  public glyphMap: Map<string, number>;
  public count: number;

  constructor(cellWidth = CONFIG.display.cellWidth, cellHeight = CONFIG.display.cellHeight) {
    this.cellWidth = cellWidth;
    this.cellHeight = cellHeight;
    this.glyphList = [];
    this.glyphMap = new Map();

    // 1. Gather all unique glyphs
    const glyphSet = new Set<string>();
    
    // Space must always be at index 0
    glyphSet.add(' ');

    // Add all ramp glyphs
    for (const ramp of CONFIG.render.ramps) {
      for (const char of ramp.chars) {
        glyphSet.add(char);
      }
    }

    // Add directional edge glyphs
    glyphSet.add(CONFIG.render.directionalGlyphs.horizontal);
    glyphSet.add(CONFIG.render.directionalGlyphs.vertical);
    glyphSet.add(CONFIG.render.directionalGlyphs.diagonalUpRight);
    glyphSet.add(CONFIG.render.directionalGlyphs.diagonalUpLeft);

    // Add material glyphs
    for (const def of Object.values(MATERIAL_DEFS)) {
      for (const char of def.glyphs) {
        glyphSet.add(char);
      }
    }

    // Add common UI & debug characters
    const commonChars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz!?:;,.-_+*#=/\\|()[]{}<>~`\'"^$@%&';
    for (const char of commonChars) {
      glyphSet.add(char);
    }

    // Build ordered list and lookup map
    this.glyphList = Array.from(glyphSet);
    this.count = this.glyphList.length;
    for (let i = 0; i < this.glyphList.length; i++) {
      this.glyphMap.set(this.glyphList[i], i);
    }

    // 2. Create offscreen canvas for the atlas
    // Width = numGlyphs * cellWidth, Height = 64 * cellHeight
    const atlasWidth = this.count * this.cellWidth;
    const atlasHeight = 64 * this.cellHeight;

    this.canvas = document.createElement('canvas');
    this.canvas.width = atlasWidth;
    this.canvas.height = atlasHeight;

    const ctx = this.canvas.getContext('2d', { alpha: false });
    if (!ctx) {
      throw new Error('Failed to get 2D context for GlyphAtlas');
    }
    this.ctx = ctx;

    this.renderAtlas();
  }

  private renderAtlas(): void {
    const ctx = this.ctx;
    const cw = this.cellWidth;
    const ch = this.cellHeight;
    const font = `${CONFIG.display.fontSize}px ${CONFIG.display.fontFamily}`;

    ctx.font = font;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.imageSmoothingEnabled = false;

    // Render every color (rows 0..63) and every glyph (cols 0..count-1)
    for (let cIdx = 0; cIdx < 64; cIdx++) {
      const color = PALETTE_64[cIdx];
      const y = cIdx * ch;

      for (let gIdx = 0; gIdx < this.count; gIdx++) {
        const char = this.glyphList[gIdx];
        const x = gIdx * cw;

        // Draw tinted background cell (gives subtle CRT grid phosphor feel)
        ctx.fillStyle = color.bgCss;
        ctx.fillRect(x, y, cw, ch);

        // Draw character if not space
        if (char !== ' ') {
          ctx.fillStyle = color.css;
          ctx.fillText(char, x + cw / 2, y + ch / 2 + 1);
        }
      }
    }
  }

  /**
   * Fast glyph index lookup (falls back to index 0 for space/unknown)
   */
  public getGlyphIndex(char: string): number {
    return this.glyphMap.get(char) ?? 0;
  }

  /**
   * Blit a pre-rendered glyph directly to the destination canvas
   */
  public blit(
    destCtx: CanvasRenderingContext2D,
    glyphIndex: number,
    colorIndex: number,
    dx: number,
    dy: number
  ): void {
    const sx = glyphIndex * this.cellWidth;
    const sy = colorIndex * this.cellHeight;
    destCtx.drawImage(
      this.canvas,
      sx,
      sy,
      this.cellWidth,
      this.cellHeight,
      dx,
      dy,
      this.cellWidth,
      this.cellHeight
    );
  }
}
