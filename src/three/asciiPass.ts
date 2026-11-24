import * as THREE from 'three';

/** Glyphs ordered by ink density, darkest first. */
const RAMP = " .,:;-~=+*xo#%@";
/** Edge glyphs, appended to the atlas after the ramp: horizontal, /, vertical, \. */
const EDGES = "-/|\\";
const ATLAS = RAMP + EDGES;

/**
 * Renders the 3D scene into a small target (2 samples per glyph cell each way),
 * then draws every cell as one glyph: brightness picks the glyph, the scene colour
 * tints it. Dark cells stay empty, which gives the references' negative space.
 */
export class AsciiPass {
  cols = 1; rows = 1;
  private target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });
  private quadScene = new THREE.Scene();
  private quadCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private material: THREE.ShaderMaterial;
  /** Glyph cell size in CSS pixels. */
  cellWidth = 7; cellHeight = 12;

  constructor(private renderer: THREE.WebGLRenderer) {
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        tScene: { value: this.target.texture },
        tGlyphs: { value: this.atlas() },
        grid: { value: new THREE.Vector2(1, 1) },
        glyphCount: { value: RAMP.length },
        atlasCount: { value: ATLAS.length },
        exposure: { value: 1.7 },
      },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }',
      fragmentShader: `
        uniform sampler2D tScene; uniform sampler2D tGlyphs; uniform vec2 grid; uniform float glyphCount; uniform float atlasCount; uniform float exposure;
        varying vec2 vUv;
        vec3 aces(vec3 x){ return clamp((x*(2.51*x+.03))/(x*(2.43*x+.59)+.14), 0., 1.); }
        vec3 sceneAt(vec2 cell){ return pow(aces(texture2D(tScene, (cell + .5) / grid).rgb * exposure), vec3(1. / 2.2)); }
        float L(vec3 c){ return dot(c, vec3(.299, .587, .114)); }
        void main(){
          vec2 cell = floor(vUv * grid);
          vec2 local = fract(vUv * grid);
          vec3 c = sceneAt(cell);
          float lum = L(c);
          // Glyph by brightness; a slight curve keeps mid-tones textured.
          float g = clamp(floor(pow(lum, .8) * glyphCount * 1.2), 0., glyphCount - 1.);
          // Silhouette and facet edges become line glyphs oriented along the edge.
          float gx = L(sceneAt(cell + vec2(1., 0.))) - L(sceneAt(cell - vec2(1., 0.)));
          float gy = L(sceneAt(cell + vec2(0., 1.))) - L(sceneAt(cell - vec2(0., 1.)));
          float edge = length(vec2(gx, gy));
          float boost = 1.;
          if (edge > .11) {
            float a = mod(atan(gy, gx) + 3.14159265 / 8., 3.14159265); // edge normal angle
            // Normal angle -> the glyph that runs along the edge.
            float dir = floor(a / (3.14159265 / 4.));
            g = glyphCount + mod(dir + 2., 4.);
            boost = 1.35;
          }
          float mask = texture2D(tGlyphs, vec2((g + local.x) / atlasCount, local.y)).r;
          // Keep hue, lift brightness so lit glyphs read strongly against the dark.
          vec3 ink = c / max(lum, .04) * clamp((lum * 1.7 + .14) * boost, 0., 1.35);
          vec3 back = c * .08;
          gl_FragColor = vec4(mix(back, ink, mask), 1.);
        }`,
      depthTest: false, depthWrite: false,
    });
    this.quadScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.material));
  }

  private atlas(): THREE.Texture {
    const cw = 24; const ch = 40;
    const canvas = document.createElement('canvas');
    canvas.width = cw * ATLAS.length; canvas.height = ch;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `bold ${ch * .9}px Consolas, "DejaVu Sans Mono", monospace`;
    for (let i = 0; i < ATLAS.length; i++) ctx.fillText(ATLAS[i], i * cw + cw / 2, ch * .54);
    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter; texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = false;
    return texture;
  }

  resize(width: number, height: number, _pixelRatio: number): void {
    // Phones get slightly larger cells so glyphs stay legible.
    const coarse = Math.min(width, height) < 600;
    this.cellWidth = coarse ? 6 : 7; this.cellHeight = coarse ? 10 : 12;
    this.cols = Math.ceil(width / this.cellWidth); this.rows = Math.ceil(height / this.cellHeight);
    this.target.setSize(this.cols * 2, this.rows * 2);
    (this.material.uniforms.grid.value as THREE.Vector2).set(this.cols, this.rows);
  }

  /** Debug: draw the plain 3D render (?raw=1) to separate art problems from shader problems. */
  raw = new URLSearchParams(location.search).has('raw');

  render(scene: THREE.Scene, camera: THREE.Camera): void {
    if (this.raw) { this.renderer.setRenderTarget(null); this.renderer.render(scene, camera); return; }
    this.renderer.setRenderTarget(this.target);
    this.renderer.render(scene, camera);
    this.renderer.setRenderTarget(null);
    this.renderer.render(this.quadScene, this.quadCamera);
  }
}
