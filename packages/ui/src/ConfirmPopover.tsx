'use client';

import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { lucideTriangleAlert } from '@liveworkspace/icons/lucide';
import { Button } from './Button';
import { lucideGlyph } from './icons/lucide-glyph';
import { Portal } from './Portal';
import { POPOVER_VIEWPORT_MARGIN as EDGE, clampIntoRange } from './popover';
import { usePopoverLayer } from './popover-stack';

// A small confirmation popover anchored beside a trigger element, with an
// arrow pointing back at it. The lightweight alternative to the full-
// screen ConfirmDialog modal for actions where being yanked to the centre
// of the screen is jarring — you confirm right where you clicked.
//
// Portal-rendered (so its `position: fixed` is relative to the viewport,
// not a transformed ancestor like the tab menu) and tagged with
// `data-confirm-popover` so a host menu's outside-click handler can
// exclude it. Esc cancels, Enter confirms (on a focused button, Enter presses that button). Sits at `--z-modal` (above the
// `--z-overlay` context menus that spawn it) so the "are you sure?" prompt
// is never hidden behind the menu it was opened from. A press anywhere but
// the popover, its anchor or a popover opened above it cancels, and Escape
// hands focus back to the anchor. Every editor's and the Explorer's.

const WIDTH = 240;
const WarningIcon = lucideGlyph(lucideTriangleAlert, 13);

/** A confirmation's question and the rest: split after its first question mark, the whole as the title without one. */
export function splitConfirmMessage(message: string): { title: string; detail: string } {
  const at = message.indexOf('? ');
  if (at < 0) return { title: message, detail: '' };
  return { title: message.slice(0, at + 1), detail: message.slice(at + 2).trim() };
}

function ConfirmText({
  id,
  message,
  warning,
}: {
  id: string;
  message: string;
  warning?: string | undefined;
}) {
  const { title, detail } = splitConfirmMessage(message);
  return (
    <div className="flex flex-col gap-1.5">
      <p
        id={`${id}-title`}
        className="text-[13px] font-semibold leading-snug text-slate-900 dark:text-slate-50"
      >
        {title}
      </p>
      {warning ? (
        <p className="flex items-start gap-1.5 rounded-md bg-amber-50 px-2 py-1.5 text-xs leading-snug text-amber-900 dark:bg-amber-500/10 dark:text-amber-100">
          <WarningIcon aria-hidden className="mt-px shrink-0" />
          {warning}
        </p>
      ) : null}
      {detail ? (
        <p
          id={`${id}-detail`}
          className="whitespace-pre-line text-xs leading-snug text-slate-500 dark:text-slate-400"
        >
          {detail}
        </p>
      ) : null}
    </div>
  );
}
const GAP = 10; // space between the anchor and the popover
const ARROW = 7; // half the arrow's visual size

