// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { LastSeenCopy } from '@liveworkspace/workbench/lib/api/last-seen-copies';

// docs/specs/006-design/offline-mode.md "Warm open of a cloud design": a cloud design this browser opened before
// paints its last seen copy before auth settles, read-only, for the reader this browser expects; the ordinary load
// catches up behind it, replaces it in place and applies its role, or swaps it for the screen it ends on.

const { api, copies, hint, identity, paint, seed, seedDeps, timing } = vi.hoisted(() => ({
  api: {
    apiLoadSelf: vi.fn(),
    apiSaveSelf: vi.fn(),
    apiLoadDesign: vi.fn(),
    apiLoadShared: vi.fn(),
  },
  copies: {
    held: null as LastSeenCopy<unknown, unknown> | null,
    read: vi.fn(),
    readVia: vi.fn(),
    lastReader: vi.fn(),
    remember: vi.fn(async () => {}),
    forget: vi.fn(async () => {}),
    forgetVia: vi.fn(async () => {}),
  },
  hint: { signedIn: false },
  identity: { guestId: 'guest-1' } as { guestId: string | null },
  paint: vi.fn(),
  seed: vi.fn(async () => null),
  seedDeps: {
    current: null as { warmFirstTab?: () => unknown; keepActiveId?: () => string | null } | null,
  }, // Each timing started, by metric: the handle the bootstrap ends.
  timing: {
    started: [] as { metric: string; from: number | undefined; endAfterPaint: () => void }[],
  },
}));
vi.mock('@/lib/api-client', () => ({
  ...api,
  getSessionSharePassword: () => null,
  readCachedSharePassword: () => null,
  setSessionSharePassword: () => {},
  writeCachedSharePassword: () => {},
}));
vi.mock('@/lib/last-seen', () => ({ lastSeenCopies: copies }));
vi.mock('@/lib/signed-in-hint', () => ({ readSignedInHint: () => hint.signedIn }));
vi.mock('@/lib/guest-identity', () => ({ ensureGuestIdentity: async () => ({ id: 'guest-1' }) }));
vi.mock('@/lib/offline/offline-store', () => ({
  isOfflineId: async () => false,
  OFFLINE_OWNER_ID: '__offline__',
}));
vi.mock('@/lib/api/design-grants', () => ({ designGrant: async () => ({ level: 'edit' }) }));
vi.mock('@liveworkspace/workbench/lib/index-client', () => ({
  indexClient: { getItem: async () => ({ item: { trashedAt: null } }) },
}));
vi.mock('@/lib/local-identity', () => ({
  ensureCollabKey: () => 'collab',
  hasConfirmedName: () => true,
  getGuestSelfId: () => identity.guestId,
}));
vi.mock('@/lib/daily-return', () => ({ trackDailyReturn: () => {} }));
vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));
vi.mock('@/lib/timing', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/timing')>()),
  startEditorTiming: (metric: string, opts: { from?: number } = {}) => {
    const handle = { metric, from: opts.from, endAfterPaint: vi.fn() };
    timing.started.push(handle);
    return { end: vi.fn(), cancel: vi.fn(), endAfterPaint: handle.endAfterPaint };
  },
}));
vi.mock('./seed-fetched-design', () => ({
  makeSeedFetchedDesign: (deps: {
    warmFirstTab?: () => unknown;
    keepActiveId?: () => string | null;
  }) => {
    seedDeps.current = deps;
    return seed;
  },
  makePaintLastSeen: () => paint,
}));

import { useIdentityBootstrap } from './useIdentityBootstrap';
import { resetLoadProgressForTests } from '@/lib/load-progress';

const DOC = { id: 'doc-1', ownerId: 'owner-1', name: 'Payments', tabs: [{ id: 't1' }] };

const copyFor = (
  over: Partial<LastSeenCopy<unknown, unknown>> = {},
): LastSeenCopy<unknown, unknown> => ({
  reader: 'guest-1',
  itemId: 'doc-1',
  seenAt: 1,
  item: DOC,
  firstTab: { id: 't1', rev: 2, tab: { id: 't1', elements: [] } },
  via: null,
  access: { role: 'edit', isOwner: true, sessionShareCode: null, tabScope: null },
  ...over,
});

