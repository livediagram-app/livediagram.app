import { useViewportStore } from '@liveworkspace/workbench/hooks/canvas/useViewportStore';
import type { MarqueeState } from '@liveworkspace/workbench/components/canvas/MarqueeRect';
import type { ReadableStore } from '@liveworkspace/workbench/lib/state-store';
import { ViewDialReader, ViewZoomControls } from '@/components/canvas/view-readers';
import { turnSpace3D } from '@/lib/space-3d/space-3d-turn';

import { computeDrawGuides } from '@/components/canvas/canvas-draw-guides';
import { CanvasGuideOverlay } from '@/components/canvas/CanvasGuideOverlay';
import { CanvasDrawPreview } from '@/components/canvas/CanvasDrawPreview';
import { TopCenterChrome } from '@/components/chrome/TopCenterChrome';
// Lazy-load the visitor name prompt the same way ExportTabDialog + ShareDialog already are. It is gated on
// `showIdentityPrompt`, false on the common path (the owner opening their own document); for a visitor the empty
// canvas underneath has already rendered, so the prompt fades in a frame later rather than blocking the route on its JS.
import dynamic from 'next/dynamic';
import { askNameCard, closeNameCard } from '@liveworkspace/workbench/lib/name-card';
const IdentityPrompt = dynamic(
  () => import('@/components/palette/IdentityPrompt').then((m) => m.IdentityPrompt),
  { ssr: false },
);
// The name tray a guest visitor sees instead of the card (liveworkspace/docs/specs/011-workbench/first-edit.md), loaded
// only when it shows.
const NameTray = dynamic(
  () => import('@liveworkspace/workbench/components/chrome/NameTray').then((m) => m.NameTray),
  { ssr: false },
);

import { OffscreenContentHint } from '@liveworkspace/workbench/components/canvas/OffscreenContentHint';
import { ToolbarPalette } from '@/components/palette/ToolbarPalette';
import { AvatarPalette } from '@/components/palette/AvatarPalette';
import { stripPaletteFor } from '@/lib/avatar-palette';
import { pickPaletteAddHandlers } from '@/components/palette/palette-add-handlers';
import { ToolbarExplorerButton } from '@/components/chrome/ToolbarExplorerButton';
import { Space3DTurnButtons } from '@/components/canvas/space-3d/Space3DTurnButtons';
import { UndoRedoClusterStrip } from '@liveworkspace/workbench/components/canvas/UndoRedoClusterStrip';
import type { CanvasProps } from '@/components/canvas/Canvas.types';
import { useCallback, useRef, type Dispatch, type RefObject, type SetStateAction } from 'react';
import type { DockAnchor, DockPanel } from '@/hooks/canvas/useDockPopovers';
import { useIsMobileViewport } from '@liveworkspace/workbench/hooks/ui/useIsMobileViewport';
import { useRenameCurrentRequest } from '@liveworkspace/workbench/hooks/editor/useRenameCurrentRequest';
import { useCanvasChromePanels } from './useCanvasChromePanels';
import { StripMorph } from '@/components/palette/StripMorph';
import { usePaletteDragGuides } from '@/hooks/canvas/usePaletteDragGuides';
import { atLeastInset } from '@livehuddle/ui';
import { PHONE_TOOLBAR_ITEMS } from '@/components/chrome/phone-toolbar-items';
import { CallDock } from '@/components/calls/CallDock';
import { clusterRowLayout } from '@/components/calls/call-dock-row';
import { useCallDockFit } from '@/components/calls/useCallDockFit';
import { PHONE_CLUSTER_BUTTON_WIDTH } from '@/components/chrome/phone-toolbar-items';
import { useSnapHaptic } from '@liveworkspace/workbench/hooks/canvas/useSnapHaptic';
import { useStartPanelOpen } from '@liveworkspace/workbench/components/start/start-panel-open';
import { EditWalkStrip, EditWalkToggle } from '@/components/palette/EditWalkToggle';
import { useUiScale } from '@liveworkspace/workbench/components/providers/ui-scale';
import { toSurfacePx, uiScaleStyle } from '@liveworkspace/workbench/lib/ui-scale';
import { useSnapGuides } from '@/hooks/canvas/useSnapGuideState';

