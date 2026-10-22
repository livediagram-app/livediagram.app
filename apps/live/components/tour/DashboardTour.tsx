'use client';

// The tour of arranging and filling a dashboard, drawn over the page: Show Me in Dashboard Settings
// (docs/specs/026-plan/plan-tabs.md "Show Me"; docs/specs/007-editor/show-me.md), and the Dashboards tour, the same
// steps behind a welcome card, offered once the first time an Editor has a dashboard open
// (docs/specs/026-plan/plan-tour.md "The Dashboards tour").
import { useEffect, useRef, useState } from 'react';
import { useOptionalEditorContext } from '@/app/document/[id]/EditorContext';
import { useStartPanelOpen } from '@/components/start/start-panel-open';
import { useLatest } from '@/hooks/ui/useLatest';
import { useAnyModalOpen } from '@/lib/modal-guard';
import { markPlanTracksSeen, planTrackSeen } from '@/lib/plan-tour';
import { track } from '@/lib/telemetry';
import { setActiveTour, useActiveTour } from '@/lib/tour-active';
import { rebaseUserPreferences } from '@/lib/user-preferences';
import { dashboardTourSteps, hideSlot, type DashboardTourApi } from './dashboard-tour-steps';
import { helpArticleHref } from '@/lib/help-articles';
import { DashboardsTourArt } from './art/plan-tour-art';
import { ShowMeButton } from './ShowMe';
import { TourStage } from './TourStage';
import { useTourEngine, type TourEngine } from './useTourEngine';

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
  // Whether this run is the offer: however it ends, the Dashboards track is answered (Show Me answers nothing).
  const offeredRef = useRef(false);
  const tour = useTourEngine<DashboardTourApi>({
    steps,
    apiRef,
    onStepView: () => {},
    // The offer accepted (Show Me sends its own from the button: it has no welcome card).
    onStart: () => track('UI', 'Started', 'DashboardTour'),
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
        if (outcome === 'declined') return track('UI', 'Closed', 'DashboardTourOffer');
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
      setSteps(dashboardTourSteps(slots, offered));
    },
  };
}

// How long a dashboard is on screen before the Dashboards tour offers itself, so the page has drawn.
const OFFER_DELAY_MS = 800;

// The Dashboards tour's offer (docs/specs/026-plan/plan-tour.md "The Dashboards tour"): once, the first time an Editor
// has a dashboard open in Plan, while its track is owed, the synced preferences are in, and nothing else (another
// tour, a dialog, a start panel) is on screen. Answered however it ends (useDashboardTour).
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
  const modalOpen = useAnyModalOpen();
  const startPanelOpen = useStartPanelOpen();
  const owed = !!ctx && !planTrackSeen(ctx.userPreferences, 'dashboards');
  const ready =
    !!ctx &&
    canWork &&
    owed &&
    ctx.prefsSettled &&
    !ctx.isReadOnly &&
    !ctx.embedMode &&
    shown === null &&
    !modalOpen &&
    !startPanelOpen &&
    !tour.active;
  const offeredRef = useRef(false);
  const latest = useLatest({ tour, freeze, slots });
  useEffect(() => {
    if (!ready || offeredRef.current) return;
    const t = setTimeout(() => {
      offeredRef.current = true;
      const { tour: engine, freeze: fix, slots: now } = latest.current;
      fix(now(), true);
      engine.start();
      track('UI', 'Opened', 'DashboardTourOffer');
    }, OFFER_DELAY_MS);
    return () => clearTimeout(t);
  }, [ready, latest]);
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
  // Show Me's card words, with the offer's eyebrow and picture for the Dashboards tour's welcome card.
  return (
    <TourStage
      engine={tour}
      // Offered, it is the Dashboards tour; run from the settings, it is Show Me.
      ariaPrefix={tour.hasWelcome ? 'Dashboards tour' : 'Show Me'}
      copy={{
        welcomeEyebrow: 'Dashboards tour',
        outroEyebrow: 'Show Me',
        helpHref: helpArticleHref('planDashboards'),
        finish: 'Done',
      }}
      welcomeArt={<DashboardsTourArt />}
      layer="overlay"
      pad={8}
    />
  );
}
