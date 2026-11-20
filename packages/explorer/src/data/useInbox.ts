'use client';

// The Inbox (GET /inbox): open actions and cards assigned to or by the person, unresolved threads they are in, and
// forms with responses they haven't seen, across every app. One request per filter, shared by the sidebar's count
// and the Inbox view. Beside it, the host's
// own rows (items only this browser holds), marked `local`, read again alone when the host says they changed
// (`subscribeLocal`). Coming back to the browser tab reads it again, keeping
// what it had if that read fails: a slightly stale list beats an alarm. A row done from the pane (`settle`) leaves
// `data` at once, so the sidebar's badge, the rail and Home drop with the list, and stays out while a read still
// lists it as it was (the index lists it until the app's next push), after a reload too (./inbox-settled). It also hears the page's Inbox watch
// (../inbox-notices/watch, inbox-notices.md "The Explorer's Inbox listens too"): with the All filter a newer answer
// that lists other rows becomes the list, with no read of its own; with this app's, one whose rows for this app differ
// reads the list again. So the badge and the list move as the editor's count does, live.

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import type {
  App,
  InboxAction,
  InboxResponse,
  InboxThread,
  IndexClient,
} from '@liveworkspace/index-client';
import type { InboxHost, InboxLocalRows, Located } from '../types';
import type { AppFilter } from '../words';
import { settledOf, withoutSettled, type InboxEntry } from '../explorer/inbox/sections';
import { isAbort } from './errors';
import { settledStoreFor } from './inbox-settled';
import { useReturnToTab } from './useReturnToTab';
import { inboxSignature, inboxWatchFor } from '../inbox-notices/watch';

/** The Inbox as the Explorer holds it: the index's rows and the host's, the host's marked `local`. */
export type InboxData = Omit<InboxResponse, 'actions' | 'threads'> & {
  actions: Located<InboxAction>[];
  threads: Located<InboxThread>[];
};

export type InboxState = {
  data: InboxData | null;
  loading: boolean;
  error: boolean;
  reload: () => void;
  /** A row's work was done here (resolved, marked done): it leaves the Inbox at once, while reads list it unchanged. */
  settle: (entry: InboxEntry) => void;
};

const NO_LOCAL: InboxLocalRows = { actions: [], threads: [] };
const NO_SETTLED: ReadonlyMap<string, number> = new Map();
const noSubscribe = () => () => {};

// The host's rows, in the filter. Its store failing lists nothing local; it never fails the Inbox.
function readLocal(
  host: InboxHost | undefined,
  app: App,
  filter: AppFilter,
): Promise<InboxLocalRows> {
  if (!host?.localRows) return Promise.resolve(NO_LOCAL);
  return host.localRows().then(
    (rows) =>
      filter === 'app'
        ? {
            actions: rows.actions.filter((r) => r.app === app),
            threads: rows.threads.filter((r) => r.app === app),
          }
        : rows,
    (e: unknown) => {
      console.warn('[explorer] inbox-local-read-failed', e);
      return NO_LOCAL;
    },
  );
}

const byNewest =
  <T>(at: (row: T) => number) =>
  (a: T, b: T) =>
    at(b) - at(a);

function merged(data: InboxResponse, local: InboxLocalRows): InboxData {
  if (local.actions.length + local.threads.length === 0) return data;
  const mark = <T extends object>(rows: T[]): Located<T>[] =>
    rows.map((r) => ({ ...r, local: true as const }));
  return {
    ...data,
    actions: [...data.actions, ...mark(local.actions)].sort(byNewest((a) => a.updatedAt)),
    threads: [...data.threads, ...mark(local.threads)].sort(byNewest((t) => t.latestAt)),
  };
}

type LocalRead = InboxHost['localRows'];

type Held = {
  key: string;
  // The index's rows as read, and the host's beside them: merged for the view, so the host's alone can be read again.
  raw: InboxResponse | null;
  local: InboxLocalRows;
  // The host's read that gave `local`: a host that reads for someone else (the person settled) is read again.
  localFrom: LocalRead;
  error: boolean;
};

