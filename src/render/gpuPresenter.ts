import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import type { AssetRenderer } from './assetRenderer.ts';

const ATLAS_COLUMNS = 32;
/** 5-bit channel -> 8-bit. */
const EXPAND = Uint8Array.from({ length: 32 }, (_, i) => Math.round(i * 255 / 31));

/**
 * Draws the 2D glyph frame on the GPU with Three.js. The game still decides every
 * cell's glyph and lit colours (AssetRenderer.prepare); this only paints them:
 * crisp glyphs from an atlas at exact cell size, then soft bloom on bright light.
 */
export class GpuPresenter {
  readonly canvas: HTMLCanvasElement;
  private renderer: THREE.WebGLRenderer;
  private composer: EffectComposer;
  private bloom: UnrealBloomPass;
  private scene = new THREE.Scene();
  private camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private material: THREE.ShaderMaterial;
  private fgTexture: THREE.DataTexture | null = null;
  private bgTexture: THREE.DataTexture | null = null;
  private infoTexture: THREE.DataTexture | null = null;
  private infoData = new Uint8Array(new ArrayBuffer(0));
  private fgData = new Uint8Array(new ArrayBuffer(0));
  private bgData = new Uint8Array(new ArrayBuffer(0));
  private atlas: THREE.CanvasTexture | null = null;
  private atlasGlyphs = 0; private atlasCellW = 0; private atlasCellH = 0;
  private width = 0; private height = 0;

