import { useMemo, useState } from 'react';
import { useStableHandlers } from '@/hooks/ui/useStableHandlers';
import { arrowViewGeometry } from './arrow-view-frame';
import { buildArrowLinks } from './drag-affected-arrows';
import { shownWithOverlay, useLayerDragPreview } from '@/hooks/canvas/useLayerDragPreview';
import { CanvasElementList } from './CanvasElementList';
import { usePublishSketchBackdrops } from '@/lib/sketch-backdrop-store';
import { useFontEpoch } from './useFontEpoch';
import {
  elementFontId,
  resolveFontStack,
  buildElementIndex,
  layerBands,
  layerOpacityOf,
  createElementGridTracker,
  type ElementIndex,
  stackedElementIds,
} from '@livedesign/document';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { type QuickConnectDirection } from '@/lib/canvas';
import { ArrowDefs } from '@/components/canvas/arrow-defs';
import type { ArrowLabels } from '@/hooks/canvas/useArrowLabelLayouts';
import { DrawnArrowPreview } from '@/components/canvas/DrawnArrowPreview';
import {
  SelectionGripsContext,
  SelectionGripsLayer,
  type SelectionGripHosts,
} from '@/components/canvas/SelectionGripsLayer';
import { ChangesetRevealOverlay } from '@/components/canvas/ChangesetRevealOverlay';
import { AgentFocusOverlay } from '@/components/canvas/AgentFocusOverlay';
import { LayerSelectionChrome } from '@/components/canvas/LayerSelectionChrome';
import type { BoxedShared } from '@/components/canvas/boxed-shared';
import type { CanvasSelectionInput } from '@/hooks/canvas/useCanvasSelectionView';
import { ZoomedLaserOverlay, ZoomedRemoteCursor } from '@/components/canvas/view-readers';
import type { CanvasProps } from '@/components/canvas/Canvas.types';
import { PageClip } from '@/components/canvas/PageClip';
import { WireframeDeviceOverlays } from '@/components/canvas/WireframeDeviceOverlays';
import { GifOmit } from './GifOmit';

// What a drawn arrow resolves its ends against on a board with no arrows yet.
const EMPTY_ELEMENT_INDEX: ElementIndex = new Map();

// Canvas-computed values threaded into the element layer alongside the
// raw props.
type ElementsExtras = {
  // The draw gesture in flight (canvas coords), for the line or arrow it would land.
  drawDrag: { startX: number; startY: number; currentX: number; currentY: number } | null;
  hasArrows: boolean;
  // Every arrow label laid out once per element change (Canvas owns the pass).
  arrowLabels: ArrowLabels;
  // What the selection chrome derives the selection from (it reads the selection from the store).
  selectionInput: CanvasSelectionInput;
  isPaintMode: boolean;
  handleArrowSelect: (id: string, e: ReactPointerEvent, paired?: boolean) => void;
  handleElementClick: (id: string) => void;
  handleElementContextSelect: (id: string, sx: number, sy: number) => void;
  // Which quick-connect ring is open (lifted to Canvas so only one opens
  // at a time and the toolbar can dodge the top ring). null = all closed.
  quickRingOpen: QuickConnectDirection | null;
  setQuickRingOpen: (placement: QuickConnectDirection | null) => void;
};

export type CanvasElementsLayerProps = CanvasProps & ElementsExtras;

