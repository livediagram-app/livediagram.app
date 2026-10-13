'use client';

import { useEffect, useId, useState } from 'react';
import type { DockAnchor } from '@/lib/canvas-chrome';
import { AUTO_LAYOUT_CHOICES, AUTO_LAYOUT_TILE_ORDER } from '@/lib/auto-layout-choices';
import type { CleanupKind } from '@/lib/tab-cleanup';
import { verdictLine, type CleanupVerdict } from '@/lib/tidy-verdict';
import { loadTidyEngine } from '@/lib/tidy-engine';
import { MovablePanel } from '@/components/primitives/MovablePanel';
import { onMouseHover, useRevertOnUnmount } from '@/components/primitives/hover-preview';
import { useLatest } from '@/hooks/ui/useLatest';
import { TidyUpDrawing } from './tidy-up-drawings';
import type { TidyUpActions } from './tidy-up-actions';

// The Tidy Up popover (docs/specs/008-canvas/layout-cleanup.md "The popover"): Diagram mode's layout
// tidiers one press away, over their cluster button. A tile per Auto Layout style, each a drawing of the
// layout it makes, then the Auto-align row. Hovering one with a mouse lays the tab out behind the popover
// (useCleanupPreview); pressing it commits that layout as one undoable step.

export const ALIGN_NAME = 'Auto-align';
export const ALIGN_LINE = 'Snap to the grid. Nothing moves far.';
export const TIDY_CAPTION = 'Rearrange shapes from the arrows between them.';
export const TIDY_EMPTY_NOTE = 'Nothing to tidy yet. Add some shapes and connect them with arrows.';
export const TIDY_LOCKED_NOTE = 'This tab is locked. Unlock it to tidy its layout.';
export const TIDY_LANES_NOTE = 'Your shapes sit in lanes, which keep the layout you gave them.';

const NO_MOVE = () => {};
const ALL_KINDS: readonly CleanupKind[] = [...AUTO_LAYOUT_TILE_ORDER, 'align'];

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
  // Each tidier is judged once, on the tab as it was when the popover opened (useCleanupPreview
  // judges the pre-hover snapshot), and greyed out with the reason if it would change nothing or
  // damage the drawing (docs/specs/008-canvas/layout-cleanup.md "A tidy never trashes the work").
  // One judgement per task after the first paint, so opening never waits on six layouts of a big
  // tab; a tile pressed before its turn is judged at the press instead.
  const verdicts = useVerdicts(inert ? null : assess);
  const reasonOf = (kind: CleanupKind) => {
    const v = verdicts[kind];
    return v ? verdictLine(v) : null;
  };
  // The popover can close (outside press, Escape, a second press of its button) with the pointer still
  // on a tile, and pointerleave does not fire on unmount.
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

  const choose = (kind: CleanupKind) => {
    // End the preview FIRST: its revert and the command's commit are two updaters in one React batch,
    // so they compose in this order and undo lands on the layout the author actually had.
    endPreview();
    run(kind, verdicts[kind] !== undefined);
    onClose();
  };
  const hover = (kind: CleanupKind) =>
    inert || reasonOf(kind)
      ? {}
      : {
          onPointerEnter: onMouseHover(() => preview(kind)),
          onPointerLeave: onMouseHover(endPreview),
        };

  // Every layout refused for the lanes says so once, over the tiles, rather than five times.
  const lanesHold = AUTO_LAYOUT_TILE_ORDER.every((k) => verdicts[k]?.kind === 'rearranges-lanes');
  const note = blocked
    ? TIDY_LOCKED_NOTE
    : empty
      ? TIDY_EMPTY_NOTE
      : lanesHold
        ? TIDY_LANES_NOTE
        : null;

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
      <div className="flex flex-col gap-3 px-3 pb-3">
        <section aria-label="Auto Layout" className="flex flex-col gap-2">
          <p className="text-xs text-slate-500 dark:text-slate-400">{note ?? TIDY_CAPTION}</p>
          <div className="grid grid-cols-2 gap-2">
            {AUTO_LAYOUT_TILE_ORDER.map((id) => (
              <TidyTile
                key={id}
                kind={id}
                name={AUTO_LAYOUT_CHOICES[id].tileName}
                line={AUTO_LAYOUT_CHOICES[id].tileLine}
                reason={reasonOf(id)}
                wide={id === 'smart'}
                disabled={inert || reasonOf(id) !== null}
                onChoose={choose}
                hover={hover(id)}
              />
            ))}
          </div>
        </section>
        <div className="border-t border-slate-100 pt-3 dark:border-slate-800">
          <TidyTile
            kind="align"
            name={ALIGN_NAME}
            line={ALIGN_LINE}
            reason={reasonOf('align')}
            row
            disabled={inert || reasonOf('align') !== null}
            onChoose={choose}
            hover={hover('align')}
          />
        </div>
      </div>
    </MovablePanel>
  );
}

