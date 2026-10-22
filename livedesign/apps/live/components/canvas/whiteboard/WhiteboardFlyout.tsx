'use client';

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Tooltip, Portal } from '@livedesign/ui';

const VIEWPORT_MARGIN_PX = 12;
// How close the tip may come to a corner of the card (its rounding is 12px).
const TIP_INSET_PX = 14;

// The flyout's tip: a small rotated square on its top edge, with the card's own border on its two
// outer sides, so it reads as part of the card pointing at the button.
function FlyoutTip({
  offset,
}: {
  // Along the edge, in px from the card's left edge.
  offset: number;
}) {
  // Centred on the offset: the square is 10px.
  const at = offset - 5;
  return (
    <span
      aria-hidden
      data-flyout-tip="top"
      style={{ left: at }}
      className="pointer-events-none absolute -top-[6px] h-2.5 w-2.5 rotate-45 border-l border-t border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900"
    />
  );
}

// Where a flyout sits below the toolbar it opens from (docs/specs/023-draw-mode/drawing-tools.md
// "Markers"): a gap below it, centred on its opener and kept inside the viewport; its tip on the top
// edge, over the opener. Pure, from screen rects and the flyout's layout size.
export function belowToolbar(
  toolbar: { bottom: number },
  opener: { left: number; width: number },
  flyout: { offsetWidth: number },
  viewport: { width: number } = { width: window.innerWidth },
): { left: number; top: number; tipLeft: number } {
  const centre = opener.left + opener.width / 2;
  const left = Math.max(
    VIEWPORT_MARGIN_PX,
    Math.min(
      centre - flyout.offsetWidth / 2,
      viewport.width - VIEWPORT_MARGIN_PX - flyout.offsetWidth,
    ),
  );
  const tipLeft = Math.max(
    TIP_INSET_PX,
    Math.min(centre - left, flyout.offsetWidth - TIP_INSET_PX),
  );
  return { left, top: toolbar.bottom + GAP_PX, tipLeft };
}

// The gap between the toolbar and a flyout below it.
const GAP_PX = 8;

type Place = { left: number; top: number; tip: number };

// A marker's settings (its colour and width). Always portalled and placed in screen px from its
// opener, so it draws at design size whatever the toolbar UI scale zooms the palette to
// (docs/specs/007-editor/ui-scale.md) and escapes the palette's scroll clip. Focus moves into it on
// open; Escape closes it and hands focus back to its opener; a press outside closes it without
// stealing focus.
export function WhiteboardFlyout({
  id,
  label,
  anchor,
  onClose,
  scope,
  children,
}: {
  id: string;
  label: string;
  // The opener's data-dock-item: the flyout is placed against it and points at it.
  anchor: string;
  onClose: (returnFocus: boolean) => void;
  // The toolbar its opener sits in: a logo page's Draw, or a marker's tile.
  scope: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  // Where it sits, in viewport px, and where its tip points; null until measured (hidden for that
  // one frame rather than flashing at the corner). Layout sizes, not the bounding rect: the pop-in
  // starts at scale(0).
  const [place, setPlace] = useState<Place | null>(null);
  useLayoutEffect(() => {
    const node = ref.current;
    const wrapEl = document.querySelector<HTMLElement>(scope);
    const opener = wrapEl?.querySelector<HTMLElement>(`[data-dock-item="${anchor}"]`);
    if (!node || !wrapEl || !opener) return;
    const at = belowToolbar(wrapEl.getBoundingClientRect(), opener.getBoundingClientRect(), node);
    setPlace({ left: at.left, top: at.top, tip: at.tipLeft });
  }, [anchor, scope]);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  // The focus moves in once the flyout is placed: it is hidden for its first, unmeasured frame, and a
  // browser will not focus a hidden element, which would leave the focus (and so Escape) on the
  // opener.
  const placed = place !== null;
  useEffect(() => {
    if (!placed) return;
    const node = ref.current;
    // The choice in force, then the first button.
    const initial =
      node?.querySelector<HTMLElement>('[aria-pressed="true"]') ??
      node?.querySelector<HTMLElement>('button');
    initial?.focus({ preventScroll: true });
  }, [placed]);

  useEffect(() => {
    const node = ref.current;
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
    return () => document.removeEventListener('pointerdown', onDown, true);
  }, [id]);

  return (
    <Portal>
      <div
        ref={ref}
        id={id}
        role="group"
        aria-label={label}
        data-floating-panel=""
        data-side="below"
        onKeyDown={(e) => {
          if (e.key !== 'Escape') return;
          e.stopPropagation();
          onClose(true);
        }}
        onPointerDown={(e) => e.stopPropagation()}
        style={{
          left: place?.left ?? 0,
          top: place?.top ?? 0,
          visibility: place ? undefined : 'hidden',
        }}
        className="pointer-events-auto fixed z-[var(--z-popover)] w-max max-w-[min(20rem,calc(100vw-1.5rem))] animate-pop-in rounded-xl border border-slate-200 bg-white p-3 shadow-lg shadow-slate-900/10 dark:border-slate-700 dark:bg-slate-900 dark:shadow-slate-950/40"
      >
        {/* The tip points at the button that opened it, wherever the card sits. */}
        {place ? <FlyoutTip offset={place.tip} /> : null}
        <FlyoutHeading className="mb-2">{label}</FlyoutHeading>
        {children}
      </div>
    </Portal>
  );
}

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
        className={`relative flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg text-sm text-slate-700 transition focus-visible:outline-2 focus-visible:outline-brand-500 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800 ${wide ? 'px-3' : 'w-10'} ${selected ? 'bg-brand-50 ring-2 ring-brand-500 dark:bg-brand-500/15' : ''}`}
      >
        {children}
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
