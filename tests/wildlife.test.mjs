import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

// Pure TS loader, matching tests/assets.test.mjs. No renderer, DOM or new dependency.
const moduleCache = new Map();
function load(location) {
  const absolute = path.resolve(location);
  if (moduleCache.has(absolute)) return moduleCache.get(absolute);
  const source = fs.readFileSync(absolute, 'utf8');
  let js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
  js = js.replace(/from ['"](.+?\.(?:ts|json))['"]/g, (_, relative) => {
    const target = path.resolve(path.dirname(absolute), relative);
    const url = relative.endsWith('.json') ? `data:text/javascript;base64,${Buffer.from('export default ' + fs.readFileSync(target, 'utf8')).toString('base64')}` : load(target);
    return `from ${JSON.stringify(url)}`;
  });
  const url = `data:text/javascript;base64,${Buffer.from(js).toString('base64')}`;
  moduleCache.set(absolute, url);
  return url;
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { validateFrame } = await import(load(path.join(root, 'src/assets/types.ts')));
const { ANIMALS } = await import(load(path.join(root, 'src/assets/animals/index.ts')));
const { CREATURES } = await import(load(path.join(root, 'src/assets/creatures.ts')));
const { Wildlife, WILDLIFE_CAPACITY } = await import(load(path.join(root, 'src/game/wildlife.ts')));
const { waterDepth } = await import(load(path.join(root, 'src/assets/landscape.ts')));

const required = ['cow', 'buffalo', 'wild-horse', 'goat', 'sheep', 'deer', 'sparrow', 'crow', 'parrot', 'vulture', 'firefly'];
assert.deepEqual(ANIMALS.map(asset => asset.id), required, 'Agent F registry IDs/order changed');
for (const asset of ANIMALS) {
  assert(asset.variants.length >= 2, `${asset.id} needs at least two variants`);
  for (const action of ['idle', 'walk']) for (const time of [.2, 1.3]) {
    const options = { time, seed: 9182, variant: 0, facing: 'right', action };
    const cells = asset.generate(options);
    assert(cells.length > (asset.id === 'firefly' ? 5 : 20), `${asset.id} ${action} is too sparse`);
    validateFrame(asset, cells);
    assert.deepEqual(cells, asset.generate(options), `${asset.id} is not deterministic`);
  }
  assert.notDeepEqual(asset.generate({ time: .2, seed: 4, variant: 0, facing: 'right', action: 'idle' }), asset.generate({ time: 1.3, seed: 4, variant: 0, facing: 'right', action: 'idle' }), `${asset.id} idle does not animate`);
}
for (const id of ['sparrow', 'crow', 'parrot', 'vulture']) {
  const asset = ANIMALS.find(a => a.id === id);
  const base = { time: .7, seed: 44, variant: 0, facing: 'right', action: 'idle' };
  assert.notDeepEqual(asset.generate(base), asset.generate({ ...base, action: 'fly' }), `${id} has no distinct flight pose`);
}
const horse = ANIMALS.find(asset => asset.id === 'wild-horse');
const horseBase = { time: .7, seed: 44, variant: 0, facing: 'right', action: 'walk' };
assert.notDeepEqual(horse.generate(horseBase), horse.generate({ ...horseBase, action: 'run' }), 'wild-horse has no gallop pose');
for (const id of ['butterfly-blue', 'butterfly-pink', 'butterfly-purple']) {
  const asset = CREATURES.find(a => a.id === id);
  assert(asset.variants.length >= 4, `${id} needs four colour variants`);
  const a = asset.generate({ time: .1, seed: 3, variant: 0, facing: 'right', action: 'idle' });
  const b = asset.generate({ time: .45, seed: 3, variant: 0, facing: 'right', action: 'idle' });
  validateFrame(asset, a); validateFrame(asset, b);
  assert.notDeepEqual(a, b, `${id} wings do not beat`);
}

function snapshot(wildlife) {
  return wildlife.animals.map(animal => ({ ...animal }));
}

function advance(wildlife, view, frames, player, night = false) {
  for (let i = 0; i < frames; i++) wildlife.update(1 / 60, view.x, view.y, view.w, view.h, player, night);
}

const replayA = new Wildlife(0x5a17);
const replayB = new Wildlife(0x5a17);
const stableReference = replayA.animals;
const replayViews = [
  [{ x: 390, y: -40, w: 280, h: 220 }, { x: 470, y: 60 }, false],
  [{ x: 620, y: -170, w: 300, h: 220 }, { x: 770, y: -60 }, false],
  [{ x: 610, y: 250, w: 220, h: 200 }, { x: 700, y: 330 }, false],
  [{ x: 60, y: 530, w: 240, h: 230 }, { x: 150, y: 640 }, false],
  [{ x: 430, y: 520, w: 230, h: 240 }, { x: 520, y: 620 }, true],
  [{ x: 390, y: -40, w: 280, h: 220 }, { x: 1000, y: 1000 }, false],
];
for (const [view, player, night] of replayViews) {
  advance(replayA, view, 150, player, night);
  advance(replayB, view, 150, player, night);
  assert.deepEqual(snapshot(replayA), snapshot(replayB), 'Same seed and update inputs must replay exactly');
  assert.equal(replayA.animals, stableReference, 'animals should be a stable readonly view');
}
assert(WILDLIFE_CAPACITY <= 150, 'Wildlife slot table exceeds the population budget');

const regions = [
  { name: 'meadow', view: { x: 390, y: -40, w: 280, h: 220 }, player: { x: 520, y: 90 } },
  { name: 'farm', view: { x: 620, y: -170, w: 300, h: 220 }, player: { x: 930, y: 20 } },
  { name: 'mudgate', view: { x: 610, y: 250, w: 220, h: 200 }, player: { x: 840, y: 330 } },
  { name: 'orcs', view: { x: 60, y: 530, w: 240, h: 230 }, player: { x: 310, y: 640 } },
  { name: 'elves', view: { x: 430, y: 520, w: 230, h: 240 }, player: { x: 650, y: 620 } },
  { name: 'crypt', view: { x: 120, y: -10, w: 250, h: 220 }, player: { x: 400, y: 100 } },
];
const seenDay = new Set(), seenNight = new Set();
const seenActions = new Map();
let maxPopulation = 0;
const airborne = new Set(['sparrow', 'crow', 'parrot', 'vulture']);
for (const region of regions) {
  const wildlife = new Wildlife(1701);
  for (const night of [false, true]) {
    advance(wildlife, region.view, 240, region.player, night);
    for (let frame = 0; frame < 30; frame++) {
      wildlife.update(1 / 60, region.view.x, region.view.y, region.view.w, region.view.h, region.player, night);
      maxPopulation = Math.max(maxPopulation, wildlife.animals.length);
      assert(wildlife.animals.length <= 150, `${region.name}: population escaped its bound`);
      for (const animal of wildlife.animals) {
        assert(Number.isFinite(animal.x) && Number.isFinite(animal.y) && Number.isFinite(animal.z), `${region.name}: non-finite animal`);
        assert(animal.z >= 0 && animal.scale > 0 && animal.scale < 1, `${region.name}: invalid transform`);
        const inWater = waterDepth(animal.x, animal.y) > 0;
        if (inWater) assert(airborne.has(animal.assetId) && animal.z > 0, `${region.name}: ${animal.assetId} placed in water at z=${animal.z}`);
        if (!airborne.has(animal.assetId)) assert(animal.z === 0 || animal.action === 'fly', `${region.name}: ground animal has invalid z`);
        if (animal.action !== 'fly') assert.equal(animal.z, 0, `${region.name}: idle/walk animal floats`);
        (night ? seenNight : seenDay).add(animal.assetId);
        if (!seenActions.has(animal.assetId)) seenActions.set(animal.assetId, new Set());
        seenActions.get(animal.assetId).add(animal.action);
      }
    }
  }
}
for (const id of required) assert(seenDay.has(id) || seenNight.has(id), `No habitat produced ${id}`);
for (const id of ['cow', 'sheep', 'goat', 'wild-horse', 'sparrow', 'crow', 'parrot', 'vulture', 'butterfly-blue', 'firefly']) assert(seenDay.has(id) || seenNight.has(id), `Missing expected wildlife ${id}`);
assert(!seenNight.has('butterfly-blue') && !seenNight.has('butterfly-pink') && !seenNight.has('butterfly-purple'), 'Butterflies remain active at night');
assert(!seenDay.has('firefly'), 'Fireflies remain active by day');
assert(seenActions.get('wild-horse')?.has('run'), 'Roaming wild horses never use the gallop pose');

// Herd cohesion: the meadow herd should not dissolve into isolated individuals.
const herd = new Wildlife(73);
const meadow = regions[0];
advance(herd, meadow.view, 420, meadow.player, false);
const cows = herd.animals.filter(a => a.assetId === 'cow');
assert(cows.length >= 3, 'Meadow did not produce a cow herd');
const cowCenter = cows.reduce((sum, a) => ({ x: sum.x + a.x / cows.length, y: sum.y + a.y / cows.length }), { x: 0, y: 0 });
assert(cows.every(a => Math.hypot(a.x - cowCenter.x, a.y - cowCenter.y) < 95), 'Cow herd drifted too far apart');

// Ground birds take off when the player closes in.
const birds = new Wildlife(991);
advance(birds, meadow.view, 300, { x: 1000, y: 1000 }, false);
const sparrow = birds.animals.find(a => a.assetId === 'sparrow');
assert(sparrow, 'No sparrow available for the flee test');
for (let i = 0; i < 20; i++) birds.update(1 / 60, meadow.view.x, meadow.view.y, meadow.view.w, meadow.view.h, { x: sparrow.x, y: sparrow.y }, false);
assert(birds.animals.some(a => airborne.has(a.assetId) && a.action === 'fly' && a.z > 1), 'Ground birds did not fly away from the player');

// Vultures circle high over the orc camp rather than standing on the ground.
const carrion = new Wildlife(812);
const orcs = regions[3];
advance(carrion, orcs.view, 300, orcs.player, false);
const vultures = carrion.animals.filter(a => a.assetId === 'vulture');
assert(vultures.length > 0, 'Orc camp has no vultures');
assert(vultures.every(a => a.action === 'fly' && a.z > 70 && Math.hypot(a.x - 150, a.y - 640) < 115), 'Vulture circle is not high/contained');
const firstVulture = { x: vultures[0].x, y: vultures[0].y };
advance(carrion, orcs.view, 120, orcs.player, false);
const movedVulture = carrion.animals.find(a => a.id === vultures[0].id);
assert(movedVulture && Math.hypot(movedVulture.x - firstVulture.x, movedVulture.y - firstVulture.y) > 5, 'Vultures do not circle');

console.log(`PASS: ${ANIMALS.length} wildlife assets, runtime flight/gallop poses, deterministic replay, ${maxPopulation} peak animals, water safety, temporal insects, herd cohesion, bird flee and vulture circling.`);
