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
| `title`           | text      | One line, required, up to 500 characters                                                                                                                              |
| `description`     | long text | Plain text with line breaks, up to 10,000 characters                                                                                                                  |
| `descriptionRich` | rich text | The description's formatting: runs of text with bold, italic, underline, strikethrough, size, colour, link and heading; `description` stays its plain-text mirror     |
| `status`          | status    | A status value, matched against a board's columns                                                                                                                     |
| `assignee`        | person    | `{ id, name, color }`: the person it is on, picked like an assigned action                                                                                            |
| `priority`        | priority  | `urgent`, `high`, `medium` or `low`                                                                                                                                   |
| `labels`          | labels    | Up to 12 short strings                                                                                                                                                |
| `estimate`        | number    | Story points, 0 to 999; the card panel picks it from a dropdown of None, 1, 2, 3, 5, 8, 13 and 21 (`ESTIMATE_POINTS`), keeping any other value a card holds           |
| `start`           | date      | A calendar date, `YYYY-MM-DD`: when the work begins (a Project's bar on the [Gantt chart](plan-views.md#gantt-chart))                                                 |
| `due`             | date      | A calendar date, `YYYY-MM-DD`                                                                                                                                         |
| `color`           | colour    | One of the twelve Plan swatches (`#2563eb`...): the item's own colour, shown beside its type colour, never instead ([Colour](#colour))                                |
| `checklist`       | checklist | Up to 50 `{ text, done }` rows                                                                                                                                        |
| `parent`          | card link | Another item's id (a Project): the Card field named Parent that Task carries (item-types.md "Card fields"), under its reserved id                                     |
| `votes`           | votes     | Per-person counts `{ [personId]: n }`: the tallies of ended session votes, written only by a vote's end                                                               |
| `comments`        | comments  | The card's conversation: the same comment thread a canvas element carries (`{ comments, resolved }`), written only through the comment writes ([Comments](#comments)) |

A card's type may leave statuses out ([Item types](item-types.md#an-item-type)): an item made or moved into one is
refused (`status_excluded`), from the editor, the api and agents alike. A card already in one is never moved out
by it, and putting a change back (a restore from the Trash, an undo or redo) is never refused.

## Item types

Five built-in types, each with a glyph, an accent colour and the fields it offers in the item panel:

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
- Every built-in type also offers **comments**, last, in its Overview tab ([Comments](#comments)). A document whose
  own catalogue predates it adds it in the type editor, like any built-in field.
- A bug is a Task labelled `bug`.
- A document can change these and add its own, with custom fields: see [Item types](item-types.md).

## Colour

- An item's **Colour** is one of the twelve swatches a card type is given from (the type editor's Colour), or none.
  Any other value is refused, like any invalid field value.
- It is an **addition** to the type colour, never a replacement: a card keeps its type's stripe and glyph colour,
  and the item's colour shows as a small dot beside them.
- It is set in the item panel from one compact dropdown showing the colour's dot and name (or **None**); it opens
  the same swatches as the type editor, plus **None**, which clears it, in a small popover under the field, inside
  the item panel (so the panel's focus trap holds it). A pick closes it, as do Escape (which leaves the card open
  and returns focus to the field), Tab out of it and a press outside.
- The swatches are one radio group with one Tab stop, the picked swatch (or None, or the first when nothing is
  picked): the arrow keys move along them (wrapping), Home and End jump to the ends, and Enter or Space picks.
  Opening the popover (a click, Enter, Space or an arrow key on the field) moves focus to the picked swatch.
- Where it shows:
  - **Card face**: a small dot beside the card's type label.
  - **Parent**: in the item panel, the Parent field (and the cards in its list) draws the linked card's type glyph in
    the linked card's own colour instead of the type's, with no dot, to save space; on the card face, the project's
    dot before its name.
  - **Swimlanes by Project**: each project row's header shows the project's dot.
  - **Gantt Chart**: a project's bar and diamond are drawn in its colour, else the Project type colour; the
    row's name carries its dot ([Gantt Chart](plan-views.md#gantt-chart)).
- A document whose own catalogue predates it keeps its Project type as saved; Colour is added in the type editor
  like any built-in field.

## Changing items

- **Create**: a type, fields (a title at least) and an optional place (`status`, and the item to sit after).
- **Update**: a field patch: keys to set and keys to clear. Two people editing different fields never overwrite
  each other; the same field resolves to the last write.
- **Move**: a new `status` and/or a new `rank`, given as "after this item" or "before this item" (or the top or
  end of a column), so a move needs no knowledge of other ranks.
- **Tally**: a session vote's host, ending it, adds each card's dots to the card's `votes` (per voter, as
  pseudonymous person ids) in one write (`POST /items/tally`, edit access); nothing else writes `votes`. Cards are
  voted on through the tab's session vote ([Session tools](../012-collaboration/session-tools.md) "Voting on Plan
  cards"), which keeps its own budget and privacy.
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
- In Plan mode a **Trash** button leads the bottom-right cluster's Plan strip, on its left before **Find a
  Card** and **Card Types** (not on a phone, whose cluster has no room for it: a card's menu still sends it to
  the Trash), its count tucked into its corner; with a grey badge of how many cards
  it holds. While a card is dragged the button opens out into a dashed **Drop to Trash** target, and while the
  card is over it fills with the brand colour, tips its lid and reads **Let go to trash it** (no motion with reduced motion; the
  colours still change); a card let go there is trashed and the move is announced.
- **Every way of deleting a card trashes it**: **Trash** in its menu and in the item panel's ⋯ menu (named
  **Trash**, not Delete), the Delete key on a focused card, and the drop on the Trash button. Each closes an open
  panel and is announced ("Card moved to the Trash"). A card leaves the store for good only from the Trash popover
  (below) or Empty Trash.
