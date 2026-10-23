// src/model/LabelLayout.ts
// Calculates exact screen coordinates, anchors, rotations, and styles for component labels

import { PlacedComponent, TextFormatConfig, SymbolDefinition, Project } from './types';
import { getSymbolById } from './symbols';
import { interruptionLabelPosition, interruptionReferencePosition, isInterruptionSymbol } from './ConnectionSymbols';
import { rotatedLocalPoint } from './SymbolGeometry';

export interface CalculatedLabelPosition {
  x: number;
  y: number;
  anchor: 'start' | 'middle' | 'end';
  rotation: number;
  fontSize: number;
  fontColor?: string;
  fontWeight?: 'normal' | 'bold';
  visible: boolean;
  transform: string;
}

type LabelKey = 'bmkPosition' | 'functionTextPosition' | 'technicalDataPosition' | 'additionalTextPosition' | 'crossRefPosition';
const automatic = (cfg?: TextFormatConfig) => !cfg?.preset || cfg.preset === 'auto';

/** A readable, right-aligned block on the world-left of the rotated symbol.
 * Only automatic, visible, populated labels consume lines in this block. */
function automaticLeftPosition(comp: PlacedComponent, sym: SymbolDefinition, key: LabelKey): CalculatedLabelPosition {
  const data: [LabelKey, string, number][] = [
    ['bmkPosition', comp.bmk ?? '', 10], ['functionTextPosition', comp.functionText ?? '', 8],
    ['technicalDataPosition', [comp.deviceTag, comp.technicalCharacteristics].filter(Boolean).join(' · '), 8],
    ['additionalTextPosition', comp.additionalText ?? '', 8], ['crossRefPosition', comp.crossRef ?? '', comp.crossRefFontSize ?? 8]
  ];
  const rows = data.filter(([id, text]) => id === key || automatic(comp[id]) && comp[id]?.visible !== false && !!text);
  const height = ([id, text, size]: typeof data[number]) => Math.max(1, text.split(/\r?\n/).length)
    * (id === 'crossRefPosition' ? comp.crossRefFontSize ?? comp[id]?.fontSize ?? size : comp[id]?.fontSize ?? size) * 1.4;
  const total = rows.reduce((sum, row) => sum + height(row), 0);
  let y = sym.height / 2 - total / 2;
  for (const row of rows) {
    if (row[0] !== key) { y += height(row); continue; }
    const cfg = comp[key], size = key === 'crossRefPosition' ? comp.crossRefFontSize ?? cfg?.fontSize ?? row[2] : cfg?.fontSize ?? row[2];
    y += size;
    const rotatedWidth = comp.rotation % 180 ? sym.height : sym.width;
    const local = rotatedLocalPoint({ x: sym.width / 2 - rotatedWidth / 2 - 4 * (sym.unitsPerMm ?? 2), y }, sym, -comp.rotation);
    const x = local.x + (cfg?.offsetX ?? 0), py = local.y + (cfg?.offsetY ?? 0), rotation = cfg?.rotation ?? 0;
    return { x, y: py, anchor: cfg?.alignment ?? 'end', rotation, fontSize: size,
      visible: cfg?.visible ?? (key === 'technicalDataPosition' ? !!row[1] : true),
      transform: labelTransform(x, py, comp.rotation, rotation), fontColor: cfg?.fontColor, fontWeight: cfg?.fontWeight };
  }
  throw new Error('Beschriftungsposition fehlt.');
}

