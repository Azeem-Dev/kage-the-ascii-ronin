import type { AsciiAsset, AsciiCell, AssetOptions } from '../types.ts';
import { GlyphShape } from '../shapes.ts';
import { drawBranch, drawTrunk, foliageClump, variation, type LeafPalette } from './treePrimitives.ts';

const BARK = ['#2d2922', '#574332', '#806044', '#a38158'] as const;
const PALETTES: readonly LeafPalette[] = [
  ['#1d4938', '#3e7450', '#70965d', '#a5b879'],
  ['#173f38', '#326453', '#58846a', '#8da47a'],
  ['#69372a', '#a95332', '#d28243', '#e5ae68'],
];

function generate(o: AssetOptions): AsciiCell[] {
  const s = new GlyphShape(300, 300, o.seed);
  const variant = o.variant % PALETTES.length;
  const dense = variant === 1;
  const baseX = 150 + variation(1, o.seed, 8);
  const topX = 148 + variation(2, o.seed, 7);
  drawTrunk(s, { x: baseX, y: 286, topX, topY: 113, baseWidth: dense ? 30 : 27, topWidth: 7, palette: BARK, seed: o.seed, roots: 39 });

  // Lower boughs first: their dark undersides sit between the lit crown clumps.
  const clusters = [
    [72, 171, 47, 38], [238, 174, 49, 37], [122, 196, 54, 34], [201, 199, 57, 36],
    [59, 132, 46, 38], [247, 127, 47, 39], [100, 111, 55, 42], [205, 108, 57, 43],
    [151, 78, 61, 47], [145, 143, 67, 49], [162, 178, 57, 35],
  ] as const;
  const branchRoots = [
    [72, 171, 207, 58], [238, 174, 207, 61], [122, 196, 226, 69], [201, 199, 229, 73],
    [59, 132, 168, 42], [247, 127, 180, 42], [100, 111, 146, 22], [205, 108, 153, 24],
  ] as const;
  for (let i = 0; i < branchRoots.length; i++) {
    const [cx, cy, by, width] = branchRoots[i];
    drawBranch(s, baseX - 2, by, cx + variation(i, o.seed, 7), cy + 15, width, BARK, o.seed + i);
  }
  drawBranch(s, topX, 133, 148 + variation(8, o.seed, 9), 64, 12, BARK, o.seed + 9);
  drawBranch(s, topX, 151, 112 + variation(10, o.seed, 8), 106, 9, BARK, o.seed + 10);
  drawBranch(s, topX, 154, 205 + variation(11, o.seed, 8), 111, 9, BARK, o.seed + 11);

  for (let i = 0; i < clusters.length; i++) {
    const [cx, cy, rx, ry] = clusters[i];
    const fullness = dense ? 1.09 : 1;
    foliageClump(s, {
      cx: cx + variation(i + 20, o.seed, 13),
      cy: cy + variation(i + 50, o.seed, 8),
      rx: rx * fullness,
      ry: ry * (dense ? 1.06 : 1),
      palette: PALETTES[variant],
      seed: o.seed * 17 + i * 101,
      phase: i * .83 + variation(i, o.seed, 1.5),
      sway: .65 + i / clusters.length * .8,
      time: o.time,
      density: dense ? .94 : .87,
      lightness: dense ? .91 : 1,
    });
  }
  return s.frame(o.facing === 'left');
}

export const OAK: AsciiAsset = {
  id: 'oak', version: 1, name: 'Broadleaf oak', category: 'Vegetation',
  description: 'Layered rounded crown, visible boughs, flared roots and broken leafy edges.',
  width: 300, height: 300, anchor: { x: 150, y: 286 },
  variants: ['Summer oak', 'Dense oak', 'Autumn oak'],
  footprint: [{ x: 0, y: -2, radius: 12 }],
  generate,
};
