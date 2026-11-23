import assert from 'node:assert/strict';
import {fixture,add} from '../layout/testing/fixture';
import {TerminalDistributionPlan} from './TerminalDistribution';
import {getSymbolForComponent,setProjectSymbolLibrary} from './symbols';
import {TerminalStripEditPlan} from './TerminalStrips';
import {terminalStripBindings} from './TerminalStripTypes';
import {DeviceRegistry} from './DeviceRegistry';
import {ProjectIndex} from './ProjectIndex';
import {ElectricalNetService} from './ElectricalNetService';
import {distributedTerminalBindings} from './DistributedTerminalTypes';
import {AutoconnectEngine} from './AutoconnectEngine';
import {setArticleAssignment,effectiveArticles} from './ArticleAssignments';
import {PartsListGenerator} from '../reports/PartsList';
import {TerminalDiagramGenerator} from '../reports/TerminalDiagram';
import {inspectWiring} from './WiringManagement';
import {ArticleEditPlan} from './ArticleEdit';
import {ProjectHistory} from './ProjectHistory';
const article={articleNumber:'TERM-3',manufacturer:'Synthetic',variant:'',quantity:1,role:'main' as const};
for(const symbolId of ['terminal_triple','terminal_installation_l_n_pe','terminal_installation_l_n_pe_disconnect','catalog_feed_terminal_push_in_3'])for(const rotation of [0,90,180,270] as const)for(const scale of [.5,1]){
 const p=fixture();setProjectSymbolLibrary(p);const c=add(p,'source',symbolId,160,160);c.rotation=rotation;c.scale=scale;c.bmk='-X1:7';c.functionText='';c.terminal={strip:'-X1',number:'7',level:'',pinSides:{}};setArticleAssignment(c,[article]);
 const s=getSymbolForComponent(c,p)!;for(const pin of s.pins){const target=add(p,'target-'+pin.id,'terminal_single',480,240);target.bmk='-OUT:'+pin.id;p.pages[0].wires.push({id:'wire-'+pin.id,from:{componentId:c.id,pinId:pin.id},to:{componentId:target.id,pinId:'1'},potential:'Signal',waypoints:[{x:440,y:120}]});}
 const before=JSON.stringify(p),plan=new TerminalDistributionPlan(p,{kind:'split',target:{pageId:'p',componentId:c.id},mode:'levels',mainLevel:'3'}),next=plan.apply(p),registry=new DeviceRegistry(next);
 assert.equal(JSON.stringify(p),before);assert.equal(registry.valid.size,1);assert.equal(registry.issues.length,0);assert.equal(terminalStripBindings(next).issues.length,0);
 assert.equal(PartsListGenerator.generatePartsList(next).find(r=>r.articleNumber===article.articleNumber)!.quantity,1);
 const entries=TerminalDiagramGenerator.generateTerminalReport(next).get('-X1')!;assert.equal(entries.length,3);assert(entries[0].mainFunction);assert(entries.slice(1).every(e=>!e.mainFunction));
 assert.equal(next.pages[0].components.find(v=>v.id==='source')!.terminal!.level,'3');
 for(const pin of s.pins){const old=AutoconnectEngine.getRotatedPinInfo(c,pin,s),wire=next.pages[0].wires.find(w=>w.id==='wire-'+pin.id)!,owner=next.pages[0].components.find(c=>c.id===wire.from.componentId)!,sym=getSymbolForComponent(owner,next)!,current=AutoconnectEngine.getRotatedPinInfo(owner,sym.pins.find(p=>p.id===pin.id)!,sym);
  assert(Math.abs(old.worldX-current.worldX)<1e-8);assert(Math.abs(old.worldY-current.worldY)<1e-8);assert.deepEqual(wire.waypoints,[{x:440,y:120}]);}
 const device=[...registry.valid.values()][0],strip=next.terminalStrips![0],position=strip.positions.find(p=>p.kind==='terminal'&&p.deviceId===device.id)!;
 assert(position.kind==='terminal');const lowest=position.members.find(a=>registry.placement(a)!.component.terminal!.level==='1')!;
 const changed=new TerminalStripEditPlan(next,{kind:'main',stripId:strip.id,positionId:position.id,target:lowest}).apply(next);
 assert.equal(effectiveArticles(changed.pages[0].components.find(c=>c.id===lowest.componentId)!,changed)[0].articleNumber,article.articleNumber);
 assert.equal(PartsListGenerator.generatePartsList(changed).find(r=>r.articleNumber===article.articleNumber)!.quantity,1);
 assert(TerminalDiagramGenerator.generateTerminalReport(changed).get('-X1')![0].mainFunction);
 const middle=position.members.find(a=>registry.placement(a)!.component.terminal!.level==='2')!;assert.throws(()=>new TerminalStripEditPlan(next,{kind:'main',stripId:strip.id,positionId:position.id,target:middle}),/terminalStripLevelsInvalid/);
 assert.throws(()=>new TerminalDistributionPlan(next,{kind:'move',target:lowest,pageId:'p',x:280,y:240}),/terminalDistributionConnected/);
 const history=new ProjectHistory();history.reset(p);history.record(next);assert.deepEqual(history.undo(),p);assert.deepEqual(history.redo(),next);
}
const p=fixture();setProjectSymbolLibrary(p);const original=add(p,'feed','terminal_feed_4',160,160);original.bmk='-X1:1';original.functionText='';original.terminal={strip:'-X1',number:'1',level:'',pinSides:{}};setArticleAssignment(original,[article]);
const split=new TerminalDistributionPlan(p,{kind:'split',target:{pageId:'p',componentId:original.id},mode:'parts'}).apply(p);
assert.equal(distributedTerminalBindings(split).valid.size,1);assert.equal(distributedTerminalBindings(split).issues.length,0);assert.equal(new ElectricalNetService(new ProjectIndex(split)).nets.length,1);
assert.equal(split.pages[0].components.length,4);assert(!inspectWiring(split).some(i=>i.code==='terminal_number_duplicate'));
assert.equal(PartsListGenerator.generatePartsList(split)[0].quantity,1);assert.equal(TerminalDiagramGenerator.generateTerminalReport(split).get('-X1')!.length,1);
const duplicate=structuredClone(split),outside=add(duplicate,'outside','terminal_single',500,100);outside.bmk='-X1:1';outside.terminal={strip:'-X1',number:'1',level:'',pinSides:{}};
assert.equal(new ElectricalNetService(new ProjectIndex(duplicate)).nets.length,2,'A matching BMK cannot join an unrelated terminal');assert.equal(inspectWiring(duplicate).filter(i=>i.code==='terminal_number_duplicate').length,2);
const destination=structuredClone(split);destination.pages.push({...structuredClone(destination.pages[0]),id:'p2',pageNumber:'2',location:'+OTHER',higherLevel:'=OTHER',components:[],wires:[]});
const moved=new TerminalDistributionPlan(destination,{kind:'move',target:{pageId:'p',componentId:'feed'},pageId:'p2',x:240,y:240}).apply(destination);
assert.equal(moved.pages[1].components.length,1);assert.equal(distributedTerminalBindings(moved).valid.size,1);assert.equal(new DeviceRegistry(moved).valid.size,1);assert.equal(new ElectricalNetService(new ProjectIndex(moved)).nets.length,1);
const row=TerminalDiagramGenerator.generateTerminalReport(moved).get('-X1')![0];assert.equal(row.representations!.length,4);assert.equal(row.pageId,'p2');assert(row.mainFunction);
assert.throws(()=>new ArticleEditPlan(moved,{kind:'unlink',deviceIds:[moved.physicalDevices![0].id]}),/terminalDistributionPartialOwnership/);
assert.throws(()=>new TerminalStripEditPlan(moved,{kind:'reset',stripId:moved.terminalStrips![0].id}),/terminalDistributionPartialOwnership/);
assert.throws(()=>new TerminalStripEditPlan(moved,{kind:'ungroup',stripId:moved.terminalStrips![0].id,positionId:moved.terminalStrips![0].positions[0].id}),/terminalDistributionPartialOwnership/);
const broken=structuredClone(moved);broken.pages[0].components.pop();assert(distributedTerminalBindings(broken).issues.length);assert(new ElectricalNetService(new ProjectIndex(broken)).issues.some(i=>i.code==='invalid_internal_group'));
const forged=structuredClone(moved);forged.pages[0].components.push({...structuredClone(forged.pages[0].components[0]),id:'copy'});assert(distributedTerminalBindings(forged).issues.some(i=>i.members.some(a=>a.componentId==='copy')));
const stale=new TerminalDistributionPlan(p,{kind:'split',target:{pageId:'p',componentId:'feed'},mode:'parts'});assert.throws(()=>stale.apply({...p,description:'changed'}),/articlesProjectStale/);
assert.deepEqual(TerminalDiagramGenerator.generateTerminalReport(JSON.parse(JSON.stringify(moved))),TerminalDiagramGenerator.generateTerminalReport(moved));
console.log('✓ Distributed terminals: separate level/point placement, every rotation/scale, exact pin positions and net partition, preserved wires and one article, selectable outer main level, cross-sheet identity, explicit links only, truthful reports, invalid/dangling/copy guards and undo');

