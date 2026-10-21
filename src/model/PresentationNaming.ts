import type { PageImage, Project, PageText, PlacedComponent, SymbolDefinition } from './types';

import { legacyVendorToken, legacyEditionToken, migrateLegacyData } from './LegacyCompatibility';
const vendorPattern=new RegExp(`\\b${legacyVendorToken}(?:[-_ ]?${legacyEditionToken})?(?![a-z0-9])`,'gi');
const editionPattern=new RegExp(`\\b${legacyEditionToken}\\b`,'gi');
/** Neutral wording for source filenames and diagnostics displayed by the app. */
export function neutralSourceLabel(value:string):string { return value.replace(vendorPattern,'Projektarchiv').replace(editionPattern,'Projektarchiv'); }
const legacyExample=new RegExp(`^(?:${legacyVendorToken}|NATIVE)[-_ ]Haus$`,'i');
const exampleName=(value:string)=>legacyExample.test(value)?'Haus':value;

/** Recognize the formerly bundled supplier logo by its actual bytes. A custom
 * replacement may retain an old caption, so filenames alone are insufficient. */
export function isBundledSupplierLogo(image:PageImage):boolean {
  if(image.dataUrl.length!==134075)return false;
  let hash=2166136261;
  for(let i=0;i<image.dataUrl.length;i++)hash=Math.imul(hash^image.dataUrl.charCodeAt(i),16777619);
  return (hash>>>0)===0x23913f56;
}

/** Converts legacy annotation/text components into first-class PageText elements */
export function convertAnnotationComponentsToTexts(project: Project): void {
  if (!project || !Array.isArray(project.pages)) return;

  const symDict = new Map<string, SymbolDefinition>(
    (project.symbolLibrary ?? []).map(s => [s.id, s])
  );

  const cleanText = (raw: string): string => {
    if (!raw) return '';
    const m = raw.match(/(?:[a-zA-Z]{2}_[a-zA-Z]{2}|\?\?_\?\?)@([^;]*)/);
    if (m) return m[1].trim();
    return raw.replace(/^[a-zA-Z]{2}_[a-zA-Z]{2}@/, '').replace(/;$/, '').trim();
  };

  let hasConverted = false;

  for (const page of project.pages) {
    if (!Array.isArray(page.components)) continue;
    const remainingComponents: PlacedComponent[] = [];
    const convertedTexts: PageText[] = [];

    for (const c of page.components) {
      const sid = c.symbolId || '';
      const sym = symDict.get(sid);
      const isAnnotation = sid.startsWith('native:annotation:') ||
        (sym?.name === 'Projekttext' && sym?.description === 'Editierbarer Projekttext');

      if (isAnnotation) {
        hasConverted = true;
        const ftp = c.functionTextPosition || {};
        const rawText = c.functionText || (c as any).displayedText || c.additionalText || c.bmk || '';
        let textVal = cleanText(rawText);
        if (!textVal && rawText) textVal = rawText;

        const fontSize = ftp.fontSize || (sym?.height ? sym.height * 0.83 : 9);
        const dx = sym && ftp.offsetX !== undefined ? (sym.width / 2 + ftp.offsetX) : 0;
        const dy = sym && ftp.offsetY !== undefined ? (sym.height + 12 + ftp.offsetY) : fontSize;
        const x = c.x + dx;
        const y = c.y + dy;

        if (textVal) {
          convertedTexts.push({
            id: c.id,
            text: textVal,
            x,
            y,
            fontSize,
            fontColor: ftp.fontColor || '#cbd5e0',
            fontWeight: ftp.fontWeight || (fontSize >= 11 ? 'bold' : 'normal'),
            fontStyle: 'normal',
            align: ftp.alignment || 'start',
            rotation: (c.rotation || ftp.rotation || 0) as 0 | 90 | 180 | 270
          });
        }
      } else {
        remainingComponents.push(c);
      }
    }

    if (convertedTexts.length > 0) {
      (page.texts ??= []).push(...convertedTexts);
    }
    page.components = remainingComponents;
  }

  if (hasConverted && project.symbolLibrary) {
    project.symbolLibrary = project.symbolLibrary.filter(s =>
      !s.id.startsWith('native:annotation:') && s.name !== 'Projekttext'
    );
  }
}

/** Migrate previous example imports while preserving custom text, logos and
 * electrical identifiers. This presentation migration is idempotent. */
export function prepareProjectPresentation(project:Project):void {
  migrateLegacyData(project);
  convertAnnotationComponentsToTexts(project);
  project.name=exampleName(project.name);
  const cover=project.coverPageTemplate;
  if(cover){
    if(cover.images)cover.images=cover.images.filter(image=>!isBundledSupplierLogo(image));
    if(cover.properties?.['10000:0'])cover.properties['10000:0']=exampleName(cover.properties['10000:0']);
    if(cover.name==='F26_001')cover.name='F01';
    if(cover.properties?.['11015:0']==='F26_001')cover.properties['11015:0']='F01';
  }
  for(const page of project.pages){
    if (page.plotFrame?.titleBlock) {
      page.plotFrame.titleBlock.projectTitle = page.plotFrame.titleBlock.projectTitle?.replace(new RegExp(`^(?:${legacyVendorToken}|NATIVE)([-_ ]Haus)(?= - |$)`,'i'),(_,suffix:string)=>suffix.slice(1)) ?? '';
    }
    if(page.coverPage?.logo && isBundledSupplierLogo(page.coverPage.logo))page.coverPage.logo=null;
    const name=page.coverPage?.values?.['10000:0'];
    if(name!==undefined)page.coverPage!.values!['10000:0']=exampleName(name);
    if(page.coverPage?.values?.['11015:0']==='F26_001')page.coverPage.values['11015:0']='F01';
    if(page.images)page.images=page.images.filter(image=>!isBundledSupplierLogo(image));
  }
}
