'use client';

// Running a Session tab (docs/specs/026-plan/session-tabs.md "The queue", "The sidebar", "The action bar"): the queue
// read live from the plan's cards, the room's current card and this screen's peek, and the facilitator's moves and
// outcomes. An outcome writes the real card (the completing outcome's move, Refined's, Commit's or Accept's; Close's
// move and duplicate link; Flag's flag), keeps the outcome in the card's history and on the tab with what it did, and
// moves the room on. Undo takes all of that back. Nothing here runs for someone who is not facilitating but reading.
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  beforeRank,
  holdOrder,
  isFlagged,
  itemStatus,
  itemTitle,
  nextToGo,
  sessionCloseTarget,
  sessionQueue,
  sessionTarget,
  type Item,
  type SessionOutcome,
} from '@liveplanner/items';
import {
  SESSION_KINDS,
  lastDecided,
  withCurrent,
  withDecision,
  withNoDecisions,
  withoutDecision,
  type SessionDecisionDetail,
  type SessionTabState,
} from '@liveplanner/project';
import { debugLog } from '@liveworkspace/workbench/lib/debug-log';
import type { PlanContextValue } from '@/components/plan/PlanContext';
import { recordSessionOutcome } from '@/lib/api/item-history';
import { track } from '@/lib/telemetry';
import { OUTCOME_LOOKS, SESSION_KIND_LOOKS } from './session-kinds';
import { duplicateLink, duplicateUnlink } from './triage/triage-duplicate';

const TRACK_TYPES = {
  refined: 'SessionRefined',
  skipped: 'SessionSkipped',
  flagged: 'SessionFlagged',
  committed: 'SessionCommitted',
  accepted: 'SessionAccepted',
  closed: 'SessionClosed',
  reviewed: 'SessionReviewed',
} as const satisfies Record<SessionOutcome, string>;

// What a Close asks: its reason, and the card it duplicates (an id) when one is linked.
export type SessionCloseInput = { reason: string; duplicateOf?: string | undefined };

export type SessionRun = ReturnType<typeof useSessionRun>;

