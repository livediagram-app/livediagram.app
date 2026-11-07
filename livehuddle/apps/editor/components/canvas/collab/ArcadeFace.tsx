'use client';

// The Arcade Machine's live face (docs/specs/009-elements/social-pieces.md "Arcade Machine", "The panel"; blueprint
// "The panel"): while you stand at it, the Insert Coin bubble, and the whole cabinet one press that opens its game;
// Enter or Space do the same. The game's panel (Moon Mail, the model, its painter and the High Scores) loads with
// lazy() the first time it opens, so none of it is in a Space's first load (app/arcade-lazy.test.ts).
//
// Away from the machine this draws nothing, and a click on the cabinet walks you to its front (avatar-click-intent).

import { lazy, Suspense, useEffect, useState } from 'react';
import type { ShapeElement } from '@livehuddle/document';
import { claimAvatarKeys, type ClaimedKey } from '@liveworkspace/avatar/key-claims';
import { walkInputBlocked } from '@liveworkspace/avatar/walk-guard';
import { isEnterActivatedTarget, isTypingTarget } from '@liveworkspace/workbench/lib/typing-target';
import { useLatest } from '@liveworkspace/workbench/hooks/ui/useLatest';
import { pieceControlProps } from '@/lib/piece-control';
import { ReaderShell } from './ReaderShell';
import { useNearArcade } from './useSocialPieces';

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
      e.preventDefault();
      openRef.current();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      release();
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [on, openRef]);
}

export function ArcadeFace({ element }: { element: ShapeElement }) {
  const near = useNearArcade(element.id);
  const [open, setOpen] = useState(false);
  useOpenKeys(near && !open, () => setOpen(true));
  const close = () => setOpen(false);
  return (
    <>
      {near ? (
        <>
          <span className="sr-only" role="status">
            Insert Coin
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
            <span
              aria-hidden
              className="lh-coin-bubble absolute bottom-[calc(100%+6px)] left-1/2 whitespace-nowrap rounded-xl border-2 border-slate-800 bg-white px-2 py-1 text-[10px] font-bold text-slate-800 shadow-md transition-colors group-hover:bg-amber-50 dark:border-slate-200 dark:bg-slate-900 dark:text-slate-100 dark:group-hover:bg-slate-800"
              style={{ transform: 'translateX(-50%)' }}
            >
              Insert Coin
            </span>
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
    <ReaderShell title="Moon Mail" onClose={onClose} widthClassName="max-w-[360px]">
      <p
        className="flex aspect-square items-center justify-center text-[13px] text-slate-500 dark:text-slate-400"
        role="status"
      >
        Loading…
      </p>
    </ReaderShell>
  );
}
