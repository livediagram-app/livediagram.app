// Approvals (liveworkspace/docs/specs/004-index/approvals.md): an Editor of the whole item asks named people to approve
// it; each approves or asks for changes; anyone who reaches the item reads where it stands.
//
//   GET    /items/:id/approval            the item's approval, or null             anyone who reaches it
//   POST   /items/:id/approval            {approverIds, note?, due?, snapshotId?}  an Editor of the whole item
//   DELETE /items/:id/approval            cancel the open request                  an Editor of the whole item
//   POST   /items/:id/approval/decision   {decision, note?}                        a named approver (any level)
//   GET    /items/:id/approval/people     whom they may name beside the team       an Editor of the whole item
//
// Every write is one batch with its event (events.ts), which also copies it into a team item's audit log. A person in
// person only: an app acting for one (an API token), the Drive mirror and the export are refused.

import {
  APPROVAL_NOTE_MAX,
  APPROVAL_REQUESTS_PER_DAY,
  APPROVALS_KEPT,
  APPROVERS_MAX,
  isApprovalDay,
  type ApprovalNotice,
  type EventType,
} from '@liveworkspace/index-client';
import { accountsPeopleNames } from './accounts-access';
import { approvalCandidates, checkNameable, isAccountId } from './approval-people';
import { approvalOf, namedIn, readApproval, type ApprovalRead } from './approval-rows';
import type { Person } from './auth';
import { isId } from './codec';
import type { RouteContext } from './context';
import { eventStatements } from './events';
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
import { loadItem, type Loaded } from './access';
import { tellApp } from './notices';

const DAY_MS = 24 * 60 * 60 * 1000;

// A person in person: not an app acting for them, the Drive mirror or the export.
function personOf(ctx: RouteContext): Person | Response {
  const person = ctx.caller.person;
  if (!person) return unauthorized();
  if (person.app || person.drive || person.export || person.kind !== 'account') {
    return forbidden('approvals_need_a_person');
  }
  return person;
}

// The item, reached at `need`; `whole`: through no link confined to one tab.
async function reach(
  ctx: RouteContext,
  id: string,
  need: 'view' | 'edit',
  whole: boolean,
): Promise<Loaded | Response> {
  const loaded = await loadItem(ctx.env, id, ctx.caller, need);
  if (loaded instanceof Response) return loaded;
  if (whole && loaded.access.tabId !== null) return forbidden();
  return loaded;
}

// Text, trimmed: null for none, undefined when it is not text or runs past the cap.
function noteOf(value: unknown): string | null | undefined {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') return undefined;
  const text = value.trim();
  if (text.length > APPROVAL_NOTE_MAX) return undefined;
  return text || null;
}

// The read answered with its people named, once.
async function answer(ctx: RouteContext, read: ApprovalRead, status = 200): Promise<Response> {
  const ids = namedIn(read);
  const names = ids.length > 0 ? await accountsPeopleNames(ctx.env)(ids) : null;
  return json({ approval: approvalOf(read, names) }, { status });
}

const event = (
  itemId: string,
  type: EventType,
  actor: Person,
  actorName: string | null,
  at: number,
  detail: Record<string, string | null>,
) => ({ itemId, type, actorId: actor.id, actorName, detail, at });

export async function handleApproval(
  ctx: RouteContext,
  id: string,
  rest: string[],
): Promise<Response> {
  const method = ctx.request.method;
  const person = personOf(ctx);
  if (person instanceof Response) return person;
  if (rest.length === 0) {
    if (method === 'GET') return readRoute(ctx, id);
    if (method === 'POST') return requestRoute(ctx, id, person);
    if (method === 'DELETE') return cancelRoute(ctx, id, person);
    return notFound();
  }
  if (rest.length === 1 && rest[0] === 'decision' && method === 'POST') {
    return decideRoute(ctx, id, person);
  }
  if (rest.length === 1 && rest[0] === 'people' && method === 'GET') {
    const loaded = await reach(ctx, id, 'edit', true);
    if (loaded instanceof Response) return loaded;
    return json({ people: await approvalCandidates(ctx.env, loaded.row, person.id) });
  }
  return notFound();
}

