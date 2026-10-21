import { legacyVendorToken, legacyEditionToken } from './LegacyCompatibility';
import { openNativeFixture } from '../packages/testing/NativeFixture';
import assert from 'node:assert/strict';
import { isBundledSupplierLogo, neutralSourceLabel, prepareProjectPresentation } from './PresentationNaming';
import { defaultCoverPageTemplate, coverPageLogo, coverPageSvg, createCoverPage } from './CoverPage';
import { PageImage, Project } from './types';

assert.equal(neutralSourceLabel(`${legacyVendorToken} ${legacyEditionToken} / ${legacyVendorToken}-Haus / ${legacyEditionToken}`),'Projektarchiv / Projektarchiv-Haus / Projektarchiv');
assert.equal(neutralSourceLabel('Schematico Suite'),'Schematico Suite');
assert.equal(neutralSourceLabel('Neuplanung einer Anlage'),'Neuplanung einer Anlage');
const project={id:'p',name:'NATIVE-Haus',company:'Eigene Firma',description:'Haus',author:'Planer',created:'',modified:'',pages:[],activePageId:''} as unknown as Project;
const page=createCoverPage(project);project.pages.push(page);project.coverPageTemplate=defaultCoverPageTemplate();
project.coverPageTemplate.properties={'10000:0':'NATIVE-Haus'};
page.coverPage={values:{'10000:0':'NATIVE-Haus'}};
page.components=[{id:'native_1_17_1',symbolId:'native:IEC:1:0',bmk:'-X8',functionText:'Eigener Text',x:1,y:2,rotation:0,pins:{},source:{format:'NATIVE_CAD',objectType:17,objectId:1}}];
const componentBefore=JSON.stringify(page.components);
prepareProjectPresentation(project);
assert.equal(project.name,'Haus');assert.equal(page.plotFrame.titleBlock.projectTitle,'Haus');
assert.equal(project.coverPageTemplate.properties['10000:0'],'Haus');assert.equal(page.coverPage.values!['10000:0'],'Haus');
assert.equal(JSON.stringify(page.components),componentBefore,'Electrical identities and user labels remain intact');
const custom:PageImage={id:'own-logo',caption:'NATIVE.jpg',x:64,y:24,width:29,height:40,dataUrl:'data:image/png;base64,custom'};
assert(!isBundledSupplierLogo(custom),'A custom replacement with an old filename is preserved');
const fixture=await openNativeFixture();
if(fixture){
  const {zip,root}=fixture;
  const file=Object.values(zip.files).find(f=>/Images\/bc146770\/[^/]+\.jpg$/i.test(f.name))!;
  const bundled={...custom,id:'source-logo',dataUrl:`data:image/jpeg;base64,${await file.async('base64')}`};
  assert(isBundledSupplierLogo(bundled));project.coverPageTemplate.images=[bundled];
  assert.equal(coverPageLogo(page,project),undefined,'Older resources cannot reintroduce the supplier logo');
  assert.doesNotMatch(coverPageSvg(page,project),/class="cover-logo"/);
  page.coverPage.logo=bundled;page.images=[bundled];prepareProjectPresentation(project);
  assert.equal(project.coverPageTemplate.images.length,0);assert.equal(page.coverPage.logo,null);assert.equal(page.images.length,0);
  page.coverPage.logo=custom;prepareProjectPresentation(project);assert.deepEqual(page.coverPage.logo,custom);
}

// Annotation component conversion to PageText
const projWithAnnotation = {
  id: 'p2',
  name: 'Haus',
  pages: [{
    id: 'page-1',
    components: [
      {
        id: 'comp_text_1',
        symbolId: 'native:annotation:14:120:24:0:0',
        bmk: 'TXT1',
        functionText: 'de_DE@Erdgeschoss Grundriss;',
        x: 100,
        y: 200,
        rotation: 0,
        pins: {},
        functionTextPosition: {
          fontSize: 14,
          fontColor: '#ff0000',
          fontWeight: 'bold',
          offsetX: -60,
          offsetY: -22
        }
      },
      {
        id: 'comp_elec_1',
        symbolId: 'native:IEC:1:0',
        bmk: '-Q1',
        functionText: 'Hauptschalter',
        x: 50,
        y: 50,
        rotation: 0,
        pins: {}
      }
    ],
    texts: []
  }],
  symbolLibrary: [
    {
      id: 'native:annotation:14:120:24:0:0',
      name: 'Projekttext',
      description: 'Editierbarer Projekttext',
      width: 120,
      height: 24,
      pins: [],
      svgContent: ''
    },
    {
      id: 'native:IEC:1:0',
      name: 'Schalter',
      description: 'Schalter',
      width: 40,
      height: 40,
      pins: [],
      svgContent: ''
    }
  ]
} as unknown as Project;

prepareProjectPresentation(projWithAnnotation);
assert.equal(projWithAnnotation.pages[0].components.length, 1);
assert.equal(projWithAnnotation.pages[0].components[0].id, 'comp_elec_1');
assert.equal(projWithAnnotation.pages[0].texts?.length, 1);
const converted = projWithAnnotation.pages[0].texts![0];
assert.equal(converted.id, 'comp_text_1');
assert.equal(converted.text, 'Erdgeschoss Grundriss');
assert.equal(converted.fontSize, 14);
assert.equal(converted.fontColor, '#ff0000');
assert.equal(converted.fontWeight, 'bold');
assert.equal(converted.x, 100);
assert.equal(converted.y, 214);
assert.equal(projWithAnnotation.symbolLibrary?.length, 1);
assert.equal(projWithAnnotation.symbolLibrary?.[0].id, 'native:IEC:1:0');

const before=JSON.stringify(project);prepareProjectPresentation(project);assert.equal(JSON.stringify(project),before,'Repeated loading does not change migrated data');
console.log('✓ Neutral application wording, legacy example migration, supplier-logo removal and preserved custom/electrical data');
