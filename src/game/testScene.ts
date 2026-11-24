// ============================================================================
// True Isometric 3D Feudal Japan Scene (2:1 Projection)
// Mathematical 3D depth: Two visible receding walls, corner-oriented Dojo,
// isometric tile roof, angled Torii gate, 2:1 ground path, and drop shadows.
// ============================================================================

import { Material } from './materials.ts';
import { SceneBuffer } from '../render/sceneBuffer.ts';

export class TestScene {
  public render(buffer: SceneBuffer, gameTime: number): void {
    const w = buffer.width;   // 400
    const h = buffer.height;  // 224

    // 1. Clear buffers: deep night moss ground + balanced ambient moonlight
    buffer.clear('#0b1612', '#223249');

    // 2. Isometric Ground: Courtyard arena, stone path, garden pond
    this.renderGround(buffer, w, h);
    this.renderPath(buffer);
    this.renderPond(buffer);

    // 3. Volumetric Isometric Dojo (Foundation -> Two Facades -> 3D Roof)
    this.renderIsometricDojo(buffer);

    // 4. Isometric Crimson Torii Gate (Pillars in depth, diagonal lintels)
    this.renderIsometricTorii(buffer);

    // 5. Isometric Wooden Fence (2:1 slope corner enclosure)
    this.renderIsometricFence(buffer);

    // 6. 3D Gnarled Pine Tree with Isometric Cloud Canopies
    this.renderPineTree(buffer);

    // 7. Lanterns (Hanging Chōchin & Stone Tōrō)
    this.renderLanterns(buffer);

    // 8. Dynamic 2D Lighting Map (Warm radial illumination)
    this.renderLighting(buffer, w, h, gameTime);

    // 9. Composite geometry and lightmap into the final scene canvas
    buffer.composite();
  }

  // --------------------------------------------------------------------------
  // ISOMETRIC GROUND PLANE & PATH
  // --------------------------------------------------------------------------
  private renderGround(buffer: SceneBuffer, w: number, h: number): void {
    // Base grass lawn
    buffer.drawRect(0, 0, w, h, '#0d1c16', Material.GRASS);

    // Courtyard gravel arena around the dojo (isometric diamond)
    const gravelPts = [
      { x: 180, y: 35 },
      { x: 385, y: 110 },
      { x: 230, y: 215 },
      { x: 45, y: 135 },
    ];
    buffer.drawPolygon(gravelPts, '#121921', Material.NONE);

    // Subtle grass tufts around courtyard borders
    const grassTufts = [
      { x: 20, y: 30, w: 45, h: 40 },
      { x: 15, y: 170, w: 40, h: 45 },
      { x: 340, y: 180, w: 55, h: 35 },
      { x: 345, y: 20, w: 50, h: 40 },
    ];
    for (const tuft of grassTufts) {
      buffer.drawRect(tuft.x, tuft.y, tuft.w, tuft.h, '#0f261c', Material.GRASS);
    }
  }

  private renderPath(buffer: SceneBuffer): void {
    // Winding flagstone path following the 2:1 isometric axis toward the Dojo
    const stones = [
      { x: 55, y: 205, rx: 14, ry: 7 },
      { x: 78, y: 192, rx: 14, ry: 7 },
      { x: 100, y: 180, rx: 15, ry: 8 },
      // Passes through the Torii gate
      { x: 124, y: 167, rx: 15, ry: 8 },
      { x: 146, y: 155, rx: 16, ry: 8 },
      // Curves toward the Dojo veranda steps
      { x: 170, y: 146, rx: 16, ry: 8 },
      { x: 195, y: 142, rx: 16, ry: 8 },
    ];

    for (const st of stones) {
      // Ground contact drop shadow
      buffer.geometryCtx.fillStyle = 'rgba(2, 5, 8, 0.55)';
      buffer.geometryCtx.beginPath();
      buffer.geometryCtx.ellipse(st.x + 2, st.y + 3, st.rx + 1, st.ry + 1, 0, 0, Math.PI * 2);
      buffer.geometryCtx.fill();

      // Stone dark side bevel (gives 3D stone height)
      buffer.drawEllipse(st.x, st.y + 2, st.rx, st.ry, '#242b33', Material.STONE);

      // Stone top flat surface (Material.STONE)
      buffer.drawEllipse(st.x, st.y, st.rx - 1, st.ry - 1, '#3b4754', Material.STONE);

      // Top highlight rim
      buffer.geometryCtx.fillStyle = '#506173';
      buffer.geometryCtx.beginPath();
      buffer.geometryCtx.ellipse(st.x - 2, st.y - 1, st.rx * 0.5, st.ry * 0.4, 0, 0, Math.PI * 2);
      buffer.geometryCtx.fill();
    }
  }

