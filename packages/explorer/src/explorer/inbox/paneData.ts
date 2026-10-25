'use client';

// What the reading pane reads beyond the row: the item (for its thumbnail) and a thread's comments (from the host).
// Only for the row chosen, only once the choice settles (moving through the list with j/k asks for nothing on the
// way), and each answer kept, so coming back to a row asks again for nothing. The caches are bounded.

import { useEffect, useState } from 'react';
import type { IndexClient, Item } from '@liveworkspace/index-client';

/** How long the choice must rest before the pane asks for anything. */
export const PANE_SETTLE_MS = 200;
const CACHE_MAX = 64;

export class BoundedCache<T> {
  private map = new Map<string, T>();
  private max: number;
  constructor(max = CACHE_MAX) {
    this.max = max;
  }
  has(key: string) {
    return this.map.has(key);
  }
  get(key: string): T | undefined {
    return this.map.get(key);
  }
  set(key: string, value: T) {
    this.map.delete(key);
    this.map.set(key, value);
    if (this.map.size > this.max) this.map.delete(this.map.keys().next().value as string);
  }
  delete(key: string) {
    this.map.delete(key);
  }
  get size() {
    return this.map.size;
  }
}

/** A value read for `key` after the key has held still for PANE_SETTLE_MS, from `cache` when it has it. `undefined`
 *  while reading (or with no key); a failed read is kept as null, so it isn't asked again this visit. */
export function useSettledRead<T>(
  key: string | null,
  cache: BoundedCache<T | null>,
  read: ((signal: AbortSignal) => Promise<T | null>) | null,
  bump = 0,
): T | null | undefined {
  const [held, setHeld] = useState<{ key: string; value: T | null } | null>(null);
  const cached = key !== null && cache.has(key);
  useEffect(() => {
    if (key === null || !read || cached) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      read(controller.signal).then(
        (value) => {
          if (controller.signal.aborted) return;
          cache.set(key, value);
          setHeld({ key, value });
        },
        () => {
          if (controller.signal.aborted) return;
          cache.set(key, null);
          setHeld({ key, value: null });
        },
      );
    }, PANE_SETTLE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
    // `read` is the caller's closure over the same row as `key`; the key says when it changed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, cached, cache, bump]);
  if (key === null) return undefined;
  if (cache.has(key)) return cache.get(key);
  return held?.key === key ? held.value : undefined;
}

// One cache of items per index client: the pane's thumbnails across visits to the Inbox.
const ITEMS = new WeakMap<IndexClient, BoundedCache<Item | null>>();

export function itemCache(client: IndexClient): BoundedCache<Item | null> {
  let c = ITEMS.get(client);
  if (!c) {
    c = new BoundedCache<Item | null>();
    ITEMS.set(client, c);
  }
  return c;
}
