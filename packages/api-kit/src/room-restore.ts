// The operator's restore door (liveworkspace/docs/specs/002-architecture/room-restore.md): a room, or up to 20, back to
// a moment in the last 30 days through the Durable Object's own point-in-time recovery. Both halves live here: the
// room's (prepareRoomRestore, restartRoom), which each product's room classes call from two RPC methods, and the
// Worker's (handleRoomRestore), which each product's api answers `POST /api/internal/restore` with, before identity.
import { SNAPSHOT_REVERTED_CLOSE } from '@liveworkspace/api-schema/room-wire';
import { pooled } from './pooled';
import { readCappedBody } from './request-body';
import { timingSafeEqual } from './timing-safe';

/** How far back Cloudflare keeps a SQLite-backed Durable Object's point-in-time recovery: 30 days. */
export const PITR_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
/** The most rooms one call restores; a longer list is refused, never cut short. */
export const RESTORE_BATCH_MAX = 20;
/** How many rooms of one call are restored at once. */
export const RESTORE_CONCURRENCY = 4;
/** The longest room name the door takes (an item's or a person's id is far shorter). */
export const ROOM_NAME_MAX = 256;
/** The longest bookmark the door takes (Cloudflare's are 4 dash-separated hex runs, under 80 characters). */
export const BOOKMARK_MAX = 128;
/** The largest body the door reads: 20 names of 256 characters with room to spare. */
export const RESTORE_BODY_MAX_BYTES = 16 * 1024;
/** The reason a restoring room restarts with, which its caller's error carries. */
export const ROOM_RESTORE_REASON = 'room-restore';

/** Where a room goes back to: a moment (ms since 1970) or a bookmark an earlier restore answered. */
export type RestoreTarget = { at: number } | { bookmark: string };

/** A room's answer to `restorePrepare`: the bookmark it goes back to, and (unless a dry run) the undo bookmark. */
export interface PreparedRestore {
  bookmark: string;
  undo: string | null;
}

/** The storage calls a restore makes (DurableObjectStorage's own). */
export interface RestorableStorage {
  getBookmarkForTime(timestamp: number): Promise<string>;
  onNextSessionRestoreBookmark(bookmark: string): Promise<string>;
}

/** The two RPC methods every restorable room class has. */
export interface RestorableRoom {
  restorePrepare(target: RestoreTarget, dryRun: boolean): Promise<PreparedRestore>;
  restoreNow(): void | Promise<void>;
}

/** The room's first half: find the bookmark, and unless a dry run ask to start from it next time (the undo back). */
export async function prepareRoomRestore(
  storage: RestorableStorage,
  target: RestoreTarget,
  dryRun: boolean,
): Promise<PreparedRestore> {
  const bookmark = 'at' in target ? await storage.getBookmarkForTime(target.at) : target.bookmark;
  if (dryRun) return { bookmark, undo: null };
  return { bookmark, undo: await storage.onNextSessionRestoreBookmark(bookmark) };
}

/** The reason every session of a restored room is closed with, beside the snapshot revert's code. */
export const ROOM_RESTORED_REASON = 'room-restored';

/** The room's second half: close every session with the snapshot revert's code (4009), so each editor reloads rather
 *  than saves what it held over the restore, then restart from the bookmark. A store with no sessions just restarts.
 *  The caller's call rejects with ROOM_RESTORE_REASON: that is the restart, not a failure (`isRoomRestart`). */
export function restartRoom(ctx: {
  abort(reason?: string): void;
  getWebSockets(): WebSocket[];
}): void {
  for (const ws of ctx.getWebSockets()) {
    try {
      ws.close(SNAPSHOT_REVERTED_CLOSE, ROOM_RESTORED_REASON);
    } catch {
      // Already gone.
    }
  }
  ctx.abort(ROOM_RESTORE_REASON);
}

/** Whether a rejected `restoreNow` is the room restarting as asked (workerd marks the error `durableObjectReset`). */
export function isRoomRestart(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  return (
    (err as { durableObjectReset?: unknown }).durableObjectReset === true ||
    err.message.includes(ROOM_RESTORE_REASON)
  );
}

const PITR_UNAVAILABLE = 'point-in-time recovery';

export interface RoomRestoreDoor {
  /** The Worker's OPERATOR_KEY; unset, the door answers 404 to everyone. */
  key: string | undefined;
  /** The app, for the log. */
  app: string;
  /** The Worker's restorable classes by class name, each reaching a room by its name. */
  rooms: Record<string, (name: string) => RestorableRoom>;
  now?: () => number;
  log?: (message: string, fields: Record<string, unknown>) => void;
}

type RoomOutcome =
  | { name: string; ok: true; bookmark: string; undo: string | null }
  | { name: string; ok: false; error: 'pitr_unavailable' | 'restore_failed'; message: string };

type Ask = { className: string; names: string[]; target: RestoreTarget; dryRun: boolean };

const answer = (status: number, body: Record<string, unknown>): Response =>
  Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
const refuse = (status: number, error: string): Response => answer(status, { error });

/** `POST /api/internal/restore`: the operator's key, then one room (`name`) or up to 20 (`names`) of one class back to
 *  `at` or `bookmark`, or a dry run that changes nothing. */