// The order this screen first queued each Session tab's cards in, under the set-up it was queued with (by value: the
// tab's state is read afresh on each change), kept for the page's life so a phone's or a desktop's layout swap keeps
// it too. A card edited while queued keeps its place; a saved set-up sorts afresh. At most HELD_TABS tabs, the
// oldest dropped first.
const HELD_TABS = 20;
const held = new Map<string, { key: string; order: string[] }>();
export function heldOrder(
  tabId: string,
  setup: SessionTabState['setup'],
  toGo: readonly Item[],
): Item[] {
  const key = JSON.stringify(setup);
  const had = held.get(tabId);
  const kept = holdOrder(had?.key === key ? had.order : [], toGo);
  held.delete(tabId);
  held.set(tabId, { key, order: kept.order });
  if (held.size > HELD_TABS) held.delete(held.keys().next().value!);
  return kept.cards;
}

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
  const kind = SESSION_KINDS[session.sessionKind];
  // A kind that reviews finished work reads archived cards too, never restoring them.
  const archived = !!kind.archived;
  const queue = useMemo(() => {
    const q = sessionQueue({ items: items.values(), types, pick: { ...setup, archived }, decided });
    return { ...q, toGo: heldOrder(tabId, setup, q.toGo) };
  }, [items, types, setup, decided, archived, tabId]);
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
  // Where the completing outcome takes `item`; null when it stays (always, for a kind that stays: Sprint Review).
  const target = (item: Item) =>
    kind.stays
      ? null
      : sessionTarget(item, types, planStatuses, setup.targets, {
          names: plan.statusNames,
          phases: plan.statusPhases,
          pass: SESSION_KIND_LOOKS[session.sessionKind].passStages,
        });
  // Where a Close takes `item`: with a duplicate linked, a Duplicate stage may win over the close stage.
  const closeTarget = (item: Item, duplicate = false) =>
    sessionCloseTarget(item, types, planStatuses, setup.closeTargets, {
      names: plan.statusNames,
      duplicate,
    });

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

  // The card's history keeps the outcome (or its undo); a failure is logged, never in the way of the session.
  const record = (
    itemId: string,
    outcome: SessionOutcome,
    extra: { reason?: string; duplicateOf?: string; undone?: true } = {},
  ) => {
    if (!plan.itemsScope) return;
    recordSessionOutcome(plan.itemsScope, itemId, {
      session: session.sessionKind,
      outcome,
      ...extra,
    }).catch((error: unknown) =>
      debugLog('[session] outcome.failed', { outcome, error: String(error) }),
    );
  };

  const decide = (outcome: SessionOutcome, close?: SessionCloseInput) => {
    const item = current;
    if (!runs || !item || decided?.[item.id]) return;
    const detail: SessionDecisionDetail = {};
    const from = itemStatus(item);
    const moveTo = (to: string | null) => {
      if (!to || !from) return;
      plan.moveItem(item.id, { status: to, before: null });
      Object.assign(detail, { from, to, fromRank: item.rank });
    };
    if (outcome === kind.completes) moveTo(target(item));
    else if (outcome === kind.closes) {
      const reason = close?.reason.trim();
      if (reason) detail.reason = reason;
      const dup = close?.duplicateOf ? plan.items.get(close.duplicateOf) : undefined;
      if (dup) {
        detail.duplicateOf = dup.id;
        const link = duplicateLink(item, dup, types);
        if (link) {
          void plan.patchItem(item.id, link.patch);
          detail.linked = link.field;
        }
      }
      moveTo(closeTarget(item, !!dup));
    } else if (outcome === 'flagged' && !isFlagged(item)) {
      void plan.patchItem(item.id, { set: { flagged: true } });
      detail.flagSet = true;
    }
    record(item.id, outcome, {
      ...(detail.reason ? { reason: detail.reason } : {}),
      ...(detail.duplicateOf ? { duplicateOf: detail.duplicateOf } : {}),
    });
    const next = nextToGo(queue.toGo, item.id);
    run(tabId, (s) =>
      withDecision(s, item.id, outcome, selfName, Date.now(), next?.id ?? null, detail),
    );
    plan.announce(
      next
        ? `${OUTCOME_LOOKS[outcome].done}. Next: ${itemTitle(next)}`
        : `${OUTCOME_LOOKS[outcome].done}. Session complete`,
    );
    track('Plan', 'Used', TRACK_TYPES[outcome]);
  };

  // Undo Outcome and Undo Last: the card back where the outcome found it (when it is still where the outcome put it),
  // its flag and duplicate link off when the outcome set them, the undo kept in its history, the outcome cleared and
  // the room on the card.
  const undo = (itemId: string) => {
    const d = decided?.[itemId];
    if (!runs || !d) return;
    const item = items.get(itemId);
    if (item) {
      if (d.from && d.to && itemStatus(item) === d.to)
        // Back in its own place: in front of the card now ranked after where it was, else the column's end.
        plan.moveItem(itemId, {
          status: d.from,
          before: d.fromRank ? beforeRank(items.values(), d.from, d.fromRank, itemId) : null,
        });
      if (d.flagSet && isFlagged(item)) void plan.patchItem(itemId, { clear: ['flagged'] });
      const unlink =
        d.linked && d.duplicateOf ? duplicateUnlink(item, d.linked, d.duplicateOf, types) : null;
      if (unlink) void plan.patchItem(itemId, unlink);
      record(itemId, d.outcome, { undone: true });
    }
    run(tabId, (s) => withCurrent(withoutDecision(s, itemId), itemId, Date.now()));
    setPeekId(null);
    plan.announce(`${OUTCOME_LOOKS[d.outcome].done} undone`);
    track('Plan', 'Used', 'SessionUndone');
  };
  const last = lastDecided(session);

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
    last,
    closeTarget,
    startAgain,
  };
}
