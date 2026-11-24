import { GlyphShape } from './shapes.ts';
import type { AsciiAsset, AssetOptions } from './types.ts';

function prop(options: AssetOptions, kind: number) {
  const s = new GlyphShape(96, 80, options.seed);
  const stone = options.variant ? ['#202735', '#3a455d', '#68718a', '#9da4ba'] : ['#232f35', '#42545b', '#71858b', '#a7b6b4'];
  const wood = ['#262f2a', '#4c5140', '#7a7958', '#aaa17b'];
  if (kind === 0) {
    s.polygon([[10, 70], [46, 12], [86, 68]], ['#203c38', '#42655a', '#759480', '#aab59a'], .9, '.,:;x#');
    s.polygon([[46, 18], [66, 69], [31, 69]], ['#0c151d', '#14252d', '#2a3e43'], .7);
    s.line(46, 12, 46, 71, '#b1aa8a', '|');
    s.line(10, 70, 46, 12, '#9ca98c', '/');
    s.line(46, 12, 86, 68, '#758775', '\\');
  } else if (kind === 1) {
    s.polygon([[10, 73], [10, 22], [20, 22], [20, 72]], stone, .8);
    s.polygon([[76, 73], [76, 22], [86, 22], [86, 73]], stone, .7);
    for (let i = 0; i < 11; i++) {
      const angle = Math.PI + i * Math.PI / 10;
      const x = 48 + Math.cos(angle) * 33; const y = 30 + Math.sin(angle) * 25;
      s.ellipse(x, y, 7, 6, stone, .9);
    }
    s.polygon([[22, 73], [22, 31], [35, 13], [61, 13], [74, 31], [74, 73]], ['#0a111b', '#17212f', '#2e3447'], .55);
    for (let x = 28; x < 74; x += 8) s.line(x, 31, x, 72, '#72828a', '|');
    s.line(25, 43, 74, 43, '#7e9094', '=');
  } else if (kind === 2) {
    s.polygon([[25, 67], [27, 20], [39, 9], [57, 9], [69, 20], [71, 67]], stone, .92);
    s.line(48, 22, 48, 46, '#a3b1af', '|'); s.line(39, 31, 57, 31, '#a3b1af', '-');
    s.polygon([[17, 68], [78, 68], [82, 73], [13, 73]], stone, .7);
  } else if (kind === 3) {
    s.polygon([[35, 64], [39, 35], [57, 35], [61, 64]], wood, .8);
    s.polygon([[13, 31], [79, 31], [91, 22], [88, 37], [64, 44], [32, 44]], stone, .95);
    s.line(25, 30, 79, 30, '#c4cfc3', '-');
    s.polygon([[27, 66], [70, 66], [75, 72], [22, 72]], wood, .7);
  } else {
    s.polygon([[41, 69], [43, 24], [50, 24], [52, 69]], wood, .85);
    s.ellipse(47, 23, 10, 16, options.variant ? ['#583d55', '#a26c94', '#e7bbd3'] : ['#59452c', '#ae8b49', '#edd29a'], 1.15, '.:;*x#');
    s.line(37, 13, 57, 13, '#8f9b88', '-');
  }
  return s.frame(options.facing === 'left');
}

export const PROPS: readonly AsciiAsset[] = ['Ranger tent', 'Crypt arch', 'Gravestone', 'Forge anvil', 'Road lantern'].map((name, kind) => ({
  id: ['tent', 'crypt-arch', 'gravestone', 'anvil', 'lantern'][kind], name, version: 1, category: 'Prop', width: 96, height: 80, anchor: { x: 48, y: 72 }, description: `${name}, authored from shaded glyph shapes with an explicit ground anchor.`, variants: ['Natural', 'Moonlit'], generate: options => prop(options, kind),
}));
