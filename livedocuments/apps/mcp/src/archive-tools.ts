// Archived for agents (docs/specs/015-api/mcp-server.md "Archived"; liveworkspace/docs/specs/004-index/one-explorer-contracts.md
// "Archived"): archive_document puts a document its owner made away, and unarchive_document moves it back, through the api's
// POST /api/documents/:id/archive and /unarchive. A refusal (not the owner, in the Trash, no such document) answers in
// words, as every api refusal does (registerTool, apiRefusalOf); find_documents with archived true lists them.
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Env } from '@liveworkspace/mcp-kit/env';
import { mcpArchiveDocument, mcpUnarchiveDocument } from '@livedocuments/agent-verbs/mcp';
import { apiJson } from './api';
import { registerTool } from './tool-annotations';
import { deepLink, requireToken, textResult } from './tool-helpers';

type Moved = { document: { id: string; name?: string | null; teamId?: string | null } };

const door = (id: string, to: 'archive' | 'unarchive') =>
  `/documents/${encodeURIComponent(id)}/${to}`;

export function registerArchiveTools(server: McpServer, env: Env): void {
  registerTool(server, env, mcpArchiveDocument, async (args, extra) => {
    const token = requireToken(extra);
    const { document } = await apiJson<Moved>(env, token, door(args.documentId, 'archive'), {
      method: 'POST',
    });
    return textResult({ archived: 'document', id: document.id, name: document.name ?? null });
  });

  registerTool(server, env, mcpUnarchiveDocument, async (args, extra) => {
    const token = requireToken(extra);
    const { document } = await apiJson<Moved>(env, token, door(args.documentId, 'unarchive'), {
      method: 'POST',
      body: JSON.stringify({ folderId: args.folderId ?? null, teamId: args.teamId ?? null }),
    });
    return textResult({
      unarchived: 'document',
      id: document.id,
      name: document.name ?? null,
      library: document.teamId ? await teamName(env, token, document.teamId) : 'personal',
      url: deepLink(env, document.id),
    });
  });
}

// The team's name for `library`, as find_documents names it; its id when the teams list is unavailable.
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
