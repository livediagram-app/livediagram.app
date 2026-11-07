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
import { AvatarPalette } from '@/components/palette/AvatarPalette';
import { stripPaletteFor } from '@/lib/avatar-palette';
import { pickPaletteAddHandlers } from '@/components/palette/palette-add-handlers';
import { ToolbarExplorerButton } from '@/components/chrome/ToolbarExplorerButton';
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
import { StripMorph } from '@/components/palette/StripMorph';
import { usePaletteDragGuides } from '@/hooks/canvas/usePaletteDragGuides';
import { PANEL_CORNERS, PANEL_IDS, cornerBottomInset, type PanelCorner } from '@/lib/panel-layout';
import { atLeastInset } from '@livehuddle/ui';
import { STRIP_SELECTOR, useStripCrowdsCorners } from '@/hooks/ui/useStripCrowdsCorners';
import { PHONE_TOOLBAR_ITEMS } from '@/components/chrome/phone-toolbar-items';
import { CallDock } from '@/components/calls/CallDock';
import { clusterRowLayout } from '@/components/calls/call-dock-row';
import { PHONE_CLUSTER_BUTTON_WIDTH } from '@/components/chrome/phone-toolbar-items';
import { useSnapHaptic } from '@liveworkspace/workbench/hooks/canvas/useSnapHaptic';
import { CollaborateClusterButton } from '@liveworkspace/workbench/components/canvas/CollaborateClusterButton';
import { useStartPanelOpen } from '@liveworkspace/workbench/components/start/start-panel-open';
import { EditWalkStrip, EditWalkToggle } from '@/components/palette/EditWalkToggle';
import { kindCounts } from '@/components/panels/collaborate/collaborate-model';
import { panelEnabled } from '@/lib/user-preferences';
import { useUiScale } from '@liveworkspace/workbench/components/providers/ui-scale';
import { toSurfacePx, uiScaleStyle } from '@liveworkspace/workbench/lib/ui-scale';
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
  // Throw one of the Reactions bursts (docs/specs/008-canvas/avatar-mode.md) around the character.
  onAvatarBurst?: (reaction: import('@livehuddle/document').Reaction) => void;
  // Say something from the Avatar panel (docs/specs/008-canvas/avatar-mode.md "The message popover"): absent for
  // a Viewer, who may not speak. Answers whether the message went; `avatarSpeechCooling` holds Send meanwhile.
  onSendAvatarMessage?: (text: string) => boolean;
  // Your status (docs/specs/008-canvas/avatar-mode.md "Status"), set from the Avatar panel.
  avatarStatus?: import('@liveworkspace/avatar/status').AvatarStatus | null;
  onSetAvatarStatus?: (status: import('@liveworkspace/avatar/status').AvatarStatus | null) => void;
  avatarSpeechCooling?: boolean;
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

  // Walking is being in the room, not editing it (docs/specs/008-canvas/avatar-mode.md "No editing chrome while
  // walking"): Undo, Redo and Tab Style step aside for as long as the mode is on.
  const walking = canvasTool === 'avatar';
  // Start a Space in front of the canvas greys the toggle's Walk (avatar-mode.md "Not over a start").
  const startOpen = useStartPanelOpen();
  // Which strip, from the session's `can` (lib/avatar-palette, docs/specs/013-workspace/share-roles.md): the building
  // palette, an Editor's; or, while walking, the avatar palette, every role's, a Participant's and a Viewer's always
  // (docs/specs/008-canvas/avatar-mode.md "The avatar palette"). The Call dock, bottom centre, shows with it, so every
  // role that can be in a call has the call's buttons. A session without a level (an embed's) reads as its read-only flag says.
  const can = {
    level: props.accessLevel ?? (readOnly ? 'view' : 'edit'),
    alwaysWalks: props.alwaysWalks === true,
  } as const;
  const strip = stripPaletteFor({ can, readOnly, walking });
  // The building strip stays mounted (hidden) while an Editor walks, so it comes back exactly as it was.
  const buildMounted = stripPaletteFor({ can, readOnly, walking: false }) === 'build';
  const paletteShown = strip !== null;
  // The strip only renders with the chrome up, and the avatar palette never over Start a Space ("Not over a start").
  const stripShown = paletteShown && !chromeHidden && !(strip === 'avatar' && startOpen);
  // The Explorer menu button: top-left on desktop; on a phone, its own card at
  // the left of the strip's row, the strip beside it (no room for a corner card
  // above a strip that needs the whole top row). A session with no strip (a
  // read-only Editor, not walking) keeps the corner there.
  const menuInStrip = isMobile && paletteShown && !(strip === 'avatar' && startOpen);
  // The Edit | Walk toggle (docs/specs/008-canvas/avatar-mode.md "The Edit | Walk toggle"): an Editor's one switch
  // between building and walking, first on whichever strip shows. Not in an embed, and not for a session held walking
  // (share-roles.md "Always walking"). Walk greys while Start a Space is open; Edit always works.
  // The Edit | Walk switch morphs the strip (toolbar-layout.md "Switching morphs the strip"): StripMorph, rendered
  // below, captures the outgoing strip before React changes the DOM and plays the morph before the incoming one paints.
  const editWalk = props.walkToggle ? (
    <EditWalkToggle
      walking={walking}
      onEdit={() => props.onExitAvatarMode?.()}
      onWalk={() => props.onSetCanvasTool('avatar')}
      walkBlockedReason={startOpen ? 'Pick a template or close Start a Space to walk.' : undefined}
    />
  ) : undefined;
  const explorerMenuButton = props.explorerHidden ? null : (
    <ToolbarExplorerButton
      open={activeDockPanel === 'explorer'}
      onToggle={(button) => handleDockButtonClick('explorer', button)}
      inline={menuInStrip}
    />
  );

  // Panel elements + their wiring live in useCanvasChromePanels.
  const { panelEls, explorerEl, collaborateEl, tidyUpPopoverEl, paletteTint } =
    useCanvasChromePanels({
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

  // The Call dock (docs/specs/008-canvas/avatar-mode.md "The Call dock"): with the avatar palette, bottom centre; on a
  // phone in the bottom-right cluster's row, on the zoom buttons' bottom line (owner, 2026-11-07, Work Tracker #642).
  const callDockShown = strip === 'avatar' && stripShown;
  const callDockInRow = callDockShown && isMobile;
  const clusterRow = clusterRowLayout(callDockInRow);
  const callDock = callDockShown ? (
    <CallDock
      doNotDisturb={props.avatarStatus === 'dnd'}
      onClearDoNotDisturb={() => props.onSetAvatarStatus?.(null)}
      inRow={callDockInRow}
    />
  ) : null;

  return (
    <>
      <StripMorph walking={walking} wrapperRef={wrapperRef} />
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
          active editor-mode banner and multi-selection toolbar, laid out as one
          non-overlapping stack. */}
      <TopCenterChrome {...props} />

      {/* The menu button (docs/specs/007-editor/toolbar-layout.md) opens the Explorer as a popover
          (an embed hides it, the welcome flow doesn't). */}
      {!chromeAway ? explorerEl : null}
      {/* The Collaborate popover (docs/specs/012-collaboration/assigned-actions.md §5): it positions
          against the canvas, so it renders outside the corner layer, as Layers does. */}
      {chromeAway ? null : collaborateEl}
      {tidyUpPopoverEl}
      {/* While walking, the avatar palette (docs/specs/008-canvas/avatar-mode.md "The avatar palette"): ahead of the
          hidden building strip, so whatever measures the strip finds this one. */}
      {strip === 'avatar' && props.avatarConfig ? (
        <AvatarPalette
          hidden={!stripShown}
          leading={menuInStrip ? explorerMenuButton : undefined}
          editWalk={editWalk}
          config={props.avatarConfig}
          onChange={props.onChangeAvatarField}
          onRandomise={props.onRandomiseAvatar}
          onReaction={props.onAvatarReaction}
          onBurst={props.onAvatarBurst}
          shirt={selfParticipant?.color}
          status={props.avatarStatus ?? null}
          onSetStatus={props.onSetAvatarStatus}
          onSendMessage={props.onSendAvatarMessage}
          speechCooling={props.avatarSpeechCooling}
        />
      ) : null}
      {buildMounted ? (
        <ToolbarPalette
          // Hidden, not unmounted, while the chrome is away (an embed, welcome) or the avatar palette stands in
          // for it, so the chosen category lasts the page load.
          hidden={chromeHidden || strip !== 'build'}
          canvasTool={canvasTool}
          onExitAvatarMode={props.onExitAvatarMode}
          editWalk={editWalk}
          {...pickPaletteAddHandlers(props)}
          pendingDraw={pendingDraw}
          themeTint={paletteTint}
          leading={menuInStrip && strip === 'build' ? explorerMenuButton : undefined}
          tabElements={elements}
        />
      ) : null}
      {/* A read-only Editor has no building strip, so the toggle stands alone where the strip would be: walking
          is still one press away (docs/specs/008-canvas/avatar-mode.md "The Edit | Walk toggle"). */}
      {strip === null && editWalk && !chromeHidden ? (
        <EditWalkStrip>{editWalk}</EditWalkStrip>
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
          {panelEls.format}
        </>
      )}

      {/* The Call dock (docs/specs/008-canvas/avatar-mode.md "The Call dock"): the call's buttons, bottom centre,
          while the avatar palette shows. On a phone it is in the cluster's row instead, below. */}
      {callDockInRow ? null : callDock}

      {/* Bottom-right cluster. Order, left to right: the Undo / Redo
          strip, the
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
        // On a phone the cluster stays one row (docs/specs/007-editor/editor-app.md): its buttons share the
        // width there is, PHONE_CLUSTER_BUTTON_WIDTH, from 36px up to their
        // usual 44px (always 44px tall to tap), so Undo, Layers and Theme and Fit fill the
        // row on a 360px screen and up. It may still wrap, from the right, on a narrower one, so Undo is never
        // pushed off the screen. While the Call dock is in the row (a phone, walking) the row is three columns: the
        // dock in the middle one, centred on the screen while there is room, and the buttons, unwrapped, in the right
        // one, which takes what they need first, so the dock gives way to the left rather than ever covering them.
        className={`pointer-events-none absolute bottom-4 right-4 z-[var(--z-panel)] ${clusterRow.row} ${PHONE_CLUSTER_BUTTON_WIDTH} ${PHONE_TOOLBAR_ITEMS}`}
      >
        {callDockInRow ? callDock : null}
        {/* The buttons: the row's right column beside the dock, or, with no dock in the row, laid out by the row
            itself (`contents`). */}
        <div data-cluster-buttons="" className={clusterRow.buttons}>
          {welcomeOpen ? null : (
            <>
              {offscreenContent ? <OffscreenContentHint onBringBack={onFitToScreen} /> : null}
              {/* Undo / Redo: see UndoRedoClusterStrip. An Editor's alone, and not while walking. */}
              {!chromeAway && !readOnly && !walking ? (
                <UndoRedoClusterStrip
                  onUndo={onUndo}
                  onRedo={onRedo}
                  canUndo={canUndo}
                  canRedo={canRedo}
                />
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
                read-only sessions pass no handler): see ThemeStrip. Away while walking. */}
              {!chromeAway && !walking ? (
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
      </div>
    </>
  );
}
