// A page's approval field (docs/specs/030-knowledgebase/approval.md "The field"), read defensively. Its own module so
// the knowledge fields (trust.ts) read it without importing the rules (approval.ts), which build on Verify.
import type { PageApproval, PageApprovalState } from '@liveknowledge/document';

export type { PageApproval, PageApprovalState } from '@liveknowledge/document';

/** The longest note a rejection keeps. */
export const APPROVAL_NOTE_MAX = 500;
const MAX_PERSON_ID = 128;
export const MAX_AGENT_NAME = 80;
/** The longest person's name an approval keeps (a profile's display name). */
export const MAX_PERSON_NAME = 80;

export const APPROVAL_ACTIONS = ['request', 'withdraw', 'approve', 'reject'] as const;
export type ApprovalAction = (typeof APPROVAL_ACTIONS)[number];
export const isApprovalAction = (v: unknown): v is ApprovalAction =>
  typeof v === 'string' && (APPROVAL_ACTIONS as readonly string[]).includes(v);

const STATES: readonly PageApprovalState[] = ['pending', 'approved', 'rejected'];

const personId = (v: unknown): string | undefined =>
  typeof v === 'string' && v.length > 0 && v.length <= MAX_PERSON_ID ? v : undefined;
const personName = (v: unknown): string | undefined =>
  typeof v === 'string' && v.trim() ? v.trim().slice(0, MAX_PERSON_NAME) : undefined;
const moment = (v: unknown): number | undefined =>
  typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.floor(v) : undefined;

/** A stored approval, or undefined for none or one that does not read: a state, who asked and when, at least. */
export function parseApproval(v: unknown): PageApproval | undefined {
  if (!v || typeof v !== 'object') return undefined;
  const raw = v as Record<string, unknown>;
  const state = STATES.find((s) => s === raw.state);
  const requestedBy = personId(raw.requestedBy);
  const requestedAt = moment(raw.requestedAt);
  if (!state || !requestedBy || requestedAt === undefined) return undefined;
  const approval: PageApproval = { state, requestedBy, requestedAt };
  if (typeof raw.requestedByAgent === 'string' && raw.requestedByAgent.trim())
    approval.requestedByAgent = raw.requestedByAgent.trim().slice(0, MAX_AGENT_NAME);
  const requestedByName = personName(raw.requestedByName);
  if (requestedByName) approval.requestedByName = requestedByName;
  if (state !== 'pending') {
    const decidedBy = personId(raw.decidedBy);
    const decidedAt = moment(raw.decidedAt);
    if (decidedBy) approval.decidedBy = decidedBy;
    if (decidedAt !== undefined) approval.decidedAt = decidedAt;
    const decidedByName = personName(raw.decidedByName);
    if (decidedByName) approval.decidedByName = decidedByName;
  }
  if (state === 'rejected' && typeof raw.note === 'string' && raw.note.trim())
    approval.note = raw.note.trim().slice(0, APPROVAL_NOTE_MAX);
  return approval;
}
