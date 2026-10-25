// This Browser in the Inbox (liveworkspace/docs/one-explorer.md "The Explorer on each app's address"): the Inbox's
// rows from an app's offline items (actions, cards and threads the index never holds), for the Explorer page on the
// app's own address. Only the app's code can read its offline store and work the rows out; the page is liveworkspace's
// build. So the app keeps one snapshot of them in localStorage under `liveworkspace:this-browser-inbox:<app>`, beside
// the This Browser list (this-browser.ts), and the page, on the same origin, reads it and hears each change.
// liveworkspace.app, on its own origin, can't read it.
//
// The snapshot names whose rows they are (the account id the app read them for, and this browser's guest id); a
// reader is handed them only when it is one of those, so another account signed in to the same browser never sees
// them. Bounded: the newest INBOX_SNAPSHOT_MAX actions and threads, long text cut short.
//
// Plain TypeScript, no React: the apps' offline stores import it.

import type { App, InboxAction, InboxThread } from '@liveworkspace/index-client';
import type { InboxLocalRows } from './types';

/** Each list is cut at this many, newest first: the apps' own Inbox reads cap each of their lists at 100 too. */
export const INBOX_SNAPSHOT_MAX = 100;
// A row's note and a thread's latest comment are a line in the Inbox; nothing longer is kept.
const TEXT_MAX = 280;
const VERSION = 1;

export const inboxSnapshotKey = (app: App) => `liveworkspace:this-browser-inbox:${app}`;

// The same tab's writes: a `storage` event only reaches other tabs.
const SAME_TAB_EVENT = 'liveworkspace:this-browser-inbox';

export type InboxSnapshot = {
  /** Whose rows these are: the first is the id the rows name as "me" (assignee, assigner). */
  ownerIds: string[];
  rows: InboxLocalRows;
  at: number;
};

type Stored = InboxSnapshot & { v: number };

const NONE: InboxLocalRows = { actions: [], threads: [] };

function storage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

const cut = (text: string) => (text.length > TEXT_MAX ? `${text.slice(0, TEXT_MAX - 1)}…` : text);

function bounded(rows: InboxLocalRows): InboxLocalRows {
  return {
    actions: [...rows.actions]
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, INBOX_SNAPSHOT_MAX)
      .map((a): InboxAction => ({ ...a, description: cut(a.description ?? '') })),
    threads: [...rows.threads]
      .sort((a, b) => b.latestAt - a.latestAt)
      .slice(0, INBOX_SNAPSHOT_MAX)
      .map((t): InboxThread => ({ ...t, latestText: cut(t.latestText ?? '') })),
  };
}

function notify(app: App) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(SAME_TAB_EVENT, { detail: app }));
  }
}

/** The snapshot as the app last wrote it, or null. */
export function readInboxSnapshot(
  app: App,
  store: Storage | null = storage(),
): InboxSnapshot | null {
  let raw: string | null = null;
  try {
    raw = store?.getItem(inboxSnapshotKey(app)) ?? null;
  } catch {
    return null;
  }
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<Stored>;
    if (
      parsed.v !== VERSION ||
      !Array.isArray(parsed.ownerIds) ||
      !parsed.rows ||
      !Array.isArray(parsed.rows.actions) ||
      !Array.isArray(parsed.rows.threads)
    ) {
      return null;
    }
    return {
      ownerIds: parsed.ownerIds.filter((id): id is string => typeof id === 'string' && !!id),
      rows: { actions: parsed.rows.actions, threads: parsed.rows.threads },
      at: typeof parsed.at === 'number' ? parsed.at : 0,
    };
  } catch {
    return null;
  }
}

/** Replaces the snapshot. A write that changes nothing but its time is skipped, and wakes no reader. */
export function writeInboxSnapshot(
  app: App,
  ownerIds: readonly string[],
  rows: InboxLocalRows,
  store: Storage | null = storage(),
  now: number = Date.now(),
): void {
  const owners = [...new Set(ownerIds.filter(Boolean))];
  if (!store || owners.length === 0) return;
  const kept = bounded(rows);
  const body = JSON.stringify({ v: VERSION, ownerIds: owners, rows: kept });
  try {
    const before = readInboxSnapshot(app, store);
    if (
      before &&
      JSON.stringify({ v: VERSION, ownerIds: before.ownerIds, rows: before.rows }) === body
    ) {
      return;
    }
    store.setItem(
      inboxSnapshotKey(app),
      JSON.stringify({ v: VERSION, ownerIds: owners, rows: kept, at: now } satisfies Stored),
    );
  } catch {
    // Storage full or blocked: the page goes without these rows; the editor's panel still lists them.
    return;
  }
  notify(app);
}

