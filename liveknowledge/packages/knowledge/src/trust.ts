// How far a page can be trusted (docs/specs/030-knowledgebase/verification.md): the fields a page carries
// (`Tab.knowledge`) and the knowledgebase's one Review Period (`knowledgeSettings.reviewEvery`), both read
// defensively, and the state worked out from them and the clock. Nothing is written when a review comes due, and
// nothing a page stores changes when the period does.

import type { ReviewEvery } from '@liveknowledge/document';

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
};

const personId = (v: unknown): string | undefined =>
  typeof v === 'string' && v.length > 0 && v.length <= MAX_PERSON_ID ? v : undefined;

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

/** The fields after Verify: verified now by `person`, who becomes the owner of a page that has none. */
export function verified(fields: KnowledgeFields, person: string, now: number): KnowledgeFields {
  return { ...fields, owner: fields.owner ?? person, verifiedAt: now, verifiedBy: person };
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
