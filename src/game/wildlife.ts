import { forestDensity, groundAt, GROUND, waterDepth } from '../assets/landscape.ts';

export type WildlifeAction = 'idle' | 'walk' | 'fly' | 'run';

/** A render-ready animal. x/y are world ground coordinates; z is height above
 * that ground (draw the asset anchor at y - z). All values are deterministic. */
export interface WildAnimal {
  id: string;
  assetId: string;
  x: number;
  y: number;
  z: number;
  facing: 'left' | 'right';
  action: WildlifeAction;
  variant: number;
  seed: number;
  scale: number;
}

type SpeciesId = 'cow' | 'buffalo' | 'wild-horse' | 'goat' | 'sheep' | 'deer' | 'sparrow' | 'crow' | 'parrot' | 'vulture' | 'butterfly' | 'firefly';
type Motion = 'herd' | 'horse' | 'deer' | 'bird' | 'parrot' | 'vulture' | 'butterfly' | 'firefly';

interface Species {
  id: SpeciesId;
  assetId: string;
  count: number;
  scale: number;
  variants: number;
  speed: number;
  motion: Motion;
  temporal?: 'day' | 'night';
}

const SPECIES: readonly Species[] = [
  { id: 'cow', assetId: 'cow', count: 10, scale: .32, variants: 2, speed: 1.25, motion: 'herd' },
  { id: 'buffalo', assetId: 'buffalo', count: 5, scale: .32, variants: 2, speed: 1.05, motion: 'herd' },
  { id: 'wild-horse', assetId: 'wild-horse', count: 5, scale: .33, variants: 3, speed: 4.2, motion: 'horse' },
  { id: 'goat', assetId: 'goat', count: 6, scale: .27, variants: 3, speed: 1.55, motion: 'herd' },
  { id: 'sheep', assetId: 'sheep', count: 8, scale: .27, variants: 3, speed: 1.15, motion: 'herd' },
  { id: 'deer', assetId: 'deer', count: 6, scale: .32, variants: 2, speed: 3.1, motion: 'deer' },
  { id: 'sparrow', assetId: 'sparrow', count: 10, scale: .11, variants: 3, speed: 1.4, motion: 'bird' },
  { id: 'crow', assetId: 'crow', count: 8, scale: .13, variants: 2, speed: 1.8, motion: 'bird' },
  { id: 'parrot', assetId: 'parrot', count: 5, scale: .13, variants: 2, speed: 2.2, motion: 'parrot' },
  { id: 'vulture', assetId: 'vulture', count: 4, scale: .2, variants: 2, speed: 1, motion: 'vulture' },
  { id: 'butterfly', assetId: 'butterfly-blue', count: 18, scale: .2, variants: 4, speed: 1.35, motion: 'butterfly', temporal: 'day' },
  { id: 'firefly', assetId: 'firefly', count: 24, scale: .12, variants: 2, speed: .85, motion: 'firefly', temporal: 'night' },
];

export const WILDLIFE_CAPACITY = SPECIES.reduce((sum, species) => sum + species.count, 0);
const MARGIN = 96;
const SPAWN_INTERVAL = .3;
const SPAWN_BUDGET = 16;
const CANDIDATE_TRIES = 7;
const ORC_CAMP = { x: 150, y: 640 } as const;
const MEADOW = { x: 430, y: 20 } as const;
const ELF_GROVE = { x: 520, y: 620 } as const;

interface Slot {
  index: number;
  speciesIndex: number;
  species: Species;
  seed: number;
  generation: number;
  retryAt: number;
  animal?: WildAnimal;
  targetX: number;
  targetY: number;
  targetZ: number;
  nextThink: number;
  fleeing: boolean;
  landing: boolean;
  orbitRadius: number;
  orbitPhase: number;
}

function hash(value: number): number {
  let n = value | 0;
  n = Math.imul(n ^ (n >>> 16), 0x7feb352d);
  n = Math.imul(n ^ (n >>> 15), 0x846ca68b);
  return (n ^ (n >>> 16)) >>> 0;
}

function random(seed: number, salt: number): number {
  return hash(seed ^ Math.imul(salt + 1, 0x9e3779b1)) / 4294967296;
}

