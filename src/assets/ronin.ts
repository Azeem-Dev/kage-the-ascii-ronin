import type { AsciiAsset, AssetOptions } from './types.ts';
import { GlyphShape } from './shapes.ts';

const DARK = ['#131b25', '#23303c', '#344652', '#52616a', '#77848a'];
const IVORY = ['#35444c', '#5f7175', '#859894', '#b7c3af', '#dce0c9', '#f0eed7'];
const INDIGO = ['#182532', '#2a4050', '#496375', '#6b8595', '#9ab0b8'];
const SKIN = ['#3b3831', '#615849', '#8a7e65', '#b9a98b', '#ddd0ae'];
const HAIR = ['#0b1017', '#17232c', '#293c48', '#41535d'];

function generate(o: AssetOptions) {
  const s = new GlyphShape(66, 90, o.seed);
  const gait = o.action === 'walk' ? Math.sin(o.time * 9) * 4 : 0;
  const cloth = o.variant === 1 ? INDIGO : IVORY;
  const bob = o.action === 'walk' ? Math.abs(Math.sin(o.time * 9)) : Math.sin(o.time * 2) * .3;
  // Rear leg, divided hakama and weighted sandals.
  s.polygon([[29, 55], [39, 56], [42 + gait, 77], [36 + gait, 82], [31 + gait, 77]], DARK, .8);
  s.ellipse(37 + gait, 81, 6, 2.2, DARK, 1.2);
  s.polygon([[20, 54], [32, 55], [29 - gait, 80], [22 - gait, 81], [21 - gait, 73]], INDIGO, .9);
  s.ellipse(23 - gait, 82, 6.5, 2, SKIN, .75);
  // Sweeping undercoat and asymmetrical robe tails.
  s.polygon([[20, 37], [39, 37], [45, 66 + gait * .2], [34, 64], [29, 57], [24, 68], [13, 64]], cloth, .9);
  // Bent rear arm, torso and wide near sleeve.
  s.polygon([[35, 25 + bob], [42, 27], [48, 42], [43, 47], [35, 35]], cloth, .68);
  s.ellipse(43, 46, 3, 4, SKIN, .85);
  s.ellipse(29, 34 + bob, 11, 16, cloth, 1.08);
  s.polygon([[20, 24 + bob], [27, 27], [22, 42], [18, 46], [10, 42], [13, 31]], cloth, 1.05);
  s.ellipse(14, 44, 3, 4, SKIN, .9);
  // Layered collar and diagonal lapel.
  s.polygon([[24, 23], [31, 29], [36, 23], [34, 32], [28, 37], [21, 27]], DARK, .9);
  s.line(23, 25, 32, 39, '#b7c3af', '\\');
  s.polygon([[19, 44], [39, 45], [39, 49], [19, 48]], ['#302e29', '#524a39', '#857252', '#b39a69'], .85, ':;=x#');
  s.ellipse(28, 47, 3, 2, SKIN, .8);
  // Neck, turned face, temple and topknot: no block sprite silhouette.
  s.ellipse(29, 22, 4, 5, SKIN, .8);
  s.ellipse(29, 15 + bob, 6.5, 8, SKIN, 1);
  s.ellipse(27, 12 + bob, 7, 8.5, HAIR, .95);
  s.polygon([[30, 12], [35, 13], [37, 17], [34, 19], [34, 23], [30, 22]], SKIN, .92);
  s.cell(34, 15, '-', '#d0cbb6');
  s.ellipse(25, 4, 3, 3, HAIR, 1.3);
  // Hair/headband strands use continuous chained motion with a fixed root.
  for (let strand = 0; strand < 4; strand++) for (let i = 0; i < 21; i++) {
    const x = 23 - i * .7 + Math.sin(o.time * 3 - i * .2) * i * .12;
    const y = 16 + strand * .8 + i * .22 + Math.sin(o.time * 2.5 - i * .25) * i * .12;
    s.cell(x, y, i % 4 === 0 ? '~' : '-', strand === 0 ? '#c7cebc' : '#71858b');
  }
  // Katana guard, scabbard and cold blade highlight.
  s.line(18, 48, 6, 72, '#554b38', '/');
  s.line(40, 45, 60, 16, '#809a9e', '/');
  s.line(41, 44, 61, 15, '#e1e7d2', '/');
  s.line(37, 43, 44, 46, '#b7a574', '=');
  return s.resizedFrame(82, 74, o.facing === 'left');
}

export const RONIN: AsciiAsset = {
  id: 'ronin', version: 2, name: 'Wandering ronin', category: 'Character',
  description: 'Shaded layered garments, articulated walk, moving hair and a drawn katana.',
  width: 82, height: 74, anchor: { x: 36, y: 68 },
  variants: ['Ivory', 'Indigo'], generate,
};
