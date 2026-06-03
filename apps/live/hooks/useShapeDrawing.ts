// Draw-to-size + freehand pen tooling, lifted out of editor-page.tsx.
// Two related gestures share the `pendingDraw` state machine:
//
// - Draw-to-size: when user-preferences.drawToAdd is on, picking a
//   shape / text / sticky / image / arrow from the palette stashes the
//   intent in `pendingDraw` instead of dropping at the viewport
//   centre. The canvas intercepts the next pointer-down and calls
//   `commitDraw` with the drag's start + end points, which mint the
//   element sized to the dragged box (or the dragged endpoints, for
//   arrows).
// - Freehand pen: `beginFreehand` queues a 'freehand' intent; the
//   canvas streams the pointer polyline to `commitFreehand`, which
//   simplifies it (RDP), optionally runs shape recognition, and
//   commits either a recognised shape / arrow or a FreehandElement.
//
// `beginDrawIfEnabled` is returned so the page's palette-add handlers
// (addShape / addText / addSticky / addArrow) can short-circuit into
// draw mode; everything else (pendingDraw, commitDraw, cancelDrawShape,
// beginFreehand, commitFreehand) is consumed by the Canvas + keyboard
// hook. Verbatim relocation — no behaviour change.

import { useState } from 'react';
import {
  createFreehand,
  createImage,
  createShape,
  createSticky,
  createText,
  recogniseShape,
  simplifyPolyline,
  type ArrowElement,
  type Element,
  type ShapeElement,
  type Tab,
} from '@livediagram/diagram';
import { deriveNewBoxedColours, getTheme } from '@/lib/themes';
import { track, titleCaseType } from '@/lib/telemetry';
import type { PendingDraw } from '@/components/Canvas';

type ShapeDrawingDeps = {
  // user-preferences.drawToAdd — gates whether palette adds queue a
  // draw gesture vs drop at the viewport centre.
  drawToAdd: boolean;
  editsBlocked: boolean;
  canvasTool: 'pan' | 'select' | 'laser';
  setCanvasTool: (tool: 'pan' | 'select' | 'laser') => void;
  activeTab: Tab;
  activeId: string;
  commit: (mapElements: (els: Element[]) => Element[]) => void;
  commitTabs: (mapTabs: (ts: Tab[]) => Tab[]) => void;
  // Tab patch helper (page-local) — used by the arrow / templateChosen
  // commits that touch tab-level fields.
  patchTab: (ts: Tab[], id: string, patch: Partial<Tab>) => Tab[];
  // Activity-log emit for the commitTabs paths (commit() emits for
  // element-only commits, but these also touch templateChosen).
  emitChange: (tabId: string, before: Element[], after: Element[]) => void;
  setSelectedId: (id: string | null) => void;
  setMultiSelectedIds: (ids: Set<string>) => void;
  setEditingId: (id: string | null) => void;
  // Opens the image picker after a draw-to-size image lands (mirrors
  // the click-to-drop placeholder flow). From useEditorImages.
  openImagePickerFor?: (elementId: string) => void;
  // Live viewport zoom — scales the freehand simplification tolerance.
  zoomRef: React.RefObject<number>;
};