/** No snapshot: the app holds no offline items, or nothing it read is for anyone. */
export function dropInboxSnapshot(app: App, store: Storage | null = storage()): void {
  try {
    if (!store || store.getItem(inboxSnapshotKey(app)) === null) return;
    store.removeItem(inboxSnapshotKey(app));
  } catch {
    return;
  }
  notify(app);
}

/** The snapshot's rows for this reader: none unless it names them, and "me" in the rows made theirs. */
export function inboxSnapshotRows(
  app: App,
  viewerId: string | null,
  store: Storage | null = storage(),
): InboxLocalRows {
  if (!viewerId) return NONE;
  const snapshot = readInboxSnapshot(app, store);
  if (!snapshot || !snapshot.ownerIds.includes(viewerId)) return NONE;
  const me = snapshot.ownerIds[0];
  if (me === viewerId) return snapshot.rows;
  // Read for the account, viewed as this browser's guest (or the other way round): the rows' "me" is the viewer.
  const mine = (id: string | null) => (id === me ? viewerId : id);
  return {
    actions: snapshot.rows.actions.map((a) => ({
      ...a,
      assigneeId: mine(a.assigneeId),
      assignerId: mine(a.assignerId) ?? a.assignerId,
    })),
    threads: snapshot.rows.threads,
  };
}

/** Calls `onChange` when the app's snapshot changes, in this tab or another. */
export function subscribeInboxSnapshot(app: App, onChange: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const key = inboxSnapshotKey(app);
  const onStorage = (e: StorageEvent) => {
    if (e.key === key || e.key === null) onChange();
  };
  const onSameTab = (e: Event) => {
    if ((e as CustomEvent<App>).detail === app) onChange();
  };
  window.addEventListener('storage', onStorage);
  window.addEventListener(SAME_TAB_EVENT, onSameTab);
  return () => {
    window.removeEventListener('storage', onStorage);
    window.removeEventListener(SAME_TAB_EVENT, onSameTab);
  };
}

// ---------- An app, keeping its snapshot -----------------------------------------------------------------------------

export type InboxSnapshotKeeperOptions = {
  app: App;
  /** The app's own read, for the person the page names (`account`, null for a guest): whose rows they are (the
   *  first standing for "me", usually with this browser's guest id after it) and its offline items' Inbox rows for
   *  them; null when there is no one to read for. Loads what it needs on first use, off the store's own graph. */
  compute: (account: string | null) => Promise<InboxSnapshotRead | null>;
  /** Whether the app has offline items at all (its This Browser list): none drops the snapshot without a read. */
  hasItems: () => boolean;
  /** How long the offline store stays quiet before the rows are worked out again. */
  delayMs?: number;
};

export type InboxSnapshotRead = { ownerIds: string[]; rows: InboxLocalRows };

export const INBOX_SNAPSHOT_DELAY_MS = 1500;

/** What an app calls to keep its snapshot: `setAccount` once the page knows who is signed in (null for a guest),
 *  `schedule` after each offline write (debounced: one read once the store has been quiet for `delayMs`), and
 *  `publish` with rows it has just read anyway (the panel's Inbox). Nothing is read until the account is known, and
 *  one read at a time: a write during one reads again once it ends. */
export function inboxSnapshotKeeper(options: InboxSnapshotKeeperOptions) {
  const { app, compute, hasItems } = options;
  const delay = options.delayMs ?? INBOX_SNAPSHOT_DELAY_MS;
  // undefined: the page hasn't said yet.
  let account: string | null | undefined;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let running: Promise<void> | null = null;
  let again = false;

  const read = async (who: string | null): Promise<void> => {
    try {
      const got = await compute(who);
      if (got) writeInboxSnapshot(app, got.ownerIds, got.rows);
    } catch (e) {
      console.warn('[explorer] inbox-snapshot-failed', e);
    }
  };

  const run = async (): Promise<void> => {
    timer = null;
    if (running) {
      again = true;
      return running;
    }
    if (!hasItems()) {
      dropInboxSnapshot(app);
      return;
    }
    if (account === undefined) return;
    running = read(account);
    await running;
    running = null;
    if (again) {
      again = false;
      schedule();
    }
  };

  function schedule(): void {
    if (typeof window === 'undefined') return;
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(() => void run(), delay);
  }

  return {
    schedule,
    setAccount(id: string | null): void {
      if (id === account) return;
      account = id;
      schedule();
    },
    publish(ownerIds: readonly (string | null)[], rows: InboxLocalRows): void {
      writeInboxSnapshot(
        app,
        ownerIds.filter((id): id is string => !!id),
        rows,
      );
    },
    /** Runs a pending read now (tests, and a page about to leave). */
    async flush(): Promise<void> {
      if (running) await running;
      if (timer === null) return;
      clearTimeout(timer);
      await run();
    },
  };
}
