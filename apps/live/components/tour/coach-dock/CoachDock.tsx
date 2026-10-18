'use client';

// The coach dock (docs/specs/007-editor/coach-dock.md): the strip between the canvas and the tab bar that a tour
// speaks through, so it never covers the page it teaches. One component for its three states: the offer (Take the
// Tour, No Thanks), a step (its count and progress, Try it, End Tour, Back, Next) and the closing (help, Start). It
// draws into the dock slot (CoachDockSlot), which makes the canvas give up its room; with no slot mounted (a surface
// outside the editor) it stands at the bottom of the window instead.
import { useEffect, useEffectEvent, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { lucideCheck, lucideCircleHelp } from '@livediagram/icons/lucide';
import { Button, lucideGlyph, Portal, safeInlinePadding } from '@livediagram/ui';
import { useCoachSlot } from './coach-dock-slots';
import { stepAnnouncement } from './coach-dock-copy';
import { useDockFloor } from './useDockFloor';

const CheckIcon = lucideGlyph(lucideCheck, 12);
const HelpIcon = lucideGlyph(lucideCircleHelp, 16);

// Every control reaches a 44px tap area on a touch screen (touch-targets.md), vertically, as they sit 8px apart.
const TAP = 'relative touch-target-y';
// A phone's dock buttons share its width, each tall enough to press.
const PHONE_BUTTON = `${TAP} max-sm:h-10 max-sm:flex-1`;

export type CoachDockState = 'offer' | 'step' | 'closing';

export type CoachDockProps = {
  state: CoachDockState;
  // Names the tour: "Slides tour", "Show Me". Also the region's label.
  eyebrow: string;
  title: string;
  body: string;
  // The offer's length ("4 stops, about a minute").
  length?: string;
  // A step's place: 1-based, of the counted steps.
  step?: { n: number; of: number };
  // A step's one thing to do, and whether it is done.
  tryIt?: { label: string; done: boolean } | null;
  // The tour's picture, beside the offer and the closing on a desktop.
  art?: ReactNode;
  help?: { href: string; label: string };
  finish?: string;
  // Changes what the dock announces and replays its rise-in: the step's id.
  stepKey: string;
  onAccept?: () => void;
  onDecline?: () => void;
  onBack?: (() => void) | undefined;
  onNext?: () => void;
  onEnd?: () => void;
  onFinish?: () => void;
  // A pointer over the dock, or focus inside it: the fold timer waits.
  onHoldChange?: (hold: boolean) => void;
};

export function CoachDock(props: CoachDockProps) {
  const slot = useCoachSlot('dock');
  const dock = <CoachDockBody {...props} />;
  if (slot) return createPortal(dock, slot);
  return (
    <Portal>
      <div className="fixed inset-x-0 bottom-0 z-[var(--z-toast)]">{dock}</div>
    </Portal>
  );
}

function CoachDockBody({
  state,
  eyebrow,
  title,
  body,
  length,
  step,
  tryIt,
  art,
  help,
  finish = 'Start',
  stepKey,
  onAccept,
  onDecline,
  onBack,
  onNext,
  onEnd,
  onFinish,
  onHoldChange,
}: CoachDockProps) {
  const ref = useRef<HTMLDivElement>(null);
  useDockFloor(ref);

  // Hold the fold timer while the person is over or inside the dock.
  const [pointerIn, setPointerIn] = useState(false);
  const [focusIn, setFocusIn] = useState(false);
  const hold = pointerIn || focusIn;
  const holdChanged = useEffectEvent((h: boolean) => onHoldChange?.(h));
  useEffect(() => holdChanged(hold), [hold]);

  // Escape from inside the dock declines the offer, ends a step and finishes from the closing. Escape anywhere
  // else is the page's own: closing a popover a step opened is not ending the tour.
  const onEscape = useEffectEvent((e: KeyboardEvent) => {
    if (e.key !== 'Escape' || e.defaultPrevented) return;
    if (!ref.current?.contains(document.activeElement)) return;
    if (state === 'offer') onDecline?.();
    else if (state === 'step') onEnd?.();
    else onFinish?.();
  });
  useEffect(() => {
    const listener = (e: KeyboardEvent) => onEscape(e);
    document.addEventListener('keydown', listener);
    return () => document.removeEventListener('keydown', listener);
  }, []);

  const announcement =
    state === 'step' && step ? stepAnnouncement(eyebrow, step.n, step.of, title) : title;
  const showArt = art && state !== 'step';

  return (
    <div
      ref={ref}
      data-coach-dock={state}
      // The editor's surfaces treat a press here as the tour's, never as an outside press: a popover a step opened
      // stays open while the person presses Next (TitlePopoverButton, PagePanel, the palette's menus).
      data-tour-popover=""
      role="region"
      aria-label={eyebrow}
      onPointerDown={(e) => e.stopPropagation()}
      // A press never takes focus: it stays where the person was working (a field, a sheet's grid).
      onMouseDown={(e) => e.preventDefault()}
      // A mouse moving over the dock holds it; one merely resting where the dock appeared does not, nor does a
      // touch (a tap that opened a template must not hold the offer up for good).
      onPointerMove={(e) => {
        if (e.pointerType === 'mouse' && !pointerIn) setPointerIn(true);
      }}
      onPointerLeave={() => setPointerIn(false)}
      onFocus={() => setFocusIn(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setFocusIn(false);
      }}
      className="relative border-t border-slate-200 bg-white text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
    >
      <div
        // Keyed on the step, so each one rises in afresh; only its contents move, never the dock's height.
        key={stepKey}
        style={safeInlinePadding('1rem')}
        className="mx-auto flex max-w-6xl animate-fly-up-in flex-col gap-3 py-3 motion-reduce:animate-none sm:min-h-[7.25rem] sm:flex-row sm:items-center sm:gap-5 sm:py-3.5"
      >
        {showArt ? (
          <div
            aria-hidden
            className="hidden w-28 shrink-0 overflow-hidden rounded-lg bg-slate-50 sm:block dark:bg-slate-800 [&_svg]:h-auto [&_svg]:w-full"
          >
            {art}
          </div>
        ) : null}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 pr-24 sm:pr-0">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-brand-700 dark:text-brand-300">
              {eyebrow}
            </span>
            {state === 'step' && step ? (
              <>
                <span className="text-xs font-medium tabular-nums text-slate-500 dark:text-slate-400">
                  {step.n} of {step.of}
                </span>
                <Progress n={step.n} of={step.of} />
              </>
            ) : null}
            {state === 'offer' && length ? (
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                {length}
              </span>
            ) : null}
            {state === 'closing' ? (
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Complete
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-sm font-semibold text-balance sm:text-[15px]">{title}</p>
          <p className="mt-0.5 max-w-[52rem] text-[13px] leading-relaxed text-slate-600 dark:text-slate-300">
            {body}
          </p>
          {tryIt ? <TryItLine label={tryIt.label} done={tryIt.done} /> : null}
        </div>
        <div className="flex shrink-0 items-center gap-2 max-sm:w-full">
          {state === 'offer' ? (
            <>
              <Button variant="secondary" onClick={onDecline} className={PHONE_BUTTON}>
                No Thanks
              </Button>
              <Button onClick={onAccept} className={PHONE_BUTTON}>
                Take the Tour
              </Button>
            </>
          ) : state === 'step' ? (
            <>
              <Button
                variant="ghost"
                onClick={onEnd}
                // On a phone End Tour sits at the dock's top right, so the row keeps two equal buttons.
                className={`${TAP} max-sm:absolute max-sm:right-2 max-sm:top-2 max-sm:px-2 max-sm:text-xs`}
              >
                End Tour
              </Button>
              {onBack ? (
                <Button variant="secondary" onClick={onBack} className={PHONE_BUTTON}>
                  Back
                </Button>
              ) : null}
              <Button onClick={onNext} className={PHONE_BUTTON}>
                {step && step.n === step.of ? 'Finish' : 'Next'}
              </Button>
            </>
          ) : (
            <>
              {help ? (
                <a
                  href={help.href}
                  target="_blank"
                  rel="noreferrer"
                  className="relative touch-target-y inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm font-medium text-brand-700 underline-offset-2 transition hover:underline max-sm:flex-1 max-sm:justify-center dark:text-brand-300"
                >
                  <HelpIcon aria-hidden />
                  {help.label}
                </a>
              ) : null}
              <Button onClick={onFinish} className={PHONE_BUTTON}>
                {finish}
              </Button>
            </>
          )}
        </div>
      </div>
      <span className="sr-only" aria-live="polite">
        {announcement}
      </span>
    </div>
  );
}

function Progress({ n, of }: { n: number; of: number }) {
  return (
    <span
      role="progressbar"
      aria-label="Tour progress"
      aria-valuemin={1}
      aria-valuemax={of}
      aria-valuenow={n}
      className="flex w-20 gap-1"
    >
      {Array.from({ length: of }, (_, i) => (
        <span
          key={i}
          className={`h-1 flex-1 rounded-full transition-colors duration-long motion-reduce:transition-none ${
            i < n ? 'bg-brand-600 dark:bg-brand-400' : 'bg-slate-200 dark:bg-slate-700'
          }`}
        />
      ))}
    </span>
  );
}

function TryItLine({ label, done }: { label: string; done: boolean }) {
  return (
    <p
      data-try-it={done ? 'done' : 'todo'}
      className={`mt-2 flex items-center gap-2 text-xs font-medium ${
        done ? 'text-emerald-700 dark:text-emerald-300' : 'text-slate-600 dark:text-slate-300'
      }`}
    >
      <span
        aria-hidden
        className={`grid h-4 w-4 shrink-0 place-items-center rounded-full border-[1.5px] transition-colors duration-short motion-reduce:transition-none ${
          done
            ? 'border-emerald-600 bg-emerald-600 text-white dark:border-emerald-400 dark:bg-emerald-400 dark:text-slate-900'
            : 'border-brand-600 text-transparent dark:border-brand-400'
        }`}
      >
        <CheckIcon />
      </span>
      {done ? 'Done' : `Try it: ${label}`}
    </p>
  );
}
