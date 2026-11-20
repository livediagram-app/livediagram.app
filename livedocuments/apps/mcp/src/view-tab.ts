// The interactive view (docs/specs/015-api/mcp-server.md "Interactive view (MCP Apps)"): the `ui://` page the tools
// link, view_tab, the call the page makes through the host to draw one page of a tab, and view_live, the view-only room
// ticket it follows the document with ("Live updates"). The page holds no lasting credential: every call is the user's
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
import {
  canvasViewResult,
  clickableBoxes,
  pageOrFirst,
  viewBoxOf,
  viewPagesOf,
} from '@liveworkspace/mcp-kit/app-view-tab';
import {
  earlierStepResult,
  laterStepPath,
  laterStepSince,
  type StepChangeset,
} from '@liveworkspace/mcp-kit/app-view-step';
import { VIEW_PICTURE_LIMITS } from '@liveworkspace/mcp-kit/preview-budget';
import {
  computeRefs,
  pagesWithWriting,
  visibleLayerElements,
  type LaidOutPage,
  type Tab,
} from '@livedocuments/document';
import { mcpViewLive, mcpViewTab } from '@livedocuments/agent-verbs/mcp';
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

export const VIEW_URI = 'ui://livedocuments/view.html';

// The `_meta` the tools that draw or read a tab carry to link the view (tools.ts, tab-tools.ts, pages-tools.ts).
export const VIEW_TOOL_META = toolUiMeta(VIEW_URI);

// What one page of a tab offers the view: its SVG's source page, the pages for the pager, and the elements a click
// can open (those drawn on the page, its hidden layers left out).
export function pageView(tab: Tab, pageId?: string) {
  const laid = pagesWithWriting(tab);
  const page: LaidOutPage | undefined = pageOrFirst(laid.pages, pageId);
  const refs = computeRefs(tab.elements.map((el) => el.id));
  const drawn = visibleLayerElements(tab.elements, tab.layers);
  const elements = clickableBoxes(drawn, (id) => refs.refOf(id), page?.rect);
  // Only the shown page's pictures are embedded: the elements reaching onto it.
  const onPage = new Set(elements.map((e) => e.id));
  const pictures = { ...tab, elements: tab.elements.filter((el) => onPage.has(el.id)) };
  return { page, pages: viewPagesOf(laid.pages), elements, pictures, writingSvg: laid.writing };
}

export async function viewTab(
  env: Env,
  token: string,
  args: { documentId: string; tabId?: string; pageId?: string; rev?: number; held?: boolean },
): Promise<ToolResult> {
  const loaded = await loadTab(env, token, args.documentId, args.tabId);
  if (!loaded) return errorResult('That document has no tabs.');
  const { document, tab } = loaded;
  // One live view: a view that names its own step hears whether an agent changed the tab after it, and one holding
  // that step's picture gets no drawing.
  const superseded = await laterStepSince(
    () =>
      apiJson<{ changesets?: StepChangeset[] }>(
        env,
        token,
        laterStepPath('documents', args.documentId, tab.id),
      ),
    args.rev,
  );
  if (superseded && args.held)
    return earlierStepResult({
      documentId: args.documentId,
      tabId: tab.id,
      name: tab.name,
      url: deepLink(env, args.documentId),
      rev: tab.rev,
      pageId: null,
      pages: [],
    });
  const { page, pages, elements, pictures, writingSvg } = pageView(tab, args.pageId);
  const { svg } = await tabSvg(tab, { env, token }, page, {
    limits: VIEW_PICTURE_LIMITS,
    pictures,
    writingSvg,
  });
  return canvasViewResult({
    documentId: args.documentId,
    tabId: tab.id,
    name: tab.name,
    tabs: document.tabs.map((t) => ({ id: t.id, name: t.name })),
    pageId: page?.id ?? null,
    pages,
    svg,
    viewBox: viewBoxOf(svg),
    elements,
    url: deepLink(env, args.documentId),
    rev: tab.rev,
    ...(superseded ? { superseded } : {}),
  });
}

// view_live: a view-only ticket into the document's room, minted for the token's owner (`?cap=view`), so the view never
// holds the owner's grant and a read-only token may follow too ("Live updates"). The shared answer keeps the ticket
// out of the text line and the logs.
export async function viewLive(
  env: Env,
  token: string,
  args: { documentId: string },
): Promise<ToolResult> {
  const id = args.documentId;
  const answer = await apiJson<ViewTicket>(env, token, viewTicketPath('documents', id), {
    method: 'POST',
  });
  return viewLiveResult({
    idKey: 'documentId',
    id,
    url: roomSocketUrl(appBase(env), 'documents', id),
    answer,
  });
}

// The page, listed on the server beside the schema resource (server.ts). Its CSP allows the one socket the view
// opens: the editor host's room ("Live updates").
export function registerViewPage(server: McpServer, env: Pick<Env, 'CONSENT_BASE_URL'>): void {
  registerViewResource(server, {
    uri: VIEW_URI,
    app: 'livedocuments',
    title: 'livedocuments view',
    connectDomains: [socketOriginOf(appBase(env))],
    viewer: { idKey: 'documentId' },
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
