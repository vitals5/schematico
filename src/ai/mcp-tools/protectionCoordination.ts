import type { McpToolDefinition } from './definitions';
import type { CanvasStateManager } from './handlers';
import { protectionCoordination } from '../../model/ProtectionCoordination';
import type { CircuitDimensioning } from '../../model/ElectricalDimensioning';

export const GET_PROTECTION_COORDINATION_TOOL: McpToolDefinition = {
  name: 'get_protection_coordination',
  description:
    'Inspects time-current tripping characteristics, curves, tolerance bands, sample points, and selectivity verification between upstream and downstream protective devices for a circuit calculation in the project.',
  inputSchema: {
    type: 'object',
    properties: {
      circuitId: {
        type: 'string',
        description: 'ID of the circuit dimensioning calculation to evaluate.',
      },
    },
    required: ['circuitId'],
  },
};

export async function handleGetProtectionCoordination(
  args: { circuitId: string },
  manager: CanvasStateManager,
) {
  const project = manager.getProject();
  const cases: CircuitDimensioning[] = project.dimensioning ?? [];
  const record = cases.find((c) => c.id === args.circuitId);
  if (!record) {
    throw new Error(`Circuit calculation "${args.circuitId}" not found in project dimensioning.`);
  }

  const coord = protectionCoordination(record, project);

  return {
    success: true,
    circuitId: coord.circuitId,
    name: coord.name,
    curves: coord.curves.map((curve) => ({
      role: curve.role,
      key: curve.key,
      label: curve.label,
      source: curve.source,
      conditions: curve.conditions,
      pointsCount: curve.points.length,
      points: curve.points,
      ratedVoltageV: curve.ratedVoltageV,
      currentType: curve.currentType,
    })),
    markers: coord.markers,
    issues: coord.issues,
    sampleCurrents: coord.sampleCurrents,
  };
}
