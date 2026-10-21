'use client';

// Show Me in the photo import review (docs/specs/021-event-storming/event-storming.md "Show Me";
// docs/specs/007-editor/show-me.md): the tour of checking what was found on the wall, drawn over the review. Never
// offered: only the button runs it.
import { useState } from 'react';
import { HelpArticleLink } from '@/components/primitives/HelpArticleLink';
import { useLatest } from '@/hooks/ui/useLatest';
import { track } from '@/lib/telemetry';
import type { PhotoReviewTourApi } from './photo-review-tour-steps';
import type { TourStepOf } from './tour-step';
import { ShowMeButton, ShowMeStage } from './ShowMe';
import { useTourEngine, type TourEngine } from './useTourEngine';

// The tour over the review. Its box, and so its steps, are fixed when Show Me is pressed (`freeze`): deleting that
// box mid-tour must not swap the steps out from under the person. The steps load at the press, so their copy stays
// out of the editor's first load.
export function usePhotoReviewTour(select: (id: number | null) => void): {
  tour: TourEngine<PhotoReviewTourApi>;
  freeze: (firstBoxId: number | null) => Promise<void>;
} {
  const [boxId, setBoxId] = useState<number | null>(null);
  const [steps, setSteps] = useState<TourStepOf<PhotoReviewTourApi>[]>([]);
  const apiRef = useLatest<PhotoReviewTourApi>({ boxId, select });
  const tour = useTourEngine<PhotoReviewTourApi>({
    steps,
    apiRef,
    onStepView: () => {},
    onFinish: (outcome) =>
      track(
        'UI',
        'Ended',
        outcome === 'completed' ? 'PhotoReviewTourCompleted' : 'PhotoReviewTourSkipped',
      ),
  });
  const freeze = async (firstBoxId: number | null) => {
    const { photoReviewTourSteps } = await import('./photo-review-tour-steps');
    setBoxId(firstBoxId);
    setSteps(photoReviewTourSteps(firstBoxId !== null));
  };
  return { tour, freeze };
}

// Show Me and Help, in a card on the photo's top-left corner (the zoom has the other). A press on it is not a drag
// that draws a box.
export function PhotoReviewShowMe({
  tour,
  onStart,
}: {
  tour: TourEngine<PhotoReviewTourApi>;
  onStart: () => Promise<void>;
}) {
  return (
    <div
      className="pointer-events-auto absolute left-2 top-2 flex items-center gap-0.5 rounded-lg bg-white/95 p-0.5 shadow-lg dark:bg-slate-900/95"
      onPointerDown={(e) => e.stopPropagation()}
    >
      <ShowMeButton
        tour={tour}
        onStart={() => {
          track('UI', 'Started', 'PhotoReviewTour');
          return onStart();
        }}
      />
      <HelpArticleLink article="eventStormingBoards" variant="labelled" />
    </div>
  );
}

export function PhotoReviewTourStage({ tour }: { tour: TourEngine<PhotoReviewTourApi> }) {
  return <ShowMeStage tour={tour} article="eventStormingBoards" />;
}
