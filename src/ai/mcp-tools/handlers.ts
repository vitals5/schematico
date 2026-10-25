// src/ai/mcp-tools/handlers.ts
// Handlers for Schematico MCP Tools that inspect and mutate canvas state

import { Project, Page, PlacedComponent, Wire, SymbolDefinition } from '../../model/types';
import { getSymbolDefinitions, getSymbolById, getSymbolForComponent } from '../../model/symbols';
import { nextDeviceTag } from '../../model/DeviceTag';
import { AutoconnectEngine, RotatedPinInfo } from '../../model/AutoconnectEngine';
import { CrossReferenceEngine } from '../../model/CrossReferenceEngine';
import type { CadCanvas } from '../../editor/CadCanvas';

export interface CanvasStateManager {
  getProject(): Project;
  getActivePage(pageId?: string): Page;
  getCanvas?(): CadCanvas | undefined;
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
  // 1. Exact match by symbolId
  if (symbolId) {
    const direct = getSymbolById(symbolId, project);
    if (direct) return direct;

    const lowerId = symbolId.toLowerCase().trim();
    if (SYMBOL_SYNONYMS[lowerId]) {
      const syn = getSymbolById(SYMBOL_SYNONYMS[lowerId], project);
      if (syn) return syn;
    }
  }

  // 2. Lookup by symbolName
  if (symbolName) {
    const query = symbolName.toLowerCase().trim();
    if (SYMBOL_SYNONYMS[query]) {
      const syn = getSymbolById(SYMBOL_SYNONYMS[query], project);
      if (syn) return syn;
    }

    // Try without spaces / underscores
    const compact = query.replace(/[\s\-_]+/g, '');
    for (const [key, targetId] of Object.entries(SYMBOL_SYNONYMS)) {
      if (key.replace(/[\s\-_]+/g, '') === compact) {
        const syn = getSymbolById(targetId, project);
        if (syn) return syn;
      }
    }

    // Search across definitions
    const defs = getSymbolDefinitions(project);
    // Exact name match
    const exactName = defs.find(s => s.name.toLowerCase() === query);
    if (exactName) return exactName;

    // Starts with query
    const starts = defs.find(s => s.name.toLowerCase().startsWith(query) || s.id.toLowerCase().startsWith(query));
    if (starts) return starts;

    // Contains query in name or keywords
    const contains = defs.find(s =>
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
  if (p === 'L1' || p === 'L2' || p === 'L3') return 'BK'; // Black or Brown
  if (p === 'N') return 'BU'; // Blue
  if (p === 'PE') return 'GNYE'; // Green-Yellow
  if (p.includes('+') || p === '+24V' || p === 'DC+') return 'DB'; // Dark Blue / Red
  if (p.includes('-') || p === '0V' || p === 'DC-') return 'WH'; // White-Blue
  return 'BK';
}

/**
 * Tool Handler: get_canvas_state
 */
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

  const canvas = manager.getCanvas?.();
  const scale = page.plotFrame ? 1 : 1;

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
          // Fallback to basic offset
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

  return {
    success: true,
    page: {
      id: page.id,
      pageNumber: page.pageNumber,
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
    stats: {
      totalComponents: components.length,
      totalWires: wires.length
    }
  };
}

/**
 * Tool Handler: add_component
 */
export async function handleAddComponent(
  args: {
    symbolId?: string;
    symbolName?: string;
    x: number;
    y: number;
    rotation?: 0 | 90 | 180 | 270;
    bmk?: string;
    functionText?: string;
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
    // Provide suggestions
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
    technicalCharacteristics: sym.technicalCharacteristics || '',
    articleNumber: sym.articleNumber || '',
    manufacturer: sym.manufacturer || '',
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
    // Non-blocking update
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
      x: newComp.x,
      y: newComp.y,
      rotation: newComp.rotation,
      pins: sym.pins.map(p => ({ id: p.id, name: p.name, direction: p.direction }))
    }
  };
}

/**
 * Tool Handler: draw_wire
 */
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

  // Case A: Component IDs provided
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

    // Auto-select pins if not specified
    if (!fromPin) {
      // Pick bottom or first pin
      const bottomPin = fromSym.pins.find(p => p.direction === 'bottom') || fromSym.pins[0];
      fromPin = bottomPin?.id || Object.keys(fromComp.pins)[0];
    }
    if (!toPin) {
      // Pick top or first pin
      const topPin = toSym.pins.find(p => p.direction === 'top') || toSym.pins[0];
      toPin = topPin?.id || Object.keys(toComp.pins)[0];
    }
  }
  // Case B: Coordinates provided
  else if (args.x1 !== undefined && args.y1 !== undefined && args.x2 !== undefined && args.y2 !== undefined) {
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
    crossSection
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
      crossSection: wire.crossSection
    }
  };
}

/**
 * Tool Handler: delete_element
 */
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

  // 1. Check components
  const compIndex = page.components.findIndex(c => c.id === id);
  if (compIndex !== -1) {
    const deleted = page.components[compIndex];
    page.components.splice(compIndex, 1);

    // Also remove any connected wires
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

  // 2. Check wires
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

    return {
      success: true,
      deletedType: 'wire',
      id: deleted.id,
      potential: deleted.potential
    };
  }

  return {
    success: false,
    error: `Element with ID "${id}" not found on the active page.`
  };
}

/**
 * Tool Handler: clear_canvas
 */
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

  page.components = [];
  page.wires = [];

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
    clearedWires
  };
}

/**
 * Tool Handler: search_symbols
 */
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
    filtered = filtered.filter(s =>
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
