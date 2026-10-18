const fs = require('node:fs/promises');
const path = require('node:path');
const MAX_FILE_SIZE = 32 * 1024 * 1024;
const MAX_FILES = 5000;
const supported = name => /\.(ema|ems)$/i.test(name);

/** User-selected library only; settings live beside the app's other user data. */
function createMacroLibrary(settingsFile) {
  const getFolder = async () => {
    try { const saved = JSON.parse(await fs.readFile(settingsFile, 'utf8')); return typeof saved.path === 'string' ? saved.path : ''; }
    catch (error) { if (error.code === 'ENOENT') return ''; throw new Error('Der gespeicherte Makroordner kann nicht gelesen werden.'); }
  };
  const setFolder = async folder => {
    if (typeof folder !== 'string') throw new Error('Bitte einen Ordnerpfad eingeben.');
    const resolved = folder.trim() ? await fs.realpath(path.resolve(folder.trim())) : '';
    if (resolved && !(await fs.stat(resolved)).isDirectory()) throw new Error('Der Makropfad ist kein Ordner.');
    await fs.mkdir(path.dirname(settingsFile), { recursive: true });
    await fs.writeFile(settingsFile + '.tmp', JSON.stringify({ path: resolved }), { mode: 0o600 });
    await fs.rename(settingsFile + '.tmp', settingsFile);
    return resolved;
  };
  const list = async () => {
    const folder = await getFolder(), files = [], issues = [];
    if (!folder) return { path: '', files, issues };
    const root = await fs.realpath(folder);
    let inspected = 0;
    const visit = async (directory, relative = '') => {
      if (++inspected > 10000) throw new Error('Der Makroordner enthält zu viele Unterordner.');
      let entries;
      try { entries = await fs.readdir(directory, { withFileTypes: true }); }
      catch { if (!relative) throw new Error('Der Makroordner ist nicht erreichbar.'); issues.push(`${relative}: Unterordner nicht lesbar.`); return; }
      for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
        if (entry.isSymbolicLink()) continue;
        const rel = relative ? `${relative}/${entry.name}` : entry.name;
        if (entry.isDirectory()) await visit(path.join(directory, entry.name), rel);
        else if (entry.isFile() && supported(entry.name)) {
          if (files.length >= MAX_FILES) throw new Error('Der Makroordner enthält mehr als 5000 Makrodateien.');
          try {
            const stat = await fs.stat(path.join(directory, entry.name));
            if (stat.size > MAX_FILE_SIZE) { issues.push(`${rel}: Datei ist größer als 32 MB.`); continue; }
            files.push({ relativePath: rel, size: stat.size, lastModified: stat.mtimeMs });
          } catch { issues.push(`${rel}: Datei nicht lesbar.`); }
        }
      }
    };
    await visit(root);
    return { path: folder, files, issues };
  };
  const read = async relativePath => {
    if (typeof relativePath !== 'string' || !relativePath || path.isAbsolute(relativePath)
      || relativePath.split(/[\\/]/).includes('..') || !supported(relativePath)) throw new Error('Ungültige Makrodatei.');
    const folder = await getFolder();
    if (!folder) throw new Error('Kein Makroordner eingestellt.');
    const root = await fs.realpath(folder), target = await fs.realpath(path.join(root, relativePath));
    const rel = path.relative(root, target);
    if (!rel || rel.startsWith('..' + path.sep) || rel === '..' || path.isAbsolute(rel)) throw new Error('Die Datei liegt außerhalb des Makroordners.');
    const stat = await fs.stat(target);
    if (!stat.isFile() || stat.size > MAX_FILE_SIZE) throw new Error('Die Makrodatei ist nicht lesbar oder größer als 32 MB.');
    const bytes = await fs.readFile(target);
    if (bytes.length > MAX_FILE_SIZE) throw new Error('Die Makrodatei ist größer als 32 MB.');
    return { name: path.basename(target), data: new Uint8Array(bytes), lastModified: stat.mtimeMs };
  };
  return { getFolder, setFolder, list, read };
}
module.exports = { createMacroLibrary };
