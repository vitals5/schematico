import type { ElkNode } from 'elkjs/lib/elk-api';
import type { LayoutSnapshot } from './types';
import { rankedGroup } from './ranked';
type Padding = {
    left: number;
    right: number;
    top: number;
    bottom: number;
};
/** Orthogonal circuit columns. Envelopes reserve labels; axes refer to real ports/bodies.
 * This is a geometric style candidate, never an inference of electrical current direction. */
export function structuredGroup(id: string, children: ElkNode[], snapshot: LayoutSnapshot, gap: number, padding: Padding): ElkNode | undefined {
    const pins = new Map(snapshot.nodes.flatMap(n => n.pins.map(p => [JSON.stringify([n.id, p.id]), p] as const)));
    const owner = new Map(children.flatMap(c => (c.ports ?? []).map(p => [p.id, c.id] as const)));
    const side = new Map<string, 'left' | 'right'>();
    const handoverPort = new Map<string, NonNullable<ElkNode['ports']>[number]>();
    const connected = new Set(snapshot.edges.flatMap(e => [JSON.stringify([e.from.componentId, e.from.pinId]), JSON.stringify([e.to.componentId, e.to.pinId])]));
    for (const c of children) {
        const ports = snapshot.nodes.find(n => n.id === c.id)?.handover
            ? (c.ports ?? []).filter(p => connected.has(p.id)) : c.ports ?? [];
        const directions = ports.map(p => pins.get(p.id)?.direction);
        // Single-port handovers only. Multi-pin devices must retain their complete interface.
        if (directions.length === 1 && (directions[0] === 'left' || directions[0] === 'right')) {
            side.set(c.id, directions[0]);
            handoverPort.set(c.id, ports[0]);
        }
    }
    const core = children.filter(c => !side.has(c.id));
    if (!core.length)
        return;
    const laid = rankedGroup(id, core, snapshot, gap, padding, true);
    if (!laid?.children)
        return;
    const nodes = laid.children;
    const byId = new Map(nodes.map(c => [c.id, c]));
    const rows = new Map<number, ElkNode[]>();
    for (const c of nodes)
        rows.set(c.y!, [...(rows.get(c.y!) ?? []), c]);
    const connections = snapshot.edges.flatMap(e => {
        const a = JSON.stringify([e.from.componentId, e.from.pinId]);
        const b = JSON.stringify([e.to.componentId, e.to.pinId]);
        const ac = owner.get(a), bc = owner.get(b);
        return ac && bc && ac !== bc ? [{ a, b, ac, bc }] : [];
    });
    // Project desired x coordinates onto non-overlapping intervals with isotonic regression.
    // Unlike a left-to-right clamp, this can move an entire row back towards its port axes.
    for (let pass = 0; pass < 12; pass++) {
        const ordered = [...rows.values()];
        if (pass % 2)
            ordered.reverse();
        for (const row of ordered) {
            const desiredAxis = (c: ElkNode) => {
                const targets = connections.flatMap(e => {
                    const own = e.ac === c.id ? e.a : e.bc === c.id ? e.b : undefined;
                    const other = byId.get(e.ac === c.id ? e.bc : e.ac);
                    if (!own || !other || row.includes(other) || other.y! >= c.y!)
                        return [];
                    const p = c.ports?.find(p => p.id === own);
                    const q = other.ports?.find(p => p.id === (e.ac === c.id ? e.b : e.a));
                    return p && q ? [other.x! + (q.x ?? 0) - (p.x ?? 0)] : [];
                });
                return targets.length ? targets.reduce((a, b) => a + b, 0) / targets.length : c.x!;
            };
            const desired = new Map(row.map(c => [c.id, desiredAxis(c)]));
            row.sort((a, b) => desired.get(a.id)! - desired.get(b.id)! || a.id.localeCompare(b.id));
            let offset = 0;
            const offsets: number[] = [];
            const blocks: {
                first: number;
                last: number;
                sum: number;
                weight: number;
            }[] = [];
            for (const [i, c] of row.entries()) {
                offsets.push(offset);
                const targets = connections.flatMap(e => {
                    const own = e.ac === c.id ? e.a : e.bc === c.id ? e.b : undefined;
                    const otherId = e.ac === c.id ? e.bc : e.ac;
                    const other = byId.get(otherId);
                    if (!own || !other || row.includes(other))
                        return [];
                    const otherPin = e.ac === c.id ? e.b : e.a;
                    const p = c.ports?.find(p => p.id === own), q = other.ports?.find(p => p.id === otherPin);
                    if (!p || !q)
                        return [];
                    return [other.x! + (q.x ?? 0) - (p.x ?? 0)];
                });
                const weight = Math.max(1, targets.length);
                const desired = targets.length ? targets.reduce((a, b) => a + b, 0) / targets.length : c.x!;
                blocks.push({ first: i, last: i, sum: (desired - offset) * weight, weight });
                while (blocks.length > 1) {
                    const b = blocks[blocks.length - 1], a = blocks[blocks.length - 2];
                    if (a.sum / a.weight <= b.sum / b.weight)
                        break;
                    blocks.splice(-2, 2, { first: a.first, last: b.last, sum: a.sum + b.sum, weight: a.weight + b.weight });
                }
                offset += (c.width ?? 1) + gap;
            }
            for (const b of blocks)
                for (let i = b.first; i <= b.last; i++)
                    row[i].x = Math.max(padding.left, b.sum / b.weight) + offsets[i];
        }
    }
    // Remove transverse drift of whole connected circuits, retaining every port-axis
    // relationship and the label clearance to independent neighbours in the same row.
    const unseen = new Set(nodes.map(c => c.id));
    while (unseen.size) {
        const ids = new Set<string>(), queue = [unseen.values().next().value!];
        while (queue.length) {
            const id = queue.pop()!;
            if (!unseen.delete(id))
                continue;
            ids.add(id);
            for (const e of connections) {
                const other = e.ac === id ? e.bc : e.bc === id ? e.ac : undefined;
                if (other && unseen.has(other))
                    queue.push(other);
            }
        }
        const members = nodes.filter(c => ids.has(c.id));
        let shift = Math.min(...members.map(c => c.x! - padding.left));
        for (const row of rows.values())
            for (const c of row.filter(c => ids.has(c.id)))
                for (const other of row.filter(other => !ids.has(other.id) && other.x! < c.x!))
                    shift = Math.min(shift, c.x! - other.x! - (other.width ?? 1) - gap);
        if (shift > 0)
            for (const c of members)
                c.x! -= shift;
    }
    // Equal body baselines, regardless of text height above an individual symbol.
    let y = padding.top;
    for (const row of rows.values()) {
        const bodyOffset = (c: ElkNode) => {
            const n = snapshot.nodes.find(n => n.id === c.id);
            const bodies = n?.shapes.filter(s => s.kind === 'body');
            return bodies?.length ? Math.min(...bodies.map(s => s.rect.y)) - n!.rect.y : 0;
        };
        const baseline = Math.max(...row.map(bodyOffset));
        for (const c of row)
            c.y = y + baseline - bodyOffset(c);
        y = Math.max(...row.map(c => c.y! + (c.height ?? 1))) + gap;
    }
    let width = Math.max(...nodes.map(c => c.x! + (c.width ?? 1))) + padding.right;
    let height = y - gap + padding.bottom;
    // Handovers have dedicated edge columns; their order follows the actual destination pins.
    for (const direction of ['right', 'left'] as const) {
        const bank = children.filter(c => side.get(c.id) === direction).map(c => {
            const own = handoverPort.get(c.id)!;
            const targets = connections.flatMap(e => {
                const otherId = e.ac === c.id ? e.bc : e.bc === c.id ? e.ac : undefined;
                const other = otherId ? byId.get(otherId) : undefined;
                const p = other?.ports?.find(p => p.id === (e.ac === c.id ? e.b : e.a));
                return other && p ? [{ y: other.y! + (p.y ?? 0) - (own.y ?? 0), x: other.x! + (p.x ?? 0) }] : [];
            });
            return { ...c, y: targets.length ? targets.reduce((a, b) => a + b.y, 0) / targets.length : padding.top, targetX: targets.length ? targets.reduce((a, b) => a + b.x, 0) / targets.length : 0 };
        }).sort((a, b) => Math.round((a.y! - b.y!) * 1e6) || (direction === 'right' ? b.targetX - a.targetX : a.targetX - b.targetX) || a.id.localeCompare(b.id));
        if (!bank.length)
            continue;
        const destinationPins = connections.flatMap(e => {
            const ac = side.get(e.ac) === direction, bc = side.get(e.bc) === direction;
            return ac && !bc ? [pins.get(e.b)] : bc && !ac ? [pins.get(e.a)] : [];
        }).filter(Boolean);
        if (destinationPins.length && destinationPins.every(p => p!.direction === 'top')) {
            const reserve = bank.reduce((sum, c) => sum + (c.height ?? 1) + gap, 0);
            for (const c of nodes)
                c.y! += reserve;
            let cursor = padding.top;
            for (const c of bank) {
                c.y = cursor;
                cursor += (c.height ?? 1) + gap;
            }
            height += reserve;
        }
        const maxPort = Math.max(...bank.map(c => handoverPort.get(c.id)!.x ?? 0));
        const bankWidth = maxPort + Math.max(...bank.map(c => (c.width ?? 1) - (handoverPort.get(c.id)!.x ?? 0)));
        if (direction === 'right')
            for (const c of nodes)
                c.x! += bankWidth + gap;
        let nextY = padding.top;
        // A common pin axis, rather than a common text-envelope edge.
        for (const c of bank) {
            c.x = (direction === 'right' ? padding.left : width + gap) + maxPort - (handoverPort.get(c.id)!.x ?? 0);
            c.y = Math.max(nextY, c.y!);
            nextY = c.y + (c.height ?? 1) + gap;
            nodes.push(c);
            byId.set(c.id, c);
        }
        width = Math.max(...nodes.map(c => c.x! + (c.width ?? 1))) + padding.right;
        height = Math.max(height, nextY - gap + padding.bottom);
    }
    return { id, children: nodes, width, height };
}
/** Penalty for avoidable axis offsets and irregular parallel conductor runs.
 * Electrical validity remains a separate hard requirement. */
