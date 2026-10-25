// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { storageEvent } from '@liveworkspace/workbench/lib/testing/storage-event';
import { GUEST_TOKEN_STORAGE_KEY } from './guest-token-key';
import { getGuestSelfId, subscribeGuestSelfId } from './local-identity';

// The guest id is an external store that render reads with useSyncExternalStore
// (docs/specs/003-system-architecture/react-state-and-effects.md): it is the guest token's id, and a token
// another tab keeps arrives as a storage event.
afterEach(() => localStorage.clear());

const b64url = (v: unknown) =>
  btoa(JSON.stringify(v)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const tokenFor = (id: string) =>
  `${b64url({ alg: 'EdDSA' })}.${b64url({ sub: id, kind: 'guest', exp: 4_102_444_800 })}.sig`;

describe('guest id store', () => {
  it("reads the guest token's id, and none without one", () => {
    expect(getGuestSelfId()).toBeNull();
    localStorage.setItem(GUEST_TOKEN_STORAGE_KEY, tokenFor('guest_abc'));
    expect(getGuestSelfId()).toBe('guest_abc');
  });

  it('notifies when another tab changes the guest token, and not for other keys', () => {
    const onChange = vi.fn();
    const unsubscribe = subscribeGuestSelfId(onChange);
    window.dispatchEvent(storageEvent({ key: GUEST_TOKEN_STORAGE_KEY }));
    window.dispatchEvent(storageEvent({ key: null }));
    window.dispatchEvent(storageEvent({ key: 'livediagram:v2:other' }));
    expect(onChange).toHaveBeenCalledTimes(2);
    unsubscribe();
    window.dispatchEvent(storageEvent({ key: null }));
    expect(onChange).toHaveBeenCalledTimes(2);
  });
});
