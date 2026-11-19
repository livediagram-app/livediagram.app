// The Inbox watch (watch.ts, inbox-notices.md "How the editor hears"): one read per browser and address at most every
// 30 seconds, shared over the channel; none hidden or idle; coming back; and the hour's budget across tabs.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { InboxResponse } from '@liveworkspace/index-client';
import {
  INBOX_WATCH_IDLE_MS,
  INBOX_WATCH_POLL_MS,
  INBOX_WATCH_RETURN_MS,
  createInboxWatch,
  inboxSignature,
  inboxWatchFor,
  type WatchChannel,
} from './watch';

const EMPTY: InboxResponse = { threads: [], actions: [], forms: [] };

// A browser: one shared storage and channel bus; each tab its own document and window.
function browser() {
  const store = new Map<string, string>();
  const storage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
  };
  const channels = new Set<{ listeners: Set<(e: { data: unknown }) => void> }>();
  let reads = 0;
  const tab = (answer: () => InboxResponse = () => EMPTY) => {
    const doc = new EventTarget() as EventTarget & { visibilityState: DocumentVisibilityState };
    doc.visibilityState = 'visible';
    const win = new EventTarget();
    const read = vi.fn(() => {
      reads++;
      return Promise.resolve(answer());
    });
    const watch = createInboxWatch({
      read,
      storage,
      now: () => Date.now(),
      doc: doc as unknown as Document,
      win: win as unknown as Window,
      channel: () => {
        const me = { listeners: new Set<(e: { data: unknown }) => void>() };
        channels.add(me);
        const ch: WatchChannel = {
          postMessage: (data) => {
            for (const other of channels)
              if (other !== me) for (const l of other.listeners) l({ data });
          },
          addEventListener: (_t, l) => void me.listeners.add(l),
          removeEventListener: (_t, l) => void me.listeners.delete(l),
          close: () => void channels.delete(me),
        };
        return ch;
      },
    });
    const hide = () => {
      doc.visibilityState = 'hidden';
      doc.dispatchEvent(new Event('visibilitychange'));
    };
    const show = () => {
      doc.visibilityState = 'visible';
      doc.dispatchEvent(new Event('visibilitychange'));
    };
    const press = () => win.dispatchEvent(new Event('pointerdown'));
    const focus = () => win.dispatchEvent(new Event('focus'));
    return { watch, read, hide, show, press, focus };
  };
  return { tab, reads: () => reads, channels, store };
}

const settle = async () => {
  for (let i = 0; i < 5; i++) await Promise.resolve();
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(1_000_000);
});
afterEach(() => {
  vi.useRealTimers();
});

