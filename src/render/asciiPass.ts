// ============================================================================
// ASCII Pass — Code-Matrix Luminance Engine
// Recreates the high-density alphanumeric code matrix aesthetic from the
// reference video ("Making the ASCII MMORPG of my dreams").
// Shaded by 3D lighting, cliff contours, material properties, and directional edges.
// ============================================================================

import { CONFIG } from '../config.ts';
import { Material, MATERIAL_DEFS, Surface } from '../game/materials.ts';
import { GlyphAtlas, quantizeRGB } from './glyphAtlas.ts';
import { SceneBuffer } from './sceneBuffer.ts';

export class AsciiPass {
  public cols: number;
  public rows: number;
  public atlas: GlyphAtlas;

  // Working typed buffers
  private cellGeomLum: Uint8Array;
  private cellLitLum: Uint8Array;
  private cellR: Uint8Array;
  private cellG: Uint8Array;
  private cellB: Uint8Array;
  private cellMat: Uint8Array;
  private cellSurface: Uint8Array;
  private outputImageData: ImageData | null = null;
  private outputPixels: Uint32Array = new Uint32Array(0);

  // Cached directional glyph IDs
  private glyphHoriz: number;
  private glyphVert: number;
  private glyphDiagUp: number;
  private glyphDiagDown: number;

  // Cached material glyph IDs (material -> number[])
  private materialGlyphIds: Record<number, number[]>;

  constructor(cols: number, rows: number, atlas: GlyphAtlas) {
    this.cols = cols;
    this.rows = rows;
    this.atlas = atlas;

    const totalCells = cols * rows;
    this.cellGeomLum = new Uint8Array(totalCells);
    this.cellLitLum = new Uint8Array(totalCells);
    this.cellR = new Uint8Array(totalCells);
    this.cellG = new Uint8Array(totalCells);
    this.cellB = new Uint8Array(totalCells);
    this.cellMat = new Uint8Array(totalCells);
    this.cellSurface = new Uint8Array(totalCells);

    // Pre-cache directional glyph indices
    this.glyphHoriz = atlas.getGlyphIndex(CONFIG.render.directionalGlyphs.horizontal);
    this.glyphVert = atlas.getGlyphIndex(CONFIG.render.directionalGlyphs.vertical);
    this.glyphDiagUp = atlas.getGlyphIndex(CONFIG.render.directionalGlyphs.diagonalUpRight);
    this.glyphDiagDown = atlas.getGlyphIndex(CONFIG.render.directionalGlyphs.diagonalUpLeft);

    // Pre-cache material glyph indices
    this.materialGlyphIds = {};
    for (const [matIdStr, def] of Object.entries(MATERIAL_DEFS)) {
      const matId = Number(matIdStr);
      this.materialGlyphIds[matId] = def.glyphs.map((g) => atlas.getGlyphIndex(g));
    }
  }

  public resize(cols: number, rows: number): void {
    this.cols = cols;
    this.rows = rows;
    const totalCells = cols * rows;
    this.cellGeomLum = new Uint8Array(totalCells);
    this.cellLitLum = new Uint8Array(totalCells);
    this.cellR = new Uint8Array(totalCells);
    this.cellG = new Uint8Array(totalCells);
    this.cellB = new Uint8Array(totalCells);
    this.cellMat = new Uint8Array(totalCells);
    this.cellSurface = new Uint8Array(totalCells);
  }

