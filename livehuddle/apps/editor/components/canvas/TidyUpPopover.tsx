'use client';

import { useEffect, useId, useState } from 'react';
import type { DockAnchor } from '@/lib/canvas-chrome';
import { verdictLine, type CleanupVerdict } from '@/lib/tidy-verdict';
import { loadTidyEngine } from '@/lib/tidy-engine';
import { MovablePanel } from '@/components/primitives/MovablePanel';
import {
  onMouseHover,
  useRevertOnUnmount,
} from '@liveworkspace/workbench/components/primitives/hover-preview';
import { useLatest } from '@liveworkspace/workbench/hooks/ui/useLatest';
import { AutoAlignDrawing } from './tidy-up-drawings';
import type { TidyUpActions } from './tidy-up-actions';

// The Tidy Up popover (docs/specs/008-canvas/layout-cleanup.md "The popover"): Auto-align one press away, over
// its cluster button, as a row with a drawing of what it does. Hovering it with a mouse lays the tab out behind
// the popover (useCleanupPreview); pressing it commits that layout as one undoable step. Auto Layout's style
// tiles left livehuddle (Work Tracker #423, part 4).

export const ALIGN_NAME = 'Auto-align';
const ALIGN_LINE = 'Snap to the grid. Nothing moves far.';
export const TIDY_EMPTY_NOTE =
  'Nothing to tidy yet. Add some notes or pictures to this Space first.';
export const TIDY_LOCKED_NOTE = 'This tab is locked. Unlock it to tidy its layout.';

const NO_MOVE = () => {};

export function TidyUpPopover({
  actions,
  empty,
  anchor,
  onClose,
}: {
  actions: TidyUpActions;
  // The active tab has nothing on it.
  empty: boolean;
  anchor?: DockAnchor;
  onClose: () => void;
}) {
  const { run, preview, endPreview, blocked, assess } = actions;
  const inert = blocked || empty;
  // Auto-align is judged once, on the tab as it was when the popover opened (useCleanupPreview judges the
  // pre-hover snapshot), and greyed out with the reason if it would change nothing or damage the drawing
  // (docs/specs/008-canvas/layout-cleanup.md "A tidy never trashes the work"). Judged in a task after the first
  // paint, so opening never waits on it; a press before then is judged at the press instead.
  const verdict = useVerdict(inert ? null : assess);
  const reason = verdict ? verdictLine(verdict) : null;
  // The popover can close (outside press, Escape, a second press of its button) with the pointer still
  // on the row, and pointerleave does not fire on unmount.
  useRevertOnUnmount(endPreview);

  // Escape closes it, like the menus it sits beside.
  const onCloseRef = useLatest(onClose);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCloseRef]);

  const choose = () => {
    // End the preview FIRST: its revert and the command's commit are two updaters in one React batch,
    // so they compose in this order and undo lands on the layout the author actually had.
    endPreview();
    run(verdict !== null);
    onClose();
  };
  const disabled = inert || reason !== null;
  const hover = disabled
    ? {}
    : {
        onPointerEnter: onMouseHover(preview),
        onPointerLeave: onMouseHover(endPreview),
      };
  const note = blocked ? TIDY_LOCKED_NOTE : empty ? TIDY_EMPTY_NOTE : null;

  return (
    <MovablePanel
      title="Tidy Up"
      helpArticle="layoutCleanup"
      position={null}
      defaultCorner="bottom-right"
      onMoveTo={NO_MOVE}
      popoverOpen
      popoverAnchor={anchor}
      asPopover
      popoverWidth="w-80"
      dismissOnOutside
      onPopoverClose={onClose}
    >
      <div className="flex flex-col gap-2 px-3 pb-3">
        {note ? <p className="text-xs text-slate-500 dark:text-slate-400">{note}</p> : null}
        <AlignRow reason={reason} disabled={disabled} onChoose={choose} hover={hover} />
      </div>
    </MovablePanel>
  );
}

// The verdict on Auto-align, filled in a task after the popover has painted. `assess` null (an empty or
// locked tab) judges nothing.
function useVerdict(assess: (() => CleanupVerdict) | null): CleanupVerdict | null {
  const [verdict, setVerdict] = useState<CleanupVerdict | null>(null);
  const assessRef = useLatest(assess);
  const judge = assess !== null;
  useEffect(() => {
    if (!judge) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let live = true;
    // The tidier loads on demand (lib/tidy-engine.ts); judging starts once it is here.
    void loadTidyEngine().then(() => {
      if (!live) return;
      timer = setTimeout(() => {
        const fn = assessRef.current;
        if (fn) setVerdict(fn());
      }, 0);
    });
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [judge, assessRef]);
  return verdict;
}

// Auto-align: its drawing beside its name and line.
function AlignRow({
  reason,
  disabled,
  onChoose,
  hover,
}: {
  // Why it is greyed out, shown in place of its line; null when it is offered.
  reason: string | null;
  disabled: boolean;
  onChoose: () => void;
  hover: Partial<
    Pick<React.HTMLAttributes<HTMLButtonElement>, 'onPointerEnter' | 'onPointerLeave'>
  >;
}) {
  const lineId = useId();
  return (
    <button
      type="button"
      data-tidy-kind="align"
      disabled={disabled}
      aria-describedby={lineId}
      onClick={onChoose}
      {...hover}
      className="group flex w-full min-w-0 flex-row items-center gap-3 rounded-lg border border-slate-200 bg-white p-2 text-left transition-colors duration-micro hover:border-brand-400 hover:bg-brand-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 disabled:cursor-not-allowed disabled:hover:border-slate-200 disabled:hover:bg-white motion-reduce:transition-none dark:border-slate-700 dark:bg-slate-900 dark:hover:border-brand-400 dark:hover:bg-brand-500/10 dark:disabled:hover:border-slate-700 dark:disabled:hover:bg-slate-900"
    >
      <span className="flex h-11 w-14 shrink-0 items-center justify-center rounded-md bg-slate-50 group-disabled:opacity-50 group-hover:bg-white group-disabled:group-hover:bg-slate-50 dark:bg-slate-800/60 dark:group-hover:bg-slate-900">
        <AutoAlignDrawing />
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="text-sm font-medium text-slate-900 group-disabled:opacity-50 dark:text-slate-50">
          {ALIGN_NAME}
        </span>
        {/* The reason stays at full strength: it is the one thing a greyed-out row has to say. */}
        <span
          id={lineId}
          className={`text-xs ${
            reason ? 'text-amber-700 dark:text-amber-300' : 'text-slate-500 dark:text-slate-400'
          }`}
        >
          {reason ?? ALIGN_LINE}
        </span>
      </span>
    </button>
  );
}
