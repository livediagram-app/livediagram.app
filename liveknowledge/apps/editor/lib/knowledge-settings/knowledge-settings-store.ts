// The knowledgebase's settings as the editor holds them (docs/specs/030-knowledgebase/verification.md "The Review
// Period"): one Review Period a knowledgebase, taken from the document's read, from the room's `document-meta` op
// when anyone changes it, and from a change made here (shown at once). Outside React: every state the editor works
// out (the tree's Due pill, the meta row, Page Health, the hover card, search's results) reads the period from
// here, so one change moves them all with no request and no page touched.
import {
  DEFAULT_REVIEW_EVERY,
  parseKnowledgeSettings,
  type ReviewEvery,
} from '@liveknowledge/knowledge';

export function createKnowledgeSettingsStore() {
  const held = new Map<string, ReviewEvery>();
  const listeners = new Set<() => void>();
  let version = 0;
  const set = (documentId: string, every: ReviewEvery): boolean => {
    if ((held.get(documentId) ?? DEFAULT_REVIEW_EVERY) === every) return false;
    held.set(documentId, every);
    version++;
    for (const listener of listeners) listener();
    return true;
  };
  return {
    subscribe: (listener: () => void): (() => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    /** Moves with every change of any knowledgebase's period: a reader that derives from it keys on this. */
    version: () => version,
    /** The knowledgebase's Review Period: every 90 days until its read says otherwise. */
    reviewEveryOf: (documentId: string | null | undefined): ReviewEvery =>
      (documentId ? held.get(documentId) : undefined) ?? DEFAULT_REVIEW_EVERY,
    /** What a document read or the room's op says, read forgivingly. True when it changed what is held. */
    take: (documentId: string, settings: unknown): boolean =>
      set(documentId, parseKnowledgeSettings(settings).reviewEvery),
    set,
  };
}

export type KnowledgeSettingsStore = ReturnType<typeof createKnowledgeSettingsStore>;

/** The editor's one store. */
export const knowledgeSettingsStore = createKnowledgeSettingsStore();
