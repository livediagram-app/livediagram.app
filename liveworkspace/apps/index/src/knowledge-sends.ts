// Send to Knowledge Base on the index (liveworkspace/docs/specs/004-index/send-to-knowledge.md, its blueprint): a
// selection in any app documented on a liveknowledge page, as the person, through liveknowledge's own door.
//
//   POST /knowledge-sends/sections                    a section written, as the person                  → 201 {send, link}
//   GET  /items/:id/knowledge-sends                   the source's sends whose knowledgebase the reader can open → {sends}
//   GET  /items/:id/knowledge-sends?received=1        the knowledgebase's sends whose source the reader can open  → {received}
//   GET  /items/:id/knowledge-sends/outline?page=     a page's headings, for an Editor of the knowledgebase       → {headings}
//   POST /app/items/:id/knowledge-sends               liveknowledge: an agent's write with a source              → {sentFrom}
//
// The person needs read on the source and their own Editor access to the whole knowledgebase, checked here on every
// send and again by liveknowledge's door on the grant minted for it. Each send is a knowledge_sends row, for the chips
// on both sides; a chip shows only to a reader who can open the item on its other side.

import { APP_ITEMS } from '@liveworkspace/sites';
import {
  ITEM_GRANT_HEADER,
  KNOWLEDGE_SEND_ITEMS_CHECKED_MAX,
  KNOWLEDGE_SEND_READ_MAX,
  PLAN_SENDS_PER_SOURCE_MAX,
  knowledgeSendDoorPath,
  readAgentKnowledgeSend,
  readKnowledgeSendAsk,
  type App,
  type KnowledgeHeading,
  type KnowledgeReceived,
  type KnowledgeSend,
  type KnowledgeSendDoorCall,
  type KnowledgeSentFrom,
} from '@liveworkspace/index-client';
import { loadItem } from './access';
import { callAppForJson } from './app-calls';
import type { Caller, Person } from './auth';
import { APP_CALL_TIMEOUT_MS, KIT_CREATE_TIMEOUT_MS } from './config';
import { appSiteOrigin } from './connection-rows';
import type { PersonContext, RouteContext } from './context';
import type { Env } from './env';
import { mintGrant } from './grants';
import { badRequest, fail, forbidden, json, notFound, readObject } from './http';
import { overRunLimit } from './kits';
import { placeLink, sender } from './plan-sends';
import { getItemRow, type ItemRow } from './rows';

const KNOWLEDGE_APP = 'liveknowledge' as const;
const TITLE_MAX = 200;
const HEADINGS_MAX = 200;
const enc = encodeURIComponent;
const cut = (s: string, max: number) => (s.length > max ? s.slice(0, max) : s);
const newSendId = () => `ks_${crypto.randomUUID().replaceAll('-', '').slice(0, 20)}`;

type SendRow = {
  id: string;
  source_id: string;
  source_tab_id: string;
  elements: string;
  kb_id: string;
  page_id: string;
  page_title: string;
  place_link: string;
  at: number;
};

/** The page's address in liveknowledge. */
export const pageLink = (env: Pick<Env, 'ENVIRONMENT'>, kbId: string, pageId: string): string =>
  `${appSiteOrigin(env, KNOWLEDGE_APP)}${APP_ITEMS[KNOWLEDGE_APP].itemPath}${enc(kbId)}#t=${enc(pageId)}`;