function near(x: number, y: number, cx: number, cy: number, radius: number): boolean {
  return (x - cx) ** 2 + (y - cy) ** 2 < radius * radius;
}

function allowedGround(kind: number, grounds: readonly number[]): boolean {
  return grounds.includes(kind);
}

/** Habitat is sampled from the very same terrain functions used by the renderer. */
function habitatOk(species: Species, x: number, y: number): boolean {
  const depth = waterDepth(x, y);
  if (species.motion === 'vulture') return near(x, y, ORC_CAMP.x, ORC_CAMP.y, 115);
  if (species.motion === 'bird' || species.motion === 'parrot') {
    // Grounded birds must never stand in the river. Airborne birds may cross it.
    if (depth > -6) return false;
    const ground = groundAt(x, y);
    if (species.id === 'crow') {
      const fields = x > 590 && x < 930 && y > -195 && y < 25;
      const mudgate = x > 595 && x < 825 && y > 235 && y < 435;
      return (fields || mudgate) && allowedGround(ground, [GROUND.FARM, GROUND.MUD, GROUND.ASH, GROUND.CLEAR, GROUND.DIRT]);
    }
    if (species.id === 'parrot') return near(x, y, ELF_GROVE.x, ELF_GROVE.y, 105) && allowedGround(ground, [GROUND.FLOWER, GROUND.LUSH, GROUND.FOREST, GROUND.MEADOW]);
    return allowedGround(ground, [GROUND.MEADOW, GROUND.FARM, GROUND.LUSH, GROUND.CLEAR, GROUND.FLOWER, GROUND.TOWN, GROUND.DIRT]);
  }
  // Insects stay over banks/land even though their z is positive.
  if (depth > -4) return false;
  if (species.motion === 'firefly') {
    if (depth > -44) return true;
    const ground = groundAt(x, y);
    return allowedGround(ground, [GROUND.MEADOW, GROUND.FLOWER, GROUND.LUSH]) && (near(x, y, MEADOW.x, MEADOW.y, 155) || near(x, y, ELF_GROVE.x, ELF_GROVE.y, 105));
  }
  if (species.motion === 'butterfly') {
    const ground = groundAt(x, y);
    return allowedGround(ground, [GROUND.FLOWER, GROUND.MEADOW, GROUND.LUSH]) && (ground === GROUND.FLOWER || near(x, y, MEADOW.x, MEADOW.y, 165) || near(x, y, ELF_GROVE.x, ELF_GROVE.y, 115));
  }
  if (depth > -8) return false;
  const ground = groundAt(x, y);
  const density = forestDensity(x, y);
  switch (species.id) {
    case 'cow': return allowedGround(ground, [GROUND.MEADOW, GROUND.FARM, GROUND.LUSH, GROUND.CLEAR]) && density < .76;
    case 'buffalo': return allowedGround(ground, [GROUND.MUD, GROUND.MEADOW, GROUND.FARM, GROUND.LUSH]) && density < .72;
    case 'wild-horse': return allowedGround(ground, [GROUND.MEADOW, GROUND.CLEAR, GROUND.LUSH]) && density < .58;
    case 'goat': return allowedGround(ground, [GROUND.FARM, GROUND.MEADOW, GROUND.LUSH, GROUND.CLEAR]) && density < .7;
    case 'sheep': return allowedGround(ground, [GROUND.FARM, GROUND.MEADOW, GROUND.LUSH, GROUND.CLEAR, GROUND.TOWN]) && density < .68;
    case 'deer': return density > .34 && density < .88 && allowedGround(ground, [GROUND.FOREST, GROUND.LUSH, GROUND.CLEAR, GROUND.MEADOW]);
    default: return false;
  }
}

function moveToward(animal: WildAnimal, targetX: number, targetY: number, speed: number, dt: number): number {
  const dx = targetX - animal.x, dy = targetY - animal.y;
  const distance = Math.hypot(dx, dy);
  if (distance < .001) return 0;
  const step = Math.min(distance, speed * dt);
  animal.x += dx / distance * step;
  animal.y += dy / distance * step;
  if (Math.abs(dx) > .05) animal.facing = dx < 0 ? 'left' : 'right';
  return distance;
}

