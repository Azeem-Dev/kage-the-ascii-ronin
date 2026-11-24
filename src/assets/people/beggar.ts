import { HUMAN_BASE, personAsset } from './personAsset.ts';
import { spec } from './body.ts';

const base = spec({
  ...HUMAN_BASE,
  hunch: .5,
  skin: '#b89578',
  torsoColor: '#5d584c',
  sleeves: 'long',
  legsKind: 'trousers',
  legsColor: '#45423b',
  boots: undefined,
  wraps: '#918773',
  ragged: 1,
  patches: 4,
  patchColors: ['#6d6657', '#484b43', '#80745d'],
  belt: undefined,
  rope: true,
  cloak: '#514c42',
  headwear: 'hood',
  headColor: '#48443b',
  headAccent: '#857a64',
  held: 'cup',
  heldColor: '#8b7658',
  heldAccent: '#b8a985',
});

export const BEGGAR = personAsset({
  id: 'beggar',
  name: 'Old Quarter beggar',
  description: 'A deeply hunched figure in layered torn rags, clutching a chipped begging cup.',
  variants: ['Hooded', 'Bandaged', 'Child'],
  base,
  footprintRadius: 4.5,
  outfits: [
    {
      torsoColor: '#60584b', cloak: '#514a3f', ragged: 1, patches: 4,
      headwear: 'hood', held: 'cup',
    },
    {
      torsoColor: '#6a6355', legsColor: '#4a473e', ragged: .95, patches: 3,
      headwear: 'bandage', headColor: '#e2d8bf', headAccent: '#a99e82',
      beard: 'short', beardColor: '#777063', held: 'cup',
    },
    {
      height: 72, shoulder: 10.5, head: 8.5, belly: .5, hunch: .58,
      legs: .46, arm: .34, skin: '#bd987a', torsoColor: '#6d6655',
      legsKind: 'loin', legsColor: '#514c41', ragged: 1, patches: 2,
      cloak: '#625b4b', hair: 'short', hairColor: '#594535',
      headwear: 'scarf', headColor: '#77705e', headAccent: '#a99b7d',
      held: 'cup',
    },
  ],
});
