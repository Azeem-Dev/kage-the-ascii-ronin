import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

// Load pure TS modules through the existing compiler; no new runtime dependency.
function load(location) {
  const absolute = path.resolve(location);
  const source = fs.readFileSync(absolute, 'utf8');
  let js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
  js = js.replace(/from ['"](.+?\.(?:ts|json))['"]/g, (_, relative) => {
    const target = path.resolve(path.dirname(absolute), relative);
    const url = relative.endsWith('.json') ? `data:text/javascript;base64,${Buffer.from('export default ' + fs.readFileSync(target, 'utf8')).toString('base64')}` : load(target);
    return `from ${JSON.stringify(url)}`;
  });
  return `data:text/javascript;base64,${Buffer.from(js).toString('base64')}`;
}
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const typesUrl = load(path.join(root, 'src/assets/types.ts'));
const { validateFrame } = await import(typesUrl);
const { ASSETS } = await import(load(path.join(root, 'src/assets/catalog.ts')));
const ids = new Set();
let frames = 0;
for (const asset of ASSETS) {
  assert(!ids.has(asset.id), `Duplicate ID ${asset.id}`); ids.add(asset.id);
  assert(asset.anchor.x >= 0 && asset.anchor.x < asset.width && asset.anchor.y >= 0 && asset.anchor.y < asset.height);
  for (let variant = 0; variant < asset.variants.length; variant++) {
    for (const seed of [0, 17, 99999]) for (const facing of ['left', 'right']) for (const action of ['idle', 'walk']) {
      const options = { time: 1.25, seed, variant, facing, action };
      const first = asset.generate(options);
      assert(first.length > 0, `${asset.id} is empty`);
      validateFrame(asset, first);
      assert.deepEqual(first, asset.generate(options), `${asset.id} is not deterministic`);
      if (!['Equipment', 'Prop'].includes(asset.category) && asset.id !== 'rock') assert.notDeepEqual(first, asset.generate({ ...options, time: 3.7 }), `${asset.id} does not animate`);
      frames++;
    }
  }
  const base = { time: 0, seed: 17, variant: 0, facing: 'right', action: 'idle' };
  assert.notDeepEqual(asset.generate(base), asset.generate({ ...base, seed: 18 }), `${asset.id} seed has no effect`);
  assert.notDeepEqual(asset.generate(base), asset.generate({ ...base, variant: 1 }), `${asset.id} variant has no effect`);
}
assert.throws(() => validateFrame(ASSETS[0], [{ x: -1, y: 0, glyph: 'x', color: '#ffffff' }]));
assert.throws(() => validateFrame(ASSETS[0], [{ x: 0, y: 0, glyph: 'xx', color: '#ffffff' }]));
const { landscapeCell, riverCenter, waterDepth } = await import(load(path.join(root, 'src/assets/landscape.ts')));
assert(waterDepth(riverCenter(230), 230) > 0);
assert(waterDepth(riverCenter(230) + 100, 230) < 0);
const sample = landscapeCell(400, 230, 1, 17);
landscapeCell(-15, 200, 4, 999);
assert.deepEqual(landscapeCell(400, 230, 1, 17), sample, 'Landscape cache changes deterministic data');
const { WorldChunks, generateChunk } = await import(load(path.join(root, 'src/game/worldChunks.ts')));
assert.deepEqual(generateChunk(-4, 7), generateChunk(-4, 7), 'Chunk regeneration differs');
const world = new WorldChunks();
const original = world.around(0, 0, 300, 160);
assert.equal(world.around(1, 1, 300, 160), original, 'Same chunk window allocates a new prop list');
world.around(20000, -20000, 300, 160);
assert(world.loadedCount < 50, 'Distant chunk travel retains old chunks');
assert.deepEqual(world.around(0, 0, 300, 160), original, 'Returning to an evicted region changes props');
const { AssetCache } = await import(load(path.join(root, 'src/render/assetCache.ts')));
let generated = 0;
const definition = { ...ASSETS[1], generate: o => { generated++; return ASSETS[1].generate(o); } };
const glyphIds = new Map();
const fakeRenderer = {
  compile: () => ({ width: 1, height: 1, ids: new Uint32Array(1) }),
  glyph: (glyph, color) => { const key = `${glyph}:${color}`; if (!glyphIds.has(key)) glyphIds.set(key, glyphIds.size + 1); return glyphIds.get(key); },
};
const cache = new AssetCache(fakeRenderer);
const options = { time: 0, seed: 17, variant: 0, facing: 'right', action: 'idle' };
const compiled = cache.get(definition, options, .2);
assert.equal(cache.get(definition, { ...options, time: 5 }, .2), compiled);
assert.equal(generated, 1, 'Static trees regenerate on animation ticks');
const { TerrainLayer } = await import(load(path.join(root, 'src/render/terrainLayer.ts')));
const terrain = new TerrainLayer(fakeRenderer);
// The ground itself must never change with time; only grass sway and water glints animate on top.
terrain.get(0, 0, 12, 12, 4, 0);
const ground = terrain.stable.slice();
terrain.get(0, 0, 12, 12, 4, 5);
assert.deepEqual(terrain.stable, ground, 'Ground texture changes with time');
terrain.get(4, 0, 12, 12, 4, 5);
const shifted = terrain.stable;
for (let y = 0; y < 12; y++) for (let x = 0; x < 11; x++) assert.equal(shifted[y * 12 + x], ground[y * 12 + x + 1], 'Coarse camera movement resamples ground texture');
const { moveBody } = await import(load(path.join(root, 'src/engine/physics.ts')));
const body = { x: 0, y: 0, vx: 0, vy: 0 };
for (let i = 0; i < 120; i++) moveBody(body, 1, 0, 85, 1 / 60, [{ x: 15, y: 0, radius: 3 }], 2);
assert(body.x <= 10, 'Fast movement tunnels through a collider');
const slider = { x: 0, y: 0, vx: 0, vy: 0 };
for (let i = 0; i < 120; i++) moveBody(slider, 1, 1, 22, 1 / 60, [{ x: 15, y: 12, radius: 4 }], 2);
assert(slider.y > 15, 'Movement cannot slide around a collider');
for (let i = 0; i < 120; i++) moveBody(slider, 0, 0, 22, 1 / 60, [], 2);
assert.equal(slider.vx, 0); assert.equal(slider.vy, 0);
console.log(`PASS: ${ASSETS.length} assets, ${frames} valid deterministic frames, animated asset variation, bounds, variants, seeds, river semantics and invalid data rejection.`);
