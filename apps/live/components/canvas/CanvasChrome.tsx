import { computeDrawGuides } from '@/components/canvas/canvas-draw-guides';
import { CanvasGuideOverlay } from '@/components/canvas/CanvasGuideOverlay';
import { CanvasDrawPreview } from '@/components/canvas/CanvasDrawPreview';
import { ActivityIcon, RedoIcon, UndoIcon } from '@/components/panels/ActivityPanel';
import { TopCenterChrome } from '@/components/chrome/TopCenterChrome';
// Lazy-load TemplatePicker (1163 lines + its theme / share helpers)
// the same way ExportTabDialog + ShareDialog already are. The picker
// is gated on `showTemplatePicker`, which is false for the common
// path (a returning user opening an existing diagram with tabs that
// already have content). For first-time guests on a fresh diagram
// the gate is true on first paint, but the empty canvas underneath
// has already rendered by then, so the user sees the welcome modal
// fade in a frame later rather than blocking the route on the
// picker's JS. The /live/new entry keeps the static import because
// the picker is the whole UI there.
import dynamic from 'next/dynamic';
const TemplatePicker = dynamic(() =>
  import('@/components/palette/TemplatePicker').then((m) => m.TemplatePicker),
);

import { Tooltip } from '@/components/primitives/Tooltip';
import { ZoomControls } from '@/components/chrome/ZoomControls';
import { OffscreenContentHint } from '@/components/canvas/OffscreenContentHint';
import { CanvasMobileDock } from '@/components/canvas/CanvasMobileDock';
import type { CanvasProps } from '@/components/canvas/Canvas.types';
import { Fragment, type Dispatch, type RefObject, type SetStateAction } from 'react';
import type { DockAnchor, MobilePanel } from '@/hooks/canvas/useCanvasMobileDock';
import { useCornerDocking } from '@/hooks/ui/useCornerDocking';
import { PanelSnapSlot } from '@/components/canvas/PanelSnapSlot';
import { useCanvasChromePanels } from './useCanvasChromePanels';
import { PANEL_CORNERS, PANEL_IDS, cornerBottomInset, type PanelCorner } from '@/lib/panel-layout';

// Values the Canvas computes (selection projection + layout/dock/zoom
// state) and threads into the chrome alongside its own props.
type ChromeExtras = {
  isPaintMode: boolean;
  isGroupMode: boolean;
  // True when every element has scrolled out of view: show the nudge above
  // the Fit button (useOffscreenContent in Canvas).
  offscreenContent: boolean;
  marquee: { startX: number; startY: number; currentX: number; currentY: number } | null;
  drawDrag: { startX: number; startY: number; currentX: number; currentY: number } | null;
  // Snapped pointer position while a draw is armed but not yet started
  // (pre-press start-snap preview); null when not armed / not snapped.
  drawHover: { x: number; y: number } | null;
  penPoints: { x: number; y: number }[] | null;
  wrapperRef: RefObject<HTMLDivElement | null>;
  paletteBottomY: number;
  setPaletteBottomY: Dispatch<SetStateAction<number>>;
  explorerBottomY: number;
  setExplorerBottomY: Dispatch<SetStateAction<number>>;
  activeMobilePanel: MobilePanel | null;
  setActiveMobilePanel: Dispatch<SetStateAction<MobilePanel | null>>;
  dockButtonRefs: RefObject<Record<string, HTMLButtonElement | null>>;
  activeDockAnchor: DockAnchor | null;
  setActiveDockAnchor: Dispatch<SetStateAction<DockAnchor | null>>;
  handleDockButtonClick: (id: MobilePanel) => void;
  handleZoomIn: () => void;
  handleZoomOut: () => void;
  handleResetZoom: () => void;
  // Begin an isometric orbit drag from the given screen coordinates
  // (wired to `isoCamera.startOrbit`). Drives the dock orbit button,
  // which only renders while the isometric tool is active.
  onIsoOrbit: (clientX: number, clientY: number) => void;
  // Reset the isometric camera to its default angle (wired to
  // `isoCamera.reset`) — fired when the dock orbit button is clicked.
  onIsoReset: () => void;
};