  private renderPond(buffer: SceneBuffer): void {
    // 2:1 Isometric Garden Koi Pond (bottom-right)
    const px = 285;
    const py = 175;
    const prx = 52;
    const pry = 26;

    // Recessed bank shadow
    buffer.geometryCtx.fillStyle = '#05090f';
    buffer.geometryCtx.beginPath();
    buffer.geometryCtx.ellipse(px + 3, py + 4, prx + 5, pry + 4, 0, 0, Math.PI * 2);
    buffer.geometryCtx.fill();

    // Smooth stone embankment rim (2:1 ellipse)
    buffer.drawEllipse(px, py, prx + 4, pry + 3, '#26313c', Material.STONE);

    // Deep water surface
    buffer.drawEllipse(px, py, prx, pry, '#0a2033', Material.WATER);

    // Isometric wooden footbridge spanning across the pond
    const bx0 = px - 26;
    const by0 = py - 10;
    const bx1 = px + 8;
    const by1 = py + 8;
    // Bridge shadow
    buffer.drawGroundShadow([
      { x: bx0 + 2, y: by0 + 10 },
      { x: bx1 + 2, y: by1 + 10 },
      { x: bx1 + 6, y: by1 + 14 },
      { x: bx0 + 6, y: by0 + 14 },
    ], 0.6);
    // Bridge planks
    const bridgePts = [
      { x: bx0, y: by0 },
      { x: bx1, y: by1 },
      { x: bx1 - 6, y: by1 + 5 },
      { x: bx0 - 6, y: by0 + 5 },
    ];
    buffer.drawPolygon(bridgePts, '#553924', Material.WOOD);
  }

