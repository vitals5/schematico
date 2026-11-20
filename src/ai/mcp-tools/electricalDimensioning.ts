import type { McpToolDefinition } from './definitions';
import type { CanvasStateManager } from './handlers';
import {
  CircuitDimensioning,
  newDimensioning,
  calculateDimensioning,
  withDimensioning,
} from '../../model/ElectricalDimensioning';
import { circuitSchematicDraft } from '../../model/CircuitSchematic';
import { previewLayout } from '../../layout/service';

export const GET_ELECTRICAL_DIMENSIONING_TOOL: McpToolDefinition = {
  name: 'get_electrical_dimensioning',
  description:
    'Returns electrical dimensioning calculations and verification checks for circuits in the project, including design current (Ib), voltage drop (DeltaU, DeltaU%), conductor power losses, minimum/maximum short-circuit fault loops (Ik,min, Ik,max), disconnection times (ta), thermal adiabatic limits (k²S² >= I²t), and selectivity status.',
  inputSchema: {
    type: 'object',
    properties: {
      circuitId: {
        type: 'string',
        description: 'Optional ID of a specific circuit dimensioning calculation to inspect.',
      },
      name: {
        type: 'string',
        description: 'Optional search filter by circuit name.',
      },
    },
  },
};

export const CALCULATE_CIRCUIT_DIMENSIONING_TOOL: McpToolDefinition = {
  name: 'calculate_circuit_dimensioning',
  description:
    'Calculates or verifies an electrical circuit dimensioning case according to electrical installation standards (DC, 1-phase AC, 3-phase AC). Evaluates voltage drop, loop impedance, short-circuit current, disconnection time, and thermal withstand. Optionally saves or updates the circuit calculation in the project.',
  inputSchema: {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        description: 'Optional circuit ID. Generated automatically if omitted.',
      },
      name: {
        type: 'string',
        description: 'Descriptive circuit name (e.g. "Zuleitung UV-1", "Motor M1", "Steckdosenstromkreis B16").',
      },
      system: {
        type: 'string',
        enum: ['dc', 'ac1', 'ac3'],
        description: 'Electrical system: "dc" (direct current), "ac1" (single-phase AC), "ac3" (three-phase AC). Default is "ac1".',
      },
      voltageV: {
        type: 'number',
        description: 'Operating voltage in Volts (e.g. 230 for ac1/dc, 400 for ac3).',
      },
      lengthM: {
        type: 'number',
        description: 'Simple conductor route length in meters.',
      },
      sectionMm2: {
        type: 'number',
        description: 'Conductor cross-section in mm² (e.g. 1.5, 2.5, 4, 6, 10, 16, 25, 35).',
      },
      material: {
        type: 'string',
        enum: ['copper', 'aluminium'],
        description: 'Conductor material: "copper" or "aluminium". Default is "copper".',
      },
      loadMode: {
        type: 'string',
        enum: ['current', 'power'],
        description: 'Load definition mode: "current" (via design current Ib) or "power" (via output power Pab, efficiency, cosPhi). Default is "current".',
      },
      currentA: {
        type: 'number',
        description: 'Operating design current Ib in Amperes (required if loadMode is "current").',
      },
      outputPowerW: {
        type: 'number',
        description: 'Output power in Watts (required if loadMode is "power").',
      },
      efficiency: {
        type: 'number',
        description: 'Load efficiency (0 to 1, default 1).',
      },
      cosPhi: {
        type: 'number',
        description: 'Power factor cos(phi) (default 1 for DC, 0.95 for AC).',
      },
      powerFactorKind: {
        type: 'string',
        enum: ['lagging', 'leading'],
        description: 'Power factor direction: "lagging" (inductive) or "leading" (capacitive). Default is "lagging".',
      },
      maxDropPercent: {
        type: 'number',
        description: 'Permissible voltage drop limit in percent (e.g. 3 or 4).',
      },
      temperatureC: {
        type: 'number',
        description: 'Conductor operating temperature in °C (default 30).',
      },
      verifyAmpacity: {
        type: 'boolean',
        description: 'Whether to evaluate current-carrying capacity Iz and overload protection Ib <= In <= Iz.',
      },
      ampacityA: {
        type: 'number',
        description: 'Base current-carrying capacity Iz0 in Amperes from installation tables.',
      },
      temperatureFactor: {
        type: 'number',
        description: 'Temperature correction factor (default 1).',
      },
      groupingFactor: {
        type: 'number',
        description: 'Grouping/bundling correction factor (default 1).',
      },
      protectiveCurrentA: {
        type: 'number',
        description: 'Rated nominal current In of the protective device in Amperes (e.g. 16, 20, 32).',
      },
      conventionalTripA: {
        type: 'number',
        description: 'Conventional tripping current I2 of the protective device (e.g. 1.45 * In for MCB).',
      },
      verifyFault: {
        type: 'boolean',
        description: 'Whether to verify fault disconnection condition and breaking capacity.',
      },
      phaseEarthVoltageV: {
        type: 'number',
        description: 'Phase-to-earth voltage U0 in Volts (e.g. 230).',
      },
      loopImpedanceZsMaxOhm: {
        type: 'number',
        description: 'Maximum fault loop impedance Zs in Ohms.',
      },
      tripCurrentIa: {
        type: 'number',
        description: 'Tripping current Ia required for automatic disconnection in Amperes (e.g. 80A for B16).',
      },
      requiredDisconnectionTimeS: {
        type: 'number',
        description: 'Maximum permitted disconnection time in seconds (e.g. 0.4s for socket circuits, 5s for distribution circuits).',
      },
      breakingCapacityA: {
        type: 'number',
        description: 'Rated ultimate short-circuit breaking capacity Icu in Amperes (e.g. 6000 for 6kA MCB).',
      },
      saveToProject: {
        type: 'boolean',
        description: 'If true, saves or updates this calculation record in the project dimensioning database.',
      },
    },
    required: ['name'],
  },
};

