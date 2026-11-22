// How far a page can be trusted (docs/specs/030-knowledgebase/verification.md): the fields a page carries
// (`Tab.knowledge`) and the knowledgebase's one Review Period (`knowledgeSettings.reviewEvery`), both read
// defensively, and the state worked out from them and the clock. Nothing is written when a review comes due, and
// nothing a page stores changes when the period does.

import type { ReviewEvery } from '@liveknowledge/document';
import { parseApproval, type PageApproval } from './approval-field';

export {
  DEFAULT_KNOWLEDGE_SETTINGS,
  DEFAULT_REVIEW_EVERY,
  REVIEW_INTERVALS,
  isReviewEvery,
  parseKnowledgeSettings,
  storedKnowledgeSettings,
  type KnowledgeSettings,
  type ReviewEvery,
} from '@liveknowledge/document';

const DAY_MS = 86_400_000;
const MAX_PERSON_ID = 128;

/** A page's knowledge fields. Every one is optional: absent is no owner, never verified, not in context. A page
 *  has no review period of its own: a stored `reviewEvery` is ignored and dropped. */
export type KnowledgeFields = {
  /** The person answerable for the page being right: an account id. */
  owner?: string;
  /** When the page was last verified (epoch ms). */
  verifiedAt?: number;
  /** Who verified it: an account id. */
  verifiedBy?: string;
  /** Always in Context (docs/specs/030-knowledgebase/ai-knowledge.md). */
  context?: true;
  /** Asked for, approved or rejected (docs/specs/030-knowledgebase/approval.md). */
  approval?: PageApproval;
};

const personId = (v: unknown): string | undefined =>
  typeof v === 'string' && v.length > 0 && v.length <= MAX_PERSON_ID ? v : undefined;

/** The mark an import's new page carries in its first save (verification.md "The owner": a page made by an import
 *  has no owner). The api reads it on a new page alone, to give it no owner, and never stores it. */
export const UNOWNED_PAGE = { unowned: true } as const;

/** The page with the mark in place of its knowledge, for its first save. The mark is no knowledge field, so it rides
 *  outside the page's type: the one place it is put on a page. */
export function asUnownedPage<T extends { knowledge?: unknown }>(page: T): T {
  return { ...page, knowledge: { ...UNOWNED_PAGE } };
}

/** Whether a new page's knowledge, as an editor sent it, declines an owner (UNOWNED_PAGE). */
export const declinesOwner = (knowledge: unknown): boolean =>
  typeof knowledge === 'object' &&
  knowledge !== null &&
  (knowledge as { unowned?: unknown }).unowned === true;

/** Stored knowledge fields, keeping what is valid and dropping the rest. A `verifiedBy` without a `verifiedAt`
 *  says nothing and is dropped. */
export function parseKnowledgeFields(v: unknown): KnowledgeFields {
  const raw = v as Record<string, unknown> | null;
  const fields: KnowledgeFields = {};
  if (!raw || typeof raw !== 'object') return fields;
  const owner = personId(raw.owner);
  if (owner) fields.owner = owner;
  if (typeof raw.verifiedAt === 'number' && Number.isFinite(raw.verifiedAt) && raw.verifiedAt > 0) {
    fields.verifiedAt = Math.floor(raw.verifiedAt);
    const by = personId(raw.verifiedBy);
    if (by) fields.verifiedBy = by;
  }
  if (raw.context === true) fields.context = true;
  const approval = parseApproval(raw.approval);
  if (approval) fields.approval = approval;
  return fields;
}

export type TrustStateName = 'verified' | 'review-due' | 'never-verified';

export type TrustState =
  | { state: 'never-verified' }
  /** `reviewAt` (epoch ms) is when the review is, or was, due; absent on a page that does not age. */
  | { state: 'verified' | 'review-due'; verifiedAt: number; reviewAt?: number };

/** The days of a Review Period, or undefined for a knowledgebase whose pages do not age ("Never"). */
export function reviewDays(every: ReviewEvery): number | undefined {
  return every === 'never' ? undefined : every;
}