- Pressed, it opens the **Trash** popover (352 px wide): how many cards it holds, then each card, newest change
  first, with its type's stripe and glyph, its whole title, its type, number, the status it came from and when,
  and **Delete** and **Restore** (back to `trashedFrom`, or no status) on a row of their own. **Delete** asks first
  in a confirm popover beside the button ("Delete #12 for good? This cannot be undone.", **Delete**), as
  the workspace Trash does; **Empty Trash** deletes every one after a confirmation ("This can't be undone"), then the Trash
  panel closes.
- An empty Trash shows the shared empty state: **The Trash is empty**, and how to put a card there.
- Moving many cards to the Trash at once (a deleted card type's, a removed column's) is one change: one request
  per 200 cards, one undo step, one update for everyone watching.
- Trash and Restore send `Plan · Moved · Trash` and `Plan · Restored · Card`; opening it, `Plan · Opened · Trash`.

## Comments

A card carries a comment thread through the canvas's own comment model ([Canvas and
palette](../008-canvas/canvas-and-palette.md), [Comment mentions](../012-collaboration/comment-mentions.md)): the
same `Comment` and `CommentThread` values, the same rules for who may write, delete, resolve and reopen, the same
author redaction, and the same thread list, composer and resolve control the comment popover draws.

- **Where it shows**: `comments` is a built-in field. In the item panel it is the last field of the Overview tab,
  under its label **Comments**, drawn as a feed with no surrounding box:
  - Once there is a comment, a quiet header row says how many (**1 comment**, **3 comments**) with **Resolve** (a
    check icon and the word) at its end. While resolved, the header shows a green **Resolved** badge with
    **Reopen** beside it, and the composer is hidden.
  - Each comment is a row: the author's avatar (28 px, their picture where the canvas has one, else initials on
    their colour), their name in medium weight, the relative time muted ("2m ago"; the full date and time in a
    tooltip), and the text below at 13 px with relaxed line height, line breaks kept and @-mentions as chips.
    Rows sit a hairline apart. Delete is a quiet trash icon (with a tooltip) that shows on the row's hover or
    focus, to whoever may delete it.
  - The composer sits under the thread beside your own avatar: a one-line field that grows with its text (to
    about eight lines, then scrolls), a soft border taking the brand ring on focus, placeholder **Add a
    comment…**. **Comment** stays disabled until there is text. While the field has focus a hint names the
    shortcut, **⌘ Enter to send** on Apple devices and **Ctrl Enter to send** elsewhere; a plain Enter adds a line.
  - Empty, it reads **No comments yet. Start the conversation.** as a quiet line. Someone who may not comment
    reads the thread with no composer and no Resolve. A type that stops offering comments keeps the card's thread
    stored, unshown, like votes.
