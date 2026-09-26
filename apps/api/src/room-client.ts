import {
  ledgerCommentAuthors,
  mergeLedgerIntoTab,
  type ElementDelta,
  type Tab,
  type TabLedger,
} from '@livediagram/diagram';
import type { Env } from './types';

// The worker's calls into a diagram's realtime room (docs/specs/012-collaboration/collab-race-hardening.md): reading its
// collaboration ledger to merge a save, and handing it a change the api made.

// A diagram has a room when it is shared or in a team; anything else has one
// writer, and asking would wake a Durable Object for nothing. Null then.
function roomStubFor(
  env: Env,
  diagram: { id: string; shareable: boolean; teamId: string | null },
): DurableObjectStub | null {
  if (!diagram.shareable && !diagram.teamId) return null;
  return env.DIAGRAM_ROOM.get(env.DIAGRAM_ROOM.idFromName(diagram.id));
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
// save without one (no live socket, the unload beacon, an api token) isn't
// merged at all. That is what keeps a change the saver made while its socket
// was down from being overruled by the room's older copy of it.
//
// Only for a diagram with a room (see roomStubFor). Best-effort by design: if the room can't answer, the
// save goes through as the client sent it, which is what happened before.
//
// Also returns who posted each comment the room has seen, so the save can
// credit a comment that is new to D1 to its author rather than to the saver.
export type RoomMerge = {
  tab: Tab;
  commentAuthors: Map<string, { authorName: string; authorColor: string }>;
};

export async function mergeRoomLedger(
  env: Env,
  diagram: { id: string; shareable: boolean; teamId: string | null },
  tab: Tab,
  cursorHeader: string | null,
): Promise<RoomMerge> {
  const unmerged: RoomMerge = { tab, commentAuthors: new Map() };
  const stub = roomStubFor(env, diagram);
  const cursor = parseRoomCursor(cursorHeader);
  if (!stub || !cursor) return unmerged;
  try {
    const query = `tab=${encodeURIComponent(tab.id)}&epoch=${encodeURIComponent(cursor.epoch)}`;
    const res = await stub.fetch(`https://room/ledger?${query}`);
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

// Hand the diagram's realtime room a change the api itself just wrote, so
// everyone connected sees it (docs/specs/012-collaboration/collab-race-hardening.md).
//
// The one case today is a view-role visitor's comment. The room refuses
// mutations from a view-role socket, so the visitor writes through the
// comment endpoints instead; before this, the comment reached D1 but no
// editor's screen, and the next editor save (built from a thread without it)
// erased it. Relayed as the same `el-delta` an editor's own comment sends, so
// receivers need nothing new.
//
// Only for a diagram with a room. Best-effort, like the share-revoked
// broadcast: the D1 write is the record, this is the live copy.
export async function relayElementDelta(
  env: Env,
  diagram: { id: string; shareable: boolean; teamId: string | null },
  tabId: string,
  elementId: string,
  delta: ElementDelta,
): Promise<void> {
  const stub = roomStubFor(env, diagram);
  if (!stub) return;
  try {
    await stub.fetch('https://room/mutation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ op: { kind: 'el-delta', tabId, elementId, delta } }),
    });
  } catch {
    // The comment is saved; the room just didn't hear about it.
  }
}
