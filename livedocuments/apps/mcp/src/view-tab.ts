// The interactive view (docs/specs/015-api/mcp-server.md "Interactive view (MCP Apps)"): the `ui://` page the drawing
// tools link, and view_tab, the call the page makes through the host to draw one page of a tab. The page holds no
// lasting credential: every view_tab is the user's own token through the api's read gate, and no share link is minted.
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Env } from '@liveworkspace/mcp-kit/env';
import { appOnlyToolMeta, registerViewResource, toolUiMeta } from '@liveworkspace/mcp-kit/app-view';
import {
  canvasViewResult,
  clickableBoxes,
  pageOrFirst,
  viewBoxOf,
  viewPagesOf,
} from '@liveworkspace/mcp-kit/app-view-tab';
import { VIEW_PICTURE_LIMITS } from '@liveworkspace/mcp-kit/preview-budget';
import {
  computeRefs,
  pagesWithWriting,
  visibleLayerElements,
  type LaidOutPage,
  type Tab,
} from '@livedocuments/document';
import { mcpViewTab } from '@livedocuments/agent-verbs/mcp';
import { tabSvg } from './image-result';
import { registerTool } from './tool-annotations';
import { deepLink, errorResult, loadTab, requireToken, type ToolResult } from './tool-helpers';

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
  args: { documentId: string; tabId?: string; pageId?: string },
): Promise<ToolResult> {
  const loaded = await loadTab(env, token, args.documentId, args.tabId);
  if (!loaded) return errorResult('That document has no tabs.');
  const { document, tab } = loaded;
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
  });
}

// The page, listed on the server beside the schema resource (server.ts). It opens no connection: the view does not
// follow the room yet ("Live updates").
export function registerViewPage(server: McpServer): void {
  registerViewResource(server, {
    uri: VIEW_URI,
    app: 'livedocuments',
    title: 'livedocuments view',
    viewer: { idKey: 'documentId', live: false },
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
