// Send to Diagram on the index (liveworkspace/docs/specs/004-index/send-to-diagram.md): words in any app drawn as a new
// livediagram diagram of the person's own.
//
//   POST /diagram-sends/diagrams   {name, graph, source}   a new diagram, as the person   → 201 {item, link}
//
// The person needs only read on the source; the diagram is theirs alone, made by livediagram's own door, whose answer
// the index checks against its own row before it hands the item back.

import { APP_ITEMS } from '@liveworkspace/sites';
import {
  DIAGRAM_FROM_GRAPH_PATH,
  readDiagramSendAsk,
  type DiagramFromGraphInput,
} from '@liveworkspace/index-client';
import { loadItem } from './access';
import { callAppForJson } from './app-calls';
import { isId } from './codec';
import { KIT_CREATE_TIMEOUT_MS } from './config';
import { appSiteOrigin } from './connection-rows';
import { isDelegate } from './connections';
import type { PersonContext } from './context';
import { badRequest, fail, forbidden, json, notFound, readObject } from './http';
import { overRunLimit } from './kits';
import { placeLink } from './plan-sends';
import { getItemRow, toItem } from './rows';

const DIAGRAM_APP = 'livediagram' as const;
const CAPTION_MAX = 240;

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
  };
  const res = await callAppForJson(
    env,
    DIAGRAM_APP,
    DIAGRAM_FROM_GRAPH_PATH,
    input,
    KIT_CREATE_TIMEOUT_MS,
  );
  if (!res.ok) {
    console.warn('[index] diagram not made', { error: res.error });
    return res.error === 'status_422'
      ? fail(422, 'invalid_graph')
      : fail(503, 'diagram_unavailable');
  }
  const id = res.body.id;
  const row = isId(id) ? await getItemRow(env, id) : null;
  if (!row || row.owner_id !== person.id || row.app !== DIAGRAM_APP) {
    console.warn('[index] diagram not made', { error: 'invalid_item' });
    return fail(503, 'diagram_unavailable');
  }
  const item = toItem(
    row,
    { level: 'edit', tabId: null, via: 'owner', code: null },
    { lastOpenedAt: null, hiddenFromRecent: false },
  );
  const link = `${appSiteOrigin(env, DIAGRAM_APP)}${APP_ITEMS[DIAGRAM_APP].itemPath}${encodeURIComponent(row.id)}`;
  console.info('[index] diagram made', {
    nodes: ask.graph.nodes.length,
    edges: ask.graph.edges.length,
    app: ask.source.app,
  });
  return json({ item, link }, { status: 201 });
}
