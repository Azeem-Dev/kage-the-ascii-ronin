// Transpiles src/engine/*.ts to a temp dir (".ts" imports -> ".mjs") and imports them as ES modules.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

let cache;
export async function loadEngine() {
  if (cache) return cache;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kage-engine-'));
  for (const file of fs.readdirSync('src/engine')) {
    if (!file.endsWith('.ts')) continue;
    const src = fs.readFileSync(path.join('src/engine', file), 'utf8');
    let js = ts.transpileModule(src, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
    js = js.replace(/(from\s+['"]\.\/[\w-]+)\.ts(['"])/g, '$1.mjs$2');
    fs.writeFileSync(path.join(dir, file.replace(/\.ts$/, '.mjs')), js);
  }
  const load = name => import(pathToFileURL(path.join(dir, `${name}.mjs`)).href);
  cache = { physics: await load('physics'), spatialHash: await load('spatialHash'), wind: await load('wind'), particles: await load('particles'), softbody: await load('softbody'), fixedStep: await load('fixedStep') };
  return cache;
}
