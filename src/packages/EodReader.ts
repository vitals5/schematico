import { Unzlib } from 'fflate';

/** Layouts observed in the supplied native CAD project. Offsets are confined to a record. */
export const EOD_LAYOUTS = {
  Page: { size: 1134, typedIndex: false },
  Potential: { size: 513, typedIndex: false },
  Function: { size: 1333, typedIndex: true },
  IPoint: { size: 530, typedIndex: true },
  Instance: { size: 215, typedIndex: true },
  Connection: { size: 980, typedIndex: false }
} as const;

export class EodRecord {
  constructor(public id: number, public type: number, public row: number, public data: Uint8Array,
    public partial = false) {}
  find(tag: number, start = 0): number {
    for (let i = start; i + 1 < this.data.length; i++) {
      if (this.data[i] === (tag & 255) && this.data[i + 1] === (tag >>> 8)) return i;
    }
    return -1;
  }
  number(tag: number, bytes = 2, skip = 2): number | undefined {
    const i = this.find(tag) + skip;
    if (i < skip || i + bytes > this.data.length) return undefined;
    const v = new DataView(this.data.buffer, this.data.byteOffset, this.data.byteLength);
    return bytes === 1 ? v.getUint8(i) : bytes === 4 ? v.getUint32(i, true) : v.getUint16(i, true);
  }
  string(tag: number, skip = 2, start = 0): string {
    const p = this.find(tag, start);
    if (p < 0) return '';
    let end = p + skip;
    while (end < this.data.length && this.data[end]) end++;
    return new TextDecoder().decode(this.data.subarray(p + skip, end));
  }
  point(tag: number): { x: number; y: number } | undefined {
    const p = this.find(tag);
    if (p < 0 || p + 18 > this.data.length) return;
    const v = new DataView(this.data.buffer, this.data.byteOffset + p + 2, 16);
    const x = v.getFloat64(0, true), y = v.getFloat64(8, true);
    if (Number.isFinite(x) && Number.isFinite(y) && Math.abs(x) < 10000 && Math.abs(y) < 10000) return { x, y };
  }
  double(tag: number): number | undefined {
    const p = this.find(tag);
    if (p < 0 || p + 10 > this.data.length) return;
    const value = new DataView(this.data.buffer, this.data.byteOffset + p + 2, 8).getFloat64(0, true);
    return Number.isFinite(value) ? value : undefined;
  }
  get pageId(): number | undefined { return this.number(0xebf2, 4, 4); }
  get position() { return this.point(0xed5a); }
  get bmk(): string { return this.string(0xee2c) + this.string(0xee2d) + this.string(0xee2e); }
  get symbol(): number | undefined { return this.number(0xef4e); }
  get variant(): number { return this.number(0xef4f, 1) ?? 0; }
  get pins(): string[] {
    // native CAD encodes repeated pin strings either as properties or as a counted array.
    for (let i = 0; i + 11 < this.data.length; i++) {
      if (this.data[i] !== 0x80 || this.data[i + 1] !== 3 || this.data[i + 2] !== 0xb9) continue;
      const v = new DataView(this.data.buffer, this.data.byteOffset + i + 3);
      const length = v.getUint32(0, true), count = v.getUint32(4, true);
      if (count > 100 || length < 4 || i + 7 + length > this.data.length) return [];
      return new TextDecoder().decode(this.data.subarray(i + 11, i + 7 + length)).split('\0').slice(0, count);
    }
    const pins: string[] = [];
    for (let i = this.find(0xeb19); i >= 0; i = this.find(0xeb19, i + 2)) pins.push(this.string(0xeb19, 2, i));
    return pins;
  }
}

/** German text is UTF-8; keep language selection separate from property decoding. */
export function nativeText(value: string): string {
  return value.match(/(?:de_DE|\?\?_\?\?)@([^;]*)/)?.[1] ?? value.split(';')[0];
}

/**
 * Read indexed fixed slots, not arbitrary marker windows. EOX suffix candidates
 * are admitted only when their 1-based row, type and object identity match EOD.
 * This is the observed native CAD index layout, not a general c-tree index implementation.
 */
export function readEodTable(bytes: Uint8Array, index: Uint8Array, table: keyof typeof EOD_LAYOUTS): EodRecord[] {
  return readIndexedEodRecords(bytes, index, EOD_LAYOUTS[table], table);
}

/** Same indexed serialization is used by project tables and embedded symbol libraries. */
export function readIndexedEodRecords(bytes: Uint8Array, index: Uint8Array,
  layout: { size: number; typedIndex: boolean }, table: string): EodRecord[] {
  const count = bytes.length / layout.size;
  if (!Number.isInteger(count)) throw new Error(`Nicht unterstütztes ${table}.eod Datensatzformat.`);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const iv = new DataView(index.buffer, index.byteOffset, index.byteLength);
  const active = new Set<number>();
  for (let i = 3; i + 4 <= index.length; i++) {
    const row = iv.getUint32(i);
    if (row === 0 || row > count) continue;
    const start = (row - 1) * layout.size;
    const id = view.getUint32(start), type = view.getUint16(start + 4);
    if (layout.typedIndex
      ? index[i - 3] === (id & 255) && iv.getUint16(i - 2) === type
      : index[i - 1] === (id & 255)) active.add(row);
  }
  const result = new Map<string, EodRecord>();
  for (const row of active) {
    const start = (row - 1) * layout.size, id = view.getUint32(start), type = view.getUint16(start + 4);
    const slot = bytes.subarray(start, start + layout.size);
    for (let i = 6; i + 8 <= slot.length; i++) {
      let data: Uint8Array | undefined, partial = false;
      if (slot[i] === 0x61 && slot[i + 1] === 0xea) data = slot.subarray(i);
      else if (slot[i] === 0x78 && [0xda, 0x9c, 0x01].includes(slot[i + 1]) && i >= 9) {
        const sv = new DataView(slot.buffer, slot.byteOffset, slot.byteLength);
        const capacity = sv.getUint32(i - 8, true), length = sv.getUint32(i - 4, true);
        if (capacity > 16 * 1024 * 1024 || length > capacity || length < 6) continue;
        const chunks: Uint8Array[] = [];
        let size = 0, finished = false;
        try {
          const stream = new Unzlib((chunk, final) => {
            size += chunk.length;
            if (size > capacity) throw new Error('EDB Dekompressionslimit überschritten.');
            chunks.push(chunk); finished ||= final;
          });
          stream.push(slot.subarray(i, Math.min(slot.length - 5, i + length)), false);
          if (i + length <= slot.length - 5) stream.push(new Uint8Array(), true);
        } catch { /* A bounded prefix may still contain the complete placement. */ }
        if (!size) continue;
        data = new Uint8Array(size);
        let offset = 0;
        for (const chunk of chunks) { data.set(chunk, offset); offset += chunk.length; }
        partial = !finished;
      }
      if (!data || data.length < 8) continue;
      const dv = new DataView(data.buffer, data.byteOffset, data.byteLength);
      if (dv.getUint16(0, true) !== 0xea61 || dv.getUint16(2, true) !== type || dv.getUint32(4, true) !== id) continue;
      const record = new EodRecord(id, type, row, data, partial);
      // Reject false suffix candidates when a later indexed revision exists.
      const key = `${type}:${id}`, previous = result.get(key);
      if (!previous || previous.row < row) result.set(key, record);
      break;
    }
  }
  return [...result.values()];
}
