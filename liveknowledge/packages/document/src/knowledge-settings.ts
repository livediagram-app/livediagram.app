// What a knowledgebase decides for every page of it (docs/specs/030-knowledgebase/verification.md "The fields"):
// the Review Period, kept in the document's metadata as `knowledgeSettings`. It travels with the document: a
// copy, a version, a snapshot, an export, the Drive file and a knowledgebase kept Offline all carry it. A page has
// no review period of its own.

export type ReviewEvery = 30 | 90 | 180 | 365 | 'never';
export const REVIEW_INTERVALS: readonly ReviewEvery[] = [30, 90, 180, 365, 'never'];
export const DEFAULT_REVIEW_EVERY: ReviewEvery = 90;

export type KnowledgeSettings = { reviewEvery: ReviewEvery };
export const DEFAULT_KNOWLEDGE_SETTINGS: KnowledgeSettings = { reviewEvery: DEFAULT_REVIEW_EVERY };

export const isReviewEvery = (v: unknown): v is ReviewEvery =>
  REVIEW_INTERVALS.includes(v as ReviewEvery);

/** Stored settings, as an object or as the JSON text a column holds: what is valid is kept, anything else is the
 *  default (90 days). */
export function parseKnowledgeSettings(v: unknown): KnowledgeSettings {
  let raw = v;
  if (typeof raw === 'string') {
    try {
      raw = JSON.parse(raw);
    } catch {
      raw = null;
    }
  }
  const every = raw && typeof raw === 'object' ? (raw as { reviewEvery?: unknown }).reviewEvery : 0;
  return { reviewEvery: isReviewEvery(every) ? every : DEFAULT_REVIEW_EVERY };
}

/** The settings as stored: nothing for the default, so a knowledgebase that never chose keeps no row of it. */
export const storedKnowledgeSettings = (settings: KnowledgeSettings): string | null =>
  settings.reviewEvery === DEFAULT_REVIEW_EVERY ? null : JSON.stringify(settings);