  constructor() {
    this.canvas = document.createElement('canvas');
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: false, alpha: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(1); // the canvas is already sized in device pixels
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        tFg: { value: null }, tBg: { value: null }, tAtlas: { value: null }, tInfo: { value: null },
        time: { value: 0 }, night: { value: 0 }, moonX: { value: .68 },
        debugWater: { value: new URLSearchParams(location.search).get('debug') === 'water' ? 1 : 0 },
        snowCover: { value: 0 }, flash: { value: 0 }, camCell: { value: new THREE.Vector2() },
        grid: { value: new THREE.Vector2(1, 1) }, atlasGrid: { value: new THREE.Vector2(ATLAS_COLUMNS, 1) },
      },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }',
      fragmentShader: `
        uniform sampler2D tFg; uniform sampler2D tBg; uniform sampler2D tAtlas; uniform sampler2D tInfo; uniform vec2 grid; uniform vec2 atlasGrid;
        uniform float time; uniform float night; uniform float moonX; uniform float debugWater;
        uniform float snowCover; uniform float flash; uniform vec2 camCell;
        varying vec2 vUv;
        float glyphMask(vec4 f, vec4 b, vec2 local){
          float index = floor(f.a * 255. + .5) + floor(b.a * 255. + .5) * 256.;
          if (index < .5) return 0.;
          vec2 a = vec2(mod(index, atlasGrid.x), floor(index / atlasGrid.x));
          return texture2D(tAtlas, vec2((a.x + local.x) / atlasGrid.x, 1. - (a.y + local.y) / atlasGrid.y)).r;
        }
        float layerAt(vec2 cell){ return floor(texture2D(tInfo, (cell + .5) / grid).r * 255. / 50. + .5); }
        float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        void main(){
          vec2 p = vec2(vUv.x, 1. - vUv.y) * grid;           // row 0 at the top, like the CPU grid
          vec2 cell = floor(p); vec2 local = fract(p);
          vec2 tc = (cell + .5) / grid;
          vec4 f = texture2D(tFg, tc); vec4 b = texture2D(tBg, tc);
          vec4 info = texture2D(tInfo, tc);
          float mask = glyphMask(f, b, local);
          // Ink follows light: dim cells keep only the strongest strokes, lit cells show the whole glyph.
          // This gives shadows sparse glyphs and highlights dense ones, like a real ASCII shading ramp.
          float inkLum = dot(f.rgb, vec3(.299, .587, .114));
          float cover = clamp(inkLum * 1.9 + .2, 0., 1.);
          float thr = (1. - cover) * .8;
          mask = smoothstep(thr, thr + .22, mask);
          vec3 srgb = mix(b.rgb, f.rgb, mask);
          float layer = floor(info.r * 255. / 50. + .5);
          // Water: mirrored, rippling reflections of whatever stands above, plus a moon path.
          if (info.g > .5 && (layer < .5 || layer > 3.5)) {
            float base = 0.;
            for (int k = 1; k <= 16; k++) {
              vec2 q = cell - vec2(0., float(k));
              if (q.y < 0.) break;
              float l = layerAt(q);
              if (l > 1.5 && l < 3.5) { base = float(k); break; }
            }
            if (base > 0.) {
              // Slow, gentle ripple: rows shift by at most one cell, so the reflection stays a calm image.
              float wobble = sin(cell.y * .35 + time * 1.1) * .62;
              // Squash the mirror image (reads as water, not a second object) and cut it with ripple bands.
              vec2 src = vec2(cell.x + floor(wobble + .5), cell.y - base - floor((base - 1.) * 1.6));
              float l = layerAt(src);
              float rippleGap = step(.45, sin(cell.y * 1.9 + time * 1.3 + sin(cell.x * .15) * 1.5));
              if (src.y >= 0. && l > 1.5 && l < 3.5 && rippleGap < .5) {
                vec2 stc = (src + .5) / grid;
                vec4 sf = texture2D(tFg, stc); vec4 sb = texture2D(tBg, stc);
                float sm = glyphMask(sf, sb, vec2(local.x, 1. - local.y));   // upside down
                float fade = clamp(1. - base / 16., 0., 1.);
                vec3 tint = vec3(.5, .62, .8);
                // Dark water reflection: about half brightness, fading quickly with depth.
                srgb = mix(srgb, mix(sb.rgb * .3, sf.rgb * tint * .5, sm), .75 * fade);
                srgb.g += debugWater * .5;
              }
            }
            srgb.r += debugWater * .25;
            // Moon path: a shimmering band of glints across the current at night.
            float band = exp(-pow((cell.x / grid.x - moonX) * 11., 2.));
            float glint = step(.86, hash(vec2(cell.x, cell.y + floor(time * 5. + cell.x * .3))));
            srgb += vec3(.62, .68, .8) * glint * band * night * .9;
            srgb += vec3(.05, .07, .11) * band * night;
          }
          // Snow settles in world-anchored patches on the ground and on the tops of props (roofs).
          if (snowCover > .01 && info.g < .5) {
            float n = hash(cell + camCell);
            float lumHere = dot(srgb, vec3(.299, .587, .114));
            vec3 snowColor = vec3(.78, .84, .94) * (.75 + lumHere);
            if (layer < .5 && n < snowCover * 1.1) srgb = mix(srgb, snowColor, .55 + .35 * mask);
            else if (layer > 1.5 && layer < 2.5) {
              float above = layerAt(cell - vec2(0., 1.)); float above2 = layerAt(cell - vec2(0., 2.));
              if (above < 1.5 || above > 2.5) srgb = mix(srgb, snowColor * 1.1, snowCover * .9);
              else if (above2 < 1.5 || above2 > 2.5) srgb = mix(srgb, snowColor, snowCover * .5);
            }
          }
          // Glyph strokes cover only part of a cell, so lift mid-tones to keep colours rich, not muddy.
          srgb = pow(clamp(srgb, 0., 1.), vec3(.78)) * 1.12;
          // Lightning lights everything for an instant, strongest on what was already lit.
          srgb += flash * vec3(.5, .55, .68) * (.25 + dot(srgb, vec3(.333)));
          gl_FragColor = vec4(pow(srgb, vec3(2.2)), 1.);   // linear for bloom; OutputPass re-encodes
        }`,
      depthTest: false, depthWrite: false,
    });
    this.scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.material));
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    // Only genuinely bright cells (fire, lamps, lit windows, glints, rim light) glow.
    this.bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), .28, .4, .78);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
  }

  /** Glyph atlas at the exact device cell size; rebuilt when glyphs are added or zoom changes. */
  private updateAtlas(glyphs: readonly string[], cw: number, ch: number): void {
    if (this.atlas && glyphs.length === this.atlasGlyphs && cw === this.atlasCellW && ch === this.atlasCellH) return;
    const rowsNeeded = Math.max(1, Math.ceil(glyphs.length / ATLAS_COLUMNS));
    const canvas = this.atlas?.image as HTMLCanvasElement | undefined ?? document.createElement('canvas');
    canvas.width = ATLAS_COLUMNS * cw; canvas.height = rowsNeeded * ch;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    // Same face and placement as the CPU rasterizer, so both paths match.
    ctx.font = `${ch <= 9 ? 'bold ' : ''}${Math.round(ch * 1.02)}px Consolas, "DejaVu Sans Mono", "Courier New", monospace`;
    for (let i = 1; i < glyphs.length; i++) {
      const x = (i % ATLAS_COLUMNS) * cw; const y = Math.floor(i / ATLAS_COLUMNS) * ch;
      ctx.save(); ctx.beginPath(); ctx.rect(x, y, cw, ch); ctx.clip();
      ctx.fillText(glyphs[i], x + cw / 2, y + ch * .8);
      ctx.restore();
    }
    this.atlas?.dispose();
    this.atlas = new THREE.CanvasTexture(canvas);
    this.atlas.minFilter = THREE.NearestFilter; this.atlas.magFilter = THREE.NearestFilter; this.atlas.generateMipmaps = false;
    this.material.uniforms.tAtlas.value = this.atlas;
    (this.material.uniforms.atlasGrid.value as THREE.Vector2).set(ATLAS_COLUMNS, rowsNeeded);
    this.atlasGlyphs = glyphs.length; this.atlasCellW = cw; this.atlasCellH = ch;
  }

  /**
   * @param water 1 per river cell (TerrainLayer.waterMask), same layout as the cell grid.
   * @param night 0 = full day, 1 = full night (drives the moon path).
   */
  present(source: AssetRenderer, cols: number, rows: number, water: Uint8Array, time: number, night: number,
    fx: { snowCover: number; flash: number; camCellX: number; camCellY: number } = { snowCover: 0, flash: 0, camCellX: 0, camCellY: 0 }): void {
    this.material.uniforms.snowCover.value = fx.snowCover; this.material.uniforms.flash.value = fx.flash;
    (this.material.uniforms.camCell.value as THREE.Vector2).set(fx.camCellX, fx.camCellY);
    const width = cols * source.cellWidth; const height = rows * source.cellHeight;
    if (!(width > 0 && height > 0)) return;
    if (width !== this.width || height !== this.height) {
      this.width = width; this.height = height;
      this.renderer.setSize(width, height, false);
      this.composer.setSize(width, height);
      this.bloom.resolution.set(width / 2, height / 2);
    }
    if (!this.fgTexture || this.fgTexture.image.width !== cols || this.fgTexture.image.height !== rows) {
      this.fgTexture?.dispose(); this.bgTexture?.dispose(); this.infoTexture?.dispose();
      this.fgData = new Uint8Array(new ArrayBuffer(cols * rows * 4)); this.bgData = new Uint8Array(new ArrayBuffer(cols * rows * 4));
      this.infoData = new Uint8Array(new ArrayBuffer(cols * rows * 4));
      const make = (data: Uint8Array<ArrayBuffer>) => {
        const t = new THREE.DataTexture(data, cols, rows, THREE.RGBAFormat, THREE.UnsignedByteType);
        t.minFilter = THREE.NearestFilter; t.magFilter = THREE.NearestFilter; t.generateMipmaps = false;
        return t;
      };
      this.fgTexture = make(this.fgData); this.bgTexture = make(this.bgData); this.infoTexture = make(this.infoData);
      this.material.uniforms.tFg.value = this.fgTexture; this.material.uniforms.tBg.value = this.bgTexture;
      this.material.uniforms.tInfo.value = this.infoTexture;
      (this.material.uniforms.grid.value as THREE.Vector2).set(cols, rows);
    }
    this.updateAtlas(source.glyphList, source.cellWidth, source.cellHeight);
    // Unpack the CPU's packed cell colours into two RGBA textures (mask index split across alphas).
    const fg = source.foreground; const bg = source.background; const fd = this.fgData; const bd = this.bgData;
    for (let i = 0, o = 0; i < fg.length; i++, o += 4) {
      const f = fg[i]; const b = bg[i]; const mask = f >>> 15;
      fd[o] = EXPAND[(f >> 10) & 31]; fd[o + 1] = EXPAND[(f >> 5) & 31]; fd[o + 2] = EXPAND[f & 31]; fd[o + 3] = mask & 255;
      bd[o] = EXPAND[(b >> 10) & 31]; bd[o + 1] = EXPAND[(b >> 5) & 31]; bd[o + 2] = EXPAND[b & 31]; bd[o + 3] = mask >> 8;
    }
    // Per-cell layer and water flag for reflections.
    const layers = source.layers; const info = this.infoData; const hasWater = water.length === fg.length;
    for (let i = 0, o = 0; i < fg.length; i++, o += 4) { info[o] = layers[i] * 50; info[o + 1] = hasWater && water[i] ? 255 : 0; }
    this.infoTexture!.needsUpdate = true;
    this.material.uniforms.time.value = time; this.material.uniforms.night.value = night;
    this.fgTexture.needsUpdate = true; this.bgTexture!.needsUpdate = true;
    this.composer.render();
  }
}