export function useInbox(
  client: IndexClient,
  app: App,
  filter: AppFilter,
  host?: InboxHost,
  // False for an app with no Inbox (appHasInbox, ../inbox-apps.ts): GET /inbox is never read, and the Inbox stays
  // empty and settled (no data, not loading).
  enabled = true,
  // The signed-in reader: the rows they did from the pane are held for them across a reload and every tab. Signed
  // out, this page alone holds them.
  viewerId: string | null = null,
): InboxState {
  const [state, setState] = useState<Held>({
    key: '',
    raw: null,
    local: NO_LOCAL,
    localFrom: undefined,
    error: false,
  });
  const [attempt, setAttempt] = useState(0);
  // A re-read on returning to the tab: the same key, so the list stays on screen while it reads.
  const [refresh, setRefresh] = useState(0);
  const hostRef = useRef(host);
  hostRef.current = host;
  const key = `${filter}:${attempt}`;
  // When this hook's latest read started: an answer of the watch's from before it never replaces it.
  const readAt = useRef(0);
  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    readAt.current = Date.now();
    inboxWatchFor(client).touch();
    const localFrom = hostRef.current?.localRows;
    Promise.all([
      client.inbox(filter === 'app' ? { app } : {}, { signal: controller.signal }),
      readLocal(hostRef.current, app, filter),
    ])
      .then(([raw, local]) => {
        if (!controller.signal.aborted) setState({ key, raw, local, localFrom, error: false });
      })
      .catch((e: unknown) => {
        if (isAbort(e) || controller.signal.aborted) return;
        setState((prev) =>
          prev.key === key && prev.raw
            ? prev
            : { key, raw: null, local: NO_LOCAL, localFrom, error: true },
        );
      });
    return () => controller.abort();
  }, [client, app, filter, key, refresh, enabled]);
  useReturnToTab(() => setRefresh((n) => n + 1));
  // The page's watch: its newer answers keep the list live.
  const held = useRef(state);
  held.current = state;
  useEffect(() => {
    if (!enabled) return;
    const watch = inboxWatchFor(client);
    return watch.subscribe(() => {
      const { data: answer, at } = watch.current();
      const prev = held.current;
      if (!answer || !prev.raw || prev.key !== key || at < readAt.current) return;
      if (filter === 'all') {
        if (inboxSignature(prev.raw) === inboxSignature(answer)) return;
        setState((p) => (p.key === key && p.raw ? { ...p, raw: answer, error: false } : p));
      } else if (inboxSignature(prev.raw, app) !== inboxSignature(answer, app)) {
        setRefresh((n) => n + 1);
      }
    });
  }, [client, app, filter, key, enabled]);
  // The host's rows alone, read again: the latest read wins, and the index's rows stay as they are.
  const localReads = useRef(0);
  const rereadLocal = useCallback(() => {
    const read = ++localReads.current;
    const localFrom = hostRef.current?.localRows;
    void readLocal(hostRef.current, app, filter).then((local) => {
      if (read !== localReads.current) return;
      setState((prev) => (prev.raw ? { ...prev, local, localFrom } : prev));
    });
  }, [app, filter]);
  useEffect(
    () => () => {
      // Unmounted, or app and filter moved on: a read still out lands nowhere.
      localReads.current++;
    },
    [rereadLocal],
  );
  // The host's rows changed (an offline item saved).
  const subscribeLocal = enabled ? host?.subscribeLocal : undefined;
  useEffect(() => subscribeLocal?.(rereadLocal), [subscribeLocal, rereadLocal]);
  // The host reads for someone else than the rows on screen were read for.
  const localRows = host?.localRows;
  const stale = enabled && state.raw !== null && state.localFrom !== localRows;
  useEffect(() => {
    if (stale) rereadLocal();
  }, [stale, localRows, rereadLocal]);
  const reload = useCallback(() => setAttempt((n) => n + 1), []);
  // The rows done here, by key, with their time then: the reader's store (kept across a reload, bounded), or this
  // page's alone when signed out, bounded by what the person does in one visit.
  const store = viewerId ? settledStoreFor(viewerId) : null;
  const stored = useSyncExternalStore(
    store ? store.subscribe : noSubscribe,
    () => (store ? store.current() : NO_SETTLED),
    () => NO_SETTLED,
  );
  const [pageSettled, setPageSettled] = useState<ReadonlyMap<string, number>>(NO_SETTLED);
  const settled = store ? stored : pageSettled;
  const settle = useCallback(
    (entry: InboxEntry) => {
      const done = settledOf(entry);
      if (store) return store.add(done);
      const { key: k, at } = done;
      setPageSettled((prev) => (prev.get(k) === at ? prev : new Map(prev).set(k, at)));
    },
    [store],
  );
  const current = state.key === key ? state : null;
  const raw = current?.raw ?? null;
  const local = current?.local ?? NO_LOCAL;
  const data = useMemo(
    () => (raw ? withoutSettled(merged(raw, local), settled) : null),
    [raw, local, settled],
  );
  const loading = enabled && !current;
  const error = current?.error ?? false;
  return useMemo(
    () => ({ data, loading, error, reload, settle }),
    [data, loading, error, reload, settle],
  );
}

export { inboxCount } from '../explorer/inbox/sections';
