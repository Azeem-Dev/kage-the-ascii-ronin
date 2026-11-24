// ============================================================================
// Direct ASCII Scene Renderer
// Builds the visible game as a character grid instead of trying to preserve
// every pixel of the hidden scene buffer. This keeps architecture, characters,
// stairs and foliage legible while remaining inexpensive on older machines.
// ============================================================================

import { CONFIG } from '../config.ts';
import { GlyphAtlas, quantizeRGB } from './glyphAtlas.ts';
import { WORLD, projectBase, WorldPoint } from '../game/world.ts';

export interface AsciiActorView {
  x: number;
  y: number;
  facing: 'left' | 'right';
  isMoving: boolean;
}

interface Point {
  x: number;
  y: number;
}

interface SpritePalette {
  [key: string]: { glyph: string; color: string };
}

const RONIN_PALETTE: SpritePalette = {
  A: { glyph: '▒', color: '#b8a06a' },
  H: { glyph: 'O', color: '#d8b894' },
  B: { glyph: '─', color: '#ffffff' },
  E: { glyph: '.', color: '#241b16' },
  K: { glyph: '|', color: '#e8eef5' },
  O: { glyph: '=', color: '#b52b22' },
  P: { glyph: '│', color: '#283044' },
  D: { glyph: '═', color: '#3a2a20' },
  R: { glyph: '~', color: '#ffffff' },
};

const RONIN_IDLE = [
  '.....AAAAA.....',
  '...AAAAAAAAA...',
  '.....HHHHH.....',
  '.....HBBBH.....',
  '......HEH......',
  '....KKKKKKK....',
  '...KKKKKKKKK...',
  '..KKKKKKKKKKK..',
  '..KOOOOOOOOOK..',
  '...KKKKKKKKK...',
  '....KKKKKKK....',
  '....KKK.KKK....',
  '....PP|.|PP....',
  '....PP|.|PP....',
  '...PPP|.|PPP...',
  '...DDD|.|DDD...',
  '..====. .====..',
  '.....R.R.......',
];

const RONIN_WALK = [
  '.....AAAAA.....',
  '...AAAAAAAAA...',
  '.....HHHHH.....',
  '.....HBBBH.....',
  '......HEH......',
  '....KKKKKKK....',
  '...KKKKKKKKK...',
  '..KKKKKKKKKKK..',
  '..KOOOOOOOOOK..',
  '...KKKKKKKKK...',
  '....KKKKKKK....',
  '....KKK.KKK....',
  '...PPP|.PP.....',
  '..PPP.|..P.....',
  '..PP..|..PP....',
  '.DDD..|..DDD...',
  '====..|...====.',
  '.....R.R.......',
];

const SKELETON_PALETTE: SpritePalette = {
  O: { glyph: 'O', color: '#d8e4ec' },
  R: { glyph: '═', color: '#aebdc8' },
  B: { glyph: '│', color: '#8c9eaa' },
  L: { glyph: '║', color: '#7e909d' },
  S: { glyph: '/', color: '#b9c8d2' },
  D: { glyph: '═', color: '#4d3b31' },
};

const SKELETON_SPRITE = [
  '....OOOO....',
  '...OOOOOO...',
  '...O.O.OO...',
  '....O||O....',
  '.....BB.....',
  '...RRRRRR...',
  '..R.RRR.R...',
  '..R.RRR.R...',
  '...RRRRRR...',
  '.....BB.....',
  '.....BB.....',
  '....L..L....',
  '....L..L....',
  '...LL..LL...',
  '...DD..DD...',
  '..DDD..DDD..',
  '.......S....',
  '......S.....',
];

export class AsciiSceneRenderer {
  public cols: number;
  public rows: number;
  public atlas: GlyphAtlas;

  private glyphs: Uint16Array;
  private colors: Uint8Array;
  private outputImageData: ImageData | null = null;
  private outputPixels: Uint32Array = new Uint32Array(0);
  private backgroundPixel: number;
  private currentZoom = 1;

