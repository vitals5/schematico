// src/ai/mcp-tools/handlers.ts
// Handlers for Schematico MCP Tools that inspect and mutate canvas and project state

import {
  Project,
  Page,
  PlacedComponent,
  Wire,
  SymbolDefinition,
  CableDefinition,
  PageText,
  PageBox,
  WallSegment,
  WallOpening,
  PageType
} from '../../model/types';
import { getSymbolDefinitions, getSymbolById, getSymbolForComponent } from '../../model/symbols';
import { nextDeviceTag } from '../../model/DeviceTag';
import { AutoconnectEngine, RotatedPinInfo } from '../../model/AutoconnectEngine';
import { CrossReferenceEngine } from '../../model/CrossReferenceEngine';
import { PartsListGenerator } from '../../reports/PartsList';
import { TerminalDiagramGenerator } from '../../reports/TerminalDiagram';
import { MacroManager, WindowMacro } from '../../model/MacroManager';
import type { CadCanvas } from '../../editor/CadCanvas';

export interface CanvasStateManager {
  getProject(): Project;
  getActivePage(pageId?: string): Page;
  getCanvas?(): CadCanvas | undefined;
  switchPage?(pageId: string): void;
  deletePage?(pageId: string): void;
  notifyModified(): void;
  render(): void;
}

/** Synonym and keyword dictionary for smart symbol resolution */
const SYMBOL_SYNONYMS: Record<string, string> = {
  // Resistors
  resistor: 'resistor',
  widerstand: 'resistor',

  // Power Supplies & Sources
  power_supply: 'power_supply_dc',
  'power supply': 'power_supply_dc',
  netzteil: 'power_supply_dc',
  schaltnetzteil: 'power_supply_dc',
  stromversorgung: 'power_supply_dc',
  trafo: 'transformer_1p',
  transformer: 'transformer_1p',
  transformator: 'transformer_1p',
  inverter: 'power_inverter',
  wechselrichter: 'power_inverter',

  // Relays and Contactors
  relay: 'contactor_coil',
  relais: 'contactor_coil',
  contactor: 'contactor_coil',
  schütz: 'contactor_coil',
  schuetz: 'contactor_coil',
  schützspule: 'contactor_coil',
  coil: 'contactor_coil',
  spule: 'contactor_coil',
  contactor_3p: 'contactor_power_3p',
  leistungsschütz: 'contactor_power_3p',

  // Contacts
  switch: 'contact_no',
  schalter: 'contact_no',
  no_contact: 'contact_no',
  schließer: 'contact_no',
  schliesser: 'contact_no',
  contact_no: 'contact_no',
  nc_contact: 'contact_nc',
  öffner: 'contact_nc',
  oeffner: 'contact_nc',
  contact_nc: 'contact_nc',

  // Pushbuttons and Controls
  pushbutton: 'pushbutton_no',
  taster: 'pushbutton_no',
  taster_no: 'pushbutton_no',
  taster_nc: 'pushbutton_nc',
  emergency_stop: 'pushbutton_emergency_stop',
  'not-aus': 'pushbutton_emergency_stop',
  'not-halt': 'pushbutton_emergency_stop',
  nothalt: 'pushbutton_emergency_stop',

  // Fuses and Circuit Breakers
  fuse: 'fuse_1p',
  sicherung: 'fuse_1p',
  fuse_1p: 'fuse_1p',
  fuse_3p: 'fuse_switch_3p',
  circuit_breaker: 'circuit_breaker_1p',
  leitungsschutzschalter: 'circuit_breaker_1p',
  lss: 'circuit_breaker_1p',
  mcb: 'circuit_breaker_1p',
  motor_protection: 'motor_protective_switch',
  motorschutzschalter: 'motor_protective_switch',
  mss: 'motor_protective_switch',

  // Lights and Lamps
  lamp: 'pilot_lamp',
  lampe: 'pilot_lamp',
  leuchte: 'pilot_lamp',
  meldeleuchte: 'pilot_lamp',
  light: 'pilot_lamp',
  signal_lamp: 'pilot_lamp',
  light_bulb: 'light_bulb',

  // Motors
  motor: 'motor_3phase',
  motor_3p: 'motor_3phase',
  drehstrommotor: 'motor_3phase',
  motor_1p: 'motor_1phase',
  wechselstrommotor: 'motor_1phase',

  // Terminals
  terminal: 'terminal_single',
  klemme: 'terminal_single',
  reihenklemme: 'terminal_single',
  pe_terminal: 'terminal_pe',
  pe_klemme: 'terminal_pe',

  // Potentials / Power rails
  l1: 'potential_l1',
  l2: 'potential_l2',
  l3: 'potential_l3',
  n: 'potential_n',
  pe: 'potential_pe'
};

/**
 * Resolves a symbol from symbolId or fuzzy symbolName.
 */
export function resolveSymbol(
  project: Project,
  symbolId?: string,
  symbolName?: string
): SymbolDefinition | undefined {
  if (symbolId) {
    const direct = getSymbolById(symbolId, project);
    if (direct) return direct;

    const lowerId = symbolId.toLowerCase().trim();
    if (SYMBOL_SYNONYMS[lowerId]) {
      const syn = getSymbolById(SYMBOL_SYNONYMS[lowerId], project);
      if (syn) return syn;
    }
  }

  if (symbolName) {
    const query = symbolName.toLowerCase().trim();
    if (SYMBOL_SYNONYMS[query]) {
      const syn = getSymbolById(SYMBOL_SYNONYMS[query], project);
      if (syn) return syn;
    }

    const compact = query.replace(/[\s\-_]+/g, '');
    for (const [key, targetId] of Object.entries(SYMBOL_SYNONYMS)) {
      if (key.replace(/[\s\-_]+/g, '') === compact) {
        const syn = getSymbolById(targetId, project);
        if (syn) return syn;
      }
    }

    const defs = getSymbolDefinitions(project);
    const exactName = defs.find(s => s.name.toLowerCase() === query);
    if (exactName) return exactName;

    const starts = defs.find(s => s.name.toLowerCase().startsWith(query) || s.id.toLowerCase().startsWith(query));
    if (starts) return starts;

    const contains = defs.find(
      s =>
        s.name.toLowerCase().includes(query) ||
        s.id.toLowerCase().includes(query) ||
        s.keywords?.some(k => k.toLowerCase().includes(query)) ||
        s.description?.toLowerCase().includes(query)
    );
    if (contains) return contains;
  }

  return undefined;
}

