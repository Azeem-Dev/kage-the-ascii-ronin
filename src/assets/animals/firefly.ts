import { GlyphShape } from '../shapes.ts';
import { noise, type AsciiAsset, type AsciiCell, type AssetOptions } from '../types.ts';

function firefly(options: AssetOptions): AsciiCell[] {
  const s = new GlyphShape(20, 20, options.seed);
  const phase = options.time * 2.3 + options.seed * .17;
  const x = 10 + Math.cos(phase) * 1.5;
  const y = 10 + Math.sin(phase * 1.31) * 2;
  const pulse = .5 + .5 * Math.sin(options.time * 4.2 + options.seed);
  const palette = options.variant % 2 === 0
    ? ['#526b2c', '#8da843', '#c4da62', '#edf58e', '#ffffc4']
    : ['#75612a', '#b49a3e', '#e1c75e', '#fff199', '#fffbd4'];
  const k = Math.min(4, Math.floor((.42 + pulse * .58) * 5));
  // A bright authored effect, not an emissive bitmap. The halo breathes as whole cells.
  if (pulse > .22) {
    s.cell(x - 2, y, '.', palette[Math.max(1, k - 1)]);
    s.cell(x + 2, y, '.', palette[Math.max(1, k - 1)]);
    s.cell(x, y - 2, '.', palette[Math.max(1, k - 1)]);
    if (pulse > .65) s.cell(x, y + 2, ':', palette[Math.max(2, k - 1)]);
  }
  s.ellipse(x, y + 2, 1.6, 3.2, ['#26352a', '#536746', '#94a56b'], .82, '.:;x#');
  s.cell(x, y + 4, '@', palette[k]);
  s.cell(x, y + 3, 'O', palette[Math.min(4, k + 1)]);
  s.cell(x - 1, y + 1, '/', palette[Math.max(1, k - 1)]);
  s.cell(x + 1, y + 1, '\\', palette[Math.max(1, k - 1)]);
  s.cell(x - 1, y - 1, '.', '#b9c5a2');
  s.cell(x + 1, y - 1, '.', '#b9c5a2');
  if (noise(Math.floor(options.time * 3), options.seed, 91) > .72) s.cell(x + 3, y - 2, '*', palette[Math.max(2, k - 1)]);
  return s.frame(options.facing === 'left');
}

export const FIREFLY: AsciiAsset = {
  id: 'firefly', name: 'Meadow light bug', version: 2, category: 'Creature',
  description: 'One-to-two-cell nocturnal light bug with a seeded drifting path and a breathing yellow-green halo.',
  width: 20, height: 20, anchor: { x: 10, y: 18 }, variants: ['Foxfire', 'Warm gold'],
  light: { x: 0, y: -8, radius: 18, color: [.72, 1, .28] },
  generate: firefly,
};
