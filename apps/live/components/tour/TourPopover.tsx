'use client';

import {
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { clamp, type PlanPalette } from '@livediagram/document';
import { tourColourVars } from './tour-colours';
import { placeTourPopover } from './tour-position';
import { TourHelpArt } from './TourHelpArt';
import { TourWelcomeArt } from './TourWelcomeArt';
import type { TourTargetRect } from './useTourEngine';

// The bookend cards' words, so a second tour (the Plan tour, docs/specs/026-plan/plan-tour.md) wears the
// same card with its own eyebrow, finish button and help link. The defaults are the Diagram tour's.
export type TourCardCopy = {
  welcomeEyebrow: string;
  accept: string;
  decline: string;
  outroEyebrow: string;
  helpHref: string;
  helpLabel: string;
  finish: string;
};

// A welcome card offering more than one way in (the Plan tour's Boards and Spreadsheets): each starts the tour
// its own way, in place of the single accept button.
export type TourWelcomeChoice = { id: string; label: string; onPick: () => void };

const WELCOME_TOUR_COPY: TourCardCopy = {
  welcomeEyebrow: 'Diagram tour',
  accept: 'Yes',
  decline: 'No',
  outroEyebrow: 'Tour complete',
  helpHref: '/help',
  helpLabel: 'Visit Help Centre',
  finish: 'Start diagramming',
};

// The tour's step card (docs/specs/007-editor/editor-tour.md). Two faces:
// - welcome: the centred offer card ("Yes" / "No"),
//   no step count, dots, or Back — declining must be one obvious click.
// - step: step count, title, copy, dots, Back / Next / Skip, anchored to
//   the highlighted target.
// Positioning is measured two-pass (render off-screen, measure, place)
// against the current target rect; once placed, left/top transitions are
// enabled so the card GLIDES between steps instead of teleporting, and
// the content slides directionally (the wizard's tip-next / tip-prev).
// A caret on the popover's edge points at the target, so the card reads
// as attached to what it explains — on phones the narrow viewport means
// side placements never fit, so steps naturally land below (or above)
// their target with the caret pointing up at it. The bookend cards stay
// centred everywhere.
export function TourPopover({
  stepNumber,
  stepCount,
  stepId,
  stepDir,
  card,
  title,
  body,
  targetRect,
  ariaPrefix = 'Tour',
  copy: copyOverrides,
  welcomeArt,
  welcomeChoices,
  palette,
  onBack,
  onNext,
  onSkip,
}: {
  // 1-based within the countable steps; 0 for the welcome card.
  stepNumber: number;
  stepCount: number;
  // Stable step id — keys the content wrapper so the slide animation
  // replays exactly once per step change.
  stepId: string;
  stepDir: 'forward' | 'backward';
  // Bookend cards ('welcome' / 'outro'): centred, no count/dots/Back,
  // with their own illustration + button set. Undefined = a normal step.
  card?: 'welcome' | 'outro';
  title: string;
  body: string;
  // Viewport rect of the highlighted target; null while the step is still
  // preparing (the card then centres itself).
  targetRect: TourTargetRect | null;
  // The dialog label's lead ("Tour step 2 of 7: ...").
  ariaPrefix?: string;
  copy?: Partial<TourCardCopy>;
  // The welcome card's illustration; the Diagram tour's own by default.
  welcomeArt?: ReactNode;
  welcomeChoices?: readonly TourWelcomeChoice[];
  // The active tab's colours (tour-colours.ts): the card, its text and its accent wear them.
  palette: PlanPalette;
  onBack?: () => void;
  onNext: () => void;
  onSkip: () => void;
}) {
  const copy = { ...WELCOME_TOUR_COPY, ...copyOverrides };
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{
    left: number;
    top: number;
    // Which edge carries the caret (the side FACING the target), and how
    // far along that edge it sits, so the caret points at the target's
    // centre even after viewport clamping. Null = centred card, no caret.
    caret: { edge: 'top' | 'bottom' | 'left' | 'right'; offset: number } | null;
  } | null>(null);
  // Position transitions are enabled one frame AFTER the first placement,
  // so the initial park-offscreen → placed jump doesn't animate as a fly-in
  // from the corner (a first-paint animation gate).
  const [animatePos, setAnimatePos] = useState(false);

  // The centred cards take the keyboard (docs/specs/007-editor/editor-tour.md): the offer and the last card are
  // dialogs over a dimmed editor, so focus moves onto the card (not a button: a stray Enter accepts nothing) and goes
  // back where it was when the card goes. A step card leaves focus on the control it points at.
  useEffect(() => {
    if (!card) return;
    const card$ = ref.current;
    if (!card$) return;
    const before = document.activeElement;
    card$.focus({ preventScroll: true });
    return () => {
      if (!card$.contains(document.activeElement) && document.activeElement !== document.body)
        return;
      if (before instanceof HTMLElement && before.isConnected)
        before.focus({ preventScroll: true });
    };
  }, [card, stepId]);

  // Escape is the card's way out (docs/specs/007-editor/editor-tour.md): it declines the offer, skips the tour from
  // a step and finishes it from the last card, as their buttons do. Not while the key is editing something, where
  // Escape puts the text back (an element tour asks for exactly that), nor when something else already took it.
  const onEscape = useEffectEvent((e: KeyboardEvent) => {
    if (e.key !== 'Escape' || e.defaultPrevented) return;
    const t = e.target;
    if (t instanceof HTMLElement && (t.isContentEditable || t.closest('input, textarea, select')))
      return;
    if (card === 'outro') onNext();
    else onSkip();
  });
  useEffect(() => {
    const listener = (e: KeyboardEvent) => onEscape(e);
    document.addEventListener('keydown', listener);
    return () => document.removeEventListener('keydown', listener);
  }, []);

  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    const place = () => {
      const size = { width: node.offsetWidth, height: node.offsetHeight };
      const viewport = { width: window.innerWidth, height: window.innerHeight };
      if (!targetRect) {
        setPos({
          left: (viewport.width - size.width) / 2,
          top: (viewport.height - size.height) / 2,
          caret: null,
        });
        return;
      }
      const placed = placeTourPopover(targetRect, size, viewport);
      let caret: NonNullable<typeof pos>['caret'] = null;
      if (placed.side === 'below' || placed.side === 'above') {
        caret = {
          edge: placed.side === 'below' ? 'top' : 'bottom',
          offset: clamp(targetRect.left + targetRect.width / 2 - placed.left, 18, size.width - 18),
        };
      } else if (placed.side === 'right' || placed.side === 'left') {
        caret = {
          edge: placed.side === 'right' ? 'left' : 'right',
          offset: clamp(targetRect.top + targetRect.height / 2 - placed.top, 18, size.height - 18),
        };
      }
      setPos({ left: placed.left, top: placed.top, caret });
    };
    place();
    const raf = requestAnimationFrame(() => setAnimatePos(true));
    window.addEventListener('resize', place);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', place);
    };
  }, [targetRect, stepId]);

  return (
    <div
      ref={ref}
      data-tour-popover=""
      role="dialog"
      aria-label={card ? title : `${ariaPrefix} step ${stepNumber} of ${stepCount}: ${title}`}
      tabIndex={card ? -1 : undefined}
      onPointerDown={(e) => e.stopPropagation()}
      className={`pointer-events-auto fixed z-[var(--z-toast)] flex outline-none max-w-[calc(100vw-1.5rem)] flex-col gap-2 rounded-xl border border-[var(--tour-border)] bg-[var(--tour-card)] p-4 text-[var(--tour-text)] shadow-2xl shadow-slate-900/20 dark:shadow-black/40 ${
        card ? 'w-[21rem]' : 'w-80'
      } ${animatePos ? 'transition-[left,top] duration-long ease-out' : ''}`}
      style={{
        ...tourColourVars(palette),
        ...(pos
          ? { left: pos.left, top: pos.top }
          : // First paint before measurement: park off-screen so the
            // two-pass placement never flashes at 0,0.
            { left: -9999, top: -9999 }),
      }}
    >
      {/* The caret: a rotated square on the edge facing the target (the
          MovablePanel dock-popover arrow recipe), so the card visibly
          points at what it explains. */}
      {pos?.caret ? (
        <span
          aria-hidden
          className={`absolute h-3.5 w-3.5 rotate-45 bg-[var(--tour-card)] ${
            pos.caret.edge === 'top'
              ? '-top-[7px] rounded-tl-sm border-l border-t'
              : pos.caret.edge === 'bottom'
                ? '-bottom-[7px] rounded-br-sm border-b border-r'
                : pos.caret.edge === 'left'
                  ? '-left-[7px] rounded-bl-sm border-b border-l'
                  : '-right-[7px] rounded-tr-sm border-r border-t'
          } border-[var(--tour-border)]`}
          style={
            pos.caret.edge === 'top' || pos.caret.edge === 'bottom'
              ? { left: pos.caret.offset - 7 }
              : { top: pos.caret.offset - 7 }
          }
        />
      ) : null}
      {/* Keyed on the step so each phase slides in directionally (forward
          from the right, back from the left) — the same motion the New
          Document wizard uses between its phases. */}
      {/* Its buttons are small (xs), so on a touch screen each reaches a 44px-tall tap area
          (touch-targets.md); vertical only, as they sit side by side 8px apart. */}
      <div
        key={stepId}
        className={`flex flex-col gap-2 [&_button]:relative [&_button]:touch-target-y ${stepDir === 'forward' ? 'animate-tip-next' : 'animate-tip-prev'}`}
      >
        {card ? (
          <>
            {card === 'welcome' ? (welcomeArt ?? <TourWelcomeArt />) : <TourHelpArt />}
            <span className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--tour-accent)]">
              {card === 'welcome' ? copy.welcomeEyebrow : copy.outroEyebrow}
            </span>
            <h3 className="text-base font-semibold">{title}</h3>
            <p className="text-xs leading-relaxed text-[var(--tour-muted)]">{body}</p>
            {card === 'welcome' ? (
              <div className="mt-2 flex items-center justify-end gap-2">
                {/* Declining is a first-class, same-weight choice — the offer
                    must never feel like a trap. It also never comes back. */}
                <button
                  type="button"
                  onClick={onSkip}
                  className="rounded-md px-3 py-1.5 text-xs font-medium text-[var(--tour-muted)] transition hover:bg-[var(--tour-hover)] hover:text-[var(--tour-text)]"
                >
                  {copy.decline}
                </button>
                {welcomeChoices ? (
                  welcomeChoices.map((choice) => (
                    <AccentButton key={choice.id} onClick={choice.onPick}>
                      {choice.label}
                    </AccentButton>
                  ))
                ) : (
                  <AccentButton onClick={onNext}>{copy.accept}</AccentButton>
                )}
              </div>
            ) : (
              // The finish button never breaks mid-label: it takes its own right-aligned row under the help
              // link when the card is too narrow for both.
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                <a
                  href={copy.helpHref}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs font-medium text-[var(--tour-accent)] underline-offset-2 transition hover:underline"
                >
                  {copy.helpLabel}
                </a>
                <div className="ml-auto flex items-center gap-2 whitespace-nowrap">
                  <AccentButton onClick={onNext}>{copy.finish}</AccentButton>
                </div>
              </div>
            )}
          </>
        ) : (
          <>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--tour-accent)]">
                {stepNumber} of {stepCount}
              </span>
              <button
                type="button"
                onClick={onSkip}
                className="text-[11px] font-medium text-[var(--tour-muted)] transition hover:text-[var(--tour-text)]"
              >
                Skip tour
              </button>
            </div>
            <h3 className="text-sm font-semibold">{title}</h3>
            <p className="text-xs leading-relaxed text-[var(--tour-muted)]">{body}</p>
            <div className="mt-1 flex items-center justify-between gap-2">
              {/* Progress dots keep place without reading like pagination. */}
              <div className="flex items-center gap-1" aria-hidden>
                {Array.from({ length: stepCount }, (_, i) => (
                  <span
                    key={i}
                    className={`h-1.5 w-1.5 rounded-full ${
                      i < stepNumber
                        ? 'bg-[var(--tour-accent)]'
                        : 'bg-[var(--tour-border)] opacity-50'
                    }`}
                  />
                ))}
              </div>
              <div className="flex items-center gap-2">
                {onBack ? (
                  <button
                    type="button"
                    onClick={onBack}
                    className="rounded-md px-2 py-1 text-xs font-medium text-[var(--tour-muted)] transition hover:bg-[var(--tour-hover)] hover:text-[var(--tour-text)]"
                  >
                    Back
                  </button>
                ) : null}
                {/* The outro card always follows the counted steps, so a
                    counted step never ends the tour — no 'Done' state. */}
                <AccentButton onClick={onNext}>Next</AccentButton>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// The primary button in the tab's accent, its label in the ink that reads on it (tour-colours inkOn).
function AccentButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-7 cursor-pointer items-center justify-center rounded-md bg-[var(--tour-accent)] px-2.5 text-xs font-medium text-[var(--tour-on-accent)] transition hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--tour-accent)]"
    >
      {children}
    </button>
  );
}
