// Draw-to-size and polygon tooling, lifted out of editor-page.tsx.
// Two related gestures share the `pendingDraw` state machine:
//
// - Draw-to-size: picking anything from the palette except the annotation
//   (docs/specs/008-canvas/canvas-and-palette.md "Placement on add") stashes the intent in `pendingDraw`. The
//   canvas intercepts the next pointer-down and calls `commitDraw` with the
//   drag's start + end points, which mint the element sized to the dragged
//   box (or the dragged endpoints, for arrows).
// - Polygon: `beginPolygon` queues a 'polygon' intent; the canvas collects the
//   clicked vertices and hands them to `commitPolygon`.
//
// `beginDraw` is returned so the page's palette-add handlers
// (addShape / addText / addSticky / addArrow) can short-circuit into
// draw mode; everything else (pendingDraw, commitDraw, cancelDrawShape,
// beginPolygon, commitPolygon) is consumed by the Canvas + keyboard hook.

import type { Selection } from '@/lib/selection-store';
import { useRef, useState } from 'react';
import { createFreehand, type Element, type Tab, withVariantColours } from '@livedocuments/document';
import { getTheme } from '@/lib/themes';
import { track, titleCaseType } from '@/lib/telemetry';
import { isTechIconId } from '@/lib/tech-icons';
import { opensForTyping, type PendingDraw } from '@/lib/draw-mode';
import { buildDressedDrawnArrow, buildDrawnBoxed, buildDrawnComponent } from '@/lib/draw-commit';
import type { CanvasTool } from '@/components/palette/palette.types';
import { componentTelemetryType, shapeTelemetryToken } from '@/lib/element-telemetry';

type ShapeDrawingDeps = {
  editsBlocked: boolean;
  // The currently-selected element id, read at arm-time so a tap-to-drop
  // inherits its size (see beginDraw / commitDraw).
  // Read when a draw begins (docs/specs/008-canvas/blueprints/selection-store.md).
  readSelection: () => Selection;
  canvasTool: CanvasTool;
  setCanvasTool: (tool: CanvasTool) => void;
  activeTab: Tab;
  // Every draw lands through the functional `commit` (live elements): the
  // commit closure is frozen for the whole
  // gesture, so a wholesale write of gesture-start elements would
  // revert anything that landed mid-drag.
  commit: (mapElements: (els: Element[]) => Element[]) => void;
  setSelectedId: (id: string | null) => void;
  setMultiSelectedIds: (ids: Set<string>) => void;
  setEditingId: (id: string | null) => void;
  // Style memory (docs/specs/008-canvas/quick-style-panel.md): dresses every user-drawn shape and arrow in
  // the remembered style of its kind. Identity for anything memory does not know.
  styleNewElement: <T extends Element>(el: T) => T;
};

