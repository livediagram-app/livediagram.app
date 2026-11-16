// What the canvas draws for suggestions (liveworkspace/docs/specs/015-suggestions/canvas-suggestions.md "Seeing a
// suggestion"): the active tab's suggestions, the change this person is gathering right now, and the one the review
// list points at. An external store the overlay reads with useSyncExternalStore, so a suggestion arriving re-renders
// the overlay alone, never the canvas's elements.
import { createContext, useContext, useSyncExternalStore } from 'react';
import type { SuggestDraft } from '../capture';
import type { CanvasSuggestion, SuggestionAuthor, SuggestionElement } from '../suggestion';

export type SuggestionsView<E extends SuggestionElement = SuggestionElement> = {
  tabId: string | null;
  suggestions: readonly CanvasSuggestion<E>[];
  // The change being gathered, drawn in this person's colour before it is sent.
  draft: SuggestDraft<E> | null;
  self: SuggestionAuthor | null;
  // The suggestion the review list points at (hovered or focused): the others draw quieter.
  focused: string | null;
};

export type SuggestionsStore<E extends SuggestionElement = SuggestionElement> = {
  get: () => SuggestionsView<E>;
  set: (patch: Partial<SuggestionsView<E>>) => void;
  subscribe: (listener: () => void) => () => void;
};

export const EMPTY_SUGGESTIONS_VIEW: SuggestionsView = {
  tabId: null,
  suggestions: [],
  draft: null,
  self: null,
  focused: null,
};

export function createSuggestionsStore<E extends SuggestionElement>(): SuggestionsStore<E> {
  let view = EMPTY_SUGGESTIONS_VIEW as SuggestionsView<E>;
  const listeners = new Set<() => void>();
  return {
    get: () => view,
    set(patch) {
      const keys = Object.keys(patch) as (keyof SuggestionsView<E>)[];
      if (keys.every((k) => view[k] === patch[k])) return;
      view = { ...view, ...patch };
      for (const l of listeners) l();
    },
    subscribe(l) {
      listeners.add(l);
      return () => void listeners.delete(l);
    },
  };
}

/** What the canvas reads of the store: any product's store is one. */
export type SuggestionsSource = Pick<SuggestionsStore, 'get' | 'subscribe'>;

/** The editor's suggestions store, provided above the canvas; absent, the canvas draws no suggestion. */
export const SuggestionsContext = createContext<SuggestionsSource | null>(null);

const noStore: SuggestionsSource = {
  get: () => EMPTY_SUGGESTIONS_VIEW,
  subscribe: () => () => {},
};

export function useSuggestionsView(): SuggestionsView {
  const store = useContext(SuggestionsContext) ?? noStore;
  return useSyncExternalStore(store.subscribe, store.get, store.get);
}
