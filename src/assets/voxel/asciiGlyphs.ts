/** Shared, deterministic glyph selection for rasterised and voxel assets.
 *
 * Brightness alone turns smooth model shading into horizontal bands. Keep a
 * coarse density ramp for broad surfaces, then use the local screen gradient to
 * choose a contour glyph around limbs, cloth folds and held items. A fixed 4x4
 * ordered dither breaks up banding without per-frame noise.
 */

const CORE = [':', ';', 'o', 'x', '#'] as const;
const BAYER = [0, 8, 2, 10, 14, 6, 12, 4, 3, 11, 1, 9, 15, 7, 13, 5] as const;
const WEIGHTS = new Map<string, number>();
for (const [chars, weight] of [
  [' ', 0], [".,'`", .14], [':;-_~^"', .24], ['/\\|!il()[]{}<>', .34],
  ['+=rcvt?*', .44], ['xoszunjfy7', .52], ['aekhdbpqgwmXYVLTZ', .62],
  ['O0QCGSUDAKHNRP%&$', .74], ['#@MWB8', .88],
] as const) for (const char of chars) WEIGHTS.set(char, weight);

const clamp01 = (v: number) => v < 0 ? 0 : v > 1 ? 1 : v;

export function glyphWeight(glyph: string): number {
  return WEIGHTS.get(glyph) ?? .55;
}

/** `gradientX/Y` are luminance differences in the -1..1 range. */
export function chooseGlyph(
  x: number,
  y: number,
  luminance: number,
  density = luminance,
  gradientX = 0,
  gradientY = 0,
  boundary = 0,
  emissive = false,
): string {
  if (emissive) return '@';
  const d = clamp01(density);
  const dither = (BAYER[(y & 3) * 4 + (x & 3)] / 16 - .5) * .8;
  const level = Math.max(0, Math.min(CORE.length - 1, Math.floor(d * (CORE.length - 1) + .5 + dither)));
  const magnitude = Math.hypot(gradientX, gradientY);
  if (magnitude < .16 || (boundary === 0 && magnitude < .42)) return CORE[level];

  const ax = Math.abs(gradientX);
  const ay = Math.abs(gradientY);
  if (ay > ax * 1.65) return d < .36 ? '!' : '|';
  if (ax > ay * 1.65) return d < .4 ? '-' : d < .68 ? '=' : '+';
  const diagonal = gradientX * gradientY >= 0 ? '\\' : '/';
  return diagonal;
}
