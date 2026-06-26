'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  PANEL_CORNERS,
  PANEL_LAYOUT_CHANGED_EVENT,
  STORAGE_KEY,
  dockPanel,
  freePanel,
  nearestSnapCorner,
  readPanelLayout,
  resetPanelPlacement,
  resolvePlacement,
  writePanelLayout,
  type PanelCorner,
  type PanelDragGeometry,
  type PanelId,
  type PanelLayout,
  type ResolvedPlacement,
} from '@/lib/panel-layout';

// Owns the device-local floating-panel layout (spec/63): which corner
// each panel docks into, where free panels float, and the live drag /
// snap-candidate state that drives the corner guides.
//
// Layout is hydrated synchronously from localStorage at mount (no
// flash) and re-read whenever it changes — our own writes fire a
// same-tab `livediagram:panel-layout-changed` event, and another tab's
// write fires the native `storage` event. The drag state is transient
// (never persisted).
//
// Composed alongside usePanelLayout in the editor view-model; the
// resolved placement + drag state are handed to CanvasChrome, which
// distributes panels into corner stacks and renders the snap overlay.

export type PanelDragState = {
  panelId: PanelId;
  // The corner the panel would snap to if released now, or null for a
  // free drop. Drives which corner guide highlights.
  candidate: PanelCorner | null;
};

export type PanelDock = {
  layout: PanelLayout;
  // Ordered panel ids per corner (top→bottom render order).
  cornerStacks: Record<PanelCorner, PanelId[]>;
  drag: PanelDragState | null;
  placementOf: (panel: PanelId) => ResolvedPlacement;
  // True while THIS panel is the one being dragged (render it as a free
  // absolute child of <main>, not inside its corner stack).
  isDragging: (panel: PanelId) => boolean;
  beginDrag: (panel: PanelId) => void;
  updateDrag: (panel: PanelId, geom: PanelDragGeometry) => void;
  // Commit the drag: snap to a corner if within range, else free-drop
  // at the released position. Returns the corner it docked to (or null
  // for a free drop) so the caller can fire telemetry.
  endDrag: (panel: PanelId, geom: PanelDragGeometry) => PanelCorner | null;
  resetPanel: (panel: PanelId) => void;
};

export function usePanelDock(): PanelDock {
  const [layout, setLayout] = useState<PanelLayout>(() => readPanelLayout());
  const [drag, setDrag] = useState<PanelDragState | null>(null);

  // Re-read on any external change (another tab's `storage` event) and
  // on our own same-tab writes (the custom event). Idempotent: a write
  // we just made re-reads the same value, so React bails on the set.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const refresh = () => setLayout(readPanelLayout());
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) refresh();
    };
    window.addEventListener(PANEL_LAYOUT_CHANGED_EVENT, refresh);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(PANEL_LAYOUT_CHANGED_EVENT, refresh);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  // Persist + update in-memory in one step.
  const commit = useCallback((next: PanelLayout) => {
    setLayout(next);
    writePanelLayout(next);
  }, []);

  const cornerStacks = useMemo(() => {
    // The stored arrays are already the resolved order, but a panel
    // that's never been placed isn't in any array — fold those into
    // their default corner so the render order matches resolvePlacement.
    const stacks: Record<PanelCorner, PanelId[]> = {
      'top-left': [...layout.corners['top-left']],
      'top-right': [...layout.corners['top-right']],
      'bottom-left': [...layout.corners['bottom-left']],
      'bottom-right': [...layout.corners['bottom-right']],
    };
    return stacks;
  }, [layout]);

  const placementOf = useCallback((panel: PanelId) => resolvePlacement(layout, panel), [layout]);

  const isDragging = useCallback((panel: PanelId) => drag?.panelId === panel, [drag]);

  const beginDrag = useCallback((panel: PanelId) => {
    setDrag({ panelId: panel, candidate: null });
  }, []);

  const updateDrag = useCallback((panel: PanelId, geom: PanelDragGeometry) => {
    const candidate = nearestSnapCorner(geom);
    setDrag((prev) => {
      // Only the panel that owns the drag updates the candidate; guard
      // against stale geometry from a panel that isn't dragging.
      if (!prev || prev.panelId !== panel) return prev;
      if (prev.candidate === candidate) return prev;
      return { panelId: panel, candidate };
    });
  }, []);

  const endDrag = useCallback(
    (panel: PanelId, geom: PanelDragGeometry): PanelCorner | null => {
      const candidate = nearestSnapCorner(geom);
      commit(
        candidate
          ? dockPanel(layout, panel, candidate)
          : freePanel(layout, panel, { x: geom.x, y: geom.y }),
      );
      setDrag(null);
      return candidate;
    },
    [commit, layout],
  );

  const resetPanel = useCallback(
    (panel: PanelId) => commit(resetPanelPlacement(layout, panel)),
    [commit, layout],
  );

  return {
    layout,
    cornerStacks,
    drag,
    placementOf,
    isDragging,
    beginDrag,
    updateDrag,
    endDrag,
    resetPanel,
  };
}

export { PANEL_CORNERS };
