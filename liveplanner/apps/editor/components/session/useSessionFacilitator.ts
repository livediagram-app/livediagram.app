'use client';

// A Session tab's baton (docs/specs/026-plan/session-tabs.md "Facilitator"): an Editor opening a session nobody runs
// takes it; one already there when it comes free sees Facilitate; once the facilitator has been gone from the room for
// FACILITATOR_GRACE_MS on this screen, any Editor sees Take Over. The facilitator hands it to an Editor in the room or
// steps down. It is never taken without a press while someone holds it.
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  FACILITATOR_GRACE_MS,
  isFacilitator,
  withFacilitator,
  type SessionFacilitator,
  type SessionTabState,
} from '@liveplanner/project';
import { participantKey, type Participant } from '@/lib/identity';

export type SessionBaton = ReturnType<typeof useSessionFacilitator>;

export function useSessionFacilitator({
  tabId,
  session,
  self,
  mayHold,
  presence,
  run,
}: {
  tabId: string;
  session: SessionTabState;
  // This screen's person as the baton names them: their collab key, name and colour.
  self: SessionFacilitator;
  // An Editor on an unlocked tab.
  mayHold: boolean;
  // Everyone else in the room.
  presence: readonly Participant[];
  run: (tabId: string, change: (s: SessionTabState) => SessionTabState) => void;
}) {
  const holder = session.facilitator ?? null;
  const mine = isFacilitator(session, self.id);
  const holderHere = !!holder && presence.some((p) => participantKey(p) === holder.id);

  // Opening a session nobody runs takes the baton, once, as the page first shows it.
  const opened = useRef(false);
  useEffect(() => {
    if (opened.current) return;
    opened.current = true;
    if (mayHold && !holder) run(tabId, (s) => (s.facilitator ? s : withFacilitator(s, self)));
  }, [mayHold, holder, run, tabId, self]);

  // Whether the facilitator has been away long enough on this screen for Take Over: the holder this screen has
  // watched stay away for the whole grace, set by the timer and cleared as the absence ends.
  const [awayId, setAwayId] = useState<string | null>(null);
  const watching = !!holder && !mine && !holderHere;
  const holderId = holder?.id ?? null;
  useEffect(() => {
    if (!watching || !holderId) return;
    const t = window.setTimeout(() => setAwayId(holderId), FACILITATOR_GRACE_MS);
    return () => {
      window.clearTimeout(t);
      setAwayId(null);
    };
  }, [watching, holderId]);
  // Coming back (or a new holder) ends it at once, before the clear lands.
  const away = watching && awayId === holderId;

  // The Editors in the room the baton can go to: one row per person, never an agent, never this screen.
  const editors = useMemo(() => {
    const seen = new Set<string>([self.id]);
    const out: SessionFacilitator[] = [];
    for (const p of presence) {
      const key = participantKey(p);
      if (p.agent || seen.has(key) || (p.role && p.role !== 'edit')) continue;
      seen.add(key);
      out.push({ id: key, name: p.name, color: p.color });
    }
    return out;
  }, [presence, self.id]);

  const take = () => {
    if (mayHold) run(tabId, (s) => withFacilitator(s, self));
  };
  return {
    holder,
    mine,
    // What this screen may do with the baton.
    canFacilitate: mayHold && !holder,
    canTakeOver: mayHold && watching && away,
    editors: mine ? editors : [],
    take,
    handOver: (to: SessionFacilitator) => {
      if (mine) run(tabId, (s) => withFacilitator(s, to));
    },
    stepDown: () => {
      if (mine) run(tabId, (s) => withFacilitator(s, undefined));
    },
  };
}
