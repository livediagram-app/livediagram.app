// A Space that is a call about an item (docs/specs/012-collaboration/calls-from-items.md, blueprint; the index's
// liveworkspace/docs/specs/004-index/item-calls.md "Joining"): the room keeps the call's id, and tells the index who
// is in the Space whenever that settles, so the item's open editors show "3 in Call". Ids stay here: the index gets a
// count and the names people show, never who they are. One push a settle (ITEM_CALL_SETTLE_MS), none when nothing
// moved, and nothing at all in a Space that is no call.

import { ITEM_CALL_SETTLE_MS, callNames } from '@liveworkspace/index-client';
import { indexAppClient } from '../index-service';
import type { DocumentRoom } from './document-room';

const KEY = 'item-call';

type CallState = {
  // The call's id, once read: null for a Space that is no call.
  callId: string | null;
  read: boolean;
  timer: ReturnType<typeof setTimeout> | null;
  // The count and names last told, so a settle that changed nothing tells nobody.
  told: string | null;
};

const states = new WeakMap<DocumentRoom, CallState>();

function stateOf(room: DocumentRoom): CallState {
  let state = states.get(room);
  if (!state) {
    state = { callId: null, read: false, timer: null, told: null };
    states.set(room, state);
  }
  return state;
}

/** The index made this Space a call: keep the id, then tell who is here now. */
export async function markItemCall(
  room: DocumentRoom,
  documentId: string,
  callId: string,
): Promise<void> {
  room.bindDocument(documentId);
  await room.state.storage.put(KEY, callId);
  const state = stateOf(room);
  state.callId = callId;
  state.read = true;
  state.told = null;
  noteItemCall(room);
}

/** Who is in the Space now, `leaving` left out: each person once, by their presence key, with the name they show. */
export function peopleHere(
  room: DocumentRoom,
  leaving: WebSocket | null = null,
): { people: number; names: string[] } {
  const keys = new Set<string>();
  const names: string[] = [];
  for (const ws of room.state.getWebSockets()) {
    // A socket closing (2) or closed (3) has left, whenever the runtime prunes it.
    if (ws === leaving || ws.readyState === 2 || ws.readyState === 3) continue;
    const session = room.readSession(ws);
    const presence = session?.presence;
    if (!presence?.key || keys.has(presence.key)) continue;
    keys.add(presence.key);
    names.push(session?.verifiedName ?? presence.name);
  }
  return { people: keys.size, names: callNames(names) };
}

async function tell(room: DocumentRoom, state: CallState): Promise<void> {
  if (!state.read) {
    state.callId = (await room.state.storage.get<string>(KEY)) ?? null;
    state.read = true;
  }
  if (!state.callId || !room.documentId || !room.roomEnv) return;
  const now = peopleHere(room);
  const said = JSON.stringify(now);
  if (said === state.told) return;
  const client = indexAppClient(room.roomEnv);
  if (!client) return;
  try {
    await client.callPeople(room.documentId, now);
    state.told = said;
  } catch (err) {
    // The next join or leave tells it again.
    console.warn('[room] call people not told', { error: String(err) });
  }
}

/** Someone joined or left: tell the index once it settles. Cheap on a Space that is no call: one storage read ever. */
export function noteItemCall(room: DocumentRoom): void {
  const state = stateOf(room);
  if (state.read && !state.callId) return;
  if (state.timer) return;
  state.timer = setTimeout(() => {
    state.timer = null;
    void tell(room, state);
  }, ITEM_CALL_SETTLE_MS);
}

export function clearItemCallForTests(room: DocumentRoom): void {
  const state = states.get(room);
  if (state?.timer) clearTimeout(state.timer);
  states.delete(room);
}
