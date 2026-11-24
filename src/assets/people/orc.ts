import { personAsset } from './personAsset.ts';
import { spec } from './body.ts';

const base = spec({
  W: 129, H: 150, height: 132,
  shoulder: 26, head: 12.5, belly: 5, hunch: .16, legs: .44, arm: .32,
  skin: '#72846a', ears: 'pointed', earSize: 1.2, eyes: '#e5ddb4', nose: 2, brow: 1.1, tusks: 1.6,
  beard: 'short', beardColor: '#282721', hair: 'short', hairColor: '#24231f',
  torso: 'tunic', torsoColor: '#60543e', sleeves: 'none', legsKind: 'trousers', legsColor: '#3d3c32', hem: .14,
  boots: '#3d3127', ragged: .45, patches: 1, patchColors: ['#74664b', '#4c5942', '#806047'],
  belt: '#3c2b22', gold: false, headwear: 'none', headColor: '#69716b', headAccent: '#9d8c58',
  held: 'axe', heldColor: '#68462d', heldAccent: '#aeb8b7', reach: false, bones: false,
});

export const ORC = personAsset({
  id: 'orc',
  name: 'Ironwood orc',
  description: 'A massive grey-green raider with a heavy brow, ivory tusks, scrap armour and a broad axe.',
  variants: ['Warrior', 'Brute', 'Chieftain'],
  base,
  footprintRadius: 9,
  outfits: [
    {
      torso: 'chain', sleeves: 'none', plates: '#727a73', furCollar: '#5a4633',
      cloak: '#553d31', ragged: .45, headwear: 'helm', shield: '#665444',
    },
    {
      torso: 'bare', sleeves: 'none', legsColor: '#494236', ragged: .3,
      furCollar: '#66503a', headwear: 'none', beard: 'long', beardColor: '#302c25',
    },
    {
      torso: 'chain', sleeves: 'none', plates: '#777b70', furCollar: '#9a8b72',
      cloak: '#4d2f2b', cloakTrim: '#b69a4d', tabard: '#733c34', crest: '#d5b558',
      ragged: .2, headwear: 'skullhelm', headColor: '#d8d0b6', headAccent: '#4a4034',
      shield: '#5b3b31', gold: true,
    },
  ],
});