export function useShapeDrawing(deps: ShapeDrawingDeps) {
  const {
    drawToAdd,
    editsBlocked,
    canvasTool,
    setCanvasTool,
    activeTab,
    activeId,
    commit,
    commitTabs,
    patchTab,
    emitChange,
    setSelectedId,
    setMultiSelectedIds,
    setEditingId,
    openImagePickerFor,
    zoomRef,
  } = deps;

  // Pending draw-to-size shape. When user-preferences.drawToAdd is
  // on, picking a shape from the palette stashes the kind here
  // instead of dropping it at the viewport centre; the canvas
  // intercepts the next pointer-down on its surface and uses the
  // drag's bounding box for the shape's size. Escape clears the
  // pending state. See user-preferences.drawToAdd.
  const [pendingDraw, setPendingDraw] = useState<PendingDraw | null>(null);

  // Shared "enter draw mode" path for every palette add. Returns true
  // when the gesture is queued (caller should bail), false otherwise.
  // Clears the current selection so the selection popover doesn't
  // float over the about-to-be-drawn rectangle, and bumps laser to
  // pan because laser swallows pointer-down to paint trail dots and
  // would prevent the draw drag from ever starting.
  const beginDrawIfEnabled = (intent: PendingDraw): boolean => {
    if (!drawToAdd) return false;
    setSelectedId(null);
    setMultiSelectedIds(new Set());
    setEditingId(null);
    if (canvasTool === 'laser') setCanvasTool('pan');
    setPendingDraw(intent);
    return true;
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
    if (intent.type === 'arrow') {
      const dx = endX - startX;
      const dy = endY - startY;
      // Stray click on the canvas while pendingDraw is set: less
      // than 16 canvas-px in either axis is treated as "I didn't
      // really mean to draw an arrow", produce a default-sized
      // horizontal one centred on the start point instead so the
      // user isn't left wondering why nothing appeared.
      const isClick = Math.abs(dx) < 16 && Math.abs(dy) < 16;
      // Stray click: lay the default 160px horizontal arrow across
      // the click point. Real drag: use the dragged endpoints as-is.
      // Y is always anchored at startY in both branches (a click
      // wants a flat line, a drag's endY only matters for non-stray
      // gestures), so it stays a plain assignment, not a ternary.
      const arrowStartX = isClick ? startX - 80 : startX;
      const arrowEndX = isClick ? startX + 80 : endX;
      const arrowEndY = isClick ? startY : endY;
      const theme = getTheme(activeTab.theme);
      const arrow: ArrowElement = {
        id: crypto.randomUUID(),
        type: 'arrow',
        from: { kind: 'free', x: arrowStartX, y: startY },
        to: { kind: 'free', x: arrowEndX, y: arrowEndY },
        arrowEnds: 'none',
        ...(theme.elementStroke ? { strokeColor: theme.elementStroke } : {}),
      };
      const before = activeTab.elements;
      // Prepend: new elements default to the BACK of z-order
      // (see addBoxed).
      const after = [arrow, ...before];
      commitTabs((ts) => patchTab(ts, activeId, { elements: after, templateChosen: true }));
      emitChange(activeId, before, after);
      setSelectedId(arrow.id);
      setPendingDraw(null);
      track('Element', 'Added', 'Arrow');
      return;
    }
    // Freehand never reaches commitDraw, it routes through
    // commitFreehand (with the polyline). If a future regression
    // mis-routes it here, bail rather than fall through the
    // ternary into createImage and mint a phantom image element
    // where the user expected a sketch.
    if (intent.type === 'freehand') {
      setPendingDraw(null);
      return;
    }
    const x = Math.min(startX, endX);
    const y = Math.min(startY, endY);
    const width = Math.max(16, Math.abs(endX - startX));
    const height = Math.max(16, Math.abs(endY - startY));
    const base =
      intent.type === 'shape'
        ? createShape(intent.kind, x, y)
        : intent.type === 'text'
          ? createText(x, y)
          : intent.type === 'sticky'
            ? createSticky(x, y)
            : createImage(x, y);
    const colours = deriveNewBoxedColours(base, {
      backgroundColor: activeTab.backgroundColor,
      patternColor: activeTab.patternColor,
      theme: activeTab.theme,
    });
    const sized = { ...base, ...colours, x, y, width, height } as typeof base;
    // Prepend so new elements default to the BACK of z-order (see
    // addBoxed's note for the rationale).
    commit((els) => [sized, ...els]);
    setSelectedId(sized.id);
    setPendingDraw(null);
    const label =
      intent.type === 'shape'
        ? titleCaseType(intent.kind)
        : intent.type === 'text'
          ? 'Text'
          : intent.type === 'sticky'
            ? 'Sticky'
            : 'Image';
    track('Element', 'Added', label);
    // Image element specifically: opening the picker after the draw
    // mirrors how the click-to-drop path drops a placeholder + lets
    // the user pick a file via double-click. Skipping the picker
    // here would leave the user with an empty box and no obvious
    // next step.
    if (intent.type === 'image' && openImagePickerFor) {
      openImagePickerFor(sized.id);
    }
  };

  const cancelDrawShape = () => setPendingDraw(null);

  // Pen tool entry. Unlike addShape / addText / etc, freehand is
  // always gestural and doesn't drop at the viewport centre, so
  // there's no "drop if drawToAdd is off" branch. Just queues the
  // intent so the canvas's pen-gesture effect picks up the next
  // drag. Clears selection like beginDrawIfEnabled does so the
  // selection popover doesn't hover over the about-to-be-drawn
  // stroke.
  const beginFreehand = () => {
    if (editsBlocked) return;
    setSelectedId(null);
    setMultiSelectedIds(new Set());
    setEditingId(null);
    if (canvasTool === 'laser') setCanvasTool('pan');
    setPendingDraw({ type: 'freehand' });
  };

  // Canvas-driven commit for the pen gesture. Receives the raw
  // pointer-sample polyline in canvas coords and applies:
  //   1. Ramer-Douglas-Peucker simplification with a tolerance
  //      that scales inversely with zoom so the visible jitter
  //      (~1 px on screen) is what gets smoothed, not absolute
  //      canvas pixels. At zoom 1 the tolerance is 1.2 canvas px
  //      which removes the bulk of pointer noise without
  //      flattening real curves.
  //   2. Auto-close detection: if the gesture's end point is
  //      within 16 canvas px of its start AND the polyline has
  //      at least 4 samples (so a stray jitter near the start
  //      doesn't trip the close), commit a closed path. Otherwise
  //      commit an open stroke.
  //   3. createFreehand to mint the element + commit.
  const commitFreehand = (rawPoints: { x: number; y: number }[], recogniseShapesMode: boolean) => {
    if (editsBlocked || rawPoints.length < 2) {
      setPendingDraw(null);
      return;
    }
    const zoom = zoomRef.current ?? 1;
    const tolerance = 1.2 / zoom;
    const simplified = simplifyPolyline(rawPoints, tolerance);
    if (simplified.length < 2) {
      setPendingDraw(null);
      return;
    }
    const theme = getTheme(activeTab.theme);

    // Shape-recognition mode: try classifying the simplified
    // polyline before falling back to FreehandElement. Threshold
    // 0.40 leans hard toward "convert it". The bar is low on
    // purpose: turning recognition on is an explicit opt-in (the
    // pencil banner toggle, persisted as a user preference per
    // spec/20), so the user has already stated they want strokes
    // classified. False positives are one Cmd+Z away and the
    // toggle is one click off; false negatives (a wobbly square
    // that stayed a sketch when the user wanted a rectangle) are
    // the more frustrating outcome, so erring toward conversion
    // is correct. Previous values: 0.72 (too strict), 0.55 (still
    // too strict per user feedback).
    const RECOGNITION_THRESHOLD = 0.4;
    if (recogniseShapesMode) {
      const detected = recogniseShape(simplified);
      if (detected !== null && detected.confidence >= RECOGNITION_THRESHOLD) {
        if (detected.kind === 'line') {
          const fromPt = detected.from ?? simplified[0]!;
          const toPt = detected.to ?? simplified[simplified.length - 1]!;
          // Map "line" to an ArrowElement with arrowEnds 'none'
          // (the existing addArrow drop). The arrowEnds toggle in
          // the Pointer accordion is there if the user wants to
          // promote it to a pointer afterwards.
          const arrow: ArrowElement = {
            id: crypto.randomUUID(),
            type: 'arrow',
            from: { kind: 'free', x: fromPt.x, y: fromPt.y },
            to: { kind: 'free', x: toPt.x, y: toPt.y },
            arrowEnds: 'none',
            ...(theme.elementStroke ? { strokeColor: theme.elementStroke } : {}),
          };
          const before = activeTab.elements;
          const after = [arrow, ...before];
          commitTabs((ts) => patchTab(ts, activeId, { elements: after, templateChosen: true }));
          emitChange(activeId, before, after);
          setSelectedId(arrow.id);
          setPendingDraw(null);
          track('Element', 'Added', 'Arrow');
          return;
        }
        // square / circle / diamond all map directly to ShapeKind.
        // Bounding box is the gesture's bbox; the renderer stretches
        // each shape to fill it, so a tall-and-thin rectangle stays
        // tall-and-thin, an oval stays oval, etc.
        const shapeBase = createShape(detected.kind, detected.bbox.x, detected.bbox.y);
        const colours = deriveNewBoxedColours(shapeBase, {
          backgroundColor: activeTab.backgroundColor,
          patternColor: activeTab.patternColor,
          theme: activeTab.theme,
        });
        const sized: ShapeElement = {
          ...shapeBase,
          ...colours,
          x: detected.bbox.x,
          y: detected.bbox.y,
          width: Math.max(16, detected.bbox.width),
          height: Math.max(16, detected.bbox.height),
        };
        commit((els) => [sized, ...els]);
        setSelectedId(sized.id);
        setPendingDraw(null);
        track('Element', 'Added', titleCaseType(detected.kind));
        return;
      }
    }

    // Fallback: commit the polyline as-is as a FreehandElement.
    const first = simplified[0]!;
    const last = simplified[simplified.length - 1]!;
    const closeDist = Math.hypot(last.x - first.x, last.y - first.y);
    const closed = simplified.length >= 4 && closeDist <= 16 / zoom;
    const base = createFreehand(simplified, closed);
    const elementToInsert: typeof base = {
      ...base,
      // Theme-aware stroke colour so a freehand sketch reads as
      // part of the diagram. Falls back to the default in
      // defaultStrokeColor when the theme has no override.
      ...(theme.elementStroke ? { strokeColor: theme.elementStroke } : {}),
      ...(closed && theme.elementFill ? { fillColor: theme.elementFill } : {}),
    };
    // Prepend: send to back by default (see addBoxed).
    commit((els) => [elementToInsert, ...els]);
    setSelectedId(elementToInsert.id);
    setPendingDraw(null);
    track('Element', 'Added', 'Freehand');
  };

  return {
    pendingDraw,
    beginDrawIfEnabled,
    commitDraw,
    cancelDrawShape,
    beginFreehand,
    commitFreehand,
  };
}
