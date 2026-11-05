import {sessionDiagnostics} from '../ai/SessionDiagnostics';
import {rcdPorts,breakerPorts,socketPorts,isDistributionFeed} from './distributionRoles';
import type { Page, Project, PlacedComponent, Wire, PinDefinition } from '../model/types';
import { getDrawingUnitsPerMm, getSymbolById, getSymbolForComponent } from '../model/symbols';
import { isConnectionSymbol } from '../model/ConnectionSymbols';
import { AutoconnectEngine } from '../model/AutoconnectEngine';
import { CrossReferenceEngine } from '../model/CrossReferenceEngine';
import { snapshotPage } from './geometry';
import { clone, type DraftPreparation, type LayoutIssue } from './types';
import { netIds, validateLayout } from './validate';
import { markLayoutAutoconnections } from './draftConnections';

type Endpoint = Wire['from'];
type Direction = PinDefinition['direction'];
const key = (e: Endpoint) => JSON.stringify([e.componentId, e.pinId]);
const byTag = (a: PlacedComponent, b: PlacedComponent) => a.bmk.localeCompare(b.bmk, 'de', { numeric: true }) || a.id.localeCompare(b.id);
interface Net { endpoints: Endpoint[]; wires: Wire[] }
interface IndexedNet extends Net { id: string }
interface Circuit { breaker: PlacedComponent; sockets: PlacedComponent[]; input: string; output: string; phase: number; liveNet: string }

/** A bounded construction grammar for NEW complete socket distributions and general multi-net circuits.
 * Recognition follows terminal connectivity, never prose, coordinates, device tags or potential names.
 * The source page is only replaced after net equivalence AND full geometry checks pass. */
