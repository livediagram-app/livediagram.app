// Changing a knowledgebase's Review Period (docs/specs/030-knowledgebase/verification.md "The Review Period"), apart
// from React so its rules are tested as plain functions: what is asked before a period applies, the count when the
// preview cannot answer, and the one optimistic write with its rollback.
import { parseKnowledgeFields, trustState, type ReviewEvery } from '@liveknowledge/knowledge';
import {
  apiPreviewReviewPeriod,
  apiSetReviewPeriod,
  type KnowledgeCaller,
} from '@/lib/api/knowledge';
import { markSummaryStale } from '@/lib/knowledge-home/home-data';
import { offlineSaveDocumentMeta } from '@/lib/offline/offline-store';
import { knowledgeSettingsStore, type KnowledgeSettingsStore } from './knowledge-settings-store';

/** The pages Review Due under a period, counted from the fields the editor already holds of every page: what the
 *  popover says for a knowledgebase kept Offline, and when the preview cannot be read. One pass, no request. */
export function countDuePages(
  pages: readonly { knowledge?: unknown }[],
  every: ReviewEvery,
  now: number,
): number {
  let due = 0;
  for (const page of pages) {
    if (trustState(parseKnowledgeFields(page.knowledge), every, now).state === 'review-due') due++;
  }
  return due;
}

export type PeriodPreview = { reviewDue: number; reviewDueNow: number };

export type ReviewPeriodDoors = {
  set: typeof apiSetReviewPeriod;
  preview: typeof apiPreviewReviewPeriod;
  saveOffline: typeof offlineSaveDocumentMeta;
  store: KnowledgeSettingsStore;
};

export const REVIEW_PERIOD_DOORS: ReviewPeriodDoors = {
  set: apiSetReviewPeriod,
  preview: apiPreviewReviewPeriod,
  saveOffline: offlineSaveDocumentMeta,
  store: knowledgeSettingsStore,
};

export type PeriodTarget = {
  who: KnowledgeCaller;
  documentId: string;
  /** A knowledgebase kept in this browser: the period is written to its record, and nothing is asked of a server. */
  offline: boolean;
  /** The pages as the editor holds them, for the count no server gives. */
  pages: () => readonly { knowledge?: unknown }[];
};

/** How many pages `every` would make due, beside how many are due now: the api's count, or the editor's own when
 *  the knowledgebase is Offline or the request fails (the editor holds every page's fields). */
export async function previewPeriod(
  target: PeriodTarget,
  every: ReviewEvery,
  now: number,
  doors: ReviewPeriodDoors = REVIEW_PERIOD_DOORS,
  signal?: AbortSignal,
): Promise<PeriodPreview> {
  const local = (): PeriodPreview => ({
    reviewDue: countDuePages(target.pages(), every, now),
    reviewDueNow: countDuePages(target.pages(), doors.store.reviewEveryOf(target.documentId), now),
  });
  if (target.offline) return local();
  try {
    const { reviewDue, reviewDueNow } = await doors.preview(
      target.who,
      target.documentId,
      every,
      signal,
    );
    return { reviewDue, reviewDueNow };
  } catch (err) {
    if (signal?.aborted) throw err;
    return local();
  }
}

/**
 * Apply a period: shown at once (every tick, Due pill and due date follows the store), then stored. Answers the
 * period it replaced. On a refusal the period goes back to what it was, unless something newer has been chosen
 * since, and the error is thrown for the caller to say in words.
 */
export async function applyPeriod(
  target: PeriodTarget,
  every: ReviewEvery,
  now: number,
  doors: ReviewPeriodDoors = REVIEW_PERIOD_DOORS,
): Promise<ReviewEvery> {
  const { documentId } = target;
  const was = doors.store.reviewEveryOf(documentId);
  doors.store.set(documentId, every);
  try {
    if (target.offline)
      await doors.saveOffline(documentId, { knowledgeSettings: { reviewEvery: every } }, now);
    else doors.store.set(documentId, await doors.set(target.who, documentId, every));
    // Home's numbers for this knowledgebase moved: its next visit reads them again.
    markSummaryStale(documentId);
    return was;
  } catch (err) {
    if (doors.store.reviewEveryOf(documentId) === every) doors.store.set(documentId, was);
    throw err;
  }
}
