import { receiveKnockOp } from '@/lib/office/knock-inbox';
import { receiveBellOp } from '@/lib/office/reception-bell';
import { receiveGameOp } from '@/lib/table-games/table-game-inbox';
import { setRemoteBesideTab } from '@liveworkspace/workbench/lib/split-presence';
import { noteAccessEnded } from '@/lib/access-notice';
import { parseViewport } from '@livehuddle/api-schema';
import type { RoomHandlers } from '@/lib/api-client';
import type { PresenceCoalescer } from './presence-coalescer';
import { receiveNudgeOp } from '@/lib/nudge/nudge-inbox';
import { applyRoomOpToTabs, remoteRoomOp } from './room-op-apply';
import { keepUnsavedTabChanges } from './meta-keep-local';
import { foldRemoteOpIntoBaseline } from './save-baseline';
import { isSupersededByOwnWrite } from './own-element-writes';
import { debugLog } from '@liveworkspace/workbench/lib/debug-log';
import { shareLinkOpEffect } from './share-link-ops';
import { endPeerDragPreview, receivePeerDragPreview } from '@/hooks/collab/peer-drag-previews';
import { receivePeerSay } from '@livehuddle/avatar/speech-store';
import {
  forgetCallPeer,
  receiveLetSpeak,
  receiveStopShare,
  receiveCallOp,
  receiveCallsMode,
} from '@/lib/calls/calls-store';
import type { RoomConnectionOptions } from './useRoomConnection.types';

type RoomOpFrom = Parameters<NonNullable<RoomHandlers['onOp']>>[0];
type RoomOp = Parameters<NonNullable<RoomHandlers['onOp']>>[1];