function getDefaultWireColor(potential: string): string {
  const p = potential.toUpperCase().trim();
  if (p === 'L1' || p === 'L2' || p === 'L3') return 'BK';
  if (p === 'N') return 'BU';
  if (p === 'PE') return 'GNYE';
  if (p.includes('+') || p === '+24V' || p === 'DC+') return 'DB';
  if (p.includes('-') || p === '0V' || p === 'DC-') return 'WH';
  return 'BK';
}

// -------------------------------------------------------------
// 1. Core Canvas State & Elements
// -------------------------------------------------------------

export async function handleGetCanvasState(
  args: { pageId?: string },
  manager: CanvasStateManager
): Promise<any> {
  const project = manager.getProject();
  const page = manager.getActivePage(args?.pageId);
  if (!page) {
    return {
      success: false,
      error: `Page "${args?.pageId || 'active'}" not found in project.`
    };
  }

  const components = page.components.map(comp => {
    const sym = getSymbolForComponent(comp, project);
    const pinsInfo: Record<string, { name: string; x: number; y: number; direction?: string }> = {};

    if (sym) {
      for (const pin of sym.pins) {
        let pinWorldX = comp.x + pin.x;
        let pinWorldY = comp.y + pin.y;
        try {
          const info = AutoconnectEngine.getRotatedPinInfo(comp, pin, sym);
          pinWorldX = info.worldX;
          pinWorldY = info.worldY;
        } catch {
          // Fallback
        }
        pinsInfo[pin.id] = {
          name: pin.name,
          x: Math.round(pinWorldX * 10) / 10,
          y: Math.round(pinWorldY * 10) / 10,
          direction: pin.direction
        };
      }
    }

    return {
      id: comp.id,
      bmk: comp.bmk,
      symbolId: comp.symbolId,
      symbolName: sym?.name || comp.symbolId,
      functionText: comp.functionText,
      technicalCharacteristics: comp.technicalCharacteristics,
      manufacturer: comp.manufacturer,
      articleNumber: comp.articleNumber,
      x: comp.x,
      y: comp.y,
      rotation: comp.rotation || 0,
      pins: pinsInfo
    };
  });

  const wires = page.wires.map(w => ({
    id: w.id,
    from: w.from,
    to: w.to,
    potential: w.potential,
    color: w.color,
    crossSection: w.crossSection,
    isAutoconnect: w.isAutoconnect
  }));

  const texts = (page.texts || []).map(t => ({
    id: t.id,
    text: t.text,
    x: t.x,
    y: t.y,
    fontSize: t.fontSize,
    rotation: t.rotation
  }));

  const boxes = (page.boxes || []).map(b => ({
    id: b.id,
    bmk: b.bmk,
    label: b.label,
    x: b.x,
    y: b.y,
    width: b.width,
    height: b.height,
    lineStyle: b.lineStyle
  }));

  const cables = (page.cables || []).map(c => ({
    id: c.id,
    bmk: c.bmk,
    cableType: c.cableType,
    crossSection: c.crossSection,
    coreCount: c.coreCount,
    start: c.start,
    end: c.end
  }));

  return {
    success: true,
    page: {
      id: page.id,
      pageNumber: page.pageNumber,
      pageType: page.pageType,
      title: page.title,
      higherLevel: page.higherLevel,
      location: page.location,
      dimensions: {
        width: page.plotFrame?.width || 420,
        height: page.plotFrame?.height || 297,
        columns: page.plotFrame?.columns || 10
      }
    },
    components,
    wires,
    texts,
    boxes,
    cables,
    stats: {
      totalComponents: components.length,
      totalWires: wires.length,
      totalTexts: texts.length,
      totalBoxes: boxes.length,
      totalCables: cables.length
    }
  };
}

export async function handleAddComponent(
  args: {
    symbolId?: string;
    symbolName?: string;
    x: number;
    y: number;
    rotation?: 0 | 90 | 180 | 270;
    bmk?: string;
    functionText?: string;
    technicalCharacteristics?: string;
    manufacturer?: string;
    articleNumber?: string;
  },
  manager: CanvasStateManager
): Promise<any> {
  const project = manager.getProject();
  const page = manager.getActivePage();
  if (!page) {
    return { success: false, error: 'No active page found in project.' };
  }

  if (args.x === undefined || args.y === undefined) {
    return { success: false, error: 'Coordinates x and y are required.' };
  }

  const sym = resolveSymbol(project, args.symbolId, args.symbolName);
  if (!sym) {
    const defs = getSymbolDefinitions(project);
    const query = (args.symbolId || args.symbolName || '').toLowerCase();
    const suggestions = defs
      .filter(s => s.name.toLowerCase().includes(query) || s.category.toLowerCase().includes(query))
      .slice(0, 8)
      .map(s => `"${s.id}" (${s.name})`);

    return {
      success: false,
      error: `Symbol "${args.symbolId || args.symbolName}" not found.`,
      suggestions: suggestions.length > 0 ? suggestions : ['contactor_coil', 'contact_no', 'fuse_1p', 'pushbutton_no', 'pilot_lamp', 'motor_3phase', 'terminal_single']
    };
  }

  const rotation = args.rotation || 0;
  const bmk = args.bmk?.trim() || nextDeviceTag(project, sym.defaultBmkPrefix || '-K');
  const functionText = args.functionText ?? sym.defaultFunctionText ?? '';

  const newComp: PlacedComponent = {
    id: 'comp_' + Math.random().toString(36).substring(2, 9),
    symbolId: sym.id,
    bmk,
    higherLevelFunction: page.higherLevel,
    mountingLocation: page.location,
    functionText,
    technicalCharacteristics: args.technicalCharacteristics || sym.technicalCharacteristics || '',
    articleNumber: args.articleNumber || sym.articleNumber || '',
    manufacturer: args.manufacturer || sym.manufacturer || '',
    x: Math.round(args.x),
    y: Math.round(args.y),
    rotation,
    pins: Object.fromEntries(sym.pins.map(pin => [pin.id, { customLabel: pin.name, wireIds: [] }]))
  };

  page.components.push(newComp);

  try {
    AutoconnectEngine.updatePageAutoconnections(page);
    CrossReferenceEngine.updateProjectCrossReferences(project);
  } catch {
    // Non-blocking
  }

  manager.notifyModified();
  manager.render();

  return {
    success: true,
    component: {
      id: newComp.id,
      bmk: newComp.bmk,
      symbolId: newComp.symbolId,
      symbolName: sym.name,
      functionText: newComp.functionText,
      technicalCharacteristics: newComp.technicalCharacteristics,
      x: newComp.x,
      y: newComp.y,
      rotation: newComp.rotation,
      pins: sym.pins.map(p => ({ id: p.id, name: p.name, direction: p.direction }))
    }
  };
}

