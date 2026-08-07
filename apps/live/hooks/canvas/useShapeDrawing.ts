// Draw-to-size + freehand pen tooling, lifted out of editor-page.tsx.
// Two related gestures share the `pendingDraw` state machine:
//
// - Draw-to-size: picking anything from the palette except the annotation
//   (spec/09 "Placement on add") stashes the intent in `pendingDraw`. The
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

import { useEffect, useRef, useState } from 'react';
import { createFreehand, isBoxed, type Element, type Tab } from '@livediagram/diagram';
import { getTheme } from '@/lib/themes';
import { track, titleCaseType } from '@/lib/telemetry';
import { isTechIconId } from '@/lib/tech-icons';
import type { PendingDraw } from '@/lib/draw-mode';
import { buildDrawnArrow, buildDrawnBoxed, buildDrawnComponent } from '@/lib/draw-commit';
import type { CanvasTool } from '@/components/palette/CommandPalette';
import { componentTelemetryType } from '@/lib/element-telemetry';
import { makeCommitFreehand } from '@/hooks/canvas/commit-freehand';

// The armed marker gesture. One frozen object so the effect below can compare
// and re-set it without minting a new intent (and a new render) per pass.
const MARKER_INTENT = { type: 'freehand', variant: 'highlighter' } as const satisfies PendingDraw;

// Marker yellow (spec/81): the highlighter's default colour regardless
// of theme; the banner's colour popover (and the Colours category on a
// committed stroke) can override it.
export const HIGHLIGHTER_DEFAULT_COLOR = '#fde047';
// Default marker width in px; the banner's strength popover overrides.
export const HIGHLIGHTER_DEFAULT_WIDTH = 14;

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

  // Pending draw-to-size intent. Picking a palette element stashes it here;
  // the canvas intercepts the next pointer-down on its surface and uses the
  // drag's bounding box for the element's size. Escape clears it.
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
      track('Element', 'Added', componentTelemetryType(intent.kind));
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
          : intent.kind === 'sticker'
            ? // Stickers are their own element kind (spec/116), so their own
              // dashboard token rather than riding Icon's.
              'Sticker'
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
            : intent.type === 'table'
              ? titleCaseType('table')
              : intent.type === 'link-card'
                ? // titleCase would emit 'Link-Card' (it capitalises at the
                  // hyphen); the click path always reported 'LinkCard', so
                  // moving the event here must not split the dashboard token.
                  'LinkCard'
                : intent.type === 'video'
                  ? // One token for all six providers, matching the old click
                    // path: spec/22's vocabulary is by element kind, and the
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
  // stroke. Both pens stay zero-arg (rather than taking the variant as a
  // parameter) because they're passed straight into onClick slots, where a
  // parameter would swallow the event object. The highlighter used to arm
  // through here too; it is a held tool now (see holdingMarker below).
  const armFreehand = (variant?: 'shape-pen') => {
    if (editsBlocked) return;
    setSelectedId(null);
    setMultiSelectedIds(new Set());
    setEditingId(null);
    if (canvasTool === 'laser') setCanvasTool('pan');
    setPendingDraw(variant ? { type: 'freehand', variant } : { type: 'freehand' });
  };
  const beginFreehand = () => armFreehand();

  // The highlighter is a MODE now (spec/81), not a one-shot arm: it lives in
  // the tool dropdown beside the Eraser, so picking it holds the marker until
  // you put it down. The gesture underneath is unchanged, so the mode is
  // expressed by keeping the freehand-marker intent armed for as long as the
  // tool is selected — entering re-arms it here, each committed stroke re-arms
  // it in commitFreehand, and leaving drops it.
  const holdingMarker = canvasTool === 'highlighter';
  useEffect(() => {
    if (holdingMarker) {
      setSelectedId(null);
      setMultiSelectedIds(new Set());
      setEditingId(null);
      setPendingDraw(MARKER_INTENT);
      return;
    }
    // Only the marker's own intent: leaving the tool must not cancel a draw
    // the user armed from the palette while holding it.
    setPendingDraw((p) => (p?.type === 'freehand' && p.variant === 'highlighter' ? null : p));
    // The setters are stable state setters; re-running on them would fight the
    // commit path's re-arm.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [holdingMarker]);

  // The shape pen (spec/115): the same gesture, but the stroke is run through
  // shape recognition on release. Which pen you picked IS the setting.
  const beginShapePen = () => armFreehand('shape-pen');

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

  // Canvas-driven commit for the pen gesture — see makeCommitFreehand.
  const commitFreehand = makeCommitFreehand({
    editsBlocked,
    holdingMarker,
    activeTab,
    commit,
    pendingDraw,
    setPendingDraw,
    setSelectedId,
    highlighterColor,
    highlighterWidth,
    zoomRef,
  });

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
    beginShapePen,
    beginPolygon,
    commitFreehand,
    commitPolygon,
    highlighterColor,
    setHighlighterColor,
    highlighterWidth,
    setHighlighterWidth,
  };
}
