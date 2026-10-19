// src/model/Clipboard.ts
import type { CableDefinition, ElementGroup, Page, PageBox, PageImage, PageText, PlacedComponent, Project, SymbolDefinition, Wire } from './types';
import { normalizeSelection, selectionCount, selectionBounds, type ElementSelection, type Bounds } from './ElementSelection';
import { expandGroupedSelection, remapElementGroups } from './ElementGroups';
import { mergeProjectSymbolLibrary } from './symbols';
import { scalePlacedComponent } from './SymbolGeometry';

export interface ClipboardPayload {
  version: 1;
  unitsPerMm?: number;
  components: PlacedComponent[];
  wires: Wire[];
  cables?: CableDefinition[];
  boxes?: PageBox[];
  images?: PageImage[];
  texts?: PageText[];
  groups?: ElementGroup[];
  symbolLibrary?: SymbolDefinition[];
  bounds?: Bounds;
  sourcePageId?: string;
  isCut?: boolean;
}

export interface PasteResult {
  pastedSelection: ElementSelection;
  components: PlacedComponent[];
  wires: Wire[];
  cables: CableDefinition[];
  boxes: PageBox[];
  images: PageImage[];
  texts: PageText[];
  groups: ElementGroup[];
}

let memoryClipboard: ClipboardPayload | null = null;
let pasteCounter = 1;

export function getClipboard(): ClipboardPayload | null {
  return memoryClipboard;
}

export function setClipboard(payload: ClipboardPayload | null): void {
  memoryClipboard = payload;
  pasteCounter = 1;
}

export function hasClipboard(): boolean {
  return memoryClipboard !== null && (
    memoryClipboard.components.length > 0 ||
    (memoryClipboard.cables?.length ?? 0) > 0 ||
    (memoryClipboard.boxes?.length ?? 0) > 0 ||
    (memoryClipboard.images?.length ?? 0) > 0 ||
    (memoryClipboard.texts?.length ?? 0) > 0 ||
    memoryClipboard.wires.length > 0
  );
}

export function clearClipboard(): void {
  memoryClipboard = null;
  pasteCounter = 1;
}

export function getPasteCounter(): number {
  return pasteCounter;
}

export function incrementPasteCounter(): void {
  pasteCounter++;
}

export function resetPasteCounter(): void {
  pasteCounter = 1;
}

