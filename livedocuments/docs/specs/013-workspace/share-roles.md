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

- **The levels are a ladder**: every level holds everything below it.
- **A Viewer only looks.** A comment and a reaction are both taking
  part, which is a Participant's. A Viewer's selection shows its badge and holds nothing: it never stops anyone
  editing the element it looks at.
- **A checklist tick is editing**: it is one shared value, not a person's answer.

## What a Participant changes

A Participant edits **text**, and nothing else.

| May                                                                                                                                               | Never                                                                                                                                                                                                                                                                    |
| ------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Change the words of an element already on the page: a label, a text box, a sticky, a table's cells                                                | Add any element; delete, duplicate or paste one                                                                                                                                                                                                                          |
| Change an image's description (alt text) and caption                                                                                              | Swap an image's picture                                                                                                                                                                                                                                                  |
| Write in an article already on the tab: add, change and remove its paragraphs, lists and code, and write in its tables' cells                     | Change an article's style (its header and footer included), insert or move its zones, dividers, page breaks, tables and contents, add or remove a table's rows or columns, add a margin note, add or remove an article ([Article pages](../007-editor/article-pages.md)) |
| Write on a flashcard already on the tab, as in an article; flip through the cards                                                                 | Add, duplicate, split, move or delete a card, or set its style ([Flashcards](../007-editor/flashcards.md))                                                                                                                                                               |
| Find and replace in the text it may write: an article's writing and elements' text fields ([Find and replace](../007-editor/find-and-replace.md)) | Replace in any other text (a checklist's items), or in anything locked                                                                                                                                                                                                   |
| Undo and redo its own writing (the room puts back any part it may not make)                                                                       | Move, resize, rotate, restyle, recolour, lock, group or reorder anything; a table's rows and columns                                                                                                                                                                     |
| Nothing about tabs or pages                                                                                                                       | Add, rename, reorder or delete tabs or pages; change a tab's theme, canvas or finish; change a page's size, background or layout; tidy a page ([Tidy Up](../007-editor/pages-mode.md#tidy-up)); rename the document                                                      |

- **Text is an allow-list.** Each element kind names the fields that are its words (`PARTICIPANT_TEXT_FIELDS`); any
  other field, or a kind with none, is an Editor's. A new field is an Editor's until someone decides it is text.
- **A text box that sizes to its words follows them**: writing on it resizes it, since its size is the words', never
  a choice. Every other element keeps its size whatever its text.
- **A table's cells change words, never shape**: the same rows and columns, every cell plain text.
- **Locked means locked.** Nothing on a locked tab, a locked layer or a locked page, and no locked element, takes a
  Participant's writing.
- **A Participant never grows the pages.** When its writing needs another page, an Editor's screen lays the article
  out and adds it, as it does for an agent's writing.
- **Nothing offers what a session cannot do.** A Participant or Viewer sees no palette, no Slides button or Slide
  Deck command, no page panel or page actions, no tab menu, and in an article no insert menu, zone bars or page
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

## Ownership

Ownership is a set of powers, held by the document's **owner** (its creator) and every joined member of the team it is
filed in. Who holds them is the index's to say: it issues the owner and team members an `edit` grant, and keeps
sharing, moves and the Trash to them ([one-explorer-contracts.md](../../../../liveworkspace/docs/specs/004-index/one-explorer-contracts.md)
"Sharing and access"). No level grants any of them. A named set of ownership powers is [planned](#later).

## Share links

Share links are the index's, made and managed in the shared Share dialog (`ShareDialog` in
[`@liveworkspace/explorer`](../../../../packages/explorer/README.md)). What livedocuments owns is what each level may do
once a document is open.

- The Share dialog offers three levels, in this order: **Viewer** ("Watches along. Can’t comment or change a
  thing."), **Participant** ("Comments, votes and works items. Can’t reshape it.") and **Editor** ("Works with you
  in real time."). Each link shows its level on a chip and can be changed in place.
- A link visitor's level comes from the grant the index issues for the link (`level`, and `tab` when the link opens
  one tab). The api and the room check it on every request and socket ([API](../015-api/api.md) "Access").
- The editor's role pill reads Editing, Participating or Viewing.
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

## Reading a level

- **An edit link is Editor; a view link is Viewer, which only looks.** An owner who wants an audience to chime in
  issues a Participant link.
- **Nothing escalates.** Every reader of a level reads an unknown value as Viewer.

## Telemetry

`Document·Joined` takes the type `Participate` beside `Edit` and `View`
([Telemetry](../017-telemetry/telemetry.md)).

## Later

**Status: Planned.** Not built yet; today an API token carries only the read-only flag, ownership powers stay
implicit in owning the document, and each browser mints its own collaboration key.

- **Token levels**: API tokens carry view, participate or edit instead of the read-only flag.
- **Ownership powers** as a named set every door asks beside the level.
- **Server-derived collaboration keys**, pinned per socket, so nobody can act as someone else's session.

## Domain language

**Participant** is this access level. A person's name and colour (their profile at the liveworkspace accounts Worker, `GET /api/participants`) are their **display identity**
(name, colour); prose calls them that, never "participant" ([Domain language](../003-system-architecture/domain-language.md)).