export async function handleUpdateComponent(
  args: {
    id: string;
    bmk?: string;
    functionText?: string;
    technicalCharacteristics?: string;
    technicalData?: string;
    manufacturer?: string;
    articleNumber?: string;
    mountingLocation?: string;
    higherLevelFunction?: string;
    x?: number;
    y?: number;
    rotation?: 0 | 90 | 180 | 270;
  },
  manager: CanvasStateManager
): Promise<any> {
  const project = manager.getProject();
  const page = manager.getActivePage();
  if (!page) return { success: false, error: 'No active page.' };

  const comp = page.components.find(c => c.id === args.id);
  if (!comp) {
    return { success: false, error: `Component with ID "${args.id}" not found on active page.` };
  }

  const tech = args.technicalCharacteristics !== undefined ? args.technicalCharacteristics : args.technicalData;

  if (args.bmk !== undefined) comp.bmk = args.bmk.trim();
  if (args.functionText !== undefined) comp.functionText = args.functionText;
  if (tech !== undefined) comp.technicalCharacteristics = tech;
  if (args.manufacturer !== undefined) comp.manufacturer = args.manufacturer;
  if (args.articleNumber !== undefined) comp.articleNumber = args.articleNumber;
  if (args.mountingLocation !== undefined) comp.mountingLocation = args.mountingLocation;
  if (args.higherLevelFunction !== undefined) comp.higherLevelFunction = args.higherLevelFunction;
  if (args.x !== undefined) comp.x = Math.round(args.x);
  if (args.y !== undefined) comp.y = Math.round(args.y);
  if (args.rotation !== undefined) comp.rotation = args.rotation;

  try {
    AutoconnectEngine.updatePageAutoconnections(page);
    CrossReferenceEngine.updateProjectCrossReferences(project);
  } catch {
    // Non-blocking
  }

  manager.notifyModified();
  manager.render();

  return {
    success: true,
    component: {
      id: comp.id,
      bmk: comp.bmk,
      functionText: comp.functionText,
      technicalCharacteristics: comp.technicalCharacteristics,
      manufacturer: comp.manufacturer,
      articleNumber: comp.articleNumber,
      x: comp.x,
      y: comp.y,
      rotation: comp.rotation
    }
  };
}

export async function handleRotateElement(
  args: { id: string; angle?: number },
  manager: CanvasStateManager
): Promise<any> {
  const project = manager.getProject();
  const page = manager.getActivePage();
  if (!page) return { success: false, error: 'No active page.' };

  const delta = args.angle || 90;

  // 1. Component
  const comp = page.components.find(c => c.id === args.id);
  if (comp) {
    comp.rotation = (((comp.rotation || 0) + delta + 360) % 360) as any;
    try {
      AutoconnectEngine.updatePageAutoconnections(page);
      CrossReferenceEngine.updateProjectCrossReferences(project);
    } catch {
      // Non-blocking
    }
    manager.notifyModified();
    manager.render();
    return { success: true, type: 'component', id: comp.id, rotation: comp.rotation };
  }

  // 2. Text
  const text = page.texts?.find(t => t.id === args.id);
  if (text) {
    text.rotation = (((text.rotation || 0) + delta + 360) % 360) as any;
    manager.notifyModified();
    manager.render();
    return { success: true, type: 'text', id: text.id, rotation: text.rotation };
  }

  return { success: false, error: `Element "${args.id}" not found on active page.` };
}

export async function handleMoveElement(
  args: { id: string; dx?: number; dy?: number; x?: number; y?: number },
  manager: CanvasStateManager
): Promise<any> {
  const project = manager.getProject();
  const page = manager.getActivePage();
  if (!page) return { success: false, error: 'No active page.' };

  // 1. Component
  const comp = page.components.find(c => c.id === args.id);
  if (comp) {
    if (args.x !== undefined) comp.x = Math.round(args.x);
    else if (args.dx !== undefined) comp.x += Math.round(args.dx);

    if (args.y !== undefined) comp.y = Math.round(args.y);
    else if (args.dy !== undefined) comp.y += Math.round(args.dy);

    try {
      AutoconnectEngine.updatePageAutoconnections(page);
      CrossReferenceEngine.updateProjectCrossReferences(project);
    } catch {
      // Non-blocking
    }
    manager.notifyModified();
    manager.render();
    return { success: true, type: 'component', id: comp.id, x: comp.x, y: comp.y };
  }

  // 2. Text
  const text = page.texts?.find(t => t.id === args.id);
  if (text) {
    if (args.x !== undefined) text.x = Math.round(args.x);
    else if (args.dx !== undefined) text.x += Math.round(args.dx);

    if (args.y !== undefined) text.y = Math.round(args.y);
    else if (args.dy !== undefined) text.y += Math.round(args.dy);

    manager.notifyModified();
    manager.render();
    return { success: true, type: 'text', id: text.id, x: text.x, y: text.y };
  }

  // 3. Box
  const box = page.boxes?.find(b => b.id === args.id);
  if (box) {
    if (args.x !== undefined) box.x = Math.round(args.x);
    else if (args.dx !== undefined) box.x += Math.round(args.dx);

    if (args.y !== undefined) box.y = Math.round(args.y);
    else if (args.dy !== undefined) box.y += Math.round(args.dy);

    manager.notifyModified();
    manager.render();
    return { success: true, type: 'box', id: box.id, x: box.x, y: box.y };
  }

  return { success: false, error: `Element "${args.id}" not found on active page.` };
}

