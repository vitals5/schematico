import JSZip from 'jszip';
import type { ArchiveFile } from './SevenZipArchive';

export interface ProjectArchive {
  zip: JSZip;
  sizes: ReadonlyMap<string, number>;
  compression: 'zip' | '7z';
}

async function sevenZipFiles(file: File): Promise<ArchiveFile[]> {
  if (file.size > 256 * 1024 * 1024) throw new Error('Die 7z-Projektsicherung überschreitet das Limit von 256 MiB.');
  const bytes = await file.arrayBuffer();
  // Browser and desktop use an owned worker, so decompression cannot block the UI.
  if (typeof Worker !== 'undefined') {
    const worker = new Worker(new URL('./ProjectArchiveWorker.ts', import.meta.url), { type: 'module' });
    return new Promise<ArchiveFile[]>((resolve, reject) => {
      const finish = (files?: ArchiveFile[], error?: string) => {
        clearTimeout(timer);
        worker.terminate();
        if (files) resolve(files); else reject(new Error(error));
      };
      const timer = setTimeout(() => finish(undefined, 'Zeitlimit beim Entpacken der Projektsicherung überschritten.'), 120000);
      worker.onmessage = (event: MessageEvent<{ files?: ArchiveFile[]; error?: string }>) => finish(event.data.files, event.data.error);
      worker.onerror = () => finish(undefined, 'Der 7z-Entpacker konnte nicht ausgeführt werden.');
      worker.onmessageerror = () => finish(undefined, 'Die entpackten Projektdaten konnten nicht übertragen werden.');
      try { worker.postMessage(bytes, [bytes]); }
      catch (error) { finish(undefined, error instanceof Error ? error.message : 'Der 7z-Entpacker konnte nicht gestartet werden.'); }
    });
  }
  // The same decoder is available for command-line regression tests.
  const [{ default: SevenZip }, { extractSevenZip }] = await Promise.all([import('7z-wasm'), import('./SevenZipArchive')]);
  return extractSevenZip(new Uint8Array(bytes), SevenZip);
}

/** Compression is identified from bytes; the database importer receives one common archive view. */
export async function readProjectArchive(file: File): Promise<ProjectArchive> {
  const signature = new Uint8Array(await file.slice(0, 6).arrayBuffer());
  const is7z = [0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c].every((byte, i) => signature[i] === byte);
  if (is7z) {
    const files = await sevenZipFiles(file), zip = new JSZip(), sizes = new Map<string, number>();
    for (const entry of files) {
      zip.file(entry.path, entry.data, { createFolders: false });
      sizes.set(entry.path, entry.data.length);
    }
    return { zip, sizes, compression: '7z' };
  }
  const zip = await JSZip.loadAsync(file), sizes = new Map<string, number>();
  zip.forEach((path, entry) => sizes.set(path, (entry as unknown as { _data?: { uncompressedSize?: number } })._data?.uncompressedSize ?? 0));
  return { zip, sizes, compression: 'zip' };
}