/**
 * Small deterministic wildlife simulation. It owns no renderer, DOM or global
 * randomness. Population is bounded by the fixed slot table (109, below 150).
 */
export class Wildlife {
  private readonly slots: Slot[] = [];
  private readonly live: WildAnimal[] = [];
  private readonly sumsX = new Float64Array(SPECIES.length);
  private readonly sumsY = new Float64Array(SPECIES.length);
  private readonly counts = new Uint16Array(SPECIES.length);
  private clock = 0;
  private nextSpawn = 0;
  private spawnCursor = 0;
  private lastNight: boolean | undefined;

  constructor(worldSeed: number) {
    for (let speciesIndex = 0; speciesIndex < SPECIES.length; speciesIndex++) {
      const species = SPECIES[speciesIndex];
      for (let i = 0; i < species.count; i++) {
        const index = this.slots.length;
        const seed = hash(worldSeed ^ Math.imul(index + 1, 0x45d9f3b));
        this.slots.push({
          index, speciesIndex, species, seed, generation: 0, retryAt: 0,
          targetX: 0, targetY: 0, targetZ: 0, nextThink: 0,
          fleeing: false, landing: false,
          orbitRadius: 28 + random(seed, 2) * 42,
          orbitPhase: random(seed, 3) * Math.PI * 2,
        });
      }
    }
  }

  get animals(): readonly WildAnimal[] { return this.live; }

  update(dt: number, viewX: number, viewY: number, viewW: number, viewH: number, player: { x: number; y: number }, isNight: boolean): void {
    const step = Number.isFinite(dt) ? Math.max(0, Math.min(.1, dt)) : 0;
    this.clock += step;
    const width = Math.max(1, viewW), height = Math.max(1, viewH);
    const minX = viewX - MARGIN, maxX = viewX + width + MARGIN;
    const minY = viewY - MARGIN, maxY = viewY + height + MARGIN;
    if (this.lastNight !== isNight) {
      this.lastNight = isNight;
      this.nextSpawn = 0;
    }

    this.sumsX.fill(0); this.sumsY.fill(0); this.counts.fill(0);
    for (const slot of this.slots) {
      const animal = slot.animal;
      if (!animal) continue;
      if ((slot.species.temporal === 'day' && isNight) || (slot.species.temporal === 'night' && !isNight) ||
          animal.x < minX || animal.x > maxX || animal.y < minY || animal.y > maxY) {
        slot.animal = undefined;
        continue;
      }
      this.sumsX[slot.speciesIndex] += animal.x;
      this.sumsY[slot.speciesIndex] += animal.y;
      this.counts[slot.speciesIndex]++;
    }

    for (const slot of this.slots) {
      const animal = slot.animal;
      if (!animal) continue;
      if (slot.species.motion === 'vulture') this.updateVulture(slot, animal);
      else if (slot.species.motion === 'butterfly' || slot.species.motion === 'firefly') this.updateInsect(slot, animal, step);
      else if (slot.species.motion === 'bird' || slot.species.motion === 'parrot') this.updateBird(slot, animal, step, player);
      else this.updateGround(slot, animal, step, player);
    }

    // A small per-frame budget avoids a population spike while crossing regions.
    if (this.clock + 1e-9 >= this.nextSpawn) {
      let attempts = 0;
      while (attempts < SPAWN_BUDGET) {
        const slot = this.slots[this.spawnCursor];
        this.spawnCursor = (this.spawnCursor + 1) % this.slots.length;
        attempts++;
        if (slot.animal || slot.retryAt > this.clock) continue;
        if ((slot.species.temporal === 'day' && isNight) || (slot.species.temporal === 'night' && !isNight)) continue;
        this.spawn(slot, viewX, viewY, width, height, minX, maxX, minY, maxY);
      }
      this.nextSpawn = this.clock + SPAWN_INTERVAL;
    }

    this.live.length = 0;
    for (const slot of this.slots) if (slot.animal) this.live.push(slot.animal);
  }

