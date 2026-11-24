import type { AsciiAsset } from '../types.ts';
import { GOBLIN } from './goblin.ts';
import { ORC } from './orc.ts';
import { ELF } from './elf.ts';
import { DWARF_TOWNSFOLK } from './dwarfTownsfolk.ts';
import { PEASANT } from './peasant.ts';
import { BEGGAR } from './beggar.ts';
import { FARMER } from './farmer.ts';
import { MERCHANT } from './merchant.ts';
import { NOBLE } from './noble.ts';
import { GUARD } from './guard.ts';

/** Races and townsfolk. Agent C places these stable ids in regions and landmarks. */
export const PEOPLE: readonly AsciiAsset[] = [
  GOBLIN,
  ORC,
  ELF,
  DWARF_TOWNSFOLK,
  PEASANT,
  BEGGAR,
  FARMER,
  MERCHANT,
  NOBLE,
  GUARD,
];
