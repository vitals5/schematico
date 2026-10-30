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
const reserves=structuredClone(interposed);
for(let i=0;i<20;i++){const n=structuredClone(reserves.nodes[0]);n.id='spare'+i;n.deviceRelation=undefined;n.circuitRole=undefined;n.rect={...n.rect,x:250,y:200};reserves.nodes.push(n);}
assert.equal(relatedAreaPenalty(reserves),relatedAreaPenalty(interposed),'Many unused devices must not disable the active area quality score');
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

// A close, left-aligned second reading row should not pay the full absolute
// vertical displacement of a horizontal-only placement model.
const wrapped=drawing([20,20,180,200],[20,100,20,20]);
const wrappedBefore=JSON.stringify(wrapped);
const nearby=relatedAreaPenalty(wrapped);
assert(nearby>0 && nearby<30,'A clear row break has a small bounded cost');
const remote=drawing([20,20,180,200],[20,210,20,20]);
assert(relatedAreaPenalty(remote)>nearby,'Excessive empty vertical distance still worsens the score');
assert(relatedAreaPenalty(drawing([20,130,180,200],[20,100,20,20]))>nearby,'A sideways-displaced second row is less clear');
assert(relatedAreaPenalty(drawing([20,20,180,200],[100,20,20,20]))>nearby,'Control above its power area must not receive the preferred reading order');
const intervening=structuredClone(wrapped);
intervening.nodes.push({id:'foreign',kind:'component',fixed:false,origin:{x:20,y:80},rect:{x:20,y:80,width:10,height:10},shapes:[],pins:[]});
// Pinned but unwired objects count as independent circuit obstacles.
intervening.nodes.at(-1)!.pins=[{id:'p',x:25,y:80,direction:'top'}];
assert(relatedAreaPenalty(intervening)>=nearby+60,'A foreign area between reading rows remains undesirable');
const inverse=structuredClone(wrapped);inverse.nodes.reverse();inverse.edges.reverse();for(const e of inverse.edges)[e.from,e.to]=[e.to,e.from];
assert.equal(relatedAreaPenalty(inverse),nearby);
assert.equal(JSON.stringify(wrapped),wrappedBefore);
assert(designPenalty(remote)>designPenalty(wrapped),'Row reading quality reaches candidate comparison');
console.log('✓ Row-aware area quality, small ordered-wrap cost, long gaps/offsets/reversed roles/interposed areas, deterministic scoring and unchanged input');
const threeRows=drawing([20,20,20,40],[20,180,100,180]);
threeRows.edges.push({id:'shared-control',from:{componentId:'a1n0',pinId:'in'},to:{componentId:'a3n0',pinId:'in'},potential:'',points:[]});
const threeCost=relatedAreaPenalty(threeRows);
assert(threeCost>nearby&&threeCost<60,'Several associated power rows before a common control retain a modest row cost');
const reversedThree=structuredClone(threeRows);
for(const n of reversedThree.nodes.filter(n=>n.id.startsWith('a2')))n.rect={...n.rect,y:n.rect.y+160};
assert(relatedAreaPenalty(reversedThree)>threeCost,'A power row following a control row loses the preferred order');
