import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

// physics.ts imports spatialHash.ts (type + helpers): load the engine through the shared loader.
import { loadEngine } from './engine-loader.mjs';
const engine = await loadEngine();
const { moveBody, resolveBodies, createBody3D, jump, moveBody3D, stepVertical, SpatialHash } = { ...engine.physics, ...engine.spatialHash };
const { Wind } = engine.wind;
const { ParticleSystem, ParticleKind } = engine.particles;
const { Chain, Cloth, segmentGlyph } = engine.softbody;
const { FixedStepper } = engine.fixedStep;

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

// ---------------------------------------------------------------------------------------------
// New engine tests (Agent D)
let seedState = 5;
const rnd = () => (seedState = (seedState * 1664525 + 1013904223) >>> 0) / 4294967296;
const penetration = (b, obs, r) => { let w = 0; for (const o of obs) w = Math.max(w, o.radius + r - Math.hypot(b.x - o.x, b.y - o.y)); return w; };

// COLL-01: the old resolver (obstacle by obstacle, no re-check) pushed the body into a neighbouring tree.
function legacyMoveBody(body, dx, dy, speed, dt, obstacles, radius = 2) {
  const length = Math.hypot(dx, dy);
  const blend = 1 - Math.exp(-dt * (length ? 12 : 16));
  body.vx += ((length ? dx / length * speed : 0) - body.vx) * blend;
  body.vy += ((length ? dy / length * speed : 0) - body.vy) * blend;
  const steps = Math.max(1, Math.ceil(Math.hypot(body.vx, body.vy) * dt / 1.2));
  for (let i = 0; i < steps; i++) {
    let x = body.x + body.vx * dt / steps, y = body.y + body.vy * dt / steps;
    for (const o of obstacles) {
      const ddx = x - o.x, ddy = y - o.y, d = Math.hypot(ddx, ddy), c = radius + o.radius;
      if (d >= c) continue;
      const nx = d > .0001 ? ddx / d : -1, ny = d > .0001 ? ddy / d : 0;
      x = o.x + nx * c; y = o.y + ny * c;
      const inw = body.vx * nx + body.vy * ny; if (inw < 0) { body.vx -= inw * nx; body.vy -= inw * ny; }
    }
    body.x = x; body.y = y;
  }
}
{
  let legacyFails = 0, fails = 0, runs = 0;
  for (let scene = 0; scene < 300; scene++) {
    const obs = []; for (let i = 0; i < 6; i++) obs.push({ x: (rnd() - .5) * 14, y: (rnd() - .5) * 14, radius: 2.5 + rnd() * 1.5 });
    for (const dt of [1 / 60, .05]) {
      const a = rnd() * 6.28; const sx = Math.cos(a) * 40, sy = Math.sin(a) * 40;   // target is the cluster centre, behind the trees
      const old = { x: sx, y: sy, vx: 0, vy: 0 }, cur = { ...old };
      let worstOld = 0, worst = 0;
      for (let f = 0; f < 300; f++) {
        legacyMoveBody(old, -sx, -sy, 55, dt, obs, 2); moveBody(cur, -sx, -sy, 55, dt, obs, 2);
        worstOld = Math.max(worstOld, penetration(old, obs, 2)); worst = Math.max(worst, penetration(cur, obs, 2));
      }
      runs++; if (worstOld > .01) legacyFails++; if (worst > .01) fails++;
    }
  }
  assert(legacyFails > 20, `COLL-01 not reproduced with the legacy resolver (${legacyFails}/${runs})`);
  assert.equal(fails, 0, `COLL-01: ${fails}/${runs} runs ended inside a tree`);
  console.log(`PASS: COLL-01 reproduced (legacy penetrates in ${legacyFails}/${runs} click-to-move runs) and fixed (0).`);
}

