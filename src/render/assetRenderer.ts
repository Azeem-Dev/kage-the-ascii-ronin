import type { AsciiCell } from '../assets/types.ts';

/** Empty-cell colour (#070b10) as 0..255 channels. */
const BG = [7, 11, 16] as const;

export interface GlyphSprite {
  width: number;
  height: number;
  ids: Uint32Array;
}

/** What a cell holds; lighting treats each layer differently. */
export const LAYER = { ground: 0, prop: 2, actor: 3, effect: 4 } as const;

/** Scene lighting, set once per frame from the time of day. */
export interface Lighting {
  ambient: [number, number, number];
  /** Directional (sun or moon) strength and colour. */
  sun: number;
  sunColor: [number, number, number];
  /** Shadow direction per cell of height: +x falls right, +y falls down. */
  shadowX: number;
  shadowY: number;
  saturation: number;
}

interface Definition { mask: number; r: number; g: number; b: number }

interface Shiftable { copyWithin(target: number, start: number, end?: number): unknown; fill(value: number, start?: number, end?: number): unknown }

/** Approximate ink coverage of a glyph, 0..1, for density-preserving downsampling. */
const WEIGHTS = new Map<string, number>();
for (const [chars, w] of [[" ", 0], [".,'`", .14], [":;-_~^\"", .24], ["/\\|!il()[]{}<>", .34], ["+=rcvt?*", .44], ["xoszunjfy7", .52], ["aekhdbpqgwmXYVLTZ", .62], ["O0QCGSUDAKHNRP%&$", .74], ["#@MWB8", .88]] as [string, number][]) for (const c of chars) WEIGHTS.set(c, w);
function glyphWeight(glyph: string): number { return WEIGHTS.get(glyph) ?? .55; }

/** 5-bit channel -> 8-bit. */
const EXPAND = Array.from({ length: 32 }, (_, i) => Math.round(i * 255 / 31));
const q5 = (v: number) => (v <= 0 ? 0 : v >= 1 ? 31 : (v * 31 + .5) | 0);

/**
 * Lit ASCII renderer.
 *
 * Authoring stays glyph + colour ids. Each frame the id grid is turned into a
 * lit image: every cell gets a foreground colour (the glyph) and a background
 * colour (a dim fill of the same material), lit by ambient light, a sun/moon
 * direction with projected cast shadows, local light sources, silhouette rim
 * light and a dark contact halo around actors. Glyphs are cached once per
 * character as alpha masks and tinted per cell, so colour can vary freely.
 */
export class AssetRenderer {
  private lookup = new Map<string, Map<string, number>>();
  private definitions: Definition[] = [{ mask: 0, r: 0, g: 0, b: 0 }];
  private glyphIndex = new Map<string, number>([[' ', 0]]);
  private glyphChars: string[] = [' '];
  private masks: (Uint8Array | undefined)[] = [];
  /** Per-cell layer of the current frame (see LAYER). */
  layers = new Uint8Array(0);
  private under = new Uint32Array(0);
  private shadow = new Uint8Array(0);
  private outline = new Uint8Array(0);
  private height = new Uint8Array(0);
  private lightR = new Float32Array(0);
  private lightG = new Float32Array(0);
  private lightB = new Float32Array(0);
  private lightsActive = false;
  private working = new Uint32Array(0);
  private fg = new Uint32Array(0);
  private bg = new Uint16Array(0);
  private previousFg = new Uint32Array(0);
  private previousBg = new Uint16Array(0);
  private previousCols = 0;
  private previousRows = 0;
  private previousCellWidth = 0;
  private previousCellHeight = 0;
  private output: ImageData | null = null;
  private outputPixels = new Uint32Array(0);
  private dirtyTiles = new Uint8Array(0);
  private rasterCanvas: HTMLCanvasElement | null = null;
  private rasterContext: CanvasRenderingContext2D | null = null;
  changedCells = 0;
  shadeMs = 0;
  putStart = 0;
  lighting: Lighting = { ambient: [.8, .82, .82], sun: .45, sunColor: [1, .95, .85], shadowX: .55, shadowY: .18, saturation: 1.3 };

  constructor(public cellWidth = 4, public cellHeight = 6) {}

  resizeGlyphs(width: number, height: number): void {
    if (width === this.cellWidth && height === this.cellHeight) return;
    this.cellWidth = width; this.cellHeight = height;
    this.masks = [];
    this.output = null;
  }

