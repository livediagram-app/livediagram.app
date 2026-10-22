// @vitest-environment jsdom

import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// docs/specs/013-workspace/explorer-home.md "First run": read from the Explorer's lists; the hero draws the answer
// this browser last saw until they land; a newcomer is taken as new.

const { clerk } = vi.hoisted(() => ({ clerk: { enabled: true } }));
vi.mock('@/lib/clerk-config', () => ({
  get clerkEnabled() {
    return clerk.enabled;
  },
}));

import { ExplorerProvider } from '../ExplorerContext';
import type { ExplorerStateValue } from '../useExplorerState';
import { useFirstRun } from './useFirstRun';

const KEY = 'liveplanner:v2:home-has-projects';

function wrap(over: Partial<Record<string, unknown>> = {}) {
  const value = {
    ownerId: 'me',
    loading: false,
    projects: [],
    shared: [],
    teamProjects: [],
    offlineProjects: [],
    clerkUserId: null,
    failedReads: { projects: false, shared: false },
    ...over,
  } as unknown as ExplorerStateValue;
  return ({ children }: { children: ReactNode }) => (
    <ExplorerProvider value={value}>{children}</ExplorerProvider>
  );
}

beforeEach(() => {
  clerk.enabled = true;
  localStorage.clear();
});
afterEach(() => localStorage.clear());

describe('useFirstRun', () => {
  it('is never a first run outside the Explorer', () => {
    const { result } = renderHook(() => useFirstRun());
    expect(result.current).toEqual({
      firstRun: false,
      heroFirstRun: false,
      signedIn: false,
      offerSignIn: false,
    });
  });

  it('is a first run with nothing loaded, offering a guest the way back', () => {
    const { result } = renderHook(() => useFirstRun(), { wrapper: wrap() });
    expect(result.current).toMatchObject({ firstRun: true, heroFirstRun: true, offerSignIn: true });
  });

  it('offers no sign-in to someone signed in, or where sign-in is off', () => {
    expect(
      renderHook(() => useFirstRun(), { wrapper: wrap({ clerkUserId: 'user_1' }) }).result.current,
    ).toMatchObject({ signedIn: true, offerSignIn: false });
    clerk.enabled = false;
    expect(renderHook(() => useFirstRun(), { wrapper: wrap() }).result.current.offerSignIn).toBe(
      false,
    );
  });

  it('is not a first run with a project', () => {
    const { result } = renderHook(() => useFirstRun(), {
      wrapper: wrap({ projects: [{ id: 'a' }] }),
    });
    expect(result.current).toMatchObject({ firstRun: false, heroFirstRun: false });
  });

  it('is no first run when a list failed to load, and remembers nothing from it', () => {
    for (const failedReads of [
      { projects: true, shared: false },
      { projects: false, shared: true },
    ]) {
      const { result } = renderHook(() => useFirstRun(), { wrapper: wrap({ failedReads }) });
      expect(result.current).toMatchObject({ firstRun: false, heroFirstRun: false });
    }
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it('remembers the answer for this person once the lists land', () => {
    renderHook(() => useFirstRun(), { wrapper: wrap({ projects: [{ id: 'a' }] }) });
    expect(JSON.parse(localStorage.getItem(KEY)!)).toEqual({ ownerId: 'me', has: true });
  });

  it('while loading, the hero takes a newcomer as new and a returning person as returning', () => {
    const loading = wrap({ loading: true });
    expect(renderHook(() => useFirstRun(), { wrapper: loading }).result.current).toMatchObject({
      firstRun: false,
      heroFirstRun: true,
    });
    localStorage.setItem(KEY, JSON.stringify({ ownerId: 'me', has: true }));
    expect(renderHook(() => useFirstRun(), { wrapper: loading }).result.current.heroFirstRun).toBe(
      false,
    );
    // Someone else's memory says nothing about this person.
    localStorage.setItem(KEY, JSON.stringify({ ownerId: 'other', has: true }));
    expect(renderHook(() => useFirstRun(), { wrapper: loading }).result.current.heroFirstRun).toBe(
      true,
    );
  });

  it("before the id resolves, takes this browser's last answer for whoever is here", () => {
    localStorage.setItem(KEY, JSON.stringify({ ownerId: 'someone', has: true }));
    const { result } = renderHook(() => useFirstRun(), {
      wrapper: wrap({ loading: true, ownerId: null }),
    });
    expect(result.current.heroFirstRun).toBe(false);
  });

  it('reads an unreadable memory as none', () => {
    localStorage.setItem(KEY, '{nope');
    const { result } = renderHook(() => useFirstRun(), { wrapper: wrap({ loading: true }) });
    expect(result.current.heroFirstRun).toBe(true);
  });
});