  private spawn(slot: Slot, viewX: number, viewY: number, viewW: number, viewH: number, minX: number, maxX: number, minY: number, maxY: number): void {
    const { species, seed } = slot;
    let anchor: WildAnimal | undefined;
    if (species.motion === 'herd' || species.id === 'crow') {
      for (const other of this.slots) {
        if (other.speciesIndex === slot.speciesIndex && other.animal) { anchor = other.animal; break; }
      }
    }
    for (let attempt = 0; attempt < CANDIDATE_TRIES; attempt++) {
      const salt = slot.generation * 17 + attempt;
      let x: number, y: number, z = 0;
      if (species.motion === 'vulture') {
        const angle = random(seed, salt + 40) * Math.PI * 2;
        x = ORC_CAMP.x + Math.cos(angle) * slot.orbitRadius;
        y = ORC_CAMP.y + Math.sin(angle) * slot.orbitRadius * .62;
        z = 82 + random(seed, salt + 41) * 28;
      } else if (anchor) {
        const angle = random(seed, salt + 42) * Math.PI * 2;
        const distance = 9 + random(seed, salt + 43) * (species.id === 'crow' ? 30 : 38);
        x = anchor.x + Math.cos(angle) * distance;
        y = anchor.y + Math.sin(angle) * distance;
      } else {
        x = viewX - 54 + random(seed, salt + 44) * (viewW + 108);
        y = viewY - 54 + random(seed, salt + 45) * (viewH + 108);
      }
      if (species.motion === 'butterfly' || species.motion === 'firefly') z = 3 + random(seed, salt + 46) * 5;
      if (x < minX || x > maxX || y < minY || y > maxY || !habitatOk(species, x, y)) continue;
      const generation = slot.generation++;
      const animal: WildAnimal = {
        id: `wild-${species.id}-${slot.index}-${generation}`,
        assetId: species.id === 'butterfly' ? ['butterfly-blue', 'butterfly-pink', 'butterfly-purple'][Math.floor(random(seed, salt + 47) * 3)] : species.assetId,
        x, y, z,
        facing: random(seed, salt + 48) < .5 ? 'left' : 'right',
        action: species.motion === 'butterfly' || species.motion === 'firefly' || species.motion === 'vulture' ? 'fly' : 'idle',
        variant: Math.floor(random(seed, salt + 49) * species.variants),
        seed: Math.floor(random(seed, salt + 50) * 1_000_000),
        scale: species.scale * (.96 + random(seed, salt + 51) * .08),
      };
      slot.animal = animal;
      slot.targetX = x; slot.targetY = y; slot.targetZ = z;
      slot.nextThink = this.clock + .2 + random(seed, salt + 52) * 1.4;
      slot.retryAt = 0; slot.fleeing = false; slot.landing = false;
      return;
    }
    slot.retryAt = this.clock + .55 + random(seed, 60) * .5;
  }

