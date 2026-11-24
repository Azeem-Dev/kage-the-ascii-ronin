import { noise, type AsciiAsset, type AsciiCell, type AssetOptions } from '../types.ts';
import { GlyphShape } from '../shapes.ts';
import { drawBranch, drawTrunk, variation } from './treePrimitives.ts';

const PALETTES = [
  ['#272724', '#514b40', '#7b6e57', '#a08d6c'],
  ['#242423', '#45433b', '#69624f', '#8b7e61'],
  ['#30383a', '#606b69', '#929b91', '#c2c6b8'],
] as const;

function generate(o: AssetOptions): AsciiCell[] {
  const s = new GlyphShape(280, 300, o.seed);
  const palette = PALETTES[o.variant % PALETTES.length];
  const x = 140 + variation(14, o.seed, 6);
  const joints = [[x, 286], [134 + variation(15, o.seed, 7), 217], [146 + variation(16, o.seed, 8), 147], [127 + variation(17, o.seed, 7), 82], [140 + variation(18, o.seed, 6), 25]] as const;
  drawTrunk(s, { x, y: 286, topX: joints[1][0], topY: 217, baseWidth: 25, topWidth: 17, palette, seed: o.seed, roots: 35 });
  for (let i = 1; i < joints.length - 1; i++) {
    drawBranch(s, joints[i][0], joints[i][1], joints[i + 1][0], joints[i + 1][1], [17, 12, 7][i - 1], palette, o.seed + i);
  }

  const limbs = [
    [143, 223, 73, 184, 13], [139, 208, 218, 190, 12],
    [143, 170, 54, 117, 10], [140, 157, 238, 103, 11],
    [133, 112, 77, 54, 8], [131, 91, 205, 48, 8],
    [134, 218, 94, 240, 8], [145, 181, 194, 234, 7],
    [129, 78, 111, 34, 5], [139, 29, 177, 20, 5],
  ] as const;
  for (let i = 0; i < limbs.length; i++) {
    const [x0, y0, tx, ty, width] = limbs[i];
    const ex = tx + variation(i + 30, o.seed, 12);
    const ey = ty + variation(i + 50, o.seed, 10);
    drawBranch(s, x0, y0, ex, ey, width, palette, o.seed + i + 20);
    const dx = ex - x0;
    const dy = ey - y0;
    const phase = i * .83 + variation(i, o.seed, 1.2);
    for (let twig = 0; twig < 3; twig++) {
      const t = .46 + twig * .2;
      const bx = x0 + dx * t;
      const by = y0 + dy * t;
      const side = twig % 2 ? 1 : -1;
      const sway = Math.sin(o.time * .9 + phase + twig) * (1.1 + twig * .25);
      const endX = bx + side * (12 + twig * 4) + dx * .12 + sway;
      const endY = by - 13 - twig * 5 + Math.cos(o.time * .7 + phase) * .55;
      s.line(bx, by, endX, endY, palette[twig % 2 + 1], side > 0 ? '/' : '\\');
      s.line(endX, endY, endX + side * (5 + noise(i, twig, o.seed) * 5), endY - 7, palette[2], side > 0 ? '\\' : '/');
      if (twig === 2) s.cell(endX + side * 3, endY - 3, "'", palette[3]);
    }
  }

  // Frost catches only the upper-left edges; the silhouette remains bare.
  if (o.variant % PALETTES.length === 2) {
    for (let i = 0; i < 34; i++) {
      const t = noise(i, 7, o.seed);
      const bx = 72 + t * 136;
      const by = 42 + (1 - t) * 62;
      s.cell(bx, by, i % 4 ? '.' : "'", '#c7d0c5');
    }
  }
  return s.frame(o.facing === 'left');
}

export const DEAD_TREE: AsciiAsset = {
  id: 'dead-tree', version: 1, name: 'Twisted dead tree', category: 'Vegetation',
  description: 'Bare jointed trunk and forked limbs with gently moving outer twigs.',
  width: 280, height: 300, anchor: { x: 140, y: 286 },
  variants: ['Bare dead tree', 'Ancient dead tree', 'Frosted dead tree'],
  footprint: [{ x: 0, y: -2, radius: 8 }],
  generate,
};
