// ============================================================================
// KAGE: The ASCII Ronin — Perspective Test Scene
// A small CPU-only 3D projection feeds the Canvas2D scene buffer. There is no
// WebGL, game engine or runtime dependency: every world face becomes a 2D
// polygon which is then converted to ASCII by the existing renderer.
// ============================================================================

import { Material, Surface } from './materials.ts';
import { SceneBuffer } from '../render/sceneBuffer.ts';
import { CONFIG } from '../config.ts';

interface Vec3 {
  x: number;
  y: number;
  z: number;
}

interface Vec2 {
  x: number;
  y: number;
}

interface Face {
  points: Vec3[];
  normal: Vec3;
  color: string;
  material: Material;
  surface: Surface;
  emissive?: boolean;
}

const sub = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const dot = (a: Vec3, b: Vec3): number => a.x * b.x + a.y * b.y + a.z * b.z;
const cross = (a: Vec3, b: Vec3): Vec3 => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
});
const normalize = (v: Vec3): Vec3 => {
  const length = Math.hypot(v.x, v.y, v.z) || 1;
  return { x: v.x / length, y: v.y / length, z: v.z / length };
};
const centerOf = (points: Vec3[]): Vec3 => {
  const center = { x: 0, y: 0, z: 0 };
  for (const point of points) {
    center.x += point.x;
    center.y += point.y;
    center.z += point.z;
  }
  const count = Math.max(1, points.length);
  return { x: center.x / count, y: center.y / count, z: center.z / count };
};

const MOON_DIRECTION = normalize({ x: -0.45, y: -0.65, z: 0.75 });

export class TestScene {
  private readonly cameraPosition: Vec3 = { x: 330, y: -430, z: 260 };
  private readonly cameraTarget: Vec3 = { x: 0, y: 60, z: 15 };
  private readonly baseFocalLength = 420;
  private targetZoom = 1;
  private zoom = 1;
  private readonly cameraForward: Vec3;
  private readonly cameraRight: Vec3;
  private readonly cameraUp: Vec3;

  constructor() {
    this.cameraForward = normalize(sub(this.cameraTarget, this.cameraPosition));
    this.cameraRight = normalize(cross(this.cameraForward, { x: 0, y: 0, z: 1 }));
    this.cameraUp = cross(this.cameraRight, this.cameraForward);
  }

  public adjustZoom(amount: number): void {
    this.targetZoom = Math.max(0.65, Math.min(1.8, this.targetZoom * Math.exp(amount)));
  }

  public resetZoom(): void {
    this.targetZoom = 1;
  }

  public getZoom(): number {
    return this.targetZoom;
  }

  public render(buffer: SceneBuffer, gameTime: number): void {
    const w = buffer.width;
    const h = buffer.height;

    // Smooth camera zoom rather than snapping between focal lengths.
    this.zoom += (this.targetZoom - this.zoom) * 0.18;

    buffer.clear('#050914', '#35465c');
    this.renderSky(buffer, w, h);
    this.renderGround(buffer);
    this.renderTerrace(buffer);
    this.renderDojo(buffer);
    this.renderPineTree(buffer, gameTime);
    this.renderPondAndBridge(buffer);
    this.renderFence(buffer);
    this.renderTorii(buffer);
    this.renderStoneLantern(buffer);
    this.renderFireflies(buffer, gameTime);
    this.renderDriftingMist(buffer, gameTime);
    this.renderLighting(buffer, w, h, gameTime);
    buffer.composite();
  }

  // --------------------------------------------------------------------------
  // Camera projection and primitive rendering
  // --------------------------------------------------------------------------

  private project(point: Vec3): Vec2 {
    const relative = sub(point, this.cameraPosition);
    const depth = Math.max(1, dot(relative, this.cameraForward));
    const scale = (this.baseFocalLength * this.zoom) / depth;
    return {
      x: 200 + dot(relative, this.cameraRight) * scale,
      y: 112 - dot(relative, this.cameraUp) * scale,
    };
  }

  private cameraDepth(point: Vec3): number {
    return dot(sub(point, this.cameraPosition), this.cameraForward);
  }

  private shadeColor(color: string, normal: Vec3, emissive = false): string {
    if (emissive) return color;

    const diffuse = Math.max(0, dot(normal, MOON_DIRECTION));
    const factor = 0.46 + diffuse * 0.68;
    const hex = color.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    const channel = (value: number): number => Math.max(0, Math.min(255, Math.round(value * factor)));
    return `rgb(${channel(r)}, ${channel(g)}, ${channel(b)})`;
  }

