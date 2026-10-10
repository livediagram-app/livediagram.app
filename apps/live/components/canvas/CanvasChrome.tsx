import { mirroredLogoPages } from '@/hooks/editor/useLogoTools';
import { useViewportStore } from '@/hooks/canvas/useViewportStore';
import { ViewZoomControls } from '@/components/canvas/view-readers';
import { ES_LANES } from '@livediagram/document';
import { computeDrawGuides } from '@/components/canvas/canvas-draw-guides';
import { CanvasGuideOverlay } from '@/components/canvas/CanvasGuideOverlay';
import { TimelineLanesOverlay } from '@/components/canvas/TimelineLanesOverlay';
import { CanvasDrawPreview } from '@/components/canvas/CanvasDrawPreview';
import { TopCenterChrome } from '@/components/chrome/TopCenterChrome';
// Lazy-load TemplatePicker (1163 lines + its theme / share helpers)
// the same way ExportTabDialog + ShareDialog already are. The picker
// is gated on `showTemplatePicker`, which is false for the common
// path (a returning user opening an existing document with tabs that
// already have content). For first-time guests on a fresh document
// the gate is true on first paint, but the empty canvas underneath
// has already rendered by then, so the user sees the welcome modal
// fade in a frame later rather than blocking the route on the
// picker's JS. The /live/new entry keeps the static import because
// the picker is the whole UI there.
import dynamic from 'next/dynamic';
const TemplatePicker = dynamic(
  () => import('@/components/palette/TemplatePicker').then((m) => m.TemplatePicker),
  { ssr: false },
);

import { ThemeBrushIcon } from '@/components/palette/palette-icons';
import { OffscreenContentHint } from '@/components/canvas/OffscreenContentHint';
import { ToolbarPalette } from '@/components/palette/ToolbarPalette';
import { pickPaletteAddHandlers } from '@/components/palette/palette-add-handlers';
import { ToolbarExplorerButton } from '@/components/chrome/ToolbarExplorerButton';
import { SlidesClusterButton } from '@/components/canvas/SlidesClusterButton';
import { PlanCardsClusterStrip } from '@/components/canvas/PlanCardsClusterStrip';
import { useCardTypesOpener } from '@/hooks/plan/useCardTypesOpener';
import { usePublishCardTypesTaken } from '@/hooks/plan/card-types-taken';
import { LayersClusterButton } from '@/components/canvas/LayersClusterButton';
import { UndoRedoClusterStrip } from '@/components/canvas/UndoRedoClusterStrip';
import type { CanvasProps } from '@/components/canvas/Canvas.types';
import {
  Fragment,
  useCallback,
  useMemo,
  type Dispatch,
  type RefObject,
  type SetStateAction,
} from 'react';
import type { DockAnchor, DockPanel } from '@/hooks/canvas/useDockPopovers';
import { useCornerDocking } from '@/hooks/ui/useCornerDocking';
import { PanelSnapSlot } from '@/components/canvas/PanelSnapSlot';
import { useCanvasChromePanels } from './useCanvasChromePanels';
import { usePaletteDragGuides } from '@/hooks/canvas/usePaletteDragGuides';
import { PANEL_CORNERS, PANEL_IDS, cornerBottomInset, type PanelCorner } from '@/lib/panel-layout';
import type { StampGhost } from '@/components/canvas/useStampGhost';
import { HoverCard, atLeastInset } from '@livediagram/ui';
import { STRIP_SELECTOR, useStripCrowdsCorners } from '@/hooks/ui/useStripCrowdsCorners';
import { PHONE_TOOLBAR_ITEMS } from '@/components/chrome/phone-toolbar-items';
import { useSnapHaptic } from '@/hooks/canvas/useSnapHaptic';
import { WHITEBOARD_DOCK_SELECTOR } from '@/lib/whiteboard-dock-prefs';
import { CollaborateClusterButton } from './CollaborateClusterButton';
import { kindCounts } from '@/components/panels/collaborate/collaborate-model';
import { panelEnabled } from '@/lib/user-preferences';
import { WhiteboardDock } from '@/components/canvas/whiteboard/WhiteboardDock';
import { useUiScale } from '@/components/providers/ui-scale';
import { toSurfacePx, uiScaleStyle } from '@/lib/ui-scale';
import { CLUSTER_STRIP } from '@/components/canvas/cluster-strip';

