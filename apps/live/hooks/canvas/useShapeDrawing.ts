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

import { useRef, useState } from 'react';
import { ARROW_SNAP_THRESHOLD_PX } from '@/lib/canvas';
import {
  createFreehand,
  createShape,
  snapToArrowPoint,
  type ArrowElement,
  type Endpoint,
  isBoxed,
  recogniseShape,
  simplifyPolyline,
  type ComponentKind,
  type Element,
  type ShapeElement,
  type Tab,
} from '@livediagram/diagram';
import { deriveNewBoxedColours, getTheme } from '@/lib/themes';
import { track, titleCaseType } from '@/lib/telemetry';
import { isTechIconId } from '@/lib/tech-icons';
import type { PendingDraw } from '@/lib/draw-mode';
import {
  buildDrawnArrow,
  buildDrawnBoxed,
  buildDrawnComponent,
  NEW_ARROW_THEME_STROKE_FALLBACK,
} from '@/lib/draw-commit';
import type { CanvasTool } from '@/components/palette/CommandPalette';

// Marker yellow (spec/81): the highlighter's default colour regardless
// of theme; the banner's colour popover (and the Colours category on a
// committed stroke) can override it.
export const HIGHLIGHTER_DEFAULT_COLOR = '#fde047';
// Default marker width in px; the banner's strength popover overrides.
export const HIGHLIGHTER_DEFAULT_WIDTH = 14;

// Telemetry `type` per component kind (closed vocabulary, no user content).
const COMPONENT_TELEMETRY: Record<ComponentKind, string> = {
  banner: 'Banner',
  hero: 'Hero',
  header: 'Header',
  callout: 'Callout',
  stat: 'StatRow',
  process: 'ProcessSteps',
  avatar: 'Avatar',
};

