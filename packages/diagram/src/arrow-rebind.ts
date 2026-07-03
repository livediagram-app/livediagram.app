import { isBoxed, type Anchor, type Element, type ElementId } from './index';
import {
  ANCHOR_SWITCH_MARGIN,
  FACE_SHARE_MIN_RAD,
  anchorAimPoint,
  buildElementIndex,
  centreOf,
  endpointPosition,
  isCardinal,
  rankAnchorsTowards,
  type Cardinal,
} from './geometry';

// Re-pin arrows whose either endpoint is anchored to a moved box, pointing
// each end at the face the connector now leaves through. Pure: takes the
// already-translated element list and the set of ids that just moved,
// returns the same list with each affected arrow's from/to anchors
// recomputed.
//
// Only re-anchors arrows where BOTH ends are pinned to a box. from/to pairs
// that mix free + pinned (one floating end) keep their anchors as-is: the
// free end already dictates the visual direction, and rebinding the pinned
// end against a floating point would jitter as the user drags.
//
// When several arrows attach to the SAME element they're distributed across
// its faces rather than stacked: the endpoint most committed to a contested
// face keeps it and the others fall to their next-best free face, so two
// arrows that both want a shape's north face end up on north + east. Faces
// held by pinned arrows we are NOT re-anchoring this pass (a mixed arrow's
// pinned end, or an arrow on a box that didn't move) are reserved so the
// re-pinned arrows route around them too.
export function rebindArrowAnchorsAfterMove(
  elements: Element[],
  movingIds: ReadonlySet<ElementId> | Map<ElementId, unknown>,
): Element[] {
  const includes = (id: ElementId) => movingIds.has(id);
  // Build the id index once so each affected arrow's from/to lookups
  // are O(1) instead of two `find` scans of the whole list per arrow
  // (this runs on every box-drag frame).
  const byId = buildElementIndex(elements);

  // Plan every endpoint we'll re-anchor, ranking each toward the OTHER
  // end's centre. Eligible arrows have both ends pinned to a box with at
  // least one box in the moving set.
  type EndPlan = {
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
  if (plans.length === 0) return elements;

  // Faces already occupied on an element by pinned arrows we are NOT
  // touching this pass, so the re-anchored arrows don't stack onto them.
  // Alongside each occupied anchor we record the occupying line's outgoing
  // DIRECTION, so the sharing test below can compare against it too.
  const reserved = new Map<ElementId, Set<Anchor>>();
  const faceDirs = new Map<ElementId, Map<Cardinal, number[]>>();
  const recordDir = (id: ElementId, anchor: Anchor, dir: number) => {
    if (!isCardinal(anchor)) return;
    let dirs = faceDirs.get(id);
    if (!dirs) faceDirs.set(id, (dirs = new Map()));
    let list = dirs.get(anchor);
    if (!list) dirs.set(anchor, (list = []));
    list.push(dir);
  };
  const reserve = (id: ElementId, anchor: Anchor, dir?: number) => {
    let set = reserved.get(id);
    if (!set) reserved.set(id, (set = new Set()));
    set.add(anchor);
    if (dir !== undefined) recordDir(id, anchor, dir);
  };
  for (const el of elements) {
    if (el.type !== 'arrow') continue;
    // Reserve faces held by arrows we are NOT re-anchoring this pass, PLUS
    // any manual end of an arrow we ARE re-anchoring (its face is fixed, so
    // the re-anchored ends route around it rather than stacking onto it).
    const skip = reassigning.has(el.id);
    if (el.from.kind === 'pinned' && (!skip || el.from.manual === true)) {
      const host = byId.get(el.from.elementId);
      const other = endpointPosition(el.to, byId);
      const c = host && isBoxed(host) ? centreOf(host) : other;
      reserve(el.from.elementId, el.from.anchor, Math.atan2(other.y - c.y, other.x - c.x));
    }
    if (el.to.kind === 'pinned' && (!skip || el.to.manual === true)) {
      const host = byId.get(el.to.elementId);
      const other = endpointPosition(el.from, byId);
      const c = host && isBoxed(host) ? centreOf(host) : other;
      reserve(el.to.elementId, el.to.anchor, Math.atan2(other.y - c.y, other.x - c.x));
    }
  }

  // Greedy per element: most-committed endpoint claims its best face first,
  // the rest take their next free face. Deterministic tie-break by arrow id.
  const byElement = new Map<ElementId, EndPlan[]>();
  for (const p of plans) {
    let list = byElement.get(p.elementId);
    if (!list) byElement.set(p.elementId, (list = []));
    list.push(p);
  }
  const assigned = new Map<string, Anchor>();
  // Face normals, for "does this line actually leave through that face"
  // half-plane checks (used by the sibling vote + pairing below).
  const FACE_NORMALS: Record<Cardinal, { x: number; y: number }> = {
    n: { x: 0, y: -1 },
    s: { x: 0, y: 1 },
    e: { x: 1, y: 0 },
    w: { x: -1, y: 0 },
  };
  const leavesThrough = (dir: number, f: Cardinal) =>
    Math.cos(dir) * FACE_NORMALS[f].x + Math.sin(dir) * FACE_NORMALS[f].y > 0.15;
  for (const [elementId, eps] of byElement) {
    // Sibling consistency vote (spec/09): a fan of arrows from one element
    // should leave through ONE face when they can (a tree fans from the
    // hub's bottom), not scatter to whichever face each line's slab-ray
    // grazes. The face most siblings naturally rank first wins, and every
    // sibling whose line genuinely leaves through it (half-plane check)
    // adopts it as its best — the share/corner resolution below then fans
    // them along that face. Settled siblings vote too: the faces of pinned
    // arrows NOT re-anchored this pass (recorded as reserved dirs) count,
    // so a LONE re-anchored arrow — a freshly connected one, or one whose
    // child just moved — still joins an established fan instead of taking
    // whichever face its own chord grazes first.
    const reservedVotes = faceDirs.get(elementId);
    let reservedCount = 0;
    const votes = new Map<Cardinal, number>();
    if (reservedVotes) {
      for (const [f, dirs] of reservedVotes) {
        votes.set(f, dirs.length);
        reservedCount += dirs.length;
      }
    }
    if (eps.length + reservedCount > 1) {
      for (const p of eps) votes.set(p.ranked[0]!, (votes.get(p.ranked[0]!) ?? 0) + 1);
      let dominant: Cardinal | null = null;
      let max = 0;
      for (const [f, n] of votes) {
        if (n > max) {
          max = n;
          dominant = f;
        }
      }
      if (dominant && max * 2 > eps.length + reservedCount) {
        for (const p of eps) {
          if (p.ranked[0] !== dominant && leavesThrough(p.dir, dominant)) {
            p.ranked = [dominant, ...p.ranked.filter((f) => f !== dominant)];
            p.voteAdopted = true;
          }
        }
      }
    }
    const taken = new Set<Anchor>(reserved.get(elementId) ?? []);
    const ordered = [...eps].sort((a, b) =>
      a.commitment === b.commitment
        ? a.arrowId < b.arrowId
          ? -1
          : a.arrowId > b.arrowId
            ? 1
            : a.end < b.end
              ? -1
              : 1
        : b.commitment - a.commitment,
    );
    for (const p of ordered) {
      // The geometrically best face for this line, regardless of occupancy.
      const best: Cardinal = p.ranked[0]!;
      // Occupied-best resolution (the "second arrow from the same box"
      // problem): hopping to the next-ranked face put an arrow to a
      // lower-left target on the WEST face — a sideways exit that reads
      // wrong. Instead:
      //   1. SHARE the best face when every line already on it diverges
      //      from this one by a wide angle (the lines fan out from the
      //      same edge, like a tree — they don't visually stack);
      //   2. otherwise slide to the SAME face's corner toward this line's
      //      side (s -> se/sw), staying on the edge the line actually
      //      leaves through;
      //   3. only when that corner is taken too, fall to the next free
      //      ranked face as before.
      const angleBetween = (a: number, b: number) => {
        const d = Math.abs(a - b) % (Math.PI * 2);
        return d > Math.PI ? Math.PI * 2 - d : d;
      };
      const dirsOn = (f: Cardinal) => faceDirs.get(elementId)?.get(f) ?? [];
      const canShare = (f: Cardinal) =>
        dirsOn(f).length > 0 &&
        dirsOn(f).every((d) => angleBetween(d, p.dir) >= FACE_SHARE_MIN_RAD);
      const cornerFor = (f: Cardinal): Anchor => {
        if (f === 'n') return Math.cos(p.dir) >= 0 ? 'ne' : 'nw';
        if (f === 's') return Math.cos(p.dir) >= 0 ? 'se' : 'sw';
        if (f === 'e') return Math.sin(p.dir) >= 0 ? 'se' : 'ne';
        return Math.sin(p.dir) >= 0 ? 'sw' : 'nw';
      };
      let face: Anchor;
      if (!taken.has(best) || canShare(best) || p.voteAdopted === true) {
        face = best;
      } else {
        const corner = cornerFor(best);
        face = !taken.has(corner) ? corner : (p.ranked.find((f) => !taken.has(f)) ?? best);
      }
      // Stability: stay on the current anchor while it's still available (or
      // shareable) and within the dead-band of the chosen one, so a drag
      // doesn't make the arrow hop under tiny direction changes. A corner
      // `current` compares via its face's exit time.
      const currentFace: Cardinal | null = isCardinal(p.current)
        ? p.current
        : p.current === 'ne' || p.current === 'nw'
          ? 'n'
          : p.current === 'se' || p.current === 'sw'
            ? 's'
            : null;
      const chosenFace: Cardinal = isCardinal(face)
        ? face
        : face === 'ne' || face === 'nw'
          ? 'n'
          : 's';
      // A corner only earns stability while it still sits on the LINE'S side
      // of its face. A stale corner from an earlier layout (target since
      // dragged across the box's centre line) would make the line exit one
      // corner and cross to the other side — over a sibling that correctly
      // holds the face's centre. Face times can't catch this (the corner
      // shares its face's exit time), so test the side explicitly and let
      // the freshly-computed face/corner win when it disagrees.
      const cornerStillAgrees =
        currentFace === null || isCardinal(p.current) || cornerFor(currentFace) === p.current;
      // A vote-adopted plan must MOVE to the fan's face — retaining the
      // scattered face it used to sit on (whose raw exit time often wins)
      // would defeat the vote every pass.
      const voteAllowsStay = p.voteAdopted !== true || currentFace === chosenFace;
      if (
        currentFace &&
        cornerStillAgrees &&
        voteAllowsStay &&
        (!taken.has(p.current) || (isCardinal(p.current) && canShare(p.current))) &&
        p.times[currentFace] <= p.times[chosenFace] * (1 + ANCHOR_SWITCH_MARGIN)
      ) {
        face = p.current;
      }
      taken.add(face);
      recordDir(elementId, isCardinal(face) ? face : chosenFace, p.dir);
      assigned.set(`${p.arrowId}:${p.end}`, face);
    }
  }

  // Pairing pass (spec/09): a connector reads best when its two faces
  // OPPOSE each other (s -> n, e -> w). When the two ends landed on
  // different axes — a wide tree child's lone arrow ranks its side face
  // first even though the hub end leaves through the bottom — re-align the
  // UNCONTESTED end (its element has just this one plan and no reserved
  // faces) to oppose the other end, provided its line genuinely leaves
  // through that face and the detour is not wildly worse (<= 3x the exit
  // time of its natural face).
  const OPPOSITE: Record<Cardinal, Cardinal> = { n: 's', s: 'n', e: 'w', w: 'e' };
  const faceOf = (a: Anchor): Cardinal =>
    isCardinal(a) ? a : a === 'ne' || a === 'nw' ? 'n' : 's';
  const planFor = new Map<string, EndPlan>();
  for (const p of plans) planFor.set(`${p.arrowId}:${p.end}`, p);
  for (const el of elements) {
    if (el.type !== 'arrow' || !reassigning.has(el.id)) continue;
    const fromKey = `${el.id}:from`;
    const toKey = `${el.id}:to`;
    const fromFace = assigned.get(fromKey);
    const toFace = assigned.get(toKey);
    if (!fromFace || !toFace) continue;
    if (faceOf(fromFace) === OPPOSITE[faceOf(toFace)]) continue;
    for (const [key, otherFace] of [
      [toKey, fromFace],
      [fromKey, toFace],
    ] as const) {
      const p = planFor.get(key);
      if (!p) continue;
      const siblings = byElement.get(p.elementId) ?? [];
      const contested = siblings.length > 1 || (reserved.get(p.elementId)?.size ?? 0) > 0;
      if (contested) continue;
      const want = OPPOSITE[faceOf(otherFace)];
      const current = assigned.get(key)!;
      if (faceOf(current) === want) break;
      if (!leavesThrough(p.dir, want)) continue;
      const tWant = p.times[want];
      const tCurrent = p.times[faceOf(current)];
      if (!Number.isFinite(tWant) || tWant > tCurrent * 3) continue;
      assigned.set(key, want);
      break;
    }
  }

  return elements.map((el) => {
    if (el.type !== 'arrow' || !reassigning.has(el.id)) return el;
    const fromFace = assigned.get(`${el.id}:from`);
    const toFace = assigned.get(`${el.id}:to`);
    return {
      ...el,
      from: fromFace ? { ...el.from, anchor: fromFace } : el.from,
      to: toFace ? { ...el.to, anchor: toFace } : el.to,
    };
  });
}
