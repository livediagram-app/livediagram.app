// Request Access (liveworkspace/docs/specs/004-index/request-access.md): a signed-in person asks the people who run an
// item they can't open to share it with them; a manager of the item grants it (a share link made for them, the item in
// their Shared with me) or declines it.
//
//   POST /items/:id/access-requests                      {note?}   an account in person; the same 202 for every id
//   POST /items/:id/access-requests/:requestId/grant     {level?}  a manager of the item (its owner or team)
//   POST /items/:id/access-requests/:requestId/decline             the same
//
// Asking reveals nothing: the answer, and the time it takes, are the same whatever stands behind the id. The person's
// try is counted and answered first; the item is read and the request recorded after, off the response's path.

import {
  ACCESS_REQUEST_EMAILS_PER_ITEM_DAY,
  ACCESS_REQUEST_NOTE_MAX,
  ACCESS_REQUEST_REPEAT_MS,
  ACCESS_REQUESTS_PER_PERSON_DAY,
  APP_DEFAULT_LINK_LEVEL,
  isLevel,
  linkLevelOffered,
  SHARE_LINKS_PER_ITEM,
  type AccessNotice,
  type Level,
  type ShareLink,
} from '@liveworkspace/index-client';
import { accessTo, loadItem } from './access';
import { accountsPeopleNames, accountsPersonTeams } from './accounts-access';
import { archivedRefusal, isArchived } from './archive';
import type { Person } from './auth';
import { generateShareCode, isId } from './codec';
import { ACCESS_REQUEST_RETRY_AFTER_S } from './config';
import type { RouteContext } from './context';
import type { Env } from './env';
import { eventStatements } from './events';
import {
  badRequest,
  conflict,
  forbidden,
  json,
  noContent,
  notFound,
  readObject,
  unauthorized,
} from './http';
import { tellApp } from './notices';
import { getItemRow, type ItemRow } from './rows';

const DAY_MS = 24 * 60 * 60 * 1000;

// An account in person: not an app acting for them, the Drive mirror or the export.
function personOf(ctx: RouteContext): Person | Response {
  const person = ctx.caller.person;
  if (!person) return unauthorized();
  if (person.app || person.drive || person.export || person.kind !== 'account') {
    return forbidden('access_requests_need_a_person');
  }
  return person;
}

// The requester's note, trimmed: null for none, undefined when it is not text or runs past the cap.
function noteOf(value: unknown): string | null | undefined {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') return undefined;
  const text = value.trim();
  if (text.length > ACCESS_REQUEST_NOTE_MAX) return undefined;
  return text || null;
}

export async function handleAccessRequests(
  ctx: RouteContext,
  id: string,
  rest: string[],
): Promise<Response> {
  const person = personOf(ctx);
  if (person instanceof Response) return person;
  if (ctx.request.method !== 'POST') return notFound();
  if (rest.length === 0) return askRoute(ctx, id, person);
  const [requestId, verb] = rest;
  if (rest.length === 2 && isId(requestId) && (verb === 'grant' || verb === 'decline')) {
    return verb === 'grant'
      ? grantRoute(ctx, id, requestId, person)
      : declineRoute(ctx, id, requestId);
  }
  return notFound();
}

// ---------- Asking ---------------------------------------------------------------------------------------------------

async function askRoute(ctx: RouteContext, id: string, person: Person): Promise<Response> {
  const { env } = ctx;
  if (!isId(id)) return badRequest();
  const body = await readObject(ctx.request);
  if (!body) return badRequest();
  const note = noteOf(body.note);
  if (note === undefined) return badRequest();
  const now = Date.now();
  const db = env.INDEX_DB;
  const tries = await db
    .prepare('SELECT COUNT(*) AS n FROM access_request_tries WHERE person_id = ? AND at > ?')
    .bind(person.id, now - DAY_MS)
    .first<{ n: number }>();
  if ((tries?.n ?? 0) >= ACCESS_REQUESTS_PER_PERSON_DAY) {
    return json(
      { error: 'rate_limited' },
      { status: 429, headers: { 'Retry-After': String(ACCESS_REQUEST_RETRY_AFTER_S) } },
    );
  }
  await db.batch([
    db
      .prepare('INSERT INTO access_request_tries (person_id, at) VALUES (?, ?)')
      .bind(person.id, now),
    db
      .prepare('DELETE FROM access_request_tries WHERE person_id = ? AND at <= ?')
      .bind(person.id, now - DAY_MS),
  ]);
  // Only now is the item looked at, after the answer is decided: the same for every id.
  ctx.waitUntil(
    recordRequest(ctx, id, person, note, now).catch((err: unknown) => {
      console.warn('[access-requests] record failed', { error: String(err) });
    }),
  );
  return json({ requested: true }, { status: 202 });
}

