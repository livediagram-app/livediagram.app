import { alignmentGuides, deriveTextColorForBg } from '@livediagram/diagram';
import { drawBannerMessage } from '@/lib/draw-mode';
import { getTheme } from '@/lib/themes';
import { CommandPalette, type SelectedElementControls } from './CommandPalette';
import { isSvgRenderedShape, ShapeSvgOverlay } from './shape-svg-overlay';
import { ActivityIcon, ActivityPanel, RedoIcon, UndoIcon } from './ActivityPanel';
// Lazy-load CommentsPanel: only mounts when the active tab has at
// least one element with comments AND the ContextPanel has reported
// its bottom edge (so we don't paint the panel at the legacy fallback
// position). Most diagrams never accumulate comments, so deferring
// the 164-line panel + its formatRelativeTimeShort + useRelativeTimeTick
// dependencies keeps the editor's initial chunk lean.
const CommentsPanel = dynamic(() => import('./CommentsPanel').then((m) => m.CommentsPanel));
import { ParticipantAvatar } from './ParticipantAvatar';
import { ContextPanel } from './ContextPanel';
import { Explorer } from './Explorer';
import { isMobileViewportSync } from '@/lib/responsive';
import { DockButton, MovablePanel } from './MovablePanel';
import { AiPanelContent } from './AiPanel';
// Lazy-load MultiSelectionToolbar: only mounts when the user has
// drag-marquee'd two or more elements. Most sessions never trigger
// it (single-element edits dominate), so deferring the 172-line
// toolbar + its icon set keeps the editor's initial chunk lean.
// Same pattern as the editor's other gated modals (NotePopover,
// TabLinkPicker, etc.).
const MultiSelectionToolbar = dynamic(() =>
  import('./MultiSelectionToolbar').then((m) => m.MultiSelectionToolbar),
);
import { ModeBanner } from './ModeBanner';
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
const TemplatePicker = dynamic(() => import('./TemplatePicker').then((m) => m.TemplatePicker));

import { Tooltip } from './Tooltip';
import { ZoomControls } from './ZoomControls';
import { CanvasMobileDock } from './CanvasMobileDock';
import type { CanvasProps } from './Canvas.types';
import type { Dispatch, RefObject, SetStateAction } from 'react';
import type { TabSectionControls } from './CommandPalette';
import type { DockAnchor, MobilePanel } from '@/hooks/useCanvasMobileDock';

// Values the Canvas computes (selection projection + layout/dock/zoom
// state) and threads into the chrome alongside its own props.
type ChromeExtras = {
  paletteSelection: SelectedElementControls | null;
  tabSection: TabSectionControls;
  selectionScope: 'single' | 'multi' | 'group';
  isPaintMode: boolean;
  isGroupMode: boolean;
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
  contextBottomY: number;
  setContextBottomY: Dispatch<SetStateAction<number>>;
  activeMobilePanel: MobilePanel | null;
  setActiveMobilePanel: Dispatch<SetStateAction<MobilePanel | null>>;
  dockButtonRefs: RefObject<Record<string, HTMLButtonElement | null>>;
  activeDockAnchor: DockAnchor | null;
  setActiveDockAnchor: Dispatch<SetStateAction<DockAnchor | null>>;
  handleDockButtonClick: (id: MobilePanel) => void;
  handleZoomIn: () => void;
  handleZoomOut: () => void;
  handleResetZoom: () => void;
};

export type CanvasChromeProps = CanvasProps & ChromeExtras;

// The floating chrome layer of the canvas: empty-state prompt, template
// picker, multi-select toolbar, mode banners, mobile dock, Explorer, the
// Activity / Comments / Editor / Context panels, the command palette, and
// the zoom / undo cluster. Extracted from Canvas.tsx verbatim; consumes
// Canvas's props plus the computed ChromeExtras.

// Nothing to exclude when guiding a draw-to-size box: the element doesn't
// exist yet, so every neighbour is a candidate.
const NO_GUIDE_EXCLUDE: Set<string> = new Set();