  private drawFace(buffer: SceneBuffer, face: Face): void {
    const center = centerOf(face.points);
    const toCamera = sub(this.cameraPosition, center);
    if (dot(face.normal, toCamera) <= 0) return;

    buffer.drawPolygon(
      face.points.map((point) => this.project(point)),
      this.shadeColor(face.color, face.normal, face.emissive),
      face.material,
      face.surface
    );
  }

  private drawBox(
    buffer: SceneBuffer,
    min: Vec3,
    max: Vec3,
    color: string,
    material: Material,
    sideSurface: Surface = Surface.VERTICAL,
    topSurface: Surface = Surface.HORIZONTAL,
    emissive = false
  ): void {
    const p000 = { x: min.x, y: min.y, z: min.z };
    const p100 = { x: max.x, y: min.y, z: min.z };
    const p110 = { x: max.x, y: max.y, z: min.z };
    const p010 = { x: min.x, y: max.y, z: min.z };
    const p001 = { x: min.x, y: min.y, z: max.z };
    const p101 = { x: max.x, y: min.y, z: max.z };
    const p111 = { x: max.x, y: max.y, z: max.z };
    const p011 = { x: min.x, y: max.y, z: max.z };

    const faces: Face[] = [
      { points: [p001, p101, p111, p011], normal: { x: 0, y: 0, z: 1 }, color, material, surface: topSurface, emissive },
      { points: [p000, p100, p101, p001], normal: { x: 0, y: -1, z: 0 }, color, material, surface: sideSurface, emissive },
      { points: [p100, p110, p111, p101], normal: { x: 1, y: 0, z: 0 }, color, material, surface: sideSurface, emissive },
      { points: [p110, p010, p011, p111], normal: { x: 0, y: 1, z: 0 }, color, material, surface: sideSurface, emissive },
      { points: [p010, p000, p001, p011], normal: { x: -1, y: 0, z: 0 }, color, material, surface: sideSurface, emissive },
    ];

    faces.sort((a, b) => this.cameraDepth(centerOf(b.points)) - this.cameraDepth(centerOf(a.points)));
    for (const face of faces) this.drawFace(buffer, face);
  }

  private drawCylinder(
    buffer: SceneBuffer,
    cx: number,
    cy: number,
    z0: number,
    z1: number,
    baseRadius: number,
    topRadius: number,
    color: string,
    material: Material,
    emissive = false,
    segments = 10
  ): void {
    const sides: Face[] = [];
    for (let i = 0; i < segments; i++) {
      const a0 = (i / segments) * Math.PI * 2;
      const a1 = ((i + 1) / segments) * Math.PI * 2;
      const middle = (a0 + a1) * 0.5;
      sides.push({
        points: [
          { x: cx + Math.cos(a0) * baseRadius, y: cy + Math.sin(a0) * baseRadius, z: z0 },
          { x: cx + Math.cos(a1) * baseRadius, y: cy + Math.sin(a1) * baseRadius, z: z0 },
          { x: cx + Math.cos(a1) * topRadius, y: cy + Math.sin(a1) * topRadius, z: z1 },
          { x: cx + Math.cos(a0) * topRadius, y: cy + Math.sin(a0) * topRadius, z: z1 },
        ],
        normal: { x: Math.cos(middle), y: Math.sin(middle), z: 0 },
        color,
        material,
        surface: Surface.CYLINDER,
        emissive,
      });
    }

    sides.sort((a, b) => this.cameraDepth(centerOf(b.points)) - this.cameraDepth(centerOf(a.points)));
    for (const face of sides) this.drawFace(buffer, face);

    const topPoints: Vec3[] = [];
    for (let i = 0; i < segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      topPoints.push({ x: cx + Math.cos(angle) * topRadius, y: cy + Math.sin(angle) * topRadius, z: z1 });
    }
    this.drawFace(buffer, {
      points: topPoints,
      normal: { x: 0, y: 0, z: 1 },
      color,
      material,
      surface: Surface.HORIZONTAL,
      emissive,
    });
  }

  private drawWorldEllipse(
    buffer: SceneBuffer,
    cx: number,
    cy: number,
    z: number,
    rx: number,
    ry: number,
    color: string,
    material: Material,
    surface: Surface = Surface.HORIZONTAL,
    emissive = false,
    segments = 24
  ): void {
    const points: Vec3[] = [];
    for (let i = 0; i < segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      points.push({ x: cx + Math.cos(angle) * rx, y: cy + Math.sin(angle) * ry, z });
    }
    this.drawFace(buffer, { points, normal: { x: 0, y: 0, z: 1 }, color, material, surface, emissive });
  }

  private drawFlatShadow(
    buffer: SceneBuffer,
    cx: number,
    cy: number,
    z: number,
    rx: number,
    ry: number,
    opacity: number,
    segments = 20
  ): void {
    const points: Vec2[] = [];
    for (let i = 0; i < segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      points.push(this.project({ x: cx + Math.cos(angle) * rx, y: cy + Math.sin(angle) * ry, z }));
    }
    buffer.drawGroundShadow(points, opacity);
  }

