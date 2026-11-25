/** Model loading shared by world and actors: cached glTF loads, static placement, animated characters. */
import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';

export const HEX = '/proof/models/hex/';
export const CHARS = '/proof/models/chars/';

const loader = new GLTFLoader();
const cache = new Map<string, Promise<GLTF>>();
export const load = (url: string): Promise<GLTF> => {
  let p = cache.get(url);
  if (!p) { p = loader.loadAsync(url); cache.set(url, p); }
  return p;
};

export function prepare(o: THREE.Object3D): void {
  o.traverse(c => { const mesh = c as THREE.Mesh; if (mesh.isMesh) { mesh.castShadow = true; mesh.receiveShadow = true; } });
}

/** Static model from the hex pack, placed on the ground. */
export async function place(scene: THREE.Scene, file: string, x: number, z: number, scale: number, rotY = 0): Promise<THREE.Object3D> {
  const g = await load(HEX + file + '.gltf');
  const o = g.scene.clone(true); prepare(o);
  o.scale.setScalar(scale); o.position.set(x, 0, z); o.rotation.y = rotY; scene.add(o);
  return o;
}

export interface Actor {
  root: THREE.Object3D;
  mixer: THREE.AnimationMixer;
  actions: Map<string, THREE.AnimationAction>;
  current?: string;
}

/** Skinned character; weapon meshes not listed in `keep` are hidden. */
export async function character(scene: THREE.Scene, file: string, keep: string[], x: number, z: number, scale = .75): Promise<Actor> {
  const g = await load(CHARS + file + '.glb');
  const root = SkeletonUtils.clone(g.scene); prepare(root);
  const weapon = /Shield|Offhand|Crossbow|Throwable|Mug|Spellbook|Wand|Staff|Axe|Sword|Knife/;
  root.traverse(c => { if ((c as THREE.Mesh).isMesh && weapon.test(c.name)) c.visible = keep.includes(c.name); });
  root.scale.setScalar(scale); root.position.set(x, 0, z); scene.add(root);
  const mixer = new THREE.AnimationMixer(root);
  const actions = new Map(g.animations.map(a => [a.name, mixer.clipAction(a)]));
  return { root, mixer, actions };
}

/** Cross-fade to an animation clip by name (no-op if already playing or missing). */
export function play(a: Actor, name: string, fade = .25): void {
  if (a.current === name) return;
  const next = a.actions.get(name); if (!next) return;
  const prev = a.current ? a.actions.get(a.current) : undefined;
  next.reset().fadeIn(fade).play(); prev?.fadeOut(fade);
  a.current = name;
}