export function CanvasChrome(props: CanvasChromeProps) {
  const {
    activeDockAnchor,
    activeMobilePanel,
    activityMinimized,
    activityPosition,
    aiPanel,
    canRedo,
    canUndo,
    canvasTool,
    changeLog,
    changeLogLoading,
    commentRows,
    commentsPanelPosition,
    contextBottomY,
    contextPosition,
    currentDiagramId,
    diagramList,
    diagramListLoading,
    diagramName,
    dockButtonRefs,
    drawDrag,
    drawHover,
    editorExpandSignal,
    elements,
    explorerBottomY,
    explorerPosition,
    folders,
    handleDockButtonClick,
    handleResetZoom,
    handleZoomIn,
    handleZoomOut,
    hydrated,
    isGroupMode,
    isOwner,
    isPaintMode,
    marquee,
    minimalPanels,
    multiSelectedIds,
    onActivityRowClick,
    onAddArrow,
    onAddImage,
    onAddShape,
    onAddIcon,
    onAddTable,
    onAddSticky,
    onAddText,
    onBeginFreehand,
    onCancelDraw,
    onCancelFormatPainter,
    onCancelGroup,
    onChooseTemplate,
    onClearActivity,
    onCreateFolder,
    onDeleteDiagram,
    onDeleteFolder,
    onDeleteMultiSelected,
    onDismissShared,
    onDuplicateDiagram,
    onDuplicateMultiSelected,
    onFitToScreen,
    onGroupMultiSelected,
    onMoveActivity,
    onMoveCommentsPanel,
    onMoveContext,
    onMoveDiagramToFolder,
    onMoveExplorer,
    onMovePalette,
    onNewDiagram,
    onOpenCommentsForElement,
    onOpenDiagram,
    onOpenFullExplorer,
    onOpenTemplatePicker,
    onRedo,
    onRenameCurrent,
    onRenameFolder,
    onResetActivity,
    onResetCommentsPanel,
    onResetContext,
    onResetExplorer,
    onResetPalette,
    onRevertChange,
    onSetCanvasTool,
    onSkipTemplatePicker,
    onToggleActivityMinimized,
    onToggleLockMultiSelected,
    onToggleRecogniseShapes,
    onUndo,
    ownerParticipant,
    paletteBottomY,
    palettePosition,
    paletteSelection,
    pendingDraw,
    penPoints,
    readOnly,
    recogniseShapes,
    savedAt,
    saveStatus,
    selectionScope,
    selfParticipant,
    snapGuides,
    distGuides,
    setActiveDockAnchor,
    setActiveMobilePanel,
    setContextBottomY,
    setExplorerBottomY,
    setPaletteBottomY,
    setTabAccordionsOpen,
    sharedDiagrams,
    showTemplatePicker,
    tabAccordionsOpen,
    tabLocked,
    tabName,
    tabSection,
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
  // Alignment guides for the in-progress draw-to-size box, so the user
  // sees which neighbour edges / centres it latched onto — the same faint
  // lines a move / resize shows. Box intents only (arrows are a line,
  // freehand a stroke). drawDrag's start + current are already the
  // SNAPPED points, so alignmentGuides reports a line exactly when a snap
  // is in effect, mirroring the move/resize derivation. Concatenated with
  // the move/resize snapGuides (mutually exclusive in practice) for the
  // single guide overlay below.
  const drawBoxGuides =
    drawDrag && pendingDraw && pendingDraw.type !== 'arrow' && pendingDraw.type !== 'freehand'
      ? alignmentGuides(
          {
            x: Math.min(drawDrag.startX, drawDrag.currentX),
            y: Math.min(drawDrag.startY, drawDrag.currentY),
            width: Math.abs(drawDrag.currentX - drawDrag.startX),
            height: Math.abs(drawDrag.currentY - drawDrag.startY),
          },
          elements,
          NO_GUIDE_EXCLUDE,
        )
      : [];
  // Pre-press start-snap preview: guides for the snapped hover point (a
  // 0×0 candidate), so the user sees the first corner latch before they
  // press. Mutually exclusive with drawBoxGuides (hover is cleared once a
  // drag starts). The snapped dot itself renders below the guide overlay.
  const drawHoverGuides = drawHover
    ? alignmentGuides(
        { x: drawHover.x, y: drawHover.y, width: 0, height: 0 },
        elements,
        NO_GUIDE_EXCLUDE,
      )
    : [];
  const alignGuides =
    drawBoxGuides.length > 0 || drawHoverGuides.length > 0
      ? [...snapGuides, ...drawBoxGuides, ...drawHoverGuides]
      : snapGuides;
  return (
    <>
      {hydrated && elements.length === 0 && !showTemplatePicker && !chromeHidden ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="pointer-events-none flex max-w-sm animate-fly-up-in flex-col items-center rounded-xl border border-slate-200 bg-white px-6 py-5 text-center shadow-md">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-500">
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <rect x="3" y="6" width="10" height="10" rx="1.5" />
                <circle cx="16" cy="14" r="5" />
              </svg>
            </div>
            <p className="text-sm font-semibold text-slate-800">{tabName}</p>
            <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Empty canvas
            </p>
            {readOnly ? (
              // View-role visitors can't add elements or browse
              // templates, so the editor copy + CTA would be
              // misleading. Surface a passive "nothing here yet"
              // line so the empty state still reads as intentional
              // rather than broken.
              <p className="mt-3 text-xs leading-relaxed text-slate-600">
                Nothing has been added to this tab yet. The diagram's owner can build it out, and
                your view will update live.
              </p>
            ) : (
              <>
                <p className="mt-3 text-xs leading-relaxed text-slate-600">
                  Click an element in the Palette to start building your diagram, double-click
                  anywhere to drop text, or connect elements by dragging from their anchor dots.
                </p>
                <button
                  type="button"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={onOpenTemplatePicker}
                  className="pointer-events-auto mt-4 inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700"
                >
                  Browse templates
                </button>
              </>
            )}
          </div>
        </div>
      ) : null}

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

      {multiSelectedIds.size >= 2 && !readOnly ? (
        <MultiSelectionToolbar
          count={multiSelectedIds.size}
          anyLocked={elements.some((el) => multiSelectedIds.has(el.id) && el.locked === true)}
          offsetForOwnerRow={!isOwner}
          onDuplicate={onDuplicateMultiSelected}
          onDelete={onDeleteMultiSelected}
          onGroup={onGroupMultiSelected}
          onToggleLock={onToggleLockMultiSelected}
        />
      ) : null}

      {/* Alignment guides. While a move / resize snap is in effect,
          draw a faint line along each edge / centre the dragged element
          now shares with a neighbour, so the user sees WHY it snapped.
          Canvas coords convert to client coords via the wrapper rect +
          zoom (same as the draw / pen previews). The colour follows the
          theme: the theme's element stroke when it sets one, else a
          slate tuned to contrast with the theme's backdrop — faint via
          opacity so it reads as helper chrome, not content. */}
      {alignGuides.length > 0
        ? (() => {
            const rect = wrapperRef.current?.getBoundingClientRect();
            if (!rect) return null;
            const theme = getTheme(tabThemeId);
            const color = theme.elementStroke ?? deriveTextColorForBg(theme.backgroundColor);
            return (
              <svg aria-hidden className="pointer-events-none fixed inset-0 z-30 h-screen w-screen">
                {alignGuides.map((g, i) => {
                  // Convert the guide's canvas-space line into the two
                  // screen-space endpoints. A vertical guide (axis 'x')
                  // holds x constant and runs start→end in y; horizontal
                  // is the mirror.
                  const x1 = rect.left + (g.axis === 'x' ? g.position : g.start) * viewportZoom;
                  const y1 = rect.top + (g.axis === 'x' ? g.start : g.position) * viewportZoom;
                  const x2 = rect.left + (g.axis === 'x' ? g.position : g.end) * viewportZoom;
                  const y2 = rect.top + (g.axis === 'x' ? g.end : g.position) * viewportZoom;
                  return (
                    <line
                      key={`${g.axis}:${g.position}:${i}`}
                      x1={x1}
                      y1={y1}
                      x2={x2}
                      y2={y2}
                      stroke={color}
                      strokeWidth={1}
                      strokeOpacity={0.55}
                      strokeDasharray="4 3"
                    />
                  );
                })}
              </svg>
            );
          })()
        : null}

      {/* Pre-press start-snap dot. While a draw is armed and the hovered
          pointer has snapped to a neighbour, mark the snapped point so the
          user knows where the first corner will land before pressing (the
          guide lines above show what it aligned to). */}
      {drawHover
        ? (() => {
            const rect = wrapperRef.current?.getBoundingClientRect();
            if (!rect) return null;
            const x = rect.left + drawHover.x * viewportZoom;
            const y = rect.top + drawHover.y * viewportZoom;
            return (
              <svg aria-hidden className="pointer-events-none fixed inset-0 z-30 h-screen w-screen">
                <circle
                  cx={x}
                  cy={y}
                  r={3.5}
                  fill="rgb(14, 165, 233)"
                  stroke="white"
                  strokeWidth={1.5}
                />
              </svg>
            );
          })()
        : null}

      {/* Equal-spacing (distribution) guides. While a move snaps an
          element to even spacing with its neighbours, draw the matched
          gap segments as pink tick-capped lines so the equal distances
          read at a glance. Same canvas→screen conversion as above. */}
      {distGuides.length > 0
        ? (() => {
            const rect = wrapperRef.current?.getBoundingClientRect();
            if (!rect) return null;
            const cx = (v: number) => rect.left + v * viewportZoom;
            const cy = (v: number) => rect.top + v * viewportZoom;
            const color = 'rgb(236, 72, 153)'; // pink-500, distinct from alignment
            return (
              <svg aria-hidden className="pointer-events-none fixed inset-0 z-30 h-screen w-screen">
                {distGuides.flatMap((g, gi) =>
                  g.spans.map((s, si) => {
                    const key = `${gi}:${si}`;
                    if (g.axis === 'x') {
                      const x1 = cx(s.from);
                      const x2 = cx(s.to);
                      const y = cy(s.cross);
                      return (
                        <g key={key} stroke={color} strokeWidth={1}>
                          <line x1={x1} y1={y} x2={x2} y2={y} />
                          <line x1={x1} y1={y - 4} x2={x1} y2={y + 4} />
                          <line x1={x2} y1={y - 4} x2={x2} y2={y + 4} />
                        </g>
                      );
                    }
                    const y1 = cy(s.from);
                    const y2 = cy(s.to);
                    const x = cx(s.cross);
                    return (
                      <g key={key} stroke={color} strokeWidth={1}>
                        <line x1={x} y1={y1} x2={x} y2={y2} />
                        <line x1={x - 4} y1={y1} x2={x + 4} y2={y1} />
                        <line x1={x - 4} y1={y2} x2={x + 4} y2={y2} />
                      </g>
                    );
                  }),
                )}
              </svg>
            );
          })()
        : null}

      {marquee ? (
        <div
          aria-hidden
          className="pointer-events-none fixed z-30 rounded-sm border border-brand-500 bg-brand-500/10"
          style={{
            left: Math.min(marquee.startX, marquee.currentX),
            top: Math.min(marquee.startY, marquee.currentY),
            width: Math.abs(marquee.currentX - marquee.startX),
            height: Math.abs(marquee.currentY - marquee.startY),
          }}
        />
      ) : null}

      {/* Draw-to-size preview. drawDrag holds canvas coords; convert
          to client coords via the wrapper rect + viewportZoom so the
          overlay aligns with the canvas content under it. The shape
          itself renders via ShapeSvgOverlay (the same primitive
          BoxedElementView uses for committed shapes) with a dashed-
          brand stroke + translucent brand fill, so "draw circle"
          looks like an oval, "draw diamond" like a diamond, etc.
          The three simple kinds (square / circle / stadium) bypass
          SVG and use border-radius on the wrapping div, matching
          how BoxedElementView renders them at rest. */}
      {/* Pen-gesture live preview. While the user is drawing freehand,
          paint the in-progress polyline as a brand-tinted stroke so
          they can see what they're sketching. Sits on the same z-30
          overlay layer as the draw-to-size box preview. Switches to
          the committed FreehandSvg after release (the next render
          tick once the new element lands in `elements`). */}
      {penPoints && pendingDraw?.type === 'freehand' && penPoints.length >= 2
        ? (() => {
            const rect = wrapperRef.current?.getBoundingClientRect();
            if (!rect) return null;
            // Build an SVG polyline string from the sampled canvas-
            // coord points, converted to client coords via the
            // wrapper rect + zoom so the overlay aligns with the
            // canvas content.
            const d = penPoints
              .map(
                (p, i) =>
                  `${i === 0 ? 'M' : 'L'} ${rect.left + p.x * viewportZoom} ${
                    rect.top + p.y * viewportZoom
                  }`,
              )
              .join(' ');
            return (
              <svg aria-hidden className="pointer-events-none fixed inset-0 z-30 h-screen w-screen">
                <path
                  d={d}
                  fill="none"
                  stroke="rgb(14, 165, 233)"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            );
          })()
        : null}

      {drawDrag && pendingDraw
        ? (() => {
            const rect = wrapperRef.current?.getBoundingClientRect();
            if (!rect) return null;
            // Arrow intent: render the drag as a line from the start
            // point to the current point, with a small chevron-like
            // arrowhead near the end so the user sees the direction
            // they've drawn (the committed arrow defaults to no
            // arrowheads; this is just preview chrome).
            if (pendingDraw.type === 'arrow') {
              const x1 = rect.left + drawDrag.startX * viewportZoom;
              const y1 = rect.top + drawDrag.startY * viewportZoom;
              const x2 = rect.left + drawDrag.currentX * viewportZoom;
              const y2 = rect.top + drawDrag.currentY * viewportZoom;
              return (
                <svg
                  aria-hidden
                  className="pointer-events-none fixed inset-0 z-30 h-screen w-screen"
                >
                  <line
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke="rgb(14, 165, 233)"
                    strokeWidth={1.5}
                    strokeDasharray="4 3"
                  />
                </svg>
              );
            }
            const canvasMinX = Math.min(drawDrag.startX, drawDrag.currentX);
            const canvasMinY = Math.min(drawDrag.startY, drawDrag.currentY);
            const canvasW = Math.abs(drawDrag.currentX - drawDrag.startX);
            const canvasH = Math.abs(drawDrag.currentY - drawDrag.startY);
            const widthPx = Math.max(canvasW * viewportZoom, 1);
            const heightPx = Math.max(canvasH * viewportZoom, 1);
            const usesSvg = pendingDraw.type === 'shape' && isSvgRenderedShape(pendingDraw.kind);
            // Box intents: square / circle / stadium use border-
            // radius on the wrapping div (matching the BoxedElementView
            // at-rest treatment), every SVG-rendered shape kind
            // delegates to ShapeSvgOverlay, and text / sticky / image
            // fall back to a simple dashed-rect. The text + sticky
            // + image branches use 4px corners; stickies don't get
            // their corner-fold preview here because the preview is
            // very small and a peeled corner just reads as noise.
            const radius =
              pendingDraw.type === 'shape' && pendingDraw.kind === 'circle'
                ? '50%'
                : pendingDraw.type === 'shape' && pendingDraw.kind === 'stadium'
                  ? '9999px'
                  : '4px';
            return (
              <div
                aria-hidden
                className="pointer-events-none fixed z-30"
                style={{
                  left: rect.left + canvasMinX * viewportZoom,
                  top: rect.top + canvasMinY * viewportZoom,
                  width: widthPx,
                  height: heightPx,
                }}
              >
                {usesSvg && pendingDraw.type === 'shape' ? (
                  <ShapeSvgOverlay
                    shape={pendingDraw.kind}
                    fill="rgba(14, 165, 233, 0.10)"
                    stroke="rgb(14, 165, 233)"
                    strokeWidth={1.5}
                    strokeDasharray="4 3"
                  />
                ) : (
                  <div
                    className="h-full w-full border border-dashed border-brand-500 bg-brand-500/10"
                    style={{ borderRadius: radius }}
                  />
                )}
              </div>
            );
          })()
        : null}

      {isPaintMode ? (
        <ModeBanner
          icon={
            <svg
              width="14"
              height="14"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M13.5 2.5l-6 6" />
              <path d="M7 8l1.5 1.5" />
              <path d="M6.5 9.5a3 3 0 1 0 1 4.5c.5-.6.5-1.4 0-2-.6-.5-1.4-.5-2 0" />
            </svg>
          }
          message="Click an element to apply formatting"
          onAction={onCancelFormatPainter}
        />
      ) : null}

      {isGroupMode ? (
        <ModeBanner
          icon={
            <svg
              width="14"
              height="14"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinejoin="round"
              aria-hidden
            >
              <rect x="2.25" y="2.25" width="8" height="8" rx="1.25" />
              <rect x="5.75" y="5.75" width="8" height="8" rx="1.25" fill="white" />
            </svg>
          }
          message="Click another element to add to the group"
          actionLabel="Done"
          onAction={onCancelGroup}
        />
      ) : null}

      {pendingDraw ? (
        <ModeBanner
          icon={
            <svg
              width="14"
              height="14"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinejoin="round"
              aria-hidden
            >
              <rect x="2.5" y="2.5" width="11" height="11" rx="1.5" strokeDasharray="2 1.5" />
              <path d="M5.5 5.5l5 5" />
            </svg>
          }
          message={drawBannerMessage(pendingDraw, isMobileViewportSync())}
          onAction={onCancelDraw}
          // Pen-mode-only extras slot: the "recognise shapes" toggle.
          // Icon-only with a Tooltip (bold title + one-line
          // description) so the symbol's meaning is discoverable
          // without clutter; the pressed state (brand-200 fill)
          // signals when the mode is active so the user always
          // knows whether the next stroke will convert or stay as a
          // sketch. The on/off state is a persisted user preference
          // (spec/20 `recogniseShapes`) lifted to editor-page, so it
          // survives across pencil sessions and across devices.
          extras={
            pendingDraw.type === 'freehand' ? (
              <Tooltip
                title={recogniseShapes ? 'Recognise shapes: on' : 'Recognise shapes: off'}
                description={
                  recogniseShapes
                    ? 'Strokes that resemble rectangles, circles, diamonds, or lines auto-convert. Click to keep sketches as-is.'
                    : 'Click to auto-convert strokes that resemble rectangles, circles, diamonds, or lines.'
                }
              >
                <button
                  type="button"
                  onClick={onToggleRecogniseShapes}
                  aria-label="Toggle shape recognition"
                  aria-pressed={recogniseShapes}
                  className={
                    'flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium transition ' +
                    (recogniseShapes
                      ? 'bg-brand-200 text-brand-900 hover:bg-brand-300'
                      : 'bg-white text-slate-700 hover:bg-slate-50')
                  }
                >
                  {/* Sparkle / magic-wand glyph signals "auto" without
                      being a literal AI motif. Two-star composition
                      so it parses at 14px. */}
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 16 16"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden
                  >
                    <path d="M6 2 L6.9 4.6 L9.5 5.5 L6.9 6.4 L6 9 L5.1 6.4 L2.5 5.5 L5.1 4.6 Z" />
                    <path d="M11.5 9 L12.1 10.4 L13.5 11 L12.1 11.6 L11.5 13 L10.9 11.6 L9.5 11 L10.9 10.4 Z" />
                  </svg>
                </button>
              </Tooltip>
            ) : undefined
          }
        />
      ) : null}

      <CanvasMobileDock
        welcomeOpen={chromeHidden}
        minimalPanels={minimalPanels}
        readOnly={readOnly}
        hasAi={!!aiPanel}
        activeMobilePanel={activeMobilePanel}
        dockButtonRefs={dockButtonRefs}
        onDockButtonClick={handleDockButtonClick}
      />

      {/* Explorer is the one piece of chrome that stays visible during
          the welcome flow — the sign-up nudge is genuinely useful there
          and lives outside the diagram's controls. Zen mode hides it
          along with everything else (spec/26). */}
      {zenMode ? null : (
        <Explorer
          position={explorerPosition}
          diagrams={diagramList}
          folders={folders}
          loading={diagramListLoading}
          shared={sharedDiagrams}
          onDismissShared={onDismissShared}
          onOpenFullExplorer={onOpenFullExplorer}
          currentDiagramId={currentDiagramId}
          onMoveTo={onMoveExplorer}
          onReset={onResetExplorer}
          onOpenDiagram={onOpenDiagram}
          onNewDiagram={onNewDiagram}
          onRenameCurrent={onRenameCurrent}
          onDeleteDiagram={onDeleteDiagram}
          onDuplicateDiagram={onDuplicateDiagram}
          onCreateFolder={onCreateFolder}
          onRenameFolder={onRenameFolder}
          onDeleteFolder={onDeleteFolder}
          onMoveDiagramToFolder={onMoveDiagramToFolder}
          onSize={(size) => setExplorerBottomY(size.bottomY)}
          mobileOpenOverride={activeMobilePanel === 'explorer' ? true : false}
          mobileDockAnchor={activeDockAnchor ?? undefined}
          forceDockMode={!!minimalPanels}
          onMobileClose={() => {
            setActiveMobilePanel(null);
            setActiveDockAnchor(null);
          }}
        />
      )}

      {/* Activity panel — per-diagram audit log + Undo/Redo. Hidden
          during the welcome flow because there's nothing to audit
          yet and Undo/Redo would target an empty history. */}
      {/* Comments panel is desktop-only chrome: on mobile, the canvas
          is already tight, the per-element comment popover stays
          available for viewing / replying, and a floating cheat
          sheet of threads would crowd the surface that's already
          banner-collapsing the Palette + Editor. Wrapped in
          `hidden sm:contents` so the MovablePanel beneath gets
          `display: none` on phones without changing its props.
          Mount is also gated on contextBottomY > 0 so the panel
          waits until the Editor pane above has reported its size:
          mounting before that would let MovablePanel fall back to
          its static top-[15rem], landing the panel BEHIND the
          Editor pane (Editor renders later in the DOM and wins
          z-order) instead of stacking cleanly under it. */}
      {!chromeHidden && commentRows.length > 0 && contextBottomY > 0 ? (
        <div className="hidden sm:contents">
          <CommentsPanel
            position={commentsPanelPosition}
            rows={commentRows}
            stackBelowY={contextBottomY}
            onMoveTo={onMoveCommentsPanel}
            onReset={onResetCommentsPanel}
            onRowClick={onOpenCommentsForElement}
          />
        </div>
      ) : null}

      {!chromeHidden && aiPanel ? (
        <MovablePanel
          title="AI Assistant"
          position={aiPanel.position}
          defaultCorner="top-right-stacked"
          stackBelowY={contextBottomY}
          width="w-auto sm:w-64"
          collapsible
          onReset={aiPanel.onReset}
          onMoveTo={aiPanel.onMove}
          mobileOpenOverride={activeMobilePanel === 'ai' ? true : false}
          mobileDockAnchor={activeDockAnchor ?? undefined}
          forceDockMode={!!minimalPanels}
          onMobileClose={() => {
            setActiveMobilePanel(null);
            setActiveDockAnchor(null);
          }}
        >
          <AiPanelContent
            contextElements={aiPanel.contextElements}
            focusIds={aiPanel.focusIds}
            tabName={tabName}
            ownerId={aiPanel.ownerId}
            onApplyElements={aiPanel.onApplyElements}
          />
        </MovablePanel>
      ) : null}

      {chromeHidden ? null : (
        <ActivityPanel
          position={activityPosition}
          minimized={activityMinimized}
          tabLocked={tabLocked}
          entries={changeLog}
          loading={changeLogLoading}
          readOnly={readOnly}
          canUndo={canUndo}
          canRedo={canRedo}
          onUndo={onUndo}
          onRedo={onRedo}
          onRevert={onRevertChange}
          onRowClick={onActivityRowClick}
          onClearActivity={onClearActivity}
          saveStatus={saveStatus}
          savedAt={savedAt}
          onMoveTo={onMoveActivity}
          onReset={onResetActivity}
          onToggleMinimized={onToggleActivityMinimized}
        />
      )}

      {/* Top-middle status row. Only renders for visitors (non-owners):
          owners already know it's their own diagram and that they're
          editing, so the extra chrome is just noise. Visitors see who
          owns it ("Owner: <avatar> <name>", when the owner is in the
          room and so reachable via livePresence) and their own role
          (Viewing in amber, Editing in green). Pointer events stay off
          so the badges don't intercept clicks on the canvas. Hidden
          below sm because the same top-row real estate carries the
          Explorer / Palette / Editor banner pills there, and the
          Owner pill overlaps them. The role is still discoverable
          from the canvas chrome (no-add palette + locked element
          affordances for view-role), so dropping the badge on a
          phone is a small loss for a meaningful layout win. */}
      {!isOwner && !zenMode ? (
        <div className="pointer-events-none absolute left-1/2 top-3 z-30 hidden -translate-x-1/2 items-center gap-2 sm:flex">
          {ownerParticipant ? (
            <div className="flex items-center gap-1.5 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-medium text-slate-700 shadow-sm dark:bg-slate-900/90 dark:text-slate-200">
              <span className="text-slate-500 dark:text-slate-400">Owner:</span>
              <ParticipantAvatar participant={ownerParticipant} size={14} />
              <span className="max-w-[10rem] truncate">{ownerParticipant.name}</span>
            </div>
          ) : null}
          <div
            className={
              'rounded-full px-2.5 py-1 text-[11px] font-medium shadow-sm ' +
              (readOnly
                ? 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-200'
                : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-200')
            }
          >
            {readOnly ? 'Viewing' : 'Editing'}
          </div>
        </div>
      ) : null}
      {chromeHidden || readOnly ? null : (
        <CommandPalette
          position={palettePosition}
          canvasTool={canvasTool}
          onSetCanvasTool={onSetCanvasTool}
          onToggleZen={onToggleZen}
          onMoveTo={onMovePalette}
          onReset={onResetPalette}
          onAddShape={onAddShape}
          onAddIcon={onAddIcon}
          onAddTable={onAddTable}
          onAddText={onAddText}
          onAddSticky={onAddSticky}
          onAddImage={onAddImage}
          onAddArrow={onAddArrow}
          onBeginFreehand={onBeginFreehand}
          pendingDraw={pendingDraw}
          onSize={(size) => setPaletteBottomY(size.bottomY)}
          mobileTopOverridePx={explorerBottomY > 0 ? explorerBottomY + 4 : undefined}
          mobileOpenOverride={activeMobilePanel === 'palette' ? true : false}
          mobileDockAnchor={activeDockAnchor ?? undefined}
          forceDockMode={!!minimalPanels}
          onMobileClose={() => {
            setActiveMobilePanel(null);
            setActiveDockAnchor(null);
          }}
        />
      )}

      {chromeHidden || readOnly ? null : (
        <ContextPanel
          position={contextPosition}
          selection={paletteSelection}
          selectionScope={selectionScope}
          tab={tabSection}
          tabAccordionsOpen={tabAccordionsOpen}
          setTabAccordionsOpen={setTabAccordionsOpen}
          expandSignal={editorExpandSignal}
          onMoveTo={onMoveContext}
          onReset={onResetContext}
          stackBelowY={
            palettePosition !== null || paletteBottomY === 0 ? undefined : paletteBottomY
          }
          onSize={(size) => setContextBottomY(size.bottomY)}
          mobileOpenOverride={activeMobilePanel === 'editor' ? true : false}
          mobileDockAnchor={activeDockAnchor ?? undefined}
          forceDockMode={!!minimalPanels}
          onMobileClose={() => {
            setActiveMobilePanel(null);
            setActiveDockAnchor(null);
          }}
        />
      )}

      {/* Bottom dock. Order, left → right: Zoom controls, History
          controls, and a minimised Activity dock when applicable.
          The Palette + Editor are banner-collapsed in place (spec/09)
          so they're not in the dock cluster; the Explorer is hidden
          on mobile entirely (spec/07) and uses banner-collapse on
          desktop, so it's also not in the dock cluster. */}
      <div className="pointer-events-none absolute bottom-4 right-4 z-10 flex items-center gap-2">
        {welcomeOpen ? null : (
          <>
            {!zenMode && activityMinimized ? (
              // Collapsed Activity dock: a single Open button in
              // view-role mode (visitors can still see the audit
              // trail by opening the panel, just not undo/redo it);
              // a wider strip with inline Undo / Redo for editor
              // sessions so the most common history actions don't
              // require reopening the panel.
              readOnly ? (
                <DockButton
                  label="Open Tab Activity"
                  description="Expand the Tab Activity panel."
                  icon={<ActivityIcon />}
                  onClick={onToggleActivityMinimized}
                />
              ) : (
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
              )
            ) : null}
            <ZoomControls
              zoom={viewportZoom}
              onZoomIn={handleZoomIn}
              onZoomOut={handleZoomOut}
              onReset={handleResetZoom}
              onFitToScreen={onFitToScreen}
              onExitZen={zenMode ? onToggleZen : undefined}
            />
          </>
        )}
      </div>
    </>
  );
}
