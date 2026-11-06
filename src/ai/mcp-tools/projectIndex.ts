import type { McpToolDefinition } from './definitions';
import type { CanvasStateManager } from './handlers';
import { ProjectIndex } from '../../model/ProjectIndex';
import { collectPlausibilityMessages } from '../../model/ProjectInspection';
export const GET_PROJECT_INDEX_TOOL: McpToolDefinition = {
    name: 'get_project_index', description: 'Read-only shared project identity index and the same plausibility messages shown in the UI. Designation groups are candidate identities, not verified physical-device counts. This is not a full electrical or standards check. Rebuilt from current project data on each call.',
    inputSchema: { type: 'object', properties: { offset: { type: 'number', description: 'Zero-based offset for both result lists, default 0.' }, limit: { type: 'number', description: 'Items per result list, 1–500, default 100.' } } }
};
export async function handleGetProjectIndex(args: any, manager: CanvasStateManager) {
    const offset = args.offset ?? 0, limit = args.limit ?? 100;
    if (!Number.isInteger(offset) || offset < 0 || !Number.isInteger(limit) || limit < 1 || limit > 500)
        throw new Error('Ungültiger Indexbereich.');
    const index = new ProjectIndex(manager.getProject()), messages = collectPlausibilityMessages(index.project, index);
    const designations = [...index.deviceGroups].map(([key, entries]) => ({ key, tag: entries[0].tag, structure: entries[0].structure, placements: entries.map(e => ({ pageId: e.page.id, pageNumber: e.page.pageNumber, componentId: e.component.id, symbolId: e.component.symbolId, role: e.symbol?.isMaster ? 'master' : e.symbol?.isContact ? 'contact' : 'unspecified', nativeRepresentation: e.nativeRepresentation })) }));
    return { success: true, schemaVersion: 1, derived: true, physicalDeviceCountKnown: false, counts: { pages: index.project.pages.length, placements: index.components.length, designationGroups: index.deviceGroups.size, articleGroups: index.articleGroups.size, connections: index.connections.length, verifiedDevices:index.devices.valid.size, identityIssues: index.identityIssues.length }, identityIssues: index.identityIssues, deviceIssues:index.devices.issues, verifiedDevices:{total:index.devices.valid.size,offset,items:[...index.devices.valid.values()].slice(offset,offset+limit)},
        designations: { total: designations.length, offset, items: designations.slice(offset, offset + limit) }, messages: { total: messages.length, offset, items: messages.slice(offset, offset + limit) } };
}
