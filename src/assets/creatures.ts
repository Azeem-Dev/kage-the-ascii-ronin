import { GlyphShape } from './shapes.ts';
import { noise, type AsciiAsset, type AsciiCell, type AssetOptions } from './types.ts';

type PaletteSet = readonly (readonly string[])[];

function actionOf(options: AssetOptions): string {
  return (options as AssetOptions & { action: string }).action;
}

function butterfly(options: AssetOptions, sets: PaletteSet, moth = false): AsciiCell[] {
  const s = new GlyphShape(64, 48, options.seed);
  const colors = sets[options.variant % sets.length];
  const beat = Math.sin(options.time * (moth ? 7 : 10) + (options.seed % 13) * .09);
  const open = moth ? .48 + Math.abs(beat) * .52 : .24 + (.5 + .5 * beat) * .76;
  const cx = 32, cy = 23;
  const edge = ['#d8ddd0', '#eee5cf', '#b9c8c6'][options.variant % 3];
  for (const side of [-1, 1]) {
    const upper: readonly (readonly [number, number])[] = [
      [cx, cy - 4], [cx + side * 4, cy - 10], [cx + side * 18 * open, 6 + (1 - open) * 7],
      [cx + side * 28 * open, 11 + (1 - open) * 5], [cx + side * 24 * open, 21],
      [cx + side * 11, cy + 1],
    ];
    const lower: readonly (readonly [number, number])[] = [
      [cx, cy], [cx + side * 12 * open, cy + 3], [cx + side * (moth ? 24 : 21) * open, 30],
      [cx + side * 16 * open, 39 + (1 - open) * 4], [cx + side * 7 * open, cy + 14], [cx, cy + 6],
    ];
    // Upper and lower wings are independently articulated pieces. Their outlines
    // close and open; no row/column of the body is sheared to imply a wingbeat.
    s.polygon(upper, colors, .93, moth ? '.,:;+=x#' : '.,:;+=xO#');
    s.polygon(lower, [colors[0], colors[1], colors[2] ?? colors[1], colors[3] ?? colors[2]], .82, '.,:;+=x#');
    s.line(cx, cy - 2, cx + side * 25 * open, 12 + (1 - open) * 4, colors[0], side > 0 ? '\\' : '/');
    s.line(cx + side * 2, cy, cx + side * 18 * open, 34, colors[0], side > 0 ? '\\' : '/');
    s.line(cx + side * 5, cy - 6, cx + side * 20 * open, 18, edge, side > 0 ? '/' : '\\');
    for (let i = 0; i < upper.length - 1; i++) {
      s.line(upper[i][0], upper[i][1], upper[i + 1][0], upper[i + 1][1], edge, '.');
      s.line(lower[i][0], lower[i][1], lower[i + 1][0], lower[i + 1][1], edge, '.');
    }
    const spotX = cx + side * 15 * open, spotY = 15 + (1 - open) * 3;
    if (noise(side, 4, options.seed) > .18) {
      s.ellipse(spotX, spotY, moth ? 3.2 : 2.5, moth ? 4 : 3, [colors[0], colors[3] ?? colors[2], edge], .92, '.:;*x#');
      s.cell(spotX, spotY, 'o', colors[0]);
    }
    if (noise(side, 8, options.seed) > .35) s.ellipse(cx + side * 12 * open, 31, 2.2, 2.6, [colors[1], colors[3] ?? colors[2], edge], .86, '.:;*#');
    if (moth) for (let i = 0; i < 5; i++) {
      s.line(cx + side * 8, cy + i * 2, cx + side * (20 + i % 2 * 3) * open, 30 + i * 2, colors[1], side > 0 ? '\\' : '/');
    }
  }
  s.ellipse(cx, cy + 1, moth ? 2.3 : 1.7, moth ? 13 : 11, ['#18282c', '#40535a', '#8fa39d', '#c1cbc0'], 1, '.:;+=x#');
  s.ellipse(cx, cy - 10, moth ? 3 : 2.4, 3, colors, .9);
  const antenna = Math.sin(options.time * 3 + options.seed) * .8;
  s.line(cx, cy - 12, cx - 5, cy - 17 + antenna, '#bdc9b8', '/');
  s.line(cx, cy - 12, cx + 5, cy - 17 - antenna, '#bdc9b8', '\\');
  return s.frame(options.facing === 'left');
}

