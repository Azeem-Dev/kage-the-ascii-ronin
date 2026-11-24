import { HUMAN_BASE, personAsset } from './personAsset.ts';
import { spec } from './body.ts';

const base = spec({
  ...HUMAN_BASE,
  height: 116,
  shoulder: 17.5,
  belly: 4,
  hunch: 0,
  torso: 'vest',
  sleeves: 'long',
  legsColor: '#4c4038',
  boots: '#48342a',
  ragged: 0,
  patches: 0,
  belt: '#4c3025',
  sash: '#82443d',
  pouch: '#9c6035',
  headwear: 'cap',
  headColor: '#784331',
  headAccent: '#d0aa5d',
  held: 'none',
});

export const MERCHANT = personAsset({
  id: 'merchant',
  name: 'Market guild merchant',
  description: 'A well-fed trader in a bright vest and sash, wearing a cap and a prominently buckled coin pouch.',
  variants: ['Spice seller', 'Cloth seller', 'Fishmonger'],
  base,
  footprintRadius: 5.5,
  outfits: [
    {
      torsoColor: '#b75c35', under: '#dbc79c', sash: '#7a3430',
      headColor: '#82452f', held: 'none', pouch: '#a56a36',
    },
    {
      torsoColor: '#3f7e7d', under: '#d5c6a4', sash: '#9b4e62',
      headColor: '#354f65', held: 'basket', heldColor: '#8a623d',
      heldAccent: '#c1a46a', pouch: '#9a5d32',
    },
    {
      torsoColor: '#526f8a', under: '#c5d0cd', sleeves: 'rolled',
      sash: '#7c4c38', apron: '#b7c1ba', headColor: '#3e5964',
      held: 'basket', heldColor: '#785637', heldAccent: '#9fb5ba', pouch: '#965d35',
    },
  ],
});
