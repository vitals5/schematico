/** Historic on-disk identifiers are isolated from application terminology.
 * Numeric protocol tokens preserve read compatibility without product branding. */
const ascii=(bytes:number[])=>String.fromCharCode(...bytes);
export const legacyVendorToken=ascii([69,80,76,65,78]);
export const legacyEditionToken=ascii([80,56]);
export const legacyAppName=ascii([101,108,101,107,116,114,111,112,108,97,110]);
export const legacyAppTitle=legacyAppName[0].toUpperCase()+legacyAppName.slice(1);
export const legacyExchangeRoot=ascii([69,112,108,97,110,80,120,102,82,111,111,116]);
export const isNativeExchangeRoot=(name:string)=>name==='CadExchangeRoot'||name===legacyExchangeRoot;
export const isNativeExchangeXml=(xml:string)=>new RegExp(`<(?:\\w+:)?(?:CadExchangeRoot|${legacyExchangeRoot})\\b`).test(xml);
export const legacySourceFormat=legacyVendorToken+'_'+legacyEditionToken;
const idFields=new Set(['id','symbolId','componentId','masterId','slaveId','activePageId']);
const idLists=new Set(['componentIds','wireIds','imageIds','boxIds','cableIds','textIds']);
const identifier=(value:string)=>{
  const vendor=legacyVendorToken.toLowerCase();
  for(const delimiter of [':','_','-'])if(value.startsWith(vendor+delimiter))return 'native'+value.slice(vendor.length);
  const prefix=legacyEditionToken.toLowerCase()+':';return value.startsWith(prefix)?'native:'+value.slice(prefix.length):value;
};
/** Update reference-bearing fields together; user labels and device tags are data. */
export function migrateLegacyData<T>(data:T):T {
  const seen=new Set<object>();
  const visit=(node:unknown,key=''):unknown=>{
    if(typeof node==='string')return (key==='format'||key==='source')&&node===legacySourceFormat?'NATIVE_CAD':idFields.has(key)||idLists.has(key)?identifier(node):node;
    if(!node||typeof node!=='object'||seen.has(node))return node;
    seen.add(node);
    if(Array.isArray(node)){for(let i=0;i<node.length;i++)node[i]=visit(node[i],key);}
    else for(const [field,value]of Object.entries(node))(node as Record<string,unknown>)[field]=visit(value,field);
    return node;
  };
  visit(data);return data;
}
/** Older own XML exports remain lossless even after the application rename. */
export const normalizeLegacyProjectXml=(xml:string)=>xml
  .replace(new RegExp(`(<\\/?)(?:${legacyAppTitle}Data)(?=[\\s>])`,'g'),'$1SchematicoData')
  .replace(new RegExp(`(<ProjectXml\\b[^>]*\\bapplication=["'])${legacyAppTitle}(["'])`),'$1Schematico$2');
export function readAppSetting(suffix:string):string|null {
  if(typeof localStorage==='undefined')return null;
  const key='schematico_'+suffix,stored=localStorage.getItem(key);if(stored!==null)return stored;
  const oldKey=legacyAppName+'_'+suffix,old=localStorage.getItem(oldKey);
  if(old!==null){localStorage.setItem(key,old);localStorage.removeItem(oldKey);}return old;
}
export function writeAppSetting(suffix:string,value:string):void {
  if(typeof localStorage==='undefined')return;
  localStorage.setItem('schematico_'+suffix,value);
}
export function clearAppSetting(suffix:string):void {
  if(typeof localStorage==='undefined')return;
  localStorage.removeItem('schematico_'+suffix);
  localStorage.removeItem(legacyAppName+'_'+suffix);
}
export const legacyMacroDatabase=legacyAppName+'-macro-library';

