import {
  alignmentGuides,
  distributionSnap,
  isBoxed,
  snapResizeBounds,
  snapToAlignment,
  type AlignmentGuide,
  type DistributionGuide,
  type Element,
} from '@livediagram/diagram';
import {
  ALIGN_SNAP_THRESHOLD,
  cornerOf,
  snapModeOf,
  MIN_SIZE,
  nextBounds,
  unionOfBounds,
  unionResizeMember,
  type DragMode,
  type ShapeBounds,
} from '@/lib/canvas';

// The boxed move / resize frame resolvers (spec/09 canvas), lifted out of
// useEditorDrag's pointermove switch the same way the arrow snap ladder
// went to resolveArrowEndpointDrag: pure functions the drag hook feeds
// the gesture's captured start state + the live delta, getting back the
// per-element bounds / translation plus the guide lines to show. The
// hook stays the owner of everything React-shaped (the engage gate, the
// checkpoint tick, the guide scheduler, the auto-rebind preference).

// The corner / edge OPPOSITE each resize handle, in element-local sign space
// (±1 per axis from the centre). Used to anchor that point while resizing a
// rotated element so it grows from the dragged side only, not the centre.
const FIXED_SIGN: Partial<Record<DragMode, { sx: number; sy: number }>> = {
  'resize-e': { sx: -1, sy: 0 },
  'resize-w': { sx: 1, sy: 0 },
  'resize-s': { sx: 0, sy: -1 },
  'resize-n': { sx: 0, sy: 1 },
  'resize-se': { sx: -1, sy: -1 },
  'resize-sw': { sx: 1, sy: -1 },
  'resize-ne': { sx: -1, sy: 1 },
  'resize-nw': { sx: 1, sy: 1 },
};

// Resolve one move frame: snap the primary's candidate bounds to align
// with other elements' edges / centres (equal-spacing distribution
// filling the axes alignment didn't claim), returning the total
// translation to apply to every member plus the guides to draw.
export function resolveBoxedMove({
  elements,
  startBounds,
  primaryId,
  dx,
  dy,
  noSnap,
  guidesOn,
}: {
  elements: Element[];
  startBounds: ReadonlyMap<string, ShapeBounds>;
  primaryId: string;
  dx: number;
  dy: number;
  // Cmd/Ctrl held: place freely — skip alignment + distribution snapping
  // and their guide lines for this gesture (spec/60).
  noSnap: boolean;
  // The user's alignment-guides preference (guides only; the snap still
  // applies when it's off).
  guidesOn: boolean;
}): { tx: number; ty: number; guides: AlignmentGuide[]; distGuides: DistributionGuide[] } {
  const primaryStart = startBounds.get(primaryId);
  if (!primaryStart || noSnap) return { tx: dx, ty: dy, guides: [], distGuides: [] };
  const memberIds = new Set(startBounds.keys());
  const candidate = {
    x: primaryStart.x + dx,
    y: primaryStart.y + dy,
    width: primaryStart.width,
    height: primaryStart.height,
  };
  const snap = snapToAlignment(candidate, elements, memberIds, ALIGN_SNAP_THRESHOLD);
  let snapDx = snap.dx;
  let snapDy = snap.dy;
  // Equal-spacing (distribution) snap fills the axes alignment didn't
  // already claim, so the element lands evenly spaced between / beyond
  // its neighbours. Alignment (edge / centre) wins per axis when both
  // are in range.
  // Skip the O(k²) equal-spacing scan entirely when alignment already
  // claimed BOTH axes — its result would be discarded below. This runs
  // on every pointer-move of a boxed drag.
  const dist =
    snap.snappedX && snap.snappedY
      ? { dx: 0, dy: 0, guides: [] }
      : distributionSnap(candidate, elements, memberIds, ALIGN_SNAP_THRESHOLD);
  // Distribution fills only the axes alignment didn't claim. Keyed off
  // snap.snappedX/Y (not snapDx === 0) so an EXACT edge alignment, whose
  // delta is 0, still wins over an equal-spacing nudge that's also in
  // range.
  if (!snap.snappedX) snapDx = dist.dx;
  if (!snap.snappedY) snapDy = dist.dy;
  // Derive guides from the SNAPPED primary bounds so a line only appears
  // once the snap has aligned an edge / centre. Suppressed entirely when
  // the user has turned guides off (the snap above still applies; only
  // the hint is hidden).
  const guides = guidesOn
    ? alignmentGuides(
        { ...candidate, x: candidate.x + snapDx, y: candidate.y + snapDy },
        elements,
        memberIds,
      )
    : [];
  // Distribution guides only for the axis distribution actually drove
  // (alignment didn't already claim it).
  const distGuides = guidesOn
    ? dist.guides.filter((g) =>
        g.axis === 'x' ? !snap.snappedX && dist.dx !== 0 : !snap.snappedY && dist.dy !== 0,
      )
    : [];
  return { tx: dx + snapDx, ty: dy + snapDy, guides, distGuides };
}

