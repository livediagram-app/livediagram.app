// Start a Call Here on the index (liveworkspace/docs/specs/004-index/item-calls.md, its blueprint): a livehuddle call
// about any item, its live count for every open editor, the invites, the summary and the item's Meetings.
//
//   POST /items/:id/calls                 start the item's call, or join the live one, as the person  → 201|200
//   GET  /items/:id/calls                 the item's live call and meetings, on the reader's access    → 200
//   GET  /items/:space/call               a Space's call, for livehuddle's editor                      → 200
//   GET  /items/:space/call/people        whom the call may invite beside the item's team               → 200
//   POST /items/:space/call/summary       the host's summary, written in a knowledgebase as the host   → 201
//   POST /items/:space/call/invite        invites to people who reach the item                         → 200
//   POST /items/:space/call/keep          the Space chosen as the Calls Space stays when its call ends  → 204
//
// The Space is livehuddle's, made through its template door as the person's, or the person's Calls Space when they
// chose one ("Your Calls Space"). Its Participant link is the way in, handed only to someone the index has just found
// can read the item.

import { sha256Hex } from '@liveworkspace/api-schema/sha256';
import {
  CALL_SPACE_LINK_DAYS,
  ITEM_CALL_APP,
  ITEM_CALL_NAME_SUFFIX,
  ITEM_CALL_TEMPLATE,
  readCallInviteAsk,
  readCallSummaryAsk,
  readItemCallAsk,
  type CallSpaceFallback,
  type ItemCallStart,
  type Level,
  type SpaceCall,
} from '@liveworkspace/index-client';
import { loadItem } from './access';
import { approvalCandidates, checkNameable } from './approval-people';
import { callApp, callAppForJson } from './app-calls';
import type { Person } from './auth';
import { takeTargetedStep } from './automation-steps';
import { generateShareCode, isId } from './codec';
import { KIT_CREATE_TIMEOUT_MS } from './config';
import { isDelegate } from './connections';
import { defaultKnowledgebase } from './knowledgebase-default';
import { accountsPeopleNames } from './accounts-access';
import type { RouteContext } from './context';
import {
  badRequest,
  fail,
  forbidden,
  json,
  noContent,
  notFound,
  readObject,
  unauthorized,
} from './http';
import { keepMadeSpace } from './item-call-sweep';
import {
  callOf,
  CALL_COLUMNS,
  isLive,
  itemLink,
  liveCallOf,
  newestCallOfSpace,
  readMeetings,
  tellItemCalls,
  type CallRow,
} from './item-call-reads';
import { overRunLimit } from './kits';
import { getItemRow, type ItemRow } from './rows';

const NAME_MAX = 120;
// The Screen's file name: a live embed's (@liveworkspace/element-model LIVE_NAME_MAX).
const SCREEN_NAME_MAX = 200;
const DAY_MS = 24 * 60 * 60 * 1000;
const newCallId = () => `ic_${crypto.randomUUID().replaceAll('-', '').slice(0, 20)}`;

// An account in person, never an app, the Drive mirror or an export acting for them.
function account(ctx: RouteContext): Person | Response {
  const person = ctx.caller.person;
  if (!person) return unauthorized();
  if (isDelegate(person)) return forbidden();
  if (person.kind !== 'account') return forbidden('sign_in_required');
  return person;
}

const cut = (s: string, max: number) => (s.length > max ? s.slice(0, max) : s);

