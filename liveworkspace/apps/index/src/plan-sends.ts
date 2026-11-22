// Send to Plan on the index (liveworkspace/docs/specs/004-index/send-to-plan.md, its blueprint): a sticky, words, a
// thread or an action in any app made a liveplanner card as the person, and each source's sends for its chips.
//
//   POST /items/:id/plan-sends          a send to the plan `id`, as the person          → 201 {sends}
//   GET  /items/:id/plan-sends          the source `id`'s sends the reader may see      → 200 {sends}
//   POST /plan-sends/plans              New Plan: an empty Kanban plan of the person's  → 201 {item}
//   POST /app/items/:id/plan-cards      liveplanner: the plan's sent cards changed       → 200 {told}
//   POST /app/items/:id/plan-sends      liveplanner: an agent's cards with a source      → 200 {sentFrom}
//
// The card is made only by liveplanner's own door, on the person's grant at Editor on the whole plan, which the door
// checks again before it writes. The source needs only the person's read. A source's chip shows only to a reader who
// can open its plan, so no plan's name or card's progress reaches anyone who could not see them.

import {
  ITEM_GRANT_HEADER,
  planSendDescription,
  planSendDoorPath,
  planSendRef,
  PLAN_SEND_CARDS_MAX,
  PLAN_SEND_PLACES_MAX,
  PLAN_SEND_PLANS_CHECKED_MAX,
  PLAN_SEND_READ_MAX,
  PLAN_SEND_SOURCES_SIGNAL_MAX,
  PLAN_SEND_TEXT_MAX,
  PLAN_SEND_TITLE_MAX,
  PLAN_SENDS_PER_SOURCE_MAX,
  readAgentSentFrom,
  readPlanCardChanges,
  readPlanSendAsk,
  textPart,
  type AgentSentFrom,
  type App,
  type PlanSend,
  type PlanSendDoorCall,
  type PlanSendKind,
  type PlanSendPlace,
  type SentFrom,
  type SourceChange,
} from '@liveworkspace/index-client';
import { APP_ITEMS } from '@liveworkspace/sites';
import { loadItem } from './access';
import { callApp, callAppForJson, eachLimited } from './app-calls';
import type { Caller, Person } from './auth';
import { isId } from './codec';
import { APP_CALL_TIMEOUT_MS, KIT_CREATE_TIMEOUT_MS } from './config';
import { appSiteOrigin } from './connection-rows';
import { isDelegate } from './connections';
import type { PersonContext, RouteContext } from './context';
import type { Env } from './env';
import { mintGrant } from './grants';
import { badRequest, fail, forbidden, json, notFound, readObject, unauthorized } from './http';
import { overRunLimit } from './kits';
import { getItemRow, toItem, type ItemRow } from './rows';
import { SOURCE_SIGNAL_CONCURRENCY } from './sheet-sources';

const PLAN_APP = 'liveplanner' as const;
const COLUMN_MAX = 120;
const NAME_MAX = 120;

type SendRow = {
  id: string;
  source_id: string;
  ref: string;
  kind: PlanSendKind;
  plan_id: string;
  card_id: string;
  card_title: string;
  column_name: string;
  done: number;
  at: number;
};

const enc = encodeURIComponent;
const cut = (s: string, max: number) => (s.length > max ? s.slice(0, max) : s);
const newSendId = () => `ps_${crypto.randomUUID().replaceAll('-', '').slice(0, 20)}`;

/** The card's own address in liveplanner. */
export const cardLink = (env: Pick<Env, 'ENVIRONMENT'>, planId: string, cardId: string): string =>
  `${appSiteOrigin(env, PLAN_APP)}${APP_ITEMS[PLAN_APP].itemPath}${enc(planId)}#item=${enc(cardId)}`;

/** The exact place in its app: the item's address and the editor's deep link (each app's collab-deep-link.ts). */
export function placeLink(
  env: Pick<Env, 'ENVIRONMENT'>,
  place: Pick<PlanSendPlace, 'app' | 'itemId' | 'kind' | 'tabId' | 'elementId'>,
): string {
  const base = `${appSiteOrigin(env, place.app)}${APP_ITEMS[place.app].itemPath}${enc(place.itemId)}`;
  const parts: string[] = [];
  if (place.tabId) parts.push(`t=${enc(place.tabId)}`);
  if (place.elementId) {
    // A plan's card thread opens its card; anywhere else, the element, and its thread or action.
    if (place.app === PLAN_APP) parts.push(`item=${enc(place.elementId)}`);
    else {
      parts.push(`el=${enc(place.elementId)}`);
      if (place.kind === 'thread') parts.push('open=comments');
      if (place.kind === 'action') parts.push('open=action');
    }
  }
  return parts.length > 0 ? `${base}#${parts.join('&')}` : base;
}

