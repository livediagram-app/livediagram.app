'use client';

// What every tour draws (docs/specs/007-editor/coach-dock.md, blueprints/coach-dock.md "Behaviour and state"): the
// offer, folding into the tour chip when left alone; each step in the dock with its Try it, and the pointer at its
// control; the closing, folding away as completed. The mode tours, the Pages tour, the element tours and every Show
// Me draw through it. It reads the shared tour engine and keeps one state of its own: whether the offer has folded.
import { useState, type ReactNode } from 'react';
import { debugLog } from '@/lib/debug-log';
import type { TourEngine } from '../useTourEngine';
import { CoachChip } from './CoachChip';
import { CoachDock } from './CoachDock';
import type { TourWelcomeChoice } from '../tour-card-copy';
import { CoachPointer } from './CoachPointer';
import { RING_PAD_IN_DIALOG_PX, RING_PAD_PX, tourLength } from './coach-dock-copy';
import { useFoldTimer } from './useFoldTimer';
import { useTryIt } from './useTryIt';

export function CoachDockStage<Api>({
  engine,
  api,
  eyebrow,
  art,
  help,
  finish,
  chip,
  choices,
  layer = 'overlay',
  onFolded,
  onChipStart,
}: {
  engine: TourEngine<Api>;
  // The steps' facade, for a Try it's selector (only the tours whose steps carry one).
  api?: Api;
  // Names the tour: "Slides tour", "Show Me".
  eyebrow: string;
  art?: ReactNode;
  help: { href: string; label: string };
  // The closing's button: "Start", "Done".
  finish: string;
  // The tour chip's words, for an offered tour: "Slides Tour", and what it shows.
  chip?: { label: string; about: string };
  // An offer with more than one way in (the Plan tour's tracks): each starts the tour its own way.
  choices?: readonly TourWelcomeChoice[] | undefined;
  // 'modal' for a tour of a dialog (a Show Me inside one): its pointer rings controls over the dialog, roomier, and
  // the dock stands over the dialog's dim. A step may say so for itself (an element tour's step in its data dialog).
  layer?: 'overlay' | 'modal';
  onFolded?: () => void;
  onChipStart?: () => void;
}) {
  const { step, stepIndex, targetRect } = engine;
  const [hold, setHold] = useState(false);

  // The offer folds into the chip once left alone; a new offer starts unfolded. Adjusted during render.
  const [folded, setFolded] = useState(false);
  const [wasActive, setWasActive] = useState(engine.active);
  if (engine.active !== wasActive) {
    setWasActive(engine.active);
    if (engine.active) setFolded(false);
  }

  const card = step?.card;
  const offering = engine.active && card === 'welcome' && !folded;
  const closing = engine.active && card === 'outro';
  useFoldTimer(offering || closing, hold, () => {
    if (closing) {
      engine.next();
      return;
    }
    debugLog('[coach-dock] fold', { eyebrow });
    setFolded(true);
    onFolded?.();
  });

  // A step's Try it: resolved against the tour's page as the step shows.
  const selector =
    engine.active && step && !card && step.tryIt && api !== undefined
      ? step.tryIt.pressed(api)
      : null;
  const stepKey = step ? `${stepIndex}:${step.id}` : '';
  const tryItDone = useTryIt(selector, stepKey, engine.next);

  if (!engine.active || !step) return null;

  if (card === 'welcome' && folded) {
    return chip ? (
      <CoachChip
        label={chip.label}
        about={chip.about}
        onStart={() => {
          setFolded(false);
          onChipStart?.();
          // An offer of choices opens again to be chosen from; otherwise the tour starts at its first step.
          if (!choices) engine.next();
        }}
        onDismiss={engine.skip}
      />
    ) : null;
  }

  if (card === 'welcome') {
    return (
      <CoachDock
        state="offer"
        eyebrow={eyebrow}
        title={step.title}
        body={step.body}
        length={tourLength(engine.countableSteps)}
        art={art}
        choices={choices}
        stepKey={stepKey}
        onAccept={engine.next}
        onDecline={engine.skip}
        onHoldChange={setHold}
      />
    );
  }

  if (card === 'outro') {
    return (
      <CoachDock
        state="closing"
        eyebrow={eyebrow}
        title={step.title}
        body={step.body}
        art={art}
        help={help}
        finish={finish}
        overModal={layer === 'modal'}
        stepKey={stepKey}
        onFinish={engine.next}
        onHoldChange={setHold}
      />
    );
  }

  // Real steps count from 1: an offered tour's welcome sits at index 0, so a step's index is its number.
  const n = stepIndex + (engine.hasWelcome ? 0 : 1);
  const inDialog = (step.layer ?? layer) === 'modal';
  const layerClass = inDialog
    ? 'z-[calc(var(--z-modal)+1)]'
    : step.ringOverMenu
      ? 'z-[calc(var(--z-overlay)+1)]'
      : 'z-[var(--z-overlay)]';
  return (
    <>
      {/* Stepped aside for a dialog that is not the tour's (useTourEngine): the dock stays, the pointer goes. */}
      {targetRect && !engine.yielded ? (
        <CoachPointer
          rect={targetRect}
          n={n}
          layerClass={layerClass}
          pad={layer === 'modal' ? RING_PAD_IN_DIALOG_PX : RING_PAD_PX}
        />
      ) : null}
      <CoachDock
        state="step"
        eyebrow={eyebrow}
        title={step.title}
        body={step.body}
        step={{ n, of: engine.countableSteps }}
        tryIt={
          step.tryIt && api !== undefined ? { label: step.tryIt.label, done: tryItDone } : null
        }
        overModal={inDialog}
        stepKey={stepKey}
        onBack={n > 1 ? engine.back : undefined}
        onNext={engine.next}
        onEnd={engine.skip}
      />
    </>
  );
}
