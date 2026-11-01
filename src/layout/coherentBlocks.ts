import type { LayoutSnapshot } from './types';

/** Soft page-partition units. Explicit atomic groups remain indivisible; only
 * unambiguous facing two-terminal device chains are joined for the first attempt. */
export function coherentBlocks(atomic: string[][], s: LayoutSnapshot): string[][] {
    const owner = new Map(atomic.flatMap((b, i) => b.map(id => [id, i] as const)));
    const parent = atomic.map((_, i) => i);
    const root = (i: number): number => parent[i] === i ? i : (parent[i] = root(parent[i]));
    const nodes = new Map(s.nodes.map(n => [n.id, n]));
    const eligible = (id: string) => {
        const n = nodes.get(id);
        return n && !n.fixed && !n.routingJunction && !n.handover && n.pins.length === 2 &&
            (n.pins.some(p => p.direction === 'top') && n.pins.some(p => p.direction === 'bottom') ||
             n.pins.some(p => p.direction === 'left') && n.pins.some(p => p.direction === 'right'));
    };
    const outgoing = new Map<string, Set<string>>(), incoming = new Map<string, Set<string>>();
    const arcs: [string, string][] = [];
    for (const e of s.edges) {
        const a = nodes.get(e.from.componentId)?.pins.find(p => p.id === e.from.pinId);
        const b = nodes.get(e.to.componentId)?.pins.find(p => p.id === e.to.pinId);
        if (!a || !b || !owner.has(e.from.componentId) || !owner.has(e.to.componentId)) continue;
        const forward = a.direction === 'bottom' && b.direction === 'top' || a.direction === 'right' && b.direction === 'left';
        const backward = b.direction === 'bottom' && a.direction === 'top' || b.direction === 'right' && a.direction === 'left';
        if (!forward && !backward) continue;
        const from = forward ? e.from.componentId : e.to.componentId, to = forward ? e.to.componentId : e.from.componentId;
        if (!outgoing.has(from)) outgoing.set(from, new Set());
        if (!incoming.has(to)) incoming.set(to, new Set());
        outgoing.get(from)!.add(to); incoming.get(to)!.add(from); arcs.push([from, to]);
    }
    for (const [a, b] of arcs) if (a !== b && eligible(a) && eligible(b) && outgoing.get(a)!.size === 1 && incoming.get(b)!.size === 1) {
        const first = root(owner.get(a)!), second = root(owner.get(b)!);
        if (first !== second) parent[Math.max(first, second)] = Math.min(first, second);
    }
    const blockSize = (rootIdx: number) => {
        let count = 0;
        for (let i = 0; i < atomic.length; i++) if (root(i) === rootIdx) count += atomic[i].length;
        return count;
    };
    for (const [from, targets] of outgoing.entries()) {
        const fromNode = nodes.get(from);
        if (!fromNode || fromNode.fixed || fromNode.routingJunction || fromNode.handover) continue;
        const bottomPins = fromNode.pins.filter(p => p.direction === 'bottom');
        if (bottomPins.length >= 3 && targets.size >= 2 && targets.size <= 12) {
            const dedicatedTargets = [...targets].filter(t => {
                const tNode = nodes.get(t);
                return tNode && !tNode.fixed && !tNode.routingJunction && !tNode.handover &&
                    incoming.get(t)?.size === 1;
            });
            if (dedicatedTargets.length === targets.size) {
                const first = root(owner.get(from)!);
                const addedSize = dedicatedTargets.reduce((sum, t) => sum + (root(owner.get(t)!) !== first ? blockSize(root(owner.get(t)!)) : 0), 0);
                if (blockSize(first) + addedSize <= 14) {
                    for (const t of dedicatedTargets) {
                        const second = root(owner.get(t)!);
                        if (first !== second) parent[Math.max(first, second)] = Math.min(first, second);
                    }
                }
            }
        }
    }
    const result = new Map<number, string[]>();
    atomic.forEach((b, i) => result.set(root(i), [...(result.get(root(i)) ?? []), ...b]));
    return [...result.values()].map(b => b.sort()).sort((a, b) => b.length - a.length || a[0].localeCompare(b[0]));
}

/** Deterministic affinity packing; component count is only a balancing estimate.
 * Every resulting page still requires its own geometric and routing validation. */
export function partitionBins(blocks: string[][], count: number, s: LayoutSnapshot): string[][] {
    const bins: string[][] = Array.from({ length: count }, () => []);
    for (const [index, block] of blocks.entries()) {
        if (index < count) { bins[index].push(...block); continue; }
        const affinity = (bin: string[]) => s.edges.filter(e => block.includes(e.from.componentId) && bin.includes(e.to.componentId) || block.includes(e.to.componentId) && bin.includes(e.from.componentId)).length;
        const bin = [...bins].sort((a, b) => affinity(b) - affinity(a) || a.length - b.length)[0];
        bin.push(...block);
    }
    return bins.filter(b => b.length);
}

/** Bounded graph-cut alternatives. Atomic groups stay intact; large connected
 * tails must not be forced onto one sheet just because all seeds were chosen first. */
export function electricalPartitions(blocks:string[][],count:number,s:LayoutSnapshot):string[][][] {
  if(blocks.length>9||count<2||count>blocks.length)return [];
  const ordered=[...blocks].map(b=>[...b].sort()).sort((a,b)=>a[0].localeCompare(b[0]));
  const owner=new Map(ordered.flatMap((b,i)=>b.map(id=>[id,i] as const)));
  const weights=ordered.map(b=>s.nodes.filter(n=>b.includes(n.id)).reduce((sum,n)=>sum+(n.rect.width+8)*(n.rect.height+8),0));
  const edges=s.edges.map(e=>[owner.get(e.from.componentId),owner.get(e.to.componentId)] as const).filter(([a,b])=>a!==undefined&&b!==undefined&&a!==b);
  const choices:{bins:string[][];score:number}[]=[];const assignment:number[]=[];let visited=0;
  const visit=(index:number,used:number)=>{
    if(++visited>50000)return;
    if(index===ordered.length){
      if(used!==count)return;
      const load=Array.from({length:count},()=>0),bins:string[][]=Array.from({length:count},()=>[]);
      assignment.forEach((n,i)=>{load[n]+=weights[i];bins[n].push(...ordered[i]);});
      const cuts=edges.filter(([a,b])=>assignment[a!]!==assignment[b!]).length;
      const budget=s.area.width*s.area.height*.65;
      const score=cuts*1200+load.reduce((v,n)=>v+Math.max(0,n-budget)*10,0)+Math.max(...load)*.25;
      choices.push({bins,score});return;
    }
    for(let n=0;n<Math.min(used+1,count);n++){assignment[index]=n;visit(index+1,Math.max(used,n+1));}
  };
  visit(0,0);choices.sort((a,b)=>a.score-b.score||JSON.stringify(a.bins).localeCompare(JSON.stringify(b.bins)));
  return choices.slice(0,1).map(c=>c.bins);
}
