import type { SevenZipModuleFactory } from '7z-wasm';

export interface ArchiveFile { path: string; data: Uint8Array }
export const MAX_ARCHIVE_BYTES = 512 * 1024 * 1024;
const MAX_ARCHIVE_FILES = 100000;

/** Extract only into the decoder's private memory filesystem, never the host filesystem. */
export async function extractSevenZip(data: Uint8Array, factory: SevenZipModuleFactory,
  locateFile?: (path: string, directory: string) => string): Promise<ArchiveFile[]> {
  const engine = await factory({
    ...(locateFile ? { locateFile } : {}),
    print: () => {}, printErr: () => {},
    stdin: () => null as unknown as number,
    quit: (_code, status) => { throw status; }
  });
  const fs = engine.FS;
  fs.mkdir('/output');
  fs.writeFile('/project.7z', data);
  // Enforce the output limit during decompression, before collecting files.
  const write = fs.write.bind(fs);
  let written = 0;
  fs.write = (stream, buffer, offset, length, position, canOwn) => {
    if (fs.isFile(stream.object.mode)) {
      if (!fs.getPath(stream.object).startsWith('/output/')) throw new Error('Ungültiger Dateipfad im Projektarchiv.');
      written += length;
      if (written > MAX_ARCHIVE_BYTES) throw new Error('Entpackte Projektsicherung überschreitet das Limit von 512 MiB.');
    }
    return write(stream, buffer, offset, length, position, canOwn);
  };
  const code = engine.callMain(['x', '/project.7z', '-o/output', '-y', '-p-', '-bso0', '-bse0', '-bsp0']) as unknown as number;
  if (code !== 0) throw new Error('Die 7z-Projektsicherung ist beschädigt, verschlüsselt oder verwendet eine nicht unterstützte Komprimierung.');
  const files: ArchiveFile[] = [];
  const visit = (directory: string, prefix = '') => {
    for (const name of fs.readdir(directory)) {
      if (name === '.' || name === '..') continue;
      const path = directory + '/' + name, relative = prefix + name, stat = fs.lstat(path);
      if (fs.isDir(stat.mode)) visit(path, relative + '/');
      else if (fs.isFile(stat.mode)) {
        if (files.length >= MAX_ARCHIVE_FILES) throw new Error('Zu viele Dateien im Projektarchiv.');
        files.push({ path: relative, data: fs.readFile(path) });
      } else throw new Error('Verknüpfungen und spezielle Dateien werden im Projektarchiv nicht unterstützt.');
    }
  };
  visit('/output');
  return files;
}
