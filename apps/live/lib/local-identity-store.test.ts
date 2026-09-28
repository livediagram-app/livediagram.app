// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { storageEvent } from '@/lib/testing/storage-event';
import {
  clearGuestSelfId,
  ensureGuestSelfId,
  getGuestSelfId,
  setGuestIdentity,
  subscribeGuestSelfId,
} from './local-identity';

// The guest id is an external store that render reads with useSyncExternalStore
// (docs/specs/003-system-architecture/react-state-and-effects.md): every write notifies subscribers, so a
// component re-renders the moment the id is minted, adopted or cleared.
afterEach(() => {
  clearGuestSelfId();
  localStorage.clear();
});

describe('guest id store', () => {
  it('notifies on a mint, an adoption and a clear', () => {
    const onChange = vi.fn();
    const unsubscribe = subscribeGuestSelfId(onChange);
    const minted = ensureGuestSelfId();
    expect(getGuestSelfId()).toBe(minted);
    expect(onChange).toHaveBeenCalledTimes(1);
    setGuestIdentity('adopted', null);
    expect(onChange).toHaveBeenCalledTimes(2);
    clearGuestSelfId();
    expect(onChange).toHaveBeenCalledTimes(3);
    unsubscribe();
    ensureGuestSelfId();
    expect(onChange).toHaveBeenCalledTimes(3);
  });

  it('does not notify when an existing id is read back', () => {
    ensureGuestSelfId();
    const onChange = vi.fn();
    subscribeGuestSelfId(onChange);
    ensureGuestSelfId();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('notifies when another tab changes storage', () => {
    const onChange = vi.fn();
    subscribeGuestSelfId(onChange);
    window.dispatchEvent(storageEvent({ key: null }));
    expect(onChange).toHaveBeenCalledTimes(1);
  });
});
