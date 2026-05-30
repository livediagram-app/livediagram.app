'use client';

import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';
import { Tooltip } from './Tooltip';

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
  width?: string;
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

  const style: React.CSSProperties = position ? { left: position.x, top: position.y } : {};
  const cornerClass = position
    ? ''
    : defaultCorner === 'top-right'
      ? 'right-4 top-4'
      : defaultCorner === 'bottom-left'
        ? 'bottom-16 left-4'
        : defaultCorner === 'bottom-right'
          ? 'bottom-16 right-4'
          : 'left-4 top-4';

  return (
    <div
      ref={ref}
      onPointerDown={(e) => e.stopPropagation()}
      style={style}
      className={`pointer-events-auto absolute z-10 flex ${width} flex-col rounded-lg border border-slate-200 bg-white shadow-lg shadow-slate-900/5 ${cornerClass}`}
    >
      <div
        onPointerDown={beginDrag}
        className={`flex items-center justify-between gap-2 rounded-t-lg px-2 pt-2 pb-1.5 ${drag ? 'cursor-grabbing' : 'cursor-grab'}`}
      >
        <span className="select-none text-[10px] font-semibold uppercase tracking-wider text-slate-500">
          {title}
        </span>
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
      {children}
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