export async function handleDrawWire(
  args: {
    fromComponentId?: string;
    fromPinId?: string;
    toComponentId?: string;
    toPinId?: string;
    x1?: number;
    y1?: number;
    x2?: number;
    y2?: number;
    potential?: string;
    color?: string;
    crossSection?: string;
    wireNumber?: string;
  },
  manager: CanvasStateManager
): Promise<any> {
  const project = manager.getProject();
  const page = manager.getActivePage();
  if (!page) {
    return { success: false, error: 'No active page found in project.' };
  }

  let fromComp: PlacedComponent | undefined;
  let toComp: PlacedComponent | undefined;
  let fromPin: string | undefined = args.fromPinId;
  let toPin: string | undefined = args.toPinId;

  if (args.fromComponentId && args.toComponentId) {
    fromComp = page.components.find(c => c.id === args.fromComponentId);
    toComp = page.components.find(c => c.id === args.toComponentId);

    if (!fromComp) {
      return { success: false, error: `Source component "${args.fromComponentId}" not found.` };
    }
    if (!toComp) {
      return { success: false, error: `Destination component "${args.toComponentId}" not found.` };
    }

    const fromSym = getSymbolForComponent(fromComp, project);
    const toSym = getSymbolForComponent(toComp, project);

    if (!fromSym) return { success: false, error: `Symbol definition for source component not found.` };
    if (!toSym) return { success: false, error: `Symbol definition for destination component not found.` };

    if (!fromPin) {
      const bottomPin = fromSym.pins.find(p => p.direction === 'bottom') || fromSym.pins[0];
      fromPin = bottomPin?.id || Object.keys(fromComp.pins)[0];
    }
    if (!toPin) {
      const topPin = toSym.pins.find(p => p.direction === 'top') || toSym.pins[0];
      toPin = topPin?.id || Object.keys(toComp.pins)[0];
    }
  } else if (args.x1 !== undefined && args.y1 !== undefined && args.x2 !== undefined && args.y2 !== undefined) {
    const allPins = AutoconnectEngine.getAllPins(page.components, project);
    const findClosestPin = (x: number, y: number, maxDist = 24): RotatedPinInfo | undefined => {
      let closest: RotatedPinInfo | undefined;
      let minDist = maxDist;
      for (const p of allPins) {
        const d = Math.hypot(p.worldX - x, p.worldY - y);
        if (d < minDist) {
          minDist = d;
          closest = p;
        }
      }
      return closest;
    };

    const p1 = findClosestPin(args.x1, args.y1);
    const p2 = findClosestPin(args.x2, args.y2);

    if (!p1) {
      return { success: false, error: `No pin found near starting coordinates (${args.x1}, ${args.y1}).` };
    }
    if (!p2) {
      return { success: false, error: `No pin found near ending coordinates (${args.x2}, ${args.y2}).` };
    }

    fromComp = page.components.find(c => c.id === p1.componentId);
    toComp = page.components.find(c => c.id === p2.componentId);
    fromPin = p1.pinId;
    toPin = p2.pinId;
  } else {
    return {
      success: false,
      error: 'Either fromComponentId and toComponentId OR coordinates (x1, y1, x2, y2) must be provided.'
    };
  }

  if (!fromComp || !toComp || !fromPin || !toPin) {
    return { success: false, error: 'Could not determine source and destination pins for wire.' };
  }

  const potential = args.potential || 'L1';
  const color = args.color || getDefaultWireColor(potential);
  const crossSection = args.crossSection || '1.5mm²';

  const wire: Wire = {
    id: 'w_' + Math.random().toString(36).substring(2, 9),
    from: { componentId: fromComp.id, pinId: fromPin },
    to: { componentId: toComp.id, pinId: toPin },
    potential,
    color,
    crossSection,
    ...(args.wireNumber ? { wireNumber: args.wireNumber } : {})
  };

  page.wires.push(wire);

  try {
    CrossReferenceEngine.updateProjectCrossReferences(project);
  } catch {
    // Non-blocking
  }

  manager.notifyModified();
  manager.render();

  return {
    success: true,
    wire: {
      id: wire.id,
      from: { componentId: fromComp.id, pinId: fromPin, bmk: fromComp.bmk },
      to: { componentId: toComp.id, pinId: toPin, bmk: toComp.bmk },
      potential: wire.potential,
      color: wire.color,
      crossSection: wire.crossSection,
      wireNumber: wire.wireNumber
    }
  };
}

export async function handleUpdateWire(
  args: { id: string; potential?: string; color?: string; crossSection?: string; wireNumber?: string },
  manager: CanvasStateManager
): Promise<any> {
  const page = manager.getActivePage();
  if (!page) return { success: false, error: 'No active page.' };

  const wire = page.wires.find(w => w.id === args.id);
  if (!wire) return { success: false, error: `Wire "${args.id}" not found on active page.` };

  if (args.potential !== undefined) wire.potential = args.potential;
  if (args.color !== undefined) wire.color = args.color;
  if (args.crossSection !== undefined) wire.crossSection = args.crossSection;
  if (args.wireNumber !== undefined) wire.wireNumber = args.wireNumber;

  manager.notifyModified();
  manager.render();

  return { success: true, wire };
}

export async function handleAddCable(
  args: {
    startX: number;
    startY: number;
    endX: number;
    endY: number;
    bmk?: string;
    cableType?: string;
    crossSection?: string;
    coreCount?: number;
    description?: string;
  },
  manager: CanvasStateManager
): Promise<any> {
  const project = manager.getProject();
  const page = manager.getActivePage();
  if (!page) return { success: false, error: 'No active page.' };

  const bmk = args.bmk?.trim() || nextDeviceTag(project, '-W');
  const cableType = args.cableType || 'NYM-J 3x1.5';
  const crossSection = args.crossSection || '1.5mm²';
  const coreCount = args.coreCount || 3;

  const cable: CableDefinition = {
    id: 'cable_' + Math.random().toString(36).substring(2, 9),
    start: { x: Math.round(args.startX), y: Math.round(args.startY) },
    end: { x: Math.round(args.endX), y: Math.round(args.endY) },
    bmk,
    cableType,
    crossSection,
    coreCount,
    description: args.description || '',
    cores: Array.from({ length: coreCount }, (_, i) => ({
      id: `core_${i + 1}`,
      t: (i + 1) / (coreCount + 1),
      designation: String(i + 1),
      crossSection
    }))
  };

  if (!page.cables) page.cables = [];
  page.cables.push(cable);

  manager.notifyModified();
  manager.render();

  return { success: true, cable };
}

