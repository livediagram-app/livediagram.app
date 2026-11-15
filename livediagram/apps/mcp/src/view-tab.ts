// The interactive view (docs/specs/015-api/mcp-server.md "Interactive view (MCP Apps)"): the `ui://` page the
// drawing tools link, view_tab, the call the page makes through the host to draw a tab, and view_live, the view-only
// room ticket it follows the document with ("Live updates"). The page holds no lasting credential: every view_tab is
// the user's own token through the api's read gate, a ticket lapses in minutes, and no share link is minted.
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Env } from '@liveworkspace/mcp-kit/env';
import {
  appOnlyToolMeta,
  registerViewResource,
  socketOriginOf,
  toolUiMeta,
} from '@liveworkspace/mcp-kit/app-view';
import { canvasViewResult, clickableBoxes, viewBoxOf } from '@liveworkspace/mcp-kit/app-view-tab';
import type { RoomTicketResponse } from '@livediagram/api-schema';
import { computeRefs, visibleLayerElements, type Tab } from '@livediagram/document';
import { mcpViewLive, mcpViewTab } from '@livediagram/agent-verbs/mcp';
import { apiJson } from './api';
import { tabSvg } from './image-result';
import { registerTool } from './tool-annotations';
import {
  appBase,
  deepLink,
  errorResult,
  loadTab,
  requireToken,
  type ToolResult,
} from './tool-helpers';

export const VIEW_URI = 'ui://livediagram/view.html';

// The `_meta` create_document, add_tab, update_document and read_document carry to link the view.
export const VIEW_TOOL_META = toolUiMeta(VIEW_URI);

// Every boxed element the SVG draws, bottom to top, with its ref and label: what a click in the view can open.
export function clickableElements(tab: Tab) {
  const refs = computeRefs(tab.elements.map((el) => el.id));
  return clickableBoxes(visibleLayerElements(tab.elements, tab.layers), (id) => refs.refOf(id));
}

export async function viewTab(
  env: Env,
  token: string,
  args: { documentId: string; tabId?: string },
): Promise<ToolResult> {
  const loaded = await loadTab(env, token, args.documentId, args.tabId);
  if (!loaded) return errorResult('That document has no tabs.');
  const { document, tab } = loaded;
  const { svg } = await tabSvg(tab, { env, token });
  // The text block is one line, not the SVG (the spec's "view_tab").
  return canvasViewResult({
    documentId: args.documentId,
    tabId: tab.id,
    name: tab.name,
    tabs: document.tabs.map((t) => ({ id: t.id, name: t.name })),
    svg,
    viewBox: viewBoxOf(svg),
    elements: clickableElements(tab),
    url: deepLink(env, args.documentId),
  });
}

// The room's socket for a document, on this deployment's editor host, as the view opens it with `?t=`.
export const roomSocketUrl = (env: Pick<Env, 'CONSENT_BASE_URL'>, documentId: string) =>
  `${socketOriginOf(appBase(env))}/api/documents/${encodeURIComponent(documentId)}/ws`;

// view_live: a view-only ticket minted for the token's owner (`?cap=view`), so the view never holds the owner's
// grant and a read-only token may follow too. The ticket rides structured content only: the text line, the logs and
// the telemetry never carry it.
export async function viewLive(
  env: Env,
  token: string,
  args: { documentId: string },
): Promise<ToolResult> {
  const answer = await apiJson<RoomTicketResponse>(
    env,
    token,
    `/documents/${encodeURIComponent(args.documentId)}/room-ticket?cap=view`,
    { method: 'POST' },
  );
  if (typeof answer.expiresAt !== 'number') return errorResult('Live updates are unavailable.');
  console.info('[mcp] view_live', {
    lapsesInS: Math.round((answer.expiresAt - Date.now()) / 1000),
  });
  return {
    content: [{ type: 'text', text: 'Opened live updates for the interactive view.' }],
    structuredContent: {
      documentId: args.documentId,
      url: roomSocketUrl(env, args.documentId),
      ticket: answer.ticket,
      expiresAt: answer.expiresAt,
    },
  };
}

// The page, listed on the server beside the schema resource (server.ts). Its CSP allows the one socket the view
// opens: the editor host's room.
export function registerViewPage(server: McpServer, env: Pick<Env, 'CONSENT_BASE_URL'>): void {
  registerViewResource(server, {
    uri: VIEW_URI,
    app: 'livediagram',
    title: 'livediagram view',
    connectDomains: [socketOriginOf(appBase(env))],
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
