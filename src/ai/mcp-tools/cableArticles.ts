import type { McpToolDefinition } from './definitions';
import type { CanvasStateManager } from './handlers';
import type { CableDefinition } from '../../model/types';
import type { AssignedArticle } from '../../model/ArticleTypes';
import {
  validateCablePart,
  cablePartData,
  cablePartFindings,
} from '../../model/CableArticles';
import { PartsListGenerator } from '../../reports/PartsList';

export const GET_CABLE_ARTICLES_TOOL: McpToolDefinition = {
  name: 'get_cable_articles',
  description:
    'Lists all cable definitions across project pages with their assigned manufacturer articles, physical lengths in meters (lengthM), conductor cross-sections, core counts, and linked circuit calculations, including purchasing meterware totals.',
  inputSchema: {
    type: 'object',
    properties: {
      pageId: {
        type: 'string',
        description: 'Optional filter by page ID.',
      },
      cableId: {
        type: 'string',
        description: 'Optional filter by specific cable definition ID.',
      },
    },
  },
};

export const ASSIGN_CABLE_ARTICLE_TOOL: McpToolDefinition = {
  name: 'assign_cable_article',
  description:
    'Assigns a catalog article, physical real length in meters (lengthM), and/or links circuit calculations to an existing cable definition. Updates purchasing BOM meterware without altering drawn schematic geometry.',
  inputSchema: {
    type: 'object',
    properties: {
      cableId: {
        type: 'string',
        description: 'ID of the cable definition to update.',
      },
      pageId: {
        type: 'string',
        description: 'Optional page ID where the cable is placed. If omitted, searches all project pages.',
      },
      article: {
        type: 'object',
        description: 'Catalog article snapshot to assign (e.g. manufacturer, articleNumber, variant, description, electrical).',
        properties: {
          manufacturer: { type: 'string' },
          articleNumber: { type: 'string' },
          variant: { type: 'string' },
          description: { type: 'string' },
          technicalCharacteristics: { type: 'string' },
          electrical: { type: 'object' },
        },
        required: ['manufacturer', 'articleNumber'],
      },
      lengthM: {
        type: 'number',
        description: 'Explicit real physical cable length in meters for purchasing and BOM meterware.',
      },
      adoptArticleData: {
        type: 'boolean',
        description: 'If true, adopts core count and cross-section from structured article electrical ratings into the cable definition.',
      },
      linkCircuitIds: {
        type: 'array',
        items: { type: 'string' },
        description: 'Array of circuit dimensioning IDs to explicitly bind to this physical cable definition.',
      },
      adoptValuesIntoCircuits: {
        type: 'boolean',
        description: 'If true, transfers cable cross-section and physical length into the linked circuit calculations.',
      },
    },
    required: ['cableId'],
  },
};

export async function handleGetCableArticles(
  args: { pageId?: string; cableId?: string },
  manager: CanvasStateManager,
) {
  const project = manager.getProject();
  const pages = args.pageId
    ? project.pages.filter((p) => p.id === args.pageId)
    : project.pages;

  const entries: Array<{
    pageId: string;
    pageNumber: string;
    cable: CableDefinition;
    articleData?: ReturnType<typeof cablePartData>;
    findings: ReturnType<typeof cablePartFindings>;
    linkedCircuitIds: string[];
  }> = [];

  for (const page of pages) {
    for (const cable of page.cables ?? []) {
      if (args.cableId && cable.id !== args.cableId) continue;

      const linkedCircuitIds = (project.dimensioning ?? [])
        .filter((d) => d.articles?.cable?.cable?.cableId === cable.id)
        .map((d) => d.id);

      entries.push({
        pageId: page.id,
        pageNumber: page.pageNumber,
        cable,
        articleData: cable.article ? cablePartData(cable.article) : undefined,
        findings: cablePartFindings(cable),
        linkedCircuitIds,
      });
    }
  }

  const parts = PartsListGenerator.generatePartsList(project);
  const cableMeterware = parts.filter((p) => p.unit === 'm');

  return {
    success: true,
    totalCables: entries.length,
    cables: entries,
    meterwareTotals: cableMeterware.map((m) => ({
      manufacturer: m.manufacturer,
      articleNumber: m.articleNumber,
      description: m.description,
      totalMeters: m.quantity,
      uncertain: m.quantityUncertain,
    })),
  };
}