export function computeBmkPosition(comp: PlacedComponent, sym: SymbolDefinition): CalculatedLabelPosition {
  const cfg = comp.bmkPosition;
  if (automatic(cfg)) return automaticLeftPosition(comp, sym, 'bmkPosition');
  const preset = cfg?.preset || 'top';
  let x = sym.width / 2;
  let y = -8;
  let anchor: 'start' | 'middle' | 'end' = 'middle';

  switch (preset) {
    case 'top':
      x = sym.width / 2;
      y = -8;
      anchor = 'middle';
      break;
    case 'top_left':
      x = 0;
      y = -8;
      anchor = 'start';
      break;
    case 'top_right':
      x = sym.width;
      y = -8;
      anchor = 'end';
      break;
    case 'bottom':
      x = sym.width / 2;
      y = sym.height + 26;
      anchor = 'middle';
      break;
    case 'bottom_left':
      x = 0;
      y = sym.height + 26;
      anchor = 'start';
      break;
    case 'bottom_right':
      x = sym.width;
      y = sym.height + 26;
      anchor = 'end';
      break;
    case 'left':
      x = -8;
      y = sym.height / 2;
      anchor = 'end';
      break;
    case 'right':
      x = sym.width + 8;
      y = sym.height / 2;
      anchor = 'start';
      break;
    case 'custom':
    default:
      x = sym.width / 2;
      y = -8;
      anchor = 'middle';
      break;
  }

  x += (cfg?.offsetX || 0);
  y += (cfg?.offsetY || 0);

  if (cfg?.alignment) {
    anchor = cfg.alignment;
  }

  const rotation = cfg?.rotation || 0;
  const fontSize = cfg?.fontSize || 10;
  const visible = cfg?.visible !== false;
  const transform = labelTransform(x, y, comp.rotation, rotation);

  return { x, y, anchor, rotation, fontSize, visible, transform, ...(cfg?.fontColor ? { fontColor: cfg.fontColor } : {}), ...(cfg?.fontWeight ? { fontWeight: cfg.fontWeight } : {}) };
}

export function computeFunctionTextPosition(comp: PlacedComponent, sym: SymbolDefinition): CalculatedLabelPosition {
  const cfg = comp.functionTextPosition;
  if (automatic(cfg)) return automaticLeftPosition(comp, sym, 'functionTextPosition');
  const preset = cfg?.preset || 'bottom';
  let x = sym.width / 2;
  let y = sym.height + 12;
  let anchor: 'start' | 'middle' | 'end' = 'middle';

  switch (preset) {
    case 'bottom':
      x = sym.width / 2;
      y = sym.height + 12;
      anchor = 'middle';
      break;
    case 'bottom_left':
      x = 0;
      y = sym.height + 12;
      anchor = 'start';
      break;
    case 'bottom_right':
      x = sym.width;
      y = sym.height + 12;
      anchor = 'end';
      break;
    case 'top':
      x = sym.width / 2;
      y = -20;
      anchor = 'middle';
      break;
    case 'top_left':
      x = 0;
      y = -20;
      anchor = 'start';
      break;
    case 'top_right':
      x = sym.width;
      y = -20;
      anchor = 'end';
      break;
    case 'left':
      x = -8;
      y = sym.height / 2 + 12;
      anchor = 'end';
      break;
    case 'right':
      x = sym.width + 8;
      y = sym.height / 2 + 12;
      anchor = 'start';
      break;
    case 'custom':
    default:
      x = sym.width / 2;
      y = sym.height + 12;
      anchor = 'middle';
      break;
  }

  x += (cfg?.offsetX || 0);
  y += (cfg?.offsetY || 0);

  if (cfg?.alignment) {
    anchor = cfg.alignment;
  }

  const rotation = cfg?.rotation || 0;
  const fontSize = cfg?.fontSize || 8;
  const visible = cfg?.visible !== false;
  const transform = labelTransform(x, y, comp.rotation, rotation);

  return { x, y, anchor, rotation, fontSize, visible, transform, ...(cfg?.fontColor ? { fontColor: cfg.fontColor } : {}), ...(cfg?.fontWeight ? { fontWeight: cfg.fontWeight } : {}) };
}