  private mask(index: number): Uint8Array {
    const cached = this.masks[index];
    if (cached) return cached;
    if (!this.rasterCanvas) {
      this.rasterCanvas = document.createElement('canvas');
      this.rasterContext = this.rasterCanvas.getContext('2d', { willReadFrequently: true });
    }
    const canvas = this.rasterCanvas; const ctx = this.rasterContext;
    if (!ctx) throw new Error('Cannot rasterize glyph');
    const w = this.cellWidth; const h = this.cellHeight;
    if (canvas.width !== w) canvas.width = w;
    if (canvas.height !== h) canvas.height = h;
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    // Tiny cells need a heavier face to stay legible as texture.
    ctx.font = `${h <= 9 ? 'bold ' : ''}${Math.round(h * 1.02)}px Consolas, "DejaVu Sans Mono", "Courier New", monospace`;
    ctx.fillText(this.glyphChars[index], w / 2, h * .8);
    const data = ctx.getImageData(0, 0, w, h).data;
    const mask = new Uint8Array(w * h);
    for (let i = 0; i < mask.length; i++) mask[i] = data[i * 4];
    this.masks[index] = mask;
    return mask;
  }

  glyph(glyph: string, color: string): number {
    let colors = this.lookup.get(color);
    if (!colors) { colors = new Map(); this.lookup.set(color, colors); }
    const found = colors.get(glyph);
    if (found !== undefined) return found;
    let mask = this.glyphIndex.get(glyph);
    if (mask === undefined) { mask = this.glyphChars.length; this.glyphChars.push(glyph); this.glyphIndex.set(glyph, mask); }
    const id = this.definitions.length;
    this.definitions.push({ mask, r: parseInt(color.slice(1, 3), 16) / 255, g: parseInt(color.slice(3, 5), 16) / 255, b: parseInt(color.slice(5, 7), 16) / 255 });
    colors.set(glyph, id);
    return id;
  }

  /** Minify once, not thousands of source cells on every world frame.
   * Shrinking averages every source cell that lands in an output cell (colour and
   * ink weight), then keeps the authored glyph closest to that weight. Nearest
   * sampling instead turns detailed art into random letters when zoomed out. */
  compile(cells: readonly AsciiCell[], width: number, height: number, scale: number): GlyphSprite {
    const w = Math.max(1, Math.ceil(width * scale) + 1);
    const h = Math.max(1, Math.ceil(height * scale) + 1);
    const ids = new Uint32Array(w * h);
    if (Math.abs(scale - 1) < .03) {
      for (const cell of cells) {
        const x = Math.round(cell.x * scale); const y = Math.round(cell.y * scale);
        if (x >= 0 && y >= 0 && x < w && y < h) ids[y * w + x] = this.glyph(cell.glyph, cell.color);
      }
      return { width: w, height: h, ids };
    }
    // Upscaling (> 1.03): sample each output cell from its nearest source cell so
    // stretched sprites never leave blank black horizontal/vertical grid lines.
    if (scale > 1) {
      const src = new Uint32Array(width * height);
      for (const cell of cells) {
        if (cell.x >= 0 && cell.y >= 0 && cell.x < width && cell.y < height) {
          src[cell.y * width + cell.x] = this.glyph(cell.glyph, cell.color);
        }
      }
      for (let y = 0; y < h; y++) {
        const sy = Math.min(height - 1, Math.floor(y / scale));
        for (let x = 0; x < w; x++) {
          const sx = Math.min(width - 1, Math.floor(x / scale));
          const id = src[sy * width + sx];
          if (id) ids[y * w + x] = id;
        }
      }
      return { width: w, height: h, ids };
    }
    const n = w * h;
    const count = new Float32Array(n); const weight = new Float32Array(n);
    const r = new Float32Array(n); const g = new Float32Array(n); const b = new Float32Array(n);
    const bins = new Int32Array(cells.length);
    for (let k = 0; k < cells.length; k++) {
      const cell = cells[k];
      const x = Math.floor((cell.x + .5) * scale); const y = Math.floor((cell.y + .5) * scale);
      if (x < 0 || y < 0 || x >= w || y >= h) { bins[k] = -1; continue; }
      const i = y * w + x; bins[k] = i;
      const c = cell.color;
      count[i]++; weight[i] += glyphWeight(cell.glyph);
      r[i] += parseInt(c.slice(1, 3), 16); g[i] += parseInt(c.slice(3, 5), 16); b[i] += parseInt(c.slice(5, 7), 16);
    }
    const capacity = 1 / (scale * scale); // source cells per output cell when fully covered
    const target = new Float32Array(n); const best = new Float32Array(n).fill(9); const pick = new Int32Array(n).fill(-1);
    for (let i = 0; i < n; i++) {
      if (!count[i]) continue;
      const coverage = Math.min(1, count[i] / capacity);
      target[i] = coverage < .22 ? -1 : (weight[i] / count[i]) * (.55 + .45 * coverage);
    }
    for (let k = 0; k < cells.length; k++) {
      const i = bins[k]; if (i < 0 || target[i] < 0) continue;
      const d = Math.abs(glyphWeight(cells[k].glyph) - target[i]);
      if (d < best[i]) { best[i] = d; pick[i] = k; }
    }
    for (let i = 0; i < n; i++) {
      if (pick[i] < 0) continue;
      const hex = (v: number) => Math.min(255, Math.round(v / count[i])).toString(16).padStart(2, '0');
      ids[i] = this.glyph(cells[pick[i]].glyph, `#${hex(r[i])}${hex(g[i])}${hex(b[i])}`);
    }
    return { width: w, height: h, ids };
  }

