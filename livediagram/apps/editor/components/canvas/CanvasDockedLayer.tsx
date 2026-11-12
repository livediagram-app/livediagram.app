import { Fragment, type ReactNode } from 'react';
import { PanelSnapSlot } from '@liveworkspace/workbench/components/canvas/PanelSnapSlot';
import { toolbarTopClearancePx } from '@/lib/canvas-chrome';
import {
  PANEL_CORNERS,
  PANEL_IDS,
  cornerBottomInset,
  type PanelCorner,
  type PanelId,
} from '@/lib/panel-layout';
import type { useCornerDocking } from '@/hooks/ui/useCornerDocking';

// Per-corner stack container classes (docs/specs/007-editor/panel-docking.md). Each is an absolute,
// pointer-inert flex column pinned to one corner of the dock layer
// (inset 16px = the `*-4` resting inset). Top corners stack downward,
// bottom corners upward (flex-col-reverse) so the first panel always
// sits flush to the corner and the rest flow away from it.
// When the Toolbar strip reaches the top corners (always on a phone, docs/specs/007-editor/toolbar-layout.md
// "On a phone"; on a desktop window too narrow for a centred strip to clear a
// docked panel, stripCrowdsTopCorners) the TOP corner stacks start below it
// rather than at the 16px inset, or a panel docked there (the Collaborate
// banner) renders underneath the strip where it can't be reached
// (toolbarTopClearancePx, lib/canvas-chrome.ts).

const DOCK_CORNER_CLASS: Record<PanelCorner, string> = {
  'top-left': 'left-4 top-4 flex-col items-start',
  'top-right': 'right-4 top-4 flex-col items-end',
  'bottom-left': 'left-4 bottom-4 flex-col-reverse items-start',
  // bottom-right omits `bottom-4`; its bottom is set inline to clear the
  // fixed zoom controls (cornerBottomInset), so panels docked there sit
  // above the zoom bar instead of overlapping it.
  'bottom-right': 'right-4 flex-col-reverse items-end',
};

type CanvasDockedLayerProps = {
  dock: ReturnType<typeof useCornerDocking>['dock'];
  dockLayerRef: ReturnType<typeof useCornerDocking>['dockLayerRef'];
  cornerRefs: ReturnType<typeof useCornerDocking>['cornerRefs'];
  panelEls: Partial<Record<PanelId, ReactNode>>;
  // The top corners start below a bar across the top (the strip, or the Draw dock) when it reaches them.
  topCleared: boolean;
  toolbarScale: number;
  cornerScale: number;
};

// The docked corner panels, split out of CanvasChrome.tsx (docs/specs/007-editor/panel-docking.md): each
// corner's stack, the live landing slot, and the free-floating panels.
export function CanvasDockedLayer({
  dock,
  dockLayerRef,
  cornerRefs,
  panelEls,
  topCleared,
  toolbarScale,
  cornerScale,
}: CanvasDockedLayerProps) {
  // Bucketing keys off the persisted placement ONLY (not which panel is
  // mid-drag): a dragged panel must stay in the same DOM parent for the
  // whole gesture, reparenting it would remount the component and drop
  // the in-flight drag. While lifted it just renders `position: absolute`
  // in place (MovablePanel), and its corner siblings reflow into the gap.
  // The persisted corner/free placement only changes on pointer-up.
  const freePanelIds = PANEL_IDS.filter(
    (id) => panelEls[id] != null && dock.placementOf(id).mode === 'free',
  );
  const snapCorner = dock.drag?.candidate ?? null;
  const snapHeight = dock.drag?.height ?? 0;
  return (
    <div ref={dockLayerRef} className="pointer-events-none absolute inset-0 z-[var(--z-panel)]">
      {PANEL_CORNERS.map((corner) => {
        const children = dock.cornerStacks[corner].filter((id) => panelEls[id] != null);
        // Show the live landing slot at the end of the candidate corner's
        // stack (flexbox places it where the panel will actually land).
        const showSlot = snapCorner === corner;
        if (children.length === 0 && !showSlot) return null;
        return (
          <div
            key={corner}
            ref={(el) => {
              cornerRefs.current[corner] = el;
            }}
            style={{
              ...(corner === 'bottom-right'
                ? { bottom: cornerBottomInset(corner, cornerScale) }
                : // The Draw dock is the strip's twin (its height, its scale), so the same clearance.
                  topCleared && corner.startsWith('top')
                  ? { top: toolbarTopClearancePx(toolbarScale) }
                  : undefined),
            }}
            className={`pointer-events-none absolute flex gap-4 ${DOCK_CORNER_CLASS[corner]}`}
          >
            {children.map((id) => (
              <Fragment key={id}>{panelEls[id]}</Fragment>
            ))}
            {showSlot ? <PanelSnapSlot height={snapHeight} /> : null}
          </div>
        );
      })}
      {freePanelIds.map((id) => (
        <Fragment key={id}>{panelEls[id]}</Fragment>
      ))}
    </div>
  );
}
