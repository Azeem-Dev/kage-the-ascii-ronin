import { noise, type AsciiAsset, type AsciiCell, type AssetOptions } from '../types.ts';
import { GlyphShape } from '../shapes.ts';
import { drawBranch, drawTrunk, foliageClump, variation, type LeafPalette } from './treePrimitives.ts';

const BARK = ['#292923', '#4b4937', '#716246', '#94805a'] as const;
const PALETTES: readonly LeafPalette[] = [
  ['#17372d', '#2f5840', '#4f7450', '#7b9365'],
  ['#142f2b', '#284b3e', '#426756', '#6a8460'],
  ['#26382d', '#445d40', '#687b4c', '#92a16b'],
];

function generate(o: AssetOptions): AsciiCell[] {
  const s = new GlyphShape(220, 330, o.seed);
  const variant = o.variant % PALETTES.length;
  const slender = variant === 2;
  const baseX = 110 + variation(7, o.seed, 5);
  const topX = 108 + variation(8, o.seed, 5);
  drawTrunk(s, { x: baseX, y: 316, topX, topY: 188, baseWidth: 21, topWidth: 5, palette: BARK, seed: o.seed, roots: 28 });
  drawBranch(s, baseX, 251, 73 + variation(9, o.seed, 8), 227, 7, BARK, o.seed + 9);
  drawBranch(s, baseX, 244, 150 + variation(10, o.seed, 8), 218, 7, BARK, o.seed + 10);

  const widths = [20, 31, 39, 46, 49, 47, 43, 35] as const;
  for (let i = 0; i < widths.length; i++) {
    const cy = 43 + i * 29;
    const cx = 110 + variation(i + 20, o.seed, 9);
    const width = widths[i] * (slender ? .78 : 1);
    foliageClump(s, {
      cx, cy, rx: width, ry: i === 0 ? 30 : 27 + noise(i, 3, o.seed) * 6,
      palette: PALETTES[variant], seed: o.seed * 29 + i * 113,
      phase: i * .67 + variation(i, o.seed, .8),
      sway: .5 + (7 - i) * .11,
      time: o.time,
      density: .94,
      lightness: .93 + i * .012,
    });
    // Sparse vertical needles break the scallops between tiers into one dark plume.
    if (i < 6) {
      const side = i % 2 ? 1 : -1;
      const x = cx + side * width * .72;
      s.line(x, cy + 14, x + side * 4, cy + 42, PALETTES[variant][1], "'");
      s.cell(x + side * 6, cy + 36, ';', PALETTES[variant][0]);
    }
  }
  return s.frame(o.facing === 'left');
}

export const CYPRESS: AsciiAsset = {
  id: 'cypress', version: 1, name: 'Dark cypress', category: 'Vegetation',
  description: 'Tall narrow Japanese/Mediterranean plume with stacked needle tiers.',
  width: 220, height: 330, anchor: { x: 110, y: 316 },
  variants: ['Cypress', 'Night cypress', 'Slender cypress'],
  footprint: [{ x: 0, y: -2, radius: 7 }],
  generate,
};