export function prepareSocketDistribution(project: Project, original: Page, newDevices: Set<string>, newWires: Set<string>, diagnose?: (result:DraftPreparation)=>void): boolean {
  let last: DraftPreparation | undefined;
  const masters = original.components.map(c => getSymbolForComponent(c, project));
  const isStrictSocketDistribution =
    masters.some(s => s?.family === 'rcd' || s?.id === 'rcd_4p') &&
    masters.some(s => s?.family === 'socket' || s?.id === 'socket_schuko');
  // Spend optional whitespace only if the complete measured construction fits.
  // Every attempt still has to pass geometry, net equivalence and real Autoconnect.
  if (isStrictSocketDistribution) {
    for (const profile of [{row:10,gap:6},{row:8,gap:4},{row:8,gap:2}]) {
      if (constructDistribution(project,original,newDevices,newWires,profile,d=>last=d)) {if(last)diagnose?.(last);return true;}
      if (!last || !['geometry_rejected','autoconnect_unavailable'].includes(last.code)) break;
    }
    if(last)diagnose?.(last);
    return false;
  }
  for (const profile of [
    { row: 10, gap: 6, columns: 1 },
    { row: 8, gap: 4, columns: 1 },
    { row: 8, gap: 2, columns: 1 },
    { row: 10, gap: 6, columns: 2 },
    { row: 8, gap: 4, columns: 2 },
    { row: 8, gap: 2, columns: 2 },
  ].flatMap(profile=>[undefined,20,16].map(labelWidth=>({...profile,labelWidth})))) {
    if (constructGeneralCircuit(project, original, newDevices, newWires, profile, d => (last = d))) {
      if (last) diagnose?.(last);
      return true;
    }
    if (!last || !['geometry_rejected', 'autoconnect_unavailable', 'object_limit'].includes(last.code)) break;
  }
  if(last)diagnose?.(last);
  return false;
}
function constructDistribution(project: Project, original: Page, newDevices: Set<string>, newWires: Set<string>, profile:{row:number;gap:number}, diagnose?: (result:DraftPreparation)=>void): boolean {
  const masters=original.components.map(c=>getSymbolForComponent(c,project));
  if(!masters.some(s=>s?.family==='rcd'||s?.id==='rcd_4p') || !masters.some(s=>s?.family==='socket'||s?.id==='socket_schuko'))return false;
  const reject=(code:string,message:string,issues?:LayoutIssue[])=>{diagnose?.({strategy:'socket_distribution',status:'rejected',code,message,issues:issues?.filter(i=>i.severity==='error').slice(0,20)});return false;};
  if (original.components.some(c => !newDevices.has(c.id) || c.rotation || c.source || c.deviceBox || c.scale && c.scale !== 1) ||
      original.wires.some(w => !newWires.has(w.id)) || original.texts?.length || original.images?.length || original.boxes?.length || original.cables?.length ||
      original.layoutConstraints?.lockedIds?.length || original.layoutConstraints?.fixedFrameIds?.length) return reject('existing_content','Das Muster benötigt einen neuen vollständigen Entwurf ohne bestehende oder fixierte Objekte.');
  const work = clone(project);
  let page = work.pages.find(p => p.id === original.id);
  if (!page) {
    page = clone(original);
    work.pages.push(page);
  }
  const symbol=(c:PlacedComponent)=>getSymbolForComponent(c,work);
  const rcds = page.components.filter(c => rcdPorts(symbol(c)));
  const breakers = page.components.filter(c => breakerPorts(symbol(c))).sort(byTag);
  const sockets = page.components.filter(c => socketPorts(symbol(c)));
  const feeds = page.components.filter(c=>isDistributionFeed(symbol(c)));
  if (rcds.length !== 1 || breakers.length < 2 || breakers.length > 8 || sockets.length < breakers.length || feeds.length !== 5 ||
      page.components.length !== 1 + breakers.length + sockets.length + feeds.length){
    const recognized=new Set([...rcds,...breakers,...sockets,...feeds].map(c=>c.id));
    return reject('unsupported_symbols',`Gerätefunktionen oder Anschlussgeometrie passen nicht zum Muster. Erkannt: ${rcds.length} vierpolige FI, ${breakers.length} einpolige Schutzgeräte, ${sockets.length} Steckdosen und ${feeds.length} Einspeisungen.`,[{type:'distribution_roles',severity:'error',objectIds:page.components.filter(c=>!recognized.has(c.id)).map(c=>c.id),message:'Nicht unterstützte Gerätefunktionen oder eine für diese Verteilung ungeeignete Geräteanzahl.'}]);
  }
  const rcd = rcds[0], initial = snapshotPage(page, work), ids = netIds(initial);
  if (initial.issues.some(i => i.severity === 'error')) return reject('invalid_input','Der Entwurf enthält ungültige Symbol- oder Anschlussdaten.',initial.issues);
  const nets = new Map<string, Net>(), endpointNet = new Map<string, string>();
  for (const w of page.wires) {
    const id = ids.get(w.id)!;
    const net = nets.get(id) ?? { endpoints: [], wires: [] };
    net.wires.push(w);
    for (const ep of [w.from, w.to]) { if (!net.endpoints.some(e => key(e) === key(ep))) net.endpoints.push(ep); endpointNet.set(key(ep), id); }
    nets.set(id, net);
  }
  const at = (c: PlacedComponent, pinId: string): Endpoint => ({ componentId: c.id, pinId });
  const netAt = (c: PlacedComponent, pin: string) => endpointNet.get(key(at(c, pin)));
  const rcdPins=rcdPorts(symbol(rcd))!;
  const live=(c:PlacedComponent)=>socketPorts(symbol(c))!.live;
  const contact=(c:PlacedComponent,p:'N'|'PE')=>socketPorts(symbol(c))![p];
  const phasePins = rcdPins.outputs;
  const phases = phasePins.map(pin => netAt(rcd, pin));
  const neutral = netAt(rcd, rcdPins.neutralOut);
  const circuits: Circuit[] = [];
  for (const breaker of breakers) {
    const sym = getSymbolForComponent(breaker, work);
    const input = sym?.pins.filter(p => p.direction === 'top'), output = sym?.pins.filter(p => p.direction === 'bottom');
    if (!sym || sym.pins.length !== 2 || input?.length !== 1 || output?.length !== 1) return reject('breaker_ports','Ein Schutzgerät besitzt keine eindeutigen Ein-/Ausgänge.');
    const inputNet=netAt(breaker,input[0].id);
    const phase = inputNet ? phases.indexOf(inputNet) : -1, liveNet = netAt(breaker, output[0].id);
    const loads = sockets.filter(s => netAt(s, live(s)) === liveNet).sort(byTag);
    if (phase < 0 || !liveNet || loads.length < 1 || loads.length > 4) return reject('circuit_topology','Ein Stromkreis hat keine eindeutige FI-Phase oder keine unterstützte Steckdosengruppe.');
    circuits.push({ breaker, sockets: loads, input: input[0].id, output: output[0].id, phase, liveNet });
  }
  if (new Set(circuits.flatMap(c => c.sockets.map(s => s.id))).size !== sockets.length) return reject('socket_assignment','Nicht jede Steckdose ist einem Schutzgerät eindeutig zugeordnet.');
  const pe = netAt(sockets[0], contact(sockets[0],'PE'));
  if (!pe || !neutral || new Set([...phases.filter(Boolean), neutral, pe]).size !== phases.filter(Boolean).length + 2 ||
      sockets.some(s => netAt(s, contact(s,'N')) !== neutral || netAt(s, contact(s,'PE')) !== pe)) return reject('neutral_protective_nets','N muss hinter dem FI liegen; PE und die Phasennetze müssen davon getrennt bleiben.');
  const feedPorts: Endpoint[] = [];
  const inputPins = [...rcdPins.inputs,rcdPins.neutralIn];
  for (const pin of inputPins) {
    const net = nets.get(netAt(rcd, pin) ?? '');
    const eps = net?.endpoints.filter(ep => ep.componentId !== rcd.id);
    if (!eps || eps.length !== 1 || !feeds.some(f => f.id === eps[0].componentId)) return reject('supply_contacts','Die vier FI-Eingänge benötigen jeweils einen eindeutigen Einspeisepunkt.');
    feedPorts.push(eps[0]);
  }
  const peFeed = nets.get(pe)!.endpoints.filter(ep => !sockets.some(s => s.id === ep.componentId));
  if (peFeed.length !== 1 || !feeds.some(f => f.id === peFeed[0].componentId) ||
      new Set([...feedPorts, peFeed[0]].map(ep => ep.componentId)).size !== 5) return reject('protective_supply','Die Schutzleiter-Einspeisung muss ein eigener Anschluss sein.');
  // Explicitly enumerate every allowed contact; extra contacts/bridges/loads reject the grammar.
  const expected = new Map<string, Endpoint[]>();
  const expect = (id: string | undefined, eps: Endpoint[]) => { if (id) expected.set(id, eps); };
  inputPins.forEach((p, i) => expect(netAt(rcd, p), [at(rcd, p), feedPorts[i]]));
  phases.forEach((p, i) => expect(p, [at(rcd, phasePins[i]), ...circuits.filter(c => c.phase === i).map(c => at(c.breaker, c.input))]));
  for (const c of circuits) expect(c.liveNet, [at(c.breaker, c.output), ...c.sockets.map(s => at(s, live(s)))]);
  expect(neutral, [at(rcd, rcdPins.neutralOut), ...sockets.map(s => at(s, contact(s,'N')))]);
  expect(pe, [peFeed[0], ...sockets.map(s => at(s, contact(s,'PE')))]);
  if (expected.size !== nets.size || [...expected].some(([id, eps]) => JSON.stringify(eps.map(key).sort()) !== JSON.stringify(nets.get(id)!.endpoints.map(key).sort()))) return reject('extra_contacts','Zusätzliche Anschlüsse oder Brücken verhindern eine eindeutige Verteilung.');
  const specification = (w: Wire) => { const { id, from, to, waypoints, isAutoconnect, routingMode, ...spec } = w; return JSON.stringify(spec); };
  if ([...nets.values()].some(n => n.wires.some(w => specification(w) !== specification(n.wires[0])))) return reject('different_wire_data','Unterschiedliche Leitungsdaten innerhalb eines Netzes werden nicht zusammengelegt.');
  const u = getDrawingUnitsPerMm(work), step = initial.grid.spacing / 2;
  const snap = (v: number) => Math.ceil(v / step - 1e-8) * step;
  const snapX=(v:number)=>snap(v-initial.grid.origin.x)+initial.grid.origin.x;
  const snapY=(v:number)=>snap(v-initial.grid.origin.y)+initial.grid.origin.y;
  // All calculations are physical millimeters; positions are converted once at the boundary.
  const point = (ep: Endpoint) => {
    const c = page.components.find(c => c.id === ep.componentId)!, s = getSymbolForComponent(c, work)!, p = s.pins.find(p => p.id === ep.pinId)!;
    const q = AutoconnectEngine.getRotatedPinInfo(c, p, s); return { x: q.worldX / u, y: q.worldY / u, direction: q.direction };
  };
  const place = (ep: Endpoint, x: number, y: number) => { const c = page.components.find(c => c.id === ep.componentId)!, p = point(ep); c.x += (x - p.x) * u; c.y += (y - p.y) * u; };
  for (const ep of [...feedPorts, peFeed[0]]) {
    const c = page.components.find(c => c.id === ep.componentId)!;
    if (point(ep).direction === 'top') c.rotation = 180;
    if (point(ep).direction !== 'bottom') return reject('feed_direction','Eine Einspeisung kann nicht zur Anschlussrichtung ausgerichtet werden.');
  }
  const geometry = snapshotPage(page, work);
  const measured = new Map(geometry.nodes.map(n => [n.id, n]));
  const loads = circuits.flatMap(c => c.sockets), inputNodes = feeds.map(f => measured.get(f.id)!);
  const row = snap(Math.max(profile.row, initial.grid.spacing * 2));
  const pairShift = snap(Math.max(16,...loads.map(c=>Math.max(...measured.get(c.id)!.shapes.filter(s=>s.kind==='body'||s.kind==='pin_label').map(s=>s.rect.x+s.rect.width))-point(at(c,live(c))).x+2)));
  const socketReach=Math.max(...loads.map(c=>point(at(c,live(c))).x-measured.get(c.id)!.rect.x));
  const socketPins=Math.max(...loads.flatMap(c=>['N','PE'].map(p=>point(at(c,contact(c,p as 'N'|'PE'))).x-point(at(c,live(c))).x)));
  const envelope=Math.max(Math.max(...[...breakers,...loads].map(c=>measured.get(c.id)!.rect.width)),socketReach+pairShift*(Math.max(...circuits.map(c=>c.sockets.length))-1)+socketPins);
  // N/PE returns pass to the left of the entire stack, including the FI.
  // Its function/technical text can extend farther left than the loads' labels.
  // Reserve that measured envelope before choosing the first column and pitch.
  const columnAnchors = [at(rcd, rcdPins.inputs[0]), ...circuits.flatMap(c =>
    [at(c.breaker, c.output), ...c.sockets.map(s => at(s, live(s)))])];
  const reach = Math.max(...columnAnchors.map(ep =>
    point(ep).x - measured.get(ep.componentId)!.rect.x));
  const leftN = snapX(initial.area.x + 6), leftPE = leftN + row;
  const first = snapX(leftPE + reach + 6);
  // Spend optional whitespace only after reserving the full measured last column.
  // Tightening a gap never changes symbols, text size or electrical endpoints.
  const last=circuits[circuits.length-1];
  const lastRight=Math.max(measured.get(last.breaker.id)!.rect.x+measured.get(last.breaker.id)!.rect.width-point(at(last.breaker,last.output)).x,...last.sockets.map((c,j)=>measured.get(c.id)!.rect.x+measured.get(c.id)!.rect.width-point(at(c,live(c))).x+j*pairShift));
  const availablePitch=Math.floor((initial.area.x+initial.area.width-first-lastRight-2)/(circuits.length-1)/step)*step;
  const pitch=Math.max(snap(envelope+2),Math.min(snap(envelope+4),availablePitch));
  const feedBottom = snapY(initial.area.y + Math.max(...inputNodes.map(n => {
    const ep = [...feedPorts, peFeed[0]].find(ep => ep.componentId === n.id)!; return point(ep).y - n.rect.y;
  })) + 4);
  const rcdTop = feedBottom + row * 5;
  place(at(rcd,rcdPins.inputs[0]), first, rcdTop);
  const rcdBottom = point(at(rcd,rcdPins.outputs[0])).y;
  const breakerTop = rcdBottom + row * 5 + 4;
  circuits.forEach((c, i) => place(at(c.breaker, c.input), first + i * pitch, breakerTop));
  const breakerBottom = Math.max(...circuits.map(c => point(at(c.breaker, c.output)).y));
  const peFirst=point(at(loads[0],contact(loads[0],'PE'))).x<point(at(loads[0],contact(loads[0],'N'))).x;
  if(loads.some(c=>(point(at(c,contact(c,'PE'))).x<point(at(c,contact(c,'N'))).x)!==peFirst))return reject('mixed_contact_order','Gemischte N-/PE-Anschlussreihenfolgen benötigen eine gesonderte Leitungsanordnung.');
  const railY=snapY(breakerBottom+row+4);
  const peY=railY+(peFirst?0:row),nY=railY+(peFirst?row:0);
  const liveY = railY + 2*row;
  const socketY = liveY + 16;
  const socketRow = snap(Math.max(...loads.map(c => measured.get(c.id)!.rect.height)) + profile.gap);
  circuits.forEach((c, i) => c.sockets.forEach((s, j) => place(at(s, live(s)), first + i * pitch + j * pairShift, socketY + j * socketRow)));
  const used = new Set(work.pages.flatMap(p => [p, ...p.components, ...p.wires, ...(p.groups ?? []), ...(p.texts ?? []), ...(p.boxes ?? []), ...(p.images ?? []), ...(p.cables ?? [])].map(x => x.id)));
  const allocate = (base: string) => { let id = base, i = 1; while (used.has(id)) id = base + '-' + i++; used.add(id); return id; };
  const added: PlacedComponent[] = [], generated: Wire[] = [];
  const consumed = new Map<string, number>();
  const connect = (id: string, from: Endpoint, to: Endpoint) => {
    const n = nets.get(id)!, index = consumed.get(id) ?? 0; consumed.set(id, index + 1);
    generated.push({ ...n.wires[0], id: n.wires[index]?.id ?? allocate(n.wires[0].id + '-distribution-' + index), from, to, waypoints: [], isAutoconnect: false, routingMode: 'auto' });
  };
  const junction = (dirs: Direction[], x: number, y: number, owner?: PlacedComponent) => {
    const names = ['corner_compact_left_top','corner_compact_left_bottom','corner_compact_right_top','corner_compact_right_bottom','t_piece_directed_bottom_left', 't_piece_directed_right_top', 't_piece_directed_left_top', 't_piece_directed_top_right', 't_piece_down', 't_piece_up', 't_piece_left', 't_piece_right', 'corner_top_left', 'corner_bottom_left', 'corner_top_right', 'corner_bottom_right'];
    const s = names.map(id => getSymbolById(id, work)).find(s => s && !s.unresolved && s.pins.length === dirs.length && dirs.every(d => s.pins.filter(p => p.direction === d).length === 1));
    if (!s) throw new Error('Distribution junction is unavailable');
    const c: PlacedComponent = { id: allocate(rcd.id + '-distribution-' + added.length), symbolId: s.id, bmk: '', functionText: '', x: x * u - s.pins.find(p=>p.direction==='top'||p.direction==='bottom')!.x, y: y * u - s.pins.find(p=>p.direction==='left'||p.direction==='right')!.y, rotation: 0, higherLevelFunction: page.higherLevel, mountingLocation: page.location, pinLabelPosition: { visible: false }, pins: Object.fromEntries(s.pins.map(p => [p.id, { wireIds: [] }])) };
    page.components.push(c); added.push(c);
    if (owner) for (const g of page.groups ?? []) if (g.members.some(m => m.kind === 'component' && m.id === owner.id)) g.members.push({ kind: 'component', id: c.id });
    return (dir: Direction): Endpoint => ({ componentId: c.id, pinId: s.pins.find(p => p.direction === dir)!.id });
  };
  try {
    feedPorts.forEach((ep, i) => {
      const id = netAt(rcd, inputPins[i])!, target = at(rcd, inputPins[i]);
      place(ep, first + i * pitch, feedBottom);
      if (i === 0) connect(id, ep, target);
      else {
        const y = feedBottom + i * row, a = junction(['top', 'left'], point(ep).x, y), b = junction(['right', 'bottom'], point(target).x, y);
        connect(id, ep, a('top')); connect(id, a('left'), b('right')); connect(id, b('bottom'), target);
      }
    });
    const peBody=measured.get(peFeed[0].componentId)!.shapes.filter(s=>s.kind==='body'),firstBody=measured.get(feedPorts[0].componentId)!.shapes.filter(s=>s.kind==='body');
    const feedSeparation=snap(Math.max(2*row,Math.max(...peBody.map(s=>s.rect.x+s.rect.width))-measured.get(peFeed[0].componentId)!.pins.find(p=>p.id===peFeed[0].pinId)!.x-(Math.min(...firstBody.map(s=>s.rect.x))-measured.get(feedPorts[0].componentId)!.pins.find(p=>p.id===feedPorts[0].pinId)!.x)+2));
    place(peFeed[0], first - feedSeparation, feedBottom + 3 * row);
    const pea=junction(['top','left'],point(peFeed[0]).x,feedBottom+row*4),peb=junction(['right','bottom'],leftPE,feedBottom+row*4);
    connect(pe,peFeed[0],pea('top'));connect(pe,pea('left'),peb('right'));
    phases.forEach((id, i) => {
      const targets = circuits.filter(c => c.phase === i).map(c => at(c.breaker, c.input));
      const source = at(rcd, phasePins[i]);
      if (!targets.length) return;
      const y = rcdBottom + row * (2 + i), x=point(source).x;
      const left=targets.filter(ep=>point(ep).x<x-1e-6).reverse();
      const equal=targets.filter(ep=>Math.abs(point(ep).x-x)<1e-6);
      const right=targets.filter(ep=>point(ep).x>x+1e-6);
      if(equal.length===1 && targets.length===1){connect(id!,source,equal[0]);return;}
      const dirs:Direction[]=['top',...(left.length?['left' as const]:[]),...(equal.length?['bottom' as const]:[]),...(right.length?['right' as const]:[])];
      if(dirs.length>3)throw new Error('Ambiguous distribution tap');
      const inlet=junction(dirs,x,y);connect(id!,source,inlet('top'));
      if(equal[0])connect(id!,inlet('bottom'),equal[0]);
      for(const [direction,others] of [['left',left],['right',right]] as const){
        if(!others.length)continue;
        const opposite=direction==='left'?'right':'left';
        let previous=inlet(direction);
        others.forEach((target,j)=>{
          const final=j===others.length-1;
          const t=junction(final?[opposite,'bottom']:['left','right','bottom'],point(target).x,y);
          connect(id!,previous,t(opposite));connect(id!,t('bottom'),target);
          if(!final)previous=t(direction);
        });
      }
    });
    const nSource = at(rcd, rcdPins.neutralOut), na = junction(['top', 'left'], point(nSource).x, rcdBottom + row), nb = junction(['right', 'bottom'], leftN, rcdBottom + row);
    connect(neutral, nSource, na('top')); connect(neutral, na('left'), nb('right'));
    for (const [id, source, x, y, pin] of [[neutral, nb('bottom'), leftN, nY, 'N'], [pe, peb('bottom'), leftPE, peY, 'PE']] as const) {
      const start = junction(['top', 'right'], x, y); connect(id, source, start('top')); let previous = start('right');
      const targets = loads.map(s => at(s, contact(s,pin))).sort((a, b) => point(a).x - point(b).x);
      targets.forEach((ep, i) => {
        const t = junction(i === targets.length - 1 ? ['left', 'bottom'] : ['left', 'right', 'bottom'], point(ep).x, y);
        connect(id, previous, t('left')); connect(id, t('bottom'), ep);
        if (i < targets.length - 1) previous = t('right');
      });
    }
    for (const c of circuits) {
      const source = at(c.breaker, c.output);
      if (c.sockets.length === 1) connect(c.liveNet, source, at(c.sockets[0],live(c.sockets[0])));
      else {
        const firstTap = junction(['top', 'bottom', 'right'], point(source).x, liveY, c.breaker);
        connect(c.liveNet, source, firstTap('top')); connect(c.liveNet, firstTap('bottom'), at(c.sockets[0],live(c.sockets[0])));
        let previous = firstTap('right');
        c.sockets.slice(1).forEach((s, i, rest) => {
          const target = at(s, live(s)), t = junction(i === rest.length - 1 ? ['left', 'bottom'] : ['left', 'right', 'bottom'], point(target).x, liveY, c.breaker);
          connect(c.liveNet, previous, t('left')); connect(c.liveNet, t('bottom'), target);
          if (i < rest.length - 1) previous = t('right');
        });
      }
    }
  } catch { return reject('junction_library','Die benötigten Bibliotheks-Verbindungsstücke sind nicht eindeutig verfügbar.'); }
  if (page.components.length > 200 || [...nets].some(([id, n]) => (consumed.get(id) ?? 0) < n.wires.length)) return reject('object_limit','Die Konstruktion würde die Objektgrenze überschreiten oder Leitungs-IDs verlieren.');
  page.wires = generated;
  for (const c of page.components) for (const p of Object.values(c.pins)) p.wireIds = [];
  for (const w of generated) for (const ep of [w.from, w.to]) page.components.find(c => c.id === ep.componentId)!.pins[ep.pinId].wireIds!.push(w.id);
  const final = snapshotPage(page, work), finalNets = netIds(final);
  // Equality of the partition of ALL original contacts includes separation, not just reachability.
  const signature = (mapping: Map<string, string>, wires: Wire[]) => {
    const contact = new Map<string, string>();
    for (const w of wires) for (const ep of [w.from, w.to]) if (newDevices.has(ep.componentId)) contact.set(key(ep), mapping.get(w.id)!);
    return [...new Set(contact.values())].map(id => [...contact].filter(([, n]) => n === id).map(([ep]) => ep).sort()).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  };
  if (JSON.stringify(signature(ids, original.wires)) !== JSON.stringify(signature(finalNets, page.wires)))return reject('net_equivalence','Die ursprüngliche elektrische Netzstruktur konnte nicht erhalten werden.');
  const report=validateLayout(final);
  sessionDiagnostics.record('distribution_geometry',{snapshot:final,report});
  if(!report.valid)return reject('geometry_rejected','Die gemessenen Symbole, Beschriftungen oder Leitungszüge passen nicht kollisionsfrei in den Zeichenbereich.',report.issues);
  markLayoutAutoconnections(work, page);
  if (page.wires.some(w => !w.isAutoconnect)) return reject('autoconnect_unavailable','Nicht alle konstruierten Abschnitte sind mit der tatsächlichen Autoconnect-Erkennung reproduzierbar.');
  Object.assign(original, page);
  diagnose?.({strategy:'socket_distribution',status:'applied',code:'applied',message:'Steckdosen-Verteilungsmuster angewendet: gemeinsame Leitungszüge und geprüfte Autoconnect-Achsen.'});
  return true;
}

