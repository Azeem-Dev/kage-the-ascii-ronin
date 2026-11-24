import art from './art/horse.json';
import type { AsciiAsset } from './types.ts';
import { authoredFrame } from './authored.ts';

export const HORSE: AsciiAsset = {
  id: 'horse', version: 2, name: 'Dapple grey mare', category: 'Character',
  description: 'Anatomically proportioned mare with leather saddle, articulated legs, mane and tail.',
  width: art.width, height: art.height, anchor: art.anchor,
  variants: ['Dapple grey', 'Night coat'],
  generate: options => authoredFrame(art, options, 'horse'),
};