describe('reading', () => {
  it('reads at once for an eager listener, then every turn, and gives each answer', async () => {
    const b = browser();
    const t = b.tab(() => ({ ...EMPTY }));
    const heard = vi.fn();
    const stop = t.watch.subscribe(heard, { readNow: true });
    await settle();
    expect(t.read).toHaveBeenCalledTimes(1);
    expect(heard).toHaveBeenCalledTimes(1);
    expect(t.watch.current().at).toBe(1_000_000);
    await vi.advanceTimersByTimeAsync(INBOX_WATCH_POLL_MS - 1);
    expect(t.read).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(t.read).toHaveBeenCalledTimes(2);
    stop();
    await vi.advanceTimersByTimeAsync(INBOX_WATCH_POLL_MS * 3);
    expect(t.read).toHaveBeenCalledTimes(2);
  });

  it('waits a turn for a passive listener, whose own read counts as the last', async () => {
    const b = browser();
    const t = b.tab();
    const stop = t.watch.subscribe(() => {});
    await vi.advanceTimersByTimeAsync(INBOX_WATCH_POLL_MS - 1);
    expect(t.read).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(t.read).toHaveBeenCalledTimes(1);
    // The list reading for itself moves the next turn on.
    await vi.advanceTimersByTimeAsync(10_000);
    t.watch.touch();
    await vi.advanceTimersByTimeAsync(INBOX_WATCH_POLL_MS - 1);
    expect(t.read).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(t.read).toHaveBeenCalledTimes(2);
    stop();
  });

  it('keeps what it had when a read fails, and tries again next turn', async () => {
    const b = browser();
    let fail = false;
    const t = b.tab(() => {
      if (fail) throw new Error('down');
      return EMPTY;
    });
    const stop = t.watch.subscribe(() => {}, { readNow: true });
    await settle();
    const first = t.watch.current();
    fail = true;
    await vi.advanceTimersByTimeAsync(INBOX_WATCH_POLL_MS);
    expect(t.read).toHaveBeenCalledTimes(2);
    expect(t.watch.current()).toBe(first);
    fail = false;
    await vi.advanceTimersByTimeAsync(INBOX_WATCH_POLL_MS);
    expect(t.read).toHaveBeenCalledTimes(3);
    stop();
  });

  it('drops a read still out when stopped', async () => {
    const b = browser();
    let resolve: (v: InboxResponse) => void = () => {};
    const doc = { visibilityState: 'visible', addEventListener() {}, removeEventListener() {} };
    const read = vi.fn(
      (signal: AbortSignal) =>
        new Promise<InboxResponse>((ok, no) => {
          resolve = ok;
          signal.addEventListener('abort', () => no(new DOMException('gone', 'AbortError')));
        }),
    );
    const watch = createInboxWatch({
      read,
      storage: null,
      channel: () => null,
      doc: doc as never,
      win: doc as never,
    });
    const heard = vi.fn();
    const stop = watch.subscribe(heard, { readNow: true });
    stop();
    resolve(EMPTY);
    await settle();
    expect(heard).not.toHaveBeenCalled();
    expect(watch.current().data).toBeNull();
    expect(b.reads()).toBe(0);
  });
});

describe('one reader per browser', () => {
  it('shares one read across tabs: the others hear it and skip their turn', async () => {
    const b = browser();
    const a = b.tab();
    const c = b.tab();
    const heardA = vi.fn();
    const heardC = vi.fn();
    const stopA = a.watch.subscribe(heardA, { readNow: true });
    await settle();
    const stopC = c.watch.subscribe(heardC);
    await vi.advanceTimersByTimeAsync(INBOX_WATCH_POLL_MS);
    // One of the two read on the turn; the other heard it.
    expect(b.reads()).toBe(2);
    expect(heardA).toHaveBeenCalledTimes(2);
    expect(heardC).toHaveBeenCalledTimes(1);
    expect(c.watch.current().at).toBe(a.watch.current().at);
    stopA();
    stopC();
  });

  it('ignores an older answer and anything that is not one', async () => {
    const b = browser();
    const a = b.tab();
    const stop = a.watch.subscribe(() => {}, { readNow: true });
    await settle();
    const at = a.watch.current().at;
    for (const ch of b.channels) {
      for (const l of ch.listeners) {
        l({ data: { type: 'answer', at: at - 1, data: { ...EMPTY, forms: [] } } });
        l({ data: { type: 'other' } });
        l({ data: null });
      }
    }
    expect(a.watch.current().at).toBe(at);
    stop();
  });

  it('keeps an hour within budget: three tabs in use read at most once a turn', async () => {
    const b = browser();
    const tabs = [b.tab(), b.tab(), b.tab()];
    const stops = tabs.map((t) => t.watch.subscribe(() => {}, { readNow: true }));
    await settle();
    const opened = b.reads();
    expect(opened).toBe(3);
    for (let m = 0; m < 60; m++) {
      tabs[m % 3]!.press();
      await vi.advanceTimersByTimeAsync(60_000);
    }
    // One read a turn for the browser, however many tabs: 120 in the hour, besides each tab's first.
    expect(b.reads() - opened).toBeLessThanOrEqual(3600_000 / INBOX_WATCH_POLL_MS + 1);
    for (const stop of stops) stop();
  });
});

