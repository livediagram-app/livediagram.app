// Shared building blocks used by all boxed element views (shape, text, sticky).
// Kept here to avoid duplication across the three view components.

import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react';
import type { DragMode } from '@/lib/canvas';
import { ADORNMENT_MIN_ZOOM } from '@/components/canvas/element-badges';
import {
  FLOATING_CONTROL_CLASS,
  FLOATING_CONTROL_HOVER_CLASS,
} from '@/components/chrome/floating-controls';

// --- Lock badge ------------------------------------------------------------

export function LockBadge({ zoom = 1 }: { zoom?: number }) {
  // Scales with the canvas and hides at overview zooms, like the other
  // on-element adornments (element-badges.tsx). The resize handles below
  // KEEP their counter-scaling: interaction grips need a constant hit size.
  if (zoom < ADORNMENT_MIN_ZOOM) return null;
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute -left-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-brand-500 text-white shadow-sm"
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
// the four corner grips stay unobtrusive. The cursor is computed from the
// rotation (resizeCursor), not baked in, so it stays correct when rotated.
const positionClasses: Record<HandlePosition, string> = {
  nw: '-top-1.5 -left-1.5',
  ne: '-top-1.5 -right-1.5',
  sw: '-bottom-1.5 -left-1.5',
  se: '-bottom-1.5 -right-1.5',
};

// The four corner handles, typed (Object.keys widens to string[]). Computed
// once here rather than per-render in each handle component below.
const HANDLE_POSITIONS = Object.keys(positionClasses) as HandlePosition[];

// Resize axis angle (degrees, y-down, mod 180) for each corner / edge, used
// to pick the right resize cursor once the element's rotation is added.
const HANDLE_AXIS: Record<string, number> = {
  nw: 45,
  se: 45,
  ne: 135,
  sw: 135,
  // Edge handles: n/s resize height (vertical axis), e/w width (horizontal).
  n: 90,
  s: 90,
  e: 0,
  w: 0,
};

// The CSS resize cursor for a handle whose resize axis sits at `baseAngle`,
// rotated by `rotation` degrees. Snaps to the nearest of the four cursors
// browsers offer for diagonal / orthogonal resizing.
export function resizeCursor(handle: string, rotation: number): string {
  const base = HANDLE_AXIS[handle] ?? 0;
  const a = (((base + rotation) % 180) + 180) % 180;
  const bucket = (Math.round(a / 45) * 45) % 180; // 0 | 45 | 90 | 135
  return bucket === 0
    ? 'ew-resize'
    : bucket === 45
      ? 'nwse-resize'
      : bucket === 90
        ? 'ns-resize'
        : 'nesw-resize';
}

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
  // Element rotation in degrees, so the resize cursor matches the visual
  // diagonal once the box is turned.
  rotation?: number;
  onBeginDrag: (id: string, mode: DragMode, e: ReactPointerEvent) => void;
};

function ResizeHandles({ elementId, zoom, rotation = 0, onBeginDrag }: ResizeHandlesProps) {
  return (
    <>
      {HANDLE_POSITIONS.map((pos) => (
        <div
          key={pos}
          onPointerDown={(e) => {
            e.stopPropagation();
            onBeginDrag(elementId, `resize-${pos}`, e);
          }}
          style={{
            transform: `scale(${1 / zoom})`,
            transformOrigin: 'center',
            cursor: resizeCursor(pos, rotation),
          }}
          className={`pointer-events-auto absolute h-3 w-3 opacity-70 hover:opacity-100 ${FLOATING_CONTROL_CLASS} ${FLOATING_CONTROL_HOVER_CLASS} ${positionClasses[pos]} ${HIT_PAD_CLASSES}`}
        />
      ))}
    </>
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
      {HANDLE_POSITIONS.map((pos) => (
        <div
          key={pos}
          onPointerDown={(e) => {
            e.stopPropagation();
            onBeginDrag(primaryId, `resize-${pos}`, e);
          }}
          style={{
            transform: `scale(${1 / zoom})`,
            transformOrigin: 'center',
            // Match the single-selection ResizeHandles: a resize cursor on
            // the grip, so it wins over the canvas mode cursor (crosshair in
            // select, grab in pan). The union box is never rotated, so the
            // base angle alone picks the diagonal (rotation = 0).
            cursor: resizeCursor(pos, 0),
          }}
          className={`pointer-events-auto absolute h-3 w-3 rounded-sm border border-brand-600 bg-white dark:border-brand-300 dark:bg-slate-900 ${positionClasses[pos]} ${HIT_PAD_CLASSES}`}
        />
      ))}
    </div>
  );
}

