'use client';

// The Inbox's data (docs/specs/013-workspace/inbox.md §1, §5): one read, split into the
// three sections the pane shows, plus the count the sidebar badge draws. The read is the server's and, beside it, this browser's designs in This Browser
// (§2.6), whose rows are marked `local` so they show the This Browser pill.
//
// Held in Explorer state (like favourites) rather than gated to the
// section, because the sidebar badge renders on every Explorer section
// and reads the same list. The payload is small and capped (docs/specs/013-workspace/inbox.md
// §3), so one read on mount is cheaper than a second endpoint for the
// count, and the badge can never disagree with the page.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ActivityAction, ActivityThread } from '@livedesign/api-schema';
import { apiListActivity } from '@/lib/api-client';
import { getGuestSelfId } from '@/lib/local-identity';
import { readOfflineActivity, type OfflineActivity } from '@/lib/offline/offline-activity';
import { useReturnToTab } from '@/hooks/ui/useReturnToTab';
import { track } from '@/lib/telemetry';

/** A row, marked `local` when it comes from a design saved only in this browser (§2.6). */
export type Located<T> = T & { local?: true };

/** One Assigned to You row: an action. */
export type AssignedRow = Located<{ kind: 'action' } & ActivityAction>;

/** One Open Comment Threads row: an element's thread (§2.5). */
export type ThreadRow = Located<{ kind: 'thread' } & ActivityThread>;

const NO_LOCAL: OfflineActivity = { actions: [], threads: [] };

const markLocal = <T extends object>(rows: T[]): Located<T>[] =>
  rows.map((r) => ({ ...r, local: true as const }));

// This Browser's designs in This Browser (§2.6), read beside the server's index. The store failing lists nothing
// local, never the page's failed state: that is the server read's to report.
function readLocal(owner: string): Promise<OfflineActivity> {
  return readOfflineActivity([owner, getGuestSelfId()]).then(
    (local) => ({
      actions: markLocal(local.actions),
      threads: markLocal(local.threads),
    }),
    (err: unknown) => {
      console.warn('[inbox] offline-read-failed', err);
      return NO_LOCAL;
    },
  );
}

export type ActivityFeed = {
  /** Open actions on the reader (self-assignments included), newest first. */
  assignedToMe: AssignedRow[];
  /** Open actions the reader assigned to somebody ELSE. */
  youAssigned: Located<ActivityAction>[];
  /** Unresolved threads the reader is in, newest comment first. */
  threads: ThreadRow[];
  loading: boolean;
  /** The last read FAILED — not the same as nothing outstanding. */
  error: boolean;
  retry: () => void;
};

export function useActivityFeed(ownerId: string | null): ActivityFeed {
  const [actions, setActions] = useState<Located<ActivityAction>[]>([]);
  const [threads, setThreads] = useState<Located<ActivityThread>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  // Guards a late response from a previous owner id (a guest signing in
  // mid-session re-runs this with a different id).
  const requestId = useRef(0);

  // One read, settling state only from its response, so the load effect
  // below only starts it.
  const fetchFeed = useCallback((owner: string, mode: 'replace' | 'merge') => {
    const id = (requestId.current += 1);
    return Promise.all([apiListActivity(owner), readLocal(owner)]).then(([result, local]) => {
      if (id !== requestId.current) return;
      if (!result) {
        // A 'merge' (returning to the tab) keeps what it had: a stale
        // list beats an alarm. A 'replace' has nothing to keep.
        setError(true);
        if (mode === 'replace') {
          setActions([]);
          setThreads([]);
        }
        setLoading(false);
        return;
      }
      setError(false);
      setActions([...result.actions, ...local.actions]);
      setThreads([...result.threads, ...local.threads]);
      setLoading(false);
    });
  }, []);

  const load = useCallback(
    async (mode: 'replace' | 'merge') => {
      if (!ownerId) return;
      if (mode === 'replace') setLoading(true);
      await fetchFeed(ownerId, mode);
    },
    [ownerId, fetchFeed],
  );

  // A new owner is loading from its first render.
  const [loadingFor, setLoadingFor] = useState(ownerId);
  if (ownerId !== loadingFor) {
    setLoadingFor(ownerId);
    if (ownerId) setLoading(true);
  }

  useEffect(() => {
    if (ownerId) void fetchFeed(ownerId, 'replace');
  }, [ownerId, fetchFeed]);

  // Coming back to a tab that has been open since yesterday re-reads
  // the list; also how a failed first read heals without a click.
  useReturnToTab(() => void load('merge'), { enabled: !!ownerId });

  const retry = useCallback(() => {
    track('Activity', 'Loaded', 'Retry');
    void load('replace');
  }, [load]);

  // The split (docs/specs/013-workspace/inbox.md §1): a self-assignment is "assigned to you" and
  // only that, so one action never lists twice.
  const assignedToMe = useMemo(
    () =>
      actions
        .filter((a) => a.assignedToMe)
        .map((a) => ({ kind: 'action' as const, ...a }))
        .sort((a, b) => b.updatedAt - a.updatedAt),
    [actions],
  );
  const youAssigned = useMemo(
    () =>
      actions
        .filter((a) => a.createdByMe && !a.assignedToMe)
        .sort((a, b) => b.updatedAt - a.updatedAt),
    [actions],
  );

  const threadRows = useMemo(
    () =>
      threads
        .map((t) => ({ kind: 'thread' as const, ...t }))
        .sort((a, b) => b.latest.at - a.latest.at),
    [threads],
  );

  return { assignedToMe, youAssigned, threads: threadRows, loading, error, retry };
}