describe('only while someone is there', () => {
  it('reads nothing while hidden, and at once on coming back when stale', async () => {
    const b = browser();
    const t = b.tab();
    const stop = t.watch.subscribe(() => {}, { readNow: true });
    await settle();
    t.hide();
    await vi.advanceTimersByTimeAsync(60 * 60_000);
    expect(t.read).toHaveBeenCalledTimes(1);
    t.show();
    await settle();
    expect(t.read).toHaveBeenCalledTimes(2);
    // Focus a moment later: the last read is fresh, so it waits for its turn.
    t.focus();
    await vi.advanceTimersByTimeAsync(INBOX_WATCH_RETURN_MS);
    expect(t.read).toHaveBeenCalledTimes(2);
    stop();
  });

  it('a passive page coming back waits at least the return gap', async () => {
    const b = browser();
    const t = b.tab();
    const stop = t.watch.subscribe(() => {});
    t.hide();
    await vi.advanceTimersByTimeAsync(5 * 60_000);
    t.show();
    await vi.advanceTimersByTimeAsync(INBOX_WATCH_RETURN_MS - 1);
    expect(t.read).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(t.read).toHaveBeenCalledTimes(1);
    stop();
  });

  it('pauses after ten quiet minutes, and reads on the next press', async () => {
    const b = browser();
    const t = b.tab();
    const stop = t.watch.subscribe(() => {}, { readNow: true });
    await settle();
    await vi.advanceTimersByTimeAsync(60 * 60_000);
    const quiet = t.read.mock.calls.length;
    // Its first read and the turns inside its first ten minutes, then nothing.
    expect(quiet).toBe(INBOX_WATCH_IDLE_MS / INBOX_WATCH_POLL_MS);
    t.press();
    await settle();
    expect(t.read).toHaveBeenCalledTimes(quiet + 1);
    // A press while in use changes nothing.
    t.press();
    await settle();
    expect(t.read).toHaveBeenCalledTimes(quiet + 1);
    stop();
  });

  it('keeps its own time when storage refuses writes', async () => {
    const doc = Object.assign(new EventTarget(), { visibilityState: 'visible' });
    const win = new EventTarget();
    const read = vi.fn(() => Promise.resolve(EMPTY));
    const watch = createInboxWatch({
      read,
      storage: {
        getItem: () => {
          throw new Error('denied');
        },
        setItem: () => {
          throw new Error('denied');
        },
      },
      channel: () => null,
      doc: doc as never,
      win: win as never,
    });
    const stop = watch.subscribe(() => {}, { readNow: true });
    await settle();
    await vi.advanceTimersByTimeAsync(INBOX_WATCH_POLL_MS - 1);
    expect(read).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(read).toHaveBeenCalledTimes(2);
    stop();
  });
});

describe('the page watch and the signature', () => {
  it('is one watch per client', () => {
    const client = { inbox: vi.fn(() => Promise.resolve(EMPTY)) } as never;
    expect(inboxWatchFor(client)).toBe(inboxWatchFor(client));
  });

  it('reads the client with no app', async () => {
    const inbox = vi.fn(() => Promise.resolve(EMPTY));
    const watch = inboxWatchFor({ inbox } as never);
    const stop = watch.subscribe(() => {}, { readNow: true });
    await settle();
    expect(inbox).toHaveBeenCalledWith({}, { signal: expect.any(AbortSignal) });
    stop();
  });

  it('says two reads list the same rows, and narrows to an app', () => {
    const thread = {
      app: 'livediagram',
      itemId: 'i',
      tabId: 't',
      elementId: 'e',
      latestAt: 5,
    } as InboxResponse['threads'][number];
    const action = {
      app: 'liveplanner',
      itemId: 'p',
      actionId: 'a',
      updatedAt: 6,
      status: 'open',
    } as InboxResponse['actions'][number];
    const data: InboxResponse = {
      threads: [thread],
      actions: [action],
      forms: [{ app: 'liveplanner', itemId: 'p', tabId: 'f', latestAt: 1, unseen: 2 } as never],
      accessRequests: [{ id: 'r', app: 'livediagram', askedAt: 3 } as never],
      shares: [{ id: 's', app: 'livediagram', sharedAt: 4 } as never],
    };
    expect(inboxSignature(data)).toBe(inboxSignature({ ...data }));
    expect(inboxSignature(data)).not.toBe(
      inboxSignature({ ...data, threads: [{ ...thread, latestAt: 7 }] }),
    );
    expect(inboxSignature(data, 'liveplanner')).toBe(
      inboxSignature({ ...data, threads: [], accessRequests: [], shares: [] }, 'liveplanner'),
    );
  });
});