const {articleCompatibility}=await import('./ArticleCompatibility');
const {articleFunctions,ArticleFunctionPlan}=await import('./ArticleFunctions');
const specified=structuredClone(split),main=specified.pages[0].components.find(c=>c.id==='feed')!;
setArticleAssignment(main,[{...article,snapshot:{id:'four',articleNumber:article.articleNumber,manufacturer:article.manufacturer,variant:'',description:'Four connection points',origin:'user',verification:'user_checked',functions:[{id:'common',type:'symbol:terminal_feed_4',pins:['a','b','c','d'],required:true}]}}]);
assert.equal(articleCompatibility(specified,{pageId:'p',componentId:'feed'}).status,'compatible','All partial placements consume one logical function template');
const suggestions=articleFunctions(specified,specified.physicalDevices![0].members);assert(suggestions.every(row=>row.actualPins.join(',')==='a,b,c,d'&&row.candidates.length===1));
const mapped=new ArticleFunctionPlan(specified,[specified.physicalDevices![0].members[1]]).apply(specified,[{address:specified.physicalDevices![0].members[1],functionId:'common'}]);
assert.equal(articleCompatibility(mapped,{pageId:'p',componentId:'feed'}).status,'compatible');assert(mapped.pages[0].components.every(c=>c.articleFunctionId==='common'));
const numbered=new (await import('./WiringManagement')).WiringEditPlan(mapped,{kind:'terminal',target:{pageId:'p',componentId:'feed'},settings:{...main.terminal!,number:'9'}}).apply(mapped);
assert(numbered.pages[0].components.every(c=>c.bmk==='-X1:9'));
const {validateTerminalComponentEdit}=await import('./TerminalEditValidation');
assert.throws(()=>validateTerminalComponentEdit(mapped,{...mapped.pages[0].components[0],bmk:'-X9:9'}),/terminalStripLevelsInvalid/);

