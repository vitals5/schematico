import type { ElkNode } from 'elkjs/lib/elk-api';
import type { LayoutSnapshot } from './types';

type Padding = { left: number; right: number; top: number; bottom: number };
type Planner = (children: ElkNode[], snapshot: LayoutSnapshot) => ElkNode | undefined;
const opposite = { top: 'bottom', bottom: 'top', left: 'right', right: 'left' } as const;

/** A bounded alternative for isolated conductive routing symbols. Keep the actual
 * junction and its wires; virtual edges are used only to arrange ordinary devices. */
export function junctionPlacement(children: ElkNode[], source: LayoutSnapshot, gap: number, padding: Padding, plan: Planner): ElkNode | undefined {
    const byId = new Map(source.nodes.map(n => [n.id, n]));
    const pins = new Map(source.nodes.flatMap(n => n.pins.map(p => [JSON.stringify([n.id, p.id]), p] as const)));
    const helpers = children.filter(c => {
        const n = byId.get(c.id);
        return n?.routingJunction && !n.fixed && n.pins.length <= 3 && n.joinedPins?.length === 1 &&
            n.pins.every(p => n.joinedPins![0].includes(p.id)) &&
            n.pins.some((p, i) => n.pins.slice(i + 1).some(q => p.direction === opposite[q.direction]));
    });
    if (!helpers.length) return;
    const helperIds = new Set(helpers.map(c => c.id));
    // Connected helper chains and nested/rigid interfaces retain the regular
    // candidate until their complete internal geometry can be placed together.
    if (source.edges.some(e => helperIds.has(e.from.componentId) && byId.get(e.to.componentId)?.routingJunction ||
        helperIds.has(e.to.componentId) && byId.get(e.from.componentId)?.routingJunction)) return;
    const core = children.filter(c => !helperIds.has(c.id));
    const owner = new Map(core.flatMap(c => (c.ports ?? []).map(p => [p.id, c.id] as const)));
    const endpointKey = (p: { componentId: string; pinId: string }) => JSON.stringify([p.componentId, p.pinId]);
    const original = source.edges.map((e, i) => ({ ...e, id: 'original-' + i }));
    const edges = original.filter(e => !helperIds.has(e.from.componentId) && !helperIds.has(e.to.componentId));
    const reservations: NonNullable<LayoutSnapshot['junctionSpaces']> = [];
    const neighbours = new Map<string, { own: string; other: string }[]>();
    for (const helper of helpers) {
        const contacts = original.flatMap(e => {
            const from = e.from.componentId === helper.id, to = e.to.componentId === helper.id;
            if (!from && !to) return [];
            const own = endpointKey(from ? e.from : e.to), other = endpointKey(from ? e.to : e.from);
            return owner.has(other) ? [{ own, other, endpoint: from ? e.to : e.from }] : [];
        });
        if (contacts.length < 2 || original.filter(e => e.from.componentId === helper.id || e.to.componentId === helper.id).length !== contacts.length) return;
        const unique = [...new Map(contacts.map(c => [c.other, c])).values()].sort((a, b) => a.other.localeCompare(b.other));
        const through = unique.flatMap((a, i) => unique.slice(i + 1).filter(b =>
            pins.get(a.own)?.direction === opposite[pins.get(b.own)!.direction] &&
            pins.get(a.other)?.direction === opposite[pins.get(b.other)!.direction]).map(b => [a, b] as const))[0];
        if (!through) return;
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
        reservations.push({ pins: unique.map(c => c.other), width: helper.width ?? 1, height: helper.height ?? 1, orderX, orderY });
        neighbours.set(helper.id, contacts);
    }
    const layout = plan(core, { ...source, edges, junctionSpaces: reservations });
    if (!layout?.children) return;
    const placed = new Map(layout.children.map(c => [c.id, c]));
    const result = [...layout.children];
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
        const fits = (c: ElkNode) => !result.some(n => c.x! < n.x! + n.width! + gap && c.x! + c.width! + gap > n.x! && c.y! < n.y! + n.height! + gap && c.y! + c.height! + gap > n.y!);
        const candidate = candidates.find(fits);
        if (!candidate) return;
        result.push(candidate);
    }
    return { ...layout, children: result, width: Math.max(...result.map(c => c.x! + c.width!)) + padding.right, height: Math.max(...result.map(c => c.y! + c.height!)) + padding.bottom };
}
