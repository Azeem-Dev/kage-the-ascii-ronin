import catGirl from './art/cat-girl.json';
import catBoy from './art/cat-boy.json';
import vampireGirl from './art/vampire-girl.json';
import vampireBoy from './art/vampire-boy.json';
import dwarf from './art/dwarf-guardian.json';
import dwarfNeutral from './art/dwarf-neutral.json';
import { authoredFrame, type GlyphArt } from './authored.ts';
import type { AsciiAsset } from './types.ts';

function character(id: string, name: string, art: GlyphArt, description: string): AsciiAsset {
  return { id, name, version: 1, category: 'Character', width: art.width, height: art.height, anchor: art.anchor, description, variants: ['Original', 'Moonlit', 'Bronze'], generate: options => authoredFrame(art, options, 'knight') };
}

export const CHARACTERS: readonly AsciiAsset[] = [
  character('cat-girl', 'Catfolk ranger - female', catGirl, 'Silver-haired feline ranger with ears, tail, layered leather and a short sword.'),
  character('cat-boy', 'Catfolk ranger - male', catBoy, 'Dark-haired feline ranger in forest leathers with visible ears and tail.'),
  character('vampire-girl', 'Vampire noble - female', vampireGirl, 'Pale vampire with dark hair, embroidered burgundy coat and a curved blade.'),
  character('vampire-boy', 'Vampire noble - male', vampireBoy, 'High-collared vampire noble with swept hair, a long cape and a curved blade.'),
  character('dwarf-guardian', 'Dwarf guardian', dwarf, 'Stocky bronze guardian with braided copper beard and a broad axe.'),
  character('dwarf-neutral', 'Dwarf sentinel - neutral', dwarfNeutral, 'Closed-helmet dwarf in a teal hood with a compact war hammer.'),
];
