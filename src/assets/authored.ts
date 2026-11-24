import type { AsciiCell, AssetOptions } from './types.ts';

export interface GlyphArt {
  width: number;
  height: number;
  anchor: { x: number; y: number };
  palette: string[];
  rows: string[];
  ink: number[];
}

/** Baked glyph art remains reusable, recolorable and articulatable. Original
 * reference images never enter the runtime rendering path. */
export function authoredFrame(art: GlyphArt, options: AssetOptions, subject: 'knight' | 'horse'): AsciiCell[] {
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
      else if (walking && y > art.height * .59 && x < art.width * .85) {
        const leg = Math.floor(x / art.width * 5);
        dx = Math.sin(options.time * 6 + leg * Math.PI * .8) * 3 * (y / art.height - .59);
      }
    } else {
      // Cape is rooted at the shoulder; cloth motion increases toward its hem.
      if (x < art.width * .34 && y > art.height * .3) dx = Math.sin(options.time * 2 + y * .07) * (y / art.height) * 1.2;
      else if (walking && y > art.height * .69 && x > art.width * .3 && x < art.width * .72) dx = gait * (x < art.width * .5 ? 1 : -1) * 2 * (y / art.height - .69);
      if (walking && y < art.height * .65) dy = Math.abs(gait) * .6;
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
