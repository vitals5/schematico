// Run after dist:linux on Linux with Xvfb. Chromium sandbox overrides below apply
// only to this isolated CI process, never to the shipped desktop launcher.
import assert from 'node:assert/strict';
import {spawn,execFileSync} from 'node:child_process';
import {readFileSync,mkdtempSync,rmSync,chmodSync,existsSync,statSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve,join} from 'node:path';
import {createServer} from 'node:net';

assert.equal(process.platform,'linux','Linux package checks must run on Linux');
const pkg=JSON.parse(readFileSync('package.json','utf8'));
const stem=resolve('release',`Schematico-${pkg.version}-linux-x64`);
const image=stem+'.AppImage',deb=stem+'.deb';
assert(existsSync(image)&&existsSync(deb),'Both Linux packages must exist');
for(const [field,value]of [['Package','schematico'],['Version',pkg.version],['Architecture','amd64']])
  assert.equal(execFileSync('dpkg-deb',['--field',deb,field],{encoding:'utf8'}).trim(),value);
const temporary=mkdtempSync(join(tmpdir(),'schematico-linux-'));
let child,socket,log='';
try{
  chmodSync(image,0o755);
  execFileSync(image,['--appimage-extract'],{cwd:temporary,stdio:['ignore','ignore','pipe'],timeout:30000});
  const extracted=join(temporary,'squashfs-root');
  const debRoot=join(temporary,'deb');
  execFileSync('dpkg-deb',['--extract',deb,debRoot]);
  assert(readFileSync(join(extracted,'resources/app.asar')).equals(readFileSync(join(debRoot,'opt/Schematico/resources/app.asar'))),'AppImage and Debian package must contain the same application');
  for(const file of ['opt/Schematico/resources/app.asar','usr/share/applications/schematico.desktop','usr/share/icons/hicolor/512x512/apps/schematico.png'])assert.equal(statSync(join(debRoot,file)).mode & 0o444,0o444,'Installed files must be readable by desktop users: '+file);
  const desktop=readFileSync(join(debRoot,'usr/share/applications/schematico.desktop'),'utf8');
  assert.match(desktop,/Name=Schematico/);assert.match(desktop,/Icon=schematico/);
  assert(desktop.includes('/opt/Schematico/schematico')&&!desktop.includes('--no-sandbox'),'The installed launcher must keep the standard sandbox');
  assert(existsSync(join(debRoot,'usr/share/icons/hicolor/512x512/apps/schematico.png')),'Linux branding icon missing');
  if(process.argv.includes('--packages-only')){
    console.log('✓ Linux x64 AppImage/Debian metadata, identical application contents, installed file permissions, desktop launcher and icon');
  }else{
  const server=createServer();await new Promise((yes,no)=>{server.once('error',no);server.listen(0,'127.0.0.1',yes);});
  const port=server.address().port;await new Promise(yes=>server.close(yes));
  child=spawn('xvfb-run',['-a',join(extracted,'schematico'),'--no-sandbox','--disable-gpu','--disable-dev-shm-usage',`--remote-debugging-port=${port}`,'--remote-debugging-address=127.0.0.1',`--user-data-dir=${join(temporary,'profile')}`],{detached:true,stdio:['ignore','pipe','pipe']});
  child.on('error',error=>{log+=error.message;});
  for(const stream of [child.stdout,child.stderr])stream.on('data',data=>{log=(log+data.toString()).slice(-8192);});
  const deadline=Date.now()+30000;
  let target;
  while(Date.now()<deadline){
    if(child.exitCode!==null)throw new Error('Packaged desktop exited before loading: '+log);
    try{const result=await fetch(`http://127.0.0.1:${port}/json/list`,{signal:AbortSignal.timeout(1000)});target=(await result.json()).find(t=>t.type==='page'&&t.url.startsWith('file:')&&t.url.endsWith('/dist/index.html'));}catch{}
    if(target)break;
    await new Promise(yes=>setTimeout(yes,250));
  }
  assert(target,'Packaged application did not open its local entry point: '+log);
  socket=new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((yes,no)=>{socket.addEventListener('open',yes,{once:true});socket.addEventListener('error',no,{once:true});setTimeout(()=>no(new Error('Desktop debugging connection timed out')),5000).unref();});
  const result=await new Promise((yes,no)=>{
    const timer=setTimeout(()=>no(new Error('Desktop did not become ready: '+log)),30000);
    socket.addEventListener('message',event=>{const message=JSON.parse(event.data);if(message.id!==1)return;clearTimeout(timer);yes(message);});
    socket.send(JSON.stringify({id:1,method:'Runtime.evaluate',params:{awaitPromise:true,returnByValue:true,expression:`(async()=>{for(let i=0;i<100;i++){if(document.querySelector('#canvasContainer svg.cad-viewport')?.children.length&&window.electronAPI?.macroLibrary?.getFolder){await window.electronAPI.macroLibrary.getFolder();return {title:document.title,editor:true,native:true};}await new Promise(r=>setTimeout(r,200));}throw new Error('Editor or native bridge missing: '+JSON.stringify({title:document.title,editor:!!document.querySelector('#canvasContainer svg.cad-viewport'),native:typeof window.electronAPI?.macroLibrary?.getFolder}));})()`}}));
  });
  assert(!result.error&&!result.result?.exceptionDetails,JSON.stringify(result)+'\n'+log);
  assert.match(result.result.result.value.title,/Schematico/);
  assert.equal(result.result.result.value.editor,true);assert.equal(result.result.result.value.native,true);
  console.log('✓ Linux x64 AppImage and Debian metadata, identical app contents, launcher/icon, packaged editor and native macro bridge');
  }
}finally{
  socket?.close();
  if(child?.pid){try{process.kill(-child.pid,'SIGTERM');}catch{}await new Promise(yes=>setTimeout(yes,500));try{process.kill(-child.pid,'SIGKILL');}catch{}}
  rmSync(temporary,{recursive:true,force:true});
}