const sendOf = (env: Env, r: SendRow, planTitle: string): PlanSend => ({
  id: r.id,
  ref: r.ref,
  kind: r.kind,
  plan: { id: r.plan_id, title: planTitle },
  card: { id: r.card_id, title: r.card_title, column: r.column_name, done: r.done === 1 },
  link: cardLink(env, r.plan_id, r.card_id),
  at: r.at,
});

// The person as the access rule reads someone the index acts for: an account, their teams read fresh.
const asPerson = (id: string): Caller => ({
  person: { id, kind: 'account', teams: [] },
  share: null,
});

// A send's person: an account in person, never an app, the Drive mirror or an export acting for them.
function sender(ctx: RouteContext): Person | Response {
  const person = ctx.caller.person;
  if (!person) return unauthorized();
  if (isDelegate(person)) return forbidden();
  if (person.kind !== 'account') return forbidden('sign_in_required');
  return person;
}

type Row = {
  id: string;
  source_id: string;
  ref: string;
  kind: string;
  plan_id: string;
  card_id: string;
  card_title: string;
  column_name: string;
  at: number;
};

async function insertRows(env: Env, rows: Row[]): Promise<void> {
  if (rows.length === 0) return;
  await env.INDEX_DB.prepare(
    `INSERT INTO plan_sends (id, source_id, ref, kind, plan_id, card_id, card_title, column_name, done, gone, at, updated_at)
     SELECT json_extract(value, '$.id'), json_extract(value, '$.source_id'), json_extract(value, '$.ref'),
            json_extract(value, '$.kind'), json_extract(value, '$.plan_id'), json_extract(value, '$.card_id'),
            json_extract(value, '$.card_title'), json_extract(value, '$.column_name'),
            0, 0, json_extract(value, '$.at'), json_extract(value, '$.at')
     FROM json_each(?)`,
  )
    .bind(JSON.stringify(rows))
    .run();
}

