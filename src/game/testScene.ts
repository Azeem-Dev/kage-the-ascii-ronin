// ============================================================================
// Playable High Ground — Reference Aesthetic Scene
// Recreates the visual style of the reference ASCII MMORPG:
// - Elevated high ground plateau with craggy cliff edges
// - Stone stairs with floating "Stairs" label
// - Player Ronin "Kage" with dynamic light halo, katana, and floating nameplate
// - Skeleton Warrior enemies with floating health bars on lower ground
// - Traditional Dojo, Torii Gate, Stone Lanterns, and Garden Pond
// - Bottom ASCII Action Hotbar & Status Bars
// ============================================================================

import { Material, Surface } from './materials.ts';
import { CONFIG } from '../config.ts';
import { SceneBuffer } from '../render/sceneBuffer.ts';
import { AsciiPass } from '../render/asciiPass.ts';
import { WORLD, canWalk, projectBase, sampleSurface } from './world.ts';

export interface PlayerState {
  x: number; // In scene buffer pixels (0..400)
  y: number; // In scene buffer pixels (0..224)
  facing: 'left' | 'right';
  isMoving: boolean;
  hp: number;
  maxHp: number;
  stamina: number;
  maxStamina: number;
}

export class TestScene {
  public player: PlayerState;
  public lanternOn = true;
  private targetZoom: number = 1.0;
  private zoom: number = 1.0;

  constructor() {
    // Start player standing on top of the High Ground plateau!
    this.player = {
      x: 215,
      y: 134,
      facing: 'right',
      isMoving: false,
      hp: 85,
      maxHp: 100,
      stamina: 100,
      maxStamina: 100,
    };
  }

  public adjustZoom(amount: number): void {
    this.targetZoom = Math.max(0.7, Math.min(2.0, this.targetZoom * Math.exp(amount)));
  }

  public resetZoom(): void {
    this.targetZoom = 1.0;
  }

  public getZoom(): number {
    return this.targetZoom;
  }

  public getInteractionPrompt(): string | null {
    return Math.hypot(this.player.x - WORLD.lantern.x, this.player.y - WORLD.lantern.y) < 38
      ? '[E] Toggle lantern'
      : null;
  }

  public interact(): void {
    if (this.getInteractionPrompt()) this.lanternOn = !this.lanternOn;
  }

  private transformPoint(x: number, y: number): { x: number; y: number } {
    return {
      x: 200 + (x - 200) * this.zoom,
      y: 112 + (y - 112) * this.zoom,
    };
  }

  public update(dt: number, moveX: number, moveY: number): void {
    const speed = 48; // world units per second
    if (moveX !== 0 || moveY !== 0) {
      this.player.isMoving = true;
      if (moveX > 0) this.player.facing = 'right';
      if (moveX < 0) this.player.facing = 'left';

      const nextX = this.player.x + moveX * speed * dt;
      const nextY = this.player.y + moveY * speed * dt;
      const currentSurface = sampleSurface(this.player.x, this.player.y);
      const nextSurface = sampleSurface(nextX, nextY);
      const changingHeight = currentSurface.kind !== nextSurface.kind;
      const usingStairs = currentSurface.kind === 'stairs' || nextSurface.kind === 'stairs';

      if (canWalk(nextX, nextY) && (!changingHeight || usingStairs)) {
        this.player.x = nextX;
        this.player.y = nextY;
      }
    } else {
      this.player.isMoving = false;
    }
  }

  public render(buffer: SceneBuffer, gameTime: number): void {
    const w = buffer.width;   // 400
    const h = buffer.height;  // 224

    this.zoom += (this.targetZoom - this.zoom) * 0.18;

    // 1. Clear: deep night atmosphere
    buffer.clear('#091216', '#3c4e66');

    // Apply the same camera transform to geometry and material ownership.
    // Scaling below 1 reveals more of the scene; scaling above 1 crops in.
    buffer.geometryCtx.save();
    buffer.materialCtx.save();
    buffer.geometryCtx.translate(w * 0.5, h * 0.5);
    buffer.geometryCtx.scale(this.zoom, this.zoom);
    buffer.geometryCtx.translate(-w * 0.5, -h * 0.5);
    buffer.materialCtx.translate(w * 0.5, h * 0.5);
    buffer.materialCtx.scale(this.zoom, this.zoom);
    buffer.materialCtx.translate(-w * 0.5, -h * 0.5);

    // 2. Lower Ground (Dark forest ground where enemies lurk)
    this.renderLowerGround(buffer, w, h);

    // 3. Playable High Ground Plateau (Stone cliff with craggy drop-offs)
    this.renderHighGroundPlateau(buffer);

    // 4. Carved Cliff Stone Stairs
    this.renderStairs(buffer);

    // 5. High Ground Architecture (Dojo Shrine, Torii Gate, Garden Pond, Pine)
    this.renderShrine(buffer);
    this.renderTorii(buffer);
    this.renderPond(buffer);
    this.renderPineTree(buffer);

    // 6. Enemies on Lower Ground (Skeleton Warriors)
    this.renderEnemies(buffer);

    // 7. Player Character (Ronin "Kage" with katana glint & light halo)
    this.renderPlayer(buffer, gameTime);

    buffer.geometryCtx.restore();
    buffer.materialCtx.restore();

    // 8. Dynamic 2D Lighting Map (Player halo + lanterns + ambient moonlight)
    this.renderLighting(buffer, w, h, gameTime);

    // 9. Composite geometry and light map into final scene canvas
    buffer.composite();
  }

