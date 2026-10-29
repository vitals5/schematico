import type { ElkNode } from 'elkjs/lib/elk-api';

interface AxialConnection { a: string; b: string; ac: string; bc: string }

/** Align unambiguous serial chains exactly after local row optimisation. Operates
 * only on temporary layout nodes; first appearance establishes the column order. */
export function alignSerialLanes(rows: ElkNode[][], connections: AxialConnection[], gap: number, left: number, preferredOrder: [string, string][] = [], separatedOrder: [string, string][] = []): boolean {
    const nodes = rows.flat(), byId = new Map(nodes.map(n => [n.id, n]));
    const level = new Map(rows.flatMap((row, i) => row.map(n => [n.id, i] as const)));
    const outgoing = new Map<string, Set<string>>(), incoming = new Map<string, Set<string>>();
    const pairs = new Map<string, { from: string; to: string; deltas: number[] }>();
    for (const e of connections) {
        const a = byId.get(e.ac), b = byId.get(e.bc);
        if (!a || !b || level.get(a.id) === level.get(b.id)) continue;
        const ap = a.ports?.find(p => p.id === e.a), bp = b.ports?.find(p => p.id === e.b);
        if (!ap || !bp) continue;
        const [from, to, p, q] = level.get(a.id)! < level.get(b.id)! ? [a, b, ap, bp] : [b, a, bp, ap];
        if (!outgoing.has(from.id)) outgoing.set(from.id, new Set());
        if (!incoming.has(to.id)) incoming.set(to.id, new Set());
        outgoing.get(from.id)!.add(to.id); incoming.get(to.id)!.add(from.id);
        const key = JSON.stringify([from.id, to.id]);
        const pair = pairs.get(key) ?? { from: from.id, to: to.id, deltas: [] };
        pair.deltas.push((p.x ?? 0) - (q.x ?? 0)); pairs.set(key, pair);
    }
    const links = new Map<string, { id: string; delta: number }[]>();
    for (const p of pairs.values()) {
        if (outgoing.get(p.from)!.size !== 1 || incoming.get(p.to)!.size !== 1 ||
            p.deltas.some(d => Math.abs(d - p.deltas[0]) > 1e-6)) continue;
        if (!links.has(p.from)) links.set(p.from, []);
        if (!links.has(p.to)) links.set(p.to, []);
        links.get(p.from)!.push({ id: p.to, delta: p.deltas[0] });
        links.get(p.to)!.push({ id: p.from, delta: -p.deltas[0] });
    }
    if (!links.size && !preferredOrder.length && !separatedOrder.length) return false;
    const laneOf = new Map<string, string>(), offset = new Map<string, number>();
    const lanes = new Map<string, ElkNode[]>();
    for (const seed of [...nodes].sort((a, b) => a.id.localeCompare(b.id))) {
        if (laneOf.has(seed.id)) continue;
        const queue = [{ id: seed.id, delta: 0 }], members: ElkNode[] = [];
        while (queue.length) {
            const n = queue.pop()!;
            if (laneOf.has(n.id)) continue;
            laneOf.set(n.id, seed.id); offset.set(n.id, n.delta); members.push(byId.get(n.id)!);
            for (const next of links.get(n.id) ?? []) queue.push({ id: next.id, delta: n.delta + next.delta });
        }
        lanes.set(seed.id, members);
    }
    const constraints = new Map<string, Map<string, number>>();
    const degree = new Map([...lanes.keys()].map(id => [id, 0]));
    const column = new Map<string, number>();
    for (const row of rows) for (const n of [...row].sort((a, b) => a.x! - b.x! || a.id.localeCompare(b.id))) {
        const lane = laneOf.get(n.id)!;
        if (!column.has(lane)) column.set(lane, column.size);
    }
    const hints = [...preferredOrder, ...separatedOrder];
    if (hints.length) {
        const next = new Map<string, Set<string>>(), indegree = new Map([...column.keys()].map(id => [id, 0]));
        for (const [a, b] of hints) {
            const from = laneOf.get(a), to = laneOf.get(b);
            if (!from || !to || from === to) continue;
            if (!next.has(from)) next.set(from, new Set());
            if (!next.get(from)!.has(to)) { next.get(from)!.add(to); indegree.set(to, indegree.get(to)! + 1); }
        }
        const ready = [...indegree].filter(([, d]) => !d).map(([id]) => id), ordered: string[] = [];
        while (ready.length) {
            ready.sort((a, b) => column.get(a)! - column.get(b)!);
            const id = ready.shift()!; ordered.push(id);
            for (const to of next.get(id) ?? []) {
                indegree.set(to, indegree.get(to)! - 1);
                if (!indegree.get(to)) ready.push(to);
            }
        }
        if (ordered.length !== column.size) return false;
        ordered.forEach((id, i) => column.set(id, i));
    }
    for (const row of rows) {
        const ordered = [...row].sort((a, b) => column.get(laneOf.get(a.id)!)! - column.get(laneOf.get(b.id)!)!);
        for (let i = 1; i < ordered.length; i++) {
            const a = ordered[i - 1], b = ordered[i], from = laneOf.get(a.id)!, to = laneOf.get(b.id)!;
            if (from === to) return false;
            if (!constraints.has(from)) constraints.set(from, new Map());
            const edges = constraints.get(from)!;
            if (!edges.has(to)) degree.set(to, degree.get(to)! + 1);
            edges.set(to, Math.max(edges.get(to) ?? -Infinity, offset.get(a.id)! + (a.width ?? 1) + gap - offset.get(b.id)!));
        }
    }
    // Open rails need a real side corridor even when their attached devices
    // occupy different levels. Reserve full envelopes, including visible labels.
    for (const [a, b] of separatedOrder) {
        const first = byId.get(a), second = byId.get(b), from = laneOf.get(a), to = laneOf.get(b);
        if (!first || !second || !from || !to || from === to) return false;
        if (!constraints.has(from)) constraints.set(from, new Map());
        const edges = constraints.get(from)!;
        if (!edges.has(to)) degree.set(to, degree.get(to)! + 1);
        edges.set(to, Math.max(edges.get(to) ?? -Infinity, offset.get(a)! + (first.width ?? 1) + gap - offset.get(b)!));
    }
    const queue = [...degree].filter(([, d]) => !d).map(([id]) => id).sort(), order: string[] = [];
    while (queue.length) {
        const id = queue.shift()!; order.push(id);
        for (const to of constraints.get(id)?.keys() ?? []) {
            degree.set(to, degree.get(to)! - 1);
            if (!degree.get(to)) { queue.push(to); queue.sort(); }
        }
    }
    // Do not apply a partial result if the column constraints are inconsistent.
    if (order.length !== lanes.size) return false;
    const positions = new Map([...lanes].map(([id, members]) => [id, Math.max(
        ...members.map(n => left - offset.get(n.id)!),
        members.reduce((sum, n) => sum + n.x! - offset.get(n.id)!, 0) / members.length,
    )]));
    for (const id of order) for (const [to, distance] of constraints.get(id) ?? [])
        positions.set(to, Math.max(positions.get(to)!, positions.get(id)! + distance));
    for (const n of nodes) n.x = positions.get(laneOf.get(n.id)!)! + offset.get(n.id)!;
    return true;
}
