// What a knowledgebase decides for every page of it (docs/specs/030-knowledgebase/verification.md "The fields"):
// the Review Period and AI Editing (ai-editing.md), kept in the document's metadata as `knowledgeSettings`. It travels with the document: a
// copy, a version, a snapshot, an export, the Drive file and a knowledgebase kept Offline all carry it. A page has
// no review period of its own. The knowledgebase's labels ride beside it (page-labels.ts, page-surface.md "Page
// labels"), so a rename is one write of this value and no page's.
import { parseKnowledgeLabels, type KnowledgeLabel } from './page-labels';

export type ReviewEvery = 30 | 90 | 180 | 365 | 'never';
export const REVIEW_INTERVALS: readonly ReviewEvery[] = [30, 90, 180, 365, 'never'];
export const DEFAULT_REVIEW_EVERY: ReviewEvery = 90;

/** AI Editing (docs/specs/030-knowledgebase/ai-editing.md): how far an agent may change pages itself. */
export type AiEditing = 'suggest' | 'unverified' | 'any';
export const AI_EDITING_LEVELS: readonly AiEditing[] = ['suggest', 'unverified', 'any'];
export const DEFAULT_AI_EDITING: AiEditing = 'suggest';
export const isAiEditing = (v: unknown): v is AiEditing =>
  AI_EDITING_LEVELS.includes(v as AiEditing);

export type KnowledgeSettings = {
  reviewEvery: ReviewEvery;
  labels?: KnowledgeLabel[];
  /** Absent is the default, Suggest Edits Only. */
  aiEditing?: AiEditing;
  /** Remove Verification When AI Edits: in effect only under Edit Any Page. */
  aiEditUnverifies?: true;
};
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
    raw && typeof raw === 'object'
      ? (raw as {
          reviewEvery?: unknown;
          labels?: unknown;
          aiEditing?: unknown;
          aiEditUnverifies?: unknown;
        })
      : {};
  const labels = parseKnowledgeLabels(record.labels);
  return {
    reviewEvery: isReviewEvery(record.reviewEvery) ? record.reviewEvery : DEFAULT_REVIEW_EVERY,
    ...(labels.length > 0 ? { labels } : {}),
    ...(isAiEditing(record.aiEditing) && record.aiEditing !== DEFAULT_AI_EDITING
      ? { aiEditing: record.aiEditing }
      : {}),
    ...(record.aiEditUnverifies === true ? { aiEditUnverifies: true as const } : {}),
  };
}

/** The knowledgebase's AI Editing level: Suggest Edits Only until an Editor chooses. */
export const aiEditingOf = (settings: Pick<KnowledgeSettings, 'aiEditing'>): AiEditing =>
  settings.aiEditing ?? DEFAULT_AI_EDITING;

/** Whether an agent's rewrite of a Verified or Review Due page takes its verification away: only under Edit Any Page
 *  with Remove Verification When AI Edits on. */
export const aiEditUnverifies = (
  settings: Pick<KnowledgeSettings, 'aiEditing' | 'aiEditUnverifies'>,
): boolean => aiEditingOf(settings) === 'any' && settings.aiEditUnverifies === true;

/** The settings as stored: nothing for the defaults with no labels, so a knowledgebase that never chose keeps no row
 *  of it. */
export function storedKnowledgeSettings(settings: KnowledgeSettings): string | null {
  const labels = settings.labels ?? [];
  const ai = aiEditingOf(settings);
  const unverifies = settings.aiEditUnverifies === true;
  if (
    settings.reviewEvery === DEFAULT_REVIEW_EVERY &&
    labels.length === 0 &&
    ai === DEFAULT_AI_EDITING &&
    !unverifies
  )
    return null;
  return JSON.stringify({
    reviewEvery: settings.reviewEvery,
    ...(labels.length > 0 ? { labels } : {}),
    ...(ai !== DEFAULT_AI_EDITING ? { aiEditing: ai } : {}),
    ...(unverifies ? { aiEditUnverifies: true } : {}),
  });
}

/** What a connection may write here (ai-editing.md "What an agent may do is the lower of the two"): nothing without
 *  the `write` scope, else as far as the level allows. */
export function aiWriteReach(
  level: AiEditing,
  scopes: readonly string[],
): 'none' | 'unverified' | 'any' {
  if (!scopes.includes('write') || level === 'suggest') return 'none';
  return level;
}
