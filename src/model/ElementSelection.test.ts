import assert from 'node:assert/strict';
import { Page, Project, SymbolDefinition } from './types';
import { elementsInWindow, componentBounds, captureSelectionMove, translateSelection } from './ElementSelection';
import { sharedPropertyValue, applySelectionProperties } from './SelectionProperties';
import { ProjectHistory } from './ProjectHistory';
const symbol:SymbolDefinition={id:'s',name:'s',category:'controls',standard:'DIN EN 60617',defaultBmkPrefix:'',defaultFunctionText:'',width:20,height:40,svgContent:'',pins:[],description:''};
const page={id:'p',components:[
  {id:'a',symbolId:'s',x:.75,y:.5,rotation:0,bmk:'-A',functionText:'Alpha',pins:{},bmkPosition:{fontSize:6,offsetX:7,rotation:180,visible:false}},
  {id:'b',symbolId:'s',x:100.75,y:.5,rotation:90,bmk:'-B',functionText:'Beta',pins:{},bmkPosition:{fontSize:8}},
  {id:'c',symbolId:'s',x:500,y:300,rotation:0,bmk:'-C',functionText:'Fixed',pins:{}},
  {id:'hidden',symbolId:'s',x:30,y:0,rotation:0,bmk:'',functionText:'',pins:{},source:{format:'NATIVE_CAD',objectType:42,objectId:1,routingUsed:false}},
],wires:[{id:'inner',from:{componentId:'a',pinId:'1'},to:{componentId:'b',pinId:'1'},waypoints:[{x:50.75,y:60.5}],potential:'Signal'},
  {id:'external',from:{componentId:'b',pinId:'1'},to:{componentId:'c',pinId:'1'},waypoints:[{x:200,y:160}],potential:'Signal'}],
  cables:[{id:'cable',start:{x:0,y:60},end:{x:120,y:60},bmk:'-W1',cableType:'NYM-J',coreCount:2,crossSection:'1,5',cores:[],labelOffset:{x:-3,y:-4}}]
} as unknown as Page;
const project={id:'p',name:'Test',activePageId:'p',pages:[page],symbolLibrary:[symbol],drawingUnitsPerMm:2,modified:''} as unknown as Project;
const original=JSON.stringify(page);
assert.deepEqual(componentBounds(page,project,'b'),{left:90.75,top:10.5,right:130.75,bottom:30.5});
const selection=elementsInWindow(page,project,{x:-5,y:-5},{x:140,y:70});
assert.deepEqual(selection,{componentIds:['a','b'],cableIds:['cable']});
assert.equal(JSON.stringify(page),original,'Marquee selection is view state only');
assert.equal(sharedPropertyValue(page,project,selection,'bmkFontSize'),undefined,'Mixed sizes are not silently replaced');
assert.equal(sharedPropertyValue(page,project,selection,'crossRefFontSize'),4);
const history=new ProjectHistory();history.reset(project);
const snapshot=captureSelectionMove(page,selection);
translateSelection(page,snapshot,20,40);translateSelection(page,snapshot,40,60);
assert.deepEqual([page.components[0].x,page.components[0].y],[40.75,60.5]);
assert.deepEqual([page.components[1].x,page.components[1].y],[140.75,60.5]);
assert.deepEqual(page.wires[0].waypoints,[{x:90.75,y:120.5}]);
assert.deepEqual(page.wires[1].waypoints,[{x:200,y:160}]);
assert.deepEqual(page.cables![0].start,{x:40,y:120});
assert.deepEqual(page.cables![0].labelOffset,{x:-3,y:-4});assert.equal(page.components[2].x,500);
history.record(project);const restored=history.undo()!;assert.deepEqual(restored.pages[0],JSON.parse(original),'One move restores the whole group and its bends');
assert(applySelectionProperties(page,project,selection,{bmkFontSize:1.8,crossRefFontSize:1.2}));
assert.deepEqual(page.components[0].bmkPosition,{fontSize:3.6,offsetX:7,rotation:180,visible:false});
assert.equal(page.components[1].bmkPosition!.fontSize,3.6);assert.equal(page.components[0].crossRefFontSize,2.4);
assert.equal(page.components[2].crossRefFontSize,undefined);assert.equal(page.components[1].functionText,'Beta');
assert.equal(page.cables![0].bmkFontSize,3.6);assert.equal(page.cables![0].cableType,'NYM-J');
const beforeInvalid=JSON.stringify(page);
assert.throws(()=>applySelectionProperties(page,project,selection,{functionText:'Bad partial write',bmkFontSize:NaN}));
assert.equal(JSON.stringify(page),beforeInvalid,'Invalid shared changes are rejected atomically');
assert.equal(applySelectionProperties(page,project,selection,{}),false);
console.log('✓ Window selection, rotated bounds, relative group movement, internal routes and atomic shared font properties');

