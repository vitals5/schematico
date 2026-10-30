import type { LayoutSnapshot, Rect } from './types';
import { relatedCircuits } from './relatedCircuits';
import { union, right, bottom } from './rect';

/** Soft drawing-quality score. Electrical validity is checked independently. */
function circuitAreas(snapshot: LayoutSnapshot) {
    const available = new Map(snapshot.nodes.filter(n => n.kind === 'component' && n.pins.length).map(n => [n.id,n]));
    const adjacent = new Map([...available.keys()].map(id => [id,new Set<string>()]));
    for (const e of snapshot.edges) if (available.has(e.from.componentId) && available.has(e.to.componentId)) {
        adjacent.get(e.from.componentId)!.add(e.to.componentId); adjacent.get(e.to.componentId)!.add(e.from.componentId);
    }
    const unseen = new Set([...available.keys()].sort()), circuits: {id:string}[][]=[];
    while(unseen.size){
        const queue=[unseen.values().next().value!], ids:string[]=[];
        while(queue.length){const id=queue.pop()!;if(!unseen.delete(id))continue;ids.push(id);queue.push(...adjacent.get(id)!);}
        circuits.push(ids.map(id=>({id})));
    }
    const wired=new Set(snapshot.edges.flatMap(e=>[e.from.componentId,e.to.componentId]));
    const active=circuits.filter(c=>c.length>1||c.some(n=>wired.has(n.id)));
    return { available, circuits, active };
}
/** Reading rows are a soft alternative to a single horizontal band. */
function readingRows(areas: { rect: Rect; power: boolean }[], tolerance: number) {
    const rows: typeof areas[] = [];
    for (const a of [...areas].sort((a,b)=>a.rect.y-b.rect.y||a.rect.x-b.rect.x)) {
        const last=rows.at(-1);
        if(last && Math.abs(a.rect.y-last[0].rect.y)<=tolerance)last.push(a);else rows.push([a]);
    }
    if(rows.length<2)return;
    let controlSeen=false;
    const bounds=rows.map(row=>union(row.map(a=>a.rect)));
    for(const [index,row]of rows.entries()){
        row.sort((a,b)=>a.rect.x-b.rect.x);
        if(index && bottom(bounds[index-1])>bounds[index].y)return;
        for(const [i,a]of row.entries()){
            if(i && right(row[i-1].rect)>a.rect.x)return;
            if(a.power && controlSeen)return;
            if(!a.power)controlSeen=true;
        }
    }
    let cost=12*(rows.length-1);
    for(let i=1;i<bounds.length;i++){
        cost+=Math.max(0,bounds[i].y-bottom(bounds[i-1])-24)*0.75;
        cost+=Math.abs(bounds[i].x-bounds[i-1].x)*0.5;
    }
    return {cost,bounds};
}
export function relatedAreaPenalty(snapshot: LayoutSnapshot): number {
    const { available, circuits, active } = circuitAreas(snapshot);
    if(active.length<2 || active.length>12)return 0;
    const bounds=(c:{id:string}[])=>union(c.map(n=>available.get(n.id)!.rect));
    const rectangles=new Map(circuits.map(c=>[c,bounds(c)]));
    let score=0;
    for(const pair of relatedCircuits(active,snapshot)){
        if(pair.length<2 || pair.flat().some(n=>available.get(n.id)!.fixed))continue;
        const role=(c:{id:string}[])=>c.some(n=>available.get(n.id)!.circuitRole==='power');
        const power=union(pair.filter(role).map(c=>rectangles.get(c)!));
        const control=union(pair.filter(c=>!role(c)).map(c=>rectangles.get(c)!));
        const dx=Math.max(0,control.x-right(power),power.x-right(control));
        const dy=Math.max(0,control.y-bottom(power),power.y-bottom(control));
        let cost=Math.max(0,dx+dy*2-24)*0.75 + Math.abs(power.y-control.y)*0.75;
        if(control.x<power.x)cost+=40+Math.min(60,(power.x-control.x)*0.5);
        const overlapX=Math.min(right(power),right(control))-Math.max(power.x,control.x);
        const overlapY=Math.min(bottom(power),bottom(control))-Math.max(power.y,control.y);
        if(overlapX>0 && overlapY>0)cost+=40+Math.min(overlapX,overlapY)*4;
        const wrapped=readingRows(pair.map(c=>({rect:rectangles.get(c)!,power:role(c)})),Math.max(2,Math.min(4,snapshot.grid.spacing)));
        if(wrapped)cost=Math.min(cost,wrapped.cost);
        const ordered=pair.map(c=>rectangles.get(c)!).sort((a,b)=>a.x-b.x);
        for(const c of circuits){
            if(pair.includes(c))continue;
            const r=rectangles.get(c)!;
            const horizontal=ordered.some((a,i)=>{const b=ordered[i+1];return b && r.x>=right(a) && right(r)<=b.x && bottom(r)>Math.max(a.y,b.y) && r.y<Math.min(bottom(a),bottom(b));});
            const vertical=wrapped?.bounds.some((a,i)=>{const b=wrapped.bounds[i+1];return b && r.y>=bottom(a) && bottom(r)<=b.y && right(r)>Math.max(a.x,b.x) && r.x<Math.min(right(a),right(b));});
            if(horizontal||vertical)cost+=60;
        }
        score+=Math.min(200,cost);
    }
    return score;
}

/** Preserve useful proximity when comparing otherwise valid sheet partitions. */
export function separatedAreaPenalty(snapshot: LayoutSnapshot, sheets: ReadonlyMap<string,string>): number {
    const {available,active}=circuitAreas(snapshot);
    if(active.length<2||active.length>12)return 0;
    let score=0;
    for(const pair of relatedCircuits(active,snapshot)){
        if(pair.length<2||pair.flat().some(n=>available.get(n.id)!.fixed||!sheets.has(n.id)))continue;
        if(new Set(pair.flat().map(n=>sheets.get(n.id)!)).size>1)score+=120;
    }
    return score;
}
