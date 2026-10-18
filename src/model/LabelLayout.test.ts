// src/model/LabelLayout.test.ts
import assert from 'node:assert/strict';
import { computeBmkPosition, computeFunctionTextPosition, computeTechnicalDataPosition, computeCrossReferencePosition } from './LabelLayout';
import { PlacedComponent, SymbolDefinition, Project } from './types';
import { getSymbolById } from './symbols';
import { interruptionLabelPosition } from './ConnectionSymbols';
import { scalePlacedComponent, rotatedLocalPoint } from './SymbolGeometry';

const mockSymbol: SymbolDefinition = {
  id: 'contactor_no',
  name: 'Schütz-Schließer',
  category: 'relays',
  standard: 'DIN EN 60617',
  defaultBmkPrefix: '-K',
  defaultFunctionText: 'Schütz',
  description: 'Schütz Schließer',
  width: 40,
  height: 60,
  pins: [],
  svgContent: '<path d="M 0 0 L 40 60"/>'
};

const baseComp: PlacedComponent = {
  id: 'c1',
  symbolId: 'contactor_no',
  bmk: '-K1',
  functionText: 'Lüftermotor',
  deviceTag: 'Hauptschütz',
  technicalCharacteristics: '4kW 400V',
  x: 100,
  y: 100,
  rotation: 0,
  pins: {}
};

console.log('--- 1. Testing Default Positions ---');
const bmkDef = computeBmkPosition(baseComp, mockSymbol);
assert.equal(bmkDef.x, -8);
assert.equal(bmkDef.anchor, 'end');
assert(bmkDef.y > 0 && bmkDef.y < mockSymbol.height);
assert(bmkDef.visible === true, `Default BMK should be visible`);
console.log('✅ Default BMK is beside the symbol, right-aligned');

const fnDef = computeFunctionTextPosition(baseComp, mockSymbol);
assert.equal(fnDef.x, -8); assert.equal(fnDef.anchor, 'end');
assert(fnDef.y > bmkDef.y + bmkDef.fontSize);
console.log('✅ Default function text is beside the symbol, below the BMK');

console.log('--- 2. Testing Preset Positions ---');
const bmkRight = computeBmkPosition({
  ...baseComp,
  bmkPosition: { preset: 'right', offsetX: 5, offsetY: -2 }
}, mockSymbol);
assert(bmkRight.x === 40 + 8 + 5, `BMK right X should be 53, got ${bmkRight.x}`);
assert(bmkRight.y === 30 - 2, `BMK right Y should be 28, got ${bmkRight.y}`);
assert(bmkRight.anchor === 'start', `BMK right anchor should be start, got ${bmkRight.anchor}`);
console.log('✅ BMK "right" preset with offsets verified');

const bmkTopLeft = computeBmkPosition({
  ...baseComp,
  bmkPosition: { preset: 'top_left', alignment: 'start' }
}, mockSymbol);
assert(bmkTopLeft.x === 0, `BMK top_left X should be 0, got ${bmkTopLeft.x}`);
assert(bmkTopLeft.anchor === 'start', `BMK top_left anchor should be start, got ${bmkTopLeft.anchor}`);
console.log('✅ BMK "top_left" preset verified');

console.log('--- 3. Testing Visibility & Rotations ---');
const bmkHidden = computeBmkPosition({
  ...baseComp,
  bmkPosition: { preset: 'top', visible: false, rotation: 90 }
}, mockSymbol);
assert(bmkHidden.visible === false, 'BMK should be hidden');
assert(bmkHidden.rotation === 90, 'BMK should be rotated 90');
assert(bmkHidden.transform.includes('rotate(90'), 'BMK transform should include rotate(90');
console.log('✅ BMK rotation and visibility verified');

const techPos = computeTechnicalDataPosition({
  ...baseComp,
  technicalDataPosition: { preset: 'bottom', visible: true }
}, mockSymbol);
assert(techPos.visible === true, 'Tech data should be visible');
assert(techPos.y === 82, `Tech data Y should be 82, got ${techPos.y}`);
console.log('✅ Technical data positioning verified');

console.log('🎉 ALL LABEL LAYOUT TESTS PASSED!');

const project = {} as Project;
assert(computeCrossReferencePosition(baseComp,mockSymbol,project).y > computeTechnicalDataPosition(baseComp,mockSymbol).y);
assert(computeCrossReferencePosition({...baseComp,technicalDataPosition:{visible:false}},mockSymbol,project).y
  < computeCrossReferencePosition(baseComp,mockSymbol,project).y);
const positioned = {...baseComp,rotation:180 as const,crossRefFontSize:5,
  crossRefPosition:{preset:'right' as const,offsetX:2.125,offsetY:-3.875,alignment:'end' as const,rotation:90 as const,visible:false}};
