import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import type { EditorMode, QaNote, Tab } from '@livediagram/document';
import type {
  AgentPresence,
  ChangesetRoomOp,
  FacilitatorReason,
  LivePoll,
} from '@livediagram/api-schema';
import type { Participant } from '@/lib/identity';
import type { connectRoom } from '@/lib/api-client';
import type { CursorPos, LaserTrail } from '@liveworkspace/workbench/lib/presence-coalescer';
import type { RemoteSelection } from '@/lib/presence-rows';
import type { PendingIdeaIds } from './room-op-apply';
import type { SaveBaselineRefs } from './save-baseline';
import type { OwnElementWrites } from './own-element-writes';
import type { RemoteViewport } from '@/hooks/collab/useFollowMe';

// What useRoomConnection takes, split out of useRoomConnection.ts: the document and who we are, the page's state
// the room drives, and the handlers each kind of message reaches.
export type RoomConnectionOptions = {
  hydrated: boolean;
  documentId: string | null;
  // Saved on the server, so it has a room: every such document, personal ones included, since an
  // agent writing through the api is a second writer even where nobody else can open it.
  documentServerStored: boolean;
  // False keeps the room closed whatever else holds: a Community viewer never joins the author's room
  // (docs/specs/025-community/community.md "Viewing a post's document"). Defaults to true.
  enabled?: boolean;
  // A workbench session (docs/specs/013-workspace/blueprints/workbench-embeds.md): told when the room
  // ends it (close 4006), or when an access change does (4005, WB31), instead of reloading.
  onWorkbenchEnded?: () => void;
  // The room turned this editor away as full (docs/specs/015-api/api.md "A room holds at most 100 connections"),
  // once per streak; the connector keeps trying on its own.
  onRoomFull?: () => void;
  // The document's team (docs/specs/013-workspace/team-shared-documents.md), null for a personal document. A team
  // document is a live room for its members even without a share link,
  // so presence opens for it the same way a shared document does.
  documentTeamId: string | null;
  selfParticipant: Participant;
  sessionShareCode: string | null;
  lastSeenRef: MutableRefObject<Map<string, number>>;
  // Bumps a peer's last-seen (usePresenceState), publishing when they arrive or return from idle.
  markSeen: (participantId: string) => void;
  selfParticipantRef: MutableRefObject<Participant>;
  // The autosave's baseline (docs/specs/012-collaboration/collab-race-hardening.md): every document op a peer sends is
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
  // Merge a peer's tab / document-meta change into the present, PRESERVING
  // the local undo / redo stacks (peers autosave ~600ms, so clearing
  // history on each would wipe undo continuously during a shared session).
  // A peer's op into the present and every undo / redo snapshot (historyApplyRemoteOp), so undo
  // never brings back what the peer changed.
  applyRemoteOp: (apply: (prev: Tab[]) => Tab[]) => void;
  // This browser's own idea posts the room has not answered (useIdeaPosts), so a peer's card that reaches a
  // full box takes the newest one's place (docs/specs/012-collaboration/idea-box.md "Racing for the last card").
  pendingIdeaIds?: PendingIdeaIds;
  // The tabs whose content is here (fetched, or made here), and marking one so: a peer's element op
  // for a tab still waiting on its first fetch is left to that fetch.
  loadedTabIdsRef: MutableRefObject<Set<string>>;
  markTabLoaded: (id: string) => void;
  setLivePresence: Dispatch<SetStateAction<Participant[]>>;
  setLiveAgents: Dispatch<SetStateAction<AgentPresence[]>>;
  setRemoteSelections: Dispatch<SetStateAction<Map<string, RemoteSelection>>>;
  setRemoteCursors: Dispatch<SetStateAction<Map<string, CursorPos>>>;
  setRemoteTabFocus: Dispatch<SetStateAction<Map<string, string>>>;
  setRemoteLaserTrails: Dispatch<SetStateAction<Map<string, LaserTrail>>>;
  // Follow-me (docs/specs/012-collaboration/follow-me-viewport.md): where each peer is looking, latest sample each.
  // Only read while somebody is being followed; kept for everyone because the
  // op is unsolicited (see the RoomOp comment).
  setRemoteViewports: Dispatch<SetStateAction<Map<string, RemoteViewport>>>;
  setDocumentName: Dispatch<SetStateAction<string>>;
  setSelfParticipant: Dispatch<SetStateAction<Participant>>;
  // Live poll (docs/specs/012-collaboration/live-poll.md) inbound handlers, owned by useLivePoll. Stable
  // (useCallback with no changing deps) so they don't reopen the socket,
  // the effect's dep list stays [hydrated, documentId, documentServerStored].
  // A peer set off a reaction pad (docs/specs/009-elements/reaction-pad.md). Purely visual: nothing is
  // written, so there is nothing here to persist, order, or undo.
  receiveReaction: (elementId: string, reaction: string) => void;
  // Bring Focus (docs/specs/012-collaboration/bring-focus.md): somebody is asking the room to come and look.
  // The op also carries the presser's zoom, which is not used: taking it keeps your own.
  receiveFocusHere: (from: string, tabId: string, at: { x: number; y: number }) => void;
  // The facilitator baton (docs/specs/012-collaboration/facilitator.md): the room's answer, and the token we
  // present on every hello so a refresh keeps it.
  receiveFacilitator: (msg: {
    holder: string | null;
    by?: string;
    reason: FacilitatorReason;
    token?: string;
  }) => void;
  readFacilitatorToken: () => string | null;
  // Follow-me (docs/specs/012-collaboration/follow-me-viewport.md "Who follows whom"): who follows us, from the room,
  // and who we follow, said again on every new socket.
  setFollowerIds: Dispatch<SetStateAction<readonly string[]>>;
  readFollowing: () => string | null;
  // The facilitator freed an element we were holding (docs/specs/007-editor/editor-app.md lock). Only our
  // socket is sent this, so there is nothing to check it against.
  receiveSelectionReleased: (msg: { elementId: string; by: string }) => void;
  receivePoll: (poll: LivePoll) => void;
  receivePollAnswer: (from: string, pollId: string, value: string | null, key?: string) => void;
  receivePollEnd: (pollId: string) => void;
  // A Q&A board's authoritative state after a server write (docs/specs/012-collaboration/qa-board.md).
  // Stable, like the poll handlers, so it can't reopen the socket.
  receiveQa: (tabId: string, elementId: string, notes: QaNote[], rev: number) => void;
  // The document went to the Trash (docs/specs/013-workspace/trash.md): the
  // worker's document-trashed op, or the room closing the socket with 4004.
  // Stable, like the others, so it can't reopen the socket.
  receiveDocumentTrashed: () => void;
  // Re-hydrate tab content from the canvas when the room can't replay our gap
  // (docs/specs/012-collaboration/resync-without-reload.md). Stable, like the poll handlers, so it can't reopen the
  // socket, the effect's dep list stays [hydrated, documentId, shareable].
  resyncFromServer: () => Promise<void>;
  // A peer switched a tab's editor mode (docs/specs/007-editor/editor-modes.md "Where the mode
  // lives"): already applied with the op; told so the editor can say who switched. `name` is the
  // peer's presence name, null when the room has not given one.
  receivePeerModeSwitch?: (name: string | null, tabId: string, mode: EditorMode) => void;
  // An agent's changeset (docs/specs/024-agents/agent-changesets.md "In the editor"), relayed by the
  // worker; useChangesetFeed decides what to do with it.
  receiveChangeset: (op: ChangesetRoomOp) => void;
  // The room has greeted this connection (its first presence list): what was relayed before it
  // joined is caught up through the api (useChangesetFeed's checkSinceLoad).
  onRoomJoined: () => void;
  // A Participant session's ticket (docs/specs/013-workspace/share-roles.md) carries the adder key the room
  // stamps on what it adds, and the key comes back for `onAdderKey`.
  onAdderKey?: (key: string | null) => void;
};
