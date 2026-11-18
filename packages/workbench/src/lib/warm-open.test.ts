import { afterEach, describe, expect, it, vi } from 'vitest';
import { cpuBudgetMs, cpuMsOfAsync } from '@liveworkspace/vitest-config/cpu-time';
import type { LastSeenCopy } from './api/last-seen-copies';
import {
  expectedReader,
  hashTabId,
  keptWarmTab,
  markLanding,
  measureAfterPaint,
  readWarmCopy,
  browserWarmOpenFallbackDeps,
  guardNotFound,
  warmOpenFallback,
  warmPaintCodeIn,
  WARM_PAINT_CODE_WAIT_MS,
  type WarmOpenCopies,
  type WarmOpenFallbackDeps,
} from './warm-open';

// The warm open (livediagram's docs/specs/006-document/offline-mode.md "Warm open of a cloud document"): the copy is
// read only for the reader this browser expects, only by the way in it was kept under, and only when its first tab is
// the one this open shows first.

type Item = { id: string; tabs: { id: string }[] };

const copy = (over: Partial<LastSeenCopy<Item, unknown>> = {}): LastSeenCopy<Item, unknown> => ({
  reader: 'user_a',
  itemId: 'd1',
  seenAt: 1,
  item: { id: 'd1', tabs: [{ id: 't1' }, { id: 't2' }] },
  firstTab: { id: 't1', rev: 3, tab: { id: 't1', elements: [] } },
  via: null,
  access: { role: 'edit', isOwner: true, sessionShareCode: null, tabScope: null },
  ...over,
});

function copies(held: LastSeenCopy<Item, unknown> | null) {
  return {
    read: vi.fn(async (reader: string, itemId: string) =>
      held && held.reader === reader && held.itemId === itemId ? held : null,
    ),
    readVia: vi.fn(async (reader: string, code: string) =>
      held && held.reader === reader && held.via === code ? held : null,
    ),
  } satisfies WarmOpenCopies<Item>;
}

const own = { itemId: 'd1', shareCode: null, hash: '' };
// Signed in: the account the session's first token answer named (the hint says whether, never who).
const signedIn = { signedIn: true, accountId: 'user_a' } as const;

describe('expectedReader', () => {
  it("expects the guest token's id when the hint says signed out", () => {
    expect(expectedReader({ signedIn: false, guestId: 'guest_1' })).toBe('guest_1');
    expect(expectedReader({ signedIn: false, guestId: null })).toBeNull();
  });

  it('expects the account the session named when signed in, and nobody for none or a guest id', () => {
    expect(expectedReader(signedIn)).toBe('user_a');
    expect(expectedReader({ signedIn: true, accountId: null })).toBeNull();
    expect(expectedReader({ signedIn: true, accountId: 'guest_1' })).toBeNull();
  });
});

