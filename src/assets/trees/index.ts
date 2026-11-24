import type { AsciiAsset } from '../types.ts';
import { OAK } from './oak.ts';
import { WILLOW } from './willow.ts';
import { BIRCH } from './birch.ts';
import { CYPRESS } from './cypress.ts';
import { CHERRY } from './cherry.ts';
import { DEAD_TREE } from './deadTree.ts';
import { BUSH } from './bush.ts';
import { REEDS } from './reeds.ts';
import { FERN } from './fern.ts';

/** Trees, bushes and large plants (Agent E). Registered in catalog.ts. */
export const TREES: readonly AsciiAsset[] = [OAK, WILLOW, BIRCH, CYPRESS, CHERRY, DEAD_TREE, BUSH, REEDS, FERN];