export function useShapeDrawing(deps: ShapeDrawingDeps) {
  const {
    editsBlocked,
    readSelection,
    canvasTool,
    setCanvasTool,
    activeTab,
    commit,
    setSelectedId,
    setMultiSelectedIds,
    setEditingId,
    styleNewElement,
  } = deps;

  // Pending draw-to-size intent. Picking a palette element stashes it here;
  // the canvas intercepts the next pointer-down on its surface and uses the
  // drag's bounding box for the element's size. Escape clears it.
  const [pendingDraw, setPendingDraw] = useState<PendingDraw | null>(null);
  // The element selected when the gesture was armed, captured here because
  // beginDraw clears the selection (below). A tap-to-drop inherits this
  // element's size in commitDraw, preserving the old "new shapes match the
  // last one you had selected" behaviour through the combined gesture.
  const inheritSizeRef = useRef<Element | null>(null);

  // The canvas tool an armed draw cannot share the pointer with: laser goes to pan (it swallows pointer-down to paint
  // trail dots and would block the draw), and the format painter to select.
  const putDownPressTool = () => {
    if (canvasTool === 'laser') setCanvasTool('pan');
    else if (canvasTool === 'format') setCanvasTool('select');
  };

  // Shared "arm draw mode" path for every palette add. Tap-to-drop and
  // drag-to-draw are one combined gesture now (no setting): picking an
  // element stashes the intent, and the canvas resolves the next pointer
  // gesture — a tap drops it at its inherited / default size, a drag sizes
  // it (see commitDraw). Clears the current selection so the popover
  // doesn't float over the about-to-be-drawn box, and puts down a tool that acts on a press (putDownPressTool).
  const beginDraw = (intent: PendingDraw): void => {
    // Capture the selection's size BEFORE clearing it so commitDraw's
    // tap branch can inherit it.
    const { selectedId } = readSelection();
    inheritSizeRef.current = selectedId
      ? (activeTab.elements.find((el) => el.id === selectedId) ?? null)
      : null;
    setSelectedId(null);
    setMultiSelectedIds(new Set());
    setEditingId(null);
    putDownPressTool();
    setPendingDraw(intent);
  };

  // Canvas-driven commit of a draw-to-size gesture. Canvas hands us
  // raw start + end canvas-coord points so each intent can interpret
  // them itself (box vs line): shape / text / sticky / image take a
  // bounding box with a 16px floor and a centre-shift on stray
  // clicks; arrow takes the points as from / to directly. After the
  // mint we clear pendingDraw so the cursor / banner / palette
  // pressed-state release together.
  const commitDraw = (
    intent: PendingDraw,
    startX: number,
    startY: number,
    endX: number,
    endY: number,
  ) => {
    if (editsBlocked) {
      setPendingDraw(null);
      return;
    }
    // The element construction per intent kind lives in lib/draw-commit
    // (pure, testable); this dispatcher owns the functional commit,
    // selection, telemetry, and follow-ups. Every append lands through
    // the functional `commit` (live elements + emit): this closure is
    // frozen for the whole gesture, so writing gesture-start elements
    // wholesale would revert anything that landed mid-drag. New
    // elements default to the FRONT of z-order (see addBoxed).
    if (intent.type === 'arrow') {
      // Built exactly as the canvas previews it while the drag is in flight.
      const arrow = buildDressedDrawnArrow(
        intent,
        startX,
        startY,
        endX,
        endY,
        { elements: activeTab.elements, theme: getTheme(activeTab.theme) },
        styleNewElement,
      );
      commit((els) => [...els, arrow]);
      setSelectedId(arrow.id);
      setPendingDraw(null);
      track('Element', 'Added', arrow.arrowEnds === 'none' ? 'Line' : 'Arrow');
      return;
    }
    // A polygon never reaches commitDraw: it routes through commitPolygon
    // (with its vertices). If a future regression mis-routes it here, bail
    // rather than fall through into the boxed branch and mint a phantom
    // element where the user expected an outline.
    if (intent.type === 'polygon') {
      setPendingDraw(null);
      return;
    }
    if (intent.type === 'component') {
      const placed = styleNewElement(
        buildDrawnComponent(intent.kind, startX, startY, endX, endY, getTheme(activeTab.theme)),
      );
      commit((els) => [...els, placed]);
      setSelectedId(placed.id);
      setPendingDraw(null);
      track('Element', 'Added', componentTelemetryType(intent.kind));
      return;
    }
    const dressed = styleNewElement(
      buildDrawnBoxed(intent, startX, startY, endX, endY, inheritSizeRef.current, activeTab),
    );
    // A preset's own colour (the Warning badge's rose) outlasts the theme and the remembered style it was dressed in.
    const sized =
      intent.type === 'shape' && dressed.type === 'shape'
        ? withVariantColours(dressed, intent.variant)
        : dressed;
    // Frames don't need special-casing here: the canvas + exporters
    // route through `framesFirst`, which keeps every frame painted
    // behind its contents regardless of array position (docs/specs/008-canvas/canvas-and-palette.md).
    commit((els) => [...els, sized]);
    setSelectedId(sized.id);
    // A freshly added text element drops straight into typing mode
    // (matches the double-click-to-add-text path in useElementCreation):
    // an empty text box is only useful once you type into it, so save the
    // user the extra click. Other element kinds stay selected-but-not-
    // editing so their format popover is the immediate next interaction.
    if (opensForTyping(intent)) setEditingId(sized.id);
    setPendingDraw(null);
    const label =
      intent.type === 'shape'
        ? // Tech (brand) icons report as TechIcon, matching the click-to-add
          // path; line-art icons + plain shapes use the kind.
          intent.iconId && isTechIconId(intent.iconId)
          ? 'TechIcon'
          : intent.kind === 'sticker'
            ? // Stickers are their own element kind (docs/specs/010-palette/stickers.md), so their own
              // dashboard token rather than riding Icon's.
              'Sticker'
            : // Hyphenated kinds ('code-block', 'tab-window', ...) need
              // their spelled-out token or they split from the copy path's.
              shapeTelemetryToken(intent.kind)
        : intent.type === 'text'
          ? 'Text'
          : intent.type === 'sticky'
            ? 'Sticky'
            : intent.type === 'table'
              ? titleCaseType('table')
              : intent.type === 'link-card'
                ? // titleCase would emit 'Link-Card' (it capitalises at the
                  // hyphen); the click path always reported 'LinkCard', so
                  // moving the event here must not split the dashboard token.
                  'LinkCard'
                : intent.type === 'video'
                  ? // One token for all six providers, matching the old click
                    // path: docs/specs/017-telemetry/telemetry.md's vocabulary is by element kind, and the
                    // provider is a user choice, not a new kind.
                    'Video'
                  : 'Image';
    track('Element', 'Added', label);
    // An image lands as its empty placeholder, selected, with no picker popping up: the
    // placeholder's Select Image button (or a double-click) opens it when the person is ready
    // (docs/specs/009-elements/images.md "Placeholder rendering").
  };

  const cancelDrawShape = () => setPendingDraw(null);

  // Polygon tool entry (docs/specs/008-canvas/polygon-tool.md): queues the click-to-place-vertices
  // intent. The vertex accumulation lives canvas-side
  // (useCanvasPolygonGesture); this just arms the mode.
  const beginPolygon = () => {
    if (editsBlocked) return;
    setSelectedId(null);
    setMultiSelectedIds(new Set());
    setEditingId(null);
    putDownPressTool();
    setPendingDraw({ type: 'polygon' });
  };

  // Canvas-driven commit for the polygon tool (docs/specs/008-canvas/polygon-tool.md). Receives the
  // deliberately placed vertices (no RDP simplification — the user
  // chose every point) and whether the loop closed on the start
  // vertex. Under-specified gestures (one stray click, or a 2-vertex
  // "close") cancel rather than minting a degenerate element.
  const commitPolygon = (vertices: { x: number; y: number }[], closed: boolean) => {
    setPendingDraw(null);
    if (editsBlocked) return;
    if (vertices.length < (closed ? 3 : 2)) return;
    const theme = getTheme(activeTab.theme);
    const base = createFreehand(vertices, closed);
    const polygon: typeof base = {
      ...base,
      straightEdges: true,
      ...(theme.elementStroke ? { strokeColor: theme.elementStroke } : {}),
      ...(closed && theme.elementFill ? { fillColor: theme.elementFill } : {}),
    };
    commit((els) => [...els, polygon]);
    setSelectedId(polygon.id);
    track('Element', 'Added', closed ? 'Polygon' : 'Polyline');
  };

  return {
    pendingDraw,
    beginDraw,
    commitDraw,
    cancelDrawShape,
    beginPolygon,
    commitPolygon,
  };
}
