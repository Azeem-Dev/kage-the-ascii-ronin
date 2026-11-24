// ============================================================================
// ASCII Pass — Stage 2 of the Rendering Pipeline
// Samples scene & material buffer, performs Sobel edge detection on geometry,
// applies material overrides, and blits pre-rendered glyphs from the atlas.
// Geometry-driven Sobel prevents artificial concentric rings around lights.
// ============================================================================

import { CONFIG } from '../config.ts';
import { Material, MATERIAL_DEFS } from '../game/materials.ts';
import { GlyphAtlas, quantizeRGB } from './glyphAtlas.ts';
import { SceneBuffer } from './sceneBuffer.ts';

export class AsciiPass {
  public cols: number;
  public rows: number;
  public atlas: GlyphAtlas;

  // Working typed buffers
  private cellGeomLum: Uint8Array; // Physical geometry luminance for Sobel
  private cellLitLum: Uint8Array;  // Final lit luminance for density ramps
  private cellR: Uint8Array;
  private cellG: Uint8Array;
  private cellB: Uint8Array;
  private cellMat: Uint8Array;

  // Cached directional glyph IDs
  private glyphHoriz: number;
  private glyphVert: number;
  private glyphDiagUp: number;
  private glyphDiagDown: number;

  // Cached material glyph IDs (material -> number[])
  private materialGlyphIds: Record<number, number[]>;

  // Cached ramp glyph IDs for all available ramps
  private rampGlyphIds: number[][];

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

    // Pre-cache ramp glyph indices
    this.rampGlyphIds = CONFIG.render.ramps.map((ramp) =>
      Array.from(ramp.chars).map((ch) => atlas.getGlyphIndex(ch))
    );
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

    // 2. Downsample buffer into grid cells
    for (let cy = 0; cy < rows; cy++) {
      const cellRowOffset = cy * cols;
      const py0 = Math.floor(cy * stepY);
      const py1 = Math.min(sceneHeight - 1, py0 + 1);

      for (let cx = 0; cx < cols; cx++) {
        const px0 = Math.floor(cx * stepX);
        const px1 = Math.min(sceneWidth - 1, px0 + 1);

        // Sample 2x2 patch from lit scene canvas
        const i00 = (py0 * sceneWidth + px0) * 4;
        const i10 = (py0 * sceneWidth + px1) * 4;
        const i01 = (py1 * sceneWidth + px0) * 4;
        const i11 = (py1 * sceneWidth + px1) * 4;

        const r = (litData[i00] + litData[i10] + litData[i01] + litData[i11]) >> 2;
        const g = (litData[i00 + 1] + litData[i10 + 1] + litData[i01 + 1] + litData[i11 + 1]) >> 2;
        const b = (litData[i00 + 2] + litData[i10 + 2] + litData[i01 + 2] + litData[i11 + 2]) >> 2;
        const litLum = (r * 77 + g * 150 + b * 29) >> 8;

        // Sample 2x2 patch from unlit geometry canvas for Sobel
        const gr = (geomData[i00] + geomData[i10] + geomData[i01] + geomData[i11]) >> 2;
        const gg = (geomData[i00 + 1] + geomData[i10 + 1] + geomData[i01 + 1] + geomData[i11 + 1]) >> 2;
        const gb = (geomData[i00 + 2] + geomData[i10 + 2] + geomData[i01 + 2] + geomData[i11 + 2]) >> 2;
        const geomLum = (gr * 77 + gg * 150 + gb * 29) >> 8;

        // Sample material ID from hardware-rasterized red channel
        const mat = matData[i00] || matData[i10] || matData[i01] || matData[i11] || Material.NONE;

        const cellIdx = cellRowOffset + cx;
        this.cellR[cellIdx] = r;
        this.cellG[cellIdx] = g;
        this.cellB[cellIdx] = b;
        this.cellLitLum[cellIdx] = litLum;
        this.cellGeomLum[cellIdx] = geomLum;
        this.cellMat[cellIdx] = mat;
      }
    }

    // 3. Sobel Edge Detection + Material Overrides + Atlas Blitting
    const edgeThreshold = CONFIG.render.edgeThreshold;
    const satBoost = CONFIG.render.saturationBoost;
    const briBoost = CONFIG.render.brightnessBoost;
    const activeRamp = this.rampGlyphIds[CONFIG.render.activeRampIndex];
    const rampLen = activeRamp.length;

    const cw = this.atlas.cellWidth;
    const ch = this.atlas.cellHeight;

    const cellGeomLum = this.cellGeomLum;
    const cellLitLum = this.cellLitLum;
    const cellR = this.cellR;
    const cellG = this.cellG;
    const cellB = this.cellB;
    const cellMat = this.cellMat;

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