function constructGeneralCircuit(
  project: Project,
  original: Page,
  newDevices: Set<string>,
  newWires: Set<string>,
  profile: { row: number; gap: number; columns?: number; labelWidth?:number },
  diagnose?: (result: DraftPreparation) => void,
): boolean {
  if (original.components.length < 2 || original.wires.length < 1) return false;
  const reject = (code: string, message: string, issues?: LayoutIssue[]) => {
    diagnose?.({
      strategy: 'socket_distribution',
      status: 'rejected',
      code,
      message,
      issues: issues?.filter(i => i.severity === 'error').slice(0, 20),
    });
    return false;
  };
  if (
    original.components.some(
      c => {
        const sym = getSymbolForComponent(c, project);
        if (sym && isConnectionSymbol(sym)) return false;
        return !newDevices.has(c.id) || c.rotation || c.source || c.deviceBox || (c.scale && c.scale !== 1);
      },
    ) ||
    original.wires.some(w => !newWires.has(w.id)) ||
    original.texts?.length ||
    original.images?.length ||
    original.boxes?.length ||
    original.cables?.length ||
    original.layoutConstraints?.lockedIds?.length ||
    original.layoutConstraints?.fixedFrameIds?.length
  ) {
    return reject(
      'existing_content',
      'Das Muster benötigt einen neuen vollständigen Entwurf ohne bestehende oder fixierte Objekte.',
    );
  }

  const work = clone(project);
  let page = work.pages.find(p => p.id === original.id);
  if (!page) {
    page = clone(original);
    work.pages.push(page);
  }
  const u = getDrawingUnitsPerMm(work);
  const initial = snapshotPage(page, work);
  if (initial.issues.some(i => i.severity === 'error')) {
    return reject('invalid_input', 'Der Entwurf enthält ungültige Symbol- oder Anschlussdaten.', initial.issues);
  }

  const ids = netIds(initial);
  const nets = new Map<string, IndexedNet>();
  const endpointNet = new Map<string, string>();
  for (const w of page.wires) {
    const id = ids.get(w.id)!;
    const net = nets.get(id) ?? { id, endpoints: [], wires: [] };
    net.wires.push(w);
    for (const ep of [w.from, w.to]) {
      if (!net.endpoints.some(e => key(e) === key(ep))) net.endpoints.push(ep);
      endpointNet.set(key(ep), id);
    }
    nets.set(id, net);
  }
  if (nets.size < 1) return false;

  const netList = [...nets.values()];
  if (page.components.some(c => !netList.some(n => n.endpoints.some(e => e.componentId === c.id)))) {
    return reject('unconnected_component', 'Nicht verbundene Reservebauteile benötigen das allgemeine Layoutverfahren.');
  }

  const specification = (w: Wire) => {
    const { id, from, to, waypoints, isAutoconnect, routingMode, ...spec } = w;
    return JSON.stringify(spec);
  };
  if (netList.some(n => n.wires.some(w => specification(w) !== specification(n.wires[0])))) {
    return reject(
      'different_wire_data',
      'Unterschiedliche Leitungsdaten innerhalb eines Netzes werden nicht zusammengelegt.',
    );
  }

  for (const c of page.components) {
    const rcdP = rcdPorts(getSymbolForComponent(c, work));
    if (!rcdP) continue;
    const nIn = endpointNet.get(key({ componentId: c.id, pinId: rcdP.neutralIn }));
    const nOut = endpointNet.get(key({ componentId: c.id, pinId: rcdP.neutralOut }));
    if (nIn && nOut && nIn === nOut) {
      return reject(
        'neutral_protective_nets',
        'N muss hinter dem FI liegen; PE und die Phasennetze müssen davon getrennt bleiben.',
      );
    }
  }
  for (const n of netList) {
    const hasPe =
      n.wires.some(w => w.potential?.trim().toUpperCase() === 'PE') ||
      n.endpoints.some(ep => {
        const c = page.components.find(x => x.id === ep.componentId);
        const s = c && getSymbolForComponent(c, work);
        const p = s?.pins.find(x => x.id === ep.pinId);
        return (
          s?.family === 'pe_terminal' ||
          ['terminal_pe', 'ground_pe', 'catalog_distribution_block_pe', 'potential_pe'].includes(s?.id ?? '') ||
          /^PE$/i.test(ep.pinId) ||
          /^PE$/i.test(p?.name ?? '')
        );
      });
    const hasNeutralOrPhase =
      n.wires.some(w => ['N', 'L1', 'L2', 'L3'].includes(w.potential?.trim().toUpperCase() ?? '')) ||
      n.endpoints.some(ep => {
        const c = page.components.find(x => x.id === ep.componentId);
        const s = c && getSymbolForComponent(c, work);
        const p = s?.pins.find(x => x.id === ep.pinId);
        return (
          ['catalog_distribution_block_neutral', 'potential_n', 'potential_l1', 'potential_l2', 'potential_l3'].includes(
            s?.id ?? '',
          ) ||
          Boolean(rcdPorts(s)) ||
          /^N([_-]|$)/i.test(ep.pinId) ||
          /^N([_-]|$)/i.test(p?.name ?? '')
        );
      });
    if (hasPe && hasNeutralOrPhase) {
      return reject(
        'neutral_protective_nets',
        'N muss hinter dem FI liegen; PE und die Phasennetze müssen davon getrennt bleiben.',
      );
    }
  }

  const point = (ep: Endpoint) => {
    const c = page.components.find(c => c.id === ep.componentId)!;
    const s = getSymbolForComponent(c, work)!;
    const p = s.pins.find(p => p.id === ep.pinId)!;
    const q = AutoconnectEngine.getRotatedPinInfo(c, p, s);
    return { x: q.worldX / u, y: q.worldY / u, direction: q.direction };
  };
  const place = (ep: Endpoint, x: number, y: number) => {
    const c = page.components.find(c => c.id === ep.componentId)!;
    const p = point(ep);
    c.x += (x - p.x) * u;
    c.y += (y - p.y) * u;
  };

  for (const c of page.components) {
    const sym = getSymbolForComponent(c, work);
    if (!isDistributionFeed(sym) && !(sym && isConnectionSymbol(sym))) continue;
    const connected = netList.flatMap(n => n.endpoints.filter(e => e.componentId === c.id));
    if (connected.length !== 1) continue;
    const ep = connected[0];
    const net = nets.get(endpointNet.get(key(ep))!)!;
    const others = net.endpoints.filter(e => e.componentId !== c.id);
    if (!others.length) continue;
    let desired:Direction|undefined = others.some(o => point(o).direction === 'bottom') ? 'top'
      : others.some(o => point(o).direction === 'top') ? 'bottom' : undefined;
    if(!desired&&others.every(other=>{const sym=getSymbolForComponent(page.components.find(c=>c.id===other.componentId)!,work);return sym&&(isDistributionFeed(sym)||isConnectionSymbol(sym));})){
      desired=key(ep)===key([...net.endpoints].sort((a,b)=>key(a).localeCompare(key(b)))[0])?'bottom':'top';
    }
    if(desired){
      const dirs:Direction[]=['top','right','bottom','left'];
      c.rotation=((c.rotation+(dirs.indexOf(desired)-dirs.indexOf(point(ep).direction)+4)*90)%360) as PlacedComponent['rotation'];
    }
  }

  for (const n of netList) {
    for (const ep of n.endpoints) {
      const c = page.components.find(c => c.id === ep.componentId);
      const sym = c && getSymbolForComponent(c, work);
      if (sym && isConnectionSymbol(sym)) continue;
      const dir = point(ep).direction;
      if (dir !== 'top' && dir !== 'bottom') {
        return reject(
          'unsupported_pin_direction',
          'Horizontale Geräteanschlüsse benötigen das allgemeine Layoutverfahren.',
        );
      }
    }
  }

  const rank = new Map<string, number>(page.components.map(c => [c.id, 0]));
  const edges: [string, string][] = [];
  for (const net of netList) {
    const bottoms = [...new Set(net.endpoints.filter(e => point(e).direction === 'bottom').map(e => e.componentId))];
    const tops = [...new Set(net.endpoints.filter(e => point(e).direction === 'top').map(e => e.componentId))];
    for (const uComp of bottoms) {
      for (const vComp of tops) {
        if (uComp !== vComp) edges.push([uComp, vComp]);
      }
    }
  }
  for (let iter = 0; iter < page.components.length; iter++) {
    let changed = false;
    for (const [uComp, vComp] of edges) {
      if (rank.get(vComp)! < rank.get(uComp)! + 1) {
        rank.set(vComp, rank.get(uComp)! + 1);
        changed = true;
      }
    }
    if (!changed) break;
  }
  for (const c of page.components) {
    const hasIncoming = edges.some(([, v]) => v === c.id);
    const outgoing = edges.filter(([u]) => u === c.id).map(([, v]) => rank.get(v)!);
    if (!hasIncoming && outgoing.length) {
      rank.set(c.id, Math.min(...outgoing) - 1);
    }
  }
  const minRank = Math.min(0, ...rank.values());
  if (minRank < 0) {
    for (const [id, r] of rank) rank.set(id, r - minRank);
  }

  if(profile.labelWidth)for(const c of page.components)for(const field of ['functionTextPosition','technicalDataPosition'] as const)c[field]={...c[field],maxWidth:Math.min(c[field]?.maxWidth??Infinity,profile.labelWidth*u)};
  const geometry = snapshotPage(page, work);
  const measured = new Map(geometry.nodes.map(n => [n.id, n]));
  const step = initial.grid.spacing / 2;
  const snap = (v: number) => Math.ceil(v / step - 1e-8) * step;
  const snapX = (v: number) => snap(v - initial.grid.origin.x) + initial.grid.origin.x;
  const snapY = (v: number) => snap(v - initial.grid.origin.y) + initial.grid.origin.y;
  const row = snap(Math.max(profile.row, initial.grid.spacing * 2));

  const maxBaseRank = Math.max(0, ...rank.values());
  const groupOrder = new Map<string, number>();
  (page.groups ?? []).forEach((g, gi) =>
    g.members.forEach(m => {
      if (m.kind === 'component' && !groupOrder.has(m.id)) groupOrder.set(m.id, gi);
    }),
  );

  const refPin = (c: PlacedComponent): Endpoint => {
    const connected = netList.flatMap(n => n.endpoints.filter(e => e.componentId === c.id));
    const topPins = connected.filter(e => point(e).direction === 'top').sort((a, b) => point(a).x - point(b).x);
    if (topPins.length) return topPins[0];
    const botPins = connected.filter(e => point(e).direction === 'bottom').sort((a, b) => point(a).x - point(b).x);
    if (botPins.length) return botPins[0];
    const sym = getSymbolForComponent(c, work)!;
    return { componentId: c.id, pinId: sym.pins[0].id };
  };

  const numCols = profile.columns ?? 1;
  const corridorReserve = numCols === 1 ? 5 * row : Math.max(5, Math.min(netList.length, 8)) * row;
  const colBudget =
    numCols === 1 ? initial.area.width - corridorReserve - 8 : (initial.area.width - corridorReserve - 16) / numCols;

  const rows: PlacedComponent[][] = [];
  for (let r = 0; r <= maxBaseRank; r++) {
    const comps = page.components.filter(c => rank.get(c.id) === r);
    comps.sort((a, b) => (groupOrder.get(a.id) ?? 999) - (groupOrder.get(b.id) ?? 999) || byTag(a, b));
    let current: PlacedComponent[] = [];
    let currentWidth = 0;
    for (const c of comps) {
      const w = measured.get(c.id)!.rect.width;
      if (current.length > 0 && currentWidth + profile.gap + w > colBudget) {
        rows.push(current);
        current = [c];
        currentWidth = w;
      } else {
        currentWidth += (current.length ? profile.gap : 0) + w;
        current.push(c);
      }
    }
    if (current.length) rows.push(current);
  }

  const colRows: PlacedComponent[][][] = Array.from({ length: numCols }, () => []);
  if (numCols === 1 || rows.length <= 1) {
    colRows[0] = rows;
  } else {
    const splitAt = Math.ceil(rows.length / 2);
    colRows[0] = rows.slice(0, splitAt);
    colRows[1] = rows.slice(splitAt);
  }

  const compLoc = new Map<string, { col: number; row: number }>();
  colRows.forEach((cRows, col) => cRows.forEach((rComps, r) => rComps.forEach(c => compLoc.set(c.id, { col, row: r }))));

  const epBand = (ep: Endpoint) => {
    const loc = compLoc.get(ep.componentId)!;
    const dir = point(ep).direction;
    return { col: loc.col, band: dir === 'top' ? loc.row : loc.row + 1 };
  };

  const netBandSet = new Map<string, Set<string>>();
  for (const net of netList) {
    const set = new Set<string>();
    for (const ep of net.endpoints) {
      const b = epBand(ep);
      set.add(`${b.col}:${b.band}`);
    }
    netBandSet.set(net.id, set);
  }

  const corridorNets = netList.filter(n => netBandSet.get(n.id)!.size > 1);
  const corridorSlots:number[][]=[];
  const corridorSlot=new Map<string,number>();
  const extents=new Map(corridorNets.map(n=>{const bands=[...netBandSet.get(n.id)!].map(code=>Number(code.split(':')[1]));return[n.id,{min:Math.min(...bands),max:Math.max(...bands)}] as const;}));
  for(const n of corridorNets){
    const span=extents.get(n.id)!;
    let slot=corridorSlots.findIndex(indices=>indices.every(index=>{const other=extents.get(corridorNets[index].id)!;return span.min>other.max+1||other.min>span.max+1;}));
    if(slot<0){slot=corridorSlots.length;corridorSlots.push([]);}
    corridorSlots[slot].push(corridorNets.indexOf(n));corridorSlot.set(n.id,slot);
  }

  const colBandNets: IndexedNet[][][] = colRows.map(cRows => Array.from({ length: cRows.length + 1 }, () => []));
  for (const net of netList) {
    const set = netBandSet.get(net.id)!;
    for (const code of set) {
      const [col, b] = code.split(':').map(Number);
      colBandNets[col][b].push(net);
    }
  }

  const bandTrackY = new Map<string, number>();
  const globalSpans: { y: number; minX: number; maxX: number }[] = [];
  let currentLeftX = snapX(initial.area.x + 6);
  const corridorX = new Map<string, number>();

  if (numCols === 1) {
    corridorNets.forEach((n, i) => corridorX.set(n.id, currentLeftX + corridorSlot.get(n.id)! * row));
    if (corridorNets.length) currentLeftX = snapX(currentLeftX + corridorSlots.length * row + 6);
  }

  const assignBandTracks = (col: number, bandIdx: number, activeNets: IndexedNet[], startY: number): number => {
    const levels: { y: number; spans: [number, number][] }[] = [];
    for (const net of activeNets) {
      const corrX = corridorX.get(net.id);
      const upperEps = net.endpoints.filter(e => {
        const l = compLoc.get(e.componentId)!;
        return l.col === col && l.row === bandIdx - 1 && point(e).direction === 'bottom';
      });
      const lowerEps = net.endpoints.filter(e => {
        const l = compLoc.get(e.componentId)!;
        return l.col === col && l.row === bandIdx && point(e).direction === 'top';
      });
      if (
        corrX === undefined &&
        upperEps.length === 1 &&
        lowerEps.length === 1 &&
        Math.abs(point(upperEps[0]).x - point(lowerEps[0]).x) < 1e-6
      ) {
        continue;
      }
      const xs = [
        ...upperEps.map(e => point(e).x),
        ...lowerEps.map(e => point(e).x),
        ...(corrX !== undefined ? [corrX] : []),
      ];
      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      const fitsAtY = (yVal: number) =>
        globalSpans.every(
          s =>
            Math.abs(s.y - yVal) >= row - 1e-6 ||
            maxX + row <= s.minX + 1e-6 ||
            minX - row >= s.maxX - 1e-6,
        );
      const existing = levels.find(lvl => fitsAtY(lvl.y));
      if (existing) {
        existing.spans.push([minX, maxX]);
        globalSpans.push({ y: existing.y, minX, maxX });
        bandTrackY.set(`${col}:${bandIdx}:${net.id}`, existing.y);
      } else {
        let trackY = levels.length ? snapY(levels[levels.length - 1].y + row) : snapY(startY);
        while (!fitsAtY(trackY)) {
          trackY = snapY(trackY + row);
        }
        levels.push({ y: trackY, spans: [[minX, maxX]] });
        globalSpans.push({ y: trackY, minX, maxX });
        bandTrackY.set(`${col}:${bandIdx}:${net.id}`, trackY);
      }
    }
    return levels.length ? snapY(levels[levels.length - 1].y + row) : snapY(startY + row);
  };

  // Pass 1: Determine X coordinates for all columns and corridors first
  for (let col = 0; col < numCols; col++) {
    if (col === 1 && corridorNets.length) {
      const baseCorr = snapX(currentLeftX + 6);
      corridorNets.forEach((n, i) => corridorX.set(n.id, baseCorr + corridorSlot.get(n.id)! * row));
      currentLeftX = snapX(baseCorr + corridorSlots.length * row + 6);
    }

    const cRows = colRows[col];
    let maxColRight = currentLeftX;

    for (let r = 0; r < cRows.length; r++) {
      const rComps = cRows[r];
      const prevBandPins: { x: number; netId: string; isCorridor?: boolean }[] = [];
      for (const [, cx] of corridorX) {
        prevBandPins.push({ x: cx, netId: '__corridor__', isCorridor: true });
      }
      for (const net of colBandNets[col][r]) {
        if (r > 0) {
          for (const ep of net.endpoints) {
            const loc = compLoc.get(ep.componentId)!;
            if (loc.col === col && loc.row === r - 1 && point(ep).direction === 'bottom') {
              prevBandPins.push({ x: point(ep).x, netId: net.id });
            }
          }
        }
      }

      const placedRowPins: { x: number; netId: string; dir: Direction }[] = [];
      let cursorX = currentLeftX;
      for (const c of rComps) {
        const ep = refPin(c);
        const node = measured.get(c.id)!;
        const leftReach = point(ep).x - node.rect.x;
        const rightReach = node.rect.x + node.rect.width - point(ep).x;
        let targetX = snapX(cursorX + leftReach);

        const connectedPins = netList.flatMap(n =>
          n.endpoints
            .filter(e => e.componentId === c.id)
            .map(e => ({ ep: e, netId: n.id, dx: point(e).x - point(ep).x, dir: point(e).direction })),
        );
        for (let shift = 0; shift < 60; shift++) {
          const tryX = targetX + shift * step;
          const conflict = connectedPins.some(cp => {
            const px = tryX + cp.dx;
            if (
              placedRowPins.some(
                other => other.netId === cp.netId && other.dir === cp.dir && Math.abs(px - other.x) < 8 - 1e-6,
              )
            ) {
              return true;
            }
            if (cp.dir === 'top') {
              return prevBandPins.some(other =>
                other.isCorridor || other.netId !== cp.netId
                  ? Math.abs(px - other.x) < 4 - 1e-6
                  : Math.abs(px - other.x) > 1e-6 && Math.abs(px - other.x) < 8 - 1e-6,
              );
            }
            return prevBandPins.some(other => other.isCorridor && Math.abs(px - other.x) < 4 - 1e-6);
          });
          if (!conflict) {
            targetX = tryX;
            break;
          }
        }

        place(ep, targetX, point(ep).y);
        for (const cp of connectedPins) {
          placedRowPins.push({ x: targetX + cp.dx, netId: cp.netId, dir: cp.dir });
        }
        cursorX = snapX(targetX + rightReach + profile.gap);
        maxColRight = Math.max(maxColRight, targetX + rightReach);
      }
    }

    currentLeftX = snapX(maxColRight + 6);
  }

  // Pass 2: Assign Y coordinates and interval-packed horizontal band tracks for all columns
  for (let col = 0; col < numCols; col++) {
    const cRows = colRows[col];
    let lastTrackY = snapY(initial.area.y + 4);
    let hasPrevTracks = false;

    const band0Nets = colBandNets[col][0];
    if (band0Nets.length) {
      lastTrackY = assignBandTracks(col, 0, band0Nets, lastTrackY + 2) - row;
      hasPrevTracks = true;
    }

    for (let r = 0; r < cRows.length; r++) {
      const rComps = cRows[r];
      const topReach = Math.max(
        ...rComps.map(c => {
          const ep = refPin(c);
          const n = measured.get(c.id)!;
          const refP = n.pins.find(p => p.id === ep.pinId)!;
          return refP.y - n.rect.y;
        }),
      );
      const rowRefY = hasPrevTracks
        ? snapY(lastTrackY + Math.max(row, topReach + 4))
        : snapY(lastTrackY + topReach);

      for (const c of rComps) {
        const ep = refPin(c);
        place(ep, point(ep).x, rowRefY);
      }

      const pinBottom = Math.max(
        ...rComps.map(c => {
          const ep = refPin(c);
          const n = measured.get(c.id)!;
          const refP = n.pins.find(p => p.id === ep.pinId)!;
          return rowRefY + Math.max(...n.pins.map(p => p.y - refP.y));
        }),
      );
      const shapeBottom = Math.max(
        ...rComps.map(c => {
          const ep = refPin(c);
          const n = measured.get(c.id)!;
          const refP = n.pins.find(p => p.id === ep.pinId)!;
          return rowRefY + Math.max(...n.shapes.map(s => s.rect.y + s.rect.height - refP.y));
        }),
      );
      const firstTrackStart = snapY(Math.max(pinBottom + row, shapeBottom + 4));

      const bandIdx = r + 1;
      const activeNets = colBandNets[col][bandIdx];
      if (activeNets.length) {
        lastTrackY = assignBandTracks(col, bandIdx, activeNets, firstTrackStart) - row;
        hasPrevTracks = true;
      } else {
        lastTrackY = shapeBottom + 4;
        hasPrevTracks = false;
      }
    }
  }

  const maxX = Math.max(
    ...[...corridorX.values()],
    ...page.components.map(c => {
      const ep = refPin(c);
      const n = measured.get(c.id)!;
      const refP = n.pins.find(p => p.id === ep.pinId)!;
      return point(ep).x + (n.rect.x + n.rect.width - refP.x);
    }),
  );
  const maxY = Math.max(
    ...[...bandTrackY.values()],
    ...page.components.map(c => {
      const ep = refPin(c);
      const n = measured.get(c.id)!;
      const refP = n.pins.find(p => p.id === ep.pinId)!;
      return point(ep).y + (n.rect.y + n.rect.height - refP.y);
    }),
  );
  if (maxX > initial.area.x + initial.area.width + 1e-3 || maxY > initial.area.y + initial.area.height + 1e-3) {
    sessionDiagnostics.record('autoconnect_capacity',{pageId:page.id,profile,maxX,maxY,area:initial.area,rows:colRows.map(rows=>rows.map(r=>r.map(c=>c.id))),corridors:corridorNets.length});
    return reject(
      'geometry_rejected',
      'Die gemessenen Symbole, Beschriftungen oder Leitungszüge passen nicht kollisionsfrei in den Zeichenbereich.',
    );
  }

  const used = new Set(
    work.pages.flatMap(p =>
      [
        p,
        ...p.components,
        ...p.wires,
        ...(p.groups ?? []),
        ...(p.texts ?? []),
        ...(p.boxes ?? []),
        ...(p.images ?? []),
        ...(p.cables ?? []),
      ].map(x => x.id),
    ),
  );
  const allocate = (base: string) => {
    let id = base,
      i = 1;
    while (used.has(id)) id = base + '-' + i++;
    used.add(id);
    return id;
  };
  const added: PlacedComponent[] = [],
    generated: Wire[] = [];
  const consumed = new Map<string, number>();
  const connect = (id: string, from: Endpoint, to: Endpoint) => {
    const n = nets.get(id)!,
      index = consumed.get(id) ?? 0;
    consumed.set(id, index + 1);
    generated.push({
      ...n.wires[0],
      id: n.wires[index]?.id ?? allocate(n.wires[0].id + '-distribution-' + index),
      from,
      to,
      waypoints: [],
      isAutoconnect: false,
      routingMode: 'auto',
    });
  };
  const junction = (dirs: Direction[], x: number, y: number, net: IndexedNet) => {
    const names = [
      'corner_compact_left_top',
      'corner_compact_left_bottom',
      'corner_compact_right_top',
      'corner_compact_right_bottom',
      't_piece_directed_bottom_left',
      't_piece_directed_right_top',
      't_piece_directed_left_top',
      't_piece_directed_top_right',
      'cross_junction_bus_top',
      'cross_junction_bus_right',
      'cross_junction_bus_bottom',
      'cross_junction_bus_left',
      't_piece_down',
      't_piece_up',
      't_piece_left',
      't_piece_right',
      'corner_top_left',
      'corner_bottom_left',
      'corner_top_right',
      'corner_bottom_right',
    ];
    const s = names
      .map(id => getSymbolById(id, work))
      .find(
        s =>
          s &&
          !s.unresolved &&
          s.pins.length === dirs.length &&
          dirs.every(d => s.pins.filter(p => p.direction === d).length === 1),
      );
    if (!s) throw new Error('Distribution junction is unavailable');
    const c: PlacedComponent = {
      id: allocate(page.components[0].id + '-distribution-' + added.length),
      symbolId: s.id,
      bmk: '',
      functionText: '',
      x: x * u - s.pins.find(p => p.direction === 'top' || p.direction === 'bottom')!.x,
      y: y * u - s.pins.find(p => p.direction === 'left' || p.direction === 'right')!.y,
      rotation: 0,
      higherLevelFunction: page.higherLevel,
      mountingLocation: page.location,
      pinLabelPosition: { visible: false },
      pins: Object.fromEntries(s.pins.map(p => [p.id, { wireIds: [] }])),
    };
    page.components.push(c);
    added.push(c);
    for (const g of page.groups ?? []) {
      if (net.endpoints.every(ep => g.members.some(m => m.kind === 'component' && m.id === ep.componentId))) {
        g.members.push({ kind: 'component', id: c.id });
      }
    }
    return (dir: Direction): Endpoint => ({ componentId: c.id, pinId: s.pins.find(p => p.direction === dir)!.id });
  };

  try {
    for (const net of netList) {
      const corrX = corridorX.get(net.id);
      const activeBands: { col: number; band: number; y: number }[] = [];
      for (const code of netBandSet.get(net.id)!) {
        const [col, band] = code.split(':').map(Number);
        const upperEps = net.endpoints.filter(e => {
          const l = compLoc.get(e.componentId)!;
          return l.col === col && l.row === band - 1 && point(e).direction === 'bottom';
        });
        const lowerEps = net.endpoints.filter(e => {
          const l = compLoc.get(e.componentId)!;
          return l.col === col && l.row === band && point(e).direction === 'top';
        });
        if (
          corrX === undefined &&
          upperEps.length === 1 &&
          lowerEps.length === 1 &&
          Math.abs(point(upperEps[0]).x - point(lowerEps[0]).x) < 1e-6
        ) {
          connect(net.id, upperEps[0], lowerEps[0]);
          continue;
        }
        const y = bandTrackY.get(`${col}:${band}:${net.id}`);
        if (y !== undefined) activeBands.push({ col, band, y });
      }

      const byY = new Map<number, { col: number; band: number }[]>();
      for (const ab of activeBands) {
        const ry = Math.round(ab.y * 1000) / 1000;
        byY.set(ry, [...(byY.get(ry) ?? []), { col: ab.col, band: ab.band }]);
      }
      const sortedYs = [...byY.keys()].sort((a, b) => a - b);
      let prevCorrBottom: Endpoint | undefined;

      sortedYs.forEach((y, yIdx) => {
        const bandsAtY = byY.get(y)!;
        const upperEps = net.endpoints.filter(e => {
          const l = compLoc.get(e.componentId)!;
          return point(e).direction === 'bottom' && bandsAtY.some(b => b.col === l.col && b.band === l.row + 1);
        });
        const lowerEps = net.endpoints.filter(e => {
          const l = compLoc.get(e.componentId)!;
          return point(e).direction === 'top' && bandsAtY.some(b => b.col === l.col && b.band === l.row);
        });

        type StationSpec = { x: number; upper?: Endpoint; lower?: Endpoint; corridorUp?: boolean; corridorDown?: boolean };
        const byX = new Map<number, StationSpec>();
        const getStation = (xVal: number) => {
          const rx = Math.round(xVal * 1000) / 1000;
          if (!byX.has(rx)) byX.set(rx, { x: xVal });
          return byX.get(rx)!;
        };

        for (const ep of upperEps) {
          const st = getStation(point(ep).x);
          if (st.upper) throw new Error('Duplicate upper station endpoint');
          st.upper = ep;
        }
        for (const ep of lowerEps) {
          const st = getStation(point(ep).x);
          if (st.lower) throw new Error('Duplicate lower station endpoint');
          st.lower = ep;
        }
        if (corrX !== undefined && sortedYs.length > 1) {
          const st = getStation(corrX);
          if (yIdx > 0) st.corridorUp = true;
          if (yIdx < sortedYs.length - 1) st.corridorDown = true;
        }

        const stations = [...byX.values()].sort((a, b) => a.x - b.x);
        let prevRight: Endpoint | undefined;
        let nextCorrBottom: Endpoint | undefined;

        stations.forEach((st, idx) => {
          if ((st.upper && st.corridorUp) || (st.lower && st.corridorDown)) {
            throw new Error('Corridor collides with endpoint');
          }
          const hasTop = !!st.upper || !!st.corridorUp;
          const hasBottom = !!st.lower || !!st.corridorDown;
          const hasLeft = idx > 0;
          const hasRight = idx < stations.length - 1;
          const dirs: Direction[] = [
            ...(hasTop ? ['top' as const] : []),
            ...(hasBottom ? ['bottom' as const] : []),
            ...(hasLeft ? ['left' as const] : []),
            ...(hasRight ? ['right' as const] : []),
          ];
          const j = junction(dirs, st.x, y, net);
          if (st.upper) connect(net.id, st.upper, j('top'));
          if (st.corridorUp && prevCorrBottom) connect(net.id, prevCorrBottom, j('top'));
          if (st.lower) connect(net.id, j('bottom'), st.lower);
          if (st.corridorDown) nextCorrBottom = j('bottom');
          if (hasLeft && prevRight) connect(net.id, prevRight, j('left'));
          if (hasRight) prevRight = j('right');
        });

        prevCorrBottom = nextCorrBottom;
      });
    }
  } catch {
    return reject('junction_library', 'Die benötigten Bibliotheks-Verbindungsstücke sind nicht eindeutig verfügbar.');
  }

  if (page.components.length > 500 || [...nets].some(([id, n]) => (consumed.get(id) ?? 0) < n.wires.length)) {
    return reject('object_limit', 'Die Konstruktion würde die Objektgrenze überschreiten oder Leitungs-IDs verlieren.');
  }
  page.wires = generated;
  for (const c of page.components) for (const p of Object.values(c.pins)) p.wireIds = [];
  for (const w of generated) {
    for (const ep of [w.from, w.to]) {
      page.components.find(c => c.id === ep.componentId)!.pins[ep.pinId].wireIds!.push(w.id);
    }
  }
  const final = snapshotPage(page, work);
  const finalNets = netIds(final);
  const signature = (mapping: Map<string, string>, wires: Wire[]) => {
    const contact = new Map<string, string>();
    for (const w of wires) {
      for (const ep of [w.from, w.to]) {
        if (newDevices.has(ep.componentId)) contact.set(key(ep), mapping.get(w.id)!);
      }
    }
    return [...new Set(contact.values())]
      .map(id =>
        [...contact]
          .filter(([, n]) => n === id)
          .map(([ep]) => ep)
          .sort(),
      )
      .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  };
  if (JSON.stringify(signature(ids, original.wires)) !== JSON.stringify(signature(finalNets, page.wires))) {
    return reject('net_equivalence', 'Die ursprüngliche elektrische Netzstruktur konnte nicht erhalten werden.');
  }
  const report = validateLayout(final);
  sessionDiagnostics.record('distribution_geometry', { snapshot: final, report });
  if (!report.valid) {
    return reject(
      'geometry_rejected',
      'Die gemessenen Symbole, Beschriftungen oder Leitungszüge passen nicht kollisionsfrei in den Zeichenbereich.',
      report.issues,
    );
  }
  markLayoutAutoconnections(work, page);
  if (page.wires.some(w => !w.isAutoconnect)) {
    return reject(
      'autoconnect_unavailable',
      'Nicht alle konstruierten Abschnitte sind mit der tatsächlichen Autoconnect-Erkennung reproduzierbar.',
    );
  }
  Object.assign(original, page);
  diagnose?.({
    strategy: 'socket_distribution',
    status: 'applied',
    code: 'applied',
    message: 'Verteilungsmuster angewendet: gemeinsame Leitungszüge und geprüfte Autoconnect-Achsen.',
  });
  return true;
}