  // --------------------------------------------------------------------------
  // LOWER GROUND (FOREST FLOOR)
  // --------------------------------------------------------------------------
  private renderLowerGround(buffer: SceneBuffer, w: number, h: number): void {
    buffer.drawRect(0, 0, w, h, '#10241a', Material.GRASS);

    // Organic ground patches avoid the flat rectangular lawn look.
    buffer.drawPolygon([
      { x: 0, y: 20 }, { x: 80, y: 8 }, { x: 135, y: 45 }, { x: 105, y: 92 }, { x: 20, y: 105 }, { x: 0, y: 78 },
    ], '#08110e', Material.GRASS);
    buffer.drawPolygon([
      { x: 300, y: 135 }, { x: 400, y: 118 }, { x: 400, y: 224 }, { x: 285, y: 224 }, { x: 268, y: 188 },
    ], '#07100d', Material.GRASS);
    buffer.drawPolygon([
      { x: 0, y: 158 }, { x: 70, y: 142 }, { x: 112, y: 178 }, { x: 86, y: 224 }, { x: 0, y: 224 },
    ], '#0b1813', Material.GRASS);

    // Sparse grass blades and field stones give the lower ground texture.
    for (let i = 0; i < 72; i++) {
      const x = (i * 61 + 17) % w;
      const y = (i * 43 + 29) % h;
      const height = 2 + (i % 4);
      buffer.drawLine(x, y, x - 1, y - height, i % 3 === 0 ? '#244c38' : '#173629', 0.8);
      if (i % 5 === 0) buffer.drawLine(x, y, x + 2, y - height + 1, '#1d4232', 0.7);
    }
    for (const rock of [
      { x: 38, y: 142, rx: 7, ry: 4 }, { x: 118, y: 207, rx: 9, ry: 5 },
      { x: 286, y: 196, rx: 8, ry: 5 }, { x: 365, y: 158, rx: 10, ry: 6 },
      { x: 58, y: 62, rx: 6, ry: 3 }, { x: 322, y: 42, rx: 7, ry: 4 },
    ]) {
      buffer.drawEllipse(rock.x + 1, rock.y + 2, rock.rx + 1, rock.ry + 1, '#050a0d', Material.NONE);
      buffer.drawEllipse(rock.x, rock.y, rock.rx, rock.ry, '#26323c', Material.STONE);
      buffer.drawEllipse(rock.x - 1, rock.y - 1, rock.rx * 0.55, rock.ry * 0.45, '#394753', Material.STONE);
    }

    // Dark forest silhouettes frame the playable space.
    for (const tree of [
      { x: 24, y: 54, s: 1.0 }, { x: 72, y: 30, s: 0.8 }, { x: 372, y: 118, s: 1.15 },
      { x: 338, y: 208, s: 0.9 }, { x: 12, y: 208, s: 0.85 },
    ]) {
      buffer.drawRect(tree.x - 2 * tree.s, tree.y - 18 * tree.s, 4 * tree.s, 24 * tree.s, '#07110e', Material.WOOD);
      buffer.drawEllipse(tree.x, tree.y - 20 * tree.s, 18 * tree.s, 9 * tree.s, '#123024', Material.FOLIAGE);
      buffer.drawEllipse(tree.x - 10 * tree.s, tree.y - 13 * tree.s, 14 * tree.s, 7 * tree.s, '#173b2a', Material.FOLIAGE);
      buffer.drawEllipse(tree.x + 11 * tree.s, tree.y - 15 * tree.s, 13 * tree.s, 7 * tree.s, '#10291d', Material.FOLIAGE);
    }
  }

