import { EodRecord, nativeText } from './EodReader';
import type { NativeLayerStyle } from './NativeLayers';
import { completePropertyPlacements } from './NativeSymbolLibrary';

export type NativePropertyLayout = {
  /** Local baseline in source millimetres, with Y pointing up. */
  point: { x: number; y: number };
  /** Font em size in physical millimetres. */
  fontSize: number;
  alignment: 'start' | 'middle' | 'end';
  rotation: 0 | 90 | 180 | 270;
};

const supported = new Set([20010, 20011, 20025, 20027, 20030]);
function content(instance: EodRecord, field: number): string | undefined {
  if (field === 20010) return instance.bmk;
  if (field === 20011) return nativeText(instance.string(field, 4) || instance.string(0xeb1a));
  if (supported.has(field)) return nativeText(instance.string(field, 4));
  // These empty intervening properties occur in the observed chained layouts.
  // Do not assume that an unknown field is empty.
  if ([20300, 20901, 20024].includes(field)) return nativeText(instance.string(field, 4));
  return;
}

/**
 * Resolve the verified horizontal, top-aligned automatic property chain.
 * EC56 contains the parent type/id and previous property-placement subobject.
 * Empty properties do not consume a line. Unfamiliar anchors, angles, cycles,
 * missing layer metrics and incomplete records leave the existing layout intact.
 *
 * The supplied instances do not store an identified arrangement selector. A
 * unique arrangement on complete instance overrides is explicit; otherwise use
 * the independently verified default arrangement 1. No page/symbol IDs decide it.
 * Other arrangements and BMK baseline conversion remain with the caller.
 */
export function nativePropertyLayouts(variantData: Uint8Array, instance: EodRecord,
  layers: ReadonlyMap<number, NativeLayerStyle>): Map<number, NativePropertyLayout> {
  const result = new Map<number, NativePropertyLayout>();
  const overrides = completePropertyPlacements(instance.data);
  const overrideArrangements = new Set(overrides.map(p => p.number(0xee18, 1)).filter((v): v is number => v !== undefined));
  const arrangement = overrideArrangements.size === 1 ? [...overrideArrangements][0] : 1;
  const chosen = completePropertyPlacements(variantData).filter(p => (p.number(0xee18, 1) ?? 1) === arrangement
    && (p.number(0xee19, 1) === undefined || p.number(0xee19, 1) === 2));
  const byId = new Map<number, EodRecord>();
  for (const p of chosen) {
    const id = p.number(0xea64);
    if (id === undefined || byId.has(id)) return result;
    byId.set(id, p);
  }
  type Node = { x: number; top: number; nextTop: number; alignment: NativePropertyLayout['alignment']; baseline: number };
  const memo = new Map<number, Node | null>(), visiting = new Set<number>();
  const resolve = (id: number): Node | undefined => {
    if (memo.has(id)) return memo.get(id) ?? undefined;
    if (visiting.has(id) || visiting.size >= 512) return;
    const p = byId.get(id);
    if (!p) return;
    visiting.add(id);
    const fail = (): undefined => { visiting.delete(id); memo.set(id, null); return; };
    const field = p.number(0xed63), text = field === undefined ? undefined : content(instance, field);
    const layer = layers.get(p.number(0xebfb) ?? -1);
    const nominal = p.double(0xee21) ?? layer?.fontSize;
    const angle = p.double(0xee22) ?? layer?.angle ?? 0;
    const anchor = p.number(0xee26, 1), align = p.number(0xec57);
    // EC57=4: explicit top anchor; EC57=6: below predecessor. The
    // corresponding EE26 values 1/2/3 are left/centre/right top alignment.
    if (text === undefined || nominal === undefined || !Number.isFinite(nominal) || nominal <= 0 || nominal >= 1000
      || (angle !== -16002 && Math.abs(angle) > 1e-8) || ![1, 2, 3].includes(anchor ?? -1)
      || ![4, 6].includes(align ?? -1)) return fail();
    const alignment: NativePropertyLayout['alignment'] = anchor === 3 ? 'end' : anchor === 2 ? 'middle' : 'start';
    let x: number, top: number;
    const point = p.point(0xec55);
    if (point && align === 4 && p.find(0xec56) < 0) { x = point.x; top = point.y; }
    else if (!point && align === 6) {
      const at = p.find(0xec56);
      if (at < 0) return fail();
      const view = new DataView(p.data.buffer, p.data.byteOffset + at + 2, 10);
      const parentType = view.getUint16(0, true), parentId = view.getUint32(2, true), previous = view.getUint32(6, true);
      // A chain may not escape to a different variant or arrangement.
      if (parentType !== p.number(0xea67) || parentId !== p.number(0xea67, 4, 4)) return fail();
      const predecessor = resolve(previous);
      if (!predecessor || predecessor.alignment !== alignment) return fail();
      x = predecessor.x; top = predecessor.nextTop;
    } else return fail();
    const lineFactor = (p.number(0xee17) ?? 15) / 10;
    if (lineFactor <= 0 || lineFactor > 10) return fail();
    // The nominal 1.8-mm text box converts to the same baseline as physical
    // pin labels (factor verified against the independent vector PDF).
    const baseline = top - nominal * 1.242 * 1.08014513;
    const node: Node = { x, top, nextTop: top - (text ? nominal * lineFactor * text.split(/\r?\n/).length : 0), alignment, baseline };
    visiting.delete(id); memo.set(id, node);
    return node;
  };
  for (const [id, p] of byId) {
    const field = p.number(0xed63);
    // Keep existing BMK rendering: its top-to-baseline metric is different,
    // and changing all BMKs is outside the verified supplemental-text scope.
    if (field === undefined || field === 20010 || !supported.has(field) || !content(instance, field)) continue;
    const node = resolve(id), nominal = p.double(0xee21) ?? layers.get(p.number(0xebfb) ?? -1)?.fontSize;
    if (node && nominal !== undefined) result.set(field, { point: { x: node.x, y: node.baseline },
      fontSize: nominal * 1.242, alignment: node.alignment, rotation: 0 });
  }
  return result;
}
