/**
 * 3D-models + ASCII scene (/proof.html): real low-poly models in a three.js scene, then ONE GPU
 * ASCII pass over the whole image. The old glyph game at / is untouched.
 *
 * Views (V cycles): isometric (fixed orthographic, snapped to whole glyph cells), top-down
 * (steep orthographic, snapped), third-person (perspective behind the hero, drag to orbit).
 *
 * Owner of each module (see artifacts/agents/README.md, round 3):
 *   main.ts (renderer, cameras, loop, input, HUD) + assets.ts: Claude
 *   ascii.ts: Agent I · world.ts: Agent J · actors.ts: Agent K
 */
import * as THREE from 'three';
import { createAsciiPass } from './ascii';
import { createWorld } from './world';
import { createActors } from './actors';

const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
const dpr = Math.min(2, devicePixelRatio || 1);
renderer.setPixelRatio(1);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const ascii = createAsciiPass(dpr);
const world = createWorld(scene);
const actors = createActors(scene);

/* ------------------------------------------------------------------ cameras and views */
type View = 'isometric' | 'top-down' | 'third-person';
const VIEWS: View[] = ['isometric', 'top-down', 'third-person'];
const params = new URLSearchParams(location.search);
let view: View = VIEWS.includes(params.get('view') as View) ? params.get('view') as View : 'isometric';
const snapCamera = !params.has('nosnap');                   // ?nosnap = sliding camera, for comparison

const ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, -200, 400);
const persp = new THREE.PerspectiveCamera(50, 1, .1, 600);
const ORTHO_DIR: Record<'isometric' | 'top-down', THREE.Vector3> = {
  isometric: new THREE.Vector3(1, .82, 1).normalize(),     // ~30° down, diagonal
  'top-down': new THREE.Vector3(.35, 2.6, .35).normalize(), // ~70° down
};
let viewSize = 16;            // ortho: world units visible vertically
let chaseDist = 7;            // third person: camera distance behind the hero
let chaseYaw = Math.PI;       // third person: orbit angle (dragging the mouse changes it)
let chasePitch = .32;
const camTarget = new THREE.Vector3();
const snapped = new THREE.Vector3();
const camRight = new THREE.Vector3(); const camUp = new THREE.Vector3();
const activeCamera = (): THREE.Camera => (view === 'third-person' ? persp : ortho);

function resize(): void {
  const w = Math.floor(innerWidth * dpr); const h = Math.floor(innerHeight * dpr);
  renderer.setSize(w, h, false);
  renderer.domElement.style.width = innerWidth + 'px'; renderer.domElement.style.height = innerHeight + 'px';
  ascii.resize(w, h);
  // The scene target covers the whole cell grid (slightly larger than the screen), anchored
  // bottom-left; frustum sized so one device pixel = viewSize / h world units.
  const c = ascii.cell(); const g = ascii.grid();
  const gw = g.cols * c.w; const gh = g.rows * c.h;
  const hh = viewSize * gh / h / 2; const hw = viewSize * gw / h / 2;
  const ox = (gw - w) / 2 * viewSize / h; const oy = (gh - h) / 2 * viewSize / h;
  ortho.left = -hw + ox; ortho.right = hw + ox; ortho.top = hh + oy; ortho.bottom = -hh + oy;
  ortho.updateProjectionMatrix();
  persp.aspect = gw / gh; persp.updateProjectionMatrix();
}
addEventListener('resize', resize);

/* ------------------------------------------------------------------ input */
const keys = new Set<string>();
let day = false;
addEventListener('keydown', e => {
  keys.add(e.code);
  if (e.code === 'Tab') { e.preventDefault(); ascii.toggle(); }
  if (e.code === 'BracketLeft') { ascii.changeCell(-1); resize(); }
  if (e.code === 'BracketRight') { ascii.changeCell(1); resize(); }
  if (e.code === 'KeyV') { view = VIEWS[(VIEWS.indexOf(view) + 1) % VIEWS.length]; if (view === 'third-person') chaseYaw = actors.heroHeading() + Math.PI; }
  if (e.code === 'KeyN') { day = !day; world.setDay(day); }
});
addEventListener('keyup', e => keys.delete(e.code));
addEventListener('wheel', e => {
  if (view === 'third-person') chaseDist = Math.max(3, Math.min(25, chaseDist * Math.exp(e.deltaY * .001)));
  else { viewSize = Math.max(7, Math.min(40, viewSize * Math.exp(e.deltaY * .001))); resize(); }
}, { passive: true });
let dragging = false;
addEventListener('pointerdown', () => { dragging = true; });
addEventListener('pointerup', () => { dragging = false; });
addEventListener('pointermove', e => {
  if (!dragging || view !== 'third-person') return;
  chaseYaw -= e.movementX * .006;
  chasePitch = Math.max(.05, Math.min(1.2, chasePitch + e.movementY * .004));
});