/** POST /items/:id/calls: the item's live call, or a new one (in the person's Calls Space when they chose one). */
async function startCall(ctx: RouteContext, itemId: string): Promise<Response> {
  const { env } = ctx;
  const person = account(ctx);
  if (person instanceof Response) return person;
  const limited = await overRunLimit(env, `item-call:${person.id}`);
  if (limited) return limited;
  const raw = await readObject(ctx.request);
  const ask = raw && readItemCallAsk(raw);
  if (!ask) return badRequest();
  const item = await loadItem(env, itemId, ctx.caller, 'view');
  if (item instanceof Response) return item;
  if (item.row.app === ITEM_CALL_APP) return badRequest('not_for_spaces');
  if (item.row.trashed_at !== null || item.row.archived_at !== null) return notFound();
  const now = Date.now();
  const live = await liveCallOf(env, itemId, now);
  if (live) return json({ call: callOf(env, live, now), started: false } satisfies ItemCallStart);

  // The person's Calls Space, checked again now; when it is skipped, the answer says why and the call has a Space of
  // its own, below.
  let fallback: CallSpaceFallback | undefined;
  if (ask.space) {
    const started = await startInCallsSpace(ctx, person, item.row, ask.space, now);
    if (started instanceof Response) return started;
    fallback = started;
  }

  // The Space: a Document Room of the person's own, named for the item, the item on its wall Screen (item-calls.md
  // "Starting", Work Tracker 1427). Only a link and a name: each person in the room sees it with their own access.
  const name = cut(`${item.row.title || 'Untitled'}${ITEM_CALL_NAME_SUFFIX}`, NAME_MAX);
  const screen = {
    app: item.row.app,
    itemId: item.row.id,
    name: cut(item.row.title || 'Untitled', SCREEN_NAME_MAX),
  };
  const res = await callAppForJson(
    env,
    ITEM_CALL_APP,
    '/items/from-template',
    { owner: person.id, folderId: null, name, template: ITEM_CALL_TEMPLATE, screen },
    KIT_CREATE_TIMEOUT_MS,
  );
  const spaceId = res.ok ? res.body.id : undefined;
  const space = isId(spaceId) ? await getItemRow(env, spaceId) : null;
  if (!space || space.owner_id !== person.id || space.app !== ITEM_CALL_APP) {
    console.warn('[index] call not made', { error: res.ok ? 'invalid_item' : res.error });
    return fail(503, 'call_unavailable');
  }
  const id = newCallId();
  const code = generateShareCode();
  await env.INDEX_DB.batch([
    // Its way in: a Participant link on the Space, never expiring, every tab.
    env.INDEX_DB.prepare(
      `INSERT INTO share_links (code, item_id, level, tab_id, expiry, expires_at, created_at, public)
       VALUES (?, ?, 'participate', NULL, 'never', NULL, ?, 0)`,
    ).bind(code, space.id, now),
    // Made by Call: the one mark that sends the Space to the Trash when its call ends (item-calls.md "When a call
    // ends"). Set here alone.
    env.INDEX_DB.prepare(
      `INSERT INTO item_calls (id, item_id, space_id, host_id, share_code, people, names, started_at, updated_at,
         made)
       VALUES (?, ?, ?, ?, (SELECT code FROM share_links WHERE code = ?), 0, '[]', ?, ?, 1)`,
    ).bind(id, itemId, space.id, person.id, code, now, now),
  ]);
  return markAndAnswer(ctx, id, space.id, item.row.app, now, fallback);
}

// The room keeps the call's id, and from then on says who is in it. A failure leaves the call working, its count
// still. Then the call as made: 201.
async function markAndAnswer(
  ctx: RouteContext,
  id: string,
  spaceId: string,
  app: string,
  now: number,
  fallback?: CallSpaceFallback,
): Promise<Response> {
  const { env } = ctx;
  const marked = await callApp(env, ITEM_CALL_APP, 'POST', `/items/${spaceId}/call`, {
    callId: id,
  });
  if (!marked.ok) console.warn('[index] call not marked', { error: marked.error });
  console.info('[index] call started', fallback ? { app, fallback } : { app });
  const row = await env.INDEX_DB.prepare(`SELECT ${CALL_COLUMNS} FROM item_calls WHERE id = ?`)
    .bind(id)
    .first<CallRow>();
  const answer: ItemCallStart = { call: callOf(env, row!, now), started: true };
  if (fallback) answer.fallback = fallback;
  return json(answer, { status: 201 });
}

