'use client';

// Show Me in the Tab Style dialog (docs/specs/011-theme/canvas-and-theme-dialog.md "Show Me";
// docs/specs/007-editor/show-me.md): the tour of the dialog's home, drawn over the dialog. Never offered: only the
// button runs it. The dialog is loaded on demand, so its steps are imported with it rather than at the press.
import { useState } from 'react';
import { useLatest } from '@/hooks/ui/useLatest';
import { track } from '@/lib/telemetry';
import { tabStyleTourSteps, type TabStyleTourApi } from './tab-style-tour-steps';
import { ShowMeButton, ShowMeStage } from './ShowMe';
import { useTourEngine, type TourEngine } from './useTourEngine';

export function useTabStyleTour(api: TabStyleTourApi): TourEngine<TabStyleTourApi> {
  const apiRef = useLatest<TabStyleTourApi>(api);
  const [steps] = useState(tabStyleTourSteps);
  return useTourEngine<TabStyleTourApi>({
    steps,
    apiRef,
    onStepView: () => {},
    onFinish: (outcome) =>
      track(
        'UI',
        'Ended',
        outcome === 'completed' ? 'TabStyleTourCompleted' : 'TabStyleTourSkipped',
      ),
  });
}

export function TabStyleShowMeButton({ tour }: { tour: TourEngine<TabStyleTourApi> }) {
  return <ShowMeButton tour={tour} onStart={() => track('UI', 'Started', 'TabStyleTour')} />;
}

export function TabStyleTourStage({ tour }: { tour: TourEngine<TabStyleTourApi> }) {
  return <ShowMeStage tour={tour} article="changingTheme" />;
}
