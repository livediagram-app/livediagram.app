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
  from four places only:
  - the tab's load: the elements as the api answered them, before the editor's own load fixes (a ragged table made
    rectangular), with the revision beside them;
  - a whole-tab save's answer: the elements it echoes, and its revision;
  - a delta save's answer whose digest is the one sent: the store then holds exactly the elements the editor sent,
    and they are the base copy at the answer's revision.
  - a peer's save, relayed by the room ([A peer's save moves the base copy](#a-peers-save-moves-the-base-copy)):
    the elements the editor holds as stored, once they prove to be what the peer's save stored.

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
- The flush also keeps a **draft** of each tab it sends in this browser ([Drafts](#drafts-of-unsaved-changes)). An
  edit whose flushed delta is refused as the page closes, or whose request never lands, comes back on the next load
  and saves, as long as nobody saved the tab since; if somebody did, it is dropped and a toast says so.

## A peer's save moves the base copy

Two Editors on one big tab each hold a base copy, and each save moves only the saver's copy forward. Before this, the
other editor's next save was always a refused delta (`stale_base`, about 1 KB) followed by the whole tab (about 610 KB
at 2,000 elements), so delta saves were lost exactly on shared big tabs (Work Tracker 808). So each save is announced
to the room, and a peer moves its base copy forward when it can prove it holds what was stored.

- **The announcement.** Once an Editor's save of a tab lands and its element ops are relayed, the editor sends one
  more room op, `tab-saved { tabId, rev, digest }`: the revision the save wrote and the digest of the elements now
  stored, as the editor's own base copy holds them (a delta's answer names the digest; a whole save's echo is
  hashed). It goes after the save's element ops, on the same socket, so every peer applies those first. A save the
  editor holds no base copy for afterwards (an answer that merged something it cannot see) announces nothing.
- **The peer's check.** A peer that receives one takes the tab as its autosave's baseline holds it (what peers and
  the store already have, the relayed ops applied, the peer's own unsaved edits not), as a save would send it, and
  hashes its elements. Only when that digest is the announced one does the peer hold those elements as its base copy
  at the announced revision. A peer that holds a copy for that revision or a newer one, has not loaded the tab, or is
  not an Editor does nothing.
- **Nothing is trusted.** A wrong announcement, a peer whose baseline differs from the store (a merge it did not see,
  an element it holds in another key order) or a forged one only fails the digest and moves nothing, or moves the copy
  to a revision the api then refuses as `stale_base`: either way the next save is whole, as before. The api proves
  every delta by its own digest regardless.
- **Ordering.** `tab-saved` is a mutation op: the room sequences it after the save's element ops, logs it for a
  reconnecting peer's catch-up (an older revision is ignored there), and relays it only from an Editor. It changes no
  content and the room's ledger does not track it.

## Drafts of unsaved changes

The page closing cannot wait for the api's answer, so an edit the close-time flush sent and the api refused (or that
never landed: the connection was down, the page went first) was lost (Work Tracker 810). So the editor keeps a draft
of each tab the flush sends, in this browser, and the next load decides what to do with it.

- **What is drafted.** When the unload flush ([Unload](#unload)) sends a tab, it first writes a draft of it: the tab
  as the flush sends it (elements and every other field), the revision of the base copy it was based on, the ids of
  the elements it changed and removed over that base copy (when the flush planned a delta). Only an Editor's flush of a cloud document writes one (an offline document is already in this browser; a Participant's
  changes go to the room), and only for a tab the editor holds a base copy for (a tab never stored has no revision to
  check against).
- **Where.** IndexedDB, in a database of its own (`livediagram-drafts`), one draft per person, document and tab: a
  newer draft of the same tab replaces the older one. Nothing is sent anywhere. A draft larger than
  `TAB_DRAFT_MAX_CHARS` (4,000,000 characters of JSON, about six times a 2,000-element tab) is not written, and an
  older draft of that tab is removed, so a draft is never older than the tab's last flush. Every read and write is
  wrapped: a browser without IndexedDB, a full disk or a private window just keeps no drafts, and the editor works as
  before. The load waits at most a second (`TAB_DRAFT_READ_TIMEOUT_MS`) for the read, then goes on without it.
- **Cleared when a save lands.** A save of the tab that started after the draft was written and landed (the flush's
  own delta or whole tab, when the page lives on to hear it, or any later autosave) removes it.
- **On the next load**, when the editor loads that tab for the same person, it reads the draft beside the tab:
  - the stored elements are the draft's, or every element the draft changed is stored as the draft has it and every
    one it removed is gone: the flush landed after all, so the draft is removed and nothing is shown;
  - otherwise, the api still holds the draft's revision: nobody saved the tab since. The draft is put on screen as an
    unsaved edit over the stored tab (the autosave's baseline stays the stored tab), so the autosave saves it and
    relays it to the room as any edit, a delta over the base copy where it can be. An info toast says "Restored your
    last unsaved edit to “Tab name”." A tab already edited since it loaded keeps those edits instead;
  - otherwise somebody saved the tab since the draft's revision. The draft never overwrites their work: it is
    removed, and a warning toast says "Couldn't apply your last unsaved edit to “Tab name”: the tab changed since."
- **Another browser** never sees a draft: it lives in the browser that wrote it. A draft written in one browser while
  the same person edits the tab in another is just an older revision there, and drops with the toast.
- **Share roles.** Only an Editor writes a draft, and only an Editor's editor puts one back on screen. A session that
  is no longer an Editor of the document leaves the draft where it is, so it can come back once that person may edit
  again, until a save lands or somebody else's save overtakes it.

## Share roles

- **Editor**: may send a delta save, exactly where a whole-tab save is allowed.
  Announces its saves (`tab-saved`), moves its base copy from a peer's, and writes the unload flush's drafts.
- **Participant**: never sends one. A Participant's changes go to the room as ops, which applies them through the
  participant content rule ([Share roles](../013-workspace/share-roles.md)); the delta door refuses them `403` as the
  whole-tab save does. It sends no `tab-saved` (the room drops one from it, as every mutation op but its own answers)
  and keeps no draft.
- **Viewer**: refused `403`. Sends no `tab-saved` and keeps no draft.

## Decisions

- **A REST door, not the room's ops path.** Work Tracker 661 left open whether Editors' saves should ride the
  Participant room-ops path instead. They do not: the room path needs an open socket (a Participant's save fails while
  it is closed), cannot carry the unload flush's keepalive requests, and skips what the whole-tab save does at the
  write (the unseen changesets, the comment authors, the empty-tab backstop, the emails and pushes). A REST door that
  rebuilds the whole tab and hands it to the same path keeps every one of those rules in one place.
- **A synchronous digest at unload.** Web Crypto answers only after the page has gone, so the flush hashes in plain
  code (about 20 ms for a 700 KB tab, once, on the way out). Planned this way the delta is sent in the same event,
  before the page tears down.
- **A draft replays only over its own revision** (Work Tracker 810). A draft older than what the api holds is never
  merged in: somebody else's newer work wins, and this browser is told its edit did not make it. A merge of the
  draft's ops over the newer tab was considered and left out: it would bring back an edit next to changes its author
  never saw.
- **Drafts at the unload flush only.** The flush is the one save whose answer the editor cannot wait for; every other
  save that fails is retried while the page is open. Drafting every autosave would cost a write of the whole tab per
  save for no case the retry does not already cover.
- **The peer proves its copy.** A relayed save carries a digest, not the elements: the room already relays the ops,
  and the peer's own baseline plus a digest check costs one hash per peer save instead of a second copy of the tab on
  the wire (Work Tracker 808).
- **Proved, not trusted.** The api compares a digest of the rebuilt elements with the editor's instead of trusting the
  ops, so the delta path can never store anything a whole-tab save would not have.
- **The other fields go whole.** A tab's name, kind, mode, layers and settings are a few hundred bytes; only elements
  grow with the board.
- **livediagram first.** The other editors (liveplanner, livedocuments, livedesign, livehuddle) follow on their own
  cards; the shared envelope (`@liveworkspace/api-schema/tab-delta`) is theirs to reuse.

## What this does not change

- The whole-tab `PUT` stays, for every save the delta path does not take.
- What is stored, the tab revision, the changesets and the room are unchanged.
