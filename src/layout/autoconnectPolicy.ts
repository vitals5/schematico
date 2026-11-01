import type {Page,Project,Wire} from '../model/types';
import {AutoconnectEngine} from '../model/AutoconnectEngine';
const pair=(a:Wire['from'],b:Wire['to'])=>JSON.stringify([JSON.stringify([a.componentId,a.pinId]),JSON.stringify([b.componentId,b.pinId])].sort());
/** Flags alone are insufficient: the actual pin directions and nearest facing
 * contacts must reproduce every segment, with no hidden routing waypoints. */
export function unverifiedAutoconnections(project:Project,page:Page):string[]{
 const actual=new Set(AutoconnectEngine.findAutoconnectPairs(page.components,1e-6,page.grid?page.grid.spacing/4:8,project).map(p=>pair(p.pin1,p.pin2)));
 return page.wires.filter(w=>!w.isAutoconnect||w.waypoints?.length||!actual.has(pair(w.from,w.to))).map(w=>w.id);
}
