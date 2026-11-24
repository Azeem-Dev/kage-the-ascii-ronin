// ============================================================================
// ASCII Pass — Stage 2 of the Rendering Pipeline
// Samples scene & material buffer, performs Sobel edge detection on geometry,
// applies material overrides, and blits pre-rendered glyphs from the atlas.
// Geometry-driven Sobel prevents artificial concentric rings around lights.
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
  private cellGeomLum: Uint8Array; // Physical geometry luminance for Sobel
  private cellLitLum: Uint8Array;  // Final lit luminance for density ramps
  private cellR: Uint8Array;
  private cellG: Uint8Array;
  private cellB: Uint8Array;
  private cellMat: Uint8Array;
  private cellSurface: Uint8Array;

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

    // 2. Downsample each complete scene-buffer region into one character cell.
    // Averaging the whole region (rather than two arbitrary pixels) preserves
    // broad faces and stops fine geometry from turning into aliased noise.
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

        // Sample material and surface orientation from the cell center. Edge
        // cells are still represented by the geometry-driven Sobel pass.
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

        // Gradient X and Y
        const gx = (l20 + (l21 << 1) + l22) - (l00 + (l01 << 1) + l02);
        const gy = (l02 + (l12 << 1) + l22) - (l00 + (l10 << 1) + l20);
        const absGx = Math.abs(gx);
        const absGy = Math.abs(gy);
        const edgeMag = absGx + absGy;

        let glyphId = 0;
        let isEdge = false;

        // Check if edge is strong enough to override. Internal texture lines
        // (shoji frames, tile courses, mortar) stay in the material pattern;
        // only material/face boundaries or very high-contrast contours become
        // structural ASCII edges.
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
        const highContrastEdge = edgeMag > edgeThreshold * 1.75;

        if (allowEdge && edgeMag > edgeThreshold && (materialBoundary || surfaceBoundary || highContrastEdge)) {
          isEdge = true;
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
              // Sparse, low-contrast blades keep the lawn from visually
              // competing with the solid architecture.
              const hash = (cx * 13 + cy * 29) % 12;
              glyphId = hash === 0 ? matGlyphs[0] : (hash === 1 ? matGlyphs[1] : 0);
              break;
            }
            case Material.STONE: {
              if (surface === Surface.VERTICAL) {
                // Solid retaining walls with subtle mortar and face shading.
                const seam = (cx + cy * 2) % 7 === 0;
                const shade = litLum > 95 ? 3 : (litLum > 45 ? 4 : 5);
                glyphId = seam ? matGlyphs[2] : matGlyphs[shade];
              } else {
                const shade = litLum > 120 ? 3 : (litLum > 55 ? 4 : 5);
                const hash = (cx * 7 + cy * 11) % 13;
                glyphId = hash === 0 ? matGlyphs[1] : matGlyphs[shade];
              }
              break;
            }
            case Material.ROOF_TILES: {
              const shade = litLum > 145 ? 0 : (litLum > 85 ? 1 : (litLum > 35 ? 2 : 3));
              if (surface === Surface.SLOPE_LEFT || surface === Surface.SLOPE_RIGHT) {
                // Broad tile planes use solid density shading; sparse diagonal
                // courses describe the roof pitch without visual static.
                const slopeGlyph = surface === Surface.SLOPE_LEFT ? matGlyphs[4] : matGlyphs[5];
                const course = (cx + cy * 2 + (surface === Surface.SLOPE_LEFT ? 0 : 1)) % 5;
                glyphId = course === 0 ? slopeGlyph : matGlyphs[shade];
              } else {
                glyphId = (cy % 4 === 0) ? matGlyphs[4] : matGlyphs[shade];
              }
              break;
            }
            case Material.FOLIAGE: {
              const hash = (cx * 11 + cy * 17 + (litLum >> 4)) & 7;
              glyphId = hash < 2 ? matGlyphs[hash] : (hash === 2 ? matGlyphs[2] : 0);
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
              // Large, quiet shoji panels. A sparse lattice reads as paper
              // screens without turning every lit wall into visual static.
              if ((cx % 5) === 0 && (cy % 4) === 0) {
                glyphId = this.atlas.getGlyphIndex('+');
              } else if ((cx % 5) === 0) {
                glyphId = this.glyphVert;
              } else if ((cy % 4) === 0) {
                glyphId = this.glyphHoriz;
              } else {
                glyphId = litLum > 150 ? matGlyphs[4] : matGlyphs[5];
              }
              break;
            }
            case Material.WOOD: {
              if (surface === Surface.VERTICAL || surface === Surface.CYLINDER) {
                // Vertical timber faces use solid shading and sparse grain.
                const seam = (cx * 7 + cy * 3) % 11 === 0;
                const shade = litLum > 105 ? 3 : (litLum > 45 ? 4 : 5);
                glyphId = seam ? matGlyphs[2] : matGlyphs[shade];
              } else if (surface === Surface.HORIZONTAL || surface === Surface.SLOPE_LEFT || surface === Surface.SLOPE_RIGHT) {
                const shade = litLum > 105 ? 3 : (litLum > 45 ? 4 : 5);
                glyphId = (cy % 3 === 0) ? matGlyphs[0] : matGlyphs[shade];
              } else {
                const idx = (cy & 1) ? 0 : 1;
                glyphId = matGlyphs[idx % matGlyphs.length];
              }
              break;
            }
            case Material.TORII: {
              if (surface === Surface.VERTICAL || surface === Surface.CYLINDER) {
                glyphId = (cx & 1) === 0 ? matGlyphs[0] : matGlyphs[4];
              } else if (surface === Surface.HORIZONTAL) {
                glyphId = (cy & 1) === 0 ? matGlyphs[1] : matGlyphs[2];
              } else {
                glyphId = matGlyphs[(cx + cy) % 4];
              }
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

        // Brighten silhouettes and darken concave contact areas. This makes
        // extruded faces read as volumes instead of evenly lit textures.
        const neighborAvg = (l00 + l10 + l20 + l01 + l21 + l02 + l12 + l22) >> 3;
        const centerGeomLum = cellGeomLum[cellIdx];
        const aoBoost = neighborAvg > centerGeomLum + 14 ? 0.80 : 1.0;
        const edgeBoost = isEdge ? 1.20 : 1.0;
        const finalBoost = briBoost * aoBoost * edgeBoost;

        if (maxC > minC && maxC > 12) {
          rB = Math.min(255, Math.max(0, Math.round((minC + (r - minC) * satBoost) * finalBoost)));
          gB = Math.min(255, Math.max(0, Math.round((minC + (g - minC) * satBoost) * finalBoost)));
          bB = Math.min(255, Math.max(0, Math.round((minC + (b - minC) * satBoost) * finalBoost)));
        } else {
          rB = Math.min(255, Math.round(r * finalBoost));
          gB = Math.min(255, Math.round(g * finalBoost));
          bB = Math.min(255, Math.round(b * finalBoost));
        }

        const colorIdx = quantizeRGB(rB, gB, bB);

        // 3e. Blit from pre-rendered atlas
        this.atlas.blit(destCtx, glyphId, colorIdx, cx * cw, destY);
      }
    }
  }
}
