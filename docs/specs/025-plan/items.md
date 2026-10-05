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

| Field         | Kind      | Holds                                                                      |
| ------------- | --------- | -------------------------------------------------------------------------- |
| `title`       | text      | One line, required, up to 200 characters                                   |
| `description` | long text | Plain text with line breaks, up to 10,000 characters                       |
| `status`      | status    | A status value, matched against a board's columns                          |
| `assignee`    | person    | `{ id, name, color }`: the person it is on, picked like an assigned action |
| `priority`    | priority  | `urgent`, `high`, `medium` or `low`                                        |
| `labels`      | labels    | Up to 12 short strings                                                     |
| `estimate`    | number    | Points or hours, 0 to 999                                                  |
| `due`         | date      | A calendar date, `YYYY-MM-DD`                                              |
| `checklist`   | checklist | Up to 50 `{ text, done }` rows                                             |
| `parent`      | item ref  | Another item's id (a Project), resolved within the same document           |
| `votes`       | votes     | Per-person counts `{ [personId]: n }`, written only through voting         |

## Item types

Five built-in types, each with a glyph, an accent colour and the fields it offers in the item panel:

| Type    | Accent | For                                    | Offers                                                                                   |
| ------- | ------ | -------------------------------------- | ---------------------------------------------------------------------------------------- |
| Project | Black  | A larger body of work others sit under | title, description, status, assignee, priority, due, labels                              |
| Task    | Gray   | A piece of work                        | title, description, status, assignee, priority, estimate, due, checklist, labels, parent |
| Note    | Blue   | A thought, a retro note                | title, description, status, votes                                                        |
| Idea    | Yellow | A proposal to weigh                    | title, description, status, votes, labels                                                |
| Action  | Red    | Something agreed to do                 | title, status, assignee, due                                                             |

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
  and carry its votes; the key is honoured while it is free.
- Every write answers with the item as stored.

## Who may do what

Items follow the document's access ([Auth and guest access](../014-identity/auth-and-guest-access.md)):

- **Read** with any access to the document. A visitor on a **tab-scoped** link sees only the items that tab shows:
  the items its boards show and its Plan cards point at.
- **Create, update, move, delete** with edit access.
- **Vote** with participate access, as comments.
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
- Votes are not undoable (a vote is taken back by voting minus), matching comments and assigned actions.
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

## Limits

- Up to 2,000 items per document; a create past it is refused with `items_full`.
- Up to 16 KB of fields per item, 64 field keys, keys of letters, digits, `_` and `-`, up to 40 characters.
- Item writes count against the write rate limit.

## Deleting a document

Deleting a document for good deletes its items with it. Trash keeps them until then.
