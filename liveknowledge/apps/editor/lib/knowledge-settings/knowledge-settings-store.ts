// The knowledgebase's settings as the editor holds them (docs/specs/030-knowledgebase/verification.md "The Review
// Period"): one Review Period a knowledgebase, taken from the document's read, from the room's `document-meta` op
// when anyone changes it, and from a change made here (shown at once). Outside React: every state the editor works
// out (the tree's Due pill, the meta row, Page Health, the hover card, search's results) reads the period from
// here, so one change moves them all with no request and no page touched.
//
// The knowledgebase's labels (page-surface.md "Page labels") ride the same settings, so they are held here too: every
// pill, the picker and the filter read them by id, and a rename or a new colour is one change of this list.
import {
  DEFAULT_REVIEW_EVERY,
  parseKnowledgeSettings,
  type ReviewEvery,
} from '@liveknowledge/knowledge';
import { parseKnowledgeLabels, type KnowledgeLabel } from '@liveknowledge/document';

const NO_LABELS: readonly KnowledgeLabel[] = Object.freeze([]);

const sameLabels = (a: readonly KnowledgeLabel[], b: readonly KnowledgeLabel[]) =>
  a.length === b.length &&
  a.every((l, i) => l.id === b[i]!.id && l.name === b[i]!.name && l.colour === b[i]!.colour);

export function createKnowledgeSettingsStore() {
  const held = new Map<string, ReviewEvery>();
  const labelsHeld = new Map<string, readonly KnowledgeLabel[]>();
  const listeners = new Set<() => void>();
  let version = 0;
  const changed = () => {
    version++;
    for (const listener of listeners) listener();
  };
  const set = (documentId: string, every: ReviewEvery): boolean => {
    if ((held.get(documentId) ?? DEFAULT_REVIEW_EVERY) === every) return false;
    held.set(documentId, every);
    changed();
    return true;
  };
  const labelsOf = (documentId: string | null | undefined): readonly KnowledgeLabel[] =>
    (documentId ? labelsHeld.get(documentId) : undefined) ?? NO_LABELS;
  const setLabels = (documentId: string, labels: readonly KnowledgeLabel[]): boolean => {
    if (sameLabels(labelsOf(documentId), labels)) return false;
    labelsHeld.set(documentId, labels.length ? Object.freeze([...labels]) : NO_LABELS);
    changed();
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
    /** The knowledgebase's labels, in their stored order; one list (the same object) until they change. */
    labelsOf,
    /** What a document read or the room's op says, read forgivingly. True when it changed what is held. */
    take: (documentId: string, settings: unknown): boolean => {
      const labels = parseKnowledgeLabels(
        settings && typeof settings === 'object'
          ? (settings as { labels?: unknown }).labels
          : undefined,
      );
      const period = set(documentId, parseKnowledgeSettings(settings).reviewEvery);
      return setLabels(documentId, labels) || period;
    },
    set,
    setLabels,
  };
}

export type KnowledgeSettingsStore = ReturnType<typeof createKnowledgeSettingsStore>;

/** The editor's one store. */
export const knowledgeSettingsStore = createKnowledgeSettingsStore();
