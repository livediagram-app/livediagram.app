'use client';

import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';
import { Tooltip } from './Tooltip';

type PanelSize = { width: number; height: number };

type MovablePanelProps = {
  // Caps-styled label that sits at the top-left of the header (acts as
  // the panel's name + the drag handle).
  title: string;
  // Last user-set position in canvas-relative pixels. `null` means the
  // panel hasn't been dragged yet — render at the default corner.
  position: { x: number; y: number } | null;
  // Where to render the panel when the user hasn't dragged it yet.
  defaultCorner: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  // Tailwind width utility for the panel body (e.g. `w-56`, `w-64`).
  // Ignored once the user has resized — explicit px size wins.
  width?: string;
  // User-set size in px. `null` ⇒ the panel grows with its content
  // and respects the `width` utility. Once dragged from the resize
  // handle, the caller persists the size and passes it back in.
  size?: PanelSize | null;
  // Minimum size in px when the user drags the resize handle. Stops
  // them from collapsing the panel into a sliver too small to use.
  minWidth?: number;
  minHeight?: number;
  onResize?: (size: PanelSize) => void;
  // Optional content rendered to the right of the title inside the
  // drag-handle row. Used by panels (e.g. Activity) that want to
  // surface a status badge in the header without inventing a new
  // bar. Pointer events stay live so buttons inside still click.
  headerExtra?: ReactNode;
  onMoveTo: (x: number, y: number) => void;
  onMinimize: () => void;
  children: ReactNode;
};

