'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { Tooltip } from '@livediagram/ui';

// A dock button's settings, opened ABOVE the dock so the dock itself never
// moves (docs/specs/023-whiteboard/whiteboard.md "What a whiteboard shows"). Focus moves into it on
// open; Escape closes it and hands focus back to its opener; a press outside
// closes it without stealing focus.
export function WhiteboardFlyout({
  id,
  label,
  left,
  onClose,
  children,
}: {
  id: string;
  label: string;
  // Horizontal centre, in px from the dock wrapper's left edge.
  left: number;
  onClose: (returnFocus: boolean) => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    const node = ref.current;
    const initial =
      node?.querySelector<HTMLElement>('[aria-pressed="true"]') ??
      node?.querySelector<HTMLElement>('button');
    initial?.focus({ preventScroll: true });
    const onDown = (e: PointerEvent) => {
      const target = e.target as Node | null;
      if (!target || node?.contains(target)) return;
      // The opener toggles the flyout itself; closing here as well would
      // reopen it on the same press.
      if ((target as Element).closest?.(`[aria-controls="${id}"]`)) return;
      onCloseRef.current(false);
    };
    document.addEventListener('pointerdown', onDown, true);
    return () => document.removeEventListener('pointerdown', onDown, true);
  }, [id]);

  return (
    <div
      ref={ref}
      id={id}
      role="group"
      aria-label={label}
      data-floating-panel=""
      onKeyDown={(e) => {
        if (e.key !== 'Escape') return;
        e.stopPropagation();
        onClose(true);
      }}
      onPointerDown={(e) => e.stopPropagation()}
      style={{ left }}
      className="pointer-events-auto absolute bottom-full mb-2 w-max max-w-[min(20rem,calc(100vw-1.5rem))] -translate-x-1/2 animate-pop-in rounded-xl border border-slate-200 bg-white p-3 shadow-lg shadow-slate-900/10 dark:border-slate-700 dark:bg-slate-900 dark:shadow-slate-950/40"
    >
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
        {label}
      </p>
      {children}
    </div>
  );
}

// A row of choices in a flyout. `selected` drives aria-pressed and the ring.
export function FlyoutOption({
  label,
  selected,
  onPick,
  children,
  wide = false,
}: {
  label: string;
  selected: boolean;
  onPick: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <Tooltip label={label}>
      <button
        type="button"
        aria-label={label}
        aria-pressed={selected}
        onClick={onPick}
        className={`flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg text-sm text-slate-700 transition hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-brand-500 dark:text-slate-200 dark:hover:bg-slate-800 ${
          wide ? 'px-3' : 'w-10'
        } ${selected ? 'bg-brand-50 ring-2 ring-brand-500 dark:bg-brand-500/15' : ''}`}
      >
        {children}
      </button>
    </Tooltip>
  );
}