export function computeTechnicalDataPosition(comp: PlacedComponent, sym: SymbolDefinition): CalculatedLabelPosition {
  const cfg = comp.technicalDataPosition;
  if (automatic(cfg)) return automaticLeftPosition(comp, sym, 'technicalDataPosition');
  const preset = cfg?.preset || 'bottom';
  let x = sym.width / 2;
  let y = sym.height + 22;
  let anchor: 'start' | 'middle' | 'end' = 'middle';

  switch (preset) {
    case 'bottom':
      x = sym.width / 2;
      y = sym.height + 22;
      anchor = 'middle';
      break;
    case 'bottom_left':
      x = 0;
      y = sym.height + 22;
      anchor = 'start';
      break;
    case 'bottom_right':
      x = sym.width;
      y = sym.height + 22;
      anchor = 'end';
      break;
    case 'top':
      x = sym.width / 2;
      y = -32;
      anchor = 'middle';
      break;
    case 'top_left':
      x = 0;
      y = -32;
      anchor = 'start';
      break;
    case 'top_right':
      x = sym.width;
      y = -32;
      anchor = 'end';
      break;
    case 'left':
      x = -8;
      y = sym.height / 2 + 22;
      anchor = 'end';
      break;
    case 'right':
      x = sym.width + 8;
      y = sym.height / 2 + 22;
      anchor = 'start';
      break;
    case 'custom':
    default:
      x = sym.width / 2;
      y = sym.height + 22;
      anchor = 'middle';
      break;
  }

  x += (cfg?.offsetX || 0);
  y += (cfg?.offsetY || 0);

  if (cfg?.alignment) {
    anchor = cfg.alignment;
  }

  const rotation = cfg?.rotation || 0;
  const fontSize = cfg?.fontSize || 8;
  const visible = cfg?.visible !== undefined ? cfg.visible : !!(comp.deviceTag || comp.technicalCharacteristics);
  const transform = labelTransform(x, y, comp.rotation, rotation);

  return { x, y, anchor, rotation, fontSize, visible, transform, ...(cfg?.fontColor ? { fontColor: cfg.fontColor } : {}), ...(cfg?.fontWeight ? { fontWeight: cfg.fontWeight } : {}) };
}

/** Keep the automatic interruption layout unless an instance overrides it. */
export function computeCrossReferencePosition(comp: PlacedComponent, sym: SymbolDefinition, project: Project): CalculatedLabelPosition {
  const cfg = comp.crossRefPosition;
  if (automatic(cfg) && !isInterruptionSymbol(sym)) return automaticLeftPosition(comp, sym, 'crossRefPosition');
  const arrow = interruptionReferencePosition(project, comp, sym) ?? interruptionLabelPosition(project, comp, sym);
  const hasTech = computeTechnicalDataPosition(comp, sym).visible && !!(comp.deviceTag || comp.technicalCharacteristics);
  const extra = comp.additionalText && computeAdditionalTextPosition(comp,sym);
  const bottom = Math.max(sym.height + (hasTech ? 38 : 24), extra && extra.visible ? extra.y + extra.fontSize * 1.7 : 0);
  let x = arrow?.referenceX ?? sym.width / 2;
  let y = arrow?.referenceY ?? bottom;
  let anchor: CalculatedLabelPosition['anchor'] = arrow?.anchor ?? 'middle';
  switch (cfg?.preset) {
    case 'top': x = sym.width / 2; y = -20; anchor = 'middle'; break;
    case 'top_left': x = 0; y = -20; anchor = 'start'; break;
    case 'top_right': x = sym.width; y = -20; anchor = 'end'; break;
    case 'bottom': x = sym.width / 2; y = bottom; anchor = 'middle'; break;
    case 'bottom_left': x = 0; y = bottom; anchor = 'start'; break;
    case 'bottom_right': x = sym.width; y = bottom; anchor = 'end'; break;
    case 'left': x = -8; y = sym.height / 2; anchor = 'end'; break;
    case 'right': x = sym.width + 8; y = sym.height / 2; anchor = 'start'; break;
  }
  x += cfg?.offsetX ?? 0;
  y += cfg?.offsetY ?? 0;
  anchor = cfg?.alignment ?? anchor;
  const rotation = cfg?.rotation ?? 0;
  return { x, y, anchor, rotation, visible: cfg?.visible !== false,
    fontSize: comp.crossRefFontSize ?? cfg?.fontSize ?? 8, transform: labelTransform(x, y, comp.rotation, rotation) };
}

