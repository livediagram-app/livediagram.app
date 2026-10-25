'use client';

// A small panel anchored to the control that opened it (Add Field, for one), portal-rendered so a scrolling dialog body or a narrow column never clips or squeezes it. It opens under
// its anchor, left-aligned, or above it when there is not room below, clamped on-screen. The side is chosen once:
// as its content grows (a form growing a field) it grows away from the anchor, scrolling past the room it has, and
// never flips; it follows the anchor as the page scrolls or resizes. Sits above the modal layer,
// so it can open from inside a dialog: the dialog closes only on a press that starts on its own backdrop, so a
// press in here never closes it. Escape (taken before the dialog's own) and a press outside close it; opening
// focuses its first control and closing hands focus back to the anchor.
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Portal, useClickOutside } from '@liveplanner/ui';
import { VIEWPORT_EDGE_MARGIN as EDGE } from '@/lib/clamp-to-viewport';
import { usePopoverLayer } from '@liveworkspace/workbench/components/primitives/popover-stack';

const GAP = 6; // space between the anchor and the panel
// The least room a panel takes on its side, however little the window leaves it (an on-screen keyboard that shrinks
// the window must not squeeze it to nothing: useFloatingKeyboardAvoidance moves it into view instead).
export const MIN_ROOM_PX = 160;
const FOCUSABLE =
  'input, select, textarea, button:not([disabled]), [tabindex]:not([tabindex="-1"])';

export type AnchoredSide = 'below' | 'above';

export type AnchoredPlace = {
  left: number;
  side: AnchoredSide;
  // The edge held to the anchor: `top` below it, `bottom` (from the viewport's bottom) above it, so the panel grows
  // away from the anchor as its content grows, and never jumps.
  top?: number;
  bottom?: number;
  // The room on that side; past it the panel scrolls.
  maxHeight: number;
};

// Where the panel goes. Its side is chosen once, when it opens (`side` absent): under the anchor, or above it when
// only above has room for it; after that the side is kept (`side` given), whatever the panel grows to, so picking
// something that adds a row never flips it across the anchor. The left edge is clamped on-screen.
export function placeAnchored(
  anchor: { left: number; top: number; bottom: number },
  size: { width: number; height: number },
  viewport: { width: number; height: number },
  side?: AnchoredSide,
): AnchoredPlace {
  const left = Math.max(EDGE, Math.min(anchor.left, viewport.width - size.width - EDGE));
  const roomBelow = viewport.height - (anchor.bottom + GAP) - EDGE;
  const roomAbove = anchor.top - GAP - EDGE;
  const chosen: AnchoredSide =
    side ?? (roomBelow >= size.height || roomBelow >= roomAbove ? 'below' : 'above');
  const floor = Math.min(size.height, MIN_ROOM_PX);
  return chosen === 'below'
    ? { left, side: chosen, top: anchor.bottom + GAP, maxHeight: Math.max(floor, roomBelow) }
    : {
        left,
        side: chosen,
        bottom: viewport.height - (anchor.top - GAP),
        maxHeight: Math.max(floor, roomAbove),
      };
}

// Beside a host panel instead (a menu narrower than what it opens): to its right, level with the
// anchor, else to its left when the right has no room; the top is clamped on-screen.
export function placeBeside(
  anchor: { top: number },
  host: { left: number; right: number },
  size: { width: number; height: number },
  viewport: { width: number; height: number },
): AnchoredPlace {
  const right = host.right + GAP;
  const left =
    right + size.width <= viewport.width - EDGE
      ? right
      : Math.max(EDGE, host.left - GAP - size.width);
  const top = Math.max(EDGE, Math.min(anchor.top, viewport.height - EDGE - size.height));
  return { left, side: 'below', top, maxHeight: Math.max(0, viewport.height - top - EDGE) };
}

export function AnchoredPopover({
  anchor,
  name,
  width,
  onClose,
  onEscape,
  beside,
  keepOpenWithin,
  children,
}: {
  anchor: HTMLElement;
  // The panel's accessible name.
  name: string;
  width: number;
  onClose: () => void;
  // Escape asked first: true when it was taken (a drill-down went back a level), the panel then staying open.
  onEscape?: () => boolean;
  // Open beside this panel rather than under the anchor (placeBeside).
  beside?: HTMLElement | null;
  // A press inside what this selector matches (a menu's flyout, a picker it opened, portalled elsewhere) is not a
  // press outside.
  keepOpenWithin?: string;
  children: ReactNode;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<AnchoredPlace | null>(null);
  // The side chosen on opening, kept from then on.
  const side = useRef<AnchoredSide | undefined>(undefined);
  const close = () => {
    onClose();
    anchor.focus();
  };
  const closeRef = useRef(close);
  const escapeRef = useRef(onEscape);
  useEffect(() => {
    closeRef.current = close;
    escapeRef.current = onEscape;
  });

  useLayoutEffect(() => {
    const place = () => {
      const node = panel.current;
      if (!node) return;
      const w = Math.min(width, window.innerWidth - 2 * EDGE);
      const viewport = { width: window.innerWidth, height: window.innerHeight };
      const size = { width: w, height: node.scrollHeight };
      const next = beside
        ? placeBeside(
            anchor.getBoundingClientRect(),
            beside.getBoundingClientRect(),
            size,
            viewport,
          )
        : placeAnchored(anchor.getBoundingClientRect(), size, viewport, side.current);
      side.current = next.side;
      setPos(next);
    };
    place();
    const grow = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(place);
    if (panel.current) grow?.observe(panel.current);
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      grow?.disconnect();
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [anchor, width, beside]);

  useEffect(() => {
    panel.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus();
  }, []);

  // Escape closes this panel only, before the dialog's own Escape, and only while it is the top popover
  // (popover-stack.ts): a popover it opened (a colour picker, a ConfirmPopover) takes Escape first, and this one
  // stays.
  const { withinAbove } = usePopoverLayer(panel, (e) => {
    if (e.key !== 'Escape') return;
    e.stopPropagation();
    e.preventDefault();
    if (escapeRef.current?.()) return;
    closeRef.current();
  });
  // A press outside closes it; a press on the anchor is the anchor's own toggle, and one in a popover it opened
  // (a picker, a ConfirmPopover) is that popover's.
  useClickOutside(panel, (e) => {
    if (withinAbove(e.target)) return;
    if (keepOpenWithin && e.target instanceof Element && e.target.closest(keepOpenWithin)) return;
    if (!(e.target instanceof Node && anchor.contains(e.target))) onClose();
  });

  return (
    <Portal>
      <div
        ref={panel}
        role="dialog"
        aria-label={name}
        // A host popover's outside-press check leaves this one alone.
        data-anchored-popover
        // Over its dialog, over a tour ring drawn on that dialog (TourStage layer="modal", one below), so a
        // menu opened mid-tour is never dimmed, and over a menu's flyout (z-popover) it opens from.
        className="fixed z-[calc(var(--z-popover)+1)] overflow-y-auto overscroll-contain rounded-lg shadow-lg"
        style={{
          width: `min(${width}px, calc(100vw - ${2 * EDGE}px))`,
          left: pos?.left ?? -9999,
          ...(pos?.side === 'above' ? { bottom: pos.bottom } : { top: pos?.top ?? -9999 }),
          ...(pos ? { maxHeight: pos.maxHeight } : {}),
        }}
      >
        {children}
      </div>
    </Portal>
  );
}
