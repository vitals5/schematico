import type { LayoutSnapshot, Point } from './types';

/** Reserve space for transverse bends between serial device levels. This is a
 * placement estimate; the router and validator still decide actual feasibility. */
export interface ChannelSpan {
    start: number;
    end: number;
    net: string;
    bank?: string;
    destinationBank?: string;
}

export function channelGap(spans: ChannelSpan[], clearance: number, minimum: number): number {
    const step = Math.max(2, clearance);
    const tracks: ChannelSpan[][] = [];
    const banks = new Map<string, { left: Set<string>; right: Set<string> }>();
    for (const span of spans
        .filter(s => Math.abs(s.end - s.start) > 1e-6)
        .map(s => ({ ...s, start: Math.min(s.start, s.end), end: Math.max(s.start, s.end) }))
        .sort((a, b) => a.start - b.start || a.end - b.end || a.net.localeCompare(b.net))) {
        // Separate nets need separate tracks wherever their bends overlap or touch.
        // Branches of the same actual net can share a track; potential names alone
        // never imply connectivity. Disjoint spans reuse space on the same track.
        const track = tracks.find(t => t.every(s => s.net === span.net ||
            span.start - s.end >= step - 1e-6 || s.start - span.end >= step - 1e-6));
        if (track) track.push(span);
        else tracks.push([span]);
    }
    for (const span of spans.filter(s => Math.abs(s.end - s.start) > 1e-6)) for (const key of [span.bank && 'from:' + span.bank, span.destinationBank && 'to:' + span.destinationBank].filter(Boolean) as string[]) {
        const bank = banks.get(key) ?? { left: new Set<string>(), right: new Set<string>() };
        (span.end < span.start ? bank.left : bank.right).add(span.net);
        banks.set(key, bank);
    }
    // Fan-outs also need nested bend order to avoid crossing their own vertical
    // drops. Interval colouring alone underestimates this when intervals form a chain.
    const demand = Math.max(tracks.length, ...[...banks.values()].map(b => Math.max(b.left.size, b.right.size)));
    // Leave one extra interval for entry/exit stubs and grid rounding.
    return Math.max(minimum, demand ? (demand + 1) * step : 0);
}

/** Recognize ordered fan-outs geometrically, without interpreting device roles.
 * Route their outer conductors first and bend near the narrower port bank. */
export function fanoutPreferences(s: LayoutSnapshot): Map<string, { group: string; reach: number; origin: Point; vertical: boolean }> {
    const nodes = new Map(s.nodes.map(n => [n.id, n]));
    type Entry = { id: string; hub: Point; remote: Point; vertical: boolean };
    const groups = new Map<string, Entry[]>();
    for (const e of s.edges) for (const [hub, remote] of [[e.from, e.to], [e.to, e.from]]) {
        const a = nodes.get(hub.componentId)?.pins.find(p => p.id === hub.pinId);
        const b = nodes.get(remote.componentId)?.pins.find(p => p.id === remote.pinId);
        if (!a || !b) continue;
        const vertical = a.direction === 'top' || a.direction === 'bottom';
        const opposite = { top: 'bottom', bottom: 'top', left: 'right', right: 'left' } as const;
        if (b.direction !== opposite[a.direction]) continue;
        const distance = vertical ? b.y - a.y : b.x - a.x;
        if (distance * (a.direction === 'bottom' || a.direction === 'right' ? 1 : -1) <= 0) continue;
        const key = JSON.stringify([hub.componentId, a.direction, vertical ? a.y : a.x, vertical ? b.y : b.x]);
        groups.set(key, [...(groups.get(key) ?? []), { id: e.id, hub: a, remote: b, vertical }]);
    }
    const result = new Map<string, { group: string; reach: number; origin: Point; vertical: boolean }>();
    for (const [group, entries] of groups) {
        if (entries.length < 3) continue;
        const coordinate = (p: Point) => entries[0].vertical ? p.x : p.y;
        const span = (points: Point[]) => Math.max(...points.map(coordinate)) - Math.min(...points.map(coordinate));
        if (span(entries.map(e => e.remote)) <= span(entries.map(e => e.hub)) + 1e-6) continue;
        const ordered = [...entries].sort((a, b) => coordinate(a.hub) - coordinate(b.hub) || coordinate(a.remote) - coordinate(b.remote) || a.id.localeCompare(b.id));
        if (ordered.some((e, i) => i > 0 && coordinate(e.remote) < coordinate(ordered[i - 1].remote) - 1e-6)) continue;
        for (const e of entries) result.set(e.id, { group, reach: Math.abs(coordinate(e.remote) - coordinate(e.hub)), origin: e.hub, vertical: e.vertical });
    }
    return result;
}
