// The room's presence list as each editor's useRoomConnection reads it (its `roomPresence` handler): the rows the
// avatars draw, the colour a later joiner yields, where each peer is, and what goes with whoever left. Each step is
// pure, and `syncRoomPresence` runs them in the order every editor does, the products' own extras passed in where
// they sit in that order.

import { syncRemoteBesideTabs } from './split-presence';

/** One session in the room's presence list, as the wire carries it. */
export type RoomPresenceEntry<Role extends string = string> = {
  id: string;
  key?: string;
  name: string;
  color: string;
  role?: Role;
  picture?: string;
  tabId?: string | null;
};

/**
 * `prev` without the ids no longer present (a stale entry leaves a ghost cursor or selection ring), and `prev` itself
 * when nobody left: identity is load-bearing, since a fresh Map on every presence ping would re-render every presence
 * consumer even when the roster didn't change.
 */
export function pruneMapToPresent<V>(prev: Map<string, V>, present: Set<string>): Map<string, V> {
  let changed = false;
  const next = new Map<string, V>();
  for (const [id, value] of prev) {
    if (present.has(id)) next.set(id, value);
    else changed = true;
  }
  return changed ? next : prev;
}

/**
 * The avatar rows for a presence list. `keepPicture` says whether a relayed picture is drawn (a product may check
 * it again); by default any picture the room relayed is.
 */
export function presenceRows<Role extends string>(
  participants: readonly RoomPresenceEntry<Role>[],
  lastSeen: ReadonlyMap<string, number>,
  now: number,
  keepPicture: (picture: string) => boolean = () => true,
) {
  return participants.map((p) => ({
    id: p.id,
    // The peer's browser key, claimed in their hello and relayed unchanged: it is what collapses their tabs into one
    // avatar and joins their saved answers back to them. `p.id` cannot, as the room mints that per socket.
    ...(p.key ? { key: p.key } : {}),
    name: p.name,
    color: p.color,
    // Status and lastActiveAt are derived locally rather than carried on the wire: the server doesn't track idle
    // time. A peer not seen yet is seeded with `now`, so the hover card reads "Active just now" until their first op.
    status: 'online' as const,
    lastActiveAt: lastSeen.get(p.id) ?? now,
    // Server-verified (the api resolved it at the upgrade and stamped it on the broadcast row). Optional on the wire
    // so a connection without role info still parses.
    ...(p.role ? { role: p.role } : {}),
    // Only ever present when the room judged us an account session (profile-picture.md §2 in each product).
    ...(p.picture && keepPicture(p.picture) ? { picture: p.picture } : {}),
  }));
}

/**
 * Unique-colour reconciliation: the colour this session moves to, or null to keep its own. Every client computes the
 * same allocation on every presence list, and only acts when someone else holds our colour and our id sorts later
 * than theirs, so only the later joiner yields and every client converges without a server-side allocator.
 */
export function yieldedColour(
  participants: readonly RoomPresenceEntry[],
  self: { id: string; color: string },
  nextFreeColor: (taken: Set<string>) => string,
): string | null {
  if (!participants.some((p) => p.id === self.id)) return null;
  const conflictHolder = participants.find((p) => p.id !== self.id && p.color === self.color);
  if (!conflictHolder || self.id <= conflictHolder.id) return null;
  const taken = new Set(participants.filter((p) => p.id !== self.id).map((p) => p.color));
  const fresh = nextFreeColor(taken);
  return fresh === self.color ? null : fresh;
}

/**
 * Each peer's tab: entries for people who left go, so their dot doesn't linger, and every peer's current tab is
 * seeded from the list, so a late joiner sees where everyone already is. Self is skipped (the relay never echoes
 * our own tab; it is the local active tab). Always a fresh Map, so it re-renders.
 */
export function seededTabFocus(
  prev: Map<string, string>,
  participants: readonly RoomPresenceEntry[],
  present: Set<string>,
  selfId: string,
): Map<string, string> {
  const next = new Map(pruneMapToPresent(prev, present));
  for (const p of participants) {
    if (p.tabId && p.id !== selfId) next.set(p.id, p.tabId);
  }
  return next;
}

/** The idle tracker forgets departed peers, so it can't grow without bound over a long-lived room. */
export function forgetDeparted(lastSeen: Map<string, number>, present: Set<string>): void {
  for (const id of [...lastSeen.keys()]) {
    if (!present.has(id)) lastSeen.delete(id);
  }
}

type MapUpdate<V> = (update: (prev: Map<string, V>) => Map<string, V>) => void;

/** What `syncRoomPresence` reads and drives: the page's presence state, as each editor's hook holds it. */
export type RoomPresenceSync<P extends RoomPresenceEntry, Selection, Cursor> = {
  lastSeen: Map<string, number>;
  // Bumps a peer's last-seen, publishing when they arrive.
  markSeen: (id: string) => void;
  // This session as it is now (read through the hook's ref, never a stale snapshot).
  self: () => { id: string; color: string };
  nextFreeColor: (taken: Set<string>) => string;
  // Moves this session to the colour it yields to (the next hello carries it).
  takeColour: (color: string) => void;
  prunePeerDragPreviews: (present: Set<string>) => void;
  setRemoteTabFocus: MapUpdate<string>;
  setRemoteSelections: MapUpdate<Selection>;
  setRemoteCursors: MapUpdate<Cursor>;
  // A product's own, run once the present set is known (livedocuments' article carets).
  onPresent?: (participants: readonly P[], present: Set<string>) => void;
  // A product's own state that goes with whoever left, after the cursors.
  onPruned?: (present: Set<string>) => void;
};

/**
 * One presence list into the page, after its avatar rows (presenceRows, which each hook sets itself): a seeded
 * last-seen for each arrival, the colour a later joiner yields, and every per-peer state without whoever left (drag
 * previews, tab dots and their other panes, selections, cursors, a product's own, and the idle tracker), in that
 * order.
 */
export function syncRoomPresence<
  P extends RoomPresenceEntry & { besideTabId?: string },
  Selection,
  Cursor,
>(participants: readonly P[], sync: RoomPresenceSync<P, Selection, Cursor>): void {
  // Seed lastSeen for any arrival not tracked yet, publishing it so the next render has their `lastActiveAt`.
  for (const p of participants) {
    if (!sync.lastSeen.has(p.id)) sync.markSeen(p.id);
  }
  // Only the later joiner yields; the new colour flushes through the autosave and the next hello carries it.
  const fresh = yieldedColour(participants, sync.self(), sync.nextFreeColor);
  if (fresh) sync.takeColour(fresh);
  // Drop what each departed peer left behind, so no stale indicator sticks after a tab close or a network drop.
  const present = new Set(participants.map((p) => p.id));
  sync.prunePeerDragPreviews(present);
  sync.onPresent?.(participants, present);
  // Each peer's tab, seeded from the list and without those who left (seededTabFocus).
  const selfId = sync.self().id;
  sync.setRemoteTabFocus((prev) => seededTabFocus(prev, participants, present, selfId));
  syncRemoteBesideTabs(participants, selfId);
  sync.setRemoteSelections((prev) => pruneMapToPresent(prev, present));
  sync.setRemoteCursors((prev) => pruneMapToPresent(prev, present));
  sync.onPruned?.(present);
  // Same for the lastSeen idle tracker (a plain ref, not state).
  forgetDeparted(sync.lastSeen, present);
}
