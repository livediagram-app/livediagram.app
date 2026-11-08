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
import { TourStart } from './TourStart';
import { TOUR_OFFER_RANK, useOfferTour } from '@liveworkspace/workbench/components/tour/tour-offer';

type Ctx = NonNullable<ReturnType<typeof useOptionalEditorContext>>;

// The tour's handle: whether it runs, and starting and ending it. `n` remounts a run started afresh.
export type DashboardTour = {
  active: boolean;
  n: number;
  // `intro`: open on the start panel first (a press on the footer's Start Tour); Show Me goes straight in.
  start: (intro?: boolean) => void;
  end: (outcome: 'completed' | 'skipped') => void;
  // Whether the start panel shows, and its two ways out: Start (the tour runs, and its track is taken) and Not Now
  // (it closes, still on offer).
  intro: boolean;
  begin: () => void;
  cancel: () => void;
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
  const [intro, setIntro] = useState(false);
  const start = useCallback((withIntro = false) => {
    activeRef.current = true;
    setRun((n) => n + 1);
    setActive(true);
    setIntro(withIntro);
  }, []);
  const begin = useCallback(() => {
    setIntro(false);
    track('UI', 'Started', 'DashboardTour');
    // Taken as it starts, so a reload mid-tour does not put it back on the button.
    const now = ctxRef.current;
    if (offeredRef.current && now && !planTrackSeen(now.userPreferences, 'dashboards'))
      markDashboardsTaken(now);
  }, [ctxRef]);
  const cancel = useCallback(() => {
    activeRef.current = false;
    offeredRef.current = false;
    setActive(false);
    setIntro(false);
  }, []);
  // The page covered or no longer editable: a run ends as skipped; the start panel only closes (nothing ran).
  useEffect(() => {
    if (!hidden || !active) return;
    // The panel closes with its refs (cancel), as the run's end does: not something a render can derive.
    // oxlint-disable-next-line react/set-state-in-effect
    if (intro) cancel();
    else end('skipped');
  }, [hidden, active, intro, end, cancel]);
  // One tour at a time: published while it runs.
  useEffect(() => {
    setActiveTour('dashboard', active);
  }, [active]);
  useEffect(() => () => setActiveTour('dashboard', false), []);
  return {
    tour: { active, n: run, start, end, intro, begin, cancel },
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
            tour.start(true);
            track('UI', 'Opened', 'DashboardTourStart');
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
  if (!tour.active) return null;
  if (tour.intro)
    return (
      <TourStart
        key={tour.n}
        name="Dashboards Tour"
        heading="Layout View"
        line="See how this dashboard is built: its grid of twelve columns, each slot’s span and each row’s height. Then a few quick changes on the real dashboard, which Undo takes back."
        tracks={[{ id: 'dashboards', title: 'Layout View', line: '', taken: false }]}
        startLabel="Show the Grid"
        onPick={tour.begin}
        onClose={tour.cancel}
      />
    );
  return <LayoutView key={tour.n} layout={layout} onEnd={tour.end} />;
}