  private drawPolygonShadow(buffer: SceneBuffer, points: Vec3[], opacity: number): void {
    buffer.drawGroundShadow(points.map((point) => this.project(point)), opacity);
  }

  private drawLine3D(buffer: SceneBuffer, a: Vec3, b: Vec3, color: string, width = 1): void {
    const pa = this.project(a);
    const pb = this.project(b);
    buffer.drawLine(pa.x, pa.y, pb.x, pb.y, color, width);
  }

  private drawBranch(buffer: SceneBuffer, a: Vec3, b: Vec3, width: number, color: string): void {
    const pa = this.project(a);
    const pb = this.project(b);
    const dx = pb.x - pa.x;
    const dy = pb.y - pa.y;
    const length = Math.hypot(dx, dy) || 1;
    const nx = (-dy / length) * width * 0.5;
    const ny = (dx / length) * width * 0.5;
    buffer.drawPolygon(
      [
        { x: pa.x + nx, y: pa.y + ny },
        { x: pb.x + nx, y: pb.y + ny },
        { x: pb.x - nx, y: pb.y - ny },
        { x: pa.x - nx, y: pa.y - ny },
      ],
      color,
      Material.WOOD,
      Surface.VERTICAL
    );
  }

  // --------------------------------------------------------------------------
  // Sky, distant scenery and ground plane
  // --------------------------------------------------------------------------

  private renderSky(buffer: SceneBuffer, w: number, h: number): void {
    const ctx = buffer.geometryCtx;
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#030611');
    sky.addColorStop(0.55, '#07101f');
    sky.addColorStop(1, '#102033');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);

    // Deterministic stars keep the static scene stable between frames.
    for (let i = 0; i < 34; i++) {
      const x = (i * 73 + 19) % w;
      const y = (i * 37 + 11) % 68;
      const alpha = 0.18 + ((i * 17) % 50) / 100;
      ctx.fillStyle = `rgba(174, 205, 235, ${alpha})`;
      ctx.fillRect(x, y, i % 7 === 0 ? 2 : 1, 1);
    }