// Dense pack of obstacles, every speed and dt up to 0.05, via array and via SpatialHash: never inside any obstacle.
{
  const pack = []; for (let i = 0; i < 80; i++) pack.push({ x: (rnd() - .5) * 60, y: (rnd() - .5) * 60, radius: 1.5 + rnd() * 2 });
  pack.push({ ax: -30, ay: 25, bx: 30, by: 28, radius: 1 });
  const hash = new SpatialHash(16).build(pack);
  const depth = (b, r) => { const p = { x: 0, y: 0 }; let w = 0; for (const o of pack) { engine.spatialHash.closestOnObstacle(o, b.x, b.y, p); w = Math.max(w, o.radius + r - Math.hypot(b.x - p.x, b.y - p.y)); } return w; };
  let worst = 0;
  for (const speed of [22, 36, 55, 85]) for (const dt of [1 / 144, 1 / 60, .033, .05]) for (const source of [pack, hash]) {
    for (let k = 0; k < 12; k++) {
      const a = k * .52; const b = { x: Math.cos(a) * 55, y: Math.sin(a) * 55, vx: 0, vy: 0 };
      if (depth(b, 2) > 0) continue;
      for (let f = 0; f < 250; f++) { moveBody(b, -Math.cos(a), -Math.sin(a), speed, dt, source, 2); worst = Math.max(worst, depth(b, 2)); }
    }
  }
  assert(worst < .01, `packed obstacles: penetration ${worst.toFixed(3)}`);
  // hash and brute force must produce the same trajectory
  const t1 = { x: 50, y: -3, vx: 0, vy: 0 }, t2 = { ...t1 };
  for (let f = 0; f < 300; f++) { moveBody(t1, -1, .1, 36, 1 / 60, pack, 2); moveBody(t2, -1, .1, 36, 1 / 60, hash, 2); }
  assert(Math.abs(t1.x - t2.x) < 1e-9 && Math.abs(t1.y - t2.y) < 1e-9, 'SpatialHash trajectory differs from brute force');
  // capsule wall blocks and slides
  const wall = [{ ax: -20, ay: 0, bx: 20, by: 0, radius: 1.5 }];
  const w = { x: 0, y: -30, vx: 0, vy: 0 };
  for (let f = 0; f < 400; f++) moveBody(w, 0, 1, 36, 1 / 60, wall, 2);
  assert(w.y < -3.4, `walked through a wall segment (y=${w.y.toFixed(2)})`);
  const w2 = { x: -10, y: -30, vx: 0, vy: 0 };
  for (let f = 0; f < 80; f++) moveBody(w2, .6, 1, 36, 1 / 60, wall, 2);
  assert(w2.y < -3.4 && w2.x > 8, `did not slide along the wall (${w2.x.toFixed(1)}, ${w2.y.toFixed(1)})`);
  console.log(`PASS: packed obstacles (array + hash) no penetration (worst ${worst.toFixed(4)}), hash == brute force, capsule walls block and slide.`);
}

// Spatial hash returns the same contacts as brute force on random scenes.
{
  const { overlapsCircle } = engine.spatialHash;
  for (let scene = 0; scene < 40; scene++) {
    const items = [];
    for (let i = 0; i < 200; i++) items.push(rnd() < .8 ? { x: (rnd() - .5) * 400, y: (rnd() - .5) * 400, radius: .5 + rnd() * 6 }
      : { ax: (rnd() - .5) * 400, ay: (rnd() - .5) * 400, bx: (rnd() - .5) * 400, by: (rnd() - .5) * 400, radius: 1 + rnd() * 2 });
    const h = new SpatialHash(8 + rnd() * 50).build(items); const out = [];
    for (let q = 0; q < 60; q++) {
      const x = (rnd() - .5) * 440, y = (rnd() - .5) * 440, r = rnd() * 20;
      const expect = items.filter(o => overlapsCircle(o, x, y, r));
      h.query(x, y, r, out);
      assert.equal(out.length, expect.length, 'hash contact count differs from brute force');
      assert(expect.every(o => out.includes(o)), 'hash missed a contact');
    }
  }
  console.log('PASS: spatial hash contacts == brute force on 40 random scenes (circles + capsules).');
}

