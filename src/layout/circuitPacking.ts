import type { ElkNode } from 'elkjs/lib/elk-api';

/** Preserve functional interiors, including wrapped units. Larger separators are
 * preferred only within the real budget; individual blocks remain a fallback. */
export function packCircuitUnits(id: string, units: ElkNode[][], width: number, height: number, inside: number, outside: number): ElkNode | undefined {
  if (!units.length || units.some(u => !u.length || u.some(b => !b.children || !Number.isFinite(b.width) || !Number.isFinite(b.height)))) return;
  const fits = (p: { node: ElkNode }) => p.node.width! <= width + 1e-6 && p.node.height! <= height + 1e-6;
  const rows = (blocks: ElkNode[], space: number) => {
    const children: ElkNode[] = [];
    let x = 0, y = 0, rowHeight = 0, usedWidth = 0, count = 1;
    for (const b of blocks) {
      if (x && x + b.width! > width) { x = 0; y += rowHeight + space; rowHeight = 0; count++; }
      children.push(...b.children!.map(c => ({ ...c, x: c.x! + x, y: c.y! + y })));
      usedWidth = Math.max(usedWidth, x + b.width!);
      rowHeight = Math.max(rowHeight, b.height!);
      x += b.width! + space;
    }
    return { node: { id, children, width: usedWidth, height: y + rowHeight }, rows: count };
  };
  const choose = (groups: ElkNode[]) => {
    const compact = rows(groups, inside), spacious = rows(groups, Math.max(inside, outside));
    if (fits(spacious) && (spacious.rows <= compact.rows || !fits(compact))) return spacious.node;
    if (fits(compact)) return compact.node;
  };
  // Each measured unit has its own row wrapping. Its envelope prevents unrelated
  // circuits from occupying the last row of the same functional region.
  const grouped = units.map(unit => rows(unit, inside).node);
  const preserved = choose(grouped);
  if (preserved) return preserved;
  // A tall wrapped region can waste otherwise usable neighbouring space. Retain
  // the earlier individual packing when neither preserved spacing fits.
  return choose(units.flatMap(unit => {
    const span = unit.reduce((sum, b) => sum + b.width!, 0) + inside * (unit.length - 1);
    return span <= width ? [rows(unit, inside).node] : unit;
  }));
}
