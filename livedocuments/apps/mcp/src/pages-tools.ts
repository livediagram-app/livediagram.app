// The Pages tools (docs/specs/024-agents/pages-for-agents.md, docs/specs/015-api/mcp-server.md
// §4.9d): change_pages and write_article, over the verbs the CLI shares (@livedocuments/agent-verbs). Pages are
// named by id, place or name, articles by id or title; a refusal is a tool error that says what is there.
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { PageChange } from '@livedocuments/api-schema';
import { changePages, writeArticle, type PagesDone } from '@livedocuments/agent-verbs';
import { mcpChangePages, mcpStyleDocument, mcpWriteArticle } from '@livedocuments/agent-verbs/mcp';
import { apiJson, clientFor } from './api';
import type { DocumentResponse } from '@livedocuments/api-schema';
import type { Env } from '@liveworkspace/mcp-kit/env';
import { registerTool } from './tool-annotations';
import { VIEW_TOOL_META } from './view-tab';
import { deepLink, errorResult, requireToken, textResult } from './tool-helpers';

// A refusal names the change it stopped at, 1 first as the agent counts them.
const refusalText = (r: { message: string; change?: number }) =>
  r.change === undefined ? r.message : `Change ${r.change + 1}: ${r.message}`;

const answerOf = (env: Env, done: PagesDone) => ({
  documentId: done.documentId,
  tabId: done.tabId,
  lines: done.lines,
  pages: done.pages,
  articles: done.articles,
  rev: done.tab.rev,
  url: deepLink(env, done.documentId),
});

export function registerPagesTools(server: McpServer, env: Env): void {
  registerTool(
    server,
    env,
    mcpChangePages,
    async (args, extra) => {
      const api = clientFor(env, requireToken(extra));
      const done = await changePages(
        api,
        args.documentId,
        // A design by name passes as text: the api reads each change strictly and names the closest design.
        { ...(args.tabId ? { tabId: args.tabId } : {}), changes: args.changes as PageChange[] },
        'mcp',
      );
      if (!done.ok) return errorResult(refusalText(done));
      return textResult(answerOf(env, done));
    },
    VIEW_TOOL_META,
  );

  registerTool(
    server,
    env,
    mcpWriteArticle,
    async (args, extra) => {
      const api = clientFor(env, requireToken(extra));
      const { documentId, ...given } = args;
      // Only what was given: an absent field keeps the article's own.
      const write = Object.fromEntries(
        Object.entries(given).filter(([, v]) => v !== undefined),
      ) as Parameters<typeof writeArticle>[2];
      const done = await writeArticle(api, documentId, write, 'mcp');
      if (!done.ok) return errorResult(refusalText(done));
      if (!done.article) return errorResult('The article was written but could not be read back.');
      return textResult({ ...answerOf(env, done), article: done.article });
    },
    VIEW_TOOL_META,
  );
  // style_document: tab_style on the tab named, or on every tab the caller may reach, one edit each, so a theme
  // can change at any time (docs/specs/024-agents/pages-for-agents.md "Restyling a tab").
  registerTool(server, env, mcpStyleDocument, async (args, extra) => {
    const token = requireToken(extra);
    const { documentId, tabId, ...look } = args;
    const given = Object.fromEntries(Object.entries(look).filter(([, v]) => v !== undefined));
    if (Object.keys(given).length === 0)
      return errorResult('Give at least one of style, theme, font and finish.');
    const api = clientFor(env, token);
    const { document } = await apiJson<DocumentResponse>(
      env,
      token,
      `/documents/${encodeURIComponent(documentId)}`,
    );
    const nameOf = (id: string) => document.tabs.find((t) => t.id === id)?.name ?? id;
    const ids = tabId ? [tabId] : document.tabs.filter((t) => !t.outOfScope).map((t) => t.id);
    const tabs: { tabId: string; name: string; rev: number }[] = [];
    const lines: string[] = [];
    for (const id of ids) {
      const done = await changePages(
        api,
        documentId,
        { tabId: id, changes: [{ op: 'tab_style', ...given }] },
        'mcp',
      );
      if (!done.ok) {
        const before = tabs.length
          ? ` (${tabs.map((t) => `"${t.name}"`).join(', ')} restyled first)`
          : '';
        return errorResult(`${refusalText(done)}${before}`);
      }
      const name = nameOf(done.tabId);
      tabs.push({ tabId: done.tabId, name, rev: done.tab.rev });
      lines.push(...done.lines.map((l) => `"${name}": ${l}`));
    }
    return textResult({ documentId, tabs, lines, url: deepLink(env, documentId) });
  });
}