function bird(options: AssetOptions, bat: boolean): AsciiCell[] {
  const s = new GlyphShape(64, 48, options.seed);
  const action = actionOf(options);
  const speed = action === 'idle' ? 2.2 : action === 'walk' ? 6 : 8;
  const flap = Math.sin(options.time * speed + options.seed % 7) * (action === 'idle' ? 5 : 12);
  const colors = bat
    ? [['#171d29', '#30384e', '#57677e', '#9daabd'], ['#272331', '#4c4057', '#7b667c', '#b19aa7'], ['#202c2d', '#3d5452', '#6f8278', '#afbdab']][options.variant % 3]
    : [['#20282d', '#3e4d53', '#71878a', '#b8c5bc'], ['#253342', '#48647a', '#7e9dac', '#c6d5d0'], ['#3a312a', '#6c5947', '#a28b68', '#d4c29e']][options.variant % 3];
  for (const side of [-1, 1]) {
    const upper: readonly (readonly [number, number])[] = bat
      ? [[30 + side * 3, 20], [30 + side * 12, 10 + flap * .4], [30 + side * 28, 5 + flap], [30 + side * 22, 18 + flap * .4], [30 + side * 17, 17], [30 + side * 20, 25], [30 + side * 11, 23], [30 + side * 5, 27]]
      : [[30 + side * 3, 20], [30 + side * 12, 11 + flap * .4], [30 + side * 27, 8 + flap], [30 + side * 21, 20 + flap * .4], [30 + side * 10, 26]];
    const lower: readonly (readonly [number, number])[] = bat
      ? [[30 + side * 4, 23], [30 + side * 18, 25 - flap * .3], [30 + side * 25, 34 - flap], [30 + side * 17, 31], [30 + side * 13, 36], [30 + side * 7, 29]]
      : [[30 + side * 4, 23], [30 + side * 14, 28 - flap * .25], [30 + side * 22, 35 - flap], [30 + side * 10, 31], [30 + side * 4, 28]];
    s.polygon(upper, colors, .9, '.,:;|x#');
    s.polygon(lower, [colors[0], colors[1], colors[2], colors[3]], .76, '.,:;|x#');
    if (bat) {
      s.line(30 + side * 4, 21, 30 + side * 26, 7 + flap, colors[2], side > 0 ? '\\' : '/');
      s.line(30 + side * 5, 23, 30 + side * 19, 24, colors[2], side > 0 ? '\\' : '/');
      s.line(30 + side * 5, 24, 30 + side * 23, 33 - flap, colors[2], side > 0 ? '/' : '\\');
    } else {
      for (let i = 1; i <= 4; i++) s.line(30 + side * 4, 21, 30 + side * (8 + i * 4), 10 + i * 2 + flap * .55, colors[2], side > 0 ? '\\' : '/');
    }
  }
  s.ellipse(31, 24, bat ? 4 : 5, bat ? 10 : 9, colors, .95);
  s.ellipse(33, 14, 4.5, 4.5, colors, .95);
  if (bat) {
    s.polygon([[29, 11], [27, 3], [32, 9]], colors, .9);
    s.polygon([[34, 9], [39, 3], [39, 12]], colors, .9);
    s.cell(31, 13, '*', '#d17d83'); s.cell(36, 13, '*', '#d17d83');
    s.polygon([[31, 31], [29, 39], [33, 36], [36, 40], [35, 30]], colors, .8);
  } else {
    s.polygon([[31, 11], [32, 4], [36, 12]], colors, .9);
    s.polygon([[37, 14], [45, 16], [37, 18]], ['#4e4637', '#a6966e', '#d0bf92'], .94);
    s.cell(36, 12, 'O', '#11191d');
    s.polygon([[27, 31], [16, 38], [23, 36], [18, 42], [31, 35]], colors, .84);
  }
  return s.frame(options.facing === 'left');
}