/** The person's Calls Space, when they may choose it now: their own or their team's (never one reached through a
 *  link), livehuddle's, out of the Trash and Archived. */
async function callsSpace(env: RouteContext['env'], person: Person, id: string) {
  const loaded = await loadItem(env, id, { person, share: null }, 'edit', { manage: true });
  if (loaded instanceof Response) {
    await loaded.body?.cancel();
    return null;
  }
  const { row } = loaded;
  return row.app === ITEM_CALL_APP && row.trashed_at === null && row.archived_at === null
    ? row
    : null;
}

/** A call in the person's Calls Space (item-calls.md "Your Calls Space"): 201, or why it was skipped. One item's call
 *  at a time; an earlier call there that never ended is ended; the Space's call link is reused, working a week from
 *  now. */
async function startInCallsSpace(
  ctx: RouteContext,
  person: Person,
  item: ItemRow,
  spaceId: string,
  now: number,
): Promise<Response | CallSpaceFallback> {
  const { env } = ctx;
  const space = await callsSpace(env, person, spaceId);
  if (!space) return 'unavailable';
  const newest = await newestCallOfSpace(env, space.id);
  if (newest && isLive(newest, now)) return 'busy';
  // The link the Space's last call had, while it is still on the Space at Participant: one call link a Space.
  const kept = newest?.share_code
    ? await env.INDEX_DB.prepare(
        `SELECT code FROM share_links WHERE code = ? AND item_id = ? AND level = 'participate'`,
      )
        .bind(newest.share_code, space.id)
        .first<{ code: string }>()
    : null;
  const code = kept?.code ?? generateShareCode();
  const expiresAt = now + CALL_SPACE_LINK_DAYS * DAY_MS;
  const id = newCallId();
  await env.INDEX_DB.batch([
    env.INDEX_DB.prepare(
      `UPDATE item_calls SET ended_at = ?1, people = 0, updated_at = ?1 WHERE space_id = ?2 AND ended_at IS NULL`,
    ).bind(now, space.id),
    // A Calls Space is never made by Call, even one that was.
    keepMadeSpace(env.INDEX_DB, space.id),
    kept
      ? env.INDEX_DB.prepare(
          `UPDATE share_links SET expiry = 'week', expires_at = ? WHERE code = ?`,
        ).bind(expiresAt, code)
      : env.INDEX_DB.prepare(
          `INSERT INTO share_links (code, item_id, level, tab_id, expiry, expires_at, created_at, public)
           VALUES (?, ?, 'participate', NULL, 'week', ?, ?, 0)`,
        ).bind(code, space.id, expiresAt, now),
    env.INDEX_DB.prepare(
      `INSERT INTO item_calls (id, item_id, space_id, host_id, share_code, people, names, started_at, updated_at,
         chosen)
       VALUES (?, ?, ?, ?, (SELECT code FROM share_links WHERE code = ?), 0, '[]', ?, ?, 1)`,
    ).bind(id, item.id, space.id, person.id, code, now, now),
  ]);
  return markAndAnswer(ctx, id, space.id, item.app, now);
}

/** POST /items/:space/call/keep: Settings › Calls chose the Space, so it is the person's own and never goes to the
 *  Trash when a call ends. Its owner's or its team's alone, as a Calls Space can be chosen. */
async function keepSpace(ctx: RouteContext, spaceId: string): Promise<Response> {
  const person = account(ctx);
  if (person instanceof Response) return person;
  const loaded = await loadItem(ctx.env, spaceId, { person, share: null }, 'edit', {
    manage: true,
  });
  if (loaded instanceof Response) return loaded;
  if (loaded.row.app !== ITEM_CALL_APP) return notFound();
  await keepMadeSpace(ctx.env.INDEX_DB, spaceId).run();
  return noContent();
}

