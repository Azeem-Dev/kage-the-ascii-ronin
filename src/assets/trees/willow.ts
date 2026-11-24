import { noise, type AsciiAsset, type AsciiCell, type AssetOptions } from '../types.ts';
import { GlyphShape } from '../shapes.ts';
import { drawBranch, drawTrunk, foliageClump, variation, type LeafPalette } from './treePrimitives.ts';

const BARK = ['#292b25', '#514b3a', '#786448', '#9b825c'] as const;
const PALETTES: readonly LeafPalette[] = [
  ['#23493e', '#4c7855', '#7e9d65', '#afbd82'],
  ['#284944', '#587b6c', '#91a58a', '#c1c7a4'],
  ['#4c4a2d', '#7e7440', '#ad9652', '#d0b979'],
];
const STRANDS = [
  ['#2f5a45', '#557d54', '#86a16b', '#afbd82'],
  ['#3a6257', '#6d8971', '#9eb196', '#c8ccb0'],
  ['#625e37', '#8d7c45', '#b29c5d', '#d2c48c'],
] as const;

function generate(o: AssetOptions): AsciiCell[] {
  const s = new GlyphShape(300, 320, o.seed);
  const variant = o.variant % PALETTES.length;
  const baseX = 150 + variation(3, o.seed, 7);
  drawTrunk(s, { x: baseX, y: 306, topX: 146 + variation(4, o.seed, 6), topY: 94, baseWidth: 27, topWidth: 7, palette: BARK, seed: o.seed, roots: 38 });

  for (let i = 0; i < 9; i++) {
    const side = i % 2 ? 1 : -1;
    const x = 62 + (i % 5) * 43 + variation(i, o.seed, 12);
    const y = 104 + Math.floor(i / 5) * 32 + variation(i + 9, o.seed, 9);
    drawBranch(s, baseX, 180 - i * 7, x, y + 16, 8 - i % 3, BARK, o.seed + i);
    if (i > 4) drawBranch(s, x - side * 13, y + 20, x + side * 23, y - 10, 4, BARK, o.seed + i + 20);
  }

  // Curtains begin under the crown and reach almost to the roots. Each strand
  // has its own phase; the lower portion moves more, like a hanging branch.
  const strandPalette = STRANDS[variant];
  for (let i = 0; i < 92; i++) {
    const base = 38 + noise(i, 2, o.seed) * 224;
    const start = 67 + noise(i, 5, o.seed) * 122;
    const end = Math.min(303, start + 113 + noise(i, 8, o.seed) * 121);
    const phase = noise(i, 11, o.seed) * Math.PI * 2;
    const commonLean = Math.sin(o.time * .75 + phase * .18) * 1.2;
    for (let y = Math.floor(start); y <= end; y++) {
      const p = (y - start) / Math.max(1, end - start);
      const x = base + commonLean * (.4 + p) + Math.sin(o.time * 1.25 + phase + p * 2.4) * (1 + p * 3.8);
      const n = noise(i, y, o.seed + 31);
      const color = strandPalette[n > .78 ? 3 : n > .42 ? 2 : n > .14 ? 1 : 0];
      const glyph = p > .78 ? (n > .6 ? "'" : ':') : n > .82 ? ';' : '|';
      s.cell(x, y, glyph, color);
      if (y % 17 === i % 17 && p > .25) {
        const side = (i + y) % 2 ? 1 : -1;
        s.line(x, y, x + side * (2 + n * 3), y - 4 - n * 3, strandPalette[2], side > 0 ? '/' : '\\');
      }
    }
  }

  const clusters = [
    [67, 126, 43, 31], [111, 94, 48, 34], [164, 78, 52, 37], [221, 101, 49, 35], [256, 137, 37, 29],
    [91, 149, 49, 33], [150, 127, 59, 39], [211, 153, 51, 34], [150, 174, 53, 29],
  ] as const;
  for (let i = 0; i < clusters.length; i++) {
    const [cx, cy, rx, ry] = clusters[i];
    foliageClump(s, {
      cx: cx + variation(i + 40, o.seed, 11), cy: cy + variation(i + 60, o.seed, 8),
      rx, ry, palette: PALETTES[variant], seed: o.seed * 19 + i * 97,
      phase: i * .71, sway: .9 + i * .05, time: o.time, density: .91,
      lightness: variant === 1 ? 1.05 : .96,
    });
  }
  return s.frame(o.facing === 'left');
}

export const WILLOW: AsciiAsset = {
  id: 'willow', version: 1, name: 'River willow', category: 'Vegetation',
  description: 'High leaf clumps above individually swaying curtains of hanging strands.',
  width: 300, height: 320, anchor: { x: 150, y: 306 },
  variants: ['River willow', 'Silver willow', 'Autumn willow'],
  footprint: [{ x: 0, y: -2, radius: 10 }],
  generate,
};