  /** Start a frame from the terrain ids. Clears layers, shadows and lights. */
  begin(base: Uint32Array): Uint32Array {
    const n = base.length;
    if (this.working.length !== n) {
      this.working = new Uint32Array(n); this.under = new Uint32Array(n);
      this.layers = new Uint8Array(n); this.shadow = new Uint8Array(n); this.outline = new Uint8Array(n);
      this.lightR = new Float32Array(n); this.lightG = new Float32Array(n); this.lightB = new Float32Array(n);
      this.lightsActive = false;
    } else {
      this.layers.fill(0); this.shadow.fill(0);
      if (this.lightsActive) { this.lightR.fill(0); this.lightG.fill(0); this.lightB.fill(0); this.lightsActive = false; }
    }
    this.working.set(base); this.under.set(base);
    return this.working;
  }

  /** Stamp a sprite. With `groundY` (the row its feet touch) it casts a projected shadow. */
  stamp(target: Uint32Array, cols: number, rows: number, sprite: GlyphSprite, x: number, y: number, layer: number = LAYER.prop, groundY?: number,
    hole?: { x: number; y: number; rx: number; ry: number }): void {
    x = Math.round(x); y = Math.round(y);
    const minX = Math.max(0, -x); const maxX = Math.min(sprite.width, cols - x);
    const minY = Math.max(0, -y); const maxY = Math.min(sprite.height, rows - y);
    const layers = this.layers.length === target.length ? this.layers : null;
    for (let sy = minY; sy < maxY; sy++) {
      const src = sy * sprite.width;
      const dst = (y + sy) * cols + x;
      for (let sx = minX; sx < maxX; sx++) {
        const id = sprite.ids[src + sx];
        if (!id) continue;
        if (hole) {
          // See-through window: fully open in the middle, dithered toward the rim.
          const d = ((x + sx - hole.x) / hole.rx) ** 2 + ((y + sy - hole.y) / hole.ry) ** 2;
          if (d < .45 ? ((x + sx + y + sy) & 3) !== 0 : d < 1 && ((x + sx + y + sy) & 1)) continue;
        }
        target[dst + sx] = id; if (layers) layers[dst + sx] = layer;
      }
    }
    if (groundY === undefined || !layers || this.lighting.sun < .04) return;
    const { shadowX, shadowY } = this.lighting;
    const ground = Math.round(groundY);
    const strength = Math.min(235, 120 + this.lighting.sun * 220);
    for (let sy = 0; sy < sprite.height; sy++) {
      const height = ground - (y + sy);
      if (height < 0) continue;
      const py = Math.round(ground + height * shadowY);
      if (py < 0 || py >= rows) continue;
      const fade = Math.max(.45, 1 - height / 220);
      const value = strength * fade;
      const offset = height * shadowX;
      const src = sy * sprite.width;
      for (let sx = 0; sx < sprite.width; sx++) {
        if (!sprite.ids[src + sx]) continue;
        const px = Math.round(x + sx + offset);
        if (px < 0 || px >= cols) continue;
        const i = py * cols + px;
        if (this.shadow[i] < value) this.shadow[i] = value;
      }
    }
  }

