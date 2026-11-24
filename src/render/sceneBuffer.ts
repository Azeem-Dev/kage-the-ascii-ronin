// ============================================================================
// Scene Buffer & Material ID Buffer
// Provides separate Geometry & Light canvases for accurate 3D top-down rendering.
// Material marking uses exact rasterized geometry (no bounding box bleeds).
// ============================================================================

import { CONFIG } from '../config.ts';
import { Material, MATERIAL_DEFS } from '../game/materials.ts';

export class SceneBuffer {
  public cols: number;
  public rows: number;
  public scale: number;
  public width: number;
  public height: number;

  // Final composited scene canvas & context (sampled for color & luminance)
  public canvas: HTMLCanvasElement;
  public ctx: CanvasRenderingContext2D;

  // Unlit geometry canvas (sampled for clean Sobel physical edges)
  public geometryCanvas: HTMLCanvasElement;
  public geometryCtx: CanvasRenderingContext2D;

  // Dynamic 2D light map canvas
  public lightCanvas: HTMLCanvasElement;
  public lightCtx: CanvasRenderingContext2D;

  // Material ID typed buffer (1 byte per scene buffer pixel)
  public materials: Uint8Array;

  // Debug visual canvas for F2 material view
  public debugMaterialCanvas: HTMLCanvasElement;
  public debugMaterialCtx: CanvasRenderingContext2D;
  private debugImageData: ImageData;

  constructor(cols: number, rows: number, _scale = CONFIG.render.bufferScale) {
    this.cols = cols;
    this.rows = rows;
    this.scale = 2;
    this.width = CONFIG.render.sceneWidth;
    this.height = CONFIG.render.sceneHeight;

    // 1. Final Scene Canvas
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.width;
    this.canvas.height = this.height;
    const ctx = this.canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('Failed to get 2D context for SceneBuffer');
    this.ctx = ctx;
    this.ctx.imageSmoothingEnabled = false;

    // 2. Unlit Geometry Canvas
    this.geometryCanvas = document.createElement('canvas');
    this.geometryCanvas.width = this.width;
    this.geometryCanvas.height = this.height;
    const geomCtx = this.geometryCanvas.getContext('2d', { willReadFrequently: true });
    if (!geomCtx) throw new Error('Failed to get 2D context for GeometryCanvas');
    this.geometryCtx = geomCtx;
    this.geometryCtx.imageSmoothingEnabled = false;

    // 3. 2D Light Map Canvas
    this.lightCanvas = document.createElement('canvas');
    this.lightCanvas.width = this.width;
    this.lightCanvas.height = this.height;
    const lightCtx = this.lightCanvas.getContext('2d');
    if (!lightCtx) throw new Error('Failed to get 2D context for LightCanvas');
    this.lightCtx = lightCtx;
    this.lightCtx.imageSmoothingEnabled = false;

    // 4. Material buffer
    this.materials = new Uint8Array(this.width * this.height);

    // 5. Debug Material Canvas
    this.debugMaterialCanvas = document.createElement('canvas');
    this.debugMaterialCanvas.width = this.width;
    this.debugMaterialCanvas.height = this.height;
    const dbgCtx = this.debugMaterialCanvas.getContext('2d');
    if (!dbgCtx) throw new Error('Failed to get 2D context for debug material view');
    this.debugMaterialCtx = dbgCtx;
    this.debugImageData = this.debugMaterialCtx.createImageData(this.width, this.height);
  }

  public resize(cols: number, rows: number): void {
    this.cols = cols;
    this.rows = rows;
    this.width = CONFIG.render.sceneWidth;
    this.height = CONFIG.render.sceneHeight;

    this.canvas.width = this.width;
    this.canvas.height = this.height;
    this.ctx.imageSmoothingEnabled = false;

    this.geometryCanvas.width = this.width;
    this.geometryCanvas.height = this.height;
    this.geometryCtx.imageSmoothingEnabled = false;

    this.lightCanvas.width = this.width;
    this.lightCanvas.height = this.height;
    this.lightCtx.imageSmoothingEnabled = false;

    this.materials = new Uint8Array(this.width * this.height);

    this.debugMaterialCanvas.width = this.width;
    this.debugMaterialCanvas.height = this.height;
    this.debugImageData = this.debugMaterialCtx.createImageData(this.width, this.height);
  }

