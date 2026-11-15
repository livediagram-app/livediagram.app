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
  laidOutPagesOf,
  visibleLayerElements,
  type LaidOutPage,
  type Tab,
} from '@livedesign/design';
import { mcpViewTab } from '@livedesign/agent-verbs/mcp';
import { tabSvg } from './image-result';
import { registerTool } from './tool-annotations';
import { deepLink, errorResult, loadTab, requireToken, type ToolResult } from './tool-helpers';

export const VIEW_URI = 'ui://livedesign/view.html';

// The `_meta` the tools that draw or read a tab carry to link the view (tools.ts, tab-tools.ts, pages-tools.ts).
export const VIEW_TOOL_META = toolUiMeta(VIEW_URI);

// What one page of a tab offers the view: the page to draw (none for a tab not in Pages, which draws whole), the
// pages for the pager, and the elements a click can open (those drawn on the page, its hidden layers left out).
export function pageView(tab: Tab, pageId?: string) {
  const laid = laidOutPagesOf(tab);
  const page: LaidOutPage | undefined = pageOrFirst(laid, pageId);
  const refs = computeRefs(tab.elements.map((el) => el.id));
  const drawn = visibleLayerElements(tab.elements, tab.layers);
  const elements = clickableBoxes(drawn, (id) => refs.refOf(id), page?.rect);
  // Only the shown page's pictures are embedded: the elements reaching onto it.
  const onPage = new Set(elements.map((e) => e.id));
  const pictures = { ...tab, elements: tab.elements.filter((el) => onPage.has(el.id)) };
  return { page, pages: viewPagesOf(laid), elements, pictures };
}

export async function viewTab(
  env: Env,
  token: string,
  args: { designId: string; tabId?: string; pageId?: string },
): Promise<ToolResult> {
  const loaded = await loadTab(env, token, args.designId, args.tabId);
  if (!loaded) return errorResult('That design has no tabs.');
  const { design, tab } = loaded;
  const { page, pages, elements, pictures } = pageView(tab, args.pageId);
  const { svg } = await tabSvg(tab, { env, token, designId: args.designId }, page, {
    limits: VIEW_PICTURE_LIMITS,
    pictures,
  });
  return canvasViewResult({
    designId: args.designId,
    tabId: tab.id,
    name: tab.name,
    tabs: design.tabs.map((t) => ({ id: t.id, name: t.name })),
    pageId: page?.id ?? null,
    pages,
    svg,
    viewBox: viewBoxOf(svg),
    elements,
    url: deepLink(env, args.designId),
  });
}

// The page, listed on the server beside the schema resource (server.ts). It opens no connection: the view does not
// follow the room yet ("Live updates").
export function registerViewPage(server: McpServer): void {
  registerViewResource(server, {
    uri: VIEW_URI,
    app: 'livedesign',
    title: 'livedesign view',
    viewer: { idKey: 'designId', live: false },
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
