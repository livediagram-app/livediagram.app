'use client';

// The Inbox (GET /inbox): open actions assigned to or by the person and unresolved threads they are in,
// across every app. One request per filter, shared by the sidebar's counts (the Inbox's, and the Timeline's
// events since the person last looked) and the Inbox view.

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { App, InboxResponse, IndexClient } from '@liveworkspace/index-client';
import type { AppFilter } from '../words';
import { isAbort } from './errors';

export type InboxState = {
  data: InboxResponse | null;
  loading: boolean;
  error: boolean;
  reload: () => void;
  /** The Timeline was just read: its count drops to nothing here, without asking the index again. */
  clearTimelineNew: () => void;
};

export function useInbox(client: IndexClient, app: App, filter: AppFilter): InboxState {
  const [state, setState] = useState<{ key: string; data: InboxResponse | null; error: boolean }>({
    key: '',
    data: null,
    error: false,
  });
  const [attempt, setAttempt] = useState(0);
  const key = `${filter}:${attempt}`;
  useEffect(() => {
    const controller = new AbortController();
    client
      .inbox(filter === 'app' ? { app } : {}, { signal: controller.signal })
      .then((data) => setState({ key, data, error: false }))
      .catch((e: unknown) => {
        if (!isAbort(e)) setState({ key, data: null, error: true });
      });
    return () => controller.abort();
  }, [client, app, filter, key]);
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

/** The sidebar's Inbox count: actions waiting on the person (assigned to them) and open threads. */
export function inboxCount(
  data: InboxResponse | null,
  viewerId: string | null,
): number | undefined {
  if (!data) return undefined;
  const actions = viewerId
    ? data.actions.filter((a) => a.assigneeId === viewerId && a.status === 'open').length
    : data.actions.filter((a) => a.status === 'open').length;
  return actions + data.threads.filter((t) => !t.resolved).length;
}
