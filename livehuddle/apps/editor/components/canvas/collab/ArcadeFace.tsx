'use client';

// The Arcade Machine's live face (docs/specs/009-elements/social-pieces.md "Arcade Machine", "The panel"; blueprint
// "The panel"): while you stand at it, the Insert Coin bubble, and the whole cabinet one press that opens its game;
// Enter or Space do the same. The game's panel (Moon Mail, the model, its painter and the High Scores) loads with
// lazy() the first time it opens, so none of it is in a Space's first load (app/arcade-lazy.test.ts).
//
// Away from the machine this draws nothing, and a click on the cabinet walks you to its front (avatar-click-intent).

import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import type { ShapeElement } from '@livehuddle/document';
import { claimAvatarKeys, type ClaimedKey } from '@livehuddle/avatar/key-claims';
import { walkInputBlocked } from '@livehuddle/avatar/walk-guard';
import { isEnterActivatedTarget, isTypingTarget } from '@liveworkspace/workbench/lib/typing-target';
import { useLatest } from '@liveworkspace/workbench/hooks/ui/useLatest';
import { formatArcadeScore } from '@/lib/arcade/arcade-format';
import { pieceControlProps } from '@/lib/piece-control';
import { ReaderShell } from './ReaderShell';
import { pieceBubbleSide, pieceBubbleStyle, useSideInView } from '@/lib/piece-bubble-style';
import { PieceBubblePortal } from '../PieceBubbleLayer';
import { useArcadeBubbleSide, useNearArcade } from './useSocialPieces';

const ArcadePanel = lazy(() => import('./arcade/ArcadePanel'));

const isOpenKey = (e: ClaimedKey) =>
  (e.key === 'Enter' || e.key === ' ') && !e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey;

/** Enter or Space open the machine you stand at, while nothing else holds the keyboard. */
function useOpenKeys(on: boolean, open: () => void) {
  const openRef = useLatest(open);
  useEffect(() => {
    if (!on) return;
    // Held from the walk (Space jumps) and the message box (Enter opens it) for as long as you stand here.
    const release = claimAvatarKeys(isOpenKey);
    const onKeyDown = (e: KeyboardEvent) => {
      if (!isOpenKey(e) || e.repeat || e.defaultPrevented) return;
      if (isTypingTarget(e.target) || isEnterActivatedTarget(e.target) || walkInputBlocked())
        return;
      // The press is the machine's: kept from the canvas's held-Space pan, which would otherwise take Space first.
      e.preventDefault();
      e.stopPropagation();
      openRef.current();
    };
    // In the capture phase, ahead of the canvas's own document listeners (the held-Space pan claims Space there).
    window.addEventListener('keydown', onKeyDown, true);
    return () => {
      release();
      window.removeEventListener('keydown', onKeyDown, true);
    };
  }, [on, openRef]);
}

export function ArcadeFace({ element }: { element: ShapeElement }) {
  const near = useNearArcade(element.id);
  // Beside the cabinet (or below it) when a Room Sign stands where the bubble rises (Work Tracker 793).
  const bubbleRef = useRef<HTMLSpanElement>(null);
  // Kept in view: beside the cabinet only while the bubble fits on screen there, else below it.
  const side = useSideInView(useArcadeBubbleSide(element.id), bubbleRef);
  const [open, setOpen] = useState(false);
  useOpenKeys(near && !open, () => setOpen(true));
  const close = () => setOpen(false);
  // The machine's best, read from the element, so a score posted or a clear made on any screen shows as it lands.
  const best = element.arcadeScores?.[0];
  return (
    <>
      {near ? (
        <>
          <span className="sr-only" role="status">
            {best
              ? `Insert Coin. Best ${formatArcadeScore(best.score)} by ${best.name}`
              : 'Insert Coin'}
          </span>
          <button
            type="button"
            aria-label="Play Moon Mail"
            data-piece-main=""
            data-arcade-press=""
            {...pieceControlProps}
            onClick={(e) => {
              e.stopPropagation();
              setOpen(true);
            }}
            className="group pointer-events-auto absolute inset-0 cursor-pointer rounded-md outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
          >
            {/* Drawn over the characters (PieceBubbleLayer), so nobody standing at the machine covers it; still the
                cabinet's press, its click reaching the button through the portal. */}
            <PieceBubblePortal box={element}>
              <span
                ref={bubbleRef}
                aria-hidden
                data-bubble-side={side}
                {...pieceControlProps}
                className={`lh-coin-bubble pointer-events-auto absolute cursor-pointer ${pieceBubbleSide(side)} whitespace-nowrap text-center rounded-xl border-2 border-slate-800 bg-white px-2 py-1 text-[10px] font-bold text-slate-800 shadow-md transition-colors hover:bg-amber-50 group-hover:bg-amber-50 dark:border-slate-200 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800 dark:group-hover:bg-slate-800`}
                style={pieceBubbleStyle(side)}
              >
                Insert Coin
                {best ? (
                  <span
                    data-arcade-best=""
                    className="flex max-w-[140px] items-baseline justify-center gap-1 text-[10px] font-semibold text-slate-600 dark:text-slate-300"
                  >
                    <span className="shrink-0">
                      Best <span className="tabular-nums">{formatArcadeScore(best.score)}</span> ·
                    </span>
                    <span className="min-w-0 truncate">{best.name}</span>
                  </span>
                ) : null}
              </span>
            </PieceBubblePortal>
          </button>
        </>
      ) : null}
      {open ? (
        <Suspense fallback={<ArcadeLoading onClose={close} />}>
          <ArcadePanel element={element} onClose={close} />
        </Suspense>
      ) : null}
    </>
  );
}

/** The panel while its code loads: its frame, its name and Close, and Loading…. */
function ArcadeLoading({ onClose }: { onClose: () => void }) {
  return (
    // Focus on the panel, as the loaded one has it: a Space pressed while it loads must not press Close.
    <ReaderShell
      title="Moon Mail"
      onClose={onClose}
      widthClassName="max-w-[360px]"
      initialFocus="container"
    >
      <p
        className="flex aspect-square items-center justify-center text-[13px] text-slate-500 dark:text-slate-400"
        role="status"
      >
        Loading…
      </p>
    </ReaderShell>
  );
}