const ref = computeCrossReferencePosition(positioned,mockSymbol,project);
assert.deepEqual(ref,{x:50.125,y:26.125,anchor:'end',rotation:90,fontSize:5,visible:false,transform:'transform="rotate(-90, 50.125, 26.125)"'});
assert.deepEqual(computeCrossReferencePosition(JSON.parse(JSON.stringify(positioned)),mockSymbol,project),ref);
const scaled=scalePlacedComponent(positioned,2);
assert.deepEqual(scaled.crossRefPosition,{...positioned.crossRefPosition,offsetX:4.25,offsetY:-7.75});
assert.equal(positioned.crossRefPosition.offsetX,2.125,'Scaling a macro does not mutate its source reference layout');
const arrow = getSymbolById('potential_arrow_right')!;
for(const side of ['before','after'] as const)for(const rotation of [0,90,180,270] as const){
  const p = {settings:{interruptionLabelSide:side}} as Project;
  const c = {...baseComp,symbolId:arrow.id,crossRef:'/2.1',rotation};
  const automatic = interruptionLabelPosition(p,c,arrow)!;
  const unchanged = computeCrossReferencePosition(c,arrow,p);
  assert.deepEqual([unchanged.x,unchanged.y,unchanged.anchor],[automatic.referenceX,automatic.referenceY,automatic.anchor]);
  const shifted = computeCrossReferencePosition({...c,crossRefPosition:{offsetX:3,offsetY:-7}},arrow,p);
  assert.deepEqual([shifted.x,shifted.y],[unchanged.x+3,unchanged.y-7]);
  const explicit = computeCrossReferencePosition({...c,crossRefPosition:{preset:'left'}},arrow,p);
  assert.deepEqual([explicit.x,explicit.y,explicit.anchor],[-8,arrow.height/2,'end']);
}
console.log('✓ Reference position presets, offsets, visibility, serialization and automatic interruption layouts for every rotation');

const { computeAdditionalTextPosition, setComponentLabelText, revealImportedComponentLabels } = await import('./LabelLayout');
const inherited: PlacedComponent = { ...baseComp, source:{format:'NATIVE_CAD',objectType:17,objectId:42},
  functionText:'',additionalText:'',deviceTag:'',technicalCharacteristics:'',
  functionTextPosition:{preset:'custom',offsetX:2,offsetY:3,fontSize:5,visible:false},
  technicalDataPosition:{preset:'right',visible:false},additionalTextPosition:{preset:'custom',offsetX:4,offsetY:7,fontSize:6,visible:false} };
assert(setComponentLabelText(inherited,'functionText','Neue Funktion'));
assert.equal(inherited.functionTextPosition?.visible,true);
assert.equal(inherited.functionTextPosition?.offsetX,2);
assert(setComponentLabelText(inherited,'additionalText','Gravur\nZweite Zeile'));
assert.equal(inherited.additionalTextPosition?.visible,true);
assert.deepEqual([computeAdditionalTextPosition(inherited,mockSymbol).x,computeAdditionalTextPosition(inherited,mockSymbol).y],[24,101]);
setComponentLabelText(inherited,'deviceTag','Neues Gerät');assert.equal(inherited.technicalDataPosition?.visible,true);
inherited.functionTextPosition={...inherited.functionTextPosition,visible:false,visibilityExplicit:true};
setComponentLabelText(inherited,'functionText','Bewusst ausgeblendeter Text');
assert.equal(inherited.functionTextPosition.visible,false,'Entering text respects an explicit visibility choice');
inherited.additionalTextPosition={...inherited.additionalTextPosition,visible:false};
revealImportedComponentLabels({pages:[{components:[inherited]}]} as Project);
assert.equal(inherited.additionalTextPosition.visible,true,'Loaded legacy text is revealed');
assert.equal(inherited.functionTextPosition.visible,false,'Loading respects explicit hidden labels');
const additionalScaled=scalePlacedComponent(inherited,2);
assert.deepEqual(additionalScaled.additionalTextPosition,{...inherited.additionalTextPosition,fontSize:12,offsetX:8,offsetY:14});
const stacked=computeAdditionalTextPosition({...baseComp,additionalText:'Gravur'},mockSymbol);
assert(stacked.y>computeTechnicalDataPosition(baseComp,mockSymbol).y);
assert(computeCrossReferencePosition({...baseComp,additionalText:'Gravur'},mockSymbol,project).y>stacked.y);
console.log('✓ Entered and legacy imported labels are visible, deliberate hiding survives, and engraving positions scale and clear other labels');

const instancePin = { ...inherited, pins: { '0': { customLabel: 'USB', labelPosition: { x: 2, y: -10, fontSize: 5, alignment: 'middle' as const } } } };
const scaledPin=scalePlacedComponent(instancePin,2);
assert.deepEqual(scaledPin.pins['0'].labelPosition,{x:4,y:-20,fontSize:10,alignment:'middle'});
assert.equal(instancePin.pins['0'].labelPosition.x,2,'Macro scaling preserves the source instance');

// Every populated default label stays on the world-left after quarter turns;
// enlarged, multiline text reserves enough space for the following label.
for (const rotation of [0, 90, 180, 270] as const) {
  const c = { ...baseComp, rotation, additionalText: 'Gravur\nZweite Zeile', crossRef: '/2.1',
    bmkPosition: { fontSize: 15 }, functionText: 'Funktion\nZweite Zeile', functionTextPosition: { fontSize: 13 } };
  const positions = [computeBmkPosition(c,mockSymbol),computeFunctionTextPosition(c,mockSymbol),
    computeTechnicalDataPosition(c,mockSymbol),computeAdditionalTextPosition(c,mockSymbol),computeCrossReferencePosition(c,mockSymbol,project)];
  const world = positions.map(p => rotatedLocalPoint(p,mockSymbol,rotation));
  const left = mockSymbol.width/2-(rotation%180 ? mockSymbol.height : mockSymbol.width)/2;
  positions.forEach((p,i) => { assert.equal(p.anchor,'end'); assert(world[i].x < left); assert.equal(p.rotation,0); });
  for(let i=1;i<world.length;i++)assert(world[i].y > world[i-1].y);
  assert(world[2].y > world[1].y + 13*1.2, 'Multiline function text clears the next label');
  assert.deepEqual(computeFunctionTextPosition(JSON.parse(JSON.stringify(c)),mockSymbol),positions[1]);
}
console.log('✓ Automatic right-aligned left label block, every rotation, populated fields, multiline sizes and serialization');
