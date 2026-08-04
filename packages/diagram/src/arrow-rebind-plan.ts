import { isBoxed, type Anchor, type BoxedElement, type Element, type ElementId } from './index';
import { anchorAimPoint, isCardinal, rankAnchorsTowards, type Cardinal } from './anchor-choice';
import { buildElementIndex, centreOf } from './geometry';

// The cardinal face an anchor sits on (corners belong to their horizontal
// edge). Shared by the settled test, the stability dead-band, and the
// pairing pass.
export const faceOf = (a: Anchor): Cardinal =>
  isCardinal(a) ? a : a === 'ne' || a === 'nw' ? 'n' : 's';

// Which corner of a face sits on the line's side: a line leaving rightward
// through the south face belongs at 'se', leftward at 'sw'.
export const cornerForFace = (f: Cardinal, dir: number): Anchor => {
  if (f === 'n') return Math.cos(dir) >= 0 ? 'ne' : 'nw';
  if (f === 's') return Math.cos(dir) >= 0 ? 'se' : 'sw';
  if (f === 'e') return Math.sin(dir) >= 0 ? 'se' : 'ne';
  return Math.sin(dir) >= 0 ? 'sw' : 'nw';
};

// WHICH ENDPOINTS NEED RE-ANCHORING, AND WHERE EACH ONE WANTS TO GO.
//
// The first phase of rebindArrowAnchorsAfterMove, split out because it is the
// half that decides nothing: it reads the moved element list and produces one
// ranked plan per endpoint. The phases that follow — reserving faces already
// taken, assigning greedily, then pairing opposing faces — share mutable
// bookkeeping and belong together; this one is a pure function of its inputs.
//
// The confidence gate moves with it, because deciding an endpoint is settled
// enough to leave alone is what decides it is not planned at all.

// Confidence gate for touching a settled arrow at all: its current face
// only becomes "wrong" once the geometrically best face beats it by MORE
// than this factor (or the line stopped exiting through it entirely). A
// subtle move of a connected box must not reshuffle a fan the user has
// already accepted — re-anchoring is for arrows whose layout genuinely
// broke, not marginal improvements. 3x matches the pairing pass's
// "not wildly worse" bound.
const KEEP_CURRENT_FACTOR = 3;

// Does this end's CURRENT anchor still make sense for the line toward the
// other box? Generous on purpose (see KEEP_CURRENT_FACTOR): the answer is
// only "no" when the layout truly broke. A corner anchor additionally has
// to sit on the line's side of its face (a stale corner reads as the line
// crossing the box).
function anchorStillReasonable(host: BoxedElement, other: BoxedElement, current: Anchor): boolean {
  const centre = centreOf(host);
  const aim = anchorAimPoint(other, centre);
  const { ranked, times } = rankAnchorsTowards(host, aim);
  const face = faceOf(current);
  const t = times[face];
  if (!Number.isFinite(t)) return false;
  if (t > times[ranked[0]!] * KEEP_CURRENT_FACTOR) return false;
  if (!isCardinal(current)) {
    const dir = Math.atan2(aim.y - centre.y, aim.x - centre.x);
    if (cornerForFace(face, dir) !== current) return false;
  }
  return true;
}

export type EndPlan = {
  arrowId: ElementId;
  end: 'from' | 'to';
  elementId: ElementId;
  current: Anchor;
  // Direction (radians) from the element's centre toward this end's aim
  // point — used to decide whether two arrows contesting one face can
  // simply SHARE it (their lines diverge) or genuinely stack.
  dir: number;
  ranked: Cardinal[];
  commitment: number;
  times: Record<Cardinal, number>;
  // Set when the sibling vote re-ranked this plan onto the dominant
  // face: it then SHARES that face outright (the fan's whole point is
  // one exit) and the stability dead-band must not drag it back to the
  // scattered face it used to sit on.
  voteAdopted?: boolean;
};

export function planEndpointRebinds(
  elements: Element[],
  includes: (id: ElementId) => boolean,
  byId: ReturnType<typeof buildElementIndex>,
): { plans: EndPlan[]; reassigning: Set<ElementId> } {
  const plans: EndPlan[] = [];
  const reassigning = new Set<ElementId>();
  for (const el of elements) {
    if (el.type !== 'arrow') continue;
    if (el.from.kind !== 'pinned' || el.to.kind !== 'pinned') continue;
    // Re-anchor only arrows that SPAN the moving boundary (exactly one end
    // pinned to a moved box). When BOTH ends moved together — a frame
    // section, group, or multi-select drag — the arrow translates rigidly
    // with its endpoints and its relative geometry is unchanged, so
    // re-choosing its faces would needlessly reflow it. When NEITHER moved
    // it's irrelevant. Both cases skip.
    if (includes(el.from.elementId) === includes(el.to.elementId)) continue;
    const fromEl = byId.get(el.from.elementId);
    const toEl = byId.get(el.to.elementId);
    if (!fromEl || !isBoxed(fromEl) || !toEl || !isBoxed(toEl)) continue;
    // A manual endpoint (the user dragged it onto that face) is excluded
    // from auto re-anchoring — it keeps its face; only the other end moves.
    // If BOTH ends are manual there's nothing to re-anchor.
    const fromManual = el.from.manual === true;
    const toManual = el.to.manual === true;
    if (fromManual && toManual) continue;
    // Settled short-circuit: when every auto end's CURRENT anchor still
    // reads fine for the new positions, leave the arrow completely alone
    // (its faces still get reserved below, so re-planned arrows route
    // around it). Only an arrow whose layout genuinely broke re-plans —
    // a subtle move must never reshuffle an accepted layout.
    if (
      (fromManual || anchorStillReasonable(fromEl, toEl, el.from.anchor)) &&
      (toManual || anchorStillReasonable(toEl, fromEl, el.to.anchor))
    ) {
      continue;
    }
    reassigning.add(el.id);
    if (!fromManual) {
      const centre = centreOf(fromEl);
      const aim = anchorAimPoint(toEl, centre);
      plans.push({
        arrowId: el.id,
        end: 'from',
        elementId: fromEl.id,
        current: el.from.anchor,
        dir: Math.atan2(aim.y - centre.y, aim.x - centre.x),
        ...rankAnchorsTowards(fromEl, aim),
      });
    }
    if (!toManual) {
      const centre = centreOf(toEl);
      const aim = anchorAimPoint(fromEl, centre);
      plans.push({
        arrowId: el.id,
        end: 'to',
        elementId: toEl.id,
        current: el.to.anchor,
        dir: Math.atan2(aim.y - centre.y, aim.x - centre.x),
        ...rankAnchorsTowards(toEl, aim),
      });
    }
  }
  return { plans, reassigning };
}