const elementsOf = (raw: string): string[] => {
  try {
    const v: unknown = JSON.parse(raw);
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
};

const sendOf = (env: Env, r: SendRow, kbTitle: string): KnowledgeSend => ({
  id: r.id,
  tabId: r.source_tab_id,
  elementIds: elementsOf(r.elements),
  knowledgebase: { id: r.kb_id, title: kbTitle },
  page: { id: r.page_id, title: r.page_title },
  link: pageLink(env, r.kb_id, r.page_id),
  at: r.at,
});

// The person as the access rule reads someone the index acts for: an account, their teams read fresh.
const asPerson = (id: string): Caller => ({
  person: { id, kind: 'account', teams: [] },
  share: null,
});

type Kb = { row: ItemRow; grant: string };

/** The knowledgebase on the person's own Editor access to the whole of it, live, with a grant for its door. */
async function editableKnowledgebase(
  env: Env,
  kbId: string,
  person: Person,
): Promise<Kb | Response> {
  const kb = await loadItem(env, kbId, { person, share: null }, 'edit');
  if (kb instanceof Response) return kb;
  if (kb.row.app !== KNOWLEDGE_APP) return badRequest();
  if (kb.access.tabId !== null) return forbidden();
  if (kb.row.trashed_at !== null || kb.row.archived_at !== null) return notFound();
  const grant = await mintGrant(env, {
    app: KNOWLEDGE_APP,
    sub: person.id,
    itemId: kb.row.id,
    level: kb.access.level,
    tabId: null,
    ownerId: kb.row.owner_id,
    teamId: kb.row.team_id,
    link: kb.access.code,
  });
  if (!grant) return fail(503, 'grants_unavailable');
  return { row: kb.row, grant: grant.grant };
}

const callDoor = (env: Env, kb: Kb, call: KnowledgeSendDoorCall, timeout: number) =>
  callAppForJson(
    env,
    KNOWLEDGE_APP,
    knowledgeSendDoorPath(kb.row.id).slice('/api/internal'.length),
    call,
    timeout,
    { [ITEM_GRANT_HEADER]: kb.grant },
  );

/** POST /knowledge-sends/sections: the section, written on the page as the person. */
export async function handleKnowledgeSends(ctx: PersonContext): Promise<Response> {
  const { env, request, segments } = ctx;
  if (request.method !== 'POST' || segments.length !== 2 || segments[1] !== 'sections')
    return notFound();
  const person = sender(ctx);
  if (person instanceof Response) return person;
  const limited = await overRunLimit(env, `knowledge-send:${person.id}`);
  if (limited) return limited;
  const ask = readKnowledgeSendAsk(await readObject(request));
  if (!ask) return badRequest();
  if (ask.knowledgebase === ask.source.itemId) return badRequest();

  // The source: the person's own read, any level, every app.
  const source = await loadItem(env, ask.source.itemId, { person, share: null }, 'view');
  if (source instanceof Response) return source.status === 403 ? notFound() : source;
  if (source.row.app !== ask.source.app) return badRequest();

  const held = await env.INDEX_DB.prepare(
    'SELECT COUNT(*) AS n FROM knowledge_sends WHERE source_id = ?',
  )
    .bind(source.row.id)
    .first<{ n: number }>();
  if ((held?.n ?? 0) >= PLAN_SENDS_PER_SOURCE_MAX) return fail(409, 'source_full');

  const kb = await editableKnowledgebase(env, ask.knowledgebase, person);
  if (kb instanceof Response) return kb;

  const place = placeLink(env, {
    app: source.row.app,
    itemId: source.row.id,
    kind: 'element',
    tabId: ask.source.tabId,
    elementId: ask.source.elementIds[0] ?? null,
  });
  const sentFrom: KnowledgeSentFrom = {
    app: source.row.app,
    title: cut(source.row.title || 'Untitled', TITLE_MAX),
    link: place,
  };
  const res = await callDoor(
    env,
    kb,
    {
      op: 'write',
      person: person.id,
      place: ask.place,
      heading: ask.heading,
      markdown: ask.markdown,
      ...(ask.picture ? { picture: ask.picture } : {}),
      sentFrom,
    },
    KIT_CREATE_TIMEOUT_MS,
  );
  if (!res.ok) {
    console.warn('[index] knowledge send not written', { error: res.error });
    if (res.error === 'status_403' || res.error === 'status_404') return forbidden();
    return fail(503, 'knowledge_unavailable');
  }
  const answer = res.body as { ok?: unknown; page?: unknown; code?: unknown; reason?: unknown };
  const page = answer.page as { id?: unknown; title?: unknown } | undefined;
  if (answer.ok !== true || typeof page?.id !== 'string' || !page.id || page.id.length > 200) {
    const reason = typeof answer.reason === 'string' ? answer.reason.slice(0, 200) : '';
    const code = typeof answer.code === 'string' ? answer.code.slice(0, 40) : 'failed';
    console.warn('[index] knowledge send refused', { code });
    return json({ error: 'knowledge_refused', code, reason }, { status: 422 });
  }
  const row: SendRow = {
    id: newSendId(),
    source_id: source.row.id,
    source_tab_id: ask.source.tabId ?? '',
    elements: JSON.stringify(ask.source.elementIds),
    kb_id: kb.row.id,
    page_id: page.id,
    page_title: cut(typeof page.title === 'string' ? page.title : '', TITLE_MAX),
    place_link: place,
    at: Date.now(),
  };
  await insertRow(env, row);
  console.info('[index] knowledge send written', {
    app: source.row.app,
    elements: ask.source.elementIds.length,
    picture: !!ask.picture,
    into: 'newPage' in ask.place ? 'new-page' : ask.place.after ? 'heading' : 'end',
  });
  const send = sendOf(env, row, kb.row.title);
  return json({ send, link: send.link }, { status: 201 });
}

async function insertRow(env: Env, r: SendRow): Promise<void> {
  await env.INDEX_DB.prepare(
    `INSERT INTO knowledge_sends (id, source_id, source_tab_id, elements, kb_id, page_id, page_title, place_link, at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      r.id,
      r.source_id,
      r.source_tab_id,
      r.elements,
      r.kb_id,
      r.page_id,
      r.page_title,
      r.place_link,
      r.at,
    )
    .run();
}

// Each distinct item once, newest first, on the reader's own access (no share code carries over): its current title
// where the reader can open it, live.
async function openTitles(
  env: Env,
  person: NonNullable<Caller['person']>,
  ids: string[],
): Promise<Map<string, { title: string; app: App }>> {
  const open = new Map<string, { title: string; app: App }>();
  await Promise.all(
    [...new Set(ids)].slice(0, KNOWLEDGE_SEND_ITEMS_CHECKED_MAX).map(async (id) => {
      const item = await loadItem(env, id, { person, share: null }, 'view');
      if (item instanceof Response) {
        await item.body?.cancel();
        return;
      }
      if (item.row.trashed_at === null && item.row.archived_at === null)
        open.set(id, { title: item.row.title, app: item.row.app });
    }),
  );
  return open;
}

/** GET /items/:id/knowledge-sends (and its `received` and `outline` reads). */
export async function readKnowledgeSends(
  ctx: RouteContext,
  itemId: string,
  rest: readonly string[],
): Promise<Response> {
  const { env, caller, request } = ctx;
  if (request.method !== 'GET') return notFound();
  if (rest.length === 1 && rest[0] === 'outline') return readOutline(ctx, itemId);
  if (rest.length > 0) return notFound();
  const item = await loadItem(env, itemId, caller, 'view');
  if (item instanceof Response) return item;
  const person = caller.person;
  const received = new URL(request.url).searchParams.get('received') === '1';
  // A visitor with no identity holds nothing on the other side to open.
  if (!person) return json(received ? { received: [] } : { sends: [] });
  const rows =
    (
      await env.INDEX_DB.prepare(
        `SELECT id, source_id, source_tab_id, elements, kb_id, page_id, page_title, place_link, at FROM knowledge_sends
         WHERE ${received ? 'kb_id' : 'source_id'} = ? ORDER BY at DESC LIMIT ?`,
      )
        .bind(itemId, KNOWLEDGE_SEND_READ_MAX)
        .all<SendRow>()
    ).results ?? [];
  const open = await openTitles(
    env,
    person,
    rows.map((r) => (received ? r.source_id : r.kb_id)),
  );
  if (received) {
    const out: KnowledgeReceived[] = rows.flatMap((r) => {
      const source = open.get(r.source_id);
      return source
        ? [
            {
              id: r.id,
              page: r.page_id,
              place: r.place_link,
              source: { app: source.app, id: r.source_id, title: source.title },
            },
          ]
        : [];
    });
    return json({ received: out });
  }
  const sends = rows.flatMap((r) => {
    const kb = open.get(r.kb_id);
    return kb ? [sendOf(env, r, kb.title)] : [];
  });
  return json({ sends });
}

/** GET /items/:kb/knowledge-sends/outline?page=: the page's headings, through liveknowledge's door, for an Editor. */
async function readOutline(ctx: RouteContext, kbId: string): Promise<Response> {
  const person = sender(ctx);
  if (person instanceof Response) return person;
  const page = new URL(ctx.request.url).searchParams.get('page') ?? '';
  if (!page || page.length > 200) return badRequest();
  const kb = await editableKnowledgebase(ctx.env, kbId, person);
  if (kb instanceof Response) return kb;
  const res = await callDoor(
    ctx.env,
    kb,
    { op: 'outline', person: person.id, page },
    APP_CALL_TIMEOUT_MS,
  );
  if (!res.ok) {
    if (res.error === 'status_403' || res.error === 'status_404') return forbidden();
    return fail(503, 'knowledge_unavailable');
  }
  const raw = Array.isArray(res.body.headings) ? res.body.headings : [];
  const headings: KnowledgeHeading[] = [];
  for (const h of raw.slice(0, HEADINGS_MAX) as Record<string, unknown>[]) {
    if (!h || typeof h.id !== 'string' || typeof h.text !== 'string') continue;
    const level = h.level === 1 || h.level === 2 || h.level === 3 ? h.level : null;
    if (!level || h.id.length > 200) continue;
    headings.push({ id: h.id, level, text: cut(h.text, TITLE_MAX) });
  }
  return json({ headings });
}

/**
 * POST /app/items/:kb/knowledge-sends: liveknowledge, for an agent's write with a source. `record: false` asks only
 * for the Sent From line (before the write); `record: true` keeps the send (after it). Answered `{sentFrom: null}`
 * where the person cannot read the source, so an agent never makes a chip appear on an item its person could not open.
 */
export async function handleAgentKnowledgeSends(
  request: Request,
  env: Env,
  app: App,
  kbId: string,
): Promise<Response> {
  if (request.method !== 'POST') return notFound();
  const kb = await getItemRow(env, kbId);
  if (!kb) return notFound();
  if (kb.app !== app || app !== KNOWLEDGE_APP) return fail(403, 'wrong_app');
  const body = await readObject(request);
  const read = readAgentKnowledgeSend(body);
  if (!read || read.source.itemId === kbId) return badRequest();
  const source = await loadItem(env, read.source.itemId, asPerson(read.person), 'view');
  if (source instanceof Response) {
    await source.body?.cancel();
    return json({ sentFrom: null });
  }
  if (source.row.app !== read.source.app) return json({ sentFrom: null });
  const link = placeLink(env, {
    app: source.row.app,
    itemId: source.row.id,
    kind: 'element',
    tabId: read.source.tabId,
    elementId: read.source.elementIds[0] ?? null,
  });
  const sentFrom: KnowledgeSentFrom = {
    app: source.row.app,
    title: cut(source.row.title || 'Untitled', TITLE_MAX),
    link,
  };
  if (body?.record === true) {
    const held = await env.INDEX_DB.prepare(
      'SELECT COUNT(*) AS n FROM knowledge_sends WHERE source_id = ?',
    )
      .bind(source.row.id)
      .first<{ n: number }>();
    if ((held?.n ?? 0) >= PLAN_SENDS_PER_SOURCE_MAX) return fail(409, 'source_full');
    await insertRow(env, {
      id: newSendId(),
      source_id: source.row.id,
      source_tab_id: read.source.tabId ?? '',
      elements: JSON.stringify(read.source.elementIds),
      kb_id: kbId,
      page_id: read.page.id,
      page_title: read.page.title,
      place_link: link,
      at: Date.now(),
    });
    console.info('[index] agent knowledge send', { app: source.row.app });
  }
  return json({ sentFrom });
}