  // --------------------------------------------------------------------------
  // TRUE ISOMETRIC DOJO (TWO VISIBLE RECEDING FACES + 3D ROOF)
  // --------------------------------------------------------------------------
  private renderIsometricDojo(buffer: SceneBuffer): void {
    // Central corner post coordinates
    const cx = 236;
    const cy = 138;
    const wallH = 28;

    // Left wall vector: dx = -68, dy = -34 (2:1 isometric slope)
    const lx = cx - 68; // 168
    const ly = cy - 34; // 104

    // Right wall vector: dx = +76, dy = -38 (2:1 isometric slope)
    const rx = cx + 76; // 312
    const ry = cy - 38; // 100

    // Back corner height reference
    const by = cy - 34 - 38;

    // 1. Isometric Ground Drop Shadow (cast to the right)
    buffer.drawGroundShadow([
      { x: cx, y: cy + 4 },
      { x: rx + 8, y: ry + 4 },
      { x: rx + 44, y: ry + 20 },
      { x: cx + 36, y: cy + 20 },
    ], 0.6);

    // 2. Elevated Stone Foundation Platform (Isometric Prism)
    const baseH = 8;
    // Front-left foundation face
    const baseLeftPts = [
      { x: lx - 6, y: ly + 4 },
      { x: cx, y: cy + 7 },
      { x: cx, y: cy + 7 + baseH },
      { x: lx - 6, y: ly + 4 + baseH },
    ];
    buffer.drawPolygon(baseLeftPts, '#232c36', Material.STONE);

    // Front-right foundation face
    const baseRightPts = [
      { x: cx, y: cy + 7 },
      { x: rx + 6, y: ry + 4 },
      { x: rx + 6, y: ry + 4 + baseH },
      { x: cx, y: cy + 7 + baseH },
    ];
    buffer.drawPolygon(baseRightPts, '#1a222a', Material.STONE);

    // Stone Steps leading up to the veranda
    const stepPts = [
      { x: cx - 36, y: cy - 11 },
      { x: cx - 12, y: cy + 1 },
      { x: cx - 12, y: cy + 6 },
      { x: cx - 36, y: cy - 6 },
    ];
    buffer.drawPolygon(stepPts, '#333e4c', Material.STONE);

    // 3. Wooden Veranda (Engawa) Platform
    // Left Veranda face
    const engawaLeft = [
      { x: lx - 4, y: ly + 2 },
      { x: cx, y: cy + 4 },
      { x: cx, y: cy + 1 },
      { x: lx - 4, y: ly - 1 },
    ];
    buffer.drawPolygon(engawaLeft, '#543621', Material.WOOD);

    // Right Veranda face
    const engawaRight = [
      { x: cx, y: cy + 4 },
      { x: rx + 4, y: ry + 2 },
      { x: rx + 4, y: ry - 1 },
      { x: cx, y: cy + 1 },
    ];
    buffer.drawPolygon(engawaRight, '#422a18', Material.WOOD);

    // 4. FRONT-LEFT WALL (FACING SOUTH-WEST) — WITH SHOHI DOORS
    // Wall polygon
    const wallLeftPts = [
      { x: lx, y: ly },
      { x: cx, y: cy },
      { x: cx, y: cy - wallH },
      { x: lx, y: ly - wallH },
    ];
    buffer.drawPolygon(wallLeftPts, '#141d26', Material.WOOD);

    // Glowing Shoji sliding screen bays along the Left Wall (2:1 perspective bays)
    const numBays = 3;
    for (let b = 0; b < numBays; b++) {
      const t0 = (b + 0.15) / numBays;
      const t1 = (b + 0.85) / numBays;

      const x0 = Math.round(lx + t0 * (cx - lx));
      const y0 = Math.round(ly + t0 * (cy - ly));
      const x1 = Math.round(lx + t1 * (cx - lx));
      const y1 = Math.round(ly + t1 * (cy - ly));

      const bayPts = [
        { x: x0, y: y0 - 3 },
        { x: x1, y: y1 - 3 },
        { x: x1, y: y1 - wallH + 5 },
        { x: x0, y: y0 - wallH + 5 },
      ];
      // Golden glowing paper
      buffer.drawPolygon(bayPts, '#f8cf6e', Material.SHOJI);

      // Deep eave shadow across upper portion of Shoji bay
      const bayShadowPts = [
        { x: x0, y: y0 - wallH + 11 },
        { x: x1, y: y1 - wallH + 11 },
        { x: x1, y: y1 - wallH + 5 },
        { x: x0, y: y0 - wallH + 5 },
      ];
      buffer.drawPolygon(bayShadowPts, '#9e7529', Material.SHOJI);
    }

    // 5. FRONT-RIGHT WALL (FACING SOUTH-EAST) — TIMBER WALL WITH WINDOW
    const wallRightPts = [
      { x: cx, y: cy },
      { x: rx, y: ry },
      { x: rx, y: ry - wallH },
      { x: cx, y: cy - wallH },
    ];
    buffer.drawPolygon(wallRightPts, '#182029', Material.WOOD);

    // Decorative shoji window on the right wall
    const winPts = [
      { x: cx + 24, y: cy - 12 - 5 },
      { x: cx + 52, y: cy - 26 - 5 },
      { x: cx + 52, y: cy - 26 - 17 },
      { x: cx + 24, y: cy - 12 - 17 },
    ];
    buffer.drawPolygon(winPts, '#f8cf6e', Material.SHOJI);

    // Timber posts (Left corner, Central corner, Right corner)
    buffer.drawRect(cx - 2, cy - wallH - 2, 5, wallH + 4, '#2c190f', Material.WOOD);
    buffer.drawRect(lx - 2, ly - wallH - 2, 4, wallH + 4, '#2c190f', Material.WOOD);
    buffer.drawRect(rx - 2, ry - wallH - 2, 4, wallH + 4, '#2c190f', Material.WOOD);

    // 6. ISOMETRIC ROOF (IRIMOYA-ZUKURI WITH 3D HIP SLOPES)
    // Overhanging eave tips in 3D:
    const eaveFront = { x: cx, y: cy - wallH + 8 };
    const eaveLeft = { x: lx - 14, y: ly - wallH - 2 };
    const eaveRight = { x: rx + 14, y: ry - wallH - 2 };

    // Eave underside shadow cast onto walls
    buffer.drawGroundShadow([
      { x: eaveLeft.x, y: eaveLeft.y + 2 },
      { x: eaveFront.x, y: eaveFront.y + 2 },
      { x: eaveRight.x, y: eaveRight.y + 2 },
      { x: cx, y: cy - wallH },
    ], 0.65);

    // Ridge beam (Mune) at the roof peak
    const ridgeY = by - wallH - 24;
    const ridgeL = { x: cx - 22, y: ridgeY + 11 };
    const ridgeR = { x: cx + 26, y: ridgeY - 13 };

    // LEFT ROOF PLANE (Sloping down-left to eaveLeft and eaveFront)
    const roofLeftFace = [
      { x: eaveLeft.x, y: eaveLeft.y },
      { x: eaveFront.x, y: eaveFront.y },
      { x: ridgeL.x, y: ridgeL.y },
      { x: eaveLeft.x + 18, y: ridgeY + 4 },
    ];
    buffer.drawPolygon(roofLeftFace, '#27384a', Material.ROOF_TILES);

    // Tile courses across the Left Roof Face
    for (let i = 1; i < 4; i++) {
      const t = i / 4;
      const tx0 = Math.round(eaveLeft.x + t * (eaveLeft.x + 18 - eaveLeft.x));
      const ty0 = Math.round(eaveLeft.y + t * (ridgeY + 4 - eaveLeft.y));
      const tx1 = Math.round(eaveFront.x + t * (ridgeL.x - eaveFront.x));
      const ty1 = Math.round(eaveFront.y + t * (ridgeL.y - eaveFront.y));
      buffer.drawPolygon([
        { x: tx0, y: ty0 },
        { x: tx1, y: ty1 },
        { x: tx1, y: ty1 - 1 },
        { x: tx0, y: ty0 - 1 },
      ], '#1b2633', Material.ROOF_TILES);
    }

    // RIGHT ROOF PLANE (Sloping down-right to eaveRight and eaveFront)
    const roofRightFace = [
      { x: eaveFront.x, y: eaveFront.y },
      { x: eaveRight.x, y: eaveRight.y },
      { x: ridgeR.x, y: ridgeR.y },
      { x: ridgeL.x, y: ridgeL.y },
    ];
    buffer.drawPolygon(roofRightFace, '#1c2836', Material.ROOF_TILES);

    // Tile courses across the Right Roof Face
    for (let i = 1; i < 4; i++) {
      const t = i / 4;
      const tx0 = Math.round(eaveFront.x + t * (ridgeL.x - eaveFront.x));
      const ty0 = Math.round(eaveFront.y + t * (ridgeL.y - eaveFront.y));
      const tx1 = Math.round(eaveRight.x + t * (ridgeR.x - eaveRight.x));
      const ty1 = Math.round(eaveRight.y + t * (ridgeR.y - eaveRight.y));
      buffer.drawPolygon([
        { x: tx0, y: ty0 },
        { x: tx1, y: ty1 },
        { x: tx1, y: ty1 - 1 },
        { x: tx0, y: ty0 - 1 },
      ], '#141e2a', Material.ROOF_TILES);
    }

    // Central Corner Hip Ridge (Sumimune) running down to eaveFront
    const hipRidgePts = [
      { x: eaveFront.x - 2, y: eaveFront.y },
      { x: eaveFront.x + 2, y: eaveFront.y },
      { x: ridgeL.x + 2, y: ridgeL.y },
      { x: ridgeL.x - 2, y: ridgeL.y },
    ];
    buffer.drawPolygon(hipRidgePts, '#415a75', Material.ROOF_TILES);

    // Ridge Beam (Mune) with ornamental Onigawara crests
    buffer.drawPolygon([
      { x: ridgeL.x - 2, y: ridgeL.y + 1 },
      { x: ridgeR.x + 2, y: ridgeR.y + 1 },
      { x: ridgeR.x + 2, y: ridgeR.y - 4 },
      { x: ridgeL.x - 2, y: ridgeL.y - 4 },
    ], '#506e8e', Material.ROOF_TILES);

    // Flared upturned eave tips (Sori)
    buffer.drawRect(eaveFront.x - 2, eaveFront.y - 2, 5, 4, '#5e80a4', Material.ROOF_TILES);
    buffer.drawRect(eaveLeft.x - 2, eaveLeft.y - 2, 4, 4, '#5e80a4', Material.ROOF_TILES);
    buffer.drawRect(eaveRight.x - 2, eaveRight.y - 2, 4, 4, '#5e80a4', Material.ROOF_TILES);
  }

