import type { TabConnectionWire } from '@liveworkspace/api-schema/tab-connection';
import type { TabSavedOp } from '@liveworkspace/api-schema/tab-delta';
import type { ElementDelta, QaNote, RoomElementOp, Tab } from '@livediagram/document';
import type { LivePoll } from './poll';
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
  // carries the element payload (see @livediagram/document ElementOp).
  | { kind: 'el'; tabId: string; op: RoomElementOp }
  // A tab's non-element metadata changed (name, background, font, …),
  // the element array is untouched, so this rides alongside `el` ops
  // without shipping the whole tab.
  //
  // `clear` names fields the sender REMOVED (Clear Timer, Clear Vote, a reset
  // background). A removed field serialises to nothing inside `patch`, so it
  // used to force a whole-`tab` op, which replaced every element on every
  // receiver and wiped their unsaved presses (docs/specs/012-collaboration/collab-race-hardening.md).
  | {
      kind: 'tab-meta';
      tabId: string;
      patch: Partial<Omit<Tab, 'elements'>>;
      clear?: string[];
    }
  // ONE dot, placed (`delta: 1`) or taken back (`delta: -1`) by `voter` on
  // `elementId` (docs/specs/012-collaboration/session-tools.md).
  //
  // Why a dot is not just a `tab-meta` patch, which is what it used to be:
  // `vote.votes` is a single map that EVERY participant writes at the same
  // time, and a tab-meta patch replaces a field wholesale. So a peer's patch,
  // built from a snapshot taken before your dot arrived, silently erased it,
  // and because the remaining-dots budget is counted out of that same map, the
  // dot came back to its owner as spendable. A retro with six voters lost dots
  // and reported votes retracting on their own.
  //
  // This op carries the CHANGE rather than the state, so two dots cast in the
  // same instant commute: each peer applies both, in whatever order they land,
  // and everybody converges on the same map. It is the same move docs/specs/012-collaboration/realtime-conflict-resolution.md made
  // for elements, for the same reason, on the one field where concurrent
  // writers are not the exception but the whole point.
  //
  // `round` names the vote the dot was cast in (docs/specs/012-collaboration/collab-race-hardening.md): a receiver drops a
  // dot for any other round, or for a vote that has closed. Optional so a
  // peer on an older client still parses.
  // ONE change to a field many people write at once: an answer, an idea, a
  // checklist tick, a comment (docs/specs/012-collaboration/collab-race-hardening.md). The `vote` op's reasoning, applied to
  // element fields: a whole-element `el` update replaced a peer's copy with the
  // sender's snapshot, so two people pressing the same done check lost a mark.
  | { kind: 'el-delta'; tabId: string; elementId: string; delta: ElementDelta }
  // An Editor's save of a tab landed (docs/specs/006-document/delta-saves.md "A peer's save moves the base copy"):
  // the revision it wrote and the digest of the elements now stored, sent after the save's element ops. A peer whose
  // save baseline hashes to `digest` holds it as its delta base copy at `rev`. Changes no content.
  | TabSavedOp
  | {
      kind: 'vote';
      tabId: string;
      elementId: string;
      voter: string;
      delta: 1 | -1;
      round?: string;
    }
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
  // One sample of the sender's laser-pointer trail (canvas-coords).
  // Sent on every pointer move while the sender is in laser tool
  // mode, throttled like cursor. Receivers append to a per-
  // participant buffer and fade the trail out over ~1 s, see
  // LaserOverlay. The active tab id scopes the rendering so peers on
  // a different tab don't see the laser.
  | {
      kind: 'laser';
      tabId: string;
      x: number;
      y: number;
      // The sender's pen (docs/specs/008-canvas/laser-panel.md): width / colour / trail / effect, each a
      // preset token. Optional, so a packet from an older client still parses
      // and simply draws the original laser. It rides the sample rather than a
      // separate op because a second packet would need ordering against the
      // samples it describes, for a couple of dozen bytes on a frame that is
      // already throttled to ~30 Hz. Receivers parse it field by field.
      look?: {
        width: 'fine' | 'medium' | 'bold';
        // 'presence', a standard colour's name ('red', 'grey'...) or a custom '#rrggbb'
        // (docs/specs/004-interface-design/colour-picker.md); older clients sent
        // 'cyan' and 'white', which receivers read as 'teal' and 'ink'.
        colour: string;
        trail: 'quick' | 'normal' | 'long';
        effect: 'beam' | 'glow' | 'comet' | 'spark';
      };
    }
  // Somebody set off a REACTION PAD (docs/specs/009-elements/reaction-pad.md). Ephemeral exactly like cursor
  // / laser: never logged, never ordered, never replayed to a
  // reconnecting client, a burst you missed is a burst that is over.
  //
  // Carries the pad's id rather than coordinates: the burst is drawn around
  // the element, and the element is where everyone already agrees it is.
  // Sending x/y would mean a peer who has since moved the pad draws confetti
  // over empty canvas. The reaction rides along so a peer plays the right one
  // even if the pad's field changed under them mid-flight.
  | { kind: 'reaction'; tabId: string; elementId: string; reaction: string }
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
  // cursor / laser: throttled, never logged, never ordered (no
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
  // --- Live poll (docs/specs/012-collaboration/live-poll.md) -------------------------------------------
  // Deliberately NOT a Tab field like the timer / dot-vote: a poll is
  // ephemeral, so nothing here reaches D1 or undo. The
  // room keeps the running poll and its answers in its own storage and
  // replays them on hello (docs/specs/012-collaboration/live-poll.md).
  // `poll-start` / `poll-end` are sequenced mutations; `poll-answer` relays
  // unordered, like presence.
  //
  // The host opened a poll. Replaces any poll already on screen (one at a
  // time per document).
  | { kind: 'poll-start'; poll: LivePoll }
  // One participant's answer; `null` means they skipped. Keyed by sender
  // on receipt, so re-sending REPLACES that person's earlier answer
  // rather than stacking a second one. Allowed from view-role senders
  // too (docs/specs/012-collaboration/live-poll.md), polling an audience on a view link is the point.
  //
  // `key` is the answerer's collab key (docs/specs/012-collaboration/collab-race-hardening.md): answers used to be keyed
  // by the per-socket presence id, so re-answering after a reconnect counted
  // twice. Optional so an older client still parses.
  //
  // `proof` is the sender's per-browser collab secret (docs/specs/012-collaboration/vote-integrity.md): it proves the
  // key is the sender's own. The room checks it and NEVER relays it; a relayed or replayed answer carries the key the
  // room decided and no proof.
  | { kind: 'poll-answer'; pollId: string; value: string | null; key?: string; proof?: string }
  // The host ended the poll: drop the question, the answers, and the
  // panel everywhere. Edit-role only, like poll-start.
  | { kind: 'poll-end'; pollId: string }
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
  // A Q&A board's whole state after a server write (docs/specs/012-collaboration/qa-board.md). Replaces the
  // element's notes when `rev` is newer than the local `qaRev`.
  | { kind: 'qa'; tabId: string; elementId: string; notes: QaNote[]; rev: number }
  // One changeset the api applied (docs/specs/024-agents/agent-changesets.md "What the room does").
  // Worker-originated through /mutation.
  | ChangesetRoomOp
  // The document went to the Trash (docs/specs/013-workspace/trash.md). Every
  // session shows the deleted state; the room then closes every socket (4004).
  // Worker-originated, like share-revoked.
  | { kind: 'document-trashed' };
