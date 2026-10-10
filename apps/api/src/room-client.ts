import {
  ledgerCommentAuthors,
  mergeLedgerIntoTab,
  type ElementDelta,
  type Tab,
  type TabLedger,
} from '@livediagram/document';
import {
  AGENT_PRESENCE_TTL_MS,
  ROOM_RELAY_TIMEOUT_MS,
  ROOM_SELECTIONS_TIMEOUT_MS,
  type ChangesetRoomOp,
  type RoomOp,
} from '@livediagram/api-schema';
import type { AgentPresenceWrite } from './room-agent-presence';
import type { ItemsRoomOp, ItemTypesRoomOp, SheetsRoomOp } from '@livediagram/api-schema';
import type { Env } from './types';

// The worker's calls into a document's realtime room (docs/specs/012-collaboration/collab-race-hardening.md): reading its
// collaboration ledger to merge a save, and handing it a change the api made.

// Every server-stored document has a room (docs/specs/024-agents/agent-changesets.md "Rooms for
// personal documents"): an agent is a second writer even on a document nobody else can open.
function roomStubFor(env: Env, documentId: string): DurableObjectStub {
  return env.DOCUMENT_ROOM.get(env.DOCUMENT_ROOM.idFromName(documentId));
}

// A room call that gives up after `ms`: the api never waits on a room longer than that.
export async function roomFetch(
  env: Env,
  documentId: string,
  path: string,
  init: RequestInit | undefined,
  ms: number,
): Promise<Response> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`room timeout after ${ms} ms`)), ms);
  });
  try {
    return await Promise.race([
      roomStubFor(env, documentId).fetch(`https://room${path}`, init),
      timeout,
    ]);
  } finally {
    clearTimeout(timer);
  }
}

// `ordered` asks the room to sequence the op into its catch-up log, so a peer whose socket blipped
// still receives it (the item store's ops).
function mutationInit(op: unknown, ordered = false): RequestInit {
  return {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(ordered ? { op, ordered: true } : { op }),
  };
}

// Send one op to every socket in a document's room. Best-effort: the D1 write before it is the
// authoritative change, so a room that can't be reached is logged as `[room-broadcast] <label> did
// not reach the room` rather than failing the request.
async function broadcastOp(
  env: Env,
  documentId: string,
  op: unknown,
  label: string,
  ordered = false,
): Promise<void> {
  try {
    await roomStubFor(env, documentId).fetch('https://room/broadcast', mutationInit(op, ordered));
  } catch (err) {
    console.warn(`[room-broadcast] ${label} did not reach the room`, documentId, err);
  }
}

// Merge the room's collaboration ledger into a tab a client is saving
// (docs/specs/012-collaboration/collab-race-hardening.md phase 3).
//
// Every client PUTs whole tabs and D1 keeps the last one, so a save
// snapshotted before somebody's answer, idea, tick or dot reached that client
// erased it from D1. The room saw every one of them in order and keeps the
// latest state of each; folding that into the save means the write holds what
// the room holds.
//
// Only what the saver had NOT seen is merged: the client sends the room
// cursor its snapshot was taken at (`X-Room-Cursor: <epoch>:<seq>`), and a
// save without one (no live socket, the unload beacon) isn't merged at all.
// That is what keeps a change the saver made while its socket was down from
// being overruled by the room's older copy of it.
//
// Best-effort by design: if the room can't answer, the save goes through as
// the client sent it.
//
// Also returns who posted each comment the room has seen, so the save can
// credit a comment that is new to D1 to its author rather than to the saver.
export type RoomMerge = {
  tab: Tab;
  commentAuthors: Map<string, { authorName: string; authorColor: string }>;
};

export async function mergeRoomLedger(
  env: Env,
  documentId: string,
  tab: Tab,
  cursorHeader: string | null,
): Promise<RoomMerge> {
  const unmerged: RoomMerge = { tab, commentAuthors: new Map() };
  const cursor = parseRoomCursor(cursorHeader);
  if (!cursor) return unmerged;
  try {
    const query = `tab=${encodeURIComponent(tab.id)}&epoch=${encodeURIComponent(cursor.epoch)}`;
    const res = await roomStubFor(env, documentId).fetch(`https://room/ledger?${query}`);
    if (!res.ok) return unmerged;
    const ledger = (await res.json()) as TabLedger;
    if (!ledger || typeof ledger !== 'object' || !ledger.elements) return unmerged;
    return {
      tab: mergeLedgerIntoTab(tab, ledger, cursor.seq),
      commentAuthors: ledgerCommentAuthors(ledger),
    };
  } catch {
    return unmerged;
  }
}