  // --------------------------------------------------------------------------
  // ISOMETRIC CRIMSON TORII GATE
  // --------------------------------------------------------------------------
  private renderIsometricTorii(buffer: SceneBuffer): void {
    // Torii spans across the stone path along an orthogonal isometric line
    const p0x = 108; // Front-left pillar
    const p0y = 176;
    const p1x = 138; // Back-right pillar
    const p1y = 161;
    const pillarH = 34;

    // 1. Angled Drop Shadow on stone path
    buffer.drawGroundShadow([
      { x: p0x, y: p0y },
      { x: p1x, y: p1y },
      { x: p1x + 26, y: p1y + 13 },
      { x: p0x + 26, y: p0y + 13 },
    ], 0.6);

    // 2. Pillars & Stone Foundation Collars
    // Back-right pillar (drawn first for correct depth sorting)
    buffer.drawRect(p1x - 3, p1y - 3, 8, 4, '#242c36', Material.STONE);
    buffer.drawRect(p1x - 2, p1y - pillarH, 5, pillarH, '#881813', Material.TORII);

    // Front-left pillar
    buffer.drawRect(p0x - 3, p0y - 3, 8, 4, '#28323c', Material.STONE);
    buffer.drawRect(p0x - 2, p0y - pillarH, 5, pillarH, '#b32019', Material.TORII);
    buffer.drawRect(p0x - 1, p0y - pillarH, 2, pillarH, '#d92c24', Material.TORII); // 3D highlight

    // 3. Lower Tie Beam (Nuki) connecting pillars
    const nukiPts = [
      { x: p0x - 6, y: p0y - pillarH + 11 },
      { x: p1x + 6, y: p1y - pillarH + 11 },
      { x: p1x + 6, y: p1y - pillarH + 8 },
      { x: p0x - 6, y: p0y - pillarH + 8 },
    ];
    buffer.drawPolygon(nukiPts, '#bf231c', Material.TORII);

    // 4. Upper Main Lintel (Kasagi & Shimaki) with curved upturned tips
    const lintelPts = [
      { x: p0x - 12, y: p0y - pillarH - 2 },
      { x: p1x + 12, y: p1y - pillarH - 2 },
      { x: p1x + 16, y: p1y - pillarH - 7 },
      { x: p0x - 16, y: p0y - pillarH - 7 },
    ];
    buffer.drawPolygon(lintelPts, '#db2921', Material.TORII);

    // Black protective roof cap on torii lintel
    buffer.drawPolygon([
      { x: p0x - 15, y: p0y - pillarH - 7 },
      { x: p1x + 15, y: p1y - pillarH - 7 },
      { x: p1x + 17, y: p1y - pillarH - 9 },
      { x: p0x - 17, y: p0y - pillarH - 9 },
    ], '#182028', Material.WOOD);
  }