type Props = { authLoaded: boolean; accountUserId: string | null; activeId?: string };
function render(initial: Props, reactStrictMode = false) {
  const fns: Record<string, ReturnType<typeof vi.fn>> = {};
  const set = new Proxy(fns, { get: (t, k: string) => (t[k] ??= vi.fn()) });
  const hook = renderHook(
    ({ authLoaded, accountUserId, activeId = 't1' }: Props) =>
      useIdentityBootstrap({
        authLoaded,
        passwordRetry: 0,
        hydrated: false,
        accountUserId,
        accountDisplayName: null,
        embed: false,
        workbench: null,
        activeId,
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
    { initialProps: initial, reactStrictMode },
  );
  return { hook, set: fns };
}
const flush = () => new Promise((r) => setTimeout(r, 0));
const lastRole = (set: Record<string, ReturnType<typeof vi.fn>>): unknown =>
  set.setSessionRole!.mock.calls.at(-1)?.[0] as unknown;

beforeEach(() => {
  resetLoadProgressForTests();
  window.history.replaceState(null, '', '/design/doc-1');
  hint.signedIn = false;
  identity.guestId = 'guest-1';
  copies.held = copyFor();
  copies.read.mockImplementation(async (reader: string, itemId: string) =>
    copies.held && copies.held.reader === reader && copies.held.itemId === itemId
      ? copies.held
      : null,
  );
  copies.lastReader.mockImplementation(async () => copies.held?.reader ?? null);
  copies.readVia.mockImplementation(async (reader: string, code: string) =>
    copies.held && copies.held.reader === reader && copies.held.via === code ? copies.held : null,
  );
  api.apiLoadDesign.mockResolvedValue(DOC);
  api.apiLoadSelf.mockImplementation(async (id: string) => ({
    id,
    name: 'Reader',
    color: '#111',
    status: 'online',
  }));
  api.apiSaveSelf.mockResolvedValue(undefined);
});
afterEach(() => {
  vi.clearAllMocks();
  timing.started.length = 0;
});

describe('useIdentityBootstrap warm open', () => {
  it("paints an Editor's copy read-only before auth, then catches up and lets them edit", async () => {
    const { hook, set } = render({ authLoaded: false, accountUserId: null });
    await flush();
    expect(paint).toHaveBeenCalledExactlyOnceWith(copies.held);
    expect(lastRole(set)).toBe('view');
    expect(set.setIsOwner).toHaveBeenCalledWith(true);
    // The painted tab is the one with a body: the others show the tab loader until the load catches up.
    expect(set.setWarmTabId).toHaveBeenCalledWith('t1');
    expect(set.setLoadingDesign).toHaveBeenCalledWith(false);
    // Nothing waits on the server, and nothing is saved or connected: those need `hydrated`.
    expect(api.apiLoadDesign).not.toHaveBeenCalled();
    expect(set.setHydrated).toBeUndefined();

    hook.rerender({ authLoaded: true, accountUserId: null });
    await flush();
    expect(api.apiLoadDesign).toHaveBeenCalledExactlyOnceWith('guest-1', 'doc-1');
    expect(lastRole(set)).toBe('edit');
    expect(set.setHydrated).toHaveBeenCalledWith(true);
    // The catch-up's seed keeps the painted first tab when its revision is unchanged.
    expect(seedDeps.current?.warmFirstTab?.()).toBe(copies.held!.firstTab);
    // Replaced in place: the opening screen never comes back between.
    expect(set.setLoadingDesign).not.toHaveBeenCalledWith(true);
    expect(copies.remember).toHaveBeenCalledOnce();
  });

  it.each([
    ['view', 'Viewer'],
    ['participate', 'Participant'],
  ] as const)(
    "paints a %s link's copy read-only, then gives the %s their role",
    async (role, _who) => {
      window.history.replaceState(null, '', '/design/doc-1?s=CODE');
      copies.held = copyFor({
        via: 'CODE',
        access: { role, isOwner: false, sessionShareCode: 'CODE', tabScope: null },
      });
      api.apiLoadShared.mockResolvedValue({ design: DOC, role, tabId: null, community: null });
      const { hook, set } = render({ authLoaded: false, accountUserId: null });
      await flush();
      expect(paint).toHaveBeenCalledOnce();
      expect(lastRole(set)).toBe('view');
      expect(set.setIsOwner).toHaveBeenCalledWith(false);
      hook.rerender({ authLoaded: true, accountUserId: null });
      await flush();
      expect(api.apiLoadShared).toHaveBeenCalledWith('CODE', 'guest-1', 'doc-1');
      expect(lastRole(set)).toBe(role);
    },
  );

  it('swaps the copy for not found when access was lost, and forgets it', async () => {
    api.apiLoadDesign.mockResolvedValue(null);
    const { hook, set } = render({ authLoaded: false, accountUserId: null });
    await flush();
    expect(paint).toHaveBeenCalledOnce();
    hook.rerender({ authLoaded: true, accountUserId: null });
    await flush();
    expect(set.setDesignNotFound).toHaveBeenCalledWith(true);
    expect(copies.forget).toHaveBeenCalledWith('guest-1', 'doc-1');
  });

  it("paints a signed-in account's copy, and takes it off the screen when someone else is reading", async () => {
    hint.signedIn = true;
    copies.held = copyFor({ reader: 'user_a' });
    const { hook, set } = render({ authLoaded: false, accountUserId: null });
    await flush();
    expect(paint).toHaveBeenCalledOnce();
    hook.rerender({ authLoaded: true, accountUserId: 'user_b' });
    await flush();
    expect(set.setLoadingDesign).toHaveBeenCalledWith(true);
    expect(set.setWarmTabId).toHaveBeenLastCalledWith(null);
    expect(api.apiLoadDesign).toHaveBeenCalledWith('user_b', 'doc-1');
  });

  it("never shows an account's copy to a signed-out browser", async () => {
    copies.held = copyFor({ reader: 'user_a' });
    render({ authLoaded: false, accountUserId: null });
    await flush();
    expect(copies.read).toHaveBeenCalledWith('guest-1', 'doc-1');
    expect(paint).not.toHaveBeenCalled();
  });

  it('paints nothing once sign-out has cleared the copies', async () => {
    hint.signedIn = true;
    copies.held = null;
    const { set } = render({ authLoaded: false, accountUserId: null });
    await flush();
    expect(paint).not.toHaveBeenCalled();
    expect(set.setLoadingDesign).toBeUndefined();
  });

  // A guest's auth settles from the local token almost at once, so the load often starts before the copy read answers.
  it('paints when auth settles before the copy read answers, while the load has not landed', async () => {
    let answer: (copy: unknown) => void = () => {};
    copies.read.mockImplementation(() => new Promise((r) => (answer = r)));
    let landed: (doc: unknown) => void = () => {};
    api.apiLoadDesign.mockImplementation(() => new Promise((r) => (landed = r)));
    const { hook, set } = render({ authLoaded: false, accountUserId: null });
    await flush();
    hook.rerender({ authLoaded: true, accountUserId: null });
    await flush();
    answer(copies.held);
    await flush();
    expect(paint).toHaveBeenCalledExactlyOnceWith(copies.held);
    expect(lastRole(set)).toBe('view');
    landed(DOC);
    await flush();
    expect(lastRole(set)).toBe('edit');
    expect(set.setHydrated).toHaveBeenCalledWith(true);
    expect(seedDeps.current?.warmFirstTab?.()).toBe(copies.held!.firstTab);
  });

  it('paints no late copy once the load resolved someone else as reading', async () => {
    hint.signedIn = true;
    copies.held = copyFor({ reader: 'user_a' });
    let answer: (copy: unknown) => void = () => {};
    copies.read.mockImplementation(() => new Promise((r) => (answer = r)));
    api.apiLoadDesign.mockImplementation(() => new Promise(() => {}));
    const { hook } = render({ authLoaded: false, accountUserId: null });
    await flush();
    hook.rerender({ authLoaded: true, accountUserId: 'user_b' });
    await flush();
    answer(copies.held);
    await flush();
    expect(paint).not.toHaveBeenCalled();
  });

  it('reads and paints once when the layout effect runs twice (StrictMode in dev)', async () => {
    render({ authLoaded: false, accountUserId: null }, true);
    await flush();
    expect(copies.read).toHaveBeenCalledOnce();
    expect(paint).toHaveBeenCalledOnce();
  });

  it('paints nothing when the ordinary load landed first', async () => {
    let answer: (copy: unknown) => void = () => {};
    copies.read.mockImplementation(() => new Promise((r) => (answer = r)));
    const { hook, set } = render({ authLoaded: false, accountUserId: null });
    await flush();
    hook.rerender({ authLoaded: true, accountUserId: null });
    await flush();
    expect(set.setHydrated).toHaveBeenCalledWith(true);
    answer(copyFor());
    await flush();
    expect(paint).not.toHaveBeenCalled();
    expect(api.apiLoadDesign).toHaveBeenCalledOnce();
  });

  it('opens as always when the copy store fails', async () => {
    copies.lastReader.mockRejectedValue(new Error('gone'));
    copies.read.mockRejectedValue(new Error('gone'));
    hint.signedIn = true;
    const { hook } = render({ authLoaded: false, accountUserId: null });
    await flush();
    expect(paint).not.toHaveBeenCalled();
    hook.rerender({ authLoaded: true, accountUserId: null });
    await flush();
    expect(api.apiLoadDesign).toHaveBeenCalledOnce();
  });
  it('keeps the tab the person moved to during the warm paint when the load catches up', async () => {
    const { hook } = render({ authLoaded: false, accountUserId: null });
    await flush();
    hook.rerender({ authLoaded: false, accountUserId: null, activeId: 't2' });
    hook.rerender({ authLoaded: true, accountUserId: null, activeId: 't2' });
    await flush();
    expect(seedDeps.current?.keepActiveId?.()).toBe('t2');
  });

  it('keeps no tab for a load with nothing warm-painted', async () => {
    copies.held = null;
    const { hook } = render({ authLoaded: false, accountUserId: null });
    await flush();
    hook.rerender({ authLoaded: true, accountUserId: null, activeId: 't2' });
    await flush();
    expect(seedDeps.current?.keepActiveId?.()).toBeNull();
  });

  // The Share dialog's links are /design/shared?s=<code>: a Viewer or Participant reloading theirs warm-opens.
  it("paints a link's own address from the copy kept under its code", async () => {
    window.history.replaceState(null, '', '/design/shared?s=CODE');
    copies.held = copyFor({
      via: 'CODE',
      access: { role: 'view', isOwner: false, sessionShareCode: 'CODE', tabScope: null },
    });
    const { set } = render({ authLoaded: false, accountUserId: null });
    await flush();
    expect(copies.readVia).toHaveBeenCalledWith('guest-1', 'CODE');
    expect(paint).toHaveBeenCalledExactlyOnceWith(copies.held);
    expect(lastRole(set)).toBe('view');
    // The address is left as it is.
    expect(window.location.pathname).toBe('/design/shared');
  });

  it("forgets a revoked link's copies by its code", async () => {
    window.history.replaceState(null, '', '/design/shared?s=CODE');
    copies.held = copyFor({
      via: 'CODE',
      access: { role: 'view', isOwner: false, sessionShareCode: 'CODE', tabScope: null },
    });
    api.apiLoadShared.mockResolvedValue(null);
    const { hook, set } = render({ authLoaded: false, accountUserId: null });
    await flush();
    expect(paint).toHaveBeenCalledOnce();
    hook.rerender({ authLoaded: true, accountUserId: null });
    await flush();
    expect(set.setDesignNotFound).toHaveBeenCalledWith(true);
    expect(copies.forgetVia).toHaveBeenCalledWith('guest-1', 'CODE');
  });

  // timing-telemetry.md "WarmPaint": the warm paint is a timing of its own, so production shows it.
  it('times the warm paint as WarmPaint from the read, and the catch-up as DesignLoad', async () => {
    const before = performance.now();
    const { hook } = render({ authLoaded: false, accountUserId: null });
    await flush();
    const warm = timing.started.filter((t) => t.metric === 'WarmPaint');
    expect(warm).toHaveLength(1);
    // No navigation entry names this page in the test, so it times from the read's start, never from undefined.
    expect(warm[0]!.from).toBeGreaterThanOrEqual(before);
    expect(warm[0]!.endAfterPaint).toHaveBeenCalledOnce();
    hook.rerender({ authLoaded: true, accountUserId: null });
    await flush();
    expect(timing.started.map((t) => t.metric)).toEqual(['WarmPaint', 'DesignLoad']);
  });

  it('times no WarmPaint for an open with no copy to paint', async () => {
    copies.held = null;
    const { hook } = render({ authLoaded: false, accountUserId: null });
    await flush();
    hook.rerender({ authLoaded: true, accountUserId: null });
    await flush();
    expect(timing.started.map((t) => t.metric)).toEqual(['DesignLoad']);
  });
});
