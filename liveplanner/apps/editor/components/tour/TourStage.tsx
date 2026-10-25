'use client';

import type { ReactNode } from 'react';
import { Portal } from '@liveplanner/ui';
import { useStartPalette } from '@/components/start/useStartPalette';
import { TourBanner } from './TourBanner';
import { TourPopover } from './TourPopover';
import { WELCOME_TOUR_COPY, type TourCardCopy, type TourWelcomeChoice } from './tour-card-copy';
import { TOUR_DIM } from '@liveworkspace/workbench/components/tour/tour-motion';
import { TourSpotlight } from './TourSpotlight';
import { TourShield } from '@liveworkspace/workbench/components/tour/TourShield';
import { useTourGlide } from './useTourGlide';
import type { TourEngine } from './useTourEngine';

// What a running tour draws (docs/specs/007-editor/editor-tour.md "The steps"), shared by every tour:
// the subtle backdrop behind a bookend card, the dimming highlight ring around a step's target, and the
// step popover. Nothing while the tour is not running. The card and the ring wear the active tab's colours, as the
// start panels do (useStartPalette, tour-colours.ts).
//
// The hand-over between steps ("Motion", useTourGlide): the ring stays on the current target while the next step
// prepares (a menu opening, a panel scrolling), then the ring and the card glide to the next target together and the
// card's words cross-fade as it goes. One ring and one card for the whole run, never remounted per step. Once landed,
// both follow their target exactly, with no easing to lag behind a scroll or a zoom.
export function TourStage<Api>({
  engine,
  ariaPrefix,
  copy,
  welcomeArt,
  welcomeChoices,
  layer = 'overlay',
  pad = 6,
  blockInput = false,
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
  // A step takes no clicks on the page, only on its card (the Diagram tour): a press on what a step opened (a palette
  // category's shape) closed it, and the step reopened it, flickering the page.
  blockInput?: boolean;
}) {
  const palette = useStartPalette();
  const { shown, gliding } = useTourGlide(engine);
  const { step, stepIndex, targetRect } = engine;
  // Stepped aside for a dialog that is not the tour's (useTourEngine): back on the same step once it closes.
  if (!engine.active || !step || engine.yielded) return null;
  const ringLayer = step.layer ?? layer;
  const z =
    ringLayer === 'modal'
      ? 'z-[calc(var(--z-modal)+1)]'
      : step.ringOverMenu
        ? 'z-[calc(var(--z-overlay)+1)]'
        : 'z-[var(--z-overlay)]';
  const anchored = !step.card;
  // The card speaks for the step on screen as soon as Next is pressed (a press must always visibly move the tour on),
  // waiting where it is, its buttons held and marked as waiting, until the step's target is ready to glide to. Before
  // the run's first target lands there is no card yet.
  const said = shown ? step : null;
  const saidIndex = stepIndex;
  return (
    <Portal>
      {/* The bookend cards ask nothing of the editor (TourBanner): no backdrop behind them. Nothing is drawn while
          the first step prepares, so the spotlight fades in once, as one layer; a step whose target went away
          mid-step dims the whole screen instead, at the spotlight's own shade. */}
      {anchored && engine.landed && !targetRect ? (
        <div
          aria-hidden
          className={`pointer-events-none fixed inset-0 ${z} animate-fade-in`}
          style={{ background: TOUR_DIM }}
        />
      ) : null}
      {anchored ? (
        <TourSpotlight rect={targetRect} gliding={gliding} pad={pad} layerClass={z} />
      ) : null}
      {anchored && blockInput ? <TourShield /> : null}
      {step.card ? (
        // The offer and the last card: a banner at the bottom, as the sign-in banner is (TourBanner).
        <TourBanner
          card={step.card}
          title={step.title}
          body={step.body}
          copy={{ ...WELCOME_TOUR_COPY, ...copy }}
          palette={palette}
          {...(welcomeArt ? { welcomeArt } : {})}
          {...(welcomeChoices ? { welcomeChoices } : {})}
          onNext={engine.next}
          onSkip={engine.skip}
        />
      ) : said ? (
        <TourPopover
          stepId={said.id}
          // Real steps count from 1 (welcome occupies index 0, so a step's index IS its number; a tour without one
          // counts from its first step).
          stepNumber={saidIndex + (engine.hasWelcome ? 0 : 1)}
          stepCount={engine.countableSteps}
          title={said.title}
          body={said.body}
          targetRect={targetRect}
          gliding={gliding}
          // Between steps the buttons wait: a second press would skip the step being prepared.
          busy={!engine.landed}
          palette={palette}
          {...(ariaPrefix ? { ariaPrefix } : {})}
          onBack={saidIndex > (engine.hasWelcome ? 1 : 0) ? engine.back : undefined}
          onNext={engine.next}
          onSkip={engine.skip}
        />
      ) : null}
    </Portal>
  );
}