// Floating, draggable panel pinned over the canvas. The header row is the
// drag handle; a minimize button collapses the panel into a dock button
// (which the caller renders elsewhere — see Canvas's bottom dock).
//
// Shared by the command palette and the Explorer. Anything that wants to
// behave like "a draggable floating panel that can be minimised" should
// build on top of this rather than reinventing the drag + header glue.
export function MovablePanel({
  title,
  position,
  defaultCorner,
  width = 'w-56',
  size = null,
  minWidth = 200,
  minHeight = 200,
  onResize,
  headerExtra,
  onMoveTo,
  onMinimize,
  children,
}: MovablePanelProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<{
    startClientX: number;
    startClientY: number;
    startX: number;
    startY: number;
  } | null>(null);
  const [resize, setResize] = useState<{
    startClientX: number;
    startClientY: number;
    startWidth: number;
    startHeight: number;
    // Pre-resize panel left position. Only consulted for bottom-left
    // grip: shrinking width from the left moves the panel's left
    // origin so the right edge stays anchored.
    startLeft: number;
    startTop: number;
    grip: 'bottom-left' | 'bottom-right';
  } | null>(null);

  useEffect(() => {
    if (!drag) return;
    const onMove = (e: PointerEvent) => {
      onMoveTo(
        drag.startX + (e.clientX - drag.startClientX),
        drag.startY + (e.clientY - drag.startClientY),
      );
    };
    const onUp = () => setDrag(null);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [drag, onMoveTo]);

  // Where the resize grip sits is derived per-render from where the
  // panel actually is on screen. Panels on the right half use a
  // bottom-left grip so the right edge stays anchored; panels on the
  // left half use a bottom-right grip. This means dragging a panel
  // across the screen automatically swaps the grip side.
  const node = ref.current;
  const panelCenterX = node
    ? node.offsetLeft + node.offsetWidth / 2
    : defaultCorner === 'top-right' || defaultCorner === 'bottom-right'
      ? Number.POSITIVE_INFINITY
      : Number.NEGATIVE_INFINITY;
  const viewportWidth =
    typeof window === 'undefined' ? Number.POSITIVE_INFINITY : window.innerWidth;
  const resizeFrom: 'bottom-left' | 'bottom-right' =
    panelCenterX > viewportWidth / 2 ? 'bottom-left' : 'bottom-right';

  useEffect(() => {
    if (!resize || !onResize) return;
    const onMove = (e: PointerEvent) => {
      const dx = e.clientX - resize.startClientX;
      const dy = e.clientY - resize.startClientY;
      const h = Math.max(minHeight, resize.startHeight + dy);
      // The grip side is locked in at the start of the drag — we
      // captured it into the resize state — so flipping sides mid-
      // drag doesn't yank the panel around when the centre crosses
      // the viewport midline.
      if (resize.grip === 'bottom-left') {
        const targetWidth = resize.startWidth - dx;
        const w = Math.max(minWidth, targetWidth);
        const clampedDx = resize.startWidth - w;
        onResize({ width: w, height: h });
        onMoveTo(resize.startLeft + clampedDx, resize.startTop);
      } else {
        const w = Math.max(minWidth, resize.startWidth + dx);
        onResize({ width: w, height: h });
      }
    };
    const onUp = () => setResize(null);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [resize, onResize, minWidth, minHeight, onMoveTo]);

  const beginDrag = (e: ReactPointerEvent) => {
    e.stopPropagation();
    const node = ref.current;
    if (!node) return;
    const startX = node.offsetLeft;
    const startY = node.offsetTop;
    // If the panel hasn't been positioned yet, freeze the current corner
    // position so subsequent deltas don't snap it to (0,0).
    if (position === null) onMoveTo(startX, startY);
    setDrag({ startClientX: e.clientX, startClientY: e.clientY, startX, startY });
  };

  const beginResize = (e: ReactPointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const local = ref.current;
    if (!local) return;
    const startLeft = local.offsetLeft;
    const startTop = local.offsetTop;
    // Freeze the corner-positioned panel's place before the resize
    // starts so the bottom-left handler has a real left coordinate
    // to slide from. Without this, position stays null and the
    // panel jumps to (0,0) on the first move.
    if (position === null && resizeFrom === 'bottom-left') onMoveTo(startLeft, startTop);
    setResize({
      startClientX: e.clientX,
      startClientY: e.clientY,
      startWidth: local.offsetWidth,
      startHeight: local.offsetHeight,
      startLeft,
      startTop,
      grip: resizeFrom,
    });
  };

  const style: React.CSSProperties = {
    ...(position ? { left: position.x, top: position.y } : {}),
    // Inline size wins over the Tailwind width utility when the user
    // has dragged the resize handle. We force both dimensions so the
    // panel can grow and shrink along either axis.
    ...(size ? { width: size.width, height: size.height } : {}),
  };
  const cornerClass = position
    ? ''
    : defaultCorner === 'top-right'
      ? 'right-4 top-4'
      : defaultCorner === 'bottom-left'
        ? 'bottom-4 left-4'
        : defaultCorner === 'bottom-right'
          ? 'bottom-4 right-4'
          : 'left-4 top-4';
  // Tailwind `width` utility is only meaningful when the user hasn't
  // resized — once they have, the inline `width` style takes over and
  // we drop the class so it doesn't fight for specificity.
  const widthClass = size ? '' : width;

  return (
    <div
      ref={ref}
      onPointerDown={(e) => e.stopPropagation()}
      style={style}
      className={`pointer-events-auto absolute z-10 flex ${widthClass} flex-col rounded-lg border border-slate-200 bg-white shadow-lg shadow-slate-900/5 ${cornerClass}`}
    >
      <div
        onPointerDown={beginDrag}
        className={`flex items-center justify-between gap-2 rounded-t-lg px-2 pt-2 pb-1.5 ${drag ? 'cursor-grabbing' : 'cursor-grab'}`}
      >
        <span className="select-none text-[10px] font-semibold uppercase tracking-wider text-slate-500">
          {title}
        </span>
        {headerExtra ? (
          <div
            onPointerDown={(e) => e.stopPropagation()}
            className="ml-auto mr-1 flex items-center"
          >
            {headerExtra}
          </div>
        ) : null}
        <Tooltip
          title={`Minimize ${title.toLowerCase()}`}
          description="Collapse this panel into a button at the bottom of the canvas."
        >
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={onMinimize}
            aria-label={`Minimize ${title.toLowerCase()}`}
            className="flex h-5 w-5 items-center justify-center rounded text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
              <line
                x1="2.5"
                y1="6"
                x2="9.5"
                y2="6"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </Tooltip>
      </div>
      {/* Body. Always a min-h-0 flex column so children that opt into
          `flex-1` can fill the panel's remaining height when the user
          resizes it. Each panel handles its own internal scrolling so
          we don't double up scrollbars. */}
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
      {/* Resize handle. Only rendered when the caller wires onResize —
          otherwise the panel stays content-sized as before. Corner
          and cursor flip based on `resizeFrom` so right-anchored
          panels grow toward the canvas centre and their handle stays
          visible. */}
      {onResize ? (
        <div
          role="separator"
          aria-label={`Resize ${title.toLowerCase()}`}
          onPointerDown={beginResize}
          className={`absolute bottom-0 flex h-4 w-4 items-end p-0.5 text-slate-300 hover:text-slate-500 ${
            resizeFrom === 'bottom-left' ? 'left-0 cursor-sw-resize justify-start' : 'right-0 cursor-se-resize justify-end'
          }`}
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden>
            {resizeFrom === 'bottom-left' ? (
              <path d="M1 4L6 9M3 9L1 7" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
            ) : (
              <path d="M9 4L4 9M9 7L7 9" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
            )}
          </svg>
        </div>
      ) : null}
    </div>
  );
}

// Round dock button rendered next to the zoom controls when a MovablePanel
// is minimised. Same visual language as ZoomControls' IconButton but
// pill-shaped so it reads as a distinct entry-point.
export function DockButton({
  label,
  description,
  icon,
  onClick,
}: {
  label: string;
  description: string;
  icon: ReactNode;
  onClick: () => void;
}) {
  return (
    <Tooltip title={label} description={description}>
      <button
        type="button"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={onClick}
        aria-label={label}
        className="pointer-events-auto flex h-11 w-11 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-lg shadow-slate-900/5 transition hover:bg-slate-50 hover:text-slate-900"
      >
        {icon}
      </button>
    </Tooltip>
  );
}
