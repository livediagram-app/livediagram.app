// The room's catch-up log (docs/specs/012-collaboration/realtime-conflict-resolution.md, Level 1; docs/specs/026-plan/
// blueprints/item-store.md "Catch-up log cap", Work Tracker 1231): the recent mutation ops a reconnecting client
// replays. It lives in memory (like opRates) and resets on hibernation, which only ever forces the safe path (a
// resync), never data loss. It is capped twice, oldest ops dropped first:
//
//   - by count, so an idle-but-connected room can't grow it without end;
//   - by size, so a burst of large card writes (split parts of up to 1 MiB each) can't hold 256 MiB in the object.
//
// The size cap is four frames: a dropped op means the ops after it pass the cap, so an unscoped catch-up that would
// reach it already passes ROOM_FRAME_MAX_BYTES and resyncs anyway; the headroom serves a tab-scoped session, whose
// catch-up carries only its own tab's ops.
import { ROOM_FRAME_MAX_BYTES } from '@liveplanner/api-schema';
import type { LoggedOp } from '../project-room-rules';

export const OP_LOG_LIMIT = 256;
export const OP_LOG_MAX_BYTES = 4 * ROOM_FRAME_MAX_BYTES;

// Each entry's size, and each log's running total, kept beside the log so the entries that go out in a catch-up
// frame carry nothing extra. Keyed by object, so a log replaced whole (a purge, a test seeding one) starts afresh.
const sizes = new WeakMap<LoggedOp, number>();
const totals = new WeakMap<LoggedOp[], number>();

// An entry's size: what it was logged with, else its op's JSON length (an entry put in the log some other way).
export const opLogEntrySize = (entry: LoggedOp): number =>
  sizes.get(entry) ?? (JSON.stringify(entry.op) ?? '').length;

// The log's size, summed once for a log this module has not seen and then kept.
export function opLogSize(log: LoggedOp[]): number {
  let total = totals.get(log);
  if (total === undefined) {
    total = log.reduce((sum, entry) => sum + opLogEntrySize(entry), 0);
    totals.set(log, total);
  }
  return total;
}

// Append `entry`, whose size is `size` (the length of the op frame's JSON the room already made to relay it, a floor
// on its UTF-8 bytes), then drop the oldest entries until the log is within both caps. An op larger than the whole
// size cap is dropped too: the log stays empty past it, and a client behind it resyncs.
export function appendToOpLog(
  log: LoggedOp[],
  entry: LoggedOp,
  size: number,
  limits: { ops: number; bytes: number } = { ops: OP_LOG_LIMIT, bytes: OP_LOG_MAX_BYTES },
): void {
  let total = opLogSize(log) + size;
  sizes.set(entry, size);
  log.push(entry);
  while (log.length > 0 && (log.length > limits.ops || total > limits.bytes))
    total -= opLogEntrySize(log.shift()!);
  totals.set(log, total);
}