  private updateGround(slot: Slot, animal: WildAnimal, dt: number, player: { x: number; y: number }): void {
    const { species } = slot;
    const toPlayerX = animal.x - player.x, toPlayerY = animal.y - player.y;
    const playerDistance = Math.hypot(toPlayerX, toPlayerY);
    if (species.motion === 'deer') {
      if (playerDistance < 72) slot.fleeing = true;
      else if (playerDistance > 112) slot.fleeing = false;
    }
    if (slot.fleeing && species.motion === 'deer') {
      const length = Math.max(1, playerDistance);
      slot.targetX = animal.x + toPlayerX / length * 65;
      slot.targetY = animal.y + toPlayerY / length * 65;
      animal.action = 'walk';
      moveToward(animal, slot.targetX, slot.targetY, 12.5, dt);
      animal.z = 0;
      return;
    }
    if (this.clock >= slot.nextThink) {
      const count = this.counts[slot.speciesIndex];
      const centerX = count ? this.sumsX[slot.speciesIndex] / count : animal.x;
      const centerY = count ? this.sumsY[slot.speciesIndex] / count : animal.y;
      const angle = random(slot.seed, Math.floor(this.clock * 10) + 70) * Math.PI * 2;
      const radius = species.motion === 'horse' ? 32 : species.id === 'cow' ? 24 : 14;
      let tx = centerX + Math.cos(angle) * radius;
      let ty = centerY + Math.sin(angle) * radius;
      if (!habitatOk(species, tx, ty) || waterDepth(tx, ty) > -8) {
        tx = animal.x + Math.cos(angle) * 5;
        ty = animal.y + Math.sin(angle) * 5;
      }
      slot.targetX = tx; slot.targetY = ty;
      const wandering = random(slot.seed, Math.floor(this.clock * 10) + 71) < (species.id === 'buffalo' ? .22 : species.motion === 'horse' ? .68 : .4);
      // Wild horses gallop while roaming; every other species uses the walk cycle.
      animal.action = wandering ? (species.motion === 'horse' ? 'run' : 'walk') : 'idle';
      slot.nextThink = this.clock + (wandering ? 1.1 : 2.4) + random(slot.seed, Math.floor(this.clock * 10) + 72) * 3;
    }
    if (animal.action === 'idle') { animal.z = 0; return; }
    let dx = slot.targetX - animal.x, dy = slot.targetY - animal.y;
    const centerDistance = Math.hypot(animal.x - this.sumsX[slot.speciesIndex] / Math.max(1, this.counts[slot.speciesIndex]), animal.y - this.sumsY[slot.speciesIndex] / Math.max(1, this.counts[slot.speciesIndex]));
    if (species.motion !== 'horse' && centerDistance > 48) {
      dx += (this.sumsX[slot.speciesIndex] / this.counts[slot.speciesIndex] - animal.x) * .8;
      dy += (this.sumsY[slot.speciesIndex] / this.counts[slot.speciesIndex] - animal.y) * .8;
    }
    // Local separation keeps herds readable without an allocation or a spatial hash.
    if (species.motion === 'herd') for (const other of this.slots) {
      if (other === slot || other.speciesIndex !== slot.speciesIndex || !other.animal) continue;
      const ox = animal.x - other.animal.x, oy = animal.y - other.animal.y;
      const d2 = ox * ox + oy * oy;
      if (d2 > .01 && d2 < 64) { dx += ox / d2 * 2; dy += oy / d2 * 2; }
    }
    const length = Math.hypot(dx, dy);
    if (length < .01) return;
    const speed = species.speed * (.82 + random(slot.seed, 80) * .36);
    const nx = animal.x + dx / length * speed * dt;
    const ny = animal.y + dy / length * speed * dt;
    if (waterDepth(nx, ny) <= -7 && habitatOk(species, nx, ny)) {
      animal.x = nx; animal.y = ny;
      animal.facing = dx < 0 ? 'left' : 'right';
    } else {
      animal.action = 'idle';
      slot.nextThink = this.clock + .5;
    }
    if (Math.hypot(slot.targetX - animal.x, slot.targetY - animal.y) < 1.2) {
      animal.action = 'idle';
      slot.nextThink = this.clock + 1.5 + random(slot.seed, 81) * 2.5;
    }
    animal.z = 0;
  }

