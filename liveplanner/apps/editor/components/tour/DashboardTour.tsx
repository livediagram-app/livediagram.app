'use client';

// The tour of arranging and filling a dashboard, drawn over the page: Show Me in Dashboard Settings
// (docs/specs/026-plan/plan-tabs.md "Show Me"; docs/specs/007-editor/show-me.md), and the Dashboards tour, the same
// steps, offered on the footer's Start Tour button while an Editor has a dashboard open
// (docs/specs/026-plan/plan-tour.md "The Dashboards tour").
import { useEffect, useRef, useState } from 'react';
import { useOptionalEditorContext } from '@/app/project/[id]/EditorContext';
import { markPlanTracksSeen } from '@/lib/plan-tour';
import { track } from '@/lib/telemetry';
import { setActiveTour, useActiveTour } from '@/lib/tour-active';
import { rebaseUserPreferences } from '@/lib/user-preferences';
import { dashboardTourSteps, hideSlot, type DashboardTourApi } from './dashboard-tour-steps';
import { helpArticleHref } from '@/lib/help-articles';
import { ShowMeButton } from './ShowMe';
import { TourStage } from './TourStage';
import {
  useTourEngine,
  type TourEngine,
} from '@liveworkspace/workbench/components/tour/useTourEngine';
import { TOUR_OFFER_RANK, useOfferTour } from '@liveworkspace/workbench/components/tour/tour-offer';

type SlotsNow = { hasEmpty: boolean; hasFilled: boolean };

// The tour, and `freeze`, which fixes its steps from the dashboard as it is when Show Me is pressed: filling the empty
// slot mid-tour must not pull the Fill step out from under the person. `hidden`: the page is covered (a slot
// maximised) or no longer editable; the tour ends with it, as it does with any surface closed under it.
export function useDashboardTour(hidden: boolean): {
  tour: TourEngine<DashboardTourApi>;
  freeze: (slots: SlotsNow, offered?: boolean) => void;
} {
  // No editor (a dashboard drawn outside one): no offer, and nothing to record.
  const ctx = useOptionalEditorContext();
  const apiRef = useRef<DashboardTourApi>(null);
  const [steps, setSteps] = useState(() => dashboardTourSteps({ hasEmpty: true, hasFilled: true }));
  // Whether this run is the Dashboards tour, from the footer button: however it ends, its track is taken (Show Me
  // records nothing).
  const offeredRef = useRef(false);
  const tour = useTourEngine<DashboardTourApi>({
    steps,
    apiRef,
    onStepView: () => {},
    // Started is sent by whichever button started it (the footer's, Show Me's).
    onFinish: (outcome) => {
      if (offeredRef.current && ctx) {
        offeredRef.current = false;
        // Onto the freshest preferences, not this render's: the whole blob is written.
        const next = rebaseUserPreferences(
          ctx.userPreferences,
          markPlanTracksSeen(ctx.userPreferences ?? {}, ['dashboards']),
        );
        ctx.setUserPreferences(next);
        ctx.writeUserPreferences(next, ctx.selfParticipant?.id ?? null);
      }
      track(
        'UI',
        'Ended',
        outcome === 'completed' ? 'DashboardTourCompleted' : 'DashboardTourSkipped',
      );
    },
  });
  const { active, stop } = tour;
  useEffect(() => {
    if (!hidden || !active) return;
    stop();
    hideSlot();
  }, [hidden, active, stop]);
  // One tour at a time: published while it runs.
  useEffect(() => {
    setActiveTour('dashboard', active);
  }, [active]);
  useEffect(() => () => setActiveTour('dashboard', false), []);
  return {
    tour,
    freeze: (slots, offered = false) => {
      offeredRef.current = offered;
      setSteps(dashboardTourSteps(slots));
    },
  };
}

// The Dashboards tour's way in (docs/specs/026-plan/plan-tour.md "The Dashboards tour"): the footer's Start Tour button,
// offered while an Editor has a dashboard open in Plan, taken or not; a press starts it. It never starts on its own.
export function useDashboardTourOffer({
  tour,
  freeze,
  canWork,
  slots,
}: {
  tour: TourEngine<DashboardTourApi>;
  freeze: (slots: SlotsNow, offered?: boolean) => void;
  // An Editor's dashboard, on screen (not covered by a maximised slot).
  canWork: boolean;
  slots: () => SlotsNow;
}) {
  // No editor (a dashboard drawn outside one): no offer, and nothing to record.
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
            freeze(slots(), true);
            tour.start();
            track('UI', 'Started', 'DashboardTour');
          },
          onShown: () => track('UI', 'Opened', 'DashboardTourOffer'),
        }
      : null,
  );
}

// Pressed inside the settings popover: `onStart` closes it first, so the tour has the page to point at.
export function DashboardShowMeButton({
  tour,
  onStart,
}: {
  tour: TourEngine<DashboardTourApi>;
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

export function DashboardTourStage({ tour }: { tour: TourEngine<DashboardTourApi> }) {
  // Show Me's card words, whichever button started it: the steps are the same.
  return (
    <TourStage
      engine={tour}
      ariaPrefix="Show Me"
      copy={{
        outroEyebrow: 'Show Me',
        helpHref: helpArticleHref('planDashboards'),
        finish: 'Done',
      }}
      layer="overlay"
      pad={8}
    />
  );
}
