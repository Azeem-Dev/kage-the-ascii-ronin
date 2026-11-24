import { HUMAN_BASE, personAsset } from './personAsset.ts';
import { spec } from './body.ts';

const base = spec({
  ...HUMAN_BASE,
  height: 116,
  shoulder: 17.5,
  belly: 1.4,
  hunch: 0,
  torso: 'chain',
  sleeves: 'long',
  legsColor: '#444b4c',
  boots: '#3d3731',
  ragged: 0,
  patches: 0,
  belt: '#3c3028',
  plates: '#858e8e',
  tabard: '#385b70',
  crest: '#c3a451',
  headwear: 'helm',
  headColor: '#8d9698',
  headAccent: '#a8b2ae',
  held: 'spear',
  heldColor: '#714b2f',
  heldAccent: '#c0cbc9',
  reach: true,
  shield: '#3c6070',
});

export const GUARD = personAsset({
  id: 'guard',
  name: 'Ashford town guard',
  description: 'A mailed watchman in a crested tabard and helmet, carrying a spear and shield; the night watch bears a lantern.',
  variants: ['Town guard', 'Captain', 'Night watch'],
  base,
  footprintRadius: 5.5,
  outfits: [
    {
      tabard: '#385b70', crest: '#c3a451', shield: '#3c6070',
      headAccent: '#a8b2ae', held: 'spear',
    },
    {
      tabard: '#7c3541', crest: '#e0bd52', shield: '#673944',
      cloak: '#62313b', headAccent: '#c8a45a', held: 'spear', gold: true,
    },
    {
      tabard: '#28384d', crest: '#7293a3', shield: '#33465b',
      headColor: '#59636c', headAccent: '#59636c',
      held: 'lantern', heldColor: '#4a4038', heldAccent: '#ffcf6a', reach: false,
    },
  ],
});
