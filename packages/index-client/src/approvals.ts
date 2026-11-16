// Approvals (liveworkspace/docs/specs/004-index/approvals.md): an Editor of the whole item asks named people to approve
// it; each approves or asks for changes; the item wears a badge saying where it stands. The wire shapes, the limits,
// and the notice the index sends the item's app for its email.

// How many people one request may name.
export const APPROVERS_MAX = 10;
// A request's note, and an approver's, at most.
export const APPROVAL_NOTE_MAX = 500;
// Requests an item keeps; only the newest is read.
export const APPROVALS_KEPT = 5;
// Requests one item may take in a day (its `approval_requested` events of the last 24 hours).
export const APPROVAL_REQUESTS_PER_DAY = 10;
// Who an Editor may name beside the team's members, at most.
export const APPROVAL_PEOPLE_MAX = 100;

export type ApprovalState = 'open' | 'approved' | 'cancelled';
export type ApproverDecision = 'pending' | 'approved' | 'changes_requested';
// The badge: worked out on each read from the request and the item's revision.
export type ApprovalStatus = 'awaiting' | 'changes_requested' | 'approved' | 'changed';

export type ApprovalPerson = { id: string; name: string | null };

export type Approver = ApprovalPerson & {
  decision: ApproverDecision;
  note: string | null;
  decidedAt: number | null;
};

export type Approval = {
  id: string;
  itemId: string;
  state: ApprovalState;
  status: ApprovalStatus | null;
  requestedBy: ApprovalPerson;
  note: string | null;
  // The day hoped for, `YYYY-MM-DD`; shown, never enforced.
  due: string | null;
  // The snapshot of the item as it was asked about, when the requester saved one.
  snapshotId: string | null;
  createdAt: number;
  closedAt: number | null;
  // How many approvers have approved.
  approved: number;
  approvers: Approver[];
};

export type ApprovalRequestInput = {
  approverIds: string[];
  note?: string | null;
  due?: string | null;
  snapshotId?: string | null;
};

export type ApprovalDecisionInput = {
  decision: 'approve' | 'request_changes';
  note?: string | null;
};

// Someone an Editor may name beside the team's members: the owner of a personal item, or a link visitor.
export type ApprovalCandidate = ApprovalPerson & { via: 'owner' | 'link' };

/** The badge's status, from the request and the item's revision (`content_at`). */
export function approvalStatus(
  approval: {
    state: ApprovalState;
    closedAt: number | null;
    approvers: { decision: ApproverDecision }[];
  },
  contentAt: number | null,
): ApprovalStatus | null {
  if (approval.state === 'cancelled') return null;
  if (approval.state === 'open') {
    return approval.approvers.some((a) => a.decision === 'changes_requested')
      ? 'changes_requested'
      : 'awaiting';
  }
  return contentAt !== null && approval.closedAt !== null && contentAt > approval.closedAt
    ? 'changed'
    : 'approved';
}

/** Whether text is a real calendar day, `YYYY-MM-DD` (2026-02-31 is not). */
export function isApprovalDay(value: unknown): value is string {
  if (typeof value !== 'string' || value.length !== 10) return false;
  if (value[4] !== '-' || value[7] !== '-') return false;
  for (const i of [0, 1, 2, 3, 5, 6, 8, 9]) {
    const c = value.charCodeAt(i);
    if (c < 48 || c > 57) return false;
  }
  const [y, m, d] = [Number(value.slice(0, 4)), Number(value.slice(5, 7)), Number(value.slice(8))];
  const at = new Date(Date.UTC(y, m - 1, d));
  return at.getUTCFullYear() === y && at.getUTCMonth() === m - 1 && at.getUTCDate() === d;
}

// ---------- The notice: what the index tells the item's app, for its email ---------------------------------------

export type ApprovalNotice = {
  type: 'approval_requested';
  approvalId: string;
  requesterId: string;
  requesterName: string | null;
  approverIds: string[];
  itemTitle: string;
  note: string | null;
  due: string | null;
};

const ID_MAX = 200;
const TITLE_MAX = 500;
const isId = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0 && value.length <= ID_MAX;
const textOrNull = (value: unknown, max: number): string | null | undefined =>
  value === null || value === undefined
    ? null
    : typeof value === 'string' && value.length <= max
      ? value
      : undefined;

/** An approval notice as the app reads its body, or null for anything else. */
export function parseApprovalNotice(value: unknown): ApprovalNotice | null {
  const v = value as Record<string, unknown> | null;
  if (!v || typeof v !== 'object' || v.type !== 'approval_requested') return null;
  const ids = v.approverIds;
  if (!isId(v.approvalId) || !isId(v.requesterId)) return null;
  if (!Array.isArray(ids) || ids.length < 1 || ids.length > APPROVERS_MAX || !ids.every(isId)) {
    return null;
  }
  if (typeof v.itemTitle !== 'string' || v.itemTitle.length > TITLE_MAX) return null;
  const requesterName = textOrNull(v.requesterName, ID_MAX);
  const note = textOrNull(v.note, APPROVAL_NOTE_MAX);
  if (requesterName === undefined || note === undefined) return null;
  if (v.due !== null && v.due !== undefined && !isApprovalDay(v.due)) return null;
  return {
    type: 'approval_requested',
    approvalId: v.approvalId,
    requesterId: v.requesterId,
    requesterName,
    approverIds: [...(ids as string[])],
    itemTitle: v.itemTitle,
    note,
    due: (v.due as string | null | undefined) ?? null,
  };
}