/** Compute new BMKs for copied components and boxes avoiding conflicts with the project. */
export function computeBmkMap(items: { bmk?: string }[], project: Project): Map<string, string> {
  const bmkMap = new Map<string, string>();
  const allProjectBmks = project.pages.flatMap(p => [
    ...p.components.map(c => c.bmk),
    ...(p.boxes ?? []).map(b => b.bmk ?? '')
  ]);

  for (const item of items) {
    if (!item.bmk) continue;
    if (bmkMap.has(item.bmk)) continue;

    // Check for terminal strip format: e.g. -X1:1 or =A1+O1-X1:1
    const termMatch = item.bmk.match(/^(=[^+]+)?(\+[^-]+)?(-[A-Za-z]+)(\d+)(:.+)$/);
    if (termMatch) {
      const loc = (termMatch[1] || '') + (termMatch[2] || '');
      const prefix = termMatch[3]; // e.g. -X
      const stripNum = termMatch[4]; // e.g. 1
      const stripKey = `${loc}${prefix}${stripNum}`;
      let newStrip = bmkMap.get(stripKey);
      if (!newStrip) {
        let maxIndex = 0;
        for (const b of allProjectBmks) {
          const m = b.match(/^(=[^+]+)?(\+[^-]+)?(-[A-Za-z]+)(\d+)/);
          if (m && m[3] === prefix) {
            const num = parseInt(m[4], 10);
            if (!isNaN(num) && num > maxIndex) maxIndex = num;
          }
        }
        for (const val of bmkMap.values()) {
          const m = val.match(/^(=[^+]+)?(\+[^-]+)?(-[A-Za-z]+)(\d+)/);
          if (m && m[3] === prefix) {
            const num = parseInt(m[4], 10);
            if (!isNaN(num) && num > maxIndex) maxIndex = num;
          }
        }
        newStrip = `${loc}${prefix}${maxIndex + 1}`;
        bmkMap.set(stripKey, newStrip);
      }
      bmkMap.set(item.bmk, `${newStrip}${termMatch[5]}`);
      continue;
    }

    // Standard device: e.g. -K1, =A1+O1-K1, -Q1
    const match = item.bmk.match(/^(=[^+]+)?(\+[^-]+)?(-[A-Za-z]+)(\d+)?(.*)$/);
    if (match && match[3]) {
      const loc = (match[1] || '') + (match[2] || '');
      const prefix = match[3];
      const suffix = match[5] ?? '';
      let maxIndex = 0;
      for (const b of allProjectBmks) {
        const m = b.match(/^(=[^+]+)?(\+[^-]+)?(-[A-Za-z]+)(\d+)/);
        if (m && m[3] === prefix) {
          const num = parseInt(m[4], 10);
          if (!isNaN(num) && num > maxIndex) maxIndex = num;
        }
      }
      for (const val of bmkMap.values()) {
        const m = val.match(/^(=[^+]+)?(\+[^-]+)?(-[A-Za-z]+)(\d+)/);
        if (m && m[3] === prefix) {
          const num = parseInt(m[4], 10);
          if (!isNaN(num) && num > maxIndex) maxIndex = num;
        }
      }
      bmkMap.set(item.bmk, `${loc}${prefix}${maxIndex + 1}${suffix}`);
    } else {
      const basePrefix = item.bmk.replace(/\d+.*$/, '') || '-K';
      let maxIndex = 0;
      for (const b of allProjectBmks) {
        if (b.startsWith(basePrefix)) {
          const num = parseInt(b.slice(basePrefix.length), 10);
          if (!isNaN(num) && num > maxIndex) maxIndex = num;
        }
      }
      for (const val of bmkMap.values()) {
        if (val.startsWith(basePrefix)) {
          const num = parseInt(val.slice(basePrefix.length), 10);
          if (!isNaN(num) && num > maxIndex) maxIndex = num;
        }
      }
      bmkMap.set(item.bmk, `${basePrefix}${maxIndex + 1}`);
    }
  }

  return bmkMap;
}

/** Compute new BMKs for copied cables avoiding collisions. */
export function computeCableBmkMap(cables: CableDefinition[], project: Project): Map<string, string> {
  const map = new Map<string, string>();
  const used = new Set(project.pages.flatMap(p => p.cables ?? []).map(c => c.bmk));
  for (const c of cables) {
    if (!c.bmk) continue;
    if (map.has(c.bmk)) continue;
    let n = 1;
    while (used.has('-W' + n)) n++;
    const newBmk = '-W' + n;
    used.add(newBmk);
    map.set(c.bmk, newBmk);
  }
  return map;
}

/** Creates a clipboard payload from the current selection on the page. */
export function copySelection(
  page: Page,
  project: Project,
  selection: ElementSelection
): ClipboardPayload | null {
  const normalized = expandGroupedSelection(page, normalizeSelection(page, selection));
  if (selectionCount(normalized) === 0) return null;

  const componentIdSet = new Set(normalized.componentIds);
  const cableIdSet = new Set(normalized.cableIds);
  const boxIdSet = new Set(normalized.boxIds ?? []);
  const imageIdSet = new Set(normalized.imageIds ?? []);
  const textIdSet = new Set(normalized.textIds ?? []);

  // 1. Components
  const components = page.components
    .filter(c => componentIdSet.has(c.id))
    .map(c => structuredClone(c));

  // 2. Internal wires where both endpoints belong to the copied components
  const wires = page.wires
    .filter(w => componentIdSet.has(w.from.componentId) && componentIdSet.has(w.to.componentId))
    .map(w => structuredClone(w));

  // 3. Cables
  const cables = (page.cables ?? [])
    .filter(c => cableIdSet.has(c.id))
    .map(c => structuredClone(c));

  // 4. Boxes
  const boxes = (page.boxes ?? [])
    .filter(b => boxIdSet.has(b.id))
    .map(b => structuredClone(b));

  // 5. Images
  const images = (page.images ?? [])
    .filter(i => imageIdSet.has(i.id))
    .map(i => structuredClone(i));

  // 6. Texts
  const texts = (page.texts ?? [])
    .filter(t => textIdSet.has(t.id))
    .map(t => structuredClone(t));

  // 7. Groups containing members from this selection
  const allCopiedMemberKeys = new Set([
    ...components.map(c => `component:${c.id}`),
    ...cables.map(c => `cable:${c.id}`),
    ...boxes.map(b => `box:${b.id}`),
    ...images.map(i => `image:${i.id}`),
    ...texts.map(t => `text:${t.id}`),
    ...wires.map(w => `wire:${w.id}`)
  ]);
  const relevantGroups = (page.groups ?? []).filter(g =>
    g.members.filter(m => m.kind === 'group' || allCopiedMemberKeys.has(`${m.kind}:${m.id}`)).length >= 2
  );

  // 8. Needed symbol definitions
  const usedSymbolIds = new Set(components.map(c => c.symbolId));
  const symbolLibrary = (project.symbolLibrary ?? [])
    .filter(s => usedSymbolIds.has(s.id))
    .map(s => structuredClone(s));

  // 9. Bounds
  const bounds = selectionBounds(page, project, normalized);

  return {
    version: 1,
    unitsPerMm: project.drawingUnitsPerMm,
    components,
    wires,
    cables,
    boxes,
    images,
    texts,
    groups: relevantGroups.map(g => structuredClone(g)),
    symbolLibrary,
    bounds,
    sourcePageId: page.id
  };
}

