import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

// physics.ts has no imports, so transpile and load it directly.
const source = fs.readFileSync('src/engine/physics.ts', 'utf8');
const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
const { moveBody } = await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);

const tree = { x: 0, y: 0, radius: 3 };
let worstPenetration = 0;
// Every approach angle, walking / running / riding / galloping, at slow and stalled frame times.
for (const speed of [22, 36, 55, 85]) for (const dt of [1 / 144, 1 / 60, .05]) for (const radius of [2, 4]) {
  for (let angle = 0; angle < 360; angle += 5) {
    const a = angle * Math.PI / 180;
    const body = { x: Math.cos(a) * 60, y: Math.sin(a) * 60, vx: 0, vy: 0 };
    for (let frame = 0; frame < 400; frame++) {
      moveBody(body, -Math.cos(a), -Math.sin(a), speed, dt, [tree], radius);
      worstPenetration = Math.max(worstPenetration, tree.radius + radius - Math.hypot(body.x - tree.x, body.y - tree.y));
    }
  }
}
assert(worstPenetration < .01, `Body tunnelled/penetrated a trunk by ${worstPenetration.toFixed(3)} units`);

// Glancing contact must slide past, not stick.
const body = { x: -40, y: 4, vx: 0, vy: 0 };
for (let frame = 0; frame < 600; frame++) moveBody(body, 1, 0, 36, 1 / 60, [tree], 2);
assert(body.x > 20, `Glancing contact stuck at x=${body.x.toFixed(1)}`);

// Walking between two trunks with a gap wider than the body must pass.
const gap = [{ x: 0, y: -8, radius: 3 }, { x: 0, y: 8, radius: 3 }];
const walker = { x: -40, y: 0, vx: 0, vy: 0 };
for (let frame = 0; frame < 600; frame++) moveBody(walker, 1, 0, 36, 1 / 60, gap, 2);
assert(walker.x > 20, 'Body could not pass through an opening wider than itself');
console.log('PASS: no penetration at any speed/frame-time/angle, glancing slide, opening passable.');

// Footprints: arches keep their doorway open; tents/pillars are solid.
const { collidersFor } = await import(`data:text/javascript;base64,${Buffer.from(ts.transpileModule(fs.readFileSync('src/game/colliders.ts', 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText).toString('base64')}`);
const place = (id, category, width, scale) => ({ x: 0, y: 0, scale, asset: { id, category, width } });
// Walk +y (through a frame / across a base) starting at the given x offset.
function crossing(obstacles, startX) {
  const b = { x: startX, y: -80, vx: 0, vy: 0 };
  for (let frame = 0; frame < 900; frame++) moveBody(b, 0, 1, 36, 1 / 60, obstacles, 2);
  return b.y;
}
const arch = collidersFor(place('crypt-arch', 'Prop', 96, .85));
assert(crossing(arch, 0) > 40, 'Arch doorway is blocked');
assert(crossing(arch, 33 * .85) < 0, 'Arch pillar is passable');
assert(crossing(arch, -33 * .85) < 0, 'Arch pillar is passable');
const tent = collidersFor(place('tent', 'Prop', 96, .8));
for (const x of [-20, -8, 0, 8, 20]) assert(crossing(tent, x) < 0, `Tent base is passable at x=${x}`);
assert.deepEqual(collidersFor(place('flowers-blue', 'Vegetation', 56, .4)), [], 'Flowers/grass must not block');
console.log('PASS: arch doorway open, pillars and tent solid, vegetation nonblocking.');
