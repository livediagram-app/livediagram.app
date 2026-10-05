// Draw-to-size + freehand pen tooling, lifted out of editor-page.tsx.
// Two related gestures share the `pendingDraw` state machine:
//
// - Draw-to-size: picking anything from the palette except the annotation
//   (docs/specs/008-canvas/canvas-and-palette.md "Placement on add") stashes the intent in `pendingDraw`. The
//   canvas intercepts the next pointer-down and calls `commitDraw` with the
//   drag's start + end points, which mint the element sized to the dragged
//   box (or the dragged endpoints, for arrows).
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

import type { Selection } from '@/lib/selection-store';
import { useRef, useState } from 'react';
import { createFreehand, type Element, type Tab } from '@livediagram/document';
import { getTheme } from '@/lib/themes';
import { track, titleCaseType } from '@/lib/telemetry';
import { isTechIconId } from '@/lib/tech-icons';
import { opensForTyping, type PendingDraw } from '@/lib/draw-mode';
import { HIGHLIGHTER_COLOR, HIGHLIGHTER_WIDTH } from '@/lib/highlighter-config';
import { boardShape } from '@/lib/whiteboard-tool';
import { buildDressedDrawnArrow, buildDrawnBoxed, buildDrawnComponent } from '@/lib/draw-commit';
import type { CanvasTool } from '@/components/palette/CommandPalette';
import { componentTelemetryType, shapeTelemetryToken } from '@/lib/element-telemetry';
import { makeCommitFreehand } from '@/hooks/canvas/commit-freehand';

type ShapeDrawingDeps = {
  editsBlocked: boolean;
  // The currently-selected element id, read at arm-time so a tap-to-drop
  // inherits its size (see beginDraw / commitDraw).
  // Read when a draw begins (docs/specs/008-canvas/blueprints/selection-store.md).
  readSelection: () => Selection;
  canvasTool: CanvasTool;
  setCanvasTool: (tool: CanvasTool) => void;
  activeTab: Tab;
  // The viewer works in Draw mode (docs/specs/007-editor/editor-modes.md): what is drawn is
  // written the Draw way (unpainted ink, no fill, hugging text, a sticky open for typing).
  drawMode: boolean;
  // Every draw lands through the functional `commit` (live elements): the
  // commit closure is frozen for the whole
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
  // Style memory (docs/specs/008-canvas/quick-style-panel.md): dresses every user-drawn shape and arrow in
  // the remembered style of its kind. Identity for anything memory does not know.
  styleNewElement: <T extends Element>(el: T) => T;
  // A palette card never lands on the canvas (docs/specs/026-plan/plan-mode.md "The palette"): it goes
  // into the board column at the point, or nowhere.
  onPlanCardPlace?: (itemType: string | undefined, canvasX: number, canvasY: number) => void;
};