/** A page's state at `now` (epoch ms), under its knowledgebase's Review Period. */
export function trustState(fields: KnowledgeFields, every: ReviewEvery, now: number): TrustState {
  const { verifiedAt } = fields;
  if (verifiedAt === undefined) return { state: 'never-verified' };
  const days = reviewDays(every);
  if (days === undefined) return { state: 'verified', verifiedAt };
  const reviewAt = verifiedAt + days * DAY_MS;
  return { state: reviewAt <= now ? 'review-due' : 'verified', verifiedAt, reviewAt };
}

/** Whether a knowledgebase verifies its pages: every Review Period but Never (verification.md "Under a Review Period
 *  of Never"). Off, no page is shown as Verified, Review Due or unverified, and nobody is offered Verify. */
export const verificationOn = (every: ReviewEvery): boolean => every !== 'never';

/** A page's state as a reader is shown it: its state, or `off` where the knowledgebase does not verify pages. */
export type ShownTrust = TrustStateName | 'off';

/** The state to hand a reader (a person or an agent). `trustState` stays the stored truth the score counts. */
export const shownTrust = (state: TrustStateName, every: ReviewEvery): ShownTrust =>
  verificationOn(every) ? state : 'off';

/** The fields after Verify: verified now by `person`, who becomes the owner of a page that has none. */
/** Who a guest's Verify is by (owner, 2026-11-21: "Guest users can verify, just say Guest"): never a guest's own id, and a
 *  guest never becomes a page's owner. */
export const GUEST_VERIFIER = 'guest';

/** The mark a guest's name carries wherever it is recorded (owner 2026-11-21: "Bright Marlin (Guest)"). */
const GUEST_MARK = ' (Guest)';
const GUEST_NAME_MAX = 80;

/** A guest's name as recorded: their name with "(Guest)" after it, or "Guest" with none. Idempotent. */
export function guestName(name: string | null | undefined): string {
  const bare = (name ?? '').trim().slice(0, GUEST_NAME_MAX);
  if (!bare || bare === 'Guest') return 'Guest';
  return bare.endsWith(GUEST_MARK) ? bare : `${bare}${GUEST_MARK}`;
}

/** The `verifiedBy` of a guest's Verify: GUEST_VERIFIER and their name, never their own id. */
export const guestVerifier = (name: string | null | undefined): string => {
  const shown = guestName(name);
  return shown === 'Guest' ? GUEST_VERIFIER : `${GUEST_VERIFIER}:${shown}`;
};

/** Whether a `verifiedBy` is a guest's, and the name it shows ("Bright Marlin (Guest)", or "Guest"). */
export const isGuestVerifier = (id: string | undefined): boolean =>
  id === GUEST_VERIFIER || (id?.startsWith(`${GUEST_VERIFIER}:`) ?? false);
export const guestVerifierName = (id: string): string =>
  id === GUEST_VERIFIER ? 'Guest' : guestName(id.slice(GUEST_VERIFIER.length + 1));

export function verified(fields: KnowledgeFields, person: string, now: number): KnowledgeFields {
  const owner = fields.owner ?? (isGuestVerifier(person) ? undefined : person);
  return {
    ...fields,
    ...(owner === undefined ? {} : { owner }),
    verifiedAt: now,
    verifiedBy: person,
  };
}

/** The counts Knowledge Health draws (docs/specs/030-knowledgebase/ai-knowledge.md "Knowledge Health"). */
export type KnowledgeHealth = {
  verified: number;
  reviewDue: number;
  neverVerified: number;
  total: number;
};

export function knowledgeHealth(
  pages: readonly KnowledgeFields[],
  every: ReviewEvery,
  now: number,
): KnowledgeHealth {
  const health: KnowledgeHealth = {
    verified: 0,
    reviewDue: 0,
    neverVerified: 0,
    total: pages.length,
  };
  for (const fields of pages) {
    const { state } = trustState(fields, every, now);
    if (state === 'verified') health.verified++;
    else if (state === 'review-due') health.reviewDue++;
    else health.neverVerified++;
  }
  return health;
}
