import { ProjectIndex, interruptionTag, type IndexedComponent, type IndexedPin, type IndexedConnection } from './ProjectIndex';
import { electricalDefinition, electricalPinGroups, type ElectricalKnowledge } from './ElectricalDefinition';
import { isConnectionSymbol, isInterruptionSymbol } from './ConnectionSymbols';
import { PortGraph } from './PortGraph';
import type { PinDefinition, Project } from './types';

export const portIdentity = (pin: IndexedPin): string => JSON.stringify([pin.owner.component.id, pin.id]);
export interface ElectricalNet {
  /** Derived conductor identity anchored to a real endpoint, never to its name or geometry. */
  id: string;
  ports: IndexedPin[];
  connections: IndexedConnection[];
  potentialNames: string[];
  referenceNames: string[];
  roles: NonNullable<PinDefinition['electricalRole']>[];
  knowledgeIncomplete: boolean;
}
export interface ElectricalIssue {
  id: string;
  code: 'invalid_endpoint' | 'invalid_internal_group' | 'neutral_pe_connection';
  pageId: string;
  componentId?: string;
  wireId?: string;
  pinIds?: string[];
  netId?: string;
}
type Link = { from: string; to: string; kind: 'wire' | 'permanent' | 'reference'; connection?: IndexedConnection };

/** Static conductor topology, not a simulation of energised equipment or switch
 * states. Build after edits, alongside the operation-scoped ProjectIndex. */
export class ElectricalNetService {
  readonly nets: ElectricalNet[] = [];
  readonly issues: ElectricalIssue[] = [];
  readonly knowledge = new Map<IndexedComponent, ElectricalKnowledge>();
  private ports = new Map<string, IndexedPin>();
  private graph = new PortGraph();
  private adjacency = new Map<string, Link[]>();
  private byPort = new Map<string, ElectricalNet>();
  private validConnections = new Set<IndexedConnection>();
  private incomplete = new Set<IndexedComponent>();

  constructor(readonly index: ProjectIndex) {
    for (const entry of index.components) {
      this.knowledge.set(entry, entry.symbol ? electricalDefinition(entry.symbol).knowledge : 'unknown');
      // Component IDs are the portable endpoint identity. Ambiguity must not
      // silently connect two placements, even if a local wire could pick one.
      if (index.componentsById.get(entry.component.id)?.length !== 1) continue;
      for (const pin of index.pinsFor(entry)) {
        const key = portIdentity(pin);
        this.ports.set(key, pin);
        this.graph.add(key);
        this.adjacency.set(key, []);
      }
    }
    for (const entry of index.components) {
      if (!entry.symbol) continue;
      const definition = electricalPinGroups(entry.symbol);
      if(definition.invalid.length) this.incomplete.add(entry);
      for (const invalid of definition.invalid) this.issues.push({
        id: JSON.stringify(['invalid_internal_group', entry.component.id, invalid.kind, invalid.pins]),
        code: 'invalid_internal_group', pageId: entry.page.id, componentId: entry.component.id, pinIds: invalid.pins });
      // Validate whole groups; never turn a malformed group into a partial short.
      const validate = (group: string[], kind: string): boolean => {
        const valid = Array.isArray(group) && group.length > 0 && group.every(id =>
          typeof id === 'string' && !!entry.symbol?.pins.some(p => p.id === id)
            && this.ports.has(JSON.stringify([entry.component.id, id])));
        if (!valid) this.issues.push({ id: JSON.stringify(['invalid_internal_group', entry.component.id, kind, group]),
          code: 'invalid_internal_group', pageId: entry.page.id, componentId: entry.component.id,
          pinIds: Array.isArray(group) ? group : [] });
        return valid;
      };
      for (const group of definition.permanent) if (validate(group, 'permanent')) {
        const keys = group.map(id => JSON.stringify([entry.component.id, id]));
        for (const key of keys.slice(1)) this.link(keys[0], key, 'permanent');
      }
      for (const group of definition.conditional) validate(group, 'conditional');
    }
    for (const connection of index.connections) {
      const { from, to, wire } = connection;
      const undeclared=(pin:IndexedPin|undefined)=>pin?.owner.symbol&&!pin.owner.symbol.unresolved&&!pin.definition;
      if (!from || !to || undeclared(from) || undeclared(to) || this.ports.get(portIdentity(from)) !== from || this.ports.get(portIdentity(to)) !== to) {
        const owner = from?.owner ?? to?.owner;
        this.issues.push({ id: JSON.stringify(['invalid_endpoint', connection.page?.id, wire.id, wire.from, wire.to]),
          code: 'invalid_endpoint', pageId: connection.page?.id ?? owner?.page.id ?? index.project.pages[0]?.id ?? '',
          componentId: owner?.component.id, wireId: wire.id });
        continue;
      }
      this.validConnections.add(connection);
      this.link(portIdentity(from), portIdentity(to), 'wire', connection);
    }
    // Named interruption symbols declare a signal continuation. Ordinary wire
    // potential strings and device/contact reference strings do not create edges.
    for (const entries of index.referenceGroups.values()) {
      const arrows = entries.filter(e => e.symbol && isInterruptionSymbol(e.symbol)
        && this.knowledge.get(e) !== 'unknown'
        && interruptionTag(e.component) && interruptionTag(e.component) !== '/'
        && !interruptionTag(e.component).startsWith('PF'));
      const representatives = arrows.map(e => this.joinedRepresentative(e)).filter((p): p is IndexedPin => !!p);
      for (const pin of representatives.slice(1)) this.link(portIdentity(representatives[0]), portIdentity(pin), 'reference');
    }
    for (const members of this.graph.groups().values()) {
      const ports = members.map(key => this.ports.get(key)!);
      const anchors = ports.filter(pin => !pin.owner.symbol || !isConnectionSymbol(pin.owner.symbol));
      const id = (anchors.length ? anchors : ports).map(portIdentity).sort()[0];
      const net: ElectricalNet = { id, ports, connections: [], potentialNames: [], referenceNames: [],
        roles: [...new Set(ports.map(p => p.role))].sort(),
        knowledgeIncomplete: ports.some(p => !p.definition || this.knowledge.get(p.owner) === 'unknown' || this.incomplete.has(p.owner)) };
      this.nets.push(net);
      for (const key of members) this.byPort.set(key, net);
    }
    for (const connection of this.validConnections) this.netForPin(connection.from!)!.connections.push(connection);
    for (const net of this.nets) {
      net.potentialNames = [...new Set(net.connections.map(c => (c.wire.potential ?? '').trim()).filter(Boolean))].sort();
      net.referenceNames = [...new Set(net.ports.filter(p => p.owner.symbol && isInterruptionSymbol(p.owner.symbol))
        .map(p => interruptionTag(p.owner.component)).filter(Boolean))].sort();
      if (net.roles.includes('neutral') && net.roles.includes('protective_earth')) {
        const pin = net.ports.find(p => p.role === 'neutral')!;
        this.issues.push({ id: JSON.stringify(['neutral_pe_connection', net.id]), code: 'neutral_pe_connection',
          pageId: pin.owner.page.id, componentId: pin.owner.component.id, netId: net.id });
      }
    }
    this.nets.sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  }

