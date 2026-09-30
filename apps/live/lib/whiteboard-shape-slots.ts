// The dock's shape slots (docs/specs/023-whiteboard/whiteboard.md "Shape slots"): which kinds fill the
// two frequent slots, how a pick is counted, and where a dragged slot lands. Pure; the dock prefs
// (lib/whiteboard-dock-prefs.ts) store the results and the slot drag (useShapeSlotDrag) measures.
import { isWhiteboardShapeKey, type WhiteboardShapeKey } from './whiteboard-shape-catalogue';
import { WHITEBOARD_SHAPES } from './whiteboard-tool';

// Per kind: how often it was picked, and when last (epoch ms), as a pair to keep the synced
// preferences blob (4 KB for everything) small.
export type ShapePicks = Readonly<Partial<Record<WhiteboardShapeKey, readonly [number, number]>>>;

export const PINNED_SHAPES_MAX = 2;
export const FREQUENT_SHAPE_SLOTS = 2;
// Kinds whose counts are kept: enough for the ranking to move, small enough for the blob
// (12 entries of about 30 bytes).
export const SHAPE_PICKS_KEPT = 12;

// With too little history: Rectangle, Ellipse, then the Shapes flyout in order.
const FALLBACK: readonly WhiteboardShapeKey[] = WHITEBOARD_SHAPES.map((s) => s.id);

type Ranked = { key: WhiteboardShapeKey; n: number; t: number };

function ranked(picks: ShapePicks): Ranked[] {
  return (Object.entries(picks) as [WhiteboardShapeKey, readonly [number, number]][])
    .map(([key, [n, t]]) => ({ key, n, t }))
    .sort((a, b) => b.n - a.n || b.t - a.t);
}

/** The kinds for the frequent slots: most picked first, ties to the most recent, pinned excluded. */
export function frequentShapes(
  picks: ShapePicks,
  pinned: readonly WhiteboardShapeKey[],
): WhiteboardShapeKey[] {
  const out: WhiteboardShapeKey[] = [];
  const candidates = [
    ...ranked(picks)
      .map((r) => r.key)
      .filter(isWhiteboardShapeKey),
    ...FALLBACK,
  ];
  for (const key of candidates) {
    if (out.length === FREQUENT_SHAPE_SLOTS) break;
    if (!pinned.includes(key) && !out.includes(key)) out.push(key);
  }
  return out;
}

/** Count one pick of `key` at `now`, keeping at most SHAPE_PICKS_KEPT kinds (never dropping `key`). */
export function recordShapePick(
  picks: ShapePicks,
  key: WhiteboardShapeKey,
  now: number,
): ShapePicks {
  const [n] = picks[key] ?? [0, 0];
  const next: Partial<Record<WhiteboardShapeKey, readonly [number, number]>> = {
    ...picks,
    [key]: [n + 1, now],
  };
  const others = ranked(next).filter((r) => r.key !== key);
  for (const weakest of others.slice(SHAPE_PICKS_KEPT - 1)) delete next[weakest.key];
  return next;
}

export type SlotLayout = {
  // The separator's centre, in client px.
  separatorX: number;
  pinned: readonly { key: WhiteboardShapeKey; left: number; right: number }[];
};

// Where a dragged slot would land: left of the separator is the pinned side (onto a pinned slot,
// or an insertion point between them); right of it is the frequent side.
export type SlotDropTarget =
  { zone: 'pinned'; index: number; onto?: WhiteboardShapeKey } | { zone: 'frequent' };

export function slotDropTarget(x: number, layout: SlotLayout): SlotDropTarget {
  if (x >= layout.separatorX) return { zone: 'frequent' };
  const over = layout.pinned.findIndex((p) => x >= p.left && x <= p.right);
  if (over >= 0) return { zone: 'pinned', onto: layout.pinned[over]!.key, index: over };
  const index = layout.pinned.filter((p) => (p.left + p.right) / 2 < x).length;
  return { zone: 'pinned', index };
}

export type SlotSource = { key: WhiteboardShapeKey; from: 'pinned' | 'frequent' };

export type SlotOutcome =
  | { type: 'pin'; pinned: WhiteboardShapeKey[] }
  | { type: 'unpin'; pinned: WhiteboardShapeKey[] }
  | { type: 'refused' }
  | { type: 'none' };

/** What dropping `source` on `target` does to the pinned kinds. */
export function resolveSlotDrop(
  pinned: readonly WhiteboardShapeKey[],
  source: SlotSource,
  target: SlotDropTarget,
): SlotOutcome {
  if (target.zone === 'frequent') {
    return source.from === 'pinned' ? unpinShape(pinned, source.key) : { type: 'none' };
  }
  if (source.from === 'pinned') {
    if (target.onto === source.key) return { type: 'none' };
    const rest = pinned.filter((k) => k !== source.key);
    const at = target.onto ? pinned.indexOf(target.onto) : target.index;
    const moved = [...rest.slice(0, at), source.key, ...rest.slice(at)];
    return moved.every((k, i) => k === pinned[i])
      ? { type: 'none' }
      : { type: 'pin', pinned: moved };
  }
  if (pinned.length >= PINNED_SHAPES_MAX) {
    if (!target.onto) return { type: 'refused' };
    return { type: 'pin', pinned: pinned.map((k) => (k === target.onto ? source.key : k)) };
  }
  const at = Math.min(target.index, pinned.length);
  return { type: 'pin', pinned: [...pinned.slice(0, at), source.key, ...pinned.slice(at)] };
}

/** Pin to dock from a slot's menu: at the end, with the same limit. */
export function pinFromMenu(
  pinned: readonly WhiteboardShapeKey[],
  key: WhiteboardShapeKey,
): SlotOutcome {
  if (pinned.includes(key)) return { type: 'none' };
  if (pinned.length >= PINNED_SHAPES_MAX) return { type: 'refused' };
  return { type: 'pin', pinned: [...pinned, key] };
}

export function unpinShape(
  pinned: readonly WhiteboardShapeKey[],
  key: WhiteboardShapeKey,
): SlotOutcome {
  if (!pinned.includes(key)) return { type: 'none' };
  return { type: 'unpin', pinned: pinned.filter((k) => k !== key) };
}

// Where the drop indicator sits while a slot is dragged, in client px: a bar at the insertion
// point on the pinned side, or just right of the separator when a pinned kind is dragged out.
// Null when the drop lands onto a pinned slot (that slot is ringed instead) or changes nothing.
export function dropIndicatorX(
  layout: SlotLayout,
  source: SlotSource,
  target: SlotDropTarget,
): number | null {
  if (target.zone === 'frequent') return source.from === 'pinned' ? layout.separatorX + 4 : null;
  if (target.onto) return null;
  const at = layout.pinned[target.index];
  if (at) return at.left - 2;
  const last = layout.pinned[layout.pinned.length - 1];
  return last ? last.right + 2 : layout.separatorX - 4;
}
