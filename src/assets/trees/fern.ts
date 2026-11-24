import { noise, type AsciiAsset, type AsciiCell, type AssetOptions } from '../types.ts';
import { GlyphShape } from '../shapes.ts';
import { variation } from './treePrimitives.ts';

const PALETTES = [
  ['#244b35', '#477348', '#72985a', '#a3b875'],
  ['#315348', '#5d8068', '#8ba387', '#b7c4a1'],
  ['#574b2d', '#89703d', '#b39150', '#d0b473'],
] as const;

function generate(o: AssetOptions): AsciiCell[] {
  const s = new GlyphShape(110, 80, o.seed);
  const variant = o.variant % PALETTES.length;
  const palette = PALETTES[variant];
  const fronds = 7;
  for (let i = 0; i < fronds; i++) {
    const t = i / (fronds - 1);
    const endX = 10 + t * 90 + variation(i, o.seed, 8);
    let endY = 13 + Math.abs(t - .5) * 28 + variation(i + 10, o.seed, 7);
    if (variant === 1) endY += 3;
    const phase = noise(i, 5, o.seed) * Math.PI * 2;
    const sway = Math.sin(o.time * 1.1 + phase) * .9;
    const ex = endX + sway;
    const ey = endY + Math.cos(o.time * .8 + phase) * .3;
    const controlX = 55 + (endX - 55) * .28;
    const controlY = 36 + noise(i, 8, o.seed) * 8;
    let previousX = 55;
    let previousY = 74;
    for (let step = 1; step <= 12; step++) {
      const p = step / 12;
      const q = 1 - p;
      const x = q * q * 55 + 2 * q * p * controlX + p * p * ex;
      const y = q * q * 74 + 2 * q * p * controlY + p * p * ey;
      s.line(previousX, previousY, x, y, palette[p > .72 ? 2 : 1], '|');
      if (step > 2 && step < 11) {
        const dx = x - previousX;
        const dy = y - previousY;
        const length = Math.max(1, Math.hypot(dx, dy));
        const nx = -dy / length;
        const ny = dx / length;
        const leafLength = (3 + Math.sin(p * Math.PI) * 7) * (i % 2 ? .9 : 1);
        for (const side of [-1, 1]) {
          const tipX = x + nx * leafLength * side + dx * .8;
          const tipY = y + ny * leafLength * side + dy * .8;
          s.line(x, y, tipX, tipY, palette[step % 3 ? 2 : 3], (side > 0) === (ny > 0) ? '/' : '\\');
          if (step % 2 === 0) s.cell(tipX, tipY, "'", palette[3]);
        }
      }
      previousX = x;
      previousY = y;
    }
    s.cell(ex, ey, '*', palette[3]);
  }
  // Low inner fronds fill the base without hiding the radiating structure.
  for (let i = 0; i < 5; i++) {
    const side = i % 2 ? 1 : -1;
    const x = 55 + side * (5 + i * 3);
    s.line(55, 74, x + Math.sin(o.time + i) * .6, 55 - i * 2, palette[1], side > 0 ? '/' : '\\');
  }
  return s.frame(o.facing === 'left');
}

export const FERN: AsciiAsset = {
  id: 'fern', version: 1, name: 'Forest fern', category: 'Vegetation',
  description: 'Seven radiating fronds with paired leaflets and gently fluttering tips.',
  width: 110, height: 80, anchor: { x: 55, y: 74 },
  variants: ['Forest fern', 'Silver fern', 'Autumn fern'],
  footprint: [{ x: 0, y: -1, radius: 2 }],
  generate,
};
