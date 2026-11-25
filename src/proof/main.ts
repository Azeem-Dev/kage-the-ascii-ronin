/**
 * 3D-models + ASCII scene (/proof.html): real low-poly models (KayKit CC0 village + characters)
 * in a dark, moonlit three.js scene with a fixed isometric orthographic camera, then ONE GPU ASCII
 * pass over the whole image. The old glyph game at / is untouched.
 *
 * Owner of each module (see artifacts/agents/README.md, round 3):
 *   main.ts (renderer, camera, loop, input, HUD) + assets.ts: Claude
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
let viewSize = 16;                                           // world units visible vertically
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -200, 400);
const camDir = new THREE.Vector3(1, .82, 1).normalize();     // fixed isometric angle
const camTarget = new THREE.Vector3();
// Screen axes of the fixed camera in world space (matches Object3D.lookAt with +Y up).
const camRight = new THREE.Vector3(0, 1, 0).cross(camDir).normalize();
const camUp = camDir.clone().cross(camRight).normalize();
const snapped = new THREE.Vector3();
const snapCamera = !new URLSearchParams(location.search).has('nosnap');   // ?nosnap = old sliding camera, for comparison

const ascii = createAsciiPass(dpr);
const world = createWorld(scene);
const actors = createActors(scene);

function resize(): void {
  const w = Math.floor(innerWidth * dpr); const h = Math.floor(innerHeight * dpr);
  renderer.setSize(w, h, false);
  renderer.domElement.style.width = innerWidth + 'px'; renderer.domElement.style.height = innerHeight + 'px';
  ascii.resize(w, h);
  const aspect = w / h;
  camera.left = -viewSize * aspect / 2; camera.right = viewSize * aspect / 2; camera.top = viewSize / 2; camera.bottom = -viewSize / 2;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);

const keys = new Set<string>();
addEventListener('keydown', e => {
  keys.add(e.code);
  if (e.code === 'Tab') { e.preventDefault(); ascii.toggle(); }
  if (e.code === 'BracketLeft') ascii.changeCell(-1);
  if (e.code === 'BracketRight') ascii.changeCell(1);
});
addEventListener('keyup', e => keys.delete(e.code));
addEventListener('wheel', e => { viewSize = Math.max(7, Math.min(40, viewSize * Math.exp(e.deltaY * .001))); resize(); }, { passive: true });

const hud = document.getElementById('hud')!;
const clock = new THREE.Clock();
const fwd = new THREE.Vector3(-camDir.x, 0, -camDir.z).normalize();
const right = new THREE.Vector3(-fwd.z, 0, fwd.x);
const move = new THREE.Vector3();
let frames = 0; let fpsT = 0;
function tick(): void {
  requestAnimationFrame(tick);
  const dt = Math.min(.05, clock.getDelta()); const t = clock.elapsedTime;

  move.set(0, 0, 0);                                         // screen-relative: W = up the screen
  if (keys.has('KeyW') || keys.has('ArrowUp')) move.add(fwd);
  if (keys.has('KeyS') || keys.has('ArrowDown')) move.sub(fwd);
  if (keys.has('KeyD') || keys.has('ArrowRight')) move.add(right);
  if (keys.has('KeyA') || keys.has('ArrowLeft')) move.sub(right);
  if (move.lengthSq() > 0) move.normalize();
  actors.update(t, dt, move, keys.has('ShiftLeft') || keys.has('ShiftRight'), world.colliders());
  const heroPos = actors.heroPosition();
  if (heroPos) camTarget.lerp(heroPos, 1 - Math.exp(-dt * 4));
  // Snap the camera to whole glyph cells on screen. A smoothly sliding camera moves the scene under
  // the fixed cell grid, so every cell re-picks its glyph each frame and the screen shimmers.
  const h = renderer.domElement.height; const c = ascii.cell();
  const sx = c.w * viewSize / h; const sy = c.h * viewSize / h;
  snapped.copy(camDir).multiplyScalar(camTarget.dot(camDir))
    .addScaledVector(camRight, Math.round(camTarget.dot(camRight) / sx) * sx)
    .addScaledVector(camUp, Math.round(camTarget.dot(camUp) / sy) * sy);
  if (!snapCamera) snapped.copy(camTarget);
  world.update(t, snapped);
  camera.position.copy(snapped).addScaledVector(camDir, 60); camera.lookAt(snapped);

  renderer.setRenderTarget(ascii.target()); renderer.render(scene, camera);
  ascii.render(renderer);

  frames++; fpsT += dt;
  if (fpsT > .5) {
    const fps = Math.round(frames / fpsT); frames = 0; fpsT = 0;
    const c = ascii.cell();
    hud.innerHTML = `<b>WASD</b> move · <b>Shift</b> run · <b>wheel</b> zoom · <b>[ ]</b> glyph size · <b>Tab</b> ASCII on/off &nbsp; ${fps} fps · cell ${c.w}×${c.h}`;
    document.body.dataset.fps = String(fps);
  }
}

resize();
Promise.all([world.ready, actors.ready])
  .then(() => { document.getElementById('load')!.remove(); document.body.dataset.ready = '1'; })
  .catch(e => { document.getElementById('load')!.textContent = 'load failed: ' + e; console.error(e); });
tick();
