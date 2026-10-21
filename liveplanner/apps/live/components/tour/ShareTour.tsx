'use client';

// Show Me in the Share dialog (docs/specs/007-editor/live-app.md "Show Me"; docs/specs/007-editor/show-me.md): the
// tour of issuing and managing passes, drawn over the dialog. Never offered: only the button runs it.
import { useState } from 'react';
import { useLatest } from '@/hooks/ui/useLatest';
import { track } from '@/lib/telemetry';
import { shareTourSteps, type ShareTourApi } from './share-tour-steps';
import { ShowMeButton, ShowMeStage } from './ShowMe';
import { useTourEngine, type TourEngine } from './useTourEngine';

// The tour, and `freeze`, which fixes its steps from the document as it is when Show Me is pressed: a collaborator
// adding or removing a tab mid-tour must not shift the steps out from under the person.
export function useShareTour(multiTab: boolean): {
  tour: TourEngine<ShareTourApi>;
  freeze: () => void;
} {
  const apiRef = useLatest<ShareTourApi>({});
  const [steps, setSteps] = useState(() => shareTourSteps(multiTab));
  const tour = useTourEngine<ShareTourApi>({
    steps,
    apiRef,
    onStepView: () => {},
    onFinish: (outcome) =>
      track('UI', 'Ended', outcome === 'completed' ? 'ShareTourCompleted' : 'ShareTourSkipped'),
  });
  return { tour, freeze: () => setSteps(shareTourSteps(multiTab)) };
}

export function ShareShowMeButton({
  tour,
  onStart,
}: {
  tour: TourEngine<ShareTourApi>;
  onStart: () => void;
}) {
  return (
    <ShowMeButton
      tour={tour}
      onStart={() => {
        track('UI', 'Started', 'ShareTour');
        onStart();
      }}
    />
  );
}

export function ShareTourStage({ tour }: { tour: TourEngine<ShareTourApi> }) {
  return <ShowMeStage tour={tour} article="sharing" />;
}
