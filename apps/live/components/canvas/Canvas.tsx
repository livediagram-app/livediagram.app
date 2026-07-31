import { useEffect, useMemo, useRef, useState } from 'react';
import {
  DEFAULT_BUTTON_MODE,
  isAnimatedPattern,
  isBoxed,
  type ShapeElement,
} from '@livediagram/diagram';
import { tabBackgroundStyle } from '@/lib/canvas-backgrounds';
import { AnimatedCanvasBackground } from '@/components/canvas/AnimatedCanvasBackground';
import { pointerToCanvas } from '@/lib/canvas';
import { deriveCanvasSelection } from '@/lib/canvas-selection';
import { canvasCursorClass } from '@/lib/canvas-chrome';
import { useCanvasMobileDock } from '@/hooks/canvas/useCanvasMobileDock';
import { drawIntentCursor } from '@/lib/draw-mode';
import { useCanvasPanAndMarquee } from '@/hooks/canvas/useCanvasPanAndMarquee';
import { useQuickRing } from '@/hooks/canvas/useQuickRing';
import { useZoomControls } from '@/hooks/canvas/useZoomControls';
import { usePaletteDrop } from '@/hooks/canvas/usePaletteDrop';
import { useLongPress } from '@/hooks/ui/useLongPress';
import { getTheme } from '@/lib/themes';
import { CanvasSelectionToolbars } from '@/components/canvas/CanvasSelectionToolbars';
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

import { CanvasChrome } from '@/components/canvas/CanvasChrome';
import { CanvasElementsLayer } from '@/components/canvas/CanvasElementsLayer';
import { MindGrowProvider } from '@/components/canvas/MindGrowContext';
import { CanvasLiveRegion } from '@/components/canvas/CanvasLiveRegion';
import { IsometricDepthLayer } from '@/components/canvas/IsometricDepthLayer';
import { useIsometricView } from '@/hooks/canvas/useIsometricView';
import { SpotlightOverlay } from '@/components/canvas/SpotlightOverlay';
import { EraserBrushRing } from '@/components/canvas/EraserBrushRing';
import { DEFAULT_ERASER_CONFIG, eraserRadius } from '@/lib/eraser-config';
import { useSpotlight } from '@/hooks/canvas/useSpotlight';
import { useSpotlightConfig } from '@/hooks/canvas/useSpotlightConfig';
import { AvatarWalker } from '@/components/canvas/AvatarWalker';
import { useAvatarWalk } from '@/hooks/canvas/useAvatarWalk';
import { AVATAR_SPAWN_GAP, type AvatarPoint } from '@/lib/avatar-walk';
import { chairSeatPoint } from '@livediagram/diagram';
import { useAvatarConfig } from '@/hooks/canvas/useAvatarConfig';
import { parseAvatarConfig } from '@/lib/avatar-config';
import { reactionPose } from '@/lib/avatar-reactions';
import {
  portalExitPoint,
  portalName,
  resolvePortalSite,
  resolvePortalTarget,
  viewportOffsetCentredOn,
} from '@/lib/portals';
import { useOffscreenContent } from '@/hooks/canvas/useOffscreenContent';
import { Portal } from '@/components/primitives/Portal';
import { TabLoadOverlay } from '@/components/canvas/TabLoadOverlay';
import { PaletteDragGhost } from '@/components/canvas/PaletteDragGhost';
import type { CanvasProps } from '@/components/canvas/Canvas.types';
import { useCanvasDrawGesture } from '@/components/canvas/useCanvasDrawGesture';
import { useCanvasPolygonGesture } from '@/components/canvas/useCanvasPolygonGesture';
import { useCanvasSurfaceGestures } from '@/hooks/canvas/useCanvasSurfaceGestures';
import { useCanvasSelectHandlers } from '@/hooks/canvas/useCanvasSelectHandlers';

