# Item types

A document's **item types** are the kinds of item its Plan boards hold: the built-in five (Project, Task, Note,
Idea, Action) and any a person adds. Each is a name, a colour, a glyph and the fields its items
offer, including fields a person makes up. People edit them from the **Card Types** panel; every card, board,
item panel and the palette's Cards category reads them from the document.

Builds on [Items](items.md) (the item store, fields) and [Plan mode](plan-mode.md) (the palette).

## Domain language

| Term               | Means                                                                                                                     | Never called                |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------- | --------------------------- |
| **item type**      | What an item is: an id, a name, a colour, a glyph and its fields                                                          | kind, category, template    |
| **type catalogue** | A document's item types, in the order the interface lists them                                                            | schema, config, type list   |
| **custom field**   | A field a person adds to a type: an id, a name and a field kind                                                           | property, attribute, column |
| **card type**      | The interface's name for an item type, on the Card Types panel and its button, because the interface shows items as cards | (no other name)             |

## The type catalogue

- Every document has one. Until someone changes it, it is the **built-in catalogue**, read from code: a document
  stores nothing, and a built-in improved in a later release reaches it.
- The first change stores the **whole catalogue** with the document (the built-ins as they are, plus the
  change). From then on the stored catalogue is the document's, whole; later releases do not change it.
- **Restore Built-In Types** puts the built-in catalogue back (stored catalogue removed) after a confirmation.
  Items of a type the built-ins do not have keep their type and draw as the fallback "Item".
- The catalogue is part of the document: copies, duplicates, offline documents, Sync to Cloud, Take Offline and
  the Drive file carry it, as they carry the items.

## An item type

| Part               | Holds                                                                                                                                                                                                                                           |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`               | A slug, `a-z0-9-`, up to 32 characters, unique in the catalogue. Built-ins keep theirs (`task`, `bug`...); a new type's is made from its name (`customer-call`), with `-2`, `-3` on a clash. Never changes once made: items store it.           |
| `label`            | The name, 1 to 32 characters, unique in the catalogue ignoring case                                                                                                                                                                             |
| `color`            | A colour from the Plan palette's twelve swatches; on a dark surface an accent too dark to see (Project's black) is drawn lifted toward white to 3:1                                                                                             |
| `icon`             | A glyph from the Plan glyph set: 74 line glyphs in eight categories, the built-in types' among them (ids never change or go, so a stored type always draws)                                                                                     |
| `fields`           | The fields its item panel offers, in order: built-in field ids and custom field ids                                                                                                                                                             |
| `custom`           | Its custom fields: `{ id, label, kind, options?, linkType?, onCard? }` (`linkType`: a Card field's target card type id)                                                                                                                         |
| `tabs`             | Its item panel's tabs, in order: `{ id, label, fields }`. A field in a tab shows on that tab; a field in no tab shows in the panel's **Details**. Absent: one tab, **Overview**, holding Description, Checklist and any Long text custom fields |
| `detailsLabel`     | What the panel calls **Details** (its side column, and the phone's first tab): 1 to 24 characters. Absent: "Details"                                                                                                                            |
| `excludedStatuses` | The statuses (ids) cards of this type do not use, up to 64 (a document's boards may name more; the type editor stops at 64). Absent: every status. A status added later is open to every type                                                   |

- **`title` and `status` are always offered** and cannot be removed: every item has a title, and a board files
  items by status.
- **A Project (`project`) always offers `start` and `due`** too: the Gantt chart draws a project from them. They
  cannot be removed from the Project type (in the type editor they carry the lock and "Always", and have no ×),
  but they move between groups and within one like any field. A stored Project type without them (saved before
  this rule) gets them back, at the end, when the catalogue is read.
- **Statuses a type leaves out** (`excludedStatuses`): a card of the type never moves into one. Kept as what is
  left out, so a status a board adds later is open to every type until a type leaves it out. An id no board names
  any more is kept, so the status keeps its exclusion if it comes back. A type may leave out every status: its cards
  stay in the status they are made in and never move. Only a move into a left-out status is refused, never a new
  card: a card is made in whatever column it is added to (Add Card, a palette card, New {Type}), even one whose
  status its type leaves out, and a card already in one (moved there before the type left it out) stays where it is, shows its status, and
  can move out but not back. A type change keeps the card's status whether or not the new type uses it. Every way a
  status changes keeps to it:
  - a drag (on a board, or onto another) over a column whose status the type leaves out shows the red refused zone
    at the column's foot, saying "**{Type} cards can't be {Status}**", and the drop moves nothing and says the same;
  - Shift+Left/Right into such a column moves nothing and announces the same;
  - the card panel's **Status** offers only the statuses the type uses (a left-out one the card is already in shows
    as "{Status} (not used by {Type})", unselectable);
  - a palette card held or dropped over such a column is still made there (no red zone: it is a new card, not a
    move); a column's **Add Card** offers every type the board takes;
  - a card's **Move To** menu, and the **not on board** tray's Move To, offer only the columns whose status the
    type uses;
  - removing a column moves its cards to the chosen column except those whose type leaves that status out: they
    stay (in the tray), and one announcement says how many ("2 cards stayed: their types can't be Done");
  - a canvas Plan card dropped on a board is checked first, against the board's card types and the column's
    status: a refused drop moves nothing, says why on screen, and the canvas card goes back to where the drag
    started, leaving no undo step; the canvas card leaves only once the move has saved;
  - a card already in a left-out status is never refused its own status: it is reordered there, and moves between
    swimlanes, freely. A swimlane by type is checked with the lane's type, the one the card would have;
  - the api refuses an item moved or edited into such a status (`status_excluded`, field `status`), so an agent or
    the CLI is told "the item's card type does not use that status"; making one in it is allowed. Putting a change
    back is never refused: a card restored from the Trash to the status it was trashed from, and an undo or redo
    (sent with `undo: true`, which the editor's undo and redo always set).
- A type holds up to **24 fields** and up to **12 custom fields**. A catalogue holds up to **32 types**.
- **Custom field kinds**: Text, Long text (up to 2,000 characters), Number, Date, Checkbox, Link (an `https://`
  URL), Choice (one of up to 20 named options) and Card (a link to one card of another type, below). Every value
  is a plain string, number or true/false, which the
  item store keeps for any field. People are assigned with the built-in Assignee field, so there is no custom
  person kind. Their values are ordinary entries in the item's `fields`, under the custom
  field's id (`f-` and a slug of its name), so the store, agents and exports already carry them.
