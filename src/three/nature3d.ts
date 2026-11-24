import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { noise } from '../assets/types.ts';
import { GROUND, groundAt, riverCenter, roadDistance, waterDepth } from '../assets/landscape.ts';

const GRASSY = new Set<number>([GROUND.LUSH, GROUND.FOREST, GROUND.FLOWER, GROUND.MEADOW, GROUND.CLEAR, GROUND.TOWN, GROUND.FARM, GROUND.BANK]);
const FLOWER_COLORS = [0x7aa8ff, 0xff8ec8, 0xc89cff, 0xffd166, 0xfff2d8, 0xff9b7a];

/**
 * Fine grass blades: thin bright strokes over darker ground, as in the references.
 * Placement is a world-anchored jittered grid (deterministic, no flicker); wind sway
 * runs in the vertex shader.
 */
export class Grass {
  readonly mesh: THREE.InstancedMesh;
  private uniforms = { uTime: { value: 0 } };
  private dummy = new THREE.Object3D();
  private color = new THREE.Color();

  constructor(private capacity: number, private radius: number, private spacing: number, private heightAt: (x: number, y: number) => number) {
    // A tuft: three tapered, slightly curved blades fanned around the root.
    const blades: THREE.BufferGeometry[] = [];
    for (let k = 0; k < 3; k++) {
      const blade = new THREE.PlaneGeometry(1.1, 7, 1, 4);
      blade.translate(0, 3.5, 0);
      const pos = blade.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < pos.count; i++) {
        const t = pos.getY(i) / 7;
        pos.setX(i, pos.getX(i) * (1 - t * .92));
        pos.setZ(i, t * t * 1.6); // natural droop
      }
      blade.rotateZ((k - 1) * .28);
      blade.rotateY(k * 2.1);
      blade.translate((k - 1) * .7, 0, (k % 2) * .6);
      blades.push(blade);
    }
    const tuft = mergeGeometries(blades);
    const material = new THREE.MeshStandardMaterial({ roughness: .95, side: THREE.DoubleSide });
    material.onBeforeCompile = shader => {
      shader.uniforms.uTime = this.uniforms.uTime;
      shader.vertexShader = 'uniform float uTime;\nvarying float vTip;\n' + shader.vertexShader.replace('#include <begin_vertex>', `
        #include <begin_vertex>
        vec4 rootWorld = instanceMatrix * vec4(0., 0., 0., 1.);
        // Gusts travel across the field as waves, plus a small flutter.
        float sway = sin(uTime * 1.3 + rootWorld.x * .035 + rootWorld.z * .02) * .55 + sin(uTime * 3.3 + rootWorld.x * .19 + rootWorld.z * .11) * .15;
        float bend = clamp(position.y / 7., 0., 1.);
        vTip = bend;
        transformed.x += sway * bend * bend * 2.6;
        transformed.z += sway * bend * bend * 1.1;`);
      // Dark at the root, bright at the tip: reads as soft depth, not flat spikes.
      shader.fragmentShader = 'varying float vTip;\n' + shader.fragmentShader.replace('#include <color_fragment>', `
        #include <color_fragment>
        diffuseColor.rgb *= mix(.22, 1.15, vTip);`);
    };
    this.mesh = new THREE.InstancedMesh(tuft, material, capacity);
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 3), 3);
    this.mesh.frustumCulled = false;
    this.mesh.receiveShadow = true;
  }

  rebuild(cx: number, cz: number): void {
    let n = 0;
    const s = this.spacing; const r = this.radius;
    for (let gz = Math.floor((cz - r) / s); gz <= Math.ceil((cz + r) / s) && n < this.capacity; gz++) {
      for (let gx = Math.floor((cx - r) / s); gx <= Math.ceil((cx + r) / s) && n < this.capacity; gx++) {
        const x = gx * s + noise(gx, gz, 11) * s; const z = gz * s + noise(gx, gz, 12) * s;
        if ((x - cx) ** 2 + (z - cz) ** 2 > r * r) continue;
        const ground = groundAt(x, z);
        if (!GRASSY.has(ground) || waterDepth(x, z) > -2 || roadDistance(x, z) < 9) continue;
        // Even coverage; soft large-scale height waves instead of bare patches.
        if (noise(gx, gz, 13) < (ground === GROUND.FOREST ? .45 : ground === GROUND.TOWN ? .6 : .06)) continue;
        const field = .5 + .5 * Math.sin(x * .021 + Math.sin(z * .017) * 2) * Math.cos(z * .019);
        const h = .55 + field * .7 + noise(gx, gz, 14) * .35;
        this.dummy.position.set(x, this.heightAt(x, z), z);
        this.dummy.rotation.set(0, noise(gx, gz, 15) * Math.PI, (noise(gx, gz, 16) - .5) * .5);
        this.dummy.scale.set(1, h, 1);
        this.dummy.updateMatrix();
        this.mesh.setMatrixAt(n, this.dummy.matrix);
        const flower = ground === GROUND.FLOWER || ground === GROUND.MEADOW ? noise(gx, gz, 17) : 0;
        if (flower > .86) this.color.setHex(FLOWER_COLORS[Math.floor(noise(gx, gz, 18) * FLOWER_COLORS.length)]);
        // Cool greens with a little yellow in taller patches, like moonlit meadow.
        else this.color.setRGB(.2 + field * .14 + noise(gx, gz, 19) * .08, .46 + field * .16 + noise(gx, gz, 20) * .1, .28 + (1 - field) * .08);
        this.mesh.setColorAt(n, this.color);
        n++;
      }
    }
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  update(time: number): void { this.uniforms.uTime.value = time; }
}

/** White glints and foam drifting downstream on the dark current. */
export class WaterSparkles {
  readonly points: THREE.Points;
  private seeds: Float32Array;
  private positions: Float32Array;

  constructor(private count: number) {
    this.positions = new Float32Array(count * 3);
    this.seeds = Float32Array.from({ length: count * 3 }, (_, i) => noise(i, 7, 31));
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.points = new THREE.Points(geometry, new THREE.PointsMaterial({ color: 0xeaf6ff, size: 3, sizeAttenuation: false, transparent: true, opacity: .95, depthWrite: false }));
    this.points.frustumCulled = false;
  }

  update(time: number, cx: number, cz: number, span: number): void {
    for (let i = 0; i < this.count; i++) {
      // Each glint loops downstream along the river through a band around the camera.
      const along = ((this.seeds[i * 3] * span + time * (14 + this.seeds[i * 3 + 1] * 16)) % span) - span / 2;
      const z = cz + along;
      const across = (this.seeds[i * 3 + 2] - .5) * 2;
      const x = riverCenter(z) + across * 34 + Math.sin(time * 1.3 + i) * 1.5;
      const visible = waterDepth(x, z) > 3 && Math.sin(time * 4 + i * 1.7) > -.2;
      this.positions[i * 3] = x; this.positions[i * 3 + 1] = visible ? -1 : -500; this.positions[i * 3 + 2] = z;
    }
    (this.points.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    void cx;
  }
}
