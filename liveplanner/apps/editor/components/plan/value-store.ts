'use client';

// A value a provider holds and its readers subscribe to (plan-items-store.ts for the plan's cards, pull-request-store.ts
// for its pull request states), apart from PlanContext so either may be read without it.
import { useInsertionEffect, useLayoutEffect, useState } from 'react';

// A value its readers subscribe to, each told after the commit that changed it (the cards, the pull request states).
export type ValueStore<T> = {
  get: () => T;
  subscribe: (listener: () => void) => () => void;
};

// One store for the provider's life, made with the first value. A new value reaches it in an insertion effect (before
// any layout effect of the commit) and its readers are told in a layout effect, so before the frame is painted; a card
// drawn in the same pass that read the old value is drawn again then (useSyncExternalStore checks after the commit).
export function useValueStore<T>(value: T): ValueStore<T> {
  const [box] = useState(() => storeBox(value));
  useInsertionEffect(() => box.set(value), [box, value]);
  useLayoutEffect(() => box.tell(), [box, value]);
  return box.store;
}

type StoreBox<T> = {
  store: ValueStore<T>;
  set: (value: T) => void;
  tell: () => void;
};

function storeBox<T>(first: T): StoreBox<T> {
  const listeners = new Set<() => void>();
  let value = first;
  let told = first;
  return {
    store: {
      get: () => value,
      subscribe: (listener) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
    },
    set: (next) => {
      value = next;
    },
    tell: () => {
      if (told === value) return;
      told = value;
      for (const listener of [...listeners]) listener();
    },
  };
}

export const noSubscribe = () => () => {};