// Whom the request email goes to: the personal item's owner; a team item's maker while they are still in its team, as
// accounts says now (IDX55). None when no one can be named; the team still sees it in the Inbox.
async function recipientsOf(env: Env, row: ItemRow): Promise<string[]> {
  if (row.team_id === null) return [row.owner_id];
  const teams = await accountsPersonTeams(env)(row.owner_id);
  return teams?.has(row.team_id) ? [row.owner_id] : [];
}

/** Records the request when the item is there, live, and not already reached by the person; tells its managers. */
export async function recordRequest(
  ctx: RouteContext,
  id: string,
  person: Person,
  note: string | null,
  now: number,
): Promise<void> {
  const { env } = ctx;
  const row = await getItemRow(env, id);
  if (!row || row.trashed_at !== null || isArchived(row)) return;
  // Their own access, or a live link in their Shared with me: nothing to ask for.
  const access = await accessTo(env, row, { person, share: null });
  if (!(access instanceof Response)) return;
  const names = await accountsPeopleNames(env)([person.id]);
  const name = names?.get(person.id) ?? null;
  const db = env.INDEX_DB;
  const [upsert, emailed] = (await db.batch([
    db
      .prepare(
        `INSERT INTO access_requests (id, item_id, requester_id, requester_name, note, state, asked_at)
         VALUES (?, ?, ?, ?, ?, 'open', ?)
         ON CONFLICT (requester_id, item_id) DO UPDATE SET state = 'open', note = excluded.note,
           requester_name = excluded.requester_name, asked_at = excluded.asked_at, emailed_at = NULL,
           closed_at = NULL, share_code = NULL
         WHERE access_requests.state <> 'open' AND access_requests.asked_at <= ?`,
      )
      .bind(
        `ar_${crypto.randomUUID().replaceAll('-', '')}`,
        id,
        person.id,
        name,
        note,
        now,
        now - ACCESS_REQUEST_REPEAT_MS,
      ),
    db
      .prepare(
        'SELECT COUNT(*) AS n FROM access_requests WHERE item_id = ? AND emailed_at IS NOT NULL AND emailed_at > ?',
      )
      .bind(id, now - DAY_MS),
  ])) as D1Result<Record<string, unknown>>[];
  // An open request, or one asked too recently: nothing new to tell.
  if (upsert!.meta.changes === 0) return;
  if (
    ((emailed!.results[0] as { n: number } | undefined)?.n ?? 0) >=
    ACCESS_REQUEST_EMAILS_PER_ITEM_DAY
  ) {
    return;
  }
  const recipientIds = await recipientsOf(env, row);
  if (recipientIds.length === 0) return;
  const request = await db
    .prepare(
      'UPDATE access_requests SET emailed_at = ? WHERE requester_id = ? AND item_id = ? RETURNING id',
    )
    .bind(now, person.id, id)
    .first<{ id: string }>();
  if (!request) return;
  const notice: AccessNotice = {
    type: 'access_requested',
    requestId: request.id,
    requesterId: person.id,
    requesterName: name,
    recipientIds,
    itemTitle: row.title,
    note,
  };
  tellApp(ctx.waitUntil, env, row, notice);
}

// ---------- Granting and declining -----------------------------------------------------------------------------------

// The item, managed by the caller through their own access (owner or team, the whole item), live.
async function managed(ctx: RouteContext, id: string): Promise<ItemRow | Response> {
  const loaded = await loadItem(ctx.env, id, ctx.caller, 'edit', { manage: true });
  if (loaded instanceof Response) return loaded;
  if (isArchived(loaded.row)) return archivedRefusal();
  if (loaded.row.trashed_at !== null) return notFound();
  return loaded.row;
}