type ShapeDrawingDeps = {
  editsBlocked: boolean;
  // The currently-selected element id, read at arm-time so a tap-to-drop
  // inherits its size (see beginDraw / commitDraw).
  selectedId: string | null;
  canvasTool: CanvasTool;
  setCanvasTool: (tool: CanvasTool) => void;
  activeTab: Tab;
  // Every draw lands through the functional `commit` (live elements +
  // activity-log emit): the commit closure is frozen for the whole
  // gesture, so a wholesale write of gesture-start elements would
  // revert anything that landed mid-drag.
  commit: (mapElements: (els: Element[]) => Element[]) => void;
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
    editsBlocked,
    selectedId,
    canvasTool,
    setCanvasTool,
    activeTab,
    commit,
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
  // Highlighter banner settings (spec/81): the colour + stroke width the
  // NEXT marker strokes commit with, adjusted from the mode banner's two
  // popovers. Session-local by design — the marker resets to yellow /
  // medium on a fresh editor load, like a real pen cup.
  const [highlighterColor, setHighlighterColor] = useState(HIGHLIGHTER_DEFAULT_COLOR);
  const [highlighterWidth, setHighlighterWidth] = useState(HIGHLIGHTER_DEFAULT_WIDTH);
  // The element selected when the gesture was armed, captured here because
  // beginDraw clears the selection (below). A tap-to-drop inherits this
  // element's size in commitDraw, preserving the old "new shapes match the
  // last one you had selected" behaviour through the combined gesture.
  const inheritSizeRef = useRef<Element | null>(null);

  // Shared "arm draw mode" path for every palette add. Tap-to-drop and
  // drag-to-draw are one combined gesture now (no setting): picking an
  // element stashes the intent, and the canvas resolves the next pointer
  // gesture — a tap drops it at its inherited / default size, a drag sizes
  // it (see commitDraw). Clears the current selection so the popover
  // doesn't float over the about-to-be-drawn box, and bumps laser to pan
  // (laser swallows pointer-down to paint trail dots and would block it).
  const beginDraw = (intent: PendingDraw): void => {
    // Capture the selection's size BEFORE clearing it so commitDraw's
    // tap branch can inherit it.
    inheritSizeRef.current = selectedId
      ? (activeTab.elements.find((el) => el.id === selectedId) ?? null)
      : null;
    setSelectedId(null);
    setMultiSelectedIds(new Set());
    setEditingId(null);
    if (canvasTool === 'laser') setCanvasTool('pan');
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
      const arrow = buildDrawnArrow(
        startX,
        startY,
        endX,
        endY,
        activeTab.elements,
        getTheme(activeTab.theme),
      );
      commit((els) => [...els, arrow]);
      setSelectedId(arrow.id);
      setPendingDraw(null);
      track('Element', 'Added', 'Arrow');
      return;
    }
    // Freehand / polygon never reach commitDraw: freehand routes
    // through commitFreehand (with the polyline) and polygon through
    // commitPolygon (with its vertices). If a future regression
    // mis-routes either here, bail rather than fall through into the
    // boxed branch and mint a phantom element where the user expected
    // a sketch.
    if (intent.type === 'freehand' || intent.type === 'polygon') {
      setPendingDraw(null);
      return;
    }
    if (intent.type === 'component') {
      const placed = buildDrawnComponent(
        intent.kind,
        startX,
        startY,
        endX,
        endY,
        getTheme(activeTab.theme),
      );
      commit((els) => [...els, ...placed]);
      // Selects the group's primary member.
      const primary = placed.find((el) => isBoxed(el) && el.groupId) ?? placed[0];
      if (primary) setSelectedId(primary.id);
      setPendingDraw(null);
      track('Element', 'Added', COMPONENT_TELEMETRY[intent.kind]);
      return;
    }
    const sized = buildDrawnBoxed(
      intent,
      startX,
      startY,
      endX,
      endY,
      inheritSizeRef.current,
      activeTab,
    );
    // Frames don't need special-casing here: the canvas + exporters
    // route through `framesFirst`, which keeps every frame painted
    // behind its contents regardless of array position (spec/09).
    commit((els) => [...els, sized]);
    setSelectedId(sized.id);
    // A freshly added text element drops straight into typing mode
    // (matches the double-click-to-add-text path in useElementCreation):
    // an empty text box is only useful once you type into it, so save the
    // user the extra click. Other element kinds stay selected-but-not-
    // editing so their format popover is the immediate next interaction.
    if (intent.type === 'text') setEditingId(sized.id);
    setPendingDraw(null);
    const label =
      intent.type === 'shape'
        ? // Tech (brand) icons report as TechIcon, matching the click-to-add
          // path; line-art icons + plain shapes use the kind.
          intent.iconId && isTechIconId(intent.iconId)
          ? 'TechIcon'
          : intent.kind === 'code-block'
            ? // titleCase would emit 'Code-Block' (it capitalises at the
              // hyphen), splitting the feature across two dashboard tokens:
              // the Changed events already report 'CodeBlock' (spec/82).
              'CodeBlock'
            : titleCaseType(intent.kind)
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
  // stroke. The highlighter (spec/81) is the same gesture with the
  // marker variant riding the intent. Both stay zero-arg (rather than
  // one variant parameter) because they're passed straight into
  // onClick slots, where a parameter would swallow the event object.
  const armFreehand = (variant?: 'highlighter') => {
    if (editsBlocked) return;
    setSelectedId(null);
    setMultiSelectedIds(new Set());
    setEditingId(null);
    if (canvasTool === 'laser') setCanvasTool('pan');
    setPendingDraw(variant ? { type: 'freehand', variant } : { type: 'freehand' });
  };
  const beginFreehand = () => armFreehand();
  const beginHighlighter = () => armFreehand('highlighter');

  // Polygon tool entry (spec/84): queues the click-to-place-vertices
  // intent. The vertex accumulation lives canvas-side
  // (useCanvasPolygonGesture); this just arms the mode.
  const beginPolygon = () => {
    if (editsBlocked) return;
    setSelectedId(null);
    setMultiSelectedIds(new Set());
    setEditingId(null);
    if (canvasTool === 'laser') setCanvasTool('pan');
    setPendingDraw({ type: 'polygon' });
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

    // Highlighter variant (spec/81): commit the marker recipe and
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
      setSelectedId(stroke.id);
      setPendingDraw(null);
      track('Element', 'Added', 'Highlighter');
      return;
    }

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
          // Snap each end onto a nearby arrow's line (spec/50), as the arrow
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
          commit((els) => [...els, arrow]);
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
        commit((els) => [...els, sized]);
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
    // Append: land on top by default (see addBoxed).
    commit((els) => [...els, elementToInsert]);
    setSelectedId(elementToInsert.id);
    setPendingDraw(null);
    track('Element', 'Added', 'Freehand');
  };

  // Canvas-driven commit for the polygon tool (spec/84). Receives the
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
    beginFreehand,
    beginHighlighter,
    beginPolygon,
    commitFreehand,
    commitPolygon,
    highlighterColor,
    setHighlighterColor,
    highlighterWidth,
    setHighlighterWidth,
  };
}
