// Anchor docking on an event-storming board (spec/139 Phase 7): the notation's
// own adjacencies, made into something the board KNOWS rather than something
// the eye infers from two notes being near each other.
//
// A command belongs to the event it triggers, or to the policy that issues it;
// a policy belongs to the event it reacts to. Docked, the pair sits with a
// small seam between the notes and a dot on each facing edge — two magnets,
// not a connector.
//
// Pure and React-free: the anchor affordance, the drag candidate, the drop,
// the canvas and the SVG export all ask these functions, so what the author
// sees mid-drag is exactly what lands.

import {
  eventStormingKindOf,
  eventStormingNoteSize,
  type EventStormingNoteKind,
} from './event-storming';
import type { Element, ElementId, StickyElement } from './index';

// Which side of its host a docked note sits on, along the board's own
// left-to-right time axis.
export type EsDockSide = 'before' | 'after';

export type EsDock = {
  hostId: ElementId;
  side: EsDockSide;
};

export type EsDocking = {
  kind: EventStormingNoteKind;
  hostKind: EventStormingNoteKind;
  side: EsDockSide;
};

// The pairings the notation has, and the side each one reads on. A CATALOGUE
// rather than a switch, because the sides are notation rather than geometry:
// a workshop that reads its wall the other way should cost one line here, and
// the further pairings (actor under a command, aggregate above a pair, …) are
// one row each plus whatever `side` they need.
//
// These are Brandolini's placements. A command sits to the LEFT of the event
// it causes — cause before effect, along the same axis the board already means
// — and both a policy and the command a policy issues sit to the RIGHT of what
// they follow.
export const ES_DOCKINGS: EsDocking[] = [
  { kind: 'command', hostKind: 'domain-event', side: 'before' },
  { kind: 'command', hostKind: 'policy', side: 'after' },
  { kind: 'policy', hostKind: 'domain-event', side: 'after' },
];

// The gap between two docked notes. Small enough to read as a join rather than
// a placement, big enough for the two dots to sit in.
export const ES_DOCK_SEAM_PX = 16;
// How near a compatible face a dragged note has to come before it docks.
export const ES_DOCK_SNAP_PX = 40;
export const ES_DOCK_DOT_R = 4;

export function dockingFor(
  kind: EventStormingNoteKind,
  hostKind: EventStormingNoteKind,
): EsDocking | null {
  return ES_DOCKINGS.find((d) => d.kind === kind && d.hostKind === hostKind) ?? null;
}

// The faces a host of this kind offers, in catalogue order. At most two, which
// is what lets them be shown as affordances without becoming chrome.
export function dockableFaces(
  hostKind: EventStormingNoteKind,
): { side: EsDockSide; kind: EventStormingNoteKind }[] {
  return ES_DOCKINGS.filter((d) => d.hostKind === hostKind).map((d) => ({
    side: d.side,
    kind: d.kind,
  }));
}

type Bounds = { x: number; y: number; width: number; height: number };

// Where a note of `kind` sits when docked to this host: a seam away on the x
// axis, and CENTRED on the host vertically — which is what lets the 180-tall
// prose kinds sit against a 200-tall square and still read as one row.
export function dockedBounds(
  host: { x: number; y: number; width: number; height: number },
  side: EsDockSide,
  kind: EventStormingNoteKind,
): Bounds {
  const size = eventStormingNoteSize(kind);
  const x =
    side === 'before'
      ? host.x - ES_DOCK_SEAM_PX - size.width
      : host.x + host.width + ES_DOCK_SEAM_PX;
  return {
    x,
    y: host.y + host.height / 2 - size.height / 2,
    width: size.width,
    height: size.height,
  };
}

function isBoxedNote(el: Element): el is StickyElement {
  return el.type === 'sticky';
}

// Is this element free to be a host right now? A locked element was pinned
// there on purpose, and one on a hidden or locked layer cannot be aimed at.
function usableHost(el: Element, inertIds?: ReadonlySet<ElementId>): el is StickyElement {
  return isBoxedNote(el) && el.locked !== true && !inertIds?.has(el.id);
}

export function dockOf(el: Element): EsDock | null {
  return isBoxedNote(el) ? (el.esDock ?? null) : null;
}

export function isFaceFree(hostId: ElementId, side: EsDockSide, elements: Element[]): boolean {
  return !elements.some((el) => {
    const d = dockOf(el);
    return d?.hostId === hostId && d.side === side;
  });
}

