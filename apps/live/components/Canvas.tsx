import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { defaultTextAlign, isBoxed, snapResizeBounds, supportsColours } from '@livediagram/diagram';
import { tabBackgroundStyle } from '@/lib/canvas-backgrounds';
import { ZOOM_MIN, ZOOM_MAX } from '@/lib/canvas';
import { deriveCanvasSelection, deriveSelectedElementFields } from '@/lib/canvas-selection';
import { canvasCursorClass } from '@/lib/canvas-chrome';
import { useCanvasMobileDock } from '@/hooks/useCanvasMobileDock';
import { drawIntentCursor } from '@/lib/draw-mode';
import { track } from '@/lib/telemetry';
import { ArrowDefs, ArrowView } from './ArrowView';
import { BoxedElementView } from './BoxedElementView';
import { type SelectedElementControls } from './CommandPalette';
import { UnionResizeHandles } from './element-parts';
// Lazy-load CommentsPanel: only mounts when the active tab has at
// least one element with comments AND the ContextPanel has reported
// its bottom edge (so we don't paint the panel at the legacy fallback
// position). Most diagrams never accumulate comments, so deferring
// the 164-line panel + its formatRelativeTimeShort + useRelativeTimeTick
// dependencies keeps the editor's initial chunk lean.
import { LaserOverlay } from './LaserOverlay';
import { useCanvasPanAndMarquee } from '@/hooks/useCanvasPanAndMarquee';
import { getTheme } from '@/lib/themes';
// Lazy-load MultiSelectionToolbar: only mounts when the user has
// drag-marquee'd two or more elements. Most sessions never trigger
// it (single-element edits dominate), so deferring the 172-line
// toolbar + its icon set keeps the editor's initial chunk lean.
// Same pattern as the editor's other gated modals (NotePopover,
// TabLinkPicker, etc.).
import { PlusButton } from './PlusButton';
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

// Stable empty-array constant for the `remoteSelectors` prop on the
// (very common) "no remote participants have this element selected"
// path. A fresh `[]` per render would invalidate BoxedElementView's
// memo (commit e8e34f9) on every editor-page render, defeating the
// memo for every element nobody else is currently selecting. The
// shared constant lets shallow equality see the same reference
// across renders.
const EMPTY_REMOTE_SELECTORS: { id: string; name: string; color: string }[] = [];

// Reused as the excludeIds argument to snapResizeBounds during draw-
// to-size: the new element doesn't exist yet, so there's nothing to
// exclude. A module-level frozen Set keeps the snap effect from
// allocating a new Set on every pointermove.
const EMPTY_ID_SET: Set<string> = new Set();

import { CanvasChrome } from './CanvasChrome';
import type { CanvasProps } from './Canvas.types';

