import { GlyphShape } from './shapes.ts';
import type { AsciiAsset, AssetOptions } from './types.ts';

function sword(options: AssetOptions, kind: number) {
  const s = new GlyphShape(28, 64, options.seed);
  const steel = options.variant ? ['#263347', '#4b6684', '#91a9c3', '#e4e8d5'] : ['#293b43', '#596d74', '#a9babc', '#e4e8d5'];
  const w = kind === 1 ? 4 : kind === 2 ? 1.5 : 2.5;
  const tip = kind === 3 ? 21 : 3;
  const curve = kind === 4 ? 5 : 0;
  s.polygon([[14 - w, 44], [14 + w, 44], [14 + w + curve, tip + 8], [14 + curve, tip], [14 - w + curve, tip + 8]], steel, 1.1, ':;+=x#');
  s.line(14 + curve, tip + 3, 14, 43, '#d5e0d8', '|');
  s.polygon([[6, 45], [22, 45], [24, 48], [4, 48]], ['#3d382d', '#85714b', '#c8b07c'], 1);
  s.polygon([[12, 48], [16, 48], [16, 59], [12, 59]], ['#272b2d', '#555044', '#8e8164'], .9, '|=x');
  s.ellipse(14, 60, 3, 2, ['#5c655e', '#b0bba6'], 1);
  s.cell(14, 44, '*', '#b3c9d0');
  return s.frame(options.facing === 'left');
}

export const EQUIPMENT: readonly AsciiAsset[] = ['Longsword', 'Greatsword', 'Rapier', 'Dagger', 'Curved sabre'].map((name, kind) => ({
  id: ['sword-long', 'sword-great', 'sword-rapier', 'sword-dagger', 'sword-sabre'][kind], name, version: 1, category: 'Equipment', width: 28, height: 64, anchor: { x: 14, y: 61 }, description: `${name} with a shaded steel blade, brass guard and leather grip.`, variants: ['Steel', 'Moonsteel'], generate: options => sword(options, kind),
}));
