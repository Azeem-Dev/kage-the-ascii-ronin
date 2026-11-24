import type { AsciiCell, AssetOptions } from './types.ts';

export interface GlyphArt {
  width: number;
  height: number;
  anchor: { x: number; y: number };
  palette: string[];
  rows: string[];
  ink: number[];
}

interface SourceCell { x: number; y: number; index: number; colorIndex: number; glyph: string }

const sourceCache = new WeakMap<GlyphArt, SourceCell[]>();
/** The baked art is immutable; lift its inked cells once so animation can treat
 * anatomical parts as rigid pieces instead of shearing whole rows/columns. */
function sourceCells(art: GlyphArt): SourceCell[] {
  const cached = sourceCache.get(art);
  if (cached) return cached;
  const cells: SourceCell[] = [];
  for (let y = 0; y < art.height; y++) for (let x = 0; x < art.width; x++) {
    const index = y * art.width + x;
    const colorIndex = art.ink[index];
    if (colorIndex) cells.push({ x, y, index, colorIndex, glyph: art.rows[y][x] });
  }
  sourceCache.set(art, cells);
  return cells;
}

const legCache = new WeakMap<GlyphArt, number[]>();
/** Centres of the real legs: separate runs of ink in the hoof rows. */
function legCentres(art: GlyphArt): number[] {
  const cached = legCache.get(art);
  if (cached) return cached;
  const ink = new Uint16Array(art.width);
  for (let y = Math.floor(art.height * .82); y < art.height; y++) for (let x = 0; x < art.width; x++) if (art.ink[y * art.width + x]) ink[x]++;
  const centres: number[] = [];
  let start = -1;
  for (let x = 0; x <= art.width; x++) {
    const on = x < art.width && ink[x] > 0;
    if (on && start < 0) start = x;
    if (!on && start >= 0) { if (x - start >= 2) centres.push((start + x - 1) / 2); start = -1; }
  }
  legCache.set(art, centres);
  return centres;
}

interface HorseLeg {
  x: number;
  left: number;
  right: number;
  hipY: number;
  kneeY: number;
  hoofY: number;
  upper: number;
  lower: number;
  bend: number;
}

interface HorseAnatomy {
  legs: HorseLeg[];
  /** One owner per inked cell. -1 means torso, tail, head or mane, never leg. */
  owners: Int8Array;
}

const horseCache = new WeakMap<GlyphArt, HorseAnatomy>();
/** The four limbs begin at different heights in the baked side view. Narrow
 * corridors keep the belly and saddle with the torso and the hanging tail with
 * the tail; a nearest-centre split below the belly pulled both into the legs. */
function horseAnatomy(art: GlyphArt): HorseAnatomy {
  const cached = horseCache.get(art);
  if (cached) return cached;
  const centres = legCentres(art);
  const owners = new Int8Array(art.width * art.height).fill(-1);
  const anatomy: HorseAnatomy = { legs: [], owners };
  if (centres.length === 4) {
    // Ascending x: far hind, near hind, near fore, far fore. The joint heights
    // follow the actual gaps where each limb leaves the body in horse.json.
    const layout = [
      { left: .105, right: .18, hip: .685, bend: -1 },
      { left: .21, right: .33, hip: .555, bend: -1 },
      { left: .565, right: .665, hip: .605, bend: 1 },
      { left: .66, right: .77, hip: .585, bend: 1 },
    ];
    anatomy.legs = centres.map((x, i) => {
      const part = layout[i];
      const left = art.width * part.left; const right = art.width * part.right;
      const hipY = art.height * part.hip;
      let hoofY = art.height - 1;
      for (let y = art.height - 1; y >= hipY; y--) {
        let found = false;
        for (let px = Math.ceil(left); px <= Math.floor(right); px++) if (art.ink[y * art.width + px]) { found = true; break; }
        if (found) { hoofY = y; break; }
      }
      const kneeY = (hipY + hoofY) * .5;
      return { x, left, right, hipY, kneeY, hoofY, upper: kneeY - hipY, lower: hoofY - kneeY, bend: part.bend };
    });
    for (const src of sourceCells(art)) {
      let owner = -1; let distance = Infinity;
      for (let i = 0; i < anatomy.legs.length; i++) {
        const leg = anatomy.legs[i];
        if (src.y >= leg.hipY && src.x >= leg.left && src.x <= leg.right) {
          const d = Math.abs(src.x - leg.x);
          if (d < distance) { distance = d; owner = i; }
        }
      }
      owners[src.index] = owner;
    }
  }
  horseCache.set(art, anatomy);
  return anatomy;
}