  /**
   * Main execution pass: samples scene buffer and blits ASCII glyphs to main canvas
   */
  public render(
    sceneBuffer: SceneBuffer,
    destCtx: CanvasRenderingContext2D,
    gameTime: number
  ): void {
    const cols = this.cols;
    const rows = this.rows;
    const sceneWidth = sceneBuffer.width;
    const sceneHeight = sceneBuffer.height;
    const stepX = sceneWidth / cols;
    const stepY = sceneHeight / rows;

    // 1. Extract raw image data from scene canvas (lit), geometry canvas (unlit), and material canvas
    const litData = sceneBuffer.ctx.getImageData(0, 0, sceneWidth, sceneHeight).data;
    const geomData = sceneBuffer.geometryCtx.getImageData(0, 0, sceneWidth, sceneHeight).data;
    const matData = sceneBuffer.materialCtx.getImageData(0, 0, sceneWidth, sceneHeight).data;

    // 2. Downsample complete buffer regions. Broad stone and foliage faces
    // survive averaging while thin silhouette edges remain available to Sobel.
    for (let cy = 0; cy < rows; cy++) {
      const cellRowOffset = cy * cols;
      const py0 = Math.floor(cy * stepY);
      const py1 = Math.max(py0, Math.min(sceneHeight - 1, Math.ceil((cy + 1) * stepY) - 1));

      for (let cx = 0; cx < cols; cx++) {
        const px0 = Math.floor(cx * stepX);
        const px1 = Math.max(px0, Math.min(sceneWidth - 1, Math.ceil((cx + 1) * stepX) - 1));
        let rSum = 0;
        let gSum = 0;
        let bSum = 0;
        let grSum = 0;
        let ggSum = 0;
        let gbSum = 0;
        let sampleCount = 0;

        for (let py = py0; py <= py1; py++) {
          const rowOffset = py * sceneWidth;
          for (let px = px0; px <= px1; px++) {
            const i = (rowOffset + px) * 4;
            rSum += litData[i];
            gSum += litData[i + 1];
            bSum += litData[i + 2];
            grSum += geomData[i];
            ggSum += geomData[i + 1];
            gbSum += geomData[i + 2];
            sampleCount++;
          }
        }

        const r = (rSum / sampleCount) | 0;
        const g = (gSum / sampleCount) | 0;
        const b = (bSum / sampleCount) | 0;
        const litLum = (r * 77 + g * 150 + b * 29) >> 8;
        const gr = (grSum / sampleCount) | 0;
        const gg = (ggSum / sampleCount) | 0;
        const gb = (gbSum / sampleCount) | 0;
        const geomLum = (gr * 77 + gg * 150 + gb * 29) >> 8;

        const centerX = (px0 + px1) >> 1;
        const centerY = (py0 + py1) >> 1;
        const matIndex = (centerY * sceneWidth + centerX) * 4;
        const mat = matData[matIndex] || Material.NONE;
        const surface = matData[matIndex + 1] || Surface.FLAT;

        const cellIdx = cellRowOffset + cx;
        this.cellR[cellIdx] = r;
        this.cellG[cellIdx] = g;
        this.cellB[cellIdx] = b;
        this.cellLitLum[cellIdx] = litLum;
        this.cellGeomLum[cellIdx] = geomLum;
        this.cellMat[cellIdx] = mat;
        this.cellSurface[cellIdx] = surface;
      }
    }

    // 3. Sobel Edge Detection + Code-Matrix Luminance Blitting
    const edgeThreshold = CONFIG.render.edgeThreshold;
    const satBoost = CONFIG.render.saturationBoost;
    const briBoost = CONFIG.render.brightnessBoost;

    const cw = this.atlas.cellWidth;
    const ch = this.atlas.cellHeight;
    const outputWidth = destCtx.canvas.width;
    const outputHeight = destCtx.canvas.height;
    if (!this.outputImageData || this.outputImageData.width !== outputWidth || this.outputImageData.height !== outputHeight) {
      this.outputImageData = destCtx.createImageData(outputWidth, outputHeight);
      this.outputPixels = new Uint32Array(this.outputImageData.data.buffer);
    }
    const outputPixels = this.outputPixels;

    const cellGeomLum = this.cellGeomLum;
    const cellLitLum = this.cellLitLum;
    const cellR = this.cellR;
    const cellG = this.cellG;
    const cellB = this.cellB;
    const cellMat = this.cellMat;
    const cellSurface = this.cellSurface;

    const animTick = Math.floor(gameTime * 4);
    const fireTick = Math.floor(gameTime * 10);

    for (let cy = 0; cy < rows; cy++) {
      const rowThis = cy * cols;
      const rowAbove = (cy > 0 ? cy - 1 : 0) * cols;
      const rowBelow = (cy < rows - 1 ? cy + 1 : rows - 1) * cols;
      const destY = cy * ch;

      for (let cx = 0; cx < cols; cx++) {
        const cellIdx = rowThis + cx;
        const litLum = cellLitLum[cellIdx];
        const mat = cellMat[cellIdx];
        const surface = cellSurface[cellIdx];
        const r = cellR[cellIdx];
        const g = cellG[cellIdx];
        const b = cellB[cellIdx];

        // 3a. Sobel Kernel on Physical Geometry Luminance
        const xLeft = cx > 0 ? cx - 1 : 0;
        const xRight = cx < cols - 1 ? cx + 1 : cols - 1;

        const l00 = cellGeomLum[rowAbove + xLeft];
        const l10 = cellGeomLum[rowAbove + cx];
        const l20 = cellGeomLum[rowAbove + xRight];

        const l01 = cellGeomLum[rowThis + xLeft];
        const l21 = cellGeomLum[rowThis + xRight];

        const l02 = cellGeomLum[rowBelow + xLeft];
        const l12 = cellGeomLum[rowBelow + cx];
        const l22 = cellGeomLum[rowBelow + xRight];

        const gx = (l20 + (l21 << 1) + l22) - (l00 + (l01 << 1) + l02);
        const gy = (l02 + (l12 << 1) + l22) - (l00 + (l10 << 1) + l20);
        const absGx = Math.abs(gx);
        const absGy = Math.abs(gy);
        const edgeMag = absGx + absGy;

        let glyphId = 0;
        let isEdge = false;

        const matDef = MATERIAL_DEFS[mat as Material];
        const allowEdge = !matDef || matDef.useEdgeOverride;
        const materialBoundary =
          cellMat[rowThis + xLeft] !== mat ||
          cellMat[rowThis + xRight] !== mat ||
          cellMat[rowAbove + cx] !== mat ||
          cellMat[rowBelow + cx] !== mat;
        const surfaceBoundary =
          cellSurface[rowThis + xLeft] !== surface ||
          cellSurface[rowThis + xRight] !== surface ||
          cellSurface[rowAbove + cx] !== surface ||
          cellSurface[rowBelow + cx] !== surface;
        const highContrastEdge = edgeMag > edgeThreshold * 1.8;

        // Only structural boundaries and strong contours become directional
        // glyphs. Internal texture stays in the material pass.
        if (allowEdge && litLum > 18 && edgeMag > edgeThreshold && (materialBoundary || surfaceBoundary || highContrastEdge)) {
          isEdge = true;
          if (absGx > (absGy << 1)) {
            glyphId = this.glyphVert;
          } else if (absGy > (absGx << 1)) {
            glyphId = this.glyphHoriz;
          } else if ((gx > 0 && gy > 0) || (gx < 0 && gy < 0)) {
            glyphId = this.glyphDiagUp;
          } else {
            glyphId = this.glyphDiagDown;
          }
        } else {
          const glyphs = this.materialGlyphIds[mat] ?? [];
          const textureHash = (cellIdx * 37 + mat * 71 + 17) & 0xffff;
          const firstVisible = glyphs.findIndex((glyph) => glyph !== 0);
          const visibleStart = firstVisible > 0 ? firstVisible : 0;
          const visibleLength = Math.max(1, glyphs.length - visibleStart);
          const shade = glyphs.length > 0
            ? visibleStart + Math.max(0, Math.min(visibleLength - 1, Math.floor((litLum * visibleLength) / 256)))
            : 0;

          if (mat === Material.GRASS) {
            // Sparse but genuinely visible blades, even in deep moonlight.
            if (litLum > 4 && textureHash % 6 === 0) {
              glyphId = glyphs[Math.min(glyphs.length - 1, 3 + Math.floor((litLum * 5) / 256))] ?? 0;
            }
          } else if (mat === Material.FOLIAGE) {
            // Clustered leaves remain visible in shadow instead of becoming void.
            if (litLum > 4 && textureHash % 4 < 2) {
              glyphId = glyphs[Math.min(glyphs.length - 1, 3 + Math.floor((litLum * 5) / 256))] ?? 0;
            }
          } else if (mat === Material.WATER) {
            const phase = (cx + animTick + (cy & 1)) % 9;
            glyphId = phase < 4 ? glyphs[Math.min(glyphs.length - 1, phase + 2)] : 0;
          } else if (mat === Material.SHOJI) {
            if (litLum > 35) {
              glyphId = textureHash % 7 === 0 ? this.atlas.getGlyphIndex('+') : (glyphs[shade] ?? 0);
            }
          } else if (mat === Material.FIRE || mat === Material.LANTERN || mat === Material.MOON) {
            const phase = (textureHash ^ fireTick) % glyphs.length;
            glyphId = glyphs[phase] ?? 0;
          } else if (mat === Material.TORII) {
            glyphId = surface === Surface.VERTICAL && textureHash % 3 === 0
              ? this.atlas.getGlyphIndex('║')
              : (glyphs[shade] ?? 0);
          } else if (glyphs.length > 0) {
            glyphId = glyphs[shade] ?? 0;
            // Sparse deterministic cracks break up broad stone and wood faces.
            if ((mat === Material.STONE || mat === Material.CLIFF) && litLum > 42 && textureHash % 29 === 0) {
              glyphId = this.atlas.getGlyphIndex(textureHash % 2 === 0 ? 'x' : '/');
            }
          } else if (litLum > 40) {
            const fallback = this.materialGlyphIds[Material.STONE];
            const index = Math.max(0, Math.min(4, Math.floor(litLum / 52)));
            glyphId = fallback[index] ?? 0;
          }
        }

        // 3c. Color Enhancement & Palette Quantization
        const maxC = Math.max(r, g, b);
        const minC = Math.min(r, g, b);
        let rB = r;
        let gB = g;
        let bB = b;
        const neighborAvg = (l00 + l10 + l20 + l01 + l21 + l02 + l12 + l22) >> 3;
        const centerGeomLum = cellGeomLum[cellIdx];
        const aoBoost = neighborAvg > centerGeomLum + 16 ? 0.82 : 1.0;
        const finalBoost = briBoost * aoBoost * (isEdge ? 1.08 : 1.0);

        if (maxC > minC && maxC > 12) {
          rB = Math.min(255, Math.max(0, Math.round((minC + (r - minC) * satBoost) * finalBoost)));
          gB = Math.min(255, Math.max(0, Math.round((minC + (g - minC) * satBoost) * finalBoost)));
          bB = Math.min(255, Math.max(0, Math.round((minC + (b - minC) * satBoost) * finalBoost)));
        } else {
          rB = Math.min(255, Math.round(r * finalBoost));
          gB = Math.min(255, Math.round(g * finalBoost));
          bB = Math.min(255, Math.round(b * finalBoost));
        }

        // Material-specific color floors keep dark foliage and water readable
        // after 64-color quantization without washing out the stone architecture.
        if (mat === Material.FOLIAGE) {
          rB = Math.max(rB, 18);
          gB = Math.max(gB, 72);
          bB = Math.max(bB, 48);
        } else if (mat === Material.GRASS) {
          rB = Math.max(rB, 10);
          gB = Math.max(gB, 38);
          bB = Math.max(bB, 26);
        } else if (mat === Material.WATER) {
          rB = Math.max(rB, 12);
          gB = Math.max(gB, 48);
          bB = Math.max(bB, 82);
        }

        const colorIdx = quantizeRGB(rB, gB, bB);

        // 3d. Copy the glyph cell into the CPU framebuffer.
        this.atlas.blitToPixelBuffer(outputPixels, outputWidth, glyphId, colorIdx, cx * cw, destY);
      }
    }

    // One upload instead of one drawImage call per character cell.
    destCtx.putImageData(this.outputImageData!, 0, 0);
  }

