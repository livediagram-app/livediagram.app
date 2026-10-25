'use client';

import type { CSSProperties } from 'react';
import { Portal } from '@liveworkspace/ui';
import { TourPopover } from './TourPopover';
import { TOUR_CARD_COPY, type TourCardCopy } from './tour-card-copy';
import { TOUR_DIM } from './tour-motion';
import { TourSpotlight } from './TourSpotlight';
import { TourShield } from './TourShield';
import { useTourGlide } from './useTourGlide';
import type { TourEngine } from './useTourEngine';

// What a running tour draws (docs/specs/007-editor/editor-tour.md "The steps"), shared by every tour: the dimming
// highlight ring around a step's target and the step card, the last card included (centred, no ring). Nothing while
// the tour is not running. The card and the ring wear the active tab's colours, as the start panels do: each editor's
// TourStage hands them in as CSS variables (its tour-colours.ts).
//
// The hand-over between steps ("Motion", useTourGlide): the ring stays on the current target while the next step
// prepares (a menu opening, a panel scrolling), then the ring and the card glide to the next target together and the
// card's words cross-fade as it goes. One ring and one card for the whole run, never remounted per step. Once landed,
// both follow their target exactly, with no easing to lag behind a scroll or a zoom.
export function TourStage<Api>({
  engine,
  colours,
  ariaPrefix,
  copy,
  layer = 'overlay',
  pad = 6,
  blockInput = false,
}: {
  engine: TourEngine<Api>;
  // The card's CSS variables, from the active tab's palette (each editor's tourColourVars).
  colours: CSSProperties;
  // The popover's label before "step N of M" ("Tour", "Workshop tour").
  ariaPrefix?: string;
  // The last card's words: its eyebrow, help link and finish button.
  copy?: Partial<TourCardCopy>;
  // 'modal' draws the ring over a dialog, for a tour of one (a dialog's Show Me): just above the
  // dialog, just below the menus its controls open (AnchoredPopover), which stay lit.
  layer?: 'overlay' | 'modal';
  // The room between the target and its ring, in px (a dialog's tightly packed rows want more).
  pad?: number;
  // A step takes no clicks on the page, only on its card (the Diagram tour): a press on what a step opened (a palette
  // category's shape) closed it, and the step reopened it, flickering the page.
  blockInput?: boolean;
}) {
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
  // The last card asks nothing of the editor: no ring, no dim, no shield behind it.
  const anchored = !step.card;
  // The card speaks for the step on screen as soon as Next is pressed (a press must always visibly move the tour on),
  // waiting where it is, its buttons held and marked as waiting, until the step's target is ready to glide to. Before
  // the run's first target lands there is no card yet.
  const said = shown ? step : null;
  const words = { ...TOUR_CARD_COPY, ...copy };
  return (
    <Portal>
      {/* Nothing is drawn while the first step prepares, so the spotlight fades in once, as one layer; a step whose
          target went away mid-step dims the whole screen instead, at the spotlight's own shade. */}
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
      {said ? (
        <TourPopover
          stepId={said.id}
          // Steps count from 1; the last card sits outside the count.
          stepNumber={stepIndex + 1}
          stepCount={engine.countableSteps}
          title={said.title}
          body={said.body}
          targetRect={anchored ? targetRect : null}
          gliding={gliding}
          // Between steps the buttons wait: a second press would skip the step being prepared.
          busy={!engine.landed}
          colours={colours}
          {...(said.card === 'outro'
            ? {
                outro: {
                  eyebrow: words.outroEyebrow,
                  helpHref: words.helpHref,
                  finish: words.finish,
                },
              }
            : {})}
          {...(ariaPrefix ? { ariaPrefix } : {})}
          onBack={stepIndex > 0 ? engine.back : undefined}
          onNext={engine.next}
          onSkip={engine.skip}
        />
      ) : null}
    </Portal>
  );
}
