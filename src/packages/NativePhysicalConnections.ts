import { PinDefinition, Wire } from '../model/types';
import { Point } from './NativeSymbolLibrary';

export type NativePort = {
  key: string;
  endpoint: Wire['from'];
  point: Point;
  direction: PinDefinition['direction'];
  /** Only routing nodes electrically join their ports, never arbitrary devices. */
  junction?: string;
  /** Automatic routing cache nodes need at least two attached directions. */
  routing?: boolean;
  potential?: Wire['potential'];
};
const opposite = { top: 'bottom', bottom: 'top', left: 'right', right: 'left' } as const;
const epsilon = 1e-6;

function rayDistance(a: NativePort, b: NativePort): number {
  if (a.endpoint.componentId === b.endpoint.componentId) return Infinity;
  const vertical = a.direction === 'top' || a.direction === 'bottom';
  if (vertical !== (b.direction === 'top' || b.direction === 'bottom')) return Infinity;
  const dx = b.point.x - a.point.x, dy = b.point.y - a.point.y;
  if (Math.abs(vertical ? dx : dy) > epsilon) return Infinity;
  const forward = a.direction === 'top' ? dy : a.direction === 'bottom' ? -dy : a.direction === 'right' ? dx : -dx;
  return forward > epsilon ? forward : Infinity;
}

/** native CAD's Connection table is a cached endpoint netlist, not a drawing polyline.
 * Reconstruct the printed automatic runs between adjacent facing library ports.
 * A same-axis port blocks the ray even if it faces away; crossings without a
 * port in that axis do not create a junction. Coordinates remain unrounded.
 */
export function physicalConnections(ports: NativePort[], netlist: Wire[], pageId: number, lineWidth: number): Wire[] {
  const findRuns = (ports: NativePort[]): [NativePort, NativePort][] => {
    const nearest = new Map<string, NativePort[]>();
    for (const a of ports) {
      let distance = Infinity;
      const targets: NativePort[] = [];
      for (const b of ports) {
        const forward = rayDistance(a, b);
        if (!Number.isFinite(forward) || forward > distance + epsilon) continue;
        if (forward < distance - epsilon) { distance = forward; targets.length = 0; }
        targets.push(b);
      }
      nearest.set(a.key, targets.filter(b => b.direction === opposite[a.direction]));
    }
    const runs: [NativePort, NativePort][] = [];
    for (const a of ports) for (const b of nearest.get(a.key) ?? []) {
      if (a.key >= b.key || !nearest.get(b.key)?.includes(a)) continue;
      runs.push([a, b]);
    }

    return runs;
  };
  // A cached corner with an unsupported outward direction must not block
  // a valid corner behind it. Check ray support before nearest-neighbour
  // pairing, so a stale nearer node cannot make the live node look dangling.
  while (true) {
    const supported = new Map<string, number>();
    for (const a of ports) if (a.routing) {
      const targets = ports.map(b => ({ port: b, distance: rayDistance(a, b) }))
        .filter(b => Number.isFinite(b.distance));
      // An actual device port blocks the ray even if it faces the wrong way.
      // Only other automatic routing-cache ports may be looked past here.
      const barrier = Math.min(Infinity, ...targets.filter(b => !b.port.routing).map(b => b.distance));
      if (targets.some(b => b.port.direction === opposite[a.direction] && b.distance <= barrier + epsilon))
        supported.set(a.endpoint.componentId, (supported.get(a.endpoint.componentId) ?? 0) + 1);
    }
    const dead = new Set(ports.filter(p => p.routing && (supported.get(p.endpoint.componentId) ?? 0) < 2)
      .map(p => p.endpoint.componentId));
    if (!dead.size) break;
    ports = ports.filter(p => !dead.has(p.endpoint.componentId));
  }
  let runs = findRuns(ports);
  while (true) {
    const attached = new Set(runs.flatMap(([a, b]) => [a.key, b.key]));
    const degree = new Map<string, number>();
    for (const p of ports) if (attached.has(p.key))
      degree.set(p.endpoint.componentId, (degree.get(p.endpoint.componentId) ?? 0) + 1);
    // A one-ended cache node can itself hide a live corner. Only discard it
    // when its unused ray is blocked by a real device or a fully usable node;
    // otherwise wait for the blocking stale node to be removed first.
    const dead = new Set(ports.filter(a => {
      if (!a.routing || (degree.get(a.endpoint.componentId) ?? 0) >= 2 || attached.has(a.key)) return false;
      const targets = ports.map(b => ({ port: b, distance: rayDistance(a, b) })).filter(b => Number.isFinite(b.distance));
      const nearest = Math.min(Infinity, ...targets.map(b => b.distance));
      return targets.some(b => b.distance <= nearest + epsilon
        && (!b.port.routing || (degree.get(b.port.endpoint.componentId) ?? 0) >= 2));
    }).map(p => p.endpoint.componentId));
    if (!dead.size) break;
    ports = ports.filter(p => !dead.has(p.endpoint.componentId));
    runs = findRuns(ports);
  }

  // Transfer net properties through actual routing junctions. No device's
  // separate poles are shorted together to infer a potential or a drawn edge.
  const parent = new Map(ports.map(p => [p.key, p.key]));
  const root = (key: string): string => {
    const next = parent.get(key)!;
    if (next !== key) parent.set(key, root(next));
    return parent.get(key)!;
  };
  const join = (a: string, b: string) => parent.set(root(a), root(b));
  const junctions = new Map<string, string>();
  for (const p of ports) if (p.junction) {
    const first = junctions.get(p.junction);
    if (first) join(p.key, first); else junctions.set(p.junction, p.key);
  }
  for (const [a, b] of runs) join(a.key, b.key);
  const endpointKey = (ep: Wire['from']) => `${ep.componentId}:${ep.pinId}`;
  const byEndpoint = new Map(ports.map(p => [endpointKey(p.endpoint), p]));
  const colors = new Map<string, Set<string>>(), sections = new Map<string, Set<string>>(), potentials = new Map<string, Set<Wire['potential']>>();
  const seed = <T>(map: Map<string, Set<T>>, key: string, value: T | undefined) => {
    if (!value) return;
    if (!map.has(key)) map.set(key, new Set());
    map.get(key)!.add(value);
  };
  for (const p of ports) seed(potentials, root(p.key), p.potential);
  for (const wire of netlist) for (const endpoint of [wire.from, wire.to]) {
    const p = byEndpoint.get(endpointKey(endpoint));
    if (p) { seed(colors, root(p.key), wire.color); seed(sections, root(p.key), wire.crossSection); }
  }
  const unique = <T>(values: Set<T> | undefined): T | undefined => values?.size === 1 ? [...values][0] : undefined;
  const live = new Set(ports.filter(p => !p.junction).map(p => root(p.key)));
  return runs.filter(([a]) => live.has(root(a.key))).map(([a, b]) => ({
    id: `native_run_${pageId}_${a.key}_${b.key}`, from: a.endpoint, to: b.endpoint,
    potential: unique(potentials.get(root(a.key))) ?? 'Signal', lineWidth,
    color: unique(colors.get(root(a.key))), crossSection: unique(sections.get(root(a.key)))
  }));
}
