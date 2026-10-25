// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { LegacyGuestClaim, LegacyGuestClaimAnswer } from '@liveworkspace/migration';
import { ApiError } from './api/core';
import {
  resetApiWriteListeners,
  subscribeApiWrites,
  type ApiWriteSignal,
} from './api/write-signal';
import {
  __resetLegacyGuestClaim,
  claimLegacyGuest,
  LEGACY_GUEST_ID_KEY,
  LEGACY_GUEST_SIG_KEY,
} from './legacy-guest-claim';

// docs/specs/014-identity/auth-and-guest-access.md "Returning guests from the old site".

const claim = vi.fn<(owner: string, c: LegacyGuestClaim) => Promise<LegacyGuestClaimAnswer>>();
vi.mock('./api/migration', () => ({
  apiClaimLegacyGuest: (owner: string, c: LegacyGuestClaim) => claim(owner, c),
}));
const tracked: string[] = [];
vi.mock('./telemetry', () => ({
  track: (c: string, a: string, t?: string) => tracked.push(`${c}·${a}·${t}`),
}));

const OLD_ID = '1b4e28ba-2fa1-41d2-883f-0016d3cca427';
let signals: ApiWriteSignal[];

beforeEach(() => {
  __resetLegacyGuestClaim();
  claim.mockReset();
  tracked.length = 0;
  localStorage.clear();
  localStorage.setItem(LEGACY_GUEST_ID_KEY, OLD_ID);
  localStorage.setItem(LEGACY_GUEST_SIG_KEY, 'sig-abc');
  localStorage.setItem('livediagram:v2:guest-token', 'kept');
  signals = [];
  subscribeApiWrites((s) => signals.push(s));
});
afterEach(() => resetApiWriteListeners());

describe('claiming an old guest', () => {
  it('sends the old id and its signature as the page, and forgets only the old keys on a merge', async () => {
    claim.mockResolvedValue({ merged: true });
    expect(await claimLegacyGuest('guest_new')).toBe('merged');
    expect(claim).toHaveBeenCalledWith('guest_new', { legacyId: OLD_ID, signature: 'sig-abc' });
    expect(localStorage.getItem(LEGACY_GUEST_ID_KEY)).toBeNull();
    expect(localStorage.getItem(LEGACY_GUEST_SIG_KEY)).toBeNull();
    expect(localStorage.getItem('livediagram:v2:guest-token')).toBe('kept');
    // The lists of the person's documents read again.
    expect(signals).toEqual([{ claimed: true }]);
    expect(tracked).toEqual(['Participant·Moved·LegacyGuest']);
  });

  it('sends a null signature for a guest from before signing', async () => {
    localStorage.removeItem(LEGACY_GUEST_SIG_KEY);
    claim.mockResolvedValue({ merged: true });
    await claimLegacyGuest('user_1');
    expect(claim).toHaveBeenCalledWith('user_1', { legacyId: OLD_ID, signature: null });
  });

  it('forgets the old keys when there was nothing to merge', async () => {
    claim.mockResolvedValue({ merged: false, reason: 'claimed' });
    expect(await claimLegacyGuest('guest_new')).toBe('forgotten');
    expect(localStorage.getItem(LEGACY_GUEST_ID_KEY)).toBeNull();
    expect(localStorage.getItem(LEGACY_GUEST_SIG_KEY)).toBeNull();
    expect(signals).toEqual([]);
    expect(tracked).toEqual(['Participant·Moved·LegacyGuestClaimed']);
  });

  it.each([
    ['a network failure', new TypeError('Failed to fetch')],
    ['a server error', new ApiError('claim legacy guest', 503, null)],
    ['a refusal', new ApiError('claim legacy guest', 401, null)],
  ])('keeps the old keys after %s, and tries again on a later load', async (_name, error) => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    claim.mockRejectedValueOnce(error);
    expect(await claimLegacyGuest('guest_new')).toBe('kept');
    expect(localStorage.getItem(LEGACY_GUEST_ID_KEY)).toBe(OLD_ID);
    expect(localStorage.getItem(LEGACY_GUEST_SIG_KEY)).toBe('sig-abc');
    warn.mockRestore();
    __resetLegacyGuestClaim();
    claim.mockResolvedValue({ merged: true });
    expect(await claimLegacyGuest('guest_new')).toBe('merged');
  });

  it('tries at most once per page load', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    claim.mockRejectedValue(new TypeError('Failed to fetch'));
    await claimLegacyGuest('guest_new');
    expect(await claimLegacyGuest('guest_new')).toBe('none');
    expect(claim).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  it('does nothing without an old id, and never sends one the old site did not write', async () => {
    localStorage.removeItem(LEGACY_GUEST_ID_KEY);
    expect(await claimLegacyGuest('guest_new')).toBe('none');
    localStorage.setItem(LEGACY_GUEST_ID_KEY, 'guest-1');
    expect(await claimLegacyGuest('guest_new')).toBe('none');
    expect(claim).not.toHaveBeenCalled();
    expect(localStorage.getItem(LEGACY_GUEST_ID_KEY)).toBe('guest-1');
  });
});
