// The MCP tools (docs/specs/015-api/mcp-server.md §4; docs/specs/024-agents/knowledgebase-for-agents.md). Each is a
// thin wrapper over the api worker: the page tools first (knowledge-read-tools.ts, knowledge-write-tools.ts), then
// the tools every liveworkspace app has for the knowledgebase itself. The api calls a knowledgebase a `document`,
// which is why those tools carry that word. The shared result and auth plumbing is tool-helpers.ts.
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type {
  DocumentResponse,
  KnowledgePagesResponse,
  ShareLinkResponse,
} from '@liveknowledge/api-schema';
import {
  DEFAULT_MCP_SHARE_LEVEL,
  isKnowledgePageRow,
  TRASH_RETENTION_DAYS,
  type TrashedDocument,
} from '@liveknowledge/api-schema';
import { templateCatalogue } from '@liveknowledge/templates';
import { ApiError, apiFetch, apiJson, clientFor, reportApiFailure } from './api';
import type { Env } from '@liveworkspace/mcp-kit/env';
import { deleteRefusal, knowledgePath, searchDocuments } from '@liveknowledge/agent-verbs';
import { deepLink, errorResult, requireToken, shareUrl, textResult } from './tool-helpers';
import { registerImageTools } from './image-tools';
import { registerTool } from './tool-annotations';
import { registerArchiveTools } from './archive-tools';
import { registerThreadTools } from './thread-tools';
import { registerRuleTools } from './rule-tools';
import { registerCreateTool } from './create-tool';
import { registerKnowledgeReadTools } from './knowledge-read-tools';
import { registerKnowledgeWriteTools } from './knowledge-write-tools';
import { registerPageFeedbackTools } from './page-feedback-tools';

import { pageRowNamed } from './page-named';
import {
  mcpDeleteDocument,
  mcpFindDocuments,
  mcpListTemplates,
  mcpListTrash,
  mcpRenameDocument,
  mcpRestoreDocument,
  mcpShareDocument,
} from '@liveknowledge/agent-verbs/mcp';

// The id of the page a rename or a delete names by id or title: one read of the page tree, no page's writing.
async function pageIdOf(env: Env, token: string, documentId: string, page: string) {
  const { pages } = await apiJson<KnowledgePagesResponse>(
    env,
    token,
    knowledgePath(documentId, 'pages'),
  );
  // A connected file in the tree is no page to rename or delete (links-and-embeds.md).
  return pageRowNamed(pages.filter(isKnowledgePageRow), page).tab;
}

