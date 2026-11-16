// Snapshots over REST, answered inside the item's Durable Object (liveworkspace/docs/specs/013-snapshots/snapshots.md
// "API", "Revert"; blueprint SN10 to SN15, SN18):
//   GET    …/snapshots                     the list, newest first
//   POST   …/snapshots                     Take Snapshot
//   DELETE …/snapshots/<snapshotId>        delete one
//   POST   …/snapshots/<snapshotId>/revert revert to one, after an automatic snapshot of the item as it is
// Each app's in-room router hands every request about one item to `serveSnapshots`, with its door (its export and its
// content replace) and its caller (its edit gate): the snapshot routes answer here, every other write meets the fence,
// and every answer carries the item's generation.

import { fenceStaleWrite, requestGeneration, stampGeneration } from './fence';
import { SNAPSHOTS_KEPT, SNAPSHOT_NAME_MAX } from './limits';
import {
  advanceGeneration,
  deleteSnapshot,
  listSnapshots,
  readGeneration,
  readSnapshotText,
  takeSnapshot,
  getSnapshot,
  type SnapshotDb,
} from './store';
import type {
  SnapshotAuthor,
  SnapshotError,
  SnapshotErrorCode,
  SnapshotListResponse,
  SnapshotRevertResponse,
  SnapshotTakeResponse,
} from './wire';

/** What an app does for snapshots: its own export file, and its content replaced from one. */
export type SnapshotDoor = {
  /** The item as its export file now; null for an item never started. */
  exportFile: () => Promise<string | null>;
  /** The item's content replaced in place from a file this door exported. */
  replaceContent: (text: string) => Promise<'ok' | 'invalid' | 'too_large'>;
  /** After a revert: the room ends every session (the close code) and forgets its ledger. */
  afterRevert?: (generation: number) => void;
};

/** Who is asking, as the app's gate judged it (SN11). */
export type SnapshotCaller = {
  /** An API token (agents, MCP, CLI): refused whatever its role. */
  token: boolean;
  /** An Editor of the whole item. */
  mayUse: boolean;
  person: SnapshotAuthor | null;
};

export type ServeSnapshots = {
  db: SnapshotDb;
  itemId: string;
  request: Request;
  /** The path after `/api/<items>/<itemId>/`, split; null when the request is not about this item. */
  rest: readonly string[] | null;
  caller: () => Promise<SnapshotCaller>;
  door: () => SnapshotDoor;
  /** The app's own handlers, for every request that is not a snapshot route. */
  handle: () => Promise<Response>;
};

function json(body: unknown, status = 200, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...extra },
  });
}

const MESSAGES: Record<SnapshotErrorCode, string> = {
  snapshots_need_a_person: 'Snapshots are taken and reverted by people, not tokens.',
  not_found: 'Not found.',
  snapshot_too_large: 'This is too large to snapshot.',
  snapshot_unreadable: 'That snapshot can no longer be read.',
  snapshot_reverted: 'Someone reverted this to a snapshot. Reload to see it.',
  method_not_allowed: 'Method not allowed.',
};

function refusal(error: SnapshotErrorCode, status: number): Response {
  const body: SnapshotError = { error, message: MESSAGES[error] };
  return json(body, status, status === 405 ? { Allow: 'GET, POST, DELETE' } : {});
}

/** SN14: a name as stored: trimmed, at most SNAPSHOT_NAME_MAX code points, null for none. */
export function snapshotName(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const name = [...raw.trim()].slice(0, SNAPSHOT_NAME_MAX).join('').trim();
  return name === '' ? null : name;
}

// SN15: a body that is not a JSON object names nothing.
async function bodyName(request: Request): Promise<string | null> {
  try {
    const parsed: unknown = await request.json();
    return parsed && typeof parsed === 'object'
      ? snapshotName((parsed as { name?: unknown }).name)
      : null;
  } catch {
    return null;
  }
}

/** The automatic snapshot's name (SN12). */
export function beforeRevertName(target: string | null): string {
  const name = target ? `Before reverting to "${target}"` : 'Before reverting';
  return [...name].slice(0, SNAPSHOT_NAME_MAX).join('');
}

/** SN18: the snapshot routes, the fence, the app's handlers, and the generation on every answer. */
export async function serveSnapshots(opts: ServeSnapshots): Promise<Response> {
  if (opts.rest === null) return opts.handle();
  if (opts.rest[0] === 'snapshots') {
    const answer = await answerSnapshotRoute(opts);
    return stampGeneration(answer, await readGeneration(opts.db, opts.itemId));
  }
  // The generation is read only for a write that names one (the fence), and for an answer that succeeded (the stamp):
  // a refusal teaches the editor nothing, and a path the app does not serve never reaches the item's store.
  if (requestGeneration(opts.request) !== null) {
    const fenced = fenceStaleWrite(opts.request, await readGeneration(opts.db, opts.itemId));
    if (fenced) return fenced;
  }
  const response = await opts.handle();
  if (response.status >= 400 || response.status === 101) return response;
  return stampGeneration(response, await readGeneration(opts.db, opts.itemId));
}