        // Gradient X and Y
        const gx = (l20 + (l21 << 1) + l22) - (l00 + (l01 << 1) + l02);
        const gy = (l02 + (l12 << 1) + l22) - (l00 + (l10 << 1) + l20);
        const absGx = Math.abs(gx);
        const absGy = Math.abs(gy);
        const edgeMag = absGx + absGy;

        let glyphId = 0;

        // Check if edge is strong enough to override
        const matDef = MATERIAL_DEFS[mat as Material];
        const allowEdge = !matDef || matDef.useEdgeOverride;

        if (allowEdge && edgeMag > edgeThreshold) {
          if (absGx > (absGy << 1)) {
            // Dominant horizontal gradient -> Vertical contour line
            glyphId = this.glyphVert;
          } else if (absGy > (absGx << 1)) {
            // Dominant vertical gradient -> Horizontal contour line
            glyphId = this.glyphHoriz;
          } else {
            // Diagonal contour lines
            if ((gx > 0 && gy > 0) || (gx < 0 && gy < 0)) {
              glyphId = this.glyphDiagUp; // '/'
            } else {
              glyphId = this.glyphDiagDown; // '\'
            }
          }
        } else if (mat !== Material.NONE && this.materialGlyphIds[mat]?.length) {
          // 3b. Material Glyphs Override
          const matGlyphs = this.materialGlyphIds[mat];
          switch (mat) {
            case Material.GRASS: {
              // Elegant sparse lawn: ~25% of cells show grass blades, rest are clean open turf
              const hash = (cx * 13 + cy * 29) % 8;
              glyphId = hash === 0 ? matGlyphs[0] : (hash === 1 ? matGlyphs[1] : (hash === 2 ? matGlyphs[2] : 0));
              break;
            }
            case Material.ROOF_TILES: {
              // Horizontal stepped ceramic tile courses
              const course = cy % 3;
              glyphId = course === 0 ? matGlyphs[0] : (course === 1 ? matGlyphs[1] : matGlyphs[2]);
              break;
            }
            case Material.FOLIAGE: {
              const hash = (cx * 11 + cy * 17 + (litLum >> 4)) & 3;
              glyphId = matGlyphs[hash];
              break;
            }
            case Material.WATER: {
              // Calm reflective water with occasional drifting ripples
              const phase = (cx + animTick + (cy & 1)) % 6;
              glyphId = phase === 0 ? matGlyphs[0] : (phase === 1 ? matGlyphs[1] : 0);
              break;
            }
            case Material.FIRE:
            case Material.LANTERN: {
              const phase = (cx ^ cy ^ fireTick) & 3;
              glyphId = matGlyphs[phase];
              break;
            }
            case Material.SHOJI: {
              // Shoji paper screen lattice pattern
              if ((cx & 1) === 0 && (cy & 1) === 0) {
                glyphId = this.atlas.getGlyphIndex('+');
              } else if ((cx & 1) === 0) {
                glyphId = this.glyphVert;
              } else if ((cy & 1) === 0) {
                glyphId = this.glyphHoriz;
              } else {
                glyphId = this.atlas.getGlyphIndex('#');
              }
              break;
            }
            case Material.WOOD: {
              const idx = (cy & 1) ? 0 : 1;
              glyphId = matGlyphs[idx % matGlyphs.length];
              break;
            }
            case Material.TORII: {
              // Heavy Torii pillars & crossbeams
              glyphId = matGlyphs[(cx + cy) % matGlyphs.length];
              break;
            }
            default: {
              const idx = (cx + cy) % matGlyphs.length;
              glyphId = matGlyphs[idx];
              break;
            }
          }
        } else {
          // 3c. Luminance Density Ramp Fallback using lit luminance
          const rampIdx = Math.min(rampLen - 1, (litLum * rampLen) >> 8);
          glyphId = activeRamp[rampIdx];
        }

        // 3d. Color Enhancement & Palette Quantization
        const maxC = Math.max(r, g, b);
        const minC = Math.min(r, g, b);
        let rB = r;
        let gB = g;
        let bB = b;

        if (maxC > minC && maxC > 12) {
          rB = Math.min(255, Math.max(0, Math.round((minC + (r - minC) * satBoost) * briBoost)));
          gB = Math.min(255, Math.max(0, Math.round((minC + (g - minC) * satBoost) * briBoost)));
          bB = Math.min(255, Math.max(0, Math.round((minC + (b - minC) * satBoost) * briBoost)));
        } else {
          rB = Math.min(255, Math.round(r * briBoost));
          gB = Math.min(255, Math.round(g * briBoost));
          bB = Math.min(255, Math.round(b * briBoost));
        }

        const colorIdx = quantizeRGB(rB, gB, bB);

        // 3e. Blit from pre-rendered atlas
        this.atlas.blit(destCtx, glyphId, colorIdx, cx * cw, destY);
      }
    }
  }
}