export function registerTools(server: McpServer, env: Env): void {
  // The page tools, get_context at their head (docs/specs/024-agents/knowledgebase-for-agents.md).
  registerKnowledgeReadTools(server, env);
  registerKnowledgeWriteTools(server, env);
  registerPageFeedbackTools(server, env);

  registerTool(server, env, mcpFindDocuments, async (args, extra) => {
    const token = requireToken(extra);
    // Personal + team shared libraries (docs/specs/013-workspace/team-shared-documents.md): a knowledgebase filed
    // into a team leaves the personal list, so both are searched, at the index in one request
    // (@liveworkspace/agent-verbs/find `searchFiles`).
    const found = await searchDocuments(clientFor(env, token), args.query, args.limit ?? 20, {
      archived: args.archived,
    });
    const matched = found.map((d) => ({ ...d, url: deepLink(env, d.id) }));
    return textResult({
      count: matched.length,
      documents: matched,
      next:
        matched.length === 0
          ? 'No knowledgebase matches: try fewer words, or create_document makes one.'
          : 'get_context with a knowledgebase’s id as documentId, then search_pages.',
    });
  });

  registerCreateTool(server, env);

  registerTool(server, env, mcpRenameDocument, async (args, extra) => {
    const token = requireToken(extra);
    if (args.page) {
      // The tab name route: the name only, relayed to anyone with the knowledgebase open
      // (docs/specs/024-agents/agent-changesets.md "Whole-tab saves and tab renames").
      const page = await pageIdOf(env, token, args.documentId, args.page);
      const { tab } = await apiJson<{ tab: { name: string } }>(
        env,
        token,
        `${knowledgePath(args.documentId, 'tabs', page)}/name`,
        { method: 'PUT', body: JSON.stringify({ name: args.name }) },
      );
      return textResult({ renamed: 'page', page, name: tab.name });
    }
    const { document: liveDoc } = await apiJson<DocumentResponse>(
      env,
      token,
      knowledgePath(args.documentId),
      { method: 'PUT', body: JSON.stringify({ name: args.name }) },
    );
    return textResult({
      renamed: 'document',
      id: liveDoc.id,
      name: liveDoc.name,
      url: deepLink(env, liveDoc.id),
    });
  });

  registerTool(server, env, mcpShareDocument, async (args, extra) => {
    const token = requireToken(extra);
    // Default to Participant (docs/specs/013-workspace/share-roles.md): people take part without reshaping the
    // knowledgebase, and an automated share never silently grants edit. The api's own default is edit, so the role
    // is always sent.
    const role = args.role ?? DEFAULT_MCP_SHARE_LEVEL;
    const { link } = await apiJson<ShareLinkResponse>(
      env,
      token,
      `${knowledgePath(args.documentId)}/share`,
      { method: 'POST', body: JSON.stringify({ role, expiry: args.expiry ?? 'never' }) },
    );
    return textResult({
      url: shareUrl(env, link.code),
      role: link.role,
      expiresAt: link.expiresAt,
      documentUrl: deepLink(env, args.documentId),
    });
  });

  // Archived (docs/specs/015-api/mcp-server.md "Archived"): archive_document and unarchive_document.
  registerArchiveTools(server, env);

  registerTool(server, env, mcpDeleteDocument, async (args, extra) => {
    const token = requireToken(extra);
    // A whole knowledgebase only ever goes to the Trash (docs/specs/013-workspace/trash.md): a permanent delete
    // is the REST API's, never an AI tool's. A page goes to its knowledgebase's page Trash (knowledgebases-and-
    // pages.md "The page Trash"), which a person restores from in the editor.
    const page = args.page ? await pageIdOf(env, token, args.documentId, args.page) : null;
    const path = page
      ? knowledgePath(args.documentId, 'tabs', page)
      : knowledgePath(args.documentId);
    // DELETE returns 204 with no body, so use apiFetch (apiJson would choke
    // parsing an empty response) and surface a clear message on failure.
    const res = await apiFetch(env, token, path, { method: 'DELETE' });
    if (!res.ok) {
      // A 5xx is a real failure worth surfacing on the Exceptions dashboard;
      // a 4xx (bad id, last page) is model-correctable and not reported.
      if (res.status >= 500) reportApiFailure(env, `Http${res.status}`);
      return errorResult(`Could not delete (${res.status}). ${deleteWords(res.status, !!page)}`);
    }
    return textResult(
      page
        ? {
            deleted: 'page',
            documentId: args.documentId,
            page,
            trashed: true,
            restorableForDays: TRASH_RETENTION_DAYS,
          }
        : {
            deleted: 'document',
            documentId: args.documentId,
            trashed: true,
            restorableForDays: TRASH_RETENTION_DAYS,
          },
    );
  });

  registerTool(server, env, mcpRestoreDocument, async (args, extra) => {
    const token = requireToken(extra);
    try {
      const { document: liveDoc } = await apiJson<{
        document?: { id: string; name: string } | null;
      }>(env, token, `/trash/${encodeURIComponent(args.documentId)}/restore`, { method: 'POST' });
      return textResult({
        restored: 'document',
        id: liveDoc?.id ?? args.documentId,
        name: liveDoc?.name ?? null,
        url: deepLink(env, liveDoc?.id ?? args.documentId),
      });
    } catch (err) {
      // Not in the Trash, or not the user's to restore: model-correctable.
      if (err instanceof ApiError && err.status === 404) {
        return errorResult(
          'That knowledgebase is not in the Trash, or is not yours to restore. Check the id with list_trash.',
        );
      }
      throw err;
    }
  });

  // The Trash (docs/specs/013-workspace/trash.md, docs/specs/015-api/mcp-server.md §4.9):
  // what delete_document put there, and the way back. Same authorisation as
  // GET /api/trash and POST /api/trash/<id>/restore: the user's personal Trash
  // and every team Trash they have joined.
  registerTool(server, env, mcpListTrash, async (_args, extra) => {
    const token = requireToken(extra);
    const { trash } = await apiJson<{ trash?: TrashedDocument[] }>(env, token, '/trash');
    return textResult({
      trash: (trash ?? []).map((t) => ({
        id: t.id,
        name: t.name,
        library: t.teamName ?? (t.teamId ? 'team' : 'personal'),
        reason: t.reason,
        deletedAt: new Date(t.trashedAt).toISOString(),
        purgeAt: new Date(t.purgeAt).toISOString(),
      })),
    });
  });

  registerTool(server, env, mcpListTemplates, async (_args, extra) => {
    requireToken(extra);
    return textResult(templateCatalogue());
  });

  // The user's image gallery (docs/specs/015-api/mcp-server.md §4.5b).
  registerImageTools(server, env);

  // Comment threads (docs/specs/015-api/mcp-server.md "Comment threads"): list_threads and change_threads.
  registerThreadTools(server, env);

  // Automations rules (docs/specs/013-workspace/automations.md "Agents"): list_rules and change_rules.
  registerRuleTools(server, env);
}

// Why a delete was refused, in this product's words: the shared ones name a page a tab and point at a tool this
// server does not have.
function deleteWords(status: number, page: boolean): string {
  if (page && status === 404)
    return 'No such page in this knowledgebase: list_pages lists its pages.';
  if (page && status === 409) return 'A knowledgebase keeps at least one page: this is its last.';
  if (status === 403)
    return 'This connection may not delete here: deleting needs the write scope, for an Editor’s connection (get_context lists the scopes).';
  return deleteRefusal(status, page);
}
