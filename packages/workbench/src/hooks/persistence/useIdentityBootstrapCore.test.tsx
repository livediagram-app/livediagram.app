// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { LastSeenCopy } from '../../lib/api/last-seen-copies';
import {
  useIdentityBootstrapCore,
  type BootstrapSeedContext,
  type IdentityBootstrapDeps,
  type IdentityBootstrapOptions,
} from './useIdentityBootstrapCore';

// Each product's docs/specs/006-*/offline-mode.md ("Instant open", "Warm open of a cloud document", "Never a wrong not
// found"), 007-editor/load-recovery.md, 007-editor/new-*-route.md ("Unknown addresses") and
// 017-telemetry/timing-telemetry.md. Each editor's own useIdentityBootstrap.*.test.tsx files drive its binding with its
// real modules; these pin the shared hook's every branch against fakes.

const warm = vi.hoisted(() => ({
  read: null as null | ((...args: unknown[]) => Promise<unknown>),
  fallback: vi.fn((..._args: unknown[]) => true),
  measure: vi.fn(),
}));
vi.mock('../../lib/warm-open', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../lib/warm-open')>();
  return {
    ...real,
    readWarmCopy: (...args: Parameters<typeof real.readWarmCopy>) =>
      warm.read ? warm.read(...args) : real.readWarmCopy(...args),
    warmOpenFallback: (...args: unknown[]) => warm.fallback(...args),
    // The browser's deps: the forget runs at once, so a test sees which copy goes.
    browserWarmOpenFallbackDeps: (forget: () => Promise<unknown>) => {
      void forget();
      return {};
    },
    measureAfterPaint: (...args: unknown[]) => {
      warm.measure(...args);
    },
  };
});

type P = { id: string; name: string; color: string; key?: string; status?: string };
type Tab = { id: string };
type Item = { name: string; tabs: Tab[] };
type Loaded = { name: string };
type W = { itemId: string };

const makeSet = () => ({
  setLoadError: vi.fn(),
  setHydrated: vi.fn(),
  setNameConfirmed: vi.fn(),
  setSelfParticipant: vi.fn(),
  setWarmTabId: vi.fn(),
  setIsOwner: vi.fn(),
  setSessionTabScope: vi.fn(),
  setSessionRole: vi.fn(),
  setIdentityPromptOpen: vi.fn(),
  setItemNotFound: vi.fn(),
  setLoadingItem: vi.fn(),
  setName: vi.fn(),
  setWarmExtra: vi.fn(),
});
type S = ReturnType<typeof makeSet>;

const READER: P = { id: 'guest_1', name: 'Ann', color: '#f00' };
const PLACEHOLDER: P = { id: 'self', name: 'Guest', color: '#000' };

const copyOf = (over: Partial<LastSeenCopy<Item, unknown>> = {}): LastSeenCopy<Item, unknown> => ({
  reader: 'guest_1',
  itemId: 'd1',
  seenAt: 1,
  item: { name: 'Kept', tabs: [{ id: 't1' }] },
  firstTab: { id: 't1', rev: 1, tab: {} },
  via: null,
  access: { role: 'edit', isOwner: true, sessionShareCode: null, tabScope: null },
  ...over,
});

let step: string | null = null;
let finishLate = false;
let watchdog: { onTimedOut: () => void; warn: (type: string) => void } | null = null;
let ctx: BootstrapSeedContext<Tab> | null = null;