/* ------------------------------------------------------------------ loop */
const hud = document.getElementById('hud')!;
const clock = new THREE.Clock();
const fwd = new THREE.Vector3(); const right = new THREE.Vector3(); const move = new THREE.Vector3();
let frames = 0; let fpsT = 0; let fps = 0;
function tick(): void {
  requestAnimationFrame(tick);
  const dt = Math.min(.05, clock.getDelta()); const t = clock.elapsedTime;

  // Movement relative to the current camera: W = away from the camera along the ground.
  activeCamera().getWorldDirection(fwd); fwd.y = 0; fwd.normalize();
  right.set(-fwd.z, 0, fwd.x);
  move.set(0, 0, 0);
  if (keys.has('KeyW') || keys.has('ArrowUp')) move.add(fwd);
  if (keys.has('KeyS') || keys.has('ArrowDown')) move.sub(fwd);
  if (keys.has('KeyD') || keys.has('ArrowRight')) move.add(right);
  if (keys.has('KeyA') || keys.has('ArrowLeft')) move.sub(right);
  if (move.lengthSq() > 0) move.normalize();
  actors.update(t, dt, move, keys.has('ShiftLeft') || keys.has('ShiftRight'), world.colliders());
  const heroPos = actors.heroPosition();
  if (heroPos) camTarget.lerp(heroPos, 1 - Math.exp(-dt * 6));

  let cam: THREE.Camera;
  if (view === 'third-person') {
    const look = snapped.copy(camTarget).setY(camTarget.y + 1.3);
    persp.position.set(
      look.x + Math.sin(chaseYaw) * Math.cos(chasePitch) * chaseDist,
      look.y + Math.sin(chasePitch) * chaseDist,
      look.z + Math.cos(chaseYaw) * Math.cos(chasePitch) * chaseDist);
    persp.lookAt(look);
    world.update(t, camTarget, persp);
    cam = persp;
  } else {
    // Fixed orientation; position snapped to whole glyph cells on screen. A smoothly sliding camera
    // moves the scene under the cell grid, so every cell re-picks its glyph each frame (shimmer).
    const dir = ORTHO_DIR[view];
    ortho.position.copy(dir); ortho.up.set(0, 1, 0); ortho.lookAt(0, 0, 0);
    camRight.set(1, 0, 0).applyQuaternion(ortho.quaternion); camUp.set(0, 1, 0).applyQuaternion(ortho.quaternion);
    const h = renderer.domElement.height; const c = ascii.cell();
    const sx = c.w * viewSize / h; const sy = c.h * viewSize / h;
    snapped.copy(dir).multiplyScalar(camTarget.dot(dir))
      .addScaledVector(camRight, Math.round(camTarget.dot(camRight) / sx) * sx)
      .addScaledVector(camUp, Math.round(camTarget.dot(camUp) / sy) * sy);
    if (!snapCamera) snapped.copy(camTarget);
    ortho.position.copy(snapped).addScaledVector(dir, 60);
    world.update(t, snapped, ortho);
    cam = ortho;
  }

  renderer.setRenderTarget(ascii.target()); renderer.render(scene, cam);
  ascii.render(renderer);

  frames++; fpsT += dt;
  if (fpsT > .5) {
    fps = Math.round(frames / fpsT); frames = 0; fpsT = 0;
    const c = ascii.cell();
    hud.innerHTML = `<span class="fps">${fps} FPS</span><br>` +
      `<b>WASD</b> move · <b>Shift</b> run · <b>V</b> view: ${view} · <b>N</b> ${day ? 'day' : 'night'} · ` +
      `<b>wheel</b> zoom${view === 'third-person' ? ' · <b>drag</b> orbit' : ''} · <b>[ ]</b> glyph ${c.w}×${c.h} · <b>Tab</b> ASCII on/off`;
    document.body.dataset.fps = String(fps);
  }
}

resize();
Promise.all([world.ready, actors.ready])
  .then(() => { document.getElementById('load')!.remove(); document.body.dataset.ready = '1'; })
  .catch(e => { document.getElementById('load')!.textContent = 'load failed: ' + e; console.error(e); });
tick();
