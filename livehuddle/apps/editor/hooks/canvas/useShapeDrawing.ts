// Draw-to-size tooling, lifted out of editor-page.tsx. Picking anything from
// the palette (docs/specs/008-canvas/canvas-and-palette.md "Placement on add") stashes the intent in
// `pendingDraw`; the canvas intercepts the next pointer-down and calls `commitDraw` with the
// drag's start + end points, which mint the element sized to the dragged box. The Room
// Builder's corners land through `commitRoomWalls`. (The pens, the Polygon and the arrow
// left with the element engine's part 4, docs/specs/002-project-scope/not-in-livehuddle.md
// "The element engine".)

import type { Selection } from '@liveworkspace/workbench/lib/selection-store';
import { useRef, useState } from 'react';
import {
  createOutlinedRoom,
  isWallPiece,
  snapDoorToWall,
  withDoorPiece,
  type Element,
  type Tab,
} from '@livehuddle/document';
import { armedRoomSnap } from '@/lib/palette-drag-snap';
import { placedSelection } from '@/lib/placed-selection';
import { track } from '@/lib/telemetry';
import { isTechIconId } from '@liveworkspace/workbench/lib/tech-icons';
import { opensForTyping, type PendingDraw } from '@/lib/draw-mode';
import { withPlacingFacing } from '@/lib/placing-facing';
import { buildDrawnBoxed, buildDrawnComponent } from '@/lib/draw-commit';
import type { CanvasTool } from '@/components/palette/palette.types';
import { componentTelemetryType, shapeTelemetryToken } from '@/lib/element-telemetry';

type ShapeDrawingDeps = {
  editsBlocked: boolean;
  // The currently-selected element id, read at arm-time so a tap-to-drop
  // inherits its size (see beginDraw / commitDraw).
  // Read when a draw begins (docs/specs/008-canvas/blueprints/selection-store.md).
  readSelection: () => Selection;
  canvasTool: CanvasTool;
  setCanvasTool: (tool: CanvasTool) => void;
  activeTab: Tab;
  // Every draw lands through the functional `commit` (live elements): the
  // commit closure is frozen for the whole
  // gesture, so a wholesale write of gesture-start elements would
  // revert anything that landed mid-drag.
  commit: (mapElements: (els: Element[]) => Element[]) => void;
  setSelectedId: (id: string | null) => void;
  setMultiSelectedIds: (ids: Set<string>) => void;
  // One write of the whole selection: a Room's pieces land selected in one store notify.
  setSelection: (next: Selection) => void;
  setEditingId: (id: string | null) => void;
  // Style memory (docs/specs/008-canvas/quick-style-panel.md): dresses every user-drawn shape in
  // the remembered style of its kind. Identity for anything memory does not know.
  styleNewElement: <T extends Element>(el: T) => T;
};

