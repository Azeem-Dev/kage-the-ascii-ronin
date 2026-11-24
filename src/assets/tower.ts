import { GlyphShape } from './shapes.ts';
import { noise, type AsciiAsset } from './types.ts';

export const TOWER: AsciiAsset = {
  id: 'ruined-tower', version: 1, name: 'Ruined river watchtower', category: 'Prop',
  width: 120, height: 164, anchor: { x: 57, y: 149 }, variants: ['Moonstone', 'Warm granite'],
  description: 'Tall curved masonry, visible upper platform, broken parapets, moss and stone approach stairs.',
  generate: options => {
    const s = new GlyphShape(120, 164, options.seed);
    const stone = options.variant ? ['#242f32', '#414a42', '#6d725c', '#a5a48a'] : ['#1b2935', '#344958', '#607b87', '#a3b5b5'];
    s.ellipse(56, 127, 44, 17, stone, .7);
    for (let y = 37; y < 132; y++) for (let x = 13; x < 100; x++) {
      const n = noise(x, y, options.seed);
      const nx = (x - 56) / 44;
      const shade = Math.max(0, Math.min(3, Math.floor((.7 - nx * .24 - Math.abs(nx) * .25 + n * .12) * 4)));
      const course = (y + Math.round((1 - nx * nx) * 7)) % 10;
      const joint = (x + Math.floor(y / 10) % 2 * 7) % 15 === 0;
      s.cell(x, y, course === 0 ? '=' : joint ? ':' : ['.', ':', 'x', 'O', '#'][Math.floor(n * 5)], course === 0 || joint ? stone[0] : stone[shade]);
      if ((x < 24 || x > 88) && n > .58 && y > 52) s.cell(x, y, n > .85 ? '&' : ';', '#4a6950');
    }
    // A top plane and parapet read separately from the long vertical wall.
    s.ellipse(56, 35, 46, 20, stone, 1);
    s.ellipse(56, 32, 36, 13, ['#22333b', '#41575e', '#718987', '#aab9aa'], .8);
    for (const [x, y] of [[13, 30], [24, 17], [43, 11], [64, 11], [83, 19], [94, 32], [77, 45], [49, 49], [23, 44]]) {
      s.polygon([[x - 6, y - 14], [x + 6, y - 14], [x + 6, y + 3], [x - 6, y + 3]], stone, .85);
      s.line(x - 6, y - 14, x + 6, y - 14, stone[3], '=');
    }
    // Deep arched windows break the mass without bright decorative outlines.
    for (const [x, y] of [[36, 65], [72, 83], [44, 112]]) {
      s.ellipse(x, y, 5, 7, ['#0b1119', '#14232e'], .6);
      s.polygon([[x - 5, y], [x + 5, y], [x + 5, y + 12], [x - 5, y + 12]], ['#0b1119', '#14232e'], .55);
      s.line(x - 6, y + 13, x + 6, y + 13, stone[2], '-');
    }
    for (let i = 0; i < 7; i++) {
      const x = 71 + i * 3; const y = 135 + i * 3;
      s.polygon([[x - 14, y], [x + 5, y - 5], [x + 17, y + 1], [x - 2, y + 7]], stone, .9);
      s.line(x - 14, y, x - 2, y + 7, stone[3], '=');
    }
    return s.frame(options.facing === 'left');
  },
};
