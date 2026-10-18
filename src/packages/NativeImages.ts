import type JSZip from 'jszip';
import type { PageImage } from '../model/types';
import { EodRecord } from './EodReader';
import { NATIVE_SCALE } from './NativeSymbolLibrary';

const basename = (path: string) => path.split(/[\\/]/).pop() ?? '';
const identity = (record: EodRecord) => `${record.type}:${record.id}`;

/** Image bytes determine the data URL format, independently of filename case. */
function imageMime(bytes: Uint8Array): 'image/png' | 'image/jpeg' | undefined {
  if (bytes.length >= 8 && [137, 80, 78, 71, 13, 10, 26, 10].every((b, i) => bytes[i] === b)) return 'image/png';
  if (bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return 'image/jpeg';
  return;
}

/**
 * Read editable image placements from indexed source records. All records may
 * be supplied to resolve intermediate parents; only type 91 creates images.
 * A form reference is not a page reference even when its numeric ID coincides.
 * Missing/ambiguous assets and unsupported image bytes are never substituted.
 */
export async function readNativePageImages(zip: JSZip, root: string, instances: readonly EodRecord[],
  diagnostic?: (message: string) => void): Promise<Map<number, PageImage[]>> {
  const result = new Map<number, PageImage[]>();
  const byIdentity = new Map(instances.map(record => [identity(record), record]));
  const pageOf = (record: EodRecord): number | undefined => {
    const seen = new Set<string>();
    let current: EodRecord | undefined = record;
    while (current) {
      const key = identity(current);
      if (seen.has(key)) return;
      seen.add(key);
      // EBF2 also refers to forms. Its stored object type must be checked.
      if (current.number(0xebf2) === 4) return current.number(0xebf2, 4, 4);
      const parentType = current.number(0xebf1), parentId = current.number(0xebf1, 4, 4);
      if (parentType === 4) return parentId;
      current = byIdentity.get(`${parentType}:${parentId}`);
    }
  };
  const prefix = `${root.replace(/\\/g, '/').replace(/\/?$/, root ? '/' : '')}Images/`.toLowerCase();
  const assets = Object.values(zip.files).filter(file => !file.dir && file.name.replace(/\\/g, '/').toLowerCase().startsWith(prefix));
  const dataUrls = new Map<string, Promise<string | undefined>>();
  const dataUrl = (file: typeof assets[number]) => {
    let pending = dataUrls.get(file.name);
    if (!pending) {
      pending = (async () => {
        const bytes = await file.async('uint8array'), mime = imageMime(bytes);
        return mime ? `data:${mime};base64,${await file.async('base64')}` : undefined;
      })();
      dataUrls.set(file.name, pending);
    }
    return pending;
  };
  for (const record of instances) {
    if (record.type !== 91) continue;
    const page = pageOf(record);
    if (page === undefined || page <= 0) continue;
    const a = record.point(0xf0d3), b = record.point(0xf0d4), source = record.string(0xf0e7), name = basename(source);
    const matches = name ? assets.filter(file => basename(file.name).toLowerCase() === name.toLowerCase()) : [];
    if (!a || !b || a.x === b.x || a.y === b.y || matches.length !== 1) {
      diagnostic?.(`Bild ${record.id}: Platzierung oder eingebettete Bilddatei nicht eindeutig auflösbar.`);
      continue;
    }
    const url = await dataUrl(matches[0]);
    if (!url) { diagnostic?.(`Bild ${record.id}: eingebettetes Bildformat wird nicht unterstützt.`); continue; }
    const image: PageImage = {
      id: `native-image-${record.id}`, dataUrl: url,
      x: Math.min(a.x, b.x) * NATIVE_SCALE,
      y: (297 - Math.max(a.y, b.y)) * NATIVE_SCALE,
      width: Math.abs(b.x - a.x) * NATIVE_SCALE,
      height: Math.abs(b.y - a.y) * NATIVE_SCALE,
      caption: name
    };
    if (!result.has(page)) result.set(page, []);
    result.get(page)!.push(image);
  }
  return result;
}
