import JSZip from 'jszip';
import { readIndexedEodRecords } from './EodReader';

export type NativeLayerStyle = {
  /** Physical millimetres; convert to the application's drawing scale at use. */
  lineWidth?: number;
  fontSize?: number;
  fontColor?: string;
  angle?: number;
  visible?: boolean;
};

/**
 * Project layer defaults referenced by graphic property 0xebfb. The observed
 * Layer records store their layer number (not their record ID) in 0xeff2,
 * line width in 0xeff5 and text height in 0xee21, both as millimetre doubles.
 */
export async function readNativeLayers(zip: JSZip, root: string): Promise<Map<number, NativeLayerStyle>> {
  const result = new Map<number, NativeLayerStyle>();
  const data = zip.file(`${root}Layer.eod`), index = zip.file(`${root}Layer.eox`);
  if (!data || !index) return result;
  const bytes = await data.async('uint8array');
  // Keep this bounded to the indexed layout observed in the supplied project.
  if (bytes.length % 284 !== 0) return result;
  const records = readIndexedEodRecords(bytes, await index.async('uint8array'),
    { size: 284, typedIndex: false }, 'Layer');
  for (const record of records) {
    const number = record.number(0xeff2), lineWidth = record.double(0xeff5);
    if (number === undefined) continue;
    const textHeight = record.double(0xee21), angle = record.double(0xee22);
    // Palette entries corroborated by the supplied source and PDF: device
    // graphics use blue (5), annotations use magenta (6).
    const fontColor=({5:'#0000ff',6:'#ff00ff'} as Record<number,string>)[record.number(0xeff4) ?? -1];
    result.set(number, {
      ...(lineWidth !== undefined && lineWidth >= 0 && lineWidth <= 100 ? { lineWidth } : {}),
      ...(textHeight !== undefined && textHeight > 0 && textHeight < 1000 ? { fontSize: textHeight } : {}),
      ...(fontColor ? {fontColor} : {}),
      ...(angle !== undefined && angle !== -16002 ? { angle } : {})
    });
    // Layer flags (0xeffb) are not decoded: 8 occurs on a visibly printed bus
    // layer, so it must not be interpreted as a hidden-layer bit.
  }
  return result;
}
