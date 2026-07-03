'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import type { PanelDragGeometry } from '@/lib/panel-layout';
import type { MovablePanelProps } from './MovablePanel.types';

// Pointer travel (px) before a header press on the docking path counts
// as a drag rather than a click. Keeps a plain click from pulling the
// panel out of its corner stack (which would reflow + re-dock it).
const DOCK_DRAG_THRESHOLD_PX = 4;

// The MovablePanel header-drag machinery, lifted out of the component:
// the legacy free-move path (offsetParent coords through onMoveTo) and
// the corner-docking path (spec/63 — threshold lift, viewport-space
// tracking, live snap geometry through the onDockDrag* callbacks), plus
// the collapse-vs-drag press routing on the title row. The component
// mounts `beginDrag` on its header and renders from `drag` /
// `dockDragPos` / `dockLifted`.
export function useMovablePanelDrag({
  ref,
  position,
  onMoveTo,
  collapsible,
  collapsed,
  setCollapsed,
  mobileOpenOverride,
  getDockBounds,
  onDockDragStart,
  onDockDrag,
  onDockDragEnd,
}: Pick<
  MovablePanelProps,
  | 'position'
  | 'onMoveTo'
  | 'mobileOpenOverride'
  | 'getDockBounds'
  | 'onDockDragStart'
  | 'onDockDrag'
  | 'onDockDragEnd'
> & {
  ref: React.RefObject<HTMLDivElement | null>;
  collapsible: boolean;
  collapsed: boolean;
  setCollapsed: (v: boolean) => void;
}) {
  // Presence of getDockBounds opts this panel into the corner-docking
  // drag path (spec/63). Computed once per render; cheap.
  const docking = !!getDockBounds;
  // Last drag geometry, so pointerup can hand the final spot to
  // onDockDragEnd (which decides snap-to-corner vs free drop).
  const dragGeomRef = useRef<PanelDragGeometry | null>(null);
  // Live position while dragging on the docking path, in the panel's
  // offsetParent coordinates (the corner stack container or the dock
  // layer — wherever the panel already lives). Rendered locally so the
  // panel follows the pointer smoothly; crucially the panel is NOT
  // reparented during the drag (that would remount it and kill the
  // gesture), it just lifts to `position: absolute` in place. Null when
  // not lifted.
  const [dockDragPos, setDockDragPos] = useState<{ x: number; y: number } | null>(null);
  // "Lifted" = the pointer has moved past the drag threshold, so this
  // is a real drag (not a click). A bare click never lifts, so it never
  // pulls the panel out of the flex flow and never re-docks it. A ref
  // mirrors the state for the window pointermove handler, which needs a
  // synchronous read between renders.
  const dockLiftedRef = useRef(false);
  const [dockLifted, setDockLifted] = useState(false);
  // Drag geometry in dock-layer (<main>) coordinates, read straight from
  // the live DOM rect so it's correct no matter which container the
  // panel currently sits in. Drives the snap-candidate detection.
  const computeDragGeom = useCallback((): PanelDragGeometry | null => {
    const node = ref.current;
    const bounds = getDockBounds?.() ?? null;
    if (!node || !bounds) return null;
    const rect = node.getBoundingClientRect();
    return {
      x: rect.left - bounds.left,
      y: rect.top - bounds.top,
      width: rect.width,
      height: rect.height,
      parentWidth: bounds.width,
      parentHeight: bounds.height,
    };
  }, [getDockBounds, ref]);
  const [drag, setDrag] = useState<{
    startClientX: number;
    startClientY: number;
    startX: number;
    startY: number;
  } | null>(null);
  useEffect(() => {
    if (!drag) return;
    const onMove = (e: PointerEvent) => {
      const dx = e.clientX - drag.startClientX;
      const dy = e.clientY - drag.startClientY;
      if (docking) {
        // Don't lift the panel out of the flex flow (or tell the parent a
        // drag started) until the pointer clears the threshold — a bare
        // click must leave the layout untouched and never re-dock.
        if (!dockLiftedRef.current) {
          if (Math.hypot(dx, dy) < DOCK_DRAG_THRESHOLD_PX) return;
          dockLiftedRef.current = true;
          setDockLifted(true);
          onDockDragStart?.();
        }
        setDockDragPos({ x: drag.startX + dx, y: drag.startY + dy });
        const geom = computeDragGeom();
        if (geom) {
          dragGeomRef.current = geom;
          onDockDrag?.(geom);
        }
      } else {
        onMoveTo(drag.startX + dx, drag.startY + dy);
      }
    };
    const onUp = () => {
      if (docking) {
        if (dockLiftedRef.current && dragGeomRef.current) onDockDragEnd?.(dragGeomRef.current);
        dockLiftedRef.current = false;
        setDockLifted(false);
        setDockDragPos(null);
        dragGeomRef.current = null;
      }
      setDrag(null);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [drag, onMoveTo, docking, computeDragGeom, onDockDrag, onDockDragEnd, onDockDragStart]);

  const beginDrag = (e: ReactPointerEvent) => {
    // Collapsible panels in their collapsed (banner) state treat the
    // entire title row as a tap target: clicking anywhere on the
    // banner expands the body, regardless of input device, because
    // the visible chrome is the banner row itself and pointing at it
    // is the most direct "open me" gesture. The +/- button still
    // works for explicit users. Mobile (touch) on an EXPANDED panel
    // also taps-to-collapse (a 375 px viewport has nowhere useful to
    // drag the panel to anyway, so the gesture is repurposed). On
    // desktop the expanded panel keeps drag semantics on the title
    // row, the +/- button is the collapse path.
    if (collapsible && collapsed) {
      e.stopPropagation();
      setCollapsed(false);
      return;
    }
    // Tap-to-collapse on mobile, except while the parent has locked
    // the panel open or the dock is controlling this panel (dock
    // button is the collapse affordance in that case).
    if (collapsible && e.pointerType === 'touch' && mobileOpenOverride === undefined) {
      e.stopPropagation();
      setCollapsed(true);
      return;
    }
    e.stopPropagation();
    const node = ref.current;
    if (!node) return;
    if (docking) {
      // Record the grab WITHOUT lifting: a bare click must not pull the
      // panel out of the flex flow or re-dock it (the move handler's
      // threshold decides when it becomes a real drag). startX/startY are
      // the panel's current VIEWPORT position: while lifted the panel is
      // `position: fixed`, so it tracks the pointer against the viewport
      // and is immune to its corner stack container collapsing as it leaves
      // the flow (which previously shifted an absolute origin and made the
      // panel jump). It is never reparented mid-drag either.
      const rect = node.getBoundingClientRect();
      setDrag({
        startClientX: e.clientX,
        startClientY: e.clientY,
        startX: rect.left,
        startY: rect.top,
      });
      return;
    }
    const startX = node.offsetLeft;
    const startY = node.offsetTop;
    // If the panel hasn't been positioned yet, freeze the current corner
    // position so subsequent deltas don't snap it to (0,0).
    if (position === null) onMoveTo(startX, startY);
    setDrag({ startClientX: e.clientX, startClientY: e.clientY, startX, startY });
  };
  return { docking, drag, dockDragPos, dockLifted, beginDrag };
}
