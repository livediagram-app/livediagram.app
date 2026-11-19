'use client';

// The picking bar (liveworkspace/docs/specs/006-media/walkthroughs.md "Picking steps aside"): while Hide From Recording
// picks on the canvas, Tools and the set-up step out of sight (they covered a Dashboard tab's right-hand slots), and
// this slim card takes the recording bar's place (RecordDock): the hint, the hidden count, Hide Selection and Done.
// Done, or Escape (useHidden), ends picking and brings the set-up back.
import { Button, CountBadge } from '@liveworkspace/ui';
import { useEffect, useRef } from 'react';
import type { Walkthroughs } from '../useWalkthroughs';
import { HideIcon } from './icons';

export function PickingBar({ walkthroughs, card }: { walkthroughs: Walkthroughs; card: string }) {
  const { hiding, host } = walkthroughs;
  const count = hiding.hidden.size;
  // The set-up held the focus and has gone: Done takes it, so Enter or Space ends picking from the keyboard.
  const done = useRef<HTMLButtonElement>(null);
  useEffect(() => done.current?.focus({ preventScroll: true }), []);
  return (
    <section
      role="toolbar"
      aria-label="Hide From Recording"
      data-walkthrough-picking-bar=""
      // The recording bar's shape: a 12 px card whose controls sit 4 px in, their 8 px corners nesting in its own.
      className={`${card} flex items-center gap-2 !rounded-xl py-1 pl-3 pr-1`}
    >
      <HideIcon size={14} className="shrink-0 text-slate-500 dark:text-slate-400" />
      <span className="whitespace-nowrap text-[13px] font-medium text-slate-800 dark:text-slate-100">
        Press elements to hide them
      </span>
      {count > 0 ? <CountBadge count={count} label={`${count} hidden`} /> : null}
      <span aria-hidden className="h-5 w-px shrink-0 bg-slate-200 dark:bg-slate-700" />
      <Button
        variant="secondary"
        size="xs"
        onClick={() =>
          // The canvas's selection, then what the app picks elsewhere (a board's cards).
          hiding.hideAll([...host.selection(), ...(host.hideable?.selection?.() ?? [])])
        }
        className="!rounded-lg"
      >
        Hide Selection
      </Button>
      <Button
        ref={done}
        variant="primary"
        size="xs"
        onClick={() => hiding.setPicking(false)}
        className="!rounded-lg"
      >
        Done
      </Button>
    </section>
  );
}