  /**
   * Reset buffers at the beginning of each frame
   * Uses balanced ambient moonlight so the world is visible while lanterns pop warmly
   */
  public clear(ambientGroundColor = '#0b1612', ambientLightColor = '#24344d'): void {
    // Clear geometry canvas with base ground color
    this.geometryCtx.fillStyle = ambientGroundColor;
    this.geometryCtx.fillRect(0, 0, this.width, this.height);

    // Clear light map with cool ambient moonlight
    this.lightCtx.fillStyle = ambientLightColor;
    this.lightCtx.fillRect(0, 0, this.width, this.height);

    // Default material is GRASS for the ground plane
    this.materials.fill(Material.GRASS);
  }

  /**
   * Mark an exact rectangular region with a material ID
   */
  public markMaterialRect(x: number, y: number, w: number, h: number, material: Material): void {
    const x0 = Math.max(0, Math.floor(x));
    const y0 = Math.max(0, Math.floor(y));
    const x1 = Math.min(this.width, Math.ceil(x + w));
    const y1 = Math.min(this.height, Math.ceil(y + h));

    for (let py = y0; py < y1; py++) {
      const rowOffset = py * this.width;
      for (let px = x0; px < x1; px++) {
        this.materials[rowOffset + px] = material;
      }
    }
  }

  /**
   * Mark an exact circular region with a material ID (rasterized)
   */
  public markMaterialCircle(cx: number, cy: number, radius: number, material: Material): void {
    const r2 = radius * radius;
    const x0 = Math.max(0, Math.floor(cx - radius));
    const y0 = Math.max(0, Math.floor(cy - radius));
    const x1 = Math.min(this.width, Math.ceil(cx + radius));
    const y1 = Math.min(this.height, Math.ceil(cy + radius));

    for (let py = y0; py < y1; py++) {
      const dy = py - cy;
      const dy2 = dy * dy;
      const rowOffset = py * this.width;
      for (let px = x0; px < x1; px++) {
        const dx = px - cx;
        if (dx * dx + dy2 <= r2) {
          this.materials[rowOffset + px] = material;
        }
      }
    }
  }

  /**
   * Mark an exact elliptical region with a material ID (rasterized)
   */
  public markMaterialEllipse(
    cx: number,
    cy: number,
    rx: number,
    ry: number,
    material: Material
  ): void {
    const x0 = Math.max(0, Math.floor(cx - rx));
    const y0 = Math.max(0, Math.floor(cy - ry));
    const x1 = Math.min(this.width, Math.ceil(cx + rx));
    const y1 = Math.min(this.height, Math.ceil(cy + ry));
    const rx2 = rx * rx;
    const ry2 = ry * ry;

    for (let py = y0; py < y1; py++) {
      const dy = py - cy;
      const dyNorm = (dy * dy) / ry2;
      const rowOffset = py * this.width;
      for (let px = x0; px < x1; px++) {
        const dx = px - cx;
        if ((dx * dx) / rx2 + dyNorm <= 1.0) {
          this.materials[rowOffset + px] = material;
        }
      }
    }
  }

  /**
   * Draw filled rectangle on geometry canvas and mark material
   */
  public drawRect(
    x: number,
    y: number,
    w: number,
    h: number,
    color: string,
    material: Material = Material.NONE
  ): void {
    this.geometryCtx.fillStyle = color;
    this.geometryCtx.fillRect(x, y, w, h);
    if (material !== Material.NONE) {
      this.markMaterialRect(x, y, w, h, material);
    }
  }

  /**
   * Draw filled circle on geometry canvas and mark material
   */
  public drawCircle(
    cx: number,
    cy: number,
    radius: number,
    color: string,
    material: Material = Material.NONE
  ): void {
    this.geometryCtx.fillStyle = color;
    this.geometryCtx.beginPath();
    this.geometryCtx.arc(cx, cy, radius, 0, Math.PI * 2);
    this.geometryCtx.fill();

    if (material !== Material.NONE) {
      this.markMaterialCircle(cx, cy, radius, material);
    }
  }

  /**
   * Draw filled ellipse on geometry canvas and mark material
   */
  public drawEllipse(
    cx: number,
    cy: number,
    rx: number,
    ry: number,
    color: string,
    material: Material = Material.NONE
  ): void {
    this.geometryCtx.fillStyle = color;
    this.geometryCtx.beginPath();
    this.geometryCtx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    this.geometryCtx.fill();

    if (material !== Material.NONE) {
      this.markMaterialEllipse(cx, cy, rx, ry, material);
    }
  }

