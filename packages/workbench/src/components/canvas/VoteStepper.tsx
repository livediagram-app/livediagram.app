'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { plural } from '@liveworkspace/model-core/plural';
import { GlyphDisc, SOLID_BRAND_DARK } from '@liveworkspace/ui';
import { CounterScaled, useCanvasZoom } from './CanvasZoomContext';
import { useVoteBadge, voteBadgeShrinks, voteStepperCollapses } from './vote-badge';
import { VoteDot } from './VoteDot';

// The keys that cast and retract on the selected element, when the product has them
// (livediagram's docs/specs/012-collaboration/session-tools.md "Casting from the keyboard"). Absent, no button
// announces a key.
export type VoteKeyShortcuts = { add: string; remove: string };

// The stepper while casting is open, its badge on a small element at a zoomed-out view, or its dot on an element
// smaller still. Its own component so only a shown stepper reads the zoom: every element's overlay would otherwise
// render on each zoom frame.
export function VoteStepper({
  box,
  voteKey,
  name,
  myVotes,
  voteTotal,
  tallyHidden,
  canCast,
  keyShortcuts,
  onRetractVote,
  onCastVote,
}: {
  box: { width: number; height: number } | undefined;
  voteKey: string;
  name: string;
  myVotes: number;
  voteTotal: number;
  tallyHidden: boolean;
  canCast: boolean;
  keyShortcuts: VoteKeyShortcuts | undefined;
  onRetractVote?: (elementId: string) => void;
  onCastVote?: (elementId: string) => void;
}) {
  const zoom = useCanvasZoom();
  const shrunk = voteBadgeShrinks(box, zoom);
  const collapsed = voteStepperCollapses(box, zoom);
  // Shrinking to a dot lifts the fold too, so an open stepper closes and a later zoom in starts on the badge.
  const { ref: stepperRef, open, setOpen } = useVoteBadge(collapsed && !shrunk);
  // The badge opened from the keyboard hands focus to the stepper it opened: plus, or minus once plus is spent.
  const focusOnOpen = useRef(false);
  useEffect(() => {
    if (!open || !focusOnOpen.current) return;
    focusOnOpen.current = false;
    const buttons =
      stepperRef.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)');
    buttons?.[buttons.length - 1]?.focus();
  }, [open, stepperRef]);
  const countLabel = tallyHidden ? `Your ${plural(voteTotal, 'dot')}` : plural(voteTotal, 'vote');
  if (shrunk) {
    return <VoteDot label={`${countLabel} on ${name}`} myVotes={myVotes} voteTotal={voteTotal} />;
  }
  if (collapsed && !open) {
    return (
      <CounterScaled
        // Hung a third off the element's corner, so a small note keeps nearly all of its text in view.
        className="lvd-vote-badge absolute bottom-0 right-0 z-10 origin-bottom-right"
        // A press on the badge opens it; it must not reach the element, whose own press casts a dot.
        onPointerDown={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          aria-label={`${countLabel} on ${name}. Open the vote stepper`}
          aria-expanded={false}
          aria-keyshortcuts={
            keyShortcuts ? `${keyShortcuts.add} ${keyShortcuts.remove}` : undefined
          }
          onClick={(e) => {
            e.stopPropagation();
            // A keyboard press (Enter, Space) reports no pointer position, so it moves focus into the stepper.
            focusOnOpen.current = e.detail === 0;
            setOpen(true);
          }}
          className={
            // 44 px to touch though it draws 24 (VOTE_BADGE_PX): the ::before pad takes the finger.
            "pointer-events-auto relative flex h-6 min-w-[24px] translate-x-1/3 translate-y-1/3 cursor-pointer items-center justify-center gap-0.5 rounded-full px-1.5 text-[12px] font-semibold tabular-nums shadow-sm ring-2 ring-white transition before:absolute before:left-1/2 before:top-1/2 before:h-11 before:w-11 before:-translate-x-1/2 before:-translate-y-1/2 before:content-[''] focus-visible:outline-none focus-visible:ring-brand-500 dark:ring-slate-900 " +
            (myVotes > 0
              ? `bg-brand-700 text-white ${SOLID_BRAND_DARK}`
              : 'bg-white text-slate-700 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800')
          }
        >
          <span className="text-optical-centre">{voteTotal}</span>
          <span
            aria-hidden
            className={
              'text-optical-centre text-[13px] leading-none ' +
              (myVotes > 0 ? 'text-white' : 'text-brand-700 dark:text-brand-300')
            }
          >
            +
          </span>
        </button>
      </CounterScaled>
    );
  }
  return (
    <CounterScaled
      ref={stepperRef}
      // Sits INSIDE the element's bottom-right rather than hanging off
      // the corner: the stepper is a control you aim at, so it wants
      // clearance from the edge (and from a neighbour's stepper on a
      // tightly packed canvas).
      // Semi-transparent at rest, fully opaque on hover. On a small box
      // the stepper covers the label, and during a vote the label is the
      // whole point: you're choosing between them, so you have to be
      // able to read them. Hovering the ELEMENT (not the stepper, which
      // is a small target) brings it up solid to click.
      //
      // Gated on a real hover pointer: on touch there is no hover to
      // restore it with, so a permanently faded control would be worse
      // than an occluding one. `pointer-fine` covers both conditions:
      // a coarse pointer keeps the plain opaque stepper. A badge's opened
      // stepper (lvd-vote-stepper-open) is always solid and above its neighbours.
      className={
        'lvd-vote-stepper absolute bottom-1.5 right-1.5 origin-bottom-right transition-opacity' +
        (open ? ' lvd-vote-stepper-open z-10' : '')
      }
      // The stepper sits ON the element, whose own press casts a dot
      // too (docs/specs/012-collaboration/session-tools.md). Without this a click meant for minus would
      // bubble into that and immediately re-add what it removed.
      onPointerDown={(e) => e.stopPropagation()}
    >
      {/* Opaque in both modes: the pill sits on the element, and a sticky note is pale on a dark canvas too, so a
          translucent wash took the note's colour under light text and hid your own count. */}
      <div
        className={
          'pointer-events-auto flex items-center gap-1 rounded-full border p-1 shadow-sm ' +
          (myVotes > 0
            ? 'border-brand-300 bg-brand-50 dark:border-brand-500 dark:bg-brand-900'
            : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900')
        }
      >
        <VoteStepButton
          label={`Remove a dot from ${name}`}
          keyShortcut={keyShortcuts?.remove}
          disabled={myVotes === 0}
          onClick={() => onRetractVote?.(voteKey)}
        >
          &minus;
        </VoteStepButton>
        <span
          className={
            'min-w-[18px] text-center text-[13px] font-semibold tabular-nums ' +
            (myVotes > 0
              ? 'text-brand-700 dark:text-brand-100'
              : 'text-slate-600 dark:text-slate-300')
          }
          role="img"
          aria-label={countLabel}
        >
          {voteTotal}
        </span>
        <VoteStepButton
          label={`Add a dot to ${name}`}
          keyShortcut={keyShortcuts?.add}
          disabled={!canCast}
          onClick={() => onCastVote?.(voteKey)}
        >
          +
        </VoteStepButton>
      </div>
    </CounterScaled>
  );
}

// One end of the vote stepper. Small, square, and disabled rather than
// hidden at its limit so the row's width (and so the plus's position)
// never shifts under the pointer mid-vote.
function VoteStepButton({
  label,
  keyShortcut,
  disabled,
  onClick,
  children,
}: {
  label: string;
  // The key that does the same on the selected element, when the product has one: Tab walks elements inside the
  // canvas, so the key is the keyboard's way to this button.
  keyShortcut: string | undefined;
  disabled: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <GlyphDisc
      size={24}
      as="button"
      type="button"
      aria-label={label}
      aria-keyshortcuts={keyShortcut}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className="text-[15px] font-semibold text-slate-600 transition enabled:hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-30 dark:text-slate-300 dark:enabled:hover:bg-slate-700"
    >
      {children}
    </GlyphDisc>
  );
}
