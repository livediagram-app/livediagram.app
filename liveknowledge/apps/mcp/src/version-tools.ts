// Version history for agents (docs/specs/015-api/mcp-server.md §4.9e; docs/specs/006-document/version-history.md
// "MCP"): list_versions and restore_version over the api's GET .../tabs/:tabId/versions and POST
// .../versions/:versionId/restore, with exactly their authority. A missing version points at list_versions; a held
// element and a busy tab answer in the route's words, as update_document's do.
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Env } from '@liveworkspace/mcp-kit/env';
import type {
  DocumentResponse,
  VersionListResponse,
  VersionRestoreResponse,
} from '@liveknowledge/api-schema';
import { mcpListVersions, mcpRestoreVersion } from '@liveknowledge/agent-verbs/mcp';
import { ApiError, apiJson } from './api';
import { changesetErrorText } from './changeset-client';
import { registerTool } from './tool-annotations';
import { deepLink, errorResult, requireToken, textResult, ToolInputError } from './tool-helpers';

const tabPath = (documentId: string, tabId: string) =>
  `/documents/${encodeURIComponent(documentId)}/tabs/${encodeURIComponent(tabId)}/versions`;

export function registerVersionTools(server: McpServer, env: Env): void {
  registerTool(server, env, mcpListVersions, async (args, extra) => {
    const token = requireToken(extra);
    const { document } = await apiJson<DocumentResponse>(
      env,
      token,
      `/documents/${encodeURIComponent(args.documentId)}`,
    );
    const tabs = document.tabs
      .filter((t) => !t.outOfScope)
      .sort((a, b) => a.orderIndex - b.orderIndex);
    const tab = args.tabId === undefined ? tabs[0] : tabs.find((t) => t.id === args.tabId);
    if (!tab) {
      throw new ToolInputError(
        `No tab "${args.tabId ?? ''}" in this document. Tabs: ${tabs.map((t) => `${t.name} (${t.id})`).join(', ')}.`,
      );
    }
    const { versions } = await apiJson<VersionListResponse>(
      env,
      token,
      tabPath(args.documentId, tab.id),
    );
    return textResult({
      documentId: args.documentId,
      tabId: tab.id,
      tabName: tab.name,
      versions: versions.map((v) => ({
        id: v.id,
        rev: v.rev,
        kind: v.kind,
        name: v.name,
        author: v.author?.name ?? null,
        savedAt: new Date(v.savedAt).toISOString(),
      })),
      url: deepLink(env, args.documentId),
    });
  });

  registerTool(server, env, mcpRestoreVersion, async (args, extra) => {
    const token = requireToken(extra);
    const path = `${tabPath(args.documentId, args.tabId)}/${encodeURIComponent(args.versionId)}/restore`;
    let answer: VersionRestoreResponse;
    try {
      answer = await apiJson<VersionRestoreResponse>(env, token, path, { method: 'POST' });
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        throw new ToolInputError(
          `No version "${args.versionId}" of that tab: list_versions lists the tab's versions.`,
        );
      }
      if (err instanceof ApiError && err.status === 409)
        return errorResult(changesetErrorText(err));
      throw err;
    }
    const url = deepLink(env, args.documentId);
    if (!answer.restored) return textResult({ restored: false, tabId: args.tabId, url });
    return textResult({
      restored: true,
      tabId: answer.restored.tabId,
      rev: answer.restored.rev,
      changesetId: answer.restored.changesetId,
      undoVersionId: answer.restored.undoVersionId,
      url,
    });
  });
}
