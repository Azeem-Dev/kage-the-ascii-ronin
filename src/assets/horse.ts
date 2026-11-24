import art from './art/horse.json';
import type { AsciiAsset } from './types.ts';
import { authoredFrame } from './authored.ts';

export const HORSE: AsciiAsset = {
  id: 'horse', version: 3, name: 'Dapple grey mare', category: 'Character',
  description: 'Articulated mare with planted walk hooves, grouped gallop, breathing, swishing tail and trailing mane.',
  width: art.width, height: art.height, anchor: art.anchor,
  variants: ['Dapple grey', 'Night coat'],
  generate: options => authoredFrame(art, options, 'horse'),
};
