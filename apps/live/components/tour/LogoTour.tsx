'use client';

// Show Me on a logo page (docs/specs/007-editor/logo-pages.md "Show Me"; docs/specs/007-editor/show-me.md): the tour of
// the logo tools, drawn over the page. Never offered: only the button in the page panel runs it.
import { useState } from 'react';
import { useLatest } from '@/hooks/ui/useLatest';
import { track } from '@/lib/telemetry';
import { logoTourSteps, type LogoTourApi } from './logo-tour-steps';
import { ShowMeButton, ShowMeStage } from './ShowMe';
import { useTourEngine, type TourEngine } from './useTourEngine';

// The tour, and `freeze`, which fixes its page and its steps when Show Me is pressed.
export function useLogoTour(panel: Pick<LogoTourApi, 'openLayouts' | 'closePanel'>): {
  tour: TourEngine<LogoTourApi>;
  freeze: (pageId: string) => void;
} {
  const [pageId, setPageId] = useState('');
  const [steps, setSteps] = useState(() => logoTourSteps(false));
  const apiRef = useLatest<LogoTourApi>({ pageId, ...panel });
  const tour = useTourEngine<LogoTourApi>({
    steps,
    apiRef,
    onStepView: () => {},
    onFinish: (outcome) =>
      track('UI', 'Ended', outcome === 'completed' ? 'LogoTourCompleted' : 'LogoTourSkipped'),
  });
  const freeze = (id: string) => {
    setPageId(id);
    setSteps(logoTourSteps(document.querySelector('[aria-label="Combine shapes"]') !== null));
  };
  return { tour, freeze };
}

export function LogoShowMeButton({
  tour,
  onStart,
}: {
  tour: TourEngine<LogoTourApi>;
  onStart: () => void;
}) {
  return (
    <ShowMeButton
      tour={tour}
      onStart={() => {
        track('UI', 'Started', 'LogoTour');
        onStart();
      }}
    />
  );
}

export function LogoTourStage({ tour }: { tour: TourEngine<LogoTourApi> }) {
  return (
    <ShowMeStage
      tour={tour}
      article="logoPages"
      helpLabel="Logo Pages Help"
      layer="overlay"
      pad={8}
    />
  );
}
