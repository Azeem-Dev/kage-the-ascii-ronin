/** Environment: lights, ground, road, grass, flowers, fireflies, buildings, trees, rocks, props. */
import * as THREE from 'three';
import { place } from './assets';

export interface World {
  /** Resolves when every model is placed. */
  ready: Promise<void>;
  /** Per frame: wind time, fireflies, moon shadow follows the camera target. */
  update(t: number, camTarget: THREE.Vector3): void;
  /** True on the square or the road (no grass, no trees). */
  onPath(x: number, z: number): boolean;
  /** Solid obstacles on the ground (buildings, trees, rocks, props) as circles; actors slide around them. */
  colliders(): readonly Collider[];
}

export interface Collider { x: number; z: number; r: number }

export function createWorld(scene: THREE.Scene): World {
  scene.background = new THREE.Color(0x000000);
  scene.fog = new THREE.FogExp2(0x000000, .02);

  /* lights: moon, sky, warm pools */
  scene.add(new THREE.HemisphereLight(0x3a5684, 0x000000, .55));
  const moon = new THREE.DirectionalLight(0xb4cbff, 3.0);
  moon.castShadow = true;
  moon.shadow.mapSize.set(2048, 2048);
  moon.shadow.camera.left = -26; moon.shadow.camera.right = 26; moon.shadow.camera.top = 26; moon.shadow.camera.bottom = -26;
  moon.shadow.camera.near = 1; moon.shadow.camera.far = 90;
  moon.shadow.bias = -.0006; moon.shadow.normalBias = .03;
  scene.add(moon, moon.target);
  const moonOffset = new THREE.Vector3(-14, 26, 9);
  const warmLight = (x: number, y: number, z: number, intensity = 24, distance = 10): void => {
    const l = new THREE.PointLight(0xffa857, intensity, distance, 1.6);
    l.position.set(x, y, z); scene.add(l);
  };

  /* ground, square, road */
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(160, 160), new THREE.MeshStandardMaterial({ color: 0x010201, roughness: 1 }));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
  const square = new THREE.Mesh(new THREE.CircleGeometry(5.2, 40), new THREE.MeshStandardMaterial({ color: 0x18191c, roughness: .95 }));
  square.rotation.x = -Math.PI / 2; square.position.y = .01; square.receiveShadow = true; scene.add(square);
  const pathPts: THREE.Vector2[] = [];
  for (let i = 0; i <= 40; i++) { const t = i / 40; pathPts.push(new THREE.Vector2(4 + t * 34, Math.sin(t * 3.2) * 5 + t * 6)); }
  const pathMat = new THREE.MeshStandardMaterial({ color: 0x2b2218, roughness: 1 });
  for (let i = 0; i < pathPts.length - 1; i++) {
    const a = pathPts[i]; const b = pathPts[i + 1];
    const seg = new THREE.Mesh(new THREE.PlaneGeometry(a.distanceTo(b) + .3, 2.1), pathMat);
    seg.rotation.x = -Math.PI / 2; seg.rotation.z = -Math.atan2(b.y - a.y, b.x - a.x);
    seg.position.set((a.x + b.x) / 2, .008, (a.y + b.y) / 2); seg.receiveShadow = true; scene.add(seg);
  }
  const onPath = (x: number, z: number): boolean => {
    if (Math.hypot(x, z) < 5.6) return true;
    for (const p of pathPts) if (Math.hypot(x - p.x, z - p.y) < 1.4) return true;
    return false;
  };

  /* grass: instanced 3D blades with wind */
  const windUniform = { value: 0 };
  {
    const blade = new THREE.BufferGeometry();
    const v: number[] = []; const segs = 3;
    for (let i = 0; i <= segs; i++) { const y = i / segs; const w = .5 * (1 - y * .85); v.push(-w, y, 0, w, y, 0); }
    const idx: number[] = [];
    for (let i = 0; i < segs; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    blade.setAttribute('position', new THREE.Float32BufferAttribute(v, 3)); blade.setIndex(idx); blade.computeVertexNormals();
    const mat = new THREE.MeshLambertMaterial({ side: THREE.DoubleSide });
    mat.onBeforeCompile = shader => {
      shader.uniforms.uTime = windUniform;
      shader.vertexShader = 'uniform float uTime;\n' + shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
        vec4 wp = instanceMatrix * vec4(0., 0., 0., 1.);
        float gust = sin(uTime * 1.3 + wp.x * .35 + wp.z * .22) * .6 + sin(uTime * 2.7 + wp.x * .9) * .25;
        transformed.x += gust * position.y * position.y * .55;
        transformed.z += gust * position.y * position.y * .25;`);
    };
    const count = 70000;
    const grass = new THREE.InstancedMesh(blade, mat, count);
    const m = new THREE.Matrix4(); const q = new THREE.Quaternion(); const s = new THREE.Vector3(); const p = new THREE.Vector3();
    const c = new THREE.Color(); let n = 0;
    let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let k = 0; k < count * 3 && n < count; k++) {
      const x = (rnd() - .5) * 70; const z = (rnd() - .5) * 70;
      if (onPath(x, z)) continue;
      const patch = Math.sin(x * .21 + Math.sin(z * .13) * 2) * Math.cos(z * .17 - x * .05);
      if (rnd() > .35 + patch * .55) continue;
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rnd() * Math.PI);
      const h = .45 + rnd() * .7 + (patch > .3 ? .35 : 0);
      s.set(.06, h, .06); p.set(x, 0, z);
      m.compose(p, q, s); grass.setMatrixAt(n, m);
      c.setHSL(.26 + rnd() * .09, .6 + rnd() * .25, .26 + rnd() * .24); grass.setColorAt(n, c);
      n++;
    }
    grass.count = n; grass.receiveShadow = true; scene.add(grass);

    const flowers = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(.07, 0), new THREE.MeshStandardMaterial({ roughness: .6, emissive: 0x1a0c22 }), 900);
    for (let i = 0; i < 900; i++) {
      let x = 0; let z = 0; do { x = (rnd() - .5) * 60; z = (rnd() - .5) * 60; } while (onPath(x, z));
      m.compose(p.set(x, .45 + rnd() * .5, z), q.identity(), s.set(1, 1, 1)); flowers.setMatrixAt(i, m);
      flowers.setColorAt(i, c.setHSL(.75 + rnd() * .15, .6, .55));
    }
    scene.add(flowers);
  }

  /* fireflies */
  const N = 140; const fpos = new Float32Array(N * 3); const fbase = new Float32Array(N * 3);
  {
    let seed = 11; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < N; i++) { fbase[i * 3] = (rnd() - .5) * 40; fbase[i * 3 + 1] = .5 + rnd() * 2; fbase[i * 3 + 2] = (rnd() - .5) * 40; }
  }
  fpos.set(fbase);
  const fgeo = new THREE.BufferGeometry(); fgeo.setAttribute('position', new THREE.BufferAttribute(fpos, 3));
  scene.add(new THREE.Points(fgeo, new THREE.PointsMaterial({ color: 0xd8ff8a, size: .12, transparent: true, opacity: .9, blending: THREE.AdditiveBlending, depthWrite: false })));

  /* village layout */
  const S = 3.6;    // hex-pack buildings are board-sized; scale them next to the characters
  const build = async (): Promise<void> => {
    const jobs: Promise<unknown>[] = [];
    const ring: [string, number, number][] = [
      ['building_tavern_red', -8.5, -3.5], ['building_home_A_red', -4, -9], ['building_home_B_blue', 3, -9.5],
      ['building_church_red', 9.5, -6.5], ['building_home_A_blue', -10, 4.5], ['building_market_red', 8.5, 2.5],
      ['building_home_B_red', -5, 9.5], ['building_blacksmith_red', 1.5, 10.5],
    ];
    for (const [f, x, z] of ring) jobs.push(place(scene, f, x, z, S, Math.atan2(-x, -z)));
    jobs.push(place(scene, 'building_well_red', 0, 0, S * .8));
    jobs.push(place(scene, 'building_windmill_red', -20, -14, S * 1.1, .6));
    for (const [, x, z] of ring) { const d = Math.hypot(x, z); warmLight(x * (d - 2.6) / d, 1.4, z * (d - 2.6) / d, 10, 7); }
    for (const a of [0, 1, 2, 3]) {
      const ang = a * Math.PI / 2 + .4; const x = Math.cos(ang) * 5.6; const z = Math.sin(ang) * 5.6;
      const post = new THREE.Mesh(new THREE.CylinderGeometry(.05, .07, 2.2, 6), new THREE.MeshStandardMaterial({ color: 0x2a2018 }));
      post.position.set(x, 1.1, z); post.castShadow = true; scene.add(post);
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(.16, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffc070 }));
      lamp.position.set(x, 2.25, z); scene.add(lamp);
      warmLight(x, 2.2, z, 16, 8);
    }
    let seed = 3; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const trees = ['trees_A_large', 'trees_A_medium', 'trees_B_large', 'trees_B_medium', 'tree_single_A', 'tree_single_B', 'trees_A_small'];
    for (let i = 0; i < 70; i++) {
      const ang = rnd() * Math.PI * 2; const r = 14 + rnd() * 18;
      const x = Math.cos(ang) * r; const z = Math.sin(ang) * r;
      // Keep the side facing the camera (large x + z) mostly open so trees frame the view, not block it.
      if (onPath(x, z) || Math.hypot(x + 20, z + 14) < 4 || (x + z > 10 && rnd() < .8)) continue;
      jobs.push(place(scene, trees[Math.floor(rnd() * trees.length)], x, z, 3.2 + rnd() * 1.6, rnd() * 6));
    }
    for (let i = 0; i < 26; i++) {
      const x = (rnd() - .5) * 44; const z = (rnd() - .5) * 44;
      if (onPath(x, z) || Math.hypot(x, z) < 12) continue;
      jobs.push(place(scene, 'rock_single_' + 'ABCDE'[Math.floor(rnd() * 5)], x, z, 3 + rnd() * 3, rnd() * 6));
    }
    const props: [string, number, number, number][] = [
      ['barrel', -6.2, -1.5, 3], ['barrel', -6.6, -.8, 3], ['crate_A_big', -6, -2.4, 3], ['sack', 6.4, 1, 3],
      ['wheelbarrow', 6, 3.8, 3], ['flag_red', 4.2, -4, 3], ['tent', 13, 9, 3.4], ['weaponrack', 2.5, 7.8, 3],
    ];
    for (const [f, x, z, s] of props) jobs.push(place(scene, f, x, z, s, rnd() * 6));
    await Promise.all(jobs);
  };

  return {
    ready: build(),
    onPath,
    colliders: () => [],   // Agent J: fill from placed models

    update(t, camTarget) {
      windUniform.value = t;
      for (let i = 0; i < N; i++) {
        fpos[i * 3] = fbase[i * 3] + Math.sin(t * .5 + i) * .8;
        fpos[i * 3 + 1] = fbase[i * 3 + 1] + Math.sin(t * 1.3 + i * 2) * .3;
        fpos[i * 3 + 2] = fbase[i * 3 + 2] + Math.cos(t * .4 + i) * .8;
      }
      fgeo.attributes.position.needsUpdate = true;
      moon.position.copy(camTarget).add(moonOffset); moon.target.position.copy(camTarget);
    },
  };
}
