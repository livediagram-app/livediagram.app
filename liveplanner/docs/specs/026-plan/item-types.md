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
| **field kind**      | What a field holds (Text, Date, Person, Image...): the one list Add Field offers, built-in and custom fields alike                  | field type, data type       |
| **built-in field**  | A field liveplanner knows by its own id (`assignee`, `due`, `labels`...), which the features using that role read; one per type     | ready-made field, preset    |
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

| Part            | Holds                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`            | A slug, `a-z0-9-`, up to 32 characters, unique in the catalogue. A ready-made type keeps its own (`task`, `bug`...); a new type's is made from its name (`customer-call`), with `-2`, `-3` on a clash. Never changes once made: items store it.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `label`         | The name, 1 to 32 characters, unique in the catalogue ignoring case                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `color`         | Any `#rrggbb` colour, from the [colour picker](../004-interface-design/colour-picker.md); on a dark surface an accent too dark to see (Project's black) is drawn lifted toward white to 3:1                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `icon`          | A glyph from the Plan glyph set: 74 line glyphs in eight categories, the ready-made types' among them (ids never change or go, so a stored type always draws)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `fields`        | The fields its item panel offers, in order: built-in field ids and custom field ids                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `custom`        | Its custom fields: `{ id, label, kind, options?, linkType?, linkTypes?, calculation?, formula?, result?, through?, aggregate?, source?, showAs?, timeSpent?, withTime?, onCard?, required? }` (a Card field's target card types: `linkType` the first, `linkTypes` all of them when there are several; a Calculated field's `calculation`, a Formula's `formula` and `result`, a Rollup's or Lookup's `through`, `aggregate` and `source` and its `result`, and `showAs: "percent"` when it [shows as a Percent](#percent-fields); `timeSpent: true` on a Duration field that [tracks time](#time-spent); `withTime: true` on a Date Range whose ends [have times](#date-range-fields); `required: true` for a [required field](#required-fields)) |
| `tabs`          | Its item panel's tabs, in order: `{ id, label, fields }`. A field in a tab shows on that tab; a field in no tab shows in the panel's **Details**. Absent: one tab, **Overview**, holding Description, Checklist and any Long text custom fields                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `detailsLabel`  | What the panel calls **Details** (its side column, and the phone's first tab): 1 to 24 characters. Absent: "Details"                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `statuses`      | The statuses (ids) cards of this type use, **in order**, up to 128: the order every status menu for a card of the type lists them in. A new board's statuses join only the types that board takes ([below](#the-statuses-a-type-uses)). Absent (a type stored before this list): read as below                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `defaultStatus` | The **Default State**: the status (id) a card of this type is made in when nothing else gives it one. Absent: none                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `display`       | What its cards show at each **card size**: `{ minimal?, detailed? }`, each a list of card fields (Number, Type, Assignee...) that size can draw. A size left out takes the type's default; a stored `compact` (a retired size) is dropped on read                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |

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
    (sent with `undo: true`, which the editor's undo and redo always set). Nor is moving a card to the Trash: the
    Trash is no type's status, so a type's list never refuses it.
- A type holds up to **24 fields** and up to **12 custom fields**, Parent not counted (it was a built-in field, so a
  type already at 12 keeps reading and saving once it gains Parent). A catalogue holds up to **32 types**.
- **Custom field kinds**: Text, Long Text (up to 2,000 characters), Number, Currency, Percent (a share from 0 to
  100, drawn as a bar, [below](#percent-fields)), Duration (hours and minutes, "2h 30m", and the time a team
  tracks, [below](#duration-fields)), Date, Date and Time (a moment, read in each viewer's own time zone,
  [below](#date-and-time-fields)), Date Range (a start and an end, days or with times, [below](#date-range-fields)),
  Checkbox, Link (an `https://` URL), Email, Phone (a phone number that calls on a phone, [below](#phone-fields)),
  Choice (one of up to 20 named options), Multiple Choice (several of up to 20 named
  options), Rating (a whole number from 1 to its scale, 3 to 10), Card (a link to one card of another type, or
  to several, below), Calculated (a value worked out from the plan, below), and the kinds the built-in fields are:
  **Person** (one person, as the Assignee holds one, or several, [below](#holds-several)), **Labels** (up to 20 short labels, as Labels holds them),
  **Colour** (any `#rrggbb` colour, as Colour holds one), **Checklist** (up to 50 to-do rows, each its text and
  whether it is done, as Checklist holds them), **Comments** (its own threads, [below](#comments-and-votes-fields)),
  **Votes** (its own votes, below) and **Image** (one picture, [below](#image-fields)). Each reads and
  is edited exactly as the built-in field of its kind (the same control in the card panel, the same chip on the
  card): a type may hold the built-in and any number of fields of its kind, each with its own name and value. The
  built-in fields keep their ids (`assignee`, `labels`, `color`, `checklist`, `comments`, `votes`), so every card,
  board, view and agent reads them as before. A feature that uses a field by its **role** reads the built-in
  field until told to read another of its kind ([Fields by role](#fields-by-role)). An option holds up to 100 characters, so a form question's full answers (a Choice field's options are a
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
  - <a id="choice-fields"></a>**Choice and Multiple Choice in the card panel** read and are edited the same way,
    one control for both, so the two sit together:
    - **An option's colour** is its place in the field's option list, the label swatches in turn (the first
      option blue, the second green, and so on, starting again past eight), so the options of one field never share
      a colour while it has eight or fewer. Options store no colour of their own (a Choice's options are plain
      names, as a form question's are); a colour picked per option would need one, and the field's order already
      gives each a stable, distinct one. Reordering options in the type editor recolours them with their new
      places. An option is drawn as a **chip**: a 12% tint of its colour, a dot of the colour itself before the name,
      inked as a label is (70% of the colour mixed toward the page's ink), so it reads at 4.5:1 in light and dark.
    - **The field** is one bordered box the width of its row, as a Person field that holds several is
      ([Holds Several](#holds-several)). A Multiple Choice shows a chip per pick, in option order, wrapping onto
      more rows as they need, each with a remove button (**Remove {option} from {Field}**), then a **+** at the end
      (**Add to {Field}**). A Choice shows its one chip, or **None**, and a chevron. A long option wraps inside its
      chip rather than overflow (it keeps its whole name, up to 100 characters); an emoji reads as any letter.
    - **Empty**: a Multiple Choice with no picks, or a Choice with none, reads **None**, quietly, in the box; the
      whole box opens the list, so a phone has a large target.
    - **The list** opens under the field, over the page (it never pushes the panel or is clipped by its column), at
      least 260 px wide, wider with the field, kept on screen. Each option is a row: a checkbox (Multiple Choice)
      or a tick at the end (Choice), the option's chip, its full name wrapping onto a second line. A Choice's list
      starts with **None**. A Multiple Choice's list stays open for more picks and ends in a quiet footer naming
      how many are chosen ("2 of 6 chosen") with **Clear** when any are; a Choice's closes on a pick. With more than
      eight options it opens with a **Find an option** field that narrows the rows as you type (case aside); one
      that finds nothing says so (the shared no-match state, "No options match “x”", with Clear Search).
    - **Keys**: Enter, Space or ↓ on the field opens the list on the first pick (else the first row); ↑ and ↓ move,
      Home and End jump, Enter (and Space, outside the find field) picks or toggles; Escape or a press outside
      closes it and puts focus back on the field; Tab closes it and moves on. A touch screen picks with a tap; rows and remove buttons are 44 px and 24 px
      to a finger there.
    - **A value that is no longer an option** (the option was renamed or removed in the type editor) still shows,
      as a grey chip with **No longer an option** in its tooltip, and can be removed; it is never dropped by
      another pick. Picks are kept in option order, any such value after them.
    - **Share roles**: an Editor and a Participant pick and remove options (editing a card's fields, [Share
      roles](../013-workspace/share-roles.md#what-a-participant-changes)); a Viewer sees the chips alone, with no
      remove buttons, no **+** and no list, and **None** when it holds none.
    - **On the board** a card face keeps reading the value as text ("Design, Research"), the kind's glyph before it,
      as every custom value pill does: the face is drawn by the card's own SVG-sized pills, not this control.
  - <a id="phone-fields"></a>**Phone** is one phone number, typed freely and kept exactly as typed less surrounding
    spaces ("+44 20 7946 0958", "(020) 7946-0958"), up to 32 characters (`PHONE_MAX`). It is checked loosely
    (`isPhoneNumber`): only digits, spaces, brackets, dashes and one leading `+`, with at least 3 digits; anything
    else is refused ("Write a phone number like +44 20 7946 0958"), as an Email that is not an address is. The panel
    edits it in a phone box (`type="tel"`, so a phone shows its number pad) and shows it as a `tel:` link (its
    number with the spaces, brackets and dashes taken out, `+44 20 7946 0958` → `tel:+442079460958`) that calls it on
    a phone; the card shows the number as typed. It sorts and lays no swimlanes (as Email). **Privacy**: a phone
    number is personal data and is treated exactly as an Email is: shown like any field to everyone who can see the
    card (Viewers and public share links included; a plan's owner chooses what goes on a public board), and carried
    whole by Export CSV, agents and images. Export CSV writes it as text, as typed, so "+44 20 7946 0958" opens as
    that number and never as a formula or with a stray apostrophe ([Plan board](plan-board.md#csv)). A form asks it
    with a [Phone question](../030-forms/forms.md#question-types). It may be [required](#required-fields).
  - <a id="date-and-time-fields"></a>**Date and Time** is a moment: a day and a time of day, for meetings,
    interviews, launches and "5pm Friday" deadlines. A Date field stays a day, exactly as before; a Date field never
    turns into a Date and Time field (or back), since its stored days carry no time.
    - **Stored** as an instant in UTC, followed by the time zone it was set in (the creator's, by its IANA name), as
      one ISO 8601 string with the zone in brackets (RFC 9557): `2026-10-31T17:00:00Z[Europe/London]`. Minutes are
      kept; seconds are always `00`. The zone is kept so the panel can say where it was set; it never changes
      the moment.
    - **Shown** in each viewer's own time zone, so a 17:00 London deadline reads 13:00 in New York: on the card short
      ("Fri 31 Oct, 17:00", the year added when it is not this year's), in the panel whole ("Fri 31 Oct 2026, 17:00"),
      in the viewer's locale and 12- or 24-hour clock. A line under the panel's box names the viewer's zone ("Your
      time, Europe/London") and, when it was set in another, that zone's time too ("Set as Fri 31 Oct, 13:00 in
      America/New_York"): a line rather than a tooltip, so a phone shows it too.
    - **Edited** in the panel with a date-and-time box (`datetime-local`), read in the viewer's zone; a whole value
      saves at once, as a [date field](../004-interface-design/date-fields.md) does, and emptying it clears it.
    - **Past due**: on the card, a Date and Time whose moment has passed draws in red, as an overdue Due does
      (to the minute, never by the day).
    - Sorts by its moment (earliest first), and lays no swimlanes.
  - <a id="date-range-fields"></a>**Date Range** is a start and an end in one field: an event's days, a trip, a
    sprint. Its type editor form has **Include Time** (a switch, off; set when the field is made and never changed
    after, like Track Time): off, its ends are days (`YYYY-MM-DD`); on, each end is a Date and Time instant as above.
    - **Stored** as a list of its two ends, start first: `["2026-10-31", "2026-11-02"]`, or two instants. The end is
      never before the start: a range written the wrong way round is kept in order (ends swapped).
    - **Shown** "31 Oct to 2 Nov" on the card (each end with its year when it is not this year's; a range of one day
      "31 Oct"), "31 Oct 2026 to 2 Nov 2026" in the panel; with times "31 Oct, 09:00 to 2 Nov, 17:00", or "31 Oct,
      09:00 to 17:00" within one day, in the viewer's zone (with times, the zone line as a Date and Time's, for its start).
    - **Edited** in the panel as two boxes, **From** and **To** (date boxes, or date-and-time boxes with Include
      Time): picking a From with no To sets both to it; moving From past To moves To with it, and To before From
      moves From, so the range never runs backwards. Clearing either clears the field.
    - Sorts by its start, and lays no swimlanes. **Past due** when its end has passed (by the day for a range of
      days, to the minute with times), drawn in red on the card.
  - **Dates elsewhere**: a Date and Time or a Date Range is read and written as ISO 8601 by Export and Import CSV,
    `list_items`, `change_items` and the CLI: a Date and Time as its UTC instant (`2026-10-31T17:00:00Z`); a Date
    Range as an ISO 8601 interval, its two ends joined by `/` (`2026-10-31/2026-11-02`). Writing one takes any ISO
    8601 time with its offset (`Z` or `+01:00`), and the zone in brackets when given; agents must give the offset
    (a time without one is refused: "give the time with its offset, such as 2026-10-31T17:00:00Z"), while Import CSV
    reads a time without one in the importer's own zone ("2026-10-31 17:00"). A Date Range also takes a list of
    its two ends. The Gantt chart and calendars read both ([Fields by role](#fields-by-role)); a form asks them with
    the [Date and Time and Date Range questions](../030-forms/forms.md#question-types). A formula reads a Date and
    Time as its UTC instant's text and a Date Range as a list of its two ends, never as a day, since the day depends on
    whose zone reads it. Either may be [required](#required-fields).
    Every value
    is a plain string, number or true/false, or a list of them, which the item store keeps for any field; a Person
    is the Assignee's `{ id, name, color }` and a Checklist the Checklist's rows (`{ text, done }`), which the store
    keeps under any field too. Their values are ordinary entries in the item's `fields`, under the custom
    field's id (`f-` and a slug of its name), so the store, agents and exports already carry them.
  - <a id="comments-and-votes-fields"></a>**Comments and Votes fields.** A type may hold the built-in Comments
    and Votes and any number of its own (a **Design Review** and a **QA Notes**, a **Priority Vote** beside the
    Votes).
    - **A Comments field holds its own threads.** Each thread belongs to one Comments field: its `field`, the
      field's id, set when the thread is started and never changed; a thread without one (every thread from before
      this) belongs to the built-in **Comments**. The card panel draws each Comments field as it draws Comments
      ([Items](items.md#where-it-shows)), under the field's name, listing only its threads, its **New Thread**
      starting one in it; each field's card chip counts its own open threads. A thread whose field the card's
      type does not offer (a thread added to a card of another type, a field taken off) shows under the type's
      first Comments field, the built-in when it has it, so no thread is ever hidden; a type with no Comments field
      shows none, as before. The Inbox, mentions and every thread rule are unchanged.
    - **A Votes field holds its own votes**, as the built-in holds them (`{ voter: dots }` under the field's id),
      drawn as the built-in's ▲ count on the card, its chip named for the field (like the built-in, never in the
      panel). Votes are still cast only through a session vote ([Session tools](../012-collaboration/session-tools.md#voting-on-plan-cards)): when
      the tab's card types offer more than one Votes field, the Vote set-up's **Count In** picks which one the
      tally lands in (the built-in Votes first, the default). Top Voted and sorting by votes read the built-in.
      A change never sets a Votes field; a card made again (an undo of a delete, an offline plan's sync) carries
      its votes across, as it carries the built-in's.
    - Agents: `list_threads` names each thread's field, and `change_threads`' `start` takes a `field` by name
      ([Plan agents](plan-agents.md#comment-threads)); `list_items` lists a card's votes per Votes field.
  - **A Person field** offers the plan's people, as the Assignee does, and draws its person's avatar disc and name.
    Whether it **notifies** its person is its own switch ([Notifies](#notifies)); whether it holds one person or
    several is another ([Holds Several](#holds-several)).
  - **A Labels field** reads and is edited as Labels (its chips, coloured by their names), offering the labels the
    plan's cards carry; **a Colour field** as Colour (a swatch and its name, the one colour picker); **a Checklist
    field** as Checklist (its rows, ticked off, and "2/5" on the card).
  - <a id="percent-fields"></a>**Percent** is how far along something is: a whole number from 0 to 100, stored as a
    number under the field's id. 0 is a value (nothing done yet); no value is no value.
    - **In the card panel** it is a **draggable bar** the width of its row: a thin rounded track with the share
      filled in the brand colour and a round thumb at its end, and after it a small box holding the number and a
      quiet "%". Dragging the thumb (or pressing anywhere on the track, which jumps there and keeps dragging) moves
      the share in whole steps, drawn live, and lets go as one change (one undo step), so a drag never floods the
      plan with writes. The bar is a `slider` (its accessible name the field's, its value "40%"): ← and → (or ↓
      and ↑) step 1, Page Up and Page Down 10, Home and End go to 0 and 100, each press one change. Typing in the
      box sets it on Enter or leaving the box, rounded to a whole number and held to 0 to 100 (150 reads 100, -5
      reads 0); emptying the box clears the field, and Escape puts the box back as it was. With no value the track
      is empty, the thumb sits faded at 0 and the box is blank; pressing the track or typing sets one. Someone who
      may only view sees the bar and the number, with no thumb and no box to type in ("None" with no value).
    - **On the card** (where the type's Display places it) it is a chip of a short thin bar (32 px wide, 4 px tall,
      the share filled in the board's accent, the brand violet unless the board has its own colour, on a quiet track of
      its muted ink) and the number ("40%"), named "{Field}:
      40%" for assistive technology; with no value it is not drawn. Exports and api or MCP images draw the same bar
      and number, after the field's name, as they draw every custom field.
    - **Sorts and groups as a number**: Sort Cards orders by it (lowest first, as a Number), and Swimlanes and Card
      Search take it as a Number field, a row or a value per share ("40%"), dropping into a row setting it. Cards by
      Field never adds Percents up: a sum of shares means nothing.
    - **Reading and writing it elsewhere**: `list_items` lists the field with `kind: "percent"` and a card's value as
      the number; `change_items`, the card table and the CLI take a number or text like "40%", round it to a whole
      number and refuse one outside 0 to 100 ("Progress is a percent: give a number from 0 to 100."). Export CSV
      writes the number ("40"); Import CSV reads "40" or "40%", rounding it, and skips a cell that is no number or is
      outside 0 to 100, as it skips a Rating out of its scale. The api stores a custom field's value without knowing
      its kind, so a stray value written straight to it (say 140) is kept, and every reader draws it held to 0 to
      100 (100%). A form can't ask it (no question maps to it).
    - It may be [required](#required-fields); 0 counts as a value.
    - **Shown as a Percent**: a value the plan works out as a share is drawn exactly as a Percent field is when its
      field says so (`showAs: "percent"`): the same chip on the card, the same bar (read-only) in the panel, the
      same bar in exports. Today that is a [Calculated](#calculated-fields) field's **Children Done (%)** and a
      [Formula](#formula-fields) with a **Percent** result; a [Rollup or Lookup](#rollup-and-lookup-fields) whose result is a Percent (an Average of a Percent field, a Lookup of
      one) takes the same switch. One shared reading (`percent-fields.ts`) decides which
      fields show as a Percent and what share they show, so every surface agrees.
- <a id="duration-fields"></a>**Duration** is how long something takes or took, in hours and minutes: an estimate in
  hours, a call's length, the time a team spent. Teams that estimate in hours, and agencies and freelancers who bill
  by time, put "2h 30m" here (Estimate stays story points). It is stored as **whole minutes**, a number under the
  field's id; 0 is a value ("0m"), no value is no value.
  - **Typing it**: the card panel's box (and everywhere text is taken: Import CSV, agents, the CLI) reads "2h 30m",
    "2h30m", "90m", "1.5h", "2:30" (hours and minutes), "2 hours 30 minutes", and a bare number as minutes ("45"),
    ignoring case and spaces, rounded to a whole minute (`parseDuration`). Up to 99,999 hours
    (`DURATION_MINUTES_MAX`); a negative or unreadable one is refused. In the panel, Enter or leaving the box saves it
    (shown back as it reads), Escape puts the box back, emptying it clears the field, and text that is no duration
    puts the box back and says "Write a duration like 2h 30m, 90m or 1.5h". Its placeholder is "2h 30m".
  - **Reading it** (`durationText`): hours and minutes, the zeros left out: "2h 30m", "45m", "3h", "0m". Hours past a
    day stay hours ("26h 15m"; a working day's length differs by team, so there are no days), grouped as the
    reader's locale groups digits ("1,250h").
  - **On the card**: a chip of the clock glyph and its value, named "{Field}: 2h 30m".
  - **Sorts as a number**: Sort Cards orders by it, shortest first. Like a Currency field it lays no swimlanes and
    Card Search has no filter for it (every card would be its own row).
  - **Adds up**: a [Rollup](#rollup-and-lookup-fields)'s Sum, Average, Min and Max of it stay a Duration ("12h 30m");
    a [Formula](#formula-fields) reads it as its minutes; the board's **Time** widget totals it ([Board
    widgets](board-widgets.md#time)). Cards by Field adds up Numbers only, as before.
  - **Reading and writing it elsewhere**: `list_items` lists the field with `kind: "duration"` and a card's value as
    its text ("2h 30m"); `change_items`, the card table and the CLI take that text or a number of minutes, refusing
    anything else ("Estimate Hours is a duration: write a duration like 2h 30m, 90m or 1.5h."). Export CSV writes its text
    ("2h 30m"); Import CSV reads any of the typed forms and skips a cell that is none. The api stores a custom
    field's value without knowing its kind, so a stray value written straight to it (text, a negative) reads as no
    value everywhere. A form can't ask it (no question maps to it).
  - It may be [required](#required-fields); 0 counts as a value.
  - <a id="time-spent"></a>**Time Spent**: a Duration field with **Track Time** on (`timeSpent: true`) holds no typed
    value: it adds up the time people track on the card, with a start/stop **timer** and **manual entries**, each
    saying who and when. The switch is set when the field is made and never changes afterwards (the field's form
    shows it, unchangeable), as a field's kind never does; anything else stored reads as off.
    - **The value** under the field's id is `{ people, entries, running }` (`time-tracking.ts`): each **entry** a span
      someone spent, `{ id, by, minutes, at }` (a person id, whole minutes from 1, and when it was recorded, in
      milliseconds); each **running timer** `{ id, by, start }`, its start stored so a reload or another device keeps
      counting; and `people`, each person they name once (`{ name, color }` by person id), so a card stays small. Its
      **total** is its entries' minutes added up; a running timer joins it when it stops. Everything that reads a
      Duration (the card face, Sort Cards, Rollups, Formulas, the Time widget, Export CSV, sheets and agents) reads a Time Spent field as its total.
    - **Time writes**: every change is one **time write** made to the card as stored (`POST
/api/projects/{id}/items/{itemId}/time`, and the same pure step in a This Browser plan), never a whole value
      written over another, so two people's timers and entries never overwrite each other: **concurrent timers from
      two people both count**. A time write is one of:
      - **start**: the caller's own timer on that field of the card, starting now. One timer per person per field: a
        second start while one runs changes nothing. Several people may run timers on one card at once.
      - **stop**: ends a timer. The time it ran, rounded to whole minutes, becomes an entry by the timer's person at
        the moment it stopped. A timer stopped before 30 seconds rounds to 0 and leaves no entry ("Under a minute:
        nothing recorded" is announced).
      - **add**: a manual entry by the caller, typed as a Duration ("1h 15m"), recorded now; at least 1 minute.
      - **remove**: an entry, or a running timer (its **Discard**: the time is not recorded).
      - **put**: an entry put back as it was (the undo of a remove).
    - **Limits**: a field holds up to **100** entries and running timers together on a card (`TIME_ENTRIES_MAX`), so
      a card stays well within its 16 KB of fields. Full, Start and Add Time are disabled ("This card holds the most
      time entries it can"); a running timer can always stop, since it already counts.
    - **In the card panel** the field's row reads, top to bottom:
      - the **total** in large tabular figures ("4h 15m"; "No time yet", muted, with none);
      - the viewer's own **timer**: **Start Timer** (a play glyph, the brand colour), or while theirs runs a green
        pulsing dot, its elapsed time ticking each second ("12:05", then "1:02:05") and **Stop** (a square glyph),
        with **Discard** (a cross, "Discard timer") beside it;
      - **others' running timers**: each a row of their avatar disc, their name and their elapsed time ticking, "Stop"
        beside it for an Editor;
      - **Entries**, newest first: each the person's disc, name, its time ("1h 15m") and when ("Today, 14:02",
        "Yesterday, 09:30", "3 Oct, 16:45"), with a remove cross ("Remove 1h 15m by Sam") on the viewer's own
        entries (an Editor's on every entry); past five, **Show All N Entries** opens the rest;
      - **Add Time**: a dashed row that opens, in place, a small box ("1h 15m") and **Add**: Enter adds, Escape or
        Cancel closes it, and text that is no duration says so under the box.
    - **On the card face**: where the Display places it, its total as any Duration ("4h 15m"). And **while anyone's
      timer runs** the card shows it, at every size, whether or not the Display places the field, at the end of the
      card's last row (Minimal: after the title): a pill of the runners' avatar discs (the first three overlapping,
      then "+N"), a green dot that pulses (still with reduced motion), and the elapsed time of the earliest started,
      ticking ("12:05"); named "Timer running: Sam, 12 minutes" for assistive technology, the full list in its
      tooltip. Everyone with the plan open sees it.
    - **Ticking**: one shared clock for the page (`useNowSeconds`) ticks once a second, only while some running timer
      is drawn; only the elapsed readouts subscribe to it and redraw, never a board, a card or the panel, so a board
      of 2,000 cards with timers running repaints a few text nodes a second.
    - **Share roles**: an **Editor** does everything: start and stop their own timer, stop anyone's, add entries and
      remove anyone's. A **Participant** starts and stops their own timer and adds and removes their own entries
      only. A **Viewer** sees the total, the entries and the running timers, read-only (no Start, Stop, Add Time or
      remove cross). The api refuses a Viewer's time write (403) and a Participant's stop or remove of another
      person's timer or entry (403, `time_not_yours`); a put back of another person's entry is an Editor's.
    - **Undo**: Add Time and removing an entry are each one undo step (the undo of an add removes it, of a remove
      puts it back); starting, stopping and discarding a timer are not (a clock, not an edit, as a vote's tally is).
    - **Card writes leave it alone**: a card change never sets or clears a Time Spent field (refused,
      `field_time_tracked`: "Time Spent is tracked: add time in the card panel"); a card made again (an undo of a
      delete, an offline plan's sync, a copy) carries its entries, checked as a time value; Duplicate leaves them
      behind (the copy's time is its own). Turning a field into one, or one back into a typed Duration, is not
      possible.
    - **Elsewhere**: Export CSV writes the total ("4h 15m"); Import CSV skips its column; the SVG and PNG exports and
      api or MCP images draw the total and, while a timer runs, the runners' discs and "Running". `list_items` lists
      the field with `kind: "duration"`, `timeSpent: true` and `readOnly: true`, a card's value as its total, and the
      card's `time`: per field, its entries (who by name, the time as text, when as an ISO time) and running timers
      (who, since when). Agents read time but never track it (`change_items` refuses a value for it: "Time Spent is
      tracked: people add time in the card panel"); a person's time is their own record, so no agent starts, stops or
      adds to it.
    - Telemetry: `Plan` · `Started` · `Timer` and `Plan` · `Ended` · `Timer` when someone starts and stops their
      timer, `Plan` · `Added` · `TimeEntry` when they add time by hand.
- **Fields by role** <a id="fields-by-role"></a>: a feature that reads a field for what it means, not by its name,
  reads the built-in field unless its own settings pick another field of the same kind. Nothing a plan already
  shows changes until someone picks.
  - **Dates**: a Gantt chart's bars run from its **Start** field to its **Due** field, a Due Calendar places
    cards by its **Due** field and a Start Calendar by its **Start** field. Each picks any Date, Date and Time or Date
    Range field of the card types it shows, built-in or custom, in its Chart Settings ([Plan views](plan-views.md#dates)).
  - **Person**: a board's Swimlanes and Cards by Field group by the Assignee or by any custom Person field
    ([Swimlanes by a field](plan-board.md#swimlanes-by-a-field)); notifying is the Person field's own switch
    ([Notifies](#notifies)).
  - **Estimate**: Cards by Field counts cards, or adds up the Estimate or any Number field
    ([Cards by Field](plan-views.md#cards-by-field)).
  - **Sort**: Sort Cards already lists every built-in and custom field it can order by; nothing changes there.
  - **Card colour**: a type's cards take their colour (the stripe, the Gantt bar, a linked card's dot) from its
    **Colour** field, or from a custom Colour field picked as its **Card Colour** on the type's Display tab,
    so a card is the same colour on every board, chart and export. Stored as `colourField` on the type (the
    custom field's id); absent is Colour. A picked field the type no longer has reads as Colour again.
    Telemetry: `Plan` · `Changed` · `CardColourField`.
- **Notifies** <a id="notifies"></a>: every Person field, the Assignee included, has a **Notifies** switch in its
  settings in the type editor (the Assignee's row menu, a custom Person field's form), with the line "Tell the
  person when a card is theirs: the Inbox, emails and Only Mine." The Assignee notifies unless switched off
  (`assigneeNotifies: false` on the type); a custom Person field does not unless switched on (`notifies: true` on
  the field), so nothing a plan does today changes. A card is **someone's** when a notifying Person field holds
  them (one of its people, for a field that [holds several](#holds-several)), and is then theirs everywhere the Assignee made it so: the Inbox's **Assigned to You** (one row a card,
  however many of its fields name them), the assignment event on their timeline and any email it sends, and the
  board's **Only Mine** ([Plan board](plan-board.md)). A custom person (an `n-` id) never notifies, as before.
  Telemetry: `Plan` · `Changed` · `FieldNotifies`.
- **Required fields**: any custom field but a Checkbox (unticked reads as empty), a [Calculated](#calculated-fields) field (the plan
  works it out), a Duration field that [tracks time](#time-spent) (its entries are recorded, never typed in), an [Image](#image-fields) field (a picture is added once the card exists) or a
  [Comments or Votes](#comments-and-votes-fields) field (threads and votes are not typed in) can be marked **Required**. A
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
    question's), absent for a Checkbox, Calculated or Image field; turning a field into any of them is not possible, so it never needs clearing. A required field's
    row carries the same red asterisk after its name.
  - **Agents** see it: `list_items` lists `required: true` on each required custom field, `change_card_types`
    sets it (`required` on `custom`, `addCustom` and `editCustom`), and `change_items` refuses an `add` missing one,
    or a `set` clearing one, before writing anything, naming every missing field and the type ("Bug cards need
    Severity and Area: give them in fields, by name").
- **Card fields** link a card to one other card, of any of the card types the field names: an Objective's
  **Owner** links to a Person, and a Task's **Parent** may link to a Project or an Epic. The value is that card's id.
  A Card field switched to [hold several](#holds-several) links to a list of cards instead (a **Related** or a
  **Depends On**); everything below reads every card of the list.
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
- <a id="holds-several"></a>**Holds Several**: a Person field or a Card field can hold more than one value, by
  its **Holds Several** switch (stored as `multiple: true` on the field; kept only as true, and only on those two
  kinds, so every field saved before holds one). Reviewers, Owners and pair work need several people; Related,
  Depends On and Candidates need several cards. The built-in Assignee and Parent always hold one. One rule serves
  both kinds:
  - **The value** is a list: a Person field's people (`[{ id, name, color }, ...]`), a Card field's card ids
    (`["<id>", ...]`), each once, in the order they were added, at most **20** (`FIELD_VALUES_MAX`). An empty list
    is no value: the field is cleared instead. A field holding several still reads a single stored value (one
    person, one card id, every value written before the switch) as a list of one, and a field holding one reads a
    stored list as its first value, so turning the switch either way never rewrites or loses a card's value: a
    value changes only when someone next edits it. An older editor reading a list reads the field as empty (never a
    crash), and its next pick replaces the list with that one value.
  - **The switch** sits in the field's form in the type editor (and Add Field's Shape step) under the kind's own
    settings, with the line "Hold more than one person, such as reviewers or a pair." (Person) or "Link more than
    one card, such as related work." (Card). Telemetry: `Plan` · `Changed` · `FieldHoldsSeveral`.
  - **The control** (the card panel): one bordered field holding a **chip** per value (a person's disc and name; a
    card's type glyph, number and title, pressing it opens the card), each with a remove button (accessible name
    "Remove {name} from {Field}"), then an **Add** button (a plus, accessible name "Add to {Field}") that drops the
    kind's own list (the plan's people and + Custom {Field}; the candidate cards with their filter). The list
    stays open for more picks: a pick adds the value, picking one already held removes it (each held row ticked,
    `aria-selected`), and Escape, a press outside or Tab close it. No one and None leave the list (removing every
    chip empties the field). Full at 20, Add is disabled with the tooltip "{Field} holds up to 20". A Viewer sees
    the chips without remove buttons or Add. Removing a chip announces "Removed {name}".
  - **On the card face**: a Person field draws its people's discs stacked, overlapping by a third, the first three
    then a "+N" disc for the rest (its accessible name "{Field}: Sam, Ana and 2 more"); a Card field reads its
    linked cards' numbers ("#3 #5 #8"), the first three then "+N", with the first linked card's glyph (its
    accessible name lists every number and title).
  - **Swimlanes and grouping**: a card sits in **each** of its values' rows (Sam's and Ana's rows both show a card
    Sam and Ana review), the way most planners lay several people, and in **No {Field}** only when it holds none.
    Dragging a card out of one value's row into another's swaps that value for the new one (from Sam's row to
    Lee's: Ana and Lee), keeping its others; into a row whose value it already holds just drops the one it left;
    into **No {Field}** clears the field. A Cards by Field chart, a Gantt chart's swimlanes and a card table's
    group filters count the card once in each of its rows. Filters by the field match a card holding any of the
    picked values.
  - **Notifies**: a notifying field holding several tells each of its people ([Notifies](#notifies)): the Inbox's
    Assigned to You (one row a card), the assignment event and email, and Only Mine all match any of them. A custom
    person among them never notifies.
  - **Linked as and children**: a card in a list links to the card as any link does: its Linked as {Field}
    section lists every card whose list holds it, Child Count and Children Done count it, and an agent's read of a
    card names every linked card. **Link Existing** on a field holding several adds this card to the picked card's
    list, so it never asks to move a link; the picked card's row shows no "Linked to" note. One shared reader
    returns every card a field links to (`linkedCardIds`), so a later rollup or lookup reads every linked card the
    same way.
  - **Agents and CSV**: `list_items` reads a field holding several as a comma list ("Sam Reed, Ana Diaz";
    "#3 Website, #5 Launch"), and `change_items` and Import CSV take a comma list (or, for agents, a JSON list) of
    names, numbers or titles back, each resolved as one value would be; one value given sets a list of one. An agent
    sets the switch with `multiple` on `change_card_types`' `custom`, `addCustom` and `editCustom` (only a Person or
    Card field). Export CSV writes the list joined by ", ".
  - **Share roles**: as any field. An Editor sets the switch (the type editor); an Editor and a Participant edit a
    card's values; a Viewer reads them.
- <a id="calculated-fields"></a>**Calculated fields**: a custom field of kind **Calculated** works its value out from the plan instead of holding
  one. It is made like any custom field (Add Field's **Calculated** kind, or `change_card_types`), with one
  **calculation** from a fixed menu, stored as `calculation` on the field:
  - **Child Count**: how many children the card has.
  - **Children Done (%)**: the share of its children that are done, a whole percentage ("40%"); nothing when it has
    no children. Its form has a **Show as Percent Bar** switch ("Draw the share as a bar, like a Percent field."): telemetry `Plan` · `Changed` · `FieldShowAsPercent` on each flip;
    on, the field is stored with `showAs: "percent"` and draws as a [Percent](#percent-fields) does, on the card,
    in the panel and in exports; off (and for every field made before it), it reads as text ("40%") as before. A
    Child Count is no share, so it never offers the switch, and changing a field's calculation to Child Count turns
    it off.
  - **Rollup**: one of a card's children's fields totalled, averaged, counted or dated (a Project's **Total
    Points**, **Total Spend**, **Last Due**), [below](#rollup-and-lookup-fields).
  - **Lookup**: a field of the card a Card field links to (a Task's **Project Due**, **Client Email**),
    [below](#rollup-and-lookup-fields).
  - **Formula**: an expression over the card's own fields (`Budget - Spent`), [below](#formula-fields).

  **Children** are the cards that link to the card through a Card field naming its type (the cards its panel lists
  under **Linked as {Field}**, Parent included): every such field, each child once, an archived child included and a
  trashed one left out. **Done** is the boards' rule ([Done columns](plan-board.md#done-columns)): a child is done
  when its status is a done column's, the first board to name a status deciding, as a plan view's Done phase does.
  - **Nothing is stored**: the value is worked out where it is read, from the same shared functions
    (`calculated-fields.ts`), so it is always current and never conflicts. It updates as soon as a child is added,
    moved, relinked or trashed.
  - **Read-only everywhere**: the card panel shows the value as text after a calculator glyph, never an input (Children Done with a thin bar of the share done, or the Percent bar, read-only, when it shows as a Percent; a card without children "No linked cards"); the field's form in the type editor says it is worked out from the cards that link here; the card face draws it like any custom field when the
    type's Display places it ("Children Done: 40%"). A write that gives a Calculated field a value is refused
    (`field_calculated`, field: the field's id): the api (and This Browser projects, through the same check),
    `change_items` and the CLI ("Progress is calculated: it can't be set"). Clearing an old value left under the
    field's id is allowed.
  - **Agents and the api read it**: `list_items` lists each Calculated field with `kind: "calculated"`, its
    `calculation`, `showAs: "percent"` when it shows as a Percent, and `readOnly: true`, and each card's value among its `fields`, by name; `GET /items` answers
    `calculated` (by card id, then field id) when asked with `?include=calculated`.
  - **Where it is left out**: a form can't ask it (no question maps to it), Import CSV skips its column and Export
    CSV leaves it out, and a board can't sort or lay swimlanes by it. A Formula, a Rollup and a Lookup are the exceptions: they export,
    sort and filter as their result ([below](#formula-fields), [Rollup and Lookup](#rollup-and-lookup-fields)).
  - A field's kind never changes, so a Calculated field stays one; its calculation can be changed in its form (or
    `editCustom`'s `calculation`), and every card's value follows at once.

- <a id="formula-fields"></a>**Formula fields**: a Calculated field whose calculation is **Formula** works its value
  out from the card's own fields, so a budget, hiring or sales board does its own sums (`Budget - Spent`,
  `Estimate * Rate`, `days(Due - Start)`, `if(Score >= 8, "Strong", "Weak")`). Like every Calculated field nothing is
  stored and it is read-only everywhere (the rules above hold); what follows is its own.
  - **The expression** names fields by the names the card panel gives them, ignoring case. A name of plain words
    (letters, digits and `_`, one space between words: `Budget`, `Story Points`) is written as it is; any name may be
    written in braces (`{Children Done (%)}`), which a name holding other characters, or one that is also `true`,
    `false` or a function's name, needs. It reads the type's custom fields (all but Image, Comments and Votes), the
    built-in Title, Estimate (or Points), Start Date (or Start), Due Date (or Due), Priority, Assignee, Labels,
    Colour and Checklist when the type offers them, and every card's **Number** and **Type**. A custom field's name
    wins over a built-in's other name. Status is not read (its names belong to the boards). Text is written in
    double quotes (`"Strong"`, `""` for a quote inside), numbers as `12` or `0.5`, and `true` and `false`.
  - **Operators**: `+ - * /`, brackets, a leading `-`, and the comparisons `= != < <= > >=` (`==` and `<>` read as
    `=` and `!=`). `* /` bind before `+ -`, which bind before a comparison.
  - **Functions**: `round(x)` (or `round(x, places)`, 0 to 10), `min(a, b, ...)`, `max(a, b, ...)`, `abs(x)`,
    `if(test, then, else)` (else blank when left out; only the branch taken is worked out), `and(a, b, ...)`,
    `or(a, b, ...)`, `not(x)`, `days(x)` (a date: the days from today to it, negative once past; a number: itself),
    `today()`, `concat(a, b, ...)` (the values as text, joined) and `len(x)` (a list's count, a text's characters).
    Names compare ignoring case; a function given the wrong number of values is a syntax error.
  - **Values**: Number, Currency, Rating and Estimate read as numbers; a [Duration](#duration-fields) as its whole
    minutes (`{Time Spent} / 60 * Rate` is the bill), a Time Spent field as the minutes its entries add up to; Date, Start and Due as dates; Checkbox as
    true or false; Text, Long Text (its text), Email, Link, Choice, Colour, Priority, Title and Type as text; a Person
    (and the Assignee) as the person's name; a Card field as the linked card's "#12 Title" ("Missing card" when it is
    gone); another Calculated field as its value (Child Count, Children Done, a Rollup's or a Lookup's result, as its result
    reads: a Date result as a date, another Formula's result). **Lists**: a
    field that [holds several](#holds-several), a Multiple Choice, Labels and a Checklist (its rows) read as a list:
    `len()` counts it, `concat()` joins it with ", ", and anything else given a list is an error ("Reviewers holds
    several: count them with len()").
  - **Blanks**: an empty field reads as 0 in sums, "" as text and false in a test. When every field a formula reads
    is empty on a card, the card shows no value, so a new card reads blank rather than 0 (a Checkbox, ticked or not,
    and Number and Type always have a value).
  - **Dates**: a date less a date is the whole days between them (a number); a date plus or less a number is a date;
    dates compare earliest first. `today()` is the reader's day (the api's and the agents' in UTC).
  - **Text** compares ignoring case (`Stage = "won"` matches "Won"); `+` on text is an error ("Join text with
    concat()").
  - **The result** (`result`, Number when absent) decides how the value reads, sorts and exports:
    **Number** (grouped, up to two decimals, as a Number field), **Currency** (in the field's `currency`, as a
    Currency field), **Duration** (a number of minutes, rounded to a whole minute and read as a Duration field reads:
    `Estimate * 60` reads "5h"; below 0 reads "0m"), **Percent** (a share, rounded to a whole number: `Spent / Budget * 100` reads "40%"; its
    form offers **Show as Percent Bar**, as Children Done's does, and on it draws as a [Percent](#percent-fields)
    does, held to 0 to 100; picking another result turns it off),
    **Text**, **Date** (as a Date field) or **Checkbox** (Yes or No; any value tests true or false). A Number,
    Currency or Percent result that is no number is an error ("Gives text: make the result Text"); so is a Date
    result that is no date. Text takes any value as text.
  - **Stored**: `formula`, the expression with each field written as its id in braces (`{f-budget} - {f-spent}`),
    so a renamed field keeps working; the editor and agents show it with names. `result` and, for Currency,
    `currency` beside it.
  - **Errors never break a board.** A formula that can't be read (bad syntax, an unknown field, too long, too deep)
    is refused where it is written: the editor and `change_card_types` name the problem and where ("Unknown field
    "Spnt" at 10", "Expected ) at 14"). A stored formula that stopped working (a field it reads was deleted or taken off
    the type, or a field it reads became a kind it can't read) and a value that can't be worked out on one card
    (dividing by 0, a list in a sum, a formula that reads itself through another) read as an **error**: the card
    panel shows the message in place of the value, the card face reads "Error" in red (the message spoken with it), and
    the api, the agents, exports and sheets read no value.
  - **Safety**: a small hand-written parser and evaluator, never `eval`; a formula holds up to 1,000 characters
    (`FORMULA_MAX`) nested up to 32 deep, and working one out on a card takes at most 10,000 steps (other formulas it
    reads included), past which it is an error ("Too much to work out").
  - **Where it reads**: everywhere a Calculated field does (the card face, the panel, the api, the agents, the SVG
    and PNG exports), and also **Export CSV** (its value as a field of its result kind exports: "2500", "2026-10-31", Yes) and a sheet's card functions
    (`CARD`, `CARDS`... read it by name: a number, text, true or false, or a date). A board **sorts** by a Formula
    whose result is a Number, Currency, Percent or Date (as that kind sorts), and lays swimlanes (and Card Search
    filters) by one whose result is a Number, Percent, Date, Text or Checkbox, read-only ([Rollup and
    Lookup](#rollup-and-lookup-fields), Filters); forms and Import CSV leave it out.
  - **In the type editor**: picking Formula in the field's form (and Add Field's Shape step) opens the formula
    editor: a **Result** menu (and **Currency** for a Currency result, **Show as Percent Bar** for a Percent one), a monospaced **Formula** box, the type's
    fields as chips under it (pressing one writes its name at the caret), and a line that checks the formula as it is
    typed: "Works" with a tick, or the problem in red. **Preview** works it out on a real card: the type's first
    live card ("On #12 Website: £2,500"), or "No {Type} card to try it on yet". Add {Name} waits until the formula
    works ("Write a formula that works"). In an existing field's form, a formula that doesn't work is not kept: the
    field keeps its last working one, and the line says so ("Not saved: Unknown field "Spnt""). Picking another
    calculation drops the formula and its result. Telemetry: `Plan` · `Changed` · `FieldFormula` on picking Formula.
  - **Agents**: `change_card_types` takes `formula` (by names) and `result` on `custom`, `addCustom` and
    `editCustom` (and `showAs: "percent"` with a Percent result), refusing a formula that can't be read with its problem; `list_items` lists a Formula field's
    `formula` by names, its `result`, and `formulaError` when it stopped working, and each card's value (a number,
    text, true or false, an ISO date, or null).
  - **Share roles**: as any field. An Editor writes the formula (the type editor); everyone who can read the plan
    reads the values.

- <a id="rollup-and-lookup-fields"></a>**Rollup and Lookup fields**: two calculations that read other cards' fields
  through the links between cards, so a Project totals its tasks' points or spend and a Task shows its Parent's due
  date without anyone copying values by hand. Like every Calculated field nothing is stored and it is read-only
  everywhere (the rules above hold); what follows is their own.
  - **Rollup** works one value out over a card's [children](#calculated-fields) (archived ones counted, trashed ones
    left out, as Child Count counts them). Its settings:
    - **Through** (`through`): which children, **All Linked Cards** (every child, stored as no `through`) or the
      ones linking here through one Card field, by name ("Parent", "Project"). The menu lists every Card field of
      any type that links to this card's type, each once (a field id names the same field on every type holding
      it). A card linking through a field that [holds several](#holds-several) is a child of each card it links.
    - **Calculate** (`aggregate`): **Sum**, **Average**, **Min**, **Max** (of a number), **Count** (how many
      children), **Count Done** (how many are done, by the boards' rule), **Earliest** and **Latest** (of a date).
    - **Field** (`source`, by id): what Sum, Average, Min and Max read: a Number, Currency, Rating, Estimate or
      Percent field (never Sum of a Percent: a sum of shares means nothing), a [Duration](#duration-fields) field (a
      Time Spent one too: the minutes its entries add up to), or a Calculated field whose result is a
      number, money, a share or a duration; what Earliest and Latest read: a Date, Start Date or Due Date field, or a Calculated
      field whose result is a Date. Count and Count Done read none. The menu lists the fields of the card types
      that link here through the chosen field (any of them for All Linked Cards), each once, by name.
    - A child without the field, or with it empty, is skipped; so is a child whose own worked-out value is an error.
      With nothing left Sum, Average, Min, Max, Earliest and Latest read no value; Count and Count Done read 0.
  - **Lookup** shows one field of the card a Card field links to. Its settings: **Through** (`through`), one of this
    type's own Card fields (required), and **Field** (`source`), any field of the card types that field links to
    that a [Formula](#formula-fields) can read (Title, Number, Type, Estimate, Start and Due Date, Priority,
    Assignee, Labels, Colour, Checklist and every custom field but Image, Comments and Votes), Calculated fields
    included. A field that holds several reads its first linked card that is still there. No linked card, a
    missing one or one in the Trash reads no value; an archived one is still read.
  - **The result** (`result`, as a Formula's, with `currency` beside a Currency one) is taken from what it reads
    when the field is set (the type editor and `change_card_types` write it), never picked: Count and Count Done
    give a **Number**, Earliest and Latest a **Date**, Sum, Average, Min and Max the field's kind (**Currency** in
    the field's currency, **Percent**, **Duration** (Sum, Average, Min and Max of a Duration stay a Duration, "12h 30m",
    an Average rounded to a whole minute), else **Number**: a Rating and Estimate read as numbers). A Lookup gives its
    field's kind: Number (Rating, Estimate and Number too), Currency, Percent, Duration, Date (Start and Due too),
    Checkbox, a Calculated field's own result, and **Text** for everything else (a Person's name, a list joined by
    ", ", a Card field's "#12 Title"). Values are rounded as the result reads (money to the penny, a share to a
    whole number). A Percent result offers **Show as Percent Bar**, as a Formula's does.
  - **Problems** read as an error, as a Formula's do (the panel says why, the card face reads "Error", the api,
    exports and sheets no value): a Card field or field it reads that no type has any more ("The field it reads is
    gone"), a value that reads itself through other cards ("Circular: Total Points reads itself"), and one that
    takes too long ("Too much to work out").
  - **With Formulas** (the order): a Formula may read a Rollup's or a Lookup's value by name (`{Total Spend} /
Budget * 100`), and a Rollup or a Lookup may read a Formula on the cards it reads. Working out one value, every
    card and formula it reads included, takes at most 100,000 steps (`CALCULATED_STEPS_MAX`: each card read is a
    step, and each formula's steps count; one formula still takes at most 10,000) and reads through at most 8
    values across cards (`CALCULATED_DEPTH_MAX`); past either, it is "Too much to work out". Within one value each
    card's value is worked out once, however many paths reach it.
  - **Filters**: a board lays swimlanes by a Formula, a Rollup or a Lookup whose result is a Number, Percent, Date,
    Text or Checkbox (a row per value, ordered as that kind's rows are; Currency, like a Currency field, lays none),
    and Card Search filters by one the same way. Its rows are read-only, as a Created row is: a card dropped into one
    keeps its value (only a drop's column move applies), and no empty row is offered to drop into.
  - **Where it reads**: everywhere a Formula does: the card face, the panel, Sort Cards (a Number, Currency, Percent
    or Date result), swimlanes and Card Search (above), Export CSV (its value as a field of its result kind exports),
    a sheet's card functions, the SVG and PNG exports, `GET /items?include=calculated`, and the agents.
  - **Performance**: the children index is made once per change to the cards (`childIndexFor`), never a scan per card
    per field, so a board of 2,000 cards with several Rollups draws in one pass over the cards and one per child
    link per Rollup.
  - **In the type editor**: picking Rollup in the field's form (and Add Field's Shape step) shows **Through**,
    **Calculate** and **Field** menus (Field hidden for Count and Count Done; a field that no longer fits the
    calculation is dropped, and Add {Name} waits for one: "Pick a field to read"), **Show as Percent Bar** for a
    Percent result, and **Preview**: the value on the type's first live card that has one ("On #3 Website: 21"),
    else on its first live card, or "No {Type} card to try it on yet". Picking Lookup shows **Through** (this type's
    Card fields; "Add a Link to Card field first" when it has none) and **Field**, and the same Preview. With no
    Card field linking to the type a Rollup's Through offers only All Linked Cards and says "No Link to Card field
    links here yet". Picking another calculation drops the settings.
  - **Agents**: `change_card_types` takes `through` (a Card field by name, or "all" for a Rollup), `aggregate` (by
    id, `countDone`, or name, "Count Done") and `source` (a field by name) on `custom`, `addCustom` and
    `editCustom`, refusing a setting that does not fit with what would ("Total Points can't Sum Status: give a
    Number, Currency, Rating, Estimate, Duration or Percent field."). `list_items` lists their `through` and `source` by name,
    `aggregate` and `result`, and each card's value as a Formula's (a number, text, true or false, an ISO date, or
    null).
  - **Share roles**: as any field. An Editor sets a Rollup or Lookup up (the type editor); everyone who can read the
    plan reads the values.

- <a id="image-fields"></a>**Image fields**: a custom field of kind **Image** holds one picture, uploaded from the
  card panel into liveworkspace's media service (`liveworkspace/docs/specs/006-media/media.md`), where every app keeps
  the images people upload. Its value is the image's id there (a string); the bytes never sit in the plan.
  - **The control** (the card panel): with no picture, a dashed drop zone the width of its row, an image glyph and
    **Add an Image** ("PNG, JPEG, WebP or GIF, up to 10 MB" under it); pressing it (or Enter or Space) opens the
    file picker, and a file dropped on it uploads too. While it uploads it reads **Uploading…** with a spinner and
    takes no other file. With a picture, the picture itself, fitted to the row's width and at most 12 rem (192 px)
    tall on a soft grey ground, and under it **Replace** and **Remove** (each an icon and its word); its accessible
    name is "{Field}: image". A picture that cannot be read (deleted at the service, or not shown to this person)
    draws a quiet broken-image tile saying "This image can't be shown", with Replace and Remove still there.
  - **What it refuses**, inline under the control, before anything is sent: a file that is not PNG, JPEG, WebP or
    GIF ("Use a PNG, JPEG, WebP or GIF image."), one over 10 MB ("That image is over 10 MB."), an empty file; and
    from the service, a full gallery ("Your image gallery is full. Delete some images and try again."). A server
    without the media service answers 503: the control then says "Image uploads aren't available here." and
    offers no upload.
  - **Who may change it**: an Editor and a Participant (who edit cards) add, replace and remove a picture; a Viewer
    sees the picture alone. Removing clears the field (one undo step, as any field); the image stays in its
    uploader's gallery.
  - **On the card face**: where the type's Display places it, a small thumbnail (20 px tall, rounded) before the
    field's name, named "{Field}: image" for assistive technology; with no value it is not drawn. Thumbnails load
    as cards scroll into view, each picture fetched once and shared by every card and panel showing it.
  - **Reading the bytes** (the api): `GET /api/images/{id}?p={planId}` answers the picture to its uploader, and to
    anyone who may read plan `{planId}` (its owner, its team, and every share role: Editor, Participant and Viewer)
    when that plan **serves** it: one of its cards holds the id and the plan holds a **grant** for it. A grant is
    recorded when the picture is uploaded for that plan (`POST /api/images?p={planId}`, by someone who may edit its
    cards), so an id pasted into another plan serves nothing there. Anything else answers 404.
  - **This Browser plans** upload too (as the person, their guest or account), and show their pictures to them.
    **Copies** carry the id; a copy shows the picture to its uploader, and to the copy's share visitors once
    someone who may edit it uploads it there again.
  - **Where it is left out**: a form can't ask it, Import CSV skips its column and Export CSV leaves it out, and a
    board can't sort or lay swimlanes by it. **Agents** read it (`list_items` lists the field with
    `kind: "image"`, and a card's value as the image id) and may clear it, but never set one: `change_items`
    refuses a value for it ("Photo is an image: add one in the card panel").
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
  - **Minimal**: **Before the Title** and **After the Title**, on its one line; it can draw Number, Priority, Due Date,
    Age and Assignee. A default type's Minimal card shows none of them by default; a type of the person's own starts
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

- **Attachments and Cover Image** (a type that offers [Attachments](items.md#attachments)): Detailed draws two card
  fields of them. **Attachments** is a picture glyph and the card's count, placed in the Footer by default.
  **Cover Image** is the card's cover picture across the top of the card, edge to edge, 120 px tall and cropped to
  fill, above the Header; it is the Display's **option** for covers: it sits only in the **Header** (that is where
  it is dragged to and listed), and taking it off the card turns covers off for the type. Both are in every type's
  default Detailed Display while it offers Attachments (Cover Image first in the Header), so adding Attachments to a
  type with its default Display shows them at once; a type whose Detailed Display was set before finds both under
  **Available Fields**. Minimal draws neither. The Display's example card draws the cover as a soft striped
  placeholder labelled "Cover image", and Attachments as "3".
- **Age** is in no default: a type shows it only once someone places it. Every type offers it (every card sits in
  a column). It reads how long the card has sat in its current status, in whole days ("4d"; "0d" on the day it
  arrived), counted in local calendar days from the moment it entered that status (`statusSince`,
  [Fields](items.md#fields)), so it moves on at local midnight with no reload, as Due Soon does, from one shared
  day tick (never a timer per card). It is quiet under a week; from **7 days** it turns amber and semibold, and from
  **14 days** (Stale Cards' threshold, [Plan views](plan-views.md)) red and bold. Its spoken label says
  "In {status} for 4 days" (for a screen reader; the hourglass glyph marks it for the eye). A card in a done column never shows it, and neither does a card with no status. Exports,
  thumbnails and api or MCP images draw it as the board does (a quiet "4d" pill, amber or red past the
  thresholds); a lone Plan card element, which has no board to say which columns are done, leaves it out.
- **Created At, Created By, Last Edited At and Last Edited By** ([Created and Last Edited](items.md#created-and-last-edited))
  join Age as its family: every type offers them, none is in a default, and Detailed draws them (Minimal's line
  keeps to its five). **Created At** and **Last Edited At** are quiet pills, a clock and "Created 3 Oct", a pencil and
  "Edited 31 Oct", the viewer's local day, the full date and time in the spoken label ("Created 3 Oct 2026,
  14:02"); **Created By** and **Last Edited By** are the person's disc, as a Person field draws, spoken
  "Created by Sam" and "Last edited by Sam". A card with no stamp for one (a card from before it was kept) draws
  nothing there. The Display's example card reads them as made two days ago and edited today, by its sample person.
  **Available Fields** lists them, with Age, under a second small heading, **Filled In Automatically**, after the
  fields a person fills in. Exports, thumbnails and api or MCP images draw them as the board does.

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
    - **On the Card**: Title (always), Votes when the type has it and each Votes field of its own; they never go in
      a tab.
    - **Details**, tagged "Side column" (after On the Card on a phone, beside the main column on desktop): every field in no tab, its name renamed in place in the group's header,
      never moved or removed.
    - Each **tab**, tagged "Tab", in order (Overview first, as the panel reads): renamed in place in its header, moved with ↑ and ↓, and taken off with
      × (its fields go to Details). **Overview** is renamed and moved like any tab but has no ×: it stays, even
      empty. A new tab's name field takes focus. An empty group says so, and that any tab but Overview left
      empty is dropped when the type is saved.
  - Field rows alternate white and a light grey within their group, so a long list reads row by row. Each field
    row leads with a **drag handle** (a grip), then an icon of what it holds, then its name, and a lock beside the
    name for a field the type always keeps (Title and Status, and a Project's Start and Due; its tooltip says "{Name}
    is always on this type"). The icon is its kind's own, as Add Field lists it (a custom field's kind: Link to Card a
    card; a built-in field its kind: the Assignee a person, Labels a tag, Colour a palette, Checklist a list of
    ticks, Comments a speech bubble, Votes a thumbs up, Due Date a calendar, Estimate a #, Description long text,
    Title text, Status and Priority a list); its tooltip and accessible name name the kind ("Link to Card", "Date", "Person"). Dragging the handle (mouse, pen or touch alike) moves the field
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
        Typing filters the kinds: a kind by its name, its line, the built-in fields of its kind (**due** and
        **start** find Date, **assignee** Person, **priority** Choice, **estimate** Number, **description** Long
        Text), and a few everyday words for it (**money**, **price**, **budget** find Currency; **stars**,
        **score** Rating; **yes/no**, **tick**, **toggle** Checkbox; **parent**, **epic**, **relation** Link to
        Card; **percent**, **progress**, **complete** Percent; **formula**, **rollup** Calculated; **url**, **website** Link; **dropdown**,
        **select**, **option** Choice; **tags**, **multi-select** Multiple Choice and Labels; **notes**,
        **paragraph** Long Text; **deadline**, **day** Date; **time**, **meeting**, **appointment** Date and Time; **range**, **event**, **trip** Date Range; **mobile**, **tel**, **call** Phone; **count**, **points** Number; **time**, **hours**, **timer**, **tracking**, **billable** Duration; **mail** Email;
        **owner**, **reviewer**, **people** Person; **color**, **swatch** Colour; **to-do**, **subtasks** Checklist;
        **discussion**, **thread** Comments; **like**, **upvote** Votes; **picture**, **photo**, **screenshot**,
        **attachment**, **cover** Image, whose Ready to use offers Attachments). With nothing matching it says **No matches for “…”** with "Try a word like money, date or
        parent." under it. How many match is announced.
      - **One list of kinds**, with no Ready-made section: every kind a field can be, built-in or not, each a row
        with its icon on a soft tile, its name, and a one-line description in plain words, in six groups as an
        **accordion**, one group open at a time (opening one closes the other; pressing the open one closes it; the
        first open to start): **Text & links** (Text "A short line of text", Long Text "Paragraphs of notes", Link
        "A web address", Email "An address that opens your mail app", Phone "A number that calls on a phone"), **Numbers & dates** (Number "Points, counts
        and sizes", Currency "An amount, like £12,500", Percent "How far along, drawn as a bar", Duration "Hours and minutes, or time tracked with a timer", Rating "Stars out of 3 to 10", Date "A day on the
        calendar", Date and Time "A day and a time, in each person's time zone", Date Range "From one day to another, with times if you like"), **Choices** (Choice "One option from a list", Multiple Choice "Several options from a list",
        Checkbox "Yes or no, ticked or not", Labels "Short tags, coloured by name"), **People & teamwork** (Person
        "Someone on the plan, like an owner or a reviewer", Checklist "To-dos ticked off one by one", Comments
        "Threads to talk the card through", Votes "Thumbs up from the team"), **Colour & images** (Colour "A colour
        to tell cards apart", Image "A picture, like a mock-up or a photo") and **Linked cards** (Link to Card
        "Another card, like a parent or an epic", Calculated "Worked out from linked cards or a formula"). Each group's
        header is a button (`aria-expanded`) with the group's name, how many kinds it lists and a chevron. While a
        search is typed the accordion steps aside: every group with a match shows open, listing only its matches
        (its count then the matches'), and a group with none is hidden; clearing the search brings the accordion
        back as it was.
      - **Comments** and **Votes** open Shape as every kind does: **Ready to use** offers the built-in while the
        type lacks it, then a field of your own takes only its name (Votes land on the card).
      - A kind whose built-in field the type lacks carries a quiet **Ready to use** tag after its name (Date while
        the type lacks Start Date or Due Date, Person while it lacks the Assignee, and so on).
      - When the type holds the most custom fields it can (12), a note heads the list: "This type holds the most
        custom fields it can (12). Remove one to add another." A kind with a built-in field the type lacks stays
        open (its Shape offers only that field); every other kind is shown dimmed and can't be pressed.
      - **Keyboard**: ↓ from the search moves to the first result; ↑ and ↓ move through every result in order (the
        group headers, the kinds), Home and End to the first and last, ↑ from the first back to the search; Enter
        or Space presses the one focused; Enter in the search, with a search typed, picks the first match. Escape
        in the search clears a typed search first, then closes the popover.
    - **Shape** (step 2, after a kind is picked): a header with **All kinds** (a left chevron; back to Pick with
      the search as it was, focus on the kind that was picked) and the kind as a pill (its icon and name, read as
      "Kind: Choice"); then, when the type lacks a built-in field of this kind, **Ready to use**: a row per such
      field (its icon, its name and what uses it: Assignee "Notifies them, and fills My Work and Workload", Labels
      "Filters, swimlanes and coloured chips", Colour "A dot on the card, and its bar on the Gantt chart", Checklist
      "Progress on the card, like 2/5", Start Date "Where its bar starts on the Gantt chart", Due Date "On the
      calendar and the Gantt chart", Estimate "Story points, summed in Workload", Priority "Urgent to Low, for sorting
      and swimlanes", Description "The card's main notes, with rich text", Comments "Threads on the card, and
      mentions in the Inbox", Votes "Session votes, Top Voted and sorting", and under Image, Attachments "Pictures on
      the card, and its cover"), each ending in a plus; one press adds that
      built-in field, keeping its id, and closes the popover. Then, under a rule reading **Or make your own** (only
      while Ready to use shows), **Name** (a labelled field, focused, "Field name" as its placeholder); then only what
      that kind needs: for Choice and Multiple Choice **Options**, a list of option rows (each a field named "Option
      1", "Option 2", … with a remove cross; one empty row to start), **Add an option** (a dashed row, "or paste a
      list" beside it), Enter in a row adding a row after it, Backspace in an empty row removing it, and pasting
      several lines into a row adding one option a line (blanks dropped, at most 20); for Rating **Scale** ("Out of
      3" to "Out of 10", 5 first chosen); for Currency **Currency** (a select of the common codes, GBP first); for Duration **Track Time** (a switch, off, its line
      "A start/stop timer on the card, adding up everyone's time."; [Time Spent](#time-spent)); for Date Range **Include
      Time** (a switch, off, its line "Each end has a time of day too. Chosen once: it can't change later."); for
      Link to Card **Links To** its card types (at least one); for Calculated **Calculation** (the menu below, the
      first chosen; a Rollup's and a Lookup's own menus, [Rollup and Lookup](#rollup-and-lookup-fields)) and, for
      Children Done or a Formula, Rollup or Lookup with a Percent result, **Show as Percent Bar** (off); then **Required** (where the kind may be required: never Checkbox, Calculated, Image, Comments or Votes); then
      **Preview**: a small card as a board's card panel draws it, "Example card" over the field's row: its name as
      typed ("Field name" until then, with the required mark when Required) beside a sample value of its kind
      (Choice its first option, Multiple Choice its first two, Link to Card the linked types' names, "Project or
      Epic", Rating stars out of its scale, Currency in its currency, Percent its bar at 40% and "40%", Duration "2h 30m" (with Track Time on, a Start
      button beside it), Date and Time "Fri 31 Oct, 17:00", Date Range "31 Oct to 2 Nov" (with times "31 Oct, 09:00 to 2 Nov, 17:00"), Phone "+44 20 7946 0958", Calculated "3" or "40%" (the Percent bar when Show as Percent Bar is on), Person a person's
      disc and name, Labels two label chips, Colour a swatch and its name, Checklist "2/5", Image a picture glyph and
      "photo.png", Votes "▲ 3"); updating as you
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
