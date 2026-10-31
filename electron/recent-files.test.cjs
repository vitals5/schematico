const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {createRecentFiles}=require('./recent-files.cjs');
const folder=fs.mkdtempSync(path.join(os.tmpdir(),'schematico-recent-'));
try{
 const settings=path.join(folder,'profile','recent.json'),file=path.join(folder,'Test.json'),other=path.join(folder,'other','Test.json');
 fs.writeFileSync(file,'original');fs.mkdirSync(path.dirname(other));fs.writeFileSync(other,'other');
 const store=createRecentFiles(settings);assert.deepEqual(store.list(),[]);assert.throws(()=>store.remember([file]),/authorized/);assert.throws(()=>store.read(file));
 store.grant([file]);const entry=store.remember([file]);assert.equal(store.list().length,1);assert.equal(store.remember([file]).id,entry.id);
 const restart=createRecentFiles(settings);fs.writeFileSync(file,'edited outside');assert.equal(Buffer.from(restart.read(entry.id).files[0].buffer).toString(),'edited outside');
 restart.grant([other]);restart.remember([other]);assert.equal(restart.list().length,2,'Same basename / different folders are different files');
 restart.grant([file,other]);const group=restart.remember([file,other]);assert.equal(restart.read(group.id).files.length,2);restart.grant([other,file]);assert.equal(restart.remember([other,file]).id,group.id);
 fs.unlinkSync(file);assert.throws(()=>restart.read(entry.id),/ENOENT/);assert(restart.list().some(e=>e.id===entry.id),'Missing entries stay removable');
 for(let i=0;i<15;i++){const p=path.join(folder,i+'.json');restart.grant([p]);restart.remember([p]);}assert.equal(restart.list().length,10);restart.clear();assert.equal(restart.list().length,0);assert.equal(fs.readFileSync(other,'utf8'),'other','Clearing history must never delete project files');
 const win=createRecentFiles(settings,'win32');win.grant(['C:\\Projects\\A.json']);const a=win.remember(['C:\\Projects\\A.json']);assert.equal(win.remember(['c:\\projects\\a.JSON']).id,a.id,'Windows paths deduplicate case-insensitively');
 fs.writeFileSync(settings,'bad{');assert.deepEqual(win.list(),[]);assert.throws(()=>win.remember(['relative.json']));
 console.log('✓ Native recent files: authorized picker paths only, restart, live contents, multipart sets, missing files, ten-entry limit, safe clearing and Windows path identity');
}finally{fs.rmSync(folder,{recursive:true,force:true});}
