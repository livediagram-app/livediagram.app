# Item types

A project's **item types** are the kinds of item its Plan boards hold: the ones its boards brought (a template's,
a board's, or the five **default types**, Project, Task, Note, Idea and Action, added on request) and any a person
adds. A project starts with none. Every type is
the project's own: none is set apart as built in. Each is a name, a colour, a glyph and the fields its items
offer, including fields a person makes up. People edit them from the **Card Types** panel; every card, board,
item panel and the palette's Cards category reads them from the project.

Builds on [Items](items.md) (the item store, fields) and [Plan mode](plan-mode.md) (the palette).

## Domain language

| Term                | Means                                                                                                                               | Never called                |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | --------------------------- |
| **item type**       | What an item is: an id, a name, a colour, a glyph and its fields                                                                    | kind, category, template    |
| **type catalogue**  | A project's item types, in the order the interface lists them                                                                       | schema, config, type list   |
| **custom field**    | A field a person adds to a type: an id, a name and a field kind                                                                     | property, attribute, column |
| **card type**       | The interface's name for an item type, on the Card Types panel and its button, because the interface shows items as cards           | (no other name)             |
| **default types**   | Project, Task, Note, Idea and Action: what Add Default Types adds, and what a project made before card types started empty reads as | built-in types              |
| **ready-made type** | A card type liveplanner defines in code that a board can bring: the default types and the ten more a template uses                  | preset type, built-in type  |

## The type catalogue

