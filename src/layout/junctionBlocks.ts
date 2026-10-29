import type { ElkNode } from 'elkjs/lib/elk-api';
import type { LayoutSnapshot } from './types';

export interface JunctionBlock extends ElkNode {
    members: Set<string>;
    parts: ElkNode[];
    through: [string, string];
    vertical: boolean;
}
const opposite = { top: 'bottom', bottom: 'top', left: 'right', right: 'left' } as const;

/** Build rigid temporary envelopes for straight chains of conductive junctions.
 * Every original symbol/port remains separate when the placement is expanded. */
export function junctionBlocks(helpers: ElkNode[], source: LayoutSnapshot, gap: number): JunctionBlock[] | undefined {
    if (!Number.isFinite(source.grid.spacing) || source.grid.spacing <= 0) return;
    const nodes = new Map(source.nodes.map(n => [n.id, n]));
    if (helpers.some(c => {
        const n = nodes.get(c.id);
        return !n?.routingJunction || n.fixed || n.joinedPins?.length !== 1 || n.pins.some(p => !n.joinedPins![0].includes(p.id));
    })) return;
    const available = new Map(helpers.map(c => [c.id, c]));
    const internal = source.edges.filter(e => available.has(e.from.componentId) && available.has(e.to.componentId));
    const components: string[][] = [], unseen = new Set(available.keys());
    while (unseen.size) {
        const queue = [[...unseen].sort()[0]], members: string[] = [];
        while (queue.length) {
            const id = queue.pop()!;
            if (!unseen.delete(id)) continue;
            members.push(id);
            for (const e of internal) {
                if (e.from.componentId === id) queue.push(e.to.componentId);
                if (e.to.componentId === id) queue.push(e.from.componentId);
            }
        }
        components.push(members.sort());
    }
    const result: JunctionBlock[] = [], usedIds = new Set(source.nodes.map(n => n.id));
    for (const ids of components) {
        const members = new Set(ids), wires = internal.filter(e => members.has(e.from.componentId));
        if (wires.length !== ids.length - 1) return;
        const ports = new Map(ids.map(id => {
            const node = nodes.get(id)!;
            const vertical = node.pins.some(p => p.direction === 'top') && node.pins.some(p => p.direction === 'bottom');
            const start = node.pins.find(p => p.direction === (vertical ? 'top' : 'left'));
            const end = node.pins.find(p => p.direction === (vertical ? 'bottom' : 'right'));
            return [id, { vertical, start, end }] as const;
        }));
        const vertical = ports.get(ids[0])!.vertical;
        if ([...ports.values()].some(p => p.vertical !== vertical || !p.start || !p.end)) return;
        const next = new Map<string, string>(), previous = new Map<string, string>();
        for (const e of wires) {
            const a = nodes.get(e.from.componentId)!.pins.find(p => p.id === e.from.pinId)!;
            const b = nodes.get(e.to.componentId)!.pins.find(p => p.id === e.to.pinId)!;
            if (!a || !b || opposite[a.direction] !== b.direction ||
                (vertical ? !['top', 'bottom'].includes(a.direction) : !['left', 'right'].includes(a.direction))) return;
            const forward = a.direction === (vertical ? 'bottom' : 'right');
            const from = forward ? e.from.componentId : e.to.componentId, to = forward ? e.to.componentId : e.from.componentId;
            if (next.has(from) || previous.has(to)) return;
            next.set(from, to); previous.set(to, from);
        }
        const first = ids.filter(id => !previous.has(id));
        if (first.length !== 1) return;
        const order: string[] = [];
        for (let id: string | undefined = first[0]; id; id = next.get(id)) {
            if (order.includes(id)) return;
            order.push(id);
        }
        if (order.length !== ids.length) return;
        const key = (id: string, pin: string) => JSON.stringify([id, pin]);
        const axes = new Map<string, { transverse: number; other: number; longitudinal: number }>();
        for (const id of order) {
            const c = available.get(id)!, p = ports.get(id)!;
            const start = c.ports!.find(q => q.id === key(id, p.start!.id))!, end = c.ports!.find(q => q.id === key(id, p.end!.id))!;
            if (!start || !end) return;
            axes.set(id, { transverse: vertical ? start.x! : start.y!, other: vertical ? end.x! : end.y!, longitudinal: vertical ? (start.y! + end.y!) / 2 : (start.x! + end.x!) / 2 });
        }
        if ([...axes.values()].some(a => Math.abs(a.transverse - a.other) > 1e-6)) return;
        const axis = Math.max(...[...axes.values()].map(a => a.transverse)), step = source.grid.spacing;
        let cursor = 0;
        const parts = order.map(id => {
            const c = available.get(id)!, a = axes.get(id)!;
            const longitudinal = ids.length === 1 ? 0 : Math.ceil((cursor + a.longitudinal) / step) * step - a.longitudinal;
            const part = { ...c, x: vertical ? axis - a.transverse : longitudinal, y: vertical ? longitudinal : axis - a.transverse };
            cursor = longitudinal + (vertical ? c.height! : c.width!) + gap;
            return part;
        });
        let id = ids.length === 1 ? ids[0] : JSON.stringify(['junction-chain', ids]);
        if (ids.length > 1) { while (usedIds.has(id)) id += ':'; usedIds.add(id); }
        result.push({ id, members, parts, vertical,
            through: [key(order[0], ports.get(order[0])!.start!.id), key(order.at(-1)!, ports.get(order.at(-1)!)!.end!.id)],
            width: Math.max(...parts.map(c => c.x! + c.width!)), height: Math.max(...parts.map(c => c.y! + c.height!)),
            ports: parts.flatMap(c => c.ports!.map(p => ({ ...p, x: c.x! + (p.x ?? 0), y: c.y! + (p.y ?? 0) }))),
        });
    }
    return result;
}
