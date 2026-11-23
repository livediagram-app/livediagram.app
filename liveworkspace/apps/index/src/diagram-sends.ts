// Send to Diagram on the index (liveworkspace/docs/specs/004-index/send-to-diagram.md): words in any app drawn as a new
// livediagram diagram of the person's own.
//
//   POST /diagram-sends/diagrams   {name, graph, source, target?}   a diagram drawn, as the person → 201 {item, link, send}
//   GET  /items/:id/diagram-sends  the source's sends whose diagram the reader can open          → 200 {sends}
//
// The person needs only read on the source. Without a target the diagram is theirs alone, made by livediagram's own
// door, whose answer the index checks against its own row; with one (a new tab, or a tab redrawn) they need their own
// edit on the whole diagram. Each send is a diagram_sends row, for the source's chips.

import { APP_ITEMS } from '@liveworkspace/sites';
import {
  DIAGRAM_FROM_GRAPH_PATH,
  DIAGRAM_SEND_DIAGRAMS_CHECKED_MAX,
  DIAGRAM_SEND_READ_MAX,
  diagramSendRef,
  readDiagramSendAsk,
  type DiagramFromGraphInput,
  type DiagramSend,
} from '@liveworkspace/index-client';
import { loadItem } from './access';
import { callAppForJson } from './app-calls';
import { isId } from './codec';
import { KIT_CREATE_TIMEOUT_MS } from './config';
import { appSiteOrigin } from './connection-rows';
import { isDelegate } from './connections';
import type { PersonContext, RouteContext } from './context';
import type { Env } from './env';
import { badRequest, fail, forbidden, json, notFound, readObject } from './http';
import { overRunLimit } from './kits';
import { placeLink } from './plan-sends';
import { getItemRow, toItem } from './rows';

const DIAGRAM_APP = 'livediagram' as const;
const CAPTION_MAX = 240;
const newSendId = () => `ds_${crypto.randomUUID().replaceAll('-', '').slice(0, 20)}`;

type SendRow = {
  id: string;
  ref: string;
  diagram_id: string;
  diagram_tab_id: string;
  at: number;
};

