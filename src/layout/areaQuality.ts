import type { LayoutSnapshot } from './types';
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
    return { available, circuits };
}
export function relatedAreaPenalty(snapshot: LayoutSnapshot): number {
    const { available, circuits } = circuitAreas(snapshot);
    if(circuits.length<2 || circuits.length>12)return 0;
    const bounds=(c:{id:string}[])=>union(c.map(n=>available.get(n.id)!.rect));
    const rectangles=new Map(circuits.map(c=>[c,bounds(c)]));
    let score=0;
    for(const pair of relatedCircuits(circuits,snapshot)){
        if(pair.length!==2 || pair.flat().some(n=>available.get(n.id)!.fixed))continue;
        const [power,control]=pair.map(c=>rectangles.get(c)!);
        const dx=Math.max(0,control.x-right(power),power.x-right(control));
        const dy=Math.max(0,control.y-bottom(power),power.y-bottom(control));
        let cost=Math.max(0,dx+dy*2-24)*0.75 + Math.abs(power.y-control.y)*0.75;
        if(control.x<power.x)cost+=40+Math.min(60,(power.x-control.x)*0.5);
        const overlapX=Math.min(right(power),right(control))-Math.max(power.x,control.x);
        const overlapY=Math.min(bottom(power),bottom(control))-Math.max(power.y,control.y);
        if(overlapX>0 && overlapY>0)cost+=40+Math.min(overlapX,overlapY)*4;
        if(right(power)<=control.x && overlapY>0)for(const c of circuits){
            if(pair.includes(c))continue;
            const r=rectangles.get(c)!;
            if(r.x>=right(power) && right(r)<=control.x && bottom(r)>Math.max(power.y,control.y) && r.y<Math.min(bottom(power),bottom(control)))cost+=60;
        }
        score+=Math.min(200,cost);
    }
    return score;
}

/** Preserve useful proximity when comparing otherwise valid sheet partitions. */
export function separatedAreaPenalty(snapshot: LayoutSnapshot, sheets: ReadonlyMap<string,string>): number {
    const {available,circuits}=circuitAreas(snapshot);
    if(circuits.length<2||circuits.length>12)return 0;
    let score=0;
    for(const pair of relatedCircuits(circuits,snapshot)){
        if(pair.length!==2||pair.flat().some(n=>available.get(n.id)!.fixed||!sheets.has(n.id)))continue;
        if(new Set(pair.flat().map(n=>sheets.get(n.id)!)).size>1)score+=120;
    }
    return score;
}