export function Canvas(props: CanvasProps) {
  const {
    tabLocked,
    readOnly,
    tabBackgroundPattern,
    tabBackgroundColor,
    tabBackgroundOpacity,
    tabPatternColor,
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
    remoteSelectionsByElement,
    remoteCursors,
    laserTrails,
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
    onBeginDrag,
    onBeginRotate,
    onBeginAnchorDrag,
    onBeginEdit,
    onCommitLabel,
    onCancelEdit,
    onBeginEndpointDrag,
    onBeginArrowCurveDrag,
    onBeginArrowElbowDrag,
    onBeginArrowTranslate,
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
    onSetFillColor,
    onSetStrokeColor,
    onSetTextColor,
    onSetOpacity,
    onResetColors,
    onSetPadding,
    onSetArrowEnds,
    onSetArrowThickness,
    onSetArrowheadSize,
    onSetArrowStyle,
    onSetArrowStrokeStyle,
    onSetShapeKind,
    onSetBorderStroke,
    onSetBorderStyle,
    onSetBorderRadius,
    onFollowLink,
    onOpenComments,
    onOpenNote,
    imageContext,
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
    onDuplicateConnect,
    onToggleLockSelected,
    onDeleteSelected,
    onCanvasDoubleClick,
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
        onSetTextColor,
        onSetFillColor,
        onSetStrokeColor,
        onSetOpacity,
        onResetColors,
        onSetPadding,
        onSetArrowEnds,
        onSetArrowThickness,
        onSetArrowheadSize,
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
      onSelect(id);
      onElementContextMenu?.(id, sx, sy);
    },
    [onSelect, onElementContextMenu],
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
      onContextMenu={(e) => {
        // BoxedElementView's onContextMenu calls e.stopPropagation()
        // for right-clicks on elements, so we only reach here for
        // canvas background clicks. Suppress the browser context
        // menu and open a tab-level context menu instead.
        e.preventDefault();
        onCanvasContextMenu?.(e.clientX, e.clientY);
      }}
      onPointerDown={(e) => {
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
        if (pendingDraw) {
          const rect = wrapperRef.current?.getBoundingClientRect();
          if (rect) {
            const sx = (e.clientX - rect.left) / viewportZoom;
            const sy = (e.clientY - rect.top) / viewportZoom;
            if (pendingDraw.type === 'freehand') {
              // Pen gesture: start a polyline accumulator. Subsequent
              // pointermoves append to it via the effect below; on
              // release the polyline is handed to onCommitFreehand.
              setPenPoints([{ x: sx, y: sy }]);
            } else {
              setDrawDrag({ startX: sx, startY: sy, currentX: sx, currentY: sy });
            }
            return;
          }
        }
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
          // Focus the canvas surface so subsequent Cmd/Ctrl+V
          // dispatches a paste event (see the outer pointerdown
          // handler above for the full rationale). Same call from
          // the inner wrapper so click-on-canvas-content (which
          // doesn't bubble through the outer onPointerDown's
          // currentTarget gate) still leaves the canvas focused.
          const node = mainRef && 'current' in mainRef ? mainRef.current : null;
          node?.focus({ preventScroll: true });
          // Draw-to-size intercept (mirror of the outer handler).
          // Must branch on `freehand` the same way the outer one
          // does: a freehand intent starts a polyline accumulator
          // (penPoints), every other intent starts the box / line
          // drag (drawDrag). The previous version always started a
          // drawDrag, so a pen click landed BOTH a penPoints state
          // (from the outer handler) AND a drawDrag (from this
          // inner one); the drawDrag preview rendered a marquee-
          // like box and its onUp routed the gesture into
          // onCommitDraw, which dropped through commitDraw's
          // ternary fallback to createImage. Three symptoms in
          // one missing branch.
          if (pendingDraw) {
            const rect = wrapperRef.current?.getBoundingClientRect();
            if (rect) {
              const sx = (e.clientX - rect.left) / viewportZoom;
              const sy = (e.clientY - rect.top) / viewportZoom;
              if (pendingDraw.type === 'freehand') {
                setPenPoints([{ x: sx, y: sy }]);
              } else {
                setDrawDrag({ startX: sx, startY: sy, currentX: sx, currentY: sy });
              }
              return;
            }
          }
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
        {elements.map((element) => {
          if (element.type === 'arrow') {
            return (
              <svg
                key={element.id}
                className="absolute inset-0 h-full w-full"
                style={{ pointerEvents: 'none', overflow: 'visible' }}
              >
                <ArrowView
                  arrow={element}
                  elements={elements}
                  isSelected={element.id === selectedId || multiSelectedIds.has(element.id)}
                  isPaintMode={isPaintMode || isGroupMode}
                  isEditing={element.id === editingId}
                  tabLocked={tabLocked}
                  readOnly={readOnly}
                  onSelect={handleArrowSelect}
                  onBeginEndpointDrag={onBeginEndpointDrag}
                  onBeginEdit={onBeginEdit}
                  onCommitLabel={onCommitLabel}
                  onCancelEdit={onCancelEdit}
                  onBeginTranslate={onBeginArrowTranslate}
                  onBeginCurveDrag={onBeginArrowCurveDrag}
                  onBeginElbowDrag={onBeginArrowElbowDrag}
                />
              </svg>
            );
          }
          if (!isBoxed(element)) return null;
          return (
            <BoxedElementView
              key={element.id}
              element={element}
              isSelected={memberIds.has(element.id) || multiSelectedIds.has(element.id)}
              isMultiSelected={multiSelectedIds.has(element.id)}
              multiSelectActive={multiSelectedIds.size > 0}
              remoteSelectors={remoteSelectionsByElement.get(element.id) ?? EMPTY_REMOTE_SELECTORS}
              isEditing={element.id === editingId}
              isPaintMode={isPaintMode || isGroupMode}
              showHandles={showHandles(element.id)}
              showAnchors={showAnchorsFor(element.id)}
              zoom={viewportZoom}
              badgeColor={badgeColor}
              tabLocked={tabLocked}
              onBeginDrag={onBeginDrag}
              onBeginRotate={onBeginRotate}
              onShiftSelect={onShiftSelect}
              onBeginAnchorDrag={onBeginAnchorDrag}
              onBeginEdit={onBeginEdit}
              onCommitLabel={onCommitLabel}
              onCancelEdit={onCancelEdit}
              onFollowLink={onFollowLink}
              onOpenComments={onOpenComments}
              onOpenNote={onOpenNote}
              imageContext={imageContext}
              onContextSelect={handleElementContextSelect}
            />
          );
        })}

        {remoteCursors.map((c) => (
          <RemoteCursor key={c.id} cursor={c} zoom={viewportZoom} />
        ))}

        {/* Laser overlay sits inside the viewport-transformed wrapper
            so trail coordinates (canvas-space) pan + zoom with
            elements. The overlay component owns its own RAF loop
            and only runs while there's at least one active trail. */}
        <LaserOverlay trails={laserTrails} zoom={viewportZoom} />

        {showUnionResize && unionResizeBounds && unionResizePrimaryId ? (
          <UnionResizeHandles
            bounds={unionResizeBounds}
            primaryId={unionResizePrimaryId}
            zoom={viewportZoom}
            onBeginDrag={onBeginDrag}
          />
        ) : null}

        {showPlus && selectionBounds ? (
          <>
            <PlusButton
              x={selectionBounds.x + selectionBounds.width}
              y={selectionBounds.y + selectionBounds.height / 2}
              placement="right"
              zoom={viewportZoom}
              onClick={() => onDuplicateConnect('right')}
            />
            <PlusButton
              x={selectionBounds.x + selectionBounds.width / 2}
              y={selectionBounds.y + selectionBounds.height}
              placement="below"
              zoom={viewportZoom}
              onClick={() => onDuplicateConnect('below')}
            />
            <PlusButton
              x={selectionBounds.x}
              y={selectionBounds.y + selectionBounds.height / 2}
              placement="left"
              zoom={viewportZoom}
              onClick={() => onDuplicateConnect('left')}
            />
            <PlusButton
              x={selectionBounds.x + selectionBounds.width / 2}
              y={selectionBounds.y}
              placement="above"
              zoom={viewportZoom}
              onClick={() => onDuplicateConnect('above')}
            />
          </>
        ) : null}
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
      {showPopover && selectionBounds ? (
        <div
          className="pointer-events-none absolute inset-0 z-40 origin-center"
          style={{
            transform: `scale(${viewportZoom}) translate(${viewportOffset.x}px, ${viewportOffset.y}px)`,
          }}
        >
          <SelectionPopover
            bounds={selectionBounds}
            canvasOffset={viewportOffset}
            zoom={viewportZoom}
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
            onGroup={!readOnly && selectedIsBoxed && !selectedIsGrouped ? onBeginGroup : undefined}
            onUngroup={!readOnly && selectedIsGrouped ? onUngroup : undefined}
            onToggleLock={readOnly ? undefined : onToggleLockSelected}
            onDelete={readOnly ? undefined : onDeleteSelected}
            onOpenComments={selected ? () => onOpenComments(selected.id) : undefined}
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
    </main>
  );
}

// Floating cursor for a remote participant. Position is in canvas
// coords (so the cursor pans + zooms with the canvas), but the SVG
// + name pill are counter-scaled so they keep their on-screen size
// at any zoom — same trick the badges + plus buttons use.
function RemoteCursor({
  cursor,
  zoom,
}: {
  cursor: { id: string; name: string; color: string; x: number; y: number };
  zoom: number;
}) {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute"
      style={{
        left: cursor.x,
        top: cursor.y,
        transform: `scale(${1 / zoom})`,
        transformOrigin: 'top left',
        zIndex: 40,
      }}
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 16 16"
        fill={cursor.color}
        stroke="white"
        strokeWidth="1"
      >
        <path d="M2 1 L14 8 L8 9 L11 14 L9 15 L6 10 L2 14 Z" />
      </svg>
      <span
        className="absolute left-3 top-3 whitespace-nowrap rounded px-1.5 py-0.5 text-[10px] font-semibold text-white shadow-sm"
        style={{ backgroundColor: cursor.color }}
      >
        {cursor.name}
      </span>
    </div>
  );
}
