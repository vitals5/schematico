import SevenZip from '7z-wasm';
import wasmUrl from '7z-wasm/7zz.wasm?url';
import { extractSevenZip } from './SevenZipArchive';

self.onmessage = async (event: MessageEvent<ArrayBuffer>) => {
  try {
    const files = await extractSevenZip(new Uint8Array(event.data), SevenZip, () => wasmUrl);
    self.postMessage({ files }, { transfer: files.map(file => file.data.buffer as ArrayBuffer) });
  } catch (error) {
    self.postMessage({ error: error instanceof Error ? error.message : '7z-Projektsicherung konnte nicht entpackt werden.' });
  }
};
