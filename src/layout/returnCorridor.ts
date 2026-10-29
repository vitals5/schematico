import type { LayoutSnapshot, LayoutEdge, LayoutPin, Point } from './types';
import { union, right, bottom } from './rect';

/** Geometric hint for long same-facing ties. This never infers current direction
 * or conductivity from labels and never changes the edge's physical endpoints. */
export function returnCorridor(s: LayoutSnapshot, e: LayoutEdge, a: LayoutPin, b: LayoutPin, clearance: number) {
    if (a.direction !== b.direction || e.from.componentId === e.to.componentId) return;
    const vertical = a.direction === 'top' || a.direction === 'bottom';
    const along = (p: Point) => vertical ? p.y : p.x;
    const across = (p: Point) => vertical ? p.x : p.y;
    const span = Math.abs(along(a) - along(b));
    if (span < Math.max(12, s.grid.spacing * 3)) return;
    // Restrict the envelope to the actual connected circuit, including labels.
    const members = new Set([e.from.componentId, e.to.componentId]);
    const neighbours = new Map<string, string[]>();
    for (const wire of s.edges) for (const [a, b] of [[wire.from.componentId, wire.to.componentId], [wire.to.componentId, wire.from.componentId]]) {
        if (!neighbours.has(a)) neighbours.set(a, []);
        neighbours.get(a)!.push(b);
    }
    const queue = [...members];
    for (let i = 0; i < queue.length; i++) for (const id of neighbours.get(queue[i]) ?? []) {
        if (!members.has(id)) { members.add(id); queue.push(id); }
    }
    const nodes = s.nodes.filter(n => members.has(n.id));
    if (!nodes.some(n => n.id !== e.from.componentId && n.id !== e.to.componentId &&
        along(n.origin) > Math.min(along(a), along(b)) && along(n.origin) < Math.max(along(a), along(b)))) return;
    const bounds = union(nodes.map(n => n.rect));
    const low = vertical ? bounds.x : bounds.y, high = vertical ? right(bounds) : bottom(bounds);
    const step = s.grid.spacing, origin = vertical ? s.grid.origin.x : s.grid.origin.y;
    if (!Number.isFinite(step) || step <= 0) return;
    const gap = Math.max(2, clearance, step);
    const lanes = [origin + Math.floor((low - gap - origin) / step) * step,
        origin + Math.ceil((high + gap - origin) / step) * step];
    // Penalize only the central run inside the circuit envelope. Outer access
    // segments are ordinary routing costs, and all hard obstacle checks apply.
    const penalty = (p: Point, q: Point) => Math.abs(across(p) - across(q)) < 1e-6 && across(p) > low - 1e-6 && across(p) < high + 1e-6
        ? Math.max(0, Math.min(Math.max(along(p), along(q)), Math.max(along(a), along(b))) - Math.max(Math.min(along(p), along(q)), Math.min(along(a), along(b)))) * 0.75 : 0;
    return { vertical, lanes, penalty };
}
