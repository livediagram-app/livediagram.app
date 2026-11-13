'use client';

import { useCallback, useRef } from 'react';
import { useIsMobileViewport } from './useIsMobileViewport';
import type { MovablePanelDockProps } from '../../components/primitives/MovablePanel.types';
import type { PanelCorner, PanelDock } from './usePanelDock';

// What the hook reads of the editor: its bound dock hook, its panels' home corners and its corner stacks' gap
// (`lib/panel-layout`), and its telemetry.
export type CornerDockingDeps<PanelId extends string> = {
  usePanelDock: () => PanelDock<PanelId>;
  DEFAULT_PANEL_CORNER: Record<PanelId, PanelCorner>;
  PANEL_CORNERS: readonly PanelCorner[];
  STACK_GAP_PX: number;
  track: (category: 'UI', action: 'Moved', label: 'PanelDock') => void;
};

// Corner docking wiring (docs/specs/007-editor/panel-docking.md), lifted out of CanvasChrome: the
// device-local panel layout + live drag/snap state (usePanelDock), the
// dock layer / corner-stack measurement refs, and the per-panel wiring
// builder the chrome host threads into each MovablePanel. Self-contained
// — CanvasChrome mounts the returned refs on its dock layer / corner
// containers and calls panelWiringFor per panel.
// Each editor binds the hook once, at module scope in its `hooks/ui/useCornerDocking.ts`.
export function createUseCornerDocking<PanelId extends string>({
  usePanelDock,
  DEFAULT_PANEL_CORNER,
  PANEL_CORNERS,
  STACK_GAP_PX,
  track,
}: CornerDockingDeps<PanelId>) {
  return function useCornerDocking({ zenMode }: { zenMode: boolean }) {
  // Device-local panel layout + live drag/snap state. Self-contained
  // (reads/writes localStorage itself), so it lives here at the one
  // consumer rather than threaded through the editor view-model.
  const isMobile = useIsMobileViewport();
  const dock = usePanelDock();
  // The dock layer is an inset-0 child of <main>, so its rect is the
  // positioning origin for free / dragging panels and the basis for the
  // corner snap zones. Docking is off in zen (no corners to dock into
  // there). A phone docks too: it is always in the Toolbar layout
  // (docs/specs/007-editor/toolbar-layout.md), which keeps the corners.
  const dockLayerRef = useRef<HTMLDivElement>(null);
  const getDockBounds = useCallback(
    () => dockLayerRef.current?.getBoundingClientRect() ?? null,
    [],
  );
  // Live refs to the four corner stack containers, so snap detection can
  // measure how tall the EXISTING stack in each corner is and offset the
  // anchor to the landing position (below a top stack / above a bottom
  // one) instead of the bare corner.
  const cornerRefs = useRef<Record<PanelCorner, HTMLDivElement | null>>({
    'top-left': null,
    'top-right': null,
    'bottom-left': null,
    'bottom-right': null,
  });
  const measureCornerExtents = useCallback((): Record<PanelCorner, number> => {
    const out: Record<PanelCorner, number> = {
      'top-left': 0,
      'top-right': 0,
      'bottom-left': 0,
      'bottom-right': 0,
    };
    // The dragged panel is `position: fixed` (out of flow), so a corner
    // container's height already excludes it. Subtract the landing slot
    // (rendered only in the current candidate corner) so we measure just
    // the RESTING stack and don't feed the slot back into the anchor.
    const candidate = dock.drag?.candidate ?? null;
    const slot = Math.max(dock.drag?.height ?? 0, 48) + STACK_GAP_PX;
    for (const corner of PANEL_CORNERS) {
      const el = cornerRefs.current[corner];
      if (!el) continue;
      const h = el.getBoundingClientRect().height;
      out[corner] = Math.max(0, corner === candidate ? h - slot : h);
    }
    return out;
  }, [dock.drag]);
  const dockingActive = !zenMode;
  // Build the per-panel wiring: in docking mode, position comes from the
  // layout (free pos, or null when corner-docked → rendered as a flex
  // child), reset snaps back to the default corner, and the dock bundle
  // routes drags through the snap machinery. Otherwise the legacy
  // per-panel position/reset props are used unchanged.
  const panelWiringFor = useCallback(
    (
      id: PanelId,
      legacyPosition: { x: number; y: number } | null,
      legacyReset: () => void,
    ): {
      position: { x: number; y: number } | null;
      onReset: () => void;
      // True when the panel actually sits away from its default corner
      // (free, or docked elsewhere) — drives the "Reset position"
      // enablement, greyed when already home.
      resettable: boolean;
      dock?: MovablePanelDockProps;
    } => {
      if (!dockingActive)
        return {
          position: legacyPosition,
          onReset: legacyReset,
          resettable: legacyPosition !== null,
        };
      const placement = dock.placementOf(id);
      const dragging = dock.isDragging(id);
      return {
        position: placement.mode === 'free' ? placement.pos : null,
        onReset: () => dock.resetPanel(id),
        resettable: placement.mode === 'free' || placement.corner !== DEFAULT_PANEL_CORNER[id],
        dock: {
          docked: placement.mode === 'corner' && !dragging,
          dockedCorner: placement.mode === 'corner' ? placement.corner : undefined,
          getDockBounds,
          onDockDragStart: () => dock.beginDrag(id),
          onDockDrag: (geom) => dock.updateDrag(id, geom, measureCornerExtents()),
          onDockDragEnd: (geom) => {
            if (dock.endDrag(id, geom, measureCornerExtents())) track('UI', 'Moved', 'PanelDock');
          },
        },
      };
    },
    [dockingActive, dock, getDockBounds, measureCornerExtents],
  );

  return { isMobile, dock, dockLayerRef, cornerRefs, dockingActive, panelWiringFor };
}
}