  // --------------------------------------------------------------------------
  // PLAYABLE HIGH GROUND PLATEAU (STONE CLIFF ELEVATION)
  // --------------------------------------------------------------------------
  private renderHighGroundPlateau(buffer: SceneBuffer): void {
    const cliffTop = [
      { x: 230, y: 35 },
      { x: 360, y: 85 },
      { x: 250, y: 148 },
      { x: 120, y: 88 },
    ];

    // Tall retaining cliff: clearly separate top surface from vertical faces.
    const cliffDropLeft = [
      { x: 120, y: 88 },
      { x: 250, y: 148 },
      { x: 250, y: 178 },
      { x: 120, y: 118 },
    ];
    buffer.drawPolygon(cliffDropLeft, '#35424f', Material.CLIFF, Surface.VERTICAL);

    const cliffDropRight = [
      { x: 250, y: 148 },
      { x: 360, y: 85 },
      { x: 360, y: 115 },
      { x: 250, y: 178 },
    ];
    buffer.drawPolygon(cliffDropRight, '#222d38', Material.CLIFF, Surface.VERTICAL);

    // Irregular crags break the cliff into readable rock volumes.
    buffer.drawPolygon([
      { x: 120, y: 88 }, { x: 168, y: 108 }, { x: 154, y: 126 }, { x: 120, y: 118 },
    ], '#2b3742', Material.CLIFF, Surface.VERTICAL);
    buffer.drawPolygon([
      { x: 184, y: 120 }, { x: 224, y: 136 }, { x: 210, y: 160 }, { x: 178, y: 148 },
    ], '#29353f', Material.CLIFF, Surface.VERTICAL);
    buffer.drawPolygon([
      { x: 270, y: 150 }, { x: 314, y: 130 }, { x: 326, y: 111 }, { x: 360, y: 115 }, { x: 360, y: 142 }, { x: 304, y: 169 }, { x: 250, y: 178 },
    ], '#1b252f', Material.CLIFF, Surface.VERTICAL);

    // Horizontal strata and vertical fissures.
    for (const offset of [8, 17, 25]) {
      buffer.drawLine(122, 91 + offset, 246, 151 + offset, '#18222c', 1);
      buffer.drawLine(255, 151 + offset, 356, 89 + offset, '#121b24', 1);
    }
    for (const crack of [
      [151, 105, 162, 129], [205, 130, 198, 157], [286, 148, 302, 169], [331, 116, 320, 139],
    ]) {
      buffer.drawLine(crack[0], crack[1], crack[2], crack[3], '#101922', 1.2);
    }

    // Cliff drop shadow on lower ground.
    buffer.drawGroundShadow([
      { x: 120, y: 118 }, { x: 250, y: 178 }, { x: 360, y: 115 },
      { x: 378, y: 126 }, { x: 254, y: 192 }, { x: 106, y: 128 },
    ], 0.72);

    // High ground surface.
    buffer.drawPolygon(cliffTop, '#3b4856', Material.STONE, Surface.HORIZONTAL);
    buffer.strokePolygon(cliffTop, '#657586', 1);

    // Irregular paver joints and exposed bedrock.
    buffer.drawLine(174, 72, 221, 104, '#26323e', 1);
    buffer.drawLine(221, 104, 286, 91, '#26323e', 1);
    buffer.drawLine(196, 104, 244, 137, '#26323e', 1);
    buffer.drawLine(244, 137, 326, 105, '#26323e', 1);
    buffer.drawLine(151, 91, 202, 119, '#202b36', 1);
    buffer.drawPolygon([
      { x: 154, y: 105 }, { x: 186, y: 91 }, { x: 207, y: 106 }, { x: 181, y: 122 },
    ], '#33404d', Material.STONE, Surface.HORIZONTAL);

    // Moss and grass spill over the cliff lip.
    for (const patch of [
      { x: 137, y: 91, rx: 13, ry: 6 }, { x: 174, y: 111, rx: 16, ry: 7 },
      { x: 232, y: 139, rx: 18, ry: 8 }, { x: 331, y: 98, rx: 14, ry: 6 },
      { x: 300, y: 122, rx: 12, ry: 6 },
    ]) {
      buffer.drawEllipse(patch.x, patch.y, patch.rx, patch.ry, '#264733', Material.GRASS, Surface.HORIZONTAL);
      buffer.drawEllipse(patch.x - 2, patch.y - 1, patch.rx * 0.55, patch.ry * 0.5, '#3a5d3e', Material.GRASS, Surface.HORIZONTAL);
    }

    // A broken shrine pillar and scattered rocks make the plateau feel inhabited.
    buffer.drawRect(132, 67, 9, 25, '#4a5764', Material.STONE, Surface.VERTICAL);
    buffer.drawRect(130, 64, 13, 5, '#5a6875', Material.STONE, Surface.HORIZONTAL);
    buffer.drawRect(136, 59, 5, 6, '#394550', Material.STONE, Surface.VERTICAL);
    for (const rock of [
      { x: 191, y: 127, rx: 8, ry: 4 }, { x: 315, y: 76, rx: 7, ry: 4 }, { x: 282, y: 132, rx: 6, ry: 3 },
    ]) {
      buffer.drawEllipse(rock.x + 1, rock.y + 2, rock.rx + 1, rock.ry + 1, '#1c2630', Material.STONE);
      buffer.drawEllipse(rock.x, rock.y, rock.rx, rock.ry, '#4b5966', Material.STONE);
    }
  }

