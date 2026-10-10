'use client';

import type { ReactNode } from 'react';
import { Portal } from '@livediagram/ui';
import { TourPopover, type TourCardCopy, type TourWelcomeChoice } from './TourPopover';
import type { TourEngine } from './useTourEngine';

// What a running tour draws (docs/specs/007-editor/editor-tour.md "The steps"), shared by every tour:
// the subtle backdrop behind a bookend card, the dimming highlight ring around a step's target, and the
// step popover. Nothing while the tour is not running.
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
  const { step, stepIndex, targetRect } = engine;
  if (!engine.active || !step) return null;
  return (
    <Portal>
      {step.card ? (
        // Focus backdrop for the bookend cards: a SUBTLE full-screen tint
        // (much lighter than Dialog's, the canvas should stay visible)
        // that draws the eye to the card and absorbs stray clicks until
        // it's answered. Deliberately NOT a click-to-dismiss surface:
        // with the once-ever done-guard, a stray backdrop click must
        // never count as a permanent decline.
        <div
          aria-hidden
          className="fixed inset-0 z-[var(--z-overlay)] animate-fade-in bg-slate-900/15 dark:bg-slate-950/25"
        />
      ) : null}
      {targetRect ? (
        // The spotlight: a ring around the target whose giant box-shadow
        // dims everything else. pointer-events-none so the user can still
        // interact with whatever is highlighted; portalled menus (higher
        // z / later portals) paint above the dim. transition-all makes it
        // glide when the rect moves between steps; fade-in covers its
        // first appearance.
        <div
          aria-hidden
          className={`pointer-events-none fixed ${layer === 'modal' ? 'z-[calc(var(--z-modal)+1)]' : 'z-[var(--z-overlay)]'} animate-fade-in rounded-xl border-2 border-brand-400 transition-all duration-long ease-out dark:border-brand-500`}
          style={{
            left: targetRect.left - pad,
            top: targetRect.top - pad,
            width: targetRect.width + pad * 2,
            height: targetRect.height + pad * 2,
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
