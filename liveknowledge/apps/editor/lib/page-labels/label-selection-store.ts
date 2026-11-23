// The labels a person has chosen, per knowledgebase, for this browser tab alone (docs/specs/030-knowledgebase/
// page-surface.md "The label filter", search-and-ask.md "Answer From"): the page tree's filter, which search follows,
// and the labels the next question is answered from. Held outside React, as the Review Period is, and never kept: a
// reload shows every page again. A label deleted while chosen leaves the choice: `chosenOf` reads only the labels
// that still exist.
import type { KnowledgeLabel } from '@liveknowledge/document';

const NONE: readonly string[] = Object.freeze([]);

export function createLabelSelectionStore() {
  const held = new Map<string, readonly string[]>();
  const listeners = new Set<() => void>();
  // Moves each time a choice asks to be shown (a page's label pill pressed): the tree opens where it is folded.
  let reveal = 0;
  const tell = () => listeners.forEach((listener) => listener());
  const idsOf = (documentId: string | null | undefined): readonly string[] =>
    (documentId ? held.get(documentId) : undefined) ?? NONE;
  const set = (documentId: string, ids: readonly string[], show = false): void => {
    const now = idsOf(documentId);
    const same = now.length === ids.length && now.every((id, i) => id === ids[i]);
    if (same && !show) return;
    if (!same) held.set(documentId, ids.length ? Object.freeze([...new Set(ids)]) : NONE);
    if (show) reveal++;
    tell();
  };
  return {
    subscribe: (listener: () => void): (() => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    /** The ids chosen, as chosen; one list (the same object) until the choice changes. */
    idsOf,
    revealCount: () => reveal,
    /** Choose exactly these; `show` asks the tree to open where it is folded. */
    set,
    /** Add a label to the choice, or take it away. */
    toggle: (documentId: string, id: string): void => {
      const now = idsOf(documentId);
      set(documentId, now.includes(id) ? now.filter((x) => x !== id) : [...now, id]);
    },
    clear: (documentId: string): void => set(documentId, NONE),
    /** Forget every choice (tests). */
    reset: (): void => {
      held.clear();
      reveal = 0;
      tell();
    },
  };
}

export type LabelSelectionStore = ReturnType<typeof createLabelSelectionStore>;

/** The chosen labels that still exist, in the order chosen. */
export function chosenOf(
  ids: readonly string[],
  labels: readonly KnowledgeLabel[],
): KnowledgeLabel[] {
  if (ids.length === 0) return [];
  const byId = new Map(labels.map((l) => [l.id, l]));
  return ids.flatMap((id) => {
    const label = byId.get(id);
    return label ? [label] : [];
  });
}

/** "Engineering", "Engineering, Onboarding": the chosen labels' names, as a heading says them. */
export const labelNamesText = (labels: readonly KnowledgeLabel[]): string =>
  labels.map((l) => l.name).join(', ');

/** The page tree's label filter, which search follows. */
export const labelFilterStore = createLabelSelectionStore();
/** The labels the next question in the Ask view is answered from. */
export const askLabelScopeStore = createLabelSelectionStore();
