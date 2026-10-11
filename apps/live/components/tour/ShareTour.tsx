'use client';

// Show Me in the Share dialog (docs/specs/007-editor/live-app.md "Show Me"; docs/specs/007-editor/show-me.md): the
// tour of issuing and managing passes, drawn over the dialog. Never offered: only the button runs it.
import { useMemo } from 'react';
import { useLatest } from '@/hooks/ui/useLatest';
import { track } from '@/lib/telemetry';
import { shareTourSteps, type ShareTourApi } from './share-tour-steps';
import { ShowMeButton, ShowMeStage } from './ShowMe';
import { useTourEngine, type TourEngine } from './useTourEngine';

export function useShareTour(multiTab: boolean, showPasses: () => void): TourEngine<ShareTourApi> {
  const apiRef = useLatest<ShareTourApi>({ showPasses });
  const steps = useMemo(() => shareTourSteps(multiTab), [multiTab]);
  return useTourEngine<ShareTourApi>({
    steps,
    apiRef,
    onStepView: () => {},
    onFinish: (outcome) =>
      track('UI', 'Ended', outcome === 'completed' ? 'ShareTourCompleted' : 'ShareTourSkipped'),
  });
}

export function ShareShowMeButton({ tour }: { tour: TourEngine<ShareTourApi> }) {
  return <ShowMeButton tour={tour} onStart={() => track('UI', 'Started', 'ShareTour')} />;
}

export function ShareTourStage({ tour }: { tour: TourEngine<ShareTourApi> }) {
  return <ShowMeStage tour={tour} article="sharing" helpLabel="Sharing Help" />;
}
