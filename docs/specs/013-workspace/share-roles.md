# Share roles

**Status: built (Viewer, Participant, Editor links); token levels, ownership powers and collaboration keys still
ahead ([Later](#later)).**

Everyone who reaches a document without owning it, by a share link or an embed, does so at one of three **access
levels**: **Viewer**, **Participant** or **Editor**. **Ownership** is not a level: it is a set of powers over the
document, held apart from editing. The research behind this is in `docs/research/access-levels/`.

## Why

A facilitator running a retrospective has to hand the team an edit link so they can add stickies, type and vote.
An edit link also lets them switch the tab's mode, drag frames away, delete the columns and reshape the board, and
in a lively session somebody does. A view link is no answer either: it cannot add a sticky or cast a dot. The
Participant level is the middle: take part in the board, never reshape it.

## The levels

| Level           | Wire name     | May                                                                                                                                                                                                                                                                                                                                                                                                             |
| --------------- | ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Viewer**      | `view`        | Look only: open and read every tab it admits; pan, zoom, point, use the laser and spotlight, follow and be followed, appear in the presence stack, present on their own screen, export. Writes nothing: no comment, poll answer, Q&A note or upvote, vote, answer or reaction.                                                                                                                                  |
| **Participant** | `participate` | All of Viewer; comment, reply, resolve and reopen; answer live polls; add to and upvote on Q&A boards; react; take part in session tools; add, write and arrange stickies and text; place images and swap their pictures; grow mind maps; write on any element but a Behaviour, a table's cells included; work with Plan cards and Sheet cells (see [What a Participant changes](#what-a-participant-changes)). |
| **Editor**      | `edit`        | All of Participant; change anything on the drawing, its tabs, its modes and its tools' configuration; hold the facilitator baton.                                                                                                                                                                                                                                                                               |

- **The levels are a ladder**: every level holds everything below it.
- **A Viewer only looks.** A comment, a poll answer, a Q&A note or upvote, a vote and a reaction are all taking
  part, which is a Participant's. A Viewer's selection shows its badge and holds nothing: it never stops anyone
  editing the element it looks at.
- **Running a session is facilitation, an Editor's hat**: starting, ending, revealing, clearing and pacing stay with
  editors and the [facilitator baton](../012-collaboration/facilitator.md). A Participant takes part and never
  runs, and never holds the baton.
- **A checklist tick is editing**: it is one shared value, not a person's answer.

## What a Participant changes

A Participant changes the board's **content**, never its **shape**.

| May                                                                                                                                                                        | Never                                                                                                                                                                 |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Take part in session tools: cast and withdraw dots, answer estimate cards, temperature checks, the Done check and quizzes, drop ideas in the idea box                      | Start, end, reveal, clear or configure a session tool; take the roll; spin a Picker; press Bring Focus; hold the baton                                                |
| Add a sticky, a text element or an image; grow a mind map (a node as a branch of one already there, with the connector joining them)                                       | Add any other element: shapes, free connectors, frames, templates, kits; a mind node with no branch to grow from                                                      |
| Write on any element: change its text (a sticky's, a shape's label, a table's cells)                                                                                       | Change any other field of an element it did not add: size, style, rotation, layer, lock; write on a Behaviour (a poll's question, a timer's or mode button's caption) |
| Move and resize any sticky or image; recolour any sticky; move any mind node, and turn a mind connector's faces, so a growing map re-lays itself; swap any image's picture | Move, resize or restyle anything else, text boxes included; turn (rotate) anything someone else added                                                                 |
| Delete anything it added itself, and any mind node (with its connector)                                                                                                    | Delete anything someone else added                                                                                                                                    |
| Change anything about what it added (size, style, text), so long as it stays something it could add                                                                        | Reorder layers; group; lock; point its connector at anything but two mind nodes                                                                                       |
| On a Plan board: add a card, edit its fields, move it between columns                                                                                                      | Columns, card types, custom fields, board settings; delete, trash or archive a card; restore one with its votes                                                       |
| On a Sheet: write cells                                                                                                                                                    | Rows and columns, the Sheet's title, adding or removing a Sheet                                                                                                       |
| Undo and redo its own changes (the room puts back any part it may not make)                                                                                                | Undo or redo anyone else's                                                                                                                                            |
| Nothing about tabs                                                                                                                                                         | Add, rename, reorder or delete tabs; change a tab's mode, theme or canvas; rename the document                                                                        |

- **"It added"** means the server recorded the Participant as the element's adder when the element was created.
  An element an Editor added, or one added before this level existed, belongs to nobody a Participant can claim.
- **Stickies and images are the content**, so a Participant arranges them whoever added them: moves and resizes
  them. Shapes, frames, connectors and someone else's text boxes (which often label the structure) stay where
  their author put them; a text box that sizes to its words still follows them when a Participant writes on it.
- **Nothing offers what a session cannot do.** A Participant or Viewer sees no Slides button or Slide Deck command,
  no timer controls on a timer element, and an inert face on a mode button set to the Eraser or Format Painter; a
  Participant sees no Sheet toolbar, row, column, merge or settings controls (cells only). Empty states describe
  instead of instructing: an agenda, roll call or done check with nothing in it says who fills it, a mood meter
  asks only someone who may answer, a comment thread or card finder invites only someone who may add. A Participant
  writes on comment panels and adds Plan cards from New Card, as it may.
- **The server is the rule.** A Participant's content changes travel as element changes the server applies one by
  one against the stored tab: a permitted change lands, a forbidden field is left as stored, a forbidden add or
  delete is refused. A stale screen therefore never writes an old copy of the board over a newer one.
- **Undo** takes back the Participant's own steps; an undo that would make a forbidden change is refused like any
  other.

## Building a new feature

Every feature a shared document can reach states, in its own spec, what an Editor, a Participant and a Viewer may do
with it, and is gated and tested to match ([Gate a feature by share role](../../instructions/gate-a-feature-by-share-role.md)).
The defaults: a Viewer only looks; a Participant takes part and adds content but never reshapes the board, runs the
session or changes settings; the rest is an Editor's. The role tests (the participant rule's leak test, the editor
capabilities, the Participant palette, the room) keep a new feature from widening a role by accident.

## The Participant palette

- **One category, Participate**, holding just what a Participant may add, as the palette's own tiles: the
  landing category's sticky and text tiles, an Event Storming board's coloured notes, else Sticky and Text; then
  Image. On every mode, Draw included. No Search, no More. A mind map grows from a selected node (Tab, Enter, or Add
  child and Add sibling on its toolbar), not from a tile.
- **The selection modes it needs**: Select, Hand, Laser, Spotlight, Avatar, Isometric and Zen. Eraser, Format
  Painter and Slide Deck are an Editor's.

## Ownership

Ownership is a set of powers, held by the document's **owner**: its creator, or whoever moved it into their own
library. Sharing (creating, revoking and rescoping links, the share password) stays with the owner; delete, Trash
and moves stay with the owner and joined team members. No level grants any of them. The full ownership model is
[Later](#later).

## Share links

- The Share dialog offers three role cards, in this order: **Editor** ("Draws with you in real time."),
  **Participant** ("Adds stickies, writes and votes. Can't reshape the board.") and **Viewer** ("Watches, pans and
  zooms. Can't comment, vote or change a thing."). A pass's header band prints `EDITOR`, `PARTICIPANT` or `VIEWER`, each with a
  glyph and a colour that meets WCAG 2.2 AA against its word ([Live app](../007-editor/live-app.md#share-dialog)).
- `POST /api/documents/:id/share` takes `role: 'view' | 'participate' | 'edit'`; an omitted role is `edit`, as today.
- The editor's role pill reads Editing, Participating or Viewing.
- The collaborators list badges each person Editor, Participant or Viewer; "Shared with you" chips read Edit,
  Participate or View.
- **Embeds look only below Editor**: an embed of a Participant link renders as a Viewer, since an embed has no
  identity screen to put a name on what it adds ([Embeds](embeds.md)).
- The MCP's `share_document` creates a **Participant** link when no level is named.

## Integrity

- **Participation is its own class of room op**, between presence (anyone) and mutation (editors): a Participant's
  socket may cast dots and send answer and idea deltas; every other mutation from it is dropped.
- **Content goes through the server.** A Participant never saves a whole tab and never relays element changes over
  its socket: it sends them to the server, which applies the rule, stores the result, and relays what it accepted
  to everyone.
- **A Participant's answers persist without an editor.** Each content write also folds the room's recorded answers
  (dots, responses, ideas) into the stored tab, and the editor flushes one after an answer.
- **The adder is stamped by the server**, never read from the request, from the caller's identity on the document.
  A copy is nobody's addition: duplicating or pasting an element never carries its adder along.
- **Peers take only what a Participant changed.** The room relays a Participant's update as the fields it changed,
  never the stored element whole, so an Editor's change that has not been saved yet is never undone by it.
- **A Participant answers as itself.** Its dots and responses must name the key its own session published; one in
  another's name is dropped. Until keys are server-derived ([Later](#later)), a session could still claim someone
  else's key from the start.
- **A held-back gesture says so.** When the editor holds back a change a Participant may not make (deleting
  someone else's sticky, resizing a shape), it shows one short notice for the burst rather than failing silently.
- A guest who signs in becomes a different adder: stickies added as a guest can no longer be deleted by them.

## Moving to three levels

- **Edit links stay Editor; view links stay Viewer, which now only looks.** A view link handed out before this
  change loses commenting, poll answers and the Q&A board (decided 2026-10-10): an owner who wants an audience to
  chime in issues a Participant link.
- **No old reader escalates.** Before the server can write a `participate` link, every reader of a stored level
  reads an unknown value as Viewer. An editor bundle from before this change reads a Participant link as Editor,
  shows editing controls, and the server refuses its first save; a reload fixes it.

## Telemetry

`Document·Shared` and `Document·Joined` take the type `Participate` beside `Edit` and `View`
([Telemetry](../017-telemetry/telemetry.md)).

## Later

Specified in the research and not built yet:

- **Token levels**: API tokens carry view, participate or edit instead of the read-only flag.
- **Ownership powers** as a named set every door asks beside the level.
- **Server-derived collaboration keys**, pinned per socket, so nobody can answer as someone else; until then a
  Participant's dots and answers carry the same client-chosen key an Editor's do.
- **An answers route** so a token can take part without a socket.

## Domain language

**Participant** is this access level. The `participants` table and its records are a person's **display identity**
(name, colour, picture); prose calls them that, never "participant" ([Domain language](../003-system-architecture/domain-language.md)).
