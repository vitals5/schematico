import type { McpToolDefinition } from './definitions';
import type { CanvasStateManager } from './handlers';
import type { CatalogArticle } from '../../model/ArticleTypes';
import {
  completeArticleWithAi,
  completeArticleHeuristics,
  detectMissingArticleFields,
  missingFieldNames,
} from '../../model/ArticleCompletion';

export const COMPLETE_ARTICLE_DATA_TOOL: McpToolDefinition = {
  name: 'complete_article_data',
  description:
    'Automatically completes missing engineering data (description, symbolId, physical dimensions, electrical characteristics) for catalog articles using domain heuristics and AI assistance. Also returns missing field diagnostics.',
  inputSchema: {
    type: 'object',
    properties: {
      article: {
        type: 'object',
        description: 'Catalog article with at least articleNumber and manufacturer',
        properties: {
          articleNumber: { type: 'string' },
          manufacturer: { type: 'string' },
          description: { type: 'string' },
          variant: { type: 'string' },
          symbolId: { type: 'string' },
        },
        required: ['articleNumber', 'manufacturer'],
      },
      useAi: {
        type: 'boolean',
        description: 'Whether to use LLM completion in addition to heuristic rules (default: true)',
      },
    },
    required: ['article'],
  },
};

export async function handleCompleteArticleDataTool(
  args: any,
  manager: CanvasStateManager,
) {
  if (!args.article || typeof args.article !== 'object') {
    throw new Error('Ungültiger Artikel übergeben.');
  }

  const rawArticle: CatalogArticle = {
    id: args.article.id || `${args.article.manufacturer}_${args.article.articleNumber}`,
    articleNumber: String(args.article.articleNumber || '').trim(),
    manufacturer: String(args.article.manufacturer || '').trim(),
    description: String(args.article.description || '').trim(),
    variant: args.article.variant ? String(args.article.variant).trim() : '',
    origin: args.article.origin || 'user',
    verification: args.article.verification || 'unverified',
    symbolId: args.article.symbolId,
    dimensions: args.article.dimensions,
    electrical: args.article.electrical,
  };

  if (!rawArticle.articleNumber || !rawArticle.manufacturer) {
    throw new Error('Hersteller und Artikelnummer sind erforderlich.');
  }

  const project = manager.getProject();
  const missingBefore = missingFieldNames(rawArticle);

  if (args.useAi === false) {
    const completed = completeArticleHeuristics(rawArticle, project);
    const missingAfter = missingFieldNames(completed);
    return {
      success: true,
      usedAi: false,
      missingBefore,
      missingAfter,
      enrichedFields: missingBefore.filter((f) => !missingAfter.includes(f)),
      article: completed,
    };
  }

  const result = await completeArticleWithAi(rawArticle, { project });
  const missingAfter = missingFieldNames(result.article);

  return {
    success: true,
    usedAi: result.usedAi,
    missingBefore,
    missingAfter,
    enrichedFields: result.enrichedFields,
    article: result.article,
  };
}