- **On the card**: a `comments` card field (a speech-bubble glyph and the count of comments in an open thread,
  drawn only when there is one), on Compact and Detailed cards, beside the votes. New boards show it. Exports and
  thumbnails draw it too, after the votes, by the same rule (a board's card fields; a Plan card always).
- **Writes**: add (text up to 2,000 characters, optional mentions), delete, resolve, reopen. Each is applied by the
  api to the item as stored, so concurrent comments, deletes and resolves all land. A comment's author name,
  colour and id are stamped by the server from the caller, never taken from the request. Adding to a resolved
  thread reopens it, as on the canvas. A comment change counts as a change to the item (its `rev`, **Edited by**).
- **Who may**: anyone who may comment on the document (participate access) may add a comment and resolve or
  reopen the thread; they may delete their own comments, and someone with edit access may delete any.
- **Author ids**: a comment's author id never leaves the api except to its own author (as on the canvas): every
  read and every write's answer leaves it out of other people's comments, and the room's `items` op leaves it out
  of all of them.
- **Live**: every comment change is an item write, so it reaches the room like any other, and an open item panel
  shows it at once.
- **Trash, Archive, Delete**: trashing or archiving a card keeps its thread; restoring brings it back as it was.
  Deleting a card for good (from the Trash) deletes its thread with it; undoing that delete restores the thread, keeping the author id only
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

## New Card

- Plan mode's bottom-right strip holds, for someone who may edit, a **+** (**New Card**, with a hover card) between
  the Trash and Find a Card. It opens the **New Card** panel above it, pointing at it as the strip's other panels
  do: a tile per card type of the document (no Add New Card Type here). A pick makes a card of that type, off any
  board, in its type's starting status (its Default State, else the first status the type
  uses), titled as the type names a new card ("New task"), and opens it in the card panel with its title selected.
- Telemetry: `Plan` · `Added` · the type, as any new card.

## Finding a card

- **Cards** is a button in Plan mode's bottom-right cluster, after the Trash in one strip with Card Types
  (buttons in one frame, as Undo and Redo are, each opening its own panel); it opens a popover of every card
  in the document that is neither archived nor in the Trash, 44 rem wide on desktop (the screen less a margin on
  a phone) with a list 32 rem tall (less on a short screen) whatever it holds, so the panel keeps its size as a search
  narrows it, of every card type the catalogue has (custom types
  included, each drawn with its own glyph and colour) and of a type it has lost (drawn as the fallback "Item"),
  newest change first.
- A search field (focused on open with a mouse, not on a phone) matches a card's number (`12` or `#12`), title,
  description or card type name ("person" finds every Person card), ignoring case.
- **All Cards** (the wider: all the room **Not on a Board**, on one line at its own width, leaves) and **Not on a Board** switch between every card and the cards no board in the document shows,
  on any tab: those with no status, those whose status no column holds (the strays a renamed or removed column
  left behind), and those whose status is a column only on boards whose Card Types leave the card's type out. A
  card is on a board when some board (not an All Cards or Archive board) names its status as a column and shows
  its type. Each carries a count.
- **Filters**: under the switch, a chip per field filter ("State: Done", "Assignee: No assignee"), each with a
  cross, and **Add Filter**, the picker Card Search uses ([Plan views](plan-views.md#card-search)): a field the
  listed cards' types offer (Card Type among them while they hold more than one type), then one of its values among them with its count, so no filter leaves nothing. Every
  filter must match; **Clear Filters** removes them. They are the person's own while the panel is open, never saved. Filters matching nothing: **No cards match these filters** (below).
- At most 200 rows are drawn, with "Showing 200 of N. Search to narrow them down." beneath.
- Each row is the card as a board draws it at **Compact** size, laid out as its type's Display says, so a card
  looks the same in the panel as on a board (named for assistive technology "Open {Title}, {Type} #{n}"). Its state is not shown: a state filter
  narrows by it. Choosing one closes the popover and
  opens the card in the item panel.
- Someone who can edit sees a bin beside each row (on hover with a mouse, always on a phone): **Move to Trash**
  puts that card in the Trash (restorable from there) without leaving the list.
- Empty: the shared empty state (as the Trash's: an icon badge, a title and a line), filling the list's height:
  **No cards yet** ("Add one from a board, or drag one in from the palette."); a search matching nothing, **No cards
  match** ("Try another word, a number or a card type."); filters matching nothing, **No cards match these filters**
  ("Remove a filter, or Clear Filters, to see more."); no strays, **Every card is on a board** ("None of them sits
  off a board here.").
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
- A tally is not undoable (a session vote's dots are taken back during the vote), matching comments and assigned
  actions. A card's
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

- **A field never shows a value nobody kept.** A card panel's text field stops taking characters at its limit (a
  title at 500, a custom Text or Long Text at 2,000), showing how many are left from 90% of it ("12 characters
  left", then "500 characters, the most it takes"). A change refused anyway (by the store before it is sent, or
  by the api) is not kept: the field goes back to the saved value, and a toast names why ("That title is too
  long: a card title holds up to 500 characters", "That value is too long or isn't one this field takes").

- Up to 2,000 items per document; a create past it is refused with `items_full`.
- Up to 16 KB of fields per item, 64 field keys, keys of letters, digits, `_` and `-`, up to 40 characters. A
  card's comment thread sits outside that budget: up to 200 comments and 128 KB per card; a comment past either is
  refused with `comments_full`.
- Item writes count against the write rate limit.

## Deleting a document

Deleting a document for good deletes its items with it. Trash keeps them until then.
