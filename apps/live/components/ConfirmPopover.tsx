import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Portal } from './Portal';

// A small confirmation popover anchored beside a trigger element, with an
// arrow pointing back at it. The lightweight alternative to the full-
// screen ConfirmDialog modal for actions where being yanked to the centre
// of the screen is jarring — you confirm right where you clicked.
//
// Portal-rendered (so its `position: fixed` is relative to the viewport,
// not a transformed ancestor like the tab menu) and tagged with
// `data-confirm-popover` so a host menu's outside-click handler can
// exclude it. Esc cancels, Enter confirms.

const WIDTH = 224;
const GAP = 10; // space between the anchor and the popover
const ARROW = 7; // half the arrow's visual size
const EDGE = 8;

type ConfirmPopoverProps = {
  anchor: HTMLElement;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  // Rose-tinted confirm button for destructive actions (the default).
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmPopover({
  anchor,
  message,
  confirmLabel,
  cancelLabel = 'Cancel',
  danger = true,
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
      let top = a.top + a.height / 2 - h / 2;
      top = Math.max(EDGE, Math.min(top, window.innerHeight - h - EDGE));
      // Arrow sits level with the anchor's centre, relative to the panel.
      const arrowTop = Math.max(ARROW, Math.min(a.top + a.height / 2 - top, h - ARROW * 2));
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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onCancel();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        onConfirm();
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [onCancel, onConfirm]);

  return (
    <Portal>
      <div
        ref={ref}
        role="dialog"
        data-confirm-popover
        onPointerDown={(e) => e.stopPropagation()}
        className="fixed z-50 flex animate-fade-in flex-col gap-2 rounded-lg border border-slate-200 bg-white p-3 shadow-xl shadow-slate-900/15 dark:border-slate-700 dark:bg-slate-900"
        style={{ left: layout?.left ?? -9999, top: layout?.top ?? -9999, width: WIDTH }}
      >
        {/* Arrow: a rotated square poking out of the side facing the anchor. */}
        {layout ? (
          <span
            aria-hidden
            className="absolute h-3 w-3 rotate-45 border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900"
            style={{
              top: layout.arrowTop - ARROW + 2,
              ...(layout.side === 'left'
                ? { right: -6, borderRight: '1px solid', borderTop: '1px solid' }
                : { left: -6, borderLeft: '1px solid', borderBottom: '1px solid' }),
            }}
          />
        ) : null}
        <p className="text-xs text-slate-700 dark:text-slate-200">{message}</p>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            autoFocus
            onClick={onConfirm}
            className={
              danger
                ? 'rounded-md bg-rose-600 px-2.5 py-1 text-xs font-semibold text-white shadow-sm transition hover:bg-rose-700'
                : 'rounded-md bg-brand-500 px-2.5 py-1 text-xs font-semibold text-white shadow-sm transition hover:bg-brand-600'
            }
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </Portal>
  );
}