  /**
   * Draw filled polygon on geometry canvas and mark material
   */
  public drawPolygon(
    points: { x: number; y: number }[],
    color: string,
    material: Material = Material.NONE
  ): void {
    if (points.length < 3) return;

    this.geometryCtx.fillStyle = color;
    this.geometryCtx.beginPath();
    this.geometryCtx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      this.geometryCtx.lineTo(points[i].x, points[i].y);
    }
    this.geometryCtx.closePath();
    this.geometryCtx.fill();

    if (material !== Material.NONE) {
      let minX = this.width;
      let maxX = 0;
      let minY = this.height;
      let maxY = 0;
      for (const p of points) {
        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.y > maxY) maxY = p.y;
      }
      const x0 = Math.max(0, Math.floor(minX));
      const y0 = Math.max(0, Math.floor(minY));
      const x1 = Math.min(this.width, Math.ceil(maxX));
      const y1 = Math.min(this.height, Math.ceil(maxY));

      for (let py = y0; py < y1; py++) {
        const rowOffset = py * this.width;
        for (let px = x0; px < x1; px++) {
          let inside = false;
          for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
            const xi = points[i].x;
            const yi = points[i].y;
            const xj = points[j].x;
            const yj = points[j].y;
            const intersect =
              yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi;
            if (intersect) inside = !inside;
          }
          if (inside) {
            this.materials[rowOffset + px] = material;
          }
        }
      }
    }
  }

  /**
   * Draw 3D Ground Cast Shadow / Ambient Occlusion
   */
  public drawGroundShadow(
    points: { x: number; y: number }[],
    opacity = 0.5
  ): void {
    if (points.length < 3) return;
    this.geometryCtx.save();
    this.geometryCtx.fillStyle = `rgba(2, 4, 6, ${opacity})`;
    this.geometryCtx.beginPath();
    this.geometryCtx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      this.geometryCtx.lineTo(points[i].x, points[i].y);
    }
    this.geometryCtx.closePath();
    this.geometryCtx.fill();
    this.geometryCtx.restore();
  }

  /**
   * Add a dynamic 2D radial light source to the light canvas
   */
  public addLight(
    cx: number,
    cy: number,
    radius: number,
    colorStops: { stop: number; color: string }[]
  ): void {
    const ctx = this.lightCtx;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
    for (const cs of colorStops) {
      grad.addColorStop(cs.stop, cs.color);
    }

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  /**
   * Composite the unlit geometry canvas and the light map canvas into the final scene canvas
   */
  public composite(): void {
    const ctx = this.ctx;
    // 1. Draw base geometry
    ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(this.geometryCanvas, 0, 0);

    // 2. Multiply with light map
    ctx.globalCompositeOperation = 'multiply';
    ctx.drawImage(this.lightCanvas, 0, 0);

    // 3. Screen/lighter blend for glowing lantern cores
    ctx.globalCompositeOperation = 'lighter';
    ctx.drawImage(this.lightCanvas, 0, 0);

    ctx.globalCompositeOperation = 'source-over';
  }

  /**
   * Generates debug visualization of the material buffer (for F2 toggle)
   */
  public updateDebugMaterialView(): void {
    const data = this.debugImageData.data;
    const total = this.width * this.height;

    const colorCache: Record<number, [number, number, number]> = {};
    for (const [matIdStr, def] of Object.entries(MATERIAL_DEFS)) {
      const matId = Number(matIdStr);
      const hex = def.debugColor.replace('#', '');
      const r = parseInt(hex.substring(0, 2), 16) || 0;
      const g = parseInt(hex.substring(2, 4), 16) || 0;
      const b = parseInt(hex.substring(4, 6), 16) || 0;
      colorCache[matId] = [r, g, b];
    }

    for (let i = 0; i < total; i++) {
      const mat = this.materials[i];
      const rgb = colorCache[mat] || [0, 0, 0];
      const p = i * 4;
      data[p] = rgb[0];
      data[p + 1] = rgb[1];
      data[p + 2] = rgb[2];
      data[p + 3] = 255;
    }

    this.debugMaterialCtx.putImageData(this.debugImageData, 0, 0);
  }
}
