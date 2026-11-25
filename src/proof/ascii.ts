/**
 * The single GPU ASCII pass: the lit scene → one glyph per cell.
 * The scene target is exactly 2×2 texels per glyph cell, so when the camera moves by whole
 * cells the scene shifts by whole texels and static things rasterise identically (no shimmer).
 * Glyph density from brightness, edge glyphs from the luminance gradient, colour from the scene.
 */
import * as THREE from 'three';

const RAMP = ' .\'`,:;-~+=*ixnoesCOQ#%@';
const EDGES = '|/-\\';

export interface AsciiPass {
  /** Render target the 3D scene must be drawn into (recreated on resize). */
  target(): THREE.WebGLRenderTarget;
  /** Call on window resize or cell change; w/h in device pixels. */
  resize(w: number, h: number): void;
  /** Draw the glyph image to the screen. */
  render(renderer: THREE.WebGLRenderer): void;
  /** Grow (+1) or shrink (-1) glyph cells; call resize() afterwards. */
  changeCell(step: number): void;
  toggle(): void;
  /** Cell size in device pixels (main.ts snaps the camera to it). */
  cell(): { w: number; h: number };
  /** Grid of cells covering the screen; the camera frustum must cover cols*cellW × rows*cellH px. */
  grid(): { cols: number; rows: number };
}

export function createAsciiPass(dpr: number): AsciiPass {
  let cellW = Math.round(5 * dpr); let cellH = Math.round(8 * dpr);
  let cols = 1; let rows = 1;
  let glyphTex: THREE.CanvasTexture | null = null;
  let target = new THREE.WebGLRenderTarget(2, 2, { type: THREE.HalfFloatType });

  const makeGlyphs = (): THREE.CanvasTexture => {
    const chars = RAMP + EDGES;
    const c = document.createElement('canvas'); c.width = cellW * chars.length; c.height = cellH;
    const g = c.getContext('2d')!;
    g.fillStyle = '#000'; g.fillRect(0, 0, c.width, c.height);
    g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = `bold ${Math.round(cellH * 1.05)}px Consolas, "DejaVu Sans Mono", "Courier New", monospace`;
    for (let i = 0; i < chars.length; i++) g.fillText(chars[i], i * cellW + cellW / 2, cellH * .55);
    const t = new THREE.CanvasTexture(c); t.minFilter = THREE.NearestFilter; t.magFilter = THREE.NearestFilter; t.generateMipmaps = false;
    return t;
  };

  const mat = new THREE.ShaderMaterial({
    uniforms: {
      tScene: { value: null }, tGlyphs: { value: null }, res: { value: new THREE.Vector2() }, cell: { value: new THREE.Vector2() },
      grid: { value: new THREE.Vector2(1, 1) },
      rampN: { value: RAMP.length }, total: { value: RAMP.length + EDGES.length }, ascii: { value: 1 },
    },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }',
    fragmentShader: `
      uniform sampler2D tScene; uniform sampler2D tGlyphs; uniform vec2 res; uniform vec2 cell; uniform vec2 grid;
      uniform float rampN; uniform float total; uniform float ascii;
      varying vec2 vUv;
      vec3 aces(vec3 x){ return clamp((x * (2.51 * x + .03)) / (x * (2.43 * x + .59) + .14), 0., 1.); }
      vec3 tone(vec3 s){ return pow(aces(s * 2.2), vec3(1. / 2.2)); }
      vec3 sceneAt(vec2 c){              // exact average of the cell's 2×2 texels, tone-mapped
        vec2 uv = (c + .5) / grid; vec2 o = .25 / grid;
        vec3 s = texture2D(tScene, uv + vec2(-o.x, -o.y)).rgb + texture2D(tScene, uv + vec2(o.x, -o.y)).rgb
               + texture2D(tScene, uv + vec2(-o.x, o.y)).rgb + texture2D(tScene, uv + vec2(o.x, o.y)).rgb;
        return tone(s * .25);
      }
      float lumOf(vec3 c){ return dot(c, vec3(.299, .587, .114)); }
      void main(){
        vec2 px = vUv * res;
        if (ascii < .5) { gl_FragColor = vec4(tone(texture2D(tScene, px / (grid * cell)).rgb), 1.); return; }
        vec2 c = floor(px / cell); vec2 local = fract(px / cell);
        vec3 col = sceneAt(c);
        float l = lumOf(col);
        float lx = lumOf(sceneAt(c + vec2(1., 0.))) - lumOf(sceneAt(c - vec2(1., 0.)));
        float ly = lumOf(sceneAt(c + vec2(0., 1.))) - lumOf(sceneAt(c - vec2(0., 1.)));
        float g = length(vec2(lx, ly));
        float index;
        if (g > .2 && l > .12) {
          float a = atan(ly, lx);
          float k = mod(floor((a / 3.14159265) * 4. + .5), 4.);
          index = rampN + (k < .5 ? 0. : k < 1.5 ? 1. : k < 2.5 ? 2. : 3.);
        } else {
          index = l < .085 ? 0. : floor(clamp(pow(l, .65) * 1.25, 0., .999) * rampN);
        }
        float m = texture2D(tGlyphs, vec2((index + local.x) / total, 1. - local.y)).r;
        vec3 vivid = col / max(max(col.r, col.g), max(col.b, .04)) * (.3 + 1.05 * sqrt(l));
        gl_FragColor = vec4(min(vivid, vec3(1.)) * m, 1.);
      }`,
    depthTest: false, depthWrite: false,
  });
  const post = new THREE.Scene(); const postCam = new THREE.Camera();
  post.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat));

  return {
    target: () => target,
    resize(w, h) {
      cols = Math.ceil(w / cellW); rows = Math.ceil(h / cellH);
      target.dispose();
      target = new THREE.WebGLRenderTarget(cols * 2, rows * 2, { type: THREE.HalfFloatType });
      target.texture.minFilter = THREE.NearestFilter; target.texture.magFilter = THREE.NearestFilter;
      glyphTex?.dispose(); glyphTex = makeGlyphs();
      mat.uniforms.tScene.value = target.texture; mat.uniforms.tGlyphs.value = glyphTex;
      mat.uniforms.res.value.set(w, h); mat.uniforms.cell.value.set(cellW, cellH); mat.uniforms.grid.value.set(cols, rows);
    },
    render(renderer) { renderer.setRenderTarget(null); renderer.render(post, postCam); },
    changeCell(step) { cellW = Math.max(3, cellW + step); cellH = Math.max(5, Math.round(cellW * 1.6)); },
    toggle() { mat.uniforms.ascii.value = 1 - mat.uniforms.ascii.value; },
    cell: () => ({ w: cellW, h: cellH }),
    grid: () => ({ cols, rows }),
  };
}