// The nearest host offering a FREE compatible face whose docked position is
// within the snap distance of where the dragged note currently is. Nearest by
// how far the note would have to travel, so two candidates in range resolve to
// the one the hand is actually closest to.
export function findDockCandidate(
  candidate: Bounds & { kind: EventStormingNoteKind; id?: ElementId },
  elements: Element[],
  opts: { inertIds?: ReadonlySet<ElementId> } = {},
): { hostId: ElementId; side: EsDockSide; bounds: Bounds } | null {
  let best: { hostId: ElementId; side: EsDockSide; bounds: Bounds; distance: number } | null = null;
  for (const el of elements) {
    if (el.id === candidate.id) continue;
    if (!usableHost(el, opts.inertIds)) continue;
    const hostKind = eventStormingKindOf(el);
    if (!hostKind) continue;
    const docking = dockingFor(candidate.kind, hostKind);
    if (!docking) continue;
    if (!isFaceFree(el.id, docking.side, elements)) continue;
    const bounds = dockedBounds(el, docking.side, candidate.kind);
    const dx = Math.abs(bounds.x - candidate.x);
    const dy = Math.abs(bounds.y - candidate.y);
    if (dx > ES_DOCK_SNAP_PX || dy > ES_DOCK_SNAP_PX) continue;
    const distance = Math.hypot(dx, dy);
    if (!best || distance < best.distance) {
      best = { hostId: el.id, side: docking.side, bounds, distance };
    }
  }
  if (!best) return null;
  return { hostId: best.hostId, side: best.side, bounds: best.bounds };
}

// What is docked to this host, in board order.
export function dockedNotesOf(hostId: ElementId, elements: Element[]): StickyElement[] {
  return elements.filter((el): el is StickyElement => dockOf(el)?.hostId === hostId);
}

// The whole cluster an element belongs to: the host plus everything docked to
// it. Asking from either end gives the same set, so a caller never has to know
// which end it is holding.
export function dockClusterOf(id: ElementId, elements: Element[]): Element[] {
  const el = elements.find((e) => e.id === id);
  if (!el) return [];
  const hostId = dockOf(el)?.hostId ?? id;
  const host = elements.find((e) => e.id === hostId);
  if (!host) return [el];
  return [host, ...dockedNotesOf(hostId, elements)];
}

// The two dots in the seam: one on each facing edge, at the shared centre
// line. Shared by the canvas and the SVG export so the picture the board hands
// out is the board.
export function seamDots(
  host: Bounds,
  docked: Bounds,
  side: EsDockSide,
): [{ x: number; y: number }, { x: number; y: number }] {
  const y = host.y + host.height / 2;
  return side === 'before'
    ? [
        { x: docked.x + docked.width, y },
        { x: host.x, y },
      ]
    : [
        { x: host.x + host.width, y },
        { x: docked.x, y },
      ];
}

// Dock a note to a host: stamp the relation and move the note into place. A
// pairing the notation does not have is refused outright (returns the same
// array), so no caller can invent one.
export function dock(
  elements: Element[],
  id: ElementId,
  hostId: ElementId,
  side: EsDockSide,
): Element[] {
  const note = elements.find((el) => el.id === id);
  const host = elements.find((el) => el.id === hostId);
  if (!note || !host || !isBoxedNote(note)) return elements;
  const kind = eventStormingKindOf(note);
  const hostKind = eventStormingKindOf(host);
  if (!kind || !hostKind) return elements;
  const docking = dockingFor(kind, hostKind);
  if (!docking || docking.side !== side) return elements;
  const bounds = dockedBounds(host as Bounds, side, kind);
  return elements.map((el) =>
    el.id === id ? { ...(el as StickyElement), ...bounds, esDock: { hostId, side } } : el,
  );
}

// Undock: drop the relation and leave the note exactly where it is. Where it
// sits is now the author's business, which is the whole point of undocking.
export function undock(elements: Element[], id: ElementId): Element[] {
  const note = elements.find((el) => el.id === id);
  if (!note || !isBoxedNote(note) || !note.esDock) return elements;
  return elements.map((el) => {
    if (el.id !== id) return el;
    const { esDock: _gone, ...rest } = el as StickyElement;
    void _gone;
    return rest as StickyElement;
  });
}

// A docked note whose host is not on the board becomes standalone — the
// `freezeDanglingGroupEnds` precedent, but simpler, because a dock needs no
// geometry from the pre-delete state: the note stays exactly where it is and
// only loses the relation.
//
// Phrased as "is the host THERE" rather than "was the host just removed", so
// the one function heals a delete, an import of a hand-edited file, and a
// cross-tab paste alike. A relation pointing at nothing is worse than no
// relation. Returns the SAME array when nothing dangles, so an ordinary
// delete doesn't churn every memoised view.
export function stripDanglingDocks(elements: Element[]): Element[] {
  const present = new Set(elements.map((el) => el.id));
  let changed = false;
  const next = elements.map((el) => {
    const d = dockOf(el);
    if (!d || present.has(d.hostId)) return el;
    changed = true;
    const { esDock: _gone, ...rest } = el as StickyElement;
    void _gone;
    return rest as StickyElement;
  });
  return changed ? next : elements;
}
