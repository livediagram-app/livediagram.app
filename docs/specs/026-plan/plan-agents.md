# Plan for agents

How an agent (the MCP tools and the CLI's verbs, [Agents](../024-agents/README.md)) reads and works a document's
Plan boards, items and card types. People see an agent's changes on their boards at once, as anyone's.

The bar: an agent that knows only the tool descriptions puts a card in the column it means on the first try, and is
never told a change worked when it shows on no board.

## Domain language

| Term            | Means                                                                       |
| --------------- | --------------------------------------------------------------------------- |
| **column name** | What a board's column is called ("In Progress"): what people and agents say |
| **status**      | The id a column files cards by (`in-progress~k3f2`): what items store       |
| **the plan**    | A document's boards, their columns and the card types, as agents read them  |
| **card type**   | An [item type](item-types.md): the interface's word, used by agents too     |

## Reading the plan

- The api answers a document's plan in one request, `GET /api/documents/:id/plan`, to anyone who may read the
  document (a tab-scoped grant sees its tab's boards only):
  - **boards**: each Plan board, in tab then canvas order, with its tab (id and name), its title, its kind
    (`board`, `all-cards`, `archive`), the card types it takes (every type when it names none; none, as the editor shows, when its last type was
    turned off) and its columns (name, status, WIP
    limit);
  - **statuses**: each status the boards name, once, with its column name, the first board's name winning (the
    editor's rule, [Plan templates](plan-templates.md) "Hand-offs");
  - **types**: the document's card types (its catalogue, or the default types), each with its id, name and fields,
    custom fields by id, name and kind (and a Choice's options).
- Each board's card types are part of what it shows: a card is on a board only when its column is there and the
  board takes its card type ([Plan board](plan-board.md#the-board-set-up)).
- **`list_items`** answers the plan with the items: each board with its columns in order, each column with its
  name, status and the numbers of the live cards in it in board order (`#3 #7`; a board that takes only some card
  types lists only theirs), then the items, each with its column's name beside its status (`Trash` for a trashed
  card, none for a status no board names), then the card types. Live cards no board column shows are listed under
  **Not on a board**. This is the text `board` view [Plan mode](plan-mode.md#agents) named as a later step. A filter
  by card type or column names them exactly as `change_items` does (`in-progress` reads In Progress; `Trash` the
  Trash), and a name the document does not have is refused with the names it has, never answered with no items.
- A document with no board says so, and how to get one: a Plan template (`kanban`, `project-planner`,
  `bug-triage`, ...) on `create_document` or `add_tab`.

## Naming things as people do

Every write takes what a person would say, and stores the ids:

- **A status** is a column name or a status. A name matches a column's name with case, spacing and punctuation
  aside (`statusKey`): "in progress", "In-Progress" and "IN PROGRESS" are one column. A status matches exactly.
- **A card type** is its id or its name ("Bug", "bug").
- **A custom field** is its id (`f-severity`) or its name ("Severity") on the item's type; a Choice takes one of
  its options, by name, case aside.
- **An assignee** is a person object `{ id, name, color }` or a name. A name matches a person already assigned on
  the document (case aside); otherwise it makes a named person (`n-` and a slug of the name, a Plan swatch chosen
  from the name), so "Sam" is the same person on every card.
- **Unknown names are refused, never stored**: a status no board names is `status_unknown`, a type the catalogue
  lacks is `type_unknown`, a custom field the type lacks is `field_unknown`, a Choice value not offered is
  `choice_unknown`. Each refusal lists what is there ("Columns: Backlog, In Progress, Review, Done"). A card that
  should wait off every board is made with no status.
- A refused change stops the batch; the answer says what was applied before it, and why the rest was not.
- The api's own refusals (`status_excluded`, `fields_invalid`, ...) carry their meaning and a hint, the same on the
  CLI and the MCP.

## Adding a board

- **`add_board`** (MCP; the CLI's `board add`) puts a Plan board on a tab: a preset (`kanban` by default; `todo`,
  `sprint`, `bug-triage`, `retro`, `roadmap`, `weekly`, `archive`, `all-cards`, `blank`) or columns by name, with an
  optional title and the card types it takes (by name).
- It is placed as the palette places one: a column named like a status the document's boards already use takes
  that status, so its cards show on both boards; any other column gets a status of its own and starts empty.
- It goes on the tab named, else the first tab that already has a board, else the first tab, to the right of
  everything the tab holds (tops aligned), as one changeset an agent can revert.
- It brings its preset's card types, as placing it in the editor does
  ([Item types](item-types.md#the-type-catalogue)): in a document whose card types are not chosen and that has no
  cards, they become its card types; otherwise each [ready-made type](plan-templates.md#ready-made-card-types) it
  takes that the document lacks (a Bug Triage board's Bug) is added. So does `add_tab` with a Plan template, for
  the boards on its one tab.
- The answer gives its columns with their names and statuses.

## Changing a board

- **`change_board`** (MCP; the CLI's `board set`) changes a board named by its title (or its element id when two
  share a title): its title, its columns and the card types it shows and takes.
- Columns are given whole, by name, left to right: a name the board has keeps its column (status, WIP limit,
  colour) and so its cards; a name the document's other boards use shares their status; any other name is a new,
  empty column. A column left out takes nothing with it: its cards keep their status and wait off this board.
  Every column keeps an id of its own: a kept column keeps its id, and a new one whose name would give it a kept
  column's id ("Doing" beside a kept "In Progress" whose id is `doing`) takes the next free one (`doing-2`).
- Card types are named as everywhere; `"every type"` (the CLI's `all`) shows every type again, and an empty list
  takes none, as turning a board's last type off does in the editor. `add_board` reads an empty list the same way.
- It is one changeset on the board element, based on the element as read, so a person's change since is kept
  except on the set-up; the board widens when its columns need it.

## What a change says

- Each change's line names the card, its column by name, and for a `set` the fields it set and cleared.
- A card whose column no board shows, or whose every board with that column leaves its card type out, is said to be
  on no board ("in To Do, but no board with that column takes Bug cards, so none shows it: add Bug to "Kanban" with
  change_board"), so a write never reads as done when no board shows the card.
- An assignee named for the first time on the document is said to be a new name, not linked to anyone's account.

## Changing card types

- **`change_card_types`** (MCP; the CLI's `type` verbs) changes the catalogue in order, each change one of:
  - `add` `{ name, color?, glyph?, fields?, custom?, defaultStatus?, excludedStatuses? }`: a new type. Fields are
    built-in field names (`assignee`, `due`...) added after Title and Status (Description and Assignee when none
    are given, as the type editor starts a type); `custom` is `[{ name, kind, options?, linkType?, onCard? }]`
    (kinds `text`, `longtext`, `number`, `date`, `checkbox`, `link`, `choice`, `card`). Colour and glyph default
    as the type editor's Add Type does.
  - `set` `{ type, name?, color?, glyph?, addFields?, removeFields?, addCustom?, removeCustom?, defaultStatus?,
excludedStatuses? }`: edit a type. Statuses here are named as above. Removing a field never deletes values.
  - `delete` `{ type }`: as the type editor's Delete Type: the type goes and its cards (out of the Trash) move to the
    Trash; the answer says how many. The catalogue's last type cannot be deleted.
  - `add_default_types`: as Add Default Types: any of Project, Task, Note, Idea and Action the document lacks, after
    its types; nothing it has changes. `restore_built_ins`, its older name, does the same.
- The tool reads the catalogue, applies every change, checks the whole result with the editor's rules
  (`validateItemTypeCatalogue`) and saves it once; a refusal saves nothing and names the change and the rule. It
  answers the types as `list_items` lists them, with the ids it made (`bug`, `f-severity`), so the next call can
  use them.
- The save names the catalogue's revision it read ([Item types](item-types.md#storage-and-sync)): when someone
  changed the card types in between, it reads them again and applies its changes to theirs (a board an agent adds
  brings its types the same way), so neither change is lost. After three tries it refuses (`item_types_stale`).
- Only someone who may edit the whole document changes card types (a tab-scoped grant may not), as in the editor.

## Errors that teach

- A refusal says what was wrong, what is there, and the next call to make. It never answers with a raw api
  status.
- A tool error is a tool result marked as an error, never a thrown protocol error, for anything the caller can fix.

## Cost

- `list_items` and `change_items` each make at most two api reads (items and plan, in parallel) however many
  changes a call carries, then one write per change. `change_card_types` makes those two reads and one catalogue
  write, then one write per card of a deleted type. `add_board` makes three reads (document, plan with items, tab)
  and one changeset.
- The plan route reads only the tabs that hold a board, in batches (as the document overview does), and returns
  only board set-ups, never elements.

## Telemetry

- None new: agent writes count through the MCP's existing per-tool events.
