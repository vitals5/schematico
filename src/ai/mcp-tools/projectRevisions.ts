import type { McpToolDefinition } from './definitions';
import type { CanvasStateManager } from './handlers';
import {
  savedRevisions,
  saveProjectRevision,
  releaseProjectRevision,
} from '../../model/ProjectRevisions';

export const LIST_PROJECT_REVISIONS_TOOL: McpToolDefinition = {
  name: 'list_project_revisions',
  description:
    'Lists all saved and released project revisions, including revision ID, name, description, creation timestamp, author, status (draft, approved, released), and approval details.',
  inputSchema: {
    type: 'object',
    properties: {},
  },
};

export const CREATE_PROJECT_REVISION_TOOL: McpToolDefinition = {
  name: 'create_project_revision',
  description:
    'Creates a saved snapshot or approved release revision of the current project state, with immutable SHA-256 digest, author attribution, and optional approval notes.',
  inputSchema: {
    type: 'object',
    properties: {
      name: {
        type: 'string',
        description: 'Name or title for the revision (e.g. "Freigabe Vorplanung", "Revision 1.1 - Motoren ergänzt").',
      },
      description: {
        type: 'string',
        description: 'Optional detailed description of the revision changes.',
      },
      author: {
        type: 'string',
        description: 'Author of the revision (defaults to project author or current user).',
      },
      release: {
        type: 'boolean',
        description: 'If true, marks the revision as released/approved.',
      },
      approver: {
        type: 'string',
        description: 'Name of the approving authority (required when release is true).',
      },
    },
    required: ['name'],
  },
};

export async function handleListProjectRevisions(
  _args: any,
  manager: CanvasStateManager,
) {
  const project = manager.getProject();
  const revisions = savedRevisions(project);

  return {
    success: true,
    count: revisions.length,
    revisions: revisions.map((r) => ({
      id: r.id,
      name: r.name,
      reason: r.reason,
      created: r.created,
      author: r.author,
      status: r.status,
      approval: r.approval,
      digest: r.digest,
      bytes: r.bytes,
      pages: r.pages,
    })),
  };
}

export async function handleCreateProjectRevision(
  args: {
    name: string;
    description?: string;
    reason?: string;
    author?: string;
    release?: boolean;
    approver?: string;
  },
  manager: CanvasStateManager,
) {
  const project = manager.getProject();
  const name = args.name?.trim();
  if (!name) {
    throw new Error('Name für Revisionsstand erforderlich.');
  }

  const author = args.author?.trim() || project.author || 'AI Assistant';
  const reason = args.reason?.trim() || args.description?.trim() || 'Projektstand gespeichert';

  let nextProject = await saveProjectRevision(project, {
    name,
    author,
    reason,
  });

  if (args.release) {
    const list = savedRevisions(nextProject);
    const newest = list[0];
    if (newest && newest.status !== 'released') {
      const approver = args.approver?.trim() || author;
      nextProject = await releaseProjectRevision(nextProject, newest.id, approver, reason);
    }
  }

  Object.assign(project, nextProject);
  manager.notifyModified();
  manager.render();

  const created = savedRevisions(project)[0];
  return {
    success: true,
    revision: created,
  };
}
