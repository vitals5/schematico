import type { ElkNode } from 'elkjs/lib/elk-api';
import type { LayoutSnapshot } from './types';
import { junctionBlocks } from './junctionBlocks';

type Padding = { left: number; right: number; top: number; bottom: number };
type Planner = (children: ElkNode[], snapshot: LayoutSnapshot) => ElkNode | undefined;
const opposite = { top: 'bottom', bottom: 'top', left: 'right', right: 'left' } as const;

/** A bounded alternative for conductive routing symbols and straight chains. Keep the actual
 * junction and its wires; virtual edges are used only to arrange ordinary devices. */
export function junctionPlacement(children: ElkNode[], source: LayoutSnapshot, gap: number, padding: Padding, plan: Planner): ElkNode | undefined {
    const byId = new Map(source.nodes.map(n => [n.id, n]));
    const pins = new Map(source.nodes.flatMap(n => n.pins.map(p => [JSON.stringify([n.id, p.id]), p] as const)));
    const selected = children.filter(c => {
        const n = byId.get(c.id);
        return n?.routingJunction && !n.fixed && n.pins.length <= 3 && n.joinedPins?.length === 1 &&
            n.pins.every(p => n.joinedPins![0].includes(p.id)) &&
            n.pins.some((p, i) => n.pins.slice(i + 1).some(q => p.direction === opposite[q.direction]));
    });
    if (!selected.length) return;
    const helperIds = new Set(selected.map(c => c.id));
    if (source.edges.some(e => helperIds.has(e.from.componentId) && byId.get(e.to.componentId)?.routingJunction && !helperIds.has(e.to.componentId) ||
        helperIds.has(e.to.componentId) && byId.get(e.from.componentId)?.routingJunction && !helperIds.has(e.from.componentId))) return;
    const helpers = junctionBlocks(selected, source, gap);
    if (!helpers) return;
    const core = children.filter(c => !helperIds.has(c.id));
    const owner = new Map(core.flatMap(c => (c.ports ?? []).map(p => [p.id, c.id] as const)));
    const endpointKey = (p: { componentId: string; pinId: string }) => JSON.stringify([p.componentId, p.pinId]);
    const original = source.edges.map((e, i) => ({ ...e, id: 'original-' + i }));
    const edges = original.filter(e => !helperIds.has(e.from.componentId) && !helperIds.has(e.to.componentId));
    const reservations: NonNullable<LayoutSnapshot['junctionSpaces']> = [];
    const neighbours = new Map<string, { own: string; other: string }[]>();
    for (const helper of helpers) {
        const contacts = original.flatMap(e => {
            const from = helper.members.has(e.from.componentId), to = helper.members.has(e.to.componentId);
            if (from === to) return [];
            const own = endpointKey(from ? e.from : e.to), other = endpointKey(from ? e.to : e.from);
            return owner.has(other) ? [{ own, other, endpoint: from ? e.to : e.from }] : [];
        });
        if (contacts.length < 2 || original.filter(e => helper.members.has(e.from.componentId) !== helper.members.has(e.to.componentId)).length !== contacts.length) return;
        const unique = [...new Map(contacts.map(c => [c.other, c])).values()].sort((a, b) => a.other.localeCompare(b.other));
        const start = unique.find(c => c.own === helper.through[0]), end = unique.find(c => c.own === helper.through[1]);
        if (!start || !end || pins.get(start.other)!.direction !== opposite[pins.get(end.other)!.direction]) return;
        const through = [start, end];
        edges.push({ id: 'virtual-' + helper.id + '-through', from: through[0].endpoint, to: through[1].endpoint, potential: '', points: [] });
        const orderX: [string, string][] = [], orderY: [string, string][] = [];
        for (const contact of unique.filter(c => !through.includes(c))) {
            const peer = through.find(c => pins.get(c.other)!.direction === pins.get(contact.other)!.direction);
            if (!peer) return;
            edges.push({ id: 'virtual-' + helper.id + '-' + contact.other, from: peer.endpoint, to: contact.endpoint, potential: '', points: [] });
            const a = helper.ports!.find(p => p.id === peer.own)!, b = helper.ports!.find(p => p.id === contact.own)!;
            if (Math.abs((a.x ?? 0) - (b.x ?? 0)) > 1e-6) orderX.push((a.x ?? 0) < (b.x ?? 0) ? [peer.other, contact.other] : [contact.other, peer.other]);
            if (Math.abs((a.y ?? 0) - (b.y ?? 0)) > 1e-6) orderY.push((a.y ?? 0) < (b.y ?? 0) ? [peer.other, contact.other] : [contact.other, peer.other]);
        }
        // Along one side of a rail, upstream branches run to the outer columns.
        // This avoids crossings when several side arms share a transverse axis.
        for (const [i, a] of unique.entries()) for (const b of unique.slice(i + 1)) {
            const direction = pins.get(a.own)!.direction;
            if (direction !== pins.get(b.own)!.direction || pins.get(a.other)!.direction !== pins.get(b.other)!.direction) continue;
            const ap = helper.ports!.find(p => p.id === a.own)!, bp = helper.ports!.find(p => p.id === b.own)!;
            if (helper.vertical && (direction === 'left' || direction === 'right') && Math.abs(ap.y! - bp.y!) > 1e-6)
                orderX.push((direction === 'left' ? ap.y! < bp.y! : ap.y! > bp.y!) ? [a.other, b.other] : [b.other, a.other]);
            if (!helper.vertical && (direction === 'top' || direction === 'bottom') && Math.abs(ap.x! - bp.x!) > 1e-6)
                orderY.push((direction === 'top' ? ap.x! < bp.x! : ap.x! > bp.x!) ? [a.other, b.other] : [b.other, a.other]);
        }
        reservations.push({ pins: unique.map(c => c.other), width: helper.width ?? 1, height: helper.height ?? 1, orderX, orderY });
        neighbours.set(helper.id, contacts);
    }
    const layout = plan(core, { ...source, edges, junctionSpaces: reservations });
    if (!layout?.children) return;
    const placed = new Map(layout.children.map(c => [c.id, c]));
    const result = [...layout.children];
    const occupied = [...layout.children];
    for (const helper of [...helpers].sort((a, b) => a.id.localeCompare(b.id))) {
        const contacts = neighbours.get(helper.id)!.map(c => {
            const node = placed.get(owner.get(c.other)!)!, own = helper.ports?.find(p => p.id === c.own), other = node?.ports?.find(p => p.id === c.other);
            return own && other ? { own, node, direction: pins.get(c.other)!.direction, x: node.x! + (other.x ?? 0), y: node.y! + (other.y ?? 0) } : undefined;
        }).filter(c => c !== undefined).sort((a, b) => {
            return Number(pins.get(a.own.id)!.direction !== opposite[a.direction]) - Number(pins.get(b.own.id)!.direction !== opposite[b.direction]) || a.own.id.localeCompare(b.own.id);
        });
        const vertical = contacts.some(c => c.direction === 'bottom') && contacts.some(c => c.direction === 'top');
        const horizontal = contacts.some(c => c.direction === 'right') && contacts.some(c => c.direction === 'left');
        if (!vertical && !horizontal) return;
        const before = contacts.filter(c => c.direction === (vertical ? 'bottom' : 'right'));
        const after = contacts.filter(c => c.direction === (vertical ? 'top' : 'left'));
        const lower = Math.max(...before.map(c => vertical ? c.node.y! + c.node.height! : c.node.x! + c.node.width!)) + gap;
        const upper = Math.min(...after.map(c => vertical ? c.node.y! : c.node.x!)) - gap - (vertical ? helper.height! : helper.width!);
        if (upper < lower - 1e-6) return;
        // Prefer a facing downstream port, then the upstream axis; no symbol rotation.
        const aligned = [...after, ...before].map(c => vertical ? c.x - (c.own.x ?? 0) : c.y - (c.own.y ?? 0));
        const candidates = aligned.map(axis => ({ ...helper, x: vertical ? Math.max(padding.left, axis) : (lower + upper) / 2, y: vertical ? (lower + upper) / 2 : Math.max(padding.top, axis) }));
        const fits = (c: ElkNode) => !occupied.some(n => c.x! < n.x! + n.width! + gap && c.x! + c.width! + gap > n.x! && c.y! < n.y! + n.height! + gap && c.y! + c.height! + gap > n.y!);
        const candidate = candidates.find(fits);
        if (!candidate) return;
        occupied.push(candidate);
        result.push(...helper.parts.map(c => ({ ...c, x: candidate.x! + c.x!, y: candidate.y! + c.y! })));
    }
    return { ...layout, children: result, width: Math.max(...result.map(c => c.x! + c.width!)) + padding.right, height: Math.max(...result.map(c => c.y! + c.height!)) + padding.bottom };
}
