# Items

An **item** is a unit of tracked work or thought that belongs to a document: a task, a bug, a retro note, an
idea. Items are stored apart from the canvas, in the document's **item store**, and the canvas only frames them:
a [Plan board](plan-board.md) shows many items arranged by their fields, and a Plan card shows one. The same item
can sit on several boards at once (a sprint board and a roadmap), and editing it anywhere changes it everywhere.

Items are not a ticket schema. An item has a **type** and an open bag of **fields**; the types we ship name the
fields people usually want, and any item may carry other fields. The store never has a column per field.

## Domain language

| Term           | Means                                                                                             | Never called                     |
| -------------- | ------------------------------------------------------------------------------------------------- | -------------------------------- |
| **item**       | One record in a document's item store: `id`, `type`, `fields`, `rank`, `key`                      | ticket, task, issue, card, entry |
| **item type**  | What an item is (Task, Bug, Note...): a name, a glyph, a colour and the fields it offers          | kind (that is a tab's), category |
| **field**      | One named value in an item's `fields` bag (`title`, `status`, `assignee`...)                      | column, property, attribute      |
| **item store** | Every item of one document                                                                        | backlog, database, table         |
| **item key**   | The short number people say out loud, `#12`: assigned once, per document, never reused            | id (the id is internal)          |
| **rank**       | The ordering key that places an item among others in a column                                     | position, index, order           |
| **status**     | The `status` field: the value a board's columns are made of                                       | state, column, stage             |
| **card**       | How an item is drawn: on a board, or alone as a Plan card. A card is a view; the item is the data | item (the data is the item)      |

## What an item is

- **`id`**: a short random id, unique within its document. A document's items and their ids travel together, so a
  copied document keeps every id and every card on its tabs still points at the right item.
- **`type`**: an item type id (`task`, `bug`, ...). An unknown type is kept and drawn as a plain item, so a type
  added later, or by an agent, never breaks a board.
- **`fields`**: a JSON object of field values. Known fields are validated by kind; other keys are kept as long as
  their values are JSON scalars, or arrays of them, within the size bounds.
- **`rank`**: a fractional ordering key. Moving one item writes one item; nothing else is renumbered.
- **`key`**: the item's number in its document, assigned by the store when the item is made (1, 2, 3...).
- **Who and when**: `createdBy` and `updatedBy` (the display identity of the person or agent), `createdAt` and
  `updatedAt`. A person's id on an item is a one-way hash of their identity, never the identity itself: a guest's
  id is their credential, so items never carry it.
- **`rev`**: the item's revision, raised by one on every write.

## Fields

The fields the shipped types use. Each has a **field kind** that validates and draws it.

| Field             | Kind      | Holds                                                                                                                                                                 |
| ----------------- | --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `title`           | text      | One line, required, up to 200 characters                                                                                                                              |
| `description`     | long text | Plain text with line breaks, up to 10,000 characters                                                                                                                  |
| `descriptionRich` | rich text | The description's formatting: runs of text with bold, italic, underline, strikethrough, size, colour, link and heading; `description` stays its plain-text mirror     |
| `status`          | status    | A status value, matched against a board's columns                                                                                                                     |
| `assignee`        | person    | `{ id, name, color }`: the person it is on, picked like an assigned action                                                                                            |
| `priority`        | priority  | `urgent`, `high`, `medium` or `low`                                                                                                                                   |
| `labels`          | labels    | Up to 12 short strings                                                                                                                                                |
| `estimate`        | number    | Points or hours, 0 to 999                                                                                                                                             |
| `start`           | date      | A calendar date, `YYYY-MM-DD`: when the work begins (a Project's bar on the [Gantt chart](plan-views.md#project-gantt-chart))                                         |
| `due`             | date      | A calendar date, `YYYY-MM-DD`                                                                                                                                         |
| `checklist`       | checklist | Up to 50 `{ text, done }` rows                                                                                                                                        |
| `parent`          | item ref  | Another item's id (a Project), resolved within the same document                                                                                                      |
| `votes`           | votes     | Per-person counts `{ [personId]: n }`, written only through voting                                                                                                    |
| `comments`        | comments  | The card's conversation: the same comment thread a canvas element carries (`{ comments, resolved }`), written only through the comment writes ([Comments](#comments)) |

## Item types

Five built-in types, each with a glyph, an accent colour and the fields it offers in the item panel:

| Type    | Accent | For                                    | Offers                                                                                   |
| ------- | ------ | -------------------------------------- | ---------------------------------------------------------------------------------------- |
| Project | Black  | A larger body of work others sit under | title, description, status, assignee, priority, start, due, labels                       |
| Task    | Gray   | A piece of work                        | title, description, status, assignee, parent, priority, estimate, due, checklist, labels |
| Note    | Blue   | A thought, a retro note                | title, description, status, votes                                                        |
| Idea    | Yellow | A proposal to weigh                    | title, description, status, votes, labels                                                |
| Action  | Red    | Something agreed to do                 | title, description, status, assignee, due, checklist                                     |

- **Start** sits right before Due, on Projects only by default (so they map onto the
  [Gantt chart](plan-views.md#project-gantt-chart)); any other type can add it in the type editor. It is edited
  with the same date picker as Due. A start after the due date is kept, and the item panel
  says **Starts after it is due** under it, gently. Start is a card field like Due; the Roadmap board and the
  Project Planner's Roadmap tab show it on their cards.
- **Parent** sits right under Status and Assignee on a Task, and in that place in the type editor's list of
  built-in fields: what a piece of work belongs to is read alongside who has it.
- Every built-in type also offers **comments**, last, in its Overview tab ([Comments](#comments)). A document whose
  own catalogue predates it adds it in the type editor, like any built-in field.
- A bug is a Task labelled `bug`.
- A document can change these and add its own, with custom fields: see [Item types](item-types.md).

## Changing items

- **Create**: a type, fields (a title at least) and an optional place (`status`, and the item to sit after).
- **Update**: a field patch: keys to set and keys to clear. Two people editing different fields never overwrite
  each other; the same field resolves to the last write.
- **Move**: a new `status` and/or a new `rank`, given as "after this item" or "before this item" (or the top or
  end of a column), so a move needs no knowledge of other ranks.
- **Vote**: plus or minus one for the caller; a person's count never drops below zero. Votes are written only this
  way, so two people voting at once never lose a vote.
- **Delete**: removes the item. Its key is not reused.
- **Restore** (an undo of a delete, or an offline document's sync): a create may name the item's old id and key
  and carry its votes and its comment thread; the key is honoured while it is free.
- **Comment**: add a comment, delete one, resolve or reopen the thread ([Comments](#comments)). Comments are
  written only this way, so two people commenting at once never lose a comment.
- Every write answers with the item as stored.

## Archive

- **Archiving** an item keeps it but takes it off every board: it sets `archived: true` (a flag: set, or the
  key removed). Its status stays, for when it comes back. It is undoable like any change.
- It is done from a card's menu (**Archive**), the item panel's header (**Archive**), or by dragging a card onto
  an **Archive board**. **Restore** (the same places on an archived card), or dragging the card off an Archive
  board onto another, clears the flag; dragged, the card takes the column it lands in.
- An ordinary board leaves archived items out altogether: not in its columns, its counts, its widgets or its
  "not on this board" list.
- An **Archive board** (the Boards category's Archive tile) shows only archived items, every one in its single
  **Archived** column, in Compact cards. It takes no new cards (no Add Card, and palette cards are refused).
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

## Trash

- **Trash** is a status, `trash`, that no board shows (not in a column, not counted, not "not on this board", not
  on All Cards). A trashed item keeps the status it had under `trashedFrom`.
- In Plan mode a **Trash** button sits in the bottom-right cluster, left of Undo, with a badge of how many cards
  it holds. While a card is dragged the button opens out into a dashed red **Drop to Trash** target, and while the
  card is over it fills red, tips its lid and reads **Let go to trash it** (no motion with reduced motion; the
  colours still change); a card let go there is trashed and the move is announced.
- Pressed, it opens the **Trash** popover (352 px wide): how many cards it holds, then each card, newest change
  first, with its type's stripe and glyph, its whole title, its type, number, the status it came from and when,
  and **Delete** and **Restore** (back to `trashedFrom`, or no status) on a row of their own. **Delete** asks first
  in a confirm popover beside the button ("Delete #12 for good? This cannot be undone.", **Delete**), as
  the workspace Trash does; **Empty Trash** deletes every one after a confirmation ("This can't be undone").
- An empty Trash shows the shared empty state: **The Trash is empty**, and how to put a card there.
- Trash and Restore send `Plan · Moved · Trash` and `Plan · Restored · Card`; opening it, `Plan · Opened · Trash`.

## Comments

A card carries a comment thread through the canvas's own comment model ([Canvas and
palette](../008-canvas/canvas-and-palette.md), [Comment mentions](../012-collaboration/comment-mentions.md)): the
same `Comment` and `CommentThread` values, the same rules for who may write, delete, resolve and reopen, the same
author redaction, and the same thread list, composer and resolve control the comment popover draws.

- **Where it shows**: `comments` is a built-in field. In the item panel it is the last field of the Overview tab,
  under its label **Comments**: the thread (author disc, name, relative time, text with @-mention chips), then the
  composer (**Add a comment…**, ⌘↵ or **Comment** sends), all in one bordered box. Once there is a comment, a row
  above the thread says how many (**1 comment**, **3 comments**) beside a **Resolve** chip (**Resolved** while
  resolved, which hides the composer; pressing it reopens). Empty, it reads **No comments yet.** Someone who may
  not comment reads the thread with no composer and no chip. A type that stops offering comments keeps the
  card's thread stored, unshown, like votes.
- **On the card**: a `comments` card field (a speech-bubble glyph and the count of comments in an open thread,
  drawn only when there is one), on Compact and Detailed cards, beside the votes. New boards show it. Exports and
  thumbnails draw it too, after the votes, by the same rule (a board's card fields; a Plan card always).
- **Writes**: add (text up to 2,000 characters, optional mentions), delete, resolve, reopen. Each is applied by the
  api to the item as stored, so concurrent comments, deletes and resolves all land. A comment's author name,
  colour and id are stamped by the server from the caller, never taken from the request. Adding to a resolved
  thread reopens it, as on the canvas. A comment change counts as a change to the item (its `rev`, **Changed by**).
- **Who may**: anyone who may comment on the document (participate access) may add a comment and resolve or
  reopen the thread; they may delete their own comments, and someone with edit access may delete any.
- **Author ids**: a comment's author id never leaves the api except to its own author (as on the canvas): every
  read and every write's answer leaves it out of other people's comments, and the room's `items` op leaves it out
  of all of them.
- **Live**: every comment change is an item write, so it reaches the room like any other, and an open item panel
  shows it at once.
- **Trash, Archive, Delete**: trashing or archiving a card keeps its thread; restoring brings it back as it was.
  Deleting a card deletes its thread with it; undoing that delete restores the thread, keeping the author id only
  on the restorer's own comments.
- **Not undoable**: comments, deletes and resolves are outside Undo, as on the canvas.
- **Mentions** show as chips and are kept on the comment, and reach people the way a canvas mention does
  ([Comment mentions](../012-collaboration/comment-mentions.md)): the card's thread lists on the mentioned person's
  Activity page (with the thread's other readers: whoever commented in it, and the document's owner), and the
  author's editor asks the api to email them, the email's button opening the card. `Comment · Mentioned` counts
  each mentioning comment, as on the canvas.
- **Timeline and email**: a new comment records on the document's timeline and emails the owner (when email is
  on and the commenter is not the owner), exactly as a canvas comment does; resolving records too.
- **Offline documents** comment locally, the same rules minus the room; the thread syncs with the item.
- Telemetry: the canvas's own comment events with the type `Item`: `Comment · Added · Item`,
  `Comment · Deleted · Item`, `Comment · Resolved · Item` and `Comment · Unresolved · Item` (existing pairs).

## Finding a card

- **Cards** is a button in Plan mode's bottom-right cluster, before Card Types; it opens a popover of every card
  in the document that is neither archived nor in the Trash, newest change first.
- A search field (focused on open with a mouse, not on a phone) matches a card's number (`12` or `#12`), title or description, ignoring case.
- **All Cards** and **Not on a Board** switch between every card and the cards whose status no column of the
  document's boards holds, on any tab (or that have no status): the strays a renamed or removed column left
  behind. Each carries a count.
- At most 200 rows are drawn, with "Showing 200 of N. Search to narrow them down." beneath.
- Each row shows the type's glyph, the title, and the type, number and status. Choosing one closes the popover and
  opens the card in the item panel.
- Someone who can edit sees a bin beside each row (on hover with a mouse, always on a phone): **Move to Trash**
  puts that card in the Trash (restorable from there) without leaving the list.
- Empty: "No cards yet" with how to add one; no match: "No cards match that search"; no strays: "Every card is
  on a board here".
- Opening it is tracked as `Plan · Opened · CardFinder`.

## Who may do what

Items follow the document's access ([Auth and guest access](../014-identity/auth-and-guest-access.md)):

- **Read** with any access to the document. A visitor on a **tab-scoped** link sees only the items that tab shows:
  the items its boards show and its Plan cards point at.
- **Create, update, move, delete** with edit access.
- **Who a card can be assigned to**: you and the joined members of the teams you are part of (by their profile
  name, else their invite address's local part), fetched once a document has Plan content. A guest, who has no
  teams, can assign only themselves, and the editor never asks for a guest's teams (the request could only fail). A card already assigned to someone outside that list keeps them, shown in its
  picker.
- **Finding your cards**: an open card assigned to you lists under **Assigned to You** on the Explorer's
  [Activity page](../013-workspace/activity-page.md) (§2.4 there), in every document you can open; a row opens the card on its board.
- **Vote** with participate access, as comments.
- **Comment** with participate access; delete your own comments, or any with edit access ([Comments](#comments)).
- An agent token acts as its person, and a read-only token reads only.

## Live for everyone

- Every write is pushed to everyone in the document's room at once, in order, with the store's revision.
- A session on a tab-scoped link hears only that the store moved on, and fetches the items its tab shows.
- A client that sees a gap in revisions, or reconnects, fetches the whole store again.
- Nothing a browser sends over the room changes an item: items change only through the api.

## Undo

- A person can undo their own item changes with the canvas's Undo, in the order they made them, mixed with their
  canvas edits: undoing a card's move puts it back; undoing a delete brings the item back with its id, key and
  votes.
- Votes are not undoable (a vote is taken back by voting minus), matching comments and assigned actions. A card's
  comments are not undoable either; undoing a card's delete brings its thread back with it.
- An undo writes the old value back, even over a later change someone else made to that field, as canvas undo
  does.

## Offline documents

- An [offline document](../006-document/offline-mode.md) keeps its item store inside its own record, as an
  `items` array beside its tabs. Every rule above holds, minus the room.
- **Sync to cloud** sends the items with the document; **Take offline** fetches every item first, all or nothing.

## Copies and exports

- **Duplicate** copies the item store with the document (same ids, same keys). A copied tab linked into another
  document finds its items only if that document has them; a Plan card whose item is not in the store says so.
- **The `.livediagram` file** (the Google Drive mirror's document file) carries the items, and a copy imported
  from it gets them back. The field is additive, so the file stays version 1.
- Images, thumbnails and api or MCP renders draw boards and cards from the document's items.
- A **Community** copy leaves every card's comments out, as it leaves out the canvas's comment threads.

## Limits

- Up to 2,000 items per document; a create past it is refused with `items_full`.
- Up to 16 KB of fields per item, 64 field keys, keys of letters, digits, `_` and `-`, up to 40 characters. A
  card's comment thread sits outside that budget: up to 200 comments and 128 KB per card; a comment past either is
  refused with `comments_full`.
- Item writes count against the write rate limit.

## Deleting a document

Deleting a document for good deletes its items with it. Trash keeps them until then.