// Apply a move frame's translation: every dragged boxed element shifts
// from its captured start bounds, and the FREE endpoints of any arrows
// pulled into a frame-section move shift with them (pinned ends are left
// for the caller's rebind pass).
export function translateBoxedSelection(
  els: Element[],
  startBounds: ReadonlyMap<string, ShapeBounds>,
  startArrowEnds: ReadonlyMap<
    string,
    { from?: { x: number; y: number }; to?: { x: number; y: number } }
  >,
  tx: number,
  ty: number,
): Element[] {
  return els.map((el) => {
    if (isBoxed(el)) {
      const start = startBounds.get(el.id);
      if (!start) return el;
      return { ...el, x: start.x + tx, y: start.y + ty };
    }
    if (el.type === 'arrow') {
      const ends = startArrowEnds.get(el.id);
      if (!ends) return el;
      const next = { ...el };
      if (ends.from && el.from.kind === 'free') {
        next.from = { kind: 'free', x: ends.from.x + tx, y: ends.from.y + ty };
      }
      if (ends.to && el.to.kind === 'free') {
        next.to = { kind: 'free', x: ends.to.x + tx, y: ends.to.y + ty };
      }
      return next;
    }
    return el;
  });
}

// Resolve one resize frame. Handles BOTH single-element and group /
// multi resizes uniformly:
// - Single member: scale the lone member directly via nextBounds (the
//   original behaviour, snapping included), with the rotated variant
//   projecting the drag into the element's local frame and anchoring
//   the corner opposite the handle.
// - Multiple members: compute a UNION start box, scale that as if it
//   were one element, then map every member through the same
//   proportional scale around the anchor (corner opposite the handle).
// Returns the per-element bounds to write plus the guides to draw —
// `guides: null` means "leave the current guides alone" (the multi
// branch never scheduled them). Returns null when the frame can't
// resolve (no start bounds / no corner).
export function resolveBoxedResize({
  elements,
  startBounds,
  primaryId,
  mode,
  dx,
  dy,
  shiftHeld,
  dragAspectLocked,
  guidesOn,
}: {
  elements: Element[];
  startBounds: ReadonlyMap<string, ShapeBounds>;
  primaryId: string;
  mode: DragMode;
  dx: number;
  dy: number;
  // Shift-held during resize is the standard "constrain aspect" modifier
  // (Figma, Photoshop, Illustrator). It works on top of the per-element
  // aspectLocked toggle: a shape with the toggle off honours the shift; a
  // shape with the toggle on stays locked regardless.
  shiftHeld: boolean;
  dragAspectLocked: boolean;
  guidesOn: boolean;
}): { boundsById: Map<string, ShapeBounds>; guides: AlignmentGuide[] | null } | null {
  const corner = cornerOf(mode);
  // Corner OR single edge — so edge resizes snap + dimension-match on
  // their axis (multi-member scaling below stays corner-only).
  const snapMode = snapModeOf(mode);
  const memberIds = new Set(startBounds.keys());
  const constrain = dragAspectLocked || shiftHeld;

  if (startBounds.size <= 1) {
    const start = startBounds.get(primaryId);
    if (!start) return null;
    const primary = elements.find((el) => el.id === primaryId);
    const rotation = (primary && isBoxed(primary) ? primary.rotation : 0) ?? 0;
    if (rotation) {
      // Rotated: project the screen drag into the element's local
      // (unrotated) frame so the size changes along its own axes, then
      // keep the edge / corner OPPOSITE the handle visually fixed — so
      // it grows from the dragged side only, not the centre. (Axis-
      // aligned snapping doesn't apply to a rotated box.) FIXED_SIGN
      // points at that opposite anchor in local coords (±half-width,
      // ±half-height).
      const r = (rotation * Math.PI) / 180;
      const cos = Math.cos(r);
      const sin = Math.sin(r);
      const dxl = dx * cos + dy * sin;
      const dyl = -dx * sin + dy * cos;
      const sized = nextBounds(start, mode, dxl, dyl, constrain);
      const sign = FIXED_SIGN[mode] ?? { sx: 0, sy: 0 };
      const cx0 = start.x + start.width / 2;
      const cy0 = start.y + start.height / 2;
      // World position of the fixed anchor before the resize.
      const ax0 = (sign.sx * start.width) / 2;
      const ay0 = (sign.sy * start.height) / 2;
      const anchorX = cx0 + (ax0 * cos - ay0 * sin);
      const anchorY = cy0 + (ax0 * sin + ay0 * cos);
      // Same anchor after the resize, relative to the new centre.
      const ax1 = (sign.sx * sized.width) / 2;
      const ay1 = (sign.sy * sized.height) / 2;
      const cx1 = anchorX - (ax1 * cos - ay1 * sin);
      const cy1 = anchorY - (ax1 * sin + ay1 * cos);
      const next = {
        x: cx1 - sized.width / 2,
        y: cy1 - sized.height / 2,
        width: sized.width,
        height: sized.height,
      };
      return { boundsById: new Map([[primaryId, next]]), guides: [] };
    }
    const raw = nextBounds(start, mode, dx, dy, constrain);
    const next =
      !constrain && snapMode
        ? snapResizeBounds(raw, snapMode, elements, memberIds, ALIGN_SNAP_THRESHOLD, MIN_SIZE)
        : raw;
    // Guide off the snapped bounds (same rationale as move). A
    // constrained resize skips the snap, so guides only appear when an
    // edge / centre genuinely lines up. Suppressed when the user has
    // turned alignment guides off.
    const guides = guidesOn ? alignmentGuides(next, elements, memberIds) : [];
    return { boundsById: new Map([[primaryId, next]]), guides };
  }

  // Multi-member resize: derive union bounds, run them through
  // nextBounds, and scale every member around the anchor (corner
  // opposite the drag handle). Aspect-lock is forced on if ANY member is
  // aspect-locked so locked figures (e.g. the actor) don't get warped by
  // an unevenly-dragged corner. Snap is skipped for multi-resize because
  // the primary's edges aren't load-bearing here: snapping one member's
  // edge would push the whole group around in ways the user didn't ask
  // for.
  const unionStart = unionOfBounds(startBounds.values());
  if (!unionStart || !corner) return null;
  const anyAspectLocked = elements.some(
    (el) => isBoxed(el) && startBounds.has(el.id) && el.aspectLocked === true,
  );
  // Shift-held forces constrain for multi-resize too, on top of the
  // per-element flags. Any aspect-locked member already forces constrain
  // to avoid warping (e.g. an actor inside the selection) so this just
  // adds the user's modifier-key opt-in for unlocked selections.
  const unionNext = nextBounds(
    unionStart,
    mode,
    dx,
    dy,
    dragAspectLocked || anyAspectLocked || shiftHeld,
  );
  const boundsById = new Map<string, ShapeBounds>();
  for (const el of elements) {
    if (!isBoxed(el)) continue;
    const start = startBounds.get(el.id);
    if (!start) continue;
    boundsById.set(el.id, unionResizeMember(start, unionStart, unionNext, corner));
  }
  return { boundsById, guides: null };
}