export const DRAFT_CIRCUIT_SCHEMATIC_TOOL: McpToolDefinition = {
  name: 'draft_circuit_schematic',
  description:
    'Converts an electrical dimensioning calculation into an automated schematic draft preview on a new sheet, placing incoming potential feeds, protective device (with its catalog article), conductors, and load device (with its catalog article and symbol). Opens a checked layout preview that the user can accept.',
  inputSchema: {
    type: 'object',
    properties: {
      circuitId: {
        type: 'string',
        description: 'ID of the existing dimensioning circuit calculation to convert into a schematic draft.',
      },
      loadSymbolId: {
        type: 'string',
        description: 'Symbol ID for the load device (e.g. "motor_3phase", "socket_schuko", "heater_3p", "pilot_lamp").',
      },
    },
    required: ['circuitId'],
  },
};

export async function handleGetElectricalDimensioning(
  args: { circuitId?: string; name?: string },
  manager: CanvasStateManager,
) {
  const project = manager.getProject();
  const cases: CircuitDimensioning[] = project.dimensioning ?? [];
  let filtered = cases;
  if (args.circuitId) {
    filtered = filtered.filter((c) => c.id === args.circuitId);
  }
  if (args.name) {
    const query = args.name.toLowerCase().trim();
    filtered = filtered.filter((c) => c.name.toLowerCase().includes(query));
  }

  const results = filtered.map((record) => {
    const calc = calculateDimensioning(record, project);
    return {
      record,
      calculation: {
        circuitId: calc.circuitId,
        name: calc.name,
        status: calc.status,
        checks: calc.checks,
        values: calc.values,
        method: calc.method,
      },
    };
  });

  return {
    success: true,
    totalCases: cases.length,
    matchingCases: results.length,
    circuits: results,
  };
}