  netForPin(pin: IndexedPin): ElectricalNet | undefined { return this.byPort.get(portIdentity(pin)); }
  /** Compare all original ports, including isolated ones; extra routing helpers
   * may subdivide conductors but cannot join or disconnect retained contacts. */
  partition(retained: ReadonlySet<string>): string {
    return JSON.stringify(this.nets.map(net=>net.ports.map(portIdentity).filter(key=>retained.has(key)).sort())
      .filter(group=>group.length).sort((a,b)=>JSON.stringify(a)<JSON.stringify(b)?-1:1));
  }
  hasConnection(pin: IndexedPin): boolean {
    return this.adjacency.get(portIdentity(pin))?.some(link => link.kind === 'wire') ?? false;
  }
  /** A permanent terminal bridge can make another port of this same conductor
   * usable; an isolated internal group alone is not an external connection. */
  hasConductiveConnection(pin: IndexedPin): boolean {
    return !!this.netForPin(pin)?.connections.length;
  }

  /** Follow one terminal side through routing pieces and sheet continuations.
   * Stop at real equipment (including the next terminal), and never cross the
   * source terminal's own internal bridge to mix its two report columns. */
  traceTargets(start: IndexedPin): { targets: IndexedPin[]; connections: IndexedConnection[] } {
    const startKey = portIdentity(start), seen = new Set<string>(), queue = [startKey];
    const targets: IndexedPin[] = [], connections = new Set<IndexedConnection>();
    if (!this.ports.has(startKey)) return { targets, connections: [] };
    for (let i = 0; i < queue.length; i++) {
      const key = queue[i];
      if (seen.has(key)) continue;
      seen.add(key);
      const pin = this.ports.get(key)!;
      if (pin.owner !== start.owner && (!pin.owner.symbol || !isConnectionSymbol(pin.owner.symbol))) {
        targets.push(pin);
        continue;
      }
      for (const link of this.adjacency.get(key) ?? []) {
        const next = link.from === key ? link.to : link.from;
        if (this.ports.get(next)!.owner === start.owner && next !== startKey) continue;
        if (link.connection) connections.add(link.connection);
        if (!seen.has(next)) queue.push(next);
      }
    }
    return { targets: targets.sort((a, b) => portIdentity(a) < portIdentity(b) ? -1 : 1), connections: [...connections] };
  }

  private joinedRepresentative(entry: IndexedComponent): IndexedPin | undefined {
    const pins = this.index.pinsFor(entry);
    if (!pins.length || pins.some(p => this.ports.get(portIdentity(p)) !== p)) return;
    // An explicit multi-circuit interruption symbol is ambiguous: do not short it.
    if (pins.some(p => this.graph.root(portIdentity(p)) !== this.graph.root(portIdentity(pins[0])))) return;
    return pins[0];
  }

  private link(from: string, to: string, kind: Link['kind'], connection?: IndexedConnection): void {
    this.graph.join(from, to);
    const link = { from, to, kind, connection };
    this.adjacency.get(from)!.push(link);
    this.adjacency.get(to)!.push(link);
  }
}

export function sameConductorTopology(before: Project, after: Project): boolean {
  const original = new ElectricalNetService(new ProjectIndex(before));
  const candidate = new ElectricalNetService(new ProjectIndex(after));
  const retained = new Set(original.nets.flatMap(net => net.ports.map(portIdentity)));
  return original.partition(retained) === candidate.partition(retained);
}
