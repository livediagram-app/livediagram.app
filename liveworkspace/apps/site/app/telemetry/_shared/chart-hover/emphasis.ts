'use client';

import { useState, useSyncExternalStore } from 'react';

// Which line a chart emphasises (liveworkspace/docs/specs/008-telemetry/telemetry.md "Tooltips"): the one under the
// pointer in its legend or pinned tooltip, or picked with Up and Down. A tiny store rather than React state in the
// card, so a legend hover re-renders only the chart and its overlay that read it, never the card around them.
export type EmphasisStore = {
  get: () => string | null;
  set: (key: string | null) => void;
  subscribe: (listener: () => void) => () => void;
};

export function createEmphasis(): EmphasisStore {
  let key: string | null = null;
  const listeners = new Set<() => void>();
  return {
    get: () => key,
    set: (next) => {
      if (next === key) return;
      key = next;
      for (const listener of listeners) listener();
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

/** A store made once for the component's life: a card hands it to its legend and its chart. */
export function useEmphasisStore(): EmphasisStore {
  return useState(createEmphasis)[0];
}

const none = () => null;

/** The emphasised line's key, re-rendering only the caller when it changes. */
export function useEmphasis(store: EmphasisStore): string | null {
  return useSyncExternalStore(store.subscribe, store.get, none);
}

/** What a legend entry spreads on itself: hovering or focusing it emphasises its line. */
export function emphasisProps(store: EmphasisStore, key: string) {
  const on = () => store.set(key);
  const off = () => {
    if (store.get() === key) store.set(null);
  };
  return { onPointerEnter: on, onPointerLeave: off, onFocus: on, onBlur: off };
}
