import { noise, type AsciiAsset, type AssetOptions } from './types.ts';
import { GlyphShape } from './shapes.ts';

function generate(o: AssetOptions) {
  const s = new GlyphShape(138, 68, o.seed);
  const coat = o.variant === 1 ? ['#1b2024', '#353c3e', '#57605d', '#7e867b', '#a3aa97'] : ['#343e40', '#616e6b', '#91a09a', '#bdc4af', '#e0dfc6', '#efead0'];
  const dark = ['#101920', '#23323b', '#3b4b52', '#60716e'];
  const leather = ['#242b29', '#42483b', '#6b6b4f', '#9e9165'];
  const phase = o.action === 'walk' ? o.time * 10 : 0;
  const gait = o.action === 'walk' ? 5 : 0;
  // Far legs first. Every leg has a knee, a narrower cannon and a dark hoof.
  for (const [i, root] of [36, 49, 79, 88].entries()) {
    const stride = Math.sin(phase + i * Math.PI * .75) * gait;
    const far = i % 2 === 0;
    const kneeX = root + stride * .55;
    const footX = root - stride;
    s.polygon([[root - 3, 29], [root + 4, 30], [kneeX + 2, 46], [footX + 2, 60], [footX - 2, 61], [kneeX - 2, 46]], far ? dark : coat, far ? .7 : .92);
    s.ellipse(footX + 1, 61, 4, 1.8, dark, 1.1);
  }
  s.ellipse(59, 27, 35, 13, coat, 1.03);
  s.ellipse(34, 26, 14, 13, coat, 1.1);
  s.ellipse(83, 26, 13, 14, coat, .95);
  s.polygon([[82, 24], [89, 10], [99, 4], [106, 11], [100, 28], [90, 36]], coat, .95);
  s.ellipse(105, 10, 12, 6, coat, 1.08);
  s.ellipse(116, 14, 10, 4, coat, .83);
  s.ellipse(123, 14, 3, 3, dark, .9);
  s.polygon([[99, 6], [97, 0], [101, 2], [104, 7]], coat, 1.05);
  s.polygon([[107, 6], [108, 0], [111, 3], [110, 8]], coat, .75);
  s.cell(111, 9, '*', '#171f24');
  // Saddle blanket, rolled leather edge, girth and stirrup.
  s.polygon([[46, 16], [72, 16], [75, 33], [52, 34]], ['#202e38', '#354855', '#526571', '#778385'], .85);
  s.ellipse(60, 18, 15, 4, leather, .9);
  s.line(54, 23, 55, 37, '#a79c75', '|');
  s.line(54, 37, 59, 37, '#b4b69b', '=');
  // Fine dark mane and tail, rooted to their attachment points.
  for (let strand = 0; strand < 7; strand++) for (let i = 0; i < 22; i++) {
    const flutter = Math.sin(o.time * 3.5 - i * .19 + strand) * i * .13;
    s.cell(96 - i * .52 - strand * .3 + flutter * .3, 7 + i * .8, i % 3 ? '|' : '/', strand < 2 ? '#7d8d8d' : '#273840');
    s.cell(24 - i * .45 + flutter, 27 + i + strand * .25, i % 4 ? '|' : '~', strand < 2 ? '#839291' : '#30404a');
  }
  // Sparse mottling follows the coat, without random frame-to-frame sparkle.
  for (let y = 19; y < 30; y++) for (let x = 32; x < 84; x++) {
    if (noise(x, y, o.seed) > .96) s.cell(x, y, ':', '#8c9c98');
  }
  return s.frame(o.facing === 'left');
}

export const HORSE: AsciiAsset = { id: 'horse', version: 1, name: 'River mare', category: 'Character', description: 'Shaded mare with a saddle, articulated gait and flowing mane and tail.', width: 138, height: 68, anchor: { x: 63, y: 62 }, variants: ['Dapple grey', 'Charcoal'], generate };