- Every project has one. **A project starts with no card types**: until its card types are chosen it stores
  nothing and reads as none. The default types never arrive on their own; they come only when someone asks, with
  **Add Default Types** (or an agent's `add_default_types`).
- **Boards bring the types they name.** A board made in a project (a template's tabs, a board from Start Planning
  or the palette, an agent's) adds each [ready-made type](plan-templates.md#ready-made-card-types) it brings that
  the project lacks (by id), after the ones it has, in the order the boards name them. So in a fresh project the
  first boards choose its card types, exactly: a Hiring Pipeline project has Role, Candidate and Onboarding Task, a
  Kanban board's Task and Action. A project that has a type of that id, or of that name (one renamed "Task"),
  keeps its own and gains nothing for it. A board that takes every type (Blank), an Archive and an All Cards board
  bring none. A **Gantt Chart** brings the types it names, else **Project**, so a project whose first Plan tab is a
  Gantt chart has a type to add cards of ([Add Card](plan-views.md#gantt-chart)); no other view brings any.
- **Every type can be deleted, the last one too**: a project left with none stores an empty catalogue and shows
  the empty states below.
- **Projects made before card types started empty** that have cards and never chose their types read as the five
  default types, as they always did: an offline record, a Drive file or an exported tab with cards and no catalogue
  (`legacyCatalogue`).
- Any change (a board choosing them, a type added, edited or deleted) stores the **whole catalogue** with the
  project. From then on the stored catalogue is the project's, whole; later releases do not change it.
- **Add Default Types** adds any of the five default types the project lacks, as they are defined, after its
  types, as one change (one undo step): it never changes or removes a type the project has. A default whose name
  a type already has is not added, and only as many as fit under the cap are: the popover names exactly those. It
  shows only while the project lacks one it can add. Pressing it first asks, in a confirmation popover beside the button (as the type
  editor's Delete does), naming the types it will add: "Add Project, Note and Idea to this project's card types?
  They go after the ones you have, and nothing you have changes." (the list joined with commas and "and", "Add
  Project to..." for one), with **Add Types** and **Cancel**. Enter confirms and Escape cancels, returning focus to
  the button; the Card Types panel stays open behind it.
- The catalogue is part of the project: copies, duplicates, offline projects, Sync to Cloud, Take Offline and
  the Drive file carry it, as they carry the items.

## An item type

| Part            | Holds                                                                                                                                                                                                                                                                                                               |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`            | A slug, `a-z0-9-`, up to 32 characters, unique in the catalogue. A ready-made type keeps its own (`task`, `bug`...); a new type's is made from its name (`customer-call`), with `-2`, `-3` on a clash. Never changes once made: items store it.                                                                     |
| `label`         | The name, 1 to 32 characters, unique in the catalogue ignoring case                                                                                                                                                                                                                                                 |
| `color`         | Any `#rrggbb` colour, from the [colour picker](../004-interface-design/colour-picker.md); on a dark surface an accent too dark to see (Project's black) is drawn lifted toward white to 3:1                                                                                                                         |
| `icon`          | A glyph from the Plan glyph set: 74 line glyphs in eight categories, the ready-made types' among them (ids never change or go, so a stored type always draws)                                                                                                                                                       |
| `fields`        | The fields its item panel offers, in order: built-in field ids and custom field ids                                                                                                                                                                                                                                 |
| `custom`        | Its custom fields: `{ id, label, kind, options?, linkType?, linkTypes?, calculation?, onCard?, required? }` (a Card field's target card types: `linkType` the first, `linkTypes` all of them when there are several; a Calculated field's `calculation`; `required: true` for a [required field](#required-fields)) |
| `tabs`          | Its item panel's tabs, in order: `{ id, label, fields }`. A field in a tab shows on that tab; a field in no tab shows in the panel's **Details**. Absent: one tab, **Overview**, holding Description, Checklist and any Long text custom fields                                                                     |
| `detailsLabel`  | What the panel calls **Details** (its side column, and the phone's first tab): 1 to 24 characters. Absent: "Details"                                                                                                                                                                                                |
| `statuses`      | The statuses (ids) cards of this type use, **in order**, up to 128: the order every status menu for a card of the type lists them in. A new board's statuses join only the types that board takes ([below](#the-statuses-a-type-uses)). Absent (a type stored before this list): read as below                      |
| `defaultStatus` | The **Default State**: the status (id) a card of this type is made in when nothing else gives it one. Absent: none                                                                                                                                                                                                  |
| `display`       | What its cards show at each **card size**: `{ minimal?, detailed? }`, each a list of card fields (Number, Type, Assignee...) that size can draw. A size left out takes the type's default; a stored `compact` (a retired size) is dropped on read                                                                   |

- **Built-in field names and custom field kinds are Title Case** wherever the type editor shows them (Start Date,
  Due Date, Long Text, Link to Card); the card panel's own short labels (Start, Due) stay as they are.
- **`title` and `status` are always offered** and cannot be removed: every item has a title, and a board files
  items by status.
- **A Project (`project`) always offers `start` and `due`** too: the Gantt chart draws a project from them. They
  cannot be removed from the Project type (in the type editor they carry a lock beside their name, and have no Remove),
  but they move between groups and within one like any field. A stored Project type without them (saved before
  this rule) gets them back, at the end, when the catalogue is read.
- **The Default State** (`defaultStatus`): a card made into a board's column takes that column's status, always; a
  card made anywhere else takes its type's Default State. That is a **New {Type}** made from a linked-card section
  of a card's panel, and a card created through the API or the MCP tools without a status. Without a Default State
  those keep today's rule: New {Type} takes the first status its type uses (in the type's order) that the tab's boards name, and an API or MCP
  card with no status is made with none, so it waits as **not on board**. A Default State the type has turned off
  (not in `statuses`) is ignored, as if absent; turning the Default State off in the editor clears it. An id no
  board names any more is kept: the card is made in it and shows as not on board until a board adds that status.
- **A ready-made type's Default State** is a state _name_, since a project's state ids are its own (`todo~k3f9`):
  **Project** starts in **Backlog**; **Task**, **Action** and **Note** in **To Do**; **Idea** in **Ideas**; any
  other [ready-made type](plan-templates.md#ready-made-card-types) in the state its table names (a Candidate in
  **Applied**)
  (`READY_MADE_DEFAULT_STATE_NAMES`, by type id, so it holds for a type stored in a project's catalogue too). The editor resolves it to the project's state of that name (as names compare: "To do" and "TO DO"
  match) when it makes a card, and when none has that name (or the type turns it off) it falls back as a type
  without one does. A Default State chosen in the editor replaces it. The API and MCP do not see state names, so
  there a ready-made type's card made without a status is made with none, as before.
- <a id="the-statuses-a-type-uses"></a>**The statuses a type uses** (`statuses`): one ordered list per type, of
  the statuses its cards may move into. A status not in it is one the type **leaves out**: a card of the type never
  moves into one. An id no board names any more is kept, in its place, so the status comes back where it was.
  - **Order.** The list's order is the order of every status menu for a card of the type (the card panel's
    **Status**, the type editor's **Default State**), the same on every tab. Editors set it by dragging in the type
    editor's **States** tab.
  - **Where a new status goes.** A status joins a type's list, at its end, when it first appears on a board that
    takes the type: a new board, a column added to a board, or a type a board starts taking (its columns' statuses
    join it). A board that takes every type gives its statuses to every type. A board that takes chosen types
    gives its statuses to those types only, never to the others: a Bug Triage board's New, In Progress and Done do
    not join a Story that no board of theirs takes. A status joins a type only once a session: putting back a column
    whose status the type had turned off (an undo) does not turn it on again. The join is made by the editor of
    whoever changed the board (one quiet catalogue change with no undo step of its own, made again over anyone's
    later change), and by the plan agents' **add_board**, **change_board** and **add_tab**.
  - **A new type's list.** Add New Card Type from a board starts with that board's statuses; a type a board brings
    (a ready-made type) starts with the statuses of the boards that bring it; any other new type (the Card Types
    panel's Add Type, the default types) starts with every status the project's boards name, in tab, board and
    column order.
  - **Types stored before the list** (with `excludedStatuses`, the statuses they left out, or neither) read as
    every status the project's boards name, in tab, board and column order (no tab first), less those they left
    out: exactly the statuses they used before. The first time someone who may edit card types opens the project
    with every tab loaded, each such type is written in the new shape (one quiet change), so from then on only
    compatible boards' statuses join it. Until then (a project of more than 12 tabs, or one only agents touch) it
    keeps the old rule, a new status open to it, and the api checks it by what it leaves out, as before.
  - A type may use no status: its cards stay in the status they are made in and never move. Only a move into a left-out status is refused, never a new
    card: a card is made in whatever column it is added to (Add Card, a palette card, New {Type}), even one whose
    status its type leaves out, and a card already in one (moved there before the type left it out) stays where it is, shows its status, and
    can move out but not back. A type change keeps the card's status whether or not the new type uses it. Every way a
    status changes keeps to it:
  - a drag (on a board, or onto another) over a column whose status the type leaves out shows the red refused zone
    at the column's foot, saying "**{Type} cards can't be {Status}**", and the drop moves nothing and says the same;
  - Shift+Left/Right into such a column moves nothing and announces the same;
  - the card panel's **Status** offers only the statuses the type uses, in the type's order (a left-out one the card
    is already in shows last, as "{Status} (not used by {Type})", unselectable);
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
- A type holds up to **24 fields** and up to **12 custom fields**, Parent not counted (it was a built-in field, so a
  type already at 12 keeps reading and saving once it gains Parent). A catalogue holds up to **32 types**.
- **Custom field kinds**: Text, Long Text (up to 2,000 characters), Number, Currency, Date, Checkbox, Link (an
  `https://` URL), Email, Choice (one of up to 20 named options), Multiple Choice (several of up to 20 named
  options), Rating (a whole number from 1 to its scale, 3 to 10), Card (a link to one card of another type,
  below) and Calculated (a value worked out from the plan, below). An option holds up to 100 characters, so a form question's full answers (a Choice field's options are a
  question's) fit; a card shows a long one shortened, and its details whole. Multiple Choice and Rating came with [Forms](../030-forms/forms.md#new-card-field-kinds), which describes
  how they read and are edited.
  - **Currency** is an amount in the one currency its field names (`currency`, an ISO 4217 code such as GBP, USD or
    EUR, chosen when the field is made and changeable later; GBP when none is given). Its value is a number with up to
    two decimals; it reads, on the card and in the panel, as the person's locale formats that currency ("£12,500",
    "$1,200.50"). Changing the field's currency changes how every value reads, never the numbers.
  - On a card a value reads short: a Number grouped as the reader's locale groups digits ("82,000"), a Link as its
    site and its last path step ("sentry.io/…/4521", the site alone for a bare address), a Long Text its first line.
  - **Long Text** is rich text, edited as the Description is ([Working on a board](plan-board.md#working-on-a-board)):
    bold, italic, underline, strikethrough, size, colour, headings, links and lists, from the same toolbar and
    shortcuts. Its value stays plain text (search, the card face, CSV, forms and agents read it), and its formatting
    is kept beside it as `<field id>Rich` (`f-steps-to-reproduce` → `f-steps-to-reproduceRich`), runs of text with
    their marks, as `descriptionRich` is the Description's. A value with no formatting (written before Long Text was
    rich, by a form, a sheet or an agent's plain text) reads as its plain text. Formatting whose text no longer
    matches the value (the value was rewritten as plain text since) is ignored, so the field never shows an older
    text. Emptying the field clears both.
  - **Email** is one email address (up to 254 characters, something@domain), kept as typed less surrounding spaces.
    The panel shows it as a mailto link; the card shows the address. A value that is not an address is refused, as
    a Link that is not `https://` is.
    Every value
    is a plain string, number or true/false, which the
    item store keeps for any field. People are assigned with the built-in Assignee field, so there is no custom
    person kind. Their values are ordinary entries in the item's `fields`, under the custom
    field's id (`f-` and a slug of its name), so the store, agents and exports already carry them.
- **Required fields**: any custom field but a Checkbox (unticked reads as empty) or a [Calculated](#calculated-fields) field (the plan
  works it out) can be marked **Required**. A
  required field must have a value: empty is no value, an empty or all-space text and an empty Multiple Choice
  included. Stored as `required: true` on the field; absent is optional, so every field saved before reads as
  optional. The rule holds wherever a card is made or changed, as one shared check (`missingRequiredFields`):
  - **A new card** is refused without it (`field_required`, field: the field's id): the editor, Import CSV, the
    api, the MCP tools and the CLI alike. In the editor every way of making a card (Add Card, a palette card, New
    Card, New {Type}, a Gantt chart's Add Card, a card table's new row, Duplicate) first asks for what is missing in
    a **New {Type}** dialog: its title and each missing required field, with the card panel's own controls, and
    **Create** (waiting until every one has a value) and **Cancel** (nothing is made). Import CSV skips a row
    without one, and says how many it skipped for that ("skipped 2 rows missing a required field"). A form whose
    card type has a required field it does not ask, as a required question in a section every response sees, cannot
    be published ([Forms](../030-forms/forms.md#publishing-and-the-form-link)).
  - **Clearing it** is refused: a change (a field cleared, or set empty, in the card panel, by a swimlane drop
    into **No {Field}**, by the api or an agent) that leaves a required field empty when it had a value. The card
    panel marks a required field with a red asterisk after its name (its accessible name adds "required") and
    puts the value back, saying "{Field} is required on {Type} cards".
  - **Cards already empty are left alone**: a card made before its field became required, or before it changed
    type, keeps working (moved, edited, archived) until someone fills the field; only emptying a value it has is
    refused. A type change is never refused for it, nor a card restored, synced, copied or put back by an undo (the
    api's bulk writes that carry a card's number, votes or thread, and every write sent with `undo: true`).
  - **In the type editor** a custom field's form (and Add Field's Shape step) has a **Required** switch (as a form
    question's), absent for a Checkbox or Calculated field; turning a field into either is not possible, so it never needs clearing. A required field's
    row carries the same red asterisk after its name.
  - **Agents** see it: `list_items` lists `required: true` on each required custom field, `change_card_types`
    sets it (`required` on `custom`, `addCustom` and `editCustom`), and `change_items` refuses an `add` missing one,
    or a `set` clearing one, before writing anything, naming every missing field and the type ("Bug cards need
    Severity and Area: give them in fields, by name").
- **Card fields** link a card to one other card, of any of the card types the field names: an Objective's
  **Owner** links to a Person, and a Task's **Parent** may link to a Project or an Epic. The value is that card's id.
  - **Its card types**: one or more (up to the catalogue's 32), in the order they were ticked. Stored as `linkType`,
    the first, and, when there are several, `linkTypes`, all of them (the first included), so a field saved with one
    type reads exactly as before and an older editor or agent reading a field of several still finds a type it can
    link to. A field with no `linkTypes` (every field saved before) links to its `linkType` alone. Should the two
    disagree (an older editor changed `linkType` alone), `linkType` wins: the field links to it alone. **Parent** is one of them: Task (and the Bug and Story
    [ready-made types](plan-templates.md#ready-made-card-types)) carries a Card field named **Parent**, linking to Projects, under the one custom id
    without `f-`, `parent`, so every card made before keeps its parent. Like any custom field it can be renamed,
    linked to another type or removed, and another type can add one. A project whose stored catalogue named
    `parent` as a built-in field reads it as this Card field. Every Card field uses one control and one way of listing
    what links where:
  - **The control** (the card panel): one bordered field the width of its row, showing the linked card's type
    glyph in its colour, its own colour dot when it has one, its number as a quiet tag and its full title (cut only
    at the field's end, the whole "#1 Title" in a tooltip), a chevron, and an open arrow at its end (inside the
    same border, tooltip "Open #1 Title") that opens the linked card in the panel. Empty, it reads **None**,
    muted; a link whose card is gone reads **Missing card**. Pressing it (or Enter, Space or an arrow key) drops
    a list under it: **None**, then the live cards of every linked type in number order (never the card itself, nor
    a trashed or archived card), each with its glyph, number and title; with more than 8 a filter leads the list
    (by number or title). The list is drawn over the page, never clipped by the side column: at least 20rem (320 px)
    wide, wider when the field is, never wider than the window less a 8 px gutter each side (so on a phone it spans
    the screen); it starts at the field's left edge, moving left to stay on screen, and opens below the field, or
    above it when there is more room there, scrolling within the room it has. Each card shows its title on up to
    two lines; a longer title ends in an ellipsis at the second (its full number and title in a tooltip), and a long
    unbroken word breaks rather than overflow. Each option's
    accessible name is its full number and title. The arrows move, Enter picks, Escape closes the list (not the card), and a press outside
    closes it. Its accessible name is the field's ("Parent", "Owner").
  - **On the linked card**: for every Card field whose card types include the card's type (Parent included: a Project's
    "Linked as Parent" lists the cards under it), a **Linked as {Field}** section ("Linked as Owner") listing the cards
    pointing here (glyph, number, title, Archived, status, assignee; pressed, each opens), its count, an empty
    note ("No cards link here as Owner yet."), and **New {Type}** for each type whose field links here: it makes
    a card of that type already linked, in its type's Default State (else the first status its type uses), and
    opens it, then **Link Existing**, which links a card already made. These sit on the type's first tab, before
    Comments.
  - <a id="link-existing"></a>**Link Existing**: one button per section, after its New {Type} buttons (a link glyph,
    accessible name "Link an existing card as {Field}"). It opens a dialog, **Link Existing Card**, saying "Pick a
    card to link to #{n} {Title} as {Field}.", drawn as Add Thread to Card's is (the same card picker,
    [Items](items.md#where-it-shows)): a search (focused on open with a mouse, never on a touch screen) matching a
    card's number (`12`, `#12`), title or type, then the cards it offers, newest change first, at most 50 until a
    search narrows them.
    - **What it offers**: this plan's cards of every type the field is on (the section's types; a field on several
      types lists them all, each row naming its type), never this card, a card already linked here through this
      field, nor an archived or trashed card. None left reads "No other {Type} cards to link." (the types' names
      joined "or" when several), a search matching nothing "No cards match.".
    - **Already linked elsewhere**: a card whose field points at another card says so on its row ("Linked to #3
      Website"; "Linked to a missing card" when that card is gone). Picking it asks first: **Move #12 {Title}?**,
      "It is linked as {Field} to #3 Website. Linking it here moves it, and it leaves #3 Website's Linked as
      {Field}.", with **Move Here** and **Cancel** (Cancel goes back to the list).
    - **The write**: picking (or Move Here) sets the picked card's field to this card, one ordinary card write
      (the same as choosing it in that card's own field), so it undoes, syncs live, keeps to the plan's permissions
      and works the same in a This Browser plan. The dialog closes, the card joins the section and "Linked #12 as
      {Field}" is announced. A refused write keeps the dialog open.
    - **Who sees it**: an Editor and a Participant (who add and edit cards); a Viewer sees neither New {Type} nor
      Link Existing.
  - **Filtering them**: a Linked as section whose cards hold more than one card type or state has a
    filter row above its list: a **Card Type** menu ("All card types", then each type the list holds) when it holds
    more than one, and a **State** menu ("All states", then each state it holds, "No status" last) when it holds
    more than one; both start at All, are each viewer's own and unsaved, and while one narrows the list "N of M"
    shows beside them. A filter matching nothing shows the shared empty state, "No cards match these filters", with **Clear Filters**.
  - **On the card face**: a Card field placed by the type's Display reads its linked card's title with that card's
    type's glyph, in its colour.
  - **Boards** can lay their rows by a Card field (Swimlanes by a field): a row per linked card, of whichever of
    its types (named by its title, in number order), and **No {Field}**; dropping a card into a row sets the link.
    One field of several types is one set of rows, so a board needs no second field per type. The Swimlanes tile
    draws the linked type's glyph when the field has one type, else the Link to Card glyph.
  - Deleting, trashing or archiving a linked card never clears the links: they read **Missing card** until the
    card is back or the link is changed. A Card field whose type is gone from the catalogue keeps it among its
    types, and an unticked type is never taken off a card already linked to one of its cards.
- <a id="calculated-fields"></a>**Calculated fields**: a custom field of kind **Calculated** works its value out from the plan instead of holding
  one. It is made like any custom field (Add Field's **Calculated** kind, or `change_card_types`), with one
  **calculation** from a fixed menu, stored as `calculation` on the field:
  - **Child Count**: how many children the card has.
  - **Children Done (%)**: the share of its children that are done, a whole percentage ("40%"); nothing when it has
    no children.

  **Children** are the cards that link to the card through a Card field naming its type (the cards its panel lists
  under **Linked as {Field}**, Parent included): every such field, each child once, an archived child included and a
  trashed one left out. **Done** is the boards' rule ([Done columns](plan-board.md#done-columns)): a child is done
  when its status is a done column's, the first board to name a status deciding, as a plan view's Done phase does.
  - **Nothing is stored**: the value is worked out where it is read, from the same shared functions
    (`calculated-fields.ts`), so it is always current and never conflicts. It updates as soon as a child is added,
    moved, relinked or trashed.
  - **Read-only everywhere**: the card panel shows the value as text after a calculator glyph, never an input (Children Done with a thin bar of the share done, a card without children "No linked cards"); the field's form in the type editor says it is worked out from the cards that link here; the card face draws it like any custom field when the
    type's Display places it ("Children Done: 40%"). A write that gives a Calculated field a value is refused
    (`field_calculated`, field: the field's id): the api (and This Browser projects, through the same check),
    `change_items` and the CLI ("Progress is calculated: it can't be set"). Clearing an old value left under the
    field's id is allowed.
  - **Agents and the api read it**: `list_items` lists each Calculated field with `kind: "calculated"`, its
    `calculation` and `readOnly: true`, and each card's value among its `fields`, by name; `GET /items` answers
    `calculated` (by card id, then field id) when asked with `?include=calculated`.
  - **Where it is left out**: a form can't ask it (no question maps to it), Import CSV skips its column and Export
    CSV leaves it out, and a board can't sort or lay swimlanes by it.
  - A field's kind never changes, so a Calculated field stays one; its calculation can be changed in its form (or
    `editCustom`'s `calculation`), and every card's value follows at once.

- **Tabs**: a type has up to **6 tabs**, each with a name of 1 to 24 characters, unique in the type ignoring
  case. A field sits in at most one tab. Title is never in a tab: it heads the panel. With one tab the panel shows
  its fields without a tab bar.
- **On the card**: a custom field goes on the card face where the type's **Display** places it, like any field:
  every custom field is in Display's **Available Fields** (its kind's icon and its name), fits any part of any
  size, and draws as a chip of its kind's icon and its value (a linked card's glyph and title), named "{Field}:
  {value}" for assistive technology; with no value it is not drawn. A field ticked **Show on card** before Display
  placed custom fields starts Under the Title on Detailed cards, until the type's Detailed layout is changed; the
  tick is gone from the field's settings.

## The Card Types panel

- In Plan mode, the bottom-right cluster has a **Card Types** button (the Cards glyph) where Diagram has Layers,
  the second of one strip with **Find a Card**.
  It opens the panel as a popover hanging above the button, as Layers does from its button; it closes on a
  press outside, a second press of the button, or leaving Plan mode.
- **Edit Cards** opens it too: a button at the end of the Toolbar strip while Cards is chosen.
- The panel is 34 rem (544 px) wide on desktop, two types to a row; on a phone the screen's width less a margin,
  one to a row. It lists the
  catalogue as **one list**, in its order, with no headings: no type is marked apart from another, wherever it came
  from.
- The panel lists the catalogue as small cards: each type's accent stripe, its glyph on a tint of its colour,
  its name with "N fields" (and "N custom") under it (no count badge: a type no card has yet is drawn a little
  grey, and the count is in its accessible name only), a **Duplicate** button (a copy
  icon, with a tooltip) and a pencil. A press anywhere on a row (or Enter on it) opens the type editor.
  **Duplicate** opens the type editor as a **new** type filled from that one: its name with " copy" (then
  " copy 2", " copy 3"... while the name is taken, shortened to fit 32 characters), and the same colour, glyph,
  fields, custom fields, tabs and Details name. Nothing is made until **Save**; **Cancel** drops it. With the
  catalogue full it is disabled and its tooltip says "The project has the most card types it can hold".
  The type editor's footer offers **Duplicate** too, for a type that exists. Telemetry: `Plan` ·
  `Duplicated` · `CardType` when a duplicate is saved. **Add Type** is a dashed tile at the end, with **Add Default
  Types** under it while the project lacks any of the five. The panel does not reorder types: the catalogue keeps
  its order (the order boards brought them in, then added types in the order they were added).
- **With no types**, the list's place holds an empty state (the Cards glyph): **No Card Types Yet**, and "Add a card
  type of your own, or add the default types: Project, Task, Note, Idea and Action." for someone who may edit, "This
  project has no card types yet." for anyone else. Add Type and Add Default Types sit under it as always.
- **With no types**, Plan's bottom-right strip shows only **Card Types**: Find a Card would surface
  nothing, so it waits for the first type. The Trash stays while it holds cards (deleting the last type sends its
  cards there), so they can be restored once a type exists.
- Someone who may only view the project sees the list without the edit and add controls.

## Add New Card Type

- Wherever a card type can be added (the Card Types panel, a board's Add a Card menu, Setup Board) it is the same
  control: a full-width dashed row, a plus and **Add New Card Type**, quiet until hovered, when it takes the brand
  colour (border, tint and text). On a board it wears the board's colours; in a menu it is one of the menu's items.

## Card display

- A card face is drawn at its board's **card size** (Minimal or Detailed; [Plan board](plan-board.md#the-board-set-up)).
  What it shows at that size, and where, is its **type's Display** for that size, each field only when the card has
  a value for it. A board has no say over the fields (its old Show on Cards setting, kept in stored set-ups, is
  ignored).
- A Display only ever holds the **fields the type has** (Number and Type always): a new type's default places only
  its own fields (a type without a default of its own starts from every field a size draws, less the ones it lacks),
  and a field taken off the type leaves the card, and its Display preview, at once.
- Each size draws its fields in **slots**, each holding fields in order:
  - **Minimal**: **Before the Title** and **After the Title**, on its one line; it can draw Number, Priority, Due Date
    and Assignee. A default type's Minimal card shows none of them by default; a type of the person's own starts
    with its Number Before the Title and its Assignee After the Title (when it has one).
  - **Detailed**: **Header** and **Header End** (one row above the title, at its start and its end), **Under the
    Title** (its own lines), **Footer** (one row at the foot) and **Bottom Right** (the footer's far end); it can
    draw every card field. Any field goes in any
    part of a size that draws it; the person chooses where.
    A type's Display is, per size, which fields sit in which slot (`display: { detailed: { head: ['key'], foot: ['due']
} }`); a field in no slot is not shown.
- **Defaults**, for a size a type has not set:

  | Type                                        | Minimal    | Detailed                                                                                          |
  | ------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------- |
  | Project                                     | title only | Number, Type, Assignee, Priority, Labels, Start, Due, Checklist, Comments, Description            |
  | Task                                        | title only | Number, Type, Assignee, Priority, Labels, Estimate, Due, Checklist, Comments, Description, Parent |
  | Note                                        | title only | Type, Votes, Comments, Description                                                                |
  | Idea                                        | title only | Type, Labels, Votes, Comments, Description                                                        |
  | Action                                      | title only | Number, Type, Assignee, Due, Checklist, Comments, Description                                     |
  | Any other (Bug, Story, a type someone adds) | title only | every card field                                                                                  |

  Each default places its fields where they read best: Number and Type in the Header, Priority at the Header End,
  Parent, Description and Labels Under the Title, the Assignee at the **Bottom Right** (last After the Title on
  Minimal), the rest in the Footer. A built-in
  type's defaults are read from code by its id, so a project that stored its catalogue before Display
  existed gets them too.

## Editing a type

- **Add Type** and a row's edit open the **type editor**, a wide modal (60 rem, as the card panel; a sheet rising
  from the bottom on a phone) in three **tabs** under its title (one underline that slides to the chosen tab): **Configuration**, **States** and **Display** (the tab's own word for the statuses
  a type uses; boards, cards and filters still say Status). Its title names the type as saved, "Edit {Name} Card
  Type" ("Edit Note Card Type"), or "New Card Type" for a new one. It opens
  on Configuration, new or edited alike. Arrow keys, Home and End move between the tabs. A tab holding what stops Save carries a small red
  dot (a clashing name, a tab problem or a custom field problem is Configuration's; a status list problem is
  States'; a missing name is not flagged, since a new type starts without one), and the problem is
  still named beside Save. The tabs edit one draft: switching loses nothing, and Save or Cancel acts on the whole.
  The title row ends with **Show Me**, **Help** (the Card Types help article) and a close cross, which acts as
  Cancel.
  - **Show Me** ([Show Me](../007-editor/show-me.md)) runs a guided tour of making a card type, there and then, on the
    editor itself; it is never offered or started on its own. It uses the shared tour (the step card, Back, Next and Skip, the ring around what it
    points at with room to breathe, drawn over the editor), and each step opens the editor tab it is about and points at a real
    control, which stays usable: the person types the name, picks a colour or adds a field while the step is up, and
    their edits stay in the draft. The steps: **Name It, Then Give It a Look** (the Configuration tab's General
    section: the Name field holding glyph, name and colour, the caret put in Name), **Lay Out Its Fields** (the Configuration tab's
    Fields section, scrolled into view), **Choose Its States** (the States tab),
    **Arrange the Card** (the Display tab), then **Save It** (Save), and a closing card with a link to the Card Types article.
    While it runs, Escape belongs to the tour (it never closes the editor). Telemetry: `UI` · `Started` ·
    `CardTypeTour`, and `UI` · `Ended` · `CardTypeTourCompleted` or `CardTypeTourSkipped`. Every
    button carries an icon: Save a tick, Cancel and the cross a cross, Delete a bin, Duplicate the copy
    icon, Back a left chevron, Add Field, Add Tab and Add {Name} a plus.
  - **Configuration**: one scrolling panel of two sections: **General**, then **Fields**, set off by a rule. General
    opens the panel without a visible heading (its Name field says what it is; the heading is kept for screen
    readers and the tour); Fields shows its heading (Title Case, a size above the row labels). Each holds every
    control and check described for it below.
  - **General** (a section of Configuration): **Name**, one field holding the glyph, the name and the colour (no
    Glyph or Colour row of its own): at its start the chosen glyph on a tint of the type's colour with a small chevron
    (named "Glyph: {Name}"), then the name typed after it, then at its end a swatch of the type's colour (named
    "Colour", its tooltip "Colour"), the field no wider than a 32-character name needs. The swatch opens the one
    [colour picker](../004-interface-design/colour-picker.md) in a popover (the swatch-button skin): the strong
    standard colours, Custom colours and **Add a custom colour** (four coloured dots), which opens the custom colour editor in place; a colour not on offer
    shows as the picked first of Custom colours. A pick closes the popover and hands focus back to the swatch; Escape
    closes the popover only, never the editor. The glyph opens a popover under it (above it when there is no room below), drawn over the editor so its
    scrolling body never clips it: **Search
    glyphs** (focused on open) and, on the same row, a **Glyph category** menu (**All glyphs**, then the eight
    categories: **Work**, **People**, **Communication**, **Planning**, **Ideas and Notes**, **Status and Signals**,
    **Business**, **Things**; it opens on the chosen glyph's), over one dense grid of that category's glyphs, small borderless tiles ten to a row, each with its name
    as a tooltip, the chosen one tinted and ringed in the type's colour. A search covers every category (the menu
    shows All glyphs), by a glyph's name and a few keywords each ("money" finds Coin and Wallet); with no match it says "No
    glyphs match “…”.". A pick closes the popover and hands focus back to the button, as do Escape (the editor
    stays open) and a press outside. One radio group, each tile named "{Name} glyph", the chosen one pressed as before.
  - **Fields** (a section of Configuration, after General): a line saying "Laid out as the card's panel shows them.
    Add, move or rename to change it.", then the Fields and Tabs list below. **States**: the type's statuses (below).
  - **Fields and Tabs**: one list laid out as the card's panel shows the fields, in groups. On desktop (768 px and
    up) it is two columns as the card's panel: On the Card, then the tabs and Add Tab, on the left, and Details in an
    18 rem column on the right; on a phone, one column in the order below.
    - **On the Card**: Title (always) and Votes when the type has it; they never go in a tab.
    - **Details**, tagged "Side column" (after On the Card on a phone, beside the main column on desktop): every field in no tab, its name renamed in place in the group's header,
      never moved or removed.
    - Each **tab**, tagged "Tab", in order (Overview first, as the panel reads): renamed in place in its header, moved with ↑ and ↓, and taken off with
      × (its fields go to Details). **Overview** is renamed and moved like any tab but has no ×: it stays, even
      empty. A new tab's name field takes focus. An empty group says so, and that any tab but Overview left
      empty is dropped when the type is saved.
  - Field rows alternate white and a light grey within their group, so a long list reads row by row. Each field
    row leads with a **drag handle** (a grip), then an icon of what it holds, then its name, and a lock beside the
    name for a field the type always keeps (Title and Status, and a Project's Start and Due; its tooltip says "{Name}
    is always on this type"). The icon is the Add Field kinds' own (a custom field's kind: Link to Card a card;
    a built-in field the kind closest to it: Due Date a calendar, Estimate a #, Checklist a checkbox, Status,
    Priority, Colour and Labels a list, Title text, Description and Comments long text, Votes a #), the Assignee a
    person; its tooltip and accessible name name the kind ("Link to Card", "Date", "Person"). Dragging the handle (mouse, pen or touch alike) moves the field
    within its group: the row follows the pointer, the rows it passes slide aside, release places it and Escape
    puts it back. Title, Status and Votes have no handle, and every row keeps its slot so the names line up.
    The row ends with a custom field's **Edit** (a pencil), which opens its name, its options (Choice), its
    **Links To** (Card, below) in its row, and a **⋯** menu headed by the field's name: **Move
    Up** and **Move Down** (the keyboard's way to reorder), **Move to {group}** for each other group (Details
    first, then the tabs) and **Remove** (absent for a field the type always keeps). Title has no menu.
  - Each group ends with **Add Field**, a full-width dashed row (as **Add Type** in the panel), which opens a
    popover anchored to it (24 rem wide, over the editor, so it is never squeezed by the Details column; on a phone
    the window's width less its margins; never taller than the room on its side, scrolling inside). It works in two
    steps, **pick, then shape**, in the same popover (named "Add Field"); the field lands in that group (Votes
    always on the card). (The owner's pick, 2026-10-28, from the design canvas's "B · Pick, then shape".)
    - **Pick** (step 1), top to bottom:
      - **Search fields** at the very top (a search field with a magnifier, its placeholder "Search fields, like
        money or date", and a close cross at its end, which closes the popover). It takes focus on opening under a
        mouse or a pen, never on a touch screen (no keyboard flies up); it stays at the top while the rest scrolls.
        Typing filters both sections at once: a built-in by its name, a kind by its name, its line, and a few
        everyday words for it (**money**, **price**, **budget** find Currency; **stars**, **score** Rating;
        **yes/no**, **tick**, **toggle** Checkbox; **parent**, **epic**, **relation** Link to Card; **percent**,
        **progress**, **formula** Calculated; **url**, **website** Link; **dropdown**, **select**, **option**
        Choice; **tags**, **multi-select** Multiple Choice; **notes**, **paragraph** Long Text; **deadline**,
        **day** Date; **count**, **points** Number; **mail** Email). With nothing matching it says **No matches for
        “…”** with "Try a word like money, date or parent." under it. How many match is announced.
      - **Ready-made**: the built-in fields the type does not have yet, each a tile with its icon (the type
        editor's rows' own) and name, three to a row (two on a narrow window); one press adds it at once and closes
        the popover. Hidden when the type has them all (or, searching, when none matches).
      - **Your own field**: the thirteen kinds, each a row with its icon on a soft tile, its name, and a one-line
        description in plain words, in four groups as an **accordion**, one group open at a time (opening one closes
        the other; pressing the open one closes it; the first open to start): **Text & links** (Text "A short line
        of text", Long Text "Paragraphs of notes", Link "A web address", Email "An address that opens your mail
        app"), **Numbers & dates** (Number "Points, counts and sizes", Currency "An amount, like £12,500", Rating
        "Stars out of 3 to 10", Date "A day on the calendar"), **Choices** (Choice "One option from a list",
        Multiple Choice "Several options from a list", Checkbox "Yes or no, ticked or not") and **Linked cards**
        (Link to Card "Another card, like a parent or an epic", Calculated "Worked out from the cards linked
        here"). Each group's header is a button (`aria-expanded`) with the group's name, how many kinds it holds and
        a chevron. While a search is typed the accordion steps aside: every group with a match shows open, listing
        only its matches (its count then the matches'), and a group with none is hidden; clearing the search brings
        the accordion back as it was.
      - When the type holds the most custom fields it can (12), "Your own field" says "This type holds the most
        custom fields it can (12). Remove one to add another." in place of the groups; Ready-made still works.
      - **Keyboard**: ↓ from the search moves to the first result; ↑ and ↓ move through every result in order (the
        Ready-made tiles, the group headers, the kinds), Home and End to the first and last, ↑ from the first back
        to the search; Enter or Space presses the one focused; Enter in the search, with a search typed, picks the
        first match. Escape in the search clears a typed search first, then closes the popover.
    - **Shape** (step 2, after a kind is picked): a header with **All kinds** (a left chevron; back to Pick with
      the search as it was, focus on the kind that was picked) and the kind as a pill (its icon and name, read as
      "Kind: Choice"); then **Name** (a labelled field, focused, "Field name" as its placeholder); then only what
      that kind needs: for Choice and Multiple Choice **Options**, a list of option rows (each a field named "Option
      1", "Option 2", … with a remove cross; one empty row to start), **Add an option** (a dashed row, "or paste a
      list" beside it), Enter in a row adding a row after it, Backspace in an empty row removing it, and pasting
      several lines into a row adding one option a line (blanks dropped, at most 20); for Rating **Scale** ("Out of
      3" to "Out of 10", 5 first chosen); for Currency **Currency** (a select of the common codes, GBP first); for
      Link to Card **Links To** its card types (at least one); for Calculated **Calculation** (the menu below, the
      first chosen); then **Required** (where the kind may be required: never Checkbox or Calculated); then
      **Preview**: a small card as a board's card panel draws it, "Example card" over the field's row: its name as
      typed ("Field name" until then, with the required mark when Required) beside a sample value of its kind
      (Choice its first option, Multiple Choice its first two, Link to Card the linked types' names, "Project or
      Epic", Rating stars out of its scale, Currency in its currency, Calculated "3" or "40%"); updating as you
      type. Last, one full-width primary button **Add {Name}** ("Add {Kind} Field" until named), off until the
      field is ready: a name, at least one option for Choice and Multiple Choice, at least one type for Link to
      Card. While it is off, a quiet line under it says what is missing ("Name the field to add it.", "Add at
      least one option.", "Pick a card type it links to."). Enter in Name (or anywhere but an option row, a menu or
      a button) adds it when ready. Escape goes back to Pick (and from Pick closes the popover). Adding closes the
      popover; the button stays in view at the foot while the rest scrolls.
    - On a touch screen every control in it is at least 44 px tall. Moving between the steps slides in gently,
      not at all with reduced motion. Dark mode throughout.
  - **Links To** is a multi-select dropdown: a field the width of its row reading **Links To Project** (one type),
    **Links To Project or Epic** (two), **Links To Project, Epic and 2 more** (more), or **Links To a Card Type…**
    (muted, none yet), with a chevron. Pressed, it opens a popover under it listing every card type (its glyph in its
    colour, its name), each a checkbox row: ticking adds the type, unticking takes it off, and the popover stays open
    for more. A ticked type the project no longer has keeps a row after the others, named by its id, so it can be
    unticked. The last ticked type cannot be unticked (its row is disabled), so a field always links somewhere.
    Escape, a press outside or the field again close it. Its accessible name is "Links To". **Add Tab**, the same full-width dashed row under the groups, adds an unnamed tab.
  - **States**: first **Order**, the states the type uses in its order ("Drag to set the order a card's status
    menu lists them in."), a numbered list of rows, each a grip, the state's name and a cross to turn it off
    ("Turn Off {State}"). A row moves by dragging its grip (mouse, pen or touch: the row follows the pointer and the
    rows it passes slide aside; release places it, Escape puts it back) or, focused on its grip, by Alt+Up and
    Alt+Down. A state the type uses that nothing names any more is kept in its place but not listed. With every
    state off, Order is not shown. Then every status the project's boards name, and any a card is in that no board
    names, grouped by the board that shows it: a group per board (All Cards and Archive boards aside), headed by the board's title as it
    is now (so a renamed board reads its new name) with "N of M states on", holding its statuses in column order (a status
    on two boards shows in both, and ticking it in one ticks it in both, as it is one status), then **No Board** for
    any status no board names. Each group is a grid of checkbox rows (three to a row on desktop, two on a tablet,
    one on a phone), each ticked while the type uses it, with "N of M states on" and
    **Select All** and **Deselect All** above them (each disabled when it would change nothing). Unticking one
    leaves it out; ticking one adds it at the end of Order; Select All adds every listed status not yet on, in board
    order, at the end; Deselect All turns every listed status off (one nothing lists any more stays). All may be off, and then a note
    says a card of this type stays in the state it is made in and can never be moved to another. With no columns
    on the tab's boards it shows an empty state, **No States Yet**: "When you add states to a board that takes this type, they’re added here automatically." At most 128 may be on: then every status still
    off is disabled, and a note says "A type can use at most 128 states. Turn one off to turn on another."
    Under them, **Default State**: a menu of every state still on, each once and by its own name, in the type's order,
    after **None** (left out for a ready-made type whose named state the project has: that state shows picked until
    another is chosen, and a pick is saved as picked), with a line saying
    "Cards made outside a board start here; a card added to a board takes that column's state."
  - **Display**: the card sizes as a segmented control (**Minimal**, **Detailed**; Detailed to start; its
    pill slides to the chosen size, as the Share dialog's Valid does),
    then the card itself, editable in place: a real card of this type at that size, drawn large (1.4 times, and
    wider than, a board's: 360 wide, so a long title has room) as a board draws it, across the tab, from a sample card (its title "Example {Name}", a person, High priority, due in
    three days, a label, an estimate, a checklist two of five done, a description, three votes, two comments), on a
    board column's colour. Each **part** of the card is a dotted box, drawn even when empty (then a small target with no label, its name
    kept for assistive technology),
    and each field's bit in it (the due pill, the avatar...) is a chip: it drags (mouse, pen or touch) to any part
    or another place in its own. While it drags, a copy of the field (its glyph and name) follows the pointer, the
    chip stays faded where it was, every part that takes it is outlined, the part under the pointer lit, and a
    brand bar marks the place it lands; dropped on **Available Fields** (lit, reading "Drop to take it off the
    card") it comes off; dropped anywhere else nothing changes, and Escape cancels the drag. Its cross (shown on
    hover or focus, and always on a touch screen, which has no hover, with the chip's outline) takes it off; focused, the arrow keys move it (Left and Right within its part, Up and Down to
    the part before or after) and Delete takes it off. Any field may go in any part of a size that draws it.
    Under the card, **Available Fields**: a chip per field the type has, that
    this size can draw, not yet on the card ("Drag one onto the card, or press it to choose where it goes."): it
    drags onto any part, or, pressed (or Enter), opens a menu "Add {Field} to" with a row per part. Under them,
    **Reset to Default** (shown only once the size differs from its default; nothing in its place otherwise). A
    size equal to its default is stored as absent.
  - A problem is named beside Save, which waits for it: no name, a name another type has, or a custom field
    without a name or a Choice without options, a tab without a name, or two tabs with one name, or more than 128
    statuses on ("Too many states on: a type can use at most 128.", on the States tab). Save always stores the
    type's `statuses` list, so a type stored before the list is saved in the new shape.
  - **Delete** (one word, as is **Duplicate**, so a phone's footer keeps each on one line), at the foot, for any type that exists, the catalogue's last too.
  - **Save** applies the whole edit as one change; **Cancel** drops it.
- Removing a field from a type, or deleting a custom field, never deletes values: items keep them, and they show
  again if the field returns. The type editor says so under the field list once a field is removed.
- **Deleting a type** asks first, in a confirmation popover anchored to **Delete**: "Delete the {Name} type?",
  and when cards (out of the Trash) have the type, "Its card will be moved to the Trash too." or "Its N cards will
  be moved to the Trash too.". **Delete** in it deletes the type and moves those cards to the
  [Trash](items.md#trash), where they can be restored (as the fallback "Item", the type gone); Cancel or Escape
  leaves everything as it was. Cards already in the Trash stay there.
  A board that showed only the deleted type shows and takes every type again ([Plan board](plan-board.md#the-board-set-up)).

## Where types show

- **The palette's Cards category** lists a card per type, in catalogue order, captioned "<Name> card", each
  tile a small card with the type's colour stripe and its glyph on the face, and lands it in a board's column as every other type's do.
  With no types it says "No card types yet. Add one, or the default types, with Edit Cards." (someone who may only
  view: "This project has no card types yet."), above Edit Cards.
- **Cards** draw a type's colour (behind the card number) and glyph (an item's own [Colour](items.md#colour) is a dot beside them,
  never in their place); the item panel's type picker lists the catalogue; the Add a
  Card popover offers the types the board shows, and its title field's `name:` prefix matches a type's name
  (`customer call:` too).
- **A board's rows By Card Type** follow the catalogue's order and names.
- **Agents** read the catalogue with `list_items` and change it with `change_card_types`, naming types and fields
  as people do ([Plan for agents](plan-agents.md)); an agent naming a type the catalogue lacks is refused. An item
  stored with a type the catalogue lacks (made before that rule, or whose type was deleted) draws as "Item".

## Collaboration

- A saved change reaches everyone with the project open at once: their cards, panels and palette redraw.
- Two people saving the same type: the later save wins, whole (the catalogue is one value), as a board's set-up.

## Undo

- Saving a type edit, adding, deleting and reordering are each one undo step, interleaved with canvas and item
  steps. Undo puts the previous catalogue back; it never changes items (a delete's "move them to" writes are
  their own item steps).

## Storage and sync

- The stored catalogue is a JSON column on the project (`item_types`, null while no card types are chosen: none), written only by
  its own route, `PUT /api/projects/{id}/item-types` with `{ itemTypes }` (a catalogue, which may hold no types, or
  null for none chosen), by anyone who may edit the project. Its answer is the catalogue as stored.
- The catalogue has a **revision** (`item_types_rev`, 0 until its first write), raised by every write and carried by
  the project's GET (`itemTypesRev`), the plan agents read and the room's op. A write names the revision it changed
  (`expectedRev`); when another change landed since, it is refused (409 `item_types_stale`, carrying the catalogue and
  revision stored), so two people changing card types at once never overwrite each other. A write that names no
  revision lands whatever is stored.
- A change is kept as the catalogue before and after it, so it can be made again to whatever is stored: only the
  types it added, changed or deleted move, every other type stays as stored. Refused as stale, the editor and agents
  make it again to the stored catalogue and send it again (up to three tries); a save that still fails drops only
  that change, never one saved after it. An undo makes the change's inverse to the catalogue as it then is, so it
  never takes back anyone's later change; a redo makes the change again the same way.
- Each write reaches the project's room as an ordered system op, `item-types`, carrying the catalogue, so open
  editors redraw at once; a tab-scoped session receives it too (types hold no content).
- The project's GET carries `itemTypes`. An offline project keeps it in its record and writes it there.
- Copies (the api's copy, Duplicate), Sync to Cloud, Take Offline and the Drive file carry it, as items.

## Limits and validation

- The api validates a stored catalogue whole (shape, ids, counts, lengths, kinds) and refuses one that fails,
  by name (`item_types_invalid`), keeping the last good one. Its stored size is at most 32 KB.

## Telemetry

- `Plan` · `Opened` · `CardTypes` when the panel opens; `Plan` · `Changed` · `CardType` when a type is saved, `Plan` · `Added` · `CardType` when one is added,
  `Plan` · `Duplicated` · `CardType` when a duplicate is saved and `Plan` · `Deleted` · `CardType` when one is deleted. Never names, ids or field names.
- `Plan` · `Added` · `LinkedCard` when New {Type} makes a card already linked, and `Plan` · `Linked` · `LinkedCard`
  when Link Existing links one (`LinkedCardMoved` when it moved from another card).
