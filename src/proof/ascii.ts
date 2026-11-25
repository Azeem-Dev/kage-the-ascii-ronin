/**
 * The single GPU ASCII pass: the lit scene (rendered to a HalfFloat target) → one glyph per cell.
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
  /** Grow (+1) or shrink (-1) glyph cells. */
  changeCell(step: number): void;
  toggle(): void;
  /** Cell size in device pixels (main.ts snaps the camera to it). */
  cell(): { w: number; h: number };
}

export function createAsciiPass(dpr: number): AsciiPass {
  let cellW = Math.round(5 * dpr); let cellH = Math.round(8 * dpr);
  let glyphTex: THREE.CanvasTexture | null = null;
  let target = new THREE.WebGLRenderTarget(2, 2, { type: THREE.HalfFloatType });
  let size = { w: 2, h: 2 };

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
      rampN: { value: RAMP.length }, total: { value: RAMP.length + EDGES.length }, ascii: { value: 1 },
    },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }',
    fragmentShader: `
      uniform sampler2D tScene; uniform sampler2D tGlyphs; uniform vec2 res; uniform vec2 cell;
      uniform float rampN; uniform float total; uniform float ascii;
      varying vec2 vUv;
      vec3 aces(vec3 x){ return clamp((x * (2.51 * x + .03)) / (x * (2.43 * x + .59) + .14), 0., 1.); }
      vec3 sceneAt(vec2 c){              // average colour of one cell (5 taps), tone-mapped to display
        vec2 o = cell / res;
        vec2 uv = (c + .5) * o;
        vec3 s = texture2D(tScene, uv).rgb * .4
          + texture2D(tScene, uv + o * vec2(-.25, -.25)).rgb * .15 + texture2D(tScene, uv + o * vec2(.25, -.25)).rgb * .15
          + texture2D(tScene, uv + o * vec2(-.25, .25)).rgb * .15 + texture2D(tScene, uv + o * vec2(.25, .25)).rgb * .15;
        return pow(aces(s * 2.2), vec3(1. / 2.2));
      }
      float lumOf(vec3 c){ return dot(c, vec3(.299, .587, .114)); }
      void main(){
        vec2 px = vUv * res;
        if (ascii < .5) { gl_FragColor = vec4(pow(aces(texture2D(tScene, vUv).rgb * 2.2), vec3(1. / 2.2)), 1.); return; }
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

  const pass: AsciiPass = {
    target: () => target,
    resize(w, h) {
      size = { w, h };
      target.dispose();
      target = new THREE.WebGLRenderTarget(Math.ceil(w / 2), Math.ceil(h / 2), { type: THREE.HalfFloatType });
      target.texture.minFilter = THREE.LinearFilter;
      glyphTex?.dispose(); glyphTex = makeGlyphs();
      mat.uniforms.tScene.value = target.texture; mat.uniforms.tGlyphs.value = glyphTex;
      mat.uniforms.res.value.set(w, h); mat.uniforms.cell.value.set(cellW, cellH);
    },
    render(renderer) { renderer.setRenderTarget(null); renderer.render(post, postCam); },
    changeCell(step) {
      cellW = Math.max(3, cellW + step); cellH = Math.max(5, Math.round(cellW * 1.6));
      pass.resize(size.w, size.h);
    },
    toggle() { mat.uniforms.ascii.value = 1 - mat.uniforms.ascii.value; },
    cell: () => ({ w: cellW, h: cellH }),
  };
  return pass;
}