// Body vs body with mass.
{
  const horse = { x: 0, y: 0, vx: 0, vy: 0, radius: 6, mass: 400 };
  const goblin = { x: 5, y: 0, vx: 0, vy: 0, radius: 3, mass: 40 };
  resolveBodies([horse, goblin], undefined, 4);
  assert(Math.hypot(horse.x - goblin.x, horse.y - goblin.y) >= 9 - 1e-6, 'bodies still overlap');
  const horseMoved = Math.hypot(horse.x, horse.y), goblinMoved = Math.hypot(goblin.x - 5, goblin.y);
  assert(Math.abs(goblinMoved / horseMoved - 10) < .01, `mass ratio push ${(goblinMoved / horseMoved).toFixed(2)} != 10`);
  const wallBody = { x: 0, y: 0, vx: 0, vy: 0, radius: 5, mass: Infinity };
  const p = { x: 3, y: 0, vx: -30, vy: 0, radius: 2, mass: 80 };
  resolveBodies([wallBody, p]);
  assert(wallBody.x === 0 && p.x >= 7 - 1e-6 && p.vx >= -1e-6, 'immovable body moved or approach velocity kept');
  // player walks into a standing horse and cannot pass; ghost (mounted) bodies are ignored
  const player = { x: -30, y: 0, vx: 0, vy: 0, radius: 2, mass: 80 };
  const stable = { x: 0, y: 0, vx: 0, vy: 0, radius: 6, mass: 500 };
  for (let f = 0; f < 300; f++) { moveBody(player, 1, 0, 36, 1 / 60, [], 2); resolveBodies([player, stable]); }
  assert(player.x < stable.x - 7.9 && stable.x < 25, `player passed through / shoved the horse (player ${player.x.toFixed(1)}, horse ${stable.x.toFixed(1)})`);
  const rider = { x: 0, y: 0, vx: 0, vy: 0, radius: 2, mass: 80, solid: false };
  const before = stable.x; resolveBodies([rider, stable]); assert.equal(stable.x, before);
  // pushed bodies never end inside a tree
  const tree = [{ x: 10, y: 0, radius: 3 }]; const big = { x: 0, y: 0, vx: 0, vy: 0, radius: 5, mass: 900 }; const small = { x: 7, y: 0, vx: 0, vy: 0, radius: 2, mass: 30 };
  resolveBodies([big, small], tree, 6);
  assert(Math.hypot(small.x - 10, small.y) >= 5 - .01, 'pushed NPC was shoved into a tree');
  console.log('PASS: body-vs-body separation, mass ratio 10:1, immovable, player blocked by horse, mounted ghost, statics win.');
}

