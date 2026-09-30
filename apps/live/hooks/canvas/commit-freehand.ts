import {
  createFreehand,
  createShape,
  nearestBorderStroke,
  recogniseShape,
  simplifyPolyline,
  snapToArrowPoint,
  type ArrowElement,
  type Element,
  type Endpoint,
  type ShapeElement,
} from '@livediagram/document';
import type { Tab } from '@livediagram/document';
import type { MutableRefObject } from 'react';
import { ARROW_SNAP_THRESHOLD_PX } from '@/lib/canvas';
import { NEW_ARROW_THEME_STROKE_FALLBACK } from '@/lib/draw-commit';
import { deriveNewBoxedColours, getTheme } from '@/lib/themes';
import { titleCaseType, track } from '@/lib/telemetry';
import type { PendingDraw } from '@/lib/draw-mode';
import { HIGHLIGHTER_DEFAULT_WIDTH } from '@/hooks/canvas/useShapeDrawing';

// WHAT A PEN STROKE BECOMES (docs/specs/008-canvas/two-pens.md's two pens, docs/specs/008-canvas/highlighter.md's highlighter).
//
// The largest single branch of useShapeDrawing, and the one that is an
// algorithm rather than wiring: simplify the raw pointer samples, decide
// whether the gesture closed on itself, and — in Shape Pen mode — try to
// recognise a real shape before falling back to a sketch.
//
// A factory called per render rather than a hook: it needs values that change
// every render (the pending draw, the highlighter recipe, the live tab) and owns
// no state of its own.
//
// Decision and effect are interleaved on purpose and stay that way. Each
// branch mints its element and commits it in the same breath; teasing the two
// apart would be a rewrite of behaviour nobody asked for, not a move.

// Shape Pen recognition bar; see the note in makeCommitFreehand.
const RECOGNITION_THRESHOLD = 0.4;