  // --------------------------------------------------------------------------
  // ISOMETRIC WOODEN FENCE
  // --------------------------------------------------------------------------
  private renderIsometricFence(buffer: SceneBuffer): void {
    // Front fence section: runs along 2:1 isometric slope from (30, 185) to (95, 217)
    const x0 = 30;
    const y0 = 185;
    const x1 = 95;
    const y1 = 217;

    // Drop shadow under fence
    buffer.drawGroundShadow([
      { x: x0, y: y0 + 6 },
      { x: x1, y: y1 + 6 },
      { x: x1 + 8, y: y1 + 10 },
      { x: x0 + 8, y: y0 + 10 },
    ], 0.5);

    // Horizontal rails along 2:1 slope
    const railPts1 = [
      { x: x0, y: y0 - 3 },
      { x: x1, y: y1 - 3 },
      { x: x1, y: y1 - 1 },
      { x: x0, y: y0 - 1 },
    ];
    buffer.drawPolygon(railPts1, '#442b1a', Material.WOOD);

    const railPts2 = [
      { x: x0, y: y0 - 9 },
      { x: x1, y: y1 - 9 },
      { x: x1, y: y1 - 7 },
      { x: x0, y: y0 - 7 },
    ];
    buffer.drawPolygon(railPts2, '#442b1a', Material.WOOD);

    // Vertical posts along front fence
    const numPosts = 4;
    for (let i = 0; i < numPosts; i++) {
      const t = i / (numPosts - 1);
      const px = Math.round(x0 + t * (x1 - x0));
      const py = Math.round(y0 + t * (y1 - y0));
      buffer.drawRect(px - 2, py - 14, 4, 16, '#543621', Material.WOOD);
      buffer.drawRect(px - 1, py - 14, 2, 16, '#6b452b', Material.WOOD);
      buffer.drawRect(px - 3, py - 16, 6, 3, '#2a1a10', Material.WOOD);
    }
  }

