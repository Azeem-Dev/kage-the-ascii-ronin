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
        tFg: { value: null }, tBg: { value: null }, tAtlas: { value: null },
        grid: { value: new THREE.Vector2(1, 1) }, atlasGrid: { value: new THREE.Vector2(ATLAS_COLUMNS, 1) },
      },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }',
      fragmentShader: `
        uniform sampler2D tFg; uniform sampler2D tBg; uniform sampler2D tAtlas; uniform vec2 grid; uniform vec2 atlasGrid;
        varying vec2 vUv;
        void main(){
          vec2 p = vec2(vUv.x, 1. - vUv.y) * grid;           // row 0 at the top, like the CPU grid
          vec2 cell = floor(p); vec2 local = fract(p);
          vec2 tc = (cell + .5) / grid;
          vec4 f = texture2D(tFg, tc); vec4 b = texture2D(tBg, tc);
          float index = floor(f.a * 255. + .5) + floor(b.a * 255. + .5) * 256.;
          float mask = 0.;
          if (index > .5) {
            vec2 a = vec2(mod(index, atlasGrid.x), floor(index / atlasGrid.x));
            mask = texture2D(tAtlas, vec2((a.x + local.x) / atlasGrid.x, 1. - (a.y + local.y) / atlasGrid.y)).r;
          }
          vec3 srgb = mix(b.rgb, f.rgb, mask);
          gl_FragColor = vec4(pow(srgb, vec3(2.2)), 1.);   // linear for bloom; OutputPass re-encodes
        }`,
      depthTest: false, depthWrite: false,
    });
    this.scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.material));
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    // Only genuinely bright cells (fire, lamps, lit windows, glints, rim light) glow.
    this.bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), .55, .5, .42);
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

  present(source: AssetRenderer, cols: number, rows: number): void {
    const width = cols * source.cellWidth; const height = rows * source.cellHeight;
    if (!(width > 0 && height > 0)) return;
    if (width !== this.width || height !== this.height) {
      this.width = width; this.height = height;
      this.renderer.setSize(width, height, false);
      this.composer.setSize(width, height);
      this.bloom.resolution.set(width / 2, height / 2);
    }
    if (!this.fgTexture || this.fgTexture.image.width !== cols || this.fgTexture.image.height !== rows) {
      this.fgTexture?.dispose(); this.bgTexture?.dispose();
      this.fgData = new Uint8Array(new ArrayBuffer(cols * rows * 4)); this.bgData = new Uint8Array(new ArrayBuffer(cols * rows * 4));
      const make = (data: Uint8Array<ArrayBuffer>) => {
        const t = new THREE.DataTexture(data, cols, rows, THREE.RGBAFormat, THREE.UnsignedByteType);
        t.minFilter = THREE.NearestFilter; t.magFilter = THREE.NearestFilter; t.generateMipmaps = false;
        return t;
      };
      this.fgTexture = make(this.fgData); this.bgTexture = make(this.bgData);
      this.material.uniforms.tFg.value = this.fgTexture; this.material.uniforms.tBg.value = this.bgTexture;
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
    this.fgTexture.needsUpdate = true; this.bgTexture!.needsUpdate = true;
    this.composer.render();
  }
}