export async function handleRoomRestore(
  request: Request,
  door: RoomRestoreDoor,
): Promise<Response> {
  const log = door.log ?? ((message, fields) => console.warn(message, JSON.stringify(fields)));
  if (!door.key) return refuse(404, 'not_found');
  const header = request.headers.get('Authorization') ?? '';
  const sent = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!sent || !(await timingSafeEqual(sent, door.key))) {
    log('[room-restore] refused', { app: door.app, bearer: sent.length > 0 });
    return refuse(401, 'unauthorized');
  }
  if (request.method !== 'POST') return refuse(405, 'method_not_allowed');
  const bytes = request.body
    ? await readCappedBody(request.body as ReadableStream<Uint8Array>, RESTORE_BODY_MAX_BYTES)
    : null;
  if (!bytes) return refuse(request.body ? 413 : 400, request.body ? 'too_large' : 'invalid_body');
  const ask = parseAsk(bytes, door, (door.now ?? Date.now)());
  if (typeof ask === 'string') return refuse(400, ask);

  const reach = door.rooms[ask.className]!;
  const outcomes = await pooled(
    ask.names.map((name) => () => restoreOne(reach(name), name, ask)),
    RESTORE_CONCURRENCY,
  );
  for (const o of outcomes)
    log('[room-restore]', {
      app: door.app,
      class: ask.className,
      name: o.name,
      ...ask.target,
      dryRun: ask.dryRun,
      ...(o.ok ? { bookmark: o.bookmark, undo: o.undo } : { error: o.error, message: o.message }),
    });
  const failed = outcomes.find((o) => !o.ok);
  const status = !failed ? 200 : failed.error === 'pitr_unavailable' ? 501 : 502;
  return answer(status, {
    app: door.app,
    class: ask.className,
    dryRun: ask.dryRun,
    rooms: outcomes,
  });
}

async function restoreOne(room: RestorableRoom, name: string, ask: Ask): Promise<RoomOutcome> {
  let prepared: PreparedRestore;
  try {
    prepared = await room.restorePrepare(ask.target, ask.dryRun);
  } catch (err) {
    const message = String(err);
    const error = message.includes(PITR_UNAVAILABLE) ? 'pitr_unavailable' : 'restore_failed';
    return { name, ok: false, error, message };
  }
  if (!ask.dryRun) {
    try {
      await room.restoreNow();
    } catch (err) {
      // Anything but the restart itself: the room is set to start from the bookmark, but has not restarted yet.
      if (!isRoomRestart(err))
        return { name, ok: false, error: 'restore_failed', message: `restart: ${String(err)}` };
    }
  }
  return { name, ok: true, bookmark: prepared.bookmark, undo: prepared.undo };
}

// The body, checked whole: an error code for the 400, or the ask.
function parseAsk(bytes: Uint8Array, door: RoomRestoreDoor, now: number): Ask | string {
  let body: unknown;
  try {
    body = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return 'invalid_body';
  }
  if (typeof body !== 'object' || body === null || Array.isArray(body)) return 'invalid_body';
  const b = body as Record<string, unknown>;
  const className = b.class;
  if (typeof className !== 'string' || !Object.hasOwn(door.rooms, className))
    return 'unknown_class';
  const names = parseNames(b.name, b.names);
  if (typeof names === 'string') return names;
  const target = parseTarget(b.at, b.bookmark, now);
  if (typeof target === 'string') return target;
  if (b.dryRun !== undefined && typeof b.dryRun !== 'boolean') return 'invalid_dry_run';
  return { className, names, target, dryRun: b.dryRun === true };
}

const isName = (v: unknown): v is string =>
  typeof v === 'string' && v.length > 0 && v.length <= ROOM_NAME_MAX;

function parseNames(name: unknown, names: unknown): string[] | string {
  if ((name === undefined) === (names === undefined)) return 'name_or_names';
  if (name !== undefined) return isName(name) ? [name] : 'invalid_name';
  if (!Array.isArray(names) || names.length === 0) return 'invalid_names';
  if (names.length > RESTORE_BATCH_MAX) return 'too_many_rooms';
  if (!names.every(isName)) return 'invalid_name';
  return [...new Set(names)];
}

// Hex runs joined by dashes, checked one character at a time (no pattern to backtrack).
function isBookmark(v: unknown): v is string {
  if (typeof v !== 'string' || v.length === 0 || v.length > BOOKMARK_MAX) return false;
  for (const ch of v) if (!'0123456789abcdefABCDEF-'.includes(ch)) return false;
  return true;
}

function parseTarget(at: unknown, bookmark: unknown, now: number): RestoreTarget | string {
  if ((at === undefined) === (bookmark === undefined)) return 'at_or_bookmark';
  if (bookmark !== undefined) return isBookmark(bookmark) ? { bookmark } : 'invalid_bookmark';
  const ms = typeof at === 'number' ? at : typeof at === 'string' ? Date.parse(at) : Number.NaN;
  if (!Number.isFinite(ms)) return 'invalid_at';
  if (ms > now) return 'at_in_future';
  if (ms < now - PITR_WINDOW_MS) return 'at_too_old';
  return { at: ms };
}
