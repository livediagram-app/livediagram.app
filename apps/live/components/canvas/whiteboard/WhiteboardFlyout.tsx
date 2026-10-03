'use client';

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Tooltip } from '@livediagram/ui';
import { Portal } from '@/components/primitives/Portal';

const VIEWPORT_MARGIN_PX = 12;
// The gap between the Palette panel's content and a flyout opened beside it: the panel's own
// padding (10px) plus the 12px the editor's floating surfaces keep between them.
const BESIDE_GAP_PX = 22;

// A flyout beside the Palette panel (docs/specs/023-draw-mode/draw-mode.md "What a whiteboard
// shows"): on the side of the panel with more room, its top level with the opener's, kept inside
// the viewport; its tip on the edge facing the panel, level with the opener's centre. Pure, from
// measured rects and the flyout's layout size.
export function besidePanel(
  panel: { left: number; right: number },
  opener: { top: number; height?: number },
  flyout: { offsetWidth: number; offsetHeight: number },
  viewport: { width: number; height: number } = {
    width: window.innerWidth,
    height: window.innerHeight,
  },
): { left: number; top: number; side: 'left' | 'right'; tipTop: number } {
  const roomLeft = panel.left;
  const roomRight = viewport.width - panel.right;
  const side = roomLeft >= roomRight ? 'left' : 'right';
  const left =
    side === 'left'
      ? Math.max(VIEWPORT_MARGIN_PX, panel.left - BESIDE_GAP_PX - flyout.offsetWidth)
      : Math.min(
          viewport.width - VIEWPORT_MARGIN_PX - flyout.offsetWidth,
          panel.right + BESIDE_GAP_PX,
        );
  const top = Math.max(
    VIEWPORT_MARGIN_PX,
    Math.min(opener.top, viewport.height - VIEWPORT_MARGIN_PX - flyout.offsetHeight),
  );
  const centre = opener.top + (opener.height ?? 0) / 2 - top;
  const tipTop = Math.max(TIP_INSET_PX, Math.min(centre, flyout.offsetHeight - TIP_INSET_PX));
  return { left, top, side, tipTop };
}

// How close the tip may come to a corner of the card (its rounding is 12px).
const TIP_INSET_PX = 14;

// The flyout's tip: a small rotated square on the edge facing its opener, with the card's own
// border on its two outer sides, so it reads as part of the card pointing at the button.
function FlyoutTip({
  edge,
  offset,
}: {
  edge: 'top' | 'bottom' | 'left' | 'right';
  // Along the edge, in px from the card's left (top / bottom) or top (left / right) edge.
  offset: number;
}) {
  const place = {
    top: '-top-[6px] border-l border-t',
    bottom: '-bottom-[6px] border-b border-r',
    left: '-left-[6px] border-b border-l',
    right: '-right-[6px] border-r border-t',
  }[edge];
  // Centred on the offset: the square is 10px.
  const at = offset - 5;
  return (
    <span
      aria-hidden
      data-flyout-tip={edge}
      style={edge === 'top' || edge === 'bottom' ? { left: at } : { top: at }}
      className={`pointer-events-none absolute h-2.5 w-2.5 rotate-45 border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900 ${place}`}
    />
  );
}

// A flyout off the dock (docs/specs/023-draw-mode/draw-mode.md "What a whiteboard shows", "Where
// the dock sits"): on the board side of the dock (below a dock at the top, above one at the
// bottom), a gap away, centred on its opener and kept inside the viewport; its tip on the edge
// facing the dock, over the opener. Pure, from screen rects and the flyout's layout size.
export function offDock(
  dock: { top: number; bottom: number },
  opener: { left: number; width: number },
  flyout: { offsetWidth: number; offsetHeight: number },
  below: boolean,
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
  const top = below
    ? dock.bottom + OFF_DOCK_GAP_PX
    : dock.top - OFF_DOCK_GAP_PX - flyout.offsetHeight;
  const tipLeft = Math.max(
    TIP_INSET_PX,
    Math.min(centre - left, flyout.offsetWidth - TIP_INSET_PX),
  );
  return { left, top, tipLeft };
}

// The gap between the dock and a flyout off it.
const OFF_DOCK_GAP_PX = 8;

export type FlyoutPlacement = 'below' | 'above' | 'beside';

type Place = {
  left: number;
  top: number;
  tip: { edge: 'top' | 'bottom' | 'left' | 'right'; offset: number };
};