- **Card fields** link a card to one other card, of the card type the field names (`linkType`): an Objective's
  **Owner** links to a Person. The value is that card's id. The built-in **Parent** is the same kind of link, to a
  Project, and both use one control and one way of listing what links where:
  - **The control** (the card panel): one bordered field the width of its row, showing the linked card's type
    glyph in its colour, its own colour dot when it has one, its number as a quiet tag and its full title (cut only
    at the field's end, the whole "#1 Title" in a tooltip), a chevron, and an open arrow at its end (inside the
    same border, tooltip "Open #1 Title") that opens the linked card in the panel. Empty, it reads **None**,
    muted; a link whose card is gone reads **Missing card**. Pressing it (or Enter, Space or an arrow key) drops
    a list under it: **None**, then the live cards of the linked type in number order (never the card itself, nor
    a trashed or archived card), each with its glyph, number and title; with more than 8 a filter leads the list
    (by number or title). The arrows move, Enter picks, Escape closes the list (not the card), and a press outside
    closes it. Its accessible name is the field's ("Parent", "Owner").
  - **On the linked card**: a Project's **Child Cards** (the cards naming it as Parent), then, for every Card
    field that links to the card's type, a **Linked as {Field}** section ("Linked as Owner") listing the cards
    pointing here (glyph, number, title, Archived, status, assignee; pressed, each opens), its count, an empty
    note ("No cards link here as Owner yet."), and **New {Type}** for each type whose field links here: it makes
    a card of that type already linked, in the first status its type uses, and opens it. These sit on the
    type's first tab, before Comments.
  - **On the card face**: a Card field marked Show on card reads "{Field}: {linked title}" with the linked type's
    glyph.
  - **Boards** can lay their rows by a Card field (Swimlanes by a field): a row per linked card (named by its
    title, in number order) and **No {Field}**; dropping a card into a row sets the link.
  - Deleting, trashing or archiving a linked card never clears the links: they read **Missing card** until the
    card is back or the link is changed. A Card field whose type is gone from the catalogue keeps its `linkType`.
- **Tabs**: a type has up to **6 tabs**, each with a name of 1 to 24 characters, unique in the type ignoring
  case. A field sits in at most one tab. Title is never in a tab: it heads the panel. With one tab the panel shows
  its fields without a tab bar.