/** GET /items/:id/calls: the item's live call and its meetings, on the reader's own access. */
async function readCalls(ctx: RouteContext, itemId: string): Promise<Response> {
  const { env, caller } = ctx;
  const item = await loadItem(env, itemId, caller, 'view');
  if (item instanceof Response) return item;
  return json(await readMeetings(env, itemId, caller.person, Date.now()));
}

export async function handleItemCalls(ctx: RouteContext, id: string): Promise<Response> {
  if (ctx.request.method === 'POST') return startCall(ctx, id);
  if (ctx.request.method === 'GET') return readCalls(ctx, id);
  return notFound();
}

// The call whose Space this is, and the reader's access to the Space at `level` (`view` to read it; `participate` to
// invite, so a Viewer of the Space invites no one, item-calls.md "Invites", Work Tracker 1458).
async function callOfSpace(
  ctx: RouteContext,
  spaceId: string,
  level: Level = 'view',
): Promise<{ call: CallRow; item: ItemRow } | null | Response> {
  const { env } = ctx;
  const call = await newestCallOfSpace(env, spaceId);
  if (!call) return null;
  const space = await loadItem(env, spaceId, ctx.caller, level);
  if (space instanceof Response) return space;
  const item = await getItemRow(env, call.item_id);
  if (!item || item.trashed_at !== null) return null;
  return { call, item };
}

/** GET /items/:space/call: the call, for livehuddle's editor; `{call: null}` for a Space that is no call. */
async function readSpaceCall(ctx: RouteContext, spaceId: string): Promise<Response> {
  const found = await callOfSpace(ctx, spaceId);
  if (found instanceof Response) return found;
  if (!found) return json({ call: null });
  const { env } = ctx;
  const { call, item } = found;
  const person = ctx.caller.person;
  const host = !!person && person.kind === 'account' && person.id === call.host_id;
  const now = Date.now();
  const read = callOf(env, call, now);
  const answer: SpaceCall = {
    id: call.id,
    item: { app: item.app, id: item.id, title: item.title, link: itemLink(env, item) },
    host,
    live: read.live,
    startedAt: call.started_at,
    names: read.names,
    summary:
      call.summary_link && call.summary_title
        ? { title: call.summary_title, link: call.summary_link }
        : null,
    summaryDefault: host && person ? await defaultKnowledgebase(env, item, person) : null,
  };
  return json({ call: answer });
}

/** GET /items/:space/call/people: whom the call may invite beside the item's team (the owner, its link visitors). */
async function readInvitePeople(ctx: RouteContext, spaceId: string): Promise<Response> {
  const person = account(ctx);
  if (person instanceof Response) return person;
  const found = await callOfSpace(ctx, spaceId, 'participate');
  if (found instanceof Response) return found;
  if (!found) return notFound();
  const reaches = await loadItem(ctx.env, found.item.id, { person, share: null }, 'view');
  if (reaches instanceof Response) return reaches;
  return json({
    teamId: found.item.team_id,
    people: await approvalCandidates(ctx.env, found.item, person.id),
  });
}

