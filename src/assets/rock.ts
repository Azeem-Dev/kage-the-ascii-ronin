import type { AsciiAsset } from './types.ts';
import { GlyphShape } from './shapes.ts';

export const ROCK: AsciiAsset = { id: 'rock', version: 1, name: 'River stone', category: 'Terrain', description: 'Rounded moonlit stone with moss and a shaded contact edge.', width: 38, height: 26, anchor: { x: 19, y: 23 }, variants: ['Granite', 'Moss'], generate: o => {
  const s = new GlyphShape(38, 26, o.seed);
  s.ellipse(19, 16, 17, 8, ['#111b23', '#253540', '#4c626c', '#7f9296', '#b1bfba'], 1.1);
  s.ellipse(15, 11, 12, 8, o.variant ? ['#213c34', '#3a5643', '#668064', '#97a082'] : ['#283943', '#4d646e', '#7a9096', '#a8b6b2'], .95);
  s.line(12, 8, 16, 18, '#34474e', ':');
  return s.frame();
} };