export function makeCommitFreehand({
  editsBlocked,
  activeTab,
  commit,
  pendingDraw,
  setPendingDraw,
  holdingMarker,
  setSelectedId,
  highlighterColor,
  highlighterWidth,
  zoomRef,
  styleNewElement = (el) => el,
}: {
  editsBlocked: boolean;
  activeTab: Tab;
  commit: (fn: (els: Element[]) => Element[]) => void;
  pendingDraw: PendingDraw | null;
  setPendingDraw: (p: PendingDraw | null) => void;
  // True while the Highlighter TOOL is held (docs/specs/008-canvas/highlighter.md). A held marker re-arms
  // after every stroke: a highlighter you have to re-pick between passages is
  // a one-shot arm wearing a mode's clothes.
  holdingMarker?: boolean;
  setSelectedId: (id: string | null) => void;
  highlighterColor: string;
  highlighterWidth: number;
  zoomRef: MutableRefObject<number> | { current: number };
  // Style memory (docs/specs/008-canvas/quick-style-panel.md): a recognised shape or line is user-drawn, so
  // it takes the remembered style of its kind. A plain sketch is not a kind
  // the memory knows.
  styleNewElement?: <T extends Element>(el: T) => T;
}) {
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
  return (rawPoints: { x: number; y: number }[], recogniseShapesMode: boolean) => {
    // Disarm on a gesture too short to be a stroke — unless the marker is
    // HELD, where a stray tap must not silently put the tool down.
    // A whiteboard pen is held too (docs/specs/023-whiteboard/whiteboard.md "Pens").
    const whiteboardPen =
      pendingDraw?.type === 'freehand' && pendingDraw.variant === 'whiteboard' ? pendingDraw : null;
    const disarm = () => {
      if (!holdingMarker && !whiteboardPen) setPendingDraw(null);
    };
    if (editsBlocked || rawPoints.length < 2) {
      disarm();
      return;
    }
    const zoom = zoomRef.current ?? 1;
    const tolerance = 1.2 / zoom;
    const simplified = simplifyPolyline(rawPoints, tolerance);
    if (simplified.length < 2) {
      disarm();
      return;
    }
    const theme = getTheme(activeTab.theme);

    // Highlighter variant (docs/specs/008-canvas/highlighter.md): commit the marker recipe and
    // skip both recognition and close-to-fill — a highlight is an
    // annotation gesture, not a sketch-a-shape one. Colour is fixed
    // marker yellow at creation (recolourable per element after);
    // width + translucency live in the renderers' pen recipe.
    if (pendingDraw?.type === 'freehand' && pendingDraw.variant === 'highlighter') {
      const stroke = {
        ...createFreehand(simplified, false),
        pen: 'highlighter' as const,
        strokeColor: highlighterColor,
        ...(highlighterWidth !== HIGHLIGHTER_DEFAULT_WIDTH ? { penWidth: highlighterWidth } : {}),
      };
      commit((els) => [...els, stroke]);
      // Held marker: keep the stroke unselected and the tool armed, so the
      // next drag highlights instead of dragging the stroke just drawn.
      if (!holdingMarker) {
        setSelectedId(stroke.id);
        setPendingDraw(null);
      }
      track('Element', 'Added', 'Highlighter');
      return;
    }

    if (whiteboardPen) {
      commit((els) => [...els, whiteboardStroke(simplified, whiteboardPen)]);
      return;
    }

    // Shape-recognition mode: try classifying the simplified
    // polyline before falling back to FreehandElement. Threshold
    // 0.40 leans hard toward "convert it". The bar is low on
    // purpose: turning recognition on is an explicit opt-in (the
    // pencil banner toggle, persisted as a user preference per
    // docs/specs/007-editor/user-preferences.md), so the user has already stated they want strokes
    // classified. False positives are one Cmd+Z away and the
    // toggle is one click off; false negatives (a wobbly square
    // that stayed a sketch when the user wanted a rectangle) are
    // the more frustrating outcome, so erring toward conversion
    // is correct. Previous values: 0.72 (too strict), 0.55 (still
    // too strict per user feedback).
    if (recogniseShapesMode) {
      const detected = recogniseShape(simplified);
      if (detected !== null && detected.confidence >= RECOGNITION_THRESHOLD) {
        if (detected.kind === 'line') {
          const fromPt = detected.from ?? simplified[0]!;
          const toPt = detected.to ?? simplified[simplified.length - 1]!;
          // Snap each end onto a nearby arrow's line (docs/specs/008-canvas/arrow-to-arrow.md), as the arrow
          // tool does, so a sketched line connects to an existing one.
          const snapLineEnd = (p: { x: number; y: number }): Endpoint => {
            const hit = snapToArrowPoint(p, activeTab.elements, ARROW_SNAP_THRESHOLD_PX, '');
            return hit
              ? { kind: 'on-arrow', arrowId: hit.arrowId, t: hit.t }
              : { kind: 'free', ...p };
          };
          // Map "line" to an ArrowElement with arrowEnds 'none'
          // (the existing addArrow drop). The arrowEnds toggle in
          // the Pointer accordion is there if the user wants to
          // promote it to a pointer afterwards.
          const arrow: ArrowElement = {
            id: crypto.randomUUID(),
            type: 'arrow',
            from: snapLineEnd(fromPt),
            to: snapLineEnd(toPt),
            arrowEnds: 'none',
            strokeColor: theme.elementStroke ?? NEW_ARROW_THEME_STROKE_FALLBACK,
          };
          // Functional commit for the same mid-gesture-staleness reason
          // as the arrow branch above.
          commit((els) => [...els, styleNewElement(arrow)]);
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
        commit((els) => [...els, styleNewElement(sized)]);
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
      // part of the canvas. Falls back to the default in
      // defaultStrokeColor when the theme has no override.
      ...(theme.elementStroke ? { strokeColor: theme.elementStroke } : {}),
      ...(closed && theme.elementFill ? { fillColor: theme.elementFill } : {}),
    };
    // Append: land on top by default (see addBoxed).
    commit((els) => [...els, elementToInsert]);
    setSelectedId(elementToInsert.id);
    setPendingDraw(null);
    track('Element', 'Added', 'Freehand');
  };
}

type WhiteboardPenIntent = Extract<PendingDraw, { variant: 'whiteboard' }>;

// What a whiteboard pen stroke becomes (docs/specs/023-whiteboard/whiteboard.md "Pens", "Shape
// recognition"): with recognition on, a stroke that reads as a shape is the
// clean shape, unfilled, in the pen's colour and nearest weight; otherwise an
// OPEN stroke (a written "o" is ink, not a filled shape) carrying the pen's
// width. The main pen records no colour, so its marks follow the board.
// Style memory is skipped on purpose: a board's marks wear the pen, not the
// remembered diagram style.
function whiteboardStroke(points: { x: number; y: number }[], pen: WhiteboardPenIntent): Element {
  const colour = pen.colour ? { strokeColor: pen.colour } : {};
  const detected = pen.recognise ? recogniseShape(points) : null;
  if (detected && detected.confidence >= RECOGNITION_THRESHOLD) {
    track('Element', 'Added', detected.kind === 'line' ? 'Arrow' : titleCaseType(detected.kind));
    if (detected.kind === 'line') {
      const from = detected.from ?? points[0]!;
      const to = detected.to ?? points[points.length - 1]!;
      return {
        id: crypto.randomUUID(),
        type: 'arrow',
        from: { kind: 'free', ...from },
        to: { kind: 'free', ...to },
        arrowEnds: 'none',
        strokeWidth: pen.width,
        ...colour,
      };
    }
    return {
      ...createShape(detected.kind, detected.bbox.x, detected.bbox.y),
      x: detected.bbox.x,
      y: detected.bbox.y,
      width: Math.max(16, detected.bbox.width),
      height: Math.max(16, detected.bbox.height),
      fillColor: 'transparent',
      strokeWidth: nearestBorderStroke(pen.width),
      ...colour,
    };
  }
  track('Element', 'Added', 'Freehand');
  return { ...createFreehand(points, false), penWidth: pen.width, ...colour };
}
