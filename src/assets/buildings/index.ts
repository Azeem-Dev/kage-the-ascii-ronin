import type { AsciiAsset } from '../types.ts';
import { HOUSES } from './houses.ts';
import { SETTLEMENT_PROPS } from './settlementProps.ts';

/** Buildings and settlement props (owned by the "buildings" work stream).
 * The catalog imports this list, so every id below is available to world placement. */
export const BUILDINGS: readonly AsciiAsset[] = [...HOUSES, ...SETTLEMENT_PROPS];