export async function handleAssignCableArticle(
  args: {
    cableId: string;
    pageId?: string;
    article?: any;
    lengthM?: number;
    adoptArticleData?: boolean;
    linkCircuitIds?: string[];
    adoptValuesIntoCircuits?: boolean;
  },
  manager: CanvasStateManager,
) {
  const project = manager.getProject();
  let targetPage = args.pageId
    ? project.pages.find((p) => p.id === args.pageId)
    : undefined;
  let targetCable: CableDefinition | undefined;

  if (targetPage) {
    targetCable = (targetPage.cables ?? []).find((c) => c.id === args.cableId);
  } else {
    for (const p of project.pages) {
      const c = (p.cables ?? []).find((cb) => cb.id === args.cableId);
      if (c) {
        targetPage = p;
        targetCable = c;
        break;
      }
    }
  }

  if (!targetPage || !targetCable) {
    throw new Error(`Cable definition "${args.cableId}" not found in project.`);
  }

  if (args.article) {
    const validated = validateCablePart({
      ...args.article,
      variant: args.article.variant ?? '',
      role: 'main',
      quantity: 1,
    } as AssignedArticle);
    targetCable.article = validated;

    if (args.adoptArticleData) {
      const data = cablePartData(validated);
      if (data?.cores) targetCable.coreCount = data.cores;
      if (data?.sectionMm2) targetCable.crossSection = String(data.sectionMm2);
    }
  }

  if (args.lengthM !== undefined) {
    const len = Number(args.lengthM);
    if (!Number.isFinite(len) || len < 0) {
      throw new Error('Kabellänge in Metern muss eine positive Zahl sein.');
    }
    targetCable.lengthM = len;
  }

  const linkedIds: string[] = [];
  if (Array.isArray(args.linkCircuitIds) && args.linkCircuitIds.length > 0) {
    const dimCases = project.dimensioning ?? [];
    for (const cid of args.linkCircuitIds) {
      const cCase = dimCases.find((c) => c.id === cid);
      if (!cCase) continue;
      if (!cCase.articles) cCase.articles = {};
      if (!cCase.articles.cable) {
        cCase.articles.cable = {
          cable: { pageId: targetPage.id, cableId: targetCable.id },
          article: targetCable.article ?? {
            manufacturer: 'Standard',
            articleNumber: targetCable.cableType || 'Kabel',
            variant: '',
            role: 'main',
            quantity: 1,
          },
        };
      } else {
        cCase.articles.cable.cable = {
          pageId: targetPage.id,
          cableId: targetCable.id,
          adoptedLengthM: targetCable.lengthM,
        };
      }

      if (args.adoptValuesIntoCircuits) {
        if (targetCable.lengthM !== undefined) {
          cCase.lengthM = targetCable.lengthM;
        }
        const data = targetCable.article ? cablePartData(targetCable.article) : undefined;
        if (data?.sectionMm2) {
          cCase.sectionMm2 = data.sectionMm2;
        }
      }
      linkedIds.push(cid);
    }
  }

  manager.notifyModified();
  manager.render();

  return {
    success: true,
    pageId: targetPage.id,
    cableId: targetCable.id,
    bmk: targetCable.bmk,
    article: targetCable.article,
    lengthM: targetCable.lengthM,
    crossSection: targetCable.crossSection,
    coreCount: targetCable.coreCount,
    linkedCircuitIds: linkedIds,
  };
}
