import { isFixedSizeElement } from '@livediagram/document';
import {
  alignmentGuides,
  distributionSnap,
  isBoxed,
  snapResizeBounds,
  snapToAlignment,
  capturePlacement,
  laneSnapThreshold,
  snapToLane,
  unionRects,
  type AlignmentGuide,
  type BoxedElement,
  type DistributionGuide,
  type Element,
  type EsTimeline,
  type TextElement,
} from '@livediagram/document';
import { hugResizedText, hugsText, type MeasureTextBlock } from '@/lib/text-hug';
import type { LanePreview } from '@/lib/lane-preview';
import {
  ALIGN_SNAP_THRESHOLD,
  constrainedBounds,
  cornerOf,
  leadingAxis,
  snapModeOf,
  MIN_SIZE,
  minUniformScale,
  nextBounds,
  snapLeadingAxis,
  unionResizeMember,
  type DragMode,
  type ShapeBounds,
} from '@/lib/canvas';

// The boxed move / resize frame resolvers (docs/specs/008-canvas/canvas-and-palette.md canvas), lifted out of
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
  pageSnapBoxes,
  startBounds,
  primaryId,
  dx,
  dy,
  noSnap,
  guidesOn,
  timeline = null,
  laneHeld = false,
}: {
  elements: Element[];
  startBounds: ReadonlyMap<string, ShapeBounds>;
  primaryId: string;
  dx: number;
  dy: number;
  // Cmd/Ctrl held: place freely — skip alignment + distribution snapping
  // and their guide lines for this gesture (docs/specs/008-canvas/snap-override.md).
  noSnap: boolean;
  // Lines to snap to besides the elements' own (an Infographic page's edges and margins), as
  // stand-in boxes: aligned to and guided by, never spaced against.
  pageSnapBoxes?: Element[];
  // The user's alignment-guides preference (guides only; the snap still
  // applies when it's off).
  guidesOn: boolean;
  // Timeline lanes (docs/specs/021-event-storming/event-storming.md Phase 6), when this drag is eligible for them: a
  // single note, on an event-storming board, with lanes on. The caller owns
  // that decision and passes null otherwise — so the rung here is purely
  // "where does the lane want it".
  timeline?: EsTimeline | null;
  // The note in hand is a WORKSHOP note, which always lands on a lane
  // (docs/specs/021-event-storming/event-storming.md "Always on a lane"): the y snap has no tolerance. A plain
  // sticky keeps the lane as an aid.
  laneHeld?: boolean;
}): {
  tx: number;
  ty: number;
  guides: AlignmentGuide[];
  distGuides: DistributionGuide[];
  // The lane / column claimed, for the overlay to light. Null when no lane
  // took this frame.
  lane: LanePreview | null;
} {
  const primaryStart = startBounds.get(primaryId);
  if (!primaryStart || noSnap) return { tx: dx, ty: dy, guides: [], distGuides: [], lane: null };
  const memberIds = new Set(startBounds.keys());
  const candidate = {
    x: primaryStart.x + dx,
    y: primaryStart.y + dy,
    width: primaryStart.width,
    height: primaryStart.height,
  };
  // Lanes claim Y — the row. X comes from the slots the notes already there
  // SUGGEST: one gutter along the row, squarely under a note in the row next
  // door, or the brick-pattern stagger under that note's gutter. Candidates
  // are measured where the note will LAND (the lane-snapped y), so which row
  // it is joining is settled before its neighbours are asked.
  const laneSnap = timeline ? snapToLane(candidate, timeline, laneSnapThreshold(laneHeld)) : null;
  // A SELECTION SNAPS BY THE NOTE IN HAND. The note the drag began on is what
  // meets the board's places, and every other note rides along by the same
  // delta, so the selection's spacing is untouched.
  const gutterSnap = laneSnap
    ? capturePlacement({ ...candidate, y: laneSnap.y }, elements, { exclude: memberIds })
    : null;
  const snapDxX = gutterSnap ? gutterSnap.x - candidate.x : 0;
  // ON A LANES BOARD, THE LANE RESOLVER IS THE ONLY SOURCE OF X.
  //
  // The ordinary alignment and distribution snaps were quietly adding places
  // the rhythm does not have — a note landing flush against its neighbour's
  // right edge (left-to-right edge alignment), or sitting exactly on top of
  // it, or half-way along. The author reads those as the board offering
  // positions it should not. With lanes on, x is the rhythm's answer or the
  // hand's own.
  if (timeline) {
    return {
      tx: dx + snapDxX,
      ty: laneSnap ? dy + (laneSnap.y - candidate.y) : dy,
      guides: [],
      distGuides: [],
      lane: laneSnap
        ? {
            laneIndex: laneSnap.laneIndex,
            ...(gutterSnap
              ? {
                  // What the author sees BEFORE dropping: the footprint the
                  // note is about to take. A capture radius this wide is only
                  // fair if the offer is visible.
                  ghost: {
                    x: gutterSnap.x,
                    y: laneSnap.y,
                    width: candidate.width,
                    height: candidate.height,
                  },
                }
              : {}),
          }
        : null,
    };
  }
  const aligned = pageSnapBoxes?.length ? [...elements, ...pageSnapBoxes] : elements;
  const snap = snapToAlignment(candidate, aligned, memberIds, ALIGN_SNAP_THRESHOLD);
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
        aligned,
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
  // Timeline is null here (the early return above owns every lane frame), so
  // x and y are the ordinary alignment / distribution answers alone.
  return { tx: dx + snapDx, ty: dy + snapDy, guides, distGuides, lane: null };
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
  pageSnapBoxes,
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
  // As resolveBoxedMove's: page lines to snap the resized edge to.
  pageSnapBoxes?: Element[];
}): { boundsById: Map<string, ShapeBounds>; guides: AlignmentGuide[] | null } | null {
  if (mode === 'move') return null;
  const aligned = pageSnapBoxes?.length ? [...elements, ...pageSnapBoxes] : elements;
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
    // A constrained resize snaps too, on the axis that leads it only: the
    // other side is re-derived from the ratio, so the snap can't bend it
    // (docs/specs/008-canvas/canvas-and-palette.md "Resize"). The floor stays the
    // start box's, expressed relative to the candidate.
    const next = !snapMode
      ? raw
      : constrain
        ? snapLeadingAxis(
            raw,
            snapMode,
            leadingAxis(mode, dx, dy),
            (c, edge) =>
              snapResizeBounds(c, edge, aligned, memberIds, ALIGN_SNAP_THRESHOLD, MIN_SIZE),
            (minUniformScale(start) * start.width) / raw.width,
          )
        : snapResizeBounds(raw, snapMode, aligned, memberIds, ALIGN_SNAP_THRESHOLD, MIN_SIZE);
    // Guide off the snapped bounds (same rationale as move), so guides
    // only appear when an edge / centre genuinely lines up. Suppressed
    // when the user has turned alignment guides off.
    const guides = guidesOn ? alignmentGuides(next, aligned, memberIds) : [];
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
  const unionStart = unionRects(startBounds.values());
  if (!unionStart || !corner) return null;
  const anyAspectLocked = elements.some(
    (el) => isBoxed(el) && startBounds.has(el.id) && el.aspectLocked === true,
  );
  // Shift-held forces constrain for multi-resize too, on top of the
  // per-element flags. Any aspect-locked member already forces constrain
  // to avoid warping (e.g. an actor inside the selection) so this just
  // adds the user's modifier-key opt-in for unlocked selections.
  // Constrained, the union scales uniformly and stops where the first
  // resizable member's shorter side meets the minimum, so every member
  // keeps its ratio too (a per-member floor would bend it).
  const unionNext =
    dragAspectLocked || anyAspectLocked || shiftHeld
      ? constrainedBounds(unionStart, mode, dx, dy, unionMinScale(elements, startBounds))
      : nextBounds(unionStart, mode, dx, dy, false);
  const boundsById = new Map<string, ShapeBounds>();
  for (const el of elements) {
    if (!isBoxed(el)) continue;
    const start = startBounds.get(el.id);
    if (!start) continue;
    // Fixed-size kinds (docs/specs/009-elements/mode-button.md) ride along with the union's MOVE but keep
    // their own width / height, so scaling a selection can't quietly resize a
    // control that has no resize handles of its own.
    if (isFixedSizeElement(el)) {
      const moved = unionResizeMember(start, unionStart, unionNext, corner);
      boundsById.set(el.id, { ...moved, width: start.width, height: start.height });
      continue;
    }
    boundsById.set(el.id, unionResizeMember(start, unionStart, unionNext, corner));
  }
  return { boundsById, guides: null };
}