async function readRoute(ctx: RouteContext, id: string): Promise<Response> {
  const loaded = await reach(ctx, id, 'view', false);
  if (loaded instanceof Response) return loaded;
  // A Community visitor sees no approval: the post is a viewing surface.
  if (loaded.access.public) return json({ approval: null });
  return answer(ctx, await readApproval(ctx.env, id));
}

async function requestRoute(ctx: RouteContext, id: string, person: Person): Promise<Response> {
  const { env } = ctx;
  const loaded = await reach(ctx, id, 'edit', true);
  if (loaded instanceof Response) return loaded;
  const { row } = loaded;
  if (row.trashed_at !== null || row.archived_at !== null) return notFound();
  const body = await readObject(ctx.request);
  if (!body) return badRequest();
  const ids = body.approverIds;
  if (
    !Array.isArray(ids) ||
    ids.length < 1 ||
    ids.length > APPROVERS_MAX ||
    !ids.every((v): v is string => isId(v) && isAccountId(v)) ||
    new Set(ids).size !== ids.length ||
    ids.includes(person.id)
  ) {
    return badRequest('invalid_approvers');
  }
  const note = noteOf(body.note);
  if (note === undefined) return badRequest();
  const due = body.due ?? null;
  if (due !== null && !isApprovalDay(due)) return badRequest('invalid_due');
  const snapshotId = body.snapshotId ?? null;
  if (snapshotId !== null && !isId(snapshotId)) return badRequest();

  const now = Date.now();
  const recent = await env.INDEX_DB.prepare(
    `SELECT COUNT(*) AS n FROM events WHERE item_id = ? AND occurred_at >= ? AND type = 'approval_requested'`,
  )
    .bind(id, now - DAY_MS)
    .first<{ n: number }>();
  if ((recent?.n ?? 0) >= APPROVAL_REQUESTS_PER_DAY) return fail(429, 'rate_limited');

  const nameable = await checkNameable(env, row, ids);
  if (nameable === 'unavailable') return fail(503, 'approvals_unavailable');
  if (nameable === 'cannot') return fail(422, 'approver_cannot_open');

  const names = await accountsPeopleNames(env)([person.id, ...ids]);
  const myName = names?.get(person.id) ?? null;
  const open = await env.INDEX_DB.prepare(
    "SELECT id FROM approvals WHERE item_id = ? AND state = 'open'",
  )
    .bind(id)
    .first<{ id: string }>();
  const approvalId = `ap_${crypto.randomUUID().replaceAll('-', '')}`;
  const db = env.INDEX_DB;
  const statements: D1PreparedStatement[] = [];
  if (open) {
    statements.push(
      db
        .prepare(
          "UPDATE approvals SET state = 'cancelled', closed_at = ? WHERE id = ? AND state = 'open'",
        )
        .bind(now, open.id),
      ...eventStatements(
        db,
        // A millisecond before the new request, so History always reads them in order.
        event(id, 'approval_cancelled', person, myName, now - 1, { replaced: 'true' }),
      ),
    );
  }
  statements.push(
    db
      .prepare(
        `INSERT INTO approvals (id, item_id, requested_by, note, due_day, snapshot_id, state, created_at)
         VALUES (?, ?, ?, ?, ?, ?, 'open', ?)`,
      )
      .bind(approvalId, id, person.id, note, due, snapshotId, now),
    db
      .prepare(
        `INSERT INTO approval_people (approval_id, person_id, position)
         SELECT ?, value, key FROM json_each(?)`,
      )
      .bind(approvalId, JSON.stringify(ids)),
    ...eventStatements(
      db,
      event(id, 'approval_requested', person, myName, now, {
        approvers: String(ids.length),
        due,
        ...(snapshotId ? { snapshot: 'true' } : {}),
      }),
    ),
    db
      .prepare(
        `DELETE FROM approvals WHERE item_id = ?1 AND id NOT IN (
           SELECT id FROM approvals WHERE item_id = ?1 ORDER BY created_at DESC, rowid DESC LIMIT ?2)`,
      )
      .bind(id, APPROVALS_KEPT),
  );
  try {
    await db.batch(statements);
  } catch (err) {
    // Two requests racing: the second's open row meets approvals_open.
    if (String(err).includes('UNIQUE')) return fail(409, 'approval_conflict');
    throw err;
  }
  const notice: ApprovalNotice = {
    type: 'approval_requested',
    approvalId,
    requesterId: person.id,
    requesterName: myName,
    approverIds: ids,
    itemTitle: row.title,
    note,
    due,
  };
  tellApp(ctx.waitUntil, env, { id, app: row.app }, notice);
  const read = await readApproval(env, id);
  return json({ approval: approvalOf(read, names) }, { status: 201 });
}

