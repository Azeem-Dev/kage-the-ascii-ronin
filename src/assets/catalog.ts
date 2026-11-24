import { RONIN } from './ronin.ts';
import { PINE } from './pine.ts';
import { ROCK } from './rock.ts';
import { HORSE } from './horse.ts';
import { noise, type AsciiAsset, type AsciiCell, type AssetOptions } from './types.ts';

function grass(o: AssetOptions): AsciiCell[] {
  const cells: AsciiCell[] = [];
  const palette = [['#344f40', '#547659', '#8c9c6a'], ['#344951', '#557880', '#8ca6a2'], ['#625939', '#918350', '#bfb27b']][o.variant % 3];
  for (let y = 5; y < 39; y++) for (let x = 3; x < 77; x++) {
    const n = noise(x, y, o.seed);
    const cluster = noise(Math.floor(x / 8), Math.floor(y / 5), o.seed);
    if (n < .45 + cluster * .25) continue;
    const wind = Math.sin(o.time * 2 + x * .12 + y * .2);
    const glyph = wind > .35 ? '/' : wind < -.35 ? '\\' : '|';
    cells.push({ x, y, glyph: n > .96 ? '*' : glyph, color: palette[n > .9 ? 2 : n > .7 ? 1 : 0] });
    if (n > .8 && y > 5) cells.push({ x: x + (wind > 0 ? 1 : -1), y: y - 1, glyph: "'", color: palette[1] });
  }
  return cells;
}

function water(o: AssetOptions): AsciiCell[] {
  const cells: AsciiCell[] = [];
  const palettes = [['#294b5c', '#50788b', '#9eafb0'], ['#294e47', '#4e7d6e', '#adc4ae'], ['#3a435c', '#686d8c', '#bec1d2']];
  const palette = palettes[o.variant % 3];
  for (let y = 3; y < 39; y++) for (let x = 3; x < 77; x++) {
    if (((x - 40) / 37) ** 2 + ((y - 21) / 18) ** 2 > 1) continue;
    const wave = Math.sin(x * .23 + y * .4 - o.time * 2) + Math.sin(x * .09 - y * .35 + o.time * 1.2);
    const n = noise(x, y, o.seed);
    if (wave < -.9 && n < .5) continue;
    cells.push({ x, y, glyph: wave > 1.35 ? '~' : wave > .5 ? '-' : n > .6 ? ',' : '.', color: palette[wave > 1.35 ? 2 : wave > .2 ? 1 : 0] });
  }
  // Concentric wake is a layer of the same cell format, not a pixel effect.
  const radius = (o.time * 5) % 17;
  if (radius > 1) for (let i = 0; i < 90; i++) {
    const a = i * Math.PI * 2 / 90;
    cells.push({ x: Math.round(40 + Math.cos(a) * radius * 1.7), y: Math.round(21 + Math.sin(a) * radius * .5), glyph: i % 3 ? '-' : '~', color: palette[2] });
  }
  return cells;
}

export const ASSETS: readonly AsciiAsset[] = [
  RONIN,
  PINE,
  ROCK,
  HORSE,
  { id: 'grass', version: 1, name: 'Wind meadow', category: 'Vegetation', description: 'Reusable patch with stable seeded distribution and a travelling wind field.', width: 80, height: 42, anchor: { x: 40, y: 38 }, variants: ['Meadow', 'Blue grass', 'Dry grass'], generate: grass },
  { id: 'water', version: 1, name: 'Quiet water', category: 'Terrain', description: 'Layered wave bands and an expanding wake, rendered entirely as glyph cells.', width: 80, height: 42, anchor: { x: 40, y: 38 }, variants: ['River', 'Jade pond', 'Night pool'], generate: water },
];
