import type { View } from '@/lib/viewport-store';
import { useViewportOf, useViewportStore } from '@/hooks/canvas/useViewportStore';
import { useByValue } from '@/hooks/ui/useByValue';
import { sameSitters, sittersByChair } from '@/lib/chair-sitters';
import { useCallback, useEffect, useEffectEvent, useMemo, useRef, useState } from 'react';
import {
  DEFAULT_BUTTON_MODE,
  isAnimatedPattern,
  isBoxed,
  type ShapeElement,
} from '@livediagram/document';
import { tabBackgroundStyle, worldPatternOrigin } from '@/lib/canvas-backgrounds';
import { useObservedSize } from '@/hooks/canvas/useObservedSize';
import { AnimatedCanvasBackground } from '@/components/canvas/AnimatedCanvasBackground';
import { pointerToCanvas } from '@/lib/canvas';
import { canvasCursorClass } from '@/lib/canvas-chrome';
import { useDockPopovers } from '@/hooks/canvas/useDockPopovers';
import { drawIntentCursor, isWhiteboardPenIntent } from '@/lib/draw-mode';
import { WhiteboardPenPreview } from '@/components/canvas/whiteboard/WhiteboardPenPreview';
import { useCanvasPanAndMarquee } from '@/hooks/canvas/useCanvasPanAndMarquee';
import { useQuickRing } from '@/hooks/canvas/useQuickRing';
import { useZoomControls } from '@/hooks/canvas/useZoomControls';
import { usePaletteDrop } from '@/hooks/canvas/usePaletteDrop';
import { isDarkCanvas } from '@/lib/dark-canvas';
import { isDrawingElement, isEventStormingTab, zoneAnchorOf } from '@livediagram/document';
import type { Element } from '@livediagram/document';
import { getTheme } from '@/lib/themes';
import { CanvasSelectionToolbars } from '@/components/canvas/CanvasSelectionToolbars';
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

// Reused as the excludeIds argument to snapResizeBounds during draw-
// to-size: the new element doesn't exist yet, so there's nothing to
// exclude. A module-level frozen Set keeps the snap effect from
// allocating a new Set on every pointermove.

import { CanvasChrome } from '@/components/canvas/CanvasChrome';
import { CanvasElementsLayer } from '@/components/canvas/CanvasElementsLayer';
import { CanvasZoomProvider } from '@/components/canvas/CanvasZoomContext';
import { useCanvasLongTaskLog } from '@/hooks/canvas/useCanvasLongTaskLog';
import { usePreviewedElements } from '@/hooks/canvas/usePreviewedElements';
import { useSelectionOf, useSelectionStore } from '@/hooks/canvas/useSelectionStore';
import type { CanvasSelectionInput } from '@/hooks/canvas/useCanvasSelectionView';
import type { Selection } from '@/lib/selection-store';
import { withStableEventProps } from '@/components/primitives/withStableEventProps';
import { MindGrowProvider } from '@/components/canvas/MindGrowContext';
import { MindOutlineProvider, useMindOutlineBadges } from '@/components/canvas/MindOutlineContext';
import { CanvasStillProvider } from '@/components/canvas/CanvasStillContext';
import { CanvasLiveRegion } from '@/components/canvas/CanvasLiveRegion';
import { IsometricDepthLayer } from '@/components/canvas/IsometricDepthLayer';
import { useIsometricView } from '@/hooks/canvas/useIsometricView';
import { SpotlightOverlay } from '@/components/canvas/SpotlightOverlay';
import { EraserBrushRing } from '@/components/canvas/EraserBrushRing';
import { DEFAULT_ERASER_CONFIG, eraserRadius } from '@/lib/eraser-config';
import { WHITEBOARD_ERASER_RADIUS_PX } from '@/lib/whiteboard-tool';
import { useWhiteboardPenCursor } from '@/hooks/canvas/useWhiteboardPenCursor';
import { useSpotlight } from '@/hooks/canvas/useSpotlight';
import { useSpotlightConfig } from '@/hooks/canvas/useSpotlightConfig';
import { AvatarWalker } from '@/components/canvas/AvatarWalker';
import { ReactionBurst } from '@/components/canvas/ReactionBurst';

// The footprint a burst is scaled against when it comes from the avatar panel
// rather than a pad: roughly a character, so the particles read as thrown by a
// person rather than by whatever size of pad last set one off.
const AVATAR_BURST_PX = 120;
import { useAvatarWalk } from '@/hooks/canvas/useAvatarWalk';
import { AVATAR_SPAWN_GAP, type AvatarPoint } from '@/lib/avatar-walk';
import { CHAIR_SITTER_FACING, DEFAULT_CHAIR_FACING, chairSeatPoint } from '@livediagram/document';
import { useAvatarConfig } from '@/hooks/canvas/useAvatarConfig';
import { parseAvatarConfig } from '@/lib/avatar-config';
import { reactionPose } from '@/lib/avatar-reactions';
import type { Reaction } from '@livediagram/document';
import { usePortalTravel } from '@/components/canvas/portal-travel';
import { useOffscreenContent } from '@/hooks/canvas/useOffscreenContent';
import { Portal } from '@/components/primitives/Portal';
import { TabLoadOverlay } from '@/components/canvas/TabLoadOverlay';
import { PaletteDragGhost } from '@/components/canvas/PaletteDragGhost';
import type { CanvasProps } from '@/components/canvas/Canvas.types';
import { useCanvasDrawGesture } from '@/components/canvas/useCanvasDrawGesture';
import { useStampGhost } from '@/components/canvas/useStampGhost';
import { useCanvasPolygonGesture } from '@/components/canvas/useCanvasPolygonGesture';
import { usePathTool } from '@/components/canvas/path/usePathTool';
import { PathDraftLayer } from '@/components/canvas/path/PathDraftLayer';
import { PathEditLayer } from '@/components/canvas/path/PathEditLayer';
import { PathEditToolbar } from '@/components/canvas/path/PathEditToolbar';
import { useCanvasSurfaceGestures } from '@/hooks/canvas/useCanvasSurfaceGestures';
import { useCanvasSelectHandlers } from '@/hooks/canvas/useCanvasSelectHandlers';
import { useArrowLabelLayouts } from '@/hooks/canvas/useArrowLabelLayouts';
import { useFontsReady } from '@/components/canvas/useFontsReady';
import { useLatest } from '@/hooks/ui/useLatest';
import { IllustratePages } from '@/components/canvas/IllustratePages';
import { ArticleFlows } from '@/components/canvas/article/ArticleFlows';
import { pressIsOffPage } from '@/hooks/canvas/illustrate-page-guard';

