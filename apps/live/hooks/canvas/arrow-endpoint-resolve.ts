import {
  alignmentGuides,
  arrowSnapPoints,
  endpointPosition,
  snapToAlignment,
  snapToAnchor,
  snapToArrowPoint,
  type AlignmentGuide,
  type ArrowElement,
  type Element,
  type Endpoint,
} from '@livediagram/diagram';
import {
  ALIGN_SNAP_THRESHOLD,
  ARROW_SNAP_REVEAL_PX,
  ARROW_SNAP_THRESHOLD_PX,
  SNAP_THRESHOLD,
  type ArrowEnd,
} from '@/lib/canvas';
import { computeSnapTargets, NO_ALIGN_EXCLUDE } from '@/lib/drag-geometry';
import type { SnapTarget } from '@/components/canvas/Canvas.types';

// Resolve one arrow-endpoint drag frame (spec/09 arrows + spec/50
// arrow-to-arrow): pin to an element anchor if the cursor is close,
// else connect onto another arrow's line, else free with the 45°
// angle lock and alignment snapping. Pure — the drag hook feeds the
// cursor + live elements in and applies the returned endpoint /
// guides / snap markers itself — so the snap ladder is one readable
// unit instead of 150 lines inside the pointermove switch.
//
// Priority order matters and is deliberate: an element anchor is the
// strongest constraint (pinning is the most desirable outcome when
// several snaps are plausible), then a nearby arrow line, then the
// free-point refinements.
export function resolveArrowEndpointDrag({
  cursor,
  elements,
  arrowId,
  end,
  reposition,
  noSnap,
  guidesOn,
}: {
  cursor: { x: number; y: number };
  elements: Element[];
  arrowId: string;
  end: ArrowEnd;
  // True when the user is repositioning an EXISTING arrow's endpoint —
  // landing on an anchor then marks it `manual` so auto-rebind leaves it.
  reposition: boolean;
  // Cmd/Ctrl held: skip the alignment snap so the point goes exactly
  // where the cursor is.
  noSnap: boolean;
  // The user's alignment-guides preference (guides only; snapping to the
  // other endpoint still applies).
  guidesOn: boolean;
}): {
  endpoint: Endpoint;
  guides: AlignmentGuide[];
  snapTargets: SnapTarget[];
  // True when this frame connected onto another arrow's line (spec/50) —
  // the caller emits the once-per-drag telemetry.
  arrowConnected: boolean;
} {
  // Element anchor wins over angle / alignment snap: pinning to
  // another shape is the strongest constraint and the most desirable
  // outcome when both are plausible.
  const anchorSnap = snapToAnchor(cursor, elements, SNAP_THRESHOLD);
  // No element anchor nearby → look for a nearby arrow line to connect to
  // (spec/50). REVEAL distance shows the line's snap dots as you approach;
  // the tighter SNAP distance actually connects. Element anchors win.
  const arrowHit = anchorSnap
    ? null
    : snapToArrowPoint(cursor, elements, ARROW_SNAP_REVEAL_PX, arrowId);
  const arrowSnap = arrowHit && arrowHit.dist <= ARROW_SNAP_THRESHOLD_PX ? arrowHit : null;
  // Reveal the connection points of nearby shapes + arrows so the user can
  // see where the endpoint will snap, highlighting the active one.
  const snapTargets = computeSnapTargets(
    cursor,
    elements,
    anchorSnap?.elementId ?? null,
    anchorSnap?.anchor ?? null,
  );
  if (arrowHit) {
    const targetArrow = elements.find((e) => e.id === arrowHit.arrowId && e.type === 'arrow') as
      | ArrowElement
      | undefined;
    if (targetArrow) {
      for (const sp of arrowSnapPoints(targetArrow, elements)) {
        snapTargets.push({
          x: sp.x,
          y: sp.y,
          active: !!arrowSnap && Math.abs(sp.t - arrowHit.t) < 1e-6,
        });
      }
    }
  }

  if (anchorSnap) {
    return {
      endpoint: {
        kind: 'pinned',
        elementId: anchorSnap.elementId,
        anchor: anchorSnap.anchor,
        // A hand-repositioned endpoint that lands on an anchor is a manual
        // override; auto-rebind then leaves this end's face alone.
        ...(reposition ? { manual: true } : {}),
      },
      guides: [],
      snapTargets,
      arrowConnected: false,
    };
  }
  if (arrowSnap) {
    // Connect to a point along the target arrow's line; it resolves
    // dynamically so it tracks the target as it moves (spec/50).
    return {
      endpoint: { kind: 'on-arrow', arrowId: arrowSnap.arrowId, t: arrowSnap.t },
      guides: [],
      snapTargets,
      arrowConnected: true,
    };
  }

  // Angle snap: lock the arrow to 45-degree increments from its
  // other endpoint when the cursor is within ~5 degrees of one.
  // Keeps right-angle connectors easy to draw without fighting the
  // cursor at oblique angles.
  const arrow = elements.find((e) => e.id === arrowId && e.type === 'arrow') as
    | ArrowElement
    | undefined;
  let resolved = cursor;
  let angleLocked = false;
  let other: { x: number; y: number } | null = null;
  if (arrow) {
    const otherKey = end === 'from' ? 'to' : 'from';
    other = endpointPosition(arrow[otherKey], elements);
    const ax = cursor.x - other.x;
    const ay = cursor.y - other.y;
    const len = Math.hypot(ax, ay);
    if (len > 0) {
      const angle = Math.atan2(ay, ax);
      const STEP = Math.PI / 4;
      const THRESH = (5 * Math.PI) / 180;
      const nearest = Math.round(angle / STEP) * STEP;
      if (Math.abs(angle - nearest) <= THRESH) {
        resolved = {
          x: other.x + Math.cos(nearest) * len,
          y: other.y + Math.sin(nearest) * len,
        };
        angleLocked = true;
      }
    }
  }
  // Alignment snapping for the free endpoint (skipped once the 45°
  // angle lock already constrains it): nudge the point to line up
  // with nearby boxed elements' edges / centres AND with the arrow's
  // OTHER endpoint (so it clicks into a perfectly horizontal /
  // vertical line), showing the same faint guides a boxed move does.
  let guides: AlignmentGuide[] = [];
  if (!angleLocked && !noSnap) {
    const boxSnap = snapToAlignment(
      { x: resolved.x, y: resolved.y, width: 0, height: 0 },
      elements,
      NO_ALIGN_EXCLUDE,
      ALIGN_SNAP_THRESHOLD,
    );
    resolved = { x: resolved.x + boxSnap.dx, y: resolved.y + boxSnap.dy };
    const extraGuides: AlignmentGuide[] = [];
    // Endpoint-to-other-endpoint alignment fills the axes the box
    // snap didn't claim, so a near-straight arrow latches truly
    // straight with a guide spanning the two ends.
    if (other) {
      if (!boxSnap.snappedX && Math.abs(resolved.x - other.x) <= ALIGN_SNAP_THRESHOLD) {
        resolved = { x: other.x, y: resolved.y };
        extraGuides.push({
          axis: 'x',
          position: other.x,
          start: Math.min(other.y, resolved.y),
          end: Math.max(other.y, resolved.y),
        });
      }
      if (!boxSnap.snappedY && Math.abs(resolved.y - other.y) <= ALIGN_SNAP_THRESHOLD) {
        resolved = { x: resolved.x, y: other.y };
        extraGuides.push({
          axis: 'y',
          position: other.y,
          start: Math.min(other.x, resolved.x),
          end: Math.max(other.x, resolved.x),
        });
      }
    }
    const boxGuides = guidesOn
      ? alignmentGuides(
          { x: resolved.x, y: resolved.y, width: 0, height: 0 },
          elements,
          NO_ALIGN_EXCLUDE,
        )
      : [];
    guides = guidesOn ? [...boxGuides, ...extraGuides] : [];
  }
  return {
    endpoint: { kind: 'free', x: resolved.x, y: resolved.y },
    guides,
    snapTargets,
    arrowConnected: false,
  };
}