/** The diagram's address in livediagram, opened on the tab drawn. */
export const diagramLink = (
  env: Pick<Env, 'ENVIRONMENT'>,
  diagramId: string,
  tabId: string | null,
): string =>
  `${appSiteOrigin(env, DIAGRAM_APP)}${APP_ITEMS[DIAGRAM_APP].itemPath}${encodeURIComponent(diagramId)}${
    tabId ? `#t=${encodeURIComponent(tabId)}` : ''
  }`;

const sendOf = (env: Env, r: SendRow, title: string): DiagramSend => ({
  id: r.id,
  ref: r.ref,
  diagram: { id: r.diagram_id, title },
  tabId: r.diagram_tab_id,
  link: diagramLink(env, r.diagram_id, r.diagram_tab_id),
  at: r.at,
});

const cut = (s: string, max: number) => (s.length > max ? `${s.slice(0, max - 1)}…` : s);

/** The caption under the diagram's title: where the words came from. */
export const diagramCaption = (sourceTitle: string, label: string): string =>
  cut(
    label && label !== sourceTitle ? `From ${sourceTitle}, ${label}` : `From ${sourceTitle}`,
    CAPTION_MAX,
  );

/** POST /diagram-sends/diagrams. */
export async function handleDiagramSends(ctx: PersonContext): Promise<Response> {
  const { env, request, segments } = ctx;
  if (request.method !== 'POST' || segments.length !== 2 || segments[1] !== 'diagrams')
    return notFound();
  const { person } = ctx;
  if (isDelegate(person)) return forbidden();
  if (person.kind !== 'account') return forbidden('sign_in_required');
  const limited = await overRunLimit(env, `diagram-send:${person.id}`);
  if (limited) return limited;
  const ask = readDiagramSendAsk(await readObject(request));
  if (!ask) return badRequest();

  // The source: the person's own read, any level.
  const source = await loadItem(env, ask.source.itemId, { person, share: null }, 'view');
  if (source instanceof Response) return source.status === 403 ? notFound() : source;
  if (source.row.app !== ask.source.app) return badRequest();

  // An existing diagram: the person's own edit on the whole of it, in livediagram, not put away.
  const target = ask.target ?? null;
  let targetAccess: Awaited<ReturnType<typeof loadItem>> | null = null;
  if (target) {
    const diagram = await loadItem(env, target.itemId, { person, share: null }, 'edit');
    if (diagram instanceof Response) return diagram;
    if (diagram.row.app !== DIAGRAM_APP) return badRequest();
    if (diagram.access.tabId !== null) return forbidden();
    if (diagram.row.trashed_at !== null || diagram.row.archived_at !== null) return notFound();
    targetAccess = diagram;
  }

  const input: DiagramFromGraphInput = {
    owner: person.id,
    name: ask.name,
    graph: ask.graph,
    caption: diagramCaption(source.row.title || 'Untitled', ask.source.label),
    link: placeLink(env, {
      app: ask.source.app,
      itemId: ask.source.itemId,
      kind: 'text',
      tabId: ask.source.tabId,
      elementId: ask.source.elementId,
    }),
    ...(target ? { itemId: target.itemId } : {}),
    ...(target?.tabId ? { tabId: target.tabId } : {}),
  };
  const res = await callAppForJson(
    env,
    DIAGRAM_APP,
    // callApp adds the /api/internal prefix the shared path carries.
    DIAGRAM_FROM_GRAPH_PATH.slice('/api/internal'.length),
    input,
    KIT_CREATE_TIMEOUT_MS,
  );
  if (!res.ok) {
    console.warn('[index] diagram not made', { error: res.error });
    if (res.error === 'status_422') return fail(422, 'invalid_graph');
    if (res.error === 'status_404') return fail(404, 'diagram_gone');
    return fail(503, 'diagram_unavailable');
  }
  const id = res.body.id;
  const row = isId(id) ? await getItemRow(env, id) : null;
  // A new diagram is the person's own; a target's answer names the target.
  const mine = target ? row?.id === target.itemId : row?.owner_id === person.id;
  if (!row || !mine || row.app !== DIAGRAM_APP) {
    console.warn('[index] diagram not made', { error: 'invalid_item' });
    return fail(503, 'diagram_unavailable');
  }
  const tabId =
    typeof res.body.tabId === 'string' && res.body.tabId.length <= 200 ? res.body.tabId : '';
  const item = toItem(
    row,
    targetAccess && !(targetAccess instanceof Response)
      ? targetAccess.access
      : { level: 'edit', tabId: null, via: 'owner', code: null },
    { lastOpenedAt: null, hiddenFromRecent: false },
  );
  const link = diagramLink(env, row.id, tabId || null);
  const sent: SendRow = {
    id: newSendId(),
    ref: diagramSendRef(ask.source.tabId, ask.source.elementId),
    diagram_id: row.id,
    diagram_tab_id: tabId,
    at: Date.now(),
  };
  // One row a place and tab: sending again moves it to the top.
  await env.INDEX_DB.batch([
    env.INDEX_DB.prepare(
      'DELETE FROM diagram_sends WHERE source_id = ? AND ref = ? AND diagram_id = ? AND diagram_tab_id = ?',
    ).bind(ask.source.itemId, sent.ref, sent.diagram_id, sent.diagram_tab_id),
    env.INDEX_DB.prepare(
      'INSERT INTO diagram_sends (id, source_id, ref, diagram_id, diagram_tab_id, at) VALUES (?, ?, ?, ?, ?, ?)',
    ).bind(sent.id, ask.source.itemId, sent.ref, sent.diagram_id, sent.diagram_tab_id, sent.at),
  ]);
  console.info('[index] diagram made', {
    nodes: ask.graph.nodes.length,
    edges: ask.graph.edges.length,
    app: ask.source.app,
    into: target?.tabId ? 'tab' : target ? 'new-tab' : 'new',
  });
  return json({ item, link, send: sendOf(env, sent, row.title) }, { status: 201 });
}

/** GET /items/:id/diagram-sends: the source's sends whose diagrams the reader can open, newest first. */
export async function readDiagramSends(ctx: RouteContext, sourceId: string): Promise<Response> {
  const { env, caller } = ctx;
  if (ctx.request.method !== 'GET') return notFound();
  const source = await loadItem(env, sourceId, caller, 'view');
  if (source instanceof Response) return source;
  const person = caller.person;
  // A visitor with no identity holds no diagram to open.
  if (!person) return json({ sends: [] });
  const rows =
    (
      await env.INDEX_DB.prepare(
        `SELECT id, ref, diagram_id, diagram_tab_id, at FROM diagram_sends
         WHERE source_id = ? ORDER BY at DESC LIMIT ?`,
      )
        .bind(sourceId, DIAGRAM_SEND_READ_MAX)
        .all<SendRow>()
    ).results ?? [];
  // Each diagram once, newest first, on the reader's own access (no share code of the source's carries over).
  const diagrams = [...new Set(rows.map((r) => r.diagram_id))].slice(
    0,
    DIAGRAM_SEND_DIAGRAMS_CHECKED_MAX,
  );
  const open = new Map<string, string>();
  await Promise.all(
    diagrams.map(async (id) => {
      const diagram = await loadItem(env, id, { person, share: null }, 'view');
      if (diagram instanceof Response) {
        await diagram.body?.cancel();
        return;
      }
      if (diagram.row.trashed_at === null && diagram.row.archived_at === null)
        open.set(id, diagram.row.title);
    }),
  );
  const sends = rows.flatMap((r) => {
    const title = open.get(r.diagram_id);
    return title === undefined ? [] : [sendOf(env, r, title)];
  });
  return json({ sends });
}