// The element-rendering layer of the canvas: the shared arrow defs, every
// element (arrows + boxed views interleaved in z-order), remote cursors,
// the laser overlay, and the grips layer on top of them all: the union resize
// handles, the quick-connect plus buttons, and every element's own grips,
// portalled in (SelectionGripsLayer). Rendered inside Canvas's
// viewport-transformed wrapper.
export function CanvasElementsLayer(props: CanvasElementsLayerProps) {
  const {
    editCursorAtEnd,
    editingId,
    elements,
    tabLayers,
    layerPreviewId,
    handleArrowSelect,
    handleElementClick,
    handleElementContextSelect,
    hasArrows,
    arrowLabels,
    drawDrag,
    imageContext,
    isPaintMode,
    laserTrails,
    onBeginArrowCurveDrag,
    onBeginArrowCurvePointDrag,
    onBeginArrowBend,
    onBeginArrowScale,
    onDeleteCurvePoint,
    onBeginArrowElbowDrag,
    onBeginArrowLabelDrag,
    onBeginArrowTranslate,
    onBeginDrag,
    onPressArmedAction,
    onBeginEdit,
    onBeginEndpointDrag,
    onCancelEdit,
    onCommitLabel,
    onSetTextAlign,
    onCommitTable,
    onAddTableRow,
    onAddTableColumn,
    onToggleChecklistItem,
    onSetPageHeading,
    onSetWebRows,
    onSetPointerTip,
    onAppendWebRow,
    onSetHeroCaptionLine,
    chartPalette,
    onSpawnConnect,
    onStartArrow,
    onStartPencil,
    onFollowLink,
    onOpenComments,
    onOpenAction,
    onOpenNote,
    onEditLink,
    onOpenEditDialog,
    onDropIcon,
    onLinkCell,
    onShiftSelect,
    readOnly,
    canMove,
    canWriteText,
    canResize,
    remoteCursors,
    remoteSelectionsByElement,
    shiftDupGhostIds,
    tabFont,
    tabFinish,
    tabLocked,
    tabSummaries,
    quickRingOpen,
    setQuickRingOpen,
    settings,
  } = props;
  // Identity-stable wrappers for every function prop the memoized
  // element views receive. The editor's orchestration mints fresh
  // closures per render (every drag tick, cursor packet, keystroke), so
  // without this the views' React.memo never fired and dragging ONE
  // element re-rendered all N views at pointer rate. See
  // useStableHandlers; the conditional (read-only) handlers keep their
  // presence/absence so children still branch on them.
  const h = useStableHandlers({
    handleArrowSelect,
    handleElementClick,
    handleElementContextSelect,
    onBeginEndpointDrag,
    onBeginEdit,
    onCommitLabel,
    onCancelEdit,
    onBeginArrowTranslate,
    onBeginArrowCurveDrag,
    onBeginArrowCurvePointDrag,
    onBeginArrowBend,
    onBeginArrowScale,
    onDeleteCurvePoint,
    onBeginArrowElbowDrag,
    onBeginArrowLabelDrag,
    onBeginDrag,
    onPressArmedAction,
    onShiftSelect,
    onSetTextAlign: readOnly ? undefined : onSetTextAlign,
    onCommitTable,
    onToggleChecklistItem: readOnly ? undefined : onToggleChecklistItem,
    onSetPageHeading,
    onSetWebRows: readOnly ? undefined : onSetWebRows,
    onSetPointerTip: readOnly ? undefined : onSetPointerTip,
    onSetHeroCaptionLine: readOnly ? undefined : onSetHeroCaptionLine,
    onFollowLink,
    onOpenComments,
    onOpenAction,
    onOpenNote,
    onEditLink,
    onOpenEditDialog,
    onDropIcon,
    onLinkCell,
  });
  // Auto-fit measures the face it paints, and webfonts land after first
  // paint — re-render this layer once they are in so every fitted label
  // re-measures in its real face (see useFontEpoch).
  const fontEpoch = useFontEpoch();
  // What the tab's stacks hold, for the reflow glide (docs/specs/009-elements/stack.md "Animation").
  const stackedIds = useMemo(() => stackedElementIds(elements), [elements]);
  // The font an element following the tab letters in, resolved once (docs/specs/004-interface-design/fonts.md):
  // the tab's, or the handwriting font on a Sketch tab (docs/specs/008-canvas/finish.md).
  const tabFontStack = resolveFontStack(elementFontId({}, tabFont, tabFinish));
  // One id -> element index per ELEMENTS CHANGE (not per render),
  // shared by every ArrowView so each resolves its endpoints / label
  // collisions with O(1) lookups instead of scanning the whole element
  // list twice per arrow. Memoised because it's a memo-compared prop of
  // every ArrowView: a fresh Map per render (cursor packets, selection
  // changes) defeated their React.memo and re-rendered every arrow at
  // presence-message rate even when no element had changed.
  const elementIndex = useMemo(
    () => (hasArrows ? buildElementIndex(elements) : null),
    [hasArrows, elements],
  );
  // Paint order (docs/specs/006-document/layers.md + docs/specs/008-canvas/canvas-and-palette.md): layer bands bottom -> top, keeping
  // array order within each band with frames hoisted to the front of
  // THEIR band (a frame is a section backdrop that must sit behind its
  // contents so they stay clickable). Hidden layers' elements drop out
  // here entirely — no DOM, so no hit-testing either. Same banding the
  // exporters use. Each element carries its band's opacity so per-layer
  // opacity multiplies over the element's own. While a Layers-panel row
  // is hovered (`layerPreviewId`, docs/specs/006-document/layers.md hover-solo) ONLY that band
  // renders — hidden or not — at full band opacity so the preview is
  // legible. Memoised for the same reason as the index (stable identity
  // when inputs are).
  const ordered = useMemo(() => {
    if (layerPreviewId) {
      return layerBands(elements, tabLayers, { includeHidden: true })
        .filter((band) => band.layer.id === layerPreviewId)
        .flatMap((band) => band.elements.map((element) => ({ element, layerOpacity: 1 })));
    }
    return layerBands(elements, tabLayers).flatMap((band) => {
      const layerOpacity = layerOpacityOf(band.layer);
      return band.elements.map((element) => ({ element, layerOpacity }));
    });
  }, [elements, tabLayers, layerPreviewId]);
  // The palette arrives as a fresh array each render (themeChartPalette): keyed by its colours, so the views
  // re-render only when the colours change.
  const paletteKey = chartPalette?.join('|') ?? '';
  // oxlint-disable-next-line react/exhaustive-deps
  const stablePalette = useMemo(() => chartPalette, [paletteKey]);
  // What every boxed element view takes from this layer, the same for each element.
  const boxedShared = useMemo<BoxedShared>(
    () => ({
      onPlainClick: h.handleElementClick,
      isPaintMode,
      tabLocked,
      tabSummaries,
      readOnly,
      onBeginDrag: h.onBeginDrag,
      onPressArmedAction: h.onPressArmedAction,
      onShiftSelect: h.onShiftSelect,
      onBeginEdit: h.onBeginEdit,
      onCommitLabel: h.onCommitLabel,
      onSetTextAlign: h.onSetTextAlign,
      onCommitTable: h.onCommitTable,
      onToggleChecklistItem: h.onToggleChecklistItem,
      onSetPageHeading: h.onSetPageHeading,
      onSetWebRows: h.onSetWebRows,
      onSetPointerTip: h.onSetPointerTip,
      onSetHeroCaptionLine: h.onSetHeroCaptionLine,
      chartPalette: stablePalette,
      onCancelEdit: h.onCancelEdit,
      onFollowLink: h.onFollowLink,
      onOpenComments: h.onOpenComments,
      onOpenAction: h.onOpenAction,
      onOpenNote: h.onOpenNote,
      onEditLink: h.onEditLink,
      onOpenEditDialog: h.onOpenEditDialog,
      onDropIcon: h.onDropIcon,
      onLinkCell: h.onLinkCell,
      imageContext,
      onContextSelect: h.handleElementContextSelect,
    }),
    [h, isPaintMode, tabLocked, tabSummaries, readOnly, stablePalette, imageContext],
  );
  // The elements actually drawn, for the arrows' pass-behind breaks: a box on
  // a hidden layer must not cut a gap in a line (docs/specs/008-canvas/arrow-route-behind.md).
  const drawnElements = useMemo(() => ordered.map((o) => o.element), [ordered]);
  // Shapes something sits on keep a solid fill under Sketch (docs/specs/008-canvas/finish.md).
  usePublishSketchBackdrops(props.activeTabId ?? '', drawnElements, tabFinish);
  // The drawn elements' grid (docs/specs/008-canvas/canvas-performance.md "Questions about neighbours
  // ask a spatial index"), re-bucketing only what changed since the last one, and every arrow's frame
  // and holes from it, once per element change. ArrowView compares both by value, so a move
  // re-renders only the arrows whose geometry it changed.
  const [gridTracker] = useState(createElementGridTracker);
  const arrowGeometry = useMemo(() => {
    const out = new Map<string, ReturnType<typeof arrowViewGeometry>>();
    if (!elementIndex) return out;
    const grid = gridTracker.gridFor(drawnElements);
    for (const el of drawnElements) {
      if (el.type === 'arrow') out.set(el.id, arrowViewGeometry(el, elementIndex, grid));
    }
    return out;
  }, [drawnElements, elementIndex, gridTracker]);
  const arrowLinks = useMemo(
    () => (hasArrows ? buildArrowLinks(drawnElements) : null),
    [hasArrows, drawnElements],
  );
  // A drag in progress, ours or a collaborator's (docs/specs/008-canvas/drag-preview.md): each element
  // it changes, and each arrow depending on them, reads its own preview entry (PreviewedElement), so a
  // preview frame renders those and not this layer; the maps above stay as built from the document.
  // The layer renders for a preview only when it adds or removes elements, which changes the list.
  const { store: previewStore, structure: previewStructure } = useLayerDragPreview({
    tabId: props.activeTabId ?? '',
    ordered,
    drawnElements,
    elementIndex,
    arrowLinks,
    gridFor: (els) => gridTracker.gridFor(els),
    arrowLabels,
  });
  const shownOrder = useMemo(
    () => (previewStructure ? shownWithOverlay(ordered, previewStructure) : ordered),
    [ordered, previewStructure],
  );
  // The grips layer's portal hosts (docs/specs/008-canvas/canvas-and-palette.md "Resize"), set once
  // it mounts; every element view portals its grips into them.
  const [gripHosts, setGripHosts] = useState<SelectionGripHosts | null>(null);
  return (
    <>
      <SelectionGripsContext.Provider value={gripHosts}>
        {/* Shared arrowhead defs. Multiple per-arrow <svg>s below
            all reference url(#arrowhead) — defs are document-scoped
            in SVG so a single defs node lets every arrow render
            with the same marker. */}
        {hasArrows ? (
          <svg
            className="absolute"
            style={{ width: 0, height: 0, overflow: 'visible' }}
            aria-hidden
          >
            <ArrowDefs />
          </svg>
        ) : null}

        {/* Render elements in their natural array order so
            `bringToFront` / `sendToBack` reorder arrows relative to
            boxed elements (instead of all arrows perpetually stacking
            above all boxes inside a single SVG layer). Each arrow
            gets its own <svg> overlay; pointer events on the SVG are
            disabled in CSS, only the inner arrow line picks them up. */}
        {/* Pages mode cuts elements off at the page edges (PageClip); not in the
          isometric view, whose 3D stack a clip would flatten. */}
        <PageClip
          pages={props.pagesMode && props.canvasTool !== 'isometric' ? props.pagesMode.pages : null}
          // A page under a layout preview shows only the preview.
          hiddenPageId={props.pagesMode?.layoutPreview?.pageId ?? null}
          elements={elements}
          layers={tabLayers}
        >
          <CanvasElementList
            shownOrder={shownOrder}
            previewStore={previewStore}
            h={h}
            boxedShared={boxedShared}
            arrowGeometry={arrowGeometry}
            arrowLabels={arrowLabels}
            elements={elements}
            editingId={editingId}
            editCursorAtEnd={editCursorAtEnd}
            reshapingArrowId={props.reshapingArrowId}
            isPaintMode={isPaintMode}
            tabLocked={tabLocked}
            readOnly={readOnly}
            shiftDupGhostIds={shiftDupGhostIds}
            remoteSelectionsByElement={remoteSelectionsByElement}
            canMove={canMove}
            canWriteText={canWriteText}
            canResize={canResize}
            tabFont={tabFont}
            tabFinish={tabFinish}
            fontEpoch={fontEpoch}
            stackedIds={stackedIds}
          />
        </PageClip>
        {/* A wireframe page's camera and system bars, over what is on its screen. */}
        {props.pagesMode && props.canvasTool !== 'isometric' ? (
          <WireframeDeviceOverlays
            pages={props.pagesMode.pages}
            frameTheme={props.pagesMode.frameTheme}
          />
        ) : null}

        {/* Editor-only marks, left out of an animated GIF (GifOmit). */}
        <GifOmit>
          {/* The line or arrow being drawn (docs/specs/008-canvas/canvas-and-palette.md "Adding
          elements — tap-to-drop or drag-to-draw"): the element the release lands, after every
          element, where it will land. */}
          {drawDrag && props.pendingDraw?.type === 'arrow' && props.previewDrawnArrow ? (
            <DrawnArrowPreview
              arrow={props.previewDrawnArrow(
                props.pendingDraw,
                drawDrag.startX,
                drawDrag.startY,
                drawDrag.currentX,
                drawDrag.currentY,
              )}
              elementIndex={elementIndex ?? EMPTY_ELEMENT_INDEX}
              occluders={drawnElements}
              draftLayout={arrowLabels.draftLayout}
              fontFamily={tabFontStack}
              withDefs={!hasArrows}
            />
          ) : null}

          {/* What the agents present name in focus (docs/specs/024-agents/agent-presence.md "In the editor"):
          above the elements, beneath the remote cursors. */}
          <AgentFocusOverlay elements={elements} />

          {remoteCursors.map((c) => (
            <ZoomedRemoteCursor key={c.id} cursor={c} />
          ))}

          {/* Laser overlay sits inside the viewport-transformed wrapper
            so trail coordinates (canvas-space) pan + zoom with
            elements. The overlay component owns its own RAF loop
            and only runs while there's at least one active trail. */}
          <ZoomedLaserOverlay trails={laserTrails} />

          {/* What a relayed changeset touched (docs/specs/024-agents/agent-changesets.md "In the editor"):
          above the elements, below the selection chrome. */}
          <ChangesetRevealOverlay elements={elements} tabId={props.activeTabId ?? ''} />
        </GifOmit>

        {/* The grips layer (docs/specs/008-canvas/canvas-and-palette.md "Resize"): above every element, so
          no grip is ever covered. The canvas's own grips go in here; each element's are portalled in. */}
        <SelectionGripsLayer onHosts={setGripHosts} isoDepth={ordered.length}>
          <LayerSelectionChrome
            selectionInput={props.selectionInput}
            tabId={props.activeTabId ?? ''}
            elements={elements}
            pluses={{
              quickRingOpen,
              setQuickRingOpen,
              openOnHover: settings.quickAddOnHover === true,
              onSpawnConnect,
              onStartArrow,
              onStartPencil,
              onAddTableRow,
              onAddTableColumn,
              onAppendWebRow,
            }}
            onBeginDrag={onBeginDrag}
            pages={props.pagesMode?.pages}
          />
        </SelectionGripsLayer>
      </SelectionGripsContext.Provider>
    </>
  );
}