  // --------------------------------------------------------------------------
  // CARVED CLIFF STONE STAIRS ("STAIRS")
  // --------------------------------------------------------------------------
  private renderStairs(buffer: SceneBuffer): void {
    const numSteps = 7;
    const sx0 = 164;
    const sy0 = 171;
    const sx1 = 205;
    const sy1 = 132;

    buffer.drawGroundShadow([
      { x: sx0 - 18, y: sy0 + 4 }, { x: sx1 + 18, y: sy1 + 4 },
      { x: sx1 + 24, y: sy1 + 14 }, { x: sx0 - 22, y: sy0 + 14 },
    ], 0.62);

    for (let i = 0; i < numSteps; i++) {
      const t = i / (numSteps - 1);
      const x = Math.round(sx0 + t * (sx1 - sx0));
      const y = Math.round(sy0 + t * (sy1 - sy0));
      const stepW = 34 - t * 5;
      const stepH = 6;

      // Stone cheek walls frame the stair and emphasize its climb.
      buffer.drawPolygon([
        { x: x - stepW / 2 - 3, y: y - 1 },
        { x: x - stepW / 2, y: y - 1 },
        { x: x - stepW / 2, y: y + 8 },
        { x: x - stepW / 2 - 3, y: y + 10 },
      ], '#29343f', Material.STONE, Surface.VERTICAL);
      buffer.drawPolygon([
        { x: x + stepW / 2, y: y - 1 },
        { x: x + stepW / 2 + 3, y: y - 1 },
        { x: x + stepW / 2 + 3, y: y + 10 },
        { x: x + stepW / 2, y: y + 8 },
      ], '#202a34', Material.STONE, Surface.VERTICAL);

      // Step riser and moonlit tread.
      buffer.drawRect(x - stepW / 2, y, stepW, stepH, '#1d2731', Material.STONE, Surface.VERTICAL);
      buffer.drawRect(x - stepW / 2, y - 2, stepW, 3, '#526171', Material.STONE, Surface.HORIZONTAL);
      buffer.drawLine(x - stepW / 2, y - 2, x + stepW / 2, y - 2, '#7b8c9d', 0.8);
    }
  }

