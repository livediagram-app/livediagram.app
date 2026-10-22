'use client';

import {
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { POPOVER_VIEWPORT_MARGIN } from '../popover';
import {
  HOVER_CARD_ARROW_PX,
  HOVER_CARD_GAP_PX,
  TOOLTIP_ARROW_PX,
  TOOLTIP_GAP_PX,
  type HintKind,
} from './hint-constants';
import { placeHint, type HintLayout, type HintPlacement } from './place-hint';

// Still frames before an open hint stops following its trigger (about half a second), until input wakes it.
export const HINT_FOLLOW_IDLE_FRAMES = 30;
import type { HintSurfaceProps } from './useHint';

// The three looks (docs/specs/004-interface-design/tooltips-hover-cards-popovers.md): an inverse pill
// for a tooltip, a white card for a hover card, a wider framed card for a preview. In dark mode both take the dark chrome's own
// colours, the Steel surface with a slate 700 border and light text, like the editor's menus;
// neither is ever a lighter card on the dark chrome. The arrow repeats the surface's colours so
// it reads as one shape.
const LOOK: Record<HintKind, { surface: string; arrow: string; gap: number; arrowPx: number }> = {
  tooltip: {
    surface:
      'max-w-xs rounded-md bg-slate-900 px-2 py-1 text-xs font-medium leading-snug text-white shadow-md shadow-slate-900/20 dark:border dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:shadow-slate-950/40',
    arrow: 'bg-slate-900 dark:border-slate-700 dark:bg-slate-900',
    gap: TOOLTIP_GAP_PX,
    arrowPx: TOOLTIP_ARROW_PX,
  },
  'hover-card': {
    surface:
      'w-56 rounded-lg border border-slate-200 bg-white px-3 py-2 text-left shadow-lg shadow-slate-900/10 dark:border-slate-700 dark:bg-slate-800 dark:shadow-slate-950/40',
    arrow: 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800',
    gap: HOVER_CARD_GAP_PX,
    arrowPx: HOVER_CARD_ARROW_PX,
  },
  // The hover card's surface, wider and with a small inset, so a picture sits in a frame.
  preview: {
    surface:
      'w-80 rounded-lg border border-slate-200 bg-white p-2 text-left shadow-lg shadow-slate-900/10 dark:border-slate-700 dark:bg-slate-800 dark:shadow-slate-950/40',
    arrow: 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800',
    gap: HOVER_CARD_GAP_PX,
    arrowPx: HOVER_CARD_ARROW_PX,
  },
};

// The portalled box both hints paint into. Measured off-screen and hidden
// for its first frame, then placed beside the anchor; re-placed on scroll,
// resize, and whenever the anchor moves (a canvas pan or zoom) while open. Portalled to <body> so it is never clipped by a
// panel and never moves the page (spec: no layout shift).
export function HintSurface({
  kind,
  anchor,
  surfaceProps,
  children,
}: {
  kind: HintKind;
  anchor: () => Element | null;
  surfaceProps: HintSurfaceProps;
  children: ReactNode;
}) {
  const id = useId();
  const ref = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState<HintLayout | null>(null);
  const look = LOOK[kind];

  useLayoutEffect(() => {
    const place = () => {
      const target = anchor();
      const surface = ref.current;
      if (!target || !surface) return;
      const box = surface.getBoundingClientRect();
      setLayout(
        placeHint({
          trigger: target.getBoundingClientRect(),
          surface: { width: box.width, height: box.height },
          viewport: { width: window.innerWidth, height: window.innerHeight },
          gap: look.gap,
          margin: POPOVER_VIEWPORT_MARGIN,
        }),
      );
    };
    place();
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    // A trigger can move without a scroll or a resize (a control on the canvas, as the canvas pans or
    // zooms): while open, the hint follows it, re-placing only on a frame where the trigger's box changed.
    // The loop sleeps after HINT_FOLLOW_IDLE_FRAMES still frames, and any input that can move the canvas
    // (a wheel, a pointer, a key) wakes it, so a hint left open costs nothing while nothing moves.
    let last = '';
    let idle = 0;
    let frame = 0;
    const follow = () => {
      const box = anchor()?.getBoundingClientRect();
      const key = box ? `${box.left},${box.top},${box.width},${box.height}` : '';
      if (key !== last) {
        if (last) place();
        last = key;
        idle = 0;
      } else idle += 1;
      frame = idle < HINT_FOLLOW_IDLE_FRAMES ? requestAnimationFrame(follow) : 0;
    };
    const wake = () => {
      idle = 0;
      if (!frame) frame = requestAnimationFrame(follow);
    };
    wake();
    const WAKE_EVENTS = ['wheel', 'pointermove', 'pointerup', 'keydown'] as const;
    for (const type of WAKE_EVENTS)
      window.addEventListener(type, wake, { capture: true, passive: true });
    return () => {
      if (frame) cancelAnimationFrame(frame);
      for (const type of WAKE_EVENTS) window.removeEventListener(type, wake, { capture: true });
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
    };
  }, [anchor, look.gap, children]);

  if (typeof document === 'undefined') return null;
  return createPortal(
    <div
      ref={ref}
      id={id}
      role="tooltip"
      data-hint={kind}
      {...surfaceProps}
      className={`pointer-events-auto fixed z-[var(--z-toast)] animate-fade-in motion-reduce:animate-none ${look.surface}`}
      style={
        layout
          ? { left: layout.left, top: layout.top }
          : { left: -9999, top: -9999, visibility: 'hidden' }
      }
    >
      {children}
      {layout ? (
        <Arrow
          placement={layout.placement}
          offset={layout.arrowOffset}
          size={look.arrowPx}
          className={look.arrow}
          bordered={kind !== 'tooltip'}
        />
      ) : null}
    </div>,
    document.body,
  );
}

// A rotated square half-tucked under the surface, pointing at the trigger.
// Only the two outward edges carry a border, so it merges with the box.
function Arrow({
  placement,
  offset,
  size,
  className,
  bordered,
}: {
  placement: HintPlacement;
  offset: number;
  size: number;
  className: string;
  bordered: boolean;
}) {
  const half = size / 2;
  // Literal class strings: Tailwind only generates classes it can read.
  // The tooltip pill is bordered in dark mode only, so its arrow borders
  // only there.
  const edges: Record<HintPlacement, { style: CSSProperties; border: string; darkBorder: string }> =
    {
      top: {
        style: { bottom: -half, left: offset - half },
        border: 'border-r border-b',
        darkBorder: 'dark:border-r dark:border-b',
      },
      bottom: {
        style: { top: -half, left: offset - half },
        border: 'border-l border-t',
        darkBorder: 'dark:border-l dark:border-t',
      },
      right: {
        style: { left: -half, top: offset - half },
        border: 'border-l border-b',
        darkBorder: 'dark:border-l dark:border-b',
      },
      left: {
        style: { right: -half, top: offset - half },
        border: 'border-r border-t',
        darkBorder: 'dark:border-r dark:border-t',
      },
    };
  const edge = edges[placement];
  return (
    <span
      aria-hidden
      className={`absolute ${bordered ? edge.border : edge.darkBorder} ${className}`}
      style={{ ...edge.style, width: size, height: size, transform: 'rotate(45deg)' }}
    />
  );
}
