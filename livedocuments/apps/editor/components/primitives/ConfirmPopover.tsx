import { useLayoutEffect, useRef, useState } from 'react';
import { Button, clampIntoRange, lucideGlyph, Portal } from '@livedocuments/ui';
import { lucideTriangleAlert } from '@liveworkspace/icons/lucide';
import { VIEWPORT_EDGE_MARGIN as EDGE } from '@/lib/clamp-to-viewport';
import { usePopoverLayer } from './popover-stack';

// A small confirmation popover anchored beside a trigger element, with an
// arrow pointing back at it. The lightweight alternative to the full-
// screen ConfirmDialog modal for actions where being yanked to the centre
// of the screen is jarring — you confirm right where you clicked.
//
// Portal-rendered (so its `position: fixed` is relative to the viewport,
// not a transformed ancestor like the tab menu) and tagged with
// `data-confirm-popover` so a host menu's outside-click handler can
// exclude it. Esc cancels, Enter confirms. Sits at `--z-modal` (above the
// `--z-overlay` context menus that spawn it) so the "are you sure?" prompt
// is never hidden behind the menu it was opened from.

const WIDTH = 240;
const WarningIcon = lucideGlyph(lucideTriangleAlert, 13);

/** A confirmation's question and the rest: split after its first question mark, the whole as the title without one. */
export function splitConfirmMessage(message: string): { title: string; detail: string } {
  const at = message.indexOf('? ');
  if (at < 0) return { title: message, detail: '' };
  return { title: message.slice(0, at + 1), detail: message.slice(at + 2).trim() };
}

function ConfirmText({ message, warning }: { message: string; warning?: string | undefined }) {
  const { title, detail } = splitConfirmMessage(message);
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-[13px] font-semibold leading-snug text-slate-900 dark:text-slate-50">
        {title}
      </p>
      {warning ? (
        <p className="flex items-start gap-1.5 rounded-md bg-amber-50 px-2 py-1.5 text-xs leading-snug text-amber-900 dark:bg-amber-500/10 dark:text-amber-100">
          <WarningIcon aria-hidden className="mt-px shrink-0" />
          {warning}
        </p>
      ) : null}
      {detail ? (
        <p className="whitespace-pre-line text-xs leading-snug text-slate-500 dark:text-slate-400">
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
  // left/top of the panel + which side the arrow is on + the arrow's top.
  const [layout, setLayout] = useState<{
    left: number;
    top: number;
    side: 'left' | 'right';
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
      const left = side === 'left' ? a.left - GAP - WIDTH : a.right + GAP;
      // Vertically centre on the anchor, clamped to the viewport.
      const top = clampIntoRange(a.top + a.height / 2 - h / 2, EDGE, window.innerHeight - h - EDGE);
      // Arrow sits level with the anchor's centre, relative to the panel.
      const arrowTop = clampIntoRange(a.top + a.height / 2 - top, ARROW, h - ARROW * 2);
      setLayout({ left, top, side, arrowTop });
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
  usePopoverLayer(ref, (e) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      onCancel();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      onConfirm();
    }
  });

  return (
    <Portal>
      <div
        ref={ref}
        role="dialog"
        // Named by its whole message, as the title and detail split it.
        aria-label={message}
        data-confirm-popover
        onPointerDown={(e) => e.stopPropagation()}
        className="fixed z-[var(--z-modal)] flex animate-fade-in flex-col gap-2 rounded-lg border border-slate-200 bg-white p-3 shadow-xl shadow-slate-900/15 dark:border-slate-700 dark:bg-slate-900"
        style={{ left: layout?.left ?? -9999, top: layout?.top ?? -9999, width: WIDTH }}
      >
        {/* Arrow: a rotated square poking out of the side facing the anchor. */}
        {layout ? (
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
        <ConfirmText message={message} warning={warning} />
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
