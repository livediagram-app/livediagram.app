import type { Anchor, BoxedElement } from './index';
import { centreOf, connectorBox, rotatePoint, type Point } from './geometry';

// Auto-anchor face selection, split out of geometry.ts: which cardinal
// face a connector should leave a box through, the hysteresis that
// keeps the choice steady while dragging, and the ranking /
// face-sharing rules the distribution pass (arrow-rebind.ts) uses when
// several arrows land on one element. geometry.ts keeps the raw
// position math (anchorPosition, endpointPosition, bounds).

// How decisively the off-axis direction must win before an arrow that is
// already bound to a face abandons it. Without this dead-band a connector
// flips between (say) the east and south face on every sub-pixel wobble
// when the target sits near the box's corner diagonal; the margin holds the
// choice steady while dragging and only commits to the new face once the
// target is clearly past the corner.
export const ANCHOR_SWITCH_MARGIN = 0.2;

// Two lines leaving the same face are allowed to SHARE it when they diverge
// by at least this angle (~30°): they fan out like a tree instead of
// stacking, and bumping one to a perpendicular face reads far worse. Lines
// closer than this genuinely overlap and get separated (same-face corner
// first, then the next face).
export const FACE_SHARE_MIN_RAD = Math.PI / 6;

export type Cardinal = 'n' | 'e' | 's' | 'w';
const CARDINALS: readonly Cardinal[] = ['n', 'e', 's', 'w'];

export function isCardinal(anchor: Anchor): anchor is Cardinal {
  return anchor === 'n' || anchor === 'e' || anchor === 's' || anchor === 'w';
}

// For a centre->`towards` direction, the parametric distance `t` at which
// the ray leaves the box through each cardinal face (smaller = the ray
// reaches that face sooner, so that's the face it actually exits through).
// A face the ray points away from is unreachable (`Infinity`). This slab /
// ray-box test underpins both face selection and ranking and is
// aspect-ratio aware: a short, wide box exits top/bottom for everything but
// near-horizontal targets, a tall box through its sides, where the earlier
// "nearest edge-midpoint to the far centre" metric picked whichever
// midpoint sat closest in raw distance even when the connecting line never
// crossed that face. Rotation is handled by bringing the direction into the
// element's unrotated frame first; anchorPosition rotates the chosen face
// back out to world space when the endpoint is resolved.
function faceExitTimes(element: BoxedElement, towards: Point): Record<Cardinal, number> {
  const c = centreOf(element);
  let dx = towards.x - c.x;
  let dy = towards.y - c.y;
  const rotation = element.rotation ?? 0;
  if (rotation) {
    const local = rotatePoint({ x: dx, y: dy }, { x: 0, y: 0 }, -rotation);
    dx = local.x;
    dy = local.y;
  }
  // `|| 1` guards a degenerate zero dimension; real elements clamp to MIN_SIZE.
  const box = connectorBox(element);
  const halfWidth = box.width / 2 || 1;
  const halfHeight = box.height / 2 || 1;
  return {
    e: dx > 0 ? halfWidth / dx : Infinity,
    w: dx < 0 ? halfWidth / -dx : Infinity,
    s: dy > 0 ? halfHeight / dy : Infinity,
    n: dy < 0 ? halfHeight / -dy : Infinity,
  };
}

// The cardinal faces ranked best-first for a centre->`towards` direction
// (`ranked[0]` is the face the connecting line exits through, i.e. what
// bestAnchorTowards picks), plus a `commitment` ratio: how decisively the
// best face beats the runner-up (>= 1; `Infinity` when the box is faced
// head-on). Distribution uses the ordering to fall back to the next-best
// FREE face when several arrows land on one element, and the commitment to
// decide which arrow keeps a contested face (the most committed one wins it,
// the rest step aside).
export function rankAnchorsTowards(
  element: BoxedElement,
  towards: Point,
): { ranked: Cardinal[]; commitment: number; times: Record<Cardinal, number> } {
  const times = faceExitTimes(element, towards);
  // Stable base order so ties (a square faced at exactly 45deg) resolve
  // deterministically instead of depending on the sort implementation.
  const ranked = [...CARDINALS].sort((a, b) => times[a] - times[b]);
  const t0 = times[ranked[0]!];
  const t1 = times[ranked[1]!];
  const commitment = t0 === Infinity ? 0 : t1 === Infinity ? Infinity : t1 / t0;
  return { ranked, commitment, times };
}

// Where one endpoint should AIM when re-choosing its face: the closest
// point of the other box to this box's centre, not the other box's
// centre. Aiming at the centre picked visually wrong, inconsistent
// faces for elements that are mostly side-by-side but slightly offset —
// the ray toward a higher box's centre exits through the TOP face even
// though the boxes read as a row — so connectors attached to odd faces
// and siblings in one layout got different face pairs. Clamping the aim
// to the other box's nearest point makes any pair whose vertical spans
// overlap choose the opposing e/w faces (and n/s for overlapping
// horizontal spans): rows read as rows, columns as columns, and
// template layouts keep consistent connections. Truly diagonal pairs
// clamp to a corner, which preserves the ray behaviour they had. Falls
// back to the other centre when the boxes overlap (the clamp would
// return this centre itself — a degenerate ray).
export function anchorAimPoint(other: BoxedElement, fromCentre: Point): Point {
  const box = connectorBox(other);
  const x = Math.min(Math.max(fromCentre.x, box.x), box.x + box.width);
  const y = Math.min(Math.max(fromCentre.y, box.y), box.y + box.height);
  if (x === fromCentre.x && y === fromCentre.y) return centreOf(other);
  return { x, y };
}

// Pick the single cardinal face (n/e/s/w) the centre->`towards` line leaves
// the box through (`ranked[0]` from rankAnchorsTowards). Corners are never
// auto-chosen: the manual anchor dots are cardinal-only too, and arrows read
// cleaner from edge middles.
//
// `current` (the face the arrow already sits on, when re-binding) adds
// hysteresis: the choice only switches axes once the target is decisively
// past the box corner (ANCHOR_SWITCH_MARGIN), so dragging a connected shape
// along the diagonal doesn't make the arrow flicker. A sign flip on the same
// axis (e<->w, n<->s) always commits — the target has crossed the centre, so
// the old face now points away (Infinity) and loses outright.
//
// `avoid` excludes faces already taken by another arrow on the same element,
// so a second connector lands on a free face instead of stacking onto the
// first. A corner `current` falls through to the exact geometric face.
export function bestAnchorTowards(
  element: BoxedElement,
  towards: Point,
  current?: Anchor,
  avoid?: ReadonlySet<Anchor>,
): Anchor {
  const { ranked, times } = rankAnchorsTowards(element, towards);
  const top = (avoid ? ranked.find((f) => !avoid.has(f)) : ranked[0]) ?? ranked[0]!;
  if (
    current &&
    isCardinal(current) &&
    (!avoid || !avoid.has(current)) &&
    times[current] <= times[top] * (1 + ANCHOR_SWITCH_MARGIN)
  ) {
    return current;
  }
  return top;
}
