'use client';

import {
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { clamp, type PlanPalette } from '@livepages/document';
import { tourColourVars } from './tour-colours';
import { glideTransition } from './tour-motion';
import { placeTourPopover } from './tour-position';
import type { TourTargetRect } from './useTourEngine';

export { WELCOME_TOUR_COPY, type TourCardCopy, type TourWelcomeChoice } from './tour-card-copy';

// The tour's step card (docs/specs/007-editor/editor-tour.md): step count, title, copy, dots, Back / Next / Skip,
// anchored to the highlighted target. The bookend cards (the offer and the last card) are TourBanner's.
// Positioning is measured two-pass (render off-screen, measure, place) against the current target rect, before the
// first paint. One card for the whole run: it fades in on the first step (dialog-in), then glides beside the ring to
// each next step while its words cross-fade (useTourGlide), and otherwise follows its target exactly.
// A caret on the popover's edge points at the target, so the card reads
// as attached to what it explains — on phones the narrow viewport means
// side placements never fit, so steps naturally land below (or above)
// their target with the caret pointing up at it.
export function TourPopover({
  stepId,
  stepNumber,
  stepCount,
  title,
  body,
  targetRect,
  ariaPrefix = 'Tour',
  gliding = false,
  busy = false,
  palette,
  onBack,
  onNext,
  onSkip,
}: {
  // 1-based within the countable steps.
  stepNumber: number;
  stepCount: number;
  // The step the words are for: they cross-fade when it changes.
  stepId: string;
  title: string;
  body: string;
  // Viewport rect of the highlighted target; null while the step is still
  // preparing (the card then centres itself).
  targetRect: TourTargetRect | null;
  // Mid-glide to the next step's target: position changes animate (tour-motion.ts); otherwise they are immediate.
  gliding?: boolean;
  // The next step is preparing: the buttons wait, so a second press does not skip it.
  busy?: boolean;
  // The dialog label's lead ("Tour step 2 of 7: ...").
  ariaPrefix?: string;
  // The active tab's colours (tour-colours.ts): the card, its text and its accent wear them.
  palette: PlanPalette;
  onBack?: () => void;
  onNext: () => void;
  onSkip: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{
    left: number;
    top: number;
    // Which edge carries the caret (the side FACING the target), and how
    // far along that edge it sits, so the caret points at the target's
    // centre even after viewport clamping. Null = centred card, no caret.
    caret: { edge: 'top' | 'bottom' | 'left' | 'right'; offset: number } | null;
  } | null>(null);
  // The card's keys (docs/specs/007-editor/editor-tour.md "Keyboard"): Escape skips the tour, as Skip tour does (the
  // bookend banners take it from inside themselves, TourBanner); the right and left arrows are Next and Back. Not
  // while the key is editing something, where Escape puts the text back and the arrows move the caret (an element
  // tour asks for exactly that), nor when something else already took it, nor with a modifier held.
  const onKey = useEffectEvent((e: KeyboardEvent) => {
    if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
    const t = e.target;
    if (t instanceof HTMLElement && (t.isContentEditable || t.closest('input, textarea, select')))
      return;
    if (e.key !== 'Escape' && e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    // The tour's keys first: a menu a step opened takes focus and would otherwise move through its own items on the
    // arrows (the Shapes flyout stepping Square, Circle, Diamond) while the tour stood still.
    e.preventDefault();
    e.stopImmediatePropagation();
    // Between steps the arrows wait, as the buttons do; Escape still skips.
    if (busy && e.key !== 'Escape') return;
    if (e.key === 'Escape') onSkip();
    else if (e.key === 'ArrowRight') onNext();
    else if (onBack) onBack();
  });
  useEffect(() => {
    const listener = (e: KeyboardEvent) => onKey(e);
    window.addEventListener('keydown', listener, { capture: true });
    return () => window.removeEventListener('keydown', listener, { capture: true });
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
    window.addEventListener('resize', place);
    return () => window.removeEventListener('resize', place);
  }, [targetRect]);

  return (
    <div
      ref={ref}
      data-tour-popover=""
      role="dialog"
      aria-label={`${ariaPrefix} step ${stepNumber} of ${stepCount}: ${title}`}
      onPointerDown={(e) => e.stopPropagation()}
      className="pointer-events-auto fixed z-[var(--z-toast)] flex w-[22rem] max-w-[calc(100vw-1.5rem)] animate-tour-card-in flex-col rounded-2xl border border-[var(--tour-border)] bg-[var(--tour-card)] p-5 text-[var(--tour-text)] shadow-2xl shadow-slate-900/20 outline-none dark:shadow-black/40"
      style={{
        ...tourColourVars(palette),
        transition: glideTransition(gliding, ['left', 'top']),
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
              ? { left: pos.caret.offset - 7, transition: glideTransition(gliding, ['left']) }
              : { top: pos.caret.offset - 7, transition: glideTransition(gliding, ['top']) }
          }
        />
      ) : null}
      {/* Its buttons are small (xs), so on a touch screen each reaches a 44px-tall tap area
          (touch-targets.md); vertical only, as they sit side by side 8px apart. */}
      {/* Keyed on the step, so the words cross-fade in as the card glides to the next target. Between steps the
          buttons wait (busy). */}
      <div
        key={stepId}
        className={`flex animate-fade-in flex-col [&_button]:relative [&_button]:touch-target-y ${busy ? 'pointer-events-none [&_button]:opacity-50' : ''}`}
      >
        <>
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--tour-accent)]">
              {stepNumber} of {stepCount}
            </span>
            <button
              type="button"
              onClick={onSkip}
              className="rounded-md px-1.5 py-0.5 text-xs font-medium text-[var(--tour-muted)] transition hover:bg-[var(--tour-hover)] hover:text-[var(--tour-text)]"
            >
              Skip tour
            </button>
          </div>
          <h3 className="mt-2 text-[15px] font-semibold leading-snug">{title}</h3>
          <p className="mt-1.5 text-[13px] leading-relaxed text-[var(--tour-muted)]">{body}</p>
          <div className="mt-4 flex items-center justify-between gap-2">
            {/* Progress dots keep place without reading like pagination. */}
            <div className="flex items-center gap-1" aria-hidden>
              {Array.from({ length: stepCount }, (_, i) => (
                <span
                  key={i}
                  // The current step's dot is drawn long, so the row reads as where you are, not a count.
                  className={`h-1.5 rounded-full transition-[width] duration-long ease-out motion-reduce:transition-none ${
                    i === stepNumber - 1 ? 'w-4' : 'w-1.5'
                  } ${i < stepNumber ? 'bg-[var(--tour-accent)]' : 'bg-[var(--tour-border)]'}`}
                />
              ))}
            </div>
            <div className="flex items-center gap-2">
              {onBack ? (
                <button
                  type="button"
                  onClick={onBack}
                  className="inline-flex h-8 items-center rounded-lg px-3 text-[13px] font-medium text-[var(--tour-muted)] transition hover:bg-[var(--tour-hover)] hover:text-[var(--tour-text)]"
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
      className="inline-flex h-8 cursor-pointer items-center justify-center rounded-lg bg-[var(--tour-accent)] px-3.5 text-[13px] font-medium text-[var(--tour-on-accent)] transition hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--tour-accent)]"
    >
      {children}
    </button>
  );
}
