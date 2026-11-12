'use client';

// The plan's pull request states on this screen (docs/specs/026-plan/github-pull-requests.md "Pull request state on
// cards"; blueprint "Part 3" "The editor"): what every items read answers, kept live by the room's `pull-requests` op.
// A plan with no connection is answered none (`undefined`), and asks nothing more. While it is connected, a card
// naming a pull request the screen has no state for (an address just pasted, a mention another tab's card made) reads
// the items once more for it, once per pull request, so its state shows without a reload.
import {
  NO_PULL_REQUEST_STATUSES,
  cardPullRequests,
  pullRequestKey,
  pullRequestStatuses,
  typeIn,
  type Item,
  type ItemTypeDef,
  type PullRequestStatus,
  type PullRequestStatuses,
} from '@liveplanner/items';
import type { PullRequestsRoomOp } from '@liveplanner/api-schema';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export type PullRequestStatusesSlice = {
  statuses: PullRequestStatuses;
  // An items read's answer: the states it carried, or undefined for a plan with no connection.
  read: (list: readonly PullRequestStatus[] | undefined) => void;
  receive: (op: PullRequestsRoomOp) => void;
};

// `read`: these came with the cards, so the cards on screen then were answered for.
type Held = {
  connected: boolean;
  byKey: ReadonlyMap<string, PullRequestStatus>;
  read?: true;
};
const NOTHING: Held = { connected: false, byKey: new Map() };

// The same state as before keeps its object, so the cards reading it are not drawn again.
const sameStatus = (a: PullRequestStatus, b: PullRequestStatus): boolean =>
  a.title === b.title &&
  a.state === b.state &&
  a.checks === b.checks &&
  a.updatedAt === b.updatedAt &&
  a.url === b.url &&
  (a.cards ?? []).join() === (b.cards ?? []).join();

function merged(
  byKey: ReadonlyMap<string, PullRequestStatus>,
  upserts: readonly PullRequestStatus[],
  removed: readonly string[] = [],
): ReadonlyMap<string, PullRequestStatus> {
  const next = new Map(byKey);
  for (const s of upserts) {
    const had = next.get(s.key);
    if (!had || !sameStatus(had, s)) next.set(s.key, s);
  }
  for (const key of removed) next.delete(key);
  return next;
}

export function usePullRequestStatuses(opts: {
  items: ReadonlyMap<string, Item>;
  types: readonly ItemTypeDef[];
  refetch: () => void;
}): PullRequestStatusesSlice {
  const { items, types, refetch } = opts;
  const [held, setHeld] = useState<Held>(NOTHING);

  const read = useCallback((list: readonly PullRequestStatus[] | undefined) => {
    setHeld((prev) => {
      if (list === undefined) return prev.connected || prev.byKey.size ? NOTHING : prev;
      // A read answers every state the screen's cards link: what it leaves out is gone.
      const kept = merged(new Map(), list);
      const next = new Map<string, PullRequestStatus>();
      for (const [key, s] of kept) {
        const had = prev.byKey.get(key);
        next.set(key, had && sameStatus(had, s) ? had : s);
      }
      return { connected: true, byKey: next, read: true };
    });
  }, []);

  const receive = useCallback(
    (op: PullRequestsRoomOp) => {
      if (op.reset) return setHeld(NOTHING);
      // A tab's session hears an empty op (the state may be another tab's cards'): it reads its own again.
      if (op.upserts.length === 0 && op.removed.length === 0) return refetch();
      setHeld((prev) => ({ connected: true, byKey: merged(prev.byKey, op.upserts, op.removed) }));
    },
    [refetch],
  );

  // The pull requests already asked after, so each is read for once; and the cards already looked at (an edit makes a
  // new card object), so a drop on a 2,000-card board looks at the cards it changed, not all of them.
  const askedRef = useRef(new Set<string>());
  const lookedRef = useRef({ types, seen: new WeakSet<Item>() });
  const answeredRef = useRef<Held | null>(null);
  useEffect(() => {
    if (!held.connected) return;
    if (lookedRef.current.types !== types) lookedRef.current = { types, seen: new WeakSet() };
    const { seen } = lookedRef.current;
    let unknown = false;
    for (const item of items.values()) {
      if (seen.has(item)) continue;
      seen.add(item);
      for (const ref of cardPullRequests(item, typeIn(types, item.type))) {
        const key = pullRequestKey(ref);
        if (held.byKey.has(key) || askedRef.current.has(key)) continue;
        askedRef.current.add(key);
        unknown = true;
      }
    }
    // The read that brought these states answered for the cards it brought: a state it lacks is one no delivery has
    // reported, and asking again would answer the same.
    const answered = !!held.read && answeredRef.current !== held;
    answeredRef.current = held;
    if (unknown && !answered) refetch();
  }, [held, items, types, refetch]);

  const statuses = useMemo(
    () =>
      held.byKey.size ? pullRequestStatuses([...held.byKey.values()]) : NO_PULL_REQUEST_STATUSES,
    [held],
  );
  return { statuses, read, receive };
}