// A Draw tool's settings (a pen, the eraser, Shapes, a slot's menu, Settings). Always portalled
// and placed in screen px from its opener, so it draws at design size whatever the toolbar UI
// scale zooms the dock to (docs/specs/007-editor/ui-scale.md) and escapes the Palette panel's
// scroll clip: off the dock's board side, or beside the panel. The dock never moves for it. Focus
// moves into it on open; Escape closes it and hands focus back to its opener; a press outside
// closes it without stealing focus.
export function WhiteboardFlyout({
  id,
  label,
  anchor,
  placement,
  revision,
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
  // The opener's data-dock-item: the flyout is placed against it and points at it.
  anchor: string;
  placement: FlyoutPlacement;
  // Changes when the opener moves under an open flyout (the dock's groups scrolled): placed again.
  revision?: number;
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
  // Where it sits, in viewport px, and where its tip points; null until measured (hidden for that
  // one frame rather than flashing at the corner). Layout sizes, not the bounding rect: the pop-in
  // starts at scale(0).
  const [place, setPlace] = useState<Place | null>(null);
  useLayoutEffect(() => {
    const node = ref.current;
    const wrapEl = document.querySelector<HTMLElement>('[data-whiteboard-dock]');
    const opener = wrapEl?.querySelector<HTMLElement>(`[data-dock-item="${anchor}"]`);
    if (!node || !wrapEl || !opener) return;
    const wrap = wrapEl.getBoundingClientRect();
    const btn = opener.getBoundingClientRect();
    if (placement === 'beside') {
      const at = besidePanel(wrap, btn, node);
      setPlace({
        left: at.left,
        top: at.top,
        tip: { edge: at.side === 'left' ? 'right' : 'left', offset: at.tipTop },
      });
      return;
    }
    const below = placement === 'below';
    const at = offDock(wrap, btn, node, below);
    setPlace({
      left: at.left,
      top: at.top,
      tip: { edge: below ? 'top' : 'bottom', offset: at.tipLeft },
    });
  }, [anchor, placement, revision]);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  const restoreRef = useRef(restoreFocus);
  useEffect(() => {
    restoreRef.current = restoreFocus;
  });

  // The focus moves in once the flyout is placed: it is hidden for its first, unmeasured frame, and a
  // browser will not focus a hidden element, which would leave the focus (and so Escape) on the
  // opener. Once only: a re-place (`revision`) keeps the focus where the user has taken it.
  const placed = place !== null;
  useEffect(() => {
    if (!placed || !takeFocus) return;
    const node = ref.current;
    // A field first (More shapes opens typing), then the choice in force, then the first button.
    const initial =
      node?.querySelector<HTMLElement>('input') ??
      node?.querySelector<HTMLElement>('[aria-pressed="true"]') ??
      node?.querySelector<HTMLElement>('button');
    initial?.focus({ preventScroll: true });
  }, [placed, takeFocus]);

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
    return () => {
      document.removeEventListener('pointerdown', onDown, true);
      if (!restoreRef.current || !takeFocus) return;
      const now = document.activeElement as HTMLElement | null;
      if (now && now !== document.body && !node?.contains(now)) return;
      now?.blur?.();
    };
  }, [id, takeFocus]);

  return (
    <Portal>
      <div
        ref={ref}
        id={id}
        role="group"
        aria-label={label}
        data-floating-panel=""
        data-side={placement}
        onKeyDown={(e) => {
          if (e.key !== 'Escape') return;
          e.stopPropagation();
          onClose(true);
        }}
        onPointerDown={(e) => e.stopPropagation()}
        onPointerEnter={(e) => (e.pointerType !== 'touch' ? onPointerEnter?.() : undefined)}
        onPointerLeave={(e) => (e.pointerType !== 'touch' ? onPointerLeave?.() : undefined)}
        style={{
          left: place?.left ?? 0,
          top: place?.top ?? 0,
          visibility: place ? undefined : 'hidden',
        }}
        className="pointer-events-auto fixed z-[var(--z-popover)] w-max max-w-[min(20rem,calc(100vw-1.5rem))] animate-pop-in rounded-xl border border-slate-200 bg-white p-3 shadow-lg shadow-slate-900/10 dark:border-slate-700 dark:bg-slate-900 dark:shadow-slate-950/40"
      >
        {/* The tip points at the button that opened it, wherever the card sits. */}
        {place ? <FlyoutTip edge={place.tip.edge} offset={place.tip.offset} /> : null}
        {hideTitle ? null : <FlyoutHeading className="mb-2">{label}</FlyoutHeading>}
        {children}
      </div>
    </Portal>
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
