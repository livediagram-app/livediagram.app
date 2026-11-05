import { useViewportStore } from '@liveworkspace/workbench/hooks/canvas/useViewportStore';
import { ViewZoomControls } from '@/components/canvas/view-readers';

import { computeDrawGuides } from '@/components/canvas/canvas-draw-guides';
import { CanvasGuideOverlay } from '@/components/canvas/CanvasGuideOverlay';
import { CanvasDrawPreview } from '@/components/canvas/CanvasDrawPreview';
import { TopCenterChrome } from '@/components/chrome/TopCenterChrome';
// Lazy-load the visitor name prompt the same way ExportTabDialog + ShareDialog already are. It is gated on
// `showIdentityPrompt`, false on the common path (the owner opening their own document); for a visitor the empty
// canvas underneath has already rendered, so the prompt fades in a frame later rather than blocking the route on its JS.
import dynamic from 'next/dynamic';
const IdentityPrompt = dynamic(
  () => import('@/components/palette/IdentityPrompt').then((m) => m.IdentityPrompt),
  { ssr: false },
);

import { OffscreenContentHint } from '@liveworkspace/workbench/components/canvas/OffscreenContentHint';
import { ToolbarPalette } from '@/components/palette/ToolbarPalette';
import { pickPaletteAddHandlers } from '@/components/palette/palette-add-handlers';
import { ToolbarExplorerButton } from '@/components/chrome/ToolbarExplorerButton';
import { WorkbenchBackButton } from '@/components/chrome/WorkbenchChrome';
import {
  SessionClusterStrip,
  sessionStripTools,
  stripCanStart,
} from '@/components/canvas/SessionClusterStrip';
import { toolbarTopClearancePx } from '@/lib/canvas-chrome';
import { ThemeStrip } from '@/components/canvas/ThemeStrip';
import { tidyUpOffered } from '@/components/canvas/tidy-up-actions';
import { UndoRedoClusterStrip } from '@liveworkspace/workbench/components/canvas/UndoRedoClusterStrip';
import type { CanvasProps } from '@/components/canvas/Canvas.types';
import { Fragment, useCallback, type Dispatch, type RefObject, type SetStateAction } from 'react';
import type { DockAnchor, DockPanel } from '@/hooks/canvas/useDockPopovers';
import { useCornerDocking } from '@/hooks/ui/useCornerDocking';
import { PanelSnapSlot } from '@liveworkspace/workbench/components/canvas/PanelSnapSlot';
import { useCanvasChromePanels } from './useCanvasChromePanels';
import { usePaletteDragGuides } from '@/hooks/canvas/usePaletteDragGuides';
import { PANEL_CORNERS, PANEL_IDS, cornerBottomInset, type PanelCorner } from '@/lib/panel-layout';
import { atLeastInset } from '@livehuddle/ui';
import { STRIP_SELECTOR, useStripCrowdsCorners } from '@/hooks/ui/useStripCrowdsCorners';
import { PHONE_TOOLBAR_ITEMS } from '@/components/chrome/phone-toolbar-items';
import { PHONE_CLUSTER_BUTTON_WIDTH } from '@/components/chrome/phone-toolbar-items';
import { useSnapHaptic } from '@liveworkspace/workbench/hooks/canvas/useSnapHaptic';
import { CollaborateClusterButton } from '@liveworkspace/workbench/components/canvas/CollaborateClusterButton';
import { AvatarClusterButton } from '@liveworkspace/avatar/components/AvatarClusterButton';
import { WalkClusterButton } from '@liveworkspace/avatar/components/WalkClusterButton';
import { AvatarModeIcon } from '@/components/palette/palette-icons';
import { walkButtonShown } from '@/lib/walk-button';
import { CallClusterButton } from '@/components/calls/CallClusterButton';
import { kindCounts } from '@/components/panels/collaborate/collaborate-model';
import { panelEnabled } from '@/lib/user-preferences';
import { useUiScale } from '@liveworkspace/workbench/components/providers/ui-scale';
import { toSurfacePx, uiScaleStyle } from '@liveworkspace/workbench/lib/ui-scale';
import { useSnapGuides } from '@/hooks/canvas/useSnapGuideState';

