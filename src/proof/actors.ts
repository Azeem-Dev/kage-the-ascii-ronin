/** Characters and animals: hero (player-controlled), townsfolk, horse. */
import * as THREE from 'three';
import { character, load, play, type Actor } from './assets';
import type { Collider } from './world';

export interface Actors {
  ready: Promise<void>;
  /** Hero position (camera follows it); null until loaded. */
  heroPosition(): THREE.Vector3 | null;
  /** Hero facing (rotation about Y, radians; 0 = facing +Z). */
  heroHeading(): number;
  /** `move` is a screen-relative world-space direction (length 0 or 1). */
  update(t: number, dt: number, move: THREE.Vector3, run: boolean, colliders: readonly Collider[]): void;
}

/**
 * Kage, quick version on the KayKit Knight rig: helmet off, flat samurai colours (dark lacquered
 * armour, grey hakama, pale cape), a wide straw hat (kasa) on the head bone and a sheathed katana
 * on the left hip. Agent K replaces this with a proper CC0 model later.
 */
/** KayKit rigs are chibi (head ≈ 45% of height). Shrinking the head bone gives adult proportions;
 *  the hat is attached to that bone, so it shrinks with it. Re-applied after every mixer update. */
const HEAD_SCALE = .62;

function dressSamurai(a: Actor): () => void {
  const root = a.root;
  const colours: Record<string, number> = {
    Knight_Body: 0x3d4a6e, Knight_ArmLeft: 0x33405f, Knight_ArmRight: 0x33405f,
    Knight_LegLeft: 0x6a6f7e, Knight_LegRight: 0x6a6f7e, Knight_Head: 0xd6a07c, Knight_Cape: 0xe6e0cf,
  };
  root.traverse(o => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    if (o.name === 'Knight_Helmet') { o.visible = false; return; }
    const c = colours[o.name];
    if (c !== undefined) m.material = new THREE.MeshStandardMaterial({ color: c, roughness: o.name === 'Knight_Body' ? .45 : .8 });
    o.userData.look = o.name === 'Knight_Head' ? 'skin' : o.name === 'Knight_Body' ? 'metal' : 'cloth';
  });
  root.userData.subject = true;
  // Light pool that travels with the hero (visual target: the player is the brightest thing).
  const pool = new THREE.PointLight(0xdfe8ff, 5, 6, 1.5);
  pool.position.set(0, 2.6 / root.scale.y, 1.2 / root.scale.y);
  root.add(pool);

  // Measure in world space at bind pose, then attach so the parts follow the animation.
  root.updateMatrixWorld(true);
  const headMesh = root.getObjectByName('Knight_Head')!;
  const head = new THREE.Box3().setFromObject(headMesh);
  const body = new THREE.Box3().setFromObject(root);
  const height = body.max.y - body.min.y;
  const headW = head.max.x - head.min.x;
  const headBone = root.getObjectByName('head')!;
  const hipBone = root.getObjectByName('hips')!;

  // Kasa: wide, shallow straw cone sitting low on the head.
  const r = headW * .95;
  const hat = new THREE.Mesh(new THREE.ConeGeometry(r, r * .42, 28, 1, true),
    new THREE.MeshStandardMaterial({ color: 0xc9a75e, roughness: .9, side: THREE.DoubleSide }));
  const hatTop = new THREE.Mesh(new THREE.CylinderGeometry(r * .12, r * .12, r * .08, 12), hat.material);
  hatTop.position.y = r * .21;
  hat.add(hatTop);
  hat.position.set((head.min.x + head.max.x) / 2, head.max.y - (head.max.y - head.min.y) * .12, (head.min.z + head.max.z) / 2);
  hat.castShadow = true; hat.userData.look = 'cloth';
  scene().add(hat); headBone.attach(hat);

  // Katana in its scabbard on the left hip (+X when facing +Z), hilt forward and up.
  const L = height * .5;
  const katana = new THREE.Group();
  const dark = new THREE.MeshStandardMaterial({ color: 0x15100e, roughness: .5 });
  const saya = new THREE.Mesh(new THREE.CylinderGeometry(L * .022, L * .02, L * .72, 8), dark);
  saya.position.y = -L * .36;
  const tsuba = new THREE.Mesh(new THREE.CylinderGeometry(L * .055, L * .055, L * .015, 12), new THREE.MeshStandardMaterial({ color: 0xb88c3a, metalness: .6, roughness: .4 }));
  const tsuka = new THREE.Mesh(new THREE.CylinderGeometry(L * .024, L * .024, L * .26, 8), new THREE.MeshStandardMaterial({ color: 0x8a1f1f, roughness: .7 }));
  tsuka.position.y = L * .135;
  katana.add(saya, tsuba, tsuka);
  katana.traverse(o => { o.castShadow = true; o.userData.look = 'metal'; });
  const hip = hipBone.getWorldPosition(new THREE.Vector3());
  const chestY = root.getObjectByName('chest')!.getWorldPosition(new THREE.Vector3()).y;
  katana.position.set(hip.x + headW * .4, hip.y + (chestY - hip.y) * .35, hip.z + height * .03);   // at the belt (obi)
  katana.rotation.set(1.15, 0, -.15);        // tilt: hilt forward-up, scabbard back-down
  scene().add(katana); hipBone.attach(katana);

  // Adult proportions: longer legs and arms (bones point along their local Y), smaller head.
  // Hands/feet are counter-scaled so they keep their size; the whole figure is lifted by the
  // extra leg length. Re-applied after every mixer update in case clips carry scale tracks.
  const LEG = 1.7; const ARM = 1.3;
  const bone = (n: string) => root.getObjectByName(n)!;
  const fixes: [THREE.Object3D, number][] = [[headBone, HEAD_SCALE]];
  for (const s of ['l', 'r']) {
    fixes.push([bone('upperleg' + s), LEG], [bone('foot' + s), 1 / LEG], [bone('upperarm' + s), ARM], [bone('hand' + s), 1 / ARM]);
  }
  const lift = hip.y * (LEG - 1) * .9;
  for (const c of [...root.children]) c.position.y += lift / root.scale.y;
  return () => {
    for (const [b, k] of fixes) {
      if (b === headBone) b.scale.setScalar(k);
      else b.scale.set(1, k, 1);
    }
  };

  function scene(): THREE.Object3D { let o: THREE.Object3D = root; while (o.parent) o = o.parent; return o; }
}

