'use client';

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Tooltip } from '@livediagram/ui';

const VIEWPORT_MARGIN_PX = 12;

// A dock button's settings, opened ABOVE the dock so the dock itself never
// moves (docs/specs/023-whiteboard/whiteboard.md "What a whiteboard shows"). Focus moves into it on
// open; Escape closes it and hands focus back to its opener; a press outside
// closes it without stealing focus.
export function WhiteboardFlyout({
  id,
  label,
  left,
  onClose,
  onPointerEnter,
  onPointerLeave,
  takeFocus = true,
  restoreFocus = false,
  hideTitle = false,
  children,
}: {
  id: string;
  label: string;
  // Horizontal centre, in px from the dock wrapper's left edge.
  left: number;
  onClose: (returnFocus: boolean) => void;
  // A hover-opened flyout stays while the pointer is over it.
  onPointerEnter?: () => void;
  onPointerLeave?: () => void;
  // False for a flyout the pointer opened: hovering never moves the keyboard focus (the Shapes
  // flyout's field is the one exception).
  takeFocus?: boolean;
  // On closing, give the focus back to the board when it is still in the flyout or nowhere: a
  // hover-opened Shapes flyout took it without being asked.
  restoreFocus?: boolean;
  // A flyout whose sections carry their own headings shows no title (it keeps
  // `label` as its accessible name).
  hideTitle?: boolean;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  // Nudge, in px, that keeps the flyout inside the viewport when its opener
  // sits near an edge (a phone, a scrolled dock). Measured before paint.
  const [nudge, setNudge] = useState(0);
  useLayoutEffect(() => {
    // Layout sizes, not the bounding rect: the pop-in starts at scale(0).
    const node = ref.current;
    const parent = node?.offsetParent;
    if (!node || !parent) return;
    const centre = parent.getBoundingClientRect().left + left;
    const half = node.offsetWidth / 2;
    const room = window.innerWidth - VIEWPORT_MARGIN_PX;
    const dx =
      centre - half < VIEWPORT_MARGIN_PX
        ? VIEWPORT_MARGIN_PX - (centre - half)
        : centre + half > room
          ? room - (centre + half)
          : 0;
    setNudge(dx);
  }, [left]);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  const restoreRef = useRef(restoreFocus);
  useEffect(() => {
    restoreRef.current = restoreFocus;
  });

  useEffect(() => {
    const node = ref.current;
    // A field first (More shapes opens typing), then the choice in force, then the first button.
    const initial =
      node?.querySelector<HTMLElement>('input') ??
      node?.querySelector<HTMLElement>('[aria-pressed="true"]') ??
      node?.querySelector<HTMLElement>('button');
    if (takeFocus) initial?.focus({ preventScroll: true });
    const onDown = (e: PointerEvent) => {
      const target = e.target as Node | null;
      if (!target || node?.contains(target)) return;
      // The opener toggles the flyout itself; closing here as well would
      // reopen it on the same press.
      if ((target as Element).closest?.(`[aria-controls="${id}"]`)) return;
      // A menu the flyout opened (a portal, such as a custom colour's Remove) is the flyout's own.
      if ((target as Element).closest?.('[data-flyout-child]')) return;
      onCloseRef.current(false);
    };
    document.addEventListener('pointerdown', onDown, true);
    return () => {
      document.removeEventListener('pointerdown', onDown, true);
      if (!restoreRef.current || !takeFocus) return;
      const now = document.activeElement as HTMLElement | null;
      if (now && now !== document.body && !node?.contains(now)) return;
      now?.blur?.();
    };
  }, [id, takeFocus]);

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
      onPointerEnter={(e) => (e.pointerType !== 'touch' ? onPointerEnter?.() : undefined)}
      onPointerLeave={(e) => (e.pointerType !== 'touch' ? onPointerLeave?.() : undefined)}
      // `translate`, not `transform`: the pop-in animation owns `transform`.
      style={{ left, translate: `calc(-50% + ${nudge}px) 0` }}
      className="pointer-events-auto absolute bottom-full mb-2 w-max max-w-[min(20rem,calc(100vw-1.5rem))] animate-pop-in rounded-xl border border-slate-200 bg-white p-3 shadow-lg shadow-slate-900/10 dark:border-slate-700 dark:bg-slate-900 dark:shadow-slate-950/40"
    >
      {hideTitle ? null : <FlyoutHeading className="mb-2">{label}</FlyoutHeading>}
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
  shortcut,
}: {
  label: string;
  selected: boolean;
  onPick: () => void;
  children: ReactNode;
  wide?: boolean;
  // The key that picks this option from anywhere on the board.
  shortcut?: string;
}) {
  return (
    <Tooltip label={label}>
      <button
        type="button"
        aria-label={label}
        aria-pressed={selected}
        aria-keyshortcuts={shortcut}
        onClick={onPick}
        className={`relative flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg text-sm text-slate-700 transition focus-visible:outline-2 focus-visible:outline-brand-500 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800 ${wide ? 'px-3' : 'w-10'} ${selected ? 'bg-brand-50 ring-2 ring-brand-500 dark:bg-brand-500/15' : ''}`}
      >
        {children}
        {shortcut ? (
          <span
            aria-hidden
            className="pointer-events-none absolute bottom-0.5 right-1 text-[8px] font-medium uppercase leading-none text-slate-500 dark:text-slate-400"
          >
            {shortcut}
          </span>
        ) : null}
      </button>
    </Tooltip>
  );
}

// The flyouts' small-capitals heading: a flyout's title, or a section's.
export function FlyoutHeading({
  className = '',
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <p
      data-flyout-heading=""
      className={`text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 ${className}`}
    >
      {children}
    </p>
  );
}
