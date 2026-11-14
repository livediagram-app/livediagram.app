import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import type { Tab } from '@livedesign/design';
import type { AgentPresence, ChangesetRoomOp, ComponentRoomOp } from '@livedesign/api-schema';
import type { Participant } from '@/lib/identity';
import type { connectRoom } from '@/lib/api-client';
import type { CursorPos, LaserTrail } from '@liveworkspace/workbench/lib/presence-coalescer';
import type { RemoteSelection } from '@/lib/presence-rows';
import type { SaveBaselineRefs } from './save-baseline';
import type { OwnElementWrites } from './own-element-writes';
import type { RemoteViewport } from '@/hooks/collab/useFollowMe';

// What useRoomConnection takes, split out of useRoomConnection.ts: the design and who we are, the page's state
// the room drives, and the handlers each kind of message reaches.
export type RoomConnectionOptions = {
  hydrated: boolean;
  designId: string | null;
  // Saved on the server, so it has a room: every such design, personal ones included, since an
  // agent writing through the api is a second writer even where nobody else can open it.
  designServerStored: boolean;
  // False keeps the room closed whatever else holds (an ended workbench session). Defaults to true.
  enabled?: boolean;
  // A workbench session (docs/specs/013-workspace/blueprints/workbench-embeds.md): told when the room
  // ends it (close 4006), or when an access change does (4005, WB31), instead of reloading.
  onWorkbenchEnded?: () => void;
  // The room is full (docs/specs/015-api/api.md "Room size"): told once per spell of being turned away, while
  // the connector keeps trying to join.
  onRoomFull?: () => void;
  // The design's team (docs/specs/013-workspace/team-shared-designs.md), null for a personal design. A team
  // design is a live room for its members even without a share link,
  // so presence opens for it the same way a shared design does.
  designTeamId: string | null;
  selfParticipant: Participant;
  sessionShareCode: string | null;
  lastSeenRef: MutableRefObject<Map<string, number>>;
  // Bumps a peer's last-seen (usePresenceState), publishing when they arrive or return from idle.
  markSeen: (participantId: string) => void;
  selfParticipantRef: MutableRefObject<Participant>;
  // The autosave's baseline (docs/specs/012-collaboration/collab-race-hardening.md): every design op a peer sends is
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
  // Merge a peer's tab / design-meta change into the present, PRESERVING
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
  setRemoteLaserTrails: Dispatch<SetStateAction<Map<string, LaserTrail>>>;
  // Follow-me (docs/specs/012-collaboration/follow-me-viewport.md): where each peer is looking, latest sample each.
  // Only read while somebody is being followed; kept for everyone because the
  // op is unsolicited (see the RoomOp comment).
  setRemoteViewports: Dispatch<SetStateAction<Map<string, RemoteViewport>>>;
  setDesignName: Dispatch<SetStateAction<string>>;
  setSelfParticipant: Dispatch<SetStateAction<Participant>>;
  // Inbound handlers are stable (useCallback with no changing deps) so they don't reopen the socket, the
  // effect's dep list stays [hydrated, designId, designServerStored].
  // Follow-me (docs/specs/012-collaboration/follow-me-viewport.md "Who follows whom"): who follows us, from the room,
  // and who we follow, said again on every new socket.
  setFollowerIds: Dispatch<SetStateAction<readonly string[]>>;
  readFollowing: () => string | null;
  // Somebody freed an element we were holding (docs/specs/007-editor/live-app.md lock). Only our
  // socket is sent this, so there is nothing to check it against.
  receiveSelectionReleased: (msg: { elementId: string; by: string }) => void;
  // The design went to the Trash (docs/specs/013-workspace/trash.md): the
  // worker's design-trashed op, or the room closing the socket with 4004.
  // Stable, like the others, so it can't reopen the socket.
  receiveDesignTrashed: () => void;
  // Re-hydrate tab content from D1 when the room can't replay our gap
  // (docs/specs/012-collaboration/resync-without-reload.md). Stable, like the others, so it can't reopen the
  // socket, the effect's dep list stays [hydrated, designId, shareable].
  resyncFromServer: () => Promise<void>;
  // An agent's changeset (docs/specs/024-agents/agent-changesets.md "In the editor"), relayed by the
  // worker; useChangesetFeed decides what to do with it.
  receiveChangeset: (op: ChangesetRoomOp) => void;
  // A main stored in the design's component library (docs/specs/009-elements/components.md "Sharing, collaboration
  // and storage"), announced by the worker to every session that may see it.
  receiveComponent?: (op: ComponentRoomOp) => void;
  // A peer's active layer on a photo page (docs/specs/031-photo/photo-pages.md "Collaboration"). Presence.
  receivePhotoPresence: (
    from: string,
    op: { tabId: string; pageId: string; layerId: string | null },
  ) => void;
  // The room has greeted this connection (its first presence list): what was relayed before it
  // joined is caught up through the api (useChangesetFeed's checkSinceLoad).
  onRoomJoined: () => void;
  // A Participant session's ticket (docs/specs/013-workspace/share-roles.md) carries the adder key the room
  // stamps on what it adds, and the key comes back for `onAdderKey`.
  onAdderKey?: (key: string | null) => void;
};
