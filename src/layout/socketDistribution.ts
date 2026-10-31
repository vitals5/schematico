import type { Page, Project, PlacedComponent, Wire, PinDefinition } from '../model/types';
import { getDrawingUnitsPerMm, getSymbolById, getSymbolForComponent } from '../model/symbols';
import { AutoconnectEngine } from '../model/AutoconnectEngine';
import { snapshotPage } from './geometry';
import { clone } from './types';
import { netIds, validateLayout } from './validate';
import { markLayoutAutoconnections } from './draftConnections';

type Endpoint = Wire['from'];
type Direction = PinDefinition['direction'];
const key = (e: Endpoint) => JSON.stringify([e.componentId, e.pinId]);
const byTag = (a: PlacedComponent, b: PlacedComponent) => a.bmk.localeCompare(b.bmk, 'de', { numeric: true }) || a.id.localeCompare(b.id);
interface Net { endpoints: Endpoint[]; wires: Wire[] }
interface Circuit { breaker: PlacedComponent; sockets: PlacedComponent[]; input: string; output: string; phase: number; liveNet: string }

/** A bounded construction grammar for NEW complete socket distributions. Recognition
 * follows terminal connectivity, never prose, coordinates, device tags or potential names.
 * The source page is only replaced after net equivalence AND full geometry checks pass. */
