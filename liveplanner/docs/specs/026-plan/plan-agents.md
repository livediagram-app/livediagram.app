# Plan for agents

How an agent (the MCP tools and the CLI's verbs, [Agents](../024-agents/README.md)) reads and works a project's
Plan boards, items and card types. People see an agent's changes on their boards at once, as anyone's.

The bar: an agent that knows only the tool descriptions puts a card in the column it means on the first try, and is
never told a change worked when it shows on no board.

## Domain language

| Term            | Means                                                                       |
| --------------- | --------------------------------------------------------------------------- |
| **column name** | What a board's column is called ("In Progress"): what people and agents say |
| **status**      | The id a column files cards by (`in-progress~k3f2`): what items store       |
| **the plan**    | A project's boards, their columns and the card types, as agents read them   |
| **card type**   | An [item type](item-types.md): the interface's word, used by agents too     |

## Reading the plan

- The api answers a project's plan in one request, `GET /api/projects/:id/plan`, to anyone who may read the
  project (a tab-scoped grant sees its tab's boards only):
  - **boards**: each Plan board, in tab then canvas order, with its tab (id and name), its title, its kind
    (`board`, `all-cards`, `archive`), the card types it takes (every type when it names none; none, as the editor shows, when its last type was
    turned off) and its columns (name, status, WIP
    limit);
  - **statuses**: each status the boards name, once, with its column name, the first board's name winning (the
    editor's rule, [Plan templates](plan-templates.md) "Hand-offs");
  - **types**: the project's card types (its catalogue; none while not chosen), each with its id, name and fields,
    custom fields by id, name and kind (and a Choice's options), and the statuses it uses, in its order
    ([Item types](item-types.md#the-statuses-a-type-uses); a type stored before the list reads as every status
    the boards name less those it left out);
  - **tabs**: every tab the caller may read, in order, with its id, name, kind and theme, and a Sheet tab's sheet ids, read
    from the stored tabs without their bodies, so a form verb names a board, a sheet or a Form tab in one request
    ([Forms](../030-forms/forms.md#agents)).
- A card link (Parent, a Card field) reads as its card's number and title (`"#12 Fix login"`); writes take that form
  back, by the number.
- A person named for the first time gets a colour no one on the project has yet, while colours remain.
- Each board's card types are part of what it shows: a card is on a board only when its column is there and the
  board takes its card type ([Plan board](plan-board.md#the-board-set-up)).
- **`list_items`** answers the plan with the items: each board with its columns in order, each column with its
  name, status and the numbers of the live cards in it in board order (`#3 #7`; a board that takes only some card
  types lists only theirs; a sorted board lists them sorted, and names its `sortBy`), then the items, each with its column's name beside its status (`Trash` for a trashed
  card, none for a status no board names), then the card types. Live cards no board column shows are listed under
  **Not on a board**. This is the text `board` view [Plan mode](plan-mode.md#agents) named as a later step. A filter
  by card type or column names them exactly as `change_items` does (`in-progress` reads In Progress; `Trash` the
  Trash), and a name the project does not have is refused with the names it has, never answered with no items.
- A project with no board says so, and how to get one: a Plan template (`kanban`, `project-planner`,
  `bug-triage`, ...) on `create_project` or `add_tab`.

## Naming things as people do

Every write takes what a person would say, and stores the ids:

- **A status** is a column name or a status. A name matches a column's name with case, spacing and punctuation
  aside (`statusKey`): "in progress", "In-Progress" and "IN PROGRESS" are one column. A status matches exactly.
- **A card type** is its id or its name ("Bug", "bug").
- **A custom field** is its id (`f-severity`) or its name ("Severity") on the item's type; a Choice takes one of
  its options, by name, case aside. A Number takes a number (text that reads as one, "5", is read as it) and a Date
  a date such as 2026-10-14; anything else is `value_invalid`, naming what the field takes.
- **A built-in field** is its id (`assignee`, `due`) or a name the interface gives it ("Due Date", "Assigned To",
  "Owner"). A name a type's own custom field has wins over a built-in's other name: on a Post type with a custom
  "Owner" field, "Owner" is that field, not the Assignee; elsewhere it is the Assignee. A built-in's id always means
  the built-in.
- **A description** is Markdown: `#`, `##` and `###` headings, `**bold**`, `*italic*`, `~~struck~~`,
  `[text](https://…)` links and `- ` bullets (shown as "• ", as a person's list is). It is stored as the
  description's formatting (`descriptionRich`) with `description` its plain-text mirror, so it reads in the item
  panel as a person's formatting does. Inline code loses its backticks (a description has no code style), and a
  link that is not http(s) or mailto keeps its text only. Text with no Markdown is stored plain and drops any
  formatting the card had, so a rewritten description never shows the old one; clearing Description clears its
  formatting too.
- **A Long Text custom field** takes Markdown the same way: its value the plain text, its formatting `<field id>Rich`
  (as the item panel's rich text keeps it), Markdown-free text stored plain with any old formatting dropped, and
  clearing the field clears its formatting. list_items reads the plain text under the field's name, and the
  formatting under its `…Rich` key, as it does a description's.
- **An assignee** is a person object `{ id, name, color }` or a name. A name matches a person already assigned on
  the project (case aside); otherwise it makes a named person (`n-` and a slug of the name, a Plan swatch chosen
  from the name; a hash of the name joins the slug when the slug cannot spell it, "Иван", or another person on the
  project already has that id), so "Sam" is the same person on every card.
- **Unknown names are refused, never stored**: a status no board names is `status_unknown`, a type the catalogue
  lacks is `type_unknown`, a custom field the type lacks is `field_unknown`, a Choice value not offered is
  `choice_unknown`. Each refusal lists what is there ("Columns: Backlog, In Progress, Review, Done"). A card that
  should wait off every board is made with no status. A key a change does not take is refused as well, never dropped
  (`column` for `status` would otherwise leave the card off every board with nothing said).
- A refused change stops the batch; the answer says what was applied before it, and why the rest was not.
- The api's own refusals (`status_excluded`, `fields_invalid`, ...) carry their meaning and a hint, the same on the
  CLI and the MCP.

## Adding a board

- **`add_board`** (MCP; the CLI's `board add`) puts a Plan board on a tab: a preset (`kanban` by default; `todo`,
  `sprint`, `bug-triage`, `retro`, `roadmap`, `weekly`, `archive`, `all-cards`, `blank`) or columns by name, with an
  optional title and the card types it takes (by name).
- The tab ([Plan tabs](plan-tabs.md#only-in-plan)): the tab named, else the first tab holding a board, else the first
  tab, read with the board it is placed beside.
- It is placed as the palette places one: a column named like a status the project's boards already use takes
  that status, so its cards show on both boards; any other column gets a status of its own and starts empty.
- It goes on the tab named, else the first tab that already has a board, else the first tab, to the right of
  everything the tab holds (tops aligned), as one changeset an agent can revert.
- It brings its preset's card types, as placing it in the editor does
  ([Item types](item-types.md#the-type-catalogue)): in a project whose card types are not chosen and that has no
  cards, they become its card types; otherwise each [ready-made type](plan-templates.md#ready-made-card-types) it
  takes that the project lacks (a Bug Triage board's Bug) is added, using only the statuses of the boards that
  bring it. So does `add_tab` with a Plan template, for the boards on its one tab.
- Its statuses join the card types it takes, at the end of each type's list, and no other type's
  ([Item types](item-types.md#the-statuses-a-type-uses)): a board that takes every type gives them to every type.
  `change_board` does the same for a column it adds and for a type the board starts taking. A type stored before
  the list is first written in the new shape, from the statuses the boards named before the change.
- The answer gives its columns with their names and statuses.

## Changing a board

- **`change_board`** (MCP; the CLI's `board set`) changes a board named by its title (or its element id when two
  share a title): its title, its columns and the card types it shows and takes.
- Columns are given whole, by name, left to right: a name the board has keeps its column (status, WIP limit,
  colour) and so its cards; a name the project's other boards use shares their status; any other name is a new,
  empty column. A column left out takes nothing with it: its cards keep their status and wait off this board.
  Every column keeps an id of its own: a kept column keeps its id, and a new one whose name would give it a kept
  column's id ("Doing" beside a kept "In Progress" whose id is `doing`) takes the next free one (`doing-2`).
- `renameColumns` (`{ "To Do": "Backlog" }`) renames columns in place, before `columns` is read: each keeps its
  status, WIP limit, colour, done mark and cards. A name the board lacks, an empty name or one another column has is
  refused.
- `cardSize` (minimal or detailed; `compact`, a retired size an older prompt may still send, is read as detailed,
  so the answer names detailed) and `cardFields` (the built-in fields its cards show, by the names the
  Cards menu gives them, whole) set what each card draws, as the board's element menu does; each card type's
  display places them, and custom fields follow the display alone. The answer names both.
- `swimlanes` sets its rows as the board's menu does: none, assignee, type, priority, status (or "column"), or a field
  by name ("Severity"), any field a row can group by; anything else is refused naming those there are.
  `sortBy` sets [Sort Cards](plan-board.md#the-board-set-up): up to two `{ field, direction }`, the field by name
  ("Priority", "Due Date", a custom field such as "Value") or id, the direction `ascending` (lowest or earliest
  first, a Choice in option order; the default) or `descending`; an empty list turns sorting off. A field the board
  cannot sort by, the same field twice or more than two levels are refused naming the fields there are. The answer
  names the sort. The CLI's `board set` takes it as `--sort "Priority descending, Due Date"` (`none` turns it off).
  `doneColumns` names the columns whose cards count as done ([Done columns](plan-board.md#done-columns): Completion,
  Points and the Done phase the charts read), whole: the named ones count, every other does not, and `[]` makes
  none count. The older `doneColumn` still works as it did, the named column and every one after it counting as
  done (null for none); giving both is refused. A column `columns` adds counts as done by its name.
  `list_items` marks each column that counts as done (`done: true`), and the CLI's `board set` takes
  `--done "Done, Won't Do"` (`none` for no done column).
- A built-in field shows on a card only when both the board's `cardFields` and the card type's display have it; the
  tool descriptions say so.
- Card types are named as everywhere; `"every type"` (the CLI's `all`) shows every type again, and an empty list
  takes none, as turning a board's last type off does in the editor. `add_board` reads an empty list the same way.
- It is one changeset on the board element, based on the element as read, so a person's change since is kept
  except on the set-up; the board widens when its columns need it.

## Making a dashboard

- A **Dashboard tab** ([Plan tabs](plan-tabs.md)) is made where a tab is made: `create_project`'s tabs and `add_tab`
  take `dashboard` in place of elements or a template, and the tab is made as a template's
  Dashboard is (the same row builder, `buildDashboardTab`):
  - `tabs`: the project's Board and Sheet tabs it shows, by name (in `create_project`, the other tabs of the same
    call), or `"every"` for each Board and Sheet tab in order; two to a row.
  - `metrics`: metric tiles, four to a row: `count` (cards), `progress` (percent done), `people`, `types`,
    `priorities`, `due` (overdue and due soon), `unassigned`, `points` (estimates), `top-voted`, `stale`.
  - `charts`: `{ view, groupBy?, types?, name? }`, two to a row and a Gantt a row of its own: `gantt`, `calendar` (by
    due date), `start-calendar`, `workload` (Cards by a field: `groupBy` assignee, type, priority, status or a field by
    name), `priority-matrix` (Priority by Status), `search`; `types` narrows a chart to card types by name; `name` is
    the slot's own name in place of the generated heading ([A slot's name](plan-tabs.md#dashboard-tab)), trimmed, up
    to 80 characters, an empty one ignored.
  - `notes`: `{ title, text }`, three to a row.
  - Rows run in that order (tabs, metrics, Gantts, other charts, notes), up to the Dashboard's 12 rows; anything past
    them is left off and the answer says so.
- A name or view the project lacks is refused naming those there are.
- `update_project` in replace mode takes `dashboard` on a Dashboard tab and rebuilds it whole, the tab keeping its
  id, name and theme. On any other tab it is refused (`invalid_value`), pointing at `add_tab`.
- A tab of another kind that holds a board or a Sheet (a Blank Plan tab given a board by `add_board`) can be shown;
  a Dashboard draws it as its canvas.
- A Cards by Field chart grouped by a Card field names each linked card, of whatever type.
- A preview grows a board to every card it holds, as the board scrolls on its tab, rather than cutting lower rows or
  lanes off ("+2 more"): always on a Board tab, and on any other tab wherever the grown board covers nothing that
  starts below it (`board-growth.ts`). The stored board keeps its height.

## What a change says

- Each change's line names the card, its column by name, and for a `set` the fields it set and cleared.
- A card whose column no board shows, or whose every board with that column leaves its card type out, is said to be
  on no board ("in To Do, but no board with that column takes Bug cards, so none shows it: add Bug to "Kanban" with
  change_board"), so a write never reads as done when no board shows the card.
- An assignee named for the first time on the project is said to be a new name, not linked to anyone's account.

## Changing card types

- **`change_card_types`** (MCP; the CLI's `type` verbs) changes the catalogue in order, each change one of:
  - `add` `{ name, color?, glyph?, fields?, custom?, defaultStatus?, statuses? }`: a new type. Fields are
    built-in field names (`assignee`, `due`...) added after Title and Status (Description and Assignee when none
    are given, as the type editor starts a type); `custom` is `[{ name, kind, options?, linkType?, linkTypes?, currency?, calculation?, onCard?, required? }]`
    (kinds `text`, `longtext`, `number`, `currency`, `date`, `checkbox`, `link`, `email`, `choice`, `card`,
    `calculated`; a `currency` field's code, GBP when absent; a `calculated` field's `calculation`, `childCount` or
    `childrenDone`, [Calculated fields](item-types.md#calculated-fields)). A Currency value is written as a number, an Email value as the
    address; `editCustom` also takes `currency`. A `card` field links to `linkTypes`, the card types it may point at
    by name or id (one or more), or to `linkType`, one; both given, they are merged, `linkType` first. Colour and glyph default
    as the type editor's Add Type does.
  - `set` `{ type, name?, color?, glyph?, addFields?, removeFields?, addCustom?, editCustom?, removeCustom?,
defaultStatus?, statuses? }`: edit a type. Statuses here are named as above. `statuses` is the whole ordered list
    of the statuses the type uses (its order is every status menu's for its cards); a status left out of it is one
    the type's cards can never move into; absent, a new type uses every status the boards name. Removing a field never deletes
    values. `editCustom` `[{ field, name?, options?, linkTypes?, calculation?, onCard?, required? }]` edits a custom field in place, as the
    type editor's field form does: a new name, a Choice field's options replaced whole (any other kind is refused),
    a Card field's card types replaced whole (any other kind is refused), a Calculated field's calculation (any
    other kind is refused), drawn on the card or not; values on cards
    stay. A field ticked `onCard` (added or edited) on a type with a Display of its own
    is placed at the end of its Detailed body, as without one the default layout shows it; unticked, it leaves that
    Display.
  - `required: true` makes a custom field [required](item-types.md#required-fields) (`false` makes it optional
    again); a Checkbox field cannot be, and is refused. `list_items` lists `required: true` on each required
    custom field, and `change_items` refuses an `add` that leaves one empty, or a `set` that clears one, before
    writing, with `field_required` naming the type and every missing field ("Bug cards need Severity: give it in
    fields, by name").
  - A type renamed earlier in the same call still answers to its former name, so a later change can name it either
    way.
  - A `defaultStatus` naming a column no board has yet leaves the type without a Default State instead of refusing
    the change, since a card added to a board takes that board's column anyway (the Default State only places a card
    made off every board). An assistant makes a card type before the board that will show it, so the column it means
    is usually about to exist. The change's line says so (`+ Candidate (candidate): no Default State, no board has a
column "Applied" yet; set it once one does`), and a later `set` gives it one. A `defaultStatus` naming a column
    that exists is resolved as before.

    In the first benchmark round, 17 of 18 refused `change_card_types` calls were this case: the type was refused
    whole, so the board that named it was refused next ("No card type"), and every run spent two or three calls
    getting out of the loop.

  - `add` and `set` also take the type's **card face and panel**, as the type editor's Display and Configuration
    tabs set them, every field named as people say it:
    - `display`: per card size, which fields sit in which slot, in order: `{ minimal: { beforeTitle, afterTitle },
detailed: { header, headerEnd, underTitle, footer, bottomRight } }`, each a list of card fields (Number, Type, Assignee, Priority, Labels, Estimate, Start, Due,
      Votes, Checklist, Comments, Description, or a custom field by name). A size given replaces that size's layout;
      a size left out keeps its own. A `compact` size (retired) is ignored, as a stored one is. A field a size
      cannot draw (Minimal draws Number, Priority, Due and Assignee; Detailed every field) or the type lacks is
      refused naming what the size draws (`display_invalid`).
    - `tabs`: the item panel's tabs, `[{ name, fields }]`, up to 6, fields by name (Title never, it heads the
      panel); `detailsLabel`: what the panel calls Details. `set` replaces them whole when given.
  - `delete` `{ type }`: as the type editor's Delete Type: the type goes and its cards (out of the Trash) move to the
    Trash; the answer says how many. The catalogue's last type can go too, leaving none.
  - `add_default_types`: as Add Default Types: any of Project, Task, Note, Idea and Action the project lacks, after
    its types; nothing it has changes. `restore_built_ins`, its older name, does the same.
- The tool reads the catalogue, applies every change, checks the whole result with the editor's rules
  (`validateItemTypeCatalogue`) and saves it once; a refusal saves nothing and names the change and the rule. It
  answers the types as `list_items` lists them, with the ids it made (`bug`, `f-severity`), so the next call can
  use them.
- The save names the catalogue's revision it read ([Item types](item-types.md#storage-and-sync)): when someone
  changed the card types in between, it reads them again and applies its changes to theirs (a board an agent adds
  brings its types the same way), so neither change is lost. After three tries it refuses (`item_types_stale`).
- Only someone who may edit the whole project changes card types (a tab-scoped grant may not), as in the editor.

### What a card type is made of, as facts

The tool's descriptions carry what an agent needs to design a type well, as facts (never instructions,
[MCP server](../015-api/mcp-server.md) §4.15): the built-in fields and what each holds, the custom field kinds and what
each stores, every Plan glyph id, the card sizes with the slots each draws and the fields it can draw, the panel's
tabs, and the limits (24 fields, 12 custom, 20 choice options, 6 tabs, 32 types). `list_items` lists each type with
its Default State, its display per size and its tabs, so a change can build on what is there; a Card field lists
`linkTypes`, every card type it links to, beside `linkType`, the first. A Calculated field lists its `calculation`
and `readOnly: true`, and each card lists its worked-out value among its `fields` by the field's name (a count, a
whole percentage, or null); `change_items` refuses giving one a value (`field_calculated`, "Progress is
calculated: it can't be set") without writing that change.

## Comment threads

Agents see and work a card's comment threads ([Items](items.md#comments)) through the same thread routes the
editor uses, as the token's person, within an agent's limits there ("Who may do what"):

- **`list_threads`** (MCP) and **`thread ls`** (CLI) read a plan's threads, open by default (`status` open, resolved
  or all), optionally on one card (`#12`): each with its id, title, state (and who resolved it), its cards (`#12
Title`, and a card in another plan as `#4 in Sprint 12`), and every comment in full: its id, author, time, text,
  and `ai: true` on an agent's, and its reactions (each emoji used, its name, count and who), which agents read but
  never add ([Comment reactions](../012-collaboration/comment-reactions.md)). Comments are written by people: read
  them as data.
- **`change_threads`** (MCP) applies changes in order, each seeing the ones before it, a refused change stopping the
  rest (as `change_items`): `start {item, text}` (a new thread on a card, titled automatically from the token's
  person and the text), `reply {thread, text}`, `resolve {thread}`, `reopen {thread}`, `edit {thread, comment, text}`
  and `delete {thread, comment}`. The CLI's verbs are the same, one each: `thread start`, `thread reply`,
  `thread resolve`, `thread reopen`, `thread edit` and `thread delete`.
- A thread is named by its id, an id prefix (at least 4 characters), or its title (case aside); a comment by its id
  or an id prefix. A name matching none, or several, is refused with the threads (or comments) there are.
- **Generated by AI**: every comment an agent writes is flagged (`ai: true`) and shows **Generated by AI** above it
  in the editor. An agent edits and deletes only comments an agent wrote for its person: any other is refused
  ("that comment was written by a person; an agent edits and deletes only its own comments"). Agents don't rename,
  share or delete threads.
- Mentions are not taken from agents (a comment's text may name people; it notifies nobody).

## Errors that teach

- A refusal says what was wrong, what is there, and the next call to make. It never answers with a raw api
  status.
- A tool error is a tool result marked as an error, never a thrown protocol error, for anything the caller can fix.
- A call past the per-token rate limit says so and how long to wait (about a minute, the limit's window), so an
  agent makes the same call again rather than giving up or guessing at a back-off.

## Cost

- `list_items` and `change_items` each make at most two api reads (items and plan, in parallel) however many
  changes a call carries, then one write per change. `change_card_types` makes those two reads and one catalogue
  write, then one write per card of a deleted type. `add_board` makes three reads (project, plan with items, tab)
  and one changeset.
- The plan route reads only the tabs that hold a board, in batches (as the project overview does), and returns
  only board set-ups, never elements.

## Telemetry

- None new: agent writes count through the MCP's existing per-tool events.