/** POST /items/:id/plan-sends: a send to the plan `planId`. */
async function sendToPlan(ctx: RouteContext, planId: string): Promise<Response> {
  const { env } = ctx;
  const person = sender(ctx);
  if (person instanceof Response) return person;
  const limited = await overRunLimit(env, `plan-send:${person.id}`);
  if (limited) return limited;
  const ask = readPlanSendAsk(await readObject(ctx.request));
  if (!ask) return badRequest();
  const places = ask.cards.flatMap((c) => c.places);
  // One source a send, and no more places than a card's checklist could hold.
  const sourceId = places[0]!.itemId;
  if (places.length > PLAN_SEND_PLACES_MAX || places.some((p) => p.itemId !== sourceId))
    return badRequest();

  // The plan: the person's Editor access on the whole of it, live, a plan.
  const plan = await loadItem(env, planId, { person, share: null }, 'edit');
  if (plan instanceof Response) return plan;
  if (plan.row.app !== PLAN_APP || plan.access.tabId !== null) return forbidden();
  if (plan.row.trashed_at !== null || plan.row.archived_at !== null) return notFound();

  // The source: the person's own read, any level, every app.
  const source = await loadItem(env, sourceId, { person, share: null }, 'view');
  if (source instanceof Response) return source.status === 403 ? notFound() : source;
  if (places.some((p) => p.app !== source.row.app)) return badRequest();

  const held = await env.INDEX_DB.prepare(
    'SELECT COUNT(*) AS n FROM plan_sends WHERE source_id = ?',
  )
    .bind(sourceId)
    .first<{ n: number }>();
  if ((held?.n ?? 0) + places.length > PLAN_SENDS_PER_SOURCE_MAX) return fail(409, 'source_full');

  // A place already sent to a live card in this plan is offered that card, unless asked again.
  if (!ask.again) {
    const same = await env.INDEX_DB.prepare(
      `SELECT id, source_id, ref, kind, plan_id, card_id, card_title, column_name, done, at FROM plan_sends
       WHERE plan_id = ? AND source_id = ? AND gone = 0 AND ref IN (SELECT value FROM json_each(?))
       ORDER BY at DESC LIMIT 1`,
    )
      .bind(planId, sourceId, JSON.stringify(places.map(planSendRef)))
      .first<SendRow>();
    if (same)
      return json(
        { error: 'already_sent', send: sendOf(env, same, plan.row.title) },
        { status: 409 },
      );
  }

  const grant = await mintGrant(env, {
    app: PLAN_APP,
    sub: person.id,
    itemId: planId,
    level: plan.access.level,
    tabId: null,
    ownerId: plan.row.owner_id,
    teamId: plan.row.team_id,
    link: plan.access.code,
  });
  if (!grant) return fail(503, 'grants_unavailable');
  const call: PlanSendDoorCall = {
    person: person.id,
    board: ask.board,
    column: ask.column,
    cards: ask.cards.map((card) => {
      const first = card.places[0]!;
      const link = placeLink(env, first);
      const sentFrom: SentFrom = {
        app: first.app,
        itemId: sourceId,
        title: cut(source.row.title, PLAN_SEND_TITLE_MAX),
        kind: first.kind,
        label: first.label,
        text: first.text,
        link,
      };
      const description = cut(
        planSendDescription(card.places, {
          title: source.row.title,
          label: first.label,
          app: first.app,
          link,
        }),
        PLAN_SEND_TEXT_MAX * 2,
      );
      return {
        title: card.title,
        description,
        ...(card.assignee ? { assignee: card.assignee } : {}),
        ...(card.due ? { due: card.due } : {}),
        ...(card.checklist ? { checklist: card.checklist } : {}),
        sentFrom,
      };
    }),
  };
  const res = await callAppForJson(
    env,
    PLAN_APP,
    planSendDoorPath(planId).slice('/api/internal'.length),
    call,
    APP_CALL_TIMEOUT_MS,
    { [ITEM_GRANT_HEADER]: grant.grant },
  );
  if (!res.ok) {
    console.warn('[index] plan send not taken', { error: res.error });
    if (res.error === 'status_403' || res.error === 'status_404') return forbidden();
    return fail(503, 'plan_unavailable');
  }
  const answer = res.body;
  if (answer.ok !== true || !Array.isArray(answer.cards)) {
    const reason = typeof answer.reason === 'string' ? answer.reason.slice(0, 200) : '';
    const code = typeof answer.code === 'string' ? answer.code : 'failed';
    return json({ error: 'plan_refused', code, reason }, { status: 422 });
  }
  const made = answer.cards as { id?: unknown; title?: unknown; column?: unknown }[];
  const now = Date.now();
  const rows: Row[] = [];
  ask.cards.forEach((card, i) => {
    const c = made[i];
    if (!c || !isId(c.id)) return;
    for (const place of card.places)
      rows.push({
        id: newSendId(),
        source_id: sourceId,
        ref: planSendRef(place),
        kind: place.kind,
        plan_id: planId,
        card_id: c.id,
        card_title: cut(typeof c.title === 'string' ? c.title : card.title, PLAN_SEND_TITLE_MAX),
        column_name: cut(typeof c.column === 'string' ? c.column : ask.column, COLUMN_MAX),
        at: now,
      });
  });
  await insertRows(env, rows);
  console.info('[index] plan send', { cards: made.length, places: rows.length });
  const sends = rows.map((r) =>
    sendOf(env, { ...r, kind: r.kind as PlanSendKind, done: 0 }, plan.row.title),
  );
  return json({ sends }, { status: 201 });
}

/** GET /items/:id/plan-sends: the source's sends whose plans the reader can open, newest first. */
async function readSends(ctx: RouteContext, sourceId: string): Promise<Response> {
  const { env, caller } = ctx;
  const source = await loadItem(env, sourceId, caller, 'view');
  if (source instanceof Response) return source;
  const person = caller.person;
  // A visitor with no identity holds no plan to see a card in.
  if (!person) return json({ sends: [] });
  const rows =
    (
      await env.INDEX_DB.prepare(
        `SELECT id, source_id, ref, kind, plan_id, card_id, card_title, column_name, done, at FROM plan_sends
         WHERE source_id = ? AND gone = 0 ORDER BY at DESC LIMIT ?`,
      )
        .bind(sourceId, PLAN_SEND_READ_MAX)
        .all<SendRow>()
    ).results ?? [];
  // Each plan once, newest first, on the reader's own access (no share code of the source's carries over).
  const plans = [...new Set(rows.map((r) => r.plan_id))].slice(0, PLAN_SEND_PLANS_CHECKED_MAX);
  const open = new Map<string, string>();
  await Promise.all(
    plans.map(async (planId) => {
      const plan = await loadItem(env, planId, { person, share: null }, 'view');
      if (plan instanceof Response) {
        await plan.body?.cancel();
        return;
      }
      if (plan.row.trashed_at === null && plan.row.archived_at === null)
        open.set(planId, plan.row.title);
    }),
  );
  const sends = rows.flatMap((r) => {
    const title = open.get(r.plan_id);
    return title === undefined ? [] : [sendOf(env, r, title)];
  });
  return json({ sends });
}

