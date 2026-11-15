// The interactive view (docs/specs/015-api/mcp-server.md "Interactive view (MCP Apps)"): the `ui://` page the
// drawing tools link, and view_tab, the call the page makes through the host to draw a tab. The page holds no
// credential: every view_tab is the user's own token through the api's read gate, and no share link is minted.
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Env } from '@liveworkspace/mcp-kit/env';
import { appOnlyToolMeta, registerViewResource, toolUiMeta } from '@liveworkspace/mcp-kit/app-view';
import { computeRefs, visibleLayerElements, type Element, type Tab } from '@livediagram/document';
import { mcpViewTab } from '@livediagram/agent-verbs/mcp';
import { tabSvg } from './image-result';
import { registerTool } from './tool-annotations';
import { deepLink, errorResult, loadTab, requireToken, type ToolResult } from './tool-helpers';

export const VIEW_URI = 'ui://livediagram/view.html';

// The `_meta` create_document, add_tab, update_document and read_document carry to link the view.
export const VIEW_TOOL_META = toolUiMeta(VIEW_URI);

type Box = { x: number; y: number; width: number; height: number };

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

// The SVG's view box (`viewBox="x y w h"` on its root), as the view maps a click into the tab.
export function viewBoxOf(svg: string): Box {
  const open = svg.indexOf('viewBox="');
  const close = open < 0 ? -1 : svg.indexOf('"', open + 9);
  const [x, y, width, height] = (close < 0 ? '' : svg.slice(open + 9, close))
    .split(' ')
    .map(Number);
  return [x, y, width, height].every(isNum)
    ? { x: x!, y: y!, width: width!, height: height! }
    : { x: 0, y: 0, width: 0, height: 0 };
}

// Every boxed element the SVG draws, bottom to top, with its ref and label: what a click in the view can open.
export function clickableElements(tab: Tab) {
  const refs = computeRefs(tab.elements.map((el) => el.id));
  return visibleLayerElements(tab.elements, tab.layers).flatMap((el: Element) => {
    const { x, y, width, height, label } = el as Partial<Box> & { label?: unknown };
    if (el.type === 'arrow' || !isNum(x) || !isNum(y) || !isNum(width) || !isNum(height)) return [];
    return [
      {
        id: el.id,
        ref: refs.refOf(el.id),
        label: typeof label === 'string' && label.trim() ? label.trim() : null,
        x,
        y,
        width,
        height,
      },
    ];
  });
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
  const value = {
    documentId: args.documentId,
    tabId: tab.id,
    name: tab.name,
    tabs: document.tabs.map((t) => ({ id: t.id, name: t.name })),
    svg,
    viewBox: viewBoxOf(svg),
    elements: clickableElements(tab),
    url: deepLink(env, args.documentId),
  };
  console.info('[mcp] view_tab', { bytes: svg.length, elements: value.elements.length });
  // The text block is one line, not the SVG: a host without MCP Apps that shows this tool to the model spends few
  // tokens on it (the spec's "view_tab").
  return {
    content: [{ type: 'text', text: `Drew tab "${tab.name}" for the interactive view.` }],
    structuredContent: value,
  };
}

// The page, listed on the server beside the schema resource (server.ts).
export function registerViewPage(server: McpServer): void {
  registerViewResource(server, { uri: VIEW_URI, app: 'livediagram', title: 'livediagram view' });
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