  private updateBird(slot: Slot, animal: WildAnimal, dt: number, player: { x: number; y: number }): void {
    const distance = Math.hypot(animal.x - player.x, animal.y - player.y);
    if (animal.action !== 'fly' && distance < (slot.species.id === 'parrot' ? 22 : 30)) {
      const length = Math.max(1, distance);
      slot.targetX = animal.x + (animal.x - player.x) / length * 75;
      slot.targetY = animal.y + (animal.y - player.y) / length * 75;
      slot.targetZ = 20 + random(slot.seed, 90) * 18;
      slot.fleeing = true; slot.landing = false;
      animal.action = 'fly';
      slot.nextThink = this.clock + 1.4;
    }
    if (animal.action === 'fly') {
      if (slot.fleeing && distance > 95 && this.clock >= slot.nextThink) {
        let found = false;
        for (let i = 0; i < 5 && !found; i++) {
          const angle = random(slot.seed, 91 + i) * Math.PI * 2;
          const x = animal.x + Math.cos(angle) * (12 + i * 5);
          const y = animal.y + Math.sin(angle) * (12 + i * 5);
          if (habitatOk(slot.species, x, y)) { slot.targetX = x; slot.targetY = y; found = true; }
        }
        if (found) { slot.targetZ = 0; slot.fleeing = false; slot.landing = true; }
      }
      moveToward(animal, slot.targetX, slot.targetY, slot.landing ? 8 : slot.species.speed * 8, dt);
      animal.z += (slot.targetZ - animal.z) * Math.min(1, dt * 2.2);
      const landingDistance = Math.hypot(slot.targetX - animal.x, slot.targetY - animal.y);
      if (slot.landing && landingDistance > 2 && animal.z < 1.2) animal.z = 1.2;
      if (slot.landing && animal.z < .45 && landingDistance < 2 && habitatOk(slot.species, animal.x, animal.y)) {
        animal.z = 0; animal.action = 'idle'; slot.landing = false;
        slot.nextThink = this.clock + 1 + random(slot.seed, 96) * 2;
      }
      return;
    }
    if (this.clock >= slot.nextThink) {
      const angle = random(slot.seed, Math.floor(this.clock * 10) + 97) * Math.PI * 2;
      const radius = 4 + random(slot.seed, Math.floor(this.clock * 10) + 98) * 10;
      const x = animal.x + Math.cos(angle) * radius, y = animal.y + Math.sin(angle) * radius;
      if (habitatOk(slot.species, x, y)) { slot.targetX = x; slot.targetY = y; }
      animal.action = random(slot.seed, Math.floor(this.clock * 10) + 99) < .62 ? 'walk' : 'idle';
      slot.nextThink = this.clock + .7 + random(slot.seed, Math.floor(this.clock * 10) + 100) * 1.8;
    }
    if (animal.action === 'walk') {
      const nx = animal.x + (slot.targetX - animal.x) * Math.min(1, dt * slot.species.speed);
      const ny = animal.y + (slot.targetY - animal.y) * Math.min(1, dt * slot.species.speed);
      if (waterDepth(nx, ny) < -6 && habitatOk(slot.species, nx, ny)) { animal.x = nx; animal.y = ny; }
      else animal.action = 'idle';
      if (Math.hypot(slot.targetX - animal.x, slot.targetY - animal.y) < .8) animal.action = 'idle';
    }
    animal.z = 0;
  }

  private updateInsect(slot: Slot, animal: WildAnimal, dt: number): void {
    if (this.clock >= slot.nextThink) {
      for (let i = 0; i < 4; i++) {
        const angle = random(slot.seed, Math.floor(this.clock * 10) + 110 + i) * Math.PI * 2;
        const radius = 8 + random(slot.seed, Math.floor(this.clock * 10) + 114 + i) * 18;
        const x = animal.x + Math.cos(angle) * radius, y = animal.y + Math.sin(angle) * radius;
        if (habitatOk(slot.species, x, y)) { slot.targetX = x; slot.targetY = y; break; }
      }
      slot.targetZ = 3 + random(slot.seed, Math.floor(this.clock * 10) + 118) * 5;
      slot.nextThink = this.clock + .8 + random(slot.seed, Math.floor(this.clock * 10) + 119) * 1.8;
    }
    const beforeX = animal.x, beforeY = animal.y;
    moveToward(animal, slot.targetX, slot.targetY, slot.species.speed, dt);
    if (!habitatOk(slot.species, animal.x, animal.y)) { animal.x = beforeX; animal.y = beforeY; slot.nextThink = this.clock + .2; }
    animal.z = slot.targetZ + Math.sin(this.clock * 2 + slot.orbitPhase) * .65;
    animal.action = 'fly';
  }

  private updateVulture(slot: Slot, animal: WildAnimal): void {
    const angle = slot.orbitPhase + this.clock * (.1 + random(slot.seed, 120) * .08);
    animal.x = ORC_CAMP.x + Math.cos(angle) * slot.orbitRadius;
    animal.y = ORC_CAMP.y + Math.sin(angle) * slot.orbitRadius * .62;
    animal.z = 94 + Math.sin(angle * 1.7) * 7;
    animal.facing = Math.sin(angle) < 0 ? 'left' : 'right';
    animal.action = 'fly';
  }
}
