import type {Page,Project,Wire} from '../model/types';
import {AutoconnectEngine} from '../model/AutoconnectEngine';
import {getSymbolForComponent} from '../model/symbols';
const pair=(a:Wire['from'],b:Wire['to'])=>JSON.stringify([JSON.stringify([a.componentId,a.pinId]),JSON.stringify([b.componentId,b.pinId])].sort());
const opposite = { top: 'bottom', bottom: 'top', left: 'right', right: 'left' } as const;

function isAbutted(project: Project, page: Page, w: Wire): boolean {
  const c1 = page.components.find(c => c.id === w.from.componentId);
  const c2 = page.components.find(c => c.id === w.to.componentId);
  if (!c1 || !c2) return false;
  const s1 = getSymbolForComponent(c1, project);
  const s2 = getSymbolForComponent(c2, project);
  const p1 = s1?.pins.find(p => p.id === w.from.pinId);
  const p2 = s2?.pins.find(p => p.id === w.to.pinId);
  if (!s1 || !s2 || !p1 || !p2) return false;
  const q1 = AutoconnectEngine.getRotatedPinInfo(c1, p1, s1);
  const q2 = AutoconnectEngine.getRotatedPinInfo(c2, p2, s2);
  return (
    Math.abs(q1.worldX - q2.worldX) <= 1e-4 &&
    Math.abs(q1.worldY - q2.worldY) <= 1e-4 &&
    q1.direction === opposite[q2.direction]
  );
}

/** Flags alone are insufficient: the actual pin directions and nearest facing
 * contacts must reproduce every segment, with no hidden routing waypoints. */
export function unverifiedAutoconnections(project:Project,page:Page):string[]{
 const actual=new Set(AutoconnectEngine.findAutoconnectPairs(page.components,1e-6,page.grid?page.grid.spacing/4:8,project).map(p=>pair(p.pin1,p.pin2)));
 return page.wires.filter(w=>!w.isAutoconnect||w.waypoints?.length||(!actual.has(pair(w.from,w.to))&&!isAbutted(project,page,w))).map(w=>w.id);
}
