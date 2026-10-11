'use client';

// Show Me in the card type editor (docs/specs/026-plan/item-types.md "Editing a type"): the tour of making a card
// type, drawn over the editor (docs/specs/007-editor/show-me.md). Never offered: only the button runs it.
import { useLatest } from '@/hooks/ui/useLatest';
import { track } from '@/lib/telemetry';
import type { TypeEditorTab } from '@/components/plan/ItemTypeEditorTabs';
import { CARD_TYPE_TOUR_STEPS, type CardTypeTourApi } from './card-type-tour-steps';
import { ShowMeButton, ShowMeStage } from './ShowMe';
import { useTourEngine, type TourEngine } from './useTourEngine';

export function useCardTypeTour(
  showTab: (tab: TypeEditorTab) => void,
): TourEngine<CardTypeTourApi> {
  const apiRef = useLatest<CardTypeTourApi>({ showTab });
  return useTourEngine<CardTypeTourApi>({
    steps: CARD_TYPE_TOUR_STEPS,
    apiRef,
    onStepView: () => {},
    onFinish: (outcome) =>
      track(
        'UI',
        'Ended',
        outcome === 'completed' ? 'CardTypeTourCompleted' : 'CardTypeTourSkipped',
      ),
  });
}

export function CardTypeShowMeButton({ tour }: { tour: TourEngine<CardTypeTourApi> }) {
  return <ShowMeButton tour={tour} onStart={() => track('UI', 'Started', 'CardTypeTour')} />;
}

export function CardTypeTourStage({ tour }: { tour: TourEngine<CardTypeTourApi> }) {
  return <ShowMeStage tour={tour} article="planCardTypes" helpLabel="Card Types Help" />;
}
