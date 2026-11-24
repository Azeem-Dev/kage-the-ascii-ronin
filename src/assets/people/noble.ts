import { HUMAN_BASE, personAsset } from './personAsset.ts';
import { spec } from './body.ts';

const base = spec({
  ...HUMAN_BASE,
  height: 118,
  shoulder: 16.5,
  belly: 1.5,
  hunch: 0,
  legs: .47,
  torso: 'coat',
  sleeves: 'long',
  legsColor: '#403842',
  boots: '#392c27',
  ragged: 0,
  patches: 0,
  belt: '#4c2d2a',
  gold: true,
  furCollar: '#c7b89c',
  held: 'none',
  reach: false,
});

export const NOBLE = personAsset({
  id: 'noble',
  name: 'Highgarden noble',
  description: 'An upright aristocrat in saturated, gold-trimmed robes with fur, jewellery and a feathered hat or circlet.',
  variants: ['Lord', 'Lady', 'Young heir'],
  base,
  footprintRadius: 5.5,
  outfits: [
    {
      torso: 'coat', torsoColor: '#783b4d', trim: '#d7b54d',
      legsKind: 'trousers', legsColor: '#3c3540', cloak: '#622f43',
      cloakTrim: '#c8a64c', headwear: 'feather', headColor: '#512d46',
      headAccent: '#d9d25c',
    },
    {
      torso: 'robe', torsoColor: '#6f3f78', trim: '#d9b65a',
      legsKind: 'robe', legsColor: '#623a69', cloak: '#6b3d70',
      hair: 'long', hairColor: '#6b3f2a', headwear: 'circlet',
      headColor: '#dfc369', headAccent: '#72c9df', furCollar: '#d4c5a7',
    },
    {
      height: 108, shoulder: 15, head: 10, belly: 1, legs: .46,
      torso: 'coat', torsoColor: '#315f83', trim: '#d8b64f',
      legsKind: 'trousers', legsColor: '#394654', cloak: '#294d70',
      cloakTrim: '#c8a64c', hair: 'short', hairColor: '#b18a4f',
      headwear: 'feather', headColor: '#315776', headAccent: '#dce2d5',
      furCollar: '#d9ccb2',
    },
  ],
});