const TAU = Math.PI * 2;
const clamp = (v: number, a: number, b: number) => v < a ? a : v > b ? b : v;
const smooth = (a: number, b: number, v: number) => { const t = clamp((v - a) / (b - a || 1), 0, 1); return t * t * (3 - 2 * t); };
const fract = (v: number) => v - Math.floor(v);
/** Rigid rotation about a joint. No row/column shearing. */
function rotate(x: number, y: number, px: number, py: number, angle: number): [number, number] {
  const c = Math.cos(angle); const s = Math.sin(angle);
  const dx = x - px; const dy = y - py;
  return [px + dx * c - dy * s, py + dx * s + dy * c];
}

interface LegPose { hip: number; knee: number }
/** Two-bone inverse kinematics. The hip follows the breathing/bobbing torso,
 * while the target hoof remains on its stance plane or follows a lifted swing. */
function solveLeg(leg: HorseLeg, targetX: number, targetY: number, bob: number): LegPose {
  const dx = targetX - leg.x;
  const dy = targetY - leg.hipY - bob;
  const distance = clamp(Math.hypot(dx, dy), Math.abs(leg.upper - leg.lower), leg.upper + leg.lower);
  const cosine = clamp((distance * distance - leg.upper * leg.upper - leg.lower * leg.lower) / (2 * leg.upper * leg.lower), -1, 1);
  const knee = leg.bend * Math.acos(cosine);
  const hip = Math.atan2(dy, dx) - Math.atan2(leg.lower * Math.sin(knee), leg.upper + leg.lower * Math.cos(knee));
  return { hip: hip - Math.PI / 2, knee };
}

interface HoofTarget { x: number; y: number }
/** Contact moves backward at a constant speed relative to the body. Swing
 * returns the same hoof forward and clears the ground; both joins are seamless. */
function hoofTarget(phase: number, leg: HorseLeg, stride: number, lift: number, duty: number): HoofTarget {
  if (phase < duty) {
    const u = phase / duty;
    return { x: leg.x + stride * (.5 - u), y: leg.hoofY };
  }
  const u = (phase - duty) / (1 - duty);
  const ease = u * u * (3 - 2 * u);
  return { x: leg.x + stride * (ease - .5), y: leg.hoofY - lift * Math.sin(Math.PI * u) };
}

interface CharacterLeg { x: number; left: number; right: number; hipY: number; kneeY: number; hoofY: number }
const characterLegCache = new WeakMap<GlyphArt, CharacterLeg[]>();
/** Two widest ink runs in the lower art are treated as the legs. A single very
 * wide run is a coat/skirt, not a leg, and keeps the cloth animation instead. */
function characterLegs(art: GlyphArt): CharacterLeg[] {
  const cached = characterLegCache.get(art);
  if (cached) return cached;
  const ink = new Uint16Array(art.width);
  for (let y = Math.floor(art.height * .78); y < art.height; y++) {
    for (let x = 0; x < art.width; x++) if (art.ink[y * art.width + x]) ink[x]++;
  }
  const runs: Array<{ left: number; right: number }> = [];
  let start = -1;
  for (let x = 0; x <= art.width; x++) {
    const on = x < art.width && ink[x] > 0;
    if (on && start < 0) start = x;
    if (!on && start >= 0) {
      if (x - start >= 4) runs.push({ left: start, right: x - 1 });
      start = -1;
    }
  }
  const hipY = art.height * .76;
  const hoofY = art.height - 1;
  const kneeY = hipY + (hoofY - hipY) * .45;
  const legs = runs
    .sort((a, b) => (b.right - b.left) - (a.right - a.left))
    .slice(0, 2)
    .sort((a, b) => a.left - b.left)
    .map(run => ({ x: (run.left + run.right) / 2, left: run.left, right: run.right, hipY, kneeY, hoofY }));
  characterLegCache.set(art, legs);
  return legs;
}