// Draw mode's dock shows only on a Draw tab, so its code loads on demand (lib/editor-deferred-code.ts
// fetches it as the editor mounts).

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
  // Avatar mode (docs/specs/008-canvas/avatar-mode.md): the character's customisation, owned by
  // useAvatarConfig in Canvas (it persists per browser, so it lives with the
  // sprite rather than in the editor's document state) and edited by the
  // Avatar Panel down in the chrome.
  avatarConfig: import('@liveworkspace/avatar/config').AvatarConfig;
  onChangeAvatarField: <K extends keyof import('@liveworkspace/avatar/config').AvatarConfig>(
    field: K,
    value: import('@liveworkspace/avatar/config').AvatarConfig[K],
  ) => void;
  // Roll a whole new character, and play one of the panel's reactions.
  onRandomiseAvatar: () => void;
  onAvatarReaction: (kind: import('@liveworkspace/avatar/reactions').AvatarReactionKind) => void;
  // Throw one of the Reaction Pad's bursts (docs/specs/009-elements/reaction-pad.md) around the character.
  onAvatarBurst?: (reaction: import('@livehuddle/document').Reaction) => void;
  // Say something from the Avatar panel (docs/specs/008-canvas/avatar-mode.md "The message popover"): absent for
  // a Viewer, who may not speak. Answers whether the message went; `avatarSpeechCooling` holds Send meanwhile.
  onSendAvatarMessage?: (text: string) => boolean;
  // Your status (docs/specs/008-canvas/avatar-mode.md "Status"), set from the Avatar panel.
  avatarStatus?: import('@liveworkspace/avatar/status').AvatarStatus | null;
  onSetAvatarStatus?: (status: import('@liveworkspace/avatar/status').AvatarStatus | null) => void;
  avatarSpeechCooling?: boolean;
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
  // Format Panel (docs/specs/008-canvas/format-panel.md): what the painter copies, owned in editor state
  // (the paint lives there), plus a description of the loaded element.
  formatConfig?: import('@liveworkspace/workbench/lib/format-config').FormatConfig;
  onToggleFormatGroup?: (
    group: import('@liveworkspace/workbench/lib/format-config').FormatGroup,
  ) => void;
  onSetFormatMode?: (mode: import('@liveworkspace/workbench/lib/format-config').FormatMode) => void;
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
    onCancelIdentity,
    onUndo,
    pendingDraw,
    penPoints,
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
    chromeAway,
  } = props;
  // The view is not a prop here: the parts that show it read it from the viewport store, so a pan or
  // zoom renders them and not this chrome or its panels (docs/specs/008-canvas/blueprints/viewport-store.md).
  const viewport = useViewportStore();
  const readZoom = useCallback(() => viewport.get().zoom, [viewport]);
  // An embed hides all floating chrome. `chromeHidden`
  // folds it in next to the welcome-flow gate that already suppresses
  // the same panels, so each panel stays hidden in either state.
  const chromeHidden = welcomeOpen || chromeAway === true;
  // Panels turned off in Settings (docs/specs/007-editor/user-preferences.md) take their cluster
  // buttons with them (Undo / Redo stay). Read once here and handed to
  // useCanvasChromePanels, so a button and its panel share one value.
  const panelsOn = {
    collaborate: panelEnabled(settings, 'collaboratePanelEnabled'),
  };

  // --- Corner docking (docs/specs/007-editor/panel-docking.md) — see useCornerDocking. ---
  const { isMobile, dock, dockLayerRef, cornerRefs, dockingActive, panelWiringFor } =
    useCornerDocking({ chromeAway: chromeAway === true });
  // Alignment guides while a palette tile is being dragged in (docs/specs/008-canvas/canvas-and-palette.md):
  // the same faint lines a move shows, BEFORE the element exists. The hook
  // also publishes the snap the ghost + drop read, so all three agree.
  const paletteDrag = usePaletteDragGuides({ elements, readZoom, wrapperRef });
  // The drag's snap guides, from the editor's store: a new set renders this chrome only.
  const { snapGuides, distGuides, snapTargets } = useSnapGuides(snapGuideStore);
  // A tick as a move catches an alignment guide (Android; @liveworkspace/workbench/lib/haptics).
  useSnapHaptic(snapGuides.length > 0);
  const { alignGuides, allSnapTargets } = computeDrawGuides({
    drawDrag,
    pendingDraw,
    elements,
    drawHover,
    penPoints,
    snapGuides,
    snapTargets,
    whiteboard: false,
  });

  // The palette strip: an editor's (not read-only), or a Participant's (docs/specs/013-workspace/share-roles.md).
  const paletteShown = !readOnly || !!props.participantPalette;
  // The strip only renders with the chrome up.
  const stripShown = paletteShown && !chromeHidden;
  // The Explorer menu button: top-left on desktop; on a phone, its own card at
  // the left of the strip's row, the strip beside it (no room for a corner card
  // above a strip that needs the whole top row). A read-only visitor has no
  // strip, so it keeps the corner there.
  const menuInStrip = isMobile && paletteShown;
  // A workspace frame puts its Back in the menu button's place (WB59), held sideways too: it is the frame's way out.
  const { workbenchBack } = props;
  const explorerMenuButton = workbenchBack ? (
    <WorkbenchBackButton
      onBack={workbenchBack.back}
      backTitle={workbenchBack.backTitle}
      inline={menuInStrip}
    />
  ) : props.explorerHidden ? null : (
    <ToolbarExplorerButton
      open={activeDockPanel === 'explorer'}
      onToggle={(button) => handleDockButtonClick('explorer', button)}
      inline={menuInStrip}
    />
  );

  const stripTools = sessionStripTools(props.editorMode);
  // Panel elements + their wiring live in useCanvasChromePanels.
  const {
    panelEls,
    explorerEl,
    collaborateEl,
    sessionPopoverEl,
    tidyUpPopoverEl,
    avatarPopoverEl,
    paletteTint,
  } = useCanvasChromePanels({
    props,
    stripTools,
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
  // The bar across the top that the top corners give way to: the strip.
  const topBar = !isMobile && stripShown ? STRIP_SELECTOR : null;
  const topBarCrowds = useStripCrowdsCorners(
    cornerRefs,
    topBar,
    topCornersKey,
    `${toolbarScale}/${panelScale}`,
  );
  const stripSpansTop = stripShown && (isMobile || topBarCrowds);
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
                : // The Draw dock is the strip's twin (its height, its scale), so the same clearance.
                  stripSpansTop && corner.startsWith('top')
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
  ) : null;

  return (
    <>
      {/* The menu button's card at the top left (or a workspace frame's Back), first of the canvas's controls in the
          keyboard order (docs/specs/007-editor/toolbar-layout.md); on a phone it rides in the strip's row instead.
          An embed hides it with the rest of the chrome. */}
      {chromeAway || menuInStrip ? null : explorerMenuButton}

      {/* The empty-canvas hint is now a dismissible bottom banner
          (EmptyCanvasBanner), rendered by EditorView alongside the sign-in /
          theme banners rather than a centre-of-canvas card. */}

      {showIdentityPrompt ? (
        <IdentityPrompt
          participant={selfParticipant}
          documentName={documentName}
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
        penPoints={penPoints}
        polygonVertices={polygonVertices}
        polygonCursor={polygonCursor}
        pendingDraw={pendingDraw}
        wrapperRef={wrapperRef}
        mainSize={props.mainSize}
      />

      {/* Top-of-canvas floating chrome (docs/specs/008-canvas/canvas-and-palette.md): owner / role badge, the
          active editor-mode banner, multi-selection toolbar and session timer, laid out as one
          non-overlapping stack. */}
      <TopCenterChrome {...props} />

      {/* The menu button (docs/specs/007-editor/toolbar-layout.md) opens the Explorer as a popover
          (an embed hides it, the welcome flow doesn't). */}
      {!chromeAway ? explorerEl : null}
      {/* The Collaborate popover (docs/specs/012-collaboration/assigned-actions.md §5): it positions
          against the canvas, so it renders outside the corner layer, as Layers does. */}
      {chromeAway ? null : collaborateEl}
      {tidyUpPopoverEl}
      {avatarPopoverEl}
      {/* The Session strip's popover, as its strip is (docs/specs/012-collaboration/session-tools.md). */}
      {sessionPopoverEl}
      {paletteShown ? (
        <ToolbarPalette
          key={readOnly ? 'participant' : 'standard'}
          participant={readOnly}
          // Hidden, not unmounted, while the chrome is away (an embed, welcome),
          // so the chosen category lasts the page load.
          hidden={chromeHidden}
          canvasTool={canvasTool}
          onSetCanvasTool={props.onSetCanvasTool}
          onExitAvatarMode={props.onExitAvatarMode}
          canvasEmpty={elements.length === 0}
          {...pickPaletteAddHandlers(props)}
          pendingDraw={pendingDraw}
          themeTint={paletteTint}
          leading={menuInStrip ? explorerMenuButton : undefined}
          tabElements={elements}
        />
      ) : null}

      {/* Corner panels (docs/specs/007-editor/panel-docking.md). Distributed into per-corner stack
          containers (with a free layer + snap guides) by `dockedLayer`; in an embed they render inline.
          Each element carries its own visibility gate, so the welcome-flow / read-only / embed
          suppression is unchanged. */}
      {dockingActive ? (
        dockedLayer
      ) : (
        <>
          {panelEls.collaborate}
          {panelEls.minimap}
          {panelEls.eraser}
          {panelEls.format}
        </>
      )}

      {/* Bottom-right cluster. Order, left to right: the Undo / Redo
          strip, the Session strip (the Timer), the
          Collaborate button (only while the tab has a thread or an action), the Layers and
          Theme & Canvas strip, then the Zoom controls. The buttons open their panels as popovers
          above them (docs/specs/007-editor/editor-app.md). */}
      <div
        data-zoom-cluster=""
        data-region="controls"
        // Drawn at the UI scale, still 16px from the corner, or clear of a landscape notch.
        style={
          cornerScale === 1
            ? { right: atLeastInset('16px', 'right') }
            : {
                ...uiScaleStyle(cornerScale),
                right: atLeastInset(`${toSurfacePx(16, cornerScale)}px`, 'right'),
                bottom: toSurfacePx(16, cornerScale),
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
            {!chromeAway && (!readOnly || !!props.participantPalette) ? (
              <UndoRedoClusterStrip
                onUndo={onUndo}
                onRedo={onRedo}
                canUndo={canUndo}
                canRedo={canRedo}
              />
            ) : null}
            {/* Walk (docs/specs/008-canvas/avatar-mode.md "The Walk button"): a Viewer has no picker, so this is its
                way in to Avatar mode and back out, first in the cluster where its Avatar button follows. */}
            {walkButtonShown({
              offered: !!props.walkButton,
              readOnly: !!readOnly,
              participantPalette: !!props.participantPalette,
            }) ? (
              <WalkClusterButton
                walking={props.canvasTool === 'avatar'}
                onToggle={() =>
                  props.canvasTool === 'avatar'
                    ? props.onExitAvatarMode?.()
                    : props.onSetCanvasTool('avatar')
                }
                icon={<AvatarModeIcon size={16} />}
              />
            ) : null}
            {/* Avatar (docs/specs/008-canvas/avatar-mode.md "The Avatar Panel"): beside Undo / Redo while the mode
                is on, for every role : it is the mode's one piece of chrome. */}
            {props.canvasTool === 'avatar' ? (
              <>
                {/* Proximity audio (docs/specs/012-collaboration/proximity-audio.md): Join Audio, then the
                    microphone and Leave, left of Avatar. Draws nothing while calls are off. */}
                <CallClusterButton
                  doNotDisturb={props.avatarStatus === 'dnd'}
                  onClearDoNotDisturb={() => props.onSetAvatarStatus?.(null)}
                />
                <AvatarClusterButton
                  popoverOpen={activeDockPanel === 'avatar'}
                  onTogglePopover={(button) => handleDockButtonClick('avatar', button, true)}
                  canSpeak={!!props.onSendAvatarMessage}
                />
              </>
            ) : null}
            {/* The Session strip (docs/specs/012-collaboration/session-tools.md "The Session strip"): left of
                Layers. A running session is the one piece of chrome a facilitator still
                needs there. */}
            {props.sessionTools && stripTools ? (
              <div className="contents">
                <SessionClusterStrip
                  timer={props.sessionTools.timer}
                  canStart={stripCanStart(!!readOnly)}
                  offersTimer={stripTools.timer}
                  open={activeDockPanel === 'session-timer' ? activeDockPanel : null}
                  onToggle={(segment, button) => handleDockButtonClick(segment, button, true)}
                />
              </div>
            ) : null}
            {/* Collaborate (docs/specs/012-collaboration/assigned-actions.md §5): before Layers, only while
                the tab has a comment thread or an action. A view-role visitor
                gets it too: they read threads and answer them. */}
            {!chromeAway &&
            panelsOn.collaborate &&
            (commentRows.length > 0 || actionRows.length > 0) ? (
              <CollaborateClusterButton
                openCount={kindCounts('open', commentRows, actionRows).all}
                popoverOpen={activeDockPanel === 'collaborate'}
                onTogglePopover={(button) => handleDockButtonClick('collaborate', button, true)}
              />
            ) : null}
            {/* The Theme & Canvas brush (docs/specs/011-theme/canvas-and-theme-dialog.md, its one entry point;
                read-only sessions pass no handler): see ThemeStrip. */}
            {!chromeAway ? (
              <ThemeStrip
                // Tidy Up, first in the strip (docs/specs/008-canvas/layout-cleanup.md "The Tidy Up button").
                tidyUp={
                  tidyUpOffered({
                    actions: props.tidyUp,
                    chromeAway: !!chromeAway,
                  })
                    ? {
                        open: activeDockPanel === 'tidy-up',
                        onToggle: (button) => handleDockButtonClick('tidy-up', button, true),
                      }
                    : undefined
                }
                onOpenTheme={onOpenCanvasTheme}
              />
            ) : null}
            <ViewZoomControls
              onZoomIn={handleZoomIn}
              onZoomOut={handleZoomOut}
              onSetZoom={handleSetZoom}
              onFitToScreen={onFitToScreen}
              pinchOnly={isMobile}
            />
          </>
        )}
      </div>
    </>
  );
}
