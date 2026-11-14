import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  __resetPreferencesKeptLocally,
  preferencesKeptLocally,
  rememberPreferencesKeptLocally,
  subscribePreferencesKeptLocally,
} from './preferences-local-only';

// The one record of whose preferences stay in this browser (docs/specs/007-editor/user-preferences.md "This app or
// All"), written by every editor's save queue and read by the Settings host.

afterEach(() => __resetPreferencesKeptLocally());

describe('preferencesKeptLocally', () => {
  it('is false for everyone until the api says it keeps none', () => {
    expect(preferencesKeptLocally()).toBe(false);
    expect(preferencesKeptLocally('owner-1')).toBe(false);
    expect(preferencesKeptLocally(null)).toBe(false);
  });

  it('holds per owner, and says whether anyone on the page is kept locally without one', () => {
    rememberPreferencesKeptLocally('owner-1');
    expect(preferencesKeptLocally('owner-1')).toBe(true);
    expect(preferencesKeptLocally('owner-2')).toBe(false);
    expect(preferencesKeptLocally(null)).toBe(false);
    expect(preferencesKeptLocally()).toBe(true);
  });

  it('forgets every answer on reset', () => {
    rememberPreferencesKeptLocally('owner-1');
    __resetPreferencesKeptLocally();
    expect(preferencesKeptLocally()).toBe(false);
  });
});

describe('subscribePreferencesKeptLocally', () => {
  it('tells its listeners once per new answer, and stops when unsubscribed', () => {
    const heard = vi.fn();
    const stop = subscribePreferencesKeptLocally(heard);
    rememberPreferencesKeptLocally('owner-1');
    rememberPreferencesKeptLocally('owner-1');
    expect(heard).toHaveBeenCalledOnce();
    __resetPreferencesKeptLocally();
    expect(heard).toHaveBeenCalledTimes(2);
    stop();
    rememberPreferencesKeptLocally('owner-2');
    expect(heard).toHaveBeenCalledTimes(2);
  });
});