describe('readWarmCopy', () => {
  it("reads the signed-in account's copy of the document the address names", async () => {
    const held = copy();
    expect(await readWarmCopy(copies(held), own, signedIn)).toBe(held);
  });

  it("reads a guest's own copy by its token's id", async () => {
    const held = copy({ reader: 'guest_1' });
    expect(await readWarmCopy(copies(held), own, { signedIn: false, guestId: 'guest_1' })).toBe(
      held,
    );
  });

  // Work Tracker 955: the session names the account, so one account never sees another's copy in this profile.
  it("never shows one account's copy to another account", async () => {
    const c = copies(copy());
    expect(await readWarmCopy(c, own, { signedIn: true, accountId: 'user_b' })).toBeNull();
    expect(await readWarmCopy(c, own, { signedIn: true, accountId: null })).toBeNull();
    expect(c.read).not.toHaveBeenCalledWith('user_a', 'd1');
  });

  it("never shows an account's copy to a signed-out browser or another guest", async () => {
    const c = copies(copy());
    expect(await readWarmCopy(c, own, { signedIn: false, guestId: 'guest_1' })).toBeNull();
    expect(await readWarmCopy(c, own, { signedIn: false, guestId: null })).toBeNull();
    expect(c.read).not.toHaveBeenCalledWith('user_a', 'd1');
  });

  it('reads nothing for an address that names no document and carries no link', async () => {
    const c = copies(copy());
    expect(await readWarmCopy(c, { ...own, itemId: null }, signedIn)).toBeNull();
    expect(c.read).not.toHaveBeenCalled();
  });

  // The Share dialog's links are `/<route>/shared?s=<code>`: a Viewer or Participant reloading theirs warm-opens.
  it("reads a share link's own address by the code its copy was kept under", async () => {
    const held = copy({ via: 'CODE', access: { ...copy().access, role: 'view', isOwner: false } });
    const c = copies(held);
    expect(await readWarmCopy(c, { ...own, itemId: null, shareCode: 'CODE' }, signedIn)).toBe(held);
    // A product that reads `shared` as an id finds no copy under it, then reads by the code.
    expect(await readWarmCopy(c, { ...own, itemId: 'shared', shareCode: 'CODE' }, signedIn)).toBe(
      held,
    );
    expect(
      await readWarmCopy(c, { ...own, itemId: null, shareCode: 'OTHER' }, signedIn),
    ).toBeNull();
    // The same reader rules: a signed-out browser never reads an account's copy by its code.
    expect(
      await readWarmCopy(
        c,
        { ...own, itemId: null, shareCode: 'CODE' },
        { signedIn: false, guestId: 'guest_1' },
      ),
    ).toBeNull();
  });

  it('paints a share link only by the share code the copy was kept under', async () => {
    const held = copy({ via: 'CODE', access: { ...copy().access, role: 'view', isOwner: false } });
    const c = copies(held);
    expect(await readWarmCopy(c, { ...own, shareCode: 'CODE' }, signedIn)).toBe(held);
    expect(await readWarmCopy(c, { ...own, shareCode: 'OTHER' }, signedIn)).toBeNull();
    // The document's own address is another way in than the link the copy came by.
    expect(await readWarmCopy(c, own, signedIn)).toBeNull();
    // A link to a document whose copy came by its own address is another way in too.
    expect(await readWarmCopy(copies(copy()), { ...own, shareCode: 'CODE' }, signedIn)).toBeNull();
  });

  it('paints nothing without a first tab, or with one that is not the tab this open shows first', async () => {
    expect(await readWarmCopy(copies(copy({ firstTab: null })), own, signedIn)).toBeNull();
    const moved = copy({ firstTab: { id: 't2', rev: 1, tab: {} } });
    expect(await readWarmCopy(copies(moved), own, signedIn)).toBeNull();
    // A tab-scoped link shows its one tab first.
    const scoped = copy({
      via: 'CODE',
      firstTab: { id: 't2', rev: 1, tab: {} },
      access: { ...copy().access, tabScope: 't2' },
    });
    expect(await readWarmCopy(copies(scoped), { ...own, shareCode: 'CODE' }, signedIn)).toBe(
      scoped,
    );
  });

  it('paints nothing when the address pins another tab of the document', async () => {
    const held = copy();
    const c = copies(held);
    expect(await readWarmCopy(c, { ...own, hash: '#t=t2' }, signedIn)).toBeNull();
    expect(await readWarmCopy(c, { ...own, hash: '#t=t1' }, signedIn)).toBe(held);
    // A pin to a tab the document no longer has opens on the first tab, as the seed does.
    expect(await readWarmCopy(c, { ...own, hash: '#t=gone' }, signedIn)).toBe(held);
  });

  it('answers none when the store fails, never throwing into the open', async () => {
    const broken = {
      read: vi.fn(async () => {
        throw new Error('gone');
      }),
      readVia: vi.fn(async () => null),
    };
    expect(await readWarmCopy(broken, own, signedIn)).toBeNull();
  });

  // The warm paint must not add work to a cold open: with no copy, the check is a store read and nothing else.
  it('adds next to nothing to a cold open (10,000 checks with no copy within budget)', async () => {
    const empty = copies(null);
    const ms = await cpuMsOfAsync(async () => {
      for (let i = 0; i < 10_000; i += 1) await readWarmCopy(empty, own, signedIn);
    });
    expect(ms).toBeLessThan(cpuBudgetMs(150));
  });
});

