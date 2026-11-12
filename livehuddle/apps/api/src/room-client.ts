import {
  ledgerCommentAuthors,
  mergeLedgerIntoTab,
  type Tab,
  type TabLedger,
} from '@livehuddle/document';
import {
  AGENT_PRESENCE_ACTIVITY_TTL_MS,
  ROOM_RELAY_TIMEOUT_MS,
  ROOM_SELECTIONS_TIMEOUT_MS,
  type ChangesetRoomOp,
} from '@livehuddle/api-schema';
import type { AgentPresenceWrite } from '@liveworkspace/api-kit/room-agent-presence';
import { createRoomClient, type RoomSelection } from '@liveworkspace/api-kit/room-client';
import type { Env } from './types';

// The worker's calls into a document's realtime room (docs/specs/012-collaboration/collab-race-hardening.md): reading its
// collaboration ledger to merge a save, and handing it a change the api made. The calls live once in
// @liveworkspace/api-kit/room-client; this binds them to the document's room, its `documentId` and its `document-meta` op.
const room = createRoomClient<Env, 'documentId', Tab, TabLedger>({
  // Every server-stored document has a room (docs/specs/024-agents/agent-changesets.md "Rooms for personal documents"):
  // an agent is a second writer even on a document nobody else can open.
  roomStub: (env, documentId) => env.DOCUMENT_ROOM.get(env.DOCUMENT_ROOM.idFromName(documentId)),
  idKey: 'documentId',
  metaKind: 'document-meta',
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
  documentId: string,
  path: string,
  init: RequestInit | undefined,
  ms: number,
) => Promise<Response> = room.roomFetch;

// Merge the room's collaboration ledger into a tab a client is saving (collab-race-hardening.md phase 3): the fetch
// runs alongside the save's own reads, and the apply folds in only what the saver had not seen.
export const fetchRoomLedger = room.fetchRoomLedger;
export const applyRoomLedger = room.applyRoomLedger;

// One changeset into the room's ordered stream (docs/specs/024-agents/agent-changesets.md "The write path" step 7).
export const relayChangeset: (
  env: Env,
  documentId: string,
  op: ChangesetRoomOp,
) => Promise<boolean> = room.relayChangeset;

// A document an agent renamed, as the document-meta op an editor's own rename sends.
export const relayDocumentRename: (
  env: Env,
  documentId: string,
  name: string,
  tabs: readonly { id: string; name: string; orderIndex: number; folder?: string }[],
) => Promise<boolean> = room.relayItemRename;

// A tab the api renamed (CS42), as the same tab-meta op an editor's own rename sends.
export const relayTabRename: (
  env: Env,
  documentId: string,
  tabId: string,
  name: string,
) => Promise<boolean> = room.relayTabRename;

// Every selection on the tab (docs/specs/024-agents/agent-changesets.md "Held elements"); null when the room cannot
// answer in time.
export const readRoomSelections = room.readRoomSelections;

// Tell every socket in a document's room that a share link changed: revoked or rescoped
// (docs/specs/013-workspace/tab-scoped-share-links.md).
export const broadcastShareOp = room.broadcastShareOp;

// Agent presence in the room (docs/specs/024-agents/blueprints/agent-presence.md "Room").
type AgentPresenceRoomWrite = AgentPresenceWrite & { documentId: string };

export const putAgentPresence: (
  env: Env,
  write: AgentPresenceRoomWrite,
) => Promise<
  { ok: true; expiresAt: number; created: boolean } | { ok: false; error: 'agent_presence_full' }
> = room.putAgentPresence;

export const deleteAgentPresence: (
  env: Env,
  documentId: string,
  tokenId: string,
  tabId: string,
) => Promise<boolean> = room.deleteAgentPresence;

// A token's changeset or read refreshes its presence on the tab for the activity window (spec "Presence").
export const refreshAgentPresence: (
  env: Env,
  write: Omit<AgentPresenceRoomWrite, 'mode' | 'status' | 'focus' | 'ttlMs'>,
) => Promise<void> = room.refreshAgentPresence;
