const fs = require('node:fs');
const path = require('node:path');
const {randomUUID} = require('node:crypto');

/** Only paths selected through native dialogs (or already in this history) may be read. */
function createRecentFiles(settingsFile, platform = process.platform) {
  const filePath=platform==='win32'?path.win32:path;
  const normalize = paths => {
    if (!Array.isArray(paths) || !paths.length || paths.length > 100 || paths.some(p => typeof p !== 'string' || !filePath.isAbsolute(p))) throw new Error('Invalid recent file selection');
    return paths.map(p => filePath.resolve(p));
  };
  const key = paths => JSON.stringify(paths.map(p => platform === 'win32' ? p.toLowerCase() : p).sort());
  const granted = new Set();
  const list = () => {
    try {
      const data = JSON.parse(fs.readFileSync(settingsFile, 'utf8'));
      if (!Array.isArray(data)) return [];
      return data.filter(e => typeof e?.id === 'string' && typeof e.name === 'string' && e.id.startsWith('native-') && Number.isFinite(e.openedAt) && Array.isArray(e.paths) && e.paths.length && e.paths.length <= 100 && e.paths.every(p => typeof p === 'string' && filePath.isAbsolute(p))).sort((a,b) => b.openedAt-a.openedAt).slice(0,10);
    } catch { return []; }
  };
  const write = entries => {
    fs.mkdirSync(path.dirname(settingsFile), {recursive:true});
    const temporary = settingsFile+'.tmp';
    fs.writeFileSync(temporary,JSON.stringify(entries),{mode:0o600});
    fs.renameSync(temporary,settingsFile);
  };
  return {
    grant(paths) { granted.add(key(normalize(paths))); },
    list,
    remember(paths) {
      paths=normalize(paths);const entries=list(),identity=key(paths),old=entries.find(e=>key(e.paths)===identity);
      if(!old&&!granted.has(identity))throw new Error('File selection was not authorized');
      const entry={id:old?.id??'native-'+randomUUID(),paths,name:filePath.basename(paths[0])+(paths.length>1?` (+${paths.length-1})`:''),openedAt:Date.now()};
      write([entry,...entries.filter(e=>key(e.paths)!==identity)].slice(0,10));return entry;
    },
    read(id) {
      const entry=list().find(e=>e.id===id);if(!entry)throw new Error('Recent file entry no longer exists');
      return {files:entry.paths.map(p=>({path:p,name:path.basename(p),buffer:Array.from(fs.readFileSync(p))}))};
    },
    remove(id) { write(list().filter(e=>e.id!==id)); },
    clear() { write([]);granted.clear(); }
  };
}
module.exports={createRecentFiles};