// One op from the room, already checked and migrated, applied to the page (useRoomConnection's onOp): the incoming
// half of the room's vocabulary (room-op-vocabulary.test.ts reads its `op.kind` chain). Split out of
// useRoomConnection.ts; it runs inside that hook's effect event, so `opts` is always the current props.
export function receiveRoomOp(
  from: RoomOpFrom,
  op: RoomOp,
  presence: PresenceCoalescer,
  opts: RoomConnectionOptions,
  // Each peer's server-verified role by presence id (the hook's presence list keeps it), read when a preview asks.
  roleByPresenceRef: { readonly current: ReadonlyMap<string, string | undefined> },
): void {
  const {
    documentId,
    markSeen,
    saveBaseline,
    ownWrites,
    countAppliedOp,
    sessionShareCodeRef,
    applyRemoteOp,
    loadedTabIdsRef,
    markTabLoaded,
    setRemoteSelections,
    setRemoteTabFocus,
    setRemoteViewports,
    setDocumentName,
    receiveAvatarPush,
    receiveFocusHere,
    receiveDocumentTrashed,
    receiveChangeset,
  } = opts;
  // Any op from a peer counts as "they're still here". Bumps
  // the idle timer used by the avatar's away/offline status
  // derivation. Cursor packets are the most frequent so this
  // doubles as a perfectly fine activity heartbeat.
  markSeen(from);
  if (
    op.kind === 'tab' ||
    op.kind === 'el' ||
    op.kind === 'el-delta' ||
    op.kind === 'tab-meta' ||
    op.kind === 'document-meta'
  ) {
    // A document change from a peer: a whole tab, one element (docs/specs/012-collaboration/realtime-conflict-resolution.md),
    // one answer / idea / tick / comment (docs/specs/012-collaboration/collab-race-hardening.md),
    // non-element tab fields, or the document's name
    // and tab list. One pure function applies each (room-op-apply.ts),
    // to the tabs on screen AND to the autosave's baseline, so the
    // change is known to be the peer's and is never saved or broadcast
    // back as if it were ours (docs/specs/012-collaboration/collab-race-hardening.md).
    if (op.kind === 'document-meta') setDocumentName(op.name);
    // A tab not fetched yet is a placeholder: an element added to it would make it look edited, so
    // its fetch would be thrown away and the next save would write the placeholder over the real
    // tab. Its fetch brings the element. A whole tab from a peer is its content: loaded.
    if (op.kind === 'el' && !loadedTabIdsRef.current.has(op.tabId)) return;
    if (op.kind === 'tab') markTabLoaded(op.tabId);
    // A dragger's real change has arrived: their live preview has done its job.
    endPeerDragPreview(from);
    // Ordered before our own pending write of the same element, which replaces it on every screen: showing it
    // here alone would leave this screen on the peer's copy (realtime-conflict-resolution.md "Same-element
    // edits converge").
    if (ownWrites && isSupersededByOwnWrite(ownWrites, op)) {
      debugLog('[room] peer update superseded by our pending write');
      return;
    }
    // A peer's tab list keeps what this editor has not saved yet: a tab added here, one deleted here
    // (keepUnsavedTabChanges), judged against the baseline as it was before the list arrived.
    const savedBefore = saveBaseline.tabs.current;
    // The undo snapshots take the op when one is restored, a run of element ops together (remoteRoomOp).
    applyRemoteOp(
      op.kind === 'document-meta'
        ? (prev) => keepUnsavedTabChanges(prev, applyRoomOpToTabs(prev, op), savedBefore)
        : remoteRoomOp(op),
    );
    foldRemoteOpIntoBaseline(saveBaseline, op);
    // In the same batch as the tabs update, so the render that shows the op also counts it.
    countAppliedOp();
  } else if (op.kind === 'select') {
    setRemoteSelections((prev) => {
      const next = new Map(prev);
      // tabId scopes the badge + docs/specs/007-editor/editor-app.md lock to the sender's tab;
      // absent (older peer) = tab-unknown, shown everywhere.
      next.set(from, { elementId: op.elementId, tabId: op.tabId });
      return next;
    });
  } else if (op.kind === 'cursor') {
    // Coalesced: buffered and committed once per animation frame
    // (see createPresenceCoalescer). Cursor
    // packets arrive at up to 30 Hz PER PEER, and a setState per
    // packet re-rendered the whole editor tree per message.
    presence.cursor(
      from,
      op.x !== null && op.y !== null ? { tabId: op.tabId, x: op.x, y: op.y } : null,
    );
  } else if (op.kind === 'drag-preview') {
    // A collaborator mid-drag (docs/specs/008-canvas/drag-preview.md): drawn, never written.
    receivePeerDragPreview(from, op, (id) => roleByPresenceRef.current.get(id));
  } else if (op.kind === 'avatar') {
    // Latest-wins per peer (no accumulation): the
    // character has one position at a time.
    presence.avatar(from, op.avatar ? { tabId: op.tabId, avatar: op.avatar } : null);
    // Leaving the mode takes the character's voice with it (docs/specs/012-collaboration/proximity-audio.md).
    if (!op.avatar) forgetCallPeer(from);
  } else if (op.kind === 'viewport') {
    // Latest-wins per peer, like the avatar: a camera has one position.
    // Applied straight through rather than batched with the presence
    // flush: a follower's view should track the presenter's hand, and a
    // 10 Hz stream needs no coalescing.
    // Checked here too (a room from before the gate checked it relays any): a malformed camera is dropped
    // rather than sending a follower's canvas to a blank view.
    const seen = parseViewport(op);
    if (seen) {
      setRemoteViewports((prev) => {
        const next = new Map(prev);
        next.set(from, { tabId: seen.tabId, pan: seen.pan, zoom: seen.zoom, size: seen.size });
        return next;
      });
    }
  } else if (op.kind === 'avatar-knock' || op.kind === 'avatar-knock-answer') {
    // A knock on a room, or the answer to ours (docs/specs/012-collaboration/knock.md): parsed, handed to the
    // canvas, which knows whether we stand inside; never written.
    receiveKnockOp(from, op);
  } else if (op.kind === 'nudge' || op.kind === 'nudge-refused') {
    // A nudge for us, or the room refusing ours (docs/specs/012-collaboration/nudge.md "The wire"): addressed to
    // this socket alone, so being handed one is the addressing; never written.
    receiveNudgeOp(from, op);
  } else if (op.kind === 'avatar-bell') {
    // A ring of a Reception Desk's bell (docs/specs/009-elements/workday-pieces.md "The wire"): parsed, handed to
    // the canvas, which knows whether we stand in earshot; never written.
    receiveBellOp(from, op);
  } else if (op.kind === 'game-input' || op.kind === 'game-event') {
    // A game at a piece (docs/specs/009-elements/social-pieces.md "The wire"): a player's paddle or a moment of the
    // game, parsed and handed to the table showing it, which checks the sender sits there; never written.
    receiveGameOp(from, op);
  } else if (op.kind === 'avatar-push') {
    // A shove is ADDRESSED: the room delivers it to the named session and
    // nobody else, so anything that arrives here was aimed at us. We
    // can't check that ourselves: peers are identified by server-minted
    // presence ids precisely so nobody learns anyone's real owner id
    // (docs/specs/015-api/public-api-and-tokens.md §6), and that includes not recognising our own. Nothing is
    // written to the document either way: our client decides what to do
    // with the request, and does nothing if we've left the mode.
    receiveAvatarPush(op.dx, op.dy);
  } else if (op.kind === 'avatar-voice' || op.kind === 'call-track') {
    // Proximity audio (docs/specs/012-collaboration/proximity-audio.md "The wire"): a talking level for the
    // equaliser, or where a speaker's microphone is. Parsed by the store, never written.
    receiveCallOp(from, op);
  } else if (op.kind === 'avatar-hand') {
    // A raised hand (docs/specs/012-collaboration/meeting-rooms-and-stage.md "Raise hand"): parsed and kept by
    // the calls store until it goes down or its owner leaves, never written.
    receiveCallOp(from, op);
  } else if (op.kind === 'avatar-let-speak') {
    // ADDRESSED like a shove: the room delivers it to the hand's owner alone, so it is ours. The running call
    // checks the sender may let us speak.
    receiveLetSpeak(from, op);
  } else if (op.kind === 'call-stop-share') {
    // ADDRESSED too: an Editor asked us to stop sharing our screen (video-and-screen-bubbles.md "Share roles").
    // The room delivers it only from an Editor; the running call checks again.
    receiveStopShare(from, op);
  } else if (op.kind === 'avatar-say') {
    // A peer said something (docs/specs/008-canvas/avatar-mode.md "Speech bubbles"): parsed, deduped and
    // drawn by the speech layer, never written.
    receivePeerSay(from, op);
  } else if (op.kind === 'focus-here') {
    // No tab check: the invitation names its own tab and taking it is
    // what switches you, so one sent from another tab is exactly the
    // case this element exists for.
    receiveFocusHere(from, op.tabId, op.at);
  } else if (op.kind === 'tab-focus') {
    setRemoteTabFocus((prev) => {
      const next = new Map(prev);
      next.set(from, op.tabId);
      return next;
    });
    // Their other pane, side by side (docs/specs/007-editor/split-view.md "Presence").
    setRemoteBesideTab(from, op.besideTabId);
  } else if (op.kind === 'share-revoked' || op.kind === 'share-rescoped') {
    // The owner revoked or rescoped a share link (share-link-ops.ts).
    // A session hydrated with that exact code leaves the editor on a
    // revoke and reloads into the new scope on a rescope; the room
    // closes its socket either way. Everyone else keeps their session.
    const effect = shareLinkOpEffect(op, from, sessionShareCodeRef.current);
    if (effect === 'leave') {
      // The Explorer says why we arrived (lib/access-notice.ts), rather than landing without a word.
      noteAccessEnded(documentId, 'revoked');
      window.location.assign('/explorer');
    } else if (effect === 'reload') window.location.reload();
  } else if (op.kind === 'changeset') {
    // An agent's changeset, applied, outlined and toasted by useChangesetFeed. System-only, like
    // the share ops: the room refuses one from a client socket.
    if (from === 'system') receiveChangeset(op);
  } else if (op.kind === 'calls-mode') {
    // The calls kill switch changed (docs/specs/016-platform/calls-kill-switch.md "The room tells its clients").
    // System-only: the store takes it from the room alone, and a running call that may no longer run ends.
    receiveCallsMode(from, op);
  } else if (op.kind === 'document-trashed') {
    // The document went to the Trash. System-only, like the share ops:
    // the room refuses it from a client socket.
    if (from === 'system') receiveDocumentTrashed();
  }
}
