import type { Rect, Point } from './types';
import { contains, overlaps, right, bottom } from './rect';
/** Maximal free rectangles. No symbol scaling and no relaxation of protected obstacles. */
export class SheetPacker {
  private free: Rect[];
  constructor(
    area: Rect,
    obstacles: Rect[],
    private gap: number,
  ) {
    this.free = [area];
    for (const r of obstacles) this.reserve(r);
  }
  place(width: number, height: number, preferred: Point, minimalChange = false): Point | undefined {
    const choices = this.free
      .filter((r) => r.width + 1e-6 >= width && r.height + 1e-6 >= height)
      .map((r) => ({
        x: r.x,
        y: r.y,
        short: Math.min(r.width - width, r.height - height),
        long: Math.max(r.width - width, r.height - height),
      }));
    const distance = (p: Point) => Math.abs(p.x - preferred.x) + Math.abs(p.y - preferred.y);
    choices.sort(
      (a, b) =>
        (minimalChange ? distance(a) - distance(b) : 0) ||
        a.short - b.short ||
        a.long - b.long ||
        distance(a) - distance(b) ||
        a.y - b.y ||
        a.x - b.x,
    );
    const result = choices[0];
    if (!result) return;
    this.reserve({ ...result, width, height });
    return { x: result.x, y: result.y };
  }
  private reserve(rect: Rect) {
    const used = {
      x: rect.x - this.gap / 2,
      y: rect.y - this.gap / 2,
      width: rect.width + this.gap,
      height: rect.height + this.gap,
    };
    const next: Rect[] = [];
    for (const r of this.free) {
      if (!overlaps(r, used)) {
        next.push(r);
        continue;
      }
      if (used.x > r.x) next.push({ ...r, width: used.x - r.x });
      if (right(used) < right(r))
        next.push({ ...r, x: right(used), width: right(r) - right(used) });
      if (used.y > r.y) next.push({ ...r, height: used.y - r.y });
      if (bottom(used) < bottom(r))
        next.push({ ...r, y: bottom(used), height: bottom(r) - bottom(used) });
    }
    this.free = next.filter(
      (r, i) =>
        r.width > 1e-6 &&
        r.height > 1e-6 &&
        !next.some(
          (other, j) =>
            j !== i &&
            contains(other, r) &&
            (other.width * other.height > r.width * r.height + 1e-6 || j < i),
        ),
    );
  }
}