export async function handlePlanSends(ctx: RouteContext, id: string): Promise<Response> {
  if (ctx.request.method === 'POST') return sendToPlan(ctx, id);
  if (ctx.request.method === 'GET') return readSends(ctx, id);
  return notFound();
}

/** POST /plan-sends/plans: New Plan, an empty Kanban plan of the person's own, through liveplanner's template door. */
export async function handleNewPlanForSend(ctx: PersonContext): Promise<Response> {
  const { env, request, segments } = ctx;
  if (request.method !== 'POST' || segments.length !== 2 || segments[1] !== 'plans')
    return notFound();
  const person = sender(ctx);
  if (person instanceof Response) return person;
  const limited = await overRunLimit(env, `plan-send:${person.id}`);
  if (limited) return limited;
  const body = await readObject(request);
  const name = typeof body?.name === 'string' ? body.name.trim() : '';
  if (!name || name.length > NAME_MAX) return badRequest();
  const res = await callAppForJson(
    env,
    PLAN_APP,
    '/items/from-template',
    { owner: person.id, folderId: null, name, template: 'kanban' },
    KIT_CREATE_TIMEOUT_MS,
  );
  const id = res.ok ? res.body.id : undefined;
  const row = isId(id) ? await getItemRow(env, id) : null;
  if (!row || row.owner_id !== person.id || row.app !== PLAN_APP) {
    console.warn('[index] new plan not made', { error: res.ok ? 'invalid_item' : res.error });
    return fail(503, 'plan_unavailable');
  }
  const item = toItem(
    row,
    { level: 'edit', tabId: null, via: 'owner', code: null },
    {
      lastOpenedAt: null,
      hiddenFromRecent: false,
    },
  );
  return json({ item }, { status: 201 });
}

// The plan an app's call names: liveplanner's, and the calling app's.
async function ownPlan(env: Env, app: App, planId: string): Promise<ItemRow | Response> {
  const row = await getItemRow(env, planId);
  if (!row) return notFound();
  if (row.app !== app || app !== PLAN_APP) return fail(403, 'wrong_app');
  return row;
}

/** POST /app/items/:id/plan-cards: the plan's sent cards changed; each source whose sends changed is told. */
export async function handlePlanCards(
  request: Request,
  env: Env,
  app: App,
  planId: string,
): Promise<Response> {
  if (request.method !== 'POST') return notFound();
  const plan = await ownPlan(env, app, planId);
  if (plan instanceof Response) return plan;
  const changes = readPlanCardChanges(await readObject(request));
  if (!changes) return badRequest();
  const now = Date.now();
  const results = await env.INDEX_DB.batch<{ source_id: string }>(
    changes.map((c) =>
      env.INDEX_DB.prepare(
        `UPDATE plan_sends SET card_title = ?1, column_name = ?2, done = ?3, gone = ?4, updated_at = ?5
         WHERE plan_id = ?6 AND card_id = ?7
           AND (card_title IS NOT ?1 OR column_name IS NOT ?2 OR done IS NOT ?3 OR gone IS NOT ?4)
         RETURNING source_id`,
      ).bind(
        cut(c.title, PLAN_SEND_TITLE_MAX),
        cut(c.column, COLUMN_MAX),
        c.done ? 1 : 0,
        c.gone ? 1 : 0,
        now,
        planId,
        c.id,
      ),
    ),
  );
  const changedCards: string[] = [];
  const sources = new Set<string>();
  results.forEach((r, i) => {
    const hit = r.results ?? [];
    if (hit.length === 0) return;
    changedCards.push(changes[i]!.id);
    for (const s of hit) sources.add(s.source_id);
  });
  if (sources.size === 0) return json({ told: 0 });
  const told =
    (
      await env.INDEX_DB.prepare(
        'SELECT id, app FROM items WHERE id IN (SELECT value FROM json_each(?)) LIMIT ?',
      )
        .bind(JSON.stringify([...sources]), PLAN_SEND_SOURCES_SIGNAL_MAX)
        .all<{ id: string; app: App }>()
    ).results ?? [];
  const change: SourceChange = { app: PLAN_APP, itemId: planId, sheetIds: [], cards: changedCards };
  await eachLimited(told, SOURCE_SIGNAL_CONCURRENCY, async (row) => {
    const result = await callApp(
      env,
      row.app,
      'POST',
      `/items/${enc(row.id)}/source-changed`,
      change,
    );
    if (!result.ok)
      console.warn('[index] plan card change not told', { app: row.app, error: result.error });
  });
  return json({ told: told.length });
}