// Values the Canvas computes (selection projection + layout/dock/zoom
// state) and threads into the chrome alongside its own props.
type ChromeExtras = {
  // The canvas <main>'s measured size (the guide overlay and the draw preview read it).
  mainSize: { width: number; height: number };
  // True when every element has scrolled out of view: show the nudge above
  // the Fit button (useOffscreenContent in Canvas).
  offscreenContent: boolean;
  // The sweep's rect, read only by the marquee rectangle (docs/specs/008-canvas/canvas-performance.md).
  marquee: ReadableStore<MarqueeState | null>;
  drawDrag: { startX: number; startY: number; currentX: number; currentY: number } | null;
  // Snapped pointer position while a draw is armed but not yet started
  // (pre-press start-snap preview); null when not armed / not snapped.
  drawHover: { x: number; y: number } | null;
  // The Room Builder's in-flight state (docs/specs/009-elements/room-builder.md): the placed corners and
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
  avatarConfig: import('@livehuddle/avatar/config').AvatarConfig;
  onChangeAvatarField: <K extends keyof import('@livehuddle/avatar/config').AvatarConfig>(
    field: K,
    value: import('@livehuddle/avatar/config').AvatarConfig[K],
  ) => void;
  // Roll a whole new character, and play one of the panel's reactions.
  onRandomiseAvatar: () => void;
  onAvatarReaction: (kind: import('@livehuddle/avatar/reactions').AvatarReactionKind) => void;
  // Whether your hand is raised (Raise Hand): its Actions card shows pressed.
  avatarHandUp?: boolean;
  // Throw one of the Reactions bursts (docs/specs/008-canvas/avatar-mode.md) around the character.
  onAvatarBurst?: (reaction: import('@livehuddle/document').Reaction) => void;
  // Say something from the Avatar panel (docs/specs/008-canvas/avatar-mode.md "The message popover"): absent for
  // a Viewer, who may not speak. Answers whether the message went; `avatarSpeechCooling` holds Send meanwhile.
  onSendAvatarMessage?: (text: string) => boolean;
  // Your status (docs/specs/008-canvas/avatar-mode.md "Status"), set from the Avatar panel.
  avatarStatus?: import('@livehuddle/avatar/status').AvatarStatus | null;
  onSetAvatarStatus?: (status: import('@livehuddle/avatar/status').AvatarStatus | null) => void;
  avatarSpeechCooling?: boolean;
};

export type CanvasChromeProps = CanvasProps & ChromeExtras;

