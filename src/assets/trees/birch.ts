import { noise, type AsciiAsset, type AsciiCell, type AssetOptions } from '../types.ts';
import { GlyphShape } from '../shapes.ts';
import { drawBranch, drawTrunk, foliageClump, variation, type LeafPalette } from './treePrimitives.ts';

const BARK = ['#8e9a94', '#bcc5b9', '#dce0cf', '#f0ecd8'] as const;
const SCAR = '#3d4742';
const PALETTES: readonly LeafPalette[] = [
  ['#356044', '#65935e', '#98b877', '#c6ce95'],
  ['#3e6052', '#75947a', '#a9bd91', '#d4d7ad'],
  ['#65522e', '#a0803f', '#c7a555', '#e0c77e'],
];

function generate(o: AssetOptions): AsciiCell[] {
  const s = new GlyphShape(260, 300, o.seed);
  const variant = o.variant % PALETTES.length;
  const baseX = 130 + variation(5, o.seed, 6);
  const topX = 128 + variation(6, o.seed, 8);
  drawTrunk(s, { x: baseX, y: 286, topX, topY: 35, baseWidth: 16, topWidth: 3, palette: BARK, seed: o.seed, roots: 23 });

  // Characteristic broken dark bark marks stay on the unmoving trunk.
  for (let i = 0; i < 13; i++) {
    const y = 68 + i * 15 + variation(i, o.seed, 6);
    const t = (286 - y) / 251;
    const x = baseX + (topX - baseX) * t + variation(i + 20, o.seed, 3);
    const width = 2 + noise(i, 4, o.seed) * 5;
    s.line(x - width, y, x + width * .4, y + (i % 2), SCAR, i % 3 ? '-' : '_');
    if (i % 4 === 0) s.cell(x + width * .6, y - 1, '.', SCAR);
  }

  const clusters = [
    [42, 130, 34, 28], [82, 95, 39, 31], [135, 65, 41, 32], [188, 88, 40, 31], [225, 126, 32, 28],
    [62, 159, 36, 27], [113, 132, 43, 31], [170, 139, 43, 30], [208, 169, 34, 25], [126, 174, 34, 24],
  ] as const;
  for (let i = 0; i < clusters.length; i++) {
    const [cx, cy, , ry] = clusters[i];
    const rootY = 219 - (i % 4) * 29;
    drawBranch(s, topX + (baseX - topX) * .25, rootY, cx + variation(i, o.seed, 5), cy + ry * .45, i < 5 ? 5 : 4, BARK, o.seed + i);
  }
  drawBranch(s, topX, 95, 126 + variation(15, o.seed, 5), 45, 4, BARK, o.seed + 15);

  for (let i = 0; i < clusters.length; i++) {
    const [cx, cy, rx, ry] = clusters[i];
    foliageClump(s, {
      cx: cx + variation(i + 30, o.seed, 10), cy: cy + variation(i + 55, o.seed, 7),
      rx, ry, palette: PALETTES[variant], seed: o.seed * 23 + i * 89,
      phase: i * .91, sway: .55 + i * .055, time: o.time,
      density: .73, lightness: 1.08,
    });
  }
  return s.frame(o.facing === 'left');
}

export const BIRCH: AsciiAsset = {
  id: 'birch', version: 1, name: 'Silver birch', category: 'Vegetation',
  description: 'Slim marked white trunk, thin visible boughs and an airy multi-clump crown.',
  width: 260, height: 300, anchor: { x: 130, y: 286 },
  variants: ['Spring birch', 'Pale birch', 'Autumn birch'],
  footprint: [{ x: 0, y: -2, radius: 6 }],
  generate,
};
