import { describe, expect, it } from 'vitest';
import {
  clearGuestSelfId,
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

  it('clearGuestSelfId is a no-op that does not throw', () => {
    expect(() => clearGuestSelfId()).not.toThrow();
  });

  it('markNameConfirmed is a no-op that does not throw', () => {
    expect(() => markNameConfirmed()).not.toThrow();
    expect(hasConfirmedName()).toBe(false);
  });

  it('ensureGuestSelfId still returns a fresh UUID without storage', () => {
    // Storage is unavailable in this environment, so the set never
    // persists. ensureGuestSelfId should still mint a one-shot id
    // (callers in the editor / new / explorer routes get a usable
    // owner id even in private browsing) rather than returning null
    // or throwing.
    const id = ensureGuestSelfId();
    expect(typeof id).toBe('string');
    // RFC 4122 v4 shape: 8-4-4-4-12 hex with the version nibble at
    // position 14 = '4'. Confirms we got `crypto.randomUUID()`'s
    // output, not a stub or empty string.
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    // The previous mint did not survive (no storage), so a second
    // call mints a fresh one. Documents the degraded-mode behaviour.
    const id2 = ensureGuestSelfId();
    expect(id2).not.toBe(id);
  });
});
