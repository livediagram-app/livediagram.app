// Shared building blocks used by all boxed element views (shape, text, sticky).
// Kept here to avoid duplication across the three view components.

import type { PointerEvent as ReactPointerEvent } from 'react';
import type { DragMode } from '@/lib/canvas';
import {
  FLOATING_CONTROL_CLASS,
  FLOATING_CONTROL_GAP,
  FLOATING_CONTROL_HOVER_CLASS,
} from './floating-controls';

// --- Lock badge ------------------------------------------------------------

export function LockBadge({ zoom = 1 }: { zoom?: number }) {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute -left-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-brand-500 text-white shadow-sm"
      style={{ transform: `scale(${1 / zoom})`, transformOrigin: 'center' }}
    >
      <svg
        width="11"
        height="11"
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="3" y="7.5" width="10" height="6.5" rx="1.25" />
        <path d="M5.25 7.5V5a2.75 2.75 0 0 1 5.5 0v2.5" />
      </svg>
    </div>
  );
}

// --- Resize handles --------------------------------------------------------

type HandlePosition = 'nw' | 'ne' | 'sw' | 'se';

// -1.5 (6px) offset centres a 12px (h-3) handle on the corner. Same round
// white style as the plus buttons (FLOATING_CONTROL_CLASS), kept small so
// the four corner grips stay unobtrusive.
const positionClasses: Record<HandlePosition, string> = {
  nw: '-top-1.5 -left-1.5 cursor-nwse-resize',
  ne: '-top-1.5 -right-1.5 cursor-nesw-resize',
  sw: '-bottom-1.5 -left-1.5 cursor-nesw-resize',
  se: '-bottom-1.5 -right-1.5 cursor-nwse-resize',
};

// Pseudo-element that extends each handle's pointer-capture region on
// touch devices without altering the visual size of the white-fill
// square. A fingertip needs roughly 44 px to land reliably (iOS HIG);
// the visible square stays 12 px so the selection chrome doesn't get
// clunky, but on `(pointer: coarse)` an invisible ::before pad fans
// out 16 px on every side, giving a 44 x 44 hit target. Desktop mice
// keep the unchanged 12 x 12 hit area, so precise corner-resize on a
// trackpad doesn't suddenly start snagging adjacent handles.
const HIT_PAD_CLASSES =
  "pointer-coarse:before:absolute pointer-coarse:before:-inset-[16px] pointer-coarse:before:content-['']";

type ResizeHandlesProps = {
  elementId: string;
  zoom: number;
  onBeginDrag: (id: string, mode: DragMode, e: ReactPointerEvent) => void;
};

export function ResizeHandles({ elementId, zoom, onBeginDrag }: ResizeHandlesProps) {
  return (
    <>
      {(Object.keys(positionClasses) as HandlePosition[]).map((pos) => (
        <div
          key={pos}
          onPointerDown={(e) => {
            e.stopPropagation();
            onBeginDrag(elementId, `resize-${pos}`, e);
          }}
          style={{ transform: `scale(${1 / zoom})`, transformOrigin: 'center' }}
          className={`pointer-events-auto absolute h-3 w-3 opacity-70 hover:opacity-100 ${FLOATING_CONTROL_CLASS} ${FLOATING_CONTROL_HOVER_CLASS} ${positionClasses[pos]} ${HIT_PAD_CLASSES}`}
        />
      ))}
    </>
  );
}

// --- Rotate handle ---------------------------------------------------------

type RotateHandleProps = {
  elementId: string;
  zoom: number;
  onBeginRotate: (
    elementId: string,
    centerClientX: number,
    centerClientY: number,
    e: ReactPointerEvent,
  ) => void;
};