function makeDeps(over: Partial<IdentityBootstrapDeps<S, Tab, P, Item, Loaded, W>> = {}) {
  const copies = {
    read: vi.fn(
      async (_reader: string, _id: string): Promise<LastSeenCopy<Item, unknown> | null> => null,
    ),
    readVia: vi.fn(
      async (_reader: string, _code: string): Promise<LastSeenCopy<Item, unknown> | null> => null,
    ),
    forget: vi.fn(async () => {}),
  };
  const timing = { endAfterPaint: vi.fn(), cancel: vi.fn() };
  const warmTiming = { endAfterPaint: vi.fn(), cancel: vi.fn() };
  const deps = {
    notFoundKey: 'setItemNotFound',
    setNotFound: (s: S) => s.setItemNotFound,
    setLoading: (s: S) => s.setLoadingItem,
    noun: 'thing',
    readPath: (pathname: string) => {
      const m = /^\/(doc|old)\/([^/?#]+)/.exec(pathname);
      if (!m || m[2] === 'placeholder') return { id: null };
      return { id: m[2]!, canonical: m[1] === 'old' ? `/doc/${m[2]}` : null };
    },
    isEditorPath: (pathname: string) => pathname.startsWith('/doc'),
    isOfflineId: vi.fn(async (_id: string) => false),
    resolveParticipant: vi.fn(async (args: { onParticipantStep?: () => void }) => {
      args.onParticipantStep?.();
      return READER;
    }),
    ensureCollabKey: () => 'key-1',
    getGuestSelfId: () => 'guest_1',
    hasConfirmedName: vi.fn(() => true),
    trackDailyReturn: vi.fn(),
    readSignedInHint: vi.fn(() => false),
    lastSeenCopies: () => copies,
    warmPaintCode: () => [],
    makeSeed: vi.fn((s: S, c: BootstrapSeedContext<Tab>) => {
      ctx = c;
      return vi.fn(async (_selfId: string, item: Loaded) => {
        s.setName(item.name);
        return null;
      });
    }),
    makePaint: vi.fn((s: S, c: BootstrapSeedContext<Tab>) => {
      ctx = c;
      return (copy: LastSeenCopy<Item, unknown>) => {
        s.setName(copy.item.name);
      };
    }),
    openShareLink: vi.fn(
      async (run: { self: { id: string }; seed: (...a: never[]) => unknown }) => {
        await (run.seed as (id: string, item: Loaded) => Promise<unknown>)(run.self.id, {
          name: 'Shared',
        });
        return true;
      },
    ),
    openOwnAddress: vi.fn(
      async (run: { self: { id: string }; seed: (...a: never[]) => unknown }) => {
        await (run.seed as (id: string, item: Loaded) => Promise<unknown>)(run.self.id, {
          name: 'Fetched',
        });
        return true;
      },
    ),
    loadWorkbench: vi.fn(async (args: { set: S }) => {
      args.set.setHydrated(true);
    }),
    armLoadWatchdog: vi.fn((onTimedOut: () => void, d: { warn: (type: string) => void }) => {
      watchdog = { onTimedOut, warn: d.warn };
      return { finish: () => finishLate };
    }),
    loadStep: () => step,
    setLoadStep: vi.fn((s: 'participant' | 'done') => {
      step = s;
    }),
    track: vi.fn(),
    loadErrorType: (err: unknown) => `ThingLoad.${(err as Error).name}`,
    loadOrigin: vi.fn((): number | undefined => 100),
    noteLoadEnded: vi.fn(),
    timeLoad: vi.fn(() => timing),
    timeWarmPaint: vi.fn(() => warmTiming),
    ...over,
  } satisfies IdentityBootstrapDeps<S, Tab, P, Item, Loaded, W>;
  return { deps, copies, timing, warmTiming };
}

type Opts = IdentityBootstrapOptions<S, Tab, P, W>;
const makeOpts = (set: S, over: Partial<Opts> = {}): Opts => ({
  authLoaded: true,
  passwordRetry: 0,
  hydrated: false,
  accountUserId: null,
  accountDisplayName: null,
  embed: false,
  workbench: null,
  activeId: 't1',
  selfParticipant: PLACEHOLDER,
  resetTabs: vi.fn(),
  refs: {
    lastPersistedSelfRef: { current: null },
    lastSavedTabsRef: { current: [] },
    lastSavedNameRef: { current: '' },
    loadedTabIdsRef: { current: new Set() },
    noteChangesetSeen: vi.fn(),
  },
  set,
  ...over,
});

function mount(
  deps: IdentityBootstrapDeps<S, Tab, P, Item, Loaded, W>,
  opts: Opts,
  strict = false,
) {
  return renderHook((p: Opts) => useIdentityBootstrapCore(deps, p), {
    initialProps: opts,
    reactStrictMode: strict,
  });
}

// Lets every promise the hook started settle.
const settle = () => act(() => new Promise<void>((r) => setTimeout(r, 0)));

const deferred = <T,>() => {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

beforeEach(() => {
  step = null;
  finishLate = false;
  watchdog = null;
  ctx = null;
  warm.read = null;
  warm.fallback.mockClear();
  warm.measure.mockClear();
  window.history.replaceState(null, '', '/doc/d1');
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useIdentityBootstrapCore: the ordinary load', () => {
  it('waits for auth, then resolves the reader and opens the item by its own address', async () => {
    const set = makeSet();
    const { deps, timing } = makeDeps();
    const { rerender } = mount(deps, makeOpts(set, { authLoaded: false }));
    await settle();
    expect(deps.openOwnAddress).not.toHaveBeenCalled();
    rerender(makeOpts(set));
    await settle();
    expect(deps.trackDailyReturn).toHaveBeenCalledWith(false);
    expect(deps.setLoadStep).toHaveBeenCalledWith('participant');
    expect(set.setSelfParticipant).toHaveBeenCalledWith({
      ...READER,
      key: 'key-1',
      status: 'online',
    });
    expect(deps.openOwnAddress).toHaveBeenCalledWith(expect.objectContaining({ self: READER }), {
      id: 'd1',
      early: false,
      accountUserId: null,
    });
    expect(set.setName).toHaveBeenCalledWith('Fetched');
    expect(set.setNameConfirmed).toHaveBeenLastCalledWith(true);
    expect(set.setHydrated).toHaveBeenLastCalledWith(true);
    expect(set.setLoadingItem).toHaveBeenLastCalledWith(false);
    expect(step).toBe('done');
    expect(timing.endAfterPaint).toHaveBeenCalledOnce();
    expect(deps.timeLoad).toHaveBeenCalledWith(100);
    expect(deps.noteLoadEnded).toHaveBeenCalledOnce();
    // Its read is an open.
    expect(ctx!.recordOpen).toBe(true);
  });

  it('does nothing once hydrated', async () => {
    const set = makeSet();
    const { deps } = makeDeps();
    mount(deps, makeOpts(set, { hydrated: true }));
    await settle();
    expect(deps.armLoadWatchdog).not.toHaveBeenCalled();
  });

  it('opens a share link, an embed reading without an open', async () => {
    window.history.replaceState(null, '', '/doc/d1?s=CODE');
    const set = makeSet();
    const { deps } = makeDeps();
    mount(deps, makeOpts(set, { embed: true }));
    await settle();
    expect(deps.openShareLink).toHaveBeenCalledWith(expect.anything(), {
      shareCodeParam: 'CODE',
      id: 'd1',
      embed: true,
    });
    expect(set.setName).toHaveBeenCalledWith('Shared');
    expect(ctx!.recordOpen).toBe(false);
  });

  it.each([
    ['share link', '/doc/shared?s=CODE', 'openShareLink'],
    ['own address', '/doc/d1', 'openOwnAddress'],
  ] as const)('ends where a %s arrival ended short of the item', async (_n, path, door) => {
    window.history.replaceState(null, '', path);
    const set = makeSet();
    const { deps } = makeDeps({ [door]: vi.fn(async () => false) });
    mount(deps, makeOpts(set));
    await settle();
    expect(set.setHydrated).not.toHaveBeenCalled();
    expect(step).not.toBe('done');
  });

  it('reuses a reader already resolved, on a password retry, untimed', async () => {
    const set = makeSet();
    const { deps } = makeDeps();
    mount(deps, makeOpts(set, { passwordRetry: 1, selfParticipant: READER }));
    await settle();
    expect(deps.resolveParticipant).not.toHaveBeenCalled();
    expect(deps.timeLoad).not.toHaveBeenCalled();
    expect(deps.openOwnAddress).toHaveBeenCalledWith(
      expect.objectContaining({ self: READER }),
      expect.anything(),
    );
  });

  it('corrects an old address in the bar', async () => {
    window.history.replaceState(null, '', '/old/d1?x=1#t=t2');
    const set = makeSet();
    const { deps } = makeDeps();
    mount(deps, makeOpts(set));
    await settle();
    expect(`${window.location.pathname}${window.location.search}${window.location.hash}`).toBe(
      '/doc/d1?x=1#t=t2',
    );
    expect(deps.openOwnAddress).toHaveBeenCalled();
  });

  it("hands the editor's own empty route to /new, loading nothing", async () => {
    window.history.replaceState(null, '', '/doc/placeholder');
    const set = makeSet();
    const { deps } = makeDeps();
    mount(deps, makeOpts(set));
    await settle();
    expect(deps.armLoadWatchdog).not.toHaveBeenCalled();
    expect(set.setItemNotFound).not.toHaveBeenCalled();
  });

  it('shows an address that names no item as not found', async () => {
    window.history.replaceState(null, '', '/typo');
    const set = makeSet();
    const { deps } = makeDeps({ hasConfirmedName: vi.fn(() => false) });
    mount(deps, makeOpts(set));
    await settle();
    expect(set.setItemNotFound).toHaveBeenCalledWith(true);
    expect(set.setHydrated).toHaveBeenCalledWith(true);
    expect(set.setLoadingItem).toHaveBeenCalledWith(false);
    expect(set.setNameConfirmed).toHaveBeenCalledWith(false);
    expect(deps.openOwnAddress).not.toHaveBeenCalled();
  });

  it('ends a load that throws on the load-error screen, untimed', async () => {
    const set = makeSet();
    const { deps, timing } = makeDeps({
      openOwnAddress: vi.fn(async () => {
        throw new TypeError('boom');
      }),
    });
    mount(deps, makeOpts(set));
    await settle();
    expect(console.error).toHaveBeenCalledWith(
      '[load] the thing load threw',
      expect.any(TypeError),
    );
    expect(deps.track).toHaveBeenCalledWith('Error', 'Client', 'ThingLoad.TypeError');
    expect(set.setLoadError).toHaveBeenCalledWith(true);
    expect(set.setLoadingItem).toHaveBeenCalledWith(false);
    expect(timing.cancel).toHaveBeenCalledOnce();
    expect(timing.endAfterPaint).not.toHaveBeenCalled();
  });

  it('cancels the timing of a retry that throws, which has none', async () => {
    const set = makeSet();
    const { deps } = makeDeps({
      openOwnAddress: vi.fn(async () => {
        throw new Error('boom');
      }),
    });
    mount(deps, makeOpts(set, { passwordRetry: 2, selfParticipant: READER }));
    await settle();
    expect(set.setLoadError).toHaveBeenCalledWith(true);
  });

  it('times nothing for a load that did not reach done', async () => {
    const set = makeSet();
    const { deps, timing } = makeDeps({ setLoadStep: vi.fn() });
    mount(deps, makeOpts(set));
    await settle();
    expect(timing.cancel).toHaveBeenCalledOnce();
    expect(timing.endAfterPaint).not.toHaveBeenCalled();
  });

  it('shows the load-error screen when the watchdog fires, and a late load replaces it', async () => {
    const set = makeSet();
    const { deps } = makeDeps();
    finishLate = true;
    mount(deps, makeOpts(set));
    watchdog!.warn('ThingLoad.Late');
    expect(deps.track).toHaveBeenCalledWith('Error', 'Warning', 'ThingLoad.Late');
    watchdog!.onTimedOut();
    expect(set.setLoadError).toHaveBeenCalledWith(true);
    await settle();
    expect(set.setLoadError).toHaveBeenLastCalledWith(false);
  });

  it("drops a superseded run's writes: its seed never runs and it records nothing", async () => {
    const set = makeSet();
    const first = deferred<boolean>();
    const runs: Array<{ seed: (...a: never[]) => unknown }> = [];
    const { deps, timing } = makeDeps({
      openOwnAddress: vi.fn(async (run: { seed: (...a: never[]) => unknown }) => {
        runs.push(run);
        return runs.length === 1 ? first.promise : true;
      }),
    });
    const { rerender } = mount(deps, makeOpts(set));
    await settle();
    rerender(makeOpts(set, { passwordRetry: 1 }));
    await settle();
    const seeded = await (runs[0]!.seed as (id: string, item: Loaded) => Promise<unknown>)(
      'guest_1',
      { name: 'Stale' },
    );
    expect(seeded).toBeNull();
    expect(set.setName).not.toHaveBeenCalledWith('Stale');
    set.setHydrated.mockClear();
    first.resolve(true);
    await settle();
    expect(set.setHydrated).not.toHaveBeenCalled();
    expect(timing.endAfterPaint).not.toHaveBeenCalled();
    expect(timing.cancel).toHaveBeenCalledOnce();
    expect(deps.noteLoadEnded).toHaveBeenCalledOnce();
  });
});

describe('useIdentityBootstrapCore: a workbench', () => {
  it('loads through the workbench, its read not an open', async () => {
    const set = makeSet();
    const { deps } = makeDeps({
      loadWorkbench: vi.fn(async (args: { set: S; seed: (...a: never[]) => unknown }) => {
        await (args.seed as (id: string, item: Loaded) => Promise<unknown>)('p1', {
          name: 'Bench',
        });
      }),
    });
    finishLate = true;
    mount(deps, makeOpts(set, { workbench: { itemId: 'd1' } }));
    await settle();
    expect(deps.loadWorkbench).toHaveBeenCalledWith(
      expect.objectContaining({ workbench: { itemId: 'd1' } }),
    );
    expect(set.setName).toHaveBeenCalledWith('Bench');
    expect(ctx!.recordOpen).toBe(false);
    expect(step).toBe('done');
    expect(set.setLoadError).toHaveBeenLastCalledWith(false);
    expect(deps.openOwnAddress).not.toHaveBeenCalled();
  });

  it('keeps the window of a load that ended in time', async () => {
    const set = makeSet();
    const { deps } = makeDeps();
    mount(deps, makeOpts(set, { workbench: { itemId: 'd1' } }));
    await settle();
    expect(set.setLoadError).not.toHaveBeenCalled();
  });

  it('opens by the address in an editor that has no workbench load', async () => {
    const set = makeSet();
    const { deps } = makeDeps({ loadWorkbench: undefined });
    mount(deps, makeOpts(set, { workbench: { itemId: 'd1' } }));
    await settle();
    expect(deps.openOwnAddress).toHaveBeenCalled();
  });
});

describe('useIdentityBootstrapCore: instant open of an item kept Offline', () => {
  it('opens before auth under the placeholder, then settles who is reading once auth answers', async () => {
    const set = makeSet();
    const { deps } = makeDeps({
      isOfflineId: vi.fn(async () => true),
      hasConfirmedName: vi.fn(() => false),
    });
    const { rerender } = mount(deps, makeOpts(set, { authLoaded: false }));
    await settle();
    expect(deps.openOwnAddress).toHaveBeenCalledWith(
      expect.objectContaining({ self: PLACEHOLDER }),
      { id: 'd1', early: true, accountUserId: null },
    );
    expect(deps.trackDailyReturn).not.toHaveBeenCalled();
    expect(deps.resolveParticipant).not.toHaveBeenCalled();
    // A retry while auth is still out runs nothing more.
    rerender(makeOpts(set, { authLoaded: false, passwordRetry: 1 }));
    await settle();
    expect(deps.openOwnAddress).toHaveBeenCalledOnce();
    rerender(makeOpts(set));
    await settle();
    expect(deps.openOwnAddress).toHaveBeenCalledOnce();
    expect(set.setSelfParticipant).toHaveBeenCalledWith({
      ...READER,
      key: 'key-1',
      status: 'online',
    });
    expect(deps.trackDailyReturn).toHaveBeenCalledWith(false);
    expect(set.setIdentityPromptOpen).toHaveBeenCalledWith(true);
    expect(set.setNameConfirmed).toHaveBeenLastCalledWith(false);
  });

  it('asks no name of a signed-in reader or one already named, and warns when the reader cannot be resolved', async () => {
    const set = makeSet();
    const { deps } = makeDeps({ isOfflineId: vi.fn(async () => true) });
    const { rerender } = mount(deps, makeOpts(set, { authLoaded: false }));
    await settle();
    rerender(makeOpts(set, { accountUserId: 'user_1' }));
    await settle();
    expect(set.setIdentityPromptOpen).not.toHaveBeenCalled();
    expect(deps.trackDailyReturn).toHaveBeenCalledWith(true);

    const set2 = makeSet();
    const { deps: deps2 } = makeDeps({ isOfflineId: vi.fn(async () => true) });
    const view = mount(deps2, makeOpts(set2, { authLoaded: false }));
    await settle();
    vi.mocked(deps2.resolveParticipant).mockRejectedValueOnce(new Error('offline'));
    view.rerender(makeOpts(set2));
    await settle();
    expect(console.warn).toHaveBeenCalledWith(
      '[load] resolving the reader failed',
      expect.any(Error),
    );
    view.unmount();

    const set3 = makeSet();
    const { deps: deps3 } = makeDeps({ isOfflineId: vi.fn(async () => true) });
    const named = mount(deps3, makeOpts(set3, { authLoaded: false }));
    await settle();
    named.rerender(makeOpts(set3));
    await settle();
    expect(set3.setIdentityPromptOpen).not.toHaveBeenCalled();
  });

  it('leaves it to the ordinary load when auth answered while the local index loaded', async () => {
    const set = makeSet();
    const offline = deferred<boolean>();
    const { deps } = makeDeps({ isOfflineId: vi.fn(() => offline.promise) });
    const { rerender } = mount(deps, makeOpts(set, { authLoaded: false }));
    rerender(makeOpts(set));
    await settle();
    offline.resolve(true);
    await settle();
    expect(deps.openOwnAddress).toHaveBeenCalledOnce();
    expect(deps.openOwnAddress).toHaveBeenCalledWith(expect.anything(), {
      id: 'd1',
      early: false,
      accountUserId: null,
    });
  });

  it('opens as it always did when the local index cannot answer', async () => {
    const set = makeSet();
    const { deps } = makeDeps({ isOfflineId: vi.fn(async () => Promise.reject(new Error('idb'))) });
    const { rerender } = mount(deps, makeOpts(set, { authLoaded: false }));
    await settle();
    expect(deps.openOwnAddress).not.toHaveBeenCalled();
    rerender(makeOpts(set));
    await settle();
    expect(deps.openOwnAddress).toHaveBeenCalledOnce();
  });

  it.each([
    ['auth already answered', { authLoaded: true }],
    ['hydrated', { hydrated: true, authLoaded: false }],
    ['an embed', { embed: true, authLoaded: false }],
    ['a workbench', { workbench: { itemId: 'd1' }, authLoaded: false }],
  ] as const)('never tries early when %s', async (_n, over) => {
    const set = makeSet();
    const { deps } = makeDeps();
    mount(deps, makeOpts(set, over));
    await settle();
    expect(deps.isOfflineId).not.toHaveBeenCalled();
  });

  it('tries once per mount under StrictMode', async () => {
    const set = makeSet();
    const { deps } = makeDeps();
    mount(deps, makeOpts(set, { authLoaded: false }), true);
    await settle();
    expect(deps.isOfflineId).toHaveBeenCalledOnce();
  });

  it('reads no copy for a share link that names no item kept Offline', async () => {
    window.history.replaceState(null, '', '/doc/d1?s=CODE');
    const set = makeSet();
    const { deps, copies } = makeDeps();
    mount(deps, makeOpts(set, { authLoaded: false }));
    await settle();
    expect(deps.isOfflineId).not.toHaveBeenCalled();
    expect(copies.readVia).toHaveBeenCalledWith('guest_1', 'CODE');
  });
});

describe('useIdentityBootstrapCore: the warm open of a cloud item', () => {
  it("paints a guest's copy read-only before auth, then the catch-up replaces it and is timed", async () => {
    const set = makeSet();
    const { deps, copies, warmTiming } = makeDeps();
    copies.read.mockResolvedValue(copyOf());
    const { rerender } = mount(deps, makeOpts(set, { authLoaded: false }));
    await settle();
    expect(copies.read).toHaveBeenCalledWith('guest_1', 'd1');
    expect(set.setName).toHaveBeenCalledWith('Kept');
    expect(set.setWarmTabId).toHaveBeenCalledWith('t1');
    expect(set.setIsOwner).toHaveBeenCalledWith(true);
    expect(set.setSessionTabScope).toHaveBeenCalledWith(null);
    expect(set.setSessionRole).toHaveBeenCalledWith('view');
    expect(set.setLoadingItem).toHaveBeenCalledWith(false);
    expect(warm.measure).toHaveBeenCalledWith('warm-paint', 100);
    expect(deps.timeWarmPaint).toHaveBeenCalledWith(100);
    expect(warmTiming.endAfterPaint).toHaveBeenCalledOnce();
    // What the seed reads of the paint: its first tab, and the tab the person moved to.
    expect(ctx!.warmFirstTab()).toEqual({ id: 't1', rev: 1, tab: {} });
    rerender(makeOpts(set, { authLoaded: false, activeId: 't2' }));
    expect(ctx!.keepActiveId()).toBe('t2');
    rerender(makeOpts(set, { activeId: 't2' }));
    await settle();
    expect(set.setName).toHaveBeenLastCalledWith('Fetched');
    expect(warm.measure).toHaveBeenCalledWith('warm-catch-up', 100);
  });

  it('times a read from now on a page that has no load start, and paints a copy without a first tab', async () => {
    const set = makeSet();
    const { deps } = makeDeps({ loadOrigin: vi.fn(() => undefined) });
    warm.read = async () => copyOf({ firstTab: null });
    mount(deps, makeOpts(set, { authLoaded: false }));
    await settle();
    expect(set.setWarmTabId).toHaveBeenCalledWith(null);
    expect(deps.timeWarmPaint).toHaveBeenCalledWith(expect.any(Number));
  });

  it('paints nothing without a copy, and nothing more of the catch-up', async () => {
    const set = makeSet();
    const { deps } = makeDeps();
    const { rerender } = mount(deps, makeOpts(set, { authLoaded: false }));
    await settle();
    expect(set.setWarmTabId).not.toHaveBeenCalled();
    expect(ctx).toBeNull();
    rerender(makeOpts(set));
    await settle();
    expect(ctx!.warmFirstTab()).toBeNull();
    expect(ctx!.keepActiveId()).toBeNull();
    expect(warm.measure).not.toHaveBeenCalledWith('warm-catch-up', expect.anything());
  });

  it('paints what the editor adds to a copy, and skips one it does not paint', async () => {
    const set = makeSet();
    const { deps, copies } = makeDeps({
      paintsCopy: (copy) => copy.item.name !== 'Skip',
      onWarmPaint: (s, copy) => {
        s.setWarmExtra(copy.item.name);
      },
    });
    copies.read.mockResolvedValue(copyOf());
    mount(deps, makeOpts(set, { authLoaded: false }));
    await settle();
    expect(set.setWarmExtra).toHaveBeenCalledWith('Kept');

    const set2 = makeSet();
    const { deps: deps2, copies: copies2 } = makeDeps({
      paintsCopy: (copy) => copy.item.name !== 'Skip',
    });
    copies2.read.mockResolvedValue(copyOf({ item: { name: 'Skip', tabs: [{ id: 't1' }] } }));
    mount(deps2, makeOpts(set2, { authLoaded: false }));
    await settle();
    expect(set2.setWarmTabId).not.toHaveBeenCalled();
  });

  it('paints too late for nothing: a load that has begun to show what it fetched wins', async () => {
    const set = makeSet();
    const read = deferred<LastSeenCopy<Item, unknown> | null>();
    const { deps } = makeDeps();
    warm.read = () => read.promise;
    const { rerender } = mount(deps, makeOpts(set, { authLoaded: false }));
    rerender(makeOpts(set));
    await settle();
    read.resolve(copyOf());
    await settle();
    expect(set.setWarmTabId).not.toHaveBeenCalled();
  });

  it("paints no copy of someone else's once the load has resolved the reader", async () => {
    const set = makeSet();
    const read = deferred<LastSeenCopy<Item, unknown> | null>();
    const own = deferred<boolean>();
    const { deps } = makeDeps({ openOwnAddress: vi.fn(() => own.promise) });
    warm.read = () => read.promise;
    const { rerender } = mount(deps, makeOpts(set, { authLoaded: false }));
    rerender(makeOpts(set));
    await settle();
    read.resolve(copyOf({ reader: 'guest_other' }));
    await settle();
    expect(set.setWarmTabId).not.toHaveBeenCalled();
    // The same reader's copy, read late before anything landed, still paints.
    own.resolve(true);
  });

  it('paints a late copy for the reader the load resolved, before it lands', async () => {
    const set = makeSet();
    const read = deferred<LastSeenCopy<Item, unknown> | null>();
    const own = deferred<boolean>();
    const { deps } = makeDeps({ openOwnAddress: vi.fn(() => own.promise) });
    warm.read = () => read.promise;
    const { rerender } = mount(deps, makeOpts(set, { authLoaded: false }));
    rerender(makeOpts(set));
    await settle();
    read.resolve(copyOf());
    await settle();
    expect(set.setWarmTabId).toHaveBeenCalledWith('t1');
    own.resolve(true);
    await settle();
  });

  it("swaps someone else's painted copy for the load, the editor's extra going too", async () => {
    const set = makeSet();
    const { deps, copies } = makeDeps({
      onWarmDropped: (s) => {
        s.setWarmExtra(null);
      },
    });
    copies.read.mockResolvedValue(copyOf({ reader: 'guest_1' }));
    vi.mocked(deps.resolveParticipant).mockResolvedValue({ ...READER, id: 'guest_2' });
    const { rerender } = mount(deps, makeOpts(set, { authLoaded: false }));
    await settle();
    rerender(makeOpts(set));
    await settle();
    expect(set.setWarmTabId).toHaveBeenLastCalledWith(null);
    expect(set.setWarmExtra).toHaveBeenCalledWith(null);
    expect(set.setLoadingItem).toHaveBeenCalledWith(true);
    // The catch-up was not the warm open's.
    expect(warm.measure).not.toHaveBeenCalledWith('warm-catch-up', expect.anything());
  });

  it("swaps someone else's copy in an editor with nothing extra to drop", async () => {
    const set = makeSet();
    const { deps, copies } = makeDeps();
    copies.read.mockResolvedValue(copyOf({ reader: 'guest_1' }));
    vi.mocked(deps.resolveParticipant).mockResolvedValue({ ...READER, id: 'guest_2' });
    const { rerender } = mount(deps, makeOpts(set, { authLoaded: false }));
    await settle();
    rerender(makeOpts(set));
    await settle();
    expect(set.setLoadingItem).toHaveBeenCalledWith(true);
  });

  it('checks a not found after a warm paint by a cold open: the copy goes and the page reloads', async () => {
    const set = makeSet();
    const { deps, copies } = makeDeps({
      openOwnAddress: vi.fn(async (run: { set: S }) => {
        run.set.setItemNotFound(true);
        return false;
      }),
    });
    copies.read.mockResolvedValue(copyOf());
    const { rerender } = mount(deps, makeOpts(set, { authLoaded: false }));
    await settle();
    rerender(makeOpts(set));
    await settle();
    expect(warm.fallback).toHaveBeenCalledWith('not-found', 'd1', expect.anything());
    expect(copies.forget).toHaveBeenCalledWith('guest_1', 'd1');
    expect(set.setItemNotFound).not.toHaveBeenCalled();
  });

  it('shows a not found with no warm paint, and one the session already fell back for', async () => {
    const set = makeSet();
    const { deps } = makeDeps({
      openOwnAddress: vi.fn(async (run: { set: S }) => {
        run.set.setItemNotFound(true);
        return false;
      }),
    });
    mount(deps, makeOpts(set));
    await settle();
    expect(warm.fallback).not.toHaveBeenCalled();
    expect(set.setItemNotFound).toHaveBeenCalledWith(true);

    const set2 = makeSet();
    const { deps: deps2, copies } = makeDeps({
      openOwnAddress: vi.fn(async (run: { set: S }) => {
        run.set.setItemNotFound(true);
        return false;
      }),
    });
    copies.read.mockResolvedValue(copyOf());
    warm.fallback.mockReturnValueOnce(false);
    const view = mount(deps2, makeOpts(set2, { authLoaded: false }));
    await settle();
    view.rerender(makeOpts(set2));
    await settle();
    expect(set2.setItemNotFound).toHaveBeenCalledWith(true);
  });

  it("reads a signed-in hint's copy only once auth names the account", async () => {
    const set = makeSet();
    const { deps, copies } = makeDeps({ readSignedInHint: vi.fn(() => true) });
    copies.read.mockResolvedValue(copyOf({ reader: 'user_1' }));
    const { rerender } = mount(deps, makeOpts(set, { authLoaded: false }));
    await settle();
    expect(copies.read).not.toHaveBeenCalled();
    rerender(makeOpts(set, { authLoaded: false, passwordRetry: 0, activeId: 't1' }));
    rerender(makeOpts(set, { accountUserId: 'user_1' }));
    await settle();
    expect(copies.read).toHaveBeenCalledWith('user_1', 'd1');
    expect(copies.read).toHaveBeenCalledOnce();
  });

  it('reads at once when auth answered while the local index loaded', async () => {
    const set = makeSet();
    const offline = deferred<boolean>();
    const { deps, copies } = makeDeps({
      readSignedInHint: vi.fn(() => true),
      isOfflineId: vi.fn(() => offline.promise),
    });
    const { rerender } = mount(deps, makeOpts(set, { authLoaded: false }));
    rerender(makeOpts(set, { accountUserId: 'user_1' }));
    offline.resolve(false);
    await settle();
    expect(copies.read).toHaveBeenCalledWith('user_1', 'd1');
  });

  it('reads nothing for a session that answered signed out, or for a load already hydrated', async () => {
    const set = makeSet();
    const { deps, copies } = makeDeps({ readSignedInHint: vi.fn(() => true) });
    const { rerender } = mount(deps, makeOpts(set, { authLoaded: false }));
    await settle();
    rerender(makeOpts(set));
    await settle();
    expect(copies.read).not.toHaveBeenCalled();

    const set2 = makeSet();
    const { deps: deps2, copies: copies2 } = makeDeps({ readSignedInHint: vi.fn(() => true) });
    const view = mount(deps2, makeOpts(set2, { authLoaded: false }));
    await settle();
    view.rerender(makeOpts(set2, { accountUserId: 'user_1', hydrated: true }));
    await settle();
    expect(copies2.read).not.toHaveBeenCalled();
  });

  it("logs and opens as always when an account's warm read fails", async () => {
    const set = makeSet();
    const { deps } = makeDeps({
      readSignedInHint: vi.fn(() => true),
      paintsCopy: () => {
        throw new Error('bad copy');
      },
    });
    warm.read = async () => copyOf({ reader: 'user_1' });
    const { rerender } = mount(deps, makeOpts(set, { authLoaded: false }));
    await settle();
    rerender(makeOpts(set, { accountUserId: 'user_1' }));
    await settle();
    expect(set.setWarmTabId).not.toHaveBeenCalled();
    expect(deps.openOwnAddress).toHaveBeenCalledOnce();
  });
});
