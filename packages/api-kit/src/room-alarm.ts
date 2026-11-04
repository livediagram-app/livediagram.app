// A Durable Object's one alarm, re-armed from times it worked out (liveworkspace/docs/specs/002-architecture/
// architecture.md "A Durable Object's alarm"). A time already due, or stuck in the past by a bug, would fire the alarm
// back to back, about 20 times a second; floored, the worst is one a second.

/** The soonest a re-armed alarm goes: a second from now. Every wait it can add to is seconds or more already. */
export const ROOM_ALARM_FLOOR_MS = 1_000;

/** When to set an alarm for `due`: then, but never sooner than ROOM_ALARM_FLOOR_MS from `now`. */
export const roomAlarmAt = (due: number, now: number): number =>
  Math.max(due, now + ROOM_ALARM_FLOOR_MS);

/** The two calls of a Durable Object's storage the alarm needs. */
export type RoomAlarmStorage = {
  setAlarm(at: number): Promise<void>;
  deleteAlarm(): Promise<void>;
};

// The time each storage's alarm was last set to (null: deleted), while the object is in memory. A woken object has
// a new storage object, so it starts unknown and its first arm writes.
const armed = new WeakMap<RoomAlarmStorage, number | null>();

/**
 * Set the room's alarm at the earliest of `due` (nulls are nothing due), floored by roomAlarmAt, or delete it when
 * nothing is due. An alarm already set to the same time still ahead, or already deleted, costs no storage write.
 * Answers the time set, or null.
 */
export function armRoomAlarm(
  storage: RoomAlarmStorage,
  due: readonly (number | null)[],
  now: number,
): number | null {
  const times = due.filter((t): t is number => t !== null);
  const next = times.length === 0 ? null : roomAlarmAt(Math.min(...times), now);
  // `next` is always ahead of now, so it never equals a time set earlier that has since come due and fired.
  if (armed.has(storage) && armed.get(storage) === next) return next;
  armed.set(storage, next);
  if (next === null) void storage.deleteAlarm();
  else void storage.setAlarm(next);
  return next;
}
