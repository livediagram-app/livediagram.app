import { setRemoteBesideTab } from '@liveworkspace/workbench/lib/split-presence';
import { noteAccessEnded } from '@/lib/access-notice';
import type { RoomHandlers } from '@/lib/api-client';
import { parseLaserConfig } from '@/lib/laser-config';
import type { PresenceCoalescer } from '@liveworkspace/workbench/lib/presence-coalescer';
import { remoteSelectionOf } from '@/lib/presence-rows';
import { applyRoomOpToTabs, remoteRoomOp, type PendingIdeaIds } from './room-op-apply';
import { keepUnsavedTabChanges } from './meta-keep-local';
import { peerModeSwitchOf } from '@/lib/peer-mode-switch';
import { foldRemoteOpIntoBaseline } from './save-baseline';
import { isSupersededByOwnWrite } from './own-element-writes';
import { debugLog } from '@liveworkspace/workbench/lib/debug-log';
import { shareLinkOpEffect } from '@liveworkspace/workbench/lib/share-link-ops';
import { endPeerDragPreview, receivePeerDragPreview } from '@/hooks/collab/peer-drag-previews';
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
  // Each peer's server-verified role and presence name by presence id (the hook's presence list keeps them).
  roleByPresence: ReadonlyMap<string, string | undefined>,
  nameByPresence: ReadonlyMap<string, string>,
): void {
  const {
    documentId,
    markSeen,
    saveBaseline,
    ownWrites,
    countAppliedOp,
    sessionShareCodeRef,
    applyRemoteOp,
    pendingIdeaIds,
    loadedTabIdsRef,
    markTabLoaded,
    setRemoteSelections,
    setRemoteTabFocus,
    setRemoteViewports,
    setDocumentName,
    receiveReaction,
    receiveFocusHere,
    receivePoll,
    receivePollAnswer,
    receivePollEnd,
    receiveQa,
    receiveDocumentTrashed,
    receiveChangeset,
    receivePeerModeSwitch,
  } = opts;
  // Any op from a peer counts as "they're still here". Bumps
  // the idle timer used by the avatar's away/offline status
  // derivation. Cursor packets are the most frequent so this
  // doubles as a perfectly fine activity heartbeat.
  markSeen(from);
  if (
    op.kind === 'tab' ||
    op.kind === 'el' ||
    op.kind === 'vote' ||
    op.kind === 'el-delta' ||
    op.kind === 'tab-meta' ||
    op.kind === 'document-meta'
  ) {
    // A document change from a peer: a whole tab, one element (docs/specs/012-collaboration/realtime-conflict-resolution.md),
    // one dot (docs/specs/012-collaboration/session-tools.md), one answer / idea / tick / comment (docs/specs/012-collaboration/collab-race-hardening.md),
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
    // The undo snapshots take the op later, when one is restored (historyApplyRemoteOp): the pending idea
    // posts are read once, when the present takes it, so a snapshot gets the answer the present got.
    let pending: readonly string[] | undefined;
    const pendingNow: PendingIdeaIds | undefined =
      pendingIdeaIds && ((tabId, elementId) => (pending ??= pendingIdeaIds(tabId, elementId)));
    applyRemoteOp(
      op.kind === 'document-meta'
        ? (prev) => keepUnsavedTabChanges(prev, applyRoomOpToTabs(prev, op), savedBefore)
        : remoteRoomOp(op, pendingNow),
    );
    foldRemoteOpIntoBaseline(saveBaseline, op);
    const switched = peerModeSwitchOf(op);
    if (switched) {
      const name = nameByPresence.get(from) ?? null;
      receivePeerModeSwitch?.(name, switched.tabId, switched.mode);
    }
    // In the same batch as the tabs update, so the render that shows the op also counts it.
    countAppliedOp();
  } else if (op.kind === 'select') {
    setRemoteSelections((prev) => {
      const next = new Map(prev);
      // tabId scopes the badge + docs/specs/007-editor/editor-app.md lock to the sender's tab;
      // absent (older peer) = tab-unknown, shown everywhere.
      // elementIds = the whole selection, so a peer's marquee holds every element in it.
      next.set(from, remoteSelectionOf(op));
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
  } else if (op.kind === 'laser') {
    // Same coalescing as cursors; points accumulate in the buffer
    // and land in one Map commit per frame.
    presence.laser(from, {
      tabId: op.tabId,
      point: { x: op.x, y: op.y, t: performance.now() },
      // The sender's pen (docs/specs/008-canvas/laser-panel.md), parsed field by field so a token
      // from a newer client costs that field and not the trail.
      config: op.look ? parseLaserConfig(op.look) : undefined,
    });
  } else if (op.kind === 'drag-preview') {
    // A collaborator mid-drag (docs/specs/008-canvas/drag-preview.md): drawn, never written.
    receivePeerDragPreview(from, op, (id) => roleByPresence.get(id));
  } else if (op.kind === 'viewport') {
    // Latest-wins per peer: a camera has one position.
    // Applied straight through rather than batched with the presence
    // flush, a follower's view should track the presenter's hand, and a
    // 10 Hz stream needs no coalescing.
    setRemoteViewports((prev) => {
      const next = new Map(prev);
      next.set(from, { tabId: op.tabId, pan: op.pan, zoom: op.zoom, size: op.size });
      return next;
    });
  } else if (op.kind === 'reaction') {
    // No tab check here, unlike the laser: a burst is keyed to the
    // ELEMENT, and only the active tab's elements are rendered, so a
    // burst for a pad on another tab has nothing to draw itself on and
    // expires quietly.
    receiveReaction(op.elementId, op.reaction);
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
  } else if (op.kind === 'poll-start') {
    // Live poll (docs/specs/012-collaboration/live-poll.md). Purely ephemeral: it lands in the poll
    // hook's memory and never touches tabs or autosave, so there is
    // nothing here to persist or undo.
    receivePoll(op.poll);
  } else if (op.kind === 'poll-answer') {
    // `from` keys the answer so a peer changing their mind replaces
    // it. It is never rendered, results carry no identity.
    receivePollAnswer(from, op.pollId, op.value, op.key);
  } else if (op.kind === 'poll-end') {
    receivePollEnd(op.pollId);
  } else if (op.kind === 'qa') {
    // The api's word on a Q&A board (docs/specs/012-collaboration/qa-board.md). System-only: the worker
    // sends it through /broadcast after the write is already in D1, and
    // the room refuses it from a client socket, so the sender check is
    // defence in depth like share-revoked's below.
    if (from === 'system') receiveQa(op.tabId, op.elementId, op.notes, op.rev);
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
  } else if (op.kind === 'document-trashed') {
    // The document went to the Trash. System-only, like the share ops:
    // the room refuses it from a client socket.
    if (from === 'system') receiveDocumentTrashed();
  }
}
