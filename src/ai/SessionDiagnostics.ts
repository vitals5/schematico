import {version} from '../../package.json';
import {sanitizeDiagnostic,getDiagnostics} from './Diagnostics';
import {getAiProvider,getAiModel} from './ProviderConfig';
/** Local, bounded trace. Never submitted to an AI provider or uploaded automatically. */
export class SessionDiagnostics {
 private events:{sequence:number;time:string;type:string;data:unknown}[]=[];
 private sequence=0;private bytes=0;private dropped=0;private started=new Date().toISOString();
 constructor(private maxBytes=32*1024*1024,private maxEvents=500,private maxEventBytes=2*1024*1024){}
 record(type:string,data:unknown):void{
  try{
   let safe=sanitizeDiagnostic(data),size=JSON.stringify(safe)?.length??0;
   if(size>this.maxEventBytes){safe={truncated:true,originalCharacters:size,reason:'Einzelereignis überschreitet das Diagnosebudget. Aktueller Projektstand ist separat im Export enthalten.'};size=JSON.stringify(safe).length;}
   const event={sequence:++this.sequence,time:new Date().toISOString(),type,data:safe};this.events.push(event);this.bytes+=size;
   while(this.events.length>this.maxEvents||this.bytes>this.maxBytes){const removed=this.events.shift()!;this.bytes-=JSON.stringify(removed.data)?.length??0;this.dropped++;}
  }catch{/* Recording must not change tool execution or mask its original error. */}
 }
 export(context:unknown){return sanitizeDiagnostic({schema:'schematico-session-diagnostic',schemaVersion:1,appVersion:version,build:{revision:typeof __BUILD_REVISION__==='undefined'?'development':__BUILD_REVISION__,builtAt:typeof __BUILD_TIME__==='undefined'?undefined:__BUILD_TIME__},startedAt:this.started,exportedAt:new Date().toISOString(),provider:getAiProvider(),model:getAiModel(),coverage:{eventsRecorded:this.sequence,eventsIncluded:this.events.length,droppedEvents:this.dropped,scope:'Aktuelle App-Sitzung seit Start oder letztem Leeren. Frühere Sitzungen und entfernte Ereignisse sind nicht rekonstruierbar.'},privacy:{localExport:true,secretsRedacted:true,attachmentContentsIncluded:false,containsChatAndProjectData:true},context,events:this.events,errors:getDiagnostics()});}
 clear(){this.events=[];this.bytes=0;this.sequence=0;this.dropped=0;this.started=new Date().toISOString();}
}
export const sessionDiagnostics=new SessionDiagnostics();

/** Keep the complete sanitized JSON while compressing repeated geometry/history.
 * Compression is asynchronous so large diagnostics do not freeze the editor. */
export async function createSessionArchive(report: ReturnType<SessionDiagnostics['export']>) {
 const {default:JSZip}=await import('jszip');
 const name='schematico-session-'+report.exportedAt.replace(/[:.]/g,'-');
 const zip=new JSZip();zip.file(name+'.json',JSON.stringify(report));
 return {name:name+'.zip',bytes:await zip.generateAsync({type:'uint8array',compression:'DEFLATE',compressionOptions:{level:6}})};
}

if(typeof window!=='undefined'){window.addEventListener('error',e=>sessionDiagnostics.record('runtime_error',{message:e.message,file:e.filename,line:e.lineno,column:e.colno,stack:e.error?.stack}));window.addEventListener('unhandledrejection',e=>sessionDiagnostics.record('unhandled_rejection',{message:e.reason?.message??String(e.reason),stack:e.reason?.stack}));}
