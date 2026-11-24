import * as THREE from 'three';

export interface Rig {
  root: THREE.Group;
  /** phase: distance-driven gait phase; moving: 0..1; time: seconds. */
  animate(phase: number, moving: number, time: number, mounted?: boolean): void;
}

const mat = (color: number, emissive = 0) => {
  const m = new THREE.MeshStandardMaterial({ color, roughness: .75, metalness: 0, flatShading: true });
  // Heroes carry a little self-light so they read as the subject at night (references).
  if (emissive) { m.emissive = new THREE.Color(emissive); m.emissiveIntensity = 1.6; }
  return m;
};
function part(geometry: THREE.BufferGeometry, material: THREE.Material, x: number, y: number, z: number, parent: THREE.Object3D): THREE.Mesh {
  const m = new THREE.Mesh(geometry, material);
  m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true;
  parent.add(m);
  return m;
}
/** A limb that rotates around its top joint. */
function limb(width: number, length: number, material: THREE.Material, x: number, y: number, z: number, parent: THREE.Object3D): THREE.Group {
  const pivot = new THREE.Group(); pivot.position.set(x, y, z); parent.add(pivot);
  part(new THREE.BoxGeometry(width, length, width), material, 0, -length / 2, 0, pivot);
  return pivot;
}

/**
 * Kage, about 40 units tall (same scale as the 2D world). Faces +Z.
 * Silhouette rule from the story: straw hat on the back + pale cape + katana,
 * and he is lit slightly brighter than everything else.
 */
export function buildSamurai(): Rig {
  const root = new THREE.Group();
  const body = new THREE.Group(); root.add(body);
  const armour = mat(0x3a3f4c, 0x161a24); const cloth = mat(0x2a2e3a, 0x0c0e14); const skin = mat(0xe0b08a, 0x3a2418);
  const cape = mat(0xeeece4, 0x5a5a54); const red = mat(0xd0262e, 0x601010); const straw = mat(0xd8b060, 0x4a3410);
  const hair = mat(0x141212, 0x060606); const steel = mat(0xdfe6ec, 0x50585e);
  const legL = limb(4.2, 17, cloth, -3, 17, 0, body);
  const legR = limb(4.2, 17, cloth, 3, 17, 0, body);
  part(new THREE.BoxGeometry(11, 7, 7), armour, 0, 18.5, 0, body); // hip guards
  part(new THREE.BoxGeometry(10, 11, 6.5), armour, 0, 26.5, 0, body); // chest
  part(new THREE.BoxGeometry(14, 3, 7.5), armour, 0, 32, 0, body); // shoulder plates
  part(new THREE.BoxGeometry(10.4, 1.2, 6.9), red, 0, 22.5, 0, body); // red cord
  const armL = limb(3.4, 13, armour, -7, 31.5, 0, body);
  const armR = limb(3.4, 13, armour, 7, 31.5, 0, body);
  part(new THREE.SphereGeometry(3.6, 8, 6), skin, 0, 37, .4, body);
  part(new THREE.SphereGeometry(3.8, 8, 6, 0, Math.PI * 2, 0, Math.PI * .55), hair, 0, 37.6, -.3, body);
  part(new THREE.CylinderGeometry(.9, 1.3, 3.5, 5), hair, 0, 41.5, -1.5, body); // topknot
  const hat = part(new THREE.ConeGeometry(8, 3.2, 10), straw, 0, 30, -5.4, body); // straw hat slung on the back
  hat.rotation.x = -Math.PI / 2.2;
  // Katana at the left hip, angled back.
  const sword = new THREE.Group(); sword.position.set(-5.8, 20, 1); sword.rotation.x = -1.15; body.add(sword);
  part(new THREE.BoxGeometry(.8, 26, 1.4), steel, 0, -8, 0, sword);
  part(new THREE.BoxGeometry(1.4, 7, 1.6), red, 0, 7, 0, sword);
  // Cape: three hanging panels that sway from the shoulders.
  const capeRoot = new THREE.Group(); capeRoot.position.set(0, 32.5, -3.6); body.add(capeRoot);
  const panels = [0, 1, 2].map(i => {
    const pivot = new THREE.Group(); pivot.position.y = -i * 6.5; (i === 0 ? capeRoot : undefined)?.add(pivot);
    part(new THREE.BoxGeometry(13 - i * .6, 6.8, .8), cape, 0, -3.4, 0, pivot);
    return pivot;
  });
  panels[0].add(panels[1]); panels[1].add(panels[2]);
  panels[1].position.y = -6.5; panels[2].position.y = -6.5;

  return {
    root,
    animate(phase, moving, time, mounted = false) {
      const swing = Math.sin(phase) * .7 * moving;
      legL.rotation.x = mounted ? -1.3 : swing; legR.rotation.x = mounted ? -1.3 : -swing;
      legL.rotation.z = mounted ? -.35 : 0; legR.rotation.z = mounted ? .35 : 0;
      armL.rotation.x = -swing * .8; armR.rotation.x = swing * .8 - (mounted ? .5 : 0);
      body.position.y = mounted ? -12 : Math.abs(Math.sin(phase)) * 1.2 * moving;
      // Cape trails behind with movement and stirs in the wind.
      const wind = Math.sin(time * 1.7) * .08 + Math.sin(time * 4.1) * .03;
      panels[0].rotation.x = .12 + moving * .45 + wind;
      panels[1].rotation.x = .1 + moving * .2 + wind * 1.4;
      panels[2].rotation.x = .1 + moving * .2 + wind * 1.8;
    },
  };
}

