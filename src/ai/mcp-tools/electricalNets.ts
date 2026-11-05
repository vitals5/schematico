import type { McpToolDefinition } from './definitions';
import type { CanvasStateManager } from './handlers';
import { ProjectIndex } from '../../model/ProjectIndex';
import { ElectricalNetService, portIdentity } from '../../model/ElectricalNetService';
import { collectPlausibilityMessages } from '../../model/ProjectInspection';

export const GET_ELECTRICAL_NETS_TOOL: McpToolDefinition = {
  name: 'get_electrical_nets',
  description: 'Read-only project-wide conductor topology. Follows explicit permanent pin groups, wires and named interruption symbols across sheets. Equal potential labels do not join unrelated conductors. Conditional contacts are not simulated; unknown imported internal connections remain unknown. Returns the same project inspection messages as the UI. Net IDs are derived endpoint anchors, not persistent physical-device or signal UUIDs.',
  inputSchema: { type: 'object', properties: {
    pageId: { type: 'string', description: 'Optional filter: nets touching this page (all their cross-sheet members remain included).' },
    offset: { type: 'number', description: 'Zero-based result offset, default 0.' },
    limit: { type: 'number', description: 'Nets per result, 1–100, default 25. Each net lists at most 500 ports.' },
  } },
};

export async function handleGetElectricalNets(args: any, manager: CanvasStateManager) {
  const offset = args.offset ?? 0, limit = args.limit ?? 25;
  if (!Number.isInteger(offset) || offset < 0 || !Number.isInteger(limit) || limit < 1 || limit > 100)
    throw new Error('Ungültiger Indexbereich.');
  const index = new ProjectIndex(manager.getProject());
  if (args.pageId !== undefined && (typeof args.pageId !== 'string' || !index.pagesById.has(args.pageId)))
    throw new Error('Seite nicht gefunden.');
  const service = new ElectricalNetService(index);
  const nets = service.nets.filter(net => args.pageId === undefined || net.ports.some(p => p.owner.page.id === args.pageId));
  const unknown = index.components.filter(e => service.knowledge.get(e) === 'unknown' && index.pinsFor(e).length);
  const messages = collectPlausibilityMessages(index.project, index, service);
  return {
    success: true, schemaVersion: 1, derived: true, switchStatesSimulated: false,
    counts: { nets: service.nets.length, unknownComponents: unknown.length, issues: service.issues.length },
    unknownComponents: unknown.slice(0, 500).map(e => ({ pageId: e.page.id, componentId: e.component.id, symbolId: e.component.symbolId })),
    issues: service.issues,
    messages: { total: messages.length, offset, items: messages.slice(offset, offset + limit) },
    nets: { total: nets.length, offset, items: nets.slice(offset, offset + limit).map(net => ({
      id: net.id, potentialNames: net.potentialNames, referenceNames: net.referenceNames,
      roles: net.roles, knowledgeIncomplete: net.knowledgeIncomplete, portCount: net.ports.length,
      ports: net.ports.slice(0, 500).map(pin => ({ key: portIdentity(pin), pageId: pin.owner.page.id,
        componentId: pin.owner.component.id, pinId: pin.id, label: pin.label,
        role: pin.role, knowledge: service.knowledge.get(pin.owner) })),
      wireIds: net.connections.map(c => c.wire.id),
    })) },
  };
}
