// The recent-designs note's leftovers (docs/specs/019-marketing/returning-visitor.md "The old note"): the
// editor used to leave a note of your six most recent designs, and their snapshot SVGs in Cache Storage, for
// the landing page's hero. The hero no longer reads them and the editor no longer writes them, but a browser
// may still hold an old note, so signing out (and deleting the account) still clears it: the next person on
// a shared computer must not see the account's design names.

import {
  RECENT_DESIGNS_KEY,
  RECENT_THUMBS_CACHE,
  RECENT_THUMBS_CACHE_LEGACY,
} from '@livedesign/api-schema';
import { removeLocalStorageSafe } from '@liveworkspace/workbench/lib/local-storage-safe';

export async function forgetRecentDesigns(): Promise<void> {
  removeLocalStorageSafe(RECENT_DESIGNS_KEY);
  if (typeof window === 'undefined' || !('caches' in window)) return;
  // Best effort: a browser that refuses keeps an orphan nothing reads.
  await caches.delete(RECENT_THUMBS_CACHE).catch(() => false);
  await caches.delete(RECENT_THUMBS_CACHE_LEGACY).catch(() => false);
}