// The verdict on each tidier, filled in one per task once the popover has painted. `assess` null
// (an empty or locked tab) judges nothing.
function useVerdicts(
  assess: ((kind: CleanupKind) => CleanupVerdict) | null,
): Partial<Record<CleanupKind, CleanupVerdict>> {
  const [verdicts, setVerdicts] = useState<Partial<Record<CleanupKind, CleanupVerdict>>>({});
  const assessRef = useLatest(assess);
  const judge = assess !== null;
  useEffect(() => {
    if (!judge) return;
    let i = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let live = true;
    const next = () => {
      const kind = ALL_KINDS[i++];
      const fn = assessRef.current;
      if (!kind || !fn) return;
      const v = fn(kind);
      setVerdicts((was) => ({ ...was, [kind]: v }));
      timer = setTimeout(next, 0);
    };
    // The tidiers load on demand (lib/tidy-engine.ts); judging starts once they are here.
    void loadTidyEngine().then(() => {
      if (live) timer = setTimeout(next, 0);
    });
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [judge, assessRef]);
  return verdicts;
}

// One tidier: a drawing over its name and line (a tile), or beside them (the Auto-align row, and the wide
// Smart tile that leads the grid).
function TidyTile({
  kind,
  name,
  line,
  reason,
  wide = false,
  row = false,
  disabled,
  onChoose,
  hover,
}: {
  kind: CleanupKind;
  name: string;
  line: string;
  // Why it is greyed out, shown in place of its line; null when it is offered.
  reason: string | null;
  wide?: boolean;
  row?: boolean;
  disabled: boolean;
  onChoose: (kind: CleanupKind) => void;
  hover: Partial<
    Pick<React.HTMLAttributes<HTMLButtonElement>, 'onPointerEnter' | 'onPointerLeave'>
  >;
}) {
  const lineId = useId();
  const across = wide || row;
  return (
    <button
      type="button"
      data-tidy-kind={kind}
      disabled={disabled}
      aria-describedby={lineId}
      onClick={() => onChoose(kind)}
      {...hover}
      className={`group flex min-w-0 rounded-lg border border-slate-200 bg-white p-2 text-left transition-colors duration-micro hover:border-brand-400 hover:bg-brand-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 disabled:cursor-not-allowed disabled:hover:border-slate-200 disabled:hover:bg-white motion-reduce:transition-none dark:border-slate-700 dark:bg-slate-900 dark:hover:border-brand-400 dark:hover:bg-brand-500/10 dark:disabled:hover:border-slate-700 dark:disabled:hover:bg-slate-900 ${
        wide ? 'col-span-2' : ''
      } ${across ? 'w-full flex-row items-center gap-3' : 'flex-col items-stretch gap-1.5'}`}
    >
      <span
        className={`flex items-center justify-center rounded-md bg-slate-50 group-disabled:opacity-50 group-hover:bg-white group-disabled:group-hover:bg-slate-50 dark:bg-slate-800/60 dark:group-hover:bg-slate-900 ${
          row ? 'h-11 w-14 shrink-0' : wide ? 'h-14 w-24 shrink-0' : 'h-14'
        }`}
      >
        <TidyUpDrawing kind={kind} />
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="text-sm font-medium text-slate-900 group-disabled:opacity-50 dark:text-slate-50">
          {name}
        </span>
        {/* The reason stays at full strength: it is the one thing a greyed-out tile has to say. */}
        <span
          id={lineId}
          className={`text-xs ${
            reason ? 'text-amber-700 dark:text-amber-300' : 'text-slate-500 dark:text-slate-400'
          }`}
        >
          {reason ?? line}
        </span>
      </span>
    </button>
  );
}