// `<epoch>:<seq>`, as the editor sends it. Null for anything else.
export function parseRoomCursor(header: string | null): { epoch: string; seq: number } | null {
  if (!header) return null;
  const cut = header.lastIndexOf(':');
  if (cut <= 0) return null;
  const epoch = header.slice(0, cut);
  const seq = Number(header.slice(cut + 1));
  if (epoch.length > 100 || !Number.isInteger(seq) || seq < 0) return null;
  return { epoch, seq };
}

// Hand the document's realtime room a change the api itself just wrote, so
// everyone connected sees it (docs/specs/012-collaboration/collab-race-hardening.md).
//
// The one case today is a view-role visitor's comment. The room refuses
// mutations from a view-role socket, so the visitor writes through the
// comment endpoints instead; before this, the comment reached D1 but no
// editor's screen, and the next editor save (built from a thread without it)
// erased it. Relayed as the same `el-delta` an editor's own comment sends, so
// receivers need nothing new.
//
// Best-effort, like the share-revoked broadcast: the D1 write is the record,
// this is the live copy; a relay the room refused or never received is logged.
export async function relayElementDelta(
  env: Env,
  documentId: string,
  tabId: string,
  elementId: string,
  delta: ElementDelta,
): Promise<boolean> {
  // The comment is saved either way; a room that did not hear about it is logged (PR26).
  const fields = { documentId, tabId, delta: delta.kind };
  try {
    const res = await roomFetch(
      env,
      documentId,
      '/mutation',
      mutationInit({ kind: 'el-delta', tabId, elementId, delta }),
      ROOM_RELAY_TIMEOUT_MS,
    );
    if (res.ok) return true;
    console.warn('[room-mutation] el-delta did not reach the room', {
      ...fields,
      error: `status ${res.status}`,
    });
  } catch (err) {
    console.warn('[room-mutation] el-delta did not reach the room', {
      ...fields,
      error: String(err),
    });
  }
  return false;
}

// One changeset into the room's ordered stream (docs/specs/024-agents/agent-changesets.md "The
// write path" step 7): sequenced in one log slot and sent to everyone. It never fails the write:
// D1 already holds the changeset and the merge on save keeps it there, so a room that refuses or
// cannot be reached within ROOM_RELAY_TIMEOUT_MS is logged and answers false.
export async function relayChangeset(
  env: Env,
  documentId: string,
  op: ChangesetRoomOp,
): Promise<boolean> {
  const fields = { documentId, tabId: op.tabId, changesetId: op.id };
  try {
    const res = await roomFetch(
      env,
      documentId,
      '/mutation',
      mutationInit(op),
      ROOM_RELAY_TIMEOUT_MS,
    );
    if (res.ok) return true;
    console.warn('[changeset] relay-failed', { ...fields, error: `status ${res.status}` });
  } catch (err) {
    console.warn('[changeset] relay-failed', { ...fields, error: String(err) });
  }
  return false;
}

// A document an agent renamed, as the document-meta op an editor's own rename sends: open editors show the new name
// at once, and their next tab reorder carries it instead of writing the old one back. Best-effort and logged, like
// the tab rename relay.
export async function relayDocumentRename(
  env: Env,
  documentId: string,
  name: string,
  tabs: readonly { id: string; name: string; orderIndex: number; folder?: string }[],
): Promise<boolean> {
  const op: RoomOp = {
    kind: 'document-meta',
    name,
    tabs: tabs.map((t) => ({
      id: t.id,
      name: t.name,
      orderIndex: t.orderIndex,
      ...(t.folder ? { folder: t.folder } : {}),
    })),
  };
  try {
    const res = await roomFetch(
      env,
      documentId,
      '/mutation',
      mutationInit(op),
      ROOM_RELAY_TIMEOUT_MS,
    );
    if (res.ok) return true;
    console.warn('[room-mutation] document-meta did not reach the room', {
      documentId,
      error: `status ${res.status}`,
    });
  } catch (err) {
    console.warn('[room-mutation] document-meta did not reach the room', {
      documentId,
      error: String(err),
    });
  }
  return false;
}