const BLUE: PaletteSet = [
  ['#1e5b9b', '#347fc0', '#72bce0', '#bce8ed'],
  ['#176b83', '#2b9ab2', '#70d2d2', '#c0f0df'],
  ['#263b78', '#4555ad', '#8494dd', '#c2c8f2'],
  ['#426c86', '#75a2b8', '#b7d6d6', '#f1ead2'],
];
const PINK: PaletteSet = [
  ['#8f3f70', '#c26496', '#e79cbd', '#f6ccdc'],
  ['#a85d46', '#df8b65', '#f4bb91', '#f9dec0'],
  ['#762c68', '#ad3f91', '#dc70bb', '#f4b4dd'],
  ['#9a765e', '#c6a17e', '#e5c9a6', '#f4e5cd'],
];
const PURPLE: PaletteSet = [
  ['#503886', '#7856ad', '#aa86d4', '#d4bde9'],
  ['#765087', '#a271b5', '#cba0d3', '#ead0e7'],
  ['#343a7c', '#575da8', '#8e8ed4', '#c4c4ee'],
  ['#4c7359', '#72a06e', '#a8c78d', '#dde4b9'],
];
const MOTH: PaletteSet = [
  ['#77765f', '#aaa184', '#d4c8a6', '#ece0c3'],
  ['#6d655d', '#9c8c7b', '#c9b69b', '#e7d6bb'],
  ['#526b63', '#809589', '#b4c1a8', '#dedbc2'],
];

export const CREATURES: readonly AsciiAsset[] = [
  { id: 'butterfly-blue', name: 'Blue morpho', version: 2, category: 'Creature', description: 'Four blue colour forms with articulated upper/lower wings, moving veins and pale patterned edges.', width: 64, height: 48, anchor: { x: 32, y: 25 }, variants: ['Azure', 'Lagoon', 'Midnight', 'Clouded blue'], generate: o => butterfly(o, BLUE) },
  { id: 'butterfly-pink', name: 'Rose butterfly', version: 2, category: 'Creature', description: 'Four rose colour forms with independently posed wings and seed-placed eyespots.', width: 64, height: 48, anchor: { x: 32, y: 25 }, variants: ['Rose', 'Peach', 'Magenta', 'Sand'], generate: o => butterfly(o, PINK) },
  { id: 'butterfly-purple', name: 'Violet butterfly', version: 2, category: 'Creature', description: 'Four violet colour forms with a clear wingbeat cycle and contrasting vein lines.', width: 64, height: 48, anchor: { x: 32, y: 25 }, variants: ['Violet', 'Lilac', 'Indigo', 'Meadow'], generate: o => butterfly(o, PURPLE) },
  { id: 'bat', name: 'Crypt bat', version: 2, category: 'Creature', description: 'Jointed scalloped membrane wings, pointed ears, muted red eyes and three colour forms.', width: 64, height: 48, anchor: { x: 32, y: 24 }, variants: ['Night', 'Dusk', 'Cave'], generate: o => bird(o, true) },
  { id: 'bird', name: 'Valley raven', version: 2, category: 'Creature', description: 'Tapered feathered wings with separate upper/lower poses for gliding, flapping and flight.', width: 64, height: 48, anchor: { x: 32, y: 24 }, variants: ['Valley', 'Blue raven', 'Tawny'], generate: o => bird(o, false) },
  { id: 'moth', name: 'Lantern moth', version: 2, category: 'Creature', description: 'Broad ivory moth with feathered wings, articulated wingbeats and a seed-varied abdomen.', width: 64, height: 48, anchor: { x: 32, y: 25 }, variants: ['Ivory', 'Dusk', 'Sage'], generate: o => butterfly(o, MOTH, true) },
];