describe('hashTabId', () => {
  it('reads the tab a fragment pins, as the seed does', () => {
    expect(hashTabId('#t=abc')).toBe('abc');
    expect(hashTabId('#x=1&t=abc&y=2')).toBe('abc');
    expect(hashTabId('')).toBeNull();
  });
});

describe('keptWarmTab', () => {
  it('keeps the painted tab only when the fresh read is the same tab at the same revision', () => {
    const tab = { id: 't1', elements: [] };
    const warm = { id: 't1', rev: 3, tab };
    expect(keptWarmTab(warm, 't1', 3)).toBe(tab);
    expect(keptWarmTab(warm, 't1', 4)).toBeNull();
    expect(keptWarmTab(warm, 't2', 3)).toBeNull();
    expect(keptWarmTab(null, 't1', 3)).toBeNull();
    expect(keptWarmTab(undefined, 't1', 3)).toBeNull();
  });
});

describe('markLanding', () => {
  it('notes the first write to the screen, never a quiet one, and passes every call and value through', () => {
    const onLand = vi.fn();
    const setName = vi.fn((n: string) => n.length);
    const setSelf = vi.fn();
    const set = markLanding({ setName, setSelf, label: 'x' }, onLand, new Set(['setSelf']));
    set.setSelf('me');
    expect(onLand).not.toHaveBeenCalled();
    expect(setSelf).toHaveBeenCalledWith('me');
    expect(set.label).toBe('x');
    expect(onLand).not.toHaveBeenCalled();
    expect(set.setName('Plan')).toBe(4);
    expect(onLand).toHaveBeenCalledOnce();
    expect(setName).toHaveBeenCalledWith('Plan');
  });
});

describe('measureAfterPaint', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
    performance.clearMeasures();
  });

  it('measures from the given start to the next frame on screen', () => {
    vi.useFakeTimers({ toFake: ['setTimeout'] });
    const frames: (() => void)[] = [];
    vi.stubGlobal('requestAnimationFrame', (fn: () => void) => frames.push(fn));
    measureAfterPaint('warm-paint', 0);
    expect(performance.getEntriesByName('warm-paint')).toHaveLength(0);
    frames.shift()!();
    vi.runAllTimers();
    const [entry] = performance.getEntriesByName('warm-paint');
    expect(entry?.startTime).toBe(0);
  });

  it('measures at once from now where there are no frames', () => {
    vi.stubGlobal('requestAnimationFrame', undefined);
    measureAfterPaint('warm-catch-up', undefined);
    expect(performance.getEntriesByName('warm-catch-up')).toHaveLength(1);
  });

  it('never throws, and does nothing without performance measures', () => {
    vi.stubGlobal('requestAnimationFrame', undefined);
    const measure = vi.spyOn(performance, 'measure').mockImplementation(() => {
      throw new Error('bad start');
    });
    expect(() => measureAfterPaint('warm-paint', -5)).not.toThrow();
    measure.mockRestore();
    vi.stubGlobal('performance', undefined);
    expect(() => measureAfterPaint('warm-paint', 0)).not.toThrow();
  });
});