const anchors=fixture();setProjectSymbolLibrary(anchors);const ac=add(anchors,'a','terminal_triple',160,160);ac.bmk='-X1:1';ac.terminal={strip:'-X1',number:'1',level:'',pinSides:{}};
anchors.potentialDefinitions=[{id:'n',name:'N',plant:'',location:'',anchors:[{pageId:'p',componentId:'a',pinId:'2.a'}]}];
const anchored=new TerminalDistributionPlan(anchors,{kind:'split',target:{pageId:'p',componentId:'a'},mode:'levels'}).apply(anchors),anchor=anchored.potentialDefinitions![0].anchors[0];
assert.notEqual(anchor.componentId,'a');assert(anchored.pages[0].components.some(c=>c.id===anchor.componentId&&getSymbolForComponent(c,anchored)?.pins.some(p=>p.id===anchor.pinId)));
const {PackageHandler}=await import('../packages/PackageHandler');const archive=await PackageHandler.inspectFile(new File([PackageHandler.generateProjectXml(moved)],'distributed.xml'));
assert.deepEqual(archive.extractedProject?.distributedTerminalFunctions,moved.distributedTerminalFunctions);
console.log('✓ Logical article function templates, allocation through a partial placement, atomic function renumbering, live anchor remapping and project archive round trip');

const newMain=mapped.physicalDevices![0].members[1],newMainPosition=mapped.terminalStrips![0].positions[0];
const swapped=new TerminalStripEditPlan(mapped,{kind:'main',stripId:mapped.terminalStrips![0].id,positionId:newMainPosition.id,target:newMain}).apply(mapped);
assert.equal(articleCompatibility(swapped,newMain).status,'compatible');
for(const member of swapped.physicalDevices![0].members){const c=swapped.pages[0].components.find(c=>c.id===member.componentId)!;
 if(c.id===newMain.componentId)assert.equal(c.articleFunctionRepresentation,undefined);else assert.deepEqual(c.articleFunctionRepresentation?.primary,newMain);}
const ordered=fixture();setProjectSymbolLibrary(ordered);
for(const [id,key] of [['one','10'],['two','2'],['three','']] as const){const c=add(ordered,id,'terminal_single',100+100*ordered.pages[0].components.length,120);c.bmk='-X2:'+id;c.terminal={strip:'-X2',number:id,level:'',sortingKey:key,pinSides:{}};}
const configured=new TerminalStripEditPlan(ordered,{kind:'initialize',identity:{plant:'',location:'',strip:'-X2'}}).apply(ordered);
const config=configured.terminalStrips![0];
const withAccessory=new TerminalStripEditPlan(configured,{kind:'accessory',stripId:config.id,description:'End bracket',article,beforeId:config.positions[1].id}).apply(configured);
const sorted=new TerminalStripEditPlan(withAccessory,{kind:'sort',stripId:config.id}).apply(withAccessory);
assert.equal(sorted.terminalStrips![0].positions[1].kind,'accessory');
assert.deepEqual(sorted.terminalStrips![0].positions.filter(p=>p.kind==='terminal').map(p=>p.members[0].componentId),['two','one','three']);
console.log('✓ Main reassignment retains logical article ownership; numeric sorting keeps physical levels together and accessories in place');

const extra=structuredClone(split),other=add(extra,'other','terminal_single',500,160);other.bmk='-X1:2';other.terminal={strip:'-X1',number:'2',level:'',pinSides:{}};
extra.terminalStrips![0].positions.push({id:'other-position',kind:'terminal',members:[{pageId:'p',componentId:'other'}]});
assert.throws(()=>new TerminalStripEditPlan(extra,{kind:'group',stripId:extra.terminalStrips![0].id,positionIds:extra.terminalStrips![0].positions.map(p=>p.id),levels:[]}),/terminalDistributionPartialOwnership/);
assert.equal(TerminalDiagramGenerator.generateTerminalReport(split).get('-X1')![0].functionText,'','Blank terminal texts remain blank in reports');
