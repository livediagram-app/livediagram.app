// The Pages tools (docs/specs/024-agents/pages-for-agents.md, docs/specs/015-api/mcp-server.md
// §4.9d): change_pages, over the verb the CLI shares (@livedesign/agent-verbs). Pages are named by id,
// place or name; a refusal is a tool error that says what is there.
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { changePages, type PagesDone } from '@livedesign/agent-verbs';
import { mcpChangePages } from '@livedesign/agent-verbs/mcp';
import { clientFor } from './api';
import type { Env } from './env';
import { registerTool } from './tool-annotations';
import { deepLink, errorResult, requireToken, textResult } from './tool-helpers';

// A refusal names the change it stopped at, 1 first as the agent counts them.
const refusalText = (r: { message: string; change?: number }) =>
  r.change === undefined ? r.message : `Change ${r.change + 1}: ${r.message}`;

const answerOf = (env: Env, done: PagesDone) => ({
  designId: done.designId,
  tabId: done.tabId,
  lines: done.lines,
  pages: done.pages,
  rev: done.tab.rev,
  url: deepLink(env, done.designId),
});

export function registerPagesTools(server: McpServer, env: Env): void {
  registerTool(server, env, mcpChangePages, async (args, extra) => {
    const api = clientFor(env, requireToken(extra));
    const done = await changePages(
      api,
      args.designId,
      { ...(args.tabId ? { tabId: args.tabId } : {}), changes: args.changes },
      'mcp',
    );
    if (!done.ok) return errorResult(refusalText(done));
    return textResult(answerOf(env, done));
  });
}
