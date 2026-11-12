import {
  ledgerCommentAuthors,
  mergeLedgerIntoTab,
  type ElementDelta,
  type Tab,
  type TabLedger,
} from '@livedesign/design';
import {
  AGENT_PRESENCE_ACTIVITY_TTL_MS,
  ROOM_RELAY_TIMEOUT_MS,
  ROOM_SELECTIONS_TIMEOUT_MS,
  type ChangesetRoomOp,
  type ComponentRoomOp,
  type RoomOp,
} from '@livedesign/api-schema';
import type { AgentPresenceWrite } from '@liveworkspace/api-kit/room-agent-presence';
import {
  createRoomClient,
  roomMutationInit,
  type RoomSelection,
} from '@liveworkspace/api-kit/room-client';
import type { Env } from './types';

// The worker's calls into a design's realtime room (docs/specs/012-collaboration/collab-race-hardening.md): reading its
// collaboration ledger to merge a save, and handing it a change the api made. The calls live once in
// @liveworkspace/api-kit/room-client; this binds them to the design's room, its `designId` and its `design-meta` op.
const room = createRoomClient<Env, 'designId', Tab, TabLedger>({
  // Every server-stored design has a room (docs/specs/024-agents/agent-changesets.md "Rooms for personal designs"):
  // an agent is a second writer even on a design nobody else can open.
  roomStub: (env, designId) => env.DESIGN_ROOM.get(env.DESIGN_ROOM.idFromName(designId)),
  idKey: 'designId',
  metaKind: 'design-meta',
  relayTimeoutMs: ROOM_RELAY_TIMEOUT_MS,
  selectionsTimeoutMs: ROOM_SELECTIONS_TIMEOUT_MS,
  activityTtlMs: AGENT_PRESENCE_ACTIVITY_TTL_MS,
  mergeLedgerIntoTab,
  ledgerCommentAuthors,
});

export { parseRoomCursor, RoomUnavailableError } from '@liveworkspace/api-kit/room-client';
export type { RoomSelection };

// A room call that gives up after `ms`: the api never waits on a room longer than that.
export const roomFetch: (
  env: Env,
  designId: string,
  path: string,
  init: RequestInit | undefined,
  ms: number,
) => Promise<Response> = room.roomFetch;

// Merge the room's collaboration ledger into a tab a client is saving (collab-race-hardening.md phase 3): the fetch
// runs alongside the save's own reads, and the apply folds in only what the saver had not seen.
export const fetchRoomLedger = room.fetchRoomLedger;
export const applyRoomLedger = room.applyRoomLedger;

// A change the api itself wrote (a view-role visitor's comment), as the `el-delta` an editor's own sends.
export const relayElementDelta: (
  env: Env,
  designId: string,
  tabId: string,
  elementId: string,
  delta: ElementDelta,
) => Promise<boolean> = room.relayElementDelta;

// One changeset into the room's ordered stream (docs/specs/024-agents/agent-changesets.md "The write path" step 7).
export const relayChangeset: (env: Env, designId: string, op: ChangesetRoomOp) => Promise<boolean> =
  room.relayChangeset;

// One main of the component library as a write stored it (docs/specs/009-elements/components.md "Sharing,
// collaboration and storage"), into the room's ordered stream like a changeset: sequenced, kept for catch-up, sent to
// everyone (a tab-scoped session only when its tab is in `tabIds`, room-scope.ts). It never fails the write: the
// library already holds the main, and an editor reads it again on an instance it cannot draw.
export async function relayComponent(
  env: Env,
  designId: string,
  op: ComponentRoomOp,
): Promise<boolean> {
  const fields = { designId, componentId: op.component.id };
  try {
    const res = await roomFetch(
      env,
      designId,
      '/mutation',
      roomMutationInit(op),
      ROOM_RELAY_TIMEOUT_MS,
    );
    if (res.ok) return true;
    console.warn('[components] relay-failed', { ...fields, error: `status ${res.status}` });
  } catch (err) {
    console.warn('[components] relay-failed', { ...fields, error: String(err) });
  }
  return false;
}

// A design an agent renamed, as the design-meta op an editor's own rename sends.
export const relayDesignRename: (
  env: Env,
  designId: string,
  name: string,
  tabs: readonly { id: string; name: string; orderIndex: number; folder?: string }[],
) => Promise<boolean> = room.relayItemRename;

// A tab the api renamed (CS42), as the same tab-meta op an editor's own rename sends.
export const relayTabRename: (
  env: Env,
  designId: string,
  tabId: string,
  name: string,
) => Promise<boolean> = room.relayTabRename;

// An agent's Pages edit (docs/specs/024-agents/pages-for-agents.md "The route"), as the ops an editor's own edit
// sends: a `tab-meta` patch of the pages. Logged under `tag`; answers how many reached the room.
export function relayPages(
  env: Env,
  designId: string,
  ops: readonly RoomOp[],
  tag = '[pages-agent]',
): Promise<number> {
  return room.relayRoomOps(env, designId, ops, tag);
}

// Every selection on the tab (docs/specs/024-agents/agent-changesets.md "Held elements"); null when the room cannot
// answer in time.
export const readRoomSelections = room.readRoomSelections;

// Tell every socket in a design's room that a share link changed: revoked or rescoped
// (docs/specs/013-workspace/tab-scoped-share-links.md).
export const broadcastShareOp = room.broadcastShareOp;

// Agent presence in the room (docs/specs/024-agents/blueprints/agent-presence.md "Room").
type AgentPresenceRoomWrite = AgentPresenceWrite & { designId: string };

export const putAgentPresence: (
  env: Env,
  write: AgentPresenceRoomWrite,
) => Promise<
  { ok: true; expiresAt: number; created: boolean } | { ok: false; error: 'agent_presence_full' }
> = room.putAgentPresence;

export const deleteAgentPresence: (
  env: Env,
  designId: string,
  tokenId: string,
  tabId: string,
) => Promise<boolean> = room.deleteAgentPresence;

// A token's changeset or read refreshes its presence on the tab for the activity window (spec "Presence").
export const refreshAgentPresence: (
  env: Env,
  write: Omit<AgentPresenceRoomWrite, 'mode' | 'status' | 'focus' | 'ttlMs'>,
) => Promise<void> = room.refreshAgentPresence;