  constructor(cols: number, rows: number, atlas: GlyphAtlas) {
    this.cols = cols;
    this.rows = rows;
    this.atlas = atlas;
    this.glyphs = new Uint16Array(cols * rows);
    this.colors = new Uint8Array(cols * rows);
    const bytes = new Uint8ClampedArray([3, 7, 12, 255]);
    this.backgroundPixel = new Uint32Array(bytes.buffer)[0];
  }

  public resize(cols: number, rows: number): void {
    this.cols = cols;
    this.rows = rows;
    this.glyphs = new Uint16Array(cols * rows);
    this.colors = new Uint8Array(cols * rows);
    this.outputImageData = null;
  }

  public render(
    destCtx: CanvasRenderingContext2D,
    player: AsciiActorView,
    gameTime: number,
    zoom: number,
    lanternOn: boolean
  ): void {
    this.currentZoom = zoom;
    this.glyphs.fill(0);
    this.drawSky();
    this.drawGround();
    this.drawHighGround();
    this.drawStairs();
    this.drawShrine(lanternOn);
    this.drawTorii();
    this.drawTrees(gameTime);
    this.drawPond(gameTime);
    this.drawEnemies();
    this.drawPlayer(player, gameTime, zoom);
    this.drawWeather(gameTime);
    this.flush(destCtx);
  }

  // --------------------------------------------------------------------------
  // Grid primitives
  // --------------------------------------------------------------------------

  private color(hex: string): number {
    const value = hex.replace('#', '');
    const r = parseInt(value.substring(0, 2), 16);
    const g = parseInt(value.substring(2, 4), 16);
    const b = parseInt(value.substring(4, 6), 16);
    return quantizeRGB(r, g, b);
  }

  private setCell(x: number, y: number, glyph: string, color: string): void {
    const ix = Math.round(x);
    const iy = Math.round(y);
    if (ix < 0 || iy < 0 || ix >= this.cols || iy >= this.rows || glyph === ' ') return;
    const index = iy * this.cols + ix;
    this.glyphs[index] = this.atlas.getGlyphIndex(glyph);
    this.colors[index] = this.color(color);
  }

  private rect(x: number, y: number, w: number, h: number, glyph: string, color: string): void {
    for (let py = Math.round(y); py < Math.round(y + h); py++) {
      for (let px = Math.round(x); px < Math.round(x + w); px++) {
        this.setCell(px, py, glyph, color);
      }
    }
  }

  private line(x0: number, y0: number, x1: number, y1: number, glyph: string, color: string): void {
    let x = Math.round(x0);
    let y = Math.round(y0);
    const endX = Math.round(x1);
    const endY = Math.round(y1);
    const dx = Math.abs(endX - x);
    const dy = Math.abs(endY - y);
    const sx = x < endX ? 1 : -1;
    const sy = y < endY ? 1 : -1;
    let err = dx - dy;

    while (true) {
      this.setCell(x, y, glyph, color);
      if (x === endX && y === endY) break;
      const e2 = err * 2;
      if (e2 > -dy) {
        err -= dy;
        x += sx;
      }
      if (e2 < dx) {
        err += dx;
        y += sy;
      }
    }
  }

  private polygon(points: Point[], glyph: string, color: string): void {
    if (points.length < 3) return;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const point of points) {
      minY = Math.min(minY, point.y);
      maxY = Math.max(maxY, point.y);
    }