// Values the Canvas computes (selection projection + layout/dock/zoom
// state) and threads into the chrome alongside its own props.
type ChromeExtras = {
  // The canvas <main>'s measured size (the Map's current-view window reads it; see Minimap.tsx).
  mainSize: { width: number; height: number };
  // True when every element has scrolled out of view: show the nudge above
  // the Fit button (useOffscreenContent in Canvas).
  offscreenContent: boolean;
  marquee: { startX: number; startY: number; currentX: number; currentY: number } | null;
  drawDrag: { startX: number; startY: number; currentX: number; currentY: number } | null;
  // Snapped pointer position while a draw is armed but not yet started
  // (pre-press start-snap preview); null when not armed / not snapped.
  drawHover: { x: number; y: number } | null;
  // The armed fixed-size note's ghost (docs/specs/021-event-storming/event-storming.md Phase 4).
  stamp: StampGhost | null;
  penPoints: { x: number; y: number }[] | null;
  // Polygon tool in-flight state (docs/specs/008-canvas/polygon-tool.md): the placed vertices and
  // the live rubber-band cursor position, both canvas coords.
  polygonVertices: { x: number; y: number }[];
  polygonCursor: { x: number; y: number } | null;
  wrapperRef: RefObject<HTMLDivElement | null>;
  activeDockPanel: DockPanel | null;
  setActiveDockPanel: Dispatch<SetStateAction<DockPanel | null>>;
  activeDockAnchor: DockAnchor | null;
  setActiveDockAnchor: Dispatch<SetStateAction<DockAnchor | null>>;
  handleDockButtonClick: (id: DockPanel, button: HTMLElement, above?: boolean) => void;
  handleZoomIn: () => void;
  handleZoomOut: () => void;
  handleSetZoom: (zoom: number) => void;
  // Begin an isometric orbit drag from the given screen coordinates
  // (wired to `isoCamera.startOrbit`). Drives the dock orbit button,
  // which only renders while the isometric tool is active.
  onIsoOrbit: (clientX: number, clientY: number) => void;
  // Reset the isometric camera to its default angle (wired to
  // `isoCamera.reset`) — fired when the dock orbit button is clicked.
  onIsoReset: () => void;
  // Avatar mode (docs/specs/008-canvas/avatar-mode.md): the character's customisation, owned by
  // useAvatarConfig in Canvas (it persists per browser, so it lives with the
  // sprite rather than in the editor's document state) and edited by the
  // Avatar Panel down in the chrome.
  avatarConfig: import('@/lib/avatar-config').AvatarConfig;
  onChangeAvatarField: <K extends keyof import('@/lib/avatar-config').AvatarConfig>(
    field: K,
    value: import('@/lib/avatar-config').AvatarConfig[K],
  ) => void;
  // Roll a whole new character, and play one of the panel's reactions.
  onRandomiseAvatar: () => void;
  onAvatarReaction: (kind: import('@/lib/avatar-reactions').AvatarReactionKind) => void;
  // Throw one of the Reaction Pad's bursts (docs/specs/009-elements/reaction-pad.md) around the character.
  onAvatarBurst?: (reaction: import('@livediagram/document').Reaction) => void;
  // Laser Panel (docs/specs/008-canvas/laser-panel.md): the pen, owned by useLaserConfig in Canvas (it
  // persists per browser, like the avatar's costume) and edited down here.
  laserConfig?: import('@/lib/laser-config').LaserConfig;
  onChangeLaserField?: <K extends keyof import('@/lib/laser-config').LaserConfig>(
    field: K,
    value: import('@/lib/laser-config').LaserConfig[K],
  ) => void;
  laserPanelPosition?: { x: number; y: number } | null;
  onMoveLaserPanel?: (x: number, y: number) => void;
  onResetLaserPanel?: () => void;
  // Spotlight Panel (docs/specs/008-canvas/spotlight-panel.md): the light's look, owned by useSpotlightConfig
  // in Canvas, plus the live radius the canvas clicks also change.
  spotlightConfig?: import('@/lib/spotlight-config').SpotlightConfig;
  onChangeSpotlightField?: <K extends keyof import('@/lib/spotlight-config').SpotlightConfig>(
    field: K,
    value: import('@/lib/spotlight-config').SpotlightConfig[K],
  ) => void;
  spotlightRadius?: number;
  onSetSpotlightRadius?: (radius: number) => void;
  spotlightPanelPosition?: { x: number; y: number } | null;
  onMoveSpotlightPanel?: (x: number, y: number) => void;
  onResetSpotlightPanel?: () => void;
  // Eraser Panel (docs/specs/008-canvas/eraser-panel.md): the brush's settings, owned by useEraserConfig in
  // Canvas (the erase gesture reads it too).
  eraserConfig?: import('@/lib/eraser-config').EraserConfig;
  onChangeEraserField?: <K extends keyof import('@/lib/eraser-config').EraserConfig>(
    field: K,
    value: import('@/lib/eraser-config').EraserConfig[K],
  ) => void;
  eraserPanelPosition?: { x: number; y: number } | null;
  onMoveEraserPanel?: (x: number, y: number) => void;
  onResetEraserPanel?: () => void;
  // Slide Deck panel (docs/specs/012-collaboration/presentation-mode.md): the sixth tool panel.
  slideDeckPanelPosition?: { x: number; y: number } | null;
  onMoveSlideDeckPanel?: (x: number, y: number) => void;
  onResetSlideDeckPanel?: () => void;
  slideDeck?: import('@/app/document/[id]/useSlideDeck').SlideDeckState;
  // Format Panel (docs/specs/008-canvas/format-panel.md): what the painter copies, owned in editor state
  // (the paint lives there), plus a description of the loaded element.
  formatConfig?: import('@/lib/format-config').FormatConfig;
  onToggleFormatGroup?: (group: import('@/lib/format-config').FormatGroup) => void;
  onSetFormatMode?: (mode: import('@/lib/format-config').FormatMode) => void;
  formatBrushSource?: {
    name: string;
    fill?: string;
    stroke?: string;
    textColor?: string;
  } | null;
  formatPanelPosition?: { x: number; y: number } | null;
  onMoveFormatPanel?: (x: number, y: number) => void;
  onResetFormatPanel?: () => void;
};