export function useShapeDrawing(deps: ShapeDrawingDeps) {
  const {
    editsBlocked,
    readSelection,
    canvasTool,
    setCanvasTool,
    activeTab,
    commit,
    setSelectedId,
    setMultiSelectedIds,
    setSelection,
    setEditingId,
    styleNewElement,
  } = deps;

  // Pending draw-to-size intent. Picking a palette element stashes it here;
  // the canvas intercepts the next pointer-down on its surface and uses the
  // drag's bounding box for the element's size. Escape clears it.
  const [pendingDraw, setPendingDraw] = useState<PendingDraw | null>(null);
  // The element selected when the gesture was armed, captured here because
  // beginDraw clears the selection (below). A tap-to-drop inherits this
  // element's size in commitDraw, preserving the old "new shapes match the
  // last one you had selected" behaviour through the combined gesture.
  const inheritSizeRef = useRef<Element | null>(null);

  // The canvas tool an armed draw cannot share the pointer with: the format painter goes to select, so the next press
  // draws what the banner says rather than painting.
  const putDownPressTool = () => {
    if (canvasTool === 'format') setCanvasTool('select');
  };

  // Shared "arm draw mode" path for every palette add. Tap-to-drop and
  // drag-to-draw are one combined gesture now (no setting): picking an
  // element stashes the intent, and the canvas resolves the next pointer
  // gesture — a tap drops it at its inherited / default size, a drag sizes
  // it (see commitDraw). Clears the current selection so the popover
  // doesn't float over the about-to-be-drawn box, and puts down a tool that acts on a press (putDownPressTool).
  const beginDraw = (intent: PendingDraw): void => {
    // Capture the selection's size BEFORE clearing it so commitDraw's
    // tap branch can inherit it.
    const { selectedId } = readSelection();
    inheritSizeRef.current = selectedId
      ? (activeTab.elements.find((el) => el.id === selectedId) ?? null)
      : null;
    setSelectedId(null);
    setMultiSelectedIds(new Set());
    setEditingId(null);
    putDownPressTool();
    setPendingDraw(intent);
  };

  // Canvas-driven commit of a draw-to-size gesture. Canvas hands us
  // raw start + end canvas-coord points so each intent can interpret
  // them itself: shape / text / sticky / image take a
  // bounding box with a 16px floor and a centre-shift on stray
  // clicks. After the
  // mint we clear pendingDraw so the cursor / banner / palette
  // pressed-state release together.
  const commitDraw = (
    intent: PendingDraw,
    startX: number,
    startY: number,
    endX: number,
    endY: number,
  ) => {
    if (editsBlocked) {
      setPendingDraw(null);
      return;
    }
    // The element construction per intent kind lives in lib/draw-commit
    // (pure, testable); this dispatcher owns the functional commit,
    // selection, telemetry, and follow-ups. Every append lands through
    // the functional `commit` (live elements + emit): this closure is
    // frozen for the whole gesture, so writing gesture-start elements
    // wholesale would revert anything that landed mid-drag. New
    // elements default to the FRONT of z-order (see addBoxed).
    // The Room Builder's corners land through commitRoomWalls, never here.
    if (intent.type === 'room-walls') {
      setPendingDraw(null);
      return;
    }
    if (intent.type === 'component') {
      const placed = styleNewElement(buildDrawnComponent(intent.kind, startX, startY, endX, endY));
      commit((els) => [...els, placed]);
      setSelectedId(placed.id);
      setPendingDraw(null);
      track('Element', 'Added', componentTelemetryType(intent.kind));
      return;
    }
    // An armed Room lands where its preview showed it, snapped to its neighbours (docs/specs/009-elements/office.md
    // "Rooms line up").
    const roomSnap =
      intent.type === 'shape' && intent.kind === 'room'
        ? armedRoomSnap({ x: startX, y: startY }, activeTab.elements)
        : null;
    const sx = startX + (roomSnap?.dx ?? 0);
    const sy = startY + (roomSnap?.dy ?? 0);
    // A piece that turns lands the way Space turned it while armed (docs/specs/009-elements/furniture-facing.md
    // "Turning while placing"), about the centre the tap put it at.
    const dressed = styleNewElement(
      withPlacingFacing(
        buildDrawnBoxed(intent, sx, sy, endX, endY, inheritSizeRef.current, activeTab),
      ),
    );
    const sized = dressed;
    // Containers don't need special-casing here: the canvas + exporters
    // route through `framesFirst`, which keeps every container painted
    // behind its contents regardless of array position.
    // A door or window tapped or drawn near a wall lands on it (docs/specs/009-elements/room-builder.md "Door",
    // "Window"), against the live walls.
    // A new Room comes with its Door (docs/specs/009-elements/office.md "The doorway is a Door"), and a room preset's
    // pieces with it (office-amenities.md "The Restroom preset"): one commit, one undo, and every piece selected
    // (office.md "Placing selects every piece"). The pieces are built once, outside the updater, so the ids it
    // commits are the ids selected.
    const wallPiece = isWallPiece(sized) ? sized : null;
    const pieces = wallPiece
      ? [sized]
      : withDoorPiece(sized, intent.type === 'shape' ? intent.variant : undefined);
    commit((els) => [...els, ...(wallPiece ? [snapDoorToWall(wallPiece, els)] : pieces)]);
    setSelection(placedSelection(pieces));
    // A freshly added text element drops straight into typing mode
    // (matches the double-click-to-add-text path in useElementCreation):
    // an empty text box is only useful once you type into it, so save the
    // user the extra click. Other element kinds stay selected-but-not-
    // editing so their format popover is the immediate next interaction.
    if (opensForTyping(intent)) setEditingId(sized.id);
    setPendingDraw(null);
    const label =
      intent.type === 'shape'
        ? // Tech (brand) icons report as TechIcon, matching the click-to-add
          // path; line-art icons + plain shapes use the kind.
          intent.iconId && isTechIconId(intent.iconId)
          ? 'TechIcon'
          : intent.kind === 'sticker'
            ? // Stickers are their own element kind (docs/specs/010-palette/stickers.md), so their own
              // dashboard token rather than riding Icon's.
              'Sticker'
            : // Hyphenated kinds ('mind-node', 'session-button', ...) need
              // their spelled-out token or they split from the copy path's.
              shapeTelemetryToken(intent.kind)
        : intent.type === 'text'
          ? 'Text'
          : intent.type === 'sticky'
            ? 'Sticky'
            : intent.type === 'link-card'
              ? // titleCase would emit 'Link-Card' (it capitalises at the
                // hyphen); the click path always reported 'LinkCard', so
                // moving the event here must not split the dashboard token.
                'LinkCard'
              : 'Image';
    track('Element', 'Added', label);
    // An image lands as its empty placeholder, selected, with no picker popping up: the
    // placeholder's Select Image button (or a double-click) opens it when the person is ready
    // (docs/specs/009-elements/images.md "Placeholder rendering").
  };

  const cancelDrawShape = () => setPendingDraw(null);

  // The Room Builder (docs/specs/009-elements/room-builder.md): arms the polygon's click-to-place gesture in room
  // mode; the corners accumulate canvas-side (useCanvasPolygonGesture).
  const beginRoomWalls = () => {
    if (editsBlocked) return;
    setSelectedId(null);
    setMultiSelectedIds(new Set());
    setEditingId(null);
    putDownPressTool();
    setPendingDraw({ type: 'room-walls' });
  };

  // The Room Builder's commit: the corners closed into a custom-shaped Room, selected, one history entry. Fewer than
  // three corners, or a room with no floor, cancels.
  const commitRoomWalls = (corners: { x: number; y: number }[]) => {
    setPendingDraw(null);
    if (editsBlocked) return;
    const room = createOutlinedRoom(corners);
    if (!room) return;
    const styled = styleNewElement(room);
    commit((els) => [...els, styled]);
    setSelectedId(styled.id);
    track('Element', 'Added', 'CustomRoom');
  };

  return {
    pendingDraw,
    beginDraw,
    commitDraw,
    cancelDrawShape,
    beginRoomWalls,
    commitRoomWalls,
  };
}
