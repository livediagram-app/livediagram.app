# Share roles

**Status: built** (Viewer, Participant, Editor links). The items under [Later](#later) are planned.

Everyone who reaches a project without owning it, by a share link or an embed, does so at one of three **access
levels**: **Viewer**, **Participant** or **Editor**. **Ownership** is not a level: it is a set of powers over the
project, held apart from editing. The research behind this is in `docs/research/access-levels/`.

## Why

A facilitator running a retrospective has to hand the team an edit link so they can add stickies, type and vote.
An edit link also lets them switch the tab's mode, drag frames away, delete the columns and reshape the board, and
in a lively session somebody does. A view link is no answer either: it cannot add a sticky or cast a dot. The
Participant level is the middle: take part in the board, never reshape it.

## The levels

| Level           | Wire name     | May                                                                                                                                                                                                                                                                                                                                                  |
| --------------- | ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Viewer**      | `view`        | Look only: open and read every tab it admits; pan, zoom, point, appear in the presence stack, export. Writes nothing: no comment, vote or answer.                                                                                                                                                                                                    |
| **Participant** | `participate` | All of Viewer; comment, reply, resolve and reopen; take part in session tools; add, write and arrange stickies and text; place images and swap their pictures; grow mind maps; write on any element but a Behaviour, a table's cells included; work with Plan cards and Sheet cells (see [What a Participant changes](#what-a-participant-changes)). |
| **Editor**      | `edit`        | All of Participant; change anything on the drawing, its tabs, its modes and its tools' configuration.                                                                                                                                                                                                                                                |

- **The levels are a ladder**: every level holds everything below it.
- **A Viewer only looks.** A comment, a vote and an answer are all taking part, which is a Participant's. A Viewer's selection shows its badge and holds nothing: it never stops anyone
  editing the element it looks at.
- **Running a session is an Editor's hat**: starting, ending, revealing, clearing and pacing stay with
  editors. A Participant takes part and never runs.
- **A checklist tick is editing**: it is one shared value, not a person's answer.

## What a Participant changes

A Participant changes the board's **content**, never its **shape**.

| May                                                                                                                                                                                                                                                                                                                                                                                               | Never                                                                                                                                                                                                                                                                                                            |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Take part in session tools: cast and withdraw dots, answer temperature checks                                                                                                                                                                                                                                                                                                                     | Start, end, reveal, clear or configure a session tool; spin a Picker                                                                                                                                                                                                                                             |
| Add a sticky, a text element or an image; grow a mind map (a node as a branch of one already there, with the connector joining them)                                                                                                                                                                                                                                                              | Add any other element: shapes, free connectors, frames, templates, kits; a mind node with no branch to grow from                                                                                                                                                                                                 |
| Write on any element: change its text (a sticky's, a shape's label, a table's cells)                                                                                                                                                                                                                                                                                                              | Change any other field of an element it did not add: size, style, rotation, layer, lock; write on a Behaviour (a poll's question, a timer's or mode button's caption); change an entity's fields, its keys or its relationships' cardinality (a data model's structure, [The entity](../009-elements/entity.md)) |
| Move and resize any sticky or image; recolour any sticky; move any mind node, and turn a mind connector's faces, so a growing map re-lays itself; swap any image's picture                                                                                                                                                                                                                        | Move, resize or restyle anything else, text boxes included; turn (rotate) anything someone else added                                                                                                                                                                                                            |
| Delete anything it added itself, and any mind node (with its connector)                                                                                                                                                                                                                                                                                                                           | Delete anything someone else added                                                                                                                                                                                                                                                                               |
| Change anything about what it added (size, style, text), so long as it stays something it could add                                                                                                                                                                                                                                                                                               | Reorder layers; group; lock; point its connector at anything but two mind nodes                                                                                                                                                                                                                                  |
| On a Plan board: add a card, edit its fields (assigning it to a [custom assignee](../026-plan/items.md#who-may-do-what) included, and linking an existing card here with [Link Existing](../026-plan/item-types.md#link-existing)), move it between columns (an Actions board's linked card too: its action follows once an Editor's editor heals, [Linked boards](../026-plan/linked-boards.md)) | Columns, card types, custom fields, board settings; delete, trash or archive a card; set, change or stop a card's [repeat](../026-plan/items.md#repeating-cards); restore one with its votes; clear or keep a template's example cards; set a card's [Blocked By](../026-plan/item-types.md#blocked-by) links    |
| On a Sheet: write cells' values, pick from dropdowns and tick checkboxes (checked by the Sheet's validation rules)                                                                                                                                                                                                                                                                                | Cells' formats, rows and columns, the Sheet's title, its validation and format rules, adding or removing a Sheet                                                                                                                                                                                                 |
| Undo and redo its own changes (the room puts back any part it may not make)                                                                                                                                                                                                                                                                                                                       | Undo or redo anyone else's                                                                                                                                                                                                                                                                                       |
| Nothing about tabs                                                                                                                                                                                                                                                                                                                                                                                | Add, rename, reorder or delete tabs; change a tab's mode, theme, canvas or finish; tidy a tab's layout ([Tidy Up](../008-canvas/layout-cleanup.md#the-tidy-up-button)); rename the project                                                                                                                       |

- **"It added"** means the server recorded the Participant as the element's adder when the element was created.
  An element an Editor added, or one added before this level existed, belongs to nobody a Participant can claim.
- **Stickies and images are the content**, so a Participant arranges them whoever added them: moves and resizes
  them. Shapes, frames, connectors and someone else's text boxes (which often label the structure) stay where
  their author put them; a text box that sizes to its words still follows them when a Participant writes on it,
  and a mind node grows to fit the label a Participant writes on it (taller only, in the same change).
- **Nothing offers what a session cannot do.** A Participant or Viewer sees notimer controls on a timer element; a
  Participant sees no Sheet toolbar, row, column, merge or settings controls (cells only). Empty states describe
  instead of instructing: a mood meter
  asks only someone who may answer, a comment thread or card finder invites only someone who may add. A Viewer's
  selection toolbar offers **Show Comments** on an element that has comments, to read them, and no comment button
  on one that has none (a Participant's offers **Add Comment** everywhere). A right-click on an element (a long-press
  on a touch screen) opens its element menu for every role, holding only what the role may do: an Editor's is the
  full menu; a Participant's offers **Add Comment** (or **View Comments**), **Edit Text** on what it may write on, and
  **Open Link**, **View Note** and **Copy Text** where the element has them; a Viewer's the same without **Edit Text**,
  and **Show Comments** only on an element with comments ([Element menu for Participants and Viewers](../008-canvas/element-menu-quick-bar.md#element-menu-for-participants-and-viewers)). A Participant
  writes on comment panels and adds Plan cards from a board's card type chips and Add card, as it may.
- **The server is the rule.** A Participant's content changes travel as element changes the server applies one by
  one against the stored tab: a permitted change lands, a forbidden field is left as stored, a forbidden add or
  delete is refused. A stale screen therefore never writes an old copy of the board over a newer one.
- **Undo** takes back the Participant's own steps; an undo that would make a forbidden change is refused like any
  other.
- **A chord the role may not run stays the canvas's.** A Viewer's or Participant's Cmd/Ctrl+A, +D, +Shift+L and the
  z-order chords do nothing rather than reaching the browser, which selected the page's text or opened the bookmark
  dialog; copy stays the browser's, so text on the page can still be copied.

## Building a new feature

Every feature a shared project can reach states, in its own spec, what an Editor, a Participant and a Viewer may do
with it, and is gated and tested to match ([Gate a feature by share role](../../instructions/gate-a-feature-by-share-role.md)).
The defaults: a Viewer only looks; a Participant takes part and adds content but never reshapes the board, runs the
session or changes settings; the rest is an Editor's. The role tests (the participant rule's leak test, the editor
capabilities, the Participant palette, the room) keep a new feature from widening a role by accident.

## The Participant palette

- **One category, Participate**, holding just what a Participant may add, as the palette's own tiles: an Event
  Storming board's coloured notes, else Sticky and Text (whatever the mode's Popular holds); then Image. On every mode, Draw included. No Search, no More. A mind map grows from a selected node (Tab, Enter, or Add
  child and Add sibling on its toolbar), not from a tile. Each tile works as an Editor's does: dragged onto the
  canvas it lands where it is let go; pressed, it arms a tap to drop or a drag to draw. No plain key adds anything in liveplanner (there is no palette, so no tool or add keys; N on a focused card is the board's own key).
- **The selection modes it needs**: Select, Hand and Zen.

## Ownership

Ownership is a set of powers, held by the plan's **owner** (its creator) and every joined member of the team it is
filed in. Who holds them is the index's to say: it issues the owner and team members an `edit` grant, and keeps
sharing, moves and the Trash to them ([one-explorer-contracts.md](../../../../liveworkspace/docs/specs/004-index/one-explorer-contracts.md)
"Sharing and access"). No level grants any of them. The full ownership model is [Later](#later).

## Share links

Share links are the index's, made and managed in the shared Share dialog (`ShareDialog` in
[`@liveworkspace/explorer`](../../../../packages/explorer/README.md)). What liveplanner owns is what each level may do
once a plan is open.

- The Share dialog offers three levels, in this order: **Viewer** ("Watches along. Can’t comment or change a
  thing."), **Participant** ("Comments, votes and works items. Can’t reshape it.") and **Editor** ("Works with you
  in real time."). Each link shows its level on a chip and can be changed in place.
- A link visitor's level comes from the grant the index issues for the link (`level`, and `tab` when the link opens
  one tab). The api and the room check it on every request and socket ([API](../015-api/api.md) "Access").
- The editor's role pill reads Editing, Participating or Viewing.
- **Losing access is explained, never silent.** A session ended by an access change (a link turned off, a password
  set, a grant whose level or tab changed on renewal) reloads into the access check, and a refusal then reads **No
  Longer Shared With You** ("Your access to this project was removed while you had it open. Ask its owner to share
  it with you again.") instead of "doesn't exist or isn't yours". The editor notes the reason in `sessionStorage`
  just before it goes and the first page after takes it once (`apps/editor/lib/access-notice.ts`, honoured for a
  minute). A session ended because its link was revoked leaves for the Explorer on liveworkspace.app with
  `?ended=revoked`, which says once that the link was revoked, so the plan is no longer open to them.
- The collaborators list badges each person Editor, Participant or Viewer.
- **Embeds look only below Editor**: an embed of a Participant link renders as a Viewer, since an embed has no
  identity screen to put a name on what it adds ([Embeds](embeds.md)).

## Integrity

- **Participation is its own class of room op**, between presence (anyone) and mutation (editors): a Participant's
  socket may cast dots and send answer deltas; every other mutation from it is dropped.
- **Content goes through the server.** A Participant never saves a whole tab and never relays element changes over
  its socket: it sends them to the server, which applies the rule, stores the result, and relays what it accepted
  to everyone.
- **A Participant's answers persist without an editor.** Each content write also folds the room's recorded answers
  (dots, responses) into the stored tab, and the editor flushes one after an answer.
- **The adder is stamped by the server**, never read from the request, from the caller's identity on the project.
  A copy is nobody's addition: duplicating or pasting an element never carries its adder along.
- **Peers take only what a Participant changed.** The room relays a Participant's update as the fields it changed,
  never the stored element whole, so an Editor's change that has not been saved yet is never undone by it.
- **A Participant answers as itself.** Its dots and responses must name the key its own session published; one in
  another's name is dropped. Keys are client-chosen today (server-derived keys are planned, [Later](#later)), so a
  session can still claim someone else's key from the start.
- **A held-back gesture says so.** When the editor holds back a change a Participant may not make (deleting
  someone else's sticky, resizing a shape), it shows one short notice for the burst rather than failing silently.
- A guest who signs in becomes a different adder: stickies added as a guest can no longer be deleted by them.

## Moving to three levels

- **Edit links stay Editor; view links stay Viewer, which now only looks.** A view link handed out before this
  change loses commenting (decided 2026-10-10): an owner who wants an audience to
  chime in issues a Participant link.
- **No old reader escalates.** Every reader of a level reads an unknown value as Viewer.

## Telemetry

`Project·Joined` takes the type `Participate` beside `Edit` and `View`
([Telemetry](../017-telemetry/telemetry.md)).

## Later

**Status: Planned.** Not built yet; today API tokens carry the read-only flag, ownership is the index's `edit`
grant, and a Participant's dots and answers carry the same client-chosen key an Editor's do.

- **Token levels**: API tokens carry view, participate or edit instead of the read-only flag.
- **Ownership powers** as a named set every door asks beside the level.
- **Server-derived collaboration keys**, pinned per socket, so nobody can answer as someone else.
- **An answers route** so a token can take part without a socket.

## Domain language

**Participant** is this access level. A person's name and colour (their profile at the liveworkspace accounts Worker, `GET /api/participants`) are their **display identity**
(name, colour, picture); prose calls them that, never "participant" ([Domain language](../003-system-architecture/domain-language.md)).
