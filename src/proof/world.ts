/** Environment: lights, ground, road, grass, flowers, fireflies, buildings, trees, rocks, props. */
import * as THREE from 'three';
import { place } from './assets';

export interface World {
  /** Resolves when every model is placed. */
  ready: Promise<void>;
  /** Per frame: wind time, fireflies, shadow light follows the camera target, sky follows the camera. */
  update(t: number, camTarget: THREE.Vector3, camera: THREE.Camera): void;
  /** Day (sun, blue sky) or night (moon, stars). */
  setDay(day: boolean): void;
  /** True on the square or the road (no grass, no trees). */
  onPath(x: number, z: number): boolean;
  /** Solid obstacles on the ground (buildings, trees, rocks, props) as circles; actors slide around them. */
  colliders(): readonly Collider[];
}

export interface Collider { x: number; z: number; r: number }

export function createWorld(scene: THREE.Scene): World {
  scene.background = new THREE.Color(0x000000);
  scene.fog = new THREE.FogExp2(0x000000, .02);
  const tmp = new THREE.Vector3();

  /* lights: moon, sky, warm pools */
  const hemi = new THREE.HemisphereLight(0x3a5684, 0x000000, .55);
  scene.add(hemi);
  const moon = new THREE.DirectionalLight(0xb4cbff, 3.0);
  moon.castShadow = true;
  moon.shadow.mapSize.set(2048, 2048);
  moon.shadow.camera.left = -26; moon.shadow.camera.right = 26; moon.shadow.camera.top = 26; moon.shadow.camera.bottom = -26;
  moon.shadow.camera.near = 1; moon.shadow.camera.far = 90;
  moon.shadow.bias = -.0006; moon.shadow.normalBias = .03;
  scene.add(moon, moon.target);
  // Low moon (~30° up) so it is visible in the sky from the third-person view; long shadows.
  const moonOffset = new THREE.Vector3(-24, 16, 12);
  const sunOffset = new THREE.Vector3(18, 30, -10);

  /* sky: moon/sun discs and stars, kept around the camera, never fogged */
  const skyDist = 280;
  const moonDisc = new THREE.Mesh(new THREE.CircleGeometry(9, 32), new THREE.MeshBasicMaterial({ color: 0xe8f0ff, fog: false }));
  const moonGlow = new THREE.Mesh(new THREE.CircleGeometry(20, 32), new THREE.MeshBasicMaterial({ color: 0x2a3a5a, fog: false, transparent: true, opacity: .5, depthWrite: false }));
  const sunDisc = new THREE.Mesh(new THREE.CircleGeometry(11, 32), new THREE.MeshBasicMaterial({ color: 0xfff2c8, fog: false }));
  const stars = (() => {
    let seed = 5; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const n = 900; const p = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const a = rnd() * Math.PI * 2; const e = Math.asin(.05 + rnd() * .95);
      p[i * 3] = Math.cos(a) * Math.cos(e) * skyDist; p[i * 3 + 1] = Math.sin(e) * skyDist; p[i * 3 + 2] = Math.sin(a) * Math.cos(e) * skyDist;
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    return new THREE.Points(g, new THREE.PointsMaterial({ color: 0xbfd0ff, size: 2, sizeAttenuation: false, fog: false }));
  })();
  for (const o of [moonDisc, moonGlow, sunDisc, stars]) { o.renderOrder = -1; scene.add(o); }
  let isDay = false;
  const night = { bg: new THREE.Color(0x000000), sky: 0x3a5684, hemi: .55 };
  const day = { bg: new THREE.Color(0x5d86b8), sky: 0xa8c8f0, hemi: 1.4 };
  const setDay = (d: boolean): void => {
    isDay = d;
    const s = d ? day : night;
    (scene.background as THREE.Color).copy(s.bg); (scene.fog as THREE.FogExp2).color.copy(s.bg);
    (scene.fog as THREE.FogExp2).density = d ? .008 : .02;
    hemi.color.setHex(s.sky); hemi.groundColor.setHex(d ? 0x3a4a2a : 0x000000); hemi.intensity = s.hemi;
    moon.color.setHex(d ? 0xfff1dc : 0xb4cbff); moon.intensity = d ? 3.6 : 3.0;
    moonDisc.visible = moonGlow.visible = stars.visible = !d; sunDisc.visible = d;
  };
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
      // Wind bends the blade in WORLD space, after the instance transform, toward (1,0,-1): that is
      // sideways on the isometric screen, so blades sway instead of seeming to grow and shrink.
      // Slow gust fronts travel across the field; between gusts the grass is almost still.
      shader.vertexShader = 'uniform float uTime;\n' + shader.vertexShader.replace('#include <project_vertex>', `
        vec4 mvPosition = instanceMatrix * vec4(transformed, 1.0);
        vec3 root = (instanceMatrix * vec4(0., 0., 0., 1.)).xyz;
        float bladeH = length(instanceMatrix[1].xyz);
        float front = sin(uTime * .7 - dot(root.xz, vec2(.09, .05)));
        float gust = front * front * front;              // mostly calm, short pushes
        float bend = (.08 + .22 * gust) * bladeH * position.y * position.y;
        mvPosition.xyz += vec3(.7071, 0., -.7071) * bend;
        mvPosition.y -= abs(bend) * .35 * position.y;    // bent blades get shorter, not longer
        mvPosition = modelViewMatrix * mvPosition;
        gl_Position = projectionMatrix * mvPosition;`);
    };
    const count = 45000;
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
      const h = .18 + rnd() * .22 + (patch > .3 ? .1 : 0);   // ankle-to-shin height next to 1.8 m people
      s.set(.1, h, .1); p.set(x, 0, z);    // wide enough to cover whole scene texels (stable glyphs)
      m.compose(p, q, s); grass.setMatrixAt(n, m);
      c.setHSL(.26 + rnd() * .09, .6 + rnd() * .25, .26 + rnd() * .24); grass.setColorAt(n, c);
      n++;
    }
    grass.count = n; grass.receiveShadow = true; scene.add(grass);

    const flowers = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(.07, 0), new THREE.MeshStandardMaterial({ roughness: .6, emissive: 0x1a0c22 }), 900);
    for (let i = 0; i < 900; i++) {
      let x = 0; let z = 0; do { x = (rnd() - .5) * 60; z = (rnd() - .5) * 60; } while (onPath(x, z));
      m.compose(p.set(x, .2 + rnd() * .25, z), q.identity(), s.set(.8, .8, .8)); flowers.setMatrixAt(i, m);
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

    setDay,
    update(t, camTarget, camera) {
      // Sky objects sit far away in the light's direction, centred on the camera, facing it.
      const lightDir = tmp.copy(isDay ? sunOffset : moonOffset).normalize();
      for (const disc of [moonDisc, moonGlow, sunDisc]) {
        disc.position.copy(camera.position).addScaledVector(lightDir, skyDist - (disc === moonGlow ? 1 : 0));
        disc.lookAt(camera.position);
      }
      stars.position.copy(camera.position);
      moon.position.copy(camTarget).addScaledVector(lightDir, 30); moon.target.position.copy(camTarget);
      windUniform.value = t;
      for (let i = 0; i < N; i++) {
        fpos[i * 3] = fbase[i * 3] + Math.sin(t * .5 + i) * .8;
        fpos[i * 3 + 1] = fbase[i * 3 + 1] + Math.sin(t * 1.3 + i * 2) * .3;
        fpos[i * 3 + 2] = fbase[i * 3 + 2] + Math.cos(t * .4 + i) * .8;
      }
      fgeo.attributes.position.needsUpdate = true;
    },
  };
}
