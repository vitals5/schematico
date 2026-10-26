import { nextDeviceTag } from '../model/DeviceTag';
import type { CanvasStateManager } from '../ai/mcp-tools/handlers';
import type { McpToolDefinition } from '../ai/mcp-tools/definitions';
import type { Project, PlacedComponent } from '../model/types';
import { getSymbolById } from '../model/symbols';
import { snapshotPage } from './geometry';
import { validateLayout } from './validate';
import { previewLayout } from './service';
import { clone, type LayoutOptions, type LayoutPreview } from './types';
const optionsSchema = {
  pageId: { type: 'string' as const },
  lockedIds: {
    type: 'array' as const,
    items: { type: 'string' },
    description: 'Object/group IDs that must remain fixed.',
  },
  selectedIds: {
    type: 'array' as const,
    items: { type: 'string' },
    description: 'Optional selection to optimize; other objects remain fixed.',
  },
  containers: {
    type: 'array' as const,
    items: {
      type: 'object',
      properties: { id: { type: 'string' }, members: { type: 'array', items: { type: 'string' } } },
      required: ['id', 'members'],
    },
    description: 'Explicit box membership when geometric containment is ambiguous.',
  },
};
export const VALIDATE_LAYOUT_TOOL: McpToolDefinition = {
  name: 'validate_schematic_layout',
  description:
    'Independently check schematic bodies, measured labels, obstacles, wire directions, crossings and sheet limits. Does not change the drawing.',
  inputSchema: { type: 'object', properties: { pageId: { type: 'string' } } },
};
export const OPTIMIZE_LAYOUT_TOOL: McpToolDefinition = {
  name: 'optimize_schematic_layout',
  description:
    'Compute deterministic whole-sheet or selection layout candidates in millimeters using the project scale and grid. Opens a preview; only the user can apply it. No diagram changes until confirmation. Reports infeasibility instead of compressing symbols or fonts.',
  inputSchema: { type: 'object', properties: optionsSchema },
};
export const CREATE_DRAFT_TOOL: McpToolDefinition = {
  name: 'create_schematic_draft',
  description:
    'Plan a complete circuit as library components, pin connections and explicit groups WITHOUT coordinates. Computes a checked layout preview. The user applies the entire draft as one undo step. Existing page contents remain unless moved by the checked layout.',
  inputSchema: {
    type: 'object',
    properties: {
      pageId: { type: 'string' },
      components: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            symbolId: { type: 'string' },
            bmk: { type: 'string' },
            functionText: { type: 'string' },
            technicalCharacteristics: { type: 'string' },
            manufacturer: { type: 'string' },
            articleNumber: { type: 'string' },
          },
          required: ['id', 'symbolId'],
        },
      },
      connections: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            from: {
              type: 'object',
              properties: { componentId: { type: 'string' }, pinId: { type: 'string' } },
              required: ['componentId', 'pinId'],
            },
            to: {
              type: 'object',
              properties: { componentId: { type: 'string' }, pinId: { type: 'string' } },
              required: ['componentId', 'pinId'],
            },
            potential: { type: 'string' },
          },
          required: ['id', 'from', 'to', 'potential'],
        },
      },
      groups: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            members: { type: 'array', items: { type: 'string' } },
          },
          required: ['id', 'members'],
        },
      },
    },
    required: ['components', 'connections'],
  },
};
function pageFor(args: any, manager: CanvasStateManager) {
  const project = manager.getProject(),
    page = project.pages.find((p) => p.id === (args?.pageId ?? project.activePageId));
  if (!page) throw new Error('Seite nicht gefunden.');
  return { project, page };
}
export async function handleValidateLayout(args: any, manager: CanvasStateManager) {
  const { project, page } = pageFor(args, manager);
  if (typeof document !== 'undefined') await document.fonts.ready;
  const report = validateLayout(snapshotPage(page, project));
  return { success: true, status: report.valid ? 'layout_valid' : 'layout_invalid', ...report };
}
function result(preview: LayoutPreview) {
  return {
    success: preview.status === 'preview_ready',
    status: preview.status,
    requiresUserApply: true,
    before: preview.before.metrics,
    candidates: preview.candidates.map((c) => ({
      id: c.id,
      profile: c.profile,
      metrics: c.report.metrics,
      valid: c.report.valid,
    })),
    issues: preview.issues,
    splitSuggestion: preview.splitSuggestion,
    message:
      preview.status === 'preview_ready'
        ? 'Geprüfte Vorschau bereit. Noch nicht übernommen. Im Vorschaufenster Übernehmen wählen.'
        : 'Kein gültiges Layout gefunden. Zeichnung unverändert; Fehlerbericht prüfen.',
  };
}
function options(args: any): LayoutOptions {
  if (args.containers !== undefined) {
    if (
      !Array.isArray(args.containers) ||
      args.containers.some((c: any) => !c || typeof c.id !== 'string' || !Array.isArray(c.members))
    )
      throw new Error('Ungültige Kastenzuordnung.');
    args = {
      ...args,
      containerMembers: Object.fromEntries(args.containers.map((c: any) => [c.id, c.members])),
    };
  }
  for (const key of ['lockedIds', 'selectedIds'])
    if (
      args[key] !== undefined &&
      (!Array.isArray(args[key]) || args[key].some((id: unknown) => typeof id !== 'string'))
    )
      throw new Error('Ungültige Objekt-Auswahl.');
  if (
    args.containerMembers !== undefined &&
    (typeof args.containerMembers !== 'object' ||
      !args.containerMembers ||
      Array.isArray(args.containerMembers) ||
      Object.values(args.containerMembers).some(
        (v) => !Array.isArray(v) || v.some((id) => typeof id !== 'string'),
      ))
  )
    throw new Error('Ungültige Gruppenmitgliedschaft.');
  return {
    lockedIds: args.lockedIds,
    selectedIds: args.selectedIds,
    containerMembers: args.containerMembers,
  };
}
export async function handleOptimizeLayout(args: any, manager: CanvasStateManager) {
  const { project, page } = pageFor(args, manager),
    opts = options(args);
  const preview = await previewLayout(project, page.id, opts);
  manager.showLayoutPreview?.(preview, undefined, opts);
  return result(preview);
}
interface Draft {
  components: {
    id: string;
    symbolId: string;
    bmk?: string;
    functionText?: string;
    technicalCharacteristics?: string;
    manufacturer?: string;
    articleNumber?: string;
  }[];
  connections: {
    id: string;
    from: { componentId: string; pinId: string };
    to: { componentId: string; pinId: string };
    potential: string;
  }[];
  groups?: { id: string; name?: string; members: string[] }[];
}
export function buildDraft(project: Project, pageId: string, input: Draft): Project {
  if (
    !Array.isArray(input.components) ||
    !input.components.length ||
    input.components.length > 200 ||
    !Array.isArray(input.connections) ||
    input.connections.length > 1000 ||
    (input.groups !== undefined && !Array.isArray(input.groups))
  )
    throw new Error('Entwurf benötigt 1–200 Komponenten und höchstens 1000 Verbindungen.');
  const draft = clone(project),
    page = draft.pages.find((p) => p.id === pageId);
  if (!page || page.floorPlan || page.pageType !== 'schematic')
    throw new Error('Stromlaufplanseite fehlt.');
  const refs = new Map<string, string>(),
    taken = new Set(
      draft.pages.flatMap((p) =>
        [
          ...p.components,
          ...p.wires,
          ...(p.groups ?? []),
          ...(p.boxes ?? []),
          ...(p.texts ?? []),
          ...(p.images ?? []),
          ...(p.cables ?? []),
        ].map((o) => o.id),
      ),
    );
  const newId = (id: string) => {
    if (typeof id !== 'string' || !id.trim() || refs.has(id))
      throw new Error('Entwurfs-IDs müssen eindeutig sein.');
    const next = 'ai-' + id;
    if (taken.has(next)) throw new Error('Objekt-ID existiert bereits: ' + next);
    refs.set(id, next);
    taken.add(next);
    return next;
  };
  for (const item of input.components) {
    const sym = getSymbolById(item.symbolId, draft);
    if (!sym || sym.unresolved)
      throw new Error('Bibliothekssymbol nicht verfügbar: ' + item.symbolId);
    const id = newId(item.id),
      c: PlacedComponent = {
        id,
        symbolId: sym.id,
        bmk: item.bmk?.trim() || nextDeviceTag(draft, sym.defaultBmkPrefix || '-K'),
        higherLevelFunction: page.higherLevel,
        mountingLocation: page.location,
        functionText: item.functionText ?? sym.defaultFunctionText ?? '',
        technicalCharacteristics: item.technicalCharacteristics ?? sym.technicalCharacteristics,
        manufacturer: item.manufacturer ?? sym.manufacturer,
        articleNumber: item.articleNumber ?? sym.articleNumber,
        x: 0,
        y: 0,
        rotation: 0,
        pins: Object.fromEntries(sym.pins.map((p) => [p.id, { customLabel: p.name, wireIds: [] }])),
      };
    page.components.push(c);
  }
  for (const g of input.groups ?? []) newId(g.id);
  for (const item of input.connections) {
    const endpoint = (ep: typeof item.from) => {
      if (!ep || typeof ep.pinId !== 'string') throw new Error('Ungültiger Leitungsanschluss.');
      const id = refs.get(ep.componentId) ?? ep.componentId,
        c = page.components.find((c) => c.id === id);
      if (!c?.pins[ep.pinId])
        throw new Error('Anschluss fehlt: ' + ep.componentId + ':' + ep.pinId);
      return { componentId: id, pinId: ep.pinId };
    };
    const id = newId(item.id),
      from = endpoint(item.from),
      to = endpoint(item.to);
    if (typeof item.potential !== 'string') throw new Error('Potential fehlt.');
    page.wires.push({ id, from, to, potential: item.potential, isAutoconnect: false });
    for (const ep of [from, to])
      (page.components.find((c) => c.id === ep.componentId)!.pins[ep.pinId].wireIds ??= []).push(
        id,
      );
  }
  for (const g of input.groups ?? []) {
    if (!Array.isArray(g.members)) throw new Error('Gruppenmitglieder fehlen.');
    (page.groups ??= []).push({
      id: refs.get(g.id)!,
      name: g.name,
      members: g.members.map((id) => {
        const mapped = refs.get(id);
        if (!mapped) throw new Error('Gruppenmitglied fehlt: ' + id);
        return {
          kind: input.groups?.some((g) => g.id === id)
            ? ('group' as const)
            : page.wires.some((w) => w.id === mapped)
              ? ('wire' as const)
              : ('component' as const),
          id: mapped,
        };
      }),
    });
  }
  return draft;
}
export async function handleCreateDraft(args: any, manager: CanvasStateManager) {
  const { project, page } = pageFor(args, manager),
    draft = buildDraft(project, page.id, args),
    preview = await previewLayout(project, page.id, {}, draft);
  manager.showLayoutPreview?.(preview, draft, {});
  return result(preview);
}