// Gravity, jump, coyote, buffering.
{
  const G = 400, V = 150, dt = 1 / 60;
  const b = createBody3D(0, 0);
  assert(jump(b, V) === true && b.grounded === false);
  let apex = 0, steps = 0;
  while (!b.landed && steps++ < 600) { moveBody3D(b, 0, 0, 0, dt, []); apex = Math.max(apex, b.z); }
  assert(Math.abs(apex - V * V / (2 * G)) < .5, `apex ${apex.toFixed(2)} != ${(V * V / (2 * G)).toFixed(2)}`);
  assert(b.z === 0 && b.vz === 0 && b.grounded && b.landed, 'did not land at z = 0');
  assert(Math.abs(b.impact - V) < G * dt, `impact speed ${b.impact}`);
  // cannot double jump
  const d = createBody3D(0, 0); jump(d, V);
  for (let i = 0; i < 12; i++) moveBody3D(d, 0, 0, 0, dt, []);
  const vzMid = d.vz; assert.equal(jump(d, V), false); moveBody3D(d, 0, 0, 0, dt, []);
  assert(d.vz < vzMid, 'double jump changed vertical velocity');
  let apex2 = 0; for (let i = 0; i < 200; i++) { moveBody3D(d, 0, 0, 0, dt, []); apex2 = Math.max(apex2, d.z); if (d.landed) break; }
  assert(apex2 < V * V / (2 * G) + .5, 'double jump went higher than a single jump');
  // jump buffering: pressed .06 s before landing fires on touchdown
  const e = createBody3D(0, 0); e.z = 1.0; e.grounded = false; e.vz = -60;
  jump(e, V); assert(e.jumpBuffer > 0 && !e.jumped);
  for (let i = 0; i < 6; i++) moveBody3D(e, 0, 0, 0, dt, []);
  assert(e.jumped && e.vz > 0, 'buffered jump did not fire on landing');
  // a press > .1 s before landing is dropped
  const f = createBody3D(0, 0); f.z = 40; f.grounded = false; f.vz = 0; jump(f, V);
  let fired = false; for (let i = 0; i < 120 && !f.landed; i++) { moveBody3D(f, 0, 0, 0, dt, []); if (f.vz > 0) fired = true; }
  assert(!fired, 'stale buffered jump fired');
  // coyote time: walk off a ledge, jump within 0.1 s works, after 0.1 s it does not
  const ledge = { groundHeight: x => x < 10 ? 20 : 0, stepHeight: 4 };
  const run = delay => {
    const c = createBody3D(0, 0, 20); c.grounded = true;
    for (let i = 0; i < 40 && c.x < 10.5; i++) moveBody3D(c, 1, 0, 40, dt, [], 2, ledge);
    assert(!c.grounded, 'did not leave the ledge');
    for (let i = 0; i < delay; i++) moveBody3D(c, 1, 0, 40, dt, [], 2, ledge);
    return jump(c, V);
  };
  assert.equal(run(2), true, 'coyote jump refused inside the window');
  assert.equal(run(9), false, 'coyote jump allowed after the window');
  // step height: a 3-unit step is walkable, a 10-unit wall is not (but can be jumped onto)
  const stepped = { groundHeight: x => x > 10 ? 3 : 0 }, high = { groundHeight: x => x > 10 ? 10 : 0 };
  const s1 = createBody3D(0, 0), s2 = createBody3D(0, 0);
  for (let i = 0; i < 200; i++) { moveBody3D(s1, 1, 0, 30, dt, [], 2, stepped); moveBody3D(s2, 1, 0, 30, dt, [], 2, high); }
  assert(s1.x > 30 && s1.z === 3, `could not walk up a 3-unit step (${s1.x}, ${s1.z})`);
  assert(s2.x <= 10.01 && s2.z === 0, `walked up a 10-unit wall (${s2.x}, ${s2.z})`);
  const s3 = createBody3D(5, 0); jump(s3, 200);
  for (let i = 0; i < 240; i++) moveBody3D(s3, 1, 0, 30, dt, [], 2, high);
  assert(s3.z === 10 && s3.x > 12, `could not jump onto a 10-unit ledge (${s3.x}, ${s3.z})`);
  // air control is reduced
  const gnd = createBody3D(0, 0), air = createBody3D(0, 0, 50); air.grounded = false;
  for (let i = 0; i < 6; i++) { moveBody3D(gnd, 1, 0, 40, dt, []); moveBody3D(air, 1, 0, 40, dt, []); }
  assert(air.vx < gnd.vx * .6, 'airborne steering is not reduced');
  console.log(`PASS: jump apex ${apex.toFixed(2)} (expected ${(V * V / (2 * G)).toFixed(2)}), landing, no double jump, buffering, coyote, step height, air control.`);
}