export function useShapeDrawing(deps: ShapeDrawingDeps) {
  const {
    editsBlocked,
    readSelection,
    canvasTool,
    setCanvasTool,
    activeTab,
    drawMode,
    commit,
    setSelectedId,
    setMultiSelectedIds,
    setEditingId,
    openImagePickerFor,
    zoomRef,
    styleNewElement,
    onPlanCardPlace,
  } = deps;

  // Pending draw-to-size intent. Picking a palette element stashes it here;
  // the canvas intercepts the next pointer-down on its surface and uses the
  // drag's bounding box for the element's size. Escape clears it.
  const [pendingDraw, setPendingDraw] = useState<PendingDraw | null>(null);
  // The highlighter's colour and width (docs/specs/008-canvas/highlighter.md "Settings"): what the
  // next stroke lands in, set from the Quick style panel while the tile is armed. Session-local by
  // design: Yellow / Medium again on a fresh load, like a real pen cup.
  const [highlighterColour, setHighlighterColourState] = useState(HIGHLIGHTER_COLOR);
  const [highlighterWidth, setHighlighterWidthState] = useState(HIGHLIGHTER_WIDTH);
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
    const { selectedId } = readSelection();
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
    // A shape drawn in Draw mode starts as plain ink, unfilled (a pen never colours
    // it), then wears the style chosen for its tool, which Draw mode keeps
    // apart from Diagram mode's (docs/specs/023-draw-mode/draw-mode.md "Shapes").
    const whiteboard = drawMode;
    const dress = <T extends Element>(el: T): T =>
      styleNewElement(whiteboard ? boardShape(el) : el);
    if (intent.type === 'arrow') {
      // Built exactly as the canvas previews it while the drag is in flight.
      const arrow = buildDressedDrawnArrow(
        intent,
        startX,
        startY,
        endX,
        endY,
        { elements: activeTab.elements, theme: getTheme(activeTab.theme), whiteboard },
        styleNewElement,
      );
      commit((els) => [...els, arrow]);
      setSelectedId(arrow.id);
      setPendingDraw(null);
      track('Element', 'Added', arrow.arrowEnds === 'none' ? 'Line' : 'Arrow');
      return;
    }
    // Freehand / polygon / path never reach commitDraw: freehand routes
    // through commitFreehand (with the polyline), polygon through
    // commitPolygon (with its vertices) and a path through commitPath
    // (usePathCommits). If a future regression
    // mis-routes either here, bail rather than fall through into the
    // boxed branch and mint a phantom element where the user expected
    // a sketch.
    if (intent.type === 'freehand' || intent.type === 'polygon' || intent.type === 'path') {
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
    if (intent.type === 'shape' && intent.kind === 'plan-card') {
      setPendingDraw(null);
      onPlanCardPlace?.(intent.plan, endX, endY);
      return;
    }
    const sized = dress(
      buildDrawnBoxed(
        intent,
        startX,
        startY,
        endX,
        endY,
        inheritSizeRef.current,
        activeTab,
        drawMode,
      ),
    );
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
    if (opensForTyping(intent, whiteboard)) setEditingId(sized.id);
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
            : // Hyphenated kinds ('mind-node', 'session-button', ...) need
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
  // stroke. The highlighter (docs/specs/008-canvas/highlighter.md) is the same gesture with the
  // marker variant, colour and width riding the intent. The begin* entry points stay zero-arg
  // (rather than taking the intent as a parameter) because they're passed
  // straight into onClick slots, where a parameter would swallow the event object.
  const armFreehand = (intent: Extract<PendingDraw, { type: 'freehand' }>) => {
    if (editsBlocked) return;
    setSelectedId(null);
    setMultiSelectedIds(new Set());
    setEditingId(null);
    if (canvasTool === 'laser') setCanvasTool('pan');
    setPendingDraw(intent);
  };
  const beginFreehand = () => armFreehand({ type: 'freehand' });
  const beginHighlighter = () =>
    armFreehand({
      type: 'freehand',
      variant: 'highlighter',
      colour: highlighterColour,
      width: highlighterWidth,
    });
  // A setting chosen while the tile is armed reaches the armed stroke too, so the very next drag
  // (and its preview) lands in it.
  const rearmHighlighter = (patch: { colour?: string; width?: number }) =>
    setPendingDraw((p) =>
      p?.type === 'freehand' && p.variant === 'highlighter' ? { ...p, ...patch } : p,
    );
  const setHighlighterColour = (colour: string) => {
    setHighlighterColourState(colour);
    rearmHighlighter({ colour });
  };
  const setHighlighterWidth = (width: number) => {
    setHighlighterWidthState(width);
    rearmHighlighter({ width });
  };

  // The shape pen (docs/specs/008-canvas/two-pens.md): the same gesture, but the stroke is run through
  // shape recognition on release. Which pen you picked IS the setting.
  const beginShapePen = () => armFreehand({ type: 'freehand', variant: 'shape-pen' });

  // Polygon tool entry (docs/specs/008-canvas/polygon-tool.md): queues the click-to-place-vertices
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

  // Canvas-driven commit for the pen gesture — see makeCommitFreehand.
  const commitFreehand = makeCommitFreehand({
    editsBlocked,
    activeTab,
    commit,
    pendingDraw,
    setPendingDraw,
    setSelectedId,
    zoomRef,
    styleNewElement,
  });

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
    beginFreehand,
    beginHighlighter,
    beginShapePen,
    beginPolygon,
    commitFreehand,
    commitPolygon,
    highlighter: {
      colour: highlighterColour,
      width: highlighterWidth,
      setColour: setHighlighterColour,
      setWidth: setHighlighterWidth,
    },
  };
}
