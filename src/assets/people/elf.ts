import { personAsset } from './personAsset.ts';
import { spec } from './body.ts';

const base = spec({
  W: 97, H: 150, height: 126,
  shoulder: 13, head: 10.5, belly: .5, hunch: .02, legs: .49, arm: .35,
  skin: '#dfb98f', ears: 'pointed', earSize: 1.3, eyes: '#e2f2e8', nose: .7, brow: .15, tusks: 0,
  beard: 'none', beardColor: '#c7b78f', hair: 'long', hairColor: '#d8d0b5',
  torso: 'robe', torsoColor: '#526f48', trim: '#9baa65', sleeves: 'long', legsKind: 'trousers', legsColor: '#46533a', hem: .2,
  boots: '#493a2d', ragged: 0, patches: 0,
  belt: '#49372a', gold: false, headwear: 'none', headColor: '#536a45', headAccent: '#d7c77c',
  held: 'bow', heldColor: '#765334', heldAccent: '#c6d5cf', reach: true, bones: false,
});

export const ELF = personAsset({
  id: 'elf',
  name: 'Silverleaf elf',
  description: 'A tall slender woodland elf with pointed ears, long flowing hair and elegant crafted gear.',
  variants: ['Ranger', 'Mage', 'Noble'],
  base,
  footprintRadius: 4.5,
  outfits: [
    {
      torso: 'vest', torsoColor: '#657543', under: '#425b35', trim: '#8d9c57',
      sleeves: 'short', legsKind: 'trousers', legsColor: '#4d5038',
      plates: '#71844b', cloak: '#425d3c', held: 'bow',
    },
    {
      torso: 'robe', torsoColor: '#4f6f9a', trim: '#c3d9df', sleeves: 'long',
      legsKind: 'robe', legsColor: '#405a82', belt: '#314660', cloak: '#3d527b',
      hairColor: '#dbe4e2', headwear: 'circlet', headColor: '#c4d6df',
      held: 'staff', heldAccent: '#bfe7f0', reach: true,
    },
    {
      torso: 'robe', torsoColor: '#e0e1d4', trim: '#d8b64f', sleeves: 'long',
      legsKind: 'robe', legsColor: '#c9cbbb', belt: '#a8873f', cloak: '#d5d7ca',
      hairColor: '#ead8a8', headwear: 'circlet', headColor: '#dfc369',
      headAccent: '#72c9df', held: 'none', reach: false, gold: true,
    },
  ],
});
