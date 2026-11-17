// The interactive view (docs/specs/015-api/mcp-server.md "Interactive view (MCP Apps)"): the `ui://` page the
// drawing tools link, view_tab, the call the page makes through the host to draw a tab, view_live, the view-only
// room ticket it follows the document with ("Live updates"), and view_edit, a rename or a move saved for an
// edit-level token ("Edits in the view"). The page holds no lasting credential: every call is the user's own token
// through the api's gates, a ticket lapses in minutes and only watches, and no share link is minted.
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Env } from '@liveworkspace/mcp-kit/env';
import {
  appOnlyToolMeta,
  registerViewResource,
  socketOriginOf,
  toolUiMeta,
} from '@liveworkspace/mcp-kit/app-view';
import { canvasViewResult, clickableBoxes, viewBoxOf } from '@liveworkspace/mcp-kit/app-view-tab';
import type {
  ChangesetResponse,
  LiveDoc,
  RoomTicketResponse,
  TabRecord,
  TabResponse,
} from '@livediagram/api-schema';
import {
  computeRefs,
  elementFingerprint,
  isLayerLocked,
  resolveLayerId,
  tabLayers,
  visibleLayerElements,
  type Element,
  type Tab,
} from '@livediagram/document';
import { mcpViewEdit, mcpViewLive, mcpViewTab } from '@livediagram/agent-verbs/mcp';
import { apiJson } from './api';
import { changesetErrorText, isChangesetRefusal, submitChangeset } from './changeset-client';
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

// The kinds whose label is their text, which a rename in the view changes ("Edits in the view").
const RENAMABLE = new Set<Element['type']>(['shape', 'text', 'sticky']);

const attachedHost = (el: Element): string | null => {
  const host = (el as { attachedTo?: unknown }).attachedTo;
  return typeof host === 'string' ? host : null;
};

// What an edit in the view may do to each element: nothing to one locked (itself, its layer or the tab, as the engine
// refuses), no move for a badge attached to a host nor for the host (only the editor carries the attachment), and a
// rename only where the label is the element's text. view_edit checks the same answer before it writes.
export function viewEditsOf(tab: Tab): (el: Element) => { canRename: boolean; canMove: boolean } {
  const layers = tabLayers(tab.layers);
  const hosts = new Set(tab.elements.map(attachedHost).filter((id) => id !== null));
  return (el) => {
    const layer = layers.find((l) => l.id === resolveLayerId(el.layerId, layers))!;
    const locked = tab.locked === true || el.locked === true || isLayerLocked(layer);
    return {
      canRename: !locked && RENAMABLE.has(el.type),
      canMove: !locked && attachedHost(el) === null && !hosts.has(el.id),
    };
  };
}

// Every boxed element the SVG draws, bottom to top, with its ref and label: what a click in the view can open, and
// what an edit may do to it.
export function clickableElements(tab: Tab) {
  const refs = computeRefs(tab.elements.map((el) => el.id));
  const byId = new Map(tab.elements.map((el) => [el.id, el]));
  const editsOf = viewEditsOf(tab);
  return clickableBoxes(visibleLayerElements(tab.elements, tab.layers), (id) => refs.refOf(id)).map(
    (box) => ({ ...box, ...editsOf(byId.get(box.id)!) }),
  );
}

export async function viewTab(
  env: Env,
  token: string,
  args: { documentId: string; tabId?: string },
): Promise<ToolResult> {
  const loaded = await loadTab(env, token, args.documentId, args.tabId);
  if (!loaded) return errorResult('That document has no tabs.');
  return drawTab(env, token, args.documentId, loaded);
}

