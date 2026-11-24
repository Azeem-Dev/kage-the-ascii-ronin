import { personAsset } from './personAsset.ts';
import { spec } from './body.ts';

const base = spec({
  W: 105, H: 100, height: 74,
  shoulder: 15, head: 9.5, belly: 1.5, hunch: .72, legs: .45, arm: .33,
  skin: '#87a04d', ears: 'long', earSize: 1.6, eyes: '#f2d23a', nose: 1.7, brow: .5, tusks: .5,
  beard: 'short', beardColor: '#4f4b2c', hair: 'short', hairColor: '#3f3b26',
  torso: 'tunic', torsoColor: '#665033', sleeves: 'none', legsKind: 'loin', legsColor: '#5a4029', hem: .2,
  ragged: .95, patches: 1, patchColors: ['#7f6a3d', '#4f603b', '#8a7148'],
  rope: true, gold: false, headwear: 'none', headColor: '#5b482f', headAccent: '#b59b58',
  held: 'dagger', heldColor: '#795335', heldAccent: '#b9c3c1', reach: false, bones: false,
});

export const GOBLIN = personAsset({
  id: 'goblin',
  name: 'Mire goblin',
  description: 'A small hunched raider with enormous ears, yellow eyes and crude scavenged gear.',
  variants: ['Grunt', 'Archer', 'Shaman'],
  base,
  footprintRadius: 5,
  outfits: [
    {
      torsoColor: '#725438', ragged: .95, patches: 2,
      held: 'dagger', heldAccent: '#bcc5c2',
    },
    {
      torso: 'vest', torsoColor: '#6e5134', under: '#8d6a3e', sleeves: 'none',
      legsColor: '#60442c', ragged: .85, held: 'bow', reach: true,
    },
    {
      torsoColor: '#78613b', legsColor: '#4f402b', ragged: 1, patches: 1,
      hair: 'tied', hairColor: '#b8ad7d', held: 'staff', heldColor: '#765035',
      heldAccent: '#89c979', reach: true, bones: true,
    },
  ],
});
