// The Illustrate tools (docs/specs/024-agents/illustrate-for-agents.md, docs/specs/015-api/mcp-server.md
// §4.9d): change_pages and write_article, over the verbs the CLI shares (@livediagram/agent-verbs). Pages are
// named by id, place or name, articles by id or title; a refusal is a tool error that says what is there.
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { PageChange } from '@livediagram/api-schema';
import { changePages, writeArticle, type IllustrateDone } from '@livediagram/agent-verbs';
import { mcpChangePages, mcpWriteArticle } from '@livediagram/agent-verbs/mcp';
import { clientFor } from './api';
import type { Env } from './env';
import { registerTool } from './tool-annotations';
import { deepLink, errorResult, requireToken, textResult, type Extra } from './tool-helpers';

// A refusal names the change it stopped at, 1 first as the agent counts them.
const refusalText = (r: { message: string; change?: number }) =>
  r.change === undefined ? r.message : `Change ${r.change + 1}: ${r.message}`;

const answerOf = (env: Env, done: IllustrateDone) => ({
  documentId: done.documentId,
  tabId: done.tabId,
  switched: done.switched,
  lines: done.lines,
  pages: done.pages,
  articles: done.articles,
  rev: done.tab.rev,
  url: deepLink(env, done.documentId),
});

export function registerIllustrateTools(server: McpServer, env: Env): void {
  registerTool(server, env, mcpChangePages, async (args, extra) => {
    const api = clientFor(env, requireToken(extra as Extra));
    const done = await changePages(
      api,
      args.documentId,
      { ...(args.tabId ? { tabId: args.tabId } : {}), changes: args.changes as PageChange[] },
      'mcp',
    );
    if (!done.ok) return errorResult(refusalText(done));
    return textResult(answerOf(env, done));
  });

  registerTool(server, env, mcpWriteArticle, async (args, extra) => {
    const api = clientFor(env, requireToken(extra as Extra));
    const { documentId, ...given } = args;
    // Only what was given: an absent field keeps the article's own.
    const write = Object.fromEntries(
      Object.entries(given).filter(([, v]) => v !== undefined),
    ) as Parameters<typeof writeArticle>[2];
    const done = await writeArticle(api, documentId, write, 'mcp');
    if (!done.ok) return errorResult(refusalText(done));
    if (!done.article) return errorResult('The article was written but could not be read back.');
    return textResult({ ...answerOf(env, done), article: done.article });
  });
}