// Custom cursor for the rotate handle. CSS has no "rotate" cursor, so
// we inline a small circular-arrow SVG (drawn twice: a fat white halo
// under a dark glyph so it reads on any canvas colour) with the hotspot
// centred at 12,12 and `grab` as the fallback.
const ROTATE_CURSOR =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M19.5 12a7.5 7.5 0 1 1-2.2-5.3' stroke='%23ffffff' stroke-width='4'/%3E%3Cpath d='M19.5 4v4h-4' stroke='%23ffffff' stroke-width='4'/%3E%3Cpath d='M19.5 12a7.5 7.5 0 1 1-2.2-5.3' stroke='%231e293b' stroke-width='2'/%3E%3Cpath d='M19.5 4v4h-4' stroke='%231e293b' stroke-width='2'/%3E%3C/svg%3E\") 12 12, grab";

// A circular handle (same size + style as the plus buttons) whose
// centre lines up with the bottom + right plus buttons: anchored at the
// element's SE corner (left/top 100%) and nudged out by the same
// FLOATING_CONTROL_GAP the plus buttons use, so the four edge plusses
// and this corner handle form one tidy ring well clear of the resize
// handles. Dragging it spins the element about its centre, which is
// read from the wrapper's bounding rect at grab time (rotation is about
// the centre, so that rect's centre is the pivot at any angle).
export function RotateHandle({ elementId, zoom, onBeginRotate }: RotateHandleProps) {
  return (
    <div
      onPointerDown={(e) => {
        e.stopPropagation();
        const wrapper = (e.currentTarget as HTMLElement).closest('[data-element-id]');
        const rect = wrapper?.getBoundingClientRect();
        if (!rect) return;
        onBeginRotate(elementId, rect.left + rect.width / 2, rect.top + rect.height / 2, e);
      }}
      style={{
        left: '100%',
        top: '100%',
        transform: `translate(${FLOATING_CONTROL_GAP / zoom}px, ${FLOATING_CONTROL_GAP / zoom}px) scale(${1 / zoom})`,
        transformOrigin: 'top left',
        cursor: ROTATE_CURSOR,
      }}
      className={`pointer-events-auto absolute flex h-6 w-6 items-center justify-center opacity-70 hover:opacity-100 ${FLOATING_CONTROL_CLASS} ${FLOATING_CONTROL_HOVER_CLASS} ${HIT_PAD_CLASSES}`}
      aria-hidden
    >
      <RotateIcon />
    </div>
  );
}

function RotateIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
      {/* Three-quarter circular arrow — the conventional "rotate" glyph. */}
      <path
        d="M12.5 5.5A5 5 0 1 0 13 8"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M12.8 2.5v3.2h-3.2"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// --- Union resize handles (for multi-selection + group resize) ------------

type UnionResizeHandlesProps = {
  // Canvas-space bounds of the union (selection bounding box).
  bounds: { x: number; y: number; width: number; height: number };
  // The id we hand back to onBeginDrag — typically the primary
  // (currently-selected) element. The drag effect picks up every
  // other member from the captured startBounds so they all scale
  // proportionally.
  primaryId: string;
  zoom: number;
  onBeginDrag: (id: string, mode: DragMode, e: ReactPointerEvent) => void;
};

// Renders the same 4 corner handles as ResizeHandles, but positioned
// in canvas-space at the union bounding box of a multi-selection /
// group. Mounted inside the viewport-transformed wrapper so its
// coordinates pan + zoom with the canvas; the handles themselves are
// counter-scaled so they remain a constant on-screen size.
export function UnionResizeHandles({
  bounds,
  primaryId,
  zoom,
  onBeginDrag,
}: UnionResizeHandlesProps) {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute"
      style={{
        left: bounds.x,
        top: bounds.y,
        width: bounds.width,
        height: bounds.height,
      }}
    >
      {(Object.keys(positionClasses) as HandlePosition[]).map((pos) => (
        <div
          key={pos}
          onPointerDown={(e) => {
            e.stopPropagation();
            onBeginDrag(primaryId, `resize-${pos}`, e);
          }}
          style={{ transform: `scale(${1 / zoom})`, transformOrigin: 'center' }}
          className={`pointer-events-auto absolute h-3 w-3 rounded-sm border border-brand-600 bg-white dark:border-brand-300 dark:bg-slate-900 ${positionClasses[pos]} ${HIT_PAD_CLASSES}`}
        />
      ))}
    </div>
  );
}
