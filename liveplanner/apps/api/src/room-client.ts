import {
  ledgerCommentAuthors,
  mergeLedgerIntoTab,
  type ElementDelta,
  type Tab,
  type TabLedger,
} from '@liveplanner/project';
import {
  AGENT_PRESENCE_ACTIVITY_TTL_MS,
  ROOM_RELAY_TIMEOUT_MS,
  ROOM_SELECTIONS_TIMEOUT_MS,
  type ChangesetRoomOp,
  type RoomOp,
} from '@liveplanner/api-schema';
import type {
  CardThreadsRoomOp,
  ItemsRoomOp,
  ItemTypesRoomOp,
  PullRequestsRoomOp,
  SheetsRoomOp,
} from '@liveplanner/api-schema';
import type { AgentPresenceWrite } from '@liveworkspace/api-kit/room-agent-presence';
import { createRoomClient, type RoomSelection } from '@liveworkspace/api-kit/room-client';
import type { Env } from './types';

// The worker's calls into a project's realtime room (docs/specs/012-collaboration/collab-race-hardening.md): reading its
// collaboration ledger to merge a save, and handing it a change the api made. The calls live once in
// @liveworkspace/api-kit/room-client; this binds them to the project's room, its `projectId` and its `project-meta` op.
const room = createRoomClient<Env, 'projectId', Tab, TabLedger>({
  // Every server-stored project has a room (docs/specs/024-agents/agent-changesets.md "Rooms for personal projects"):
  // an agent is a second writer even on a project nobody else can open.
  roomStub: (env, projectId) => env.PLAN_ROOM.get(env.PLAN_ROOM.idFromName(projectId)),
  idKey: 'projectId',
  metaKind: 'project-meta',
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
  projectId: string,
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
  projectId: string,
  tabId: string,
  elementId: string,
  delta: ElementDelta,
) => Promise<boolean> = room.relayElementDelta;

// One changeset into the room's ordered stream (docs/specs/024-agents/agent-changesets.md "The write path" step 7).
export const relayChangeset: (
  env: Env,
  projectId: string,
  op: ChangesetRoomOp,
) => Promise<boolean> = room.relayChangeset;

// A project an agent renamed, as the project-meta op an editor's own rename sends.
export const relayProjectRename: (
  env: Env,
  projectId: string,
  name: string,
  tabs: readonly { id: string; name: string; orderIndex: number; folder?: string }[],
) => Promise<boolean> = room.relayItemRename;

// A tab the api renamed (CS42), as the same tab-meta op an editor's own rename sends.
export const relayTabRename: (
  env: Env,
  projectId: string,
  tabId: string,
  name: string,
) => Promise<boolean> = room.relayTabRename;

// An agent's form write (docs/specs/030-forms/forms.md "Agents"), as the ops an editor's own edit sends: its form
// and name as one `tab-meta`. Logged under `tag`; answers how many reached the room.
export const relayRoomOps: (
  env: Env,
  projectId: string,
  ops: readonly RoomOp[],
  tag: string,
) => Promise<number> = room.relayRoomOps;

// Every selection on the tab (docs/specs/024-agents/agent-changesets.md "Held elements"); null when the room cannot
// answer in time.
export const readRoomSelections = room.readRoomSelections;

// Tell every socket in a project's room that a share link changed: revoked or rescoped
// (docs/specs/013-workspace/tab-scoped-share-links.md).
export const broadcastShareOp = room.broadcastShareOp;

// Agent presence in the room (docs/specs/024-agents/blueprints/agent-presence.md "Room").
type AgentPresenceRoomWrite = AgentPresenceWrite & { projectId: string };

export const putAgentPresence: (
  env: Env,
  write: AgentPresenceRoomWrite,
) => Promise<
  { ok: true; expiresAt: number; created: boolean } | { ok: false; error: 'agent_presence_full' }
> = room.putAgentPresence;

export const deleteAgentPresence: (
  env: Env,
  projectId: string,
  tokenId: string,
  tabId: string,
) => Promise<boolean> = room.deleteAgentPresence;

// A token's changeset or read refreshes its presence on the tab for the activity window (spec "Presence").
export const refreshAgentPresence: (
  env: Env,
  write: Omit<AgentPresenceRoomWrite, 'mode' | 'status' | 'focus' | 'ttlMs'>,
) => Promise<void> = room.refreshAgentPresence;

// A stored type catalogue (docs/specs/026-plan/item-types.md "Storage and sync"): ordered like items,
// to every session, a tab-scoped one too (a catalogue holds no content).
export async function relayItemTypes(
  env: Env,
  projectId: string,
  op: ItemTypesRoomOp,
): Promise<void> {
  await room.broadcastOp(env, projectId, op, 'item types', true);
}

// Tell a project's room about item writes (docs/specs/026-plan/items.md "Live for everyone"): an
// ordered system op, so a peer whose socket blipped catches it up. Best-effort like the other
// broadcasts: the stored write is the change, and a client that missed it refetches on a rev gap.
export async function relayItems(env: Env, projectId: string, op: ItemsRoomOp): Promise<void> {
  await room.broadcastOp(env, projectId, op, 'items', true);
}

// A card thread write (docs/specs/026-plan/items.md "Comments"), in the stream items ride in, to one plan the thread
// is on. It carries no store rev: a session that missed one reads the threads again on its reconnect.
export async function relayThreads(
  env: Env,
  projectId: string,
  op: CardThreadsRoomOp,
): Promise<void> {
  await room.broadcastOp(env, projectId, op, 'threads', true);
}

// Pull request states a GitHub delivery brought (docs/specs/026-plan/github-pull-requests.md "Pull request state on
// cards"), ordered like items. A session that missed one reads them again with the cards on its reconnect.
export async function relayPullRequests(
  env: Env,
  projectId: string,
  op: PullRequestsRoomOp,
): Promise<void> {
  await broadcastOp(env, projectId, op, 'pull requests', true);
}

// A sheet write the api made (docs/specs/029-sheets/sheet-store.md "Live for everyone"), ordered like items.
export async function relaySheets(env: Env, projectId: string, op: SheetsRoomOp): Promise<void> {
  await room.broadcastOp(env, projectId, op, 'sheets', true);
}