export async function handleCalculateCircuitDimensioning(
  args: any,
  manager: CanvasStateManager,
) {
  const project = manager.getProject();
  const existing = args.id
    ? (project.dimensioning ?? []).find((c) => c.id === args.id)
    : undefined;

  const base = existing ? structuredClone(existing) : newDimensioning(args.name);

  const record: CircuitDimensioning = {
    ...base,
    id: args.id || base.id,
    name: args.name || base.name,
    system: args.system ?? base.system ?? 'ac1',
    material: args.material ?? base.material ?? 'copper',
    loadMode: args.loadMode ?? base.loadMode ?? 'current',
    powerFactorKind: args.powerFactorKind ?? base.powerFactorKind ?? 'lagging',
    voltageV: args.voltageV !== undefined ? Number(args.voltageV) : base.voltageV,
    currentA: args.currentA !== undefined ? Number(args.currentA) : base.currentA,
    outputPowerW: args.outputPowerW !== undefined ? Number(args.outputPowerW) : base.outputPowerW,
    efficiency: args.efficiency !== undefined ? Number(args.efficiency) : base.efficiency,
    cosPhi: args.cosPhi !== undefined ? Number(args.cosPhi) : (base.cosPhi ?? (args.system === 'dc' ? 1 : 0.95)),
    lengthM: args.lengthM !== undefined ? Number(args.lengthM) : base.lengthM,
    sectionMm2: args.sectionMm2 !== undefined ? Number(args.sectionMm2) : base.sectionMm2,
    temperatureC: args.temperatureC !== undefined ? Number(args.temperatureC) : (base.temperatureC ?? 30),
    reactanceOhmKm: args.reactanceOhmKm !== undefined ? Number(args.reactanceOhmKm) : (base.reactanceOhmKm ?? 0),
    maxDropPercent: args.maxDropPercent !== undefined ? Number(args.maxDropPercent) : base.maxDropPercent,
    verifyAmpacity: args.verifyAmpacity !== undefined ? Boolean(args.verifyAmpacity) : base.verifyAmpacity,
    ampacityA: args.ampacityA !== undefined ? Number(args.ampacityA) : base.ampacityA,
    temperatureFactor: args.temperatureFactor !== undefined ? Number(args.temperatureFactor) : base.temperatureFactor,
    groupingFactor: args.groupingFactor !== undefined ? Number(args.groupingFactor) : base.groupingFactor,
    protectiveCurrentA: args.protectiveCurrentA !== undefined ? Number(args.protectiveCurrentA) : base.protectiveCurrentA,
    conventionalTripA: args.conventionalTripA !== undefined ? Number(args.conventionalTripA) : base.conventionalTripA,
    verifyFault: args.verifyFault !== undefined ? Boolean(args.verifyFault) : base.verifyFault,
    phaseEarthVoltageV: args.phaseEarthVoltageV !== undefined ? Number(args.phaseEarthVoltageV) : base.phaseEarthVoltageV,
    faultMode: args.loopImpedanceZsMaxOhm !== undefined ? 'loop' : base.faultMode,
    loopMaxOhm: args.loopImpedanceZsMaxOhm !== undefined ? Number(args.loopImpedanceZsMaxOhm) : base.loopMaxOhm,
    tripThresholdA: args.tripCurrentIa !== undefined ? Number(args.tripCurrentIa) : base.tripThresholdA,
    requiredDisconnectS: args.requiredDisconnectionTimeS !== undefined ? Number(args.requiredDisconnectionTimeS) : base.requiredDisconnectS,
    breakingCapacityA: args.breakingCapacityA !== undefined ? Number(args.breakingCapacityA) : base.breakingCapacityA,
  };

  const calc = calculateDimensioning(record, project);

  let saved = false;
  if (args.saveToProject) {
    const nextProject = withDimensioning(project, record);
    Object.assign(project, nextProject);
    manager.notifyModified();
    manager.render();
    saved = true;
  }

  return {
    success: true,
    saved,
    record,
    calculation: {
      circuitId: calc.circuitId,
      name: calc.name,
      status: calc.status,
      checks: calc.checks,
      values: calc.values,
    },
  };
}

export async function handleDraftCircuitSchematic(
  args: { circuitId: string; loadSymbolId?: string },
  manager: CanvasStateManager,
  signal?: AbortSignal,
) {
  const project = manager.getProject();
  const cases: CircuitDimensioning[] = project.dimensioning ?? [];
  const record = cases.find((c) => c.id === args.circuitId);
  if (!record) {
    throw new Error(`Circuit dimensioning calculation "${args.circuitId}" not found.`);
  }

  const loadSymbolId = args.loadSymbolId || 'socket_schuko';
  const { draft, pageId } = circuitSchematicDraft(project, record, loadSymbolId);

  const preview = await previewLayout(project, pageId, { abortSignal: signal, constructionOnly: true }, draft);
  manager.showLayoutPreview?.(preview, draft, { constructionOnly: true });

  return {
    success: true,
    status: preview.status,
    pageId,
    circuitId: record.id,
    circuitName: record.name,
    preview,
  };
}
