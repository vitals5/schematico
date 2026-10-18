import assert from 'node:assert/strict';
import { PropertiesDialog } from './PropertiesDialog';
import { PlacedComponent, Project, SymbolDefinition } from '../model/types';

const symbol: SymbolDefinition = { id: 'native:SPECIAL:1:0', name: 'Source', category: 'connections', standard: 'DIN EN 60617',
  defaultBmkPrefix: '', defaultFunctionText: '', width: 20, height: 30, pins: [], svgContent: '<line x1="0" y1="0" x2="20" y2="30"/>',
  importedGraphics: [], description: '' };
const component: PlacedComponent = { id: 'c', symbolId: symbol.id, bmk: '-Q1', functionText: 'L1 <Prüfen> & "Ändern"\nZweite Zeile',
  x: 100.125, y: 200.625, rotation: 0, pins: {},
  bmkPosition: { preset: 'custom', fontSize: 7, offsetX: 2.125, offsetY: -1.625, visible: true, alignment: 'start' },
  functionTextPosition: { preset: 'custom', fontSize: 6, offsetX: 12.75, offsetY: -7.375, visible: true, alignment: 'start' },
  technicalDataPosition: { preset: 'right', fontSize: 5.5, offsetX: 1.25, offsetY: -2.875, visible: false, alignment: 'end' } };
const project = { symbolLibrary: [symbol], pages: [] } as unknown as Project;
const dialog = new PropertiesDialog(component, project, { onSave: () => undefined }) as any;
const fields: Record<string, any> = { '#propPosX': { value: '100.125' }, '#propPosY': { value: '200.625' } };
for (const [prefix, config] of [['Bmk', component.bmkPosition!], ['Fn', component.functionTextPosition!], ['Tech', component.technicalDataPosition!]] as const) {
  fields[`#prop${prefix}Preset`] = { value: config.preset };
  fields[`#prop${prefix}OffsetX`] = { value: String(config.offsetX) };
  fields[`#prop${prefix}OffsetY`] = { value: String(config.offsetY) };
  fields[`#prop${prefix}Alignment`] = { value: config.alignment };
  fields[`#prop${prefix}Rotation`] = { value: String(config.rotation ?? 0) };
  fields[`#prop${prefix}Visible`] = { checked: config.visible };
}
const modal = { querySelector: (selector: string) => fields[selector] ?? null, querySelectorAll: () => [] };
dialog.collectFormData(modal);
assert.equal(dialog.component.x, 100.125); assert.equal(dialog.component.y, 200.625);
for (const key of ['bmkPosition', 'functionTextPosition', 'technicalDataPosition'] as const) {
  for (const property of ['fontSize', 'offsetX', 'offsetY', 'visible', 'alignment', 'preset'] as const) {
    assert.equal(dialog.component[key][property], component[key]![property], `${key}.${property} survives saving the dialog`);
  }
}
fields['#propBmkOffsetX'].value = '-3.875';
dialog.collectFormData(modal);
assert.equal(dialog.component.bmkPosition.offsetX, -3.875);
assert.equal(dialog.component.bmkPosition.fontSize, 7);
const preview = dialog.generatePreviewSvg() as string;
assert.match(preview, />-Q1<\/text>/, 'Imported SPECIAL symbols use the regular editable label preview');
assert.match(preview, /L1 &lt;Prüfen&gt; &amp; &quot;Ändern&quot;/);
const form = dialog.renderActiveTabContent() as string;
assert.match(form, /<textarea[^>]*id="propFunctionText"[^>]*>L1 &lt;Prüfen&gt; &amp; &quot;Ändern&quot;\nZweite Zeile<\/textarea>/);
fields['#propFunctionText'] = { value: component.functionText };
dialog.collectFormData(modal);
assert.equal(dialog.component.functionText, component.functionText);
fields['#propBmk'] = { value: '   ' };
fields['#propFunctionText'] = { value: '' };
fields['#propHigherLevel'] = { value: '' };
fields['#propLocation'] = { value: '' };
dialog.collectFormData(modal);
assert.equal(dialog.component.bmk, '', 'Explicitly clearing BMK must replace the previous value');
assert.equal(dialog.component.functionText, '');
const clearedForm = dialog.renderActiveTabContent() as string;
for (const id of ['propBmk', 'propHigherLevel', 'propLocation']) {
  assert.match(clearedForm, new RegExp(`id="${id}"[^>]*value=""`), `${id} stays empty when reopening or switching tabs`);
}
delete fields['#propBmk'];
dialog.component.bmk = '-Q2';
dialog.collectFormData(modal);
assert.equal(dialog.component.bmk, '-Q2', 'An absent BMK field on another tab must preserve the value');
project.drawingUnitsPerMm = 2;
dialog.component.crossRef='/2.1';
dialog.component.crossRefFontSize=4;
Object.assign(fields,{
  '#propCrossRefPreset':{value:'right'},'#propCrossRefOffsetX':{value:'2.125'},'#propCrossRefOffsetY':{value:'-3.875'},
  '#propCrossRefAlignment':{value:'start'},'#propCrossRefRotation':{value:'90'},'#propCrossRefVisible':{checked:true}
});
dialog.collectFormData(modal);
assert.deepEqual(dialog.component.crossRefPosition,{preset:'right',offsetX:4.25,offsetY:-7.75,alignment:'start',rotation:90,visible:true});
assert.equal(dialog.component.crossRefFontSize,4,'Moving a reference preserves its font size');
assert.match(dialog.generatePreviewSvg(),/class="cross-reference" x="32.25" y="7.25"/);
dialog.activeTab='display';
const display=dialog.renderActiveTabContent() as string;
assert.match(display,/id="propCrossRefOffsetX" value="2.125"/);
assert.match(display,/id="propCrossRefOffsetY" value="-3.875"/);
fields['#propCrossRefVisible'].checked=false;dialog.collectFormData(modal);
assert.doesNotMatch(dialog.generatePreviewSvg(),/class="cross-reference"/);
console.log('✓ Property dialog preserves imported layout precision and shows editable source labels');