  // --------------------------------------------------------------------------
  // HIGH GROUND SHRINE / DOJO
  // --------------------------------------------------------------------------
  private renderShrine(buffer: SceneBuffer): void {
    const cx = 250;
    const cy = 110;
    const wallH = 24;

    const lx = cx - 50; // 200
    const ly = cy - 25; // 85
    const rx = cx + 56; // 306
    const ry = cy - 28; // 82
    const by = cy - 25 - 28; // 57

    // Raised stone foundation beneath the shrine.
    const foundationTop = [
      { x: cx, y: cy + 26 },
      { x: cx + 82, y: cy - 2 },
      { x: cx, y: cy - 32 },
      { x: cx - 82, y: cy - 2 },
    ];
    buffer.drawPolygon([
      { x: cx - 82, y: cy - 2 }, { x: cx, y: cy + 26 },
      { x: cx, y: cy + 35 }, { x: cx - 82, y: cy + 7 },
    ], '#303c48', Material.STONE, Surface.VERTICAL);
    buffer.drawPolygon([
      { x: cx, y: cy + 26 }, { x: cx + 82, y: cy - 2 },
      { x: cx + 82, y: cy + 7 }, { x: cx, y: cy + 35 },
    ], '#202b35', Material.STONE, Surface.VERTICAL);
    buffer.drawPolygon(foundationTop, '#465463', Material.STONE, Surface.HORIZONTAL);
    buffer.strokePolygon(foundationTop, '#718191', 1);
    buffer.drawLine(cx - 70, cy + 2, cx, cy + 30, '#26333f', 0.8);
    buffer.drawLine(cx, cy + 30, cx + 70, cy + 2, '#1d2832', 0.8);

    // Veranda & Wall Left (Lit with glowing shoji)
    const wallLeft = [
      { x: lx, y: ly },
      { x: cx, y: cy },
      { x: cx, y: cy - wallH },
      { x: lx, y: ly - wallH },
    ];
    buffer.drawPolygon(wallLeft, '#1e2833', Material.WOOD);

    // Glowing Shoji bays
    for (let b = 0; b < 2; b++) {
      const t0 = (b + 0.15) / 2;
      const t1 = (b + 0.85) / 2;
      const x0 = Math.round(lx + t0 * (cx - lx));
      const y0 = Math.round(ly + t0 * (cy - ly));
      const x1 = Math.round(lx + t1 * (cx - lx));
      const y1 = Math.round(ly + t1 * (cy - ly));
      buffer.drawPolygon([
        { x: x0, y: y0 - 2 },
        { x: x1, y: y1 - 2 },
        { x: x1, y: y1 - wallH + 4 },
        { x: x0, y: y0 - wallH + 4 },
      ], '#f8cf6e', Material.SHOJI);
    }

    // Wall Right (in shadow)
    const wallRight = [
      { x: cx, y: cy },
      { x: rx, y: ry },
      { x: rx, y: ry - wallH },
      { x: cx, y: cy - wallH },
    ];
    buffer.drawPolygon(wallRight, '#141a22', Material.WOOD);

    // 3D Roof
    const eaveFront = { x: cx, y: cy - wallH + 6 };
    const eaveLeft = { x: lx - 12, y: ly - wallH - 2 };
    const eaveRight = { x: rx + 12, y: ry - wallH - 2 };
    const ridgeY = by - wallH - 18;
    const ridgeL = { x: cx - 18, y: ridgeY + 8 };
    const ridgeR = { x: cx + 20, y: ridgeY - 10 };

    // Left roof face
    buffer.drawPolygon([
      { x: eaveLeft.x, y: eaveLeft.y },
      { x: eaveFront.x, y: eaveFront.y },
      { x: ridgeL.x, y: ridgeL.y },
      { x: eaveLeft.x + 14, y: ridgeY + 3 },
    ], '#354d68', Material.ROOF_TILES);

    // Right roof face
    buffer.drawPolygon([
      { x: eaveFront.x, y: eaveFront.y },
      { x: eaveRight.x, y: eaveRight.y },
      { x: ridgeR.x, y: ridgeR.y },
      { x: ridgeL.x, y: ridgeL.y },
    ], '#192533', Material.ROOF_TILES);

    // Lower roof skirt creates a second overlapping eave tier.
    buffer.drawPolygon([
      { x: eaveLeft.x - 9, y: eaveLeft.y + 8 },
      { x: eaveFront.x, y: eaveFront.y + 12 },
      { x: ridgeL.x - 4, y: ridgeL.y + 3 },
      { x: eaveLeft.x + 12, y: ridgeY + 9 },
    ], '#2c4259', Material.ROOF_TILES, Surface.SLOPE_LEFT);
    buffer.drawPolygon([
      { x: eaveFront.x, y: eaveFront.y + 12 },
      { x: eaveRight.x + 9, y: eaveRight.y + 8 },
      { x: eaveRight.x - 10, y: ridgeY + 9 },
      { x: ridgeR.x + 4, y: ridgeR.y + 3 },
    ], '#1c2d3f', Material.ROOF_TILES, Surface.SLOPE_RIGHT);
    buffer.drawLine(eaveLeft.x - 9, eaveLeft.y + 8, eaveFront.x, eaveFront.y + 12, '#7691ad', 1);
    buffer.drawLine(eaveFront.x, eaveFront.y + 12, eaveRight.x + 9, eaveRight.y + 8, '#405b76', 1);

    // Visible paper lantern under the eave.
    buffer.drawRect(cx - 10, cy - wallH + 7, 1, 6, '#20140c', Material.WOOD, Surface.VERTICAL);
    buffer.drawRect(cx - 13, cy - wallH + 12, 7, 9, '#ffae35', Material.LANTERN, Surface.VERTICAL);
    buffer.drawRect(cx - 12, cy - wallH + 13, 5, 7, '#ffe6a3', Material.LANTERN, Surface.VERTICAL);
    buffer.drawRect(cx - 14, cy - wallH + 11, 9, 2, '#2c190d', Material.WOOD, Surface.HORIZONTAL);
    buffer.drawRect(cx - 14, cy - wallH + 20, 9, 2, '#2c190d', Material.WOOD, Surface.HORIZONTAL);

    // Ridge beam
    buffer.drawPolygon([
      { x: ridgeL.x - 2, y: ridgeL.y + 1 },
      { x: ridgeR.x + 2, y: ridgeR.y + 1 },
      { x: ridgeR.x + 2, y: ridgeR.y - 3 },
      { x: ridgeL.x - 2, y: ridgeL.y - 3 },
    ], '#5a7fa8', Material.ROOF_TILES);
  }

  private renderTorii(buffer: SceneBuffer): void {
    // Torii standing at the entrance to the high ground
    const p0x = 145;
    const p0y = 120;
    const p1x = 168;
    const p1y = 108;
    const h = 26;

    // Ground shadow
    buffer.drawGroundShadow([
      { x: p0x, y: p0y },
      { x: p1x, y: p1y },
      { x: p1x + 18, y: p1y + 9 },
      { x: p0x + 18, y: p0y + 9 },
    ], 0.6);

    // Pillars with stone footings.
    buffer.drawRect(p1x - 4, p1y - 3, 9, 4, '#2b3540', Material.STONE, Surface.HORIZONTAL);
    buffer.drawRect(p0x - 4, p0y - 3, 9, 4, '#34404c', Material.STONE, Surface.HORIZONTAL);
    buffer.drawRect(p1x - 2, p1y - h, 4, h, '#881813', Material.TORII, Surface.VERTICAL);
    buffer.drawRect(p0x - 2, p0y - h, 4, h, '#b8201a', Material.TORII, Surface.VERTICAL);
    buffer.drawRect(p0x - 1, p0y - h, 2, h, '#e03028', Material.TORII, Surface.VERTICAL);

    // Crossbeams
    buffer.drawPolygon([
      { x: p0x - 8, y: p0y - h - 1 },
      { x: p1x + 8, y: p1y - h - 1 },
      { x: p1x + 11, y: p1y - h - 5 },
      { x: p0x - 11, y: p0y - h - 5 },
    ], '#db2921', Material.TORII);
  }

