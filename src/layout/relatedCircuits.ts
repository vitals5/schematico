import type { ElkNode } from 'elkjs/lib/elk-api';
import type { LayoutSnapshot } from './types';
/** Drawing proximity only. Never creates an electrical edge or a saved group. */
export function relatedCircuits(circuits: ElkNode[][], snapshot: LayoutSnapshot): ElkNode[][][] {
    const owner = new Map(circuits.flatMap((c,i)=>c.flatMap(n=>(n.ports??[]).map(p=>[p.id,i] as const))));
    const members = circuits.map(c=>new Set(c.map(n=>n.id)));
    const nodes = circuits.map((_,i)=>snapshot.nodes.filter(n=>members[i].has(n.id)||n.pins.some(p=>owner.get(JSON.stringify([n.id,p.id]))===i)));
    const priority = nodes.map(ns=>{const roles=new Set(ns.map(n=>n.circuitRole).filter(Boolean));return roles.size===1&&roles.has('power')?0:roles.size===1&&roles.has('control')?2:1;});
    const names = circuits.map(c=>c.map(n=>n.id).sort()[0]);
    const relations = new Map<string,{masters:number[];contacts:number[]}>();
    nodes.forEach((ns,i)=>ns.forEach(n=>{if(!n.deviceRelation || (n.deviceRelation.kind==='master' ? priority[i]!==2 : priority[i]!==0))return;const r=relations.get(n.deviceRelation.key)??{masters:[],contacts:[]};r[n.deviceRelation.kind==='master'?'masters':'contacts'].push(i);relations.set(n.deviceRelation.key,r);}));
    const partners = circuits.map(()=>new Set<number>());
    for(const r of relations.values()) if(r.masters.length===1&&r.contacts.length===1){const a=r.contacts[0],b=r.masters[0];if(a!==b&&priority[a]===0&&priority[b]===2){partners[a].add(b);partners[b].add(a);}}
    const used=new Set<number>(),units:{ids:number[];priority:number;name:string}[]=[];
    for(const i of circuits.map((_,i)=>i).sort((a,b)=>priority[a]-priority[b]||names[a].localeCompare(names[b]))){
        if(used.has(i))continue;
        const p=[...partners[i]][0];
        const ids=partners[i].size===1&&partners[p].size===1&&!used.has(p)?[i,p].sort((a,b)=>priority[a]-priority[b]):[i];
        ids.forEach(id=>used.add(id));units.push({ids,priority:Math.min(...ids.map(id=>priority[id])),name:names[ids[0]]});
    }
    return units.sort((a,b)=>a.priority-b.priority||a.name.localeCompare(b.name)).map(u=>u.ids.map(i=>circuits[i]));
}
