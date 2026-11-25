/** Characters and animals: hero (player-controlled), townsfolk, horse. */
import * as THREE from 'three';
import { character, load, play, type Actor } from './assets';
import type { Collider } from './world';

export interface Actors {
  ready: Promise<void>;
  /** Hero position (camera follows it); null until loaded. */
  heroPosition(): THREE.Vector3 | null;
  /** `move` is a screen-relative world-space direction (length 0 or 1). */
  update(t: number, dt: number, move: THREE.Vector3, run: boolean, colliders: readonly Collider[]): void;
}

export function createActors(scene: THREE.Scene): Actors {
  const npcs: { actor: Actor; update: (t: number, dt: number) => void }[] = [];
  let hero: Actor | null = null;
  let horse: { mixer: THREE.AnimationMixer } | null = null;

  const build = async (): Promise<void> => {
    const jobs: Promise<unknown>[] = [];
    jobs.push(character(scene, 'Rogue_Hooded', ['Knife'], 1.5, 3).then(a => { hero = a; play(a, 'Idle'); }));
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
    update(t, dt, move, run) {
      if (hero) {
        if (move.lengthSq() > 0) {
          hero.root.position.addScaledVector(move, (run ? 6 : 2.6) * dt);
          hero.root.rotation.y = Math.atan2(move.x, move.z);
          play(hero, run ? 'Running_A' : 'Walking_A');
        } else play(hero, 'Idle');
        hero.mixer.update(dt);
      }
      for (const n of npcs) { n.update(t, dt); n.actor.mixer.update(dt); }
      horse?.mixer.update(dt);
    },
  };
}
