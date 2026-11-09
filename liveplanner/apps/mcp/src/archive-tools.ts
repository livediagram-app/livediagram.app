// Archived for agents (docs/specs/015-api/mcp-server.md "Archived"; liveworkspace/docs/specs/004-index/one-explorer-contracts.md
// "Archived"): archive_project puts a plan its owner made away, and unarchive_project moves it back, through the api's
// POST /api/projects/:id/archive and /unarchive. A refusal (not the owner, in the Trash, no such plan) answers in
// words, as every api refusal does (registerTool, apiRefusalOf); find_projects with archived true lists them.
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Env } from '@liveworkspace/mcp-kit/env';
import { mcpArchiveProject, mcpUnarchiveProject } from '@liveplanner/agent-verbs/mcp';
import { apiJson } from './api';
import { registerTool } from './tool-annotations';
import { deepLink, requireToken, textResult } from './tool-helpers';

type Moved = { project: { id: string; name?: string | null; teamId?: string | null } };

const door = (id: string, to: 'archive' | 'unarchive') =>
  `/projects/${encodeURIComponent(id)}/${to}`;

export function registerArchiveTools(server: McpServer, env: Env): void {
  registerTool(server, env, mcpArchiveProject, async (args, extra) => {
    const token = requireToken(extra);
    const { project } = await apiJson<Moved>(env, token, door(args.projectId, 'archive'), {
      method: 'POST',
    });
    return textResult({ archived: 'project', id: project.id, name: project.name ?? null });
  });

  registerTool(server, env, mcpUnarchiveProject, async (args, extra) => {
    const token = requireToken(extra);
    const { project } = await apiJson<Moved>(env, token, door(args.projectId, 'unarchive'), {
      method: 'POST',
      body: JSON.stringify({ folderId: args.folderId ?? null, teamId: args.teamId ?? null }),
    });
    return textResult({
      unarchived: 'project',
      id: project.id,
      name: project.name ?? null,
      library: project.teamId ? await teamName(env, token, project.teamId) : 'personal',
      url: deepLink(env, project.id),
    });
  });
}

// The team's name for `library`, as find_projects names it; its id when the teams list is unavailable.
async function teamName(env: Env, token: string, teamId: string): Promise<string> {
  try {
    const { teams } = await apiJson<{ teams: { id: string; name: string }[] }>(
      env,
      token,
      '/teams',
    );
    return teams.find((t) => t.id === teamId)?.name ?? teamId;
  } catch {
    return teamId;
  }
}
