// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// docs/specs/007-editor/load-recovery.md "The load always ends": the load ends on the load-error
// screen when it hangs or throws, and a load that lands after the watchdog replaces that screen.

const { api, identity, seed } = vi.hoisted(() => ({
  api: {
    apiLoadSelf: vi.fn(),
    apiSaveSelf: vi.fn(),
    apiLoadDocument: vi.fn(),
    apiLoadShared: vi.fn(),
    apiListShareLinks: vi.fn(),
  },
  identity: { ensureCollabKey: vi.fn(() => 'collab'), hasConfirmedName: vi.fn(() => true) },
  seed: vi.fn(async () => {}),
}));

vi.mock('@/lib/api-client', () => ({
  ...api,
  getSessionSharePassword: () => null,
  readCachedSharePassword: () => null,
  setSessionSharePassword: () => {},
  writeCachedSharePassword: () => {},
}));
vi.mock('@/lib/local-identity', () => identity);
vi.mock('@/lib/guest-identity', () => ({
  ensureSignedGuestIdentity: async () => ({ id: 'guest-1' }),
}));
vi.mock('@/lib/daily-return', () => ({ trackDailyReturn: () => {} }));
vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));
vi.mock('./seed-fetched-document', () => ({ makeSeedFetchedDocument: () => seed }));

import { useIdentityBootstrap } from './useIdentityBootstrap';
import { AUTO_RELOAD_KEY, LOAD_TIMEOUT_MS, resetLoadProgressForTests } from '@/lib/load-progress';
import { track } from '@/lib/telemetry';

type Setters = Record<string, ReturnType<typeof vi.fn>>;

function render() {
  const fns: Setters = {};
  const set = new Proxy(fns, {
    get: (t, k: string) => (t[k] ??= vi.fn()),
  });
  renderHook(() =>
    useIdentityBootstrap({
      authLoaded: true,
      passwordRetry: 0,
      hydrated: false,
      clerkUserId: null,
      clerkDisplayName: null,
      embed: false,
      activeId: 't1',
      selfParticipant: { id: 'self', name: 'x', color: '#000', status: 'online' },
      refreshDocumentList: () => {},
      refreshSharedList: () => {},
      resetTabs: () => {},
      refs: {
        lastPersistedSelfRef: { current: null },
        lastSavedTabsRef: { current: [] },
        lastSavedNameRef: { current: '' },
        loadedTabIdsRef: { current: new Set() },
        noteChangesetSeen: () => {},
      },
      set: set as never,
    }),
  );
  return fns;
}

const DOC = { id: 'doc-1', ownerId: 'guest-1', name: 'D', tabs: [] };

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  resetLoadProgressForTests();
  window.history.replaceState(null, '', '/document/doc-1');
  // A self-healing reload already ran in this tab, so a timeout shows the error screen.
  window.sessionStorage.setItem(
    AUTO_RELOAD_KEY,
    JSON.stringify({ [window.location.href]: Date.now() }),
  );
  api.apiLoadSelf.mockResolvedValue({ id: 'guest-1', name: 'G', color: '#111', status: 'online' });
  api.apiSaveSelf.mockResolvedValue(undefined);
  api.apiListShareLinks.mockResolvedValue({ links: [], passwordSet: false });
  identity.ensureCollabKey.mockReturnValue('collab');
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  window.sessionStorage.clear();
});

describe('useIdentityBootstrap recovery', () => {
  it('shows the load-error screen when the document load never answers', async () => {
    api.apiLoadDocument.mockReturnValue(new Promise(() => {}));
    const s = render();
    await vi.advanceTimersByTimeAsync(LOAD_TIMEOUT_MS);
    expect(s.setLoadError).toHaveBeenCalledWith(true);
    expect(s.setLoadingDocument).toHaveBeenCalledWith(false);
    expect(track).toHaveBeenCalledWith('Error', 'Warning', 'DocumentLoad.TimedOut.Document');
  });

  it('shows the load-error screen when the load throws', async () => {
    identity.ensureCollabKey.mockImplementation(() => {
      throw new TypeError('crypto.randomUUID is not a function');
    });
    const s = render();
    await vi.advanceTimersByTimeAsync(0);
    expect(s.setLoadError).toHaveBeenCalledWith(true);
    expect(s.setLoadingDocument).toHaveBeenCalledWith(false);
    expect(track).toHaveBeenCalledWith('Error', 'Client', 'DocumentLoad.TypeError');
  });

  it('replaces the load-error screen with the editor when the load lands late', async () => {
    let resolve!: (d: unknown) => void;
    api.apiLoadDocument.mockReturnValue(new Promise((r) => (resolve = r)));
    const s = render();
    await vi.advanceTimersByTimeAsync(LOAD_TIMEOUT_MS);
    expect(s.setLoadError).toHaveBeenLastCalledWith(true);
    resolve(DOC);
    await vi.advanceTimersByTimeAsync(0);
    expect(s.setLoadError).toHaveBeenLastCalledWith(false);
    expect(s.setHydrated).toHaveBeenCalledWith(true);
  });

  it('leaves a load that finishes in time alone', async () => {
    api.apiLoadDocument.mockResolvedValue(DOC);
    const s = render();
    await vi.advanceTimersByTimeAsync(LOAD_TIMEOUT_MS * 2);
    expect(s.setLoadError).not.toHaveBeenCalled();
    expect(s.setLoadingDocument).toHaveBeenCalledWith(false);
  });
});
