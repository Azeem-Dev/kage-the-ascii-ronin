import { HUMAN_BASE, personAsset } from './personAsset.ts';
import { spec } from './body.ts';

const base = spec({
  ...HUMAN_BASE,
  hunch: .08,
  torsoColor: '#968252',
  sleeves: 'rolled',
  legsColor: '#5d533e',
  boots: '#58432f',
  ragged: .2,
  patches: 1,
  rope: true,
  belt: undefined,
  headwear: 'straw',
  headColor: '#c3a15d',
  headAccent: '#7f6238',
  held: 'pitchfork',
  heldColor: '#795333',
  heldAccent: '#aeb7b4',
});

export const FARMER = personAsset({
  id: 'farmer',
  name: 'Wheatsheaf farmer',
  description: 'A straw-hatted field worker with rolled sleeves, practical wraps and a long-handled tool.',
  variants: ['Man', 'Woman', 'Boy'],
  base,
  footprintRadius: 5,
  outfits: [
    {
      torsoColor: '#978453', legsKind: 'trousers', legsColor: '#5f543f',
      ragged: .2, patches: 1, held: 'pitchfork',
    },
    {
      torsoColor: '#8e7350', legsKind: 'skirt', legsColor: '#6d6048',
      ragged: .25, patches: 1, hair: 'tied', hairColor: '#654832',
      held: 'basket', heldColor: '#88613b', heldAccent: '#b7a15e',
    },
    {
      height: 76, shoulder: 11, head: 9, belly: .7, hunch: .04,
      legs: .45, arm: .34, torsoColor: '#a18b56', legsColor: '#5b513d',
      ragged: .2, patches: 1, hair: 'short', hairColor: '#765130',
      held: 'pitchfork',
    },
  ],
});
