import type { McpToolDefinition } from './definitions';
import type { CanvasStateManager } from './handlers';
import { inspectElectricalProject } from '../../model/ElectricalInspection';
export const VALIDATE_ELECTRICAL_PROJECT_TOOL: McpToolDefinition = {
    name: 'validate_electrical_project',
    description: 'Read-only electrical project inspection, using the same rules, stable finding IDs, causes and precise locations as the editor and import inspection. Checks explicit required/reserve ports, references, identities, relevant articles and conductor constraints. Geometry is checked separately by validate_schematic_layout. success means the inspection ran; consult status, summary and unknown-data coverage. Does not certify standards compliance or simulate switching states.',
    inputSchema: { type: 'object', properties: { offset: { type: 'number', description: 'Zero-based message offset, default 0.' }, limit: { type: 'number', description: 'Messages per response, 1–500, default 100.' } } },
};
export async function handleValidateElectricalProject(args: any, manager: CanvasStateManager) {
    const offset = args.offset ?? 0, limit = args.limit ?? 100;
    if (!Number.isInteger(offset) || offset < 0 || !Number.isInteger(limit) || limit < 1 || limit > 500)
        throw new Error('Ungültiger Indexbereich.');
    const report = inspectElectricalProject(manager.getProject());
    return { success: true, ...report, messages: { total: report.messages.length, offset, items: report.messages.slice(offset, offset + limit) } };
}
