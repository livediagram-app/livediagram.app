'use client';

// Show Me in the card type editor (docs/specs/026-plan/item-types.md "Editing a type"): the button that starts the
// tour of making a card type, and the tour itself, drawn over the editor. Never offered: only the button runs it.
import { lucideGlyph } from '@livediagram/ui';
import { lucideFootprints } from '@livediagram/icons/lucide';
import { useLatest } from '@/hooks/ui/useLatest';
import { track } from '@/lib/telemetry';
import type { TypeEditorTab } from '@/components/plan/ItemTypeEditorTabs';
import { CARD_TYPE_TOUR_STEPS, type CardTypeTourApi } from './card-type-tour-steps';
import { TourStage } from './TourStage';
import { useTourEngine, type TourEngine } from './useTourEngine';

const CARD_TYPE_TOUR_COPY = {
  outroEyebrow: 'Show Me',
  helpHref: '/help/canvas/plan-mode/card-types/',
  helpLabel: 'Card Types Help',
  finish: 'Done',
};

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

// A walkthrough's footprints, at the Help link's size.
const FootprintsIcon = lucideGlyph(lucideFootprints, 14);

// The header's Show Me, left of Help and drawn as it is (HelpArticleLink's labelled variant).
export function ShowMeButton({ tour }: { tour: TourEngine<CardTypeTourApi> }) {
  return (
    <button
      type="button"
      aria-pressed={tour.active}
      className="relative touch-target inline-flex h-8 shrink-0 items-center gap-1 rounded-md px-2 text-[12px] font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
      onClick={() => {
        if (tour.active) return;
        track('UI', 'Started', 'CardTypeTour');
        tour.start();
      }}
    >
      <FootprintsIcon />
      Show Me
    </button>
  );
}

export function CardTypeTourStage({ tour }: { tour: TourEngine<CardTypeTourApi> }) {
  return (
    <TourStage
      engine={tour}
      ariaPrefix="Show Me"
      copy={CARD_TYPE_TOUR_COPY}
      layer="modal"
      pad={14}
    />
  );
}
