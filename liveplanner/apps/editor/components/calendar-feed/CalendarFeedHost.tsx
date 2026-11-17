'use client';

// Gives the editor its door to Subscribe to Calendar (CalendarFeedContext) and draws the dialog while it is open
// (docs/specs/026-plan/calendar-feed.md "Where it lives"). The dialog's code loads the first time it opens
// (docs/specs/016-platform/web-performance.md), so a plan whose person never opens it pays nothing for it.
import dynamic from 'next/dynamic';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { requestToolsView } from '@liveworkspace/workbench/components/chrome/tools-door';
import { track } from '@/lib/telemetry';
import { CalendarFeedDoorContext, type CalendarFeedDoor } from './CalendarFeedContext';
import { CALENDAR_FEED_PARAM, type CalendarFeedScope } from './calendar-feed-gate';
import {
  ToolGateDialog,
  toolGateBadges,
  useAskedOpen,
  type ToolGate,
} from '@/components/dialogs/tool-gate';
import type { CalendarFeedTarget } from './CalendarFeedDialog';

const CalendarFeedDialog = dynamic(
  () => import('./CalendarFeedDialog').then((m) => m.CalendarFeedDialog),
  { ssr: false },
);

export function CalendarFeedHost({
  scope,
  gate = null,
  children,
}: {
  // Null for anyone who may not have a feed (calendarFeedScopeFor).
  scope: CalendarFeedScope | null;
  // Set for someone who would have one but must sign in or sync first (calendarFeedGateFor): the door opens it.
  gate?: ToolGate | null;
  children: ReactNode;
}) {
  // Back from a guest's sign-in, asked open: Tools opens at the feed on arrival (footer-tools-menu.md "From
  // elsewhere"), where the gate or the feed draws.
  const asked = useAskedOpen(CALENDAR_FEED_PARAM);
  useEffect(() => {
    if (asked) requestToolsView('calendar-feed');
  }, [asked]);
  const [open, setOpen] = useState(false);
  const { ownerId, projectId } = scope ?? {};
  const stable = useMemo<CalendarFeedScope | null>(
    () => (ownerId && projectId ? { ownerId, projectId } : null),
    [ownerId, projectId],
  );
  // One target while the scope holds: the dialog reads its feed again only when it changes.
  const target = useMemo<CalendarFeedTarget | null>(
    () => (stable ? { kind: 'plan', scope: stable } : null),
    [stable],
  );
  const gateKind = gate?.kind ?? null;
  const door = useMemo<CalendarFeedDoor | null>(() => {
    if (stable)
      return {
        open: () => {
          setOpen(true);
          track('UI', 'Opened', 'CalendarFeed');
        },
      };
    if (!gateKind) return null;
    // Through the gate: once synced (or signed in) the scope arrives and the feed's dialog opens in its place.
    return {
      badges: toolGateBadges(gate),
      open: () => {
        setOpen(true);
        track('UI', 'Opened', gateKind === 'sync' ? 'CalendarFeedOffline' : 'CalendarFeedSignIn');
      },
    };
  }, [stable, gateKind, gate]);
  return (
    <CalendarFeedDoorContext.Provider value={door}>
      {children}
      {target && open ? (
        <CalendarFeedDialog target={target} onClose={() => setOpen(false)} />
      ) : null}
      {gate && !target && open ? (
        <ToolGateDialog
          gate={gate}
          title="Subscribe to Calendar"
          param={CALENDAR_FEED_PARAM}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </CalendarFeedDoorContext.Provider>
  );
}
