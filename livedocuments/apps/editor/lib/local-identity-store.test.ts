// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { storageEvent } from '@liveworkspace/workbench/lib/testing/storage-event';
import { GUEST_TOKEN_STORAGE_KEY } from './guest-token-key';
import { getGuestSelfId, subscribeGuestSelfId } from './local-identity';
import { guestTokenFor } from '@liveworkspace/index-client/testing';

// The guest id is an external store that render reads with useSyncExternalStore
// (docs/specs/003-system-architecture/react-state-and-effects.md): it is the guest token's id, and another tab's new
// token arrives as a storage event.
afterEach(() => localStorage.clear());

describe('guest id store', () => {
  it('reads the id from the kept guest token', () => {
    expect(getGuestSelfId()).toBeNull();
    localStorage.setItem(GUEST_TOKEN_STORAGE_KEY, guestTokenFor('guest_abc'));
    expect(getGuestSelfId()).toBe('guest_abc');
  });

  it('ignores a lapsed token', () => {
    localStorage.setItem(GUEST_TOKEN_STORAGE_KEY, guestTokenFor('guest_abc', -60));
    expect(getGuestSelfId()).toBeNull();
  });

  it('notifies when another tab changes the token, and only then', () => {
    const onChange = vi.fn();
    const unsubscribe = subscribeGuestSelfId(onChange);
    window.dispatchEvent(storageEvent({ key: 'something-else' }));
    expect(onChange).not.toHaveBeenCalled();
    window.dispatchEvent(storageEvent({ key: GUEST_TOKEN_STORAGE_KEY }));
    window.dispatchEvent(storageEvent({ key: null }));
    expect(onChange).toHaveBeenCalledTimes(2);
    unsubscribe();
    window.dispatchEvent(storageEvent({ key: null }));
    expect(onChange).toHaveBeenCalledTimes(2);
  });
});
