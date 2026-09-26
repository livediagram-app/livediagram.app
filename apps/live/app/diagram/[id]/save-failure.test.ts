import { describe, expect, it } from 'vitest';
import { ApiError, SessionTokenUnavailableError } from '@/lib/api-client';
import { saveFailureStatus } from './save-failure';

// What a failed autosave tells the author (docs/specs/006-diagram/per-tab-storage.md). Each kind of
// failure has one honest status: a connection problem, a sign-in problem, or
// a refusal. Production showed 401s reading as "Check your connection" on a
// wired fibre line.
describe('saveFailureStatus', () => {
  it('reads a 403 as a refusal that no retry can fix', () => {
    expect(saveFailureStatus(new ApiError('save tab', 403, 'forbidden'))).toBe('forbidden');
  });

  it('reads a 401 as a sign-in problem, not a connection one', () => {
    expect(
      saveFailureStatus(new ApiError('save tab', 401, 'account_id_not_a_guest_credential')),
    ).toBe('unauthenticated');
  });

  it('reads a missing session token as a sign-in problem', () => {
    expect(saveFailureStatus(new SessionTokenUnavailableError())).toBe('unauthenticated');
  });

  it('reads everything else as a failure worth retrying', () => {
    expect(saveFailureStatus(new ApiError('save tab', 500, null))).toBe('error');
    expect(saveFailureStatus(new TypeError('Failed to fetch'))).toBe('error');
    expect(saveFailureStatus('odd')).toBe('error');
  });
});
