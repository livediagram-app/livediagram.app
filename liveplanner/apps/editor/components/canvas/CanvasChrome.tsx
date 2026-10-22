import { useViewportStore } from '@/hooks/canvas/useViewportStore';
import { ViewZoomControls } from '@/components/canvas/view-readers';
import { votesSpentBy } from '@liveplanner/project';
import { participantKey } from '@/lib/identity';
import { useVoteReviewOpener } from '@/hooks/canvas/useVoteReviewOpener';
import { computeDrawGuides } from '@/components/canvas/canvas-draw-guides';
import { CanvasGuideOverlay } from '@/components/canvas/CanvasGuideOverlay';
import { CanvasDrawPreview } from '@/components/canvas/CanvasDrawPreview';
import { TopCenterChrome } from '@/components/chrome/TopCenterChrome';
// Lazy-load the visitor name prompt the same way ExportTabDialog + ShareDialog already are. It is gated on
// `showIdentityPrompt`, false on the common path (the owner opening their own project); for a visitor the empty
// canvas underneath has already rendered, so the prompt fades in a frame later rather than blocking the route on its JS.
import dynamic from 'next/dynamic';
const IdentityPrompt = dynamic(
  () => import('@/components/palette/IdentityPrompt').then((m) => m.IdentityPrompt),
  { ssr: false },
);

import { OffscreenContentHint } from '@/components/canvas/OffscreenContentHint';
import { ToolbarExplorerButton } from '@/components/chrome/ToolbarExplorerButton';
import { PlanCardsClusterStrip } from '@/components/canvas/PlanCardsClusterStrip';
import { useTabShowsCards } from '@/hooks/sheets/card-table-sheets';
import {
  SessionClusterStrip,
  sessionStripTools,
  stripCanStart,
} from '@/components/canvas/SessionClusterStrip';
import { useCardTypesOpener } from '@/hooks/plan/useCardTypesOpener';
import { usePublishCardTypesTaken } from '@/hooks/plan/card-types-taken';
import { usePlanVoting } from '@/hooks/plan/usePlanVoting';
import { useCanvasCovered, usePlanTabKind } from '@/hooks/plan/plan-cover-store';