async function decideRoute(ctx: RouteContext, id: string, person: Person): Promise<Response> {
  const { env } = ctx;
  const loaded = await reach(ctx, id, 'view', true);
  if (loaded instanceof Response) return loaded;
  if (loaded.access.public) return notFound('approval_not_found');
  const body = await readObject(ctx.request);
  if (!body || (body.decision !== 'approve' && body.decision !== 'request_changes')) {
    return badRequest();
  }
  const note = noteOf(body.note);
  if (note === undefined) return badRequest();
  const read = await readApproval(env, id);
  const request = read.request;
  if (!request || request.state !== 'open') return notFound('approval_not_found');
  const mine = read.approvers.find((a) => a.person_id === person.id);
  if (!mine) return forbidden('not_an_approver');
  const decision = body.decision === 'approve' ? 'approved' : 'changes_requested';
  if (mine.decision === decision && mine.note === note) return answer(ctx, read);

  const now = Date.now();
  const complete =
    decision === 'approved' &&
    read.approvers.every((a) => a.person_id === person.id || a.decision === 'approved');
  const names = await accountsPeopleNames(env)(namedIn(read));
  const db = env.INDEX_DB;
  const detail: Record<string, string | null> = { note };
  if (complete) detail.complete = 'true';
  const statements = [
    db
      .prepare(
        `UPDATE approval_people SET decision = ?, note = ?, decided_at = ?
         WHERE approval_id = ? AND person_id = ?`,
      )
      .bind(decision, note, now, request.id, person.id),
    ...eventStatements(
      db,
      event(
        id,
        decision === 'approved' ? 'approval_approved' : 'approval_changes_requested',
        person,
        names?.get(person.id) ?? null,
        now,
        detail,
      ),
    ),
  ];
  if (complete) {
    statements.push(
      db
        .prepare(
          `UPDATE approvals SET state = 'approved', closed_at = ?1 WHERE id = ?2 AND state = 'open'
             AND NOT EXISTS (SELECT 1 FROM approval_people WHERE approval_id = ?2 AND decision <> 'approved')`,
        )
        .bind(now, request.id),
    );
  }
  await db.batch(statements);
  return json({ approval: approvalOf(await readApproval(env, id), names) });
}

async function cancelRoute(ctx: RouteContext, id: string, person: Person): Promise<Response> {
  const { env } = ctx;
  const loaded = await reach(ctx, id, 'edit', true);
  if (loaded instanceof Response) return loaded;
  const open = await env.INDEX_DB.prepare(
    "SELECT id FROM approvals WHERE item_id = ? AND state = 'open'",
  )
    .bind(id)
    .first<{ id: string }>();
  if (!open) return notFound('approval_not_found');
  const now = Date.now();
  const names = await accountsPeopleNames(env)([person.id]);
  const db = env.INDEX_DB;
  await db.batch([
    db
      .prepare(
        "UPDATE approvals SET state = 'cancelled', closed_at = ? WHERE id = ? AND state = 'open'",
      )
      .bind(now, open.id),
    ...eventStatements(
      db,
      event(id, 'approval_cancelled', person, names?.get(person.id) ?? null, now, {}),
    ),
  ]);
  return noContent();
}