  /** Soft dark ellipse where something touches the ground. */
  contactShadow(cols: number, rows: number, x: number, y: number, rx: number, ry: number, strength = 190): void {
    if (this.shadow.length !== cols * rows) return;
    for (let py = Math.floor(y - ry); py <= y + ry; py++) for (let px = Math.floor(x - rx); px <= x + rx; px++) {
      if (px < 0 || py < 0 || px >= cols || py >= rows) continue;
      const d = ((px - x) / rx) ** 2 + ((py - y) / ry) ** 2;
      if (d >= 1) continue;
      const i = py * cols + px; const value = strength * (1 - d * .6);
      if (this.shadow[i] < value) this.shadow[i] = value;
    }
  }

  /** Coloured point light in cell coordinates (ellipse corrects for tall cells). */
  addLight(cols: number, rows: number, x: number, y: number, radius: number, r: number, g: number, b: number): void {
    if (this.lightR.length !== cols * rows || radius <= 0) return;
    const ry = radius * .68;
    const minX = Math.max(0, Math.floor(x - radius)); const maxX = Math.min(cols - 1, Math.ceil(x + radius));
    const minY = Math.max(0, Math.floor(y - ry)); const maxY = Math.min(rows - 1, Math.ceil(y + ry));
    for (let py = minY; py <= maxY; py++) for (let px = minX; px <= maxX; px++) {
      const d = ((px - x) / radius) ** 2 + ((py - y) / ry) ** 2;
      if (d >= 1) continue;
      const f = (1 - d) * (1 - d);
      const i = py * cols + px;
      this.lightR[i] += r * f; this.lightG[i] += g * f; this.lightB[i] += b * f;
    }
    this.lightsActive = true;
  }

  /** Back-compatible local light: warm torch or cool fill. */
  illuminate(_ids: Uint32Array, cols: number, rows: number, x: number, y: number, radius: number, warm: boolean): void {
    if (warm) this.addLight(cols, rows, x, y, radius, 1.05, .62, .26);
    else this.addLight(cols, rows, x, y, radius, .22, .32, .5);
  }

  /** Turn ids + layers + light into per-cell foreground/background colours. */
  private shade(ids: Uint32Array, cols: number, rows: number): void {
    const n = ids.length;
    if (this.fg.length !== n) { this.fg = new Uint32Array(n); this.bg = new Uint16Array(n); }
    const { layers, shadow, outline, under, definitions: defs } = this;
    const L = this.lighting;
    const [ar, ag, ab] = L.ambient; const [sr, sg, sb] = L.sunColor;
    const sat = L.saturation;
    const litSide = L.shadowX > 0 ? -1 : 1; // light comes from opposite the shadows
    const lights = this.lightsActive;
    const bgEmpty = (q5(BG[0] / 255) << 10) | (q5(BG[1] / 255) << 5) | q5(BG[2] / 255);

    // Actor silhouettes: dark halo on neighbours, rim on the actor's own edge.
    outline.fill(0);
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
      const i = y * cols + x;
      if (layers[i] !== LAYER.actor) continue;
      // Halo on the sides and above only: a dark band under the feet would cut actors
      // off from the ground and make them look like they float.
      for (let dy = -1; dy <= 0; dy++) {
        const yy = y + dy; if (yy < 0 || yy >= rows) continue;
        for (let dx = -2; dx <= 2; dx++) {
          const xx = x + dx; if (xx < 0 || xx >= cols) continue;
          const j = yy * cols + xx;
          if (layers[j] !== LAYER.actor) { outline[j] = 1; outline[i] = 2; }
        }
      }
    }

    // Height above each object's base, in cells (bottom-up run of solid cells per
    // column). Drives volume shading: dark at the foot, lit toward the top.
    if (this.height.length !== n) this.height = new Uint8Array(n);
    const height = this.height;
    for (let x = 0; x < cols; x++) {
      let run = 0;
      for (let y = rows - 1; y >= 0; y--) {
        const i = y * cols + x; const l = layers[i];
        run = l === LAYER.prop || l === LAYER.actor ? Math.min(255, run + 1) : 0;
        height[i] = run;
      }
    }

