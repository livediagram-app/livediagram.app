'use client';

// The Activity page's data (docs/specs/013-workspace/activity-page.md §1, §5): one read, split into the
// three sections the pane shows, plus the count the sidebar badge draws.
//
// Held in Explorer state (like favourites) rather than gated to the
// section, because the sidebar badge renders on every Explorer section
// and reads the same list. The payload is small and capped (docs/specs/013-workspace/activity-page.md
// §3), so one read on mount is cheaper than a second endpoint for the
// count, and the badge can never disagree with the page.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ActivityAction, ActivityThread } from '@livediagram/api-schema';
import { apiListActivity } from '@/lib/api-client';
import { useReturnToTab } from '@/hooks/ui/useReturnToTab';
import { track } from '@/lib/telemetry';

export type ActivityFeed = {
  /** Open actions assigned to the reader (self-assignments included). */
  assignedToMe: ActivityAction[];
  /** Open actions the reader assigned to somebody ELSE. */
  youAssigned: ActivityAction[];
  /** Unresolved threads the reader is in. */
  threads: ActivityThread[];
  loading: boolean;
  /** The last read FAILED — not the same as nothing outstanding. */
  error: boolean;
  retry: () => void;
};

export function useActivityFeed(ownerId: string | null): ActivityFeed {
  const [actions, setActions] = useState<ActivityAction[]>([]);
  const [threads, setThreads] = useState<ActivityThread[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  // Guards a late response from a previous owner id (a guest signing in
  // mid-session re-runs this with a different id).
  const requestId = useRef(0);

  const load = useCallback(
    async (mode: 'replace' | 'merge') => {
      if (!ownerId) return;
      const id = (requestId.current += 1);
      if (mode === 'replace') setLoading(true);
      const result = await apiListActivity(ownerId);
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
      setActions(result.actions);
      setThreads(result.threads);
      setLoading(false);
    },
    [ownerId],
  );

  useEffect(() => {
    if (!ownerId) return;
    void load('replace');
  }, [ownerId, load]);

  // Coming back to a tab that has been open since yesterday re-reads
  // the list; also how a failed first read heals without a click.
  useReturnToTab(() => void load('merge'), { enabled: !!ownerId });

  const retry = useCallback(() => {
    track('Activity', 'Loaded', 'Retry');
    void load('replace');
  }, [load]);

  // The split (docs/specs/013-workspace/activity-page.md §1): a self-assignment is "assigned to you" and
  // only that, so one action never lists twice.
  const assignedToMe = useMemo(() => actions.filter((a) => a.assignedToMe), [actions]);
  const youAssigned = useMemo(
    () => actions.filter((a) => a.createdByMe && !a.assignedToMe),
    [actions],
  );

  return { assignedToMe, youAssigned, threads, loading, error, retry };
}