/** POST /items/:space/call/summary: the host's summary, a page in a knowledgebase written as the host. */
async function sendSummary(ctx: RouteContext, spaceId: string): Promise<Response> {
  const { env } = ctx;
  const person = account(ctx);
  if (person instanceof Response) return person;
  const found = await callOfSpace(ctx, spaceId);
  if (found instanceof Response) return found;
  if (!found) return notFound();
  const { call, item } = found;
  if (call.host_id !== person.id) return forbidden();
  const limited = await overRunLimit(env, `item-call:${person.id}`);
  if (limited) return limited;
  const ask = readCallSummaryAsk(await readObject(ctx.request));
  if (!ask) return badRequest();
  const kb = await getItemRow(env, ask.knowledgebase);
  if (!kb || kb.app !== 'liveknowledge') return badRequest();
  const answered = await takeTargetedStep(
    env,
    {
      author: person.id,
      rule: { id: 'call-summary', name: 'Meeting Summary' },
      from: { title: cut(item.title || 'Untitled', 200), url: itemLink(env, item) },
      chain: { id: call.id, hops: 0, rules: [] },
      app: ITEM_CALL_APP,
      sourceId: spaceId,
      ruleKey: `${ITEM_CALL_APP}:${spaceId}:call-summary`,
    },
    {
      kind: 'kb_page',
      target: { app: 'liveknowledge', item: kb.id, title: kb.title },
      title: ask.title,
      body: ask.body,
    },
  );
  if (!answered.ok || !answered.link) {
    console.warn('[index] call summary not written', {
      code: answered.ok ? 'no_link' : answered.code,
    });
    const reason = answered.ok ? '' : answered.reason;
    const code = answered.ok ? 'failed' : answered.code;
    return json({ error: 'summary_refused', code, reason }, { status: 422 });
  }
  await env.INDEX_DB.prepare(
    `UPDATE item_calls SET summary_item_id = ?, summary_link = ?, summary_title = ?, updated_at = ? WHERE id = ?`,
  )
    .bind(kb.id, answered.link, ask.title, Date.now(), call.id)
    .run();
  ctx.waitUntil(tellItemCalls(env, item, spaceId));
  console.info('[index] call summary written');
  return json({ summary: { title: ask.title, link: answered.link } }, { status: 201 });
}

/** POST /items/:space/call/invite: an Inbox row for each person picked, each of whom reaches the whole item. */
async function invite(ctx: RouteContext, spaceId: string): Promise<Response> {
  const { env } = ctx;
  const person = account(ctx);
  if (person instanceof Response) return person;
  const found = await callOfSpace(ctx, spaceId, 'participate');
  if (found instanceof Response) return found;
  if (!found) return notFound();
  const { call, item } = found;
  const reaches = await loadItem(env, item.id, { person, share: null }, 'view');
  if (reaches instanceof Response) return reaches;
  const limited = await overRunLimit(env, `item-call:${person.id}`);
  if (limited) return limited;
  const ask = readCallInviteAsk(await readObject(ctx.request));
  if (!ask) return badRequest();
  const people = ask.people.filter((id) => id !== person.id);
  if (people.length === 0) return json({ invited: 0 });
  const nameable = await checkNameable(env, item, people);
  if (nameable === 'unavailable') return fail(503, 'call_unavailable');
  if (nameable === 'cannot') return forbidden('cannot_invite');
  const names = await accountsPeopleNames(env)([person.id]);
  const byName = cut(names?.get(person.id)?.trim() || 'Someone', 80);
  const now = Date.now();
  const ids = await Promise.all(
    people.map((p) => sha256Hex(new TextEncoder().encode(`${call.id}\n${p}`))),
  );
  await env.INDEX_DB.batch(
    people.map((p, i) =>
      env.INDEX_DB.prepare(
        `INSERT OR IGNORE INTO item_call_invites (id, call_id, person_id, by_name, at) VALUES (?, ?, ?, ?, ?)`,
      ).bind(`ci:${ids[i]}`, call.id, p, byName, now),
    ),
  );
  console.info('[index] call invites', { people: people.length });
  return json({ invited: people.length });
}

export async function handleSpaceCall(
  ctx: RouteContext,
  spaceId: string,
  rest: string[],
): Promise<Response> {
  const method = ctx.request.method;
  if (rest.length === 0 && method === 'GET') return readSpaceCall(ctx, spaceId);
  if (rest.length === 1 && rest[0] === 'people' && method === 'GET')
    return readInvitePeople(ctx, spaceId);
  if (rest.length === 1 && rest[0] === 'summary' && method === 'POST')
    return sendSummary(ctx, spaceId);
  if (rest.length === 1 && rest[0] === 'invite' && method === 'POST') return invite(ctx, spaceId);
  if (rest.length === 1 && rest[0] === 'keep' && method === 'POST') return keepSpace(ctx, spaceId);
  return notFound();
}
