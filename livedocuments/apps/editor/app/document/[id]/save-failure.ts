import type { SaveStatus } from '@/components/chrome/EditorHeader';
import { ApiError, SessionTokenUnavailableError } from '@/lib/api-client';

// What a refused save says, a tab's or the deck's (editor-persistence.ts, deck-save-failure.ts).
export const SAVE_FORBIDDEN_MESSAGE =
  'You can no longer edit this. Export a copy to keep your changes.';
export const SAVE_SIGNED_OUT_MESSAGE =
  'Your sign-in has lapsed, so changes aren’t saving. Sign in again.';

// The status a failed autosave shows (docs/specs/006-document/per-tab-storage.md). A 403 is a refusal
// the autosave stops on; a 401 or a missing session token is a sign-in
// problem, retried on the next edit because the session can come back; a 413
// is a tab over the row cap, saved again only by an edit; the rest (network,
// 5xx, anything thrown) is a failure worth retrying.
export function saveFailureStatus(
  err: unknown,
): Extract<SaveStatus, 'forbidden' | 'unauthenticated' | 'error' | 'tooLarge'> {
  if (err instanceof ApiError && err.status === 403) return 'forbidden';
  if (err instanceof ApiError && err.status === 413) return 'tooLarge';
  if (err instanceof ApiError && err.status === 401) return 'unauthenticated';
  if (err instanceof SessionTokenUnavailableError) return 'unauthenticated';
  return 'error';
}
