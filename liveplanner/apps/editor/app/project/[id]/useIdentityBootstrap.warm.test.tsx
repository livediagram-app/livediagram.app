// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { LastSeenCopy } from '@liveworkspace/workbench/lib/api/last-seen-copies';

// docs/specs/006-project/offline-mode.md "Warm open of a cloud project": a cloud plan this browser opened before paints
// its last seen copy before auth settles, read-only (as a Viewer: card moves, the shared filter and Automations stay
// closed), with the cards and sheets it kept; the ordinary load catches up behind it and replaces it in place. A Form
// first tab, or a Board without cards kept, waits for the load.

const { api, copies, fallback, hint, identity, paint, seed, seedDeps, timing } = vi.hoisted(() => ({
  fallback: { reload: vi.fn(), warn: vi.fn() },
  api: {
    apiLoadSelf: vi.fn(),
    apiSaveSelf: vi.fn(),
    apiLoadProject: vi.fn(),
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
  },
  // Each timing started, by metric: the handle the bootstrap ends.
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
// The not-found fallback's reload, watched rather than run (offline-mode.md "Never a wrong not found").
vi.mock('@liveworkspace/workbench/lib/warm-open', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@liveworkspace/workbench/lib/warm-open')>()),
  browserWarmOpenFallbackDeps: (forget: () => Promise<unknown>) => ({
    storage: () => window.sessionStorage,
    forget,
    reload: fallback.reload,
    warn: fallback.warn,
  }),
}));
vi.mock('@/lib/signed-in-hint', () => ({ readSignedInHint: () => hint.signedIn }));
vi.mock('@/lib/guest-identity', () => ({
  ensureGuestIdentity: async () => ({ id: 'guest-1', sig: 's' }),
}));
vi.mock('@/lib/offline/offline-store', () => ({
  isOfflineId: async () => false,
  OFFLINE_OWNER_ID: '__offline__',
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
vi.mock('./seed-fetched-project', () => ({
  makeSeedFetchedProject: (deps: {
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

const PLAN = { id: 'plan-1', ownerId: 'guest-1', name: 'Launch', tabs: [{ id: 't1' }] };
const CARDS = { items: [{ id: 'c1' }], rev: 4, nextKey: 2 };
const SHEETS = { tabId: 't1', sheets: [{ id: 's1', tabId: 't1', cells: [] }] };

const copyFor = (
  kind: string = 'board',
  over: Partial<LastSeenCopy<unknown, unknown>> = {},
  item: object = { cards: CARDS },
): LastSeenCopy<unknown, unknown> => ({
  reader: 'guest-1',
  itemId: 'plan-1',
  seenAt: 1,
  item: { ...PLAN, ...item },
  firstTab: { id: 't1', rev: 2, tab: { id: 't1', kind, elements: [] } },
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
  window.sessionStorage.clear();
  window.history.replaceState(null, '', '/project/plan-1');
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
  api.apiLoadProject.mockResolvedValue(PLAN);
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
  it("paints an Editor's Board copy read-only with its cards, then catches up and lets them edit", async () => {
    const { hook, set } = render({ authLoaded: false, accountUserId: null });
    await flush();
    expect(paint).toHaveBeenCalledExactlyOnceWith(copies.held);
    // A Viewer until the participant resolves: card moves, the shared filter and Automations stay closed.
    expect(lastRole(set)).toBe('view');
    expect(set.setIsOwner).toHaveBeenCalledWith(true);
    expect(set.setWarmTabId).toHaveBeenCalledWith('t1');
    expect(set.setWarmPlan).toHaveBeenCalledWith({ cards: CARDS, sheets: null });
    expect(set.setLoadingProject).toHaveBeenCalledWith(false);
    // Nothing waits on the server, and nothing is saved or connected: those need `hydrated` and a project id.
    expect(api.apiLoadProject).not.toHaveBeenCalled();
    expect(set.setHydrated).toBeUndefined();
    expect(set.setProjectId).toBeUndefined();

    hook.rerender({ authLoaded: true, accountUserId: null });
    await flush();
    expect(api.apiLoadProject).toHaveBeenCalledExactlyOnceWith('guest-1', 'plan-1');
    expect(lastRole(set)).toBe('edit');
    expect(set.setHydrated).toHaveBeenCalledWith(true);
    expect(seedDeps.current?.warmFirstTab?.()).toBe(copies.held!.firstTab);
    // Replaced in place: the opening screen never comes back between.
    expect(set.setLoadingProject).not.toHaveBeenCalledWith(true);
    expect(copies.remember).toHaveBeenCalledOnce();
  });

  it.each([
    ['dashboard', { cards: CARDS }],
    ['sheet', { sheets: SHEETS }],
  ])('paints a %s first tab from what the copy kept', async (kind, item) => {
    copies.held = copyFor(kind, {}, item);
    const { set } = render({ authLoaded: false, accountUserId: null });
    await flush();
    expect(paint).toHaveBeenCalledOnce();
    expect(set.setWarmPlan).toHaveBeenCalledWith(expect.objectContaining(item));
  });

  it.each([
    ['form', { cards: CARDS, sheets: SHEETS }],
    ['board', { cards: null }],
    ['sheet', { sheets: null }],
  ])('waits for the load on a %s first tab the copy cannot paint', async (kind, item) => {
    copies.held = copyFor(kind, {}, item);
    const { hook, set } = render({ authLoaded: false, accountUserId: null });
    await flush();
    expect(paint).not.toHaveBeenCalled();
    expect(set.setWarmPlan).toBeUndefined();
    expect(timing.started).toHaveLength(0);
    hook.rerender({ authLoaded: true, accountUserId: null });
    await flush();
    expect(api.apiLoadProject).toHaveBeenCalledOnce();
  });

  it("paints a link's copy read-only, then catches up under the link", async () => {
    window.history.replaceState(null, '', '/project/plan-1?s=CODE');
    copies.held = copyFor('board', {
      via: 'CODE',
      access: { role: 'participate', isOwner: false, sessionShareCode: 'CODE', tabScope: null },
    });
    api.apiLoadShared.mockResolvedValue({
      project: { ...PLAN, ownerId: 'owner-9' },
      role: 'participate',
      tabId: null,
    });
    const { hook, set } = render({ authLoaded: false, accountUserId: null });
    await flush();
    expect(paint).toHaveBeenCalledOnce();
    expect(lastRole(set)).toBe('view');
    expect(set.setIsOwner).toHaveBeenCalledWith(false);
    hook.rerender({ authLoaded: true, accountUserId: null });
    await flush();
    expect(api.apiLoadShared).toHaveBeenCalledWith('CODE', 'guest-1', 'plan-1');
    expect(set.setSessionShareCode).toHaveBeenCalledWith('CODE');
    expect(set.setHydrated).toHaveBeenCalledWith(true);
  });

  it('reloads once without the copy rather than show not found after a warm paint', async () => {
    api.apiLoadProject.mockResolvedValue(null);
    const { hook, set } = render({ authLoaded: false, accountUserId: null });
    await flush();
    hook.rerender({ authLoaded: true, accountUserId: null });
    await flush();
    expect(set.setProjectNotFound?.mock.calls ?? []).not.toContainEqual([true]);
    expect(copies.forget).toHaveBeenCalledWith('guest-1', 'plan-1');
    expect(fallback.reload).toHaveBeenCalledOnce();
    expect(fallback.warn).toHaveBeenCalledWith(
      expect.stringContaining('[load] warm-open-fallback not-found'),
    );
  });

  it('swaps the copy for not found when access was lost, and forgets it', async () => {
    window.sessionStorage.setItem('warm-open-fallback:plan-1', 'not-found');
    api.apiLoadProject.mockResolvedValue(null);
    const { hook, set } = render({ authLoaded: false, accountUserId: null });
    await flush();
    hook.rerender({ authLoaded: true, accountUserId: null });
    await flush();
    expect(set.setProjectNotFound).toHaveBeenCalledWith(true);
    expect(copies.forget).toHaveBeenCalledWith('guest-1', 'plan-1');
  });

  // A plan's share revoked: the link opens nothing now, so every copy kept under its code goes, as in the other editors.
  it("forgets a revoked link's copies by its code", async () => {
    window.sessionStorage.setItem('warm-open-fallback:plan-1', 'not-found');
    window.history.replaceState(null, '', '/project/plan-1?s=CODE');
    copies.held = copyFor('board', {
      via: 'CODE',
      access: { role: 'view', isOwner: false, sessionShareCode: 'CODE', tabScope: null },
    });
    api.apiLoadShared.mockResolvedValue(null);
    const { hook, set } = render({ authLoaded: false, accountUserId: null });
    await flush();
    expect(paint).toHaveBeenCalledOnce();
    hook.rerender({ authLoaded: true, accountUserId: null });
    await flush();
    expect(set.setProjectNotFound).toHaveBeenCalledWith(true);
    expect(copies.forgetVia).toHaveBeenCalledWith('guest-1', 'CODE');
  });

  it("takes someone else's copy off the screen, cards included", async () => {
    hint.signedIn = true;
    copies.held = copyFor('board', { reader: 'user_a' });
    const { hook, set } = render({ authLoaded: false, accountUserId: null });
    await flush();
    expect(paint).toHaveBeenCalledOnce();
    hook.rerender({ authLoaded: true, accountUserId: 'user_b' });
    await flush();
    expect(set.setLoadingProject).toHaveBeenCalledWith(true);
    expect(set.setWarmTabId).toHaveBeenLastCalledWith(null);
    expect(set.setWarmPlan).toHaveBeenLastCalledWith(null);
    expect(api.apiLoadProject).toHaveBeenCalledWith('user_b', 'plan-1');
  });

  it("never shows an account's copy to a signed-out browser", async () => {
    copies.held = copyFor('board', { reader: 'user_a' });
    render({ authLoaded: false, accountUserId: null });
    await flush();
    expect(copies.read).toHaveBeenCalledWith('guest-1', 'plan-1');
    expect(paint).not.toHaveBeenCalled();
  });

  it('paints when auth settles before the copy read answers, while the load has not landed', async () => {
    let answer: (copy: unknown) => void = () => {};
    copies.read.mockImplementation(() => new Promise((r) => (answer = r)));
    let landed: (plan: unknown) => void = () => {};
    api.apiLoadProject.mockImplementation(() => new Promise((r) => (landed = r)));
    const { hook, set } = render({ authLoaded: false, accountUserId: null });
    await flush();
    hook.rerender({ authLoaded: true, accountUserId: null });
    await flush();
    answer(copies.held);
    await flush();
    expect(paint).toHaveBeenCalledExactlyOnceWith(copies.held);
    landed(PLAN);
    await flush();
    expect(lastRole(set)).toBe('edit');
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
  });

  it('reads and paints once when the layout effect runs twice (StrictMode in dev)', async () => {
    render({ authLoaded: false, accountUserId: null }, true);
    await flush();
    expect(copies.read).toHaveBeenCalledOnce();
    expect(paint).toHaveBeenCalledOnce();
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
    expect(api.apiLoadProject).toHaveBeenCalledOnce();
  });

  it('keeps the tab the person moved to during the warm paint, and none without one', async () => {
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

  // timing-telemetry.md "WarmPaint": the warm paint is a timing of its own, so production shows it.
  it('times the warm paint as WarmPaint, and the catch-up as ProjectLoad', async () => {
    const { hook } = render({ authLoaded: false, accountUserId: null });
    await flush();
    const warm = timing.started.filter((t) => t.metric === 'WarmPaint');
    expect(warm).toHaveLength(1);
    expect(warm[0]!.endAfterPaint).toHaveBeenCalledOnce();
    hook.rerender({ authLoaded: true, accountUserId: null });
    await flush();
    expect(timing.started.map((t) => t.metric)).toEqual(['WarmPaint', 'ProjectLoad']);
  });
});