// Entering text reveals inherited hidden source defaults; a later explicit hide
// remains authoritative when returning to the text tab and editing again.
dialog.activeTab='symbol';
dialog.component.source={format:'NATIVE_CAD',objectType:17,objectId:123};
dialog.component.functionTextPosition={visible:false,offsetX:3,fontSize:5};
dialog.component.additionalTextPosition={visible:false};
dialog.component.technicalDataPosition={visible:false};
for(const key of Object.keys(fields))delete fields[key];
Object.assign(fields,{'#propFunctionText':{value:'Neu eingetragen'},'#propAdditionalText':{value:'Gravur <1>'},'#propDeviceTag':{value:'Gerät'}});
dialog.collectFormData(modal);
assert.equal(dialog.component.functionTextPosition.visible,true);
assert.equal(dialog.component.additionalTextPosition.visible,true);
assert.equal(dialog.component.technicalDataPosition.visible,true);
assert.match(dialog.generatePreviewSvg(),/Gravur &lt;1&gt;/);
for(const key of Object.keys(fields))delete fields[key];
fields['#propFnVisible']={checked:false};
dialog.collectFormData(modal);
assert.equal(dialog.component.functionTextPosition.visibilityExplicit,true);
fields['#propFunctionText']={value:'Weiterhin ausgeblendet'};delete fields['#propFnVisible'];
dialog.collectFormData(modal);
assert.equal(dialog.component.functionTextPosition.visible,false);
dialog.activeTab='display';
assert.match(dialog.renderActiveTabContent(),/propAdditionalPreset/);
assert.match(dialog.renderActiveTabContent(),/propAdditionalFontSize/);
console.log('✓ Text entry reveals inherited hidden labels; display controls preserve explicit hiding and editable engraving layout');

for(const key of Object.keys(fields))delete fields[key];
dialog.component.technicalDataPosition=undefined;dialog.component.deviceTag='';dialog.component.technicalCharacteristics='';
fields['#propTechVisible']={checked:false};
dialog.collectFormData(modal);
assert.equal(dialog.component.technicalDataPosition,undefined,'An untouched initially empty label is not recorded as explicitly hidden');