// Wind: deterministic, allocation-free sampling, levels, gust fronts.
{
  const w = new Wind('breeze', .35, 7);
  w.update(1.234); w.update(.5);
  const a = w.at(112.3, -45.6), b = w.at(112.3, -45.6);
  assert(a.x === b.x && a.y === b.y && a.strength === b.strength, 'wind not deterministic for the same (x, y, t)');
  const w2 = new Wind('breeze', .35, 7);
  w2.update(1.234); w2.update(.5);
  const c = w2.at(112.3, -45.6);
  assert(a.x === c.x && a.y === c.y && a.strength === c.strength, 'same seed + time gave different wind');
  // a different seed changes the field somewhere
  const w3 = new Wind('breeze', .35, 99);
  w3.update(1.234); w3.update(.5);
  assert([112.3, -45.6, 30, 77, -12, 5.5].some((v, i) => i % 2 === 0 && w3.at(v, [ -45.6, 77, 5.5 ][i / 2]).x !== w.at(v, [ -45.6, 77, 5.5 ][i / 2]).x), 'different seed gave identical wind');
  // atInto writes into a reused object and agrees with at
  const out = { x: 0, y: 0, strength: 0 };
  const returned = w.atInto(out, 112.3, -45.6);
  assert(returned === out && out.x === a.x && out.y === a.y && out.strength === a.strength, 'atInto disagrees with at');
  // base strength eases toward the level; calm stays far below storm
  const calm = new Wind('calm'), storm = new Wind('storm');
  for (let i = 0; i < 600; i++) { calm.update(1 / 60); storm.update(1 / 60); }
  assert(calm.strength < storm.strength / 3, `calm (${calm.strength.toFixed(2)}) not far below storm (${storm.strength.toFixed(2)})`);
  // travelling gust fronts: the field varies across space at one instant
  let min = Infinity, max = -Infinity;
  for (let gx = -200; gx <= 200; gx += 20) for (let gy = -200; gy <= 200; gy += 20) {
    const s = storm.at(gx, gy).strength; min = Math.min(min, s); max = Math.max(max, s);
  }
  assert(max - min > .05, `no spatial gust variation (${min.toFixed(2)}..${max.toFixed(2)})`);
  console.log('PASS: wind deterministic per (x,y,t), atInto == at, calm/storm levels ease, gust fronts vary across space.');
}

// Particles: pool bounded, every kind dies, no NaN, rain splashes, z never negative.
{
  const wind = new Wind('storm', .35, 3);
  const ps = new ParticleSystem(2000, 42);
  const made = ps.emit('rain', 0, 0, 300, 5000, 50);
  assert.equal(ps.count, 2000, 'pool exceeded capacity');
  assert.equal(made, 2000, 'emit claimed to fit more than the pool');
  const healthy = q => {
    for (let i = 0; i < q.count; i++) {
      if (!Number.isFinite(q.x[i]) || !Number.isFinite(q.y[i]) || !Number.isFinite(q.z[i])
        || !Number.isFinite(q.vx[i]) || !Number.isFinite(q.vy[i]) || !Number.isFinite(q.vz[i])
        || !Number.isFinite(q.life[i]) || q.z[i] < -1e-6) return false;
    }
    return true;
  };
  let steps = 0, splashed = 0;
  while (ps.count > 0 && steps < 3000) {
    ps.update(1 / 60, wind);
    if (!healthy(ps)) break;
    ps.forEach((x, y, z, k) => { if (k === ParticleKind.splash) splashed++; });
    steps++;
  }
  assert(healthy(ps), 'particle state went NaN / below ground');
  assert.equal(ps.count, 0, `rain particles did not all die (${ps.count} after ${steps} steps)`);
  assert(splashed > 0, 'rain produced no splashes on ground impact');
  // every kind spawns, simulates and dies, with and without wind
  for (const name of ['dust', 'leaf', 'spark', 'splash', 'rain', 'smoke']) {
    for (const withWind of [true, false]) {
      const q = new ParticleSystem(512, 7);
      assert(q.emit(name, 3, 4, 12, 300, 3) === 300, `${name} did not spawn into an empty pool`);
      let s = 0;
      while (q.count > 0 && s < 2400) { q.update(1 / 60, withWind ? wind : null); s++; }
      assert(healthy(q), `${name} went NaN (${withWind ? 'with' : 'without'} wind)`);
      assert.equal(q.count, 0, `${name} never died (${withWind ? 'with' : 'without'} wind, ${s} steps)`);
    }
  }
  // clear empties the pool
  ps.emit('smoke', 0, 0, 0, 100, 1); ps.clear(); assert.equal(ps.count, 0, 'clear() did not empty the pool');
  console.log('PASS: particles bounded by pool, rain dies + splashes, all 6 kinds die cleanly with/without wind, no NaN, z >= 0.');
}

