import type { AsciiAsset } from '../types.ts';
import { SPARROW, CROW, PARROT, VULTURE } from './birds.ts';
import { FIREFLY } from './firefly.ts';
import { COW, BUFFALO, WILD_HORSE, GOAT, SHEEP, DEER } from './quadrupeds.ts';

/** Agent F wildlife. All art is generated glyph geometry; catalog.ts already imports ANIMALS. */
export const ANIMALS: readonly AsciiAsset[] = [
  COW, BUFFALO, WILD_HORSE, GOAT, SHEEP, DEER,
  SPARROW, CROW, PARROT, VULTURE, FIREFLY,
];