// The smallest uniform scale a constrained multi-resize may reach: the
// largest of its resizable members' own floors. Fixed-size members keep
// their size whatever the union does, so they set no floor.
function unionMinScale(elements: Element[], startBounds: ReadonlyMap<string, ShapeBounds>): number {
  let floor = 0;
  for (const el of elements) {
    const start = startBounds.get(el.id);
    if (!start || !isBoxed(el) || isFixedSizeElement(el)) continue;
    floor = Math.max(floor, minUniformScale(start));
  }
  return floor;
}

// How a resize frame's hugging text boxes are sized (docs/specs/023-draw-mode/draw-mode.md "Text
// boxes"): the handle, whether the ratio is kept (Shift or the element's lock), and the DOM
// measure. Given only for a single element; it applies to a text box that fits or wraps.
export type TextHugResize = {
  mode: DragMode;
  constrain: boolean;
  measure: (el: TextElement) => MeasureTextBlock;
};

// One element through a resolved resize frame. A text box that fits or wraps (hugsText, in either
// editor mode) hugs its text: its width from the frame, its height the text's, or under Shift its
// text scaled with the box. A rotated one, and every other element, takes the frame's bounds.
export function resizedElement(
  el: BoxedElement,
  next: ShapeBounds,
  hug: TextHugResize | null,
): BoxedElement {
  if (hug && hug.mode !== 'move' && hugsText(el) && !el.rotation) {
    return hugResizedText(el, next, hug.mode, hug.constrain, hug.measure);
  }
  return { ...el, ...next };
}