// Soft bodies: pinned points follow anchors exactly, no NaN, chain length exact under storm,
// wearer collision holds, cloth stays intact, everything settles when the anchor stops.
{
  const wind = new Wind('storm', .35, 3);
  const chain = new Chain(12, 2.5);
  let anchorOK = true, nan = false, stretchMax = 0;
  for (let f = 0; f < 600; f++) {
    wind.update(1 / 60);
    const ax = Math.sin(f * .05) * 25, ay = Math.cos(f * .04) * 15, az = 40 + Math.sin(f * .11) * 6;
    chain.setAnchor(ax, ay, az);
    chain.update(1 / 60, wind);
    if (chain.x[0] !== ax || chain.y[0] !== ay || chain.z[0] !== az) anchorOK = false;
    stretchMax = Math.max(stretchMax, chain.maxStretch());
    for (let i = 0; i < 12; i++) if (!Number.isFinite(chain.x[i]) || !Number.isFinite(chain.y[i]) || !Number.isFinite(chain.z[i])) nan = true;
  }
  assert(anchorOK, 'pinned chain root does not exactly follow its anchor');
  assert(!nan, 'chain produced NaN');
  assert(stretchMax <= .05, `chain stretched ${(stretchMax * 100).toFixed(1)}% under storm wind (budget 5%)`);
  // wearer collision: points stay outside a capsule
  const wearer = new Chain(12, 2.5, { windForce: 40 });
  wearer.colliders.push({ ax: 0, ay: 0, az: 0, bx: 0, by: 0, bz: 60, radius: 5 });
  let inside = false;
  for (let f = 0; f < 400; f++) {
    wind.update(1 / 60);
    wearer.setAnchor(12, Math.sin(f * .03) * 8, 45);
    wearer.update(1 / 60, wind);
    for (let i = 0; i < wearer.n; i++) {
      const t = Math.max(0, Math.min(60, wearer.z[i]));
      const dist = Math.hypot(wearer.x[i], wearer.y[i], wearer.z[i] - t);
      if (dist < 5 - .001) inside = true;
    }
  }
  assert(!inside, 'a chain point passed through the wearer capsule');
  assert(!Number.isNaN(wearer.x.reduce((s, v) => s + v, 0)), 'wearer chain produced NaN');
  // cloth: pinned top row follows the anchor line exactly, stays intact under storm
  const cloth = new Cloth(8, 10, 24, 34);
  let clothOK = true, clothNan = false, clothStretch = 0;
  for (let f = 0; f < 600; f++) {
    const ax = -12 + Math.sin(f * .02) * 4, ay = Math.sin(f * .01) * 3;
    const bx = 12 + Math.sin(f * .02) * 4, by = Math.cos(f * .013) * 3;
    cloth.setAnchorLine(ax, ay, 40, bx, by, 40);
    cloth.update(1 / 60, wind);
    if (cloth.x[0] !== ax || cloth.y[0] !== ay || cloth.x[7] !== bx || cloth.y[7] !== by) clothOK = false;
    clothStretch = Math.max(clothStretch, cloth.maxStretch());
    for (let i = 0; i < cloth.n; i++) if (!Number.isFinite(cloth.x[i]) + !Number.isFinite(cloth.y[i]) + !Number.isFinite(cloth.z[i])) clothNan = true;
  }
  assert(clothOK, 'cloth top corners do not exactly follow the anchor line');
  assert(!clothNan, 'cloth produced NaN');
  assert(clothStretch <= .2, `cloth distorted ${(clothStretch * 100).toFixed(1)}% under storm wind (tear guard 20%)`);
  // settles when the anchor stops (energy decays)
  const still = new Chain(12, 2.5, { windForce: 0 });
  for (let f = 0; f < 120; f++) { still.setAnchor(f * .3, 0, 40); still.update(1 / 60, null); }
  still.setAnchor(36, 0, 40);
  let peak = 0, late = 0;
  for (let f = 0; f < 400; f++) { still.update(1 / 60, null); if (f < 80) peak = Math.max(peak, still.energy()); late = still.energy(); }
  assert(late < peak * .02 && late < .05, `chain did not settle after the anchor stopped (energy ${late.toExponential(2)}, peak ${peak.toExponential(2)})`);
  // segment glyph suggestions stay in the promised set
  const glyphs = ['|', '/', '\\', '~', "'"];
  const segments = [
    [0, 0, 0, 0, 5, 0], [0, 0, 0, 5, 5, 0], [0, 0, 0, 5, 0, 0],
    [0, 0, 0, 0, 0, 5], [0, 0, 0, -5, -5, 0], [0, 0, 0, 0, 0, 0],
  ];
  for (const segment of segments) assert(glyphs.includes(segmentGlyph(...segment)), `segmentGlyph returned an unexpected glyph for ${segment}`);
  console.log(`PASS: softbody anchors exact, no NaN, chain stretch ${(stretchMax * 100).toFixed(2)}% (budget 5%), wearer capsule holds, cloth intact (${(clothStretch * 100).toFixed(1)}%), settles (energy ${late.toExponential(2)} < 2% of peak ${peak.toExponential(2)}).`);
}

