import type { ElkNode } from 'elkjs/lib/elk-api';
import type { LayoutSnapshot } from './types';
import { netIds } from './validate';

type Connection = { a: string; b: string; ac: string; bc: string };
/** Equal physical pitch for equivalent two-terminal paths between the same nets.
 * Only temporary node positions change; unequal paths and multipole banks retain
 * the existing serial-lane arrangement. */
export function spaceParallelBranches(rows: ElkNode[][], connections: Connection[], snapshot: LayoutSnapshot, gap: number, left: number): boolean {
    const nodes = rows.flat(), byId = new Map(nodes.map(n => [n.id, n]));
    const levels = new Map(rows.flatMap((r, i) => r.map(n => [n.id, i] as const)));
    const next = new Map<string, Set<string>>(), previous = new Map<string, Set<string>>();
    for (const e of connections) {
        if (!byId.has(e.ac) || !byId.has(e.bc) || levels.get(e.ac) === levels.get(e.bc)) continue;
        const [a, b] = levels.get(e.ac)! < levels.get(e.bc)! ? [e.ac, e.bc] : [e.bc, e.ac];
        if (!next.has(a)) next.set(a, new Set());
        if (!previous.has(b)) previous.set(b, new Set());
        next.get(a)!.add(b); previous.get(b)!.add(a);
    }
    const successor = new Map<string, string>(), predecessor = new Map<string, string>();
    for (const [a, bs] of next) if (bs.size === 1) {
        const b = [...bs][0];
        if (previous.get(b)?.size === 1) { successor.set(a, b); predecessor.set(b, a); }
    }
    const model = new Map(snapshot.nodes.map(n => [n.id, n])), nets = netIds(snapshot), pinNets = new Map<string, string>();
    const key = (id: string, pin: string) => JSON.stringify([id, pin]);
    for (const e of snapshot.edges) for (const end of [e.from, e.to]) pinNets.set(key(end.componentId, end.pinId), nets.get(e.id)!);
    const groups = new Map<string, { members: ElkNode[]; axis: number; local: Map<string, number> }[]>();
    for (const seed of nodes) {
        if (predecessor.has(seed.id) || !successor.has(seed.id)) continue;
        const members: ElkNode[] = [], seen = new Set<string>();
        for (let id: string | undefined = seed.id; id && !seen.has(id); id = successor.get(id)) { seen.add(id); members.push(byId.get(id)!); }
        if (members.some(c => {
            const n = model.get(c.id);
            return !n || n.fixed || n.routingJunction || n.pins.length !== 2 || !n.pins.some(p => p.direction === 'top') || !n.pins.some(p => p.direction === 'bottom') ||
                c.ports?.length !== 2 || Math.abs((c.ports[0].x ?? 0) - (c.ports[1].x ?? 0)) > 1e-6;
        })) continue;
        const first = model.get(seed.id)!, last = model.get(members.at(-1)!.id)!;
        const entry = pinNets.get(key(first.id, first.pins.find(p => p.direction === 'top')!.id));
        const exit = pinNets.get(key(last.id, last.pins.find(p => p.direction === 'bottom')!.id));
        if (!entry || !exit || entry === exit) continue;
        const local = new Map(members.map(c => [c.id, c.ports![0].x ?? 0]));
        const axis = seed.x! + local.get(seed.id)!;
        if (members.some(c => Math.abs(c.x! + local.get(c.id)! - axis) > 1e-6)) continue;
        const group = JSON.stringify([entry, exit, members.map(c => levels.get(c.id))]);
        if (!groups.has(group)) groups.set(group, []);
        groups.get(group)!.push({ members, axis, local });
    }
    let changed = false;
    for (const branches of groups.values()) {
        if (branches.length < 3) continue;
        branches.sort((a, b) => a.axis - b.axis || a.members[0].id.localeCompare(b.members[0].id));
        let pitch = (branches.at(-1)!.axis - branches[0].axis) / (branches.length - 1);
        for (let i = 1; i < branches.length; i++) for (let j = 0; j < branches[i].members.length; j++) {
            const a = branches[i - 1], b = branches[i], first = a.members[j], second = b.members[j];
            pitch = Math.max(pitch, (first.width ?? 1) - a.local.get(first.id)! + b.local.get(second.id)! + gap);
        }
        if (snapshot.grid.spacing > 0) pitch = Math.ceil(pitch / snapshot.grid.spacing) * snapshot.grid.spacing;
        let start = (branches[0].axis + branches.at(-1)!.axis - pitch * (branches.length - 1)) / 2;
        start = Math.max(start, ...branches.flatMap((b, i) => b.members.map(c => left + b.local.get(c.id)! - i * pitch)));
        const proposed = new Map(branches.flatMap((b, i) => b.members.map(c => [c.id, start + i * pitch - b.local.get(c.id)!] as const)));
        // A dedicated common feeder/return can follow the centre of its bank.
        // Further external wiring or fixed geometry disables this extra movement.
        for (const end of ['entry', 'exit'] as const) {
            const targets = new Set(branches.map(b => (end === 'entry' ? b.members[0] : b.members.at(-1)!).id));
            for (const dock of nodes) {
                const n = model.get(dock.id);
                if (proposed.has(dock.id) || !n || n.fixed || n.routingJunction) continue;
                const incident = snapshot.edges.filter(e => e.from.componentId === dock.id || e.to.componentId === dock.id);
                if (incident.length !== branches.length) continue;
                const contacts = incident.map(e => e.from.componentId === dock.id ? [e.from, e.to] : [e.to, e.from]);
                if (new Set(contacts.map(([, other]) => other.componentId)).size !== targets.size || contacts.some(([, other]) => !targets.has(other.componentId) ||
                    model.get(other.componentId)?.pins.find(p => p.id === other.pinId)?.direction !== (end === 'entry' ? 'top' : 'bottom'))) continue;
                const pinId = contacts[0][0].pinId;
                if (contacts.some(([own]) => own.pinId !== pinId) || n.pins.find(p => p.id === pinId)?.direction !== (end === 'entry' ? 'bottom' : 'top')) continue;
                const port = dock.ports?.find(p => p.id === key(dock.id, pinId));
                if (port) proposed.set(dock.id, start + pitch * (branches.length - 1) / 2 - (port.x ?? 0));
            }
        }
        // Independent neighbours and non-equivalent paths remain obstacles. Never
        // apply just part of a symmetric group when its envelope cannot fit.
        if (rows.some(row => row.some(c => proposed.has(c.id) && row.some(other => other !== c &&
            proposed.get(c.id)! < (proposed.get(other.id) ?? other.x!) + (other.width ?? 1) + gap - 1e-6 &&
            (proposed.get(other.id) ?? other.x!) < proposed.get(c.id)! + (c.width ?? 1) + gap - 1e-6)))) continue;
        for (const [id, x] of proposed) { if (Math.abs(byId.get(id)!.x! - x) > 1e-6) changed = true; byId.get(id)!.x = x; }
    }
    return changed;
}
