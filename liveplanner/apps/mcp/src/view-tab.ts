// The interactive view (docs/specs/015-api/mcp-server.md "Interactive view (MCP Apps)"): the `ui://` page list_items
// and read_project link, and view_tab, the call the page makes through the host to draw a tab's boards. The page holds
// no lasting credential: every view_tab is the user's own token through the api's read gate, and no share link is
// minted.
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Env } from '@liveworkspace/mcp-kit/env';
import { appOnlyToolMeta, registerViewResource, toolUiMeta } from '@liveworkspace/mcp-kit/app-view';
import { readPlanState } from '@liveplanner/agent-verbs';
import { mcpViewTab } from '@liveplanner/agent-verbs/mcp';
import { clientFor } from './api';
import { boardView } from './board-view';
import { registerTool } from './tool-annotations';
import { deepLink, requireToken, type ToolResult } from './tool-helpers';

export const VIEW_URI = 'ui://liveplanner/view.html';

// The `_meta` list_items and read_project carry to link the view (plan-tools.ts, tools.ts).
export const VIEW_TOOL_META = toolUiMeta(VIEW_URI);

export async function viewTab(
  env: Env,
  token: string,
  args: { projectId: string; tabId?: string },
): Promise<ToolResult> {
  const state = await readPlanState(clientFor(env, token), args.projectId);
  const view = boardView(state, args.tabId);
  const drawn = view.boards.reduce(
    (n, b) => n + b.columns.reduce((m, c) => m + c.cards.length, 0),
    0,
  );
  console.info('[mcp] view_tab', { boards: view.boards.length, cards: drawn });
  // The text block is one line (the spec's "view_tab"): list_items stays the model's read.
  const text = view.boards.length
    ? `Drew the boards on tab "${view.name}" for the interactive view.`
    : 'This plan has no board to draw.';
  return {
    content: [{ type: 'text', text }],
    structuredContent: { projectId: args.projectId, ...view, url: deepLink(env, args.projectId) },
  };
}

// The page, listed on the server beside the schema resource (server.ts). It opens no connection.
export function registerViewPage(server: McpServer): void {
  registerViewResource(server, {
    uri: VIEW_URI,
    app: 'liveplanner',
    title: 'liveplanner view',
    viewer: { idKey: 'projectId', board: true, live: false },
  });
}

// view_tab, registered last of the tools (tools.ts), as the catalogue orders it.
export function registerViewTool(server: McpServer, env: Env): void {
  registerTool(
    server,
    env,
    mcpViewTab,
    async (args, extra) => viewTab(env, requireToken(extra), args),
    appOnlyToolMeta(),
  );
}
