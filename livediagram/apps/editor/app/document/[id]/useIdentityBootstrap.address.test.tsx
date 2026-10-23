// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// docs/specs/007-editor/new-document-route.md "Unknown addresses": an address that names no document and carries no
// share link shows the not-found card, never the New Document wizard; the editor's own empty route still hands off
// to /new.

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
  ensureGuestIdentity: async () => ({ id: 'guest-1' }),
}));
vi.mock('@/lib/daily-return', () => ({ trackDailyReturn: () => {} }));
vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));
vi.mock('./seed-fetched-document', () => ({ makeSeedFetchedDocument: () => seed }));
const { timingLib } = vi.hoisted(() => {
  const timing = { end: vi.fn(), cancel: vi.fn(), endAfterPaint: vi.fn() };
  return {
    timing,
    timingLib: {
      startEditorTiming: vi.fn(() => timing),
      documentLoadOrigin: vi.fn(() => 0),
      noteDocumentLoadEnded: vi.fn(),
    },
  };
});
vi.mock('@/lib/timing', () => timingLib);

import { useIdentityBootstrap } from './useIdentityBootstrap';
import { resetLoadProgressForTests } from '@/lib/load-progress';

type Setters = Record<string, ReturnType<typeof vi.fn>>;

function render(passwordRetry = 0) {
  const fns: Setters = {};
  const set = new Proxy(fns, {
    get: (t, k: string) => (t[k] ??= vi.fn()),
  });
  renderHook(() =>
    useIdentityBootstrap({
      authLoaded: true,
      passwordRetry,
      hydrated: false,
      accountUserId: null,
      accountDisplayName: null,
      embed: false,
      workbench: null,
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

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  resetLoadProgressForTests();
  api.apiLoadSelf.mockResolvedValue({ id: 'guest-1', name: 'G', color: '#111', status: 'online' });
  api.apiSaveSelf.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  window.history.replaceState(null, '', '/');
});

describe('useIdentityBootstrap on an address that names no document', () => {
  it.each(['/explorer/mine', '/typo', '/documents/abc'])(
    'shows %s as not found, loading nothing',
    async (path) => {
      window.history.replaceState(null, '', path);
      const s = render();
      await vi.advanceTimersByTimeAsync(0);
      expect(s.setDocumentNotFound).toHaveBeenCalledWith(true);
      expect(s.setHydrated).toHaveBeenCalledWith(true);
      expect(s.setLoadingDocument).toHaveBeenCalledWith(false);
      expect(api.apiLoadDocument).not.toHaveBeenCalled();
      expect(api.apiLoadShared).not.toHaveBeenCalled();
    },
  );

  it('still hands the editor’s own empty route to /new', async () => {
    window.history.replaceState(null, '', '/document/placeholder');
    const s = render();
    await vi.advanceTimersByTimeAsync(0);
    expect(s.setDocumentNotFound).not.toHaveBeenCalled();
    expect(api.apiLoadSelf).not.toHaveBeenCalled();
  });
});
