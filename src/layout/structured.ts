import type { ElkNode } from 'elkjs/lib/elk-api';
import type { LayoutSnapshot } from './types';
import { rankedGroup } from './ranked';
import { channelGap, type ChannelSpan } from './channels';
import { netIds } from './validate';
import { spaceParallelBranches } from './branchSpacing';
import { alignSerialLanes } from './serialLanes';
import { junctionPlacement } from './junctionPlacement';
import { perpendicularRail } from './perpendicularRail';
type Padding = {
    left: number;
    right: number;
    top: number;
    bottom: number;
};
/** Orthogonal circuit columns. Envelopes reserve labels; axes refer to real ports/bodies.
 * This is a geometric style candidate, never an inference of electrical current direction. */
export function structuredGroup(id: string, children: ElkNode[], snapshot: LayoutSnapshot, gap: number, padding: Padding): ElkNode | undefined {
    return perpendicularRail(children, snapshot, gap, padding, (core, planning) => axisStructuredGroup(id, core, planning, gap, padding))
        ?? junctionPlacement(children, snapshot, gap, padding, (core, planning) => axisStructuredGroup(id, core, planning, gap, padding))
        ?? axisStructuredGroup(id, children, snapshot, gap, padding);
}

function axisStructuredGroup(id: string, children: ElkNode[], snapshot: LayoutSnapshot, gap: number, padding: Padding): ElkNode | undefined {
    // A left/right device chain needs columns rather than vertical ranks. Count device
    // pairs, not conductors: a three-phase cable must not outweigh three control paths.
    // Handover arrows are edge annotations and do not decide the circuit's main axis.
    const owners = new Map(children.flatMap(c => (c.ports ?? []).map(p => [p.id, c.id] as const)));
    const nodes = new Map(snapshot.nodes.map(n => [n.id, n]));
    const axes = { horizontal: new Set<string>(), vertical: new Set<string>() };
    for (const e of snapshot.edges) {
        const a = nodes.get(e.from.componentId), b = nodes.get(e.to.componentId);
        const ac = owners.get(JSON.stringify([e.from.componentId, e.from.pinId]));
        const bc = owners.get(JSON.stringify([e.to.componentId, e.to.pinId]));
        if (!ac || !bc || ac === bc || a?.handover || b?.handover) continue;
        const ap = a?.pins.find(p => p.id === e.from.pinId), bp = b?.pins.find(p => p.id === e.to.pinId);
        const key = JSON.stringify([ac, bc].sort());
        if ((ap?.direction === 'right' && bp?.direction === 'left') || (ap?.direction === 'left' && bp?.direction === 'right')) axes.horizontal.add(key);
        if ((ap?.direction === 'bottom' && bp?.direction === 'top') || (ap?.direction === 'top' && bp?.direction === 'bottom')) axes.vertical.add(key);
    }
    if (snapshot.planningAxis ? snapshot.planningAxis === 'horizontal' : axes.horizontal.size > axes.vertical.size) {
        // Transpose only the temporary layout geometry. Symbols, text rotations and
        // electrical endpoints in the project are never rotated or rewritten.
        const point = <T extends { x?: number; y?: number }>(p: T): T => ({ ...p, x: p.y, y: p.x });
        const rect = <T extends { x: number; y: number; width: number; height: number }>(r: T): T => ({ ...point(r), width: r.height, height: r.width });
        const transpose = (c: ElkNode): ElkNode => ({ ...point(c), width: c.height, height: c.width, ports: c.ports?.map(p => ({ ...point(p), width: p.height, height: p.width })), children: c.children?.map(transpose) });
        const directions = { left: 'top', right: 'bottom', top: 'left', bottom: 'right' } as const;
        const transposed = { ...snapshot, junctionSpaces: snapshot.junctionSpaces?.map(s => ({ ...s, width: s.height, height: s.width, orderX: s.orderY, orderY: s.orderX, apartX: s.apartY, apartY: s.apartX })), nodes: snapshot.nodes.map(n => ({ ...n, rect: rect(n.rect), pins: n.pins.map(p => ({ ...point(p), direction: directions[p.direction] })), shapes: n.shapes.map(s => ({ ...s, rect: rect(s.rect) })) })) };
        const result = verticalStructuredGroup(id, children.map(transpose), transposed, gap, { left: padding.top, top: padding.left, right: padding.bottom, bottom: padding.right });
        return result && transpose(result);
    }
    return verticalStructuredGroup(id, children, snapshot, gap, padding);
}

