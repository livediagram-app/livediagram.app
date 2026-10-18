'use client';

import type { ReactNode } from 'react';
import { Portal } from '@livediagram/ui';
import { useStartPalette } from '@/components/start/useStartPalette';
import { TourPopover, type TourCardCopy, type TourWelcomeChoice } from './TourPopover';
import type { TourEngine } from './useTourEngine';

// What a running tour draws (docs/specs/007-editor/editor-tour.md "The steps"), shared by every tour:
// the subtle backdrop behind a bookend card, the dimming highlight ring around a step's target, and the
// step popover. Nothing while the tour is not running. The card and the ring wear the active tab's colours, as the
// start panels do (useStartPalette, tour-colours.ts).
export function TourStage<Api>({
  engine,
  ariaPrefix,
  copy,
  welcomeArt,
  welcomeChoices,
  layer = 'overlay',
  pad = 6,
}: {
  engine: TourEngine<Api>;
  // The popover's label before "step N of M" ("Tour", "Plan tour").
  ariaPrefix?: string;
  copy?: Partial<TourCardCopy>;
  welcomeArt?: ReactNode;
  // The welcome card's ways in, when it has more than one (the Plan tour's tracks).
  welcomeChoices?: readonly TourWelcomeChoice[];
  // 'modal' draws the ring over a dialog, for a tour of one (the card type editor's Show Me): just above the
  // dialog, just below the menus its controls open (AnchoredPopover), which stay lit.
  layer?: 'overlay' | 'modal';
  // The room between the target and its ring, in px (a dialog's tightly packed rows want more).
  pad?: number;
}) {
  const palette = useStartPalette();
  const { step, stepIndex, targetRect } = engine;
  // Stepped aside for a dialog that is not the tour's (useTourEngine): back on the same step once it closes.
  if (!engine.active || !step || engine.yielded) return null;
  const ringLayer = step.layer ?? layer;
  return (
    <Portal>
      {/* The bookend cards ask nothing of the editor (TourPopover): no backdrop behind them. */}
      {targetRect ? (
        // The spotlight: a ring around the target whose giant box-shadow
        // dims everything else. pointer-events-none so the user can still
        // interact with whatever is highlighted; portalled menus (higher
        // z / later portals) paint above the dim. transition-all makes it
        // glide when the rect moves between steps; fade-in covers its
        // first appearance.
        <div
          aria-hidden
          className={`pointer-events-none fixed ${ringLayer === 'modal' ? 'z-[calc(var(--z-modal)+1)]' : step.ringOverMenu ? 'z-[calc(var(--z-overlay)+1)]' : 'z-[var(--z-overlay)]'} animate-fade-in rounded-xl border-2 transition-all duration-long ease-out`}
          style={{
            left: targetRect.left - pad,
            top: targetRect.top - pad,
            width: targetRect.width + pad * 2,
            height: targetRect.height + pad * 2,
            borderColor: palette.focus,
            boxShadow: '0 0 0 100vmax rgba(15, 23, 42, 0.4)',
          }}
        />
      ) : null}
      <TourPopover
        // The bookend cards have no number; real steps count from 1 (welcome occupies index 0, so a step's
        // index IS its number; a tour without one counts from its first step).
        stepNumber={step.card ? 0 : stepIndex + (engine.hasWelcome ? 0 : 1)}
        stepCount={engine.countableSteps}
        stepId={step.id}
        stepDir={engine.stepDir}
        card={step.card}
        title={step.title}
        body={step.body}
        targetRect={targetRect}
        palette={palette}
        {...(ariaPrefix ? { ariaPrefix } : {})}
        {...(copy ? { copy } : {})}
        {...(welcomeArt ? { welcomeArt } : {})}
        {...(welcomeChoices ? { welcomeChoices } : {})}
        onBack={stepIndex > (engine.hasWelcome ? 1 : 0) && !step.card ? engine.back : undefined}
        onNext={engine.next}
        onSkip={engine.skip}
      />
    </Portal>
  );
}
