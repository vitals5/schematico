import type { PinDefinition } from '../model/types';
import { EodRecord } from './EodReader';
import type { NativeLayerStyle } from './NativeLayers';
import { completePropertyPlacements } from './NativeSymbolLibrary';

const SCALE = 1000 / 420;
type PinLabel = NonNullable<PinDefinition['labelPosition']>;
/**
 * Verified native Function overrides for a single connection designation:
 * property 20036, horizontal EE26=8 (bottom-centre), relative to the symbol
 * insertion point. Property 20039 belongs to another string and is not a pin
 * designation. Unresolved arrangements/formats leave the library layout intact.
 *
 * Returned coordinates are insertion-relative, Y-down editor units. The caller
 * adds the normalized library insertion offset before storing an instance pin
 * override; neither the shared definition nor its physical pin is changed.
 */
export function nativePinLabelOverrides(instance: EodRecord, pins: readonly PinDefinition[],
  layers: ReadonlyMap<number, NativeLayerStyle>): Map<string, PinLabel> {
  const result = new Map<string, PinLabel>();
  if (instance.type !== 0x11 || pins.length !== 1 || !instance.pins[0]?.trim()) return result;
  const candidates = completePropertyPlacements(instance.data).filter(p => p.number(0xea67) === instance.type
    && p.number(0xea67, 4, 4) === instance.id && p.number(0xed63) === 20036);
  // No instance arrangement selector has been identified. Multiple alternative
  // overrides must not be resolved by whichever happens to occur first.
  if (candidates.length !== 1) return result;
  const p = candidates[0], point = p.point(0xec55), layer = layers.get(p.number(0xebfb) ?? -1);
  if (!point || p.find(0xec56) >= 0 || p.find(0xec57) >= 0 || p.find(0xed64) >= 0
    || p.number(0xee26, 1) !== 8 || (p.number(0xee19, 1) !== undefined && p.number(0xee19, 1) !== 2)) return result;
  const explicitSize = p.double(0xee21), explicitAngle = p.double(0xee22);
  if ((p.find(0xee21) >= 0 && explicitSize === undefined) || (p.find(0xee22) >= 0 && explicitAngle === undefined)) return result;
  const nominal = explicitSize ?? layer?.fontSize;
  const angle = explicitAngle === -16002 ? layer?.angle ?? 0 : explicitAngle ?? layer?.angle ?? 0;
  if (nominal === undefined || !Number.isFinite(nominal) || nominal <= 0 || nominal >= 1000 || !Number.isFinite(angle) || Math.abs(angle) > 1e-8) return result;
  // The independent PDF uses 6.33713-pt Tahoma for the source's nominal 1.8 mm.
  // Its bottom-centred baseline matches the existing source pin-label metric.
  const fontSize = nominal * 1.242 * SCALE;
  result.set(pins[0].id, { x: point.x * SCALE, y: -point.y * SCALE - fontSize * 0.12753948,
    fontSize, alignment: 'middle', rotation: 0,
    ...(layer?.visible !== undefined ? { visible: layer.visible } : {}) });
  return result;
}