/** Counter-rotate text about its own anchor; the component still moves the anchor. */
export function labelTransform(x: number, y: number, componentRotation = 0, textRotation = 0): string {
  const angle = textRotation - componentRotation;
  return angle ? `transform="rotate(${angle}, ${x}, ${y})"` : '';
}

/** Text entered by the user reveals an inherited hidden import label, while an
 * explicit visibility choice always remains in force. */
export function setComponentLabelText(comp: PlacedComponent,
  property: 'functionText' | 'additionalText' | 'deviceTag' | 'technicalCharacteristics', value: string): boolean {
  if (comp[property] === value) return false;
  comp[property] = value;
  const key = property === 'functionText' ? 'functionTextPosition' : property === 'additionalText' ? 'additionalTextPosition' : 'technicalDataPosition';
  if (value.trim() && comp.source && comp[key]?.visible === false && !comp[key]?.visibilityExplicit)
    comp[key] = { ...comp[key], visible: true };
  return true;
}

/** Zusatztext has its own editable layout, below the other populated labels. */
export function computeAdditionalTextPosition(comp: PlacedComponent, sym: SymbolDefinition): CalculatedLabelPosition {
  const cfg = comp.additionalTextPosition;
  if (automatic(cfg)) return automaticLeftPosition(comp, sym, 'additionalTextPosition');
  const pos = computeTechnicalDataPosition({ ...comp, technicalDataPosition: cfg }, sym);
  if (cfg?.preset === 'custom') {
    pos.y = sym.height + 34 + (cfg.offsetY || 0);
    pos.transform = labelTransform(pos.x, pos.y, comp.rotation, pos.rotation);
  } else if (!cfg?.preset || cfg.preset === 'bottom' || cfg.preset === 'bottom_left' || cfg.preset === 'bottom_right') {
    const lines = Math.max(1, (comp.functionText || '').split('\n').length);
    const fn = computeFunctionTextPosition(comp, sym), tech = computeTechnicalDataPosition(comp, sym);
    const lowest = Math.max(sym.height + 12,
      comp.functionText && fn.visible ? fn.y + (lines - 1) * fn.fontSize * 1.2 : 0,
      (comp.deviceTag || comp.technicalCharacteristics) && tech.visible ? tech.y + Math.max(0, ((comp.deviceTag || '').split('\n').length - 1)) * tech.fontSize * 1.2 : 0);
    pos.y = lowest + pos.fontSize * 1.4 + (cfg?.offsetY || 0);
    pos.transform = labelTransform(pos.x, pos.y, comp.rotation, pos.rotation);
  }
  pos.visible = cfg?.visible !== false;
  return pos;
}

/** Upgrade inherited hidden defaults and legacy left-side alignments in already saved imported projects once.
 * New user visibility choices are persisted and are never changed here. */
export function revealImportedComponentLabels(project: Project): void {
  const projectSymbols = new Map(
    (project.symbolLibrary ?? []).map(s => [s.id, s])
  );
  for (const page of project.pages) for (const comp of page.components) {
    if (!comp.source) continue;
    for (const [property, hasText] of [
      ['functionTextPosition', !!comp.functionText?.trim()],
      ['additionalTextPosition', !!comp.additionalText?.trim()],
      ['technicalDataPosition', !!(comp.deviceTag?.trim() || comp.technicalCharacteristics?.trim())],
    ] as const) {
      if (hasText && comp[property]?.visible === false && !comp[property]?.visibilityExplicit)
        comp[property] = { ...comp[property], visible: true };
    }
    const sym = projectSymbols.get(comp.symbolId) ?? getSymbolById(comp.symbolId);
    if (sym && !comp.deviceBox && !sym.deviceBox) {
      for (const key of ['bmkPosition', 'functionTextPosition', 'technicalDataPosition', 'additionalTextPosition'] as const) {
        const cfg = comp[key];
        if (cfg?.preset === 'custom' && cfg.alignment === 'start' && sym.width / 2 + (cfg.offsetX ?? 0) <= 0) {
          comp[key] = { ...cfg, alignment: 'end' };
        }
      }
    }
  }
}
