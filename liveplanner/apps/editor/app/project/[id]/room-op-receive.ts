import { explorerHref } from '@liveworkspace/workbench/lib/explorer-href';
import { setRemoteBesideTab } from '@liveworkspace/workbench/lib/split-presence';
import type { RoomHandlers } from '@/lib/api-client';
import type { PresenceCoalescer } from './presence-coalescer';
import { applyRoomOpToTabs, remoteRoomOp } from './room-op-apply';
import { keepUnsavedTabChanges } from './meta-keep-local';
import { foldRemoteOpIntoBaseline } from './save-baseline';
import { isSupersededByOwnWrite, withoutOwnDashboardWrites } from './own-element-writes';
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
  received: RoomOp,
  presence: PresenceCoalescer,
  opts: RoomConnectionOptions,
  // Each peer's server-verified role by presence id (the hook's presence list keeps it), read when a preview asks.
  roleByPresenceRef: { readonly current: ReadonlyMap<string, string | undefined> },
): void {
  const {
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
    setProjectName,
    receiveProjectTrashed,
    receiveChangeset,
    receiveItems,
    receiveThreads,
    receivePullRequests,
    receiveItemTypes,
    receivePlanPresence,
    receiveSheets,
    receiveSheetPresence,
  } = opts;
  // A peer's layout change without the fields this editor is writing, which the room ordered after it
  // (collab-race-hardening.md "A Dashboard's layout travels as deltas"); nothing left of it, nothing to do.
  const op = ownWrites ? withoutOwnDashboardWrites(ownWrites, received) : received;
  if (op === null) {
    markSeen(from);
    debugLog('[room] peer layout change superseded by our pending write');
    return;
  }
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
    op.kind === 'dashboard-delta' ||
    op.kind === 'tab-meta' ||
    op.kind === 'project-meta'
  ) {
    // A project change from a peer: a whole tab, one element (docs/specs/012-collaboration/realtime-conflict-resolution.md),
    // one dot (docs/specs/012-collaboration/session-tools.md), one answer / idea / tick / comment (docs/specs/012-collaboration/collab-race-hardening.md),
    // non-element tab fields, or the project's name
    // and tab list. One pure function applies each (room-op-apply.ts),
    // to the tabs on screen AND to the autosave's baseline, so the
    // change is known to be the peer's and is never saved or broadcast
    // back as if it were ours (docs/specs/012-collaboration/collab-race-hardening.md).
    if (op.kind === 'project-meta') setProjectName(op.name);
    // A tab not fetched yet is a placeholder: an element added to it would make it look edited, so
    // its fetch would be thrown away and the next save would write the placeholder over the real
    // tab. Its fetch brings the element. A whole tab from a peer is its content: loaded.
    if (
      (op.kind === 'el' || op.kind === 'dashboard-delta') &&
      !loadedTabIdsRef.current.has(op.tabId)
    )
      return;
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
      op.kind === 'project-meta'
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
      // The note rides in the address: the Explorer is another site's page, served here.
      window.location.assign(explorerHref('', '?ended=revoked'));
    } else if (effect === 'reload') window.location.reload();
  } else if (op.kind === 'changeset') {
    // An agent's changeset, applied, outlined and toasted by useChangesetFeed. System-only, like
    // the share ops: the room refuses one from a client socket.
    if (from === 'system') receiveChangeset(op);
  } else if (op.kind === 'plan-presence') {
    receivePlanPresence(from, op);
  } else if (op.kind === 'sheet-presence') {
    receiveSheetPresence(from, op);
  } else if (op.kind === 'sheets') {
    // Sheet writes (docs/specs/029-sheets/sheet-store.md). System-only, as items.
    if (from === 'system') receiveSheets(op);
  } else if (op.kind === 'items') {
    // Item writes (docs/specs/026-plan/items.md). System-only: items change only through the api,
    // and the room refuses this op from a client socket.
    if (from === 'system') receiveItems(op);
  } else if (op.kind === 'threads') {
    // Card comment threads (docs/specs/026-plan/items.md "Comments"). System-only: threads change only
    // through the api.
    if (from === 'system') receiveThreads(op);
  } else if (op.kind === 'pull-requests') {
    // A GitHub delivery's pull request states. System-only: only a verified delivery changes them.
    if (from === 'system') receivePullRequests?.(op);
  } else if (op.kind === 'item-types') {
    // The type catalogue (docs/specs/026-plan/item-types.md). System-only: it changes only through
    // the api.
    if (from === 'system') receiveItemTypes(op);
  } else if (op.kind === 'project-trashed') {
    // The project went to the Trash. System-only, like the share ops:
    // the room refuses it from a client socket.
    if (from === 'system') receiveProjectTrashed();
  }
}