  private renderPond(buffer: SceneBuffer): void {
    const px = 300;
    const py = 145;
    const prx = 36;
    const pry = 18;
    buffer.drawEllipse(px, py, prx + 3, pry + 2, '#232c36', Material.STONE);
    buffer.drawEllipse(px, py, prx, pry, '#0a2033', Material.WATER);
  }

  private renderPineTree(buffer: SceneBuffer): void {
    const tx = 335;
    const ty = 70;
    buffer.drawGroundShadow([
      { x: tx - 14, y: ty + 20 },
      { x: tx + 18, y: ty + 20 },
      { x: tx + 24, y: ty + 30 },
      { x: tx - 6, y: ty + 30 },
    ], 0.6);

    // Trunk
    const trunkPts = [
      { x: tx - 5, y: ty + 22 },
      { x: tx + 6, y: ty + 22 },
      { x: tx + 4, y: ty + 4 },
      { x: tx - 4, y: ty - 10 },
      { x: tx - 8, y: ty - 20 },
      { x: tx + 2, y: ty - 12 },
      { x: tx + 7, y: ty + 2 },
    ];
    buffer.drawPolygon(trunkPts, '#24160e', Material.WOOD);

    // Canopies
    const canopies = [
      { x: tx - 8, y: ty - 32, rx: 18, ry: 9 },
      { x: tx - 28, y: ty - 18, rx: 16, ry: 8 },
      { x: tx + 14, y: ty - 24, rx: 15, ry: 7 },
    ];
    for (const c of canopies) {
      buffer.drawEllipse(c.x, c.y, c.rx, c.ry, '#123024', Material.FOLIAGE);
      buffer.drawEllipse(c.x - 2, c.y - 2, c.rx * 0.6, c.ry * 0.5, '#1e4c3a', Material.FOLIAGE);
    }
  }

  // --------------------------------------------------------------------------
  // ENEMIES ON LOWER GROUND (SKELETON WARRIORS)
  // --------------------------------------------------------------------------
  private renderEnemies(buffer: SceneBuffer): void {
    const enemies = [
      { x: 105, y: 172 },
      { x: 80, y: 185 },
      { x: 140, y: 190 },
    ];

    for (const en of enemies) {
      // Ground shadow
      buffer.drawCircle(en.x, en.y + 4, 6, 'rgba(2, 4, 6, 0.6)');

      // Skeleton body (bony white/ash)
      buffer.drawRect(en.x - 2, en.y - 12, 4, 12, '#b8c5d0', Material.CLOTH); // Spine/ribs
      buffer.drawCircle(en.x, en.y - 15, 3, '#d8e4f0', Material.CLOTH);       // Skull
      buffer.drawRect(en.x - 4, en.y - 6, 8, 2, '#889aa8', Material.CLOTH);   // Sword arm
      // Rusted blade
      buffer.drawRect(en.x + 4, en.y - 14, 2, 10, '#9e6040', Material.WOOD);
    }
  }

  // --------------------------------------------------------------------------
  // PLAYER RONIN "KAGE" (3/4 OBLIQUE VIEW)
  // --------------------------------------------------------------------------
  private renderPlayer(buffer: SceneBuffer, gameTime: number): void {
    const surface = sampleSurface(this.player.x, this.player.y);
    const projected = projectBase({ x: this.player.x, y: this.player.y, z: surface.z });
    const px = Math.round(projected.x);
    const py = Math.round(projected.y);

    // Subtle breathing / walking bob
    const bob = this.player.isMoving ? Math.sin(gameTime * 14) * 1.5 : Math.sin(gameTime * 3) * 0.5;
    const drawY = py + bob;

    // Player contact drop shadow
    buffer.drawCircle(px, py + 3, 7, 'rgba(2, 4, 6, 0.7)');

    // 1. Hakama pants (Dark indigo/black)
    buffer.drawRect(px - 4, drawY - 7, 8, 8, '#141a24', Material.CLOTH);

    // 2. Kimono tunic (Pure white ronin garb with deep crimson belt/sash)
    buffer.drawRect(px - 5, drawY - 14, 10, 8, '#eaf2fc', Material.CLOTH);
    buffer.drawRect(px - 5, drawY - 8, 10, 2, '#b81c16', Material.TORII); // Crimson Obi sash

    // 3. Head & Headband / Straw Kasa Hat
    buffer.drawCircle(px, drawY - 17, 4, '#f0d2b2', Material.CLOTH); // Face
    buffer.drawRect(px - 4, drawY - 18, 8, 2, '#ffffff', Material.CLOTH); // White Headband
    // Headband ribbon fluttering in wind
    const flutter = Math.sin(gameTime * 8) * 2;
    buffer.drawRect(px - (this.player.facing === 'right' ? 7 : -4), drawY - 18 + flutter, 3, 2, '#ffffff', Material.CLOTH);

    // 4. Katana Scabbard at hip with gleaming steel glint
    const kDir = this.player.facing === 'right' ? 1 : -1;
    buffer.drawRect(px + kDir * 3, drawY - 9, 7 * kDir, 2, '#201a14', Material.WOOD);
    // Katana Tsuba guard & steel glint
    buffer.drawRect(px + kDir * 3, drawY - 10, 2, 3, '#f5d061', Material.LANTERN);
    buffer.drawRect(px + kDir * 9, drawY - 10, 2, 2, '#ffffff', Material.MOON);
  }