export function prepareSocketDistribution(project: Project, original: Page, newDevices: Set<string>, newWires: Set<string>): boolean {
  if (original.components.some(c => !newDevices.has(c.id) || c.rotation || c.source || c.deviceBox || c.scale && c.scale !== 1) ||
      original.wires.some(w => !newWires.has(w.id)) || original.texts?.length || original.images?.length || original.boxes?.length || original.cables?.length ||
      original.layoutConstraints?.lockedIds?.length || original.layoutConstraints?.fixedFrameIds?.length) return false;
  const work = clone(project), page = work.pages.find(p => p.id === original.id)!;
  const rcds = page.components.filter(c => c.symbolId === 'rcd_4p');
  const breakers = page.components.filter(c => /^(catalog_mcb_1p_[bcdkz]|circuit_breaker_1p)$/.test(c.symbolId)).sort(byTag);
  const sockets = page.components.filter(c => c.symbolId === 'socket_schuko');
  const feeds = page.components.filter(c => ['terminal_single', 'terminal_pe', 'potential_arrow', 'potential_arrow_up', 'potential_arrow_down'].includes(c.symbolId));
  if (rcds.length !== 1 || breakers.length < 2 || breakers.length > 8 || sockets.length < breakers.length || feeds.length !== 5 ||
      page.components.length !== 1 + breakers.length + sockets.length + feeds.length) return false;
  const rcd = rcds[0], initial = snapshotPage(page, work), ids = netIds(initial);
  if (initial.issues.some(i => i.severity === 'error')) return false;
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
  const phasePins = ['2', '4', '6'];
  const phases = phasePins.map(pin => netAt(rcd, pin));
  const neutral = netAt(rcd, 'N_out');
  const circuits: Circuit[] = [];
  for (const breaker of breakers) {
    const sym = getSymbolForComponent(breaker, work);
    const input = sym?.pins.filter(p => p.direction === 'top'), output = sym?.pins.filter(p => p.direction === 'bottom');
    if (!sym || sym.pins.length !== 2 || input?.length !== 1 || output?.length !== 1) return false;
    const inputNet=netAt(breaker,input[0].id);
    const phase = inputNet ? phases.indexOf(inputNet) : -1, liveNet = netAt(breaker, output[0].id);
    const loads = sockets.filter(s => netAt(s, '1') === liveNet).sort(byTag);
    if (phase < 0 || !liveNet || loads.length < 1 || loads.length > 4) return false;
    circuits.push({ breaker, sockets: loads, input: input[0].id, output: output[0].id, phase, liveNet });
  }
  if (new Set(circuits.flatMap(c => c.sockets.map(s => s.id))).size !== sockets.length) return false;
  const pe = netAt(sockets[0], 'PE');
  if (!pe || !neutral || new Set([...phases.filter(Boolean), neutral, pe]).size !== phases.filter(Boolean).length + 2 ||
      sockets.some(s => netAt(s, 'N') !== neutral || netAt(s, 'PE') !== pe)) return false;
  const feedPorts: Endpoint[] = [];
  const inputPins = ['1', '3', '5', 'N_in'];
  for (const pin of inputPins) {
    const net = nets.get(netAt(rcd, pin) ?? '');
    const eps = net?.endpoints.filter(ep => ep.componentId !== rcd.id);
    if (!eps || eps.length !== 1 || !feeds.some(f => f.id === eps[0].componentId)) return false;
    feedPorts.push(eps[0]);
  }
  const peFeed = nets.get(pe)!.endpoints.filter(ep => !sockets.some(s => s.id === ep.componentId));
  if (peFeed.length !== 1 || !feeds.some(f => f.id === peFeed[0].componentId) ||
      new Set([...feedPorts, peFeed[0]].map(ep => ep.componentId)).size !== 5) return false;
  // Explicitly enumerate every allowed contact; extra contacts/bridges/loads reject the grammar.
  const expected = new Map<string, Endpoint[]>();
  const expect = (id: string | undefined, eps: Endpoint[]) => { if (id) expected.set(id, eps); };
  inputPins.forEach((p, i) => expect(netAt(rcd, p), [at(rcd, p), feedPorts[i]]));
  phases.forEach((p, i) => expect(p, [at(rcd, phasePins[i]), ...circuits.filter(c => c.phase === i).map(c => at(c.breaker, c.input))]));
  for (const c of circuits) expect(c.liveNet, [at(c.breaker, c.output), ...c.sockets.map(s => at(s, '1'))]);
  expect(neutral, [at(rcd, 'N_out'), ...sockets.map(s => at(s, 'N'))]);
  expect(pe, [peFeed[0], ...sockets.map(s => at(s, 'PE'))]);
  if (expected.size !== nets.size || [...expected].some(([id, eps]) => JSON.stringify(eps.map(key).sort()) !== JSON.stringify(nets.get(id)!.endpoints.map(key).sort()))) return false;
  const specification = (w: Wire) => { const { id, from, to, waypoints, isAutoconnect, routingMode, ...spec } = w; return JSON.stringify(spec); };
  if ([...nets.values()].some(n => n.wires.some(w => specification(w) !== specification(n.wires[0])))) return false;
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
    if (point(ep).direction !== 'bottom') return false;
  }
  const geometry = snapshotPage(page, work);
  const measured = new Map(geometry.nodes.map(n => [n.id, n]));
  const loads = circuits.flatMap(c => c.sockets), inputNodes = feeds.map(f => measured.get(f.id)!);
  const row = snap(Math.max(10, initial.grid.spacing * 2));
  const pairShift = snap(16);
  const socketReach=Math.max(...loads.map(c=>point(at(c,'1')).x-measured.get(c.id)!.rect.x));
  const socketPins=Math.max(...loads.map(c=>point(at(c,'N')).x-point(at(c,'1')).x));
  const pitch = snap(Math.max(Math.max(...[...breakers, ...loads].map(c => measured.get(c.id)!.rect.width)),socketReach+pairShift*(Math.max(...circuits.map(c=>c.sockets.length))-1)+socketPins) + 4);
  const reach = Math.max(...circuits.flatMap(c => [at(c.breaker, c.output), ...c.sockets.map(s => at(s, '1'))]).map(ep => point(ep).x - measured.get(ep.componentId)!.rect.x));
  const leftN = snapX(initial.area.x + 6), leftPE = leftN + row;
  const first = snapX(leftPE + reach + 6);
  const feedBottom = snapY(initial.area.y + Math.max(...inputNodes.map(n => {
    const ep = [...feedPorts, peFeed[0]].find(ep => ep.componentId === n.id)!; return point(ep).y - n.rect.y;
  })) + 4);
  const rcdTop = feedBottom + row * 5;
  place(at(rcd, '1'), first, rcdTop);
  const rcdBottom = point(at(rcd, '2')).y;
  const breakerTop = rcdBottom + row * 5 + 4;
  circuits.forEach((c, i) => place(at(c.breaker, c.input), first + i * pitch, breakerTop));
  const breakerBottom = Math.max(...circuits.map(c => point(at(c.breaker, c.output)).y));
  const peY = snapY(breakerBottom + row + 4), nY = peY + row;
  const liveY = nY + row;
  const socketY = liveY + 16;
  const socketRow = snap(Math.max(...loads.map(c => measured.get(c.id)!.rect.height)) + 6);
  circuits.forEach((c, i) => c.sockets.forEach((s, j) => place(at(s, '1'), first + i * pitch + j * pairShift, socketY + j * socketRow)));
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
    place(peFeed[0], first - 2 * row, feedBottom + 3 * row);
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
    const nSource = at(rcd, 'N_out'), na = junction(['top', 'left'], point(nSource).x, rcdBottom + row), nb = junction(['right', 'bottom'], leftN, rcdBottom + row);
    connect(neutral, nSource, na('top')); connect(neutral, na('left'), nb('right'));
    for (const [id, source, x, y, pin] of [[neutral, nb('bottom'), leftN, nY, 'N'], [pe, peb('bottom'), leftPE, peY, 'PE']] as const) {
      const start = junction(['top', 'right'], x, y); connect(id, source, start('top')); let previous = start('right');
      const targets = loads.map(s => at(s, pin)).sort((a, b) => point(a).x - point(b).x);
      targets.forEach((ep, i) => {
        const t = junction(i === targets.length - 1 ? ['left', 'bottom'] : ['left', 'right', 'bottom'], point(ep).x, y);
        connect(id, previous, t('left')); connect(id, t('bottom'), ep);
        if (i < targets.length - 1) previous = t('right');
      });
    }
    for (const c of circuits) {
      const source = at(c.breaker, c.output);
      if (c.sockets.length === 1) connect(c.liveNet, source, at(c.sockets[0], '1'));
      else {
        const firstTap = junction(['top', 'bottom', 'right'], point(source).x, liveY, c.breaker);
        connect(c.liveNet, source, firstTap('top')); connect(c.liveNet, firstTap('bottom'), at(c.sockets[0], '1'));
        let previous = firstTap('right');
        c.sockets.slice(1).forEach((s, i, rest) => {
          const target = at(s, '1'), t = junction(i === rest.length - 1 ? ['left', 'bottom'] : ['left', 'right', 'bottom'], point(target).x, liveY, c.breaker);
          connect(c.liveNet, previous, t('left')); connect(c.liveNet, t('bottom'), target);
          if (i < rest.length - 1) previous = t('right');
        });
      }
    }
  } catch { return false; }
  if (page.components.length > 200 || [...nets].some(([id, n]) => (consumed.get(id) ?? 0) < n.wires.length)) return false;
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
  if (JSON.stringify(signature(ids, original.wires)) !== JSON.stringify(signature(finalNets, page.wires)) || !validateLayout(final).valid) return false;
  markLayoutAutoconnections(work, page);
  if (page.wires.some(w => !w.isAutoconnect)) return false;
  Object.assign(original, page);
  return true;
}
