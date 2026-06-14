import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import {
  defaultTextAlign,
  isBoxed,
  snapResizeBounds,
  snapToAlignment,
  supportsColours,
  type ShapeKind,
} from '@livediagram/diagram';
import { ICON_DND_MIME, PALETTE_DND_MIME } from '@/lib/icons';
import { TECH_ICON_DND_MIME } from '@/lib/tech-icons';
import { tabBackgroundStyle } from '@/lib/canvas-backgrounds';
import { ZOOM_MIN, ZOOM_MAX } from '@/lib/canvas';
import { deriveCanvasSelection, deriveSelectedElementFields } from '@/lib/canvas-selection';
import { canvasCursorClass } from '@/lib/canvas-chrome';
import { useCanvasMobileDock } from '@/hooks/useCanvasMobileDock';
import { drawIntentCursor } from '@/lib/draw-mode';
import { track } from '@/lib/telemetry';
import { type SelectedElementControls } from './CommandPalette';
// Lazy-load CommentsPanel: only mounts when the active tab has at
// least one element with comments AND the ContextPanel has reported
// its bottom edge (so we don't paint the panel at the legacy fallback
// position). Most diagrams never accumulate comments, so deferring
// the 164-line panel + its formatRelativeTimeShort + useRelativeTimeTick
// dependencies keeps the editor's initial chunk lean.
import { useCanvasPanAndMarquee } from '@/hooks/useCanvasPanAndMarquee';
import { getTheme } from '@/lib/themes';
// Lazy-load MultiSelectionToolbar: only mounts when the user has
// drag-marquee'd two or more elements. Most sessions never trigger
// it (single-element edits dominate), so deferring the 172-line
// toolbar + its icon set keeps the editor's initial chunk lean.
// Same pattern as the editor's other gated modals (NotePopover,
// TabLinkPicker, etc.).
import { SelectionPopover } from './SelectionPopover';
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

// Reused as the excludeIds argument to snapResizeBounds during draw-
// to-size: the new element doesn't exist yet, so there's nothing to
// exclude. A module-level frozen Set keeps the snap effect from
// allocating a new Set on every pointermove.
const EMPTY_ID_SET: Set<string> = new Set();

import { CanvasChrome } from './CanvasChrome';
import { CanvasElementsLayer } from './CanvasElementsLayer';
import { TabLoadOverlay } from './TabLoadOverlay';
import type { CanvasProps } from './Canvas.types';