function verticalStructuredGroup(id: string, children: ElkNode[], snapshot: LayoutSnapshot, gap: number, padding: Padding): ElkNode | undefined {
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
    const edges = snapshot.edges.map((e, i) => ({ ...e, id: e.id ?? 'channel-' + i }));
    const nets = netIds({ ...snapshot, edges });
    const connections = edges.flatMap(e => {
        const a = JSON.stringify([e.from.componentId, e.from.pinId]);
        const b = JSON.stringify([e.to.componentId, e.to.pinId]);
        const ac = owner.get(a), bc = owner.get(b);
        return ac && bc && ac !== bc ? [{ a, b, ac, bc, net: nets.get(e.id)!, alignAxis: e.alignAxis !== false }] : [];
    });
    // Same-side connections join parallel branches; they do not define a shared
    // device axis when those branches contain different numbers of serial devices.
    const axial = connections.filter(e => {
        const a = pins.get(e.a)?.direction, b = pins.get(e.b)?.direction;
        return e.alignAxis && (a === 'bottom' && b === 'top' || a === 'top' && b === 'bottom');
    });
    // Project desired x coordinates onto non-overlapping intervals with isotonic regression.
    // Unlike a left-to-right clamp, this can move an entire row back towards its port axes.
    for (let pass = 0; pass < 12; pass++) {
        const ordered = [...rows.values()];
        if (pass % 2)
            ordered.reverse();
        for (const row of ordered) {
            const desiredAxis = (c: ElkNode) => {
                const targets = axial.flatMap(e => {
                    const own = e.ac === c.id ? e.a : e.bc === c.id ? e.b : undefined;
                    const other = byId.get(e.ac === c.id ? e.bc : e.ac);
                    if (!own || !other || row.includes(other) || other.y! >= c.y!)
                        return [];
                    const p = c.ports?.find(p => p.id === own);
                    const q = other.ports?.find(p => p.id === (e.ac === c.id ? e.b : e.a));
                    return p && q ? [other.x! + (q.x ?? 0)] : [];
                });
                const ownAxis = c.ports?.length ? c.ports.reduce((sum, p) => sum + (p.x ?? 0), 0) / c.ports.length : (c.width ?? 0) / 2;
                return targets.length ? targets.reduce((a, b) => a + b, 0) / targets.length : c.x! + ownAxis;
            };
            const desired = new Map(row.map(c => [c.id, desiredAxis(c)]));
            // Order by physical source axes, not the left edges of unequal labels.
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
                const targets = axial.flatMap(e => {
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
    const columnOrder = (snapshot.junctionSpaces ?? []).flatMap(s => (s.orderX ?? []).flatMap(([a, b]) => {
        const from = owner.get(a), to = owner.get(b);
        return from && to && from !== to ? [[from, to] as [string, string]] : [];
    }));
    const separatedOrder = (snapshot.junctionSpaces ?? []).flatMap(s => (s.apartX ?? []).flatMap(([a, b]) => {
        const from = owner.get(a), to = owner.get(b);
        return from && to && from !== to ? [[from, to] as [string, string]] : [];
    }));
    const aligned = alignSerialLanes([...rows.values()], axial, gap, padding.left, columnOrder, separatedOrder);
    if (separatedOrder.length && !aligned) return;
    if (!columnOrder.length && !separatedOrder.length) spaceParallelBranches([...rows.values()], axial, snapshot, gap, padding.left);
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
    // Reserve transverse routing space before fixing the distance between levels.
    // A fixed device gap is insufficient for several independent fan-out bends.
    const levels = [...rows.values()];
    const levelOf = new Map(levels.flatMap((row, i) => row.map(c => [c.id, i] as const)));
    const junctionGaps = levels.map(() => gap);
    for (const space of snapshot.junctionSpaces ?? []) {
        if (space.reserve === false) continue;
        const ranks = space.pins.map(p => levelOf.get(owner.get(p)!)).filter(r => r !== undefined);
        if (!ranks.length || Math.min(...ranks) === Math.max(...ranks)) return;
        const first = Math.min(...ranks);
        junctionGaps[first] = Math.max(junctionGaps[first], space.height + gap * 2);
    }
    const spans = levels.map(() => [] as ChannelSpan[]);
    for (const e of connections) {
        const a = byId.get(e.ac), b = byId.get(e.bc);
        const ar = levelOf.get(e.ac), br = levelOf.get(e.bc);
        if (!a || !b || ar === undefined || br === undefined || ar === br) continue;
        const ap = a.ports?.find(p => p.id === e.a), bp = b.ports?.find(p => p.id === e.b);
        const ad = pins.get(e.a)?.direction, bd = pins.get(e.b)?.direction;
        if (!ap || !bp || !(ar < br && ad === 'bottom' && bd === 'top' || br < ar && bd === 'bottom' && ad === 'top')) continue;
        const upper = ar < br ? a : b, lower = ar < br ? b : a;
        const up = ar < br ? ap : bp, down = ar < br ? bp : ap;
        spans[Math.min(ar, br)].push({ start: upper.x! + (up.x ?? 0), end: lower.x! + (down.x ?? 0), net: e.net, bank: upper.id, destinationBank: lower.id });
    }
    // Equal body baselines, regardless of text height above an individual symbol.
    let y = padding.top;
    for (const [index, row] of levels.entries()) {
        const bodyOffset = (c: ElkNode) => {
            const n = snapshot.nodes.find(n => n.id === c.id);
            const bodies = n?.shapes.filter(s => s.kind === 'body');
            return bodies?.length ? Math.min(...bodies.map(s => s.rect.y)) - n!.rect.y : 0;
        };
        const baseline = Math.max(...row.map(bodyOffset));
        for (const c of row)
            c.y = y + baseline - bodyOffset(c);
        y = Math.max(...row.map(c => c.y! + (c.height ?? 1))) +
            (index === levels.length - 1 ? gap : Math.max(junctionGaps[index], channelGap(spans[index], snapshot.grid?.spacing ?? 2, gap)));
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
    let score = 0;
    for (const e of s.edges) {
        const a = nodes.get(e.from.componentId)?.pins.find(p => p.id === e.from.pinId);
        const b = nodes.get(e.to.componentId)?.pins.find(p => p.id === e.to.pinId);
        if (!a || !b)
            continue;
        const vertical = (a.direction === 'bottom' && b.direction === 'top') || (a.direction === 'top' && b.direction === 'bottom');
        const horizontal = (a.direction === 'left' && b.direction === 'right') || (a.direction === 'right' && b.direction === 'left');
        if (!vertical && !horizontal)
            continue;
        // Geometric reading order follows facing ports, independent of wire from/to.
        // A backwards path remains electrically legal but is harder to read.
        const forward = vertical
            ? (a.direction === 'bottom' ? b.y - a.y : a.y - b.y)
            : (a.direction === 'right' ? b.x - a.x : a.x - b.x);
        score += Math.max(0, -forward) * 3;
        const ids = [e.from.componentId, e.to.componentId].sort();
        const sign = e.from.componentId === ids[0] ? 1 : -1;
        const delta = sign * (vertical ? a.x - b.x : a.y - b.y);
        const key = JSON.stringify([ids, vertical]);
        pairs.set(key, [...(pairs.get(key) ?? []), delta]);
    }
    for (const deltas of pairs.values()) {
        const mean = deltas.reduce((a, b) => a + b, 0) / deltas.length;
        score += Math.abs(mean) * 3 + deltas.reduce((a, b) => a + Math.abs(b - mean), 0) * 2;
    }
    return score;
}
