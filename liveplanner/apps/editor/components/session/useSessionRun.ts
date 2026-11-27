'use client';

// Running a Session tab (docs/specs/026-plan/session-tabs.md "The queue", "The sidebar", "The action bar"): the queue
// read live from the plan's cards, the room's current card and this screen's peek, and the facilitator's moves and
// outcomes. An outcome writes the real card (the completing outcome's move, Refined's or Commit's; Flag's flag), keeps the outcome in the card's history and
// on the tab, and moves the room on. Nothing here runs for someone who is not facilitating but reading.
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  isFlagged,
  itemTitle,
  nextToGo,
  sessionQueue,
  sessionTarget,
  type Item,
  type SessionOutcome,
} from '@liveplanner/items';
import {
  SESSION_KINDS,
  withCurrent,
  withDecision,
  withNoDecisions,
  withoutDecision,
  type SessionTabState,
} from '@liveplanner/project';
import { debugLog } from '@liveworkspace/workbench/lib/debug-log';
import type { PlanContextValue } from '@/components/plan/PlanContext';
import { recordSessionOutcome } from '@/lib/api/item-history';
import { track } from '@/lib/telemetry';
import { OUTCOME_LOOKS } from './session-kinds';

const TRACK_TYPES = {
  refined: 'SessionRefined',
  skipped: 'SessionSkipped',
  flagged: 'SessionFlagged',
  committed: 'SessionCommitted',
} as const satisfies Record<SessionOutcome, string>;

export type SessionRun = ReturnType<typeof useSessionRun>;

export function useSessionRun({
  tabId,
  session,
  plan,
  runs,
  selfName,
  run,
}: {
  tabId: string;
  session: SessionTabState;
  plan: PlanContextValue;
  // Whether this screen holds the baton and may run the session (an Editor facilitating on an unlocked tab).
  runs: boolean;
  selfName: string;
  run: (tabId: string, change: (s: SessionTabState) => SessionTabState) => void;
}) {
  const { items, types } = plan;
  const { setup, decided, currentId } = session;
  const queue = useMemo(
    () => sessionQueue({ items: items.values(), types, pick: setup, decided }),
    [items, types, setup, decided],
  );
  // The whole list as the sidebar shows it: decided cards first, then those still to go.
  const list = useMemo(() => [...queue.decided, ...queue.toGo], [queue]);
  // The room's card: the one the tab names while it is queued, else the first still to go, else none (complete).
  const current: Item | null =
    (currentId ? list.find((i) => i.id === currentId) : undefined) ?? queue.toGo[0] ?? null;
  // This screen's own look at another card (a peek): never the room's.
  const [peekId, setPeekId] = useState<string | null>(null);
  const peek = peekId && peekId !== current?.id ? (items.get(peekId) ?? null) : null;
  const shown = peek ?? current;
  const planStatuses = useMemo(() => [...plan.statusNames.keys()], [plan.statusNames]);
  const target = (item: Item) => sessionTarget(item, types, planStatuses, setup.targets);

  // The facilitator's screen settles the room on a real card, its clock starting, when the tab names none still queued
  // (a fresh session, or the current card dragged out of the picked stages).
  const settledId = current?.id ?? null;
  useEffect(() => {
    if (!runs || settledId === (currentId ?? null)) return;
    run(tabId, (s) => withCurrent(s, settledId, Date.now()));
  }, [runs, settledId, currentId, run, tabId]);

  const goTo = useCallback(
    (itemId: string) => {
      if (!runs) {
        setPeekId(itemId);
        return;
      }
      setPeekId(null);
      run(tabId, (s) => (s.currentId === itemId ? s : withCurrent(s, itemId, Date.now())));
    },
    [runs, run, tabId],
  );

  const step = (by: 1 | -1) => {
    if (!runs || list.length === 0) return;
    const at = current ? list.findIndex((i) => i.id === current.id) : -1;
    const next = list[Math.min(list.length - 1, Math.max(0, at + by))];
    if (next && next.id !== current?.id) goTo(next.id);
  };

  const decide = (outcome: SessionOutcome) => {
    const item = current;
    if (!runs || !item || decided?.[item.id]) return;
    if (outcome === SESSION_KINDS[session.sessionKind].completes) {
      const to = target(item);
      if (to) plan.moveItem(item.id, { status: to, before: null });
    } else if (outcome === 'flagged' && !isFlagged(item)) {
      void plan.patchItem(item.id, { set: { flagged: true } });
    }
    if (plan.itemsScope)
      recordSessionOutcome(plan.itemsScope, item.id, {
        session: session.sessionKind,
        outcome,
      }).catch((error: unknown) =>
        debugLog('[session] outcome.failed', { outcome, error: String(error) }),
      );
    const next = nextToGo(queue.toGo, item.id);
    run(tabId, (s) => withDecision(s, item.id, outcome, selfName, Date.now(), next?.id ?? null));
    plan.announce(
      next
        ? `${OUTCOME_LOOKS[outcome].done}. Next: ${itemTitle(next)}`
        : `${OUTCOME_LOOKS[outcome].done}. Session complete`,
    );
    track('Plan', 'Used', TRACK_TYPES[outcome]);
  };

  const undo = (itemId: string) => {
    if (!runs) return;
    run(tabId, (s) => withCurrent(withoutDecision(s, itemId), itemId, Date.now()));
  };

  const startAgain = () => {
    if (!runs) return;
    run(tabId, withNoDecisions);
  };

  return {
    queue,
    list,
    current,
    shown,
    peeking: !!peek,
    backToRoom: () => setPeekId(null),
    target,
    goTo,
    next: () => step(1),
    previous: () => step(-1),
    decide,
    undo,
    startAgain,
  };
}