// Fixed stepper: exact step count, interpolation alpha, catch-up cap, pause.
{
  const step = new FixedStepper(60, 5, .25);
  let ran = 0, dtSeen = 0;
  for (let f = 0; f < 120; f++) {
    const alpha = step.advance(1 / 60, dt => { ran++; dtSeen += dt; });
    assert(alpha >= 0 && alpha < 1, 'alpha out of [0,1)');
  }
  assert.equal(ran, 120, '60 Hz frames did not run one step each');
  assert(Math.abs(dtSeen - 2) < 1e-9, 'steps did not run at exactly 1/60 s');
  step.reset(); ran = 0;
  for (let f = 0; f < 60; f++) step.advance(1 / 30, () => ran++);
  assert.equal(ran, 120, '30 Hz frames did not run two steps each');
  step.reset();
  step.advance(1 / 120, () => {});
  assert(Math.abs(step.alpha - .5) < .01, `half-step alpha ${step.alpha.toFixed(3)} != 0.5`);
  step.reset(); ran = 0;
  step.advance(10, () => ran++);   // tab switch: 10 s clamped to .25 s, capped at 5 steps
  assert.equal(ran, 5, 'catch-up exceeded the step cap');
  assert(step.dropped > .1, 'backlog beyond the cap was not dropped');
  assert(step.alpha < 1, 'accumulator left above one step after the cap');
  step.reset(); step.paused = true; ran = 0;
  for (let f = 0; f < 120; f++) step.advance(1 / 60, () => ran++);
  assert.equal(ran, 0, 'paused stepper ran updates');
  step.paused = false;
  const fresh = step.advance(1 / 120, () => ran++);
  assert.equal(ran, 0, 'half a step ran an update after unpause');
  assert(Math.abs(fresh - .5) < .01, 'alpha did not reflect only the fresh half-step');
  step.advance(1 / 120, () => ran++);
  assert.equal(ran, 1, 'second fresh half-step did not run one update');
  assert(fresh < 1, 'alpha jumped after unpause');
  console.log('PASS: fixed stepper 60/30 Hz step counts, alpha interpolation, catch-up cap drops backlog, pause stops accumulation.');
}