/** Tsuki: white horse, faces +Z, about 36 units at the back and 70 long. */
export function buildHorse(): Rig {
  const root = new THREE.Group();
  const coat = mat(0xeeece6, 0x4a4a50); const mane = mat(0xf8f6f2, 0x5a5a60); const hoof = mat(0x2a2522); const tack = mat(0x5a2a1c);
  const body = new THREE.Group(); root.add(body);
  part(new THREE.BoxGeometry(14, 14, 40), coat, 0, 30, 0, body);
  part(new THREE.BoxGeometry(14.6, 2, 12), tack, 0, 37.5, -1, body); // saddle
  const neck = new THREE.Group(); neck.position.set(0, 34, 18); neck.rotation.x = -.75; body.add(neck);
  part(new THREE.BoxGeometry(8, 20, 9), coat, 0, 9, 0, neck);
  part(new THREE.BoxGeometry(2.2, 20, 5), mane, 0, 9, -4.5, neck);
  const head = new THREE.Group(); head.position.set(0, 19, 2); head.rotation.x = 1.55; neck.add(head);
  part(new THREE.BoxGeometry(7, 7, 16), coat, 0, 0, 6, head);
  part(new THREE.BoxGeometry(1.5, 4, 1.5), coat, -2.2, 4.5, 1, head);
  part(new THREE.BoxGeometry(1.5, 4, 1.5), coat, 2.2, 4.5, 1, head);
  const legs = [[-5, 15], [5, 15], [-5, -15], [5, -15]].map(([x, z]) => {
    const leg = limb(4, 23, coat, x, 24, z, body);
    part(new THREE.BoxGeometry(4.4, 3, 4.4), hoof, 0, -23, 0, leg);
    return leg;
  });
  const tail = new THREE.Group(); tail.position.set(0, 34, -20); body.add(tail);
  part(new THREE.BoxGeometry(3.5, 18, 3.5), mane, 0, -9, -2, tail);
  return {
    root,
    animate(phase, moving, time) {
      legs.forEach((leg, i) => { leg.rotation.x = Math.sin(phase + (i === 0 || i === 3 ? 0 : Math.PI)) * .6 * moving; });
      body.position.y = Math.abs(Math.sin(phase * 2)) * 1.5 * moving;
      neck.rotation.x = -.75 + Math.sin(phase * 2) * .06 * moving + Math.sin(time * .8) * .03;
      tail.rotation.x = .35 + Math.sin(time * 2.3) * .12 + moving * .4;
      tail.rotation.z = Math.sin(time * 1.6) * .15;
    },
  };
}
