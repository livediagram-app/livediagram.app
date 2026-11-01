# Items

An **item** is a unit of tracked work or thought that belongs to a project: a task, a bug, a retro note, an
idea. Items are stored apart from the canvas, in the project's **item store**, and the canvas only frames them:
a [Plan board](plan-board.md) shows many items arranged by their fields, and a Plan card shows one. The same item
can sit on several boards at once (a sprint board and a roadmap), and editing it anywhere changes it everywhere.

Items are not a ticket schema. An item has a **type** and an open bag of **fields**; the types we ship name the
fields people usually want, and any item may carry other fields. The store never has a column per field.

## Domain language

| Term           | Means                                                                                             | Never called                     |
| -------------- | ------------------------------------------------------------------------------------------------- | -------------------------------- |
| **item**       | One record in a project's item store: `id`, `type`, `fields`, `rank`, `key`                       | ticket, task, issue, card, entry |
| **item type**  | What an item is (Task, Bug, Note...): a name, a glyph, a colour and the fields it offers          | kind (that is a tab's), category |
| **field**      | One named value in an item's `fields` bag (`title`, `status`, `assignee`...)                      | column, property, attribute      |
| **item store** | Every item of one project                                                                         | backlog, database, table         |
| **item key**   | The short number people say out loud, `#12`: assigned once, per project, never reused             | id (the id is internal)          |
| **rank**       | The ordering key that places an item among others in a column                                     | position, index, order           |
| **status**     | The `status` field: the value a board's columns are made of                                       | state, column, stage             |
| **card**       | How an item is drawn: on a board, or alone as a Plan card. A card is a view; the item is the data | item (the data is the item)      |

## What an item is

- **`id`**: a short random id, unique within its project. A project's items and their ids travel together, so a
  copied project keeps every id and every card on its tabs still points at the right item.
- **`type`**: an item type id (`task`, `bug`, ...). An unknown type is kept and drawn as a plain item, so a type
  added later, or by an agent, never breaks a board.
- **`fields`**: a JSON object of field values. Known fields are validated by kind; other keys are kept as long as
  their values are JSON scalars, or arrays of them, within the size bounds.
- **`rank`**: a fractional ordering key. Moving one item writes one item; nothing else is renumbered.
- **`key`**: the item's number in its project, assigned by the store when the item is made (1, 2, 3...).
- **Who and when**: `createdBy` and `updatedBy` (the display identity of the person or agent), `createdAt` and
  `updatedAt`. A person's id on an item is a one-way hash of their identity, never the identity itself: a guest's
  id is their credential, so items never carry it. They are stamped by the plan on each write, never sent by a
  client, and people see them as the card's [Created and Last Edited](#created-and-last-edited) fields.
- **`rev`**: the item's revision, raised by one on every write.

## Fields

The fields the shipped types use. Each has a **field kind** that validates and draws it.

| Field             | Kind        | Holds                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ----------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `title`           | text        | One line, required, up to 500 characters                                                                                                                                                                                                                                                                                                                                                                                        |
| `description`     | long text   | Plain text with line breaks, up to 10,000 characters                                                                                                                                                                                                                                                                                                                                                                            |
| `descriptionRich` | rich text   | The description's formatting: runs of text with bold, italic, underline, strikethrough, size, colour, link and heading; `description` stays its plain-text mirror                                                                                                                                                                                                                                                               |
| `<field>Rich`     | rich text   | A Long Text custom field's formatting (`f-steps` → `f-stepsRich`), the same runs; the field's own value stays its plain-text mirror ([Item types](item-types.md#an-item-type))                                                                                                                                                                                                                                                  |
| `status`          | status      | A status value, matched against a board's columns                                                                                                                                                                                                                                                                                                                                                                               |
| `assignee`        | person      | `{ id, name, color }`: the person it is on, picked like an assigned action                                                                                                                                                                                                                                                                                                                                                      |
| `priority`        | priority    | `urgent`, `high`, `medium` or `low`                                                                                                                                                                                                                                                                                                                                                                                             |
| `labels`          | labels      | Up to 12 short strings                                                                                                                                                                                                                                                                                                                                                                                                          |
| `estimate`        | number      | Story points, 0 to 999; the card panel picks it from a dropdown of None, 1, 2, 3, 5, 8, 13 and 21 (`ESTIMATE_POINTS`), keeping any other value a card holds                                                                                                                                                                                                                                                                     |
| `start`           | date        | A calendar date, `YYYY-MM-DD`: when the work begins (a Project's bar on the [Gantt chart](plan-views.md#gantt-chart))                                                                                                                                                                                                                                                                                                           |
| `due`             | date        | A calendar date, `YYYY-MM-DD`                                                                                                                                                                                                                                                                                                                                                                                                   |
| `color`           | colour      | One of the twelve Plan swatches (`#2563eb`...): the item's own colour, shown beside its type colour, never instead ([Colour](#colour))                                                                                                                                                                                                                                                                                          |
| `checklist`       | checklist   | Up to 50 `{ text, done }` rows                                                                                                                                                                                                                                                                                                                                                                                                  |
| `attachments`     | attachments | Up to 20 pictures on the card, `{ id, name, size, type, cover? }` each ([Attachments](#attachments))                                                                                                                                                                                                                                                                                                                            |
| `parent`          | card link   | Another item's id (a Project): the Card field named Parent that Task carries (item-types.md "Card fields"), under its reserved id                                                                                                                                                                                                                                                                                               |
| `votes`           | votes       | Per-person counts `{ [personId]: n }`: the tallies of ended session votes, written only by a vote's end                                                                                                                                                                                                                                                                                                                         |
| `comments`        | comments    | The card's comment threads: stored apart from the card, in the plan's thread store, never in `fields`, and written only through the thread writes ([Comments](#comments))                                                                                                                                                                                                                                                       |
| `statusSince`     | timestamp   | When the card entered its current status, as a ms epoch: stamped by every write that changes the status (and by a create), from the editor, the api, agents and forms alike, and kept by every other write. A card stored before it existed reads its last change (`updatedAt`) instead, and its next write keeps that moment, so its age never restarts on an edit. A card's [Age](item-types.md#card-display) is read from it |

A card's type may leave statuses out ([Item types](item-types.md#an-item-type)): an item made or moved into one is
refused (`status_excluded`), from the editor, the api and agents alike. A card already in one is never moved out
by it, and putting a change back (a restore from the Trash, an undo or redo) is never refused.

### Created and Last Edited

Four built-in fields read the item's own stamps, so people can see who made a card and who last changed it, and
when, and sort, filter and lane by them. Every type offers them, as it offers [Age](item-types.md#card-display), and
they are the same family: filled in automatically, never typed.

| Field              | Id          | Kind   | Reads                                     |
| ------------------ | ----------- | ------ | ----------------------------------------- |
| **Created At**     | `createdAt` | date   | When the card was made                    |
| **Created By**     | `createdBy` | person | Who made it: a person, an agent or a form |
| **Last Edited At** | `updatedAt` | date   | When it was last edited (an edit, below)  |
| **Last Edited By** | `updatedBy` | person | Who last edited it                        |

- **Read-only**: the plan stamps them as it applies a write, from the editor, the api, agents and forms alike, from
  the caller it has signed in; nothing a client sends sets them. A write naming one in its fields is refused
  (`field_key_invalid`), as is an agent naming one in `change_items`. They are not in `fields`: they are the item's
  `createdAt`, `createdBy`, `updatedAt` and `updatedBy`.
- **An edit** is any write that changes the card: a field set or cleared, a status or type changed, a move into
  another column, a trash, archive or flag and their restores, an undo or redo (by the person undoing). These leave
  **Last Edited** as it was, because nobody edited the card:
  - a session vote's **tally** (its votes; its `rev` still rises);
  - a card's **place within its column alone** (a reorder, a drop back where it was), as History leaves it out;
  - a **linked board** keeping a card with its record ([Linked boards](linked-boards.md#keeping-them-together)): a
    write that sets or clears the link's own fields (`linked`, `linkedAt`, `linkedRev`, `linkedGone`) is that
    upkeep, whoever's browser sends it;
  - a **thread** write ([Writes](#writes)), and the plan's own upkeep (the schema's moves, a closed account's
    anonymising, which rewrites the name to **Deleted account**, and the migration door).
- **People** are shown as the item holds them today, a name and colour beside the hashed id, never more: the same
  identity the panel's foot has always shown.
- **No guessing**: a card stored without a maker or a time (an import from an older file, a row that lost its
  person, which reads as an empty id) shows nothing for that field, and sorts and lanes as having no value; it is
  never filled from another field. Undoing a card's delete, or duplicating a card, makes it anew: stamped then, by
  the person doing it.
- **Dates** read as the viewer's local calendar day ("31 Oct") on a card, the full date and time in its spoken label
  (and in the panel's tooltip on the last edit's "2h ago"); lanes and filters group by that day (`2026-10-31`), sorts by the moment itself.

### Attachments

Screenshots, mock-ups and photos kept on the card itself. **Attachments** (`attachments`) is a built-in field any card
type can offer (no ready-made type offers it to start): Add Field's **Image** kind lists it under **Ready to use**,
"Pictures on the card, and its cover". The owner's answer (2026-10-30) set what it takes: images only, on
liveworkspace's media service, as [Image fields](item-types.md#image-fields) are.

- **What a file may be**: a PNG, JPEG, WebP or GIF of up to 10 MB (the media service's own rule,
  `@liveworkspace/media` limits.ts). A card holds at most **20** (`ITEM_ATTACHMENTS_MAX`). Each entry is
  `{ id, name, size, type, cover? }`: the picture's id at the media service, its file name (cut to 120 characters),
  its size in bytes, its type, and `cover: true` on at most one of them. The api refuses anything else
  (`field_value_invalid`), a 21st picture included, so the cap holds for every door: the editor, agents and a sync.
- **Adding** (the card panel, an Editor or a Participant): the field's section lists the card's pictures, then a
  dashed **Add Images** zone ("PNG, JPEG, WebP or GIF, up to 10 MB · or paste"). Pressing it opens the file picker
  (several files at once); files dropped on it, or on the list above it, upload; and an image pasted while
  the panel is open, outside a text field, uploads too. A file **dropped on a card** on a board uploads into that
  card's Attachments when its type offers them (the card rings in the brand colour and reads **Drop to Attach** while a
  file is over it, then **Uploading…**; a refusal is a toast; a card whose type has no Attachments, or a reader who
  can't edit it, takes no drop). Each upload goes through
  `POST /api/images?p=` as an Image field's does, then joins the end of the list in one write. Several files upload
  one after another; a file past the card's 20, or one the media service refuses, is skipped and said under the
  zone ("That image is over 10 MB.", "A card holds up to 20 images."), the rest still land.
- **Each picture** is a row: a 40 px square thumbnail (cropped to fill), its name and its size ("1.2 MB"), with a
  **Cover** tag on the cover. Pressing the row **opens** the picture full size in a new browser tab. Its **⋯** menu
  holds **Open**, **Download** (saves it under its name), **Set as Cover** (or **Remove Cover** on the cover) and
  **Remove**. A Viewer, and a link visitor who only reads, sees the rows and opens and downloads them; the menu
  then holds only Open and Download.
- **Removing** takes the picture off the card (one undo step, as any field change); its bytes stay in the
  uploader's gallery, which the Explorer's Image Gallery lists, until the media service's sweep (below).
- **The cover**: **Set as Cover** makes that picture the card's cover (the one before stops being it). On a
  Detailed card whose type's Display holds **Cover Image** ([Card display](item-types.md#card-display)), the cover
  is drawn across the top of the card, edge to edge, 120 px tall and cropped to fill. Removing the cover's picture
  leaves the card without one. A Plan card on the canvas keeps its fixed size and draws no cover.
- **On the card face**: the **Attachments** card field is a picture glyph and how many pictures the card holds
  ("Attachments: 3"); with none it is not drawn.
- **Loading**: thumbnails and covers are fetched only as the card or row scrolls into view, at the size they are
  drawn (a cover at most 640 px on its longest side, a row's thumbnail 160 px), never the original; each size is
  fetched once and shared by every card and panel showing it.
- **Who sees the bytes**: `GET /api/images/{id}?p=` serves an attachment as it serves an Image field's picture: to
  its uploader, and to anyone who may read the plan while the plan holds a grant for it and one of its cards holds it
  ([api.md](../015-api/api.md) "Images").
- **The Trash and deleting for good**: a trashed card keeps its pictures (Restore brings them back as they were). A
  card deleted for good, or a plan purged, no longer places them: the plan reports the pictures its cards hold to
  the media service ("Images in use", below), and the service's daily sweep deletes a picture nothing in any
  app has placed for 30 days.
- **Copies**: duplicating a card, or a whole plan, carries the attachment ids: no bytes are copied. In the same
  plan the copy shows them to everyone; a copied plan shows them to their uploader, and to its other readers once
  someone who may edit it uploads them there again (as an Image field's).
- **This Browser plans** take no attachments: the server holds no record of them, so nothing would report their
  pictures and the sweep would take them. The zone reads "Save this plan to your account to add images." and
  takes no file; a card that came in with attachments (a plan taken offline) keeps them and shows them to their
  uploader.
- **Agents and the api read it**: `list_items` lists each card's attachments as stored (name, size, type, id); an agent may clear the field
  but never set it ("Attachments are added in the card panel"). A form can't ask it, and Import CSV and Export CSV
  leave it out, as an Image field's.
- Telemetry: `Plan · Added · CardAttachment`, `Plan · Removed · CardAttachment`, `Plan · Changed · CardCover`.

### Images in use

A plan tells liveworkspace's media service which pictures its cards hold, so the service's sweep never takes one in
use and can take one no card holds any more ([media.md](../../../../liveworkspace/docs/specs/006-media/media.md)
"References"). The set is every picture a card's Attachments hold, and every Image field value the plan holds a grant
for. A card write that could change it (made, changed or deleted while the plan holds a grant or a card holds
attachments) and each upload's grant queue an `images` key in the plan's outbox; the outbox's drain, at most once a
minute, works the set out and sends it (`POST /app/refs`, under the plan's id) only when it differs from the last one
sent. A purged plan sends an empty set. A plan reports on its first wake after this ships when it holds a grant, so
pictures uploaded before are counted.

The sweep can never take a picture a plan still holds, whether or not that plan has woken:

- **Claimed at upload.** An upload for a plan the server holds (`POST /api/images?p=`) names the plan to the
  service (`X-Media-Document`), which records the plan's reference at once. Only that plan's own report can take
  it away, so a plan that never reports again keeps every picture uploaded for it.
- **Never `complete`.** Plans report one by one as they wake, so liveplanner never tells the service it has sent
  every plan. The service then sweeps only pictures claimed for a plan that has since reported them gone (once
  every other app has reported complete); a picture with no claim, uploaded before claims began or for a This
  Browser plan (an Image field there, which uploads with no `p`), is never swept.
- **Past the cap.** A plan holding more pictures than one report carries (500) sends nothing and logs it, so no
  reference is dropped; it reports again once back under.

## Item types

The five **default types** ([Item types](item-types.md#the-type-catalogue)), each with a glyph, an accent colour and the fields it offers in the item panel:

| Type    | Accent | For                                    | Offers                                                                                   |
| ------- | ------ | -------------------------------------- | ---------------------------------------------------------------------------------------- |
| Project | Black  | A larger body of work others sit under | title, description, status, assignee, priority, color, start, due, labels                |
| Task    | Gray   | A piece of work                        | title, description, status, assignee, parent, priority, estimate, due, checklist, labels |
| Note    | Blue   | A thought, a retro note                | title, description, status, votes                                                        |
| Idea    | Yellow | A proposal to weigh                    | title, description, status, votes, labels                                                |
| Action  | Red    | Something agreed to do                 | title, description, status, assignee, due, checklist                                     |

- **Start** sits right before Due, on Projects only by default (so they map onto the
  [Gantt chart](plan-views.md#gantt-chart)); any other type can add it in the type editor. It is edited
  with the same date picker as Due. A start after the due date is kept, and the item panel
  says **Starts after it is due** under it, gently. Start is a card field like Due; the Roadmap board and the
  Project Planner's Roadmap tab show it on their cards.
- **Colour** (`color`) sits before Start on Projects by default, so projects can be colour coded; any other type
  can add it in the type editor. See [Colour](#colour).
- **Parent** (a Card field linking to Projects, item-types.md "Card fields") sits right under Status and Assignee
  on a Task: what a piece of work belongs to is read alongside who has it.
- Every ready-made type also offers **comments**, last, in its Overview tab ([Comments](#comments)). A project whose
  own catalogue predates it adds it in the type editor, like any built-in field.
- A bug is a card of the Bug type a Sprint or Bug Triage board brings.
- A project can change these and add its own, with custom fields: see [Item types](item-types.md).

## Colour

- An item's **Colour** is any `#rrggbb` colour, or none. Any other value is refused, like any invalid field value
  (agents and MCP included).
- It is an **addition** to the type colour, never a replacement: a card keeps its type's stripe and glyph colour,
  and the item's colour shows as a small dot beside them.
- It is set in the item panel from one compact field showing the colour's swatch and name (or **None**); it opens
  the one colour picker ([Colour picker](../004-interface-design/colour-picker.md)) in a popover: **None** (which
  clears it), the strong standard colours, Custom colours and **Add a custom colour** (four coloured dots). A pick closes it, as does Escape (which leaves
  the card open and returns focus to the field) and a press outside. A colour from an earlier Plan palette keeps
  its word ("Amber", "Cyan").
- The picker's keyboard is the colour picker's: one Tab stop (the picked swatch, else None), the arrow keys move
  focus (wrapping), Home and End jump to the ends, and Enter or Space picks. Opening it (a click, or an arrow key on
  the field) moves focus to the picked swatch.
- Where it shows:
  - **Card face**: a small dot beside the card's type label.
  - **Parent**: in the item panel, the Parent field (and the cards in its list) draws the linked card's type glyph in
    the linked card's own colour instead of the type's, with no dot, to save space; on the card face, the project's
    dot before its name.
  - **Swimlanes by Project**: each project row's header shows the project's dot.
  - **Gantt Chart**: a project's bar and diamond are drawn in its colour, else the Project type colour; the
    row's name carries its dot ([Gantt Chart](plan-views.md#gantt-chart)).
- A project whose own catalogue predates it keeps its Project type as saved; Colour is added in the type editor
  like any built-in field.

## Changing items

- **Create**: a type, fields (a title at least) and an optional place (`status`, and the item to sit after).
- **Update**: a field patch: keys to set and keys to clear. Two people editing different fields never overwrite
  each other; the same field resolves to the last write.
- **Move**: a new `status` and/or a new `rank`, given as "after this item" or "before this item" (or the top or
  end of a column), so a move needs no knowledge of other ranks.
- **Move many**: several cards moved as one write (a group dragged on a board, a selection's Move To), each with its
  own move, applied in order, so the cards can land together: the first at the drop point, each next one right
  after the one before (`POST /items/moves`, up to 200, participate access). Every card is checked before any is
  written, so one refusal refuses them all, naming the card. One undo step puts every card back where it was.
- A create, update or move that changes a card's `status` stamps `statusSince` with the write's moment; one that
  names `statusSince` itself (an undo, a restore, a sync or copy) keeps the value it gives.
- **Tally**: a session vote's host, ending it, adds each card's dots to the card's `votes` (per voter, as
  pseudonymous person ids) in one write (`POST /items/tally`, edit access); nothing else writes `votes`. A vote that
  counts in a Votes field of the type's own sends its id as `field`, and the dots land there; a card whose type
  does not offer that field takes them in the built-in `votes` ([Session tools](../012-collaboration/session-tools.md)
  "Count In"). A tally is not an edit: the card's Last Edited stays as it was ([Created and Last
  Edited](#created-and-last-edited)). Cards are
  voted on through the tab's session vote ([Session tools](../012-collaboration/session-tools.md) "Voting on Plan
  cards"), which keeps its own budget and privacy.
- **Delete**: removes the item. Its key is not reused.
- **Restore** (an undo of a delete, or an offline project's sync): a create may name the item's old id and key
  and carry its votes and the threads it was on; the key is honoured while it is free.
- **Comment**: start a thread, reply, edit or delete a comment, resolve, reopen, rename, add a thread to a card or
  delete it ([Comments](#comments)). Threads are written only this way, so two people commenting at once never lose
  a comment.
- Every write answers with the item as stored.
- **Busy**: writes racing for the same keys or revisions (a quick run of new cards, people dragging the same
  card) are retried by the api after a short, jittered pause; when its retries are spent it answers `item_busy`
  with nothing written, and the editor sends the write again (up to three times, the pause growing) before it
  tells the person the change was not saved. A burst of new cards keeps every card.

## Archive

- **Archiving** an item keeps it but takes it off every board: it sets `archived: true` (a flag: set, or the
  key removed). Its status stays, for when it comes back. It is undoable like any change.
- It is done from a card's menu (**Archive**), the item panel's header (**Archive**), or by dragging a card onto
  an **Archive board**. **Restore** (the same places on an archived card), or dragging the card off an Archive
  board onto another, clears the flag; dragged, the card takes the column it lands in, in the move itself (one write,
  one undo step).
- An ordinary board leaves archived items out altogether: not in its columns, its counts, its widgets or its
  "not on this board" list.
- An **Archive board** (the Boards category's Archive tile) shows only archived items, every one in its single
  **Archived** column, in Detailed cards. It takes no new cards (no Add Card, and palette cards are refused).
- Archive and Restore send `Plan · Moved · Archive` and `Plan · Restored · Card`.

## Flags

- **Flagging** an item marks it for attention without moving it: it sets `flagged: true` (a flag: set, or the key
  removed). It is undoable like any change, and reaches everyone at once like any field.
- It is done from a card's menu (**Flag**) or the item panel's ⋯ menu (**Flag**); on a flagged item both read
  **Remove Flag**.
- A flagged card wears a red flag at the end of its title on every board it is on, at every card size, in exports
  and thumbnails, and on its item slide. The item panel's header shows a **Flagged** chip beside the key.
- Flags change nothing else: a flagged card counts, sorts and moves like any other, and keeps its flag when
  archived, trashed or restored.
- Flag and Remove Flag send `Plan · Toggled · FlagOn` and `Plan · Toggled · FlagOff`.

## Example cards

- An **example card** is one a Plan template made to show how its boards run
  ([Plan templates](plan-templates.md#example-cards)). It carries `example: true` (a flag: set, or the key removed),
  set only when the template's cards are made and taken off by the board notice's **Keep Them**.
- The flag changes nothing on the card: an example card shows, counts, sorts, moves, archives and restores like any
  other, keeps its flag in a copy, an export or the Trash, and wears no mark of its own. It is what lets **Clear
  Example Cards** find exactly the template's cards.
- Only the template seed sets it; no card menu, panel field or agent verb offers it.

## The Plan strip

- Plan mode's bottom-right strip (**Trash**, **Find a Card**, **Card Types**, each below) shows only
  while the open tab has something that shows cards: a board, a view, or a Sheet holding a card table
  ([Card tables](../029-sheets/sheet.md#card-tables)). On an empty tab, or one of only diagrams, stickies and plain
  Sheets, it is hidden: those buttons would be noise there. It comes back the moment such an element arrives (a board
  placed, a Sheet set up from Plan Cards), and goes when the last one leaves.
- **On a phone beside the Session strip** (a tab whose cards take votes) the strip is one **More Card Tools** button,
  its menu holding Find a Card, Card Types and, for an editor, the Trash (the Trash's only door on a phone);
  each opens its panel above that button ([Session tools](../012-collaboration/session-tools.md#the-session-strip)).
- On a wide desktop (1440 px and up) each of its buttons is named beside its icon in one short word (**Trash**,
  **Find**, **Types**), as the cluster's other strips are ([Editor app](../007-editor/editor-app.md)); narrower,
  they are icons alone. Their accessible names and hover cards keep the fuller labels (Find a Card, Card
  Types), each containing its short name.

## Trash

- **Trash** is a status, `trash`, that no board shows (not in a column, not counted, not "not on this board", not
  on All Cards). A trashed item keeps the status it had under `trashedFrom`.
- In Plan mode a **Trash** button leads the bottom-right cluster's Plan strip, on its left before **Find a
  Card** and **Card Types** (not on a phone, whose cluster has no room for it, unless the strip is folded beside the Session strip, The Plan
  strip; a card's menu still sends it to the Trash), its count tucked into its corner (beside its name where the strip is named, The Plan strip); with a grey badge of how many cards
  it holds. While a card is dragged the button opens out into a dashed **Drop to Trash** target, and while the
  card is over it fills with the brand colour, tips its lid and reads **Let go to trash it** (no motion with reduced motion; the
  colours still change); a card let go there is trashed and the move is announced. That holds wherever the board is:
  a maximised or tab-filling board runs under the bottom-right controls, so the target floats over the board, and
  a card over it is over the Trash, not over a column (no slot opens beneath it).
- **Every way of deleting a card trashes it**: **Trash** in its menu and in the item panel's ⋯ menu (named
  **Trash**, not Delete), the Delete key on a focused card, and the drop on the Trash button. Each closes an open
  panel and is announced ("Card moved to the Trash"). A card leaves the store for good only from the Trash popover
  (below) or Empty Trash.
- Pressed, it opens the **Trash** popover (352 px wide): how many cards it holds, then each card, newest change
  first, with its type's stripe and glyph, its whole title, its type, number, the status it came from and when,
  and **Delete** and **Restore** (back to `trashedFrom`, or no status) on a row of their own. **Delete** asks first
  in a confirm popover beside the button ("Delete #12 for good? This cannot be undone.", **Delete**), as
  the workspace Trash does; **Empty Trash** deletes every one at once, with no confirmation (the button is in the Trash and says what it
  does), announced ("Trash emptied"), then the Trash panel closes.
- An empty Trash shows the shared empty state: **The Trash is empty**, and how to put a card there.
- Moving many cards to the Trash at once (a deleted card type's, a removed column's) is one change: one request
  per 200 cards, one undo step, one update for everyone watching.
- Trash and Restore send `Plan · Moved · Trash` and `Plan · Restored · Card`; opening it, `Plan · Opened · Trash`.

## Comments

A card holds **comment threads**: as many conversations as it needs, each with its own title, its own replies and
its own resolved state. Most cards have none; a busy card has a handful (about five is what the panel is drawn
for), and nothing stops one having many more. A thread is made of the canvas's own `Comment` values
([Canvas and palette](../008-canvas/canvas-and-palette.md), [Comment mentions](../012-collaboration/comment-mentions.md)):
the same text, mentions, author stamp and author redaction, drawn with the same comment rows and composer.

| Term          | Means                                                                                          | Never called                    |
| ------------- | ---------------------------------------------------------------------------------------------- | ------------------------------- |
| **thread**    | One conversation: a title, its comments oldest first, open or resolved, and the cards it is on | discussion, topic, conversation |
| **home plan** | The plan that stores a thread: the plan of the card it was started on                          | owner plan, source              |
| **shared**    | A thread that is on more than one card                                                         | linked, copied                  |
| **reply**     | A comment added to a thread after its first                                                    | answer                          |

### What a thread is

- **`id`**: a random id, unique across every plan (`th-` and 16 letters and digits), so a thread keeps one id on
  every card it is on.
- **`title`**: up to 120 characters. Made automatically when the thread is started, from the starter's name and the
  start of the first comment: `{name}: {opening}`, the opening being the comment's first line cut at a word to about
  60 characters with an ellipsis ("Gentle Falcon: Basket empties after switching restaurants"). Anyone who may reply
  may **rename** it; a renamed title is kept as written. The same title shows on every card it is on, in the Inbox and
  to agents.
- **`comments`**: oldest first, up to 200 and 128 KB per thread (`comments_full` past either). A thread always has at
  least one: it is started with its first comment, and deleting its last comment deletes the thread.
- **`resolved`**: open or resolved, with who resolved it and when. Resolving and reopening keep every comment.
  Replying to a resolved thread is not offered (the composer is hidden), and a reply that reaches one anyway (an
  agent's, the Inbox's) reopens it, as on the canvas.
- **`createdBy`**, **`createdAt`**, and **`updatedAt`** (its last activity: a comment added or edited, a resolve, a
  reopen or a rename; a reaction is not activity and leaves it).
- **`cards`**: every card it is on (up to 20), each named by its plan and card id, with its number and, for a card in
  another plan, that plan's name as it was when the thread was added there. The first is the card it was started
  on.
- **`field`**: the Comments field it belongs to ([Comments and Votes fields](item-types.md#comments-and-votes-fields)),
  set when it is started; absent is the built-in Comments (every thread from before).
- A card is on up to 50 threads (`threads_full` past it), counted across all its Comments fields.

### Stored once, on every card

A thread is **stored once**, in its home plan, and **shown on every card it is on**: a reply, a resolve, a rename
or a deleted comment made from any of them changes it everywhere at once. Nothing is copied.

- **Add Thread to Card** puts an existing thread on another card **in the same plan**, never on a card in another
  plan (`400 thread_other_plan`). The card it is added to must be one the person may change. (The owner's decision,
  2026-10-28: a thread is added only to cards in the plan it is viewed in.)
- **Anyone who can see one of its cards can read it.** A thread shared into another plan before that rule (the
  first release offered other plans) stays on both and keeps working: someone who reaches it only through a card in
  another plan acts by their role **on the card they are viewing**: a Participant or an Editor there may reply,
  resolve, reopen and rename it, and a Viewer reads it.
- **There is no removing a thread from one card.** A thread leaves a card only when the thread is deleted (it goes
  from every card), or the card is deleted for good (it leaves that card; a thread on no other card goes with it).
- **Deleting a thread** removes it from every card it is on, after a confirmation that says how many cards that is
  ("Delete this thread? It is on 3 cards, and goes from all of them. This can't be undone."). **A thread is deleted
  only by someone every comment in it is theirs**: their own comments, including any an agent posted with their own
  token for them ("Generated by AI"). This holds for everyone, Editors included: a thread holding anyone else's
  comment is never deleted, only resolved. A Participant may delete a thread made only of their own comments; a
  Viewer never; an agent never. The api checks it against the stored comments' author ids at write time, in the
  thread's home plan (so a delete through another plan the thread is on is checked the same), and refuses
  `409 thread_has_others` ("Others have commented on this thread: resolve it instead"). In the ⋯ menu, **Delete
  Thread…** is then shown greyed with that reason under it, beside Resolve. (The owner's decision, 2026-10-28:
  "don't let me Delete a thread with other people's comments in it, just resolve." It replaces "an Editor may delete
  any thread; the starter may delete their own".)

### Who may do what

| Who                                    | Read | Start, reply, resolve, reopen, rename | Edit or delete own comments | Delete any comment | Add to another card | Delete the thread |
| -------------------------------------- | ---- | ------------------------------------- | --------------------------- | ------------------ | ------------------- | ----------------- |
| **Editor** (on the card viewed)        | yes  | yes                                   | yes                         | yes                | yes                 | only all-own      |
| **Participant**                        | yes  | yes                                   | yes                         | no                 | yes                 | only all-own      |
| **Viewer**                             | yes  | no                                    | no                          | no                 | no                  | no                |
| **An agent** (API token, MCP, the CLI) | yes  | start, reply, resolve, reopen         | only comments it wrote      | no                 | no                  | no                |

- **Only all-own**: a thread every comment in which is the deleting person's own (an agent's posted with their
  token counts as theirs); one holding anyone else's comment is refused `409 thread_has_others`, Editors included.
- **React** ([Comment reactions](../012-collaboration/comment-reactions.md)) goes with replying: an Editor or a
  Participant adds and takes back their own six emoji on any comment, a Viewer only sees them and who left them, and
  an agent reads them (`list_threads`) but never reacts (`403 forbidden`).
- The card a thread is added to is always in the plan being viewed, so the same role decides.
- A tab-scoped link reaches a thread only through a card its tab shows.
- An agent token acts as its person, by that person's role, with the limits in the last row: it edits and deletes
  only comments an agent posted for that person (those carrying **Generated by AI**), never a comment a person
  typed, nor anyone else's.

### Generated by AI

Every comment an agent writes (posted with an API token: the MCP, the CLI, a script) carries `ai: true`, stamped by
the server from the request, never taken from it. Wherever a comment row is drawn (a card's threads, the canvas's
comment popover, the Comment panel), a quiet **Generated by AI** label with a sparkle glyph sits above the comment's
text. Editing an AI comment keeps the flag; a person cannot set or clear it.
A card's history marks an agent's changes with the same sparkle, worded by what they did ("Transitioned by AI",
"Edited by AI": [History](#ai-wording)); **Generated by AI** is a comment's alone.

### Where it shows

**In the card panel.** `comments` stays a built-in field, the last of the Overview tab, under its label
**Comments**:

- **The header** is one line: the label, then, quietly, a small count of the open threads ("2 Open", none drawn
  with none open; the resolved count is on the Resolved disclosure), and at its end **New Thread** (a plus and the
  word) for anyone who may start one. Nothing sits on a line of its own between the label and the threads; it
  fits on one line at 390 px.
- **No threads**: a soft empty state: a speech-bubble glyph, **No threads yet**, and "Start a thread to discuss this
  card." with **New Thread**; someone who may not comment reads **No comments yet** and "No one has started a thread on this card.", with no button (the shared compact empty state).
- **New Thread** opens the starter at the top of the list (sliding in; none with reduced motion): your avatar, a
  field with the placeholder **Start a thread…** that grows with its text, the title it will get shown live beneath it
  ("Titled “Gentle Falcon: Basket empties…”", muted; it takes no room until there is text), and **Cancel** and
  **Start Thread** (off until there is text) on a row close under the field, spaced as the reply composer's.
  ⌘ Enter or Ctrl Enter starts it, Escape cancels; mentions work as in any composer. The new thread lands at the top,
  open.
- **Open threads** come first, the most recently active at the top. Each is a rounded card (a hairline ring, a soft
  shadow when open) whose header row opens and closes it (a disclosure button, `aria-expanded`), drawn in the same
  language as the Activity timeline:
  - on the left, the disc of whoever started it (28 px, their colour), carrying a small green check badge once
    resolved;
  - its title (one line, cut with an ellipsis, the whole title in a tooltip), with its last activity at the line's
    end ("2h ago", the full date in a tooltip);
  - under it, the avatars of up to three people in it (then "+2"), "4 comments", and, collapsed, the latest
    comment's opening words ("Alex: I think the basket…", one line);
  - a **shared chip** when it is on more than one card (a link glyph and the count, named "On 3 cards"; amber when one of them is in another plan), which opens a small popover
    listing the cards (#12 Title, and for another plan's card "#4 in Sprint 12"; the card being viewed tagged **This card**), each opening that card (one in this
    plan in the card panel, one in another plan in a new tab);
  - a chevron that turns as it opens, and a **⋯** menu: **Rename**, **Add to Card…**, **Resolve** or **Reopen**, and **Delete Thread…**,
    each shown only to whoever may comment (a Viewer has no menu); Delete Thread… is greyed, with "Others have
    commented: resolve it instead." under it, on a thread holding anyone else's comment.
- **An open thread, expanded**, reads as one conversation inside its card: its comments hang from a thin rail that
  runs down from the starter's disc through each author's disc to your own beside the reply composer, all in one
  column aligned under the header's disc, no rule or box between them. It shows its comments as the comment rows
  draw them (author avatar, name, relative
  time, text with mention chips, **Generated by AI** above an agent's comment, **Edited** after an edited comment's
  time), then a reply composer (**Reply…**), whose bottom row holds **Resolve** (quiet, secondary) to the left of
  **Reply** (primary, on the right), the same height, with no row of its own between the comments and the composer.
  Resolve shows only to those who may resolve, who are those who may reply. With text typed in the box, Resolve
  reads **Comment and Resolve** (tooltip "Post your reply, then resolve the thread"): it posts the text as a reply and
  then resolves the thread, as one action, announced "Reply posted, thread resolved". If the reply fails nothing is
  resolved and the draft stays; with a blank box it is plain Resolve. Your own comment offers **Edit**
  (in place: the text becomes a field, **Save** and **Cancel**, ⌘/Ctrl Enter saves, Escape cancels) and **Delete**; an
  Editor's row offers Delete on anyone's. Every comment takes **reactions**
  ([Comment reactions](../012-collaboration/comment-reactions.md)): **Add Reaction** in its row actions opens the
  six in place, and chips under the text count each emoji, highlight yours and say who; a resolved thread's
  comments keep their chips but take no new ones. Every thread is **closed when the card opens** (its header only: title,
  avatars, count, last activity). A thread opens when its header is pressed, when a link names it (below), or when
  the person has just started it with Start Thread (it lands open, so they see what they posted and can go on);
  replying keeps an opened thread open. What is open is remembered only while the panel stays on the card:
  closing the card, or opening another, and coming back finds every thread closed again; nothing is stored.
- **Resolved threads** sit at the bottom under a **Resolved · 2** disclosure, closed by default. Each is drawn
  quieter: a green check badge on its disc, "Resolved by Ada · 3d ago" in its meta line, its comments dimmed when
  opened, and **Reopen** on its own row at the right under the comments (a resolved thread has no composer). Resolving a thread moves it there (smoothly; at once with
  reduced motion), and reopening it brings it back up.
- **Rename** turns the title into a field in place (its text selected): Enter or leaving the field saves, Escape
  cancels, an emptied title goes back to the automatic one.
- **A link** to a card's thread (`#item=<card>&thread=<thread>`: the Inbox, a mention email) opens the card with
  that thread expanded and scrolled into view (and the Resolved disclosure opened when it is resolved).
- **Keyboard and screen readers**: every control is a button or a field in reading order; Enter or Space opens a
  thread; the ⋯ menu is a menu (arrows, Escape); a new thread, a resolve, a reopen and a delete are announced ("Thread
  started", "Thread resolved"). Every target is at least 32 px on a touch screen, and the ⋯ menu and Edit and Delete
  are always visible there (on hover with a mouse).

**Add Thread to Card** opens a dialog, **Add Thread to Card**, naming the thread:

- A search field (focused on open with a mouse), matching a card's number (`12`, `#12`), title or type.
- **This plan's cards only** (not archived, not in the Trash), as the card finder draws them (type glyph and
  colour, number, title), newest change first, at most 50 until a search narrows them. A card the thread is already
  on is shown with **Already on this card**, and cannot be picked. No other plan is offered, in the cloud or in
  This Browser.
- Picking a card adds the thread at once ("Added to #12"). Once added, the thread's shared chip counts the new card
  on every card it is on.

**On a card face**: the `comments` card field draws a speech bubble and the count of comments in the card's **open**
threads (none drawn when there are none), labelled "5 comments in 2 open threads". Detailed cards,
beside the votes; exports and thumbnails draw it too.

**In the Inbox**: each thread is one Inbox item ([Inbox](../013-workspace/inbox.md) §2.5), titled with its title and
placed on its card (its number and title, and the board that shows it), listed for the people in it, those it
mentions, and the plan's owner, until it is resolved. A thread shared into two plans lists once for a reader of both.

### Writes

Every write is applied by the home plan to the thread as stored, so concurrent writes all land:

| Write             | What it does                                                                                          | Refusals                                                   |
| ----------------- | ----------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| **start**         | a new thread on a card, in one of its Comments fields, with its first comment and its automatic title | `threads_full`, `item_not_found`, `field_invalid`          |
| **reply**         | adds a comment (text up to 2,000 characters, mentions); reopens a resolved thread                     | `comments_full`, `thread_not_found`                        |
| **edit**          | replaces one of the caller's own comments' text and mentions, marking it edited                       | `comment_not_found`, 403 not theirs                        |
| **delete**        | deletes a comment (own, or any for an Editor); the last one deletes the thread                        | `comment_not_found`, 403                                   |
| **resolve**       | resolves or reopens; already so changes nothing (an empty answer)                                     | `thread_not_found`                                         |
| **react**         | turns the caller's emoji on or off on a comment; already so changes nothing (empty)                   | `comment_not_found`, `comments_full`, 403 agent            |
| **rename**        | sets the title (trimmed, 1 to 120 characters), or clears it back to the automatic one                 | `title_too_long`                                           |
| **add to card**   | puts the thread on another card                                                                       | `thread_on_card`, `threads_full`, `thread_cards_full`, 403 |
| **delete thread** | removes it from every card                                                                            | 403                                                        |

- A comment's author name, colour and id, its `ai` flag and its token are stamped by the server from the caller. A
  reaction's name is the server's too; its `by` is the caller's collab key, as on the canvas.
- A thread write is not a change to its cards: no card's `rev`, **Last Edited By** or **Last Edited At** moves.
- **Author ids** never leave the api except to their author: every read and answer leaves them out of other people's
  comments (and the thread's starter), and the room hears none.
- **Live**: every write reaches everyone with any of the thread's cards open, in every plan it is on, at once.
- **Not undoable**: thread writes are outside Undo, as comments always were.
- **Mentions** reach people as a canvas mention does ([Comment mentions](../012-collaboration/comment-mentions.md)):
  the email's button opens the card on that thread. `Comment · Mentioned` counts each mentioning comment.
- **Timeline and email**: a new comment records on the home plan's timeline and emails its owner (when email is on
  and the commenter is not the owner), as before; resolving records too.

### Cards coming and going

- **Trash and Archive** keep a card's threads; restoring brings them back as they were.
- **Deleting a card for good** takes it off its threads; a thread on no other card is deleted with it. Undoing that
  delete puts the card back on its threads (a thread it was alone on comes back whole, keeping author ids only on the
  restorer's own comments).
- **Copies**: a copied plan takes the threads its own cards hold (stored in it), on the copied cards; a thread
  shared in from another plan stays that plan's and is not copied.
- **Exports**: a tab's JSON export carries no comments (they name people), as before.
- **Offline projects** (This Browser) keep their threads in their own record beside the items, with every rule
  above minus the room and other plans; **Sync to cloud** sends them with the items; **Take offline** keeps the
  threads the plan stores and leaves behind the ones shared in from other plans.

### Existing comments

A card's single thread from before threads becomes the card's **first thread**, with every comment, keeping its
resolved state, titled automatically from its first comment's author and text. Plans in the cloud move once, when
the plan is next opened (a step of its schema); a thread that arrives later in the old shape (an older copy, an
import, a restore) is taken the same way as it lands. This Browser plans move as their record is read.

### Telemetry

`Comment · Added · Item` (a reply), `Comment · Changed · Item` (an edit), `Comment · Deleted · Item`,
`Comment · Resolved · Item`, `Comment · Unresolved · Item`, and for threads `Comment · Created · Thread`,
`Comment · Renamed · Thread`, `Comment · Linked · Thread` (added to another card; the type `ThreadOtherPlan`, for one
added into another plan, is no longer sent) and `Comment · Deleted · Thread`.

## History

A card keeps its own **history**: who made it, moved it and changed it, and when, so nobody has to ask around. It
answers "who moved this?" for one card; it is not a plan-wide log, it offers no Revert, and Undo is unchanged
([Undo](#undo), [No activity log](../012-collaboration/README.md#no-activity-log)).

| Term              | Means                                                            | Never called                      |
| ----------------- | ---------------------------------------------------------------- | --------------------------------- |
| **history**       | Every history entry one card keeps, newest first                 | log, audit trail, feed            |
| **history entry** | What one write did to the card: when, by whom, and its changes   | event, log line, record           |
| **activity**      | The card's history as the panel's Activity tab draws it, grouped | timeline (that is the Explorer's) |

### What is kept

Each write to a card adds one entry, written by the plan as it applies the write, in the same request:

- **Created**: the card was made (from a board, a cell, an agent, a form's response, a restore), in the status it
  was made in ("Sam created this card in To Do").
- **Moved**: its status changed, from one to another ("Sam moved this from In Progress to Review").
- **Trashed** and **restored from the Trash**; **archived** and **restored**; **flagged** and **unflagged**.
- **Changed type**: from one card type to another.
- **Set a field**: the field and its new value ("Alex set Priority to High"); a cleared field reads "cleared Due
  Date". A long value (a description, a checklist, rich text) is named, not copied ("Alex edited the
  Description"). A value is cut to 80 characters, a list to its first 12 entries; a person is kept by name alone.

Left out, because they are not a change a reader is asking about: a card's place within its column alone (its
rank), when it reached its column (`statusSince`, stamped by the move itself), a vote's tally (its votes), its comment
threads (they are shown beside it), and the plan's own upkeep (the
schema's moves, a closed account's anonymising, the migration door). A plan made from a copy, a duplicate, a
sync to the cloud or an import starts its cards with no history: history never travels with a card.

Each entry is **tagged** by how it was made:

- **By an agent** (an API token: the MCP, the CLI, a script): drawn with the AI sparkle beside the name, worded by
  what the agent did (below), never **Generated by AI**: an agent moving a card generated nothing.
- <a id="ai-wording"></a>**The AI sparkle's words** (its tooltip and accessible name) name what the run's changes did,
  worked out in the editor from the change kinds each history entry already carries (the API is unchanged):

  | The run's changes are all                   | The sparkle reads      |
  | ------------------------------------------- | ---------------------- |
  | Moved (a status or column change)           | **Transitioned by AI** |
  | Created                                     | **Created by AI**      |
  | Set or cleared a field, or changed the type | **Edited by AI**       |
  | Set the title alone                         | **Renamed by AI**      |
  | Moved to the Trash                          | **Trashed by AI**      |
  | Archived                                    | **Archived by AI**     |
  | Restored from the Trash or the Archive      | **Restored by AI**     |
  | Flagged                                     | **Flagged by AI**      |
  | Removed the flag                            | **Unflagged by AI**    |
  | Of more than one of these (a mixed run)     | **Changed by AI**      |

  A rename beside other field edits is an edit (**Edited by AI**). Comments keep **Generated by AI**
  ([Generated by AI](#generated-by-ai)): they are text an agent wrote.

- **An undo or redo** (the write's `undo`): drawn with **(Undo)** after it, so a card moving back reads as a person
  taking their change back, not a second decision.
- **A form's response**: the card made from it reads "created this card from a form response".

### Kept bounded, in the plan

- History lives in the plan's own Durable Object storage, beside its cards, never in D1. The plan writes the entry as
  it applies the card's write, so a write costs no extra database round trip.
- A card keeps its newest **200 entries** and none older than **180 days**: each write drops its card's entries past
  either, and the plan's daily upkeep drops every card's entries past the age.
- **Deleting a card for good deletes its history** with it; trashing or archiving keeps it. Undoing a delete brings the
  card back with no history before that point.
- Deleting a plan deletes every history with it.

### Reading it

- History is **read while a card's Activity tab is open** (when it is picked, and again when the open card changes
  while it shows), one request for that card, never sent with the room's item ops and never with the store. A card
  whose Activity tab is never picked reads nothing.
- **Grouped**: entries one person makes with the same tag within a minute of the first of them read as one entry,
  each field once at its latest value ("Sam moved this from To Do to Review and set Priority to High"). A move
  there and back, a flag on and off, or a trash and restore within the minute drops out; a group with nothing left
  is not shown.
- **Who may read it**: anyone who may read the card ([Who may do what](#who-may-do-what)), a Viewer included; a
  tab-scoped link reaches only the history of cards its tab shows (others answer `item_not_found`). Nobody writes it
  but the plan.
- **Author ids** follow the comment redaction ([Writes](#writes)): an entry names its author by name and colour, and
  carries their id only to the author themselves (who reads "You").
- A closed account's entries read **Deleted account**, as their cards and comments do.

### Where it shows

In the card panel, on a tab of its own, **Activity**, never mixed with the threads:

- **Every card has it**, whatever tabs and fields its type defines: it is not a field a type places, and the type
  editor does not list it. It is always the last of the type's own tabs (on a phone, before **Details**, which ends
  the bar: [plan-board.md](plan-board.md) "Open an item"), so a type with one tab now shows a tab bar of two. It is
  not counted in a type's 6 tabs. **Comments** shows only the card's comment threads.
- It **is not the tab a card opens on**: the panel opens on the type's first tab (Overview), so opening a card reads
  no history. History is read when Activity is picked (above). Which tab is picked is not remembered: each card
  opens on its first tab.
- **A timeline**, newest first, in **day groups** headed **Today**, **Yesterday**, then the date ("Mon 27 Oct", with
  the year when it is not this one). Down its left runs a thin **rail**: each **run** (entries by one person, one
  after another within the same day and no more than 30 minutes apart) hangs from that person's disc (24 px, their
  colour) on the rail, with their name ("You" for yourself), an agent's sparkle worded by what it did
  ([above](#ai-wording): "Transitioned by AI" for a move), and the run's
  newest time; the run's entries follow under it, each with its own time when the run holds more than one.
- **An entry reads as short lines**, one per change, each with a small glyph for its kind (created, moved, edited,
  flagged, archived, trashed, type) and a clear sentence: "Moved **In Progress** → **Review**", "Set **Priority** to
  **High**", "Changed **Due Date** **3 Oct** → **10 Oct**", "Cleared **Estimate**", "Edited the **Description**",
  "Renamed to “Basket empties”", "Created this card in **To Do**". Values are **chips**: a status chip carries a dot
  in its stage's colour (Not Started, In Progress, Done, as the Details status pill does), a priority chip the
  priority's own colour; other values are plain chips. **The old value** shows, muted, before the arrow when the
  card's kept history holds it (the same field's earlier entry); otherwise the line names only the new value. An
  undo's entry ends with **(Undo)**. An entry of more than three changes shows the first three and "Show N More
  Changes".
- **Times**: under Today, how long ago ("2h ago"); under an older day, the time of day ("14:32"); the exact date
  and time in a tooltip either way.
- **Entries past the first 20** wait under **Show N More** (the number left) at the timeline's end.
- **While it loads**: a skeleton of three rows on the rail (still, with reduced motion). **No history yet** (a card
  made before history, or past its age): the shared compact empty state, a history glyph, **No Activity Yet** and
  "Changes to this card show here: who moved it, what they set, and when."; a failed read: **Couldn't Load
  Activity**, "Check your connection and try again." and **Try Again**.
- **This Browser** plans keep no history: the tab says **No Activity in This Browser** and "Plans in This Browser
  keep no card history." in place of the timeline.
- A panel with no plan to read from (a preview) still shows the tab, with the This Browser note's sibling: **No
  Activity Here** and "Activity shows on cards in a plan."
- **Every role** sees the tab and reads it (a Viewer included); nobody writes it.
- Picking it sends `Plan · Toggled · ActivityOn` (the event the earlier Activity switch and section sent when
  opened, so the chart stays continuous); leaving it sends nothing.
- It was first an **Activity** switch in the Comments header that interleaved the rows with the open threads by
  time, then a collapsible section below Comments (Work Tracker #164); the owner moved it to a tab of its own on
  every card type.

## No New Card button

- The Plan strip has **no New Card button**: a card is added where it will live, from a board's
  [card type chips](plan-board.md#card-type-chips) (a click, or a drag into a column and row) or a cell's **Add
  card**. A card made off any board in the strip made people go and find it again, and a button that adds without
  placing was the least convenient way in. On a phone, where the header has no chips, each cell's **Add card** is
  the way in; a Sheet's card table adds rows of its own, and a linked card's **New {Type}** makes one beside the card
  it links to.

## Finding a card

- **Cards** is a button in Plan mode's bottom-right cluster, after the Trash in one strip with Card Types
  (buttons in one frame, as Undo and Redo are, each opening its own panel); it opens a popover of every card
  in the project that is neither archived nor in the Trash, 44 rem wide on desktop (the screen less a margin on
  a phone) with a list 32 rem tall (less on a short screen) whatever it holds, so the panel keeps its size as a search
  narrows it, of every card type the catalogue has (custom types
  included, each drawn with its own glyph and colour) and of a type it has lost (drawn as the fallback "Item"),
  newest change first. On a phone, where the strip folds into **More Card Tools**, its **Find a Card** row opens
  the same popover (a press on a row of that menu reaches only the menu, never the canvas under it, which used
  to take the focus and shut the menu before the row could act, so none of its three rows opened anything).
- A search field (focused on open with a mouse, not on a phone) matches a card's number (`12` or `#12`), title,
  description or card type name ("person" finds every Person card), ignoring case.
- **All Cards** (the wider: all the room **Not on a Board**, on one line at its own width, leaves) and **Not on a Board** switch between every card and the cards no board in the project shows,
  on any tab: those with no status, those whose status no column holds (the strays a renamed or removed column
  left behind), and those whose status is a column only on boards whose Card Types leave the card's type out. A
  card is on a board when some board (not an All Cards or Archive board) names its status as a column and shows
  its type. Each carries a count.
- **Filters**: inside the search box itself ([Search and filters](../004-interface-design/search-and-filters.md)), a
  chip per field filter before the words ("State: Done", "Assignee: No assignee"), each with a cross, and **Add
  Filter** at the box's right edge, the picker Card Search uses ([Plan views](plan-views.md#card-search)): a field the
  listed cards' types offer (Card Type always among them), then one of its values among them with its count, so no
  filter leaves nothing. Every filter must match; Backspace in an empty box takes the last off, and the box's
  **Clear Search** clears the words and the filters. They are the person's own while the panel is open, never saved. Filters matching nothing: **No cards match these filters** (below).
- At most 200 tiles are drawn, with "Showing 200 of N. Search to narrow them down." beneath.
- The cards sit in a **grid of tiles**, two across on a desktop (one on a phone), 8 px apart, so the panel shows
  about twice as many as a list of full-width rows did and no row is a long, mostly empty strip. Tiles in a row
  share its height. Each tile is the card as a board draws it at **Detailed** size, laid out as its type's
  Display says, so a card looks the same in the panel as on a board (named for assistive technology "Open
  {Title}, {Type} #{n}"). Its state is not shown: a state filter narrows by it. Choosing a tile (anywhere but
  its ⋯) closes the popover and opens the card in the item panel.
- **The tile's ⋯** sits inside the card, at the end of its header row (after the priority), never beside the
  card: with a mouse it shows while the pointer is over the tile or the ⋯ has focus, and stays while its menu is
  open; on a touch screen it always shows. It opens the card's menu (the shared anchored menu, icon-left rows):
  **Open** and, where the plan has an address to give, **Copy Card Link** (as the item panel's ⋯), then, for
  someone who may retire cards (an Editor, as the panel's Trash), a separator and **Move to Trash**, which puts
  that card in the Trash (restorable from there, and announced "#{n} moved to the Trash") without leaving the
  list. A Participant or Viewer gets Open and Copy Card Link only.
- Empty: the shared empty state (as the Trash's: an icon badge, a title and a line), filling the list's height:
  **No cards yet** ("Add one from a board, or drag one in from the palette."); a search matching nothing, **No cards
  match “<words>”** ("Try another word, a number or a card type."); filters matching nothing, **No cards match these
  filters** ("Remove a filter, or clear the search, to see more."); no strays, **No cards off a board** ("Every card
  here is on a board."). The copy follows [Empty states](../004-interface-design/empty-states.md).
- Opening it is tracked as `Plan · Opened · CardFinder`.

## Who may do what

Items follow the project's access ([Auth and guest access](../014-identity/auth-and-guest-access.md)):

- **Read** with any access to the project. A visitor on a **tab-scoped** link sees only the items that tab shows:
  the items its boards show and its Plan cards point at. Those boards, plan views and Plan cards are the tab's structure,
  which the link never adds, removes or repoints ([Tab-scoped share links](../013-workspace/tab-scoped-share-links.md#structure)).
- **Create, update, move, delete** with edit access. A tab-scoped link creates cards only from a tab that shows
  every card (a board or plan view on it); from any other tab the card would land on boards outside its reach, so
  the api refuses it (403), before it looks at any id the create names, so a taken id on another tab answers
  exactly as a free one does and never shows that the card exists.
- **Who a card can be assigned to**: you, the joined members of **the plan's team** (the team whose library holds
  it, and only when your sign-in names that team; by their profile name, else their invite address's local part),
  fetched once a project has Plan content, and the plan's **custom assignees**. People from your other teams are
  never offered: a plan in My Work, one shared with you from someone else's My Work, one in This Browser or a
  guest's offers only you and custom assignees. A guest, who has no teams, never has its teams asked for (the
  request could only fail). A card already assigned to someone outside that list keeps them, shown in its picker
  (and, as a held assignee, in the plan's other pickers; see "Where the list comes from" below). Comment
  @-mentions draw on the same team ([Comment mentions](../012-collaboration/comment-mentions.md)), so no name from
  another team shows anywhere in the plan.
- **Custom assignees**: a name for someone outside the plan's team (a contractor, a client, a person not on the plan),
  so their work can be tracked like anyone's. The Assignee picker ends with **+ Custom Assignee**; choosing it opens
  a small popover (**Custom Assignee**, a **Name** field of up to 60 characters, **Cancel** and **Add**, Add off
  while the name is blank) whose Add assigns the card to that name at once. A name already in the picker (a
  teammate's or an earlier custom assignee's, case and spacing aside) picks that person rather than making a second
  one. A custom assignee is the same named person agents and the CLI make (`n-` and a slug of the name, a Plan
  swatch; [Plan agents](plan-agents.md) "Naming things as people do"), so a name made either way is one person.
  - **Where the list comes from**: the cards. Every assignee a card in the plan holds is offered in every card's
    picker, so a custom assignee exists in the whole plan as soon as one card has them, and leaves the picker once
    no card does. Nothing else is stored: no list on the plan, no migration.
  - **Who may add one**: anyone who may edit the card, an Editor or a Participant (assigning is editing a card's
    fields, [Share roles](../013-workspace/share-roles.md#what-a-participant-changes)), a guest and a link editor
    included. A Viewer sees the picker disabled and no **+ Custom Assignee**.
  - **Everything that groups by person** (swimlanes, the Assignee filter, workload, the People tile) treats a custom
    assignee as a person: they get their own lane, filter option and bar.
  - **Accounts are marked**: in the Assignee picker's open list, and only there, every person who is a
    liveworkspace identity (a person id hashed from an account or guest id: you, the plan's team, and anyone the cards
    hold who was assigned that way) carries a small liveworkspace mark to the left of their name: the prism glyph every app's logo is, in the
    platform's slate, 12 px. It shows no tooltip on hover; a screen reader hears it as **liveworkspace account** (the row reads "Sam, liveworkspace account"). A custom assignee
    and a template's example person carry nothing (an empty space of the same width, so the names line up). Nowhere else shows it: not the closed
    field, card faces, the @-mention list or any other list of people. The picker is a list of its own rather than a
    native select so a row can hold the mark: the closed field shows the current assignee (or **No one**) and a
    chevron; opening it (a press, or Enter, Space, Up or Down) drops a list under the field, in place: **No one**, the
    people, then **+ Custom Assignee** (for someone who may edit the card), the current choice in bold; Up and Down
    move, Enter picks, Escape or a press outside closes it. One inline SVG a row, no image requests.
  - **Never a person to notify**: a custom assignee has no account, so no email, no Inbox row (the cards push skips
    `n-` ids instead of counting them as people it could not name), and **Only Mine** never matches them.
- **Finding your cards**: an open card that is yours (its Assignee, or any Person field that notifies, one of its
  people for a field that holds several,
  [Notifies](item-types.md#notifies)) lists under **Assigned to You** on the Explorer's
  [Inbox](../013-workspace/inbox.md) (§2.4 there), in every project you can open; a row opens the card on its board.
- **Comment** with participate access; edit and delete your own comments, delete any with edit access, and delete a
  thread you started, or any with edit access ([Comments](#comments)).
- An agent token acts as its person, and a read-only token reads only.

## Live for everyone

- Every write is pushed to everyone in the project's room at once, in order, with the store's revision.
- A session on a tab-scoped link hears only that the store moved on, and fetches the items its tab shows.
- A client that sees a gap in revisions, or reconnects, fetches the whole store again.
- Nothing a browser sends over the room changes an item: items change only through the api.

## Undo

- A person can undo their own item changes with the canvas's Undo, in the order they made them, mixed with their
  canvas edits: undoing a card's move puts it back; undoing a delete brings the item back with its id, key and
  votes. Undoing a move or a status change puts the card's `statusSince` back too, so its Age reads as it
  did.
- A tally is not undoable (a session vote's dots are taken back during the vote), matching comments and assigned
  actions. A card's
  threads are not undoable either; undoing a card's delete puts it back on its threads ([Comments](#comments)).
- An undo writes the old value back, even over a later change someone else made to that field, as canvas undo
  does.

## Offline projects

- An [offline project](../006-project/offline-mode.md) keeps its item store inside its own record, as an
  `items` array beside its tabs, and its threads as a `threads` array. Every rule above holds, minus the room and
  [History](#history), which it does not keep.
- Its writes pass the api's own checks (fields, places, what a move may set, a status the card's type leaves out,
  the size bounds) and are refused by the same names, so the record never holds what **Sync to cloud** would refuse.
- **Sync to cloud** sends the items and threads with the project; **Take offline** fetches every item and thread
  first, all or nothing.

## Copies and exports

- **Duplicate** copies the item store with the project (same ids, same keys), without the cards' history
  ([History](#history)). A copied tab linked into another
  project finds its items only if that project has them; a Plan card whose item is not in the store says so.
- Images, thumbnails and api or MCP renders draw boards and cards from the project's items. The Export dialog's
  preview draws them too, so it shows what the download holds.
- **A tab's JSON export** (the `liveplanner.tab` file) carries the items the tab shows (`itemIdsShownOnTab`, the
  Trash left out) as `items`, and the project's stored type catalogue as `itemTypes` when it has one. Each item
  keeps its id, type, key, fields and rank, without its votes or comments: the file travels, and those name people.
  Both fields are additive and absent when the tab shows no items, so the file keeps its schema version.
- **Importing that file** into a tab adds its items to the project. Every item whose id the project does not
  already have is created in status and rank order, numbered afresh by the project; first, the file's types those
  items use and the project lacks are added (by id, the catalogue's cap holding). An item the project already has
  is left as it is, so importing a tab's export back into its own project never doubles the cards. The tab's
  content, the added types and the new cards are separate undo steps, newest first: undo takes the cards away, then
  the types, then restores the tab. The import waits for the project's item store to load (a project with no Plan content
  starts loading it once the imported board lands; blueprint DEFAULTS D43). When the store never loads, or refuses the
  cards (the 2,000 cap), none are added, the tab stays imported, and the import's report says how many cards could
  not be added.
- **The Markdown export** lists each Plan board under "Plan Boards": its title, then each column with its card
  count after a middle dot (`To Do · 3`, never in brackets), then its cards as `#key Title (Type)`. A Plan card on the canvas is listed under "Plan Cards".

## Limits

- **A field never shows a value nobody kept.** A card panel's text field stops taking characters at its limit (a
  title at 500, a custom Text or Long Text at 2,000), showing how many are left from 90% of it ("12 characters
  left", then "500 characters, the most it takes"). A change refused anyway (by the store before it is sent, or
  by the api) is not kept: the field goes back to the saved value, and a toast names why ("That title is too
  long: a card title holds up to 500 characters", "That value is too long or isn't one this field takes").

- Up to 2,000 items per project; a create past it is refused with `items_full`.
- Up to 20 pictures in a card's Attachments ([Attachments](#attachments)), each at most 10 MB.
- Up to 16 KB of fields per item, 64 field keys, keys of letters, digits, `_` and `-`, up to 40 characters. A
  card's comment threads sit outside that budget: up to 50 threads a card, 20 cards a thread, and 200 comments and
  128 KB a thread; a write past one is refused with `threads_full`, `thread_cards_full` or `comments_full`.
- Item writes count against the write rate limit.

## Deleting a project

Deleting a project for good deletes its items, and their history, with it. Trash keeps them until then.
