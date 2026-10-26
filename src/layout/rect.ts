import type { Rect } from './types';
export const right = (r: Rect) => r.x + r.width,
  bottom = (r: Rect) => r.y + r.height;
export const contains = (a: Rect, b: Rect, e = 1e-6) =>
  b.x >= a.x - e && b.y >= a.y - e && right(b) <= right(a) + e && bottom(b) <= bottom(a) + e;
export const overlaps = (a: Rect, b: Rect, gap = 0) =>
  Math.min(right(a), right(b)) - Math.max(a.x, b.x) > -gap + 1e-6 &&
  Math.min(bottom(a), bottom(b)) - Math.max(a.y, b.y) > -gap + 1e-6;
export const union = (rs: Rect[]): Rect => {
  const x = Math.min(...rs.map((r) => r.x)),
    y = Math.min(...rs.map((r) => r.y));
  return { x, y, width: Math.max(...rs.map(right)) - x, height: Math.max(...rs.map(bottom)) - y };
};
export const translate = (r: Rect, dx: number, dy: number): Rect => ({
  ...r,
  x: r.x + dx,
  y: r.y + dy,
});