  /**
   * Render floating in-game text (Player nameplate, Enemy health bars, "Stairs" label)
   */
  public drawFloatingText(
    destCtx: CanvasRenderingContext2D,
    text: string,
    cellX: number,
    cellY: number,
    colorCss: string,
    bgCss = 'rgba(2, 4, 8, 0.85)'
  ): void {
    const cw = this.atlas.cellWidth;
    const ch = this.atlas.cellHeight;
    const x = Math.round(cellX * cw);
    const y = Math.round(cellY * ch);

    destCtx.save();
    destCtx.font = `bold 11px ${CONFIG.display.fontFamily}`;
    destCtx.textBaseline = 'middle';
    destCtx.textAlign = 'center';

    const textMetrics = destCtx.measureText(text);
    const pad = 4;
    destCtx.fillStyle = bgCss;
    destCtx.fillRect(
      x - textMetrics.width / 2 - pad,
      y - 7,
      textMetrics.width + pad * 2,
      14
    );

    destCtx.fillStyle = colorCss;
    destCtx.fillText(text, x, y);
    destCtx.restore();
  }

  /**
   * Foreground atmospheric rain and mist particles
   */
  public renderAtmosphere(destCtx: CanvasRenderingContext2D, gameTime: number): void {
    const drops = CONFIG.atmosphere.rainDrops;
    const fall = Math.floor(gameTime * 24);
    const wind = Math.floor(gameTime * 3);
    const cw = this.atlas.cellWidth;
    const ch = this.atlas.cellHeight;

    for (let i = 0; i < drops; i++) {
      const x = (i * 97 + wind + (i % 5) * 11) % this.cols;
      const y = (i * 53 + fall + (i % 7) * 9) % this.rows;
      const glyphId = i % 4 === 0 ? this.glyphVert : this.glyphDiagUp;
      const shade = 45 + (i % 4) * 12;
      const colorIdx = quantizeRGB(shade, shade + 25, shade + 55);
      this.atlas.blit(destCtx, glyphId, colorIdx, x * cw, y * ch);
    }
  }
}