export function createActors(scene: THREE.Scene): Actors {
  const npcs: { actor: Actor; update: (t: number, dt: number) => void }[] = [];
  let hero: Actor | null = null;
  let heroProportions: (() => void) | null = null;
  let horse: { mixer: THREE.AnimationMixer } | null = null;

  const build = async (): Promise<void> => {
    const jobs: Promise<unknown>[] = [];
    jobs.push(character(scene, 'Knight', [], 1.5, 3).then(a => { heroProportions = dressSamurai(a); heroProportions(); hero = a; play(a, 'Idle'); }));
    jobs.push(character(scene, 'Knight', ['1H_Sword', 'Round_Shield'], 4, 0).then(a => {
      npcs.push({ actor: a, update: t => { const ang = t * .25; a.root.position.set(Math.cos(ang) * 3.8, 0, Math.sin(ang) * 3.8); a.root.rotation.y = -ang; play(a, 'Walking_A'); } });
    }));
    jobs.push(character(scene, 'Barbarian', ['2H_Axe'], 1, 8.2).then(a => { a.root.rotation.y = Math.PI; play(a, 'Idle'); npcs.push({ actor: a, update: () => {} }); }));
    jobs.push(character(scene, 'Mage', ['2H_Staff'], -1.6, -1.8).then(a => { a.root.rotation.y = .6; play(a, 'Idle'); npcs.push({ actor: a, update: () => {} }); }));
    // Horse (three.js example model; licence unconfirmed: replace before release), tinted pale like Tsuki.
    jobs.push(load('/proof/models/three/Horse.glb').then(g => {
      const root = g.scene; root.scale.setScalar(.011); root.position.set(-2.5, 0, 4.5); root.rotation.y = 2.2;
      root.traverse(c => { const m = c as THREE.Mesh; if (m.isMesh) { m.castShadow = true; m.material = new THREE.MeshStandardMaterial({ color: 0xe8eae4, roughness: .7, flatShading: true }); } });
      scene.add(root);
      const mixer = new THREE.AnimationMixer(root); const action = mixer.clipAction(g.animations[0]); action.play(); action.timeScale = 0;
      horse = { mixer };
    }));
    await Promise.all(jobs);
  };

  return {
    ready: build(),
    heroPosition: () => hero?.root.position ?? null,
    heroHeading: () => hero?.root.rotation.y ?? 0,
    update(t, dt, move, run) {
      if (hero) {
        if (move.lengthSq() > 0) {
          hero.root.position.addScaledVector(move, (run ? 6 : 2.6) * dt);
          hero.root.rotation.y = Math.atan2(move.x, move.z);
          play(hero, run ? 'Running_A' : 'Walking_A');
        } else play(hero, 'Idle');
        hero.mixer.update(dt);
        heroProportions?.();
      }
      for (const n of npcs) { n.update(t, dt); n.actor.mixer.update(dt); }
      horse?.mixer.update(dt);
    },
  };
}
