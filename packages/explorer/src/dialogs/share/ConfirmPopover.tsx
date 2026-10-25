'use client';

// A small confirmation beside the control that asked for it, with an arrow pointing back at it, so a revoke is
// confirmed where it was pressed: livediagram's ConfirmPopover from before the Explorer split. Its message is the
// question, then what follows from it ("Revoke this pass? The link stops working ..."), drawn as a title over a
// quieter line. Escape cancels it alone (never the dialog), Enter confirms; it sits over the dialog in a portal.

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Button, Portal, clampIntoRange } from '@liveworkspace/ui';
import { useLatest } from '../../ui/useLatest';

const WIDTH = 240;
const GAP = 10;
const ARROW = 7;
const EDGE = 8;

export function ConfirmPopover({
  anchor,
  message,
  confirmLabel,
  onConfirm,
  onCancel,
}: {
  anchor: HTMLElement;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState<{
    left: number;
    top: number;
    side: 'left' | 'right';
    arrowTop: number;
  } | null>(null);
  const cancel = useLatest(onCancel);
  const confirm = useLatest(onConfirm);
  const at = message.indexOf('? ');
  const title = at < 0 ? message : message.slice(0, at + 1);
  const detail = at < 0 ? '' : message.slice(at + 2).trim();

  useLayoutEffect(() => {
    const place = () => {
      const a = anchor.getBoundingClientRect();
      const h = ref.current?.getBoundingClientRect().height ?? 88;
      // The left of the bin, where the pass's own width is; the right when there is no room.
      const side = a.left - GAP - WIDTH >= EDGE ? 'left' : 'right';
      const left = side === 'left' ? a.left - GAP - WIDTH : a.right + GAP;
      const top = clampIntoRange(a.top + a.height / 2 - h / 2, EDGE, window.innerHeight - h - EDGE);
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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopImmediatePropagation();
        cancel.current();
        anchor.focus();
      } else if (e.key === 'Enter' && ref.current?.contains(document.activeElement)) {
        e.preventDefault();
        confirm.current();
      }
    };
    // A press anywhere else cancels, as a popover does.
    const onDown = (e: PointerEvent) => {
      const target = e.target as Node | null;
      if (target && !ref.current?.contains(target) && !anchor.contains(target)) cancel.current();
    };
    document.addEventListener('keydown', onKey, true);
    document.addEventListener('pointerdown', onDown, true);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      document.removeEventListener('pointerdown', onDown, true);
    };
  }, [anchor, cancel, confirm]);

  return (
    <Portal>
      <div
        ref={ref}
        role="alertdialog"
        aria-label={title}
        data-confirm-popover=""
        className="fixed z-[var(--z-modal)] flex animate-fade-in flex-col gap-2 rounded-lg border border-slate-200 bg-white p-3 shadow-xl shadow-slate-900/15 dark:border-slate-700 dark:bg-slate-900"
        style={{ left: layout?.left ?? -9999, top: layout?.top ?? -9999, width: WIDTH }}
      >
        {layout ? (
          <span
            aria-hidden
            className={`absolute h-3 w-3 rotate-45 border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900 ${
              layout.side === 'left' ? 'border-r border-t' : 'border-b border-l'
            }`}
            style={{
              top: layout.arrowTop - ARROW + 2,
              ...(layout.side === 'left' ? { right: -6 } : { left: -6 }),
            }}
          />
        ) : null}
        <div className="flex flex-col gap-1.5">
          <p className="text-[13px] font-semibold leading-snug text-slate-900 dark:text-slate-50">
            {title}
          </p>
          {detail ? (
            <p className="text-xs leading-snug text-slate-500 dark:text-slate-400">{detail}</p>
          ) : null}
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" size="xs" onClick={onCancel} className="px-2.5 py-1">
            Cancel
          </Button>
          {/* Its primary action, a revoke included: never painted red. */}
          <Button size="xs" autoFocus onClick={onConfirm} className="px-2.5 py-1 shadow-sm">
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Portal>
  );
}
