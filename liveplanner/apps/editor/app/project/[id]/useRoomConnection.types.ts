import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import type { Tab } from '@liveplanner/project';
import type {
  AgentPresence,
  CardThreadsRoomOp,
  PullRequestsRoomOp,
  ChangesetRoomOp,
  ItemsRoomOp,
  ItemTypesRoomOp,
  SheetPresenceOp,
  SheetsRoomOp,
} from '@liveplanner/api-schema';
import type { Participant } from '@/lib/identity';
import type { connectRoom } from '@/lib/api-client';
import type { CursorPos } from './presence-coalescer';
import type { RemoteSelection } from '@/lib/presence-rows';
import type { SaveBaselineRefs } from './save-baseline';
import type { OwnElementWrites } from './own-element-writes';

// What useRoomConnection takes, split out of useRoomConnection.ts: the plan and who we are, the page's state
// the room drives, and the handlers each kind of message reaches.
export type RoomConnectionOptions = {
  hydrated: boolean;
  projectId: string | null;
  // Saved on the server, so it has a room: every such project, personal ones included, since an
  // agent writing through the api is a second writer even where nobody else can open it.
  projectServerStored: boolean;
  // False keeps the room closed whatever else holds (an ended workbench session). Defaults to true.
  enabled?: boolean;
  // A workbench session (docs/specs/013-workspace/blueprints/workbench-embeds.md): told when the room
  // ends it (close 4006), or when an access change does (4005, WB31), instead of reloading.
  onWorkbenchEnded?: () => void;
  // The room turned this connection away, full (docs/specs/015-api/api.md "A room holds 100 connections").
  onRoomFull?: () => void;
  // The project's team (docs/specs/013-workspace/team-shared-projects.md), null for a personal project. A team
  // project is a live room for its members even without a share link,
  // so presence opens for it the same way a shared project does.
  projectTeamId: string | null;
  selfParticipant: Participant;
  sessionShareCode: string | null;
  lastSeenRef: MutableRefObject<Map<string, number>>;
  // Bumps a peer's last-seen (usePresenceState), publishing when they arrive or return from idle.
  markSeen: (participantId: string) => void;
  selfParticipantRef: MutableRefObject<Participant>;
  // The autosave's baseline (docs/specs/012-collaboration/collab-race-hardening.md): every project op a peer sends is
  // folded into it as well as into the tabs on screen, so the next local save
  // neither mistakes it for ours nor ships it back out.
  saveBaseline: SaveBaselineRefs;
  // This editor's element writes the room has not sequenced yet: a peer's update of one was ordered first, and
  // ours replaces it everywhere, so it is not shown here (own-element-writes.ts).
  ownWrites?: OwnElementWrites;
  // Counts a peer op applied to `tabs` (useEditorState's opsApplied, read by the autosave).
  countAppliedOp: () => void;
  sessionShareCodeRef: MutableRefObject<string | null>;
  roomRef: MutableRefObject<ReturnType<typeof connectRoom> | null>;
  // Merge a peer's tab / project-meta change into the present, PRESERVING
  // the local undo / redo stacks (peers autosave ~600ms, so clearing
  // history on each would wipe undo continuously during a shared session).
  // A peer's op into the present and every undo / redo snapshot (historyApplyRemoteOp), so undo
  // never brings back what the peer changed.
  applyRemoteOp: (apply: (prev: Tab[]) => Tab[]) => void;
  // The tabs whose content is here (fetched, or made here), and marking one so: a peer's element op
  // for a tab still waiting on its first fetch is left to that fetch.
  loadedTabIdsRef: MutableRefObject<Set<string>>;
  markTabLoaded: (id: string) => void;
  setLivePresence: Dispatch<SetStateAction<Participant[]>>;
  setLiveAgents: Dispatch<SetStateAction<AgentPresence[]>>;
  setRemoteSelections: Dispatch<SetStateAction<Map<string, RemoteSelection>>>;
  setRemoteCursors: Dispatch<SetStateAction<Map<string, CursorPos>>>;
  setRemoteTabFocus: Dispatch<SetStateAction<Map<string, string>>>;
  setProjectName: Dispatch<SetStateAction<string>>;
  setSelfParticipant: Dispatch<SetStateAction<Participant>>;
  // The project went to the Trash (docs/specs/013-workspace/trash.md): the
  // worker's project-trashed op, or the room closing the socket with 4004.
  // Stable, like the others, so it can't reopen the socket.
  receiveProjectTrashed: () => void;
  // Re-hydrate tab content from D1 when the room can't replay our gap
  // (docs/specs/012-collaboration/resync-without-reload.md). Stable, like the others, so it can't reopen the
  // socket, the effect's dep list stays [hydrated, projectId, shareable].
  resyncFromServer: () => Promise<void>;
  // An agent's changeset (docs/specs/024-agents/agent-changesets.md "In the editor"), relayed by the
  // worker; useChangesetFeed decides what to do with it.
  receiveChangeset: (op: ChangesetRoomOp) => void;
  // A peer's save landed (docs/specs/006-project/delta-saves.md "A peer's save moves the base copy"): the tab as
  // the autosave's baseline holds it, and the revision and digest the save announced. Absent, nothing is taken.
  receiveTabSaved?: (tab: Tab, rev: number, digest: string) => void;
  // Item writes the api made (docs/specs/026-plan/items.md "Live for everyone"). System-only.
  receiveItems: (op: ItemsRoomOp) => void;
  // A card comment thread's write (docs/specs/026-plan/items.md "Comments"), from any plan the thread is on.
  receiveThreads: (op: CardThreadsRoomOp) => void;
  // The plan's pull request states (docs/specs/026-plan/github-pull-requests.md "Pull request state on cards").
  // System-only. Absent: the screen keeps none.
  receivePullRequests?: (op: PullRequestsRoomOp) => void;
  // A stored type catalogue (docs/specs/026-plan/item-types.md "Storage and sync"). System-only.
  receiveItemTypes: (op: ItemTypesRoomOp) => void;
  // A peer's hands on a Plan card (docs/specs/026-plan/plan-board.md). Presence.
  receivePlanPresence: (
    from: string,
    op: { tabId: string; itemId: string | null; state?: 'drag' | 'view' },
  ) => void;
  // Sheet writes the api made (docs/specs/029-sheets/sheet-store.md "Live for everyone"). System-only.
  receiveSheets: (op: SheetsRoomOp) => void;
  // A peer's selection on a sheet (docs/specs/029-sheets/sheet.md "Collaboration"). Presence.
  receiveSheetPresence: (from: string, op: SheetPresenceOp) => void;
  // The room has greeted this connection (its first presence list): what was relayed before it
  // joined is caught up through the api (useChangesetFeed's checkSinceLoad).
  onRoomJoined: () => void;
  // A Participant session's ticket (docs/specs/013-workspace/share-roles.md) carries the adder key the room
  // stamps on what it adds, and the key comes back for `onAdderKey`.
  onAdderKey?: (key: string | null) => void;
};