export async function handleListCables(
  args: { pageId?: string },
  manager: CanvasStateManager
): Promise<any> {
  const page = manager.getActivePage(args?.pageId);
  if (!page) return { success: false, error: 'Page not found.' };

  const cables = page.cables || [];
  return { success: true, total: cables.length, cables };
}

export async function handleDeleteElement(
  args: { id: string },
  manager: CanvasStateManager
): Promise<any> {
  const project = manager.getProject();
  const page = manager.getActivePage();
  if (!page) {
    return { success: false, error: 'No active page found in project.' };
  }

  if (!args.id) {
    return { success: false, error: 'Element ID is required.' };
  }

  const id = args.id.trim();

  // 1. Component
  const compIndex = page.components.findIndex(c => c.id === id);
  if (compIndex !== -1) {
    const deleted = page.components[compIndex];
    page.components.splice(compIndex, 1);
    const wiresBefore = page.wires.length;
    page.wires = page.wires.filter(w => w.from.componentId !== id && w.to.componentId !== id);
    const wiresRemoved = wiresBefore - page.wires.length;

    try {
      AutoconnectEngine.updatePageAutoconnections(page);
      CrossReferenceEngine.updateProjectCrossReferences(project);
    } catch {
      // Non-blocking
    }

    manager.notifyModified();
    manager.render();

    return {
      success: true,
      deletedType: 'component',
      id: deleted.id,
      bmk: deleted.bmk,
      connectedWiresRemoved: wiresRemoved
    };
  }

  // 2. Wire
  const wireIndex = page.wires.findIndex(w => w.id === id);
  if (wireIndex !== -1) {
    const deleted = page.wires[wireIndex];
    page.wires.splice(wireIndex, 1);
    try {
      CrossReferenceEngine.updateProjectCrossReferences(project);
    } catch {
      // Non-blocking
    }
    manager.notifyModified();
    manager.render();
    return { success: true, deletedType: 'wire', id: deleted.id, potential: deleted.potential };
  }

  // 3. Text
  if (page.texts) {
    const textIdx = page.texts.findIndex(t => t.id === id);
    if (textIdx !== -1) {
      page.texts.splice(textIdx, 1);
      manager.notifyModified();
      manager.render();
      return { success: true, deletedType: 'text', id };
    }
  }

  // 4. Box
  if (page.boxes) {
    const boxIdx = page.boxes.findIndex(b => b.id === id);
    if (boxIdx !== -1) {
      page.boxes.splice(boxIdx, 1);
      manager.notifyModified();
      manager.render();
      return { success: true, deletedType: 'box', id };
    }
  }

  // 5. Cable
  if (page.cables) {
    const cableIdx = page.cables.findIndex(c => c.id === id);
    if (cableIdx !== -1) {
      page.cables.splice(cableIdx, 1);
      manager.notifyModified();
      manager.render();
      return { success: true, deletedType: 'cable', id };
    }
  }

  return {
    success: false,
    error: `Element with ID "${id}" not found on the active page.`
  };
}

export async function handleClearCanvas(
  args: { confirm: boolean },
  manager: CanvasStateManager
): Promise<any> {
  if (!args?.confirm) {
    return {
      success: false,
      error: 'Canvas not cleared: parameter "confirm" must be true to proceed.'
    };
  }

  const project = manager.getProject();
  const page = manager.getActivePage();
  if (!page) {
    return { success: false, error: 'No active page found in project.' };
  }

  const clearedComponents = page.components.length;
  const clearedWires = page.wires.length;
  const clearedTexts = page.texts?.length || 0;
  const clearedBoxes = page.boxes?.length || 0;

  page.components = [];
  page.wires = [];
  page.texts = [];
  page.boxes = [];

  try {
    CrossReferenceEngine.updateProjectCrossReferences(project);
  } catch {
    // Non-blocking
  }

  manager.notifyModified();
  manager.render();

  return {
    success: true,
    message: 'Canvas cleared successfully.',
    clearedComponents,
    clearedWires,
    clearedTexts,
    clearedBoxes
  };
}

export async function handleSearchSymbols(
  args: { query: string; category?: string; limit?: number },
  manager: CanvasStateManager
): Promise<any> {
  const project = manager.getProject();
  const query = (args?.query || '').toLowerCase().trim();
  const category = args?.category?.toLowerCase().trim();
  const limit = Math.min(Math.max(args?.limit || 15, 1), 50);

  const allDefs = getSymbolDefinitions(project);
  let filtered = allDefs;

  if (category && category !== 'all') {
    filtered = filtered.filter(s => s.category?.toLowerCase() === category);
  }

  if (query) {
    filtered = filtered.filter(
      s =>
        s.id.toLowerCase().includes(query) ||
        s.name.toLowerCase().includes(query) ||
        s.description?.toLowerCase().includes(query) ||
        s.keywords?.some(k => k.toLowerCase().includes(query)) ||
        s.category?.toLowerCase().includes(query)
    );
  }

  const results = filtered.slice(0, limit).map(s => ({
    id: s.id,
    name: s.name,
    category: s.category,
    defaultBmkPrefix: s.defaultBmkPrefix,
    description: s.description || '',
    pins: s.pins.map(p => ({ id: p.id, name: p.name, direction: p.direction }))
  }));

  return {
    success: true,
    totalMatches: filtered.length,
    returned: results.length,
    symbols: results
  };
}

// -------------------------------------------------------------
// 2. Project & Page Management Handlers
// -------------------------------------------------------------

