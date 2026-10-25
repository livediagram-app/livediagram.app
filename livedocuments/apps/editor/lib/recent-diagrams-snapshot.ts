// Older builds left a note of the six most recent documents in localStorage, with their snapshots in
// Cache Storage, for a landing-page hero that is gone (docs/specs/019-marketing/marketing-site.md "Hero").
// Nothing writes them now; sign-out and account deletion still clear any a browser kept, so the next
// person on a shared computer never sees the account's document names.
import { removeLocalStorageSafe } from '@liveworkspace/workbench/lib/local-storage-safe';

const RECENT_NOTE_KEY = 'livedocuments:recent-diagrams:v1';
const RECENT_THUMB_CACHES = ['livedocuments-recent-thumbs-v2', 'livedocuments-recent-thumbs-v1'];

export async function forgetRecentDiagrams(): Promise<void> {
  removeLocalStorageSafe(RECENT_NOTE_KEY);
  if (typeof window === 'undefined' || !('caches' in window)) return;
  for (const name of RECENT_THUMB_CACHES) await caches.delete(name).catch(() => false);
}
