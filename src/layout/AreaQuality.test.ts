import assert from 'node:assert/strict';
import type {LayoutSnapshot} from './types';
import {relatedAreaPenalty,separatedAreaPenalty} from './areaQuality';
import {designPenalty} from './structured';
function drawing(xs:number[], ys=[20,20,20,20]):LayoutSnapshot{
 const s:LayoutSnapshot={pageId:'p',area:{x:0,y:0,width:400,height:260},grid:{spacing:2,origin:{x:0,y:0}},nodes:[],edges:[],frames:[],issues:[]};
 for(let area=0;area<4;area++)for(let i=0;i<2;i++){
  const id='a'+area+'n'+i,x=xs[area],y=ys[area]+i*40;
  s.nodes.push({id,kind:'component',fixed:false,origin:{x,y},rect:{x,y,width:10,height:10},shapes:[{id,owner:id,kind:'body',rect:{x,y,width:10,height:10}}],
   circuitRole:area%2?'control':'power',deviceRelation:i===0?{key:'device'+Math.floor(area/2),kind:area%2?'master':'contact'}:undefined,
   pins:[{id:'in',x:x+5,y,direction:'top'},{id:'out',x:x+5,y:y+10,direction:'bottom'}]});
  if(i)s.edges.push({id:'wire'+area,from:{componentId:'a'+area+'n0',pinId:'out'},to:{componentId:id,pinId:'in'},potential:'',points:[]});
 }
 return s;
}
const adjacent=drawing([20,40,90,110]),interposed=drawing([20,90,40,110]),backward=drawing([40,20,110,90]);
const original=JSON.stringify(adjacent);
assert.equal(relatedAreaPenalty(adjacent),0);
assert(relatedAreaPenalty(interposed)>relatedAreaPenalty(adjacent),'Related neighbours beat interposed foreign circuits');
assert(relatedAreaPenalty(backward)>0,'Power-before-control reading order matters');
assert(relatedAreaPenalty(drawing([20,40,90,110],[20,100,20,100]))>0,'Separate rows are a soft disadvantage');
assert(designPenalty(interposed)>designPenalty(adjacent),'Quality reaches the shared layout and multi-page scoring');
const reversed=structuredClone(interposed);reversed.nodes.reverse();reversed.edges.reverse();for(const e of reversed.edges)[e.from,e.to]=[e.to,e.from];
assert.equal(relatedAreaPenalty(reversed),relatedAreaPenalty(interposed));
const unknown=structuredClone(interposed);for(const n of unknown.nodes)n.deviceRelation=undefined;
assert.equal(relatedAreaPenalty(unknown),0,'No tag relationship means no invented association');
const ambiguous=structuredClone(interposed);ambiguous.nodes.find(n=>n.id==='a3n0')!.deviceRelation!.key='device0';
assert.equal(relatedAreaPenalty(ambiguous),0,'Ambiguous masters do not produce quality preferences');
const fixed=structuredClone(interposed);for(const n of fixed.nodes)n.fixed=true;
assert.equal(relatedAreaPenalty(fixed),0,'Fixed areas are not penalized for their required placement');
const together=new Map(adjacent.nodes.map(n=>[n.id,'sheet-1']));
assert.equal(separatedAreaPenalty(adjacent,together),0);
const split=new Map(adjacent.nodes.map(n=>[n.id,n.circuitRole==='control'?'sheet-2':'sheet-1']));
assert(separatedAreaPenalty(adjacent,split)>0,'Sheet partition scores must not reward lost pair relationships');
assert.equal(separatedAreaPenalty(ambiguous,split),0);
assert.equal(JSON.stringify(adjacent),original);
console.log('✓ Shared quality scoring for related area distance/order/interposition, unchanged source, deterministic input order, unknown/ambiguous/fixed guards');
