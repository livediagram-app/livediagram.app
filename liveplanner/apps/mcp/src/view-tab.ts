// The interactive view (docs/specs/015-api/mcp-server.md "Interactive view (MCP Apps)"): the `ui://` page the tools
// link, view_tab, the call the page makes through the host to draw a tab's boards, and view_live, the view-only room
// ticket it follows the plan with ("Live updates"). The page holds no lasting credential: every call is the user's
// own token through the api's gates, a ticket lapses in minutes and only watches, and no share link is minted.
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Env } from '@liveworkspace/mcp-kit/env';
import {
  appOnlyToolMeta,
  registerViewResource,
  socketOriginOf,
  toolUiMeta,
} from '@liveworkspace/mcp-kit/app-view';
import {
  roomSocketUrl,
  viewLiveResult,
  viewTicketPath,
  type ViewTicket,
} from '@liveworkspace/mcp-kit/app-view-live';
import { readPlanState } from '@liveplanner/agent-verbs';
import { mcpViewLive, mcpViewTab } from '@liveplanner/agent-verbs/mcp';
import { apiJson, clientFor } from './api';
import { boardView } from './board-view';
import { registerTool } from './tool-annotations';
import { appBase, deepLink, requireToken, type ToolResult } from './tool-helpers';

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

// view_live: a view-only ticket into the plan's room, minted for the token's owner (`?cap=view`), so the view never
// holds the owner's grant and a read-only token may follow too ("Live updates"). The shared answer keeps the ticket
// out of the text line and the logs.
export async function viewLive(
  env: Env,
  token: string,
  args: { projectId: string },
): Promise<ToolResult> {
  const id = args.projectId;
  const answer = await apiJson<ViewTicket>(env, token, viewTicketPath('projects', id), {
    method: 'POST',
  });
  return viewLiveResult({
    idKey: 'projectId',
    id,
    url: roomSocketUrl(appBase(env), 'projects', id),
    answer,
  });
}

// The page, listed on the server beside the schema resource (server.ts). Its CSP allows the one socket the view
// opens: the editor host's room ("Live updates").
export function registerViewPage(server: McpServer, env: Pick<Env, 'CONSENT_BASE_URL'>): void {
  registerViewResource(server, {
    uri: VIEW_URI,
    app: 'liveplanner',
    title: 'liveplanner view',
    connectDomains: [socketOriginOf(appBase(env))],
    viewer: { idKey: 'projectId', board: true, word: 'plan' },
  });
}

// view_tab and view_live, registered last of the tools (tools.ts), as the catalogue orders them.
export function registerViewTool(server: McpServer, env: Env): void {
  registerTool(
    server,
    env,
    mcpViewTab,
    async (args, extra) => viewTab(env, requireToken(extra), args),
    appOnlyToolMeta(),
  );
  registerTool(
    server,
    env,
    mcpViewLive,
    async (args, extra) => viewLive(env, requireToken(extra), args),
    appOnlyToolMeta(),
  );
}
