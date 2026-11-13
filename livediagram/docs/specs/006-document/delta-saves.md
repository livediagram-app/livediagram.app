# Delta saves

An Editor's autosave of a tab sends only the elements that changed, as element ops, instead of the whole tab. The api
rebuilds the whole tab from the stored copy and the ops, proves the rebuild is exactly the tab the editor holds, and
then saves it through the same path as a whole-tab `PUT`. When anything does not line up, the api refuses the delta
and the editor sends the whole tab, as every save does today.

## Why

- Every autosave (600 ms after the last edit, [Per-tab storage](per-tab-storage.md#saving)) `PUT`s the whole tab. A
  2,000-element tab is about 300 KB per save (Work Tracker 661 measured 299,648 bytes), sent each time someone pauses
  while typing. The CPU cost is small (about 0.6 ms to serialise, and an unchanged tab is not saved at all); the cost
  is the upload, which hurts on phones, tablets and slow connections.
- The editor already derives the change as element ops (`diffToElementOps`) for the realtime room
  ([Realtime conflict resolution](../012-collaboration/realtime-conflict-resolution.md)). A one-label edit is one
  `update` op of a few hundred bytes.
- The unload flush has a 64 KB keepalive budget; a large tab's whole body cannot ride it (Work Tracker 589). A delta
  usually can.

## What a delta save is

`POST /api/documents/:id/tabs/:tabId/delta`, a JSON body:

| Field     | What it is                                                                                                             |
| --------- | ---------------------------------------------------------------------------------------------------------------------- |
| `baseRev` | The tab revision the editor's base copy is ([Agent changesets](../024-agents/agent-changesets.md), "The tab revision") |
| `ops`     | The element ops that turn the base copy's elements into the editor's: `diffToElementOps(base, current)`                |
| `digest`  | SHA-256 (lowercase hex) of `JSON.stringify` of the editor's current elements, as it would send them whole              |
| `tab`     | Every other field of the tab as a whole-tab save would send it (name, kind, mode, layers, settings), no elements       |

The same headers as the whole-tab save ride with it: `X-Changeset-Seen`, `X-Room-Cursor` and `X-Allow-Empty`.

The **base copy** is the tab exactly as the api stores it at `baseRev`: what a whole-tab save's answer echoes, or what
a delta save's answer confirms (below). It is never the editor's own last-sent copy, since the api may have merged
changesets, the room's ledger or comment authors into what it stored.

## How the api applies it

1. The same doors as the whole-tab save: an API token is refused `405 use_changesets`; the caller must be the owner or
   hold an edit-role grant on this tab (a tab-scoped link on its own tab only).
2. The body is checked: `baseRev` a whole number, `digest` 64 lowercase hex characters, `ops` a list of well-formed
   ops, `tab` an object. A malformed body is `400`.
3. The stored tab is read. The delta is **refused** (`409 delta_refused`, with a `reason`) when:
   - `too_many_ops`: more than 500 ops (a diff that large saves little; the whole tab is sent instead);
   - `no_base`: the tab is not stored (a new tab is always saved whole);
   - `stale_base`: the stored revision is not `baseRev` (another writer saved since);
   - `digest_mismatch`: the stored elements with the ops applied are not, byte for byte, the elements the editor
     holds.
4. Otherwise the rebuilt tab (`tab` with the rebuilt elements) goes through the whole-tab save's path unchanged: the
   schema gate, the changesets the editor had not seen and the room's ledger merged in, the name cap, the empty-tab
   backstop, the Q&A notes rule, the comment authors, the write at the revision read, the comment emails and pushes.
5. It answers `200 { rev, digest }`: the revision written and the digest of the elements now stored. When that digest
   is the one the editor sent, the store holds exactly the editor's elements and they are its next base copy;
   otherwise (the save merged something in) the editor has no base copy and its next save is whole.

The digest check is what makes the delta path safe: a delta is only ever stored when it rebuilds exactly the tab a
whole-tab save would have sent, so a bug in applying ops, or a base copy the editor got wrong, can only ever cost a
fallback, never a tab.

## How the editor uses it

The autosave sends deltas, and so does the unload flush (below, [Unload](#unload)).

- The editor holds one **base copy** per tab: the elements exactly as the api stores them at a revision. It comes
  from three places only:
  - the tab's load: the elements as the api answered them, before the editor's own load fixes (a ragged table made
    rectangular), with the revision beside them;
  - a whole-tab save's answer: the elements it echoes, and its revision;
  - a delta save's answer whose digest is the one sent: the store then holds exactly the elements the editor sent,
    and they are the base copy at the answer's revision.

  A base copy is never replaced by one for an older revision (a slower answer is ignored). It is dropped on a
  refusal and on a delta answer whose digest differs, so the next save is whole. The editor holds base copies for
  at most 16 tabs, the most recently used.

- An Editor's save of a tab it holds a base copy for sends a delta when the delta is small: at most 500 ops and a
  body at most half the size of the elements sent whole. Otherwise, and for a new tab, it sends the whole tab.
- A `409 delta_refused` is answered at once with the whole-tab save, in the same save. Any other failure is a failed
  save, retried as today ([Per-tab storage](per-tab-storage.md#a-refused-save-stops-a-failed-save-doesnt)). The
  whole save's own refusals (`409 empty_tab_overwrite_blocked`, `409 tab_busy`, `403`, `413`) reach the editor from
  a delta exactly as from the whole save.
- Only livediagram's editor sends deltas; the other editors' saves stay whole until their own cards turn it on.
- The room relay and the own-write hold are unchanged: the ops are derived at the snapshot and relayed after the save
  lands, whichever way it went ([Collaboration race hardening](../012-collaboration/collab-race-hardening.md#saves)).
- The unload flush sends a delta where it has one, so a large tab's last edits fit the keepalive budget (Work Tracker
  589; [Unload](#unload)).
- An offline document (This Browser) never sends one: it has no api.

## Unload

What the debounce still holds when the editor goes is flushed at once ([Per-tab storage](per-tab-storage.md#saving)):
on `beforeunload`, on `pagehide` and when the editor unmounts for another page of the app. Those requests outlive the
page only as `keepalive` requests, which browsers cap at 64 KB in all per page (the flush uses 60 KB). A whole
2,000-element tab is several hundred KB, so before delta saves its last edits rode a plain request that dies with the
page (Work Tracker 589).

- **A delta first.** For each changed tab the editor holds a base copy for, the flush plans a delta by the autosave's
  rules (at most 500 ops, a body at most half the elements' JSON). It plans synchronously, since the page is going
  and cannot wait: the digest is taken in plain code, the same SHA-256 the autosave takes with Web Crypto.
- **Within the keepalive budget.** The delta goes, as a `keepalive` request with the whole flush's headers, only when
  its body fits what is left of the budget. A one-shape edit on a 2,000-element tab is under 1 KB.
- **Otherwise as before.** No base copy, a diff too large, or a delta past the budget: the tab goes whole, as
  `keepalive` while it fits and as a plain request past that.
- **A refused delta** (`409 delta_refused`) stores nothing. Where the page lives on (the editor unmounted for another
  page of the app, or the page kept in the back-forward cache), the whole tab follows as soon as the refusal answers,
  as the autosave's fallback does. A landed delta whose digest matches is the tab's next base copy.
- An offline document, a Participant (whose changes go to the room) and a refused or deleted document flush exactly as
  before.

What is guaranteed:

- Nothing but the editor's exact tab is ever stored from the flush: the digest check holds there as everywhere.
- A tab's last edits survive a closed page when its delta fits the budget and lands, which a whole large tab never
  could. A delta is refused only when someone else saved the tab since this editor's base copy, or the base copy was
  wrong.
- The editor keeps no local copy of unsaved changes ([Load recovery](../007-editor/load-recovery.md): they are held in
  memory only). So an edit whose flushed delta is refused as the page closes is lost, as a large tab's whole flush was
  before, and the next load shows the tab as last stored. A draft kept in the browser for that case is a follow-up
  (Work Tracker 661).

## Share roles

- **Editor**: may send a delta save, exactly where a whole-tab save is allowed.
- **Participant**: never sends one. A Participant's changes go to the room as ops, which applies them through the
  participant content rule ([Share roles](../013-workspace/share-roles.md)); the delta door refuses them `403` as the
  whole-tab save does.
- **Viewer**: refused `403`.

## Decisions

- **A REST door, not the room's ops path.** Work Tracker 661 left open whether Editors' saves should ride the
  Participant room-ops path instead. They do not: the room path needs an open socket (a Participant's save fails while
  it is closed), cannot carry the unload flush's keepalive requests, and skips what the whole-tab save does at the
  write (the unseen changesets, the comment authors, the empty-tab backstop, the emails and pushes). A REST door that
  rebuilds the whole tab and hands it to the same path keeps every one of those rules in one place.
- **A synchronous digest at unload.** Web Crypto answers only after the page has gone, so the flush hashes in plain
  code (about 20 ms for a 700 KB tab, once, on the way out). Planned this way the delta is sent in the same event,
  before the page tears down.
- **No draft in the browser yet.** Keeping unsaved changes in browser storage for the next load to save is a new
  recovery path with its own conflicts (another writer since, another browser); it is not needed for the common case
  this fixes, a large tab's last edit by its only editor, and is left to its own card.
- **Proved, not trusted.** The api compares a digest of the rebuilt elements with the editor's instead of trusting the
  ops, so the delta path can never store anything a whole-tab save would not have.
- **The other fields go whole.** A tab's name, kind, mode, layers and settings are a few hundred bytes; only elements
  grow with the board.
- **livediagram first.** The other editors (liveplanner, livedocuments, livedesign, livehuddle) follow on their own
  cards; the shared envelope (`@liveworkspace/api-schema/tab-delta`) is theirs to reuse.

## What this does not change

- The whole-tab `PUT` stays, for every save the delta path does not take.
- What is stored, the tab revision, the changesets and the room are unchanged.