export async function handleGetProjectInfo(
  _args: any,
  manager: CanvasStateManager
): Promise<any> {
  const project = manager.getProject();
  return {
    success: true,
    project: {
      id: project.id,
      name: project.name,
      description: project.description,
      author: project.author,
      company: project.company,
      standard: project.standard,
      version: project.version,
      activePageId: project.activePageId,
      totalPages: project.pages.length,
      pages: project.pages.map(p => ({
        id: p.id,
        pageNumber: p.pageNumber,
        pageType: p.pageType,
        title: p.title,
        componentsCount: p.components.length,
        wiresCount: p.wires.length
      }))
    }
  };
}

export async function handleUpdateProjectInfo(
  args: { name?: string; description?: string; author?: string; company?: string },
  manager: CanvasStateManager
): Promise<any> {
  const project = manager.getProject();
  if (args.name !== undefined) project.name = args.name.trim();
  if (args.description !== undefined) project.description = args.description;
  if (args.author !== undefined) project.author = args.author;
  if (args.company !== undefined) project.company = args.company;

  manager.notifyModified();
  return { success: true, project: { name: project.name, description: project.description, author: project.author, company: project.company } };
}

export async function handleListPages(
  _args: any,
  manager: CanvasStateManager
): Promise<any> {
  const project = manager.getProject();
  const pages = project.pages.map(p => ({
    id: p.id,
    pageNumber: p.pageNumber,
    pageType: p.pageType,
    title: p.title,
    higherLevel: p.higherLevel,
    location: p.location,
    isCurrent: p.id === project.activePageId,
    componentsCount: p.components.length,
    wiresCount: p.wires.length
  }));

  return { success: true, total: pages.length, pages };
}

export async function handleCreatePage(
  args: {
    pageType?: PageType;
    title?: string;
    pageNumber?: string;
    higherLevel?: string;
    location?: string;
  },
  manager: CanvasStateManager
): Promise<any> {
  const project = manager.getProject();
  const num = args.pageNumber || (project.pages.length + 1).toString();
  const pageType: PageType = args.pageType || 'schematic';
  const title = args.title || (pageType === 'cover' ? 'Deckblatt' : `Schaltplan Seite ${num}`);

  const newPage: Page = {
    id: 'p_' + Math.random().toString(36).substring(2, 9),
    pageNumber: num,
    pageType,
    title,
    higherLevel: args.higherLevel || project.pages[0]?.higherLevel || '=A1',
    location: args.location || project.pages[0]?.location || '+S1',
    components: [],
    wires: [],
    plotFrame: {
      type: 'DIN_A3_LANDSCAPE',
      width: 1000,
      height: 700,
      columns: 10,
      rows: ['A', 'B', 'C', 'D', 'E', 'F'],
      titleBlock: {
        projectTitle: project.name,
        commission: 'KOM-2026',
        company: project.company,
        author: project.author,
        date: new Date().toISOString().split('T')[0],
        revision: '1.0',
        sheetNumber: num,
        totalSheets: (project.pages.length + 1).toString()
      }
    }
  };

  project.pages.push(newPage);
  project.activePageId = newPage.id;
  manager.switchPage?.(newPage.id);
  manager.notifyModified();
  manager.render();

  return { success: true, page: { id: newPage.id, pageNumber: newPage.pageNumber, pageType: newPage.pageType, title: newPage.title } };
}

export async function handleSwitchPage(
  args: { pageId?: string; pageNumber?: string },
  manager: CanvasStateManager
): Promise<any> {
  const project = manager.getProject();
  let targetPage: Page | undefined;

  if (args.pageId) {
    targetPage = project.pages.find(p => p.id === args.pageId);
  } else if (args.pageNumber) {
    targetPage = project.pages.find(p => p.pageNumber === args.pageNumber);
  }

  if (!targetPage) {
    return { success: false, error: `Page "${args.pageId || args.pageNumber}" not found.` };
  }

  project.activePageId = targetPage.id;
  manager.switchPage?.(targetPage.id);
  manager.notifyModified();
  manager.render();

  return {
    success: true,
    activePage: {
      id: targetPage.id,
      pageNumber: targetPage.pageNumber,
      title: targetPage.title
    }
  };
}

export async function handleDeletePage(
  args: { pageId: string },
  manager: CanvasStateManager
): Promise<any> {
  const project = manager.getProject();
  if (project.pages.length <= 1) {
    return { success: false, error: 'Cannot delete the only remaining page in the project.' };
  }

  const idx = project.pages.findIndex(p => p.id === args.pageId);
  if (idx === -1) {
    return { success: false, error: `Page with ID "${args.pageId}" not found.` };
  }

  project.pages.splice(idx, 1);
  if (project.activePageId === args.pageId) {
    const newActive = project.pages[Math.min(idx, project.pages.length - 1)];
    project.activePageId = newActive.id;
    manager.switchPage?.(newActive.id);
  }

  manager.deletePage?.(args.pageId);
  manager.notifyModified();
  manager.render();

  return { success: true, deletedPageId: args.pageId, remainingPages: project.pages.length };
}

export async function handleUpdatePageInfo(
  args: {
    pageId?: string;
    title?: string;
    pageNumber?: string;
    higherLevel?: string;
    location?: string;
    commission?: string;
    author?: string;
    date?: string;
    revision?: string;
  },
  manager: CanvasStateManager
): Promise<any> {
  const page = manager.getActivePage(args.pageId);
  if (!page) return { success: false, error: 'Page not found.' };

  if (args.title !== undefined) page.title = args.title;
  if (args.pageNumber !== undefined) {
    page.pageNumber = args.pageNumber;
    if (page.plotFrame?.titleBlock) page.plotFrame.titleBlock.sheetNumber = args.pageNumber;
  }
  if (args.higherLevel !== undefined) page.higherLevel = args.higherLevel;
  if (args.location !== undefined) page.location = args.location;

  if (page.plotFrame?.titleBlock) {
    if (args.commission !== undefined) page.plotFrame.titleBlock.commission = args.commission;
    if (args.author !== undefined) page.plotFrame.titleBlock.author = args.author;
    if (args.date !== undefined) page.plotFrame.titleBlock.date = args.date;
    if (args.revision !== undefined) page.plotFrame.titleBlock.revision = args.revision;
  }

  manager.notifyModified();
  manager.render();

  return {
    success: true,
    page: {
      id: page.id,
      pageNumber: page.pageNumber,
      title: page.title,
      higherLevel: page.higherLevel,
      location: page.location
    }
  };
}