// How far the bottom-right cluster moves in and up over a covering board or Sheet: the cover's padding (12 px) and a
// little more in, and past the element's bottom scrollbar up.
const COVERED_CLUSTER_INSET = { x: 16, y: 20 };
const NO_CLUSTER_INSET = { x: 0, y: 0 };
import { LayersThemeStrip } from '@/components/canvas/LayersThemeStrip';
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
import { atLeastInset } from '@liveplanner/ui';
import { PHONE_TOOLBAR_ITEMS } from '@/components/chrome/phone-toolbar-items';
import { PHONE_CLUSTER_BUTTON_WIDTH } from '@/components/chrome/phone-toolbar-items';
import { useSnapHaptic } from '@/hooks/canvas/useSnapHaptic';
import { CollaborateClusterButton } from './CollaborateClusterButton';
import { kindCounts } from '@/components/panels/collaborate/collaborate-model';
import { panelEnabled } from '@/lib/user-preferences';
import { useUiScale } from '@/components/providers/ui-scale';
import { toSurfacePx, uiScaleStyle } from '@/lib/ui-scale';
import { useSnapGuides } from '@/hooks/canvas/useSnapGuideState';

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
  // Format Panel (docs/specs/008-canvas/format-panel.md): what the painter copies, owned in editor state
  // (the paint lives there), plus a description of the loaded element.
  formatConfig?: import('@/lib/format-config').FormatConfig;
  onToggleFormatGroup?: (group: import('@/lib/format-config').FormatGroup) => void;
  onSetFormatMode?: (mode: import('@/lib/format-config').FormatMode) => void;
  formatBrushSource?: import('@/components/panels/FormatPanel').FormatBrushSource | null;
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
    projectName,
    drawDrag,
    drawHover,
    elements,
    handleDockButtonClick,
    handleSetZoom,
    handleZoomIn,
    handleZoomOut,
    marquee,
    commentRows,
    actionRows,
    onOpenCanvasTheme,
    onConfirmIdentity,
    offscreenContent,
    onFitToScreen,
    onRedo,
    onIsoOrbit,
    onIsoReset,
    onCancelIdentity,
    onUndo,
    pendingDraw,
    polygonVertices,
    polygonCursor,
    readOnly,
    selfParticipant,
    settings,
    snapGuideStore,
    showIdentityPrompt,
    tabThemeId,
    identityLockedName,
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
    collaborate: panelEnabled(settings, 'collaboratePanelEnabled'),
  };

  // --- Corner docking (docs/specs/007-editor/panel-docking.md) — see useCornerDocking. ---
  const { isMobile, dock, dockLayerRef, cornerRefs, dockingActive, panelWiringFor } =
    useCornerDocking({ zenMode: zenMode === true });
  // Alignment guides while a palette tile is being dragged in (docs/specs/010-palette/palette-drag-ghost.md):
  // the same faint lines a move shows, BEFORE the element exists. The hook
  // also publishes the snap the ghost + drop read, so all three agree.
  const paletteDrag = usePaletteDragGuides({ elements, readZoom, wrapperRef });
  // The drag's snap guides, from the editor's store: a new set renders this chrome only.
  const { snapGuides, distGuides, snapTargets } = useSnapGuides(snapGuideStore);
  // A tick as a move catches an alignment guide (Android; lib/haptics).
  useSnapHaptic(snapGuides.length > 0);
  const { alignGuides, allSnapTargets } = computeDrawGuides({
    drawDrag,
    pendingDraw,
    elements,
    drawHover,
    snapGuides,
    snapTargets,
  });

  // The palette's Edit Cards opens the Card Types popover from its button (docs/specs/026-plan/item-types.md).
  const cardTypesButtonRef = useCardTypesOpener(!zenMode, {
    activeDockPanel,
    handleDockButtonClick,
  });
  // The Vote button, which a starting results walkthrough opens for whoever drives it.
  const voteButtonRef = useVoteReviewOpener(!!props.voteReview?.canControl, {
    activeDockPanel,
    handleDockButtonClick,
  });
  // No palette (docs/specs/026-plan/plan-mode.md "No palette"): a board, sheet or dashboard carries its own tools.
  // The Explorer menu button keeps its corner, top-left.
  const explorerMenuButton = props.explorerHidden ? null : (
    <ToolbarExplorerButton
      open={activeDockPanel === 'explorer'}
      onToggle={(button) => handleDockButtonClick('explorer', button)}
    />
  );

  // Whether the tab has a Plan board, for an armed Plan card's hint (docs/specs/026-plan/plan-mode.md).
  const hasPlanBoard = useMemo(
    () => elements.some((e) => e.type === 'shape' && e.shape === 'plan-board'),
    [elements],
  );
  // A board or Sheet covering the canvas (maximised or filling its tab, not a Dashboard's page): the bottom-right
  // cluster moves inside its frame.
  const canvasCovered = useCanvasCovered();
  const tabPlanKind = usePlanTabKind();
  // A Dashboard's or a Form tab's page covers the canvas as a page, not an element.
  const elementCovers = canvasCovered && tabPlanKind !== 'dashboard' && tabPlanKind !== 'form';
  const clusterInset = elementCovers ? COVERED_CLUSTER_INSET : NO_CLUSTER_INSET;
  // Plan's Timer and Vote, only for a board made for voting (or a session running), never on a Dashboard.
  const planVoting = usePlanVoting(elements, !!props.tabVote || !!props.sessionTools?.timer);
  const stripTools = sessionStripTools(planVoting);
  // Plan's card strip shows only while the tab has something that shows cards (items.md "The Plan strip").
  const tabShowsCards = useTabShowsCards(elements);
  // The card types the tab's boards take, so the palette greys out a card tile none would take (plan-mode.md).
  usePublishCardTypesTaken(elements);
  // Panel elements + their wiring live in useCanvasChromePanels.
  const {
    panelEls,
    explorerEl,
    collaborateEl,
    cardTypesPopoverEl,
    trashPopoverEl,
    newCardPopoverEl,
    cardFinderPopoverEl,
    sessionPopoverEl,
  } = useCanvasChromePanels({
    props,
    stripTools,
    chromeHidden,
    isMobile,
    panelWiringFor,
    panelsOn,
  });

  // UI scale (docs/specs/007-editor/ui-scale.md): the bottom-right cluster is drawn at it, so the clearances around
  // it follow.
  const cornerScale = useUiScale('cornerButtons');
  const clusterX = clusterInset.x;
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
            style={{
              ...(corner === 'bottom-right'
                ? { bottom: cornerBottomInset(corner, cornerScale) }
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
  ) : null;

  return (
    <>
      {/* The empty-canvas hint is now a dismissible bottom banner
        (EmptyCanvasBanner), rendered by EditorView alongside the sign-in /
        theme banners rather than a centre-of-canvas card. */}

      {showIdentityPrompt ? (
        <IdentityPrompt
          participant={selfParticipant}
          projectName={projectName}
          lockedName={identityLockedName}
          onJoin={onConfirmIdentity}
          onCancel={onCancelIdentity}
        />
      ) : null}

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
        polygonVertices={polygonVertices}
        polygonCursor={polygonCursor}
        pendingDraw={pendingDraw}
        wrapperRef={wrapperRef}
        mainSize={props.mainSize}
      />

      {/* Top-of-canvas floating chrome (docs/specs/008-canvas/canvas-and-palette.md): owner / role badge, the
        active editor-mode banner, multi-selection toolbar, session timer
        and vote banner — laid out as one non-overlapping stack. */}
      <TopCenterChrome {...props} hasPlanBoard={hasPlanBoard} />

      {/* The menu button (docs/specs/007-editor/toolbar-layout.md) opens the Explorer as a popover
        (zen hides it, the welcome flow doesn't). */}
      {!zenMode ? (
        <>
          {explorerMenuButton}
          {explorerEl}
        </>
      ) : null}
      {/* The Collaborate popover (docs/specs/012-collaboration/assigned-actions.md §5): it positions
        against the canvas, so it renders outside the corner layer. */}
      {zenMode ? null : collaborateEl}
      {zenMode ? null : cardTypesPopoverEl}
      {zenMode ? null : trashPopoverEl}
      {zenMode ? null : newCardPopoverEl}
      {zenMode ? null : cardFinderPopoverEl}
      {/* The Session strip's popover, in Zen too, as its strip is (docs/specs/012-collaboration/session-tools.md). */}
      {sessionPopoverEl}

      {/* Corner panels (docs/specs/007-editor/panel-docking.md). Distributed into per-corner stack
        containers (with a free layer + snap guides) by `dockedLayer`; in zen they render inline.
        Each element carries its own visibility gate, so the welcome-flow / read-only / zen
        suppression is unchanged. */}
      {dockingActive ? (
        dockedLayer
      ) : (
        <>
          {panelEls.collaborate}
          {panelEls.minimap}
          {panelEls.format}
        </>
      )}

      {/* Bottom-right cluster. Order, left to right: the Undo / Redo
        strip, the Session strip (Timer, Vote), the mode's own strip (Contents, Plan), the
        Collaborate button (only while the tab has a thread or an action), the Layers and
        Theme & Canvas strip, then the Zoom controls. The buttons open their panels as popovers
        above them (docs/specs/007-editor/editor-app.md). */}
      <div
        // Zen keeps the zoom controls as its one way back out.
        data-zoom-cluster=""
        data-region="controls"
        // Drawn at the UI scale, still 16px from the corner, or clear of a landscape notch.
        // Over a maximised or tab-filling board or Sheet it sits inside the element's frame, clear of its edge and its
        // scrollbar: in by the cover's padding and up past the scrollbar (docs/specs/026-plan/plan-board.md "Maximised
        // board").
        style={
          cornerScale === 1
            ? {
                right: atLeastInset(`${16 + clusterX}px`, 'right'),
                ...(clusterInset.y ? { bottom: 16 + clusterInset.y } : {}),
              }
            : {
                ...uiScaleStyle(cornerScale),
                right: atLeastInset(`${toSurfacePx(16 + clusterX, cornerScale)}px`, 'right'),
                bottom: toSurfacePx(16 + clusterInset.y, cornerScale),
              }
        }
        // On a phone the cluster stays one row (docs/specs/012-collaboration/session-tools.md "The Session
        // strip"): its buttons share the width there is, PHONE_CLUSTER_BUTTON_WIDTH, from 36px up to their
        // usual 44px (always 44px tall to tap), so Undo, the Session strip, Layers and Theme and Fit fill the
        // row on a 360px screen and up. It may still wrap, from the right, on a narrower one, so Undo is never
        // pushed off the screen.
        className={`pointer-events-none absolute bottom-4 right-4 z-[var(--z-panel)] flex items-center gap-2 phone:left-4 phone:flex-wrap phone:justify-end phone:gap-1.5 ${PHONE_CLUSTER_BUTTON_WIDTH} ${PHONE_TOOLBAR_ITEMS}`}
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
            {/* The Session strip (docs/specs/012-collaboration/session-tools.md "The Session strip"): left of
              Layers, or of the mode's own strip. Kept in Zen: a running session is the one piece of
              chrome a facilitator still needs there: its Timer and Vote. */}
            {props.sessionTools && stripTools ? (
              <div className="contents">
                <SessionClusterStrip
                  timer={props.sessionTools.timer}
                  voteRunning={!!props.tabVote}
                  voteDotsLeft={
                    // A Participant votes too (docs/specs/013-workspace/share-roles.md), so it sees its dots left.
                    props.tabVote?.active && (!readOnly || props.takePart)
                      ? Math.max(
                          0,
                          props.tabVote.votesPerPerson -
                            votesSpentBy(props.tabVote, participantKey(selfParticipant)),
                        )
                      : null
                  }
                  voteReviewing={!!props.voteReview}
                  voteButtonRef={voteButtonRef}
                  canStart={stripCanStart(!!readOnly)}
                  offersTimer={stripTools.timer}
                  open={
                    activeDockPanel === 'session-timer' || activeDockPanel === 'session-vote'
                      ? activeDockPanel
                      : null
                  }
                  onToggle={(segment, button) => handleDockButtonClick(segment, button, true)}
                />
              </div>
            ) : null}
            {/* Find a Card and Card Types (docs/specs/026-plan/items.md "Finding a card", item-types.md): one strip,
              while the tab has something that shows cards ("The Plan strip"). */}
            {!zenMode && tabShowsCards ? (
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
            {/* Collaborate (docs/specs/012-collaboration/assigned-actions.md §5): before Layers, only while
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
            {/* Layers (docs/specs/006-project/layers.md) and the Theme & Canvas brush
              (docs/specs/011-theme/canvas-and-theme-dialog.md, its one entry point; read-only sessions
              pass no handler), one strip in every mode: see LayersThemeStrip. */}
            {!zenMode ? <LayersThemeStrip onOpenTheme={onOpenCanvasTheme} /> : null}
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
              // dropdown); the zoom controls keep the enter button for them.
              zenEnterHere={readOnly}
              pinchOnly={isMobile}
            />
          </>
        )}
      </div>
    </>
  );
}