type ConfirmPopoverProps = {
  anchor: HTMLElement;
  // The question, then what follows from it: "Delete this tab? It can't be recovered." The question reads as the
  // popover's title and the rest as its quieter detail (splitConfirmMessage), so no popover is one block of text.
  message: string;
  // A consequence to see before confirming (a form unpublished), on its own line with a warning mark.
  warning?: string;
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmPopover({
  anchor,
  message,
  warning,
  confirmLabel,
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
}: ConfirmPopoverProps) {
  const ref = useRef<HTMLDivElement>(null);
  const id = useId();
  // left/top of the panel + which side the arrow is on (none when it could not sit beside the anchor) + the
  // arrow's top.
  const [layout, setLayout] = useState<{
    left: number;
    top: number;
    side: 'left' | 'right' | null;
    arrowTop: number;
  } | null>(null);

  useLayoutEffect(() => {
    const place = () => {
      const a = anchor.getBoundingClientRect();
      const h = ref.current?.getBoundingClientRect().height ?? 88;
      // Prefer the LEFT of the anchor (the tab menu opens to the right of
      // the tabs, so the delete row's left is the open space); flip right
      // if there's no room.
      const roomLeft = a.left - GAP - WIDTH >= EDGE;
      const side: 'left' | 'right' = roomLeft ? 'left' : 'right';
      const beside = side === 'left' ? a.left - GAP - WIDTH : a.right + GAP;
      // With room on neither side (a full-width row on a phone), it stays on screen over the anchor, with no
      // arrow: placed beside it, the whole popover, Confirm focused, would sit past the right edge.
      const left = clampIntoRange(beside, EDGE, window.innerWidth - WIDTH - EDGE);
      // Vertically centre on the anchor, clamped to the viewport.
      const top = clampIntoRange(a.top + a.height / 2 - h / 2, EDGE, window.innerHeight - h - EDGE);
      // Arrow sits level with the anchor's centre, relative to the panel.
      const arrowTop = clampIntoRange(a.top + a.height / 2 - top, ARROW, h - ARROW * 2);
      setLayout({ left, top, side: left === beside ? side : null, arrowTop });
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [anchor]);

  // It is the top popover while it is up (popover-stack.ts), so Escape cancels it alone, never the popover or menu
  // it was opened from.
  const { withinAbove } = usePopoverLayer(ref, (e) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      onCancel();
      anchor.focus();
    } else if (e.key === 'Enter') {
      // A focused button presses itself: Enter on Cancel cancels. Taking every Enter as Confirm deleted
      // the thing a keyboard user had just tabbed to Cancel to keep.
      if (e.target instanceof HTMLButtonElement && ref.current?.contains(e.target)) return;
      e.preventDefault();
      onConfirm();
    }
  });

  // A press anywhere else cancels, as a popover does. Read through refs so the listener is added once per anchor.
  const outsideRef = useRef({ onCancel, withinAbove });
  useEffect(() => {
    outsideRef.current = { onCancel, withinAbove };
  });
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      const target = e.target as Node | null;
      if (!target || ref.current?.contains(target) || anchor.contains(target)) return;
      if (outsideRef.current.withinAbove(target)) return;
      outsideRef.current.onCancel();
    };
    document.addEventListener('pointerdown', onDown, true);
    return () => document.removeEventListener('pointerdown', onDown, true);
  }, [anchor]);

  return (
    <Portal>
      <div
        ref={ref}
        role="alertdialog"
        // Named by its question, described by the rest (splitConfirmMessage).
        aria-labelledby={`${id}-title`}
        aria-describedby={splitConfirmMessage(message).detail ? `${id}-detail` : undefined}
        data-confirm-popover
        onPointerDown={(e) => e.stopPropagation()}
        className="fixed z-[var(--z-modal)] flex animate-fade-in flex-col gap-2 rounded-lg border border-slate-200 bg-white p-3 shadow-xl shadow-slate-900/15 dark:border-slate-700 dark:bg-slate-900"
        style={{ left: layout?.left ?? -9999, top: layout?.top ?? -9999, width: WIDTH }}
      >
        {/* Arrow: a rotated square poking out of the side facing the anchor. */}
        {layout?.side ? (
          <span
            aria-hidden
            className={`absolute h-3 w-3 rotate-45 bg-white dark:bg-slate-900 ${
              layout.side === 'left' ? 'border-r border-t' : 'border-b border-l'
            } border-slate-200 dark:border-slate-700`}
            style={{
              top: layout.arrowTop - ARROW + 2,
              ...(layout.side === 'left' ? { right: -6 } : { left: -6 }),
            }}
          />
        ) : null}
        <ConfirmText id={id} message={message} warning={warning} />
        <div className="flex justify-end gap-2">
          {/* py-1 keeps the popover's tighter rhythm; the classes append
              after the size scale, so they win. */}
          <Button variant="secondary" size="xs" onClick={onCancel} className="px-2.5 py-1">
            {cancelLabel}
          </Button>
          <Button
            // Its primary action, a delete included: never painted red.
            variant="primary"
            size="xs"
            autoFocus
            onClick={onConfirm}
            className="px-2.5 py-1 shadow-sm"
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Portal>
  );
}
