// A public form's code, as an app's Worker finds the item behind it (liveworkspace/docs/one-explorer-contracts.md
// "What an item pushes"). The item's Durable Object keeps its form links; the index keeps each live link's code on
// the form's Inbox row (`pushForm` with `code`), so the Worker asks the index which item a code names
// (`GET /app/forms/:code`) and routes the request there. The item's own check (deleted, suspended, closed) stays
// the last word, so a cached answer only ever sends a request to the right item a little longer.

import type { CollabFormPlace, IndexAppClient } from '@liveworkspace/index-client';

// How long an isolate trusts an answer, and how many it keeps (the oldest goes first).
export const FORM_PLACE_TTL_MS = 60_000;
export const FORM_PLACE_CACHE_MAX = 1_000;

export type FormPlaces = {
  // The item and tab a code names, or null for none. Throws when the index cannot answer.
  lookup(
    client: Pick<IndexAppClient, 'formByCode'>,
    code: string,
    now?: number,
  ): Promise<CollabFormPlace | null>;
  // Drop a code's answer (a link just deleted or suspended in this isolate).
  forget(code: string): void;
  readonly size: number;
};

// One per app module: a bounded, per-isolate cache of code → place, misses included (a code is random, so one
// asked before it existed is never asked again once it does).
export function createFormPlaces(
  ttlMs = FORM_PLACE_TTL_MS,
  max = FORM_PLACE_CACHE_MAX,
): FormPlaces {
  const cache = new Map<string, { place: CollabFormPlace | null; at: number }>();
  return {
    async lookup(client, code, now = Date.now()) {
      const hit = cache.get(code);
      if (hit && now - hit.at < ttlMs) return hit.place;
      const place = await client.formByCode(code);
      cache.delete(code);
      cache.set(code, { place, at: now });
      while (cache.size > max) cache.delete(cache.keys().next().value!);
      return place;
    },
    forget(code) {
      cache.delete(code);
    },
    get size() {
      return cache.size;
    },
  };
}