export type CanvasChromeProps = CanvasProps & ChromeExtras;

// Per-corner stack container classes (docs/specs/007-editor/panel-docking.md). Each is an absolute,
// pointer-inert flex column pinned to one corner of the dock layer
// (inset 16px = the `*-4` resting inset). Top corners stack downward,
// bottom corners upward (flex-col-reverse) so the first panel always
// sits flush to the corner and the rest flow away from it.
// When the Toolbar strip reaches the top corners (always on a phone, docs/specs/007-editor/toolbar-layout.md
// "On a phone"; on a desktop window too narrow for a centred strip to clear a
// docked panel, stripCrowdsTopCorners) the TOP corner stacks start below it
// rather than at the 16px inset, or a panel docked there (the Collaborate
// banner) renders underneath the strip where it can't be reached. The strip
// sits 12px down (top-3) and is 46px tall; 68px leaves a 10px gap. The strip
// is drawn at the UI scale (docs/specs/007-editor/ui-scale.md), so only its
// height scales.
const toolbarTopClearancePx = (scale: number) => 12 + 46 * scale + 10;

const DOCK_CORNER_CLASS: Record<PanelCorner, string> = {
  'top-left': 'left-4 top-4 flex-col items-start',
  'top-right': 'right-4 top-4 flex-col items-end',
  'bottom-left': 'left-4 bottom-4 flex-col-reverse items-start',
  // bottom-right omits `bottom-4`; its bottom is set inline to clear the
  // fixed zoom controls (cornerBottomInset), so panels docked there sit
  // above the zoom bar instead of overlapping it.
  'bottom-right': 'right-4 flex-col-reverse items-end',
};

// The chrome layer of the canvas: empty-state prompt, template picker,
// multi-select toolbar, mode banners, the menu button and Explorer, the
// corner panels, the palette strip, and the zoom / undo cluster. Extracted from Canvas.tsx verbatim; consumes
// Canvas's props plus the computed ChromeExtras.