export function designPenalty(s: LayoutSnapshot): number {
    const nodes = new Map(s.nodes.map(n => [n.id, n]));
    const pairs = new Map<string, number[]>();
    for (const e of s.edges) {
        const a = nodes.get(e.from.componentId)?.pins.find(p => p.id === e.from.pinId);
        const b = nodes.get(e.to.componentId)?.pins.find(p => p.id === e.to.pinId);
        if (!a || !b)
            continue;
        const vertical = (a.direction === 'bottom' && b.direction === 'top') || (a.direction === 'top' && b.direction === 'bottom');
        const horizontal = (a.direction === 'left' && b.direction === 'right') || (a.direction === 'right' && b.direction === 'left');
        if (!vertical && !horizontal)
            continue;
        const ids = [e.from.componentId, e.to.componentId].sort();
        const sign = e.from.componentId === ids[0] ? 1 : -1;
        const delta = sign * (vertical ? a.x - b.x : a.y - b.y);
        const key = JSON.stringify([ids, vertical]);
        pairs.set(key, [...(pairs.get(key) ?? []), delta]);
    }
    let score = 0;
    for (const deltas of pairs.values()) {
        const mean = deltas.reduce((a, b) => a + b, 0) / deltas.length;
        score += Math.abs(mean) * 3 + deltas.reduce((a, b) => a + Math.abs(b - mean), 0) * 2;
    }
    return score;
}
