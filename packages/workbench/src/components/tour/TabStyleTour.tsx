'use client';

// Show Me in the Tab Style dialog (docs/specs/011-theme/canvas-and-theme-dialog.md "Show Me";
// docs/specs/007-editor/show-me.md): the tour of the dialog's home, drawn over the dialog. Never offered: only the
// button runs it. The dialog is loaded on demand, so its steps are imported with it rather than at the press. Each
// editor binds it once, in its components/tour/TabStyleTour.tsx, with its own Show Me parts and its own `track`.
import { useState, type ReactNode } from 'react';
import { useLatest } from '../../hooks/ui/useLatest';
import { tabStyleTourSteps, type TabStyleTourApi } from './tab-style-tour-steps';
import { useTourEngine, type TourEngine } from './useTourEngine';

type Tour = TourEngine<TabStyleTourApi>;

export type TabStyleTourDeps = {
  /** The editor's Show Me button (its components/tour/ShowMe.tsx). */
  ShowMeButton: (props: { tour: Tour; onStart: () => void }) => ReactNode;
  /** The editor's Show Me stage, closing on the theme help article. */
  ShowMeStage: (props: { tour: Tour; article: 'changingTheme' }) => ReactNode;
  /** The editor's telemetry, for the tour's Started and Ended events. */
  track: (category: 'UI', action: 'Started' | 'Ended', type: string) => void;
};

export function createTabStyleTour({ ShowMeButton, ShowMeStage, track }: TabStyleTourDeps) {
  function useTabStyleTour(api: TabStyleTourApi): Tour {
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

  function TabStyleShowMeButton({ tour }: { tour: Tour }) {
    return <ShowMeButton tour={tour} onStart={() => track('UI', 'Started', 'TabStyleTour')} />;
  }

  function TabStyleTourStage({ tour }: { tour: Tour }) {
    return <ShowMeStage tour={tour} article="changingTheme" />;
  }

  return { useTabStyleTour, TabStyleShowMeButton, TabStyleTourStage };
}