// -------------------------------------------------------------
// 3. Text & Device Box Handlers
// -------------------------------------------------------------

export async function handleAddText(
  args: {
    text: string;
    x: number;
    y: number;
    fontSize?: number;
    fontColor?: string;
    fontWeight?: 'normal' | 'bold';
    align?: 'start' | 'center' | 'end';
    rotation?: 0 | 90 | 180 | 270;
  },
  manager: CanvasStateManager
): Promise<any> {
  const page = manager.getActivePage();
  if (!page) return { success: false, error: 'No active page.' };

  const textElem: PageText = {
    id: 'text_' + Math.random().toString(36).substring(2, 9),
    text: args.text,
    x: Math.round(args.x),
    y: Math.round(args.y),
    fontSize: args.fontSize || 12,
    fontColor: args.fontColor || '#edf2f7',
    fontWeight: args.fontWeight || 'normal',
    align: args.align || 'start',
    rotation: args.rotation || 0
  };

  if (!page.texts) page.texts = [];
  page.texts.push(textElem);

  manager.notifyModified();
  manager.render();

  return { success: true, text: textElem, textElement: textElem };
}

export async function handleUpdateText(
  args: {
    id: string;
    text?: string;
    x?: number;
    y?: number;
    fontSize?: number;
    fontColor?: string;
    fontWeight?: 'normal' | 'bold';
    rotation?: 0 | 90 | 180 | 270;
  },
  manager: CanvasStateManager
): Promise<any> {
  const page = manager.getActivePage();
  if (!page) return { success: false, error: 'No active page.' };

  const text = page.texts?.find(t => t.id === args.id);
  if (!text) return { success: false, error: `Text "${args.id}" not found on active page.` };

  if (args.text !== undefined) text.text = args.text;
  if (args.x !== undefined) text.x = Math.round(args.x);
  if (args.y !== undefined) text.y = Math.round(args.y);
  if (args.fontSize !== undefined) text.fontSize = args.fontSize;
  if (args.fontColor !== undefined) text.fontColor = args.fontColor;
  if (args.fontWeight !== undefined) text.fontWeight = args.fontWeight;
  if (args.rotation !== undefined) text.rotation = args.rotation;

  manager.notifyModified();
  manager.render();

  return { success: true, text, textElement: text };
}

export async function handleAddDeviceBox(
  args: {
    x: number;
    y: number;
    width: number;
    height: number;
    bmk?: string;
    label?: string;
    description?: string;
    lineStyle?: 'solid' | 'dashed';
    color?: string;
  },
  manager: CanvasStateManager
): Promise<any> {
  const page = manager.getActivePage();
  if (!page) return { success: false, error: 'No active page.' };

  const box: PageBox = {
    id: 'box_' + Math.random().toString(36).substring(2, 9),
    kind: 'device',
    x: Math.round(args.x),
    y: Math.round(args.y),
    width: Math.round(args.width),
    height: Math.round(args.height),
    bmk: args.bmk || '',
    label: args.label || '',
    description: args.description || '',
    lineStyle: args.lineStyle || 'dashed',
    color: args.color || '#63b3ed'
  };

  if (!page.boxes) page.boxes = [];
  page.boxes.push(box);

  manager.notifyModified();
  manager.render();

  return { success: true, box, deviceBox: box };
}

export async function handleUpdateDeviceBox(
  args: {
    id: string;
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    bmk?: string;
    label?: string;
    description?: string;
    lineStyle?: 'solid' | 'dashed';
  },
  manager: CanvasStateManager
): Promise<any> {
  const page = manager.getActivePage();
  if (!page) return { success: false, error: 'No active page.' };

  const box = page.boxes?.find(b => b.id === args.id);
  if (!box) return { success: false, error: `Device box "${args.id}" not found on active page.` };

  if (args.x !== undefined) box.x = Math.round(args.x);
  if (args.y !== undefined) box.y = Math.round(args.y);
  if (args.width !== undefined) box.width = Math.round(args.width);
  if (args.height !== undefined) box.height = Math.round(args.height);
  if (args.bmk !== undefined) box.bmk = args.bmk;
  if (args.label !== undefined) box.label = args.label;
  if (args.description !== undefined) box.description = args.description;
  if (args.lineStyle !== undefined) box.lineStyle = args.lineStyle;

  manager.notifyModified();
  manager.render();

  return { success: true, box, deviceBox: box };
}

// -------------------------------------------------------------
// 4. Macro System Handlers
// -------------------------------------------------------------

export async function handleListMacros(
  args: { category?: string; type?: 'window' | 'page' | 'all' },
  _manager: CanvasStateManager
): Promise<any> {
  const all = MacroManager.getAllMacros();
  let filtered = all;

  if (args?.type && args.type !== 'all') {
    const targetType = args.type === 'window' ? 'ema' : args.type === 'page' ? 'ems' : args.type;
    filtered = filtered.filter(m => m.type === targetType);
  }

  if (args?.category && args.category !== 'all') {
    filtered = filtered.filter(m => m.category.toLowerCase() === args.category!.toLowerCase());
  }

  const results = filtered.map(m => ({
    id: m.id,
    name: m.name,
    category: m.category,
    type: m.type === 'ema' ? 'window' : 'page',
    macroType: m.type,
    description: m.description,
    componentCount: m.type === 'ema' ? (m as WindowMacro).components.length : (m as any).page?.components?.length || 0
  }));

  return { success: true, total: results.length, macros: results };
}