    for (let y = 0; y < rows; y++) {
      // Atmospheric depth: the top of the screen is farther away, hazier and darker.
      const depth = .88 + .12 * (y / rows);
      for (let x = 0; x < cols; x++) {
      const i = y * cols + x;
      const layer = layers[i];
      // Light arriving at this cell.
      let lr = ar; let lg = ag; let lb = ab; let sun = L.sun;
      if (layer === LAYER.ground || layer === LAYER.effect) {
        let s = shadow[i] * (1 / 255);
        // Ambient occlusion where the ground meets an object standing above it.
        // A soft 4-cell falloff reads as contact, a 1-cell band reads as an outline.
        if (y > 0 && height[i - cols]) s = Math.max(s, .78);
        else if (y > 1 && height[i - 2 * cols]) s = Math.max(s, .55);
        else if (y > 2 && height[i - 3 * cols]) s = Math.max(s, .32);
        else if (y > 3 && height[i - 4 * cols]) s = Math.max(s, .15);
        sun *= 1 - s; const a = 1 - .55 * s; lr *= a; lg *= a; lb *= a;
      } else {
        // Volume: base in shadow, top catches the sky; lit side vs far side.
        const h = height[i];
        // Gradient over the full storey height so tall facades darken toward the street.
        const up = h < 36 ? h / 36 : 1;
        // Actors stay fully lit so they read as the subject, like the references.
        let e = layer === LAYER.actor ? .3 : up * .75 - .5;
        const lx = x + litSide; const fx = x - litSide;
        const above = y > 0 ? layers[i - cols] : 0;
        if (above !== LAYER.prop && above !== LAYER.actor) e += .55;
        if (lx >= 0 && lx < cols) { const l = layers[i + litSide]; if (l !== LAYER.prop && l !== LAYER.actor) e += .4; }
        if (fx >= 0 && fx < cols) { const l = layers[i - litSide]; if (l !== LAYER.prop && l !== LAYER.actor) e -= .5; }
        sun *= Math.max(0, 1 + e);
        // Objects standing in another object's cast shadow lose direct light too,
        // so walking under a house's shade visibly dims the figure.
        const cast = shadow[i] * (1 / 255) * (layer === LAYER.actor ? .7 : .5);
        sun *= 1 - cast;
        const a = Math.max(.25, 1 + e * .35) * (1 - cast * .4); lr *= a; lg *= a; lb *= a;
      }
      if (layer !== LAYER.actor) { lr *= depth; lg *= depth; lb *= depth; }
      lr += sun * sr; lg += sun * sg; lb += sun * sb;
      if (lights) { lr += this.lightR[i]; lg += this.lightG[i]; lb += this.lightB[i]; }

      // Background: the ground material under everything that is not a solid object.
      let bgDef = defs[layer === LAYER.prop || layer === LAYER.actor ? ids[i] : under[i]];
      let bgFactor = layer === LAYER.prop || layer === LAYER.actor ? .3 : .34;
      if (!bgDef || (bgDef.r === 0 && bgDef.g === 0 && bgDef.b === 0)) { bgDef = defs[0]; bgFactor = 0; }

      const id = ids[i];
      const def = defs[id];
      let fr = 0; let fgc = 0; let fb = 0; let mask = 0;
      if (id && def) {
        mask = def.mask;
        fr = def.r * lr; fgc = def.g * lg; fb = def.b * lb;
        // Ground recedes hard so lit objects and actors carry the picture.
        if (layer === LAYER.ground) {
          const gl = .299 * fr + .587 * fgc + .114 * fb;
          fr = (gl + (fr - gl) * .6) * .4; fgc = (gl + (fgc - gl) * .6) * .4; fb = (gl + (fb - gl) * .6) * .42;
        }
        if (layer === LAYER.effect) { fr = Math.max(fr, def.r * .95); fgc = Math.max(fgc, def.g * .95); fb = Math.max(fb, def.b * .95); }
        if (layer === LAYER.actor) {
          // Mild lift plus extra saturation: the old ×1.4 + rim + bloom burned
          // every costume to white, so NPCs read as ghosts.
          const al = .299 * fr + .587 * fgc + .114 * fb;
          fr = (al + (fr - al) * 1.5) * 1.3 + .03; fgc = (al + (fgc - al) * 1.5) * 1.3 + .03; fb = (al + (fb - al) * 1.5) * 1.3 + .03;
          if (outline[i] === 2) { fr += .1; fgc += .095; fb += .08; }
        }
      }
      let br = bgDef.r * lr * bgFactor; let bgg = bgDef.g * lg * bgFactor; let bb = bgDef.b * lb * bgFactor;
      if (layer === LAYER.prop && id) { fr *= 1.18; fgc *= 1.18; fb *= 1.18; }
      if (outline[i] === 1) { fr *= .55; fgc *= .55; fb *= .6; br *= .5; bgg *= .5; bb *= .55; }
      // Saturation: the references are rich, not grey.
      let lum = .299 * fr + .587 * fgc + .114 * fb;
      fr = lum + (fr - lum) * sat; fgc = lum + (fgc - lum) * sat; fb = lum + (fb - lum) * sat;
      const blum = .299 * br + .587 * bgg + .114 * bb;
      br = blum + (br - blum) * sat; bgg = blum + (bgg - blum) * sat; bb = blum + (bb - blum) * sat;
      // Unlit glyphs drop out, leaving dark negative space in shadow and at night.
      if (lum < .045) mask = 0;
      this.fg[i] = mask ? (mask << 15) | (q5(fr) << 10) | (q5(fgc) << 5) | q5(fb) : 0;
      this.bg[i] = bgFactor ? (q5(br + BG[0] / 255 * .5) << 10) | (q5(bgg + BG[1] / 255 * .5) << 5) | q5(bb + BG[2] / 255 * .5) : bgEmpty;
      }
    }
  }

  private shift2D(buffer: Shiftable, width: number, height: number, dx: number, dy: number, fill: number): void {
    if (dx === 0 && dy === 0) return;
    if (Math.abs(dx) >= width || Math.abs(dy) >= height) { buffer.fill(fill); return; }
    if (dy > 0) { buffer.copyWithin(dy * width, 0, (height - dy) * width); buffer.fill(fill, 0, dy * width); }
    else if (dy < 0) { buffer.copyWithin(0, -dy * width, height * width); buffer.fill(fill, (height + dy) * width, height * width); }
    for (let row = 0; row < height; row++) {
      const start = row * width;
      if (dx > 0) { buffer.copyWithin(start + dx, start, start + width - dx); buffer.fill(fill, start, start + dx); }
      else if (dx < 0) { buffer.copyWithin(start, start - dx, start + width); buffer.fill(fill, start + width + dx, start + width); }
    }
  }

  /** GPU path: compute lit per-cell colours without painting pixels (see gpuPresenter.ts). */
  prepare(ids: Uint32Array, cols: number, rows: number): void {
    if (this.layers.length !== ids.length) { this.layers = new Uint8Array(ids.length); this.under = new Uint32Array(ids.length); this.shadow = new Uint8Array(ids.length); this.outline = new Uint8Array(ids.length); }
    const shadeStart = performance.now();
    this.shade(ids, cols, rows);
    this.shadeMs = performance.now() - shadeStart;
    this.putStart = performance.now();
  }
  /** Packed per-cell colours from the last shade: fg = mask<<15 | rgb555, bg = rgb555. */
  get foreground(): Uint32Array { return this.fg; }
  get background(): Uint16Array { return this.bg; }
  /** True if the id draws no glyph (empty or a space). */
  isBlank(id: number): boolean { return !id || !this.definitions[id] || this.definitions[id].mask === 0; }
  /** Glyph characters by mask index (index 0 is blank). */
  get glyphList(): readonly string[] { return this.glyphChars; }

  present(ctx: CanvasRenderingContext2D, ids: Uint32Array, cols: number, rows: number, scrollX = 0, scrollY = 0): void {
    const width = cols * this.cellWidth; const height = rows * this.cellHeight;
    // A hidden or zero-size window (e.g. during startup) has nothing to present.
    if (!(width > 0 && height > 0)) return;
    if (this.layers.length !== ids.length) { this.layers = new Uint8Array(ids.length); this.under = new Uint32Array(ids.length); this.shadow = new Uint8Array(ids.length); this.outline = new Uint8Array(ids.length); }
    const shadeStart = performance.now();
    this.shade(ids, cols, rows);
    this.shadeMs = performance.now() - shadeStart;

    const resized = !this.output || this.output.width !== width || this.output.height !== height;
    const tileSize = 48;
    const tileCols = Math.ceil(cols / tileSize); const tileRows = Math.ceil(rows / tileSize);
    if (this.dirtyTiles.length !== tileCols * tileRows) this.dirtyTiles = new Uint8Array(tileCols * tileRows);
    let fullRedraw = resized;
    const emptyPixel = 0xff000000 | (BG[2] << 16) | (BG[1] << 8) | BG[0];
    if (resized) {
      this.output = ctx.createImageData(width, height);
      this.outputPixels = new Uint32Array(this.output.data.buffer);
      this.previousFg = new Uint32Array(ids.length).fill(0xffffffff);
      this.previousBg = new Uint16Array(ids.length).fill(0xffff);
    } else if (this.previousFg.length === ids.length && this.previousCols === cols && this.previousRows === rows &&
      this.previousCellWidth === this.cellWidth && this.previousCellHeight === this.cellHeight) {
      // Camera moved by whole cells: slide what is already drawn instead of redrawing it.
      this.shift2D(this.previousFg, cols, rows, scrollX, scrollY, 0xffffffff);
      this.shift2D(this.previousBg, cols, rows, scrollX, scrollY, 0xffff);
      this.shift2D(this.outputPixels, width, height, scrollX * this.cellWidth, scrollY * this.cellHeight, emptyPixel);
      if (scrollX || scrollY) fullRedraw = true; // whole image moved; one put is cheaper than many tiles
    } else {
      fullRedraw = true;
      this.previousFg = new Uint32Array(ids.length).fill(0xffffffff);
      this.previousBg = new Uint16Array(ids.length).fill(0xffff);
    }
    this.previousCols = cols; this.previousRows = rows;
    this.previousCellWidth = this.cellWidth; this.previousCellHeight = this.cellHeight;

    const cw = this.cellWidth; const ch = this.cellHeight;
    const out = this.outputPixels; const fgs = this.fg; const bgs = this.bg;
    this.dirtyTiles.fill(0);
    this.changedCells = 0;
    for (let i = 0; i < ids.length; i++) {
      const f = fgs[i]; const b = bgs[i];
      if (this.previousFg[i] === f && this.previousBg[i] === b) continue;
      this.previousFg[i] = f; this.previousBg[i] = b; this.changedCells++;
      const cellX = i % cols; const cellY = (i / cols) | 0;
      this.dirtyTiles[((cellY / tileSize) | 0) * tileCols + ((cellX / tileSize) | 0)] = 1;
      const br = EXPAND[(b >> 10) & 31]; const bgc = EXPAND[(b >> 5) & 31]; const bb = EXPAND[b & 31];
      const bgPixel = 0xff000000 | (bb << 16) | (bgc << 8) | br;
      const origin = cellY * ch * width + cellX * cw;
      const maskIndex = f >>> 15;
      if (!maskIndex) {
        for (let y = 0; y < ch; y++) out.fill(bgPixel, origin + y * width, origin + y * width + cw);
        continue;
      }
      const m = this.mask(maskIndex);
      const fr = EXPAND[(f >> 10) & 31]; const fgc = EXPAND[(f >> 5) & 31]; const fb = EXPAND[f & 31];
      for (let y = 0; y < ch; y++) {
        const row = origin + y * width; const src = y * cw;
        for (let x = 0; x < cw; x++) {
          const a = m[src + x];
          if (a === 0) { out[row + x] = bgPixel; continue; }
          const r = br + (((fr - br) * a) >> 8); const g = bgc + (((fgc - bgc) * a) >> 8); const bl = bb + (((fb - bb) * a) >> 8);
          out[row + x] = 0xff000000 | (bl << 16) | (g << 8) | r;
        }
      }
    }
    this.putStart = performance.now();
    if (!this.output || (!this.changedCells && !fullRedraw)) return;
    if (fullRedraw) { ctx.putImageData(this.output, 0, 0); return; }
    // One upload per horizontal run of dirty tiles: far fewer calls than per tile.
    for (let ty = 0; ty < tileRows; ty++) {
      let tx = 0;
      while (tx < tileCols) {
        if (!this.dirtyTiles[ty * tileCols + tx]) { tx++; continue; }
        const startX = tx;
        while (tx < tileCols && this.dirtyTiles[ty * tileCols + tx]) tx++;
        ctx.putImageData(this.output, 0, 0, startX * tileSize * cw, ty * tileSize * ch,
          (Math.min(cols, tx * tileSize) - startX * tileSize) * cw, Math.min(tileSize, rows - ty * tileSize) * ch);
      }
    }
  }
}