/** Pastes a clipboard payload onto a page, remapping IDs, BMKs, wires and groups. */
export function pasteClipboard(
  page: Page,
  project: Project,
  payload: ClipboardPayload,
  offset?: { dx?: number; dy?: number }
): PasteResult {
  const dx = offset?.dx ?? 0;
  const dy = offset?.dy ?? 0;
  const factor = (payload.unitsPerMm && project.drawingUnitsPerMm)
    ? project.drawingUnitsPerMm / payload.unitsPerMm
    : 1;

  // 1. Calculate BMK mapping for components and boxes
  const bmkMap = computeBmkMap([...payload.components, ...(payload.boxes ?? [])], project);

  // 2. ID mappings
  const compIdMap = new Map<string, string>();
  const wireIdMap = new Map<string, string>();
  const cableIdMap = new Map<string, string>();
  const boxIdMap = new Map<string, string>();
  const imageIdMap = new Map<string, string>();
  const textIdMap = new Map<string, string>();

  // 3. Clone components
  const newComponents: PlacedComponent[] = payload.components.map(c => {
    const newId = 'comp_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now().toString(36);
    compIdMap.set(c.id, newId);
    const assignedBmk = bmkMap.get(c.bmk) || c.bmk;
    const scaled = factor !== 1 ? scalePlacedComponent(c, factor) : structuredClone(c);
    delete scaled.source;

    return {
      ...scaled,
      id: newId,
      bmk: assignedBmk,
      x: scaled.x * factor + dx,
      y: scaled.y * factor + dy
    };
  });

  // 4. Clone wires
  const newWires: Wire[] = [];
  for (const w of payload.wires) {
    const fromId = compIdMap.get(w.from.componentId);
    const toId = compIdMap.get(w.to.componentId);
    if (fromId && toId) {
      const newWireId = 'w_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now().toString(36);
      wireIdMap.set(w.id, newWireId);
      newWires.push({
        ...structuredClone(w),
        id: newWireId,
        from: { ...w.from, componentId: fromId },
        to: { ...w.to, componentId: toId },
        ...(w.waypoints ? {
          waypoints: w.waypoints.map(p => ({ x: p.x * factor + dx, y: p.y * factor + dy }))
        } : {}),
        ...(w.lineWidth !== undefined ? { lineWidth: w.lineWidth * factor } : {})
      });
    }
  }

  // Remap wireIds on new components' pins
  for (const c of newComponents) {
    for (const pin of Object.values(c.pins)) {
      if (pin.wireIds) {
        pin.wireIds = pin.wireIds
          .map(oldId => wireIdMap.get(oldId))
          .filter((id): id is string => !!id);
      }
    }
  }

  // 5. Merge symbol definitions into project symbol library
  if (payload.symbolLibrary?.length) {
    mergeProjectSymbolLibrary(project, payload.symbolLibrary, newComponents);
  }

  // 6. Clone cables
  const cableBmkMap = computeCableBmkMap(payload.cables ?? [], project);
  const newCables: CableDefinition[] = (payload.cables ?? []).map(original => {
    const cable = structuredClone(original);
    const newId = 'cable_' + crypto.randomUUID();
    cableIdMap.set(original.id, newId);
    delete cable.source;
    cable.id = newId;
    if (cableBmkMap.has(cable.bmk)) cable.bmk = cableBmkMap.get(cable.bmk)!;
    cable.start = { x: cable.start.x * factor + dx, y: cable.start.y * factor + dy };
    cable.end = { x: cable.end.x * factor + dx, y: cable.end.y * factor + dy };
    if (factor !== 1) {
      for (const key of ['fontSize', 'bmkFontSize', 'coreFontSize'] as const) {
        if (cable[key] !== undefined) cable[key]! *= factor;
      }
      if (cable.labelOffset) cable.labelOffset = { x: cable.labelOffset.x * factor, y: cable.labelOffset.y * factor };
    }
    cable.cores = cable.cores.map(core => ({
      ...core,
      id: 'core_' + crypto.randomUUID(),
      wireIds: core.wireIds?.map(id => wireIdMap.get(id)).filter((id): id is string => !!id)
    }));
    return cable;
  });

  // 7. Clone boxes
  const newBoxes: PageBox[] = (payload.boxes ?? []).map(original => {
    const box = structuredClone(original);
    const newId = 'box_' + crypto.randomUUID();
    boxIdMap.set(original.id, newId);
    box.id = newId;
    box.x = box.x * factor + dx;
    box.y = box.y * factor + dy;
    if (factor !== 1) {
      box.width *= factor;
      box.height *= factor;
      if (box.fontSize !== undefined) box.fontSize *= factor;
      if (box.lineWidth !== undefined) box.lineWidth *= factor;
    }
    if (box.bmk && bmkMap.has(box.bmk)) {
      box.bmk = bmkMap.get(box.bmk)!;
    }
    return box;
  });

  // 8. Clone images
  const newImages: PageImage[] = (payload.images ?? []).map(original => {
    const image = structuredClone(original);
    const newId = 'image_' + crypto.randomUUID();
    imageIdMap.set(original.id, newId);
    image.id = newId;
    image.x = image.x * factor + dx;
    image.y = image.y * factor + dy;
    if (factor !== 1) {
      image.width *= factor;
      image.height *= factor;
    }
    return image;
  });

  // 9. Clone texts
  const newTexts: PageText[] = (payload.texts ?? []).map(original => {
    const text = structuredClone(original);
    const newId = 'text_' + crypto.randomUUID();
    textIdMap.set(original.id, newId);
    text.id = newId;
    text.x = text.x * factor + dx;
    text.y = text.y * factor + dy;
    if (factor !== 1 && text.fontSize !== undefined) {
      text.fontSize *= factor;
    }
    return text;
  });

  // 10. Clone groups
  const newGroups = remapElementGroups(payload.groups, {
    component: compIdMap,
    wire: wireIdMap,
    cable: cableIdMap,
    box: boxIdMap,
    image: imageIdMap,
    text: textIdMap
  });

  // 11. Add everything to page
  page.components.push(...newComponents);
  page.wires.push(...newWires);
  if (newCables.length) (page.cables ??= []).push(...newCables);
  if (newBoxes.length) (page.boxes ??= []).push(...newBoxes);
  if (newImages.length) (page.images ??= []).push(...newImages);
  if (newTexts.length) (page.texts ??= []).push(...newTexts);
  if (newGroups.length) (page.groups ??= []).push(...newGroups);

  const pastedSelection: ElementSelection = {
    componentIds: newComponents.map(c => c.id),
    cableIds: newCables.map(c => c.id),
    ...(newBoxes.length ? { boxIds: newBoxes.map(b => b.id) } : {}),
    ...(newImages.length ? { imageIds: newImages.map(i => i.id) } : {}),
    ...(newTexts.length ? { textIds: newTexts.map(t => t.id) } : {}),
    ...(newWires.length ? { wireIds: newWires.map(w => w.id) } : {})
  };

  return {
    pastedSelection,
    components: newComponents,
    wires: newWires,
    cables: newCables,
    boxes: newBoxes,
    images: newImages,
    texts: newTexts,
    groups: newGroups
  };
}
