// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// docs/specs/007-editor/load-recovery.md "The load always ends": the load ends on the load-error
// screen when it hangs or throws, and a load that lands after the watchdog replaces that screen.

const { api, identity, seed } = vi.hoisted(() => ({
  api: {
    apiLoadSelf: vi.fn(),
    apiSaveSelf: vi.fn(),
    apiLoadDesign: vi.fn(),
    apiLoadShared: vi.fn(),
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
vi.mock('./seed-fetched-design', () => ({ makeSeedFetchedDesign: () => seed }));
const { timing, timingLib } = vi.hoisted(() => {
  const timing = { end: vi.fn(), cancel: vi.fn(), endAfterPaint: vi.fn() };
  return {
    timing,
    timingLib: {
      startEditorTiming: vi.fn(() => timing),
      designLoadOrigin: vi.fn(() => 0),
      noteDesignLoadEnded: vi.fn(),
    },
  };
});
vi.mock('@/lib/timing', () => timingLib);

import { useIdentityBootstrap } from './useIdentityBootstrap';
import { AUTO_RELOAD_KEY, LOAD_TIMEOUT_MS, resetLoadProgressForTests } from '@/lib/load-progress';
import { track } from '@/lib/telemetry';

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
  window.history.replaceState(null, '', '/design/doc-1');
  // A self-healing reload already ran in this tab, so a timeout shows the error screen.
  window.sessionStorage.setItem(
    AUTO_RELOAD_KEY,
    JSON.stringify({ [window.location.href]: Date.now() }),
  );
  api.apiLoadSelf.mockResolvedValue({ id: 'guest-1', name: 'G', color: '#111', status: 'online' });
  api.apiSaveSelf.mockResolvedValue(undefined);
  identity.ensureCollabKey.mockReturnValue('collab');
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  window.sessionStorage.clear();
});

describe('useIdentityBootstrap recovery', () => {
  it('shows the load-error screen when the design load never answers', async () => {
    api.apiLoadDesign.mockReturnValue(new Promise(() => {}));
    const s = render();
    await vi.advanceTimersByTimeAsync(LOAD_TIMEOUT_MS);
    expect(s.setLoadError).toHaveBeenCalledWith(true);
    expect(s.setLoadingDesign).toHaveBeenCalledWith(false);
    expect(track).toHaveBeenCalledWith('Error', 'Warning', 'DesignLoad.TimedOut.Design');
  });

  it('shows the load-error screen when the load throws', async () => {
    identity.ensureCollabKey.mockImplementation(() => {
      throw new TypeError('crypto.randomUUID is not a function');
    });
    const s = render();
    await vi.advanceTimersByTimeAsync(0);
    expect(s.setLoadError).toHaveBeenCalledWith(true);
    expect(s.setLoadingDesign).toHaveBeenCalledWith(false);
    expect(track).toHaveBeenCalledWith('Error', 'Client', 'DesignLoad.TypeError');
  });

  it('replaces the load-error screen with the editor when the load lands late', async () => {
    let resolve!: (d: unknown) => void;
    api.apiLoadDesign.mockReturnValue(new Promise((r) => (resolve = r)));
    const s = render();
    await vi.advanceTimersByTimeAsync(LOAD_TIMEOUT_MS);
    expect(s.setLoadError).toHaveBeenLastCalledWith(true);
    resolve(DOC);
    await vi.advanceTimersByTimeAsync(0);
    expect(s.setLoadError).toHaveBeenLastCalledWith(false);
    expect(s.setHydrated).toHaveBeenCalledWith(true);
  });

  it('leaves a load that finishes in time alone', async () => {
    api.apiLoadDesign.mockResolvedValue(DOC);
    const s = render();
    await vi.advanceTimersByTimeAsync(LOAD_TIMEOUT_MS * 2);
    expect(s.setLoadError).not.toHaveBeenCalled();
    expect(s.setLoadingDesign).toHaveBeenCalledWith(false);
  });

  // sign-in answering after the guest timeout settles auth twice: the second run wins, the first's late answer is
  // dropped rather than overwriting it.
  it('drops the writes of a load superseded by a later run', async () => {
    seed.mockClear();
    let resolveFirst!: (d: unknown) => void;
    api.apiLoadDesign
      .mockReturnValueOnce(new Promise((r) => (resolveFirst = r)))
      .mockResolvedValueOnce(DOC);
    const fns: Setters = {};
    const set = new Proxy(fns, { get: (t, k: string) => (t[k] ??= vi.fn()) });
    const props = (authLoaded: boolean) => ({
      authLoaded,
      passwordRetry: 0,
      hydrated: false,
      accountUserId: null,
      accountDisplayName: null,
      embed: false,
      workbench: null,
      activeId: 't1',
      selfParticipant: { id: 'self', name: 'x', color: '#000', status: 'online' as const },
      resetTabs: () => {},
      refs: {
        lastPersistedSelfRef: { current: null },
        lastSavedTabsRef: { current: [] },
        lastSavedNameRef: { current: '' },
        loadedTabIdsRef: { current: new Set<string>() },
        noteChangesetSeen: () => {},
      },
      set: set as never,
    });
    const hook = renderHook(
      (p: { authLoaded: boolean }) => useIdentityBootstrap(props(p.authLoaded)),
      {
        initialProps: { authLoaded: true },
      },
    );
    await vi.advanceTimersByTimeAsync(0);
    hook.rerender({ authLoaded: false });
    hook.rerender({ authLoaded: true });
    await vi.advanceTimersByTimeAsync(0);
    expect(seed).toHaveBeenCalledTimes(1);
    resolveFirst({ ...DOC, name: 'stale' });
    await vi.advanceTimersByTimeAsync(0);
    expect(seed).toHaveBeenCalledTimes(1);
    expect(fns['setHydrated']).toHaveBeenCalledTimes(1);
  });
});

// The DesignLoad timing (docs/specs/017-telemetry/timing-telemetry.md): ends on screen for a load
// that reached `done`, from the navigation for the page's first load; never for a failure.
describe('useIdentityBootstrap DesignLoad timing', () => {
  beforeEach(() => {
    Object.values(timing).forEach((fn) => fn.mockClear());
    Object.values(timingLib).forEach((fn) => fn.mockClear());
  });

  it('ends after paint for a load that opened the design', async () => {
    api.apiLoadDesign.mockResolvedValue(DOC);
    render();
    await vi.advanceTimersByTimeAsync(0);
    expect(timingLib.startEditorTiming).toHaveBeenCalledWith('DesignLoad', { from: 0 });
    expect(timing.endAfterPaint).toHaveBeenCalledTimes(1);
    expect(timingLib.noteDesignLoadEnded).toHaveBeenCalled();
  });

  it('is dropped for a design that is not there', async () => {
    api.apiLoadDesign.mockResolvedValue(null);
    render();
    await vi.advanceTimersByTimeAsync(0);
    expect(timing.endAfterPaint).not.toHaveBeenCalled();
    expect(timing.cancel).toHaveBeenCalled();
    expect(timingLib.noteDesignLoadEnded).toHaveBeenCalled();
  });

  it('is dropped for a load that throws', async () => {
    identity.ensureCollabKey.mockImplementation(() => {
      throw new TypeError('boom');
    });
    render();
    await vi.advanceTimersByTimeAsync(0);
    expect(timing.cancel).toHaveBeenCalled();
    expect(timing.endAfterPaint).not.toHaveBeenCalled();
  });

  it('is not timed on a password retry', async () => {
    api.apiLoadDesign.mockResolvedValue(DOC);
    render(1);
    await vi.advanceTimersByTimeAsync(0);
    expect(timingLib.startEditorTiming).not.toHaveBeenCalled();
  });
});
