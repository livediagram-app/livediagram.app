// Archived for agents (docs/specs/015-api/mcp-server.md "Archived"; liveworkspace/docs/specs/004-index/one-explorer-contracts.md
// "Archived"): archive_design puts a design its owner made away, and unarchive_design moves it back, through the api's
// POST /api/designs/:id/archive and /unarchive. A refusal (not the owner, in the Trash, no such design) answers in
// words, as every api refusal does (registerTool, apiRefusalOf); find_designs with archived true lists them.
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Env } from '@liveworkspace/mcp-kit/env';
import { mcpArchiveDesign, mcpUnarchiveDesign } from '@livedesign/agent-verbs/mcp';
import { apiJson } from './api';
import { registerTool } from './tool-annotations';
import { deepLink, requireToken, textResult } from './tool-helpers';

type Moved = { design: { id: string; name?: string | null; teamId?: string | null } };

const door = (id: string, to: 'archive' | 'unarchive') =>
  `/designs/${encodeURIComponent(id)}/${to}`;

export function registerArchiveTools(server: McpServer, env: Env): void {
  registerTool(server, env, mcpArchiveDesign, async (args, extra) => {
    const token = requireToken(extra);
    const { design } = await apiJson<Moved>(env, token, door(args.designId, 'archive'), {
      method: 'POST',
    });
    return textResult({ archived: 'design', id: design.id, name: design.name ?? null });
  });

  registerTool(server, env, mcpUnarchiveDesign, async (args, extra) => {
    const token = requireToken(extra);
    const { design } = await apiJson<Moved>(env, token, door(args.designId, 'unarchive'), {
      method: 'POST',
      body: JSON.stringify({ folderId: args.folderId ?? null, teamId: args.teamId ?? null }),
    });
    return textResult({
      unarchived: 'design',
      id: design.id,
      name: design.name ?? null,
      library: design.teamId ? await teamName(env, token, design.teamId) : 'personal',
      url: deepLink(env, design.id),
    });
  });
}

// The team's name for `library`, as find_designs names it; its id when the teams list is unavailable.
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
