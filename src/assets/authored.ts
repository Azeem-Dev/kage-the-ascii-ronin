import type { AsciiCell, AssetOptions } from './types.ts';

export interface GlyphArt {
  width: number;
  height: number;
  anchor: { x: number; y: number };
  palette: string[];
  rows: string[];
  ink: number[];
}

const legCache = new WeakMap<GlyphArt, number[]>();
/** Centres of the real legs: separate runs of ink in the hoof rows. Each column of the
 * lower body is then owned by its nearest leg, so a leg always moves as one piece
 * (fixed vertical strips split a leg in two and made it look doubled). */
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

/** Baked glyph art remains reusable, recolorable and articulatable. Original
 * reference images never enter the runtime rendering path. */
export function authoredFrame(art: GlyphArt, options: AssetOptions, subject: 'knight' | 'horse'): AsciiCell[] {
  const legs = subject === 'horse' ? legCentres(art) : [];
  const cells: AsciiCell[] = [];
  const walking = options.action === 'walk';
  const gait = walking ? Math.sin(options.time * 6) : 0;
  for (let y = 0; y < art.height; y++) for (let x = 0; x < art.width; x++) {
    const index = y * art.width + x;
    const colorIndex = art.ink[index];
    if (!colorIndex) continue;
    let dx = 0; let dy = 0;
    if (subject === 'horse') {
      if (x < art.width * .2 && y > art.height * .4) dx = Math.sin(options.time * 3 + y * .1) * (y / art.height) * 1.3;
      else if (walking && y > art.height * .59 && legs.length) {
        // Nearest real leg owns this column; diagonal pairs move together (walk/trot gait).
        let leg = 0; let best = Infinity;
        for (let k = 0; k < legs.length; k++) { const d = Math.abs(x - legs[k]); if (d < best) { best = d; leg = k; } }
        const phase = options.time * 6 + (leg % 2 ? Math.PI : 0) + (leg >= legs.length / 2 ? Math.PI / 2 : 0);
        const depth = y / art.height - .59;
        dx = Math.sin(phase) * 12 * depth;
        dy = -Math.max(0, Math.sin(phase + Math.PI / 2)) * 5 * depth; // lift the hoof on the forward swing
      }
    } else {
      // Cape is rooted at the shoulder; cloth motion increases toward its hem.
      if (x < art.width * .34 && y > art.height * .3) dx = Math.sin(options.time * 2 + y * .07) * (y / art.height) * 1.2;
      else if (walking && y > art.height * .65 && x > art.width * .3 && x < art.width * .72) {
        const phase = options.time * 6 + (x < art.width * .5 ? 0 : Math.PI);
        dx = Math.sin(phase) * 22 * (y / art.height - .65);
        dy = -Math.max(0, Math.cos(phase)) * 10 * (y / art.height - .65);
      } else if (walking && y > art.height * .3 && y < art.height * .62 && (x < art.width * .42 || x > art.width * .65)) {
        dx = gait * (x < art.width * .42 ? -1 : 1) * (y / art.height - .3) * 8;
      }
      if (walking && y < art.height * .65) dy = Math.abs(gait) * 1.8;
    }
    const px = Math.max(0, Math.min(art.width - 1, Math.round(x + dx)));
    const py = Math.max(0, Math.min(art.height - 1, Math.round(y + dy)));
    let color = art.palette[colorIndex - 1];
    if (options.variant > 0) {
      const r = parseInt(color.slice(1, 3), 16); const g = parseInt(color.slice(3, 5), 16); const b = parseInt(color.slice(5, 7), 16);
      const values = options.variant === 1 ? [r * .72, g * .83, b * 1.02] : options.variant === 2 ? [r * 1.1, g * .89, b * .62] : [r * .9, g * .53, b * .59];
      color = '#' + values.map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
    }
    // Seed affects a few material marks, never anatomy or the whole silhouette.
    const glyph = (x * 37 + y * 11 + options.seed) % 211 === 0 ? ':' : art.rows[y][x];
    cells.push({ x: options.facing === 'left' ? art.width - 1 - px : px, y: py, glyph, color });
  }
  return cells;
}
