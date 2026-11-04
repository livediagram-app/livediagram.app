// A big room hears its talkers (docs/specs/012-collaboration/meeting-rooms-and-stage.md "Rooms are calls", "Cost";
// Work Tracker #482): in a room where you would hear more than BIG_ROOM_AFTER people, you receive the nearest few and
// whoever talked lately, rather than everyone, so a full Coworking floor costs about what the same people in the open
// would. Pure: the call hands it the people heard and when each last talked.
import { distance, togetherWith, type Point } from './hearing';
import type { CallZoning } from './zones';

/** A room where you would hear more than this many people is a big room. */
export const BIG_ROOM_AFTER = 8;
/** In a big room, the nearest this many are always received. */
export const NEAREST_IN_ROOM = 3;
/** One of them stays received until this many others are nearer, so walking past nobody flickers. */
export const NEAREST_RELEASE = NEAREST_IN_ROOM + 2;
/** Anyone who talked within this long is received. */
export const RECENT_TALK_MS = 30_000;
/** At most this many of them: the ones who talked last. */
export const MAX_ROOM_TALKERS = 8;

export type BigRoomInput = {
  heard: ReadonlySet<string>;
  prev: ReadonlySet<string>;
  self: Point | null;
  walkers: ReadonlyMap<string, Point>;
  zoning: CallZoning | undefined;
  // When a peer last talked (performance.now ms), or undefined for never.
  talkedAt: (id: string) => number | undefined;
  now: number;
};

/**
 * The people received: `heard` itself unless you share a big room, else everyone heard outside it (the open, a
 * stage) and, of the room, the nearest NEAREST_IN_ROOM (one already received stays within NEAREST_RELEASE) and the
 * MAX_ROOM_TALKERS who talked last within RECENT_TALK_MS. Answers `prev` itself when nothing changed.
 */
export function capBigRoom(input: BigRoomInput): ReadonlySet<string> {
  const { heard, prev, self, walkers, zoning } = input;
  const room: { id: string; d: number }[] = [];
  for (const id of heard) {
    const at = walkers.get(id);
    if (at && self && togetherWith(id, zoning) === 'room') room.push({ id, d: distance(self, at) });
  }
  if (room.length <= BIG_ROOM_AFTER) return heard;
  const keep = new Set<string>();
  for (const id of heard) if (!room.some((r) => r.id === id)) keep.add(id);
  room.sort((a, b) => a.d - b.d || (a.id < b.id ? -1 : 1));
  room.forEach((r, rank) => {
    if (rank < NEAREST_IN_ROOM || (rank < NEAREST_RELEASE && prev.has(r.id))) keep.add(r.id);
  });
  const talkers = room
    .map((r) => ({ id: r.id, at: input.talkedAt(r.id) }))
    .filter((t): t is { id: string; at: number } => t.at !== undefined)
    .filter((t) => input.now - t.at <= RECENT_TALK_MS)
    .sort((a, b) => b.at - a.at)
    .slice(0, MAX_ROOM_TALKERS);
  for (const t of talkers) keep.add(t.id);
  if (keep.size === prev.size && [...keep].every((id) => prev.has(id))) return prev;
  return keep;
}
