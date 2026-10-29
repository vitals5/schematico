import type { ElkNode } from 'elkjs/lib/elk-api';
import type { LayoutSnapshot } from './types';
import { junctionBlocks } from './junctionBlocks';

type Padding = { left: number; right: number; top: number; bottom: number };
const opposite = { top: 'bottom', bottom: 'top', left: 'right', right: 'left' } as const;
/** A bounded candidate for straight rails with facing perpendicular branches.
 * Branch subcircuits are arranged first; rail stations then follow their real pins. */
export function perpendicularRail(children: ElkNode[], source: LayoutSnapshot, gap: number, padding: Padding,
    plan: (core: ElkNode[], snapshot: LayoutSnapshot) => ElkNode | undefined): ElkNode | undefined {
    const nodes = new Map(source.nodes.map(n => [n.id, n]));
    if (children.some(c => nodes.get(c.id)?.fixed)) return;
    const selected = children.filter(c => {
        const n = nodes.get(c.id);
        return n?.routingJunction && !n.fixed && n.pins.length === 3 && n.joinedPins?.length === 1 && n.pins.every(p => n.joinedPins![0].includes(p.id));
    });
    if (!selected.length) return;
    const blocks = junctionBlocks(selected, source, gap);
    if (!blocks?.length || blocks.length > 2) return;
    if (blocks.length === 2) {
        // Paired supply/return rails are peeled from the outside inward. Both
        // original station orders remain constraints on the intervening paths.
        const side = (block: typeof blocks[number]) => nodes.get(block.parts[0].id)!.pins.find(p =>
            block.vertical ? ['left', 'right'].includes(p.direction) : ['top', 'bottom'].includes(p.direction))?.direction;
        const firstSide = side(blocks[0]), secondSide = side(blocks[1]);
        if (!firstSide || !secondSide || blocks[0].vertical !== blocks[1].vertical || firstSide !== opposite[secondSide]) return;
        blocks.sort((a, b) => Number(['left', 'top'].includes(side(a)!)) - Number(['left', 'top'].includes(side(b)!)));
    }
    const rail = blocks[0], originals = new Map(children.map(c => [c.id, c]));
    const owner = new Map(children.flatMap(c => (c.ports ?? []).map(p => [p.id, c.id] as const)));
    const pins = new Map(source.nodes.flatMap(n => n.pins.map(p => [JSON.stringify([n.id, p.id]), p] as const)));
    const key = (p: { componentId: string; pinId: string }) => JSON.stringify([p.componentId, p.pinId]);
    const endpoint = (encoded: string) => {
        const [componentId, pinId] = JSON.parse(encoded) as [string, string];
        return { componentId, pinId };
    };
    const contacts = source.edges.flatMap(e => {
        const from = rail.members.has(e.from.componentId), to = rail.members.has(e.to.componentId);
        if (from === to) return [];
        const own = key(from ? e.from : e.to), other = key(from ? e.to : e.from), id = owner.get(other);
        return [{ own, other, id }];
    });
    if (contacts.some(c => {
        const own = pins.get(c.own), other = pins.get(c.other);
        return !c.id || !nodes.has(c.id) || nodes.get(c.id)!.routingJunction || !own || !other || own.direction !== opposite[other.direction];
    })) return;
    const head = contacts.filter(c => c.own === rail.through[0]), tail = contacts.filter(c => c.own === rail.through[1]);
    if (head.length > 1 || tail.length > 1 || !head.length && !tail.length) return;
    const docks = [...head, ...tail];
    if (docks.some(c => source.edges.filter(e => e.from.componentId === c.id || e.to.componentId === c.id).length !== 1)) return;
    const dockIds = new Set(docks.map(c => c.id!));
    const branches = contacts.filter(c => !docks.includes(c));
    if (!branches.length || new Set(branches.map(c => c.id)).size !== branches.length || branches.some(c => dockIds.has(c.id!))) return;
    const direction = pins.get(branches[0].own)!.direction;
    if ((rail.vertical ? !['left', 'right'].includes(direction) : !['top', 'bottom'].includes(direction)) || branches.some(c => pins.get(c.own)!.direction !== direction)) return;
    // One measured station per consumer. Spare or multiply wired side arms keep
    // the regular candidate until an unambiguous station assignment is available.
    if (rail.parts.some(p => branches.filter(c => JSON.parse(c.own)[0] === p.id).length !== 1)) return;
    const long = (p: { x?: number; y?: number }) => (rail.vertical ? p.y : p.x) ?? 0;
    const cross = (p: { x?: number; y?: number }) => (rail.vertical ? p.x : p.y) ?? 0;
    const length = (c: ElkNode) => (rail.vertical ? c.height : c.width) ?? 1;
    const thickness = (c: ElkNode) => (rail.vertical ? c.width : c.height) ?? 1;
    const at = (c: ElkNode, l: number, t: number): ElkNode => ({ ...c, x: rail.vertical ? t : l, y: rail.vertical ? l : t });
    branches.sort((a, b) => long(rail.ports!.find(p => p.id === a.own)!) - long(rail.ports!.find(p => p.id === b.own)!));
    const inflation = new Map<string, number>();
    const core = children.filter(c => !rail.members.has(c.id) && !dockIds.has(c.id)).map(c => {
        const branch = branches.find(b => b.id === c.id);
        if (!branch) return c;
        const part = originals.get(JSON.parse(branch.own)[0])!, own = part.ports!.find(p => p.id === branch.own)!, other = c.ports!.find(p => p.id === branch.other)!;
        const before = Math.max(0, long(own) - long(other));
        const after = Math.max(0, length(part) - long(own) - length(c) + long(other));
        inflation.set(c.id, before);
        return { ...c, width: rail.vertical ? c.width : length(c) + before + after, height: rail.vertical ? length(c) + before + after : c.height,
            ports: c.ports!.map(p => ({ ...p, x: rail.vertical ? p.x : (p.x ?? 0) + before, y: rail.vertical ? (p.y ?? 0) + before : p.y })) };
    });
    const order: [string, string][] = branches.slice(1).map((c, i) => [branches[i].other, c.other]);
    const edges = source.edges.filter(e => !rail.members.has(e.from.componentId) && !rail.members.has(e.to.componentId) && !dockIds.has(e.from.componentId) && !dockIds.has(e.to.componentId))
        .map((e, i) => ({ ...e, id: 'rail-original-' + i }));
    // Same-net planning edges align branch entrances; no virtual wire is applied.
    for (let i = 1; i < branches.length; i++) edges.push({ id: 'rail-order-' + i, from: endpoint(branches[0].other),
        to: endpoint(branches[i].other), potential: '', points: [], alignAxis: false });
    const planning: LayoutSnapshot = { ...source, edges, planningAxis: rail.vertical ? 'horizontal' : 'vertical',
        junctionSpaces: [...(source.junctionSpaces ?? []), { pins: branches.map(c => c.other), width: 0, height: 0, reserve: false, orderX: rail.vertical ? [] : order, orderY: rail.vertical ? order : [] }] };
    const layout = blocks.length === 2 ? perpendicularRail(core, planning, gap, padding, plan) : plan(core, planning);
    if (!layout?.children) return;
    const placed = layout.children.map(c => {
        const old = originals.get(c.id)!;
        return inflation.has(c.id) ? { ...at(c, long(c) + inflation.get(c.id)!, cross(c)), width: old.width, height: old.height, ports: old.ports } : c;
    });
    const byId = new Map(placed.map(c => [c.id, c]));
    const targets = branches.map(c => {
        const n = byId.get(c.id!)!, p = n.ports!.find(p => p.id === c.other)!;
        return { branch: c, part: originals.get(JSON.parse(c.own)[0])!, station: long(n) + long(p), entrance: cross(n) + cross(p) };
    });
    if (targets.some(t => Math.abs(t.entrance - targets[0].entrance) > 1e-6)) return;
    const dockAxis = docks.map(c => cross(originals.get(c.id!)!.ports!.find(p => p.id === c.other)!));
    const partAxis = targets.map(t => cross(t.part.ports!.find(p => pins.get(p.id)!.direction === (rail.vertical ? 'top' : 'left'))!));
    const positive = direction === 'right' || direction === 'bottom';
    const axis = positive ? (rail.vertical ? padding.left : padding.top) + Math.max(...dockAxis, ...partAxis)
        : Math.max(...placed.map(c => cross(c) + thickness(c))) + gap + Math.max(...dockAxis, ...partAxis);
    const stations = targets.map((t, i) => at(t.part, t.station - long(t.part.ports!.find(p => p.id === t.branch.own)!), axis - partAxis[i]));
    if (stations.some((c, i) => i > 0 && long(c) < long(stations[i - 1]) + length(stations[i - 1]) + gap - 1e-6)) return;
    const band = [...stations];
    for (const c of docks) {
        const node = originals.get(c.id!)!, p = node.ports!.find(p => p.id === c.other)!;
        band.push(at(node, head.includes(c) ? long(stations[0]) - gap - length(node) : long(stations.at(-1)!) + length(stations.at(-1)!) + gap, axis - cross(p)));
    }
    const offset = positive ? Math.max(...band.map(c => cross(c) + thickness(c))) + gap - Math.min(...placed.map(c => cross(c))) : 0;
    let result = [...placed.map(c => at(c, long(c), cross(c) + offset)), ...band];
    const shift = Math.max(0, (rail.vertical ? padding.top : padding.left) - Math.min(...result.map(long)));
    result = result.map(c => at(c, long(c) + shift, cross(c)));
    return { ...layout, children: result, width: Math.max(...result.map(c => c.x! + c.width!)) + padding.right, height: Math.max(...result.map(c => c.y! + c.height!)) + padding.bottom };
}