export function Canvas(props: CanvasProps) {
  const {
    tabLocked,
    readOnly,
    tabBackgroundPattern,
    tabBackgroundColor,
    tabBackgroundOpacity,
    tabBackgroundPatternScale,
    tabBackgroundAnimationSpeed,
    tabPatternColor,
    mainRef,
    isPinchingRef,
    viewportOffset,
    setViewportOffset,
    viewportZoom,
    setViewportZoom,
    elements,
    selectedId,
    soloSelectedId,
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

  // Touch has no right-click, so a press-and-hold on the empty canvas opens
  // the tab / canvas context menu (the same one desktop reaches via
  // right-click). Element presses stopPropagation in their own pointerdown,
  // so this only arms for the bare canvas. Movement (pan / marquee) cancels it.
  const canvasLongPress = useLongPress((x, y) => onCanvasContextMenu?.(x, y));

  const wrapperRef = useRef<HTMLDivElement>(null);

  // Paint mode covers BOTH painter entry points: a single-shot armed source
  // (toolbar) and the persistent Format canvas tool — the tool must read as
  // paint mode from its first click (copy cursor, handles/label-drag/dblclick
  // suppressed on boxed elements AND arrows), not only once a source is armed.
  const isPaintMode = formatSourceId !== null || canvasTool === 'format';
  const isGroupMode = groupSourceId !== null;
  // Nudge above the Fit button when the whole diagram has scrolled out of view.
  const offscreenContent = useOffscreenContent(elements, viewportOffset, viewportZoom, mainRef);

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
  // Explorer's measured bottom edge on mobile. The Palette sits BELOW
  // this via its `mobileTopOverridePx` so the diagram switcher fits
  // above the Palette without overlapping. Desktop ignores it (the
  // Explorer pins to top-left there, not as a banner).
  const [explorerBottomY, setExplorerBottomY] = useState<number>(0);
  // Which quick-connect ring (if any) is open. Self-contained state + reset /
  // outside-close effects live in useQuickRing.
  const [quickRingOpen, setQuickRingOpen] = useQuickRing(selectedId);
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

  // Palette drag-drop onto the canvas (onDragOver / onDrop), lifted into
  // usePaletteDrop so the canvas body keeps to layout + pointer routing.
  const paletteDrop = usePaletteDrop({
    // A tile DRAGGED onto the canvas is an edit too (spec/101), so it leaves
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
  } = useZoomControls(viewportZoom, setViewportZoom);

  // Selection-display derivation (primary element, bounds, and every
  // "show this chrome?" predicate) lives in lib/canvas-selection.ts so
  // it's unit-tested. Memoised because selectionMembers walks every
  // element and Canvas re-renders on every drag tick.
  const canvasSelection = useMemo(
    () =>
      deriveCanvasSelection({
        elements,
        selectedId,
        soloSelectedId,
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
      soloSelectedId,
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
    selectionBounds,
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

  // Spotlight presenter tool (spec/09): screen-space light position +
  // radius. Local to Canvas so the click handlers, the pointer tracker, and
  // the overlay share one source of truth; survives Pan/Select detours
  // because Canvas stays mounted.
  const spotlight = useSpotlight();
  // The spotlight's look (spec/112): persisted per browser, read by the
  // overlay and edited from the Spotlight Panel down in the chrome.
  const spotlightLook = useSpotlightConfig();
  // Where to draw the eraser's brush ring, in <main>-relative px. Null until
  // the pointer has been over the canvas — an eraser ring parked in the middle
  // of the screen would claim a brush that isn't there.
  const [eraserPos, setEraserPos] = useState<{ x: number; y: number } | null>(null);

  // Avatar mode (spec/101): the walking character's position / facing / step
  // frame, its click-to-walk entry point, and the camera follow. Owns its own
  // rAF loop, dormant unless the tool is active.
  // The character's gender / clothing / hair / size (spec/101), persisted per
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
  const avatarRef = useRef<ReturnType<typeof useAvatarWalk> | null>(null);
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
    // Walking the character into a portal travels through it (spec/104) — the same
    // action the portal's own click fires.
    onWalkIntoPortal: (element) => enterPortalRef.current(element),
    // Chair (spec/130): walking onto one sits the character down, snapped to
    // the seat point so it sits ON the chair rather than wherever it arrived.
    onWalkIntoChair: (element) => avatarRef.current?.sitOn(element.id, chairSeatPoint(element)),
  });
  // `sitOn` is returned by the very hook whose callback needs it, so the call
  // goes through a ref — declared above, repointed here, read at arrival time.
  // Same shape as `enterPortalRef` below, for the same reason.
  avatarRef.current = avatar;

  // Who is sitting in each chair, from PRESENCE — never from the diagram. Our
  // own character plus every peer's, keyed by chair id, so a chair empties by
  // itself the moment its occupant leaves the mode, changes tab or drops off.
  const chairSitters = useMemo(() => {
    const byChair = new Map<string, { name: string; color: string }[]>();
    const add = (chairId: string, sitter: { name: string; color: string }) => {
      const list = byChair.get(chairId);
      if (list) list.push(sitter);
      else byChair.set(chairId, [sitter]);
    };
    if (avatar.seatedOn) {
      add(avatar.seatedOn, { name: 'You', color: props.selfParticipant.color });
    }
    for (const peer of props.remoteAvatars) {
      if (peer.avatar.seatedOn) add(peer.avatar.seatedOn, { name: peer.name, color: peer.color });
    }
    return byChair;
  }, [avatar.seatedOn, props.remoteAvatars, props.selfParticipant.color]);
  // Somebody pushed us (spec/101): slide along their direction, once per push.
  // Keyed on the sequence number, not the vector, so two identical shoves in a
  // row both land.
  const lastShoveRef = useRef<number | null>(null);
  useEffect(() => {
    const shove = props.avatarShove;
    if (!shove || shove.seq === lastShoveRef.current) return;
    lastShoveRef.current = shove.seq;
    avatar.shove(shove.dx, shove.dy);
    // `avatar` is a fresh object every render; the shove is the trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.avatarShove]);

  // Bounds of whatever the avatar is standing on, for its "you are here" ring.
  const avatarStandingOn = useMemo(() => {
    if (!avatar.standingOnId) return null;
    const el = elements.find((e) => e.id === avatar.standingOnId);
    return el && isBoxed(el) ? { x: el.x, y: el.y, width: el.width, height: el.height } : null;
  }, [avatar.standingOnId, elements]);

  // Portals (spec/104). Travelling means two things at once: the CAMERA centres on
  // the paired portal, and — if the traveller is walking around in Avatar mode —
  // their character steps out of it. One function behind both the portal face's
  // click and the avatar's walk-in, so the two can't drift apart.
  // `enterPortal` needs the avatar hook (to place the character) and the hook
  // needs `enterPortal` (for the walk-in), so the callback goes through a ref:
  // declared here, repointed on every render, read at call time.
  const enterPortalRef = useRef<(from: ShapeElement) => void>(() => {});
  // Where a portal leads, searched across every tab when the canvas was given
  // them (spec/104) and within this tab otherwise.
  const portalDestination = (from: ShapeElement) => {
    const site = props.portalTabs ? resolvePortalSite(props.portalTabs, from) : null;
    if (site) {
      const tab = props.portalTabs?.find((t) => t.id === site.tabId);
      return { portal: site.portal, tabId: site.tabId, elements: tab?.elements ?? elements };
    }
    const target = resolvePortalTarget(elements, from);
    return target ? { portal: target, tabId: props.activeTabId, elements } : null;
  };
  const enterPortal = (from: ShapeElement) => {
    const to = portalDestination(from);
    if (!to) return;
    // A link across tabs switches tab first, through the same follow-a-link
    // path a tab link uses, so selection / edit state is cleaned up the same
    // way. The camera + character then land on the far side.
    if (props.activeTabId && to.tabId && to.tabId !== props.activeTabId) {
      props.onFollowLink({ kind: 'tab', tabId: to.tabId });
    }
    const node = mainRef && 'current' in mainRef ? mainRef.current : null;
    const rect = node?.getBoundingClientRect();
    if (rect) {
      setViewportOffset(
        viewportOffsetCentredOn(
          to.portal,
          { width: rect.width, height: rect.height },
          viewportZoom,
        ),
      );
    }
    // Step out of the far portal, and tell the walk hook to ignore that portal until
    // the character leaves it, so it doesn't bounce straight back.
    avatar.teleportTo(portalExitPoint(to.portal), to.portal.id);
  };
  enterPortalRef.current = enterPortal;
  // What the portal face needs: the far portal's name for the tooltip, and the
  // travel action — absent when the portal is unlinked, which is what makes the
  // face render inert and say so.
  const resolvePortal = (element: ShapeElement) => {
    const to = portalDestination(element);
    return {
      targetName: to ? portalName(to.elements, to.portal) : null,
      travel: to ? () => enterPortal(element) : undefined,
    };
  };

  // Isometric view (spec/45): the orbit-able camera + the innermost
  // transform fragment, pivoted on the content centre — see
  // useIsometricView. Shift-drag on the canvas spins / tilts it (see
  // the <main> pointerdown handler).
  const { isoCamera, isoFragment } = useIsometricView({ canvasTool, elements, mainRef });

  const cursorClass = canvasCursorClass({
    pendingDraw: !!pendingDraw,
    pan: !!pan,
    marquee: !!marquee,
    canvasTool,
    spaceHeld: spaceHeldRef.current,
    isPaintMode,
    isGroupMode,
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
    // not canvas-coords: its light must stay put on screen as the diagram
    // pans / zooms under it. <main> is `position: relative` with no border,
    // so its content origin is its bounding-rect top-left.
    if (canvasTool === 'spotlight' || canvasTool === 'eraser') {
      const node = mainRef && 'current' in mainRef ? mainRef.current : null;
      const mr = node?.getBoundingClientRect();
      const at = mr ? { x: e.clientX - mr.left, y: e.clientY - mr.top } : null;
      // The eraser's brush ring (spec/113) needs the same screen-space point
      // the spotlight's light does, so they share the measurement.
      if (at && canvasTool === 'spotlight') spotlight.setPos(at);
      if (at && canvasTool === 'eraser') setEraserPos(at);
    }
    const rect = wrapperRef.current?.getBoundingClientRect();
    if (!rect) return;
    const { x: sx, y: sy } = pointerToCanvas(e.clientX, e.clientY, rect, viewportZoom);
    onCanvasPointerMove(sx, sy);
  };
  const handlePointerLeaveCanvas = () => {
    onCanvasPointerMove(null, null);
  };

  // Stable selection-routing wrappers for the memo'd element / arrow
  // views — see useCanvasSelectHandlers.
  const { handleElementContextSelect, handleArrowSelect } = useCanvasSelectHandlers({
    inertIds: props.layerInertIds,
    soloSelectedId: props.soloSelectedId,
    elements,
    multiSelectedIds,
    onSelect,
    onShiftSelect,
    onElementContextMenu,
    onMultiContextMenu,
  });

  const { drawDrag, penPoints, drawHover, beginPendingDrawGesture } = useCanvasDrawGesture({
    pendingDraw,
    elements,
    wrapperRef,
    viewportZoom,
    isPinchingRef,
    onCommitDraw,
    onCommitFreehand,
  });

  // Polygon click-to-place gesture (spec/84), composed IN FRONT of the
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
  const beginPendingDrawOrPolygon = (e: React.PointerEvent): boolean =>
    beginPolygonPoint(e) || beginPendingDrawGesture(e);

  // Bare-surface press routing (capture intercepts, background context
  // menu, pan-vs-marquee) lives in useCanvasSurfaceGestures; the JSX
  // below mounts its handlers verbatim.
  const surface = useCanvasSurfaceGestures({
    canvasTool,
    pendingDraw,
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
    canvasLongPress,
    beginPendingDrawGesture: beginPendingDrawOrPolygon,
    onEraseStart: props.onEraseStart,
    onCanvasContextMenu,
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
  return (
    <main
      ref={mainRef}
      // In the tab order (spec/71): keyboard users Tab to the canvas as
      // one stop, then Tab / Shift+Tab walk the elements (useCanvasA11y,
      // engaged only while this surface itself is focused — the marker
      // attribute below is how the hook recognises it). The role stays
      // the main landmark (not "application") because the floating
      // panels render inside it and must keep normal SR navigation.
      tabIndex={0}
      aria-label="Diagram canvas"
      data-canvas-a11y-root=""
      onPointerMove={handlePointerMoveCanvas}
      onPointerLeave={handlePointerLeaveCanvas}
      onDragOver={paletteDrop.onDragOver}
      onDrop={paletteDrop.onDrop}
      onPointerDownCapture={surface.onPointerDownCapture}
      onContextMenuCapture={surface.onContextMenuCapture}
      onContextMenu={surface.onContextMenu}
      onPointerDown={surface.onPointerDown}
      // focus-visible ring only: pointer focus stays outline-free, but a
      // keyboard user Tabbing to the canvas sees where they landed.
      className={`relative flex-1 touch-none select-none overflow-hidden outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-400/70 [-webkit-touch-callout:none] [-webkit-tap-highlight-color:transparent] ${
        pendingDraw ? '' : cursorClass
      }`}
      style={{
        ...tabBackgroundStyle(
          tabBackgroundPattern,
          viewportOffset,
          tabBackgroundColor,
          tabPatternColor,
          tabBackgroundOpacity,
          tabBackgroundPatternScale,
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
      {/* SR-only polite live region (spec/71): selection / delete / undo
          announcements land here. */}
      <CanvasLiveRegion />
      {/* Animated backdrops (spec/09) paint as an ambient overlay behind the
          diagram content; the static patterns ride the <main> background
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
          // Polygon finish-line double-click (spec/84) wins over the
          // add-text double-click while the intent is armed.
          if (handlePolygonDoubleClick()) return;
          surface.onWrapperDoubleClick(e);
        }}
        // Spotlight (spec/09) is a non-editing presenter mode: make the whole
        // diagram layer ignore pointer events so NO element kind can be
        // selected, dragged, or edited (a per-element capture guard can't
        // catch every select path — boxed elements, arrow hit-bands, labels,
        // click vs pointerdown). Clicks then fall through to <main>, where the
        // capture handler turns them into grow / shrink, and middle-mouse or
        // held-Space still pans.
        // Isometric view (spec/45): like Spotlight, the layer goes
        // pointer-events-none so NO element kind can be selected / dragged —
        // it's a read-only view tool. Clicks fall through to <main>, where a
        // drag pans (canvasTool === 'isometric' is added to `wantsPan`).
        // Avatar mode (spec/101): same treatment for the same reason — the mode
        // is read-only, so the diagram layer goes inert and every click falls
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
        style={{
          // Translate is in canvas-coords (applied first); scale is centred
          // on the wrapper so zooming keeps the viewport centre stable.
          // Isometric tilt (spec/45) is appended INNERMOST (last in the list,
          // so it transforms the content first): that keeps the pan translate
          // in screen space, so a drag moves the scene the way the cursor
          // moves at any camera angle. The fragment (built above as
          // isoFragment) pivots the tilt around the content centre so the
          // diagram tilts in place / stays centred while orbiting rather than
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
          ...(pendingDraw ? { cursor: drawIntentCursor(pendingDraw) } : null),
        }}
      >
        {/* Isometric extrusion (spec/45): per-element raised blocks painted
            behind the real element layer, which caps each column at z=0.
            Only mounted while the tool is active. */}
        {canvasTool === 'isometric' ? <IsometricDepthLayer elements={elements} /> : null}
        <MindGrowProvider value={props.onGrowMindNode}>
          <CanvasElementsLayer
            {...props}
            // Portal travel is resolved HERE (Canvas owns the viewport + the avatar),
            // so the prop from the host is overridden with the local resolver.
            onEnterPortal={resolvePortal}
            // Chair (spec/130): occupancy resolved here, where peer presence
            // lives, rather than threaded from the page.
            chairSitters={(elementId) => chairSitters.get(elementId) ?? []}
            // Pressing a Selection Mode button that hands out Avatar mode drops
            // the character at THAT button (see avatarSpawn), not the viewport
            // centre: you pressed a thing on the canvas, so the character should
            // appear where you pressed it.
            onPressModeButton={pressModeButton}
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
        </MindGrowProvider>
        {/* Avatar mode (spec/101): the walking characters, INSIDE the
            transformed wrapper so they pan / zoom with the diagram, and after
            the element layer so they stand in front of the content they walk
            over. Peers' characters render whether or not WE are in the mode —
            someone else walking their diagram is worth seeing regardless. */}
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
            // the same pure function the sender used (spec/101).
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

      {/* Spotlight presenter shroud (spec/09). Screen-space sibling of the
          transformed wrapper so the light stays fixed on screen while the
          diagram pans / zooms underneath. Rendered before CanvasChrome so the
          palette + chrome paint ON TOP and stay reachable to switch tools
          back; pointer-events-none lets clicks fall through to <main>. */}
      {/* The eraser's brush ring (spec/113): the same screen-space layer as
          the shroud, for the same reason — it must not pan or zoom with the
          diagram, and it must never take a pointer event. */}
      {canvasTool === 'eraser' ? (
        <EraserBrushRing
          pos={eraserPos}
          radius={eraserRadius(props.eraserConfig ?? DEFAULT_ERASER_CONFIG)}
          filtered={(props.eraserConfig ?? DEFAULT_ERASER_CONFIG).target !== 'anything'}
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
        selection={canvasSelection}
        quickRingOpen={quickRingOpen !== null}
      />

      <CanvasChrome
        {...props}
        isPaintMode={isPaintMode}
        isGroupMode={isGroupMode}
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
        offscreenContent={offscreenContent}
        marquee={marquee}
        drawDrag={drawDrag}
        drawHover={drawHover}
        penPoints={penPoints}
        polygonVertices={polygonVertices}
        polygonCursor={polygonCursor}
        wrapperRef={wrapperRef}
        paletteBottomY={paletteBottomY}
        setPaletteBottomY={setPaletteBottomY}
        explorerBottomY={explorerBottomY}
        setExplorerBottomY={setExplorerBottomY}
        activeMobilePanel={activeMobilePanel}
        setActiveMobilePanel={setActiveMobilePanel}
        dockButtonRefs={dockButtonRefs}
        activeDockAnchor={activeDockAnchor}
        setActiveDockAnchor={setActiveDockAnchor}
        handleDockButtonClick={handleDockButtonClick}
        handleZoomIn={handleZoomIn}
        handleZoomOut={handleZoomOut}
        handleSetZoom={handleSetZoom}
        onIsoOrbit={isoCamera.startOrbit}
        onIsoReset={isoCamera.reset}
      />
      {/* Lazy per-tab load (spec/13). Last child + z-[var(--z-overlay)] so it covers the
          canvas AND the floating palette, blocking any edit that would
          otherwise overwrite an unfetched tab's real content. */}
      {tabLoadState && tabLoadState !== 'ready' ? (
        <TabLoadOverlay state={tabLoadState} onRetry={() => onRetryTabLoad?.()} />
      ) : null}
      {/* Drag-to-add ghost (spec/58): previews where a dragged palette shape
          will land, following the cursor over the canvas. */}
      <PaletteDragGhost zoom={viewportZoom} />
      {/* Map (spec/59) now renders inside CanvasChrome's docking layer
          (spec/63) so it snaps + stacks like the other floating panels. */}
      {/* Touch long-press "hold" ring at the finger: the spec/09
          press-and-hold affordance that opens the context menu on touch.
          Portaled to escape the canvas's pan/zoom transform so its fixed
          position is viewport-relative. Reveals only after a deliberate hold
          and completes as the context menu opens. */}
      {canvasLongPress.pressPoint ? (
        <Portal>
          <div
            aria-hidden
            className="animate-longpress-hold pointer-events-none fixed z-[var(--z-toast)] h-9 w-9 rounded-full border-2 border-brand-500/70"
            style={{ left: canvasLongPress.pressPoint.x, top: canvasLongPress.pressPoint.y }}
          />
        </Portal>
      ) : null}
    </main>
  );
}
