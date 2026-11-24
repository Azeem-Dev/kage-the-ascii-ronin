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
  js = js.replace(/from ['"](.+?\.ts)['"]/g, (_, relative) => `from ${JSON.stringify(load(path.resolve(path.dirname(absolute), relative)))}`);
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
      if (asset.id !== 'rock') assert.notDeepEqual(first, asset.generate({ ...options, time: 3.7 }), `${asset.id} does not animate`);
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
console.log(`PASS: ${ASSETS.length} assets, ${frames} valid deterministic frames, animated asset variation, bounds, variants, seeds, river semantics and invalid data rejection.`);