// The canvas boundary (docs/specs/008-canvas/canvas-performance.md "The canvas re-renders only for what it
// shows"): memoised, its `on…` props stable, so an editor render that changes nothing it shows stops here.
export const Canvas = withStableEventProps(CanvasView);

// The canvas is what shows the view (docs/specs/008-canvas/blueprints/viewport-store.md "Inside the
// canvas"): CanvasView subscribes to it; what it renders takes the view only where it shows it.
const wholeView = (v: View) => v;

function CanvasView(props: CanvasProps) {
  const {
    tabLocked,
    readOnly,
    tabBackgroundPattern,
    tabBackgroundColor,
    tabLayers,
    tabKind,
    tabBackgroundOpacity,
    tabBackgroundPatternScale,
    tabBackgroundAnimationSpeed,
    tabPatternColor,
    mainRef,
    isPinchingRef,
    setViewportOffset,
    setViewportZoom,
    elements,
    onSelectMarquee,
    canvasTool,
    onCanvasPointerMove,
    editingId,
    formatSourceId,
    pendingDraw,
    onCommitDraw,
    onCommitFreehand,
    onCommitPolygon,
    onDeselect,
    onSelect,
    onCanvasContextMenu,
    onElementContextMenu,
    onMultiContextMenu,
    onShiftSelect,
    tabThemeId,
    onCanvasDoubleClick,
    tabLoadState,
    onRetryTabLoad,
  } = props;
  const { zoom: viewportZoom, offset: viewportOffset } = useViewportOf(wholeView);
  // The zoom when a handler runs, for what is handed down and must keep its identity across zooms.
  const viewportStore = useViewportStore();
  const readZoom = useCallback(() => viewportStore.get().zoom, [viewportStore]);

  const wrapperRef = useRef<HTMLDivElement>(null);
  // A whiteboard pen's own cursor, as chosen in the dock's More flyout.
  const penCursorValue = useWhiteboardPenCursor(
    pendingDraw,
    props.whiteboardDock?.prefs.cursor,
    viewportZoom,
  );

  // Paint mode covers BOTH painter entry points: a single-shot armed source
  // (toolbar) and the persistent Format canvas tool — the tool must read as
  // paint mode from its first click (copy cursor, handles/label-drag/dblclick
  // suppressed on boxed elements AND arrows), not only once a source is armed.
  const isPaintMode = formatSourceId !== null || canvasTool === 'format';
  // Nudge above the Fit button when everything on the canvas has scrolled out of view.
  // Long tasks, with the gesture they fell in, while the canvas-perf debug scope is on
  // (docs/specs/008-canvas/canvas-performance.md "Observability").
  useCanvasLongTaskLog();
  const offscreenContent = useOffscreenContent(
    elements,
    viewportOffset,
    viewportZoom,
    mainRef,
    props.illustratePages?.pages,
  );
  // The canvas's size, for the pattern's zoom centre (worldPatternOrigin).
  const mainSize = useObservedSize(mainRef) ?? { width: 0, height: 0 };

  // Pan tracking. viewportOffset is owned by the page (so element placement
  // can reason about the visible viewport); we just read/write through props.
  // Palette's bottom-Y (offsetTop + offsetHeight in offsetParent
  // coords). The Comments + AI panels use this to stack below the
  // Palette as it changes height; MovablePanel publishes it via onSize.
  // The bottom-Y (vs height alone) makes the alignment robust to the
  // Palette's own top-utility class, so the stacked panel lands at
  // paletteBottomY + 16 regardless of whether the palette pins to
  // top-2 (mobile) or top-4 (desktop).
  const [paletteBottomY, setPaletteBottomY] = useState<number>(0);
  // Which quick-connect ring (if any) is open. Self-contained state + reset /
  // outside-close effects live in useQuickRing.
  // The selection lives in the store (docs/specs/008-canvas/blueprints/selection-store.md): the canvas
  // reads it when a handler runs and subscribes only to the narrow slices it draws.
  const selectionStore = useSelectionStore();
  const [quickRingOpen, setQuickRingOpen] = useQuickRing(selectionStore);
  // Which panel is open as a popover off its button (the Toolbar Explorer,
  // the cluster popovers). See useDockPopovers; the popover anchor math is
  // the tested computeDockAnchor.
  const {
    activeDockPanel,
    setActiveDockPanel,
    activeDockAnchor,
    setActiveDockAnchor,
    handleDockButtonClick,
  } = useDockPopovers(mainRef);

  // Pan + marquee + held-Space machinery lives in
  // useCanvasPanAndMarquee. The hook owns the pointerdown / move
  // / up listeners and the rect-vs-element marquee intersection,
  // exposes pan / marquee state + setters back so the canvas's
  // own pointerdown handlers can drive it, and exposes the
  // spaceHeldRef the pointerdown reads to decide pan vs marquee (and
  // spaceHeld, its state twin, for the cursor).
  const { pan, setPan, marquee, setMarquee, spaceHeldRef, spaceHeld } = useCanvasPanAndMarquee({
    viewportZoom,
    setViewportOffset,
    elements,
    wrapperRef,
    onDeselect,
    onSelectMarquee,
    onShiftSelect,
    currentSelection: () => {
      const { selectedId, multiSelectedIds } = selectionStore.get();
      return new Set([...multiSelectedIds, ...(selectedId ? [selectedId] : [])]);
    },
    isPinchingRef,
  });

  // Palette drag-drop onto the canvas (onDragOver / onDrop), lifted into
  // usePaletteDrop so the canvas body keeps to layout + pointer routing.
  const paletteDrop = usePaletteDrop({
    onDropPhoto: props.onDropPhoto,
    onDropFile: props.onDropFile,
    onDropLibraryShape: props.onDropLibraryShape,
    // A tile DRAGGED onto the canvas is an edit too (docs/specs/008-canvas/avatar-mode.md), so it leaves
    // Avatar mode the same way a tile click does — otherwise the element
    // landed while the canvas still read as read-only.
    onDropPalette: props.onDropPalette
      ? (kind, x, y, art) => {
          if (canvasTool === 'avatar') props.onExitAvatarMode?.();
          props.onDropPalette?.(kind, x, y, art);
        }
      : undefined,
    viewportZoom,
    wrapperRef,
  });

  const {
    zoomIn: handleZoomIn,
    zoomOut: handleZoomOut,
    setZoomTo: handleSetZoom,
  } = useZoomControls(setViewportZoom);

  // "Are there any arrows" decides whether to mount the ArrowDefs and lay out
  // labels. `some` short-circuits on the first arrow, so the typical render
  // pays O(1).
  const hasArrows = elements.some((el) => el.type === 'arrow');
  // Every arrow label laid out once per element change, avoiding each other
  // (docs/specs/008-canvas/arrow-labels.md). Laid out here, not in the element
  // layer, because the selection toolbars clear a label as part of its arrow.
  const fontsReady = useFontsReady();
  const arrowLabels = useArrowLabelLayouts(elements, hasArrows, props.tabFont, fontsReady);

  // Selection-display derivation (primary element, bounds, and every
  // "show this chrome?" predicate) lives in lib/canvas-selection.ts so
  // it's unit-tested. Memoised because it walks the elements. It reads the elements as a drag in
  // progress shows them (docs/specs/008-canvas/drag-preview.md), so the union handles follow a resize.
  const selectionElements = usePreviewedElements(elements, props.activeTabId ?? '');
  // An object in an article's writing (a chart, an image, a table) connects to nothing: no
  // quick-connect pluses on it (docs/specs/007-editor/article-pages.md "Zones"). A predicate the
  // selection derivation applies, so the canvas itself still doesn't read the selection.
  const articlePages = props.illustratePages?.pages;
  const plusBlocked = useMemo(() => {
    if (!articlePages?.some((p) => p.flow)) return undefined;
    return (el: Element) => {
      if (isDrawingElement(el)) return false;
      const at = zoneAnchorOf(el, selectionElements);
      return articlePages.some(
        (p) =>
          p.flow &&
          at.x >= p.rect.x &&
          at.x <= p.rect.x + p.rect.width &&
          at.y >= p.rect.y &&
          at.y <= p.rect.y + p.rect.height,
      );
    };
  }, [articlePages, selectionElements]);
  const selectionInput = useMemo<CanvasSelectionInput>(
    () => ({
      elements: selectionElements,
      editingId,
      isPaintMode,
      tabLocked,
      readOnly,
      esBoard: isEventStormingTab({ kind: tabKind, layers: tabLayers }),
      elementMenuOpen: props.elementMenuOpen === true,
      labelRectOf: arrowLabels.labelRectOf,
      plusBlocked,
    }),
    [
      selectionElements,
      editingId,
      isPaintMode,
      tabLocked,
      readOnly,
      tabLayers,
      tabKind,
      props.elementMenuOpen,
      arrowLabels,
      plusBlocked,
    ],
  );
  // The one selected element when it is a path: the path tool's edit gesture arms on it.
  const soleSelectedPathId = useSelectionOf(
    useCallback(
      (s: Selection) =>
        s.multiSelectedIds.size === 0 &&
        s.selectedId !== null &&
        elements.some((el) => el.id === s.selectedId && el.type === 'path')
          ? s.selectedId
          : null,
      [elements],
    ),
  );

  // Spotlight presenter tool (docs/specs/008-canvas/canvas-and-palette.md): screen-space light position +
  // radius. Local to Canvas so the click handlers, the pointer tracker, and
  // the overlay share one source of truth; survives Pan/Select detours
  // because Canvas stays mounted.
  const spotlight = useSpotlight();
  // The spotlight's look (docs/specs/008-canvas/spotlight-panel.md): persisted per browser, read by the
  // overlay and edited from the Spotlight Panel down in the chrome.
  const spotlightLook = useSpotlightConfig();
  // Where to draw the eraser's brush ring, in <main>-relative px. Null until
  // the pointer has been over the canvas — an eraser ring parked in the middle
  // of the screen would claim a brush that isn't there.
  const [eraserPos, setEraserPos] = useState<{ x: number; y: number } | null>(null);

  // Avatar mode (docs/specs/008-canvas/avatar-mode.md): the walking character's position / facing / step
  // frame, its click-to-walk entry point, and the camera follow. Owns its own
  // rAF loop, dormant unless the tool is active.
  // The character's gender / clothing / hair / size (docs/specs/008-canvas/avatar-mode.md), persisted per
  // browser. Owned here because both the sprite and the Avatar Panel (down in
  // CanvasChrome) read it, and it outlives any one walk.
  const avatarLook = useAvatarConfig({ active: canvasTool === 'avatar' });
  // Where the next entry into Avatar mode should place the character, when it
  // was entered by pressing a button on the canvas. Cleared once used, so a
  // later entry from the palette spawns at the viewport centre as before.
  const avatarSpawnRef = useRef<AvatarPoint | null>(null);
  const pressModeButton = (element: ShapeElement) => {
    if ((element.mode ?? DEFAULT_BUTTON_MODE) === 'avatar') {
      // Feet just below the button, centred on it: standing ON the button would
      // read as the character having pressed itself out of existence.
      avatarSpawnRef.current = {
        x: element.x + element.width / 2,
        y: element.y + element.height + AVATAR_SPAWN_GAP,
      };
    }
    props.onPressModeButton?.(element);
  };
  // Declared before the hook that fills it: the walk hook's chair callback
  // needs `sitOn`, which the same hook returns (see enterPortalRef below for
  // the identical knot).
  // The burst the avatar panel has asked for, if any. Ephemeral exactly like
  // a pad's (docs/specs/009-elements/reaction-pad.md): nothing is stored and nothing is replayed.
  const [avatarBurst, setAvatarBurst] = useState<{ reaction: Reaction; seed: number } | null>(null);
  const avatarBurstSeq = useRef(0);
  const avatar = useAvatarWalk({
    active: canvasTool === 'avatar',
    config: avatarLook.config,
    onToggleGender: avatarLook.toggleGender,
    elements,
    mainRef,
    wrapperRef,
    viewportOffset,
    viewportZoom,
    setViewportOffset,
    spawnAtRef: avatarSpawnRef,
    onPresence: props.onAvatarPresence,
    // Walking the character into a portal travels through it (docs/specs/009-elements/portal-element.md) — the same
    // action the portal's own click fires.
    onWalkIntoPortal: (element) => enterPortalRef.current(element),
    // Chair (docs/specs/009-elements/chair.md): walking onto one sits the character down, snapped to
    // the seat point so it sits ON the chair rather than wherever it arrived.
    onWalkIntoChair: (element) => {
      const facing = element.chairFacing ?? DEFAULT_CHAIR_FACING;
      avatarRef.current?.sitOn(
        element.id,
        chairSeatPoint(element, facing),
        CHAIR_SITTER_FACING[facing],
      );
    },
    // Reaction pad (docs/specs/009-elements/reaction-pad.md): walking onto one is the same act as pressing
    // it, so it runs the same handler.
    onWalkIntoReactionPad: (element) => props.onFireReaction?.(element),
  });
  // `sitOn` is returned by the very hook whose callback needs it, so the call
  // goes through a ref — declared above, repointed here, read at arrival time.
  // Same shape as `enterPortalRef` below, for the same reason.
  const avatarRef = useLatest<ReturnType<typeof useAvatarWalk> | null>(avatar);

  // Who is sitting in each chair, from PRESENCE — never from the document. Our
  // own character plus every peer's, keyed by chair id, so a chair empties by
  // itself the moment its occupant leaves the mode, changes tab or drops off.
  // Kept by value: presence rebuilds the peers' list often (a join, a colour), and a new map would
  // render every element view for chairs nobody sits in.
  const chairSitters = useByValue(
    useMemo(
      () =>
        sittersByChair(
          avatar.seatedOn,
          props.selfParticipant.color,
          props.remoteAvatars.map((peer) => ({
            name: peer.name,
            color: peer.color,
            seatedOn: peer.avatar.seatedOn,
          })),
        ),
      [avatar.seatedOn, props.remoteAvatars, props.selfParticipant.color],
    ),
    sameSitters,
  );
  // Stable while nobody sits or stands, so the element views' memo holds
  // (docs/specs/008-canvas/canvas-performance.md); it changes exactly when a chair must re-render.
  const sittersOf = useCallback(
    (elementId: string) => chairSitters.get(elementId) ?? [],
    [chairSitters],
  );
  // Somebody pushed us (docs/specs/008-canvas/avatar-mode.md): slide along their direction, once per push.
  // Keyed on the sequence number, not the vector, so two identical shoves in a
  // row both land.
  const lastShoveRef = useRef<number | null>(null);
  // `avatar` is a fresh object every render; the shove is the trigger, so the
  // push itself is an effect event.
  const applyShove = useEffectEvent((dx: number, dy: number) => avatar.shove(dx, dy));
  useEffect(() => {
    const shove = props.avatarShove;
    if (!shove || shove.seq === lastShoveRef.current) return;
    lastShoveRef.current = shove.seq;
    applyShove(shove.dx, shove.dy);
  }, [props.avatarShove]);

  // Bounds of whatever the avatar is standing on, for its "you are here" ring.
  const avatarStandingOn = useMemo(() => {
    if (!avatar.standingOnId) return null;
    const el = elements.find((e) => e.id === avatar.standingOnId);
    return el && isBoxed(el) ? { x: el.x, y: el.y, width: el.width, height: el.height } : null;
  }, [avatar.standingOnId, elements]);
  const { enterPortal, resolvePortal } = usePortalTravel({
    elements,
    tabs: props.portalTabs,
    activeTabId: props.activeTabId,
    onFollowLink: props.onFollowLink,
    mainRef,
    readZoom,
    setViewportOffset,
    teleportTo: avatar.teleportTo,
  });
  // Portals (docs/specs/009-elements/portal-element.md): the camera centres on the paired portal and the walking
  // character steps out of it — see usePortalTravel.
  //
  // `enterPortal` needs the avatar hook (to place the character) and the hook
  // needs `enterPortal` (for the walk-in), so the callback goes through a ref:
  // declared here, repointed on every render, read at call time.
  const enterPortalRef = useLatest<(from: ShapeElement) => void>(enterPortal);

  // Isometric view (docs/specs/008-canvas/isometric-view.md): the orbit-able camera + the innermost
  // transform fragment, pivoted on the content centre — see
  // useIsometricView. Shift-drag on the canvas spins / tilts it (see
  // the <main> pointerdown handler).
  const { isoCamera, isoFragment } = useIsometricView({ canvasTool, elements, mainRef });

  const cursorClass = canvasCursorClass({
    pendingDraw: !!pendingDraw,
    pan: !!pan,
    marquee: !!marquee,
    canvasTool,
    spaceHeld,
    isPaintMode,
  });

  // Colour for the link / comment badges. The active theme's
  // elementStroke is the obvious "this theme's accent" — it's what
  // arrows and new shape outlines use. The Brand theme has no stroke
  // override, so fall back to brand-500 (the hex behind bg-brand-500).
  const badgeColor = getTheme(tabThemeId).elementStroke ?? '#0ea5e9';

  // Broadcast the local pointer position to peers (canvas-coords).
  // Throttling lives in page.tsx so the Canvas stays prop-driven.
  const handlePointerMoveCanvas = (e: React.PointerEvent) => {
    // Spotlight tracks the cursor in SCREEN space (px relative to <main>),
    // not canvas-coords: its light must stay put on screen as the canvas
    // pans / zooms under it. <main> is `position: relative` with no border,
    // so its content origin is its bounding-rect top-left.
    if (canvasTool === 'spotlight' || canvasTool === 'eraser') {
      const node = mainRef && 'current' in mainRef ? mainRef.current : null;
      const mr = node?.getBoundingClientRect();
      const at = mr ? { x: e.clientX - mr.left, y: e.clientY - mr.top } : null;
      // The eraser's brush ring (docs/specs/008-canvas/eraser-panel.md) needs the same screen-space point
      // the spotlight's light does, so they share the measurement.
      if (at && canvasTool === 'spotlight') spotlight.setPos(at);
      if (at && canvasTool === 'eraser') setEraserPos(at);
    }
    const rect = wrapperRef.current?.getBoundingClientRect();
    if (!rect) return;
    const { x: sx, y: sy } = pointerToCanvas(e.clientX, e.clientY, rect, viewportZoom);
    onCanvasPointerMove(sx, sy, e.target);
  };
  const handlePointerLeaveCanvas = () => {
    onCanvasPointerMove(null, null);
  };

  // Stable selection-routing wrappers for the memo'd element / arrow
  // views — see useCanvasSelectHandlers.
  const { handleElementContextSelect, handleArrowSelect, handleElementClick } =
    useCanvasSelectHandlers({
      inertIds: props.layerInertIds,
      isPaintMode,
      readSelection: selectionStore.get,
      onSelect,
      onDeselect,
      onShiftSelect,
      onElementContextMenu,
      onMultiContextMenu,
    });

  // An armed workshop-note tile is a STAMP, not a draw-to-size (docs/specs/021-event-storming/event-storming.md
  // Phase 4): its ghost follows the pointer, and the draw gesture places by the
  // same rule.
  const { stamp, stampAt, showStamp } = useStampGhost({
    pendingDraw,
    elements,
    tabKind: props.tabKind,
    tabLayers: props.tabLayers,
    viewportZoom,
    wrapperRef,
  });
  const { drawDrag, penPoints, penStroke, drawHover, beginPendingDrawGesture } =
    useCanvasDrawGesture({
      pendingDraw,
      elements,
      wrapperRef,
      viewportZoom,
      isPinchingRef,
      onCommitDraw,
      onCommitFreehand,
      stampAt,
      showStamp,
    });

  // Polygon click-to-place gesture (docs/specs/008-canvas/polygon-tool.md), composed IN FRONT of the
  // drag-based draw gesture: while the polygon intent is armed it
  // claims every draw-intercept press as a vertex placement.
  const { polygonVertices, polygonCursor, beginPolygonPoint, handlePolygonDoubleClick } =
    useCanvasPolygonGesture({
      pendingDraw,
      elements,
      wrapperRef,
      viewportZoom,
      onCommitPolygon,
    });
  // The Path tool (docs/specs/023-draw-mode/path-tool.md), in front of both: see usePathTool.
  const pathTool = usePathTool({
    pendingDraw,
    canvasTool,
    elements,
    inertIds: props.layerInertIds,
    wrapperRef,
    viewportZoom,
    activeTabId: props.activeTabId,
    editingId,
    soleSelectedPathId,
    onCommitPath: props.onCommitPath,
    onCommitPathEdit: props.onCommitPathEdit,
    onDressPath: props.onDressPath,
    onLeaveEdit: props.onCancelEdit,
    onDeselect,
    onBeginEdit: props.onBeginEdit,
    onCancelDraw: props.onCancelDraw,
  });
  // In Illustrate mode a press off the page is claimed and dropped: nothing is made there.
  const offPage = (e: { clientX: number; clientY: number }) =>
    pressIsOffPage(props.illustratePages, e, wrapperRef, viewportZoom);
  const beginPendingDrawOrPolygon = (e: React.PointerEvent): boolean =>
    offPage(e) || pathTool.beginPathPress(e) || beginPolygonPoint(e) || beginPendingDrawGesture(e);

  // Bare-surface press routing (capture intercepts, background context
  // menu, pan-vs-marquee) lives in useCanvasSurfaceGestures; the JSX
  // below mounts its handlers verbatim.
  const surface = useCanvasSurfaceGestures({
    canvasTool,
    middleMousePan: props.settings?.middleMousePan !== false,
    pendingDraw,
    whiteboard: props.whiteboardDock !== undefined,
    viewportOffset,
    viewportZoom,
    mainRef,
    wrapperRef,
    spaceHeldRef,
    setPan,
    setMarquee,
    spotlight,
    avatar,
    peerAvatars: props.remoteAvatars,
    onPushPeer: props.onAvatarPush,
    isoCamera,
    beginPendingDrawGesture: beginPendingDrawOrPolygon,
    interceptPress: pathTool.beginEditPress,
    onEraseStart: props.onEraseStart,
    onCanvasContextMenu,
    onDeselect,
    onCanvasDoubleClick,
  });

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
  // Mind map (docs/specs/009-elements/mind-node.md): the growers the label editor and the "+" reach.
  const { onGrowMindNode, onAbandonMindNode } = props;
  const mindGrow = useMemo(
    () => ({ grow: onGrowMindNode, abandon: onAbandonMindNode }),
    [onGrowMindNode, onAbandonMindNode],
  );
  // The Edit Outline badge on each map root (MindOutlineContext).
  const mindOutlineBadges = useMindOutlineBadges(
    elements,
    props.canEditMindOutline,
    props.onEditMindOutline,
    props.onTidyMindMap,
  );
  return (
    <main
      ref={mainRef}
      // In the tab order (docs/specs/004-interface-design/canvas-accessibility.md): keyboard users Tab to the canvas as
      // one stop, then Tab / Shift+Tab walk the elements (useCanvasA11y,
      // engaged only while this surface itself is focused — the marker
      // attribute below is how the hook recognises it). The role stays
      // the main landmark (not "application") because the floating
      // panels render inside it and must keep normal SR navigation.
      tabIndex={0}
      aria-label="Canvas"
      data-canvas-a11y-root=""
      onPointerMove={handlePointerMoveCanvas}
      onPointerLeave={handlePointerLeaveCanvas}
      onDragOver={paletteDrop.onDragOver}
      onDrop={paletteDrop.onDrop}
      onPointerDownCapture={surface.onPointerDownCapture}
      // A dark backdrop deepens the sticky paper-peel (docs/specs/008-canvas/canvas-and-palette.md): the shadow
      // ink is tuned for light paper and vanishes on a dark wall. Flagged
      // here so the peel's CSS can respond without knowing about themes.
      data-dark-canvas={isDarkCanvas(tabBackgroundColor) ? '' : undefined}
      onContextMenuCapture={surface.onContextMenuCapture}
      onContextMenu={surface.onContextMenu}
      onPointerUp={surface.onContextMenuPointerUp}
      onPointerDown={surface.onPointerDown}
      // focus-visible ring only: pointer focus stays outline-free, but a
      // keyboard user Tabbing to the canvas sees where they landed.
      // overflow-clip, not overflow-hidden: a hidden box still scrolls (focus revealing a label
      // editor past the bottom edge, a scrollIntoView), and the corner chrome positioned in it (the
      // bottom-right cluster, the Map) rode up the screen by every scroll and stayed there. A
      // clipped box clips the same and can never scroll (docs/specs/008-canvas/canvas-and-palette.md).
      className={`relative flex-1 touch-none select-none overflow-clip outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-400/70 [-webkit-touch-callout:none] [-webkit-tap-highlight-color:transparent] ${
        pendingDraw ? '' : cursorClass
      }`}
      style={{
        // The paper hollow arrowheads fill with (arrow-defs.tsx).
        ['--lvd-canvas-paper' as string]: tabBackgroundColor,
        // In world space: the pattern pans and zooms with the elements, so
        // they stay on the same dots at any zoom (worldPatternOrigin).
        ...tabBackgroundStyle(
          tabBackgroundPattern,
          worldPatternOrigin(viewportOffset, viewportZoom, {
            w: mainSize.width,
            h: mainSize.height,
          }),
          tabBackgroundColor,
          tabPatternColor,
          tabBackgroundOpacity,
          tabBackgroundPatternScale * viewportZoom,
        ),
        // Mirror the inner-wrapper cursor on <main>. The inner div is
        // `absolute inset-0` but its CSS transform scales it (zoom),
        // so when zoom is below 1 the hit area shrinks and the
        // surrounding "letterbox" gap falls through to <main>. Without
        // setting cursor here too, the user would see the OS default
        // arrow in that gap while a draw-to-size intent is pending.
        ...(pendingDraw ? { cursor: penCursorValue ?? drawIntentCursor(pendingDraw) } : null),
        ...(pathTool.cursor ? { cursor: pathTool.cursor } : null),
      }}
    >
      {/* SR-only polite live region (docs/specs/004-interface-design/canvas-accessibility.md): selection / delete / undo
          announcements land here. */}
      <CanvasLiveRegion />
      {/* Animated backdrops (docs/specs/008-canvas/canvas-and-palette.md) paint as an ambient overlay behind the
          canvas content; the static patterns ride the <main> background
          above. tabBackgroundStyle returns just the backdrop colour for
          these, so this layer is the only thing that draws their motion. */}
      {isAnimatedPattern(tabBackgroundPattern) ? (
        <AnimatedCanvasBackground
          variant={tabBackgroundPattern}
          color={tabPatternColor}
          scale={tabBackgroundPatternScale}
          speed={tabBackgroundAnimationSpeed}
          opacity={tabBackgroundOpacity}
        />
      ) : null}
      <div
        ref={wrapperRef}
        onPointerDown={surface.onWrapperPointerDown}
        onDoubleClick={(e) => {
          // Polygon finish-line double-click (docs/specs/008-canvas/polygon-tool.md) wins over the
          // add-text double-click while the intent is armed.
          if (handlePolygonDoubleClick() || pathTool.handlePathDoubleClick()) return;
          if (offPage(e)) return;
          surface.onWrapperDoubleClick(e);
        }}
        // Spotlight (docs/specs/008-canvas/canvas-and-palette.md) is a non-editing presenter mode: make the whole
        // canvas layer ignore pointer events so NO element kind can be
        // selected, dragged, or edited (a per-element capture guard can't
        // catch every select path — boxed elements, arrow hit-bands, labels,
        // click vs pointerdown). Clicks then fall through to <main>, where the
        // capture handler turns them into grow / shrink, and middle-mouse or
        // held-Space still pans.
        // Isometric view (docs/specs/008-canvas/isometric-view.md): like Spotlight, the layer goes
        // pointer-events-none so NO element kind can be selected / dragged —
        // it's a read-only view tool. Clicks fall through to <main>, where a
        // drag pans (canvasTool === 'isometric' is added to `wantsPan`).
        // Avatar mode (docs/specs/008-canvas/avatar-mode.md): same treatment for the same reason — the mode
        // is read-only, so the canvas layer goes inert and every click falls
        // through to <main>, where the capture handler turns it into a walk.
        className={`absolute inset-0 origin-center touch-none ${
          canvasTool === 'spotlight' || canvasTool === 'isometric' || canvasTool === 'avatar'
            ? 'pointer-events-none'
            : ''
        } ${pendingDraw ? '' : cursorClass}`}
        // Scopes the [data-iso] CSS (globals.css): frames settle just under
        // the base plane while the camera orbits so they can't z-fight
        // (flicker) with the coplanar contents above them.
        data-iso={canvasTool === 'isometric' ? '' : undefined}
        // A whiteboard pen draws wherever it presses, so nothing under it swaps
        // the pen cursor for its own (globals.css, docs/specs/023-draw-mode/draw-mode.md "Pens").
        data-pen-in-hand={
          (pendingDraw?.type === 'freehand' && pendingDraw.variant === 'whiteboard') ||
          pendingDraw?.type === 'path'
            ? ''
            : undefined
        }
        data-path-cursor={pathTool.cursor ? '' : undefined}
        // Fades in as the editor arrives (globals.css, "Editor fade-in").
        data-canvas-world=""
        style={{
          // Translate is in canvas-coords (applied first); scale is centred
          // on the wrapper so zooming keeps the viewport centre stable.
          // Isometric tilt (docs/specs/008-canvas/isometric-view.md) is appended INNERMOST (last in the list,
          // so it transforms the content first): that keeps the pan translate
          // in screen space, so a drag moves the scene the way the cursor
          // moves at any camera angle. The fragment (built above as
          // isoFragment) pivots the tilt around the content centre so the
          // canvas tilts in place / stays centred while orbiting rather than
          // swinging off-screen. preserve-3d lets the depth layer's
          // translateZ stack read as real extruded height.
          transform: `scale(${viewportZoom}) translate(${viewportOffset.x}px, ${viewportOffset.y}px)${isoFragment}`,
          ...(canvasTool === 'isometric' ? { transformStyle: 'preserve-3d' as const } : null),
          // Draw-mode cursor: every intent gets a custom inline-SVG
          // cursor (crosshair at the pointer tip plus a small glyph
          // hinting at what's about to land). Without this, tool
          // intents inherited the default arrow cursor because the
          // wrapper drops its Tailwind cursor- class above when
          // pendingDraw is set, leaving no cursor specified at all.
          ...(pendingDraw ? { cursor: penCursorValue ?? drawIntentCursor(pendingDraw) } : null),
          // A path in its edit mode says what a press would do (usePathTool).
          ...(pathTool.cursor ? { cursor: pathTool.cursor } : null),
        }}
      >
        {/* Isometric extrusion (docs/specs/008-canvas/isometric-view.md): per-element raised blocks painted
            behind the real element layer, which caps each column at z=0.
            Only mounted while the tool is active. */}
        {canvasTool === 'isometric' ? <IsometricDepthLayer elements={elements} /> : null}
        {/* Illustrate mode's A4 pages, under every element (IllustratePages). */}
        {props.illustratePages ? (
          <IllustratePages
            view={props.illustratePages}
            zoom={viewportZoom}
            // Zen, presenting and the isometric view show the sheets alone: no labels, cogs,
            // layout invites or add button.
            bare={props.zenMode === true || canvasTool === 'isometric'}
          />
        ) : null}
        {/* Article pages' writing (ArticleFlows), over the sheets and under the elements, so a
            zone's elements sit in the room the writing leaves them. */}
        {props.illustratePages?.articles && canvasTool !== 'isometric' ? (
          <ArticleFlows
            view={props.illustratePages}
            zoom={viewportZoom}
            interactive={!pendingDraw && canvasTool !== 'spotlight' && canvasTool !== 'avatar'}
            elements={elements}
          />
        ) : null}
        <CanvasStillProvider still={props.editorMode === 'draw'}>
          {/* The zoom reaches only the counter-scaled parts of each element
              (docs/specs/008-canvas/canvas-performance.md). */}
          <CanvasZoomProvider zoom={viewportZoom}>
            <MindGrowProvider value={mindGrow}>
              <MindOutlineProvider value={mindOutlineBadges}>
                <CanvasElementsLayer
                  {...props}
                  elements={pathTool.elements}
                  // Portal travel is resolved HERE (Canvas owns the viewport + the avatar),
                  // so the prop from the host is overridden with the local resolver.
                  onEnterPortal={resolvePortal}
                  onFireReaction={props.onFireReaction}
                  reactionBursts={props.reactionBursts}
                  onReactionBurstDone={props.onReactionBurstDone}
                  // Chair (docs/specs/009-elements/chair.md): occupancy resolved here, where peer presence
                  // lives, rather than threaded from the page.
                  chairSitters={sittersOf}
                  // Pressing a Selection Mode button that hands out Avatar mode drops
                  // the character at THAT button (see avatarSpawn), not the viewport
                  // centre: you pressed a thing on the canvas, so the character should
                  // appear where you pressed it.
                  onPressModeButton={pressModeButton}
                  onPressFocusButton={props.onPressFocusButton}
                  hasArrows={hasArrows}
                  arrowLabels={arrowLabels}
                  badgeColor={badgeColor}
                  selectionInput={selectionInput}
                  isPaintMode={isPaintMode}
                  handleArrowSelect={handleArrowSelect}
                  handleElementClick={handleElementClick}
                  handleElementContextSelect={handleElementContextSelect}
                  quickRingOpen={quickRingOpen}
                  setQuickRingOpen={setQuickRingOpen}
                  drawDrag={drawDrag}
                />
              </MindOutlineProvider>
            </MindGrowProvider>
          </CanvasZoomProvider>
        </CanvasStillProvider>
        {/* The whiteboard pen's stroke being drawn (docs/specs/023-draw-mode/draw-mode.md "Pens"):
            in this transformed layer, after the elements, laid out as the stroke it lands as, so
            the same layer rasterises both and release changes no pixel. */}
        {penStroke && isWhiteboardPenIntent(pendingDraw) ? (
          <WhiteboardPenPreview
            stroke={penStroke}
            pen={pendingDraw}
            ink={props.whiteboardInk ?? 'currentColor'}
            zoom={viewportZoom}
          />
        ) : null}
        {/* The path being drawn (docs/specs/023-draw-mode/path-tool.md), in the same layer. */}
        {pathTool.draftView ? <PathDraftLayer {...pathTool.draftView} /> : null}
        {pathTool.editView ? <PathEditLayer {...pathTool.editView} /> : null}
        {/* Avatar mode (docs/specs/008-canvas/avatar-mode.md): the walking characters, INSIDE the
            transformed wrapper so they pan / zoom with the canvas, and after
            the element layer so they stand in front of the content they walk
            over. Peers' characters render whether or not WE are in the mode —
            someone else walking the canvas is worth seeing regardless. */}
        {props.remoteAvatars.map((peer) => (
          <AvatarWalker
            key={peer.id}
            pos={{ x: peer.avatar.x, y: peer.avatar.y }}
            facing={peer.avatar.facing}
            // Parsed, not trusted: an older peer omits the costume entirely and
            // a future one may send an option this build doesn't know.
            config={parseAvatarConfig(peer.avatar.config)}
            walking={peer.avatar.walking}
            stepFrame={peer.avatar.stepFrame}
            lift={peer.avatar.lift}
            wave={peer.avatar.wave}
            seated={!!peer.avatar.seatedOn}
            // Replayed locally from the kind + elapsed time in their packet, by
            // the same pure function the sender used (docs/specs/008-canvas/avatar-mode.md).
            pose={
              peer.avatar.reaction
                ? reactionPose(peer.avatar.reaction.kind, peer.avatar.reaction.elapsedMs)
                : null
            }
            shirt={peer.color}
            name={peer.name}
            standingOn={null}
          />
        ))}
        {/* A Reaction Pad burst (docs/specs/009-elements/reaction-pad.md) thrown around the CHARACTER rather
            than around a pad. Same engine, same particles: the pad and the
            avatar panel are two ways to set off one effect, not two effects.
            Positioned at the character's canvas point, inside the transformed
            wrapper, so it pans and zooms with the canvas it is celebrating. */}
        {avatar.pos && avatarBurst ? (
          <div
            className="pointer-events-none absolute"
            style={{ left: avatar.pos.x, top: avatar.pos.y, width: 0, height: 0 }}
          >
            <ReactionBurst
              reaction={avatarBurst.reaction}
              seed={avatarBurst.seed}
              // The character's own footprint, so the burst is scaled to a
              // person rather than to whatever pad happened to throw it.
              width={AVATAR_BURST_PX}
              height={AVATAR_BURST_PX}
              onDone={() => setAvatarBurst(null)}
            />
          </div>
        ) : null}
        {avatar.pos ? (
          <AvatarWalker
            pos={avatar.pos}
            facing={avatar.facing}
            config={avatarLook.config}
            walking={avatar.walking}
            stepFrame={avatar.stepFrame}
            lift={avatar.lift}
            wave={avatar.wave}
            pose={avatar.pose}
            seated={avatar.seatedOn !== null}
            shirt={props.selfParticipant.color}
            standingOn={avatarStandingOn}
            onStand={avatar.standUp}
          />
        ) : null}
      </div>

      {/* Spotlight presenter shroud (docs/specs/008-canvas/canvas-and-palette.md). Screen-space sibling of the
          transformed wrapper so the light stays fixed on screen while the
          canvas pans / zooms underneath. Rendered before CanvasChrome so the
          palette + chrome paint ON TOP and stay reachable to switch tools
          back; pointer-events-none lets clicks fall through to <main>. */}
      {/* The eraser's brush ring (docs/specs/008-canvas/eraser-panel.md): the same screen-space layer as
          the shroud, for the same reason — it must not pan or zoom with the
          canvas, and it must never take a pointer event. */}
      {canvasTool === 'eraser' ? (
        <EraserBrushRing
          pos={eraserPos}
          // A whiteboard's brush is fixed per mode (docs/specs/023-draw-mode/draw-mode.md "Eraser").
          radius={
            props.whiteboardDock
              ? WHITEBOARD_ERASER_RADIUS_PX[props.whiteboardDock.prefs.eraserMode]
              : eraserRadius(props.eraserConfig ?? DEFAULT_ERASER_CONFIG)
          }
          filtered={
            !props.whiteboardDock &&
            (props.eraserConfig ?? DEFAULT_ERASER_CONFIG).target !== 'anything'
          }
        />
      ) : null}
      {canvasTool === 'spotlight' ? (
        <SpotlightOverlay
          pos={spotlight.pos}
          radius={spotlight.radius}
          config={spotlightLook.config}
        />
      ) : null}

      <CanvasSelectionToolbars
        props={props}
        selectionInput={selectionInput}
        quickRingOpen={quickRingOpen !== null}
      />
      {pathTool.toolbar ? (
        <PathEditToolbar
          {...pathTool.toolbar}
          viewportOffset={viewportOffset}
          zoom={viewportZoom}
        />
      ) : null}

      <CanvasChrome
        {...props}
        // While a path is being drawn, Undo and Redo (the dock's and the corner's) step through its
        // nodes, not the board (docs/specs/023-draw-mode/path-tool.md "Drawing").
        {...(pathTool.history
          ? {
              canUndo: pathTool.history.canUndo,
              canRedo: pathTool.history.canRedo,
              onUndo: pathTool.history.undo,
              onRedo: pathTool.history.redo,
            }
          : null)}
        isPaintMode={isPaintMode}
        mainSize={mainSize}
        avatarConfig={avatarLook.config}
        onChangeAvatarField={avatarLook.setField}
        laserConfig={props.laserConfig}
        onChangeLaserField={props.onChangeLaserField}
        spotlightConfig={spotlightLook.config}
        onChangeSpotlightField={spotlightLook.setField}
        spotlightRadius={spotlight.radius}
        onSetSpotlightRadius={spotlight.setRadius}
        spotlightPanelPosition={props.spotlightPanelPosition}
        onMoveSpotlightPanel={props.onMoveSpotlightPanel}
        onResetSpotlightPanel={props.onResetSpotlightPanel}
        eraserConfig={props.eraserConfig}
        onChangeEraserField={props.onChangeEraserField}
        formatConfig={props.formatConfig}
        onToggleFormatGroup={props.onToggleFormatGroup}
        onSetFormatMode={props.onSetFormatMode}
        formatBrushSource={props.formatBrushSource}
        formatPanelPosition={props.formatPanelPosition}
        onMoveFormatPanel={props.onMoveFormatPanel}
        onResetFormatPanel={props.onResetFormatPanel}
        eraserPanelPosition={props.eraserPanelPosition}
        onMoveEraserPanel={props.onMoveEraserPanel}
        onResetEraserPanel={props.onResetEraserPanel}
        laserPanelPosition={props.laserPanelPosition}
        onMoveLaserPanel={props.onMoveLaserPanel}
        onResetLaserPanel={props.onResetLaserPanel}
        onRandomiseAvatar={avatarLook.randomise}
        onAvatarReaction={avatar.playReaction}
        onAvatarBurst={(reaction: Reaction) => {
          // A fresh seed each  press, so pressing the same reaction twice replays
          // rather than continuing.
          avatarBurstSeq.current += 1;
          setAvatarBurst({ reaction, seed: avatarBurstSeq.current });
        }}
        offscreenContent={offscreenContent}
        marquee={marquee}
        drawDrag={drawDrag}
        drawHover={drawHover}
        stamp={stamp}
        penPoints={penPoints}
        polygonVertices={polygonVertices}
        polygonCursor={polygonCursor}
        wrapperRef={wrapperRef}
        paletteBottomY={paletteBottomY}
        setPaletteBottomY={setPaletteBottomY}
        activeDockPanel={activeDockPanel}
        setActiveDockPanel={setActiveDockPanel}
        activeDockAnchor={activeDockAnchor}
        setActiveDockAnchor={setActiveDockAnchor}
        handleDockButtonClick={handleDockButtonClick}
        handleZoomIn={handleZoomIn}
        handleZoomOut={handleZoomOut}
        handleSetZoom={handleSetZoom}
        onIsoOrbit={isoCamera.startOrbit}
        onIsoReset={isoCamera.reset}
      />
      {/* Lazy per-tab load (docs/specs/006-document/per-tab-storage.md). Last child + z-[var(--z-overlay)] so it covers the
          canvas AND the floating palette, blocking any edit that would
          otherwise overwrite an unfetched tab's real content. */}
      {tabLoadState && tabLoadState !== 'ready' ? (
        <TabLoadOverlay state={tabLoadState} onRetry={() => onRetryTabLoad?.()} />
      ) : null}
      {/* Drag-to-add ghost (docs/specs/010-palette/palette-drag-ghost.md): previews where a dragged palette shape
          will land, following the cursor over the canvas. */}
      <PaletteDragGhost zoom={viewportZoom} />
      {/* Map (docs/specs/008-canvas/minimap.md) now renders inside CanvasChrome's docking layer
          (docs/specs/007-editor/panel-docking.md) so it snaps + stacks like the other floating panels. */}
      {/* Touch long-press "hold" ring at the finger: the docs/specs/008-canvas/canvas-and-palette.md
          press-and-hold affordance that opens the context menu on touch.
          Portaled to escape the canvas's pan/zoom transform so its fixed
          position is viewport-relative. Reveals only after a deliberate hold
          and completes as the context menu opens. */}
      {surface.canvasLongPress.pressPoint ? (
        <Portal>
          <div
            aria-hidden
            className="animate-longpress-hold pointer-events-none fixed z-[var(--z-toast)] h-9 w-9 rounded-full border-2 border-brand-500/70"
            style={{
              left: surface.canvasLongPress.pressPoint.x,
              top: surface.canvasLongPress.pressPoint.y,
            }}
          />
        </Portal>
      ) : null}
    </main>
  );
}
