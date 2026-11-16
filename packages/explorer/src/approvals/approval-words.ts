// What an approval says (liveworkspace/docs/specs/004-index/approvals.md "In the editor"): its status pill, a due day
// and whether it has passed, each approver's decision, and who is named how. No React here, so each rule is tested on
// its own.

import type { Approval, ApprovalStatus, ApproverDecision } from '@liveworkspace/index-client';
import { dateFormat } from '@liveworkspace/ui/date-format';

// "20 Nov", or "20 Nov 2027" in another year, in the reader's locale.
const DUE = dateFormat({ day: 'numeric', month: 'short' });
const DUE_YEAR = dateFormat({ day: 'numeric', month: 'short', year: 'numeric' });

// A due day's local midnight: a due day is a calendar day, read the same wherever the reader is.
function dayDate(day: string): Date {
  return new Date(Number(day.slice(0, 4)), Number(day.slice(5, 7)) - 1, Number(day.slice(8, 10)));
}

/** The reader's local day, `YYYY-MM-DD`. */
export function todayKey(now: number): string {
  const d = new Date(now);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** A due day as a person says it: "20 Nov", with its year when it is not this one. */
export function dueWords(day: string, now: number = Date.now()): string {
  const date = dayDate(day);
  if (Number.isNaN(date.getTime())) return day;
  return (date.getFullYear() === new Date(now).getFullYear() ? DUE : DUE_YEAR).format(date);
}

/** Whether a due day has passed: the day after it has begun where the reader is. */
export function isOverdue(day: string | null, now: number = Date.now()): boolean {
  return day !== null && todayKey(now) > day;
}

// The id a closed account's rows carry.
const ANONYMISED = 'deleted';

/** A person as the approval names them. */
export function personName(person: { id: string; name: string | null }): string {
  if (person.id === ANONYMISED) return 'A closed account';
  return person.name?.trim() || 'A teammate';
}

export type StatusTone = 'awaiting' | 'changes' | 'approved' | 'changed';

/** The status pill's words and tone, or null for no pill. */
export function statusWords(
  approval: Pick<Approval, 'status' | 'approved' | 'approvers'> | null,
): { label: string; tone: StatusTone } | null {
  const status: ApprovalStatus | null = approval?.status ?? null;
  if (!approval || !status) return null;
  switch (status) {
    case 'awaiting':
      return {
        label: `Awaiting ${approval.approved} of ${approval.approvers.length}`,
        tone: 'awaiting',
      };
    case 'changes_requested':
      return { label: 'Changes Requested', tone: 'changes' };
    case 'approved':
      return { label: 'Approved', tone: 'approved' };
    case 'changed':
      return { label: 'Changed Since Approval', tone: 'changed' };
  }
}

export const DECISION_WORDS: Readonly<Record<ApproverDecision, string>> = {
  pending: 'Waiting',
  approved: 'Approved',
  changes_requested: 'Changes Requested',
};

/** The badge's tooltip: who asked, by when (and Overdue), and who has and hasn't answered. */
export function badgeSummary(approval: Approval, now: number = Date.now()): string {
  const parts = [`Asked by ${personName(approval.requestedBy)}`];
  if (approval.due && approval.state === 'open') {
    parts.push(
      isOverdue(approval.due, now)
        ? `Due ${dueWords(approval.due, now)}, Overdue`
        : `Due ${dueWords(approval.due, now)}`,
    );
  }
  for (const decision of ['approved', 'changes_requested', 'pending'] as const) {
    const names = approval.approvers.filter((a) => a.decision === decision).map(personName);
    if (names.length > 0) parts.push(`${DECISION_WORDS[decision]}: ${names.join(', ')}`);
  }
  return parts.join('. ');
}

/** What the banner says once its reader has answered. */
export function decidedWords(approval: Approval, viewerId: string): string | null {
  const mine = approval.approvers.find((a) => a.id === viewerId);
  if (!mine || mine.decision === 'pending') return null;
  if (mine.decision === 'changes_requested') return 'You asked for changes.';
  if (approval.state === 'approved') return 'You approved this. Everyone has approved.';
  const waiting = approval.approvers.length - approval.approved;
  return `You approved this. Waiting on ${waiting} more.`;
}
