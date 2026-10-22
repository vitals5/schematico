import { SymbolDefinition, Project, PlacedComponent } from './types';
import { getSymbolForComponent } from './symbols';
import { rotatedLocalPoint } from './SymbolGeometry';
import { wirePolyline, wirePinDirection } from './WireRouting';

const directions = ['top', 'right', 'bottom', 'left'] as const;
type Direction = typeof directions[number];
const opposite: Record<Direction, Direction> = { top: 'bottom', right: 'left', bottom: 'top', left: 'right' };

export function isInterruptionSymbol(s: SymbolDefinition): boolean {
  return s.id === 'potential_arrow' || s.id.startsWith('potential_arrow_')
    || s.source?.library === 'SPECIAL' && s.source.number === 8;
}
export function isConnectionSymbol(s: SymbolDefinition): boolean {
  return s.category === 'connections' || !!s.connectionGraphic || isInterruptionSymbol(s);
}
export function connectionFamily(s: SymbolDefinition): string {
  if (isInterruptionSymbol(s)) return 'interruptions';
  const n = s.source?.library === 'SPECIAL' ? s.source.number : -1;
  return s.id.startsWith('t_piece') || [64, 66, 67, 72, 78].includes(n) ? 'tees'
    : s.id.startsWith('corner') || [70, 75].includes(n) ? 'corners'
    : s.id.startsWith('cross') || [69, 77].includes(n) ? 'crossings' : 'other';
}
export function arrowDirection(s: SymbolDefinition): 'top' | 'right' | 'bottom' | 'left' {
  if (s.source?.library === 'SPECIAL' && s.source.number === 8)
    return (['right', 'top', 'left', 'bottom'] as const)[s.source.variant % 4];
  return s.id.endsWith('_up') ? 'top' : s.id.endsWith('_left') ? 'left' : s.id.endsWith('_right') ? 'right' : 'bottom';
}
/** Source layouts remain unchanged until selected; new arrows default to the tip side. */
export function interruptionLabelPosition(project: Project, comp: PlacedComponent, s: SymbolDefinition) {
  if (!isInterruptionSymbol(s)) return;
  let side = project.settings?.interruptionLabelSide;
  if (!side || side === 'source') {
    const connected = interruptionReferencePosition(project, comp, s);
    if (connected) return connected;
    if (s.source) return;
    side = 'after';
  }
  let direction = arrowDirection(s);
  if (side === 'before') direction = ({ top: 'bottom', bottom: 'top', left: 'right', right: 'left' } as const)[direction];
  return interruptionTextPositions(comp, s, direction);
}

function interruptionTextPositions(comp: PlacedComponent, s: SymbolDefinition, direction: Direction) {
  const gap = 3 * (s.unitsPerMm ?? 2);
  const turn = ((Math.round((comp.rotation || 0) / 90) % 4) + 4) % 4;
  const worldDirection = (['top','right','bottom','left'] as const)[(['top','right','bottom','left'].indexOf(direction) + turn) % 4];
  const anchor = worldDirection === 'left' ? 'end' as const : worldDirection === 'right' ? 'start' as const : 'middle' as const;
  const position = direction === 'left' ? { x: -gap, y: s.height / 2 }
    : direction === 'right' ? { x: s.width + gap, y: s.height / 2 }
    : direction === 'top' ? { x: s.width / 2, y: -gap }
    : { x: s.width / 2, y: s.height + gap };
  // The two lines stay horizontal in world space, also after a quarter turn.
  const lineStep = Math.max(comp.functionTextPosition?.fontSize ?? 8.5,
    comp.crossRefFontSize ?? comp.crossRefPosition?.fontSize ?? 8) * 1.4;
  const down = [{x:0,y:lineStep},{x:lineStep,y:0},{x:0,y:-lineStep},{x:-lineStep,y:0}][turn];
  if (comp.crossRef && worldDirection === 'top') { position.x -= down.x; position.y -= down.y; }
  return { ...position, anchor, referenceX: position.x + down.x, referenceY: position.y + down.y };
}

/** Find the first painted segment leaving an interruption point. Its opposite
 * is the reference side, independent of the glyph's nominal arrow direction. */
export function interruptionReferencePosition(project: Project, comp: PlacedComponent, s: SymbolDefinition) {
  if (!isInterruptionSymbol(s)) return;
  const page = project.pages?.find(p => p.components.some(c => c.id === comp.id));
  if (!page) return;
  const occupied = new Set<Direction>();
  const turn = Math.round(comp.rotation / 90);
  for (const wire of page.wires) {
    const from = wire.from.componentId === comp.id, to = wire.to.componentId === comp.id;
    if (!from && !to) continue;
    const own = from ? wire.from : wire.to, other = from ? wire.to : wire.from;
    const pin = s.pins.find(p => p.id === own.pinId);
    if (!pin) continue;
    const direction = directions[(directions.indexOf(pin.direction) + turn + 4) % 4];
    const anchor = rotatedLocalPoint(pin, s, comp.rotation), start = { x: comp.x + anchor.x, y: comp.y + anchor.y };
    const target = page.components.find(c => c.id === other.componentId), symbol = target && getSymbolForComponent(target, project);
    const port = symbol?.pins.find(p => p.id === other.pinId);
    if (!target || !symbol || !port) { occupied.add(direction); continue; }
    const endpoint = rotatedLocalPoint(port, symbol, target.rotation);
    const points = wirePolyline(start, { x: target.x + endpoint.x, y: target.y + endpoint.y },
      from ? wire.waypoints : wire.waypoints?.slice().reverse(), direction, wirePinDirection(page, project, other), false, page.grid);
    const next = points.find(p => Math.hypot(p.x - start.x, p.y - start.y) > 1e-6);
    if (!next) { occupied.add(direction); continue; }
    const dx = next.x - start.x, dy = next.y - start.y;
    occupied.add(Math.abs(dx) > Math.abs(dy) ? dx < 0 ? 'left' : 'right' : dy < 0 ? 'top' : 'bottom');
  }
  if (!occupied.size) return;
  let free: Direction = opposite[occupied.values().next().value!];
  if (occupied.has(free)) free = directions.find(d => !occupied.has(d)) ?? free;
  const local = directions[(directions.indexOf(free) - turn + 4) % 4];
  return interruptionTextPositions(comp, s, local);
}
