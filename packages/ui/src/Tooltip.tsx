'use client';

import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { POPOVER_VIEWPORT_MARGIN, clampIntoRange } from './popover';

type TooltipProps = {
  title: ReactNode;
  // Optional one-line elaboration under the title. Omit it for simple
  // icon/label tooltips that just name the control (the card then shows
  // only the bold title).
  description?: string;
  // When true, the wrapping span renders as a full-width flex container so
  // the tooltip-wrapped child can stretch to fill a grid cell or flex
  // parent. Default (false) keeps the historical `inline-flex` behaviour
  // so existing toolbar usages don't reflow.
  block?: boolean;
  // Extra classes / inline style merged onto the wrapping span. Use when the
  // trigger must participate in its parent's layout (a flex/grid child, a
  // chart bar sized by a percentage) rather than sit inline. Appended after
  // the block/inline-flex base so callers can override the display.
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
};

type Placement = 'top' | 'bottom' | 'left' | 'right';

const TOOLTIP_WIDTH = 224; // matches w-56
const GAP = 10;
// Edge inset shared with every other floating box (packages/ui/popover).
const VIEWPORT_MARGIN = POPOVER_VIEWPORT_MARGIN;

// Custom tooltip with a bold title and a one-line description. Appears next
// to the wrapped element on hover/focus. Rendered via portal so it isn't
// clipped by floating panels or transform contexts.
//
// Placement is adaptive: the tooltip prefers `top` but falls back to
// `bottom`, then `right`, then `left` when there isn't room. The little
// arrow pointer tracks the anchor element so the connection between
// tooltip and trigger stays unambiguous even when the tooltip slides
// sideways to stay on-screen.
export function Tooltip({
  title,
  description,
  block = false,
  className,
  style,
  children,
}: TooltipProps) {
  const wrapRef = useRef<HTMLSpanElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [layout, setLayout] = useState<{
    left: number;
    top: number;
    placement: Placement;
    arrowOffset: number;
  } | null>(null);

  useLayoutEffect(() => {
    if (!visible || !wrapRef.current) return;
    const target = wrapRef.current.firstElementChild ?? wrapRef.current;
    const trigger = target.getBoundingClientRect();
    const card = cardRef.current?.getBoundingClientRect();
    const cardWidth = card?.width ?? TOOLTIP_WIDTH;
    const cardHeight = card?.height ?? 48;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    // Decide placement: top > bottom > right > left, picking the first
    // that fits the card within the viewport (with margin).
    const fitsTop = trigger.top - cardHeight - GAP >= VIEWPORT_MARGIN;
    const fitsBottom = trigger.bottom + cardHeight + GAP <= vh - VIEWPORT_MARGIN;
    const fitsRight = trigger.right + cardWidth + GAP <= vw - VIEWPORT_MARGIN;
    const fitsLeft = trigger.left - cardWidth - GAP >= VIEWPORT_MARGIN;
    const placement: Placement = fitsTop
      ? 'top'
      : fitsBottom
        ? 'bottom'
        : fitsRight
          ? 'right'
          : fitsLeft
            ? 'left'
            : 'top';

    let left: number;
    let top: number;
    let arrowOffset: number;
    const triggerCenterX = trigger.left + trigger.width / 2;
    const triggerCenterY = trigger.top + trigger.height / 2;

    if (placement === 'top' || placement === 'bottom') {
      // Centre under the trigger horizontally, then clamp into the
      // viewport. The arrow stays pinned to the trigger's centre
      // even when the card slides.
      const idealLeft = triggerCenterX - cardWidth / 2;
      left = clampIntoRange(idealLeft, VIEWPORT_MARGIN, vw - VIEWPORT_MARGIN - cardWidth);
      top = placement === 'top' ? trigger.top - cardHeight - GAP : trigger.bottom + GAP;
      arrowOffset = triggerCenterX - left;
    } else {
      const idealTop = triggerCenterY - cardHeight / 2;
      top = clampIntoRange(idealTop, VIEWPORT_MARGIN, vh - VIEWPORT_MARGIN - cardHeight);
      left = placement === 'right' ? trigger.right + GAP : trigger.left - cardWidth - GAP;
      arrowOffset = triggerCenterY - top;
    }

    setLayout({ left, top, placement, arrowOffset });
  }, [visible, title, description]);

  const show = () => {
    // Suppress on coarse-pointer devices (phones, tablets): browsers
    // synthesise mouseenter on tap, so without this every tap on a
    // tooltipped button would flash the card. On touch surfaces the
    // affordance is the icon + the tap-to-act gesture itself; the
    // tooltip text is desktop-only chrome.
    if (typeof window !== 'undefined' && window.matchMedia?.('(hover: none)').matches) {
      return;
    }
    setVisible(true);
  };
  const hide = () => {
    setVisible(false);
    setLayout(null);
  };

  return (
    <span
      ref={wrapRef}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
      className={`${block ? 'flex w-full' : 'inline-flex'}${className ? ` ${className}` : ''}`}
      style={style}
    >
      {children}
      {visible && typeof document !== 'undefined'
        ? createPortal(
            <div
              ref={cardRef}
              role="tooltip"
              className="pointer-events-none fixed z-[var(--z-toast)] w-56 animate-fade-in rounded-lg border border-slate-200 bg-white px-3 py-2 text-left shadow-lg shadow-slate-900/10 dark:border-slate-700 dark:bg-slate-800 dark:shadow-slate-950/40"
              style={
                layout
                  ? { left: layout.left, top: layout.top }
                  : { left: -9999, top: -9999, visibility: 'hidden' }
              }
            >
              <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">{title}</p>
              {description ? (
                <p className="mt-0.5 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                  {description}
                </p>
              ) : null}
              {layout ? <Arrow placement={layout.placement} offset={layout.arrowOffset} /> : null}
            </div>,
            document.body,
          )
        : null}
    </span>
  );
}

// Triangle that connects the card to its anchor. Rendered as a CSS-
// rotated square so it inherits the card's border + shadow. Border /
// background colours come from Tailwind classes so dark mode flips
// them with the rest of the tooltip; positioning stays inline because
// `offset` is computed per-tooltip.
function Arrow({ placement, offset }: { placement: Placement; offset: number }) {
  const style: React.CSSProperties = { position: 'absolute' };
  const size = 10;
  let borderClass = '';
  if (placement === 'top') {
    style.bottom = -size / 2;
    style.left = offset - size / 2;
    borderClass = 'border-r border-b';
  } else if (placement === 'bottom') {
    style.top = -size / 2;
    style.left = offset - size / 2;
    borderClass = 'border-l border-t';
  } else if (placement === 'right') {
    style.left = -size / 2;
    style.top = offset - size / 2;
    borderClass = 'border-l border-b';
  } else {
    style.right = -size / 2;
    style.top = offset - size / 2;
    borderClass = 'border-r border-t';
  }
  return (
    <span
      aria-hidden
      className={`${borderClass} border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800`}
      style={{
        ...style,
        width: size,
        height: size,
        transform: 'rotate(45deg)',
      }}
    />
  );
}