type Route =
  | { kind: 'list' }
  | { kind: 'take' }
  | { kind: 'delete'; id: string }
  | { kind: 'revert'; id: string };

// SN10: which route, `null` for none, 'method' for a known path asked with the wrong method.
function routeOf(rest: readonly string[], method: string): Route | null | 'method' {
  if (rest.length === 1) {
    if (method === 'GET') return { kind: 'list' };
    return method === 'POST' ? { kind: 'take' } : 'method';
  }
  const id = rest[1]!;
  if (rest.length === 2) return method === 'DELETE' ? { kind: 'delete', id } : 'method';
  if (rest.length === 3 && rest[2] === 'revert') {
    return method === 'POST' ? { kind: 'revert', id } : 'method';
  }
  return null;
}

/** SN10 to SN13: one snapshot route. */
export async function answerSnapshotRoute(opts: ServeSnapshots): Promise<Response> {
  const { db, itemId, request } = opts;
  const route = routeOf(opts.rest ?? [], request.method.toUpperCase());
  if (route === null) return refusal('not_found', 404);
  if (route === 'method') return refusal('method_not_allowed', 405);
  const caller = await opts.caller();
  // A token first, before anything is read.
  if (caller.token) {
    console.info('[snapshots] refused', { itemId, reason: 'token' });
    return refusal('snapshots_need_a_person', 403);
  }
  if (!caller.mayUse) {
    console.info('[snapshots] refused', { itemId, reason: 'role' });
    return refusal('not_found', 404);
  }
  if (route.kind === 'list') {
    const body: SnapshotListResponse = {
      snapshots: await listSnapshots(db, itemId),
      kept: SNAPSHOTS_KEPT,
    };
    return json(body);
  }
  const door = opts.door();
  if (route.kind === 'take') {
    const name = await bodyName(request);
    const text = await door.exportFile();
    if (text === null) return refusal('not_found', 404);
    const taken = await takeSnapshot(db, {
      itemId,
      text,
      name,
      kind: 'manual',
      author: caller.person,
    });
    if (!taken.ok) {
      console.warn('[snapshots] refused', { itemId, reason: 'too-large' });
      return refusal('snapshot_too_large', 413);
    }
    console.info('[snapshots] taken', {
      itemId,
      snapshotId: taken.snapshot.id,
      kind: 'manual',
      bytes: taken.snapshot.bytes,
    });
    const body: SnapshotTakeResponse = { snapshot: taken.snapshot };
    return json(body, 201);
  }
  if (route.kind === 'delete') {
    if (!(await deleteSnapshot(db, itemId, route.id))) return refusal('not_found', 404);
    console.info('[snapshots] deleted', { itemId, snapshotId: route.id });
    return new Response(null, { status: 204 });
  }
  return revert(opts, door, caller, route.id);
}

// SN12, SN13: read the target, keep the item as it is (never skipped), replace, advance, tell the room.
async function revert(
  opts: ServeSnapshots,
  door: SnapshotDoor,
  caller: SnapshotCaller,
  snapshotId: string,
): Promise<Response> {
  const { db, itemId } = opts;
  const target = await getSnapshot(db, itemId, snapshotId);
  if (!target) return refusal('not_found', 404);
  const text = await readSnapshotText(db, itemId, snapshotId);
  if (typeof text !== 'string') {
    console.warn('[snapshots] refused', { itemId, snapshotId, reason: 'unreadable' });
    return refusal('snapshot_unreadable', 422);
  }
  const now = await door.exportFile();
  if (now === null) return refusal('not_found', 404);
  const safety = await takeSnapshot(db, {
    itemId,
    text: now,
    name: beforeRevertName(target.name),
    kind: 'before-revert',
    author: caller.person,
  });
  if (!safety.ok) {
    console.warn('[snapshots] refused', { itemId, snapshotId, reason: 'safety-too-large' });
    return refusal('snapshot_too_large', 413);
  }
  const replaced = await door.replaceContent(text);
  if (replaced !== 'ok') {
    console.warn('[snapshots] refused', { itemId, snapshotId, reason: replaced });
    return replaced === 'too_large'
      ? refusal('snapshot_too_large', 413)
      : refusal('snapshot_unreadable', 422);
  }
  const generation = await advanceGeneration(db, itemId);
  door.afterRevert?.(generation);
  console.info('[snapshots] reverted', {
    itemId,
    snapshotId,
    safetySnapshotId: safety.snapshot.id,
    generation,
  });
  const body: SnapshotRevertResponse = {
    reverted: { snapshotId, safetySnapshotId: safety.snapshot.id, generation },
  };
  return json(body);
}
