import { noise, type AsciiAsset, type AssetOptions, type AsciiCell } from './types.ts';
import { GlyphShape } from './shapes.ts';
import { drawBranch, drawTrunk, variation, type LeafPalette } from './trees/treePrimitives.ts';

const BARK = ['#242723', '#48483a', '#6d654b', '#948064'] as const;
const PALETTES: readonly LeafPalette[] = [
  ['#14372b', '#2d593f', '#53774e', '#849568'],
  ['#132f32', '#2a4e4d', '#496d67', '#7d9481'],
  ['#1c4035', '#42664d', '#72906a', '#aec0a2'],
];

interface Bough {
  cx: number;
  top: number;
  bottom: number;
  halfWidth: number;
  palette: LeafPalette;
  seed: number;
  phase: number;
  time: number;
  snowy: boolean;
}

/** One ragged tier: bright upper needles, dark drooping underside, open edges. */
function needleBough(s: GlyphShape, bough: Bough): void {
  const { cx, top, bottom, halfWidth, palette, seed, phase, time, snowy } = bough;
  const height = bottom - top;
  const lean = Math.sin(time * .8 + phase) * .72;
  for (let y = top; y <= bottom; y++) {
    const p = (y - top) / height;
    const width = halfWidth * (.13 + .87 * Math.pow(p, .82));
    for (let x = Math.floor(cx - width - 5); x <= Math.ceil(cx + width + 5); x++) {
      const nx = (x - cx - lean) / Math.max(1, width);
      const n = noise(x, y, seed);
      const edge = .88 + Math.sin(y * .73 + phase) * .11 + (n - .5) * .15;
      if (Math.abs(nx) > edge + .12) continue;
      if (Math.abs(nx) > edge) {
        if (n < .72) continue;
        s.cell(x, y + (n > .9 ? 1 : 0), n > .9 ? '*' : "'", palette[3]);
        continue;
      }
      if (p > .72 && n < .12) continue;
      const light = .31 + (1 - p) * .35 - nx * .12 + (n - .5) * .13;
      const shade = Math.max(0, Math.min(3, Math.floor(light * 4)));
      const glyph = p < .2 ? (n > .5 ? '^' : '*') : p > .72 ? (n > .55 ? "'" : ';') : shade > 2 ? (n > .5 ? 'O' : '#') : shade > 1 ? (n > .5 ? '*' : 'x') : (n > .5 ? ';' : ':');
      const snow = snowy && p < .28 && nx > -.45 && n > .3;
      s.cell(x, y, snow ? (n > .8 ? '*' : '+') : glyph, snow ? '#dce5d7' : palette[shade]);
    }
  }
}

function generate(o: AssetOptions): AsciiCell[] {
  const s = new GlyphShape(110, 110, o.seed);
  const variant = o.variant % PALETTES.length;
  const baseX = 54 + variation(22, o.seed, 4);
  drawTrunk(s, { x: baseX, y: 104, topX: 53 + variation(23, o.seed, 3), topY: 15, baseWidth: 13, topWidth: 3, palette: BARK, seed: o.seed, roots: 18 });
  const tiers = [
    [10, 41, 18], [26, 58, 29], [42, 74, 38], [57, 88, 46], [71, 97, 52],
  ] as const;
  for (let i = tiers.length - 1; i >= 0; i--) {
    const [top, bottom, halfWidth] = tiers[i];
    const cx = 54 + variation(i + 30, o.seed, 4);
    const sway = Math.sin(o.time * .8 + i * .67) * .72;
    drawBranch(s, baseX, Math.min(101, bottom - 5), cx - halfWidth * .68 + sway, bottom - 8, i > 2 ? 4 : 3, BARK, o.seed + i);
    drawBranch(s, baseX, Math.min(101, bottom - 7), cx + halfWidth * .68 + sway, bottom - 10, i > 2 ? 4 : 3, BARK, o.seed + i + 10);
    needleBough(s, {
      cx, top, bottom, halfWidth: halfWidth * (.94 + noise(i, 7, o.seed) * .12),
      palette: PALETTES[variant], seed: o.seed * 41 + i * 127,
      phase: i * .67 + variation(i, o.seed, .5), time: o.time, snowy: variant === 2,
    });
  }
  return s.frame(o.facing === 'left');
}

export const PINE: AsciiAsset = {
  id: 'pine', version: 3, name: 'Layered mountain pine', category: 'Vegetation',
  description: 'Five ragged needle tiers, dark undersides, visible trunk and optional snowy tips.',
  width: 110, height: 110, anchor: { x: 54, y: 104 },
  variants: ['Forest', 'Moonlit', 'Snowy tips'],
  footprint: [{ x: 0, y: -1, radius: 6 }],
  generate,
};
