# Item types

A document's **item types** are the kinds of item its Plan boards hold: the built-in eight (Task, Story, Bug,
Epic, Note, Idea, Action, Risk) and any a person adds. Each is a name, a colour, a glyph and the fields its items
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

| Part     | Holds                                                                                                                                                                                                                                 |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`     | A slug, `a-z0-9-`, up to 32 characters, unique in the catalogue. Built-ins keep theirs (`task`, `bug`...); a new type's is made from its name (`customer-call`), with `-2`, `-3` on a clash. Never changes once made: items store it. |
| `label`  | The name, 1 to 32 characters, unique in the catalogue ignoring case                                                                                                                                                                   |
| `color`  | A colour from the Plan palette's twelve swatches                                                                                                                                                                                      |
| `icon`   | A glyph from the Plan glyph set (the eight built-in glyphs and eight more)                                                                                                                                                            |
| `fields` | The fields its item panel offers, in order: built-in field ids and custom field ids                                                                                                                                                   |
| `custom` | Its custom fields: `{ id, label, kind, options?, onCard? }`                                                                                                                                                                           |

- **`title` and `status` are always offered** and cannot be removed: every item has a title, and a board files
  items by status.
- A type holds up to **24 fields** and up to **12 custom fields**. A catalogue holds up to **32 types**.
- **Custom field kinds**: Text, Long text (up to 2,000 characters), Number, Date, Checkbox, Link (an `https://`
  URL) and Choice (one of up to 20 named options). Every value is a plain string, number or true/false, which the
  item store keeps for any field. People are assigned with the built-in Assignee field, so there is no custom
  person kind. Their values are ordinary entries in the item's `fields`, under the custom
  field's id (`f-` and a slug of its name), so the store, agents and exports already carry them.
- **On the card**: a custom field marked **Show on card** is drawn on the card face, after the built-in fields
  the board shows (one line: its name and value). The board's card fields still choose the built-in ones.

## The Card Types panel

- In Plan mode, the bottom-right cluster has a **Card Types** button (the Cards glyph) where Diagram has Layers.
  It opens the panel as a popover hanging above the button, as Layers does from its button; it closes on a
  press outside, a second press of the button, or leaving Plan mode.
- The panel lists the catalogue: each type's glyph and colour, its name, how many items have it, and an edit
  button. **Add Type** sits at the end, with **Restore Built-In Types** beside it once the catalogue is stored.
  Rows reorder by drag, or with Alt and the up or down arrow on a focused row (announced); the Cards category
  follows the order.
- Someone who may only view the document sees the list without the edit, add and reorder controls.

## Editing a type

- **Add Type** and a row's edit open the **type editor**, a modal (a sheet rising from the bottom on a phone):
  - **Name**, **Colour** (the twelve swatches) and **Glyph** (a grid of the glyph set).
  - **Fields**: the type's fields in order, each with its name and its kind (Title and Status say "Always"),
    moved with ↑ and ↓ and taken off with ×, except Title and Status. **Add Field** offers the built-in fields
    the type lacks as chips, and **New Custom Field**: a name and a kind (and the options, one a line, for
    Choice).
  - A custom field's **Edit** opens its name, its options and **Show on card** in its row.
  - A problem is named beside Save, which waits for it: no name, a name another type has, or a custom field
    without a name or a Choice without options.
  - **Delete Type**, at the foot, for a type that is not the catalogue's last.
  - **Save** applies the whole edit as one change; **Cancel** drops it.
- Removing a field from a type, or deleting a custom field, never deletes values: items keep them, and they show
  again if the field returns. The type editor says so under the field list once a field is removed.
- **Deleting a type with items** asks where they go: another type (picked from the catalogue) or **Keep as
  Item** (they keep the old type id and draw as the fallback "Item"). Without items it deletes at once.
- A board whose scope names a deleted type drops it from the scope.

## Where types show

- **The palette's Cards category** lists a card per type, in catalogue order, captioned "<Name> card", and
  drags or places it as the built-in ones do. Popular keeps its built-in card tiles while those types exist.
- **Cards** draw a type's colour stripe and glyph; the item panel's type picker lists the catalogue; quick add's
  `name:` prefix matches a type's name (`customer call:` too).
- **Board set-up's scope** lists the catalogue's types.
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

- `Plan` · `Opened` · `CardTypes` when the panel opens; `Plan` · `Changed` · `CardType` when a type is saved, `Plan` · `Added` · `CardType` when one is added and
  `Plan` · `Deleted` · `CardType` when one is deleted. Never names, ids or field names.
