'use client';

import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import {
  SHARE_STATE_META,
  shareStatesLabel,
  type ShareState,
  type VisibilityActions,
} from './share-states';
import { VisibilityLegend } from './VisibilityLegend';
import { VISIBILITY_TONE } from '@liveworkspace/explorer/visibility-tones';

// The corner card's Share button (docs/specs/007-editor/editor-app.md "Header actions", owner 2026-11-19): its words
// wear the item's visibility (Offline grey, Private green, Shared blue, Team violet, Public pink), and on a
// computer hovering it opens the visibility legend the header's badge used to (VisibilityLegend: who can see this,
// on one scale), right-aligned under the button, with Change Who Can See This opening Share. A press opens Share.

// The resolution lives with the states (share-states); kept here for the callers that import it from the button.
export { shareStateOf, shareStatesOf, type ItemVisibility } from './share-states';

// Each state's words, its hue from the one table (4.5:1 on the card in both looks).
const INK: Record<ShareState, string> = {
  private: VISIBILITY_TONE.private.ink,
  shared: VISIBILITY_TONE.shared.ink,
  team: VISIBILITY_TONE.team.ink,
  community: VISIBILITY_TONE.public.ink,
  offline: VISIBILITY_TONE.browser.ink,
};

// Several states at once (owner 2026-11-19, "combine the two colors in some meaningful way"): the word sweeps from one
// state's hue to the next, left to right in ladder order (Shared, Team, Public), light 700s and dark 300s. One literal
// class string per combination, so Tailwind's scanner sees every class. Every point of each sweep reads 4.5:1 on the
// card and its hover wash (share-ink.test.ts). The word is the button's direct `span` child (the caller's label).
const SWEEP_WORD = '[&>span]:bg-gradient-to-r [&>span]:bg-clip-text [&>span]:text-transparent';
export const SHARE_SWEEP: Record<string, string> = {
  'shared team': `${SWEEP_WORD} [&>span]:from-blue-700 [&>span]:to-violet-700 dark:[&>span]:from-blue-300 dark:[&>span]:to-violet-300`,
  'shared community': `${SWEEP_WORD} [&>span]:from-blue-700 [&>span]:to-pink-700 dark:[&>span]:from-blue-300 dark:[&>span]:to-pink-300`,
  'team community': `${SWEEP_WORD} [&>span]:from-violet-700 [&>span]:to-pink-700 dark:[&>span]:from-violet-300 dark:[&>span]:to-pink-300`,
  'shared team community': `${SWEEP_WORD} [&>span]:from-blue-700 [&>span]:via-violet-700 [&>span]:to-pink-700 dark:[&>span]:from-blue-300 dark:[&>span]:via-violet-300 dark:[&>span]:to-pink-300`,
};
// The glyph sweeps the same hues: its stroke is the gradient below, set through a custom property (a static class).
const SWEEP_GLYPH = '[&>svg]:[stroke:var(--share-sweep)]';

/** The button's ink: one state's hue, or the sweep for several (with its glyph's stroke). */
export function shareInk(states: readonly ShareState[]): string {
  const sweep = states.length > 1 ? SHARE_SWEEP[states.join(' ')] : undefined;
  return sweep ? `${INK[states[0]!]} ${sweep} ${SWEEP_GLYPH}` : INK[states[0] ?? 'private'];
}

// The glyph's gradient: across the 16-unit box every chrome glyph draws on (userSpaceOnUse, so the circles and lines
// share one sweep rather than each its own), each stop coloured by its state's ink through currentColor. Zero-sized
// and out of the button's flow.
function SweepGradient({ id, states }: { id: string; states: readonly ShareState[] }) {
  return (
    <svg
      aria-hidden
      width="0"
      height="0"
      className="pointer-events-none absolute"
      focusable="false"
    >
      <linearGradient id={id} gradientUnits="userSpaceOnUse" x1="2" y1="8" x2="14" y2="8">
        {states.map((s, i) => (
          <stop
            key={s}
            offset={i / (states.length - 1)}
            stopColor="currentColor"
            className={INK[s]}
          />
        ))}
      </linearGradient>
    </svg>
  );
}

// How long the legend stays after the pointer leaves the button or the legend, so crossing the gap never shuts it.
const LEGEND_CLOSE_GRACE_MS = 120;
// A beat's rest before it opens, so passing over the button on the way elsewhere never flashes it.
const LEGEND_OPEN_DELAY_MS = 150;

export function ShareVisibilityButton({
  state,
  states: statesIn,
  onOpenShare,
  actions,
  className,
  children,
}: {
  // The leading state, for anything that needs one value (`data-share-state`).
  state: ShareState;
  // Every state that applies, in ladder order (shareStatesOf); one, the leading state, when absent.
  states?: readonly ShareState[] | undefined;
  onOpenShare: () => void;
  // The legend's stops: each closes the legend and runs the app's own move to that audience.
  actions?: VisibilityActions | undefined;
  // The card's button classes (CORNER_BTN and its hover wash), less the words' colour, which the state sets.
  className: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  const ref = useRef<HTMLButtonElement>(null);
  const [at, setAt] = useState<{ top: number; right: number } | null>(null);
  const show = (delay: number) => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setOpen(true), delay);
  };
  const hide = () => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setOpen(false), LEGEND_CLOSE_GRACE_MS);
  };
  useEffect(() => () => window.clearTimeout(timer.current), []);
  useEffect(() => {
    if (!open) return;
    const r = ref.current?.getBoundingClientRect();
    if (r) setAt({ top: r.bottom, right: window.innerWidth - r.right });
  }, [open]);
  const states = statesIn?.length ? statesIn : [state];
  const sweepId = `share-sweep-${useId().replace(/[^\w-]/g, '')}`;
  const sweeps = states.length > 1 && !!SHARE_SWEEP[states.join(' ')];
  return (
    <>
      <button
        ref={ref}
        type="button"
        data-tour-id="share"
        data-share-state={state}
        data-share-states={states.join(' ')}
        onClick={() => {
          window.clearTimeout(timer.current);
          setOpen(false);
          onOpenShare();
        }}
        // A mouse only: a touch's hover would open it under the finger that is pressing Share.
        onPointerEnter={(e) => {
          if (e.pointerType === 'mouse') show(LEGEND_OPEN_DELAY_MS);
        }}
        onPointerLeave={(e) => {
          if (e.pointerType === 'mouse') hide();
        }}
        aria-label={`Share, ${shareStatesLabel(states)}`}
        aria-description={states.map((s) => SHARE_STATE_META[s].description).join(' ')}
        className={`${className} ${shareInk(states)}`}
        style={sweeps ? ({ '--share-sweep': `url(#${sweepId})` } as CSSProperties) : undefined}
      >
        {sweeps ? <SweepGradient id={sweepId} states={states} /> : null}
        {children}
      </button>
      {open && at
        ? createPortal(
            <div
              className="fixed z-[var(--z-popover)] max-sm:hidden"
              style={{ top: at.top, right: at.right }}
              onPointerEnter={() => show(0)}
              onPointerLeave={hide}
            >
              <VisibilityLegend
                current={state}
                states={states}
                align="floating"
                actions={
                  actions &&
                  (Object.fromEntries(
                    Object.entries(actions).map(([k, run]) => [
                      k,
                      run &&
                        (() => {
                          setOpen(false);
                          run();
                        }),
                    ]),
                  ) as VisibilityActions)
                }
                onManage={() => {
                  setOpen(false);
                  onOpenShare();
                }}
              />
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
