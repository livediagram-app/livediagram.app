// The Knowledgebase Style as the editor holds it (docs/specs/030-knowledgebase/page-surface.md "Knowledgebase
// Style"): one style a knowledgebase, taken from the document's read, from the room's `document-meta` op when an
// Editor changes it, and from a change made here (shown at once). Outside React and outside the tabs: every mounted
// page's writing, the drawings in it, the chrome's accent and the exports read it from here, so a change redraws
// what is on screen and writes no page.
import { useSyncExternalStore } from 'react';
import {
  DEFAULT_KNOWLEDGE_STYLE,
  parseKnowledgeStyle,
  sameKnowledgeStyle,
  type KnowledgeStyle,
} from '@liveknowledge/document';

export function createKnowledgeStyleStore() {
  const held = new Map<string, KnowledgeStyle>();
  const listeners = new Set<() => void>();
  // The knowledgebase the editor has open, for a reader with no document id to hand (an export of a tab).
  let openId: string | null = null;
  const styleOf = (documentId: string | null | undefined): KnowledgeStyle =>
    (documentId ? held.get(documentId) : undefined) ?? DEFAULT_KNOWLEDGE_STYLE;
  const set = (documentId: string, style: KnowledgeStyle): boolean => {
    // The same style again keeps the object every reader holds, so nothing re-renders.
    if (sameKnowledgeStyle(styleOf(documentId), style)) return false;
    held.set(documentId, style);
    for (const listener of listeners) listener();
    return true;
  };
  return {
    subscribe: (listener: () => void): (() => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    /** The knowledgebase's style: the Everyday look in the product's theme until its read says otherwise. */
    styleOf,
    /** What a document read or the room's op says, read forgivingly. True when it changed what is held. */
    take: (documentId: string, style: unknown): boolean =>
      set(documentId, parseKnowledgeStyle(style)),
    set,
    /** The editor's slice says which knowledgebase is open; null when none is. */
    setOpen: (documentId: string | null): void => {
      openId = documentId;
    },
    /** The open knowledgebase's style: the default when none is open. */
    openStyle: (): KnowledgeStyle => styleOf(openId),
    /** A test's clean slate. */
    clear: (): void => {
      openId = null;
      held.clear();
      for (const listener of listeners) listener();
    },
  };
}

export type KnowledgeStyleStore = ReturnType<typeof createKnowledgeStyleStore>;

/** The editor's one store. */
export const knowledgeStyleStore = createKnowledgeStyleStore();

/** The open knowledgebase's style. Renders only when the style itself changes. */
export function useKnowledgeStyle(documentId: string | null | undefined): KnowledgeStyle {
  return useSyncExternalStore(
    knowledgeStyleStore.subscribe,
    () => knowledgeStyleStore.styleOf(documentId),
    () => DEFAULT_KNOWLEDGE_STYLE,
  );
}
