'use client';

// Layout View, the hands-on tour of arranging and filling a dashboard (docs/specs/026-plan/plan-tour.md "Dashboards:
// Layout View"): Show Me in Dashboard Settings (docs/specs/026-plan/plan-tabs.md "Show Me"), and the Dashboards tour,
// the same tour, offered on the footer's Start Tour button while an Editor has a dashboard open
// (plan-tour.md "The Dashboards tour").
import { useCallback, useEffect, useRef, useState } from 'react';
import type { DashboardLayout } from '@liveplanner/project';
import { useOptionalEditorContext } from '@/app/project/[id]/EditorContext';
import { markPlanTracksSeen, planTrackSeen } from '@/lib/plan-tour';
import { track } from '@/lib/telemetry';
import { setActiveTour, useActiveTour } from '@/lib/tour-active';
import { rebaseUserPreferences } from '@/lib/user-preferences';
import { ShowMeButton } from './ShowMe';
import { useLatest } from '@liveworkspace/workbench/hooks/ui/useLatest';
import { LayoutView } from './LayoutView';
import { TOUR_OFFER_RANK, useOfferTour } from '@liveworkspace/workbench/components/tour/tour-offer';

type Ctx = NonNullable<ReturnType<typeof useOptionalEditorContext>>;

// The tour's handle: whether it runs, and starting and ending it. `n` remounts a run started afresh.
export type DashboardTour = {
  active: boolean;
  n: number;
  start: () => void;
  end: (outcome: 'completed' | 'skipped') => void;
};

// Marks the Dashboards track taken, onto the freshest preferences, not this render's: the whole blob is written.
function markDashboardsTaken(ctx: Ctx): void {
  const next = rebaseUserPreferences(
    ctx.userPreferences,
    markPlanTracksSeen(ctx.userPreferences ?? {}, ['dashboards']),
  );
  ctx.setUserPreferences(next);
  ctx.writeUserPreferences(next, ctx.selfParticipant?.id ?? null);
}

// The tour, and `offered`, which marks a run as the Dashboards tour's (from the footer button: however it ends, its
// track is taken; Show Me records nothing). `hidden`: the page is covered (a slot maximised) or no longer editable;
// the tour ends with it, as it does with any surface closed under it.
export function useDashboardTour(hidden: boolean): {
  tour: DashboardTour;
  offered: (yes: boolean) => void;
} {
  // No editor (a dashboard drawn outside one): no offer, and nothing to record.
  const ctx = useOptionalEditorContext();
  const [run, setRun] = useState(0);
  const [active, setActive] = useState(false);
  const offeredRef = useRef(false);
  const ctxRef = useLatest(ctx);
  // Whether a run is on, read at its end so an end counts once.
  const activeRef = useRef(false);
  const end = useCallback(
    (outcome: 'completed' | 'skipped') => {
      if (!activeRef.current) return;
      activeRef.current = false;
      setActive(false);
      if (offeredRef.current && ctxRef.current) {
        offeredRef.current = false;
        markDashboardsTaken(ctxRef.current);
      }
      track(
        'UI',
        'Ended',
        outcome === 'completed' ? 'DashboardTourCompleted' : 'DashboardTourSkipped',
      );
    },
    [ctxRef],
  );
  const start = useCallback(() => {
    activeRef.current = true;
    setRun((n) => n + 1);
    setActive(true);
  }, []);
  useEffect(() => {
    if (hidden && active) end('skipped');
  }, [hidden, active, end]);
  // One tour at a time: published while it runs.
  useEffect(() => {
    setActiveTour('dashboard', active);
  }, [active]);
  useEffect(() => () => setActiveTour('dashboard', false), []);
  return {
    tour: { active, n: run, start, end },
    offered: (yes) => {
      offeredRef.current = yes;
    },
  };
}

// The Dashboards tour's way in (plan-tour.md "The Dashboards tour"): the footer's Start Tour button, offered while an
// Editor has a dashboard open in Plan, until the track is taken (its Settings row puts it back); a press starts it and
// records it. It never starts on its own.
export function useDashboardTourOffer({
  tour,
  offered,
  canWork,
}: {
  tour: DashboardTour;
  offered: (yes: boolean) => void;
  // An Editor's dashboard, on screen (not covered by a maximised slot).
  canWork: boolean;
}) {
  const ctx = useOptionalEditorContext();
  const shown = useActiveTour();
  const can = !!ctx && canWork && !ctx.isReadOnly && !ctx.embedMode;
  useOfferTour(
    'dashboard',
    can
      ? {
          name: 'Dashboards',
          rank: TOUR_OFFER_RANK.tool,
          start: () => {
            if (shown !== null || tour.active) return;
            offered(true);
            tour.start();
            track('UI', 'Started', 'DashboardTour');
            // Taken as it starts, so a reload mid-tour does not put it back on the button.
            if (!planTrackSeen(ctx.userPreferences, 'dashboards')) markDashboardsTaken(ctx);
          },
          onShown: () => track('UI', 'Opened', 'DashboardTourOffer'),
          seen: planTrackSeen(ctx.userPreferences, 'dashboards'),
        }
      : null,
  );
}

// Pressed inside the settings popover: `onStart` closes it first, so the tour has the page to work on.
export function DashboardShowMeButton({
  tour,
  onStart,
}: {
  tour: DashboardTour;
  onStart: () => void;
}) {
  return (
    <ShowMeButton
      tour={tour}
      onStart={() => {
        track('UI', 'Started', 'DashboardTour');
        onStart();
      }}
    />
  );
}

export function DashboardTourStage({
  tour,
  layout,
}: {
  tour: DashboardTour;
  layout: DashboardLayout;
}) {
  return tour.active ? <LayoutView key={tour.n} layout={layout} onEnd={tour.end} /> : null;
}
