import type { TabConnectionWire } from '@liveworkspace/api-schema/tab-connection';
import type { TabSavedOp } from '@liveworkspace/api-schema/tab-delta';
import type { ElementDelta, RoomElementOp, Tab } from '@livehuddle/document';
import type { AvatarOp, AvatarPushOp } from '@livehuddle/avatar/wire';
import type { AvatarSayOp } from '@livehuddle/avatar/wire-say';
import type { AvatarVoiceOp, CallsCheckOp, CallTrackOp } from './call-voice';
import type { AvatarHandOp, AvatarLetSpeakOp } from './call-hand';
import type { CallSessionOp, CallStopShareOp } from './call-control';
import type { AvatarKnockAnswerOp, AvatarKnockOp } from './knock';
import type { AvatarBellOp } from './bell';
import type { NudgeOp, NudgeRefusedOp } from './nudge';
import type { GameEventOp, GameInputOp } from './table-game';
import type { CallsModeOp } from './calls-mode';
import type { DragPreviewPatch, DragPreviewRide } from './drag-preview';
import type { ChangesetRoomOp } from './changesets';

// ---------------------------------------------------------------------
// Realtime room: op vocabulary (client view)
// ---------------------------------------------------------------------

// The set of `op` kinds the live editor knows how to send + receive
// inside the room's `op` envelopes. The api worker's view
// (`ClientMessage` / `ServerMessage` in room-messages.ts) keeps `op` as `unknown`
// so the Durable Object stays agnostic of editor evolution, it just
// rebroadcasts. The union below is what the editor narrows to on the
// receive side, and what it constructs on the send side. New op
// kinds grow this union (and matching handlers in the editor),
// nothing in the api worker changes.
export type RoomOp =
  // The sender just switched to (or initially focused) a tab. Drives
  // the per-tab avatar dots in the TabBar so collaborators can see at
  // a glance which tab each peer is working on.
  // `besideTabId`: the tab in the sender's other pane while they work side by side
  // (docs/specs/007-editor/split-view.md "Presence"); absent or null with no split.
  | { kind: 'tab-focus'; tabId: string; besideTabId?: string | null }
  // A single tab's content changed. The post-refactor replacement for
  // the heavyweight `tabs` op below, sender ships only the one tab
  // they edited. Receivers merge by id. Kept as a fallback for bulk
  // changes and older peers; the granular `el` op (docs/specs/012-collaboration/realtime-conflict-resolution.md) supersedes it
  // for the common single-element edit so concurrent different-element
  // edits stop clobbering.
  | { kind: 'tab'; tabId: string; tab: Tab }
  // A single element on a tab changed (docs/specs/012-collaboration/realtime-conflict-resolution.md, Level 0): add / update /
  // remove / reorder, applied by id so a peer editing a DIFFERENT element
  // on the same tab merges instead of overwriting the whole tab. `op`
  // carries the element payload (see @livehuddle/document ElementOp).
  | { kind: 'el'; tabId: string; op: RoomElementOp }
  // A tab's non-element metadata changed (name, background, font, …),
  // the element array is untouched, so this rides alongside `el` ops
  // without shipping the whole tab.
  //
  // `clear` names fields the sender REMOVED (Clear Timer, a reset
  // background). A removed field serialises to nothing inside `patch`, so it
  // used to force a whole-`tab` op, which replaced every element on every
  // receiver and wiped their unsaved presses (docs/specs/012-collaboration/collab-race-hardening.md).
  | {
      kind: 'tab-meta';
      tabId: string;
      patch: Partial<Omit<Tab, 'elements'>>;
      clear?: string[];
    }
  // ONE change to a field many people write at once: a checklist tick, a
  // comment (docs/specs/012-collaboration/collab-race-hardening.md): a whole-element `el` update replaced a peer's copy with the
  // sender's snapshot, so two people ticking the same checklist row lost a mark.
  | { kind: 'el-delta'; tabId: string; elementId: string; delta: ElementDelta }
  // An Editor's save of a tab landed (docs/specs/006-document/delta-saves.md "A peer's save moves the base copy"): the
  // revision it wrote and the digest of the elements now stored, sent after the save's element ops. Changes no content.
  | TabSavedOp
  // Document-level metadata changed: rename, tab reorder, tab add /
  // delete. Carries the new ordered list of tab summaries (id + name
  // + order) so receivers can update the TabBar without fetching the
  // full tab payloads.
  | {
      kind: 'document-meta';
      name: string;
      // `folder` (docs/specs/006-document/tab-folders.md) is the per-document folder name, optional so
      // an older peer that omits it is treated as loose, no parse break.
      // `outOfScope` marks a tab outside a tab-scoped session's scope
      // (docs/specs/013-workspace/tab-scoped-share-links.md): its name is blanked by the room.
      // `connection`: a connected tab's (liveworkspace/docs/specs/004-index/connected-tabs.md), as the room sends when
      // the index adds one (the reverse tab of a connection made both ways).
      tabs: {
        id: string;
        name: string;
        orderIndex: number;
        folder?: string;
        outOfScope?: true;
        connection?: TabConnectionWire;
      }[];
    }
  // `tabId` scopes the selection to the tab it lives on: element ids
  // are only unique per tab in older documents (tab duplication used to
  // copy ids verbatim), so an unscoped selection rendered, and, via
  // the docs/specs/007-editor/editor-app.md concurrent-selection lock, LOCKED, the same-id element
  // on every other tab too. Optional for wire compatibility: a frame
  // without it is treated as tab-unknown and shown everywhere (the old
  // behaviour).
  //
  // `elementIds` is the whole selection (the multi-selection, or the single one), capped at
  // MAX_SELECTION_IDS: the room records it so the api can refuse an agent changeset on an element a
  // person holds (docs/specs/024-agents/agent-changesets.md "Held elements"). A sender that omits it
  // holds `[elementId]`.
  | { kind: 'select'; elementId: string | null; tabId?: string; elementIds?: string[] }
  // Cursor position in canvas coordinates. `null` means the cursor
  // left the canvas surface so peers can hide their indicator. The
  // active tab id is included so we only render cursors of
  // participants who are looking at the same tab as us.
  | { kind: 'cursor'; tabId: string; x: number | null; y: number | null }
  // The sender's Avatar-mode character, and one character SHOVING another (docs/specs/008-canvas/avatar-mode.md):
  // Avatar mode's wire shapes, in @livehuddle/avatar/wire.
  | AvatarOp
  | AvatarPushOp
  | AvatarSayOp
  // Proximity audio (docs/specs/012-collaboration/proximity-audio.md "The wire").
  | AvatarVoiceOp
  | CallTrackOp
  | CallsCheckOp
  // Raise hand and Let Speak (docs/specs/012-collaboration/meeting-rooms-and-stage.md "Raise hand").
  | AvatarHandOp
  | AvatarLetSpeakOp
  | CallSessionOp
  | CallStopShareOp
  | AvatarKnockOp
  | AvatarKnockAnswerOp
  | AvatarBellOp
  | NudgeOp
  | NudgeRefusedOp
  // A game at a piece (docs/specs/009-elements/social-pieces.md "The wire").
  | GameInputOp
  | GameEventOp
  // The calls kill switch changed (docs/specs/016-platform/calls-kill-switch.md): system only, from the room.
  | CallsModeOp
  // A dragger's live preview (docs/specs/008-canvas/drag-preview.md): one geometry patch per changed
  // element, or for a very large move one shared offset (`ride`, in place of `patches`, so an editor that
  // does not know it drops the op and sees the move on release); `end` says the preview is over, `landed`
  // that it was written (the real change follows as element ops, after the autosave's wait), so receivers
  // keep drawing it until then.
  | {
      kind: 'drag-preview';
      tabId: string;
      patches?: DragPreviewPatch[];
      ride?: DragPreviewRide;
      end?: true;
      landed?: true;
    }
  // The sender's VIEWPORT (docs/specs/012-collaboration/follow-me-viewport.md): where they are looking, so anyone who
  // has chosen to follow them can mirror it. Ephemeral presence exactly like
  // cursor / laser / avatar: throttled, never logged, never ordered (no
  // `seq`), never replayed to a reconnecting client.
  //
  // Sent by everyone on change rather than on request. The alternative, a
  // follower asks, the presenter starts publishing, needs a second op kind, a
  // re-request on every reconnect, and a rule for what happens when the
  // presenter reloads mid-follow, all for three numbers on an
  // already-throttled channel. The cost is accepted and written down: a room
  // where nobody follows anybody still carries these while people scroll.
  //
  // `size` is the sender's canvas, so Bring Focus can tell a presser whether
  // the room is already looking at a point on each viewer's own screen
  // (docs/specs/012-collaboration/bring-focus.md). Optional: a client from before it
  // sends none, and a viewport without one counts as unknown.
  | {
      kind: 'viewport';
      tabId: string;
      pan: { x: number; y: number };
      zoom: number;
      size?: { width: number; height: number };
    }
  // Who the sender follows (a presence id), or null when they stop: to the room, never relayed.
  | { kind: 'follow'; target: string | null }
  // --- Bring Focus (docs/specs/012-collaboration/bring-focus.md) ----------------------------------------
  // Somebody pressed a Bring Focus element: offer everyone else a jump to it.
  //
  // Carries the element's CENTRE, not the presser's pan. Two people rarely
  // have the same window size, so copying a pan lands the element off-centre
  // (or off-screen) for anyone whose canvas is a different shape; centring the
  // point is the correct translation of "come and look at this". The
  // presser's `zoom` still rides along for clients from before receivers kept
  // their own zoom; a receiver ignores it.
  //
  // No sender name: the envelope already identifies the sender and the
  // receiver resolves the name from the presence list it holds, so a renamed
  // participant's invitation reads correctly.
  | { kind: 'focus-here'; tabId: string; at: { x: number; y: number }; zoom: number }
  // A share link was revoked by the document owner. Every connected
  // peer using that share code (the `X-Share-Code` they handed in to
  // hydrate) should hard-redirect to a "share revoked" surface so
  // they don't continue to read or hold open a stale connection.
  // Carries only the revoked code; viewers compare against their own
  // sessionShareCode and act only if it matches.
  | { kind: 'share-revoked'; code: string }
  // The named share link changed scope (docs/specs/013-workspace/tab-scoped-share-links.md). Sessions that
  // hydrated with that code reload into the new scope; the room closes their
  // sockets. Worker-originated, like share-revoked.
  | { kind: 'share-rescoped'; code: string }
  // One changeset the api applied (docs/specs/024-agents/agent-changesets.md "What the room does").
  // Worker-originated through /mutation.
  | ChangesetRoomOp
  // The document went to the Trash (docs/specs/013-workspace/trash.md). Every
  // session shows the deleted state; the room then closes every socket (4004).
  // Worker-originated, like share-revoked.
  | { kind: 'document-trashed' };
