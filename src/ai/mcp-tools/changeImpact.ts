import type { McpToolDefinition } from './definitions';
import type { CanvasStateManager } from './handlers';
import {
  analyzeChangeImpact,
  reviewChangeImpacts,
  applyImpactProposals,
  ImpactStatus,
} from '../../model/ChangeImpact';
import { savedRevisions, readProjectRevision } from '../../model/ProjectRevisions';

export const ANALYZE_CHANGE_IMPACT_TOOL: McpToolDefinition = {
  name: 'analyze_change_impact',
  description:
    'Compares the current working project state against a saved or released baseline revision to track affected circuits, unassigned electrical changes, outdated documents (BOM, terminal/cable lists), and actionable update proposals.',
  inputSchema: {
    type: 'object',
    properties: {
      baselineRevisionId: {
        type: 'string',
        description:
          'Optional ID of the reference baseline revision to compare against. If omitted, the latest released revision (or latest saved revision) is used.',
      },
    },
  },
};

export const REVIEW_CHANGE_IMPACT_TOOL: McpToolDefinition = {
  name: 'review_change_impact',
  description:
    'Records an actionable engineering review decision (status: open, in_progress, reviewed) with author and reason for change-impact worklist tasks. Recorded persistently in project.changeImpactReview.',
  inputSchema: {
    type: 'object',
    properties: {
      baselineRevisionId: {
        type: 'string',
        description: 'Optional baseline revision ID. Defaults to latest released or saved revision.',
      },
      rowKeys: {
        type: 'array',
        items: { type: 'string' },
        description: 'Array of task keys from analyze_change_impact to update.',
      },
      status: {
        type: 'string',
        enum: ['open', 'in_progress', 'reviewed'],
        description: 'Review decision status: "open", "in_progress", or "reviewed".',
      },
      author: {
        type: 'string',
        description: 'Name or identifier of the reviewer.',
      },
      reason: {
        type: 'string',
        description: 'Justification and notes for the review decision.',
      },
    },
    required: ['rowKeys', 'status', 'author', 'reason'],
  },
};

export const APPLY_CHANGE_IMPACT_PROPOSALS_TOOL: McpToolDefinition = {
  name: 'apply_change_impact_proposals',
  description:
    'Applies confirmed change-impact proposals (e.g. synchronizing updated component part ratings or physical wire lengths into circuit dimensioning calculations) in one safe, undoable operation.',
  inputSchema: {
    type: 'object',
    properties: {
      baselineRevisionId: {
        type: 'string',
        description: 'Optional baseline revision ID. Defaults to latest released or saved revision.',
      },
      proposalIds: {
        type: 'array',
        items: { type: 'string' },
        description: 'Array of proposal IDs from analyze_change_impact to apply.',
      },
      confirmFullLength: {
        type: 'boolean',
        description: 'Explicit confirmation that the drawn reference line represents the complete circuit conductor length (required when adopting wire lengths).',
      },
    },
    required: ['proposalIds'],
  },
};

async function getBaselineAndReport(project: any, baselineId?: string) {
  const revisions = savedRevisions(project);
  if (!revisions.length) {
    throw new Error('Keine gespeicherten Projektstände vorhanden. Zuerst einen Revisionsstand speichern.');
  }

  const baseline = baselineId
    ? revisions.find((r) => r.id === baselineId)
    : (revisions.find((r) => r.status === 'released') ?? revisions[0]);

  if (!baseline) {
    throw new Error(`Revisionsstand "${baselineId}" nicht gefunden.`);
  }

  const before = await readProjectRevision(baseline);
  const report = await analyzeChangeImpact(before, project, baseline);
  return { baseline, before, report };
}

export async function handleAnalyzeChangeImpact(
  args: { baselineRevisionId?: string },
  manager: CanvasStateManager,
) {
  const project = manager.getProject();
  const { baseline, report } = await getBaselineAndReport(project, args.baselineRevisionId);

  return {
    success: true,
    baseline: {
      id: baseline.id,
      name: baseline.name,
      status: baseline.status,
      created: baseline.created,
      digest: baseline.digest,
    },
    workingChanged: report.workingChanged,
    generatedAt: report.generatedAt,
    totalRows: report.rows.length,
    rows: report.rows.map((row) => ({
      key: row.key,
      label: row.label,
      kind: row.kind,
      checks: row.checks,
      circuitId: row.circuitId,
      status: row.decision?.status ?? 'open',
      decision: row.decision,
      causesCount: row.causes.length,
      causes: row.causes,
      documents: row.documents,
    })),
    proposals: report.proposals.map((prop) => ({
      id: prop.id,
      kind: prop.kind,
      circuitId: prop.circuitId,
      role: prop.role,
      label: prop.label,
      note: prop.note,
      values: prop.values,
    })),
    diagnostics: report.diagnostics,
  };
}

export async function handleReviewChangeImpact(
  args: {
    baselineRevisionId?: string;
    rowKeys: string[];
    status: ImpactStatus;
    author: string;
    reason: string;
  },
  manager: CanvasStateManager,
) {
  const project = manager.getProject();
  const { report } = await getBaselineAndReport(project, args.baselineRevisionId);

  const nextProject = reviewChangeImpacts(
    project,
    report,
    args.rowKeys,
    args.status,
    args.author,
    args.reason,
  );

  Object.assign(project, nextProject);
  manager.notifyModified();
  manager.render();

  return {
    success: true,
    status: args.status,
    author: args.author,
    reason: args.reason,
    updatedRowsCount: args.rowKeys.length,
    rowKeys: args.rowKeys,
  };
}

export async function handleApplyChangeImpactProposals(
  args: {
    baselineRevisionId?: string;
    proposalIds: string[];
    confirmFullLength?: boolean;
  },
  manager: CanvasStateManager,
) {
  const project = manager.getProject();
  const { report } = await getBaselineAndReport(project, args.baselineRevisionId);

  const nextProject = applyImpactProposals(
    project,
    report,
    args.proposalIds,
    Boolean(args.confirmFullLength),
  );

  Object.assign(project, nextProject);
  manager.notifyModified();
  manager.render();

  return {
    success: true,
    appliedProposalsCount: args.proposalIds.length,
    proposalIds: args.proposalIds,
  };
}