- **On the card**: a custom field marked **Show on card** is drawn on the card face, after the built-in fields
  the board shows (one line: its name and value). The board's card fields still choose the built-in ones.

## The Card Types panel

- In Plan mode, the bottom-right cluster has a **Card Types** button (the Cards glyph) where Diagram has Layers.
  It opens the panel as a popover hanging above the button, as Layers does from its button; it closes on a
  press outside, a second press of the button, or leaving Plan mode.
- **Edit Cards** opens it too: a button at the foot of the palette's Cards category (floating layout), and at
  the end of the Toolbar layout's strip while Cards is chosen.
- The panel is 34 rem (544 px) wide on desktop, two types to a row; on a phone the screen's width less a margin,
  one to a row. It lists the
  catalogue in two groups under small headings: **Built-In Types** (Project, Task, Note, Idea and Action, edited or
  not) and **Your Types** (the ones this document added, in the order they were added; before there are any, the
  group says "Types you add show here." to someone who may edit).
- The panel lists the catalogue as small cards: each type's accent stripe, its glyph on a tint of its colour,
  its name with "N fields" (and "N custom") under it (no count badge: a type no card has yet is drawn a little
  grey, and the count is in its accessible name only), a **Duplicate** button (a copy
  icon, with a tooltip) and a pencil. A press anywhere on a row (or Enter on it) opens the type editor.
  **Duplicate** opens the type editor as a **new** type filled from that one: its name with " copy" (then
  " copy 2", " copy 3"... while the name is taken, shortened to fit 32 characters), and the same colour, glyph,
  fields, custom fields, tabs and Details name. Nothing is made until **Save**; **Cancel** drops it. With the
  catalogue full it is disabled and its tooltip says "The document has the most card types it can hold".
  The type editor's footer offers **Duplicate Type** too, for a type that exists. Telemetry: `Plan` ·
  `Duplicated` · `CardType` when a duplicate is saved. **Add Type** is a dashed tile at the end, with **Restore
  built-in types** under it once the catalogue is stored. The panel does not reorder types: the catalogue keeps
  its order (the built-ins first, then added types in the order they were added).
- Someone who may only view the document sees the list without the edit and add controls.

## Editing a type

- **Add Type** and a row's edit open the **type editor**, a wide modal (60 rem, as the card panel; a sheet rising
  from the bottom on a phone) in three **tabs** under its title: **General**, **Fields** and **Statuses**. It opens
  on General. Arrow keys, Home and End move between the tabs. A tab holding what stops Save carries a small red
  dot (a missing or clashing name is General's; a tab or custom field problem is Fields'), and the problem is
  still named beside Save. The tabs edit one draft: switching loses nothing, and Save or Cancel acts on the whole.
  The title row ends with **Help** (the Card Types help article) and a close cross, which acts as Cancel. Every
  button carries an icon: Save a tick, Cancel and the cross a cross, Delete Type a bin, Duplicate Type the copy
  icon, Back a left chevron, Add Field, Add Tab and Add Custom Field a plus.
  - **General**: **Name**, **Colour** (the twelve swatches) and **Glyph**: the glyph set as a grid in eight
    categories, each under a small uppercase heading (**Work**, **People**, **Communication**, **Planning**, **Ideas
    and Notes**, **Status and Signals**, **Business**, **Things**), with **Search glyphs** above it filtering by a
    glyph's name and a few keywords each ("money" finds Coin and Wallet); with no match it says "No glyphs match
    “…”.". One radio group, each tile named "{Name} glyph", the chosen one pressed as before.
  - **Fields**: the Fields and Tabs list below. **Statuses**: the type's statuses (below).
  - **Fields and Tabs**: one list laid out as the card's panel shows the fields, in groups:
    - **On the Card**: Title (always) and Votes when the type has it; they never go in a tab.
    - Each **tab**, tagged "Tab", in order (Overview first, as the panel reads): renamed in place in its header, moved with ↑ and ↓, and taken off with
      × (its fields go to Details). **Overview** is renamed and moved like any tab but has no ×: it stays, even
      empty. A new tab's name field takes focus. An empty group says so, and that any tab but Overview left
      empty is dropped when the type is saved.
    - **Details**, tagged "Side column", after the tabs: every field in no tab, its name renamed in place in the group's header,
      never moved or removed.
  - Each field row shows its name and, for a custom field, its kind (Title and Status, and a Project's Start and
    Due, say "Always" with a lock).
    **Move To** files it under another group (Details or a tab); ↑ and ↓ move it within its group; × takes it
    off. Title and Status have no ↑, ↓ or ×, and every row keeps their slots so the controls line up. A custom
    field's **Edit** (a pencil) opens its name, its options (Choice), its **Links To** (Card) and **Show on card** in
    its row.
  - Each group ends with **Add Field**, which offers the built-in fields the type lacks as chips, and **New
    Custom Field**: a name and a kind (and the options, one a line, for Choice; for Card, **Links To** a card type,
    required). The field lands in that group
    (Votes always on the card). **Add Tab**, under the groups, adds an unnamed tab.
  - **Statuses**: every status this tab's boards name, each a chip pressed while the type uses it (all pressed to
    start). Pressing one off leaves it out; all may be off, and then a note says a card of this type stays in the
    status it is made in and can never be moved to another. With no columns on the tab's boards it says
    there are no statuses to choose from. At most 64 may be off: then every status still on is disabled and a
    note says "A type can turn off at most 64 statuses. Turn one back on to turn off another."
  - A problem is named beside Save, which waits for it: no name, a name another type has, or a custom field
    without a name or a Choice without options, a tab without a name, or two tabs with one name, or more than 64
    statuses off (a type stored that way: "Too many statuses turned off: a type can turn off at most 64.", on the
    Statuses tab).
  - **Delete Type**, at the foot, for a type that is not the catalogue's last.
  - **Save** applies the whole edit as one change; **Cancel** drops it.
