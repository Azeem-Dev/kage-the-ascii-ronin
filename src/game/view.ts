/** World ↔ screen projection. The world (collisions, roads, regions) is always
 * top-down x/y. The screen is either the same (top-down) or isometric.
 *
 * Isometric: screenX = wx - wy, screenY = (wx + wy) / 3.
 * With 4×6 px cells this gives the classic 2:1 diamond in pixels
 * (one world unit along +x moves 4 px right and 2 px down). Sprites keep their
 * own upright art: 1 sprite unit = 1 cell, standing on their projected ground point. */

/** Isometric is the default view; `?view=top` keeps the old top-down one. */
export const ISO = new URLSearchParams(location.search).get('view') !== 'top';

const K = 1 / 3;

export function toScreenX(wx: number, wy: number): number { return ISO ? wx - wy : wx; }
export function toScreenY(wx: number, wy: number): number { return ISO ? (wx + wy) * K : wy; }
export function toWorldX(sx: number, sy: number): number { return ISO ? (sx + sy / K) / 2 : sx; }
export function toWorldY(sx: number, sy: number): number { return ISO ? (sy / K - sx) / 2 : sy; }

/** Screen-direction input (W = up the screen) as a world direction. */
export function inputToWorld(mx: number, my: number): [number, number] {
  if (!ISO) return [mx, my];
  // Screen up (0,-1) is world (-1,-1); screen right (1,0) is world (1,-1).
  // (The first version had the signs of `my` flipped, so W walked down the screen.)
  return [mx + my, my - mx];
}

/** World-space bounding box of a screen-space view rectangle. */
export function worldBounds(sx: number, sy: number, sw: number, sh: number): { x: number; y: number; w: number; h: number } {
  if (!ISO) return { x: sx, y: sy, w: sw, h: sh };
  const xs = [toWorldX(sx, sy), toWorldX(sx + sw, sy), toWorldX(sx, sy + sh), toWorldX(sx + sw, sy + sh)];
  const ys = [toWorldY(sx, sy), toWorldY(sx + sw, sy), toWorldY(sx, sy + sh), toWorldY(sx + sw, sy + sh)];
  const x = Math.min(...xs); const y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}
