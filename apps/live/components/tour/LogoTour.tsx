'use client';

// Show Me on a logo page (docs/specs/007-editor/logo-pages.md "Show Me"; docs/specs/007-editor/show-me.md): the tour of
// the logo tools, drawn over the page. Never offered: only the button in the page panel runs it.
import { useEffect, useState } from 'react';
import { useLatest } from '@/hooks/ui/useLatest';
import { track } from '@/lib/telemetry';
import type { LogoTourApi } from './logo-tour-steps';
import type { TourStepOf } from './tour-step';
import { ShowMeButton, ShowMeStage } from './ShowMe';
import { useTourEngine, type TourEngine } from './useTourEngine';

// The tour, and `freeze`, which fixes its page and its steps when Show Me is pressed. The steps load at the press, so
// their copy stays out of the editor's first load. `editable` says whether a page is still there to edit: the tour ends
// with its page (deleted, or no longer editable), as it does with any surface closed under it.
export function useLogoTour(
  panel: Pick<LogoTourApi, 'openLayouts' | 'closePanel'>,
  editable: (pageId: string) => boolean,
): {
  tour: TourEngine<LogoTourApi>;
  freeze: (pageId: string) => Promise<void>;
} {
  const [pageId, setPageId] = useState('');
  const [steps, setSteps] = useState<TourStepOf<LogoTourApi>[]>([]);
  const apiRef = useLatest<LogoTourApi>({ pageId, ...panel });
  const tour = useTourEngine<LogoTourApi>({
    steps,
    apiRef,
    onStepView: () => {},
    onFinish: (outcome) =>
      track('UI', 'Ended', outcome === 'completed' ? 'LogoTourCompleted' : 'LogoTourSkipped'),
  });
  const gone = tour.active && !editable(pageId);
  const { stop } = tour;
  useEffect(() => {
    if (gone) stop();
  }, [gone, stop]);
  const freeze = async (id: string) => {
    const { logoTourSteps } = await import('./logo-tour-steps');
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
  onStart: () => Promise<void>;
}) {
  return (
    <ShowMeButton
      tour={tour}
      onStart={() => {
        track('UI', 'Started', 'LogoTour');
        return onStart();
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
