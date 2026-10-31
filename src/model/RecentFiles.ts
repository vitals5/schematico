import type {Project} from './types';
export interface RecentHandle {
 name:string;getFile():Promise<File>;
 isSameEntry?(other:RecentHandle):Promise<boolean>;
 queryPermission?(options:{mode:'read'}):Promise<PermissionState>;
 requestPermission?(options:{mode:'read'}):Promise<PermissionState>;
}
export interface RecentEntry {id:string;name:string;kind:'native'|'handle'|'copy'|'reselect';openedAt:number;path?:string}
export interface BrowserRecent extends RecentEntry {identity?:string;handles?:RecentHandle[];copy?:Blob;copyName?:string}
export interface RecentStore {get():Promise<BrowserRecent[]>;put(entries:BrowserRecent[]):Promise<void>}
export interface NativeRecent {
 list():Promise<{id:string;name:string;paths:string[];openedAt:number}[]>;
 remember(paths:string[]):Promise<unknown>;
 read(id:string):Promise<{files:{name:string;path:string;buffer:number[]}[]}>;
 remove(id:string):Promise<unknown>;clear():Promise<unknown>;
}
export class BrowserRecentStore implements RecentStore {
 private async transaction<T>(write:boolean,action:(store:IDBObjectStore)=>IDBRequest<T>):Promise<T>{
  const db=await new Promise<IDBDatabase>((resolve,reject)=>{const r=indexedDB.open('schematico-recent-files',1);r.onupgradeneeded=()=>r.result.createObjectStore('history');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);r.onblocked=()=>reject(new Error('Recent file storage blocked'));});
  return new Promise((resolve,reject)=>{const tx=db.transaction('history',write?'readwrite':'readonly'),r=action(tx.objectStore('history'));tx.oncomplete=()=>{db.close();resolve(r.result);};tx.onerror=tx.onabort=()=>{db.close();reject(tx.error||r.error);};});
 }
 async get(){const data=await this.transaction(false,s=>s.get('entries'));return Array.isArray(data)?data.filter(e=>typeof e?.id==='string'&&typeof e.name==='string'&&Number.isFinite(e.openedAt)):[];}
 async put(entries:BrowserRecent[]){await this.transaction(true,s=>s.put(entries,'entries'));}
}
const maximumCopy=32*1024*1024,totalCopies=64*1024*1024;
export class RecentFiles {
 private queue=Promise.resolve();private memory?:BrowserRecent[];
 constructor(private native?:NativeRecent,private store:RecentStore=new BrowserRecentStore()){}
 private async browser(){if(this.memory)return this.memory;try{return await this.store.get();}catch{return this.memory=[];}}
 private async persist(entries:BrowserRecent[]){let bytes=0;for(const e of entries){if(e.copy){if(e.copy.size>maximumCopy||bytes+e.copy.size>totalCopies){e.copy=undefined;e.copyName=undefined;e.kind='reselect';}else bytes+=e.copy.size;}}try{await this.store.put(entries);this.memory=undefined;}catch{this.memory=entries;}}
 private serial<T>(action:()=>Promise<T>):Promise<T>{const result=this.queue.then(action);this.queue=result.then(()=>{},()=>{});return result;}
 async list():Promise<RecentEntry[]>{
  await this.queue;
  const browser=await this.browser(),native=this.native?await this.native.list():[];
  return [...native.map(e=>({id:e.id,name:e.name,kind:'native' as const,openedAt:e.openedAt,path:e.paths.join('\n')})),...browser.map(({handles,copy,copyName,identity,...metadata})=>metadata)].sort((a,b)=>b.openedAt-a.openedAt).slice(0,10);
 }
 private async trim(){
  const browser=await this.browser(),native=this.native?await this.native.list():[];
  const keep=new Set([...browser,...native].sort((a,b)=>b.openedAt-a.openedAt).slice(0,10).map(e=>e.id));
  if(browser.some(e=>!keep.has(e.id)))await this.persist(browser.filter(e=>keep.has(e.id)));
  if(this.native)for(const e of native)if(!keep.has(e.id))await this.native.remove(e.id);
 }
 async remember(project:Project,names:string[],source:{paths?:string[];handles?:RecentHandle[];recentId?:string}={}):Promise<void>{
  const snapshot=!source.handles?.length&&!(this.native&&source.paths?.length)?new Blob([JSON.stringify(project)],{type:'application/json'}):undefined;
  const snapshotName=project.name+'.json';
  return this.serial(async()=>{
   if(!names.length||names.some(name=>typeof name!=='string'||!name))throw new Error('Recent files require a file name');
   if(this.native&&source.paths?.length){await this.native.remember(source.paths);await this.trim();return;}
   const entries=await this.browser(),handles=source.handles;
   let old=source.recentId?entries.find(e=>e.id===source.recentId):undefined;
   const identity=JSON.stringify([project.id,...names]);
   if(!old&&handles?.length){for(const e of entries){if(e.handles?.length!==handles.length)continue;try{if((await Promise.all(handles.map(async h=>(await Promise.all(e.handles!.map(old=>h.isSameEntry?.(old)??Promise.resolve(h===old)))).some(Boolean)))).every(Boolean)){old=e;break;}}catch{}}}
   if(!old&&!handles?.length)old=entries.find(e=>e.identity===identity&&!e.handles);
   const entry:BrowserRecent={id:old?.id??'browser-'+(globalThis.crypto?.randomUUID?.()??Date.now().toString(36)+'-'+Math.random().toString(36).slice(2)),name:old&&source.recentId?old.name:names.join(' + '),kind:handles?.length?'handle':'copy',openedAt:Date.now(),identity:old?.identity??identity,...(handles?.length?{handles}:{copy:snapshot,copyName:snapshotName})};
   await this.persist([entry,...entries.filter(e=>e.id!==entry.id)].slice(0,10));await this.trim();
  });
 }
 async open(entry:RecentEntry):Promise<{files:File[];filePaths?:string[];fileHandle?:RecentHandle;fileHandles?:RecentHandle[]}|null>{
  await this.queue;
  if(entry.kind==='native'){
   if(!this.native)throw new Error('Native recent file access unavailable');const {files}=await this.native.read(entry.id);
   return {files:files.map(f=>new File([new Uint8Array(f.buffer)],f.name)),filePaths:files.map(f=>f.path)};
  }
  const saved=(await this.browser()).find(e=>e.id===entry.id);if(!saved)throw new Error('Recent file entry no longer exists');
  if(saved.handles?.length){
   const files:File[]=[];
   for(const h of saved.handles){let permission=await h.queryPermission?.({mode:'read'});if(permission&&permission!=='granted')permission=await h.requestPermission?.({mode:'read'});if(permission&&permission!=='granted')throw new Error('Dateizugriff nicht freigegeben / File access not granted');files.push(await h.getFile());}
   return {files,fileHandles:saved.handles,fileHandle:saved.handles.length===1?saved.handles[0]:undefined};
  }
  if(saved.copy&&saved.copyName)return {files:[new File([saved.copy],saved.copyName,{type:'application/json'})]};
  return null;
 }
 async remove(id:string){return this.serial(async()=>{if(id.startsWith('native-')&&this.native)await this.native.remove(id);else await this.persist((await this.browser()).filter(e=>e.id!==id));});}
 async clear(){return this.serial(async()=>{if(this.native)await this.native.clear();await this.persist([]);});}
}
