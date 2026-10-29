import type { LayoutSnapshot } from './types';

/** Soft page-partition units. Explicit atomic groups remain indivisible; only
 * unambiguous facing two-terminal device chains are joined for the first attempt. */
export function coherentBlocks(atomic: string[][], s: LayoutSnapshot): string[][] {
    const owner = new Map(atomic.flatMap((b, i) => b.map(id => [id, i] as const)));
    const parent = atomic.map((_, i) => i);
    const root = (i: number): number => parent[i] === i ? i : (parent[i] = root(parent[i]));
    const nodes = new Map(s.nodes.map(n => [n.id, n]));
    const eligible = (id: string) => {
        const n = nodes.get(id);
        return n && !n.fixed && !n.routingJunction && !n.handover && n.pins.length === 2 &&
            (n.pins.some(p => p.direction === 'top') && n.pins.some(p => p.direction === 'bottom') ||
             n.pins.some(p => p.direction === 'left') && n.pins.some(p => p.direction === 'right'));
    };
    const outgoing = new Map<string, Set<string>>(), incoming = new Map<string, Set<string>>();
    const arcs: [string, string][] = [];
    for (const e of s.edges) {
        const a = nodes.get(e.from.componentId)?.pins.find(p => p.id === e.from.pinId);
        const b = nodes.get(e.to.componentId)?.pins.find(p => p.id === e.to.pinId);
        if (!a || !b || !owner.has(e.from.componentId) || !owner.has(e.to.componentId)) continue;
        const forward = a.direction === 'bottom' && b.direction === 'top' || a.direction === 'right' && b.direction === 'left';
        const backward = b.direction === 'bottom' && a.direction === 'top' || b.direction === 'right' && a.direction === 'left';
        if (!forward && !backward) continue;
        const from = forward ? e.from.componentId : e.to.componentId, to = forward ? e.to.componentId : e.from.componentId;
        if (!outgoing.has(from)) outgoing.set(from, new Set());
        if (!incoming.has(to)) incoming.set(to, new Set());
        outgoing.get(from)!.add(to); incoming.get(to)!.add(from); arcs.push([from, to]);
    }
    for (const [a, b] of arcs) if (a !== b && eligible(a) && eligible(b) && outgoing.get(a)!.size === 1 && incoming.get(b)!.size === 1) {
        const first = root(owner.get(a)!), second = root(owner.get(b)!);
        if (first !== second) parent[Math.max(first, second)] = Math.min(first, second);
    }
    const result = new Map<number, string[]>();
    atomic.forEach((b, i) => result.set(root(i), [...(result.get(root(i)) ?? []), ...b]));
    return [...result.values()].map(b => b.sort()).sort((a, b) => b.length - a.length || a[0].localeCompare(b[0]));
}

/** Deterministic affinity packing; component count is only a balancing estimate.
 * Every resulting page still requires its own geometric and routing validation. */
export function partitionBins(blocks: string[][], count: number, s: LayoutSnapshot): string[][] {
    const bins: string[][] = Array.from({ length: count }, () => []);
    for (const [index, block] of blocks.entries()) {
        if (index < count) { bins[index].push(...block); continue; }
        const affinity = (bin: string[]) => s.edges.filter(e => block.includes(e.from.componentId) && bin.includes(e.to.componentId) || block.includes(e.to.componentId) && bin.includes(e.from.componentId)).length;
        const bin = [...bins].sort((a, b) => affinity(b) - affinity(a) || a.length - b.length)[0];
        bin.push(...block);
    }
    return bins.filter(b => b.length);
}