// offline-mode.md "Never a wrong not found".
describe('warmOpenFallback', () => {
  const depsWith = (store: Map<string, string> | null) => {
    const deps = {
      storage: () => {
        if (!store) throw new Error('no session storage');
        return {
          getItem: (k: string) => store.get(k) ?? null,
          setItem: (k: string, v: string) => void store.set(k, v),
        };
      },
      forget: vi.fn(async () => {}),
      reload: vi.fn(),
      warn: vi.fn(),
    } satisfies WarmOpenFallbackDeps;
    return deps;
  };
  const settle = () => new Promise((r) => setTimeout(r, 0));

  it('forgets the copy and reloads, cold, the first time an item ends on not found', async () => {
    const deps = depsWith(new Map());
    expect(warmOpenFallback('not-found', 'doc-1', deps)).toBe(true);
    await settle();
    expect(deps.forget).toHaveBeenCalledOnce();
    expect(deps.reload).toHaveBeenCalledOnce();
    expect(deps.warn).toHaveBeenCalledWith(
      expect.stringContaining('[load] warm-open-fallback not-found'),
    );
  });

  it('lets the second not found in the session show, so a gone item never loops', async () => {
    const store = new Map<string, string>();
    expect(warmOpenFallback('not-found', 'doc-1', depsWith(store))).toBe(true);
    const again = depsWith(store);
    expect(warmOpenFallback('not-found', 'doc-1', again)).toBe(false);
    expect(warmOpenFallback('not-found', 'doc-2', depsWith(store))).toBe(true);
    await settle();
    expect(again.reload).not.toHaveBeenCalled();
  });

  it('shows the not found when there is no session store to guard the reload', () => {
    const deps = depsWith(null);
    expect(warmOpenFallback('not-found', 'doc-1', deps)).toBe(false);
    expect(deps.reload).not.toHaveBeenCalled();
  });

  it('reloads even when the forget fails', async () => {
    const deps = depsWith(new Map());
    deps.forget.mockRejectedValueOnce(new Error('idb'));
    warmOpenFallback('not-found', 'doc-1', deps);
    await settle();
    expect(deps.reload).toHaveBeenCalledOnce();
  });

  it("binds the browser's session store, console and reload", () => {
    const sessionStorage = { getItem: () => null, setItem: () => {} };
    const reload = vi.fn();
    vi.stubGlobal('window', { sessionStorage, location: { reload } });
    try {
      const forget = vi.fn(async () => {});
      const deps = browserWarmOpenFallbackDeps(forget);
      expect(deps.storage()).toBe(sessionStorage);
      expect(deps.forget).toBe(forget);
      deps.reload();
      expect(reload).toHaveBeenCalledOnce();
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      deps.warn('line');
      expect(warn).toHaveBeenCalledWith('line');
      warn.mockRestore();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe('guardNotFound', () => {
  it('checks a not found first, and passes everything else straight through', () => {
    const setNotFound = vi.fn();
    const setName = vi.fn();
    let takeOver = true;
    const set = guardNotFound({ setNotFound, setName, count: 1 }, 'setNotFound', () => takeOver);
    set.setNotFound(true);
    expect(setNotFound).not.toHaveBeenCalled();
    set.setNotFound(false);
    expect(setNotFound).toHaveBeenCalledWith(false);
    takeOver = false;
    set.setNotFound(true);
    expect(setNotFound).toHaveBeenLastCalledWith(true);
    set.setName('x');
    expect(setName).toHaveBeenCalledWith('x');
    expect(set.count).toBe(1);
  });
});

// offline-mode.md "The code it draws is in first": the warm paint waits for its panels' code, never past the cap.
describe('warmPaintCodeIn', () => {
  afterEach(() => vi.useRealTimers());

  it('answers once every preload has, failed ones included', async () => {
    let finish: () => void = () => {};
    const slow = vi.fn(() => new Promise<void>((r) => (finish = r)));
    const failing = vi.fn(() => Promise.reject(new Error('offline')));
    const throwing = vi.fn((): Promise<void> => {
      throw new Error('sync');
    });
    let done = false;
    const wait = warmPaintCodeIn([slow, failing, throwing], 10_000).then(() => (done = true));
    await new Promise((r) => setTimeout(r, 0));
    expect(slow).toHaveBeenCalledOnce();
    expect(failing).toHaveBeenCalledOnce();
    expect(throwing).toHaveBeenCalledOnce();
    expect(done).toBe(false);
    finish();
    await wait;
    expect(done).toBe(true);
  });

  it('stops waiting at the cap, and clears its timer when the code is in first', async () => {
    vi.useFakeTimers();
    const wait = warmPaintCodeIn([() => new Promise(() => {})]);
    await vi.advanceTimersByTimeAsync(WARM_PAINT_CODE_WAIT_MS - 1);
    let done = false;
    void wait.then(() => (done = true));
    await vi.advanceTimersByTimeAsync(0);
    expect(done).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(done).toBe(true);
    await warmPaintCodeIn([async () => {}]);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('waits on nothing when there is no code to wait for', async () => {
    vi.useFakeTimers();
    await warmPaintCodeIn([]);
    expect(vi.getTimerCount()).toBe(0);
  });
});
