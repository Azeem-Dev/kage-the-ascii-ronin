import { noise, type AsciiAsset, type AsciiCell, type AssetOptions } from '../types.ts';
import { GlyphShape } from '../shapes.ts';
import { variation } from './treePrimitives.ts';

const PALETTES = [
  ['#3c5b3b', '#68804a', '#98a263', '#c0ba79'],
  ['#35523b', '#5e794c', '#8d9b61', '#b5ad72'],
  ['#665739', '#99804e', '#baa066', '#d4bf86'],
] as const;
const HEADS = [
  ['#6f7d48', '#a5a368'],
  ['#493b2b', '#79583a', '#aa7b4c'],
  ['#80765c', '#b2a68a', '#d0c5a7'],
] as const;

function generate(o: AssetOptions): AsciiCell[] {
  const s = new GlyphShape(120, 110, o.seed);
  const variant = o.variant % PALETTES.length;
  const palette = PALETTES[variant];
  const headPalette: readonly string[] = HEADS[variant];
  for (let i = 0; i < 23; i++) {
    const base = 19 + noise(i, 2, o.seed) * 82;
    const top = 16 + noise(i, 5, o.seed) * 48 + variation(i, o.seed, 7);
    const phase = noise(i, 8, o.seed) * Math.PI * 2;
    const amplitude = 3.2 + noise(i, 11, o.seed) * 4.2;
    const height = 104 - top;
    let previousX = base;
    let previousY = 104;
    for (let step = 1; step <= 9; step++) {
      const p = step / 9;
      const y = 104 - height * p;
      const x = base + Math.sin(o.time * 1.45 + phase + p * 1.8) * amplitude * p;
      s.line(previousX, previousY, x, y, palette[p > .68 ? 2 : 1], Math.abs(x - previousX) > 1.3 ? (x > previousX ? '/' : '\\') : '|');
      previousX = x;
      previousY = y;
    }
    if (variant === 1) {
      for (let h = 0; h < 9; h++) s.cell(previousX, top + h, h % 3 ? '=' : 'O', headPalette[h < 3 ? 2 : 1]);
      s.line(previousX, top - 2, previousX, top, palette[2], "'");
    } else if (variant === 2) {
      for (let h = 0; h < 7; h++) {
        const spread = h < 2 ? 1 : h < 5 ? 2 : 1;
        for (let dx = -spread; dx <= spread; dx++) if (noise(i + dx, h, o.seed) > .2) s.cell(previousX + dx, top + h, h % 2 ? ':' : ';', headPalette[h > 4 ? 2 : 1]);
      }
    } else {
      s.line(previousX, top + 4, previousX, top - 2, headPalette[1], "'");
      s.cell(previousX, top - 3, '.', palette[3]);
    }

    // Long blade leaves branch at different heights instead of marching in unison.
    for (let leaf = 0; leaf < 2; leaf++) {
      const p = .28 + leaf * .27 + noise(i, leaf + 20, o.seed) * .12;
      const rootY = 104 - height * p;
      const rootX = base + Math.sin(o.time * 1.45 + phase + p * 1.8) * amplitude * p;
      const side = (i + leaf) % 2 ? 1 : -1;
      const length = 13 + noise(i, leaf + 30, o.seed) * 15;
      const tipX = rootX + side * length + Math.sin(o.time * 1.8 + phase + leaf) * 2.5;
      const tipY = rootY - 9 - noise(i, leaf + 40, o.seed) * 12;
      s.line(rootX, rootY, tipX, tipY, palette[leaf ? 2 : 1], side > 0 ? '/' : '\\');
      s.cell(tipX, tipY, "'", palette[3]);
    }
  }
  return s.frame(o.facing === 'left');
}

export const REEDS: AsciiAsset = {
  id: 'reeds', version: 1, name: 'Riverbank reeds', category: 'Vegetation',
  description: 'Tall staggered reed stems, blade leaves, green tips, cattails and dry heads.',
  width: 120, height: 110, anchor: { x: 60, y: 104 },
  variants: ['River reeds', 'Cattails', 'Dry reeds'],
  footprint: [{ x: 0, y: -1, radius: 3 }],
  generate,
};