// view_tab's answer for a tab already read: the SVG, its boxes and the document's tabs.
async function drawTab(
  env: Env,
  token: string,
  documentId: string,
  { document, tab }: { document: LiveDoc; tab: TabRecord },
) {
  const { svg } = await tabSvg(tab, { env, token });
  // The text block is one line, not the SVG (the spec's "view_tab").
  return canvasViewResult({
    documentId,
    tabId: tab.id,
    name: tab.name,
    tabs: document.tabs.map((t) => ({ id: t.id, name: t.name })),
    svg,
    viewBox: viewBoxOf(svg),
    elements: clickableElements(tab),
    url: deepLink(env, documentId),
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
  // Edits in the view are offered at edit only, by the level the api answers: a read-only token's is view.
  const canEdit = answer.level === 'edit';
  console.info('[mcp] view_live', {
    lapsesInS: Math.round((answer.expiresAt - Date.now()) / 1000),
    canEdit,
  });
  return {
    content: [{ type: 'text', text: 'Opened live updates for the interactive view.' }],
    structuredContent: {
      documentId: args.documentId,
      url: roomSocketUrl(env, args.documentId),
      ticket: answer.ticket,
      expiresAt: answer.expiresAt,
      canEdit,
    },
  };
}

type ViewEditArgs = {
  documentId: string;
  tabId: string;
  edits: { elementId: string; label?: string; dx?: number; dy?: number }[];
};

// The changeset an edit list means ("Edits in the view"): a rename is `set label`, a move `move by=dx,dy`, on the
// element's `id:"…"` target, based on each named element as stored now. A string is the refusal, before anything is
// sent: an element not on the tab, an edit with nothing in it, or one the view may not make.
export function viewEditChangeset(tab: Tab & { rev: number }, edits: ViewEditArgs['edits']) {
  const byId = new Map(tab.elements.map((el) => [el.id, el]));
  const editsOf = viewEditsOf(tab);
  const operations: unknown[] = [];
  const elements: Record<string, string> = {};
  for (const [i, edit] of edits.entries()) {
    const at = `edits[${i + 1}]`;
    const el = byId.get(edit.elementId);
    if (!el) return `${at}: "${edit.elementId}" is not on this tab any more.`;
    const [dx, dy] = [Math.round(edit.dx ?? 0), Math.round(edit.dy ?? 0)];
    const moves = dx !== 0 || dy !== 0;
    if (edit.label === undefined && !moves) return `${at}: give a new label, a move, or both.`;
    const may = editsOf(el);
    if (edit.label !== undefined && !may.canRename)
      return `${at}: this element can't be renamed here.`;
    if (moves && !may.canMove) return `${at}: this element can't be moved here.`;
    const target = `id:${JSON.stringify(el.id)}`;
    if (edit.label !== undefined)
      operations.push({ op: 'set', target, fields: { label: edit.label } });
    if (moves) operations.push({ op: 'move', target, by: [dx, dy] });
    elements[el.id] = elementFingerprint(el);
  }
  return {
    operations,
    base: { rev: tab.rev, elements },
    summary: 'Edited in the interactive view',
  };
}

// view_edit: the person's rename or move, one changeset through the api on the user's own token, the path
// update_document writes through, so the api's gates decide (a read-only token, a level below edit, a lock); the
// answer is the tab drawn again, so the view redraws without a second call.
export async function viewEdit(env: Env, token: string, args: ViewEditArgs): Promise<ToolResult> {
  const loaded = await loadTab(env, token, args.documentId, args.tabId);
  if (!loaded) return errorResult('That document has no tabs.');
  const body = viewEditChangeset(loaded.tab, args.edits);
  if (typeof body === 'string') return errorResult(body);
  let answer: ChangesetResponse;
  try {
    answer = await submitChangeset(env, token, args.documentId, loaded.tab.id, body);
  } catch (err) {
    if (isChangesetRefusal(err)) return errorResult(changesetErrorText(err));
    throw err;
  }
  // The tab as stored after the edit, read once more; the document's tabs are as loaded.
  const { tab } = await apiJson<TabResponse>(
    env,
    token,
    `/documents/${encodeURIComponent(args.documentId)}/tabs/${encodeURIComponent(loaded.tab.id)}`,
  );
  const drawn = await drawTab(env, token, args.documentId, { document: loaded.document, tab });
  const count = args.edits.length;
  return {
    content: [
      {
        type: 'text',
        text: `Saved ${count} edit${count === 1 ? '' : 's'} from the interactive view.`,
      },
    ],
    structuredContent: {
      ...(drawn.structuredContent as Record<string, unknown>),
      changesetId: answer.changeset?.id ?? null,
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
    viewer: { edits: true },
  });
}

// view_tab, view_live and view_edit, registered last of the tools (tools.ts), as the catalogue orders them.
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
  registerTool(
    server,
    env,
    mcpViewEdit,
    async (args, extra) => viewEdit(env, requireToken(extra), args),
    appOnlyToolMeta(),
  );
}
