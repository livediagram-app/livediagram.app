// Viewport state for the canvas: pan offset, zoom level, the wrapper
// ref every measurement reads through, and the zoom-ref the drag
// hook reads each pointer-move event. Owns the two helpers that
// translate between viewport space and canvas space
// (`getViewportCenter`) and that re-fit every element into view
// (`fitToScreen`). Lifted out of editor-page.tsx so the route file
// stays focused on orchestration; same depsRef pattern as
// useEditorDrag so the helpers always read fresh tab elements
// without re-creating themselves on every parent render.

import { useCallback, useEffect, useRef, useState } from 'react';
import { isBoxed, unionBoxedBounds, type Tab } from '@livediagram/diagram';
import { computeFitToScreen, computeViewportCenter } from '@/lib/viewport';

// Breakpoint at which we initialise the viewport at 60% zoom rather
// than 100%, so a mobile visitor lands on a usable overview instead
// of a single nodes-fill-the-screen view. 30% was too far out, the
// text on every element became unreadable; 60% keeps labels legible
// while still showing a workable chunk of canvas around the
// pointer.
const MOBILE_BREAKPOINT_PX = 768;
const MOBILE_DEFAULT_ZOOM = 0.6;
const DESKTOP_DEFAULT_ZOOM = 1;

export type EditorViewportDeps = {
  activeTab: Tab;
};

export type EditorViewportApi = {
  // Pan offset in canvas-coords. The canvas wrapper applies
  // `translate(viewportOffset.x, viewportOffset.y) scale(zoom)`.
  viewportOffset: { x: number; y: number };
  setViewportOffset: React.Dispatch<React.SetStateAction<{ x: number; y: number }>>;
  // Zoom multiplier on the canvas transform. 1 = 100%.
  viewportZoom: number;
  setViewportZoom: React.Dispatch<React.SetStateAction<number>>;
  // Same value as `viewportZoom` but mirrored into a ref so the
  // pointer-move handlers in useEditorDrag can invert the zoom
  // without re-attaching their listeners every time zoom changes.
  zoomRef: React.RefObject<number>;
  // Wrapper element the canvas renders into. Its bounding-client
  // rect is the source of truth for "where is the viewport in
  // screen space?" and every helper here reads through it.
  canvasMainRef: React.RefObject<HTMLElement | null>;
  // Canvas-coord position of the viewport centre, used as the drop
  // point for "add a shape from the palette".
  getViewportCenter: () => { x: number; y: number };
  // Re-fit every boxed element on the active tab into the
  // viewport. Idempotent (the lastFittedTabRef gate in
  // editor-page.tsx still controls WHEN this runs).
  fitToScreen: () => void;
};

export function useEditorViewport(deps: EditorViewportDeps): EditorViewportApi {
  const [viewportOffset, setViewportOffset] = useState({ x: 0, y: 0 });
  const [viewportZoom, setViewportZoom] = useState<number>(() => {
    if (typeof window === 'undefined') return DESKTOP_DEFAULT_ZOOM;
    return window.innerWidth <= MOBILE_BREAKPOINT_PX ? MOBILE_DEFAULT_ZOOM : DESKTOP_DEFAULT_ZOOM;
  });
  const canvasMainRef = useRef<HTMLElement>(null);
  const zoomRef = useRef(viewportZoom);
  useEffect(() => {
    zoomRef.current = viewportZoom;
  }, [viewportZoom]);

  // depsRef means the helpers below can be stable across renders
  // (useCallback empty-dep) AND always read the latest activeTab.
  // The drag hook is the only consumer that holds a long-lived
  // reference; everyone else calls into the helpers fresh each
  // time, so this is mostly defensive.
  const depsRef = useRef(deps);
  depsRef.current = deps;

  const getViewportCenter = useCallback(() => {
    const rect = canvasMainRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return computeViewportCenter(rect, viewportOffset);
  }, [viewportOffset]);

  const fitToScreen = useCallback(() => {
    const rect = canvasMainRef.current?.getBoundingClientRect();
    if (!rect) return;
    const { activeTab } = depsRef.current;
    const boxedIds = new Set(activeTab.elements.filter(isBoxed).map((el) => el.id));
    if (boxedIds.size === 0) {
      setViewportOffset({ x: 0, y: 0 });
      setViewportZoom(1);
      return;
    }
    const bbox = unionBoxedBounds(activeTab.elements, boxedIds);
    if (!bbox) return;
    const { zoom, offset } = computeFitToScreen(rect, bbox);
    setViewportZoom(zoom);
    setViewportOffset(offset);
  }, []);

  return {
    viewportOffset,
    setViewportOffset,
    viewportZoom,
    setViewportZoom,
    zoomRef,
    canvasMainRef,
    getViewportCenter,
    fitToScreen,
  };
}
