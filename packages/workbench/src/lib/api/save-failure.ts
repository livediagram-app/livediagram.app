import { ApiError } from './api-error';
import { SessionTokenUnavailableError } from './core';

// The status a failed autosave shows (docs/specs/006-document/per-tab-storage.md). A 403 is a refusal
// the autosave stops on; a 401 or a missing session token is a sign-in
// problem, retried on the next edit because the session can come back; a 413
// is a tab over the row cap, saved again only by an edit; the rest (network,
// 5xx, anything thrown) is a failure worth retrying. Each a status the editor header's SaveStatus names.
export function saveFailureStatus(
  err: unknown,
): 'forbidden' | 'unauthenticated' | 'error' | 'tooLarge' {
  if (err instanceof ApiError && err.status === 403) return 'forbidden';
  if (err instanceof ApiError && err.status === 413) return 'tooLarge';
  if (err instanceof ApiError && err.status === 401) return 'unauthenticated';
  if (err instanceof SessionTokenUnavailableError) return 'unauthenticated';
  return 'error';
}