type AgentCard = {
  id: string;
  title: string;
  column: string;
  done: boolean;
  sentFrom: AgentSentFrom;
};

function readAgentCards(
  body: Record<string, unknown> | null,
): { person: string; cards: AgentCard[] } | null {
  const person = body?.person;
  const cards = body?.cards;
  if (typeof person !== 'string' || !person.startsWith('user_') || !isId(person)) return null;
  if (!Array.isArray(cards) || cards.length === 0 || cards.length > PLAN_SEND_CARDS_MAX)
    return null;
  const out: AgentCard[] = [];
  for (const c of cards as Record<string, unknown>[]) {
    const sentFrom = readAgentSentFrom(c?.sentFrom);
    if (!sentFrom || !isId(c.id) || typeof c.title !== 'string' || typeof c.column !== 'string')
      return null;
    if (typeof c.done !== 'boolean') return null;
    out.push({
      id: c.id,
      title: cut(c.title, PLAN_SEND_TITLE_MAX),
      column: cut(c.column, COLUMN_MAX),
      done: c.done,
      sentFrom,
    });
  }
  return { person, cards: out };
}

/** POST /app/items/:id/plan-sends: an agent's cards with a source, filled in and recorded where the person can read
 *  the source; null for each it cannot. */
export async function handleAgentPlanSends(
  request: Request,
  env: Env,
  app: App,
  planId: string,
): Promise<Response> {
  if (request.method !== 'POST') return notFound();
  const plan = await ownPlan(env, app, planId);
  if (plan instanceof Response) return plan;
  const read = readAgentCards(await readObject(request));
  if (!read) return badRequest();
  const sources = new Map<string, ItemRow | null>();
  for (const id of new Set(read.cards.map((c) => c.sentFrom.itemId))) {
    const loaded = await loadItem(env, id, asPerson(read.person), 'view');
    if (loaded instanceof Response) {
      await loaded.body?.cancel();
      sources.set(id, null);
    } else sources.set(id, loaded.row);
  }
  const now = Date.now();
  const rows: Row[] = [];
  const sentFrom = read.cards.map((c): SentFrom | null => {
    const row = sources.get(c.sentFrom.itemId);
    if (!row || row.app !== c.sentFrom.app) return null;
    const kind: PlanSendKind = c.sentFrom.elementId ? 'element' : 'text';
    const place = {
      app: row.app,
      itemId: row.id,
      kind,
      tabId: c.sentFrom.tabId ?? null,
      elementId: c.sentFrom.elementId ?? null,
      part: kind === 'text' ? textPart(c.sentFrom.text) : null,
    };
    rows.push({
      id: newSendId(),
      source_id: row.id,
      ref: planSendRef(place),
      kind,
      plan_id: planId,
      card_id: c.id,
      card_title: c.title,
      column_name: c.column,
      at: now,
    });
    return {
      app: row.app,
      itemId: row.id,
      title: cut(row.title, PLAN_SEND_TITLE_MAX),
      kind,
      label: '',
      text: c.sentFrom.text,
      link: placeLink(env, place),
    };
  });
  const held = new Map<string, number>();
  for (const r of rows) held.set(r.source_id, (held.get(r.source_id) ?? 0) + 1);
  for (const [id, n] of held) {
    const count = await env.INDEX_DB.prepare(
      'SELECT COUNT(*) AS n FROM plan_sends WHERE source_id = ?',
    )
      .bind(id)
      .first<{ n: number }>();
    if ((count?.n ?? 0) + n > PLAN_SENDS_PER_SOURCE_MAX) return fail(409, 'source_full');
  }
  await insertRows(env, rows);
  console.info('[index] agent plan sends', { cards: read.cards.length, recorded: rows.length });
  return json({ sentFrom });
}
