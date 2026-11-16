// Reading an item's approval (liveworkspace/docs/specs/004-index/approvals.md "Reading"): its newest request, that
// request's approvers in the order named, and the item's revision, in one batch of three primary-key or index reads;
// then the wire `Approval`, its people named by accounts as they are named now.

import {
  ANONYMISED_PERSON,
  approvalStatus,
  type Approval,
  type ApprovalPerson,
  type ApprovalState,
  type ApproverDecision,
} from '@liveworkspace/index-client';
import type { Env } from './env';

export type ApprovalRow = {
  id: string;
  item_id: string;
  requested_by: string;
  note: string | null;
  due_day: string | null;
  snapshot_id: string | null;
  state: ApprovalState;
  created_at: number;
  closed_at: number | null;
};

export type ApproverRow = {
  person_id: string;
  decision: ApproverDecision;
  note: string | null;
  decided_at: number | null;
};

export type ApprovalRead = {
  request: ApprovalRow | null;
  approvers: ApproverRow[];
  contentAt: number | null;
};

const NEWEST =
  'SELECT id FROM approvals WHERE item_id = ? ORDER BY created_at DESC, rowid DESC LIMIT 1';

/** The item's newest request, its approvers and the item's revision: one batch. */
export async function readApproval(env: Env, itemId: string): Promise<ApprovalRead> {
  const db = env.INDEX_DB;
  const [request, approvers, item] = await db.batch([
    db
      .prepare(
        `SELECT id, item_id, requested_by, note, due_day, snapshot_id, state, created_at, closed_at
         FROM approvals WHERE id = (${NEWEST})`,
      )
      .bind(itemId),
    db
      .prepare(
        `SELECT person_id, decision, note, decided_at FROM approval_people
         WHERE approval_id = (${NEWEST}) ORDER BY position`,
      )
      .bind(itemId),
    db.prepare('SELECT content_at FROM items WHERE id = ?').bind(itemId),
  ]);
  return {
    request: ((request as D1Result<ApprovalRow>).results[0] as ApprovalRow | undefined) ?? null,
    approvers: (approvers as D1Result<ApproverRow>).results,
    contentAt:
      ((item as D1Result<{ content_at: number | null }>).results[0]?.content_at as
        number | null | undefined) ?? null,
  };
}

/** The people a read names, for one names call. */
export const namedIn = (read: ApprovalRead): string[] =>
  read.request
    ? [read.request.requested_by, ...read.approvers.map((a) => a.person_id)].filter(
        (id) => id !== ANONYMISED_PERSON,
      )
    : [];

function person(id: string, names: ReadonlyMap<string, string> | null): ApprovalPerson {
  return { id, name: id === ANONYMISED_PERSON ? null : (names?.get(id) ?? null) };
}

/** The wire approval, or null when there is none to show (no request, or the newest cancelled). */
export function approvalOf(
  read: ApprovalRead,
  names: ReadonlyMap<string, string> | null,
): Approval | null {
  const r = read.request;
  if (!r || r.state === 'cancelled') return null;
  const approvers = read.approvers.map((a) => ({
    ...person(a.person_id, names),
    decision: a.decision,
    note: a.note,
    decidedAt: a.decided_at,
  }));
  const closedAt = r.closed_at;
  return {
    id: r.id,
    itemId: r.item_id,
    state: r.state,
    status: approvalStatus({ state: r.state, closedAt, approvers }, read.contentAt),
    requestedBy: person(r.requested_by, names),
    note: r.note,
    due: r.due_day,
    snapshotId: r.snapshot_id,
    createdAt: r.created_at,
    closedAt,
    approved: approvers.filter((a) => a.decision === 'approved').length,
    approvers,
  };
}
