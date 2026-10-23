import { describe, expect, it } from 'vitest';
import {
  ensureGuestSelfId,
  getGuestSelfId,
  hasConfirmedName,
  markNameConfirmed,
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

  it('markNameConfirmed is a no-op that does not throw', () => {
    expect(() => markNameConfirmed()).not.toThrow();
    expect(hasConfirmedName()).toBe(false);
  });

  it('ensureGuestSelfId answers one stand-in guest id for the page load without a token', () => {
    const id = ensureGuestSelfId();
    expect(id).toMatch(/^guest_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    expect(ensureGuestSelfId()).toBe(id);
  });
});
