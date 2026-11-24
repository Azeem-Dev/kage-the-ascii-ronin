import { HUMAN_BASE, personAsset } from './personAsset.ts';
import { spec } from './body.ts';

const base = spec({
  ...HUMAN_BASE,
  hunch: .18,
  torsoColor: '#6f604a',
  sleeves: 'long',
  legsColor: '#4d4438',
  boots: undefined,
  wraps: '#a09579',
  ragged: .55,
  patches: 3,
  rope: true,
  belt: undefined,
});

export const PEASANT = personAsset({
  id: 'peasant',
  name: 'Ashford peasant',
  description: 'A patched, rope-belted villager in worn wraps, with a tired forward stoop and bare feet.',
  variants: ['Man', 'Woman', 'Elder'],
  base,
  footprintRadius: 5,
  outfits: [
    {
      torsoColor: '#756148', legsColor: '#51483b', ragged: .55, patches: 3,
      hair: 'short', hairColor: '#49382a',
    },
    {
      torsoColor: '#736a57', legsKind: 'skirt', legsColor: '#655846',
      ragged: .65, patches: 2, hair: 'tied', hairColor: '#5a4030',
      headwear: 'scarf', headColor: '#81725b', headAccent: '#b7a384',
    },
    {
      height: 112, hunch: .36, shoulder: 15.5, head: 10.5,
      skin: '#bd9677', torsoColor: '#69604f', legsColor: '#4c463c',
      ragged: .7, patches: 2, hair: 'none', beard: 'short', beardColor: '#b8b2a1',
      wraps: '#9a927f',
    },
  ],
});
