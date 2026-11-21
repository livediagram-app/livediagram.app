'use client';

import { useCallback, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Dialog } from './dialog/Dialog';
import { Portal } from './Portal';
import { POPOVER_VIEWPORT_MARGIN as EDGE, clampIntoRange } from './popover';
import { usePopoverLayer } from './popover-stack';
import { useClickOutside } from './useClickOutside';
import { DialogInlineContext } from './dialog/dialog-slot';
import { useFocusTrap } from './useFocusTrap';
import { useMediaQuery } from './useMediaQuery';

// A panel of work that opens from the control that asked for it, never pushing the page about: from `sm` up a popover
// under its anchor (above it when only above has room), and on a phone a drawer rising from the bottom edge (the
// shared Dialog's phone sheet, with its grab handle and swipe to close). For a form too big for a ConfirmPopover and
// too small to deserve a centred modal (the Community Forum's New Post).
//
// The popover is portalled and fixed, so no scrolling column clips it; it follows its anchor as the page scrolls or
// resizes, and past the room on its side it scrolls inside. Escape (only the popover on top), or a press outside it
// and its anchor, closes it; opening focuses its first control and closing hands focus back.

const GAP = 8;
const SM = '(min-width: 640px)';
// Below this much room under the anchor, a popover with more room above opens above instead.
const MIN_ROOM_BELOW = 320;

export type ResponsivePopoverProps = {
  open: boolean;
  onClose: () => void;
  /** The control it opens from (kept in state by the host, so a new anchor re-places it). */
  anchor: HTMLElement | null;
  /** The id of the panel's heading, for its accessible name. */
  titleId: string;
  /** The popover's width in px from `sm` up (clamped to the window). */
  width?: number;
  /** Which edge lines up with the anchor's: its right (`end`, for a control at a row's right end) or left. */
  align?: 'start' | 'end';
  /** `side`: beside the anchor (its right, or its left without room), level with its top; a panel opened from a
   *  dialog sits beside the dialog. `below` (the default): under it, or above with more room there. */
  placement?: 'below' | 'side';
  /** No padding of its own: the content draws its own edges (a form with a sticky foot). */
  bare?: boolean;
  /** Asked before closing by a press outside, Escape or a swipe: false keeps it open. */
  beforeClose?: () => boolean;
  children: ReactNode;
};

type Place = { left: number; top?: number; bottom?: number; maxHeight: number; width: number };

export function placeResponsivePopover(
  anchor: { left: number; right: number; top: number; bottom: number },
  width: number,
  viewport: { width: number; height: number },
  align: 'start' | 'end',
): Place {
  const w = Math.min(width, viewport.width - EDGE * 2);
  const start = align === 'end' ? anchor.right - w : anchor.left;
  const left = clampIntoRange(start, EDGE, viewport.width - w - EDGE);
  const below = viewport.height - anchor.bottom - GAP - EDGE;
  const above = anchor.top - GAP - EDGE;
  return below >= MIN_ROOM_BELOW || below >= above
    ? { left, top: anchor.bottom + GAP, maxHeight: below, width: w }
    : { left, bottom: viewport.height - anchor.top + GAP, maxHeight: above, width: w };
}

/** Beside the anchor: its right when the panel fits there, else its left; level with its top, lifted so at least half
 *  the window's height is left to it. Without room either side, inside the dialog it was opened from (`within`, its
 *  box), at its right edge and within its height, never hanging over the dialog's edge; else held inside the window's
 *  right edge. */
export function placeSidePopover(
  anchor: { left: number; right: number; top: number; bottom: number },
  width: number,
  viewport: { width: number; height: number },
  within?: { left: number; right: number; top: number; bottom: number } | null,
): Place {
  const w = Math.min(width, viewport.width - EDGE * 2);
  const right = anchor.right + GAP;
  const leftSide = anchor.left - GAP - w;
  const fitsRight = right + w <= viewport.width - EDGE;
  const fitsLeft = leftSide >= EDGE;
  if (!fitsRight && !fitsLeft && within) {
    const inner = Math.min(w, within.right - within.left - GAP * 2);
    const top = Math.max(within.top, EDGE) + GAP;
    return {
      left: within.right - inner - GAP,
      top,
      maxHeight: Math.min(within.bottom, viewport.height - EDGE) - GAP - top,
      width: inner,
    };
  }
  const left = fitsRight ? right : fitsLeft ? leftSide : viewport.width - w - EDGE;
  const top = clampIntoRange(anchor.top, EDGE, Math.max(EDGE, viewport.height / 2));
  return { left, top, maxHeight: viewport.height - top - EDGE, width: w };
}

export function ResponsivePopover(props: ResponsivePopoverProps) {
  const desktop = useMediaQuery(SM);
  if (!props.open) return null;
  return desktop ? <AnchoredPanel {...props} /> : <PhoneDrawer {...props} />;
}

function PhoneDrawer({ onClose, titleId, beforeClose, bare, children }: ResponsivePopoverProps) {
  return (
    <Dialog
      open
      onClose={onClose}
      titleId={titleId}
      size="lg"
      phoneSheet
      closeOnBack
      {...(beforeClose ? { beforeClose } : {})}
    >
      {bare ? children : <div className="px-4 pb-4 pt-1">{children}</div>}
    </Dialog>
  );
}

function AnchoredPanel({
  onClose,
  anchor,
  titleId,
  width = 512,
  align = 'end',
  placement = 'below',
  bare = false,
  beforeClose,
  children,
}: ResponsivePopoverProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [place, setPlace] = useState<Place | null>(null);
  const close = useCallback(() => {
    if (!beforeClose || beforeClose()) onClose();
  }, [beforeClose, onClose]);

  useLayoutEffect(() => {
    let frame = 0;
    const measure = () => {
      if (!anchor) return;
      const viewport = { width: window.innerWidth, height: window.innerHeight };
      const at = anchor.getBoundingClientRect();
      setPlace(
        placement === 'side'
          ? placeSidePopover(
              at,
              width,
              viewport,
              anchor.closest('[data-dialog-panel]')?.getBoundingClientRect() ?? null,
            )
          : placeResponsivePopover(at, width, viewport, align),
      );
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener('resize', schedule);
    window.addEventListener('scroll', schedule, true);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', schedule);
      window.removeEventListener('scroll', schedule, true);
    };
  }, [anchor, width, align, placement]);

  useFocusTrap(ref, true);
  const { withinAbove } = usePopoverLayer(ref, (e) => {
    if (e.key !== 'Escape') return;
    e.preventDefault();
    e.stopPropagation();
    close();
  });
  useClickOutside(ref, (e) => {
    if (anchor?.contains(e.target as Node) || withinAbove(e.target)) return;
    close();
  });

  return (
    <Portal>
      <div
        ref={ref}
        role="dialog"
        aria-labelledby={titleId}
        data-responsive-popover=""
        className={`fixed z-[var(--z-modal)] animate-fade-in overflow-y-auto rounded-2xl border border-slate-200 bg-white ${bare ? '' : 'p-5'} shadow-xl shadow-slate-900/15 dark:border-slate-700 dark:bg-slate-900`}
        style={{
          left: place?.left ?? -9999,
          top: place?.top,
          bottom: place?.bottom,
          width: place?.width ?? width,
          maxHeight: place?.maxHeight,
          visibility: place ? 'visible' : 'hidden',
        }}
      >
        {/* Its own surface even when opened from a dialog drawn inside Tools: its headers draw in full. */}
        <DialogInlineContext value={false}>{children}</DialogInlineContext>
      </div>
    </Portal>
  );
}
