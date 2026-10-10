'use client';

// The Inbox's data (docs/specs/013-workspace/inbox.md §1, §5): one read, split into the
// three sections the pane shows, plus the count the sidebar badge draws. Assigned to You holds actions and
// Plan cards (§2.4) in one list.
//
// Held in Explorer state (like favourites) rather than gated to the
// section, because the sidebar badge renders on every Explorer section
// and reads the same list. The payload is small and capped (docs/specs/013-workspace/inbox.md
// §3), so one read on mount is cheaper than a second endpoint for the
// count, and the badge can never disagree with the page.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  ActivityAction,
  ActivityCard,
  ActivityCardThread,
  ActivityThread,
} from '@livediagram/api-schema';
import { apiListActivity } from '@/lib/api-client';
import { useReturnToTab } from '@/hooks/ui/useReturnToTab';
import { track } from '@/lib/telemetry';

/** One Assigned to You row: an action or a Plan card, told apart by `kind`. */
export type AssignedRow = ({ kind: 'action' } & ActivityAction) | ({ kind: 'card' } & ActivityCard);

/** One Open Comment Threads row: an element's thread or a Plan card's (§2.5), told apart by `kind`. */
export type ThreadRow =
  ({ kind: 'thread' } & ActivityThread) | ({ kind: 'card' } & ActivityCardThread);

export type ActivityFeed = {
  /** Open actions (self-assignments included) and open Plan cards on the reader, newest first. */
  assignedToMe: AssignedRow[];
  /** Open actions the reader assigned to somebody ELSE. */
  youAssigned: ActivityAction[];
  /** Unresolved threads the reader is in, on elements and on Plan cards, newest comment first. */
  threads: ThreadRow[];
  loading: boolean;
  /** The last read FAILED — not the same as nothing outstanding. */
  error: boolean;
  retry: () => void;
};

export function useActivityFeed(ownerId: string | null): ActivityFeed {
  const [actions, setActions] = useState<ActivityAction[]>([]);
  const [threads, setThreads] = useState<ActivityThread[]>([]);
  const [cards, setCards] = useState<ActivityCard[]>([]);
  const [cardThreads, setCardThreads] = useState<ActivityCardThread[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  // Guards a late response from a previous owner id (a guest signing in
  // mid-session re-runs this with a different id).
  const requestId = useRef(0);

  // One read, settling state only from its response, so the load effect
  // below only starts it.
  const fetchFeed = useCallback((owner: string, mode: 'replace' | 'merge') => {
    const id = (requestId.current += 1);
    return apiListActivity(owner).then((result) => {
      if (id !== requestId.current) return;
      if (!result) {
        // A 'merge' (returning to the tab) keeps what it had: a stale
        // list beats an alarm. A 'replace' has nothing to keep.
        setError(true);
        if (mode === 'replace') {
          setActions([]);
          setThreads([]);
          setCards([]);
          setCardThreads([]);
        }
        setLoading(false);
        return;
      }
      setError(false);
      setActions(result.actions);
      setThreads(result.threads);
      setCards(result.cards);
      setCardThreads(result.cardThreads ?? []);
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
      [
        ...actions.filter((a) => a.assignedToMe).map((a) => ({ kind: 'action' as const, ...a })),
        ...cards.map((c) => ({ kind: 'card' as const, ...c })),
      ].sort((a, b) => b.updatedAt - a.updatedAt),
    [actions, cards],
  );
  const youAssigned = useMemo(
    () => actions.filter((a) => a.createdByMe && !a.assignedToMe),
    [actions],
  );

  const threadRows = useMemo(
    () =>
      [
        ...threads.map((t) => ({ kind: 'thread' as const, ...t })),
        ...cardThreads.map((t) => ({ kind: 'card' as const, ...t })),
      ].sort((a, b) => b.latest.at - a.latest.at),
    [threads, cardThreads],
  );

  return { assignedToMe, youAssigned, threads: threadRows, loading, error, retry };
}