export async function handlePlaceMacro(
  args: { macroId?: string; macroName?: string; x: number; y: number },
  manager: CanvasStateManager
): Promise<any> {
  const project = manager.getProject();
  const page = manager.getActivePage();
  if (!page) return { success: false, error: 'No active page.' };

  const all = MacroManager.getAllMacros();
  let found = all.find(m => m.id === args.macroId);

  if (!found && args.macroName) {
    const q = args.macroName.toLowerCase().trim();
    found = all.find(m => m.name.toLowerCase().includes(q) || m.id.toLowerCase().includes(q));
  }

  if (!found) {
    return {
      success: false,
      error: `Macro "${args.macroId || args.macroName}" not found in library. Available: ${all.map(m => m.name).slice(0, 8).join(', ')}`
    };
  }

  if (found.type !== 'ema') {
    return { success: false, error: `Macro "${found.name}" is a page macro, not a window macro.` };
  }

  const canvas = manager.getCanvas?.();
  if (canvas) {
    const placed = canvas.placeMacroAt(args.x, args.y, found as WindowMacro);
    return { success: true, placedComponents: placed.length, macroName: found.name };
  } else {
    const placed = MacroManager.instantiateWindowMacro(found as WindowMacro, args.x, args.y, page.components, project);
    manager.notifyModified();
    manager.render();
    return { success: true, placedComponents: placed.components.length, macroName: found.name };
  }
}

// -------------------------------------------------------------
// 5. Floor Plan Handlers
// -------------------------------------------------------------

export async function handleAddWall(
  args: { startX: number; startY: number; endX: number; endY: number; thickness?: number; isExterior?: boolean },
  manager: CanvasStateManager
): Promise<any> {
  const page = manager.getActivePage();
  if (!page) return { success: false, error: 'No active page.' };

  if (!page.floorPlan) {
    page.floorPlan = {
      scale: { scaleRatio: 100, pixelPerMeter: 50 },
      walls: [],
      openings: []
    };
  }

  const wall: WallSegment = {
    id: 'wall_' + Math.random().toString(36).substring(2, 9),
    start: { x: Math.round(args.startX), y: Math.round(args.startY) },
    end: { x: Math.round(args.endX), y: Math.round(args.endY) },
    thickness: args.thickness || 24,
    isExterior: args.isExterior || false
  };

  page.floorPlan.walls.push(wall);
  manager.notifyModified();
  manager.render();

  return { success: true, wall };
}

export async function handleAddWallOpening(
  args: { kind: 'door' | 'window' | 'opening' | 'garage_door'; x: number; y: number; width?: number; orientation?: 'horizontal' | 'vertical'; wallId?: string },
  manager: CanvasStateManager
): Promise<any> {
  const page = manager.getActivePage();
  if (!page) return { success: false, error: 'No active page.' };

  if (!page.floorPlan) {
    page.floorPlan = {
      scale: { scaleRatio: 100, pixelPerMeter: 50 },
      walls: [],
      openings: []
    };
  }

  const opening: WallOpening = {
    id: 'op_' + Math.random().toString(36).substring(2, 9),
    kind: args.kind,
    center: { x: Math.round(args.x), y: Math.round(args.y) },
    width: args.width || 90,
    orientation: args.orientation || 'horizontal',
    wallId: args.wallId
  };

  page.floorPlan.openings.push(opening);
  manager.notifyModified();
  manager.render();

  return { success: true, opening };
}

export async function handleGetFloorPlanState(
  args: { pageId?: string },
  manager: CanvasStateManager
): Promise<any> {
  const page = manager.getActivePage(args?.pageId);
  if (!page) return { success: false, error: 'Page not found.' };

  return {
    success: true,
    hasFloorPlan: !!page.floorPlan,
    floorPlan: page.floorPlan || null,
    walls: page.floorPlan?.walls || [],
    openings: page.floorPlan?.openings || []
  };
}

// -------------------------------------------------------------
// 6. Reports, Calculations & View Handlers
// -------------------------------------------------------------

export async function handleGetPartsList(
  _args: any,
  manager: CanvasStateManager
): Promise<any> {
  const project = manager.getProject();
  const parts = PartsListGenerator.generatePartsList(project);
  const totalQuantity = parts.reduce((sum, p) => sum + p.quantity, 0);

  return {
    success: true,
    totalEntries: parts.length,
    totalQuantity,
    parts,
    items: parts
  };
}

export async function handleGetTerminalDiagram(
  args: { terminalStripBmk?: string },
  manager: CanvasStateManager
): Promise<any> {
  const project = manager.getProject();
  const reportMap = TerminalDiagramGenerator.generateTerminalReport(project);

  const strips: Array<{ strip: string; terminalsCount: number; terminals: any[] }> = [];

  for (const [stripBmk, entries] of reportMap.entries()) {
    if (args?.terminalStripBmk && stripBmk !== args.terminalStripBmk) {
      continue;
    }
    strips.push({
      strip: stripBmk,
      terminalsCount: entries.length,
      terminals: entries.map(e => ({
        terminal: e.terminalNumber,
        terminalNumber: e.terminalNumber,
        internalTarget: e.internalTarget,
        internalTargets: e.internalTarget,
        externalTarget: e.externalTarget,
        externalTargets: e.externalTarget,
        functionText: e.functionText,
        crossSection: e.crossSection,
        wireColor: e.wireColor
      }))
    });
  }

  return {
    success: true,
    stripsCount: strips.length,
    terminalStrips: strips,
    strips
  };
}

export async function handleRecalculateCrossReferences(
  _args: any,
  manager: CanvasStateManager
): Promise<any> {
  const project = manager.getProject();
  CrossReferenceEngine.updateProjectCrossReferences(project);
  manager.notifyModified();
  manager.render();

  return {
    success: true,
    message: 'Cross references successfully updated across project.'
  };
}

export async function handleExportPdf(
  args: { mode?: 'all' | 'active' },
  manager: CanvasStateManager
): Promise<any> {
  const project = manager.getProject();
  return {
    success: true,
    mode: args?.mode || 'active',
    totalPages: project.pages.length,
    message: 'PDF export ready. Use the UI PDF export dialog or electron build for binary vector output.'
  };
}

export async function handleZoomCanvas(
  args: { action: 'fit' | 'in' | 'out' | 'reset' },
  manager: CanvasStateManager
): Promise<any> {
  const canvas = manager.getCanvas?.();
  if (!canvas) {
    return { success: false, error: 'Canvas viewport is not active.' };
  }

  switch (args.action) {
    case 'fit':
      canvas.fitToScreen();
      break;
    case 'in':
      canvas.zoomIn();
      break;
    case 'out':
      canvas.zoomOut();
      break;
    case 'reset':
      canvas.resetZoom();
      break;
  }

  return { success: true, action: args.action };
}
