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
const { Wildlife } = await import(load(path.join(root, 'src/game/wildlife.ts')));
const views = [
  [430, 20, 280, 220], [770, -60, 300, 220], [700, 330, 220, 200], [150, 640, 240, 230], [520, 620, 230, 240],
];
const w = new Wildlife(1701);
for (const [x, y, vw, vh] of views) for (let i = 0; i < 200; i++) w.update(1 / 60, x, y, vw, vh, { x: x + 80, y: y + 50 }, false);
const N = 6000;
let worst = 0, peak = 0;
const t0 = performance.now();
for (let i = 0; i < N; i++) {
  const [x, y, vw, vh] = views[Math.floor(i / 1200) % views.length];
  const a = performance.now();
  w.update(1 / 60, x, y, vw, vh, { x: x + 80 + (i % 60), y: y + 50 }, (i % 600) >= 300);
  const ms = performance.now() - a;
  if (ms > worst) worst = ms;
  peak = Math.max(peak, w.animals.length);
}
const total = performance.now() - t0;
console.log(`avg ${(total / N).toFixed(4)} ms/update, worst ${worst.toFixed(3)} ms, peak ${peak} live`);
