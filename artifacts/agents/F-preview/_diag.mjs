import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
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
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const { ASSETS } = await import(load(path.join(root, 'src/assets/catalog.ts')));
for (const asset of ASSETS) {
  if (['Equipment', 'Prop', 'Terrain', 'Vegetation'].includes(asset.category) || asset.id === 'rock') continue;
  const fails = [];
  for (let variant = 0; variant < asset.variants.length; variant++)
    for (const seed of [0, 17, 99999]) for (const facing of ['left', 'right']) for (const action of ['idle', 'walk']) {
      const a = asset.generate({ time: 1.25, seed, variant, facing, action });
      const b = asset.generate({ time: 3.7, seed, variant, facing, action });
      if (JSON.stringify(a) === JSON.stringify(b)) fails.push(`${action}/v${variant}/s${seed}/${facing}`);
    }
  if (fails.length) console.log(asset.id, fails.length, fails.slice(0, 8).join(' '));
}
