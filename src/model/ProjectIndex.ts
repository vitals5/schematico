import {DeviceRegistry,componentAddress} from './DeviceRegistry';
import type { Project, Page, PlacedComponent, SymbolDefinition, PinDefinition, Wire } from './types';
import { getSymbolForComponent } from './symbols';
import { isConnectionSymbol, isInterruptionSymbol } from './ConnectionSymbols';
import {electricalPinRole} from './ElectricalDefinition';
export interface ProjectStructure {
    plant: string;
    location: string;
}
export interface IndexedComponent {
    component: PlacedComponent;
    page: Page;
    symbol?: SymbolDefinition;
    structure: ProjectStructure;
    tag: string;
    deviceKey?: string;
    referenceKey?: string;
    nativeRepresentation: boolean;
}
export interface IndexedPin {
    owner: IndexedComponent;
    id: string;
    definition?: PinDefinition;
    label: string;
    role: NonNullable<PinDefinition['electricalRole']>;
}
export interface IndexedConnection {
    wire: Wire;
    page?: Page;
    logical: boolean;
    from?: IndexedPin;
    to?: IndexedPin;
}
export interface IdentityIssue {
    id: string;
    code: 'missing_device_tag' | 'duplicate_page_id' | 'duplicate_component_id' | 'duplicate_master' | 'duplicate_device_tag' | 'duplicate_terminal';
    pageId: string;
    componentId?: string;
    componentIds: string[];
    key: string;
}
const normalize = (value: string, marker: '=' | '+') => value.trim().replace(marker === '=' ? /^=+/ : /^\++/, '').trim();
export function projectStructure(page: Page, component?: PlacedComponent): ProjectStructure {
    return { plant: normalize(component?.higherLevelFunction ?? page.higherLevel ?? '', '='), location: normalize(component?.mountingLocation ?? page.location ?? '', '+') };
}
export function scopedDesignation(structure: ProjectStructure, tag: string): string { return JSON.stringify([structure.plant, structure.location, tag.trim()]); }
export function displayDesignation(structure: ProjectStructure, tag: string): string { return `${structure.plant ? '=' + structure.plant : ''}${structure.location ? '+' + structure.location : ''}${tag}`; }
export function interruptionTag(component: PlacedComponent): string {
    const tag = component.bmk?.trim() ?? '';
    return tag && !tag.startsWith('PF') && tag !== '/' ? tag : component.functionText?.trim() || tag;
}
export function componentIdentity(page: Page, component: PlacedComponent, symbol?: SymbolDefinition) {
    const structure = projectStructure(page, component), tag = component.bmk?.trim() ?? '';
    const deviceKey = tag ? scopedDesignation(structure, tag) : undefined;
    const interruption = !!symbol && isInterruptionSymbol(symbol);
    const refTag = interruption ? interruptionTag(component) : tag;
    const referenceKey = !refTag ? undefined : interruption
        ? JSON.stringify(['interruption', structure.plant, refTag])
        : JSON.stringify(['device', structure.plant, structure.location, tag]);
    return { structure, tag, deviceKey, referenceKey };
}
/** Derived operation-scoped view. Rebuild after edits: mutable Project identity is
 * deliberately NOT a cache key. Keys describe candidate identity, not proof that
 * multiple placements are one physical device. No persisted schema is changed. */