  // --------------------------------------------------------------------------
  // DYNAMIC 2D LIGHTING MAP
  // --------------------------------------------------------------------------
  private renderLighting(buffer: SceneBuffer, w: number, _h: number, gameTime: number): void {
    // 1. Dynamic Player Light Halo (Moves with Kage wherever he walks!)
    const surface = sampleSurface(this.player.x, this.player.y);
    const projected = projectBase({ x: this.player.x, y: this.player.y, z: surface.z });
    const px = Math.round(projected.x);
    const py = Math.round(projected.y);
    const pHalo = 26 + Math.sin(gameTime * 5) * 1.5;
    const playerLight = this.transformPoint(px, py - 6);
    buffer.addLight(playerLight.x, playerLight.y, pHalo * this.zoom, [
      { stop: 0.0, color: 'rgba(255, 245, 220, 0.65)' },
      { stop: 0.45, color: 'rgba(245, 225, 175, 0.22)' },
      { stop: 1.0, color: 'rgba(0, 0, 0, 0)' },
    ]);

    // 2. Paper Lantern at Shrine Corner
    const lanternLight = this.transformPoint(245, 95);
    const flicker = Math.sin(gameTime * 7.2) * 0.05 + Math.cos(gameTime * 14.8) * 0.03;
    buffer.addLight(lanternLight.x, lanternLight.y, Math.round(w * 0.10 * this.zoom * (1 + flicker)), [
      { stop: 0.0, color: 'rgba(255, 232, 175, 0.65)' },
      { stop: 0.45, color: 'rgba(245, 200, 125, 0.22)' },
      { stop: 1.0, color: 'rgba(0, 0, 0, 0)' },
    ]);

    // 3. Shoji Interior Glow
    const shojiLight = this.transformPoint(220, 95);
    buffer.addLight(shojiLight.x, shojiLight.y, w * 0.12 * this.zoom, [
      { stop: 0.0, color: 'rgba(255, 215, 100, 0.34)' },
      { stop: 1.0, color: 'rgba(0, 0, 0, 0)' },
    ]);

    // 4. Directional moonlight, not a circular plateau light.
    const lightCtx = buffer.lightCtx;
    lightCtx.save();
    lightCtx.globalCompositeOperation = 'lighter';
    const moonWash = lightCtx.createLinearGradient(0, 0, w, buffer.height);
    moonWash.addColorStop(0, 'rgba(105, 150, 205, 0.24)');
    moonWash.addColorStop(0.55, 'rgba(45, 80, 125, 0.10)');
    moonWash.addColorStop(1, 'rgba(8, 18, 34, 0.02)');
    lightCtx.fillStyle = moonWash;
    lightCtx.fillRect(0, 0, w, buffer.height);
    lightCtx.restore();
  }

