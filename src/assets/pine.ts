import { noise, type AsciiAsset, type AssetOptions, type AsciiCell } from './types.ts';
import { GlyphShape } from './shapes.ts';

function generate(o: AssetOptions): AsciiCell[] {
  const s = new GlyphShape(110, 110, o.seed);
  const bark = ['#212726', '#3d453c', '#626853', '#939079'];
  // Bent trunk and branching silhouette, independent from world placement.
  s.polygon([[51, 104], [59, 104], [56, 76], [50, 53], [54, 25], [49, 28], [44, 55], [49, 77]], bark, .8, '.:;|x#');
  for (const [x, y, tipX, tipY] of [[50, 70, 19, 56], [49, 52, 82, 38], [51, 38, 38, 20], [53, 76, 91, 67]]) {
    s.line(x, y, tipX, tipY, '#656b55', '/');
    s.line(x, y + 1, tipX, tipY + 1, '#303d34', '-');
  }
  const palette = o.variant === 1 ? ['#192b31', '#28464a', '#42635f', '#7a9281'] : ['#142b24', '#25483a', '#426750', '#789171'];
  const clusters = [
    [34, 21, 23, 11], [54, 16, 21, 12], [60, 28, 26, 12],
    [22, 47, 21, 12], [42, 43, 25, 15], [77, 37, 25, 14], [92, 48, 16, 12],
    [27, 58, 22, 14], [49, 61, 24, 13], [81, 64, 25, 13],
  ];
  for (let k = 0; k < clusters.length; k++) {
    const [cx, cy, rx, ry] = clusters[k];
    const sway = Math.sin(o.time * 1.2 + k * .5) * 1.3;
    for (let y = Math.floor(cy - ry); y <= cy + ry; y++) for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
      const n = noise(x, y, o.seed + k);
      const nx = (x - cx) / rx; const ny = (y - cy) / ry;
      if (nx * nx + ny * ny > .8 + n * .38 || n < .08) continue;
      const light = .45 - ny * .28 - nx * .14 + n * .2;
      const shade = Math.max(0, Math.min(3, Math.floor(light * 4)));
      s.cell(x + sway, y, ["'", '/', '\\', ';', '*', '%'][Math.floor(n * 6)], palette[shade]);
    }
  }
  return s.frame();
}

export const PINE: AsciiAsset = { id: 'pine', version: 2, name: 'Mountain pine', category: 'Vegetation', description: 'Bent trunk, branching canopy, clustered needles and wind.', width: 110, height: 110, anchor: { x: 54, y: 104 }, variants: ['Forest', 'Moonlit'], generate };
