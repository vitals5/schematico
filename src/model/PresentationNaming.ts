import type { PageImage, Project } from './types';

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

/** Migrate previous example imports while preserving custom text, logos and
 * electrical identifiers. This presentation migration is idempotent. */
export function prepareProjectPresentation(project:Project):void {
  migrateLegacyData(project);
  project.name=exampleName(project.name);
  const cover=project.coverPageTemplate;
  if(cover){
    if(cover.images)cover.images=cover.images.filter(image=>!isBundledSupplierLogo(image));
    if(cover.properties?.['10000:0'])cover.properties['10000:0']=exampleName(cover.properties['10000:0']);
  }
  for(const page of project.pages){
    page.plotFrame.titleBlock.projectTitle=page.plotFrame.titleBlock.projectTitle?.replace(new RegExp(`^(?:${legacyVendorToken}|NATIVE)([-_ ]Haus)(?= - |$)`,'i'),(_,suffix:string)=>suffix.slice(1)) ?? '';
    if(page.coverPage?.logo && isBundledSupplierLogo(page.coverPage.logo))page.coverPage.logo=null;
    const name=page.coverPage?.values?.['10000:0'];
    if(name!==undefined)page.coverPage!.values!['10000:0']=exampleName(name);
    if(page.images)page.images=page.images.filter(image=>!isBundledSupplierLogo(image));
  }
}