    for (let y = Math.floor(minY); y <= Math.ceil(maxY); y++) {
      const intersections: number[] = [];
      for (let i = 0; i < points.length; i++) {
        const a = points[i];
        const b = points[(i + 1) % points.length];
        if ((a.y <= y && b.y > y) || (b.y <= y && a.y > y)) {
          intersections.push(a.x + ((y - a.y) / (b.y - a.y)) * (b.x - a.x));
        }
      }
      intersections.sort((a, b) => a - b);
      for (let i = 0; i + 1 < intersections.length; i += 2) {
        const start = Math.ceil(intersections[i]);
        const end = Math.floor(intersections[i + 1]);
        for (let x = start; x <= end; x++) this.setCell(x, y, glyph, color);
      }
    }
  }

  private ellipse(cx: number, cy: number, rx: number, ry: number, glyph: string, color: string): void {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      const ny = (y - cy) / Math.max(1, ry);
      const span = rx * Math.sqrt(Math.max(0, 1 - ny * ny));
      for (let x = Math.ceil(cx - span); x <= Math.floor(cx + span); x++) {
        this.setCell(x, y, glyph, color);
      }
    }
  }

  private basePoint(x: number, y: number, zoom: number): Point {
    const gx = (x / 400) * this.cols;
    const gy = (y / 224) * this.rows;
    return {
      x: this.cols * 0.5 + (gx - this.cols * 0.5) * zoom,
      y: this.rows * 0.52 + (gy - this.rows * 0.52) * zoom,
    };
  }

  private worldPoint(point: WorldPoint, zoom: number): Point {
    const projected = projectBase(point);
    return this.basePoint(projected.x, projected.y, zoom);
  }

  private worldPolygon(points: readonly WorldPoint[], glyph: string, color: string, zoom: number): void {
    this.polygon(points.map((point) => this.worldPoint(point, zoom)), glyph, color);
  }

  private worldLine(a: WorldPoint, b: WorldPoint, glyph: string, color: string, zoom: number): void {
    const pa = this.worldPoint(a, zoom);
    const pb = this.worldPoint(b, zoom);
    this.line(pa.x, pa.y, pb.x, pb.y, glyph, color);
  }

  private baseRect(
    x: number,
    y: number,
    w: number,
    h: number,
    glyph: string,
    color: string,
    zoom: number
  ): void {
    const p = this.basePoint(x, y, zoom);
    this.rect(p.x, p.y, (w / 400) * this.cols * zoom, (h / 224) * this.rows * zoom, glyph, color);
  }

  private baseLine(
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    glyph: string,
    color: string,
    zoom: number
  ): void {
    const a = this.basePoint(x0, y0, zoom);
    const b = this.basePoint(x1, y1, zoom);
    this.line(a.x, a.y, b.x, b.y, glyph, color);
  }

  private basePolygon(points: Point[], glyph: string, color: string, zoom: number): void {
    this.polygon(points.map((point) => this.basePoint(point.x, point.y, zoom)), glyph, color);
  }

  private baseEllipse(
    cx: number,
    cy: number,
    rx: number,
    ry: number,
    glyph: string,
    color: string,
    zoom: number
  ): void {
    const p = this.basePoint(cx, cy, zoom);
    this.ellipse(p.x, p.y, (rx / 400) * this.cols * zoom, (ry / 224) * this.rows * zoom, glyph, color);
  }

  // --------------------------------------------------------------------------
  // Environment
  // --------------------------------------------------------------------------

  private drawSky(): void {
    for (let i = 0; i < 46; i++) {
      const x = (i * 73 + 17) % this.cols;
      const y = (i * 29 + 7) % Math.max(1, Math.floor(this.rows * 0.42));
      this.setCell(x, y, i % 9 === 0 ? '*' : '.', i % 3 === 0 ? '#547ba0' : '#263e5b');
    }
  }

  private drawGround(): void {
    // Sparse moonlit lawn, drawn as readable multi-blade tufts.
    for (let i = 0; i < 520; i++) {
      const x = (i * 61 + 13) % this.cols;
      const y = Math.floor(this.rows * 0.16) + ((i * 47 + 23) % Math.floor(this.rows * 0.84));
      const color = i % 4 === 0 ? '#396346' : (i % 3 === 0 ? '#2b523a' : '#203f2d');
      this.setCell(x, y - 1, i % 7 === 0 ? '"' : "'", color);
      this.setCell(x - 1, y, ',', color);
      this.setCell(x + 1, y, i % 5 === 0 ? '"' : ',', color);
    }

    // Clearly outlined field stones break the grass silhouette.
    for (const rock of [
      { x: 42, y: 154 }, { x: 96, y: 206 }, { x: 286, y: 207 },
      { x: 382, y: 150 }, { x: 74, y: 104 }, { x: 344, y: 118 },
      { x: 204, y: 211 }, { x: 24, y: 206 },
    ]) {
      const point = this.basePoint(rock.x, rock.y, 1);
      this.setCell(point.x - 1, point.y, '.', '#111b22');
      this.setCell(point.x, point.y - 1, 'o', '#566674');
      this.setCell(point.x + 1, point.y, 'o', '#3c4b58');
      this.setCell(point.x, point.y + 1, '-', '#26333e');
    }

    // Approach path.
    for (let i = 0; i < 8; i++) {
      const t = i / 7;
      const x = 78 + 92 * t;
      const y = 202 - 57 * t;
      const zoom = this.currentZoom;
      this.baseEllipse(x + 2, y + 2, 12 + t * 4, 5 + t * 2, '░', '#111b22', zoom);
      this.baseEllipse(x, y, 11 + t * 4, 4 + t * 2, '▒', '#435361', zoom);
    }

    // Foreground shrubs are drawn as grounded clusters, not floating ellipses.
    for (const shrub of [
      { x: 34, y: 188, s: 1.0 }, { x: 374, y: 188, s: 1.1 },
      { x: 58, y: 82, s: 0.8 }, { x: 356, y: 54, s: 0.9 },
    ]) {
      this.baseEllipse(shrub.x + 2, shrub.y + 2, 13 * shrub.s, 5 * shrub.s, '.', '#111b17', 1);
      this.baseEllipse(shrub.x, shrub.y, 12 * shrub.s, 5 * shrub.s, '&', '#244a32', 1);
      this.baseEllipse(shrub.x - 3, shrub.y - 2, 6 * shrub.s, 3 * shrub.s, '%', '#326044', 1);
    }
  }

  private drawHighGround(): void {
    const zoom = this.currentZoom;
    const top = WORLD.plateau.points;
    const bottom = top.map((point) => ({ x: point.x, y: point.y, z: 0 }));
    this.worldPolygon([top[0], top[2], bottom[2], bottom[0]], ':', '#35434f', zoom);
    this.worldPolygon([top[2], top[1], bottom[1], bottom[2]], '.', '#222e39', zoom);
    this.worldPolygon(top, ',', '#465563', zoom);

    // Cliff strata and fissures.
    for (const offset of [7, 14, 20]) {
      this.baseLine(124, 101 + offset, 250, 160 + offset, '─', '#1b2731', zoom);
      this.baseLine(255, 160 + offset, 357, 95 + offset, '─', '#17212b', zoom);
    }
    for (const crack of [[153, 112, 162, 137], [211, 137, 205, 163], [290, 151, 304, 173]]) {
      this.baseLine(crack[0], crack[1], crack[2], crack[3], '/', '#111b24', zoom);
    }

    // Crisp plateau rim.
    this.worldLine(top[0], top[1], '/', '#718392', zoom);
    this.worldLine(top[1], top[2], '\\', '#718392', zoom);
    this.worldLine(top[2], top[3], '/', '#4c6173', zoom);
    this.worldLine(top[3], top[0], '\\', '#4c6173', zoom);

    // Pavers and moss clusters.
    for (const joint of [
      [176, 77, 220, 105], [220, 105, 284, 94], [198, 108, 246, 143], [246, 143, 326, 108],
    ]) {
      this.baseLine(joint[0], joint[1], joint[2], joint[3], '─', '#2c3945', zoom);
    }
    for (const patch of [
      { x: 143, y: 102, rx: 10, ry: 4 }, { x: 183, y: 126, rx: 12, ry: 5 },
      { x: 236, y: 149, rx: 13, ry: 5 }, { x: 330, y: 105, rx: 9, ry: 4 },
    ]) {
      this.baseEllipse(patch.x, patch.y, patch.rx, patch.ry, '&', '#2d583c', zoom);
    }

    // Broken pillar.
    this.baseRect(132, 75, 8, 27, '║', '#657482', zoom);
    this.baseRect(129, 72, 14, 5, '═', '#7a8996', zoom);
    this.baseRect(136, 67, 4, 6, '║', '#485765', zoom);
  }

  private drawStairs(): void {
    const zoom = this.currentZoom;
    for (let i = 0; i < 7; i++) {
      const t = i / 6;
      const cx = 154 + 51 * t;
      const cy = 184 - 47 * t;
      const halfWidth = 18 - t * 3;

      // Isometric tread: a clear diamond/parallelogram top surface.
      this.basePolygon([
        { x: cx - halfWidth, y: cy },
        { x: cx, y: cy - 5 },
        { x: cx + halfWidth, y: cy },
        { x: cx, y: cy + 5 },
      ], '=', '#667786', zoom);
      this.baseLine(cx - halfWidth, cy, cx, cy - 5, '═', '#a1b0bd', zoom);
      this.baseLine(cx, cy - 5, cx + halfWidth, cy, '═', '#a1b0bd', zoom);
      this.baseLine(cx + halfWidth, cy, cx, cy + 5, '═', '#4b5e6e', zoom);

      // Front and side risers give every step visible height.
      this.basePolygon([
        { x: cx - halfWidth, y: cy },
        { x: cx, y: cy + 5 },
        { x: cx, y: cy + 11 },
        { x: cx - halfWidth, y: cy + 6 },
      ], '|', '#26333e', zoom);
      this.basePolygon([
        { x: cx, y: cy + 5 },
        { x: cx + halfWidth, y: cy },
        { x: cx + halfWidth, y: cy + 6 },
        { x: cx, y: cy + 11 },
      ], ':', '#202b35', zoom);
    }

    // Continuous side stringers make the stair line readable at distance.
    this.baseLine(134, 188, 194, 137, '/', '#7b8d9c', zoom);
    this.baseLine(211, 188, 229, 145, '/', '#405363', zoom);
  }

  private drawShrine(lanternOn: boolean): void {
    const zoom = this.currentZoom;
    const cx = 254;
    const cy = 112;

    // Stone foundation.
    this.basePolygon([
      { x: cx - 78, y: cy + 2 }, { x: cx, y: cy + 31 },
      { x: cx, y: cy + 40 }, { x: cx - 78, y: cy + 11 },
    ], ':', '#303d49', zoom);
    this.basePolygon([
      { x: cx, y: cy + 31 }, { x: cx + 78, y: cy + 2 },
      { x: cx + 78, y: cy + 11 }, { x: cx, y: cy + 40 },
    ], '.', '#202b35', zoom);
    this.basePolygon([
      { x: cx, y: cy - 25 }, { x: cx + 78, y: cy + 2 },
      { x: cx, y: cy + 31 }, { x: cx - 78, y: cy + 2 },
    ], ',', '#4b5b69', zoom);

    // Timber walls: lit left face, shadowed right face.
    this.basePolygon([
      { x: 198, y: 91 }, { x: 254, y: 110 }, { x: 254, y: 76 }, { x: 198, y: 57 },
    ], '|', '#4a3527', zoom);
    this.basePolygon([
      { x: 254, y: 110 }, { x: 312, y: 90 }, { x: 312, y: 56 }, { x: 254, y: 76 },
    ], ':', '#202a35', zoom);

    // Shoji panels.
    for (let i = 0; i < 3; i++) {
      const t0 = 0.08 + i * 0.30;
      const t1 = t0 + 0.22;
      const x0 = 198 + 56 * t0;
      const y0 = 91 + 19 * t0;
      const x1 = 198 + 56 * t1;
      const y1 = 91 + 19 * t1;
      this.basePolygon([
        { x: x0, y: y0 - 3 }, { x: x1, y: y1 - 3 },
        { x: x1, y: y1 - 27 }, { x: x0, y: y0 - 27 },
      ], '▓', '#e2b85f', zoom);
      this.baseLine(x0, y0 - 3, x1, y1 - 3, '─', '#6e431c', zoom);
      this.baseLine(x0, y0 - 3, x0, y0 - 27, '║', '#6e431c', zoom);
    }

    // Corner posts.
    this.baseRect(196, 55, 4, 58, '║', '#2a190f', zoom);
    this.baseRect(250, 74, 5, 39, '║', '#2a190f', zoom);
    this.baseRect(309, 54, 4, 39, '║', '#180f0b', zoom);

    // Lower and upper roof tiers.
    this.basePolygon([
      { x: 184, y: 59 }, { x: 254, y: 82 }, { x: 214, y: 48 }, { x: 190, y: 39 },
    ], '▒', '#2f465c', zoom);
    this.basePolygon([
      { x: 254, y: 82 }, { x: 324, y: 55 }, { x: 292, y: 35 }, { x: 264, y: 45 },
    ], '▓', '#1d2f42', zoom);
    this.basePolygon([
      { x: 190, y: 39 }, { x: 254, y: 65 }, { x: 264, y: 17 }, { x: 224, y: 9 },
    ], '▓', '#405a73', zoom);
    this.basePolygon([
      { x: 254, y: 65 }, { x: 318, y: 36 }, { x: 286, y: 3 }, { x: 264, y: 17 },
    ], '▒', '#263b50', zoom);
    this.baseLine(190, 39, 254, 65, '═', '#86a0b7', zoom);
    this.baseLine(254, 65, 318, 36, '═', '#4a647d', zoom);
    this.baseLine(224, 9, 264, 17, '═', '#b2c6d8', zoom);
    this.baseLine(264, 17, 286, 3, '═', '#7891aa', zoom);

    // Hanging lantern.
    this.baseRect(240, 77, 1, 7, '│', '#28170c', zoom);
    this.baseRect(236, 83, 8, 9, '▒', lanternOn ? '#ffae35' : '#3b3328', zoom);
    this.baseRect(238, 85, 4, 5, '█', lanternOn ? '#ffe6a3' : '#171a1d', zoom);
    this.baseRect(235, 81, 10, 2, '═', '#2c190d', zoom);
    this.baseRect(235, 91, 10, 2, '═', '#2c190d', zoom);
  }

  private drawTorii(): void {
    const zoom = this.currentZoom;
    // Matches the requested upper-right entrance: beam slopes down to the right.
    this.baseRect(205, 109, 5, 44, '║', '#a8241d', zoom);
    this.baseRect(265, 132, 5, 44, '║', '#d13a2c', zoom);
    this.baseRect(202, 150, 11, 4, '═', '#394652', zoom);
    this.baseRect(262, 173, 11, 4, '═', '#394652', zoom);
    this.basePolygon([
      { x: 195, y: 105 }, { x: 277, y: 128 }, { x: 280, y: 134 }, { x: 198, y: 111 },
    ], '═', '#c63529', zoom);
    this.basePolygon([
      { x: 191, y: 97 }, { x: 280, y: 121 }, { x: 284, y: 127 }, { x: 195, y: 103 },
    ], '═', '#e04a3b', zoom);
    this.basePolygon([
      { x: 193, y: 93 }, { x: 281, y: 117 }, { x: 284, y: 121 }, { x: 196, y: 97 },
    ], '▓', '#182028', zoom);
    this.baseLine(205, 109, 265, 132, '═', '#ff7560', zoom);
  }

  private drawTrees(gameTime: number): void {
    const sway = Math.round(Math.sin(gameTime * 0.7) * 1.5);
    const trees = [
      { x: 350, y: 83, s: 1.0 }, { x: 45, y: 65, s: 0.9 },
      { x: 68, y: 199, s: 0.85 }, { x: 372, y: 196, s: 0.95 },
      { x: 330, y: 139, s: 0.7 },
    ];
    for (const tree of trees) this.drawTree(tree.x, tree.y, tree.s, sway);
  }

  private drawTree(x: number, y: number, scale: number, sway: number): void {
    const zoom = this.currentZoom;
    const trunkHeight = 30 * scale;
    this.baseRect(x - 2 * scale, y - trunkHeight, 4 * scale, trunkHeight, '║', '#4a2d1c', zoom);
    this.baseLine(x, y - trunkHeight * 0.55, x - 14 * scale + sway, y - trunkHeight * 0.9, '/', '#3b2417', zoom);
    this.baseLine(x, y - trunkHeight * 0.65, x + 15 * scale + sway, y - trunkHeight, '\\', '#3b2417', zoom);

    const pads = [
      { dx: -12, dy: -36, rx: 20, ry: 9 },
      { dx: 10, dy: -42, rx: 18, ry: 8 },
      { dx: -22, dy: -27, rx: 17, ry: 8 },
      { dx: 19, dy: -29, rx: 16, ry: 7 },
      { dx: 0, dy: -49, rx: 16, ry: 7 },
    ];
    for (const pad of pads) {
      this.baseEllipse(
        x + pad.dx * scale + sway,
        y + pad.dy * scale,
        pad.rx * scale,
        pad.ry * scale,
        '▒',
        '#1d4a34',
        zoom
      );
      this.baseEllipse(
        x + pad.dx * scale - 3 + sway,
        y + pad.dy * scale - 2,
        pad.rx * scale * 0.55,
        pad.ry * scale * 0.45,
        '▓',
        '#2f6647',
        zoom
      );
    }
  }

  private drawPond(gameTime: number): void {
    const zoom = this.currentZoom;
    this.baseEllipse(335, 190, 48, 23, ':', '#27343f', zoom);
    this.baseEllipse(335, 188, 44, 20, '.', '#164966', zoom);
    const tick = Math.floor(gameTime * 3);
    for (let i = 0; i < 14; i++) {
      const x = 302 + ((i * 19 + tick * 2) % 64);
      const y = 174 + ((i * 9) % 28);
      this.baseLine(x, y, x + 4, y, i % 2 === 0 ? '~' : '-', '#4f8cae', zoom);
    }
    for (const rock of [
      { x: 294, y: 194, rx: 6, ry: 3 }, { x: 373, y: 177, rx: 7, ry: 4 }, { x: 352, y: 207, rx: 5, ry: 3 },
    ]) {
      this.baseEllipse(rock.x, rock.y, rock.rx, rock.ry, '.', '#455461', zoom);
    }
  }

  // --------------------------------------------------------------------------
  // Actors and weather
  // --------------------------------------------------------------------------

  private drawSprite(
    sprite: string[],
    x: number,
    y: number,
    palette: SpritePalette,
    flip: boolean,
    scale: number
  ): void {
    const sourceWidth = Math.max(...sprite.map((line) => line.length));
    const sourceHeight = sprite.length;
    const destWidth = Math.max(1, Math.round(sourceWidth * scale));
    const destHeight = Math.max(1, Math.round(sourceHeight * scale));

    for (let destRow = 0; destRow < destHeight; destRow++) {
      const sourceRow = Math.min(sourceHeight - 1, Math.floor(destRow / scale));
      const source = sprite[sourceRow];
      for (let destCol = 0; destCol < destWidth; destCol++) {
        const sourceCol = Math.min(sourceWidth - 1, Math.floor(destCol / scale));
        const key = source[flip ? sourceWidth - 1 - sourceCol : sourceCol];
        const entry = palette[key];
        if (!entry) continue;
        this.setCell(x + destCol, y + destRow, entry.glyph, entry.color);
      }
    }
  }

  private drawPlayer(player: AsciiActorView, gameTime: number, zoom: number): void {
    const point = this.basePoint(player.x, player.y, zoom);
    const bob = player.isMoving ? Math.round(Math.sin(gameTime * 12)) : 0;
    const scale = Math.max(0.65, zoom);
    const sprite = player.isMoving ? RONIN_WALK : RONIN_IDLE;
    const direction = player.facing === 'right' ? 1 : -1;

    // Ground contact shadow keeps Kage visually attached to the surface.
    this.baseEllipse(player.x, player.y + 2, 8, 2.5, '.', '#020406', zoom);
    this.drawSprite(
      sprite,
      point.x - Math.round((15 * scale) / 2),
      point.y - Math.round(18 * scale) + bob,
      RONIN_PALETTE,
      player.facing === 'left',
      scale
    );

    // Katana and scabbard are separate from the body sprite so they remain
    // readable at every zoom and during the walk cycle.
    const handX = point.x + direction * 6 * scale;
    const handY = point.y - 10 * scale + bob;
    const tipX = point.x + direction * 14 * scale;
    const tipY = point.y - 22 * scale + bob;
    this.line(handX, handY, tipX, tipY, direction > 0 ? '/' : '\\', '#eef7ff');
    this.line(
      point.x - direction * 4 * scale,
      point.y - 7 * scale,
      point.x - direction * 12 * scale,
      point.y - 2 * scale,
      '─',
      '#3a2a20'
    );

    // Procedural cloth motion: headband ribbon and robe hem react to movement.
    const flutter = Math.sin(gameTime * (player.isMoving ? 11 : 5)) * 1.4;
    this.setCell(point.x - direction * (8 + flutter) * scale, point.y - 7 * scale, '~', '#ffffff');
    this.setCell(point.x - direction * (9 + flutter) * scale, point.y - 6 * scale, '~', '#d8e4ee');
    this.setCell(point.x - 5 * scale, point.y - 4 * scale + bob, '\\', '#dce6ef');
    this.setCell(point.x + 5 * scale, point.y - 4 * scale + bob, '/', '#dce6ef');

    this.setCell(point.x - 1, point.y + 2, '·', '#d9a64b');
    if (Math.sin(gameTime * 4) > 0.35) {
      this.setCell(tipX, tipY, '*', '#ffffff');
    }
  }

  private drawEnemies(): void {
    const enemies = [
      { x: 105, y: 172 }, { x: 80, y: 185 }, { x: 140, y: 190 },
    ];
    for (const enemy of enemies) {
      const point = this.basePoint(enemy.x, enemy.y, this.currentZoom);
      const scale = Math.max(0.65, this.currentZoom);
      this.drawSprite(
        SKELETON_SPRITE,
        point.x - Math.round((12 * scale) / 2),
        point.y - Math.round(18 * scale),
        SKELETON_PALETTE,
        false,
        scale
      );
      this.setCell(point.x, point.y + 2, '·', '#23352f');
    }
  }

  private drawWeather(gameTime: number): void {
    const fall = Math.floor(gameTime * 22);
    const wind = Math.floor(gameTime * 3);
    for (let i = 0; i < CONFIG.atmosphere.rainDrops; i++) {
      const x = (i * 97 + wind + (i % 5) * 11) % this.cols;
      const y = (i * 53 + fall + (i % 7) * 9) % this.rows;
      this.setCell(x, y, i % 4 === 0 ? '|' : '/', '#3d6684');
    }

    for (let i = 0; i < CONFIG.atmosphere.fireflies; i++) {
      const x = this.cols * 0.68 + Math.sin(gameTime * 0.6 + i * 1.7) * this.cols * 0.12;
      const y = this.rows * 0.62 + Math.cos(gameTime * 0.8 + i * 2.1) * this.rows * 0.13;
      this.setCell(x, y, Math.sin(gameTime * 2 + i) > 0 ? '*' : '·', '#8fae63');
    }
  }

  // --------------------------------------------------------------------------
  // Framebuffer upload
  // --------------------------------------------------------------------------

  private flush(destCtx: CanvasRenderingContext2D): void {
    const width = destCtx.canvas.width;
    const height = destCtx.canvas.height;
    if (!this.outputImageData || this.outputImageData.width !== width || this.outputImageData.height !== height) {
      this.outputImageData = destCtx.createImageData(width, height);
      this.outputPixels = new Uint32Array(this.outputImageData.data.buffer);
    }

    this.outputPixels.fill(this.backgroundPixel);
    const cw = this.atlas.cellWidth;
    const ch = this.atlas.cellHeight;
    for (let y = 0; y < this.rows; y++) {
      for (let x = 0; x < this.cols; x++) {
        const index = y * this.cols + x;
        const glyph = this.glyphs[index];
        if (glyph === 0) continue;
        this.atlas.blitToPixelBuffer(this.outputPixels, width, glyph, this.colors[index], x * cw, y * ch);
      }
    }
    destCtx.putImageData(this.outputImageData, 0, 0);
  }
}
