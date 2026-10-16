'use client';

// Show Me in Dashboard Settings (docs/specs/026-plan/plan-tabs.md "Show Me"; docs/specs/007-editor/show-me.md): the
// tour of arranging and filling a dashboard, drawn over the page. Never offered: only the button runs it.
import { useEffect, useRef, useState } from 'react';
import { track } from '@/lib/telemetry';
import { dashboardTourSteps, hideSlot, type DashboardTourApi } from './dashboard-tour-steps';
import { ShowMeButton, ShowMeStage } from './ShowMe';
import { useTourEngine, type TourEngine } from './useTourEngine';

type SlotsNow = { hasEmpty: boolean; hasFilled: boolean };

// The tour, and `freeze`, which fixes its steps from the dashboard as it is when Show Me is pressed: filling the empty
// slot mid-tour must not pull the Fill step out from under the person. `hidden`: the page is covered (a slot
// maximised) or no longer editable; the tour ends with it, as it does with any surface closed under it.
export function useDashboardTour(hidden: boolean): {
  tour: TourEngine<DashboardTourApi>;
  freeze: (slots: SlotsNow) => void;
} {
  const apiRef = useRef<DashboardTourApi>(null);
  const [steps, setSteps] = useState(() => dashboardTourSteps({ hasEmpty: true, hasFilled: true }));
  const tour = useTourEngine<DashboardTourApi>({
    steps,
    apiRef,
    onStepView: () => {},
    onFinish: (outcome) =>
      track(
        'UI',
        'Ended',
        outcome === 'completed' ? 'DashboardTourCompleted' : 'DashboardTourSkipped',
      ),
  });
  const { active, stop } = tour;
  useEffect(() => {
    if (!hidden || !active) return;
    stop();
    hideSlot();
  }, [hidden, active, stop]);
  return { tour, freeze: (slots) => setSteps(dashboardTourSteps(slots)) };
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
  return (
    <ShowMeStage
      tour={tour}
      article="planDashboards"
      helpLabel="Dashboards Help"
      layer="overlay"
      pad={8}
    />
  );
}
