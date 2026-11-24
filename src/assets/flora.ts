import { GlyphShape } from './shapes.ts';
import { noise, type AsciiAsset, type AssetOptions } from './types.ts';

function flowers(options: AssetOptions, palette: readonly string[]) {
  const s = new GlyphShape(56, 42, options.seed);
  for (let i = 0; i < 7; i++) {
    const x = 8 + i * 6 + noise(i, 5, options.seed) * 3;
    const y = 13 + noise(i, 8, options.seed) * 15;
    const sway = Math.sin(options.time * 1.4 + i) * 1.3;
    s.line(x, 38, x + sway, y, '#587e50', '|');
    s.line(x, 32, x - 4, 29, '#7e9c67', '/');
    const color = palette[(i + options.variant) % palette.length];
    for (const [dx, dy] of [[-2, 0], [2, 0], [0, -2], [0, 2]]) s.ellipse(x + sway + dx, y + dy, 2, 1.5, [color, '#dcd9bf'], .9, ':*+#');
    s.cell(x + sway, y, '*', '#e3c982');
  }
  return s.frame(options.facing === 'left');
}

export const FLORA: readonly AsciiAsset[] = [
  ['flowers-blue', 'Bluebells', ['#6da1d4', '#a0bcdf', '#7594c2']],
  ['flowers-pink', 'Wild roses', ['#cc91ac', '#e5b2c7', '#b7709c']],
  ['flowers-purple', 'Lavender clump', ['#9576b8', '#c1a1d9', '#aa89c3']],
  ['flowers-gold', 'Golden meadow flowers', ['#c7a75e', '#ead39a', '#e2bc63']],
].map(([id, name, palette]) => ({ id: id as string, name: name as string, version: 1, category: 'Vegetation', width: 56, height: 42, anchor: { x: 28, y: 38 }, description: 'Reusable multi-stem flower clump with individually swaying blossoms.', variants: ['Natural', 'Mixed bloom'], generate: options => flowers(options, palette as string[]) }));
