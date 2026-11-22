// The Inbox, watched (liveworkspace/docs/specs/004-index/inbox-notices.md "How the editor hears"): one read of
// GET /inbox per browser and address at most every 30 seconds, while someone is there, its answer shared with every
// tab of the address. The editor's notices and the Explorer's Inbox list both listen to it.
//
// Coordination between tabs: the time of the last read, any tab's, is kept in localStorage, and a tab reads only when
// that time is a turn old; its answer goes to the other tabs on a BroadcastChannel. A tab reads only while visible and
// used (a key or pointer press in the last 10 minutes), so a browser left open overnight soon reads nothing.

import type { InboxResponse, IndexClient } from '@liveworkspace/index-client';
import { actionKey, suggestionKey, threadKey } from '../explorer/inbox/sections';

/** A turn: the most often one browser reads the Inbox for one address. */
export const INBOX_WATCH_POLL_MS = 30_000;
/** Coming back to the tab reads at once when the last read is older than this. */
export const INBOX_WATCH_RETURN_MS = 15_000;
/** No key or pointer press for this long: reads pause until the next one. */
export const INBOX_WATCH_IDLE_MS = 10 * 60_000;
/** A turn this close to its time counts as due (timers fire a little early or late). */
const TURN_SLACK_MS = 1_000;

export const INBOX_WATCH_READ_AT_KEY = 'liveworkspace:inbox-watch:read-at';
export const INBOX_WATCH_CHANNEL = 'liveworkspace:inbox-watch';

type Message = { type: 'answer'; at: number; data: InboxResponse };

/** What a channel needs to be: a BroadcastChannel, or a test's stand-in. */
export type WatchChannel = {
  postMessage: (message: Message) => void;
  addEventListener: (type: 'message', listener: (e: { data: unknown }) => void) => void;
  removeEventListener: (type: 'message', listener: (e: { data: unknown }) => void) => void;
  close: () => void;
};

export type InboxWatchDeps = {
  read: (signal: AbortSignal) => Promise<InboxResponse>;
  storage?: Pick<Storage, 'getItem' | 'setItem'> | null;
  channel?: () => WatchChannel | null;
  now?: () => number;
  doc?: Pick<Document, 'visibilityState' | 'addEventListener' | 'removeEventListener'>;
  win?: Pick<Window, 'addEventListener' | 'removeEventListener'>;
};

export type InboxWatchState = { data: InboxResponse | null; at: number };

export type InboxWatch = {
  current: () => InboxWatchState;
  /** A listener read the Inbox itself just now (the Explorer's list): this page's next read waits a turn from it. */
  touch: () => void;
  /** Listens; the first listener starts the watch, the last one gone stops it. `readNow` (the editor's notices): read
   *  at once when nothing has been read on this page yet, and again on coming back to the tab when the last read is
   *  stale. Without it (the Explorer's Inbox list, which reads for itself on mount and on coming back) the listener
   *  only hears, and the watch's own reads keep their turns. */
  subscribe: (listener: () => void, options?: { readNow?: boolean }) => () => void;
};

const isAnswer = (value: unknown): value is Message => {
  const v = value as Partial<Message> | null;
  return Boolean(v && v.type === 'answer' && typeof v.at === 'number' && v.data);
};

function defaultStorage(): Pick<Storage, 'getItem' | 'setItem'> | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

function defaultChannel(): WatchChannel | null {
  if (typeof BroadcastChannel === 'undefined') return null;
  try {
    return new BroadcastChannel(INBOX_WATCH_CHANNEL) as unknown as WatchChannel;
  } catch {
    return null;
  }
}