// Performance: 2,000+ particles + 500 colliders + 30 bodies under 2 ms; softbody budget under 1 ms.
{
  let s = 1234567; const prnd = () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
  const pack = [];
  for (let i = 0; i < 450; i++) pack.push({ x: (prnd() - .5) * 800, y: (prnd() - .5) * 800, radius: 1.5 + prnd() * 3 });
  for (let i = 0; i < 50; i++) { const x = (prnd() - .5) * 800, y = (prnd() - .5) * 800; pack.push({ ax: x, ay: y, bx: x + (prnd() - .5) * 60, by: y + (prnd() - .5) * 60, radius: 1 + prnd() * 2 }); }
  const hash = new SpatialHash(24).build(pack);
  const npcs = [];
  for (let i = 0; i < 30; i++) npcs.push({ x: (prnd() - .5) * 400, y: (prnd() - .5) * 400, vx: 0, vy: 0, radius: 2 + prnd() * 4, mass: 40 + prnd() * 400 });
  const player = createBody3D(0, -200); player.radius = 2; player.mass = 80;
  const everybody = [player, ...npcs];
  const wind = new Wind('breeze');
  const ps = new ParticleSystem(4096, 5);
  let frameNo = 0;
  const frame = () => {
    const dt = 1 / 60; frameNo++;
    wind.update(dt);
    ps.emit('rain', (prnd() - .5) * 600, (prnd() - .5) * 600, 200, 25, 40);
    moveBody3D(player, Math.sin(frameNo * .13), Math.cos(frameNo * .11), 55, dt, hash, 2);
    for (let i = 0; i < 10; i++) { const b = npcs[i]; moveBody(b, Math.sin(frameNo * .7 + i), Math.cos(frameNo * .9 + i * 2), 22, dt, hash, b.radius); }
    resolveBodies(everybody, hash);
    ps.update(dt, wind);
  };
  for (let i = 0; i < 480; i++) frame();   // reach rain equilibrium
  assert(ps.count >= 2000, `only ${ps.count} particles alive at measurement time`);
  let t0 = performance.now();
  for (let i = 0; i < 300; i++) frame();
  const perFrame = (performance.now() - t0) / 300;
  assert(perFrame < 2, `rain + colliders + bodies took ${perFrame.toFixed(3)} ms/frame (budget 2)`);
  // softbody budget: 40 chains x 12 points + 6 cloths x 8x10
  const chains = [], cloths = [];
  for (let i = 0; i < 40; i++) chains.push(new Chain(12, 2.5));
  for (let i = 0; i < 6; i++) cloths.push(new Cloth(8, 10, 24, 34));
  const stepSoft = () => {
    wind.update(1 / 60);
    for (let i = 0; i < 40; i++) { chains[i].setAnchor(i * 3 + Math.sin(frameNo * .1 + i) * 2, i * 2, 40); chains[i].update(1 / 60, wind); }
    for (let i = 0; i < 6; i++) { cloths[i].setAnchorLine(i * 40 - 12, 0, 40, i * 40 + 12, 0, 40); cloths[i].update(1 / 60, wind); }
    frameNo++;
  };
  for (let i = 0; i < 60; i++) stepSoft();
  t0 = performance.now();
  for (let i = 0; i < 300; i++) stepSoft();
  const soft = (performance.now() - t0) / 300;
  assert(soft < 1, `softbody scene took ${soft.toFixed(3)} ms/frame (budget 1)`);
  console.log(`PASS: performance ${perFrame.toFixed(3)} ms/frame with ~${ps.count} particles + 500 colliders + 31 bodies (budget 2 ms), softbody scene ${soft.toFixed(3)} ms/frame (budget 1 ms).`);
}