// A tab the api renamed (CS42), as the same tab-meta op an editor's own rename sends: a
// document-meta keeps every open editor's names, so a stale tab list can never revert a rename.
// Best-effort and logged, like the changeset relay.
export async function relayTabRename(
  env: Env,
  documentId: string,
  tabId: string,
  name: string,
): Promise<boolean> {
  const op: RoomOp = { kind: 'tab-meta', tabId, patch: { name } };
  try {
    const res = await roomFetch(
      env,
      documentId,
      '/mutation',
      mutationInit(op),
      ROOM_RELAY_TIMEOUT_MS,
    );
    if (res.ok) return true;
    console.warn('[room-mutation] tab-meta did not reach the room', {
      documentId,
      error: `status ${res.status}`,
    });
  } catch (err) {
    console.warn('[room-mutation] tab-meta did not reach the room', {
      documentId,
      error: String(err),
    });
  }
  return false;
}

// An agent's Illustrate edit (docs/specs/024-agents/illustrate-for-agents.md "The route"), as the ops an
// editor's own edit sends: a `tab-meta` patch of the pages and mode, then each article's frames, in
// order. Best-effort and logged, like the tab rename relay; answers how many reached the room.
export async function relayIllustrate(
  env: Env,
  documentId: string,
  ops: readonly RoomOp[],
): Promise<number> {
  let reached = 0;
  for (const op of ops) {
    try {
      const res = await roomFetch(
        env,
        documentId,
        '/mutation',
        mutationInit(op),
        ROOM_RELAY_TIMEOUT_MS,
      );
      if (res.ok) {
        reached += 1;
        continue;
      }
      console.warn('[illustrate-agent] relay-missed', {
        documentId,
        op: op.kind,
        error: `status ${res.status}`,
      });
    } catch (err) {
      console.warn('[illustrate-agent] relay-missed', {
        documentId,
        op: op.kind,
        error: String(err),
      });
    }
  }
  return reached;
}

// One open editor's selection on a tab, as the room answers it: every selected id, the session's
// name and colour, and whether it is the agent owner's own session (matched by person tag).
export type RoomSelection = { elementIds: string[]; name: string; color: string; mine: boolean };

// Every selection on the tab (docs/specs/024-agents/agent-changesets.md "Held elements"). Null
// when the room cannot answer within ROOM_SELECTIONS_TIMEOUT_MS: then nothing counts as held, and
// the warning, under the reader's own fingerprint, says so.
export async function readRoomSelections(
  env: Env,
  documentId: string,
  tabId: string,
  personTag: string | null,
  reader: 'changeset' | 'views' = 'changeset',
): Promise<RoomSelection[] | null> {
  const query = `tab=${encodeURIComponent(tabId)}&person=${encodeURIComponent(personTag ?? '')}`;
  try {
    const res = await roomFetch(
      env,
      documentId,
      `/selections?${query}`,
      undefined,
      ROOM_SELECTIONS_TIMEOUT_MS,
    );
    if (!res.ok) throw new Error(`status ${res.status}`);
    const body = (await res.json()) as { selections?: unknown };
    if (!Array.isArray(body.selections)) throw new Error('no selections');
    return body.selections as RoomSelection[];
  } catch (err) {
    console.warn(`[${reader}] selections-unreachable`, { documentId, tabId, error: String(err) });
    return null;
  }
}

// Tell every socket in a document's room that a share link changed: revoked
// (its holders leave the editor) or rescoped (they reload into the new scope,
// docs/specs/013-workspace/tab-scoped-share-links.md). The room also closes those sockets. Best-effort: the
// D1 write before it is the authoritative change, so a room that can't be
// reached is logged rather than failing the request.
export async function broadcastShareOp(
  env: Env,
  documentId: string,
  op: { kind: 'share-revoked' | 'share-rescoped'; code: string },
): Promise<void> {
  await broadcastOp(env, documentId, op, op.kind);
}

// Tell a document's realtime room that the document was moved to the Trash
// (docs/specs/013-workspace/trash.md): every open session hears the deleted
// state, and the room closes every socket. Best-effort like the share-op
// broadcast: the D1 write is the change, and a session the room misses still
// has every save refused with document_trashed.
export async function broadcastDocumentTrashed(env: Env, documentId: string): Promise<void> {
  await broadcastOp(env, documentId, { kind: 'document-trashed' }, 'document-trashed');
}

