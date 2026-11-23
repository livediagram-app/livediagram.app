// Start a Call Here on the index (liveworkspace/docs/specs/004-index/item-calls.md, its blueprint): a livehuddle call
// about any item, its live count for every open editor, the invites, the summary and the item's Meetings.
//
//   POST /items/:id/calls                 start the item's call, or join the live one, as the person  → 201|200
//   GET  /items/:id/calls                 the item's live call and meetings, on the reader's access    → 200
//   GET  /items/:space/call               a Space's call, for livehuddle's editor                      → 200
//   GET  /items/:space/call/people        whom the call may invite beside the item's team               → 200
//   POST /items/:space/call/summary       the host's summary, written in a knowledgebase as the host   → 201
//   POST /items/:space/call/invite        invites to people who reach the item                         → 200
//
// The Space is livehuddle's, made through its template door as the person's. Its Participant link is the way in,
// handed only to someone the index has just found can read the item.

import { sha256Hex } from '@liveworkspace/api-schema/sha256';
import {
  ITEM_CALL_APP,
  ITEM_CALL_NAME_SUFFIX,
  ITEM_CALL_TEMPLATE,
  readCallInviteAsk,
  readCallSummaryAsk,
  type ItemCallStart,
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
import { accountsPeopleNames } from './accounts-access';
import type { RouteContext } from './context';
import type { Env } from './env';
import { badRequest, fail, forbidden, json, notFound, readObject, unauthorized } from './http';
import {
  callOf,
  CALL_COLUMNS,
  itemLink,
  liveCallOf,
  readMeetings,
  tellItemCalls,
  type CallRow,
} from './item-call-reads';
import { overRunLimit } from './kits';
import { getItemRow, type ItemRow } from './rows';

const NAME_MAX = 120;
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

/** POST /items/:id/calls: the item's live call, or a new one. */
async function startCall(ctx: RouteContext, itemId: string): Promise<Response> {
  const { env } = ctx;
  const person = account(ctx);
  if (person instanceof Response) return person;
  const limited = await overRunLimit(env, `item-call:${person.id}`);
  if (limited) return limited;
  const item = await loadItem(env, itemId, ctx.caller, 'view');
  if (item instanceof Response) return item;
  if (item.row.app === ITEM_CALL_APP) return badRequest('not_for_spaces');
  if (item.row.trashed_at !== null || item.row.archived_at !== null) return notFound();
  const now = Date.now();
  const live = await liveCallOf(env, itemId, now);
  if (live) return json({ call: callOf(env, live, now), started: false } satisfies ItemCallStart);

  // The Space: a Team Pod of the person's own, named for the item.
  const name = cut(`${item.row.title || 'Untitled'}${ITEM_CALL_NAME_SUFFIX}`, NAME_MAX);
  const res = await callAppForJson(
    env,
    ITEM_CALL_APP,
    '/items/from-template',
    { owner: person.id, folderId: null, name, template: ITEM_CALL_TEMPLATE },
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
    env.INDEX_DB.prepare(
      `INSERT INTO item_calls (id, item_id, space_id, host_id, share_code, people, names, started_at, updated_at)
       VALUES (?, ?, ?, ?, (SELECT code FROM share_links WHERE code = ?), 0, '[]', ?, ?)`,
    ).bind(id, itemId, space.id, person.id, code, now, now),
  ]);
  // The room keeps the call's id, and from then on says who is in it. A failure leaves the call working, its count
  // still.
  const marked = await callApp(env, ITEM_CALL_APP, 'POST', `/items/${space.id}/call`, {
    callId: id,
  });
  if (!marked.ok) console.warn('[index] call not marked', { error: marked.error });
  console.info('[index] call started', { app: item.row.app });
  const row = await env.INDEX_DB.prepare(`SELECT ${CALL_COLUMNS} FROM item_calls WHERE id = ?`)
    .bind(id)
    .first<CallRow>();
  return json({ call: callOf(env, row!, now), started: true } satisfies ItemCallStart, {
    status: 201,
  });
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

// The call whose Space this is, and the reader's view of the Space.
async function callOfSpace(
  ctx: RouteContext,
  spaceId: string,
): Promise<{ call: CallRow; item: ItemRow } | null | Response> {
  const { env } = ctx;
  const call = await env.INDEX_DB.prepare(
    `SELECT ${CALL_COLUMNS} FROM item_calls WHERE space_id = ?`,
  )
    .bind(spaceId)
    .first<CallRow>();
  if (!call) return null;
  const space = await loadItem(env, spaceId, ctx.caller, 'view');
  if (space instanceof Response) return space;
  const item = await getItemRow(env, call.item_id);
  if (!item || item.trashed_at !== null) return null;
  return { call, item };
}

// The knowledgebase a summary goes to by default: one connected to the item (either way), else the newest of the
// item's team the host can edit.
async function summaryDefault(
  env: Env,
  item: ItemRow,
  host: Person,
): Promise<SpaceCall['summaryDefault']> {
  const connected = await env.INDEX_DB.prepare(
    `SELECT i.id, i.title FROM connections c JOIN items i
       ON (c.host_item_id = ?1 AND i.id = c.target_item_id) OR (c.target_item_id = ?1 AND i.id = c.host_item_id)
     WHERE i.app = 'liveknowledge' AND i.trashed_at IS NULL AND i.archived_at IS NULL
     ORDER BY c.created_at DESC LIMIT 1`,
  )
    .bind(item.id)
    .first<{ id: string; title: string }>();
  const candidate =
    connected ??
    (item.team_id
      ? await env.INDEX_DB.prepare(
          `SELECT id, title FROM items WHERE team_id = ? AND app = 'liveknowledge'
             AND trashed_at IS NULL AND archived_at IS NULL ORDER BY updated_at DESC LIMIT 1`,
        )
          .bind(item.team_id)
          .first<{ id: string; title: string }>()
      : null);
  if (!candidate) return null;
  const can = await loadItem(env, candidate.id, { person: host, share: null }, 'edit');
  if (can instanceof Response) {
    await can.body?.cancel();
    return null;
  }
  return { id: candidate.id, title: candidate.title };
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
    summaryDefault: host && person ? await summaryDefault(env, item, person) : null,
  };
  return json({ call: answer });
}

/** GET /items/:space/call/people: whom the call may invite beside the item's team (the owner, its link visitors). */
async function readInvitePeople(ctx: RouteContext, spaceId: string): Promise<Response> {
  const person = account(ctx);
  if (person instanceof Response) return person;
  const found = await callOfSpace(ctx, spaceId);
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
  const found = await callOfSpace(ctx, spaceId);
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
  return notFound();
}