  // --------------------------------------------------------------------------
  // 3D GNARLED PINE TREE (MATSU)
  // --------------------------------------------------------------------------
  private renderPineTree(buffer: SceneBuffer): void {
    const tx = 345;
    const ty = 100;

    // 1. Circular Ground Shadow at the base of the trunk
    buffer.drawGroundShadow([
      { x: tx - 18, y: ty + 24 },
      { x: tx + 24, y: ty + 24 },
      { x: tx + 34, y: ty + 38 },
      { x: tx - 8, y: ty + 38 },
    ], 0.6);

    // 2. Thick 3D Gnarled Trunk with bark texture
    const trunkPts = [
      { x: tx - 8, y: ty + 26 },
      { x: tx + 8, y: ty + 26 },
      { x: tx + 5, y: ty + 4 },
      { x: tx - 5, y: ty - 12 },
      { x: tx - 14, y: ty - 28 },
      { x: tx - 10, y: ty - 32 },
      { x: tx + 3, y: ty - 18 },
      { x: tx + 10, y: ty + 2 },
    ];
    buffer.drawPolygon(trunkPts, '#24160e', Material.WOOD);
    buffer.drawRect(tx - 3, ty - 8, 3, 28, '#3d2518', Material.WOOD);

    // Branches reaching leftward over pond
    buffer.drawRect(tx - 38, ty - 24, 26, 5, '#24160e', Material.WOOD);
    buffer.drawRect(tx - 52, ty - 6, 38, 4, '#24160e', Material.WOOD);

    // 3. Layered Cloud-Pruned Foliage Pads (2:1 Isometric Canopies)
    const canopies = [
      { x: tx - 12, y: ty - 42, rx: 22, ry: 11 },
      { x: tx - 42, y: ty - 26, rx: 20, ry: 10 },
      { x: tx + 16, y: ty - 34, rx: 18, ry: 9 },
      { x: tx - 54, y: ty - 8, rx: 22, ry: 11 },
      { x: tx + 12, y: ty - 12, rx: 16, ry: 8 },
    ];

    for (const c of canopies) {
      // Underside shadow
      buffer.geometryCtx.fillStyle = '#0a1a14';
      buffer.geometryCtx.beginPath();
      buffer.geometryCtx.ellipse(c.x, c.y + 2, c.rx, c.ry, 0, 0, Math.PI * 2);
      buffer.geometryCtx.fill();

      // Main foliage body
      buffer.drawEllipse(c.x, c.y, c.rx - 1, c.ry - 1, '#112e22', Material.FOLIAGE);

      // Top moonlit highlight
      buffer.geometryCtx.fillStyle = '#1c4a37';
      buffer.geometryCtx.beginPath();
      buffer.geometryCtx.ellipse(c.x - 2, c.y - 2, c.rx * 0.65, c.ry * 0.5, 0, 0, Math.PI * 2);
      buffer.geometryCtx.fill();
    }
  }

