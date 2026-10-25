// The returning-visitor note the editor used to leave for the landing page (docs/specs/019-marketing/returning-visitor.md):
// a list of your recent diagrams in localStorage and their snapshot SVGs in Cache Storage. Nothing writes or reads
// it now, but a browser that kept one still holds an account's diagram names and previews, so signing out (and
// deleting the account) clears whatever is left.

import {
  RECENT_DIAGRAMS_KEY,
  RECENT_THUMBS_CACHE,
  RECENT_THUMBS_CACHE_LEGACY,
} from '@livediagram/api-schema';
import { removeLocalStorageSafe } from '@liveworkspace/workbench/lib/local-storage-safe';

export async function forgetRecentDiagrams(): Promise<void> {
  removeLocalStorageSafe(RECENT_DIAGRAMS_KEY);
  if (typeof window === 'undefined' || !('caches' in window)) return;
  for (const name of [RECENT_THUMBS_CACHE, RECENT_THUMBS_CACHE_LEGACY]) {
    // Best effort: Cache Storage refused (a private window) or has no delete.
    await caches.delete(name).catch(() => false);
  }
}