    buffer.drawCircle(338, 28, 10, '#b9d2e8', Material.MOON, Surface.HORIZONTAL);
    buffer.drawCircle(335, 25, 4, '#eef7ff', Material.MOON, Surface.HORIZONTAL);
    buffer.drawCircle(341, 31, 2, '#9fbad1', Material.MOON, Surface.HORIZONTAL);
  }

  private renderGround(buffer: SceneBuffer): void {
    this.drawFace(buffer, {
      points: [
        { x: -520, y: -220, z: 0 },
        { x: 520, y: -220, z: 0 },
        { x: 520, y: 800, z: 0 },
        { x: -520, y: 800, z: 0 },
      ],
      normal: { x: 0, y: 0, z: 1 },
      color: '#0b1b16',
      material: Material.GRASS,
      surface: Surface.HORIZONTAL,
    });

    // Subtle lawn color variation gives the ground depth without texture noise.
    this.drawWorldEllipse(buffer, -210, 80, 0.05, 120, 70, '#0d2119', Material.GRASS);
    this.drawWorldEllipse(buffer, 260, 230, 0.05, 150, 85, '#0a1813', Material.GRASS);
    this.drawWorldEllipse(buffer, -40, 330, 0.05, 190, 100, '#0e211a', Material.GRASS);

    // Distant mountain silhouettes establish a horizon and atmospheric scale.
    buffer.drawPolygon([
      { x: 0, y: 76 }, { x: 35, y: 48 }, { x: 66, y: 63 }, { x: 104, y: 34 },
      { x: 142, y: 61 }, { x: 184, y: 43 }, { x: 226, y: 66 }, { x: 274, y: 39 },
      { x: 318, y: 61 }, { x: 356, y: 45 }, { x: 400, y: 72 }, { x: 400, y: 92 }, { x: 0, y: 92 },
    ], '#0a1422', Material.NONE);
    buffer.drawPolygon([
      { x: 0, y: 84 }, { x: 48, y: 64 }, { x: 88, y: 78 }, { x: 132, y: 55 },
      { x: 176, y: 82 }, { x: 222, y: 60 }, { x: 268, y: 83 }, { x: 314, y: 58 },
      { x: 354, y: 79 }, { x: 400, y: 66 }, { x: 400, y: 98 }, { x: 0, y: 98 },
    ], '#0e1b2c', Material.NONE);

    // Low drifting mist band behind the courtyard.
    const mist = buffer.geometryCtx.createLinearGradient(0, 45, 0, 105);
    mist.addColorStop(0, 'rgba(70, 100, 130, 0)');
    mist.addColorStop(0.5, 'rgba(70, 100, 130, 0.12)');
    mist.addColorStop(1, 'rgba(20, 35, 55, 0)');
    buffer.geometryCtx.fillStyle = mist;
    buffer.geometryCtx.fillRect(0, 45, buffer.width, 60);

    // Flagstone approach path. Near stones are visibly larger due to perspective.
    for (let i = 0; i < 8; i++) {
      const t = i / 7;
      const x = -66 + 51 * t + Math.sin(i * 1.7) * 4;
      const y = -190 + 165 * t;
      const rx = 13 + t * 5;
      const ry = 7 + t * 3;
      this.drawFlatShadow(buffer, x + 2, y + 2, 0.08, rx + 2, ry + 2, 0.55);
      this.drawWorldEllipse(buffer, x, y + 1, 0.25, rx, ry, '#202a34', Material.STONE, Surface.VERTICAL);
      this.drawWorldEllipse(buffer, x, y, 0.55, rx - 1, ry - 1, '#465463', Material.STONE);
    }
  }

  // --------------------------------------------------------------------------
  // Terrace, dojo and roof
  // --------------------------------------------------------------------------

  private renderTerrace(buffer: SceneBuffer): void {
    this.drawBox(
      buffer,
      { x: -135, y: -5, z: 0 },
      { x: 135, y: 175, z: 10 },
      '#3a4654',
      Material.STONE
    );

    // Paving joints on the terrace top.
    for (const x of [-90, -45, 0, 45, 90]) {
      this.drawLine3D(buffer, { x, y: 0, z: 10.2 }, { x, y: 170, z: 10.2 }, '#202a35', 0.8);
    }
    for (const y of [25, 65, 105, 145]) {
      this.drawLine3D(buffer, { x: -130, y, z: 10.2 }, { x: 130, y, z: 10.2 }, '#202a35', 0.8);
    }

    // Stone courses on the visible retaining faces.
    for (const z of [3, 6]) {
      this.drawLine3D(buffer, { x: -135, y: -5.2, z }, { x: 135, y: -5.2, z }, '#1c2631', 0.8);
      this.drawLine3D(buffer, { x: 135.2, y: -5, z }, { x: 135.2, y: 175, z }, '#17202b', 0.8);
    }

    // Broad steps centered on the approach path.
    this.drawBox(buffer, { x: -38, y: -31, z: 0 }, { x: 2, y: -23, z: 2 }, '#465362', Material.STONE);
    this.drawBox(buffer, { x: -38, y: -23, z: 0 }, { x: 2, y: -15, z: 5 }, '#414e5d', Material.STONE);
    this.drawBox(buffer, { x: -38, y: -15, z: 0 }, { x: 2, y: -6, z: 8 }, '#3b4857', Material.STONE);
  }

  private renderDojo(buffer: SceneBuffer): void {
    this.drawPolygonShadow(buffer, [
      { x: -112, y: 18, z: 10.4 },
      { x: 112, y: 18, z: 10.4 },
      { x: 172, y: 188, z: 10.4 },
      { x: -52, y: 188, z: 10.4 },
    ], 0.48);

    // Engawa platform.
    this.drawBox(
      buffer,
      { x: -98, y: 12, z: 10 },
      { x: 98, y: 148, z: 16 },
      '#5a3b25',
      Material.WOOD
    );

    // Main timber walls.
    this.drawBox(
      buffer,
      { x: -82, y: 28, z: 16 },
      { x: 82, y: 132, z: 58 },
      '#3b2b22',
      Material.WOOD
    );

    // Corner and bay posts.
    for (const x of [-82, -28, 28, 82]) {
      this.drawBox(buffer, { x: x - 2, y: 26, z: 16 }, { x: x + 2, y: 31, z: 62 }, '#24170f', Material.WOOD);
    }
    for (const y of [28, 132]) {
      this.drawBox(buffer, { x: -84, y: y - 2, z: 16 }, { x: -79, y: y + 2, z: 62 }, '#24170f', Material.WOOD);
      this.drawBox(buffer, { x: 79, y: y - 2, z: 16 }, { x: 84, y: y + 2, z: 62 }, '#180f0b', Material.WOOD);
    }

    // Glowing shoji panels on the camera-facing wall.
    const bays = [
      { x0: -75, x1: -35, color: '#e7b85f' },
      { x0: -31, x1: 9, color: '#f4cb76' },
      { x0: 13, x1: 53, color: '#f8d384' },
      { x0: 57, x1: 75, color: '#dca94f' },
    ];
    for (const bay of bays) {
      this.drawFace(buffer, {
        points: [
          { x: bay.x0, y: 27.8, z: 20 },
          { x: bay.x1, y: 27.8, z: 20 },
          { x: bay.x1, y: 27.8, z: 52 },
          { x: bay.x0, y: 27.8, z: 52 },
        ],
        normal: { x: 0, y: -1, z: 0 },
        color: bay.color,
        material: Material.SHOJI,
        surface: Surface.VERTICAL,
        emissive: true,
      });
      this.drawLine3D(buffer, { x: bay.x0, y: 27.5, z: 20 }, { x: bay.x0, y: 27.5, z: 52 }, '#4a2c16', 1.1);
      this.drawLine3D(buffer, { x: bay.x0, y: 27.5, z: 52 }, { x: bay.x1, y: 27.5, z: 52 }, '#4a2c16', 1.1);
      this.drawLine3D(buffer, { x: bay.x1, y: 27.5, z: 52 }, { x: bay.x1, y: 27.5, z: 20 }, '#4a2c16', 1.1);
      this.drawLine3D(buffer, { x: bay.x1, y: 27.5, z: 20 }, { x: bay.x0, y: 27.5, z: 20 }, '#4a2c16', 1.1);
    }

    // Dimmer shoji window on the right wall.
    this.drawFace(buffer, {
      points: [
        { x: 82.2, y: 62, z: 25 },
        { x: 82.2, y: 104, z: 25 },
        { x: 82.2, y: 104, z: 46 },
        { x: 82.2, y: 62, z: 46 },
      ],
      normal: { x: 1, y: 0, z: 0 },
      color: '#a97932',
      material: Material.SHOJI,
      surface: Surface.VERTICAL,
      emissive: true,
    });

    // Roof fascia gives the broad roof planes physical thickness.
    this.drawBox(buffer, { x: -101, y: 7, z: 59 }, { x: 101, y: 12, z: 63 }, '#1b2838', Material.ROOF_TILES);
    this.drawBox(buffer, { x: 97, y: 10, z: 59 }, { x: 102, y: 151, z: 63 }, '#152130', Material.ROOF_TILES);

    const roofColor = '#405873';
    this.drawFace(buffer, {
      points: [
        { x: -100, y: 10, z: 62 }, { x: 100, y: 10, z: 62 },
        { x: 45, y: 80, z: 98 }, { x: -45, y: 80, z: 98 },
      ],
      normal: normalize({ x: 0, y: -1, z: 0.55 }),
      color: roofColor,
      material: Material.ROOF_TILES,
      surface: Surface.SLOPE_LEFT,
    });
    this.drawFace(buffer, {
      points: [
        { x: -45, y: 80, z: 98 }, { x: 45, y: 80, z: 98 },
        { x: 100, y: 150, z: 62 }, { x: -100, y: 150, z: 62 },
      ],
      normal: normalize({ x: 0, y: 1, z: 0.55 }),
      color: roofColor,
      material: Material.ROOF_TILES,
      surface: Surface.SLOPE_RIGHT,
    });
    this.drawFace(buffer, {
      points: [
        { x: -100, y: 10, z: 62 }, { x: -45, y: 80, z: 98 }, { x: -100, y: 150, z: 62 },
      ],
      normal: normalize({ x: -1, y: 0, z: 0.45 }),
      color: roofColor,
      material: Material.ROOF_TILES,
      surface: Surface.SLOPE_LEFT,
    });
    this.drawFace(buffer, {
      points: [
        { x: 100, y: 10, z: 62 }, { x: 100, y: 150, z: 62 }, { x: 45, y: 80, z: 98 },
      ],
      normal: normalize({ x: 1, y: 0, z: 0.45 }),
      color: roofColor,
      material: Material.ROOF_TILES,
      surface: Surface.SLOPE_RIGHT,
    });

    // Ridge, upturned eave tips and tile courses.
    this.drawBox(buffer, { x: -48, y: 77, z: 96 }, { x: 48, y: 83, z: 101 }, '#6f8ba8', Material.ROOF_TILES);
    for (const x of [-100, 100]) {
      for (const y of [10, 150]) {
        this.drawBox(buffer, { x: x - 3, y: y - 3, z: 62 }, { x: x + 3, y: y + 3, z: 67 }, '#587593', Material.ROOF_TILES);
      }
    }
    for (const t of [0.25, 0.5, 0.75]) {
      const halfWidth = 100 - 55 * t;
      const y = 10 + 70 * t;
      const z = 62 + 36 * t;
      this.drawLine3D(buffer, { x: -halfWidth, y, z }, { x: halfWidth, y, z }, '#25374b', 0.75);
    }
    this.drawLine3D(buffer, { x: -100, y: 10, z: 62.4 }, { x: 100, y: 10, z: 62.4 }, '#86a5c2', 1.1);
    this.drawLine3D(buffer, { x: -48, y: 80, z: 101.2 }, { x: 48, y: 80, z: 101.2 }, '#b2c9de', 1.2);

    // Hanging lantern under the front eave.
    this.drawCylinder(buffer, -55, 8, 46, 58, 4, 4, '#ffb347', Material.LANTERN, true, 10);
    this.drawCylinder(buffer, -55, 8, 58, 60, 4.5, 4.5, '#2b180d', Material.WOOD, false, 10);
    this.drawCylinder(buffer, -55, 8, 44, 46, 4.5, 4.5, '#2b180d', Material.WOOD, false, 10);
  }

  // --------------------------------------------------------------------------
  // Garden objects
  // --------------------------------------------------------------------------

  private renderPineTree(buffer: SceneBuffer, gameTime: number): void {
    const sway = Math.sin(gameTime * 0.65) * 2.2 + Math.sin(gameTime * 1.37) * 0.8;
    this.drawFlatShadow(buffer, 174, 166, 0.1, 58, 30, 0.62);
    this.drawCylinder(buffer, 165, 150, 0, 78, 7, 4, '#2b1a10', Material.WOOD, false, 8);
    this.drawBranch(buffer, { x: 165, y: 150, z: 48 }, { x: 132 + sway, y: 145, z: 73 }, 5, '#24160e');
    this.drawBranch(buffer, { x: 165, y: 150, z: 56 }, { x: 198 + sway, y: 154, z: 76 }, 4, '#24160e');
    this.drawBranch(buffer, { x: 165, y: 150, z: 66 }, { x: 158 + sway, y: 158, z: 91 }, 4, '#24160e');

    const pads = [
      { x: 145 + sway, y: 148, z: 73, rx: 39, ry: 21 },
      { x: 188 + sway, y: 145, z: 82, rx: 35, ry: 19 },
      { x: 160 + sway, y: 160, z: 94, rx: 34, ry: 18 },
      { x: 126 + sway, y: 156, z: 86, rx: 29, ry: 16 },
      { x: 177 + sway, y: 166, z: 88, rx: 27, ry: 15 },
    ];
    for (const pad of pads) {
      this.drawWorldEllipse(buffer, pad.x, pad.y, pad.z - 2, pad.rx, pad.ry, '#07130f', Material.FOLIAGE);
      this.drawWorldEllipse(buffer, pad.x, pad.y, pad.z, pad.rx, pad.ry, '#173c2d', Material.FOLIAGE);
      this.drawWorldEllipse(buffer, pad.x - 6, pad.y - 3, pad.z + 1, pad.rx * 0.62, pad.ry * 0.55, '#245640', Material.FOLIAGE);
    }
  }

  private renderPondAndBridge(buffer: SceneBuffer): void {
    this.drawWorldEllipse(buffer, 172, 72, 0.1, 72, 44, '#050b10', Material.NONE);
    this.drawWorldEllipse(buffer, 170, 70, 0.25, 70, 43, '#2a3642', Material.STONE);
    this.drawWorldEllipse(buffer, 170, 70, 0.45, 63, 36, '#12344a', Material.WATER);

    // Wooden footbridge planks and low rails.
    for (let i = 0; i < 8; i++) {
      const x = 116 + i * 14;
      this.drawBox(buffer, { x, y: 61, z: 1.5 }, { x: x + 13, y: 79, z: 4 }, '#62412a', Material.WOOD);
    }
    for (const y of [58, 82]) {
      this.drawBox(buffer, { x: 114, y, z: 8 }, { x: 222, y: y + 3, z: 10 }, '#3c281b', Material.WOOD);
      for (const x of [122, 158, 194, 216]) {
        this.drawBox(buffer, { x, y, z: 3 }, { x: x + 3, y: y + 3, z: 12 }, '#432d1d', Material.WOOD);
      }
    }

    // Sparse reflected moon ripples.
    for (const line of [
      [{ x: 145, y: 62, z: 0.6 }, { x: 169, y: 62, z: 0.6 }],
      [{ x: 178, y: 78, z: 0.6 }, { x: 205, y: 78, z: 0.6 }],
      [{ x: 151, y: 88, z: 0.6 }, { x: 176, y: 88, z: 0.6 }],
    ]) {
      this.drawLine3D(buffer, line[0], line[1], '#4c7894', 0.8);
    }

    // A few embankment rocks break the pond silhouette.
    for (const rock of [
      { x: 116, y: 83, rx: 8, ry: 5 },
      { x: 211, y: 47, rx: 9, ry: 6 },
      { x: 224, y: 91, rx: 7, ry: 5 },
    ]) {
      this.drawWorldEllipse(buffer, rock.x, rock.y, 0.7, rock.rx, rock.ry, '#3d4a57', Material.STONE);
    }
  }

  private renderFence(buffer: SceneBuffer): void {
    for (let y = -30; y <= 150; y += 45) {
      this.drawBox(buffer, { x: -178, y, z: 0 }, { x: -173, y: y + 5, z: 27 }, '#543621', Material.WOOD);
      this.drawBox(buffer, { x: -180, y: y - 1, z: 25 }, { x: -171, y: y + 6, z: 29 }, '#2a1a10', Material.WOOD);
    }
    this.drawBox(buffer, { x: -177, y: -30, z: 10 }, { x: -174, y: 155, z: 13 }, '#442b1a', Material.WOOD);
    this.drawBox(buffer, { x: -177, y: -30, z: 19 }, { x: -174, y: 155, z: 22 }, '#442b1a', Material.WOOD);
  }

  private renderTorii(buffer: SceneBuffer): void {
    this.drawPolygonShadow(buffer, [
      { x: -104, y: -101, z: 0.1 }, { x: -2, y: -101, z: 0.1 },
      { x: 30, y: -54, z: 0.1 }, { x: -72, y: -54, z: 0.1 },
    ], 0.62);

    for (const x of [-90, -10]) {
      this.drawCylinder(buffer, x, -90, 0, 5, 6, 6, '#2c3641', Material.STONE, false, 10);
      this.drawCylinder(buffer, x, -90, 5, 70, 4.2, 3.4, '#b52b22', Material.TORII, false, 10);
    }

    this.drawBox(buffer, { x: -97, y: -94, z: 43 }, { x: -3, y: -86, z: 48 }, '#c33427', Material.TORII);
    this.drawBox(buffer, { x: -106, y: -95, z: 63 }, { x: 6, y: -85, z: 69 }, '#d13a2c', Material.TORII);
    this.drawBox(buffer, { x: -111, y: -96, z: 68 }, { x: -101, y: -84, z: 73 }, '#b52b22', Material.TORII);
    this.drawBox(buffer, { x: 1, y: -96, z: 68 }, { x: 11, y: -84, z: 73 }, '#b52b22', Material.TORII);
    this.drawBox(buffer, { x: -109, y: -96, z: 70 }, { x: 9, y: -84, z: 73 }, '#182028', Material.WOOD);
    this.drawLine3D(buffer, { x: -104, y: -96.2, z: 69.2 }, { x: 4, y: -96.2, z: 69.2 }, '#ff7560', 1);
  }

  private renderStoneLantern(buffer: SceneBuffer): void {
    const x = -4;
    const y = -34;
    this.drawFlatShadow(buffer, x + 8, y + 8, 0.1, 18, 11, 0.58);
    this.drawCylinder(buffer, x, y, 0, 4, 10, 8, '#303b47', Material.STONE, false, 8);
    this.drawBox(buffer, { x: x - 3, y: y - 3, z: 4 }, { x: x + 3, y: y + 3, z: 24 }, '#465362', Material.STONE);
    this.drawBox(buffer, { x: x - 7, y: y - 6, z: 23 }, { x: x + 7, y: y + 6, z: 31 }, '#ffab32', Material.LANTERN, Surface.VERTICAL, Surface.HORIZONTAL, true);
    this.drawBox(buffer, { x: x - 10, y: y - 9, z: 30 }, { x: x + 10, y: y + 9, z: 33 }, '#2d3946', Material.STONE);

    const apex = { x, y, z: 43 };
    const roofBase = [
      { x: x - 13, y: y - 11, z: 33 },
      { x: x + 13, y: y - 11, z: 33 },
      { x: x + 13, y: y + 11, z: 33 },
      { x: x - 13, y: y + 11, z: 33 },
    ];
    for (let i = 0; i < 4; i++) {
      const a = roofBase[i];
      const b = roofBase[(i + 1) % 4];
      const normal = normalize({
        x: (a.x + b.x) * 0.5 - x,
        y: (a.y + b.y) * 0.5 - y,
        z: 8,
      });
      this.drawFace(buffer, {
        points: [a, b, apex],
        normal,
        color: '#4b5968',
        material: Material.STONE,
        surface: normal.x < 0 ? Surface.SLOPE_LEFT : Surface.SLOPE_RIGHT,
      });
    }
    this.drawCylinder(buffer, x, y, 43, 46, 2.5, 1.5, '#68788a', Material.STONE, false, 8);
  }

  // --------------------------------------------------------------------------
  // Dynamic atmosphere
  // --------------------------------------------------------------------------

  private renderFireflies(buffer: SceneBuffer, gameTime: number): void {
    for (let i = 0; i < CONFIG.atmosphere.fireflies; i++) {
      const angle = i * 2.399 + gameTime * (0.12 + (i % 3) * 0.035);
      const radius = 28 + (i % 4) * 13;
      const x = 142 + Math.cos(angle) * radius + Math.sin(gameTime * 0.7 + i) * 5;
      const y = 52 + Math.sin(angle * 1.3) * radius * 0.65;
      const z = 8 + (i % 5) * 4 + Math.sin(gameTime * 1.1 + i * 0.8) * 3;
      const point = this.project({ x, y, z });
      const pulse = 0.5 + 0.5 * Math.sin(gameTime * 2.2 + i * 1.7);
      buffer.drawCircle(
        point.x,
        point.y,
        0.65 + pulse * 0.65,
        pulse > 0.45 ? '#d8f59a' : '#527a45',
        Material.FIRE,
        Surface.HORIZONTAL
      );
    }
  }

  private renderDriftingMist(buffer: SceneBuffer, gameTime: number): void {
    const ctx = buffer.geometryCtx;
    for (let layer = 0; layer < CONFIG.atmosphere.fogLayers; layer++) {
      const span = buffer.width + 260;
      const x = ((gameTime * (3.5 + layer * 1.7) + layer * 173) % span) - 130;
      const y = 62 + layer * 17 + Math.sin(gameTime * 0.23 + layer) * 5;
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(2.8, 0.42);
      const fog = ctx.createRadialGradient(0, 0, 0, 0, 0, 85);
      fog.addColorStop(0, 'rgba(105, 140, 165, 0.13)');
      fog.addColorStop(0.55, 'rgba(65, 95, 125, 0.07)');
      fog.addColorStop(1, 'rgba(20, 35, 55, 0)');
      ctx.fillStyle = fog;
      ctx.fillRect(-85, -85, 170, 170);
      ctx.restore();
    }
  }

  // --------------------------------------------------------------------------
  // Dynamic lighting
  // --------------------------------------------------------------------------

  private renderLighting(buffer: SceneBuffer, w: number, h: number, gameTime: number): void {
    const ctx = buffer.lightCtx;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const moonWash = ctx.createLinearGradient(0, 0, w, h);
    moonWash.addColorStop(0, 'rgba(105, 145, 190, 0.38)');
    moonWash.addColorStop(0.55, 'rgba(45, 75, 115, 0.16)');
    moonWash.addColorStop(1, 'rgba(8, 18, 34, 0.04)');
    ctx.fillStyle = moonWash;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();

    const flicker =
      Math.sin(gameTime * 6.8) * 0.06 +
      Math.cos(gameTime * 15.2) * 0.035 +
      Math.sin(gameTime * 29.5) * 0.015;

    const hanging = this.project({ x: -55, y: 8, z: 52 });
    buffer.addLight(hanging.x, hanging.y, 43 * (1 + flicker), [
      { stop: 0, color: 'rgba(255, 235, 170, 0.95)' },
      { stop: 0.25, color: 'rgba(255, 165, 45, 0.72)' },
      { stop: 0.7, color: 'rgba(190, 75, 10, 0.24)' },
      { stop: 1, color: 'rgba(0, 0, 0, 0)' },
    ]);

    const windows = this.project({ x: 0, y: 25, z: 38 });
    buffer.addLight(windows.x, windows.y, 78, [
      { stop: 0, color: 'rgba(255, 210, 105, 0.52)' },
      { stop: 0.55, color: 'rgba(210, 125, 35, 0.20)' },
      { stop: 1, color: 'rgba(0, 0, 0, 0)' },
    ]);

    const stoneLantern = this.project({ x: -4, y: -34, z: 27 });
    buffer.addLight(stoneLantern.x, stoneLantern.y, 34 * (1 + flicker * 0.7), [
      { stop: 0, color: 'rgba(255, 220, 135, 0.90)' },
      { stop: 0.35, color: 'rgba(255, 145, 30, 0.52)' },
      { stop: 1, color: 'rgba(0, 0, 0, 0)' },
    ]);

    const pond = this.project({ x: 170, y: 70, z: 0 });
    buffer.addLight(pond.x, pond.y, 66, [
      { stop: 0, color: 'rgba(105, 165, 220, 0.30)' },
      { stop: 0.6, color: 'rgba(45, 95, 150, 0.12)' },
      { stop: 1, color: 'rgba(0, 0, 0, 0)' },
    ]);

    buffer.addLight(338, 28, 38, [
      { stop: 0, color: 'rgba(150, 195, 235, 0.30)' },
      { stop: 0.45, color: 'rgba(70, 115, 170, 0.12)' },
      { stop: 1, color: 'rgba(0, 0, 0, 0)' },
    ]);
  }
}