  // --------------------------------------------------------------------------
  // LANTERNS (HANGING CHŌCHIN & STONE TŌRŌ)
  // --------------------------------------------------------------------------
  private renderLanterns(buffer: SceneBuffer): void {
    // 1. Hanging Paper Lantern at Dojo Front Corner
    const lx = 230;
    const ly = 108;

    // Cord suspended from eave
    buffer.drawRect(lx + 2, ly - 8, 2, 8, '#1e120a', Material.WOOD);
    // Caps
    buffer.drawRect(lx - 2, ly - 1, 10, 2, '#2e180d', Material.WOOD);
    buffer.drawRect(lx - 2, ly + 11, 10, 2, '#2e180d', Material.WOOD);
    // Glowing paper body
    buffer.drawRect(lx, ly + 1, 6, 10, '#ffa834', Material.LANTERN);
    buffer.drawRect(lx + 1, ly + 2, 4, 8, '#fff3c4', Material.LANTERN);

    // 2. Stone Garden Lantern (Tōrō) along Path
    const tx = 152;
    const ty = 168;

    // Ground shadow
    buffer.drawGroundShadow([
      { x: tx - 6, y: ty + 12 },
      { x: tx + 12, y: ty + 12 },
      { x: tx + 18, y: ty + 18 },
      { x: tx, y: ty + 18 },
    ], 0.6);

    // Pedestal
    buffer.drawRect(tx - 5, ty + 9, 12, 4, '#242b33', Material.STONE);
    buffer.drawRect(tx - 3, ty + 6, 8, 3, '#303944', Material.STONE);
    buffer.drawRect(tx - 2, ty + 1, 5, 6, '#3d4855', Material.STONE);

    // Glowing Firebox Window (Hibukuro)
    buffer.drawRect(tx - 3, ty - 5, 8, 5, '#ffa02a', Material.LANTERN);
    buffer.drawRect(tx - 2, ty - 4, 5, 3, '#fff2b8', Material.LANTERN);

    // Umbrella Roof Cap (Kasa)
    const roofPts = [
      { x: tx - 8, y: ty - 4 },
      { x: tx + 10, y: ty - 4 },
      { x: tx + 3, y: ty - 9 },
      { x: tx - 1, y: ty - 9 },
    ];
    buffer.drawPolygon(roofPts, '#3e4a57', Material.STONE);
    buffer.drawRect(tx, ty - 11, 2, 2, '#5c6c7d', Material.STONE);
  }

  // --------------------------------------------------------------------------
  // DYNAMIC 2D LIGHTING MAP
  // --------------------------------------------------------------------------
  private renderLighting(buffer: SceneBuffer, w: number, _h: number, gameTime: number): void {
    // 1. Hanging Paper Lantern at Central Corner
    const lx = 230;
    const ly = 108;
    const flicker =
      Math.sin(gameTime * 6.8) * 0.07 +
      Math.cos(gameTime * 15.2) * 0.04 +
      Math.sin(gameTime * 29.5) * 0.02;
    const lRadius = Math.round(w * 0.17 * (1.0 + flicker));

    buffer.addLight(lx + 3, ly + 6, lRadius, [
      { stop: 0.0, color: 'rgba(255, 230, 150, 0.95)' },
      { stop: 0.25, color: 'rgba(255, 155, 35, 0.75)' },
      { stop: 0.65, color: 'rgba(210, 95, 15, 0.35)' },
      { stop: 1.0, color: 'rgba(0, 0, 0, 0)' },
    ]);

    // 2. Shoji Interior Glow (Spilling out from left and right walls)
    buffer.addLight(195, 115, w * 0.18, [
      { stop: 0.0, color: 'rgba(255, 220, 110, 0.55)' },
      { stop: 0.5, color: 'rgba(220, 140, 40, 0.25)' },
      { stop: 1.0, color: 'rgba(0, 0, 0, 0)' },
    ]);

    // 3. Stone Garden Lantern Glow along Path
    const tx = 152;
    const ty = 168;
    const tRadius = Math.round(w * 0.10 * (1.0 + flicker * 0.6));

    buffer.addLight(tx + 1, ty - 2, tRadius, [
      { stop: 0.0, color: 'rgba(255, 215, 120, 0.85)' },
      { stop: 0.35, color: 'rgba(255, 135, 25, 0.55)' },
      { stop: 0.75, color: 'rgba(180, 75, 10, 0.20)' },
      { stop: 1.0, color: 'rgba(0, 0, 0, 0)' },
    ]);

    // 4. Cool Moonlit Wash over Pond & Pine Canopy
    buffer.addLight(285, 175, w * 0.22, [
      { stop: 0.0, color: 'rgba(120, 180, 240, 0.30)' },
      { stop: 0.6, color: 'rgba(60, 110, 170, 0.12)' },
      { stop: 1.0, color: 'rgba(0, 0, 0, 0)' },
    ]);
  }
}
