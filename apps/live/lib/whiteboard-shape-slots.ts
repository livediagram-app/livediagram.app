// The dock's shape slots (docs/specs/023-whiteboard/whiteboard.md "Shape slots"): the default pins,
// which kinds fill the Shapes flyout's six slots (Most used, Recent), how a pick is recorded, and
// where a shape dragged onto the bar lands. Pure; the dock prefs (lib/whiteboard-dock-prefs.ts) store the results and
// the slot drag (useShapeSlotDrag) measures.
import {
  isWhiteboardShapeKey,
  WHITEBOARD_SHAPE_CATALOGUE,
  type WhiteboardShapeKey,
} from './whiteboard-shape-catalogue';
import { WHITEBOARD_SHAPES } from './whiteboard-tool';

// Per kind: how often it was picked, and when last (epoch ms), as a pair to keep the synced
// preferences blob (4 KB for everything) small. The time orders the last-used slots.
export type ShapePicks = Readonly<Partial<Record<WhiteboardShapeKey, readonly [number, number]>>>;

export const PINNED_SHAPES_MAX = 7;

// The pinned side of a user who never changed it (docs/specs/023-whiteboard/whiteboard.md "Shape slots").
export const DEFAULT_PINNED_SHAPES: readonly WhiteboardShapeKey[] = [
  'arrow',
  'rectangle',
  'ellipse',
];

// The Shapes flyout's two rows of slots.
export const MOST_USED_SLOTS = 3;
export const RECENT_SLOTS = 3;

// Kinds whose picks are kept: the last 20 kinds used (about 600 bytes), never evicting one of the
// SHAPE_PICKS_PROTECTED most picked, so a favourite survives a spell of one-off picks.
export const SHAPE_PICKS_KEPT = 20;
export const SHAPE_PICKS_PROTECTED = 5;

// With too little history: the Shapes flyout in order (Rectangle, Ellipse, Diamond, Cylinder,
// Line, Arrow), then the rest of the catalogue, so the slots still fill when those are on the bar.
const FALLBACK: readonly WhiteboardShapeKey[] = [
  ...new Set<WhiteboardShapeKey>([
    ...WHITEBOARD_SHAPES.map((s) => s.id),
    ...WHITEBOARD_SHAPE_CATALOGUE.map((e) => e.key),
  ]),
];

type Pick = { key: WhiteboardShapeKey; n: number; t: number };

function picksOf(picks: ShapePicks): Pick[] {
  return (Object.entries(picks) as [WhiteboardShapeKey, readonly [number, number]][]).map(
    ([key, [n, t]]) => ({ key, n, t }),
  );
}

const byUse = (a: Pick, b: Pick) => b.n - a.n || b.t - a.t;
const byRecency = (a: Pick, b: Pick) => b.t - a.t;

export type ShapeSlots = { mostUsed: WhiteboardShapeKey[]; recent: WhiteboardShapeKey[] };

/**
 * The Shapes flyout's slots: Most used (most picks first, ties to the most recent), then Recent
 * (newest first), none of them pinned and none twice; an empty slot takes the next fallback kind
 * not already showing.
 */
export function shapeSlots(picks: ShapePicks, pinned: readonly WhiteboardShapeKey[]): ShapeSlots {
  const known = picksOf(picks).filter(
    (p) => isWhiteboardShapeKey(p.key) && !pinned.includes(p.key),
  );
  const onBar = new Set<WhiteboardShapeKey>(pinned);
  const next = (candidates: readonly WhiteboardShapeKey[]) => {
    const key = [...candidates, ...FALLBACK].find((k) => !onBar.has(k))!;
    onBar.add(key);
    return key;
  };
  const used = [...known].sort(byUse).map((p) => p.key);
  const mostUsed = Array.from({ length: MOST_USED_SLOTS }, (_, i) => next(used.slice(0, i + 1)));
  const latest = [...known].sort(byRecency).map((p) => p.key);
  const recent = Array.from({ length: RECENT_SLOTS }, () => next(latest));
  return { mostUsed, recent };
}

