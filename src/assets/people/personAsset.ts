import { spec, type BodySpec } from './body.ts';
import { personCells, personModel, personSpriteSize } from '../voxel/voxelPerson.ts';
import type { AsciiAsset } from '../types.ts';

interface PersonAssetDefinition extends Pick<AsciiAsset, 'id' | 'name' | 'description' | 'variants'> {
  base: BodySpec;
  /** One override per named variant. Canvas dimensions must stay equal to the base. */
  outfits: readonly Partial<BodySpec>[];
  /** Ground collision radius in authored cells; the collision centre is the anchor. */
  footprintRadius?: number;
}

/** Wrap the shared body renderer in the public asset contract. */
export function personAsset(definition: PersonAssetDefinition): AsciiAsset {
  const { id, name, description, variants, base, outfits, footprintRadius } = definition;
  if (variants.length === 0 || outfits.length !== variants.length) {
    throw new Error(`${id}: every named variant needs one body spec`);
  }
  if (base.W % 2 === 0) {
    throw new Error(`${id}: an odd canvas width is required for clean mirroring`);
  }

  const bodies = outfits.map(outfit => {
    const body = spec({ ...base, ...outfit });
    if (body.W !== base.W || body.H !== base.H) {
      throw new Error(`${id}: variants must share the base canvas`);
    }
    return body;
  });

  const baseSpec = spec(base);
  const size = personSpriteSize(baseSpec);
  return {
    id,
    version: 2,
    name,
    category: 'Character',
    description,
    width: size.width,
    height: size.height,
    anchor: size.anchor,
    variants,
    footprint: [{ x: 0, y: 0, radius: footprintRadius ?? Math.max(3, base.shoulder * .36) }],
    generateAt: (options, scale) => {
      const index = ((Math.trunc(options.variant) % bodies.length) + bodies.length) % bodies.length;
      return personModel(bodies[index], options, baseSpec, scale);
    },
    generate: options => {
      const index = ((Math.trunc(options.variant) % bodies.length) + bodies.length) % bodies.length;
      return personCells(bodies[index], options, baseSpec);
    },
  };
}

/** Shared 116-cell human proportions; townsfolk override build, clothing and posture. */
export const HUMAN_BASE = spec({
  W: 97,
  H: 140,
  height: 116,
  shoulder: 16,
  head: 10.5,
  belly: 1.4,
  hunch: 0,
  legs: .46,
  arm: .34,
  skin: '#d4a074',
  ears: 'round',
  earSize: 1,
  eyes: '#e9eee8',
  nose: 1,
  brow: 0,
  tusks: 0,
  beard: 'none',
  beardColor: '#65503a',
  hair: 'short',
  hairColor: '#493526',
  torso: 'tunic',
  torsoColor: '#71614b',
  sleeves: 'long',
  legsKind: 'trousers',
  legsColor: '#4c4338',
  hem: .16,
  boots: '#49382c',
  ragged: 0,
  patches: 0,
  patchColors: ['#76634b', '#59604f', '#8a7455'],
  belt: '#4d3526',
  rope: false,
  gold: false,
  headwear: 'none',
  headColor: '#5b4b38',
  headAccent: '#c6b38c',
  held: 'none',
  heldColor: '#775032',
  heldAccent: '#b9c4c7',
  reach: false,
  bones: false,
});