// --- Selection chrome layer -------------------------------------------------

// The per-element selection chrome (corner resize handles + edge
// midpoint grips), composed into the z-30 layer BoxedElementView
// mounts above its content. On plain selection the element wrapper is
// not a stacking context, so this z-index resolves at the
// canvas-elements level: the handles paint above neighbouring elements
// WITHOUT lifting the element's own content (lifting it would re-hide
// a container's contents — the whole point of not raising z on
// select). pointer-events-none keeps the body draggable; every handle
// re-enables pointer events on itself.
export function SelectionChromeLayer({
  elementId,
  zoom,
  rotation,
  showHandles,
  showAnchors,
  onBeginDrag,
}: {
  elementId: string;
  zoom: number;
  rotation: number;
  showHandles: boolean;
  showAnchors: boolean;
  onBeginDrag: (id: string, mode: DragMode, e: ReactPointerEvent) => void;
}) {
  if (!showHandles && !showAnchors) return null;
  return (
    <div className="pointer-events-none absolute inset-0" style={{ zIndex: 30 }}>
      {/* Annotations resize too (aspect-locked by default so the marker
          stays round); they just keep rotation off — a tilted note marker
          reads as a mistake. Corner handles show even when rotated — the
          resize math projects the drag into the element's local frame
          (useEditorDrag). */}
      {showHandles ? (
        <ResizeHandles
          elementId={elementId}
          zoom={zoom}
          rotation={rotation}
          onBeginDrag={onBeginDrag}
        />
      ) : null}

      {showAnchors
        ? (['n', 'e', 's', 'w'] as const).map((a) => (
            <EdgeResizeHandle
              key={a}
              anchor={a}
              elementId={elementId}
              zoom={zoom}
              rotation={rotation}
              onBeginDrag={onBeginDrag}
            />
          ))
        : null}
    </div>
  );
}

// --- Edge-midpoint resize handle -------------------------------------------

const ANCHOR_STYLE: Record<'n' | 'e' | 's' | 'w', CSSProperties> = {
  n: { top: 0, left: '50%' },
  e: { top: '50%', left: '100%' },
  s: { top: '100%', left: '50%' },
  w: { top: '50%', left: 0 },
};

// Edge-midpoint handle: a single-axis resize grip (arrows are drawn from
// the quick-connect menu now, so these no longer start a connector). N / S
// resize height, E / W resize width — a small bar oriented along the edge.
function EdgeResizeHandle({
  anchor,
  elementId,
  zoom,
  rotation = 0,
  onBeginDrag,
}: {
  anchor: 'n' | 'e' | 's' | 'w';
  elementId: string;
  zoom: number;
  rotation?: number;
  onBeginDrag: (id: string, mode: DragMode, e: ReactPointerEvent) => void;
}) {
  const vertical = anchor === 'n' || anchor === 's';
  return (
    <div
      role="button"
      aria-label={`Resize ${vertical ? 'height' : 'width'}`}
      onPointerDown={(e) => {
        e.stopPropagation();
        onBeginDrag(elementId, `resize-${anchor}`, e);
      }}
      style={{
        ...ANCHOR_STYLE[anchor],
        // Counter-scale so the grip stays the same on-screen size at any zoom.
        transform: `translate(-50%, -50%) scale(${1 / zoom})`,
        // Rotation-aware cursor so it points the right way once turned.
        cursor: resizeCursor(anchor, rotation),
      }}
      className={`pointer-events-auto absolute rounded-full border border-brand-400 bg-white opacity-80 shadow-sm transition hover:opacity-100 dark:border-brand-300 dark:bg-slate-900 ${HIT_PAD_CLASSES} ${
        vertical ? 'h-1.5 w-4' : 'h-4 w-1.5'
      }`}
    />
  );
}
