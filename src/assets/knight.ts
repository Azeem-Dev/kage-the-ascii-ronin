import art from './art/knight.json';
import type { AsciiAsset } from './types.ts';
import { authoredFrame } from './authored.ts';

export const KNIGHT: AsciiAsset = {
  id: 'knight', version: 3, name: 'Eclipse knight', category: 'Character',
  description: 'Closed armet, overlapping plate armor, layered cape and a longsword. Authored glyph art.',
  width: art.width, height: art.height, anchor: art.anchor,
  variants: ['Weathered steel', 'Midnight steel', 'Antique bronze', 'Crimson plate'],
  generate: options => authoredFrame(art, options, 'knight'),
};
