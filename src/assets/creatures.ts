import { GlyphShape } from './shapes.ts';
import { noise, type AsciiAsset, type AssetOptions } from './types.ts';

function butterfly(options: AssetOptions, colors: readonly string[]) {
  const s = new GlyphShape(64, 48, options.seed);
  const opening = .3 + Math.abs(Math.sin(options.time * 5)) * .7;
  for (const side of [-1, 1]) {
    for (let y = 4; y < 43; y++) for (let x = 1; x < 63; x++) {
      const nx = (x - (32 + side * 12 * opening)) / (18 * opening);
      const upper = nx * nx + ((y - 16) / 13) ** 2;
      const lower = ((x - (32 + side * 9 * opening)) / (13 * opening)) ** 2 + ((y - 31) / 11) ** 2;
      const d = Math.min(upper, lower);
      if (d > 1 || side * (x - 32) < 1) continue;
      const n = noise(x, y, options.seed);
      const vein = Math.abs(Math.sin(Math.atan2(y - 24, x - 32) * 7)) < .14;
      const edge = d > .81;
      s.cell(x, y, edge ? '.' : vein ? '/' : n > .6 ? '*' : ':', edge ? '#adc0ce' : vein ? '#263a54' : colors[Math.floor(n * colors.length)]);
    }
  }
  s.ellipse(32, 24, 1.7, 12, ['#19282f', '#495b65', '#b4c3c4'], 1);
  s.line(32, 14, 27, 8, '#a5bcc7', '/'); s.line(32, 14, 37, 8, '#a5bcc7', '\\');
  return s.frame(options.facing === 'left');
}

function bird(options: AssetOptions, bat: boolean) {
  const s = new GlyphShape(60, 38, options.seed);
  const flap = Math.sin(options.time * (bat ? 8 : 5));
  const colors = bat ? options.variant ? ['#202539', '#3c4465', '#6c7c95', '#a9bed0'] : ['#1c2231', '#34354c', '#656075', '#b1a4ac'] : options.variant ? ['#202d3c', '#425d75', '#7997aa', '#c7d5d0'] : ['#242b2e', '#46575a', '#8ca09b', '#d6ddd0'];
  for (const side of [-1, 1]) {
    const wingY = 16 + flap * 9;
    s.polygon([[30, 17], [30 + side * 26, wingY - 8], [30 + side * 21, wingY + 2], [30 + side * 16, wingY + (bat ? 0 : 7)], [30 + side * 10, 25], [30 + side * 5, 21]], colors, .9, '.,:;x#');
    for (let i = 1; i <= 4; i++) s.line(30 + side * 3, 18, 30 + side * (9 + i * 4), wingY + i * 2, colors[2], side > 0 ? '/' : '\\');
  }
  s.ellipse(30, 21, 4, 9, colors, 1.1);
  s.ellipse(30, 12, 4, 4, colors, 1.1);
  if (bat) {
    s.polygon([[26, 11], [26, 5], [29, 9]], colors, .9);
    s.polygon([[31, 9], [34, 5], [34, 12]], colors, .9);
    s.cell(28, 12, '*', '#bb7176'); s.cell(32, 12, '*', '#bb7176');
  } else s.polygon([[29, 10], [30, 5], [33, 11]], ['#4c4b39', '#b9aa78'], 1);
  s.polygon([[27, 28], [25, 35], [30, 32], [35, 35], [33, 28]], colors, .8);
  return s.frame(options.facing === 'left');
}

const common = { version: 1, category: 'Creature' as const, width: 64, height: 48, anchor: { x: 32, y: 25 }, variants: ['Natural', 'Moonlit'] };
export const CREATURES: readonly AsciiAsset[] = [
  { ...common, id: 'butterfly-blue', name: 'Blue morpho', description: 'Blue veined wings with a pale patterned edge.', generate: o => butterfly(o, o.variant ? ['#72c6eb', '#4182bd', '#b4e7f0'] : ['#357fc0', '#52a6d3', '#99d4e4']) },
  { ...common, id: 'butterfly-pink', name: 'Rose butterfly', description: 'Pink veined wings and a slim articulated body.', generate: o => butterfly(o, o.variant ? ['#e4a0c7', '#ad598e', '#f0c4da'] : ['#b96395', '#d487b0', '#eab4d0']) },
  { ...common, id: 'butterfly-purple', name: 'Violet butterfly', description: 'Purple veined wings with a lilac edge.', generate: o => butterfly(o, o.variant ? ['#aa90de', '#7856b1', '#d0b8ee'] : ['#7960b0', '#a385cd', '#c0a6de']) },
  { ...common, id: 'bat', name: 'Crypt bat', description: 'Jointed membrane wings, pointed ears and muted red eyes.', width: 60, height: 38, anchor: { x: 30, y: 22 }, generate: o => bird(o, true) },
  { ...common, id: 'bird', name: 'Valley raven', description: 'Tapered feathered wings and an animated flight cycle.', width: 60, height: 38, anchor: { x: 30, y: 22 }, generate: o => bird(o, false) },
  { ...common, id: 'moth', name: 'Lantern moth', description: 'Small ivory moth with softly patterned wings.', generate: o => butterfly(o, o.variant ? ['#c5b6a1', '#e3d5bb', '#a5968a'] : ['#b1b4a3', '#dbd8bd', '#8e9c92']) },
];