- Removing a field from a type, or deleting a custom field, never deletes values: items keep them, and they show
  again if the field returns. The type editor says so under the field list once a field is removed.
- **Deleting a type with items** asks where they go: another type (picked from the catalogue) or **Keep as
  Item** (they keep the old type id and draw as the fallback "Item"). Without items it deletes at once.
  A board that showed only the deleted type shows and takes every type again ([Plan board](plan-board.md#the-board-set-up)).

## Where types show

- **The palette's Cards category** lists a card per type, in catalogue order, captioned "<Name> card", and
  lands it in a board's column as the built-in ones do.
- **Cards** draw a type's colour (behind the card number) and glyph (an item's own [Colour](items.md#colour) is a dot beside them,
  never in their place); the item panel's type picker lists the catalogue; the Add a
  Card popover offers the types the board shows, and its title field's `name:` prefix matches a type's name
  (`customer call:` too).
- **A board's rows By Card Type** follow the catalogue's order and names.
- **Agents** see the type ids on items, as before; an item made by an agent with a type the catalogue lacks
  draws as "Item".

## Collaboration

- A saved change reaches everyone with the document open at once: their cards, panels and palette redraw.
- Two people saving the same type: the later save wins, whole (the catalogue is one value), as a board's set-up.

## Undo

- Saving a type edit, adding, deleting and reordering are each one undo step, interleaved with canvas and item
  steps. Undo puts the previous catalogue back; it never changes items (a delete's "move them to" writes are
  their own item steps).

## Storage and sync

- The stored catalogue is a JSON column on the document (`item_types`, null for the built-ins), written only by
  its own route, `PUT /api/documents/{id}/item-types` with `{ itemTypes }` (a catalogue, or null to restore the
  built-ins), by anyone who may edit the document. Its answer is the catalogue as stored.
- Each write reaches the document's room as an ordered system op, `item-types`, carrying the catalogue, so open
  editors redraw at once; a tab-scoped session receives it too (types hold no content).
- The document's GET carries `itemTypes`. An offline document keeps it in its record and writes it there.
- Copies (the api's copy, Duplicate), Sync to Cloud, Take Offline and the Drive file carry it, as items.

## Limits and validation

- The api validates a stored catalogue whole (shape, ids, counts, lengths, kinds) and refuses one that fails,
  by name (`item_types_invalid`), keeping the last good one. Its stored size is at most 32 KB.

## Telemetry

- `Plan` · `Opened` · `CardTypes` when the panel opens; `Plan` · `Changed` · `CardType` when a type is saved, `Plan` · `Added` · `CardType` when one is added,
  `Plan` · `Duplicated` · `CardType` when a duplicate is saved and `Plan` · `Deleted` · `CardType` when one is deleted. Never names, ids or field names.