// Agent presence in the room (docs/specs/024-agents/blueprints/agent-presence.md "Room"). The room is its only store,
// so a set or clear that cannot reach it throws `RoomUnavailableError` (the route answers 503, PR11).
export const ROOM_AGENT_PRESENCE_TIMEOUT_MS = 3_000;

export class RoomUnavailableError extends Error {
  constructor(cause: unknown) {
    super(`room unavailable: ${String(cause)}`);
    this.name = 'RoomUnavailableError';
  }
}

export type AgentPresenceRoomWrite = AgentPresenceWrite & { documentId: string };

export async function putAgentPresence(
  env: Env,
  write: AgentPresenceRoomWrite,
): Promise<
  { ok: true; expiresAt: number; created: boolean } | { ok: false; error: 'agent_presence_full' }
> {
  const { documentId, ...body } = write;
  let res: Response;
  try {
    res = await roomFetch(
      env,
      documentId,
      '/presence',
      { method: 'PUT', body: JSON.stringify(body) },
      ROOM_AGENT_PRESENCE_TIMEOUT_MS,
    );
  } catch (err) {
    throw new RoomUnavailableError(err);
  }
  if (res.status === 409) return { ok: false, error: 'agent_presence_full' };
  if (!res.ok) throw new RoomUnavailableError(`status ${res.status}`);
  const answer = (await res.json()) as { expiresAt: number; created: boolean };
  return { ok: true, expiresAt: answer.expiresAt, created: answer.created };
}

export async function deleteAgentPresence(
  env: Env,
  documentId: string,
  tokenId: string,
  tabId: string,
): Promise<boolean> {
  const query = `token=${encodeURIComponent(tokenId)}&tab=${encodeURIComponent(tabId)}`;
  let res: Response;
  try {
    res = await roomFetch(
      env,
      documentId,
      `/presence?${query}`,
      { method: 'DELETE' },
      ROOM_AGENT_PRESENCE_TIMEOUT_MS,
    );
  } catch (err) {
    throw new RoomUnavailableError(err);
  }
  if (!res.ok) throw new RoomUnavailableError(`status ${res.status}`);
  return ((await res.json()) as { cleared: boolean }).cleared;
}

// A token's changeset refreshes its presence on the tab (spec "Presence"); a refresh that fails is logged and the
// changeset stands (E7).
export async function refreshAgentPresence(
  env: Env,
  write: Omit<AgentPresenceRoomWrite, 'mode' | 'status' | 'focus' | 'ttlMs'>,
): Promise<void> {
  try {
    const answer = await putAgentPresence(env, {
      ...write,
      status: null,
      focus: [],
      ttlMs: AGENT_PRESENCE_TTL_MS,
      mode: 'refresh',
    });
    if (!answer.ok)
      console.warn('[agent-presence] refresh refused', {
        documentId: write.documentId,
        tabId: write.tabId,
        error: answer.error,
      });
  } catch (err) {
    console.warn('[agent-presence] refresh failed', {
      documentId: write.documentId,
      tabId: write.tabId,
      error: String(err),
    });
  }
}

// A stored type catalogue (docs/specs/026-plan/item-types.md "Storage and sync"): ordered like items,
// to every session, a tab-scoped one too (a catalogue holds no content).
export async function relayItemTypes(
  env: Env,
  documentId: string,
  op: ItemTypesRoomOp,
): Promise<void> {
  await broadcastOp(env, documentId, op, 'item types', true);
}

// Tell a document's room about item writes (docs/specs/026-plan/items.md "Live for everyone"): an
// ordered system op, so a peer whose socket blipped catches it up. Best-effort like the other
// broadcasts: the D1 write is the change, and a client that missed it refetches on a rev gap.
export async function relayItems(env: Env, documentId: string, op: ItemsRoomOp): Promise<void> {
  await broadcastOp(env, documentId, op, 'items', true);
}

// A sheet write the api made (docs/specs/029-sheets/sheet-store.md "Live for everyone"), ordered like items.
export async function relaySheets(env: Env, documentId: string, op: SheetsRoomOp): Promise<void> {
  await broadcastOp(env, documentId, op, 'sheets', true);
}
