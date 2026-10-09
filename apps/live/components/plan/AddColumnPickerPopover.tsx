'use client';

// The column picker hung from a column's + Add Column After (docs/specs/026-plan/plan-board.md "The column picker"):
// its own small popover beside the button, an arrow pointing at it, over the settings popover (which stays open).
// Placed by placeHint (right, left, below, above: the first that fits on screen). It takes focus as it opens and
// gives it back to the button when it closes; Escape closes only it, as does a press outside it.
import { useLayoutEffect, useRef, useState, type CSSProperties, type RefObject } from 'react';
import {
  POPOVER_VIEWPORT_MARGIN,
  Portal,
  placeHint,
  useClickOutside,
  useEscape,
  type HintLayout,
  type HintPlacement,
} from '@livediagram/ui';
import { AddColumnPicker } from './AddColumnPicker';

// The picker's width, its gap from the button, and the arrow's size.
export const ADD_COLUMN_PICKER_PX = 304;
const GAP_PX = 10;
const ARROW_PX = 12;
const ORDER: readonly HintPlacement[] = ['right', 'left', 'bottom', 'top'];

// The arrow's square, half tucked under the popover's edge facing the button.
const ARROW: Record<HintPlacement, (offset: number) => { style: CSSProperties; border: string }> = {
  right: (o) => ({
    style: { left: -ARROW_PX / 2, top: o - ARROW_PX / 2 },
    border: 'border-l border-b',
  }),
  left: (o) => ({
    style: { right: -ARROW_PX / 2, top: o - ARROW_PX / 2 },
    border: 'border-r border-t',
  }),
  bottom: (o) => ({
    style: { top: -ARROW_PX / 2, left: o - ARROW_PX / 2 },
    border: 'border-l border-t',
  }),
  top: (o) => ({
    style: { bottom: -ARROW_PX / 2, left: o - ARROW_PX / 2 },
    border: 'border-r border-b',
  }),
};

export function AddColumnPickerPopover({
  anchor,
  onClose,
  ...picker
}: Omit<Parameters<typeof AddColumnPicker>[0], 'autoFocus'> & {
  // + Add Column After: what the popover points at, and where focus goes back to.
  anchor: RefObject<HTMLElement | null>;
  // Closed without adding (Escape, a press outside).
  onClose: () => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState<HintLayout | null>(null);
  const dismiss = () => {
    onClose();
    anchor.current?.focus();
  };
  useLayoutEffect(() => {
    const trigger = anchor.current?.getBoundingClientRect();
    const surface = box.current?.getBoundingClientRect();
    if (!trigger || !surface) return;
    setLayout(
      placeHint({
        trigger,
        surface: { width: ADD_COLUMN_PICKER_PX, height: surface.height },
        viewport: { width: window.innerWidth, height: window.innerHeight },
        gap: GAP_PX,
        margin: POPOVER_VIEWPORT_MARGIN,
        order: ORDER,
      }),
    );
  }, [anchor]);
  useEscape(dismiss, { capture: true, stopPropagation: true });
  // The button toggles the picker itself, so a press on it is not "outside".
  useClickOutside(box, dismiss, true, '[data-add-column-after]');
  const arrow = layout ? ARROW[layout.placement](layout.arrowOffset) : null;
  return (
    <Portal>
      <div
        ref={box}
        role="dialog"
        aria-label="Add a Column"
        data-add-column-picker=""
        onPointerDown={(e) => e.stopPropagation()}
        className="fixed z-[var(--z-popover)] animate-fade-in rounded-xl border border-slate-200 bg-white p-3 text-slate-800 shadow-xl shadow-slate-900/15 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
        style={{
          width: ADD_COLUMN_PICKER_PX,
          ...(layout
            ? { left: layout.left, top: layout.top }
            : { left: -9999, top: -9999, visibility: 'hidden' }),
        }}
      >
        {arrow ? (
          <span
            aria-hidden
            className={`absolute h-3 w-3 rotate-45 border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900 ${arrow.border}`}
            style={arrow.style}
          />
        ) : null}
        <AddColumnPicker {...picker} autoFocus />
      </div>
    </Portal>
  );
}