/** Baked glyph art stays reusable, recolorable and articulatable. Original
 * reference images never enter the runtime rendering path. */
export function authoredFrame(art: GlyphArt, options: AssetOptions, subject: 'knight' | 'horse' | 'character'): AsciiCell[] {
  // `run` is accepted as a friendly alias for renderer/engine callers that do
  // not share the narrower AssetOptions action union.
  const action = String(options.action);
  const walking = action === 'walk';
  const galloping = action === 'gallop' || action === 'run';
  const moving = walking || galloping;
  const t = options.time;
  const W = art.width; const H = art.height;
  const cells: AsciiCell[] = [];

  const gaitRate = galloping ? 9 : 6;
  const cycle = fract(t * gaitRate / TAU);
  const anatomy = subject === 'horse' ? horseAnatomy(art) : undefined;
  const charLegs = subject === 'character' ? characterLegs(art) : [];
  const walkDuty = .7; const gallopDuty = .4;
  const strideRatio = galloping ? .34 : .22;
  const lift = H * (galloping ? .09 : .045);
  // Gallop has one short all-air suspension after the fore pair pushes off.
  const suspension = galloping ? Math.pow(Math.max(0, 1 - Math.abs(cycle - .96) / .04), 2) : 0;
  const bob = subject === 'horse'
    ? (galloping ? .68 - 1.9 * suspension : walking ? .36 + .12 * Math.sin(t * gaitRate) : .32 * Math.sin(t * 2))
    : 0;

  const legPoses: LegPose[] = [];
  if (anatomy?.legs.length) {
    const offsets = galloping ? [0, .94, .5, .48] : [0, .5, .25, .75];
    const duty = galloping ? gallopDuty : walkDuty;
    for (let i = 0; i < anatomy.legs.length; i++) {
      const leg = anatomy.legs[i];
      const stride = (leg.upper + leg.lower) * strideRatio;
      const target = moving ? hoofTarget(fract(cycle + offsets[i]), leg, stride, lift, duty) : { x: leg.x, y: leg.hoofY };
      legPoses.push(solveLeg(leg, target.x, target.y, bob));
    }
  }

  const headX = W * .68; const headY = H * .50;
  const tailX = W * .23; const tailY = H * .44;
  const maneX = W * .55; const maneY = H * .55;
  const headAngle = moving ? (galloping ? .065 : .038) * Math.sin(t * gaitRate + .6) : .028 * Math.sin(t * 3);
  const tailAngle = moving
    ? (galloping ? .18 : .08) + (galloping ? .15 : .12) * Math.sin(t * gaitRate * .5 + .4)
    : .11 * Math.sin(t * 2);
  const maneAngle = moving
    ? -(galloping ? .05 : .028) + .018 * Math.sin(t * gaitRate * .7)
    : .012 * Math.sin(t * 2);

  // Knight art is uniquely 112x118; the playable cast shares the breathing
  // pass but keeps its gentler inherited cloth response.
  const isKnight = subject === 'knight' && W === 112 && H === 118;
  const clothAmp = isKnight ? 1 : .55;
  const capeLimit = W * (isKnight ? .39 : .40);
  const rootY = H * (isKnight ? .16 : .13);
  const breath = .4 * Math.sin(t * 2);
  const trail = moving ? (galloping ? -7.5 : -4.5) * clothAmp : -.8 * clothAmp;

  for (const src of sourceCells(art)) {
    let px = src.x; let py = src.y;
    if (subject === 'horse') {
      const owner = anatomy?.owners[src.index] ?? -1;
      const leg = owner >= 0 ? anatomy?.legs[owner] : undefined;
      if (leg && legPoses[owner]) {
        const pose = legPoses[owner];
        if (src.y < leg.kneeY) {
          [px, py] = rotate(src.x, src.y, leg.x, leg.hipY, pose.hip);
          py += bob;
        } else {
          // First carry the whole lower segment with the upper leg around the
          // hip, then bend it around the *transformed* knee.
          [px, py] = rotate(src.x, src.y, leg.x, leg.hipY, pose.hip);
          py += bob;
          const kneeX = leg.x;
          const kneeY = leg.kneeY + bob;
          [px, py] = rotate(px, py, kneeX, kneeY, pose.knee);
        }
      } else if (src.x < W * .225 && src.y >= tailY) {
        [px, py] = rotate(src.x, src.y, tailX, tailY, tailAngle);
        py += bob;
      } else if (src.x > headX && src.y < headY) {
        [px, py] = rotate(src.x, src.y, W * .66, H * .42, headAngle);
        py += bob;
      } else if (src.x > W * .52 && src.y < H * .58) {
        // Neck and mane move from the withers; the free forelock trails back.
        [px, py] = rotate(src.x, src.y, maneX, maneY, maneAngle);
        py += bob;
      } else {
        py += bob;
      }
    } else {
      const bodyWeight = 1 - smooth(H * .70, H * .92, src.y);
      const bodyBob = moving ? .35 * Math.sin(t * gaitRate) : 0;
      if (subject === 'character') {
        const leg = charLegs.length === 2
          ? (src.x <= charLegs[0].right ? charLegs[0] : charLegs[1])
          : undefined;
        if (leg && src.y >= leg.hipY) {
          if (action === 'sit') {
            // Seated on horseback: thigh swings forward, shin drops to the stirrup.
            const hipAngle = -0.92;
            if (src.y < leg.kneeY) {
              [px, py] = rotate(src.x, src.y, leg.x, leg.hipY, hipAngle);
            } else {
              const [kneeX, kneeY] = rotate(leg.x, leg.kneeY, leg.x, leg.hipY, hipAngle);
              [px, py] = rotate(src.x, src.y, kneeX, kneeY, 1.18);
            }
          } else {
            const phase = leg === charLegs[0] ? 0 : Math.PI;
            const angle = moving
              ? .09 * Math.sin(t * gaitRate + phase)
              : .015 * Math.sin(t * 2 + phase);
            [px, py] = rotate(src.x, src.y, leg.x, leg.hipY, angle);
          }
        }
        py += bodyBob * bodyWeight;
      }
      if (isKnight) {
        // A diagonal inner edge follows the cape rather than the whole left
        // side of the sprite. The old rectangular mask also dragged the left
        // leg and sword arm away from the body.
        const edge = capeLimit - Math.max(0, src.y - rootY) * .105;
        if (src.y >= rootY && src.x <= edge) {
          const rootWeight = smooth(rootY, rootY + H * .14, src.y);
          const wave = moving ? Math.sin(t * gaitRate - src.y * .11) * 2.2 : Math.sin(t * 2 - src.y * .05) * .75;
          px += rootWeight * (trail + wave);
          py += rootWeight * (moving ? -Math.abs(Math.sin(t * gaitRate - src.y * .11)) * 1.1 : 0);
        }
        py += breath * bodyWeight + bodyBob * bodyWeight;
      } else {
        const rootWeight = smooth(rootY, rootY + H * .15, src.y);
        const seamWeight = 1 - smooth(capeLimit - H * .11, capeLimit, src.x);
        const weight = rootWeight * seamWeight;
        const wave = moving ? Math.sin(t * gaitRate - src.y * .10) * 2.5 : Math.sin(t * 2 - src.y * .05) * 1.1;
        px += weight * (trail + wave * clothAmp);
        py += weight * (moving ? -Math.abs(Math.sin(t * gaitRate - src.y * .10)) * 1.6 * clothAmp : 0);
        py += breath;
      }
    }

    const x = clamp(Math.round(px), 0, W - 1);
    const y = clamp(Math.round(py), 0, H - 1);
    let color = art.palette[src.colorIndex - 1];
    if (options.variant > 0) {
      const r = parseInt(color.slice(1, 3), 16); const g = parseInt(color.slice(3, 5), 16); const b = parseInt(color.slice(5, 7), 16);
      const values = options.variant === 1 ? [r * .72, g * .83, b * 1.02] : options.variant === 2 ? [r * 1.1, g * .89, b * .62] : [r * .9, g * .53, b * .59];
      color = '#' + values.map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
    }
    const glyph = (src.x * 37 + src.y * 11 + options.seed) % 211 === 0 ? ':' : src.glyph;
    cells.push({ x: options.facing === 'left' ? W - 1 - x : x, y, glyph, color });
  }
  return cells;
}