export type CanvasChromeProps = CanvasProps & ChromeExtras;

// Per-corner stack container classes (spec/63). Each is an absolute,
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

// The floating chrome layer of the canvas: empty-state prompt, template
// picker, multi-select toolbar, mode banners, mobile dock, Explorer, the
// Activity / Comments / Editor / Context panels, the palette, and
// the zoom / undo cluster. Extracted from Canvas.tsx verbatim; consumes
// Canvas's props plus the computed ChromeExtras.

export function CanvasChrome(props: CanvasChromeProps) {
  const {
    activeMobilePanel,
    activityMinimized,
    aiPanel,
    canRedo,
    canUndo,
    canvasTool,
    diagramName,
    dockButtonRefs,
    drawDrag,
    drawHover,
    elements,
    handleDockButtonClick,
    handleResetZoom,
    handleZoomIn,
    handleZoomOut,
    marquee,
    minimalPanels,
    onChooseTemplate,
    offscreenContent,
    onFitToScreen,
    onRedo,
    onIsoOrbit,
    onIsoReset,
    onSkipTemplatePicker,
    onToggleActivityMinimized,
    onUndo,
    pendingDraw,
    penPoints,
    readOnly,
    selfParticipant,
    snapGuides,
    distGuides,
    snapTargets,
    showTemplatePicker,
    tabThemeId,
    templatePickerLockedName,
    templatePickerMode,
    viewportZoom,
    welcomeOpen,
    wrapperRef,
    zenMode,
    onToggleZen,
  } = props;
  // Zen / focus mode (spec/26): hide all floating chrome. `chromeHidden`
  // folds it in next to the welcome-flow gate that already suppresses
  // the same panels, so each panel stays hidden in either state.
  const chromeHidden = welcomeOpen || zenMode === true;

  // --- Corner docking (spec/63) — see useCornerDocking. ---
  const { isMobile, dock, dockLayerRef, cornerRefs, dockingActive, panelWiringFor } =
    useCornerDocking({ minimalPanels: minimalPanels === true, zenMode: zenMode === true });
  const { alignGuides, allSnapTargets } = computeDrawGuides({
    drawDrag,
    pendingDraw,
    elements,
    drawHover,
    penPoints,
    snapGuides,
    snapTargets,
  });

  // Floating panel elements + their wiring live in useCanvasChromePanels.
  const { panelEls } = useCanvasChromePanels({
    props,
    chromeHidden,
    isMobile,
    dockingActive,
    panelWiringFor,
  });
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
            style={corner === 'bottom-right' ? { bottom: cornerBottomInset(corner) } : undefined}
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
          diagramName={diagramName}
          lockedName={templatePickerLockedName}
          onPick={onChooseTemplate}
          onSkip={onSkipTemplatePicker}
        />
      ) : null}

      <CanvasGuideOverlay
        alignGuides={alignGuides}
        allSnapTargets={allSnapTargets}
        distGuides={distGuides}
        drawHover={drawHover}
        viewportZoom={viewportZoom}
        marquee={marquee}
        tabThemeId={tabThemeId}
        wrapperRef={wrapperRef}
      />

      <CanvasDrawPreview
        drawDrag={drawDrag}
        penPoints={penPoints}
        pendingDraw={pendingDraw}
        viewportZoom={viewportZoom}
        wrapperRef={wrapperRef}
      />

      {/* Top-of-canvas floating chrome (spec/09): owner / role badge, the
          active editor-mode banner, multi-selection toolbar, session timer
          and vote banner — laid out as one non-overlapping stack. */}
      <TopCenterChrome {...props} />

      <CanvasMobileDock
        welcomeOpen={chromeHidden}
        minimalPanels={minimalPanels}
        readOnly={readOnly}
        hasAi={!!aiPanel}
        activeMobilePanel={activeMobilePanel}
        dockButtonRefs={dockButtonRefs}
        onDockButtonClick={handleDockButtonClick}
      />

      {/* Floating panels (spec/63). In the desktop docking layout they
          are distributed into per-corner stack containers (with a free
          layer + snap guides) by `dockedLayer`; otherwise — mobile,
          minimal dock, or zen — they render inline where they always
          did. Each element carries its own visibility gate, so the
          welcome-flow / read-only / zen suppression is unchanged.
          Explorer stays visible during the welcome flow; only zen hides
          it. */}
      {dockingActive ? (
        dockedLayer
      ) : (
        <>
          {panelEls.explorer}
          {panelEls.collaborate}
          {panelEls.ai}
          {panelEls.activity}
          {panelEls.palette}
          {panelEls.minimap}
        </>
      )}

      {/* Bottom dock. Order, left → right: Zoom controls, History
          controls, and a minimised Activity dock when applicable.
          The Palette is banner-collapsed in place (spec/09)
          so it's not in the dock cluster; the Explorer is hidden
          on mobile entirely (spec/07) and uses banner-collapse on
          desktop, so it's also not in the dock cluster. */}
      <div className="pointer-events-none absolute bottom-4 right-4 z-[var(--z-panel)] flex items-center gap-2">
        {welcomeOpen ? null : (
          <>
            {offscreenContent ? <OffscreenContentHint onBringBack={onFitToScreen} /> : null}
            {!zenMode && activityMinimized && !readOnly ? (
              // Collapsed Activity dock (editor sessions only): a strip
              // with inline Undo / Redo so the most common history
              // actions don't require reopening the panel. View-role
              // visitors don't get this button at all: undo/redo and
              // the audit trail aren't actionable for them, so the
              // dock would just be dead chrome.
              <div
                onContextMenu={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                className="pointer-events-auto flex animate-pop-in items-stretch overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg shadow-slate-900/5 dark:border-slate-700 dark:bg-slate-900 dark:shadow-slate-950/40"
              >
                <Tooltip title="Open Tab Activity" description="Expand the Tab Activity panel.">
                  <button
                    type="button"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={onToggleActivityMinimized}
                    aria-label="Open Tab Activity"
                    className="hidden h-11 w-11 items-center justify-center border-r border-slate-200 text-slate-600 transition hover:bg-slate-50 hover:text-slate-900 sm:flex dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
                  >
                    <ActivityIcon />
                  </button>
                </Tooltip>
                <Tooltip title="Undo" description="Undo last edit.">
                  <button
                    type="button"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={onUndo}
                    disabled={!canUndo}
                    aria-label="Undo"
                    className="flex h-11 w-11 items-center justify-center text-slate-600 transition hover:bg-slate-50 hover:text-slate-900 disabled:cursor-not-allowed disabled:text-slate-300 disabled:hover:bg-transparent dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white dark:disabled:text-slate-600 dark:disabled:hover:bg-transparent"
                  >
                    <UndoIcon />
                  </button>
                </Tooltip>
                <Tooltip title="Redo" description="Redo last undone edit.">
                  <button
                    type="button"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={onRedo}
                    disabled={!canRedo}
                    aria-label="Redo"
                    className="flex h-11 w-11 items-center justify-center border-l border-slate-100 text-slate-600 transition hover:bg-slate-50 hover:text-slate-900 disabled:cursor-not-allowed disabled:text-slate-300 disabled:hover:bg-transparent dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white dark:disabled:text-slate-600 dark:disabled:hover:bg-transparent"
                  >
                    <RedoIcon />
                  </button>
                </Tooltip>
              </div>
            ) : null}
            <ZoomControls
              zoom={viewportZoom}
              onZoomIn={handleZoomIn}
              onZoomOut={handleZoomOut}
              onReset={handleResetZoom}
              onFitToScreen={onFitToScreen}
              onIsoOrbit={canvasTool === 'isometric' ? onIsoOrbit : undefined}
              onIsoReset={canvasTool === 'isometric' ? onIsoReset : undefined}
              onToggleZen={onToggleZen}
              zenActive={zenMode}
            />
          </>
        )}
      </div>
    </>
  );
}