export function createInboxWatch(deps: InboxWatchDeps): InboxWatch {
  const now = deps.now ?? Date.now;
  const storage = deps.storage === undefined ? defaultStorage() : deps.storage;
  const openChannel = deps.channel ?? defaultChannel;
  let state: InboxWatchState = { data: null, at: 0 };
  const listeners = new Set<() => void>();
  let timer: ReturnType<typeof setTimeout> | null = null;
  let inFlight: AbortController | null = null;
  let channel: WatchChannel | null = null;
  let usedAt = 0;
  // This page's own last read, for a browser whose storage refuses writes.
  let ownReadAt = 0;
  let running = false;
  // Listeners that asked for `readNow`.
  let eager = 0;

  const doc = () => deps.doc ?? (typeof document === 'undefined' ? null : document);
  const win = () => deps.win ?? (typeof window === 'undefined' ? null : window);
  const visible = () => doc()?.visibilityState !== 'hidden';
  const used = () => now() - usedAt < INBOX_WATCH_IDLE_MS;
  const lastRead = () => {
    let stored = 0;
    try {
      stored = Number(storage?.getItem(INBOX_WATCH_READ_AT_KEY)) || 0;
    } catch {
      stored = 0;
    }
    return Math.max(stored, ownReadAt);
  };
  const stamp = (t: number) => {
    ownReadAt = t;
    try {
      storage?.setItem(INBOX_WATCH_READ_AT_KEY, String(t));
    } catch {
      // Private mode or a full store: this page keeps its own time.
    }
  };
  const give = () => {
    for (const l of listeners) l();
  };
  const clear = () => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
  };
  // The next turn, a turn after the last read (any tab's), and no sooner than `atLeast`; none while hidden, idle or
  // stopped.
  const schedule = (atLeast = 0) => {
    clear();
    if (!running || !visible() || !used()) return;
    const due = lastRead() + INBOX_WATCH_POLL_MS - now();
    timer = setTimeout(turn, Math.max(atLeast, due, 0));
  };
  const turn = () => {
    timer = null;
    if (!running || !visible() || !used()) return;
    if (now() - lastRead() < INBOX_WATCH_POLL_MS - TURN_SLACK_MS) return schedule();
    read();
  };
  const take = (data: InboxResponse, at: number) => {
    if (at < state.at) return;
    state = { data, at };
    give();
  };
  const read = () => {
    if (inFlight) return;
    const at = now();
    stamp(at);
    const controller = new AbortController();
    inFlight = controller;
    let answer: Promise<InboxResponse>;
    try {
      answer = deps.read(controller.signal);
    } catch (e) {
      answer = Promise.reject(e);
    }
    answer.then(
      (data) => {
        if (controller.signal.aborted) return;
        inFlight = null;
        take(data, at);
        try {
          channel?.postMessage({ type: 'answer', at, data });
        } catch {
          // A channel closed under us: the other tabs read on their own turns.
        }
        schedule();
      },
      () => {
        if (controller.signal.aborted) return;
        // A failed read keeps what was there; the next turn tries again.
        inFlight = null;
        schedule();
      },
    );
  };
  // Back in view, focused, or pressed after a pause: an eager listener's page reads at once when the last read is
  // stale, else waits a turn. A page of passive listeners only (the Explorer, which reads for itself on coming back)
  // takes its turn no sooner than INBOX_WATCH_RETURN_MS on.
  const comeBack = () => {
    if (!running) return;
    if (!visible()) return clear();
    if (eager > 0 && now() - lastRead() >= INBOX_WATCH_RETURN_MS) read();
    else if (!inFlight) schedule(eager > 0 ? 0 : INBOX_WATCH_RETURN_MS);
  };
  const onPress = () => {
    const idle = !used();
    usedAt = now();
    if (idle) comeBack();
  };
  const onMessage = (e: { data: unknown }) => {
    if (!isAnswer(e.data)) return;
    take(e.data.data, e.data.at);
    if (!inFlight) schedule();
  };

  const start = () => {
    running = true;
    usedAt = now();
    doc()?.addEventListener('visibilitychange', comeBack);
    const w = win();
    w?.addEventListener('focus', comeBack);
    w?.addEventListener('pointerdown', onPress, { passive: true, capture: true });
    w?.addEventListener('keydown', onPress, { passive: true, capture: true });
    channel = openChannel();
    channel?.addEventListener('message', onMessage);
  };
  const stop = () => {
    running = false;
    clear();
    inFlight?.abort();
    inFlight = null;
    doc()?.removeEventListener('visibilitychange', comeBack);
    const w = win();
    w?.removeEventListener('focus', comeBack);
    w?.removeEventListener('pointerdown', onPress, { capture: true });
    w?.removeEventListener('keydown', onPress, { capture: true });
    channel?.removeEventListener('message', onMessage);
    channel?.close();
    channel = null;
  };

  return {
    current: () => state,
    touch() {
      ownReadAt = Math.max(ownReadAt, now());
      if (running && !inFlight) schedule();
    },
    subscribe(listener, options) {
      const wantsRead = options?.readNow === true;
      listeners.add(listener);
      if (wantsRead) eager++;
      // A listener that read the Inbox itself just now: its read counts as this page's last.
      else if (ownReadAt === 0) ownReadAt = now();
      if (!running) start();
      if (wantsRead && state.data === null) read();
      else if (!inFlight && timer === null) schedule();
      return () => {
        listeners.delete(listener);
        if (wantsRead) eager--;
        if (listeners.size === 0) stop();
      };
    },
  };
}

const watches = new WeakMap<IndexClient, InboxWatch>();

/** The page's watch over this client's Inbox: one per client, shared by every listener on the page. */
export function inboxWatchFor(client: IndexClient): InboxWatch {
  let watch = watches.get(client);
  if (!watch) {
    watch = createInboxWatch({ read: (signal) => client.inbox({}, { signal }) });
    watches.set(client, watch);
  }
  return watch;
}

/** The rows an answer lists, each by key and time: two answers with one signature list the same Inbox. With `app`,
 *  that app's rows alone (the Explorer's This App filter). */
export function inboxSignature(data: InboxResponse, app: string | null = null): string {
  const mine = <T extends { app: string }>(rows: readonly T[] | undefined) =>
    (rows ?? []).filter((r) => app === null || r.app === app);
  const parts: string[] = [];
  for (const t of mine(data.threads)) parts.push(`${threadKey(t)}@${t.latestAt}`);
  for (const a of mine(data.actions)) parts.push(`${actionKey(a)}@${a.updatedAt}:${a.status}`);
  for (const f of mine(data.forms))
    parts.push(`f:${f.itemId}:${f.tabId}@${f.latestAt}:${f.unseen}`);
  for (const r of mine(data.accessRequests)) parts.push(`r:${r.id}@${r.askedAt}`);
  for (const s of mine(data.shares)) parts.push(`s:${s.id}@${s.sharedAt}`);
  for (const g of mine(data.suggestions)) parts.push(`${suggestionKey(g)}@${g.createdAt}`);
  return parts.sort().join('|');
}