// The chrome layer of the canvas: empty-state prompt, template picker,
// multi-select toolbar, mode banners, the menu button and Explorer, the palette strip, and the zoom / undo cluster. Extracted from Canvas.tsx verbatim; consumes
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
    onConfirmIdentity,
    offscreenContent,
    onFitToScreen,
    onRedo,
    onCancelIdentity,
    onUndo,
    pendingDraw,
    polygonVertices,
    polygonCursor,
    readOnly,
    selfParticipant,
    snapGuideStore,
    showIdentityPrompt,
    showIdentityTray = false,
    tabThemeId,
    identityLockedName,
    wrapperRef,
    chromeAway,
  } = props;
  // The view is not a prop here: the parts that show it read it from the viewport store, so a pan or
  // zoom renders them and not this chrome or its panels (docs/specs/008-canvas/blueprints/viewport-store.md).
  const viewport = useViewportStore();
  const readZoom = useCallback(() => viewport.get().zoom, [viewport]);
  // An embed hides all floating chrome. `chromeHidden`
  // A visitor's name card hides none of it: it is a modal over the canvas (Work Tracker 1522).
  const chromeHidden = chromeAway === true;

  const isMobile = useIsMobileViewport();
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
    snapGuides,
    snapTargets,
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
  // Rename <Kind> from the search opens the Explorer panel from its menu button, on the open item's name
  // field (liveworkspace/docs/specs/004-index/one-explorer.md "Rename from the search").
  const explorerButtonRef = useRef<HTMLButtonElement>(null);
  const renameCurrent = useRenameCurrentRequest({
    nonce: props.renameCurrentNonce ?? 0,
    explorerOpen: activeDockPanel === 'explorer',
    available: !props.explorerHidden,
    openExplorer: () => {
      const button = explorerButtonRef.current;
      if (button) handleDockButtonClick('explorer', button);
    },
  });
  const explorerMenuButton = props.explorerHidden ? null : (
    <ToolbarExplorerButton
      open={activeDockPanel === 'explorer'}
      onToggle={(button) => handleDockButtonClick('explorer', button)}
      buttonRef={explorerButtonRef}
      inline={menuInStrip}
    />
  );

  // The Explorer popover and the palette's theme tint live in useCanvasChromePanels.
  const { explorerEl, paletteTint } = useCanvasChromePanels({ props, renameCurrent });

  // The Call dock (docs/specs/008-canvas/avatar-mode.md "The Call dock"): with the avatar palette, in the bottom-right
  // cluster's row, on the zoom buttons' bottom line (owner, 2026-11-07, Work Tracker #642), at every width (Work
  // Tracker 1041): centred while there is room, moving left rather than covering the buttons.
  const callDockShown = strip === 'avatar' && stripShown;
  // With no room for the dock and the buttons on one line, the dock stands above the buttons (useCallDockFit).
  // UI scale (docs/specs/007-editor/ui-scale.md): the bottom-right cluster is drawn at the corner buttons' scale.
  const cornerScale = useUiScale('cornerButtons');
  const clusterRef = useRef<HTMLDivElement>(null);
  const dockFit = useCallDockFit({ active: callDockShown, rowRef: clusterRef, scale: cornerScale });
  const clusterRow = clusterRowLayout(callDockShown, dockFit.lifted);
  const callDock = callDockShown ? (
    <CallDock
      doNotDisturb={props.avatarStatus === 'dnd'}
      onClearDoNotDisturb={() => props.onSetAvatarStatus?.(null)}
      lifted={dockFit.lifted}
    />
  ) : null;

  const undoRedo =
    !chromeAway && !readOnly && !walking ? (
      <UndoRedoClusterStrip onUndo={onUndo} onRedo={onRedo} canUndo={canUndo} canRedo={canRedo} />
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
          onJoin={(name) => {
            closeNameCard();
            onConfirmIdentity(name);
          }}
          onCancel={() => {
            closeNameCard();
            onCancelIdentity();
          }}
        />
      ) : null}
      {/* A signed-in visitor's name is their account's: nothing to choose, so no tray. */}
      {showIdentityTray && !identityLockedName ? (
        <NameTray name={selfParticipant.name} onChange={askNameCard} onKeep={onCancelIdentity} />
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
          active editor-mode banner and multi-selection toolbar, laid out as one
          non-overlapping stack. */}
      <TopCenterChrome {...props} />

      {/* The menu button (docs/specs/007-editor/toolbar-layout.md) opens the Explorer as a popover
          (an embed hides it, the welcome flow doesn't). */}
      {!chromeAway ? explorerEl : null}
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
          handUp={props.avatarHandUp}
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
          // Hidden, not unmounted, while the chrome is away (an embed) or the avatar palette stands in
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

      {/* Bottom-right cluster. Order, left to right: the Undo / Redo
          strip, then the Zoom controls. The buttons open their panels as popovers
          above them (docs/specs/007-editor/editor-app.md). */}
      <div
        data-zoom-cluster=""
        data-region="controls"
        // Drawn at the UI scale, still 16px from the corner, or clear of a landscape notch.
        ref={clusterRef}
        style={{
          ...(cornerScale === 1
            ? { right: atLeastInset('16px', 'right') }
            : {
                ...uiScaleStyle(cornerScale),
                right: atLeastInset(`${toSurfacePx(16, cornerScale)}px`, 'right'),
                bottom: toSurfacePx(16, cornerScale),
              }),
        }}
        // On a phone the cluster stays one row (docs/specs/007-editor/editor-app.md): its buttons share the
        // width there is, PHONE_CLUSTER_BUTTON_WIDTH, from 36px up to their
        // usual 44px (always 44px tall to tap), so Undo, Layers and Theme and Fit fill the
        // row on a 360px screen and up. It may still wrap, from the right, on a narrower one, so Undo is never
        // pushed off the screen. While the Call dock is in the row (walking, at any width) the row is three columns: the
        // dock in the middle one, centred on the screen while there is room, and the buttons, unwrapped, in the right
        // one, which takes what they need first, so the dock gives way to the left rather than ever covering them.
        className={`pointer-events-none absolute bottom-4 right-4 z-[var(--z-panel)] ${clusterRow.row} ${PHONE_CLUSTER_BUTTON_WIDTH} ${PHONE_TOOLBAR_ITEMS}`}
      >
        {callDock}
        {/* The buttons: the row's right column beside the dock, or, with no dock in the row, laid out by the row
            itself (`contents`). */}
        <div data-cluster-buttons="" className={clusterRow.buttons}>
          {offscreenContent ? <OffscreenContentHint onBringBack={onFitToScreen} /> : null}
          {/* Undo / Redo: see UndoRedoClusterStrip. An Editor's alone, and not while walking. On a desktop it
              stands just left of the view dial, level with it (the owner, 2026-11-27: "to the left of the
              navigator and zoom control, not below it"). */}
          {isMobile ? undoRedo : null}
          {/* A phone's Turn Left and Turn Right (docs/specs/008-canvas/3d-view.md "Turning the camera"). */}
          {isMobile ? <Space3DTurnButtons /> : null}
          {/* On a desktop the zoom is the view dial, standing over the row's right end (3d-view.md "The view
              dial"); a phone keeps the row's zoom. */}
          {isMobile ? (
            <ViewZoomControls
              onZoomIn={handleZoomIn}
              onZoomOut={handleZoomOut}
              onSetZoom={handleSetZoom}
              onFitToScreen={onFitToScreen}
              pinchOnly
            />
          ) : (
            <div className="flex items-end gap-2">
              {undoRedo}
              <ViewDialReader
                onZoomIn={handleZoomIn}
                onZoomOut={handleZoomOut}
                onSetZoom={handleSetZoom}
                onFitToScreen={onFitToScreen}
                onTurn={turnSpace3D}
              />
            </div>
          )}
        </div>
      </div>
    </>
  );
}
