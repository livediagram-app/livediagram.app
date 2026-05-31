import { describe, expect, it } from 'vitest';
import {
  clearGuestSelfId,
  getGuestSelfId,
  hasConfirmedName,
  markNameConfirmed,
  setGuestSelfId,
} from './local-identity';

// These tests run in the `node` environment (no `window`), which is
// exactly the static-export / SSR code path. Every accessor must
// degrade to a safe no-op rather than throwing — that's the contract
// `safeLocalStorage()` exists to guarantee (see the module header).
describe('local-identity SSR-safety (no window)', () => {
  it('getGuestSelfId returns null when storage is unavailable', () => {
    expect(getGuestSelfId()).toBeNull();
  });

  it('hasConfirmedName returns false when storage is unavailable', () => {
    expect(hasConfirmedName()).toBe(false);
  });

  it('setGuestSelfId is a no-op that does not throw', () => {
    expect(() => setGuestSelfId('id-123')).not.toThrow();
    // Still null — the write silently no-ops without a real Storage.
    expect(getGuestSelfId()).toBeNull();
  });

  it('clearGuestSelfId is a no-op that does not throw', () => {
    expect(() => clearGuestSelfId()).not.toThrow();
  });

  it('markNameConfirmed is a no-op that does not throw', () => {
    expect(() => markNameConfirmed()).not.toThrow();
    expect(hasConfirmedName()).toBe(false);
  });
});
