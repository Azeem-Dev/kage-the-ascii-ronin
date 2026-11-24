import { noise, type AsciiAsset, type AsciiCell, type AssetOptions } from '../types.ts';
import { GlyphShape } from '../shapes.ts';
import { foliageClump, variation, type LeafPalette } from './treePrimitives.ts';

const STEM = ['#2c392b', '#4f6140', '#748052'] as const;
const PALETTES: readonly LeafPalette[] = [
  ['#2b4b36', '#52754a', '#7f995d', '#a9b67b'],
  ['#264637', '#4a704b', '#76935d', '#9eb079'],
  ['#58472d', '#8b6739', '#b18a4a', '#d0af6c'],
];
const BERRIES = ['#722f38', '#a94546', '#d36855'] as const;

function generate(o: AssetOptions): AsciiCell[] {
  const s = new GlyphShape(110, 80, o.seed);
  const variant = o.variant % PALETTES.length;
  const sizes = [
    { cy: 59, rx: 29, ry: 20, spread: 25 },
    { cy: 53, rx: 35, ry: 26, spread: 29 },
    { cy: 45, rx: 40, ry: 32, spread: 33 },
  ] as const;
  const size = sizes[variant];
  for (let i = 0; i < 4; i++) s.line(55 + (i - 1.5) * 3, 74, 54 + variation(i, o.seed, 8), size.cy + 3, STEM[i % 3], i % 2 ? '/' : '\\');
  const clumps = [
    [-.72, .2, .62, .69], [.68, .18, .64, .7], [-.28, -.42, .73, .78], [.36, -.35, .7, .75], [0, .38, .86, .62],
  ] as const;
  for (let i = 0; i < clumps.length; i++) {
    const [dx, dy, rx, ry] = clumps[i];
    foliageClump(s, {
      cx: 55 + dx * size.spread + variation(i + 10, o.seed, 5),
      cy: size.cy + dy * size.ry + variation(i + 20, o.seed, 4),
      rx: size.rx * rx, ry: size.ry * ry,
      palette: PALETTES[variant], seed: o.seed * 37 + i * 131,
      phase: i * 1.13, sway: .35 + i * .06, time: o.time,
      density: variant === 2 ? .83 : .9,
    });
  }
  if (variant === 1) {
    for (let i = 0; i < 13; i++) {
      const angle = noise(i, 3, o.seed) * Math.PI * 2;
      const radius = .35 + noise(i, 6, o.seed) * .52;
      const x = 55 + Math.cos(angle) * size.rx * radius;
      const y = size.cy + Math.sin(angle) * size.ry * radius;
      const sway = Math.sin(o.time * .75 + i) * .35;
      s.cell(x + sway, y, i % 3 ? 'o' : 'O', BERRIES[i % BERRIES.length]);
      if (i % 3 === 0) s.cell(x + sway, y - 1, "'", PALETTES[variant][2]);
    }
  }
  return s.frame(o.facing === 'left');
}

export const BUSH: AsciiAsset = {
  id: 'bush', version: 1, name: 'Roadside shrub', category: 'Vegetation',
  description: 'Three shrub sizes with warm autumn colouring and a berry-covered variant.',
  width: 110, height: 80, anchor: { x: 55, y: 74 },
  variants: ['Small leafy shrub', 'Berry bush', 'Large autumn shrub'],
  footprint: [{ x: 0, y: -1, radius: 5 }],
  generate,
};
