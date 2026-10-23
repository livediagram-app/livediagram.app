'use client';

// The Inbox (GET /inbox): open actions and cards assigned to or by the person, unresolved threads they are in, and
// forms with responses they haven't seen, across every app. One request per filter, shared by the sidebar's counts
// (the Inbox's, and the Timeline's events since the person last looked) and the Inbox view. Beside it, the host's
// own rows (items only this browser holds), marked `local`. Coming back to the browser tab reads it again, keeping
// what it had if that read fails: a slightly stale list beats an alarm.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  App,
  InboxAction,
  InboxResponse,
  InboxThread,
  IndexClient,
} from '@liveworkspace/index-client';
import type { InboxHost, InboxLocalRows, Located } from '../types';
import type { AppFilter } from '../words';
import { isAbort } from './errors';
import { useReturnToTab } from './useReturnToTab';

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
  /** The Timeline was just read: its count drops to nothing here, without asking the index again. */
  clearTimelineNew: () => void;
};

const NO_LOCAL: InboxLocalRows = { actions: [], threads: [] };

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

export function useInbox(
  client: IndexClient,
  app: App,
  filter: AppFilter,
  host?: InboxHost,
): InboxState {
  const [state, setState] = useState<{ key: string; data: InboxData | null; error: boolean }>({
    key: '',
    data: null,
    error: false,
  });
  const [attempt, setAttempt] = useState(0);
  // A re-read on returning to the tab: the same key, so the list stays on screen while it reads.
  const [refresh, setRefresh] = useState(0);
  const hostRef = useRef(host);
  hostRef.current = host;
  const key = `${filter}:${attempt}`;
  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      client.inbox(filter === 'app' ? { app } : {}, { signal: controller.signal }),
      readLocal(hostRef.current, app, filter),
    ])
      .then(([data, local]) => {
        if (!controller.signal.aborted) setState({ key, data: merged(data, local), error: false });
      })
      .catch((e: unknown) => {
        if (isAbort(e) || controller.signal.aborted) return;
        setState((prev) =>
          prev.key === key && prev.data ? prev : { key, data: null, error: true },
        );
      });
    return () => controller.abort();
  }, [client, app, filter, key, refresh]);
  useReturnToTab(() => setRefresh((n) => n + 1));
  const reload = useCallback(() => setAttempt((n) => n + 1), []);
  const clearTimelineNew = useCallback(
    () =>
      setState((prev) =>
        prev.data && prev.data.timelineNew
          ? { ...prev, data: { ...prev.data, timelineNew: 0 } }
          : prev,
      ),
    [],
  );
  const current = state.key === key ? state : null;
  const data = current?.data ?? null;
  const loading = !current;
  const error = current?.error ?? false;
  return useMemo(
    () => ({ data, loading, error, reload, clearTimelineNew }),
    [data, loading, error, reload, clearTimelineNew],
  );
}

export { inboxCount } from '../explorer/inbox/sections';