  // --------------------------------------------------------------------------
  // FLOATING UI & ACTION HUD (Matches Reference Video!)
  // --------------------------------------------------------------------------
  public renderUI(
    destCtx: CanvasRenderingContext2D,
    asciiPass: AsciiPass,
    cols: number,
    rows: number,
    canvasW: number,
    canvasH: number
  ): void {
    const cw = asciiPass.atlas.cellWidth;
    const ch = asciiPass.atlas.cellHeight;
    const zoom = this.getZoom();
    const project = (x: number, y: number, z = 0): { x: number; y: number } => {
      const gx = (x / 400) * cols;
      const gy = ((y - z) / 224) * rows;
      return {
        x: cols * 0.5 + (gx - cols * 0.5) * zoom,
        y: rows * 0.52 + (gy - rows * 0.52) * zoom,
      };
    };

    // 1. Floating "Stairs" Label.
    const stairPoint = project(185, 151);
    const stairCellX = Math.round(stairPoint.x);
    const stairCellY = Math.round(stairPoint.y);
    asciiPass.drawFloatingText(destCtx, 'Stairs', stairCellX, stairCellY, '#d8e8f8');

    // 2. Floating Player Nameplate: "Kage · Lv 1".
    const playerSurface = sampleSurface(this.player.x, this.player.y);
    const playerPoint = project(this.player.x, this.player.y, playerSurface.z);
    const playerCellX = Math.round(playerPoint.x);
    const playerCellY = Math.round(playerPoint.y - 18 * zoom - 2);
    asciiPass.drawFloatingText(destCtx, 'Kage  ·  Lv 1', playerCellX, playerCellY, '#ffffff');

    // 3. Floating Enemy Nameplates & Health Bars: "Skeleton Warrior · lv 5"
    const enemies = [
      { x: 105, y: 172, hp: 80 },
      { x: 80, y: 185, hp: 100 },
      { x: 140, y: 190, hp: 60 },
    ];
    for (const en of enemies) {
      const enemyPoint = project(en.x, en.y);
      const enCellX = Math.round(enemyPoint.x);
      const enCellY = Math.round(enemyPoint.y - 18 * zoom - 2);
      asciiPass.drawFloatingText(
        destCtx,
        'Skeleton Warrior · lv 5',
        enCellX,
        enCellY,
        '#e0e8f0',
        'rgba(2, 4, 6, 0.75)'
      );
      // Small health bar above enemy.
      const barW = 44;
      const barH = 3;
      const bx = Math.round(enCellX * cw - barW / 2);
      const by = Math.round((enCellY - 0.2) * ch);
      destCtx.fillStyle = '#220000';
      destCtx.fillRect(bx, by, barW, barH);
      destCtx.fillStyle = '#ff3322';
      destCtx.fillRect(bx, by, Math.round((barW * en.hp) / 100), barH);
    }

    // 4. Bottom Action Bar & Status HUD (like in reference video!)
    const hudY = canvasH - 32;
    destCtx.save();
    destCtx.fillStyle = 'rgba(2, 4, 8, 0.92)';
    destCtx.fillRect(0, hudY, canvasW, 32);
    destCtx.strokeStyle = '#22364c';
    destCtx.lineWidth = 1;
    destCtx.strokeRect(0, hudY, canvasW, 32);

    // Player HP & SP Bars
    destCtx.font = `bold 10px ${CONFIG.display.fontFamily}`;
    destCtx.textBaseline = 'middle';
    destCtx.textAlign = 'left';

    destCtx.fillStyle = '#4ade80';
    destCtx.fillText(`HP [████████████░░░░] ${this.player.hp}/${this.player.maxHp}`, 16, hudY + 10);
    destCtx.fillStyle = '#38bdf8';
    destCtx.fillText(`SP [████████████████] 100/100`, 16, hudY + 22);

    // Action Slots: 1..9, 0 (From Reference Video!)
    const hotbarSlots = [
      { key: '1', name: 'Slash' },
      { key: '2', name: 'Heavy' },
      { key: '3', name: 'Parry' },
      { key: '4', name: 'Dash' },
      { key: '5', name: 'Iaijutsu' },
      { key: '6', name: 'Potion' },
      { key: '7', name: 'Smoke' },
      { key: '8', name: 'Flame' },
      { key: '9', name: 'Kunai' },
      { key: '0', name: 'Map' },
    ];

    const slotW = 42;
    const startX = Math.round(canvasW / 2 - (hotbarSlots.length * slotW) / 2);
    for (let i = 0; i < hotbarSlots.length; i++) {
      const slot = hotbarSlots[i];
      const sx = startX + i * slotW;
      destCtx.fillStyle = 'rgba(10, 20, 32, 0.8)';
      destCtx.fillRect(sx + 2, hudY + 3, slotW - 4, 26);
      destCtx.strokeStyle = '#385472';
      destCtx.strokeRect(sx + 2, hudY + 3, slotW - 4, 26);

      // Slot key number
      destCtx.fillStyle = '#f59e0b';
      destCtx.textAlign = 'left';
      destCtx.fillText(slot.key, sx + 5, hudY + 11);

      // Slot skill name
      destCtx.fillStyle = '#94a3b8';
      destCtx.textAlign = 'center';
      destCtx.font = `9px ${CONFIG.display.fontFamily}`;
      destCtx.fillText(slot.name, sx + slotW / 2, hudY + 20);
      destCtx.font = `bold 10px ${CONFIG.display.fontFamily}`;
    }

    // WASD Controls Hint
    destCtx.fillStyle = '#a78bfa';
    destCtx.textAlign = 'right';
    destCtx.fillText('[WASD] Walk  |  [F1] Scene  |  [F11] Fullscreen', canvasW - 16, hudY + 16);

    destCtx.restore();
  }
}
