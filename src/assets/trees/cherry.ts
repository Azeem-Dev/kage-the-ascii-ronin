import { noise, type AsciiAsset, type AsciiCell, type AssetOptions } from '../types.ts';
import { GlyphShape } from '../shapes.ts';
import { drawBranch, drawTrunk, foliageClump, variation, type LeafPalette } from './treePrimitives.ts';

const BARK = ['#252526', '#48403a', '#6e5546', '#93705a'] as const;
const PALETTES: readonly LeafPalette[] = [
  ['#744959', '#ad6f82', '#dfa0af', '#f4cad1'],
  ['#766572', '#b49baa', '#ddd0ce', '#f6e7dc'],
  ['#673c52', '#a45e79', '#d98da4', '#f5bdcd'],
];
const PETALS = ['#d991a8', '#efb5c3', '#f8d5d7', '#fae5dc'] as const;

function generate(o: AssetOptions): AsciiCell[] {
  const s = new GlyphShape(300, 300, o.seed);
  const variant = o.variant % PALETTES.length;
  const baseX = 150 + variation(12, o.seed, 7);
  drawTrunk(s, { x: baseX, y: 286, topX: 144 + variation(13, o.seed, 7), topY: 107, baseWidth: 26, topWidth: 6, palette: BARK, seed: o.seed, roots: 37 });
  const branches = [
    [75, 154, 213, 54], [230, 163, 218, 65], [113, 195, 237, 70], [207, 199, 239, 74],
    [54, 119, 165, 43], [249, 118, 177, 43], [106, 98, 146, 23], [205, 95, 153, 24],
  ] as const;
  for (let i = 0; i < branches.length; i++) {
    const [x, y, rootY, width] = branches[i];
    drawBranch(s, baseX, rootY, x + variation(i, o.seed, 7), y + 15, width, BARK, o.seed + i);
  }
  drawBranch(s, 144, 141, 145 + variation(21, o.seed, 8), 59, 10, BARK, o.seed + 21);

  const clusters = [
    [55, 144, 43, 33], [246, 148, 43, 34], [93, 181, 49, 34], [208, 185, 50, 35],
    [65, 100, 43, 34], [133, 70, 50, 38], [210, 96, 48, 36], [119, 126, 58, 42],
    [184, 131, 57, 41], [151, 169, 50, 33], [158, 106, 45, 31],
  ] as const;
  for (let i = 0; i < clusters.length; i++) {
    const [cx, cy, rx, ry] = clusters[i];
    foliageClump(s, {
      cx: cx + variation(i + 40, o.seed, 11), cy: cy + variation(i + 65, o.seed, 7),
      rx, ry, palette: PALETTES[variant], seed: o.seed * 31 + i * 107,
      phase: i * .77, sway: .65 + i * .045, time: o.time,
      density: .89, lightness: 1.06,
    });
  }

  // Variant three adds a light, asynchronous fall rather than a decorative ring.
  if (variant === 2) {
    for (let i = 0; i < 30; i++) {
      const offset = noise(i, 2, o.seed);
      const speed = .045 + noise(i, 5, o.seed) * .035;
      const progress = (o.time * speed + offset) % 1;
      const startY = 38 + noise(i, 8, o.seed) * 104;
      const x = 43 + noise(i, 11, o.seed) * 214 + Math.sin(progress * 7 + i) * (4 + progress * 10);
      const y = startY + progress * (280 - startY);
      const n = noise(i, Math.floor(y), o.seed + 71);
      if (n < .18) continue;
      s.cell(x + Math.sin(o.time * 1.5 + i) * 1.2, y, n > .72 ? '.' : n > .4 ? "'" : ',', PETALS[i % PETALS.length]);
    }
  }
  return s.frame(o.facing === 'left');
}

export const CHERRY: AsciiAsset = {
  id: 'cherry', version: 1, name: 'Flowering cherry', category: 'Vegetation',
  description: 'Dark branching trunk under pink blossom clumps; petal-fall variant included.',
  width: 300, height: 300, anchor: { x: 150, y: 286 },
  variants: ['Pink sakura', 'White sakura', 'Sakura petal fall'],
  footprint: [{ x: 0, y: -2, radius: 9 }],
  generate,
};