/** Record one pick of `key` at `now`, keeping at most SHAPE_PICKS_KEPT kinds (never dropping `key`). */
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
  const all = picksOf(next);
  if (all.length <= SHAPE_PICKS_KEPT) return next;
  const protectedKeys = new Set(
    all
      .sort(byUse)
      .slice(0, SHAPE_PICKS_PROTECTED)
      .map((p) => p.key),
  );
  const evictable = all
    .filter((p) => p.key !== key && !protectedKeys.has(p.key))
    .sort((a, b) => a.t - b.t);
  for (const old of evictable.slice(0, all.length - SHAPE_PICKS_KEPT)) delete next[old.key];
  return next;
}

export type SlotLayout = {
  // Where the pinned side ends: the separator before the Shapes button, in client px.
  boundaryX: number;
  // The Shapes bar's box; a pointer beyond it by more than SLOT_BAR_REACH_PX is off the bar.
  bar: { left: number; right: number; top: number; bottom: number };
  pinned: readonly { key: WhiteboardShapeKey; left: number; right: number }[];
};

// How far past the bar a drop still counts as on it: one button's width, so an empty pinned side
// is still a comfortable target.
export const SLOT_BAR_REACH_PX = 44;

// Where a dragged shape would land: the pinned side (an insertion `index`, 0 to the number pinned,
// and the pinned slot under the pointer, if any, which a full side replaces), past the separator,
// or off the bar.
export type SlotDropTarget =
  { zone: 'pinned'; index: number; onto?: WhiteboardShapeKey } | { zone: 'past' } | { zone: 'off' };

export function slotDropTarget(x: number, y: number, layout: SlotLayout): SlotDropTarget {
  const { bar } = layout;
  const reach = SLOT_BAR_REACH_PX;
  if (
    x < bar.left - reach ||
    x > bar.right + reach ||
    y < bar.top - reach ||
    y > bar.bottom + reach
  )
    return { zone: 'off' };
  if (x >= layout.boundaryX) return { zone: 'past' };
  const over = layout.pinned.findIndex((p) => x >= p.left && x <= p.right);
  if (over >= 0) {
    // Onto a pinned slot: its left half inserts before it, its right half after it.
    const p = layout.pinned[over]!;
    return { zone: 'pinned', onto: p.key, index: x < (p.left + p.right) / 2 ? over : over + 1 };
  }
  const index = layout.pinned.filter((p) => (p.left + p.right) / 2 < x).length;
  return { zone: 'pinned', index };
}

// A pinned shape on the bar, or a slot or search result in the Shapes flyout.
export type SlotSource = { key: WhiteboardShapeKey; from: 'pinned' | 'flyout' };

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
  if (target.zone !== 'pinned') {
    // Off the pinned side: a pinned kind leaves it (its picks stay); a flyout shape settles back.
    return source.from === 'pinned' ? unpinShape(pinned, source.key) : { type: 'none' };
  }
  if (source.from === 'pinned') {
    // A move: the insertion point counts the slot being moved, so one after it shifts down by one.
    const from = pinned.indexOf(source.key);
    const rest = pinned.filter((k) => k !== source.key);
    const at = target.index > from ? target.index - 1 : target.index;
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

/** Pin to dock from a flyout shape's menu: at the end, with the same limit. */
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

// Where the drop marker sits while a shape is dragged, in client px: a bar at the insertion point on
// the pinned side, or at the separator when a pinned kind is dragged past it. Null when a full
// side would replace the pinned slot under the pointer (it is ringed instead), off the bar, or when
// the drop changes nothing.
export function dropIndicatorX(
  layout: SlotLayout,
  source: SlotSource,
  target: SlotDropTarget,
): number | null {
  if (target.zone === 'off') return null;
  if (target.zone === 'past') return source.from === 'pinned' ? layout.boundaryX : null;
  const replacing = source.from === 'flyout' && layout.pinned.length >= PINNED_SHAPES_MAX;
  if (target.onto && replacing) return null;
  const at = layout.pinned[target.index];
  if (at) return at.left - 2;
  const last = layout.pinned[layout.pinned.length - 1];
  return last ? last.right + 2 : layout.boundaryX - 2;
}
