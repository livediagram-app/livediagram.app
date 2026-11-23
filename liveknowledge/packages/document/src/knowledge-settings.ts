// What a knowledgebase decides for every page of it (docs/specs/030-knowledgebase/verification.md "The fields"):
// the Review Period, kept in the document's metadata as `knowledgeSettings`. It travels with the document: a
// copy, a version, a snapshot, an export, the Drive file and a knowledgebase kept Offline all carry it. A page has
// no review period of its own. The knowledgebase's labels ride beside it (page-labels.ts, page-surface.md "Page
// labels"), so a rename is one write of this value and no page's.
import { parseKnowledgeLabels, type KnowledgeLabel } from './page-labels';

export type ReviewEvery = 30 | 90 | 180 | 365 | 'never';
export const REVIEW_INTERVALS: readonly ReviewEvery[] = [30, 90, 180, 365, 'never'];
export const DEFAULT_REVIEW_EVERY: ReviewEvery = 90;

export type KnowledgeSettings = { reviewEvery: ReviewEvery; labels?: KnowledgeLabel[] };
export const DEFAULT_KNOWLEDGE_SETTINGS: KnowledgeSettings = { reviewEvery: DEFAULT_REVIEW_EVERY };

export const isReviewEvery = (v: unknown): v is ReviewEvery =>
  REVIEW_INTERVALS.includes(v as ReviewEvery);

/** Stored settings, as an object or as the JSON text a column holds: what is valid is kept, anything else is the
 *  default (90 days, no labels). */
export function parseKnowledgeSettings(v: unknown): KnowledgeSettings {
  let raw = v;
  if (typeof raw === 'string') {
    try {
      raw = JSON.parse(raw);
    } catch {
      raw = null;
    }
  }
  const record =
    raw && typeof raw === 'object' ? (raw as { reviewEvery?: unknown; labels?: unknown }) : {};
  const labels = parseKnowledgeLabels(record.labels);
  return {
    reviewEvery: isReviewEvery(record.reviewEvery) ? record.reviewEvery : DEFAULT_REVIEW_EVERY,
    ...(labels.length > 0 ? { labels } : {}),
  };
}

/** The settings as stored: nothing for the default with no labels, so a knowledgebase that never chose keeps no row
 *  of it. */
export function storedKnowledgeSettings(settings: KnowledgeSettings): string | null {
  const labels = settings.labels ?? [];
  if (settings.reviewEvery === DEFAULT_REVIEW_EVERY && labels.length === 0) return null;
  return JSON.stringify({
    reviewEvery: settings.reviewEvery,
    ...(labels.length > 0 ? { labels } : {}),
  });
}