page.components[0].source={format:'NATIVE_CAD',objectType:17,objectId:1};
page.components[0].functionTextPosition={visible:false,offsetX:2};
page.components[0].additionalTextPosition={visible:false};
page.components[1].source={format:'NATIVE_CAD',objectType:17,objectId:2};
page.components[1].functionTextPosition={visible:false,visibilityExplicit:true};
assert(applySelectionProperties(page,project,selection,{functionText:'Gemeinsam',additionalText:'Gravur',additionalFontSize:1.5}));
assert.equal(page.components[0].functionTextPosition.visible,true);
assert.equal(page.components[0].functionTextPosition.offsetX,2);
assert.equal(page.components[1].functionTextPosition.visible,false);
assert.equal(page.components[0].additionalTextPosition.visible,true);
assert.equal(page.components[0].additionalTextPosition.fontSize,3);
assert.equal(sharedPropertyValue(page,project,selection,'additionalFontSize'),1.5);
assert.equal(page.components[2].additionalText,undefined);
console.log('✓ Shared engraving edits and sizes reveal only inherited hidden labels and preserve explicit hiding');

// Images participate in window selection and a common move without changing
// electrical connectivity; image-only moves produce one ordinary history step.
page.images=[{id:'graphic',dataUrl:'data:image/png;base64,AA==',x:10,y:80,width:60,height:30}];
const imagesOnly={componentIds:[],cableIds:[],imageIds:['graphic']};
const { normalizeSelection,selectionBounds,selectionCount }=await import('./ElementSelection');
assert.deepEqual(normalizeSelection(page,{...imagesOnly,imageIds:['graphic','missing','graphic']}),imagesOnly);
assert.equal(selectionCount(imagesOnly),1);
assert.deepEqual(selectionBounds(page,project,imagesOnly),{left:10,top:80,right:70,bottom:110});
assert.deepEqual(elementsInWindow(page,project,{x:5,y:75},{x:75,y:115}),imagesOnly);
const imageHistory=new ProjectHistory();imageHistory.reset(project);
const imageSnapshot=captureSelectionMove(page,imagesOnly),beforeImageMove=JSON.stringify(page);
translateSelection(page,imageSnapshot,20,40);translateSelection(page,imageSnapshot,40,60);
assert.deepEqual([page.images[0].x,page.images[0].y],[50,140]);
assert.equal(page.images[0].width,60);assert.equal(page.images[0].height,30);
assert.deepEqual(page.wires,JSON.parse(beforeImageMove).wires);
assert.deepEqual(page.components,JSON.parse(beforeImageMove).components);
imageHistory.record(project);
assert.equal(JSON.stringify(imageHistory.undo()!.pages[0]),beforeImageMove);
assert.deepEqual(imageHistory.redo()!.pages[0].images,page.images);
console.log('✓ Images support window selection, relative movement and one-step history without changing electrical objects');

// Multi-selection intersection and property existence tests
const { propertyExistsOnAllSelected } = await import('./SelectionProperties');
const twoCompsSelection = { componentIds: ['a', 'b'], cableIds: [] };
assert.equal(propertyExistsOnAllSelected(page, twoCompsSelection, 'bmk'), true);
assert.equal(propertyExistsOnAllSelected(page, twoCompsSelection, 'functionText'), true);
assert.equal(propertyExistsOnAllSelected(page, twoCompsSelection, 'higherLevel'), true);
assert.equal(propertyExistsOnAllSelected(page, twoCompsSelection, 'cableType'), false);

const mixedCompCableSelection = { componentIds: ['a'], cableIds: ['cable'] };
assert.equal(propertyExistsOnAllSelected(page, mixedCompCableSelection, 'bmk'), true);
assert.equal(propertyExistsOnAllSelected(page, mixedCompCableSelection, 'bmkFontSize'), true);
assert.equal(propertyExistsOnAllSelected(page, mixedCompCableSelection, 'deviceTag'), false);
assert.equal(propertyExistsOnAllSelected(page, mixedCompCableSelection, 'cableType'), false);

page.texts = [{ id: 'txt1', text: 'T1', x: 0, y: 0 }, { id: 'txt2', text: 'T2', x: 10, y: 10 }];
const twoTextsSelection = { componentIds: [], cableIds: [], textIds: ['txt1', 'txt2'] };
assert.equal(propertyExistsOnAllSelected(page, twoTextsSelection, 'textContent'), true);
assert.equal(propertyExistsOnAllSelected(page, twoTextsSelection, 'textFontSize'), true);
assert.equal(propertyExistsOnAllSelected(page, twoTextsSelection, 'textAlign'), true);
assert.equal(propertyExistsOnAllSelected(page, twoTextsSelection, 'bmk'), false);
console.log('✓ propertyExistsOnAllSelected correctly intersects supported properties across all selected element types');