export function CanvasChrome(props: CanvasChromeProps) {
  const {
    activeDockPanel,
    canRedo,
    canUndo,
    canvasTool,
    documentName,
    drawDrag,
    drawHover,
    stamp,
    elements,
    handleDockButtonClick,
    handleSetZoom,
    handleZoomIn,
    handleZoomOut,
    marquee,
    commentRows,
    actionRows,
    onOpenCanvasTheme,
    onChooseTemplate,
    offscreenContent,
    onFitToScreen,
    onRedo,
    onIsoOrbit,
    onIsoReset,
    onSkipTemplatePicker,
    onUndo,
    pendingDraw,
    penPoints,
    polygonVertices,
    polygonCursor,
    readOnly,
    selfParticipant,
    settings,
    snapGuides,
    distGuides,
    snapTargets,
    showTemplatePicker,
    tabThemeId,
    templatePickerLockedName,
    templatePickerMode,
    welcomeOpen,
    wrapperRef,
    zenMode,
    onToggleZen,
  } = props;
  // The view is not a prop here: the parts that show it read it from the viewport store, so a pan or
  // zoom renders them and not this chrome or its panels (docs/specs/008-canvas/blueprints/viewport-store.md).
  const viewport = useViewportStore();
  const readZoom = useCallback(() => viewport.get().zoom, [viewport]);
  // Zen / focus mode (docs/specs/007-editor/zen-mode.md): hide all floating chrome. `chromeHidden`
  // folds it in next to the welcome-flow gate that already suppresses
  // the same panels, so each panel stays hidden in either state.
  const chromeHidden = welcomeOpen || zenMode === true;
  // Panels turned off in Settings (docs/specs/007-editor/user-preferences.md) take their cluster
  // buttons with them (Undo / Redo stay). Read once here and handed to
  // useCanvasChromePanels, so a button and its panel share one value.
  const panelsOn = {
    // Not in Illustrate mode: a page is laid out by its pages, not layers
    // (docs/specs/007-editor/illustrate-pages.md). Not in Plan mode either: a board is worked by its
    // columns and cards, not a stacking order (docs/specs/026-plan/plan-mode.md).
    layers:
      panelEnabled(settings, 'layersPanelEnabled') &&
      !props.illustratePages &&
      props.editorMode !== 'plan',
    collaborate: panelEnabled(settings, 'collaboratePanelEnabled'),
  };

  // --- Corner docking (docs/specs/007-editor/panel-docking.md) — see useCornerDocking. ---
  const { isMobile, dock, dockLayerRef, cornerRefs, dockingActive, panelWiringFor } =
    useCornerDocking({ zenMode: zenMode === true });
  // Alignment guides while a palette tile is being dragged in (docs/specs/021-event-storming/event-storming.md):
  // the same faint lines a move shows, BEFORE the element exists. The hook
  // also publishes the snap the ghost + drop read, so all three agree.
  //
  // On an event-storming board, while Alt is held, it additionally offers to
  // INSERT the note between two others (docs/specs/021-event-storming/event-storming.md): the board is a
  // left-to-right timeline, so making room in the middle is the board's most
  // common edit. Never offered where the drop would be refused anyway
  // (read-only, locked tab, blocked active layer), so the preview can't
  // promise something it can't keep.
  const paletteDrag = usePaletteDragGuides({
    elements,
    readZoom,
    wrapperRef,
    insertGate: {
      esBoard: props.esBoard === true,
      readOnly,
      tabLocked: props.tabLocked,
      createBlocked: props.createBlocked === true,
    },
    inertIds: props.layerInertIds,
    // Every event-storming board is on lanes; the stack is derived from the
    // board itself, so there is nothing to gate beyond "is this that board".
    timeline: props.esBoard === true ? ES_LANES : null,
  });
  // A tick as a move catches an alignment guide (Android; lib/haptics).
  useSnapHaptic(snapGuides.length > 0);
  const { alignGuides, allSnapTargets } = computeDrawGuides({
    // A stamp is placed by the lanes, not sized against edges: no box guides.
    drawDrag: stamp ? null : drawDrag,
    pendingDraw,
    elements,
    drawHover,
    penPoints,
    snapGuides,
    snapTargets,
    whiteboard: props.editorMode === 'draw',
  });

  // Draw mode trades the palette, the strip and the theme controls for its
  // dock (docs/specs/023-draw-mode/draw-mode.md "What a whiteboard shows").
  const whiteboard = props.editorMode === 'draw';
  // The palette's Edit Cards opens the Card Types popover from its button (docs/specs/026-plan/item-types.md).
  const cardTypesButtonRef = useCardTypesOpener(!zenMode && props.editorMode === 'plan', {
    activeDockPanel,
    handleDockButtonClick,
  });
  // The palette strip: an editor's (not read-only), never on a whiteboard, which has its dock; or a Participant's
  // (docs/specs/013-workspace/share-roles.md), on every mode, since it has no dock.
  const paletteShown = (!readOnly && !whiteboard) || !!props.participantPalette;
  // The strip only renders with the chrome up.
  const stripShown = paletteShown && !chromeHidden;
  // The whiteboard's dock, absent for a view-role visitor (nothing to draw with) and while the
  // chrome is away; at the top unless the user chose the bottom (docs/specs/023-draw-mode/draw-mode.md
  // "Where the dock sits").
  const dockShown = whiteboard && !!props.whiteboardDock && !readOnly && !chromeHidden;
  const dockOnTop = dockShown && props.whiteboardDock?.position === 'top';
  // The Explorer menu button: top-left on desktop; on a phone, its own card at
  // the left of the strip's row, the strip beside it (no room for a corner card
  // above a strip that needs the whole top row). A read-only visitor has no
  // strip, and nor does a whiteboard, so it keeps the corner there.
  const menuInStrip = isMobile && paletteShown;
  const explorerMenuButton = props.explorerHidden ? null : (
    <ToolbarExplorerButton
      open={activeDockPanel === 'explorer'}
      onToggle={(button) => handleDockButtonClick('explorer', button)}
      inline={menuInStrip}
    />
  );

  // Whether the tab has a Plan board, for an armed Plan card's hint (docs/specs/026-plan/plan-mode.md).
  const hasPlanBoard = useMemo(
    () => elements.some((e) => e.type === 'shape' && e.shape === 'plan-board'),
    [elements],
  );
  // The card types the tab's boards take, so the palette greys out a card tile none would take (plan-mode.md).
  usePublishCardTypesTaken(elements);
  // Panel elements + their wiring live in useCanvasChromePanels.
  const {
    panelEls,
    explorerEl,
    layersEl,
    collaborateEl,
    slidesPopoverEl,
    cardTypesPopoverEl,
    trashPopoverEl,
    newCardPopoverEl,
    cardFinderPopoverEl,
    paletteTint,
  } = useCanvasChromePanels({
    props,
    chromeHidden,
    isMobile,
    panelWiringFor,
    panelsOn,
  });

  // Measured against the real top-corner stacks (useStripCrowdsCorners). A
  // stack only renders while it holds a panel, so which top corners are
  // occupied is part of what re-measures. A phone's strip always spans the top.
  const topCornersKey = (['top-left', 'top-right'] as const)
    .map((c) => dock.cornerStacks[c].filter((id) => panelEls[id] != null).join('+'))
    .join('|');
  // UI scale (docs/specs/007-editor/ui-scale.md): the strip, the panels and the
  // bottom-right cluster are drawn at it, so the clearances around them follow.
  const toolbarScale = useUiScale('toolbar');
  const panelScale = useUiScale('panels');
  const cornerScale = useUiScale('cornerButtons');
  // The bar across the top that the top corners give way to: the strip, or a dock at the top.
  const topBar = isMobile
    ? null
    : stripShown
      ? STRIP_SELECTOR
      : dockOnTop
        ? WHITEBOARD_DOCK_SELECTOR
        : null;
  const topBarCrowds = useStripCrowdsCorners(
    cornerRefs,
    topBar,
    topCornersKey,
    `${toolbarScale}/${panelScale}`,
  );
  const stripSpansTop = stripShown && (isMobile || topBarCrowds);
  const dockSpansTop = dockOnTop && topBarCrowds;
  // Bucketing keys off the persisted placement ONLY (not which panel is
  // mid-drag): a dragged panel must stay in the same DOM parent for the
  // whole gesture — reparenting it would remount the component and drop
  // the in-flight drag. While lifted it just renders `position: absolute`
  // in place (MovablePanel), and its corner siblings reflow into the gap.
  // The persisted corner/free placement only changes on pointer-up.
  const freePanelIds = PANEL_IDS.filter(
    (id) => panelEls[id] != null && dock.placementOf(id).mode === 'free',
  );
  const snapCorner = dock.drag?.candidate ?? null;
  const snapHeight = dock.drag?.height ?? 0;
  const dockedLayer = dockingActive ? (
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
            style={
              corner === 'bottom-right'
                ? { bottom: cornerBottomInset(corner, cornerScale) }
                : // The Draw dock is the strip's twin (its height, its scale), so the same clearance.
                  (stripSpansTop || dockSpansTop) && corner.startsWith('top')
                  ? { top: toolbarTopClearancePx(toolbarScale) }
                  : undefined
            }
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
  ) : null;

  return (
    <>
      {/* The empty-canvas hint is now a dismissible bottom banner
          (EmptyCanvasBanner), rendered by EditorView alongside the sign-in /
          theme banners rather than a centre-of-canvas card. */}

      {showTemplatePicker ? (
        <TemplatePicker
          mode={templatePickerMode}
          participant={selfParticipant}
          currentThemeId={tabThemeId}
          documentName={documentName}
          lockedName={templatePickerLockedName}
          onPick={onChooseTemplate}
          onSkip={onSkipTemplatePicker}
        />
      ) : null}

      {/* Timeline lanes (docs/specs/021-event-storming/event-storming.md Phase 6): the lane a dragged note is
          landing on, lit for the duration of the drag. Beside the guide
          overlay because it is the same kind of thing — help BEFORE the
          drop — and it publishes through its own store, so it costs nothing
          on every other tab. */}
      <TimelineLanesOverlay
        timeline={props.esBoard === true ? ES_LANES : null}
        tabThemeId={tabThemeId}
        wrapperRef={wrapperRef}
        mainSize={props.mainSize}
      />

      <CanvasGuideOverlay
        alignGuides={paletteDrag.guides.length > 0 ? paletteDrag.guides : alignGuides}
        allSnapTargets={allSnapTargets}
        distGuides={paletteDrag.distGuides.length > 0 ? paletteDrag.distGuides : distGuides}
        drawHover={drawHover}
        marquee={marquee}
        tabThemeId={tabThemeId}
        wrapperRef={wrapperRef}
        mainSize={props.mainSize}
      />

      <CanvasDrawPreview
        drawDrag={drawDrag}
        penPoints={penPoints}
        polygonVertices={polygonVertices}
        polygonCursor={polygonCursor}
        pendingDraw={pendingDraw}
        stamp={stamp}
        whiteboardInk={whiteboard ? props.whiteboardInk : undefined}
        mirrorPages={
          props.illustratePages
            ? mirroredLogoPages(props.illustratePages.pages, props.illustratePages.logo)
            : null
        }
        wrapperRef={wrapperRef}
        mainSize={props.mainSize}
      />

      {/* Top-of-canvas floating chrome (docs/specs/008-canvas/canvas-and-palette.md): owner / role badge, the
          active editor-mode banner, multi-selection toolbar, session timer
          and vote banner — laid out as one non-overlapping stack. */}
      <TopCenterChrome {...props} dockOnTop={dockOnTop} hasPlanBoard={hasPlanBoard} />

      {/* The menu button (docs/specs/007-editor/toolbar-layout.md) opens the Explorer as a popover
          (zen hides it, the welcome flow doesn't), and Layers opens as a popover over its cluster
          button. */}
      {!zenMode ? (
        <>
          {menuInStrip ? null : explorerMenuButton}
          {explorerEl}
          {layersEl}
        </>
      ) : null}
      {/* The Collaborate popover (docs/specs/012-collaboration/assigned-actions.md §5): it positions
          against the canvas, so it renders outside the corner layer, as Layers does. */}
      {zenMode ? null : collaborateEl}
      {zenMode ? null : slidesPopoverEl}
      {zenMode ? null : cardTypesPopoverEl}
      {zenMode ? null : trashPopoverEl}
      {zenMode ? null : newCardPopoverEl}
      {zenMode ? null : cardFinderPopoverEl}
      {paletteShown ? (
        <ToolbarPalette
          key={`${props.esBoard ? 'es-board' : 'standard'}${readOnly ? '-participant' : ''}`}
          participant={readOnly}
          // Hidden, not unmounted, while the chrome is away (zen, welcome),
          // so the chosen category lasts the page load.
          hidden={chromeHidden}
          canvasTool={canvasTool}
          onSetCanvasTool={props.onSetCanvasTool}
          onExitAvatarMode={props.onExitAvatarMode}
          onToggleZen={onToggleZen}
          canvasEmpty={elements.length === 0}
          {...pickPaletteAddHandlers(props)}
          pendingDraw={pendingDraw}
          esBoard={props.esBoard}
          esBoardControls={props.esBoardControls}
          logoPages={!!props.illustratePages?.pages.some((p) => p.kind === 'logo')}
          themeTint={paletteTint}
          leading={menuInStrip ? explorerMenuButton : undefined}
          onAddPage={readOnly ? undefined : props.illustratePages?.edit?.addPage}
          tabElements={elements}
        />
      ) : null}

      {/* The whiteboard's dock (docs/specs/023-draw-mode/draw-mode.md): top or bottom centre, in place
          of the palette. */}
      {dockShown && props.whiteboardDock ? (
        <WhiteboardDock model={props.whiteboardDock} ink={props.whiteboardInk ?? '#1c1917'} />
      ) : null}

      {/* Corner panels (docs/specs/007-editor/panel-docking.md). Distributed into per-corner stack
          containers (with a free layer + snap guides) by `dockedLayer`; in zen they render inline.
          Each element carries its own visibility gate, so the welcome-flow / read-only / zen
          suppression is unchanged. */}
      {dockingActive ? (
        dockedLayer
      ) : (
        <>
          {panelEls.collaborate}
          {panelEls.ai}
          {panelEls.minimap}
          {panelEls.poll}
          {panelEls.vote}
          {panelEls.avatar}
          {panelEls.laser}
          {panelEls.spotlight}
          {panelEls.eraser}
          {panelEls.format}
          {panelEls['slide-deck']}
        </>
      )}

      {/* Bottom-right cluster. Order, left to right: the Undo / Redo
          strip, the Layers button, the Collaborate button (only while the tab
          has a thread or an action), the Theme & Canvas paintbrush, then the
          Zoom controls. Layers and Collaborate open as popovers above their buttons
          (docs/specs/007-editor/live-app.md). */}
      <div
        // Presenting hides this cluster (docs/specs/012-collaboration/presentation-mode.md): zen keeps the zoom controls
        // as its one way back out, and a deck has its own way out plus no
        // zoom to offer.
        data-zoom-cluster=""
        // Drawn at the UI scale, still 16px from the corner, or clear of a landscape notch.
        style={
          cornerScale === 1
            ? { right: atLeastInset('1rem', 'right') }
            : {
                ...uiScaleStyle(cornerScale),
                right: atLeastInset(`${toSurfacePx(16, cornerScale)}px`, 'right'),
                bottom: toSurfacePx(16, cornerScale),
              }
        }
        className={`pointer-events-none absolute bottom-4 right-4 z-[var(--z-panel)] flex items-center gap-2 ${PHONE_TOOLBAR_ITEMS}`}
      >
        {welcomeOpen ? null : (
          <>
            {offscreenContent ? <OffscreenContentHint onBringBack={onFitToScreen} /> : null}
            {/* Undo / Redo: see UndoRedoClusterStrip. A Participant undoes its own changes too
                (docs/specs/013-workspace/share-roles.md). */}
            {!zenMode && (!readOnly || !!props.participantPalette) ? (
              <UndoRedoClusterStrip
                onUndo={onUndo}
                onRedo={onRedo}
                canUndo={canUndo}
                canRedo={canRedo}
              />
            ) : null}
            {/* Slides (docs/specs/007-editor/illustrate-pages.md "Slides"): in Illustrate mode, where
                Layers would be, the deck one press away. */}
            {/* Desktop only, as the Slide Deck itself is; an Editor's, since building and presenting a deck
                runs the session (docs/specs/013-workspace/share-roles.md). */}
            {!zenMode && !isMobile && !readOnly && props.illustratePages && props.slideDeck ? (
              <SlidesClusterButton
                popoverOpen={activeDockPanel === 'slides'}
                onTogglePopover={(button) => handleDockButtonClick('slides', button, true)}
              />
            ) : null}
            {/* Find a Card and Card Types (docs/specs/026-plan/items.md "Finding a card", item-types.md): in Plan
                mode, one strip where Layers would be. */}
            {!zenMode && props.editorMode === 'plan' ? (
              <PlanCardsClusterStrip
                finderOpen={activeDockPanel === 'plan-cards'}
                onToggleFinder={(button) => handleDockButtonClick('plan-cards', button, true)}
                typesOpen={activeDockPanel === 'card-types'}
                onToggleTypes={(button) => handleDockButtonClick('card-types', button, true)}
                typesButtonRef={cardTypesButtonRef}
                // The Trash leads the strip, off a phone and for an editor (docs/specs/026-plan/items.md "Trash").
                // A Participant adds cards too (docs/specs/013-workspace/share-roles.md); the Trash stays an Editor's.
                newCard={
                  !readOnly || !!props.participantPalette
                    ? {
                        open: activeDockPanel === 'plan-new-card',
                        onToggle: (button) => handleDockButtonClick('plan-new-card', button, true),
                      }
                    : undefined
                }
                trash={
                  !readOnly && !isMobile
                    ? {
                        open: activeDockPanel === 'plan-trash',
                        onToggle: (button) => handleDockButtonClick('plan-trash', button, true),
                      }
                    : undefined
                }
              />
            ) : null}
            {/* Layers (docs/specs/006-document/layers.md): see LayersClusterButton. */}
            {!zenMode && !readOnly && panelsOn.layers ? (
              <LayersClusterButton
                popoverOpen={activeDockPanel === 'layers'}
                onTogglePopover={(button) => handleDockButtonClick('layers', button, true)}
              />
            ) : null}
            {/* Collaborate (docs/specs/012-collaboration/assigned-actions.md §5): right after Layers, only while
                the tab has a comment thread or an action. A view-role visitor
                gets it too: they read threads and answer them. */}
            {!zenMode &&
            panelsOn.collaborate &&
            (commentRows.length > 0 || actionRows.length > 0) ? (
              <CollaborateClusterButton
                openCount={kindCounts('open', commentRows, actionRows).all}
                popoverOpen={activeDockPanel === 'collaborate'}
                onTogglePopover={(button) => handleDockButtonClick('collaborate', button, true)}
              />
            ) : null}
            {/* Theme & Canvas dock button (docs/specs/011-theme/canvas-and-theme-dialog.md): the paintbrush right of
                the Layers dock opens the CanvasThemeDialog. It is the one
                entry point: the canvas and tab menus no longer carry the
                theme and canvas controls. All viewports, mobile included
                (read-only sessions pass no handler). */}
            {!zenMode && onOpenCanvasTheme && !whiteboard ? (
              <div
                data-tour-id="canvas-theme"
                onContextMenu={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                className={CLUSTER_STRIP}
              >
                <HoverCard
                  title="Theme & canvas"
                  description="Change this tab's theme and canvas background."
                >
                  <button
                    type="button"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={onOpenCanvasTheme}
                    aria-label="Theme and canvas"
                    className="flex h-11 w-11 items-center justify-center text-slate-600 transition hover:bg-slate-50 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
                  >
                    <ThemeBrushIcon />
                  </button>
                </HoverCard>
              </div>
            ) : null}
            <ViewZoomControls
              onZoomIn={handleZoomIn}
              onZoomOut={handleZoomOut}
              onSetZoom={handleSetZoom}
              onFitToScreen={onFitToScreen}
              onIsoOrbit={canvasTool === 'isometric' ? onIsoOrbit : undefined}
              onIsoReset={canvasTool === 'isometric' ? onIsoReset : undefined}
              onToggleZen={onToggleZen}
              zenActive={zenMode}
              // View-only visitors have no palette (so no canvas-tool
              // dropdown); the dock keeps the enter button for them.
              zenEnterHere={readOnly}
              pinchOnly={isMobile}
            />
          </>
        )}
      </div>
    </>
  );
}
