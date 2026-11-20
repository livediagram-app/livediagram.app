# Share roles

Everyone who reaches a document without owning it, by a share link or an embed, does so at one of three **access
levels**: **Viewer**, **Participant** or **Editor**. **Ownership** is not a level: it is a set of powers over the
document, held apart from editing. The research behind this is in `docs/research/access-levels/`.

## Why

Someone gathering feedback on a deck or an article has to hand the reviewers an edit link so they can comment and
fix a typo. An edit link also lets them restyle the pages, move the layout around and delete what others made, and
in a busy review somebody does. A view link is no answer either: it cannot comment or correct a word. The
Participant level is the middle: edit the text and comment, never reshape the document.

## The levels

| Level           | Wire name     | May                                                                                                                                                                                                                             |
| --------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Viewer**      | `view`        | Look only: open and read every tab it admits; pan, zoom, point, use the laser and spotlight, follow and be followed, appear in the presence stack, present on their own screen, export. Writes nothing: no comment or reaction. |
| **Participant** | `participate` | All of Viewer; comment, reply, resolve and reopen; react; edit the text of what is already on the pages and write in an article (see [What a Participant changes](#what-a-participant-changes)).                                |
| **Editor**      | `edit`        | All of Participant; change anything on the pages, its tabs and its tools' configuration.                                                                                                                                        |

- **A Participant never grows the pages.** When its writing needs another page, an Editor's screen lays the article
  out and adds it, as it does for an agent's writing.
- **A Participant holds what it writes**, as an Editor does: the paragraph or cell it types in is held for it until
  it lets go, and others' holds hold it back ([Article pages](../007-editor/article-pages.md#holding-a-paragraph)).
  A Viewer holds nothing.
- **Nothing offers what a session cannot do.** A Participant or Viewer sees no palette, no page panel or page actions, no tab menu, and in an article no insert menu, zone bars or page
  toolbar. Empty states describe instead of instructing: a comment thread invites only someone who may add.
- **The element menu shows only what the role may do.** A right-click on an element (a long-press on a touch screen)
  opens its menu for every role ([Element menu for Participants and Viewers](../008-canvas/element-menu-quick-bar.md#element-menu-for-participants-and-viewers)).
  An Editor's is the full menu. A Participant's offers **Add Comment** (or **View Comments**), **Edit Text** on what
  it may write on, and **Open Link**, **View Note** and **Copy Text** where the element has them. A Viewer's offers
  **Show Comments** on an element that has comments and no comment row on one that has none, plus **Open Link**,
  **View Note** and **Copy Text**. An element with nothing for the role opens no menu. There is no selection toolbar
  for any role (the element menu holds what it offered).
- **The server is the rule.** A Participant's changes travel as element and article changes the server applies one
  by one against the stored tab: its words land, every other field stays as stored, and an add, a delete or a
  reorder is refused. A stale screen therefore never writes an old copy of a tab over a newer one.
- **Undo** takes back the Participant's own writing; an undo that would make a forbidden change is refused like any
  other.
- **A key the role may not use stays the canvas's.** Delete, Backspace and the add keys do nothing on a selection;
  a Viewer's or Participant's Cmd/Ctrl+A, +D, +Shift+L and the z-order chords do nothing rather than reaching the
  browser, which selected the page's text or opened the bookmark dialog; copy stays the browser's, so text on the
  page can still be copied.
- **An emptied text box stays.** An Editor's text box left empty is removed; a Participant's stays, empty, because
  removing it would be a delete. A Participant's words never rename the document, a tab or a layer.

## Building a new feature

Every feature a shared document can reach states, in its own spec, what an Editor, a Participant and a Viewer may do
with it, and is gated and tested to match ([Gate a feature by share role](../../instructions/gate-a-feature-by-share-role.md)).
The defaults: a Viewer only looks; a Participant edits text and comments, but never adds, reshapes or restyles
anything or changes settings; the rest is an Editor's. The role tests (the participant rule's leak test, the editor
capabilities, the room) keep a new feature from widening a role by accident.

- **Version history** ([Version history](../006-document/version-history.md#who-may-do-what)): every level looks at a
  tab's versions (a tab link its own tab's); only an Editor names, restores or copies one. A Community visitor sees
  none.

## Ownership

Ownership is a set of powers, held by the document's **owner** (its creator) and every joined member of the team it is
filed in. Who holds them is the index's to say: it issues the owner and team members an `edit` grant, and keeps
sharing, moves and the Trash to them ([one-explorer-contracts.md](../../../../liveworkspace/docs/specs/004-index/one-explorer-contracts.md)
"Sharing and access"). No level grants any of them. A named set of ownership powers is [planned](#later).

## Share links

Share links are the index's, made and managed in the shared Share dialog (`ShareDialog` in
[`@liveworkspace/explorer`](../../../../packages/explorer/README.md)). What liveknowledge owns is what each level may do
once a document is open.

- The Share dialog offers three levels, in this order: **Viewer** ("Watches along. Can’t comment or change a
  thing."), **Participant** ("Comments, votes and works on items. Can’t reshape it.") and **Editor** ("Works with you
  in real time."). Each link shows its level on a chip and can be changed in place.
- A link visitor's level comes from the grant the index issues for the link (`level`, and `tab` when the link opens
  one tab). The api and the room check it on every request and socket ([API](../015-api/api.md) "Access").
- **Reopening without the code keeps the link's level.** A visitor who opened a link once reaches the document again
  by its own address (`/document/<id>`, a reload, Shared With Me, a bookmark) with no code. The index's grant still
  names the link (`link`, beside its `level` and `tab`), so the editor opens them as that link's visitor: its role,
  its tab, and its code on every write. Edit with no link is the owner's or a team member's. The role never comes
  from the address, so a Viewer or Participant is never shown Editing for saves the api would refuse
  (`openOwnAddress`, `@liveworkspace/workbench/lib/editor-arrival`, shared by every editor).
- **Losing access is explained, never silent.** A session ended by an access change (a link turned off, a password
  set, a grant whose level or tab changed on renewal) reloads into the access check, and a refusal then reads **No
  Longer Shared With You** ("Your access to this document was removed while you had it open. Ask its owner to share
  it with you again.") instead of "doesn't exist or isn't yours". The editor notes the reason in `sessionStorage`
  just before it goes and the first page after takes it once (`apps/editor/lib/access-notice.ts`, honoured for a
  minute). A session whose link is revoked leaves for the Explorer at `/explorer?ended=revoked`: the Explorer is
  liveworkspace's, on another origin, so the reason rides in the address, and the Explorer says once that the link
  was revoked (liveworkspace/docs/specs/010-site/site.md "Addresses handed over").
- The collaborators list badges each person Editor, Participant or Viewer.
- **Embeds look only below Editor**: an embed of a Participant link renders as a Viewer, since an embed has no
  identity screen to put a name on what it adds ([Embeds](embeds.md)).

## Integrity

- **Participation is its own class of room op**, between presence (anyone) and mutation (editors): every mutation
  from a Participant's socket is dropped but its element changes and its article writing, which go through the
  server (below).
- **Content goes through the server.** A Participant never saves a whole tab and its changes are never relayed
  as sent: the room applies the rule to the stored tab, stores the result, and relays what it accepted to everyone.
  A refused element change is answered with the change that puts the sender's screen back; refused writing
  reloads the sender's copy of the tab.
- **Peers take only what a Participant changed.** The room relays a Participant's update as the fields it changed,
  never the stored element whole, so an Editor's change that has not been saved yet is never undone by it. Its
  article writing is relayed block by block, marked for an Editor's screen to grow the pages.
- **A held-back gesture says so.** When the editor holds back a change a Participant may not make, it shows one
  short notice for the burst ("As a participant you can edit text and comment.") rather than failing silently.
- **A link to one tab stays on it**: writing for any other tab is dropped.
- **Placing images is an Editor's.** An image someone else owns is granted to a document only when its owner is a
  team member or an Editor there; a Participant's access places no image.

### The collab key

A person's **collab key** is the public id their [comment reactions](../012-collaboration/comment-reactions.md) are recorded under. The server derives it; the browser never
chooses it.

- **From who you are.** `collabKeyFor(person)` (`@liveworkspace/api-kit/collab-key`) is the first 32 hex characters
  of SHA-256(`liveworkspace:collab:v1:<person>`), the person being the account or guest id the grant names. It is
  the same on every device and every document, so a signed-in person's own reactions read as theirs everywhere, and
  their two devices count as one person. It gives nothing away: the hash cannot be turned back into the id.
- **Pinned on the session.** The upgrade forwards it as `X-Verified-Collab-Key`, the session keeps it, and the
  roster's `key` is that value whatever the `hello` claimed. The room then tells the session its own key in a
  `collab-key` frame sent to that socket alone, and the editor records its reactions under it from then on. Before
  that (a document only Offline, or the moment before the room answers) the editor uses this browser's own
  key, as it always did.
- **A guest who signs in keeps their entries.** When a guest becomes an account, the index keeps the guest as an
  alias of the account, and every grant for the account names the collab keys of its aliases (`aliases`, at most 32;
  [one-explorer-contracts.md "Becoming an account"](../../../../liveworkspace/docs/specs/004-index/one-explorer-contracts.md#guests)). The upgrade forwards them as `X-Verified-Collab-Aliases`, the session keeps them, and the `collab-key`
  frame carries them beside the key. The room, the api and the editor read reactions under any of the person's keys
  as theirs: shown as theirs, theirs to take back (taking one back clears it under every key of theirs), kept or
  changed as theirs by a whole-tab write, and counted once. New entries go under the session's own key. Nothing
  stored is rewritten (owner, 2026-11-15, Work Tracker 678).
- **A session with no identity** (a link visitor whose guest handoff could not run) gets a random key the room mints
  for that socket. Nobody else can be handed it, so nobody can act under it; it lasts as long as the socket.
- **Nobody acts as someone else, at any level.** The room stamps every reaction's `by` with the sender's key, an
  Editor's included, so a reaction can only ever be the sender's own. A Participant's reaction, sent over REST, is recorded under the caller's derived key; the key the request names
  is ignored.
- **Whole-tab writes keep other people's entries.** A write that replaces a tab whole (the tab save, an agent's
  changeset and its revert, which the REST and MCP document updates go through, and a re-commit, which an offline sync
  sends) may change only the writer's own reactions. For anyone else's, what is stored is the room ledger's latest on or
  off for that person when the ledger has one, and otherwise what the stored tab held, so another person's live entry
  the saver had is kept and one it made up, changed or took away is not. A token answers as nobody. The api reads the
  ledger only for the elements where the write differs from the stored tab on someone else's entry; a room that
  cannot answer keeps the stored entry. A reaction stored under an old browser key goes when the same comment holds
  the same emoji, under the same name, from a collab key. The lock is one shared rule
  (`@liveworkspace/model-core/person-entry-lock`, read beside the ledger's `RoomLedgerStore.readKeys`).
- **What stays open.** This product's write paths do not take the lock yet: livediagram's took it first (Work
  Tracker 677, part 1) and this product's follow in a later part. Until then an Editor's whole-tab save can still
  write any of these into the stored tab; the room's ledger keeps each person's latest live entry, so a save made
  before one arrived cannot erase it.
- **Reactions left before this** were filed under each browser's own key. They still show and count, but no longer
  as yours; reacting again records yours under the new key.
- **An editor from before this**, still open when it ships, keeps its browser's key. The room stamps its reactions
  with the server's key, so peers see them as its person's; a reload, which the new-version prompt offers, brings it
  in line.

## Reading a level

- **An edit link is Editor; a view link is Viewer, which only looks.** An owner who wants an audience to chime in
  issues a Participant link.
- **Nothing escalates.** Every reader of a level reads an unknown value as Viewer.

## Telemetry

`Document·Joined` takes the type `Participate` beside `Edit` and `View`
([Telemetry](../017-telemetry/telemetry.md)).

## Later

**Status: Planned.** Not built yet; today an API token carries only the read-only flag, ownership powers stay
implicit in owning the document.

- **Token levels**: API tokens carry view, participate or edit instead of the read-only flag.
- **Ownership powers** as a named set every door asks beside the level.

## Domain language

**Participant** is this access level. A person's name and colour (their profile at the liveworkspace accounts Worker, `GET /api/participants`) are their **display identity**
(name, colour); prose calls them that, never "participant" ([Domain language](../003-system-architecture/domain-language.md)).
