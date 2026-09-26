import type { SaveStatus } from '@/components/chrome/EditorHeader';
import { ApiError, SessionTokenUnavailableError } from '@/lib/api-client';

// The status a failed autosave shows (docs/specs/006-diagram/per-tab-storage.md). A 403 is a refusal
// the autosave stops on; a 401 or a missing session token is a sign-in
// problem, retried on the next edit because the session can come back; the
// rest (network, 5xx, anything thrown) is a failure worth retrying.
export function saveFailureStatus(
  err: unknown,
): Extract<SaveStatus, 'forbidden' | 'unauthenticated' | 'error'> {
  if (err instanceof ApiError && err.status === 403) return 'forbidden';
  if (err instanceof ApiError && err.status === 401) return 'unauthenticated';
  if (err instanceof SessionTokenUnavailableError) return 'unauthenticated';
  return 'error';
}