export class ProjectIndex {
    readonly devices:DeviceRegistry;
    readonly components: IndexedComponent[] = [];
    readonly pagesById = new Map<string, Page[]>();
    readonly componentsById = new Map<string, IndexedComponent[]>();
    readonly deviceGroups = new Map<string, IndexedComponent[]>();
    readonly referenceGroups = new Map<string, IndexedComponent[]>();
    readonly articleGroups = new Map<string, IndexedComponent[]>();
    readonly connections: IndexedConnection[] = [];
    readonly identityIssues: IdentityIssue[] = [];
    private byObject = new Map<PlacedComponent, IndexedComponent>();
    private pins = new Map<IndexedComponent, Map<string, IndexedPin>>();
    private incident = new Map<IndexedComponent, IndexedConnection[]>();
    constructor(readonly project: Project) {
        this.devices=new DeviceRegistry(project);
        const push = <T>(map: Map<string, T[]>, key: string, value: T) => {
            const group = map.get(key);
            if (group) group.push(value);
            else map.set(key, [value]);
        };
        for (const page of project.pages) {
            push(this.pagesById, page.id, page);
            for (const component of page.components) {
                const symbol = getSymbolForComponent(component, project);
                const entry: IndexedComponent = { component, page, symbol, ...componentIdentity(page, component, symbol), nativeRepresentation: component.source?.format === 'NATIVE_CAD' || !!(symbol?.source && symbol.importedGraphics) };
                const { deviceKey, referenceKey } = entry;
                this.components.push(entry);
                this.byObject.set(component, entry);
                push(this.componentsById, component.id, entry);
                if (deviceKey)
                    push(this.deviceGroups, deviceKey, entry);
                if (referenceKey)
                    push(this.referenceGroups, referenceKey, entry);
                if (component.articleNumber?.trim())
                    push(this.articleGroups, JSON.stringify([component.manufacturer?.trim() ?? '', component.articleNumber.trim()]), entry);
                const pins = new Map<string, IndexedPin>();
                for (const id of new Set([...(symbol?.pins.map(p => p.id) ?? []), ...Object.keys(component.pins ?? {})])) {
                    const definition = symbol?.pins.find(p => p.id === id);
                    pins.set(id, { owner: entry, id, definition, role: symbol?electricalPinRole(symbol,id):'unknown', label: component.pins?.[id]?.customLabel ?? definition?.name ?? id });
                }
                this.pins.set(entry, pins);
                this.incident.set(entry, []);
            }
        }
        for (const page of project.pages)
            for (const wire of page.wires)
                this.addConnection(wire, false, page);
        for (const wire of project.logicalConnections ?? [])
            this.addConnection(wire, true);
        const issue = (code: IdentityIssue['code'], key: string, entries: IndexedComponent[], pageId = entries[0]?.page.id ?? key) => this.identityIssues.push({ id: JSON.stringify([code, key]), code, key, pageId, componentId: entries[0]?.component.id, componentIds: entries.map(e => e.component.id) });
        for (const entry of this.components)
            if (!entry.tag && entry.symbol && !entry.nativeRepresentation && !isConnectionSymbol(entry.symbol) && entry.symbol.category !== 'structure')
                issue('missing_device_tag', JSON.stringify([entry.page.id, entry.component.id]), [entry]);
        for (const [id, pages] of this.pagesById)
            if (pages.length > 1)
                issue('duplicate_page_id', id, [], id);
        for (const [id, entries] of this.componentsById)
            if (entries.length > 1)
                issue('duplicate_component_id', id, entries);
        for (const [key, entries] of this.deviceGroups) {
            const meaningful = entries.filter(e => !e.symbol || !isConnectionSymbol(e.symbol) && e.symbol.category !== 'structure');
            const deviceIds=meaningful.map(e=>this.devices.forComponent(componentAddress(e.page,e.component))?.id);
            if(deviceIds.length>1&&deviceIds[0]&&deviceIds.every(id=>id===deviceIds[0]))continue;
            if (meaningful.length < 2 || meaningful.some(e => e.nativeRepresentation))
                continue;
            const masters = meaningful.filter(e => e.symbol?.isMaster);
            if (masters.length > 1) {
                issue('duplicate_master', key, masters);
                continue;
            }
            if (meaningful.every(e => e.symbol?.category === 'terminals')) {
                if(meaningful.every(e=>e.component.terminal)&&new Set(meaningful.map(e=>JSON.stringify([e.component.terminal!.strip,e.component.terminal!.number,e.component.terminal!.level]))).size===meaningful.length)continue;
                if (meaningful[0].tag.includes(':'))
                    issue('duplicate_terminal', key, meaningful);
                continue; // Multiple unnumbered placements can be members of one strip.
            }
            const plain = meaningful.filter(e => !e.symbol?.isMaster && !e.symbol?.isContact);
            if (plain.length > 1 || plain.length && masters.length)
                issue('duplicate_device_tag', key, meaningful);
        }
    }
    entry(component: PlacedComponent): IndexedComponent | undefined { return this.byObject.get(component) ?? this.component(component.id); }
    component(id: string, pageId?: string): IndexedComponent | undefined {
        const matches = (this.componentsById.get(id) ?? []).filter(e => pageId === undefined || e.page.id === pageId);
        return matches.length === 1 ? matches[0] : undefined;
    }
    pin(entry: IndexedComponent, id: string): IndexedPin | undefined { return this.pins.get(entry)?.get(id); }
    pinsFor(entry: IndexedComponent): IndexedPin[] { return [...(this.pins.get(entry)?.values() ?? [])]; }
    connectionsFor(entry: IndexedComponent): readonly IndexedConnection[] { return this.incident.get(entry) ?? []; }
    referencesFor(component: PlacedComponent): readonly IndexedComponent[] {
        const entry = this.entry(component);
        if (!entry) return [];
        // Property dialogs pass a copy, which may already carry an edited tag.
        const { referenceKey } = componentIdentity(entry.page, component, getSymbolForComponent(component, this.project));
        return referenceKey ? this.referenceGroups.get(referenceKey) ?? [] : [];
    }
    private addConnection(wire: Wire, logical: boolean, page?: Page) {
        const resolve = (ep: Wire['from']) => { const entry = this.component(ep.componentId, page?.id); return entry ? this.pin(entry, ep.pinId) : undefined; };
        const connection = { wire, logical, page, from: resolve(wire.from), to: resolve(wire.to) };
        this.connections.push(connection);
        for (const entry of new Set([connection.from?.owner, connection.to?.owner]))
            if (entry)
                this.incident.get(entry)!.push(connection);
    }
}