export function Canvas(props: CanvasProps) {
  const {
    tabLocked,
    readOnly,
    tabBackgroundPattern,
    tabBackgroundColor,
    tabBackgroundOpacity,
    tabPatternColor,
    tabFont,
    onSetTabFont,
    tabDefaultTextSize,
    onSetTabDefaultTextSize,
    mainRef,
    isPinchingRef,
    viewportOffset,
    setViewportOffset,
    viewportZoom,
    setViewportZoom,
    elements,
    selectedId,
    multiSelectedIds,
    onSelectMarquee,
    canvasTool,
    onCanvasPointerMove,
    editingId,
    formatSourceId,
    groupSourceId,
    pendingDraw,
    onCommitDraw,
    onCommitFreehand,
    recogniseShapes,
    onDeselect,
    onSelect,
    onCanvasContextMenu,
    onElementContextMenu,
    onMultiContextMenu,
    onShiftSelect,
    onBeginFormatPainter,
    onBeginGroup,
    onUngroup,
    onBringToFront,
    onSendToBack,
    onSetTextSize,
    onSetTextAlign,
    onToggleTextBold,
    onToggleTextItalic,
    onToggleTextUnderline,
    onToggleTextStrikethrough,
    onSetFont,
    onSetFillColor,
    onSetStrokeColor,
    onSetTextColor,
    onSetOpacity,
    onResetColors,
    onSetPadding,
    onSetArrowEnds,
    onSetArrowThickness,
    onSetArrowheadSize,
    onSetArrowheadShape,
    onToggleTableHeaderRow,
    onToggleTableHeaderColumn,
    onToggleTableZebra,
    onSetTableHeaderFill,
    onSetTableHeaderTextColor,
    onSetArrowStyle,
    onSetArrowStrokeStyle,
    onSetShapeKind,
    onSetBorderStroke,
    onSetBorderStyle,
    onSetBorderRadius,
    onOpenComments,
    onOpenElementContextMenu,
    tabThemeId,
    onSetTheme,
    onResetElementsToTheme,
    onExportTab,
    onImportTab,
    importError,
    onAutoAlign,
    canAutoAlign,
    recentImages,
    imageOwnerId,
    imageDiagramId,
    imageShareCode,
    onAddImageFromGallery,
    onSetBackgroundPattern,
    onSetBackgroundColor,
    onSetBackgroundOpacity,
    onSetPatternColor,
    onToggleAspectLock,
    onToggleLockSelected,
    onDeleteSelected,
    onDuplicateSelected,
    onCanvasDoubleClick,
    tabLoadState,
    onRetryTabLoad,
  } = props;

  const wrapperRef = useRef<HTMLDivElement>(null);

  const isPaintMode = formatSourceId !== null;
  const isGroupMode = groupSourceId !== null;

  // Pan tracking. viewportOffset is owned by the page (so element placement
  // can reason about the visible viewport); we just read/write through props.
  // Palette's bottom-Y (offsetTop + offsetHeight in offsetParent
  // coords). The ContextPanel uses this to stack dynamically below
  // the Palette as accordions open / close and as the banner
  // collapses; MovablePanel publishes it via onSize. The bottom-Y
  // (vs height alone) makes the alignment robust to the upper
  // panel's own top-utility class, the editor lands at
  // paletteBottomY + 16 regardless of whether the palette pins to
  // top-2 (mobile) or top-4 (desktop).
  const [paletteBottomY, setPaletteBottomY] = useState<number>(0);
  // Explorer's measured bottom edge on mobile. The Palette sits BELOW
  // this via its `mobileTopOverridePx` so the diagram switcher fits
  // above the Palette without overlapping. Desktop ignores it (the
  // Explorer pins to top-left there, not as a banner).
  const [explorerBottomY, setExplorerBottomY] = useState<number>(0);
  // ContextPanel's measured bottom edge. Drives the CommentsPanel's
  // top-right-stacked positioning so it lands directly under the
  // Editor pane on first paint and slides when Editor expands /
  // collapses.
  const [contextBottomY, setContextBottomY] = useState<number>(0);
  // Which quick-connect ring (if any) is currently open, lifted here so
  // only one opens at a time and the selection toolbar can dodge the
  // top ring (see SelectionPopover forceBelow below). Reset whenever the
  // selection changes, and closed by any pointerdown outside a ring.
  const [quickRingOpen, setQuickRingOpen] = useState<'right' | 'below' | 'left' | 'above' | null>(
    null,
  );
  useEffect(() => {
    setQuickRingOpen(null);
  }, [selectedId]);
  useEffect(() => {
    if (!quickRingOpen) return;
    const onDown = (e: PointerEvent) => {
      if (!(e.target as HTMLElement)?.closest?.('[data-quick-ring]')) setQuickRingOpen(null);
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [quickRingOpen]);
  // Mobile dock state + toggle (compact button row replacing the four
  // full-width collapse banners on mobile). See useCanvasMobileDock; the
  // popover anchor math is the tested computeDockAnchor.
  const {
    activeMobilePanel,
    setActiveMobilePanel,
    dockButtonRefs,
    activeDockAnchor,
    setActiveDockAnchor,
    handleDockButtonClick,
  } = useCanvasMobileDock(mainRef);

  // Pan + marquee + held-Space machinery lives in
  // useCanvasPanAndMarquee. The hook owns the pointerdown / move
  // / up listeners and the rect-vs-element marquee intersection,
  // exposes pan / marquee state + setters back so the canvas's
  // own pointerdown handlers can drive it, and exposes the
  // spaceHeldRef the pointerdown reads to decide pan vs marquee.
  const { pan, setPan, marquee, setMarquee, spaceHeldRef } = useCanvasPanAndMarquee({
    viewportZoom,
    setViewportOffset,
    elements,
    wrapperRef,
    onDeselect,
    onSelectMarquee,
    isPinchingRef,
  });

  const zoomStep = 0.1;
  const clampZoom = (z: number) => Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, z));
  const handleZoomIn = () => {
    setViewportZoom(clampZoom(viewportZoom + zoomStep));
    track('Canvas', 'Zoomed', 'In');
  };
  const handleZoomOut = () => {
    setViewportZoom(clampZoom(viewportZoom - zoomStep));
    track('Canvas', 'Zoomed', 'Out');
  };
  const handleResetZoom = () => {
    setViewportZoom(1);
    track('Canvas', 'Zoomed', 'Reset');
  };

  // Selection-display derivation (primary element, bounds, and every
  // "show this chrome?" predicate) lives in lib/canvas-selection.ts so
  // it's unit-tested. Memoised because selectionMembers walks every
  // element and Canvas re-renders on every drag tick.
  const canvasSelection = useMemo(
    () =>
      deriveCanvasSelection({
        elements,
        selectedId,
        multiSelectedIds,
        editingId,
        isPaintMode,
        isGroupMode,
        tabLocked,
        readOnly,
      }),
    [
      elements,
      selectedId,
      multiSelectedIds,
      editingId,
      isPaintMode,
      isGroupMode,
      tabLocked,
      readOnly,
    ],
  );
  const {
    memberIds,
    selected,
    selectionScope,
    selectedIsBoxed,
    selectedIsGrouped,
    selectionBounds,
    selectedLocked,
    showPopover,
    showPlus,
    showHandlesFor: showHandles,
    showAnchorsFor,
    unionResizeBounds,
    unionResizePrimaryId,
    showUnionResize,
  } = canvasSelection;

  // Cached check only. Render loops iterate `elements` directly so
  // arrows and boxed elements interleave in z-order (see render
  // block below); the only thing we still need eagerly is "are
  // there any arrows" to decide whether to mount the ArrowDefs.
  // `some` short-circuits on the first arrow (which is usually
  // near the front of the list once a diagram has any), so the
  // typical render pays O(1); the prior reduce was unconditional
  // O(N) for the sole purpose of computing a boolean.
  const hasArrows = elements.some((el) => el.type === 'arrow');

  const cursorClass = canvasCursorClass({
    pendingDraw: !!pendingDraw,
    pan: !!pan,
    marquee: !!marquee,
    canvasTool,
    spaceHeld: spaceHeldRef.current,
    isPaintMode,
    isGroupMode,
  });

  const selectionSupportsColours = selected ? supportsColours(selected) : false;
  const selectedDefaultAlign = selected && isBoxed(selected) ? defaultTextAlign(selected) : null;
  const paletteSelection: SelectedElementControls | null = selected
    ? {
        // Field values are the pure, type-gated projection
        // (deriveSelectedElementFields); the on* handlers are bundled in
        // around them here.
        ...deriveSelectedElementFields(selected, selectionSupportsColours, selectedDefaultAlign),
        onBringToFront,
        onSendToBack,
        onSetTextSize,
        onSetTextAlign,
        onToggleTextBold,
        onToggleTextItalic,
        onToggleTextUnderline,
        onToggleTextStrikethrough,
        onSetFont,
        onSetTextColor,
        onSetFillColor,
        onSetStrokeColor,
        onSetOpacity,
        onResetColors,
        onSetPadding,
        onSetArrowEnds,
        onSetArrowThickness,
        onSetArrowheadSize,
        onSetArrowheadShape,
        onToggleTableHeaderRow,
        onToggleTableHeaderColumn,
        onToggleTableZebra,
        onSetTableHeaderFill,
        onSetTableHeaderTextColor,
        onSetArrowStyle,
        onSetArrowStrokeStyle,
        onSetShapeKind,
        onToggleAspectLock,
        onSetBorderStroke,
        onSetBorderStyle,
        onSetBorderRadius,
      }
    : null;

  const tabSection = {
    backgroundPattern: tabBackgroundPattern,
    backgroundColor: tabBackgroundColor,
    backgroundOpacity: tabBackgroundOpacity,
    patternColor: tabPatternColor,
    onSetBackgroundOpacity,
    themeId: tabThemeId,
    font: tabFont ?? null,
    onSetTabFont,
    defaultTextSize: tabDefaultTextSize ?? null,
    onSetTabDefaultTextSize,
    onSetBackgroundPattern,
    onSetBackgroundColor,
    onSetPatternColor,
    onSetTheme,
    onResetElementsToTheme,
    onExportTab,
    onImportTab,
    importError,
    onAutoAlign,
    canAutoAlign,
    recentImages,
    imageOwnerId,
    imageDiagramId,
    imageShareCode,
    onAddImageFromGallery,
    // Live session tools (spec/39): timer + vote facilitator controls.
    timer: props.tabTimer,
    vote: props.tabVote,
    onStartTimer: props.onStartTimer,
    onPauseTimer: props.onPauseTimer,
    onResumeTimer: props.onResumeTimer,
    onResetTimer: props.onResetTimer,
    onClearTimer: props.onClearTimer,
    onStartVote: props.onStartVote,
    onEndVote: props.onEndVote,
    onRevealVote: props.onRevealVote,
    onClearVote: props.onClearVote,
  };

  // Colour for the link / comment badges. The active theme's
  // elementStroke is the obvious "this theme's accent" — it's what
  // arrows and new shape outlines use. The Brand theme has no stroke
  // override, so fall back to brand-500 (the hex behind bg-brand-500).
  const badgeColor = getTheme(tabThemeId).elementStroke ?? '#0ea5e9';

  // Broadcast the local pointer position to peers (canvas-coords).
  // Throttling lives in page.tsx so the Canvas stays prop-driven.
  const handlePointerMoveCanvas = (e: React.PointerEvent) => {
    const rect = wrapperRef.current?.getBoundingClientRect();
    if (!rect) return;
    const sx = (e.clientX - rect.left) / viewportZoom;
    const sy = (e.clientY - rect.top) / viewportZoom;
    onCanvasPointerMove(sx, sy);
  };
  const handlePointerLeaveCanvas = () => {
    onCanvasPointerMove(null, null);
  };

  // Stable wrapper for the element-right-click flow. BoxedElementView
  // is memoed; passing inline arrows for `onContextSelect` would
  // recreate them per element per render and invalidate the memo.
  // useCallback gives it one identity across renders, so the memoed
  // child sees the same function reference until `onSelect` or
  // `onElementContextMenu` itself changes upstream.
  const handleElementContextSelect = useCallback(
    (id: string, sx: number, sy: number) => {
      // Right-clicking a member of an active multi-selection keeps the whole
      // selection and opens a selection-wide menu. Right-clicking a grouped
      // element selects the group (which expands to all members) and opens
      // the same menu. Otherwise it's a single element.
      const inMarquee = multiSelectedIds.size > 1 && multiSelectedIds.has(id);
      const el = elements.find((e) => e.id === id);
      const grouped = !!el && isBoxed(el) && !!el.groupId;
      if (inMarquee && onMultiContextMenu) {
        onMultiContextMenu(sx, sy);
        return;
      }
      if (grouped && onMultiContextMenu) {
        onSelect(id);
        onMultiContextMenu(sx, sy);
        return;
      }
      onSelect(id);
      onElementContextMenu?.(id, sx, sy);
    },
    [onSelect, onElementContextMenu, onMultiContextMenu, elements, multiSelectedIds],
  );

  // Stable wrapper for the arrow click flow. Same rationale as
  // handleElementContextSelect: a per-arrow inline arrow at the
  // call site would defeat ArrowView's memo on every render of the
  // Canvas. Mirrors BoxedElementView's shift-modifier semantics so
  // an arrow can join a marquee multi-selection via plain click
  // (when one is active) or Shift-click. Reading the latest
  // `multiSelectedIds` through a ref keeps this callback stable
  // even as the selection set changes.
  const multiSelectedIdsRef = useRef(multiSelectedIds);
  useEffect(() => {
    multiSelectedIdsRef.current = multiSelectedIds;
  }, [multiSelectedIds]);

  // Draw-to-size gesture state. Set when the user starts a drag on
  // the canvas while pendingDraw is set; cleared on pointer-up
  // (either when onCommitDraw persists the element or the drag was
  // cancelled). Coords are stored as canvas coords (pre-divided by
  // viewportZoom) so the preview renders in the same space as the
  // rest of the canvas content. `current` is the snapped point, not
  // the raw pointer, so preview + commit see the same number.
  const [drawDrag, setDrawDrag] = useState<{
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
  } | null>(null);

  // Pen gesture state. The freehand intent samples pointer positions
  // for the whole drag (one polyline) rather than start + end like
  // the box / line intents. Stored as a flat array of canvas-coord
  // points; appended to on every pointermove (throttled to one append
  // per frame via requestAnimationFrame so high-DPI / 120 Hz pointers
  // can't push thousands of samples per second through React's
  // reconciliation). Null when no pen drag is active.
  const [penPoints, setPenPoints] = useState<{ x: number; y: number }[] | null>(null);

  // Snap a draw gesture's START point to nearby element edge / centre
  // lines the same way the moving corner snaps: a 0×0 candidate snaps
  // each axis independently to the nearest line within the same
  // 6-screen-px halo, so a drawn shape's first corner — or an arrow's
  // first endpoint — can latch onto a neighbour instead of landing a
  // pixel off.
  const snapDrawStart = (px: number, py: number): { x: number; y: number } => {
    const snap = snapToAlignment(
      { x: px, y: py, width: 0, height: 0 },
      elements,
      EMPTY_ID_SET,
      6 / viewportZoom,
    );
    return { x: px + snap.dx, y: py + snap.dy };
  };

  // Starts a draw-to-size / freehand gesture from a primary-button
  // pointer-down when an intent is pending, converting to canvas
  // coords first. Returns true once a gesture began so callers can
  // stop there. Shared by the capture-phase intercept (which fires
  // over elements too) and the background bubble handlers; a freehand
  // intent seeds the polyline accumulator, every other intent seeds
  // the box / line drag.
  const beginPendingDrawGesture = (e: React.PointerEvent): boolean => {
    if (!pendingDraw) return false;
    const rect = wrapperRef.current?.getBoundingClientRect();
    if (!rect) return false;
    const sx = (e.clientX - rect.left) / viewportZoom;
    const sy = (e.clientY - rect.top) / viewportZoom;
    if (pendingDraw.type === 'freehand') {
      // Snap the first stroke point to nearby alignments (same as a shape's
      // first corner) so the sketch can begin from an aligned start.
      const start = snapDrawStart(sx, sy);
      setPenPoints([{ x: start.x, y: start.y }]);
    } else {
      const start = snapDrawStart(sx, sy);
      setDrawDrag({ startX: start.x, startY: start.y, currentX: start.x, currentY: start.y });
    }
    return true;
  };

  // Pre-press snap preview: while a draw is armed but not yet started,
  // snap the hovered pointer to nearby element edges / centres and stash
  // it, so the user can land the shape's FIRST corner on an alignment
  // before pressing down (the moving corner already snaps mid-drag). Only
  // set when a snap is actually in effect, so the preview (a dot + guides
  // in CanvasChrome) appears exactly when the start would latch.
  const [drawHover, setDrawHover] = useState<{ x: number; y: number } | null>(null);
  useEffect(() => {
    if (!pendingDraw || drawDrag || penPoints) {
      setDrawHover(null);
      return;
    }
    const wrapperEl = wrapperRef.current;
    const onMove = (e: PointerEvent) => {
      const rect = wrapperEl?.getBoundingClientRect();
      if (!rect) return;
      const px = (e.clientX - rect.left) / viewportZoom;
      const py = (e.clientY - rect.top) / viewportZoom;
      const snap = snapToAlignment(
        { x: px, y: py, width: 0, height: 0 },
        elements,
        EMPTY_ID_SET,
        6 / viewportZoom,
      );
      setDrawHover(snap.dx === 0 && snap.dy === 0 ? null : { x: px + snap.dx, y: py + snap.dy });
    };
    window.addEventListener('pointermove', onMove);
    return () => window.removeEventListener('pointermove', onMove);
  }, [pendingDraw, drawDrag, penPoints, viewportZoom, elements]);

  // Window-level move + up listeners for the draw gesture. Attached
  // only while a drag is in flight so the canvas pays nothing in the
  // common case (idle, or in pan / marquee mode). pointermove
  // resolves the raw pointer, applies snap (1:1 lock on shift, edge
  // alignment to existing elements via snapResizeBounds for box
  // intents), and stores the snapped point so the preview tracks it.
  // pointerup hands raw start + end to onCommitDraw and lets the
  // editor decide how to interpret them (box vs line). Pointercancel
  // + Escape go through the keyboard hook's onCancelDraw path.
  useEffect(() => {
    if (!drawDrag || !pendingDraw) return;
    const wrapperEl = wrapperRef.current;
    const isBoxIntent = pendingDraw.type !== 'arrow';
    // Snap threshold scales inversely with zoom so the "feel" is
    // consistent: a 6-screen-pixel halo at any zoom level, big enough
    // to grab edges without surprise-snapping while the user is
    // still freely placing.
    const snapPx = 6 / viewportZoom;
    // Local mutable mirror of drawDrag. The effect's setDrawDrag
    // updater used to call onCommitDraw inline, which re-entered
    // the editor's commit handler (a parent setState) from inside
    // React's setState updater path and tripped a "setState during
    // render" warning on LivePage. Keeping the latest gesture state
    // in a closure variable lets onMove update it synchronously and
    // onUp call onCommitDraw cleanly OUTSIDE any setState updater.
    // setDrawDrag is now only used to trigger preview re-renders.
    let latest: { startX: number; startY: number; currentX: number; currentY: number } | null =
      drawDrag;
    const onMove = (e: PointerEvent) => {
      const rect = wrapperEl?.getBoundingClientRect();
      if (!rect || !latest) return;
      // A 2-finger pinch took over: freeze the draw at its last good
      // position so finger-1's moves don't size the element to the
      // pinch-warped pointer (pan + editor-drag bail the same way).
      if (isPinchingRef?.current) return;
      const rawX = (e.clientX - rect.left) / viewportZoom;
      const rawY = (e.clientY - rect.top) / viewportZoom;
      let endX = rawX;
      let endY = rawY;
      // 1:1 aspect lock on shift. Mirrors Figma / Photoshop: hold
      // shift while drawing to get a perfect square / circle. Picks
      // the dominant axis (the one the user moved further) and
      // matches the other to it, preserving the drag's direction so
      // the box still grows where the cursor is.
      if (e.shiftKey) {
        const dx = endX - latest.startX;
        const dy = endY - latest.startY;
        const absMax = Math.max(Math.abs(dx), Math.abs(dy));
        endX = latest.startX + (dx === 0 ? absMax : Math.sign(dx) * absMax);
        endY = latest.startY + (dy === 0 ? absMax : Math.sign(dy) * absMax);
      }
      // Element-edge snap for box intents. Arrows skip this: their
      // endpoints don't read as a bounding box (the natural snap
      // there is per-end anchor pinning, handled by the existing
      // arrow drag-handle flow after creation).
      if (isBoxIntent) {
        const x = Math.min(latest.startX, endX);
        const y = Math.min(latest.startY, endY);
        const width = Math.max(1, Math.abs(endX - latest.startX));
        const height = Math.max(1, Math.abs(endY - latest.startY));
        const mode: 'se' | 'sw' | 'ne' | 'nw' =
          endX >= latest.startX
            ? endY >= latest.startY
              ? 'se'
              : 'ne'
            : endY >= latest.startY
              ? 'sw'
              : 'nw';
        const snapped = snapResizeBounds(
          { x, y, width, height },
          mode,
          elements,
          EMPTY_ID_SET,
          snapPx,
          1,
        );
        endX = mode === 'se' || mode === 'ne' ? snapped.x + snapped.width : snapped.x;
        endY = mode === 'se' || mode === 'sw' ? snapped.y + snapped.height : snapped.y;
      } else {
        // Arrow: snap the moving endpoint to nearby element edge / centre
        // lines (a point snap) so it can latch onto a shape's edge or
        // corner as you draw, the way the box corner does. (Per-end
        // anchor pinning still happens via the arrow drag-handle flow
        // after creation.)
        const snap = snapToAlignment(
          { x: endX, y: endY, width: 0, height: 0 },
          elements,
          EMPTY_ID_SET,
          snapPx,
        );
        endX += snap.dx;
        endY += snap.dy;
      }
      latest = { ...latest, currentX: endX, currentY: endY };
      setDrawDrag(latest);
    };
    const onUp = () => {
      const snapshot = latest;
      latest = null;
      setDrawDrag(null);
      if (snapshot) {
        onCommitDraw(
          pendingDraw,
          snapshot.startX,
          snapshot.startY,
          snapshot.currentX,
          snapshot.currentY,
        );
      }
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawDrag !== null, pendingDraw]);

  // Pen-gesture sampling loop. While penPoints is non-null and the
  // freehand intent is the active pendingDraw, accumulate pointer
  // samples into the polyline. Pointermove writes to a local mirror
  // and schedules ONE setPenPoints per requestAnimationFrame, so a
  // 120 Hz pointer doesn't pump thousands of React renders. On
  // pointerup we hand the polyline to onCommitFreehand (which
  // simplifies + smooths it) and clear the gesture state.
  useEffect(() => {
    if (!penPoints || !pendingDraw || pendingDraw.type !== 'freehand') return;
    const wrapperEl = wrapperRef.current;
    let buffer: { x: number; y: number }[] = penPoints;
    let rafId: number | null = null;
    const onMove = (e: PointerEvent) => {
      const rect = wrapperEl?.getBoundingClientRect();
      if (!rect) return;
      // Stop sampling once a 2-finger pinch takes over, so the committed
      // polyline doesn't pick up the pinch-warped finger-1 path.
      if (isPinchingRef?.current) return;
      const x = (e.clientX - rect.left) / viewportZoom;
      const y = (e.clientY - rect.top) / viewportZoom;
      buffer = [...buffer, { x, y }];
      if (rafId !== null) return;
      rafId = window.requestAnimationFrame(() => {
        rafId = null;
        setPenPoints(buffer);
      });
    };
    const onUp = () => {
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
        rafId = null;
      }
      const snapshot = buffer;
      setPenPoints(null);
      if (snapshot.length >= 2) {
        onCommitFreehand(snapshot, recogniseShapes);
      }
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      if (rafId !== null) window.cancelAnimationFrame(rafId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [penPoints !== null, pendingDraw]);

  // Auto-focus the canvas surface on mount so clipboard paste works
  // before the user has clicked anywhere. The browser only dispatches
  // `paste` events on a focusable element; <main> has tabIndex=-1 to
  // be a valid focus target, but it doesn't grab focus by itself.
  // Without this, a freshly-loaded editor swallows Cmd/Ctrl+V silently
  // until the first canvas click. preventScroll keeps the viewport
  // from jumping if the page was scrolled at load time.
  useEffect(() => {
    const node = mainRef && 'current' in mainRef ? mainRef.current : null;
    node?.focus({ preventScroll: true });
  }, [mainRef]);
  const handleArrowSelect = useCallback(
    (id: string, e: ReactPointerEvent) => {
      const set = multiSelectedIdsRef.current;
      const isMember = set.has(id);
      if (e.shiftKey || (set.size > 0 && !isMember)) {
        onShiftSelect(id);
        return;
      }
      onSelect(id);
    },
    [onSelect, onShiftSelect],
  );

  return (
    <main
      ref={mainRef}
      tabIndex={-1}
      onPointerMove={handlePointerMoveCanvas}
      onPointerLeave={handlePointerLeaveCanvas}
      onDragOver={(e) => {
        // Allow dropping palette tiles (shapes / devices / icons).
        if (
          e.dataTransfer.types.includes(PALETTE_DND_MIME) ||
          e.dataTransfer.types.includes(ICON_DND_MIME) ||
          e.dataTransfer.types.includes(TECH_ICON_DND_MIME)
        ) {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'copy';
        }
      }}
      onDrop={(e) => {
        const shapeKind = e.dataTransfer.getData(PALETTE_DND_MIME);
        // A line-art icon and a tech (brand) icon both drop as an 'icon'
        // shape carrying the id; dropPaletteItem picks the telemetry type.
        const iconId =
          e.dataTransfer.getData(ICON_DND_MIME) || e.dataTransfer.getData(TECH_ICON_DND_MIME);
        if (!shapeKind && !iconId) return;
        e.preventDefault();
        const rect = e.currentTarget.getBoundingClientRect();
        // Canvas transform is scale(z) translate(o): invert to canvas coords.
        const cx = (e.clientX - rect.left) / viewportZoom - viewportOffset.x;
        const cy = (e.clientY - rect.top) / viewportZoom - viewportOffset.y;
        if (iconId) props.onDropPalette?.('icon', cx, cy, iconId);
        else props.onDropPalette?.(shapeKind as ShapeKind, cx, cy);
      }}
      onPointerDownCapture={(e) => {
        // Pointer-downs that land on a floating panel (palette, context
        // panel, ...) are UI interactions, not canvas gestures. The
        // panels live inside <main> for layout, so their bubble-phase
        // stopPropagation can't stop this ancestor capture handler from
        // firing first. Without this guard, clicking a palette button
        // while a draw is armed lets the draw-to-size intercept below
        // start a gesture at the click point and drop the pending shape
        // behind the panel. Bail before any canvas gesture starts.
        if ((e.target as Element | null)?.closest?.('[data-floating-panel]')) return;
        // Eraser tool (spec/09): a primary-button press deletes whatever
        // it lands on and starts a drag-to-erase gesture. Handled in the
        // capture phase so it wins over an element's own select/drag and
        // the background marquee/pan; useCanvasEraser tracks the rest of
        // the gesture via window listeners.
        if (e.button === 0 && canvasTool === 'eraser') {
          const node = mainRef && 'current' in mainRef ? mainRef.current : null;
          node?.focus({ preventScroll: true });
          e.preventDefault();
          e.stopPropagation();
          props.onEraseStart?.(e.clientX, e.clientY);
          return;
        }
        // Middle-mouse drag pans from anywhere on the canvas — empty
        // space OR over elements — regardless of the active tool. The
        // capture phase runs before the element + background
        // pointerdown handlers, so it wins over selection / drag.
        // Mirrors Figma + the browser's own middle-drag scroll.
        if (e.button === 1) {
          e.preventDefault();
          e.stopPropagation();
          setPan({
            startClientX: e.clientX,
            startClientY: e.clientY,
            startOffsetX: viewportOffset.x,
            startOffsetY: viewportOffset.y,
            movedRef: { current: false },
          });
          return;
        }
        // Draw-to-size intercept must run in the capture phase so a
        // queued draw can begin ON TOP of an existing element. An
        // element's own bubble-phase pointerdown selects / drags it and
        // stops propagation, which would otherwise make it impossible
        // to draw a new element over another. Capturing here lets the
        // draw win regardless of what's under the pointer; the
        // background bubble handlers still cover the rect-less edge
        // case where this returns false.
        if (e.button === 0 && pendingDraw) {
          const node = mainRef && 'current' in mainRef ? mainRef.current : null;
          node?.focus({ preventScroll: true });
          if (beginPendingDrawGesture(e)) e.stopPropagation();
        }
      }}
      onContextMenu={(e) => {
        // BoxedElementView's onContextMenu calls e.stopPropagation()
        // for right-clicks on elements, so we only reach here for
        // canvas background clicks. Suppress the browser context
        // menu and open a tab-level context menu instead.
        e.preventDefault();
        onCanvasContextMenu?.(e.clientX, e.clientY);
      }}
      onPointerDown={(e) => {
        // Primary button only. A right- (or middle-) click must fall
        // through to onContextMenu untouched: it opens the menu, and if
        // we also armed a marquee here the matching pointerup would fire
        // onDeselect (sub-4px "drag") and close the menu the same instant
        // it appeared. PointerEvent.button is 0 for touch / pen contact
        // too, so this only filters non-primary mouse buttons.
        if (e.button !== 0) return;
        // Focus the canvas surface so subsequent Cmd/Ctrl+V dispatches
        // a `paste` event the editor-page-level handler can read. The
        // browser only fires `paste` when something focusable is
        // currently focused; tabIndex={-1} below makes <main> a valid
        // focus target, but a click on a tabIndex=-1 element doesn't
        // auto-focus it (mouse focus is restricted to inputs / hrefs /
        // tabIndex>=0). Calling `.focus()` here closes that loop so
        // clipboard-image paste works after the user has interacted
        // with the canvas at least once.
        const node = mainRef && 'current' in mainRef ? mainRef.current : null;
        node?.focus({ preventScroll: true });
        // Draw-to-size intercept: when an intent is pending, this
        // pointer-down starts the size-drag instead of falling
        // through to pan / marquee. Coords convert immediately to
        // canvas coords so the rest of the gesture (the window-
        // level move + up listeners above) operates in one space.
        // Usually the capture-phase intercept above has already started
        // the gesture (and stopped propagation); this is the fallback
        // for the rect-less edge case where it didn't.
        if (pendingDraw && beginPendingDrawGesture(e)) return;
        // Auto-fit on load can scale the wrapper below 1, which
        // shrinks its hit region inside `main`. Without this mirror
        // handler, clicks in the "outside the shrunken wrapper but
        // still on the canvas" gap would never start a marquee.
        // Restrict to direct hits on `main` so element clicks (which
        // bubble up here) don't also trigger.
        //
        // Laser is grouped with pan here (matching the inner wrapper
        // handler below): mid-presentation a click-drag is far more
        // often "reposition the canvas" than "multi-select", and a
        // pan is the safe no-op when the presenter is just steadying
        // their hand. Without this, a laser-mode drag in the outer
        // gap would silently draw a marquee selection box.
        //
        // Touch is the explicit exception (spec/09): a finger drag
        // in laser mode MUST draw the laser, not pan, because touch
        // has no hover. Pan-on-drag would pin the dot in canvas
        // coords (the canvas slides under the finger), defeating
        // the presenter mode entirely on phones / tablets.
        if (e.target !== e.currentTarget) return;
        const laserOnTouch = canvasTool === 'laser' && e.pointerType === 'touch';
        // Touch + Laser is a pure draw gesture: no pan, no marquee.
        // pointermove on <main> keeps broadcasting laser samples via
        // onCanvasPointerMove. Without this short-circuit the drag
        // would fall into the marquee branch below and paint a
        // selection rectangle while the user is presenting.
        if (laserOnTouch) return;
        const wantsPan = spaceHeldRef.current || canvasTool === 'pan' || canvasTool === 'laser';
        if (wantsPan) {
          setPan({
            startClientX: e.clientX,
            startClientY: e.clientY,
            startOffsetX: viewportOffset.x,
            startOffsetY: viewportOffset.y,
            movedRef: { current: false },
          });
        } else {
          setMarquee({
            startX: e.clientX,
            startY: e.clientY,
            currentX: e.clientX,
            currentY: e.clientY,
          });
        }
      }}
      className={`relative flex-1 touch-none select-none overflow-hidden outline-none [-webkit-touch-callout:none] [-webkit-tap-highlight-color:transparent] ${
        pendingDraw ? '' : cursorClass
      }`}
      style={{
        ...tabBackgroundStyle(
          tabBackgroundPattern,
          viewportOffset,
          tabBackgroundColor,
          tabPatternColor,
          tabBackgroundOpacity,
        ),
        // Mirror the inner-wrapper cursor on <main>. The inner div is
        // `absolute inset-0` but its CSS transform scales it (zoom),
        // so when zoom is below 1 the hit area shrinks and the
        // surrounding "letterbox" gap falls through to <main>. Without
        // setting cursor here too, the user would see the OS default
        // arrow in that gap while a draw-to-size intent is pending.
        ...(pendingDraw ? { cursor: drawIntentCursor(pendingDraw) } : null),
      }}
    >
      <div
        ref={wrapperRef}
        onPointerDown={(e) => {
          if (e.target !== e.currentTarget) return;
          // Primary button only — see the outer handler: a right-click
          // must reach onContextMenu without arming a marquee whose
          // pointerup would deselect and close the menu instantly.
          if (e.button !== 0) return;
          // Focus the canvas surface so subsequent Cmd/Ctrl+V
          // dispatches a paste event (see the outer pointerdown
          // handler above for the full rationale). Same call from
          // the inner wrapper so click-on-canvas-content (which
          // doesn't bubble through the outer onPointerDown's
          // currentTarget gate) still leaves the canvas focused.
          const node = mainRef && 'current' in mainRef ? mainRef.current : null;
          node?.focus({ preventScroll: true });
          // Draw-to-size intercept (mirror of the outer handler).
          // beginPendingDrawGesture branches on `freehand` internally:
          // a freehand intent seeds the polyline accumulator, every
          // other intent seeds the box / line drag. (An earlier inline
          // version always started a drawDrag, so a pen click landed
          // BOTH a penPoints state and a drawDrag and mis-routed into
          // createImage; the shared helper has the single correct
          // branch.) Usually the capture-phase intercept has already
          // handled this; kept as the rect-less fallback.
          if (pendingDraw && beginPendingDrawGesture(e)) return;
          // Tool decides the gesture:
          //  - Pan tool / Space / Laser tool → drag scrolls. Laser
          //    drags pan because mid-presentation a click-drag is far
          //    more often "I want to reposition the canvas" than "I
          //    want to multi-select", and a pan is the safe no-op
          //    when the presenter is just steadying their hand. The
          //    trail keeps capturing pointer-moves throughout, so
          //    the pan reads as a sweeping laser to peers.
          //  - Touch + Laser is the exception (spec/09): a finger
          //    drag in laser mode draws the laser, not panning,
          //    because touch has no hover and pan-on-drag would pin
          //    the dot in canvas-coords.
          //  - Select tool → drag draws a marquee for multi-select.
          const laserOnTouch = canvasTool === 'laser' && e.pointerType === 'touch';
          // Touch + Laser: pure draw, no pan, no marquee. Falls
          // through so pointermove on <main> can keep broadcasting
          // laser samples. See the outer handler above for the
          // matching short-circuit.
          if (laserOnTouch) return;
          const wantsPan = spaceHeldRef.current || canvasTool === 'pan' || canvasTool === 'laser';
          if (wantsPan) {
            setPan({
              startClientX: e.clientX,
              startClientY: e.clientY,
              startOffsetX: viewportOffset.x,
              startOffsetY: viewportOffset.y,
              movedRef: { current: false },
            });
          } else {
            setMarquee({
              startX: e.clientX,
              startY: e.clientY,
              currentX: e.clientX,
              currentY: e.clientY,
            });
          }
        }}
        onDoubleClick={(e) => {
          if (e.target !== e.currentTarget) return;
          const rect = wrapperRef.current?.getBoundingClientRect();
          if (!rect) return;
          // rect is post-transform; click position relative to wrapper top-left
          // is in scaled pixels — divide by zoom to recover canvas-coords.
          const sx = (e.clientX - rect.left) / viewportZoom;
          const sy = (e.clientY - rect.top) / viewportZoom;
          onCanvasDoubleClick(sx, sy);
        }}
        className={`absolute inset-0 origin-center touch-none ${pendingDraw ? '' : cursorClass}`}
        style={{
          // Translate is in canvas-coords (applied first); scale is centred
          // on the wrapper so zooming keeps the viewport centre stable.
          transform: `scale(${viewportZoom}) translate(${viewportOffset.x}px, ${viewportOffset.y}px)`,
          // Draw-mode cursor: every intent gets a custom inline-SVG
          // cursor (crosshair at the pointer tip plus a small glyph
          // hinting at what's about to land). Without this, tool
          // intents inherited the default arrow cursor because the
          // wrapper drops its Tailwind cursor- class above when
          // pendingDraw is set, leaving no cursor specified at all.
          ...(pendingDraw ? { cursor: drawIntentCursor(pendingDraw) } : null),
        }}
      >
        <CanvasElementsLayer
          {...props}
          hasArrows={hasArrows}
          memberIds={memberIds}
          showHandles={showHandles}
          showAnchorsFor={showAnchorsFor}
          badgeColor={badgeColor}
          selectionBounds={selectionBounds}
          showPlus={showPlus}
          showUnionResize={showUnionResize}
          unionResizeBounds={unionResizeBounds}
          unionResizePrimaryId={unionResizePrimaryId}
          isPaintMode={isPaintMode}
          isGroupMode={isGroupMode}
          handleArrowSelect={handleArrowSelect}
          handleElementContextSelect={handleElementContextSelect}
          quickRingOpen={quickRingOpen}
          setQuickRingOpen={setQuickRingOpen}
        />
      </div>

      {/* SelectionPopover rides on a sibling wrapper that mirrors
          the canvas transform but lives AFTER the editor panels in
          DOM order. z-40 on every viewport: lifts the toolbar
          above panels (Palette, Editor / Context, Explorer,
          Activity, Zoom / ZoomControls, the TabBar footer) so it
          stays visible whether the selected element sits near a
          panel-pinned corner on desktop OR overlaps the bottom
          dock on mobile. The previous mobile-only z-0 was an
          older design choice that hid the toolbar behind chrome,
          which made multi-select edit ops awkward on a phone.
          Diagram elements stay in the original wrapper at z-auto
          and continue to be visually covered by panels where they
          overlap. */}
      {/* Hide the selection toolbar while a quick-connect ring is open — its
          options own the space around the element, and a toolbar on top just
          competes for clicks. Kept mounted and faded out (not unmounted) so
          it animates away as the ring opens and back in when it closes. */}
      {showPopover && selectionBounds ? (
        <div
          className="pointer-events-none absolute inset-0 z-40 origin-center"
          style={{
            transform: `scale(${viewportZoom}) translate(${viewportOffset.x}px, ${viewportOffset.y}px)`,
            opacity: quickRingOpen ? 0 : 1,
            // Transition visibility too so it stays interactive through the
            // fade-out then goes non-interactive (hidden) at the end.
            visibility: quickRingOpen ? 'hidden' : 'visible',
            transition: 'opacity 150ms ease, visibility 150ms ease',
          }}
        >
          <SelectionPopover
            bounds={selectionBounds}
            canvasOffset={viewportOffset}
            zoom={viewportZoom}
            title={selectionScope === 'group' ? 'Selected Group' : 'Selected Element'}
            // In view-only mode we mount the popover with just
            // `onOpenComments`: visitors should be able to read +
            // post comments on a diagram they don't own, but no
            // other edit affordances apply. Every other handler
            // becomes undefined and the matching button drops out.
            locked={readOnly ? undefined : selectedLocked}
            onCopyFormat={
              readOnly
                ? undefined
                : selected && (isBoxed(selected) || selected.type === 'arrow')
                  ? onBeginFormatPainter
                  : undefined
            }
            onDuplicate={readOnly ? undefined : selected ? onDuplicateSelected : undefined}
            onGroup={!readOnly && selectedIsBoxed && !selectedIsGrouped ? onBeginGroup : undefined}
            onUngroup={!readOnly && selectedIsGrouped ? onUngroup : undefined}
            onToggleLock={readOnly ? undefined : onToggleLockSelected}
            onDelete={readOnly ? undefined : onDeleteSelected}
            // Comment button is VIEW-ROLE ONLY now. Editors reach
            // comments via the right-click / ellipsis context menu (which
            // is gated !isReadOnly), so the toolbar button was a
            // duplicate for them. View-role visitors get no context menu,
            // so the toolbar stays their only way into a thread.
            onOpenComments={readOnly && selected ? () => onOpenComments(selected.id) : undefined}
            onOpenContextMenu={
              readOnly
                ? undefined
                : selected && onOpenElementContextMenu
                  ? (x, y) => onOpenElementContextMenu(selected.id, x, y)
                  : undefined
            }
            compact={readOnly}
          />
        </div>
      ) : null}

      <CanvasChrome
        {...props}
        paletteSelection={paletteSelection}
        tabSection={tabSection}
        selectionScope={selectionScope}
        isPaintMode={isPaintMode}
        isGroupMode={isGroupMode}
        marquee={marquee}
        drawDrag={drawDrag}
        drawHover={drawHover}
        penPoints={penPoints}
        wrapperRef={wrapperRef}
        paletteBottomY={paletteBottomY}
        setPaletteBottomY={setPaletteBottomY}
        explorerBottomY={explorerBottomY}
        setExplorerBottomY={setExplorerBottomY}
        contextBottomY={contextBottomY}
        setContextBottomY={setContextBottomY}
        activeMobilePanel={activeMobilePanel}
        setActiveMobilePanel={setActiveMobilePanel}
        dockButtonRefs={dockButtonRefs}
        activeDockAnchor={activeDockAnchor}
        setActiveDockAnchor={setActiveDockAnchor}
        handleDockButtonClick={handleDockButtonClick}
        handleZoomIn={handleZoomIn}
        handleZoomOut={handleZoomOut}
        handleResetZoom={handleResetZoom}
      />
      {/* Lazy per-tab load (spec/13). Last child + z-50 so it covers the
          canvas AND the floating palette, blocking any edit that would
          otherwise overwrite an unfetched tab's real content. */}
      {tabLoadState && tabLoadState !== 'ready' ? (
        <TabLoadOverlay state={tabLoadState} onRetry={() => onRetryTabLoad?.()} />
      ) : null}
    </main>
  );
}
