import { personAsset } from './personAsset.ts';
import { spec } from './body.ts';

const base = spec({
  W: 109, H: 106, height: 88,
  shoulder: 22, head: 11, belly: 6, hunch: .08, legs: .4, arm: .32,
  skin: '#c68c64', ears: 'round', earSize: 1.3, eyes: '#eee7d2', nose: 1.5, brow: .55, tusks: 0,
  beard: 'braided', beardColor: '#77482b', hair: 'tied', hairColor: '#6c432b',
  torso: 'tunic', torsoColor: '#846846', sleeves: 'rolled', legsKind: 'trousers', legsColor: '#4a4034', hem: .2,
  boots: '#47362a', ragged: .25, patches: 1, patchColors: ['#98784d', '#58604e', '#79644b'],
  belt: '#493126', rope: false, gold: false, headwear: 'none', headColor: '#775237', headAccent: '#c2a064',
  held: 'hammer', heldColor: '#704b2e', heldAccent: '#adb8b8', reach: false, bones: false,
});

export const DWARF_TOWNSFOLK = personAsset({
  id: 'dwarf-townsfolk',
  name: 'Stonehall dwarf',
  description: 'A short broad craftsperson with a massive braided beard, leather apron and trade tools.',
  variants: ['Smith', 'Miner', 'Merchant'],
  base,
  footprintRadius: 7.5,
  outfits: [
    {
      torso: 'chain', torsoColor: '#756149', sleeves: 'rolled', apron: '#72472e',
      ragged: .2, held: 'hammer', plates: '#727b77',
    },
    {
      torso: 'tunic', torsoColor: '#6d6852', sleeves: 'rolled', legsColor: '#454438',
      ragged: .65, patches: 2, headwear: 'lamp', headColor: '#8b7a50',
      headAccent: '#ffd46b', held: 'pick', heldAccent: '#b7c1c0',
    },
    {
      torso: 'vest', torsoColor: '#84443e', under: '#cfb47f', sleeves: 'rolled',
      legsColor: '#514238', sash: '#3f716a', pouch: '#a56835',
      ragged: 0, patches: 0, headwear: 'cap', headColor: '#713e35',
      headAccent: '#d1aa5b', held: 'none',
    },
  ],
});