type OpenRequest = { requester_id: string };

const openRequest = (env: Env, id: string, requestId: string) =>
  env.INDEX_DB.prepare(
    "SELECT requester_id FROM access_requests WHERE id = ? AND item_id = ? AND state = 'open'",
  )
    .bind(requestId, id)
    .first<OpenRequest>();

async function grantRoute(
  ctx: RouteContext,
  id: string,
  requestId: string,
  person: Person,
): Promise<Response> {
  const { env } = ctx;
  const row = await managed(ctx, id);
  if (row instanceof Response) return row;
  const body = await readObject(ctx.request);
  if (!body) return badRequest();
  if (body.level !== undefined && !isLevel(body.level)) return badRequest('invalid_level');
  if (body.level !== undefined && !linkLevelOffered(row.app, body.level as Level)) {
    return badRequest('level_not_offered');
  }
  // IDX54: Viewer unless the manager picks another, or the app's default where it offers no Viewer.
  const level: Level =
    (body.level as Level | undefined) ??
    (linkLevelOffered(row.app, 'view') ? 'view' : APP_DEFAULT_LINK_LEVEL[row.app]);
  const request = await openRequest(env, id, requestId);
  if (!request) return notFound('access_request_not_found');

  const now = Date.now();
  const code = generateShareCode();
  const db = env.INDEX_DB;
  const isOpen = "EXISTS (SELECT 1 FROM access_requests WHERE id = ? AND state = 'open')";
  const linkMade = 'EXISTS (SELECT 1 FROM share_links WHERE code = ?)';
  // Every statement guarded, so a manager who loses a race to another changes nothing.
  const [made] = await db.batch([
    db
      .prepare(
        `INSERT INTO share_links (code, item_id, level, tab_id, expiry, expires_at, created_at, public)
         SELECT ?, ?, ?, NULL, 'never', NULL, ?, 0
         WHERE (SELECT COUNT(*) FROM share_links WHERE item_id = ?) < ? AND ${isOpen}`,
      )
      .bind(code, id, level, now, id, SHARE_LINKS_PER_ITEM, requestId),
    db
      .prepare(
        `UPDATE access_requests SET state = 'granted', closed_at = ?, share_code = ?
         WHERE id = ? AND state = 'open' AND ${linkMade}`,
      )
      .bind(now, code, requestId, code),
    db
      .prepare(
        `INSERT INTO shared_with (person_id, item_id, share_code, last_seen) SELECT ?, ?, ?, ? WHERE ${linkMade}
         ON CONFLICT (person_id, item_id) DO UPDATE SET share_code = excluded.share_code, last_seen = excluded.last_seen`,
      )
      .bind(request.requester_id, id, code, now, code),
    ...eventStatements(db, {
      itemId: id,
      type: 'shared',
      actorId: person.id,
      detail: { level },
      at: now,
      when: { sql: linkMade, args: [code] },
    }),
  ]);
  if (made!.meta.changes === 0) {
    // Still open: the item is at its link cap. Otherwise another manager answered it first.
    return (await openRequest(env, id, requestId))
      ? conflict('share_link_limit')
      : notFound('access_request_not_found');
  }
  const names = await accountsPeopleNames(env)([person.id]);
  tellApp(ctx.waitUntil, env, row, {
    type: 'access_granted',
    requestId,
    requesterId: request.requester_id,
    granterId: person.id,
    granterName: names?.get(person.id) ?? null,
    level,
    itemTitle: row.title,
  });
  const link: ShareLink = {
    code,
    itemId: id,
    level,
    tabId: null,
    expiry: 'never',
    expiresAt: null,
    createdAt: now,
    public: false,
  };
  return json({ link });
}

async function declineRoute(ctx: RouteContext, id: string, requestId: string): Promise<Response> {
  const row = await managed(ctx, id);
  if (row instanceof Response) return row;
  const res = await ctx.env.INDEX_DB.prepare(
    `UPDATE access_requests SET state = 'declined', closed_at = ?
     WHERE id = ? AND item_id = ? AND state = 'open'`,
  )
    .bind(Date.now(), requestId, id)
    .run();
  if (res.meta.changes === 0) return notFound('access_request_not_found');
  return noContent();
}
