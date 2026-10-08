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
- **Restore Built-In Types** puts the five built-in types back as they started (any deleted come back, any edited
  lose their edits), after a confirmation ("Project, Task, Note, Idea and Action go back to how they started. Your
  own types stay as they are."). The document's own types are kept, after the built-ins, unchanged; with none,
  the stored catalogue is removed.
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
| `defaultStatus`    | The **Default State**: the status (id) a card of this type is made in when nothing else gives it one. Absent: none                                                                                                                              |
| `display`          | What its cards show at each **card size**: `{ minimal?, compact?, detailed? }`, each a list of card fields (Number, Type, Assignee...) that size can draw. A size left out takes the type's default                                             |

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
  those keep today's rule: New {Type} takes the first status its type uses on the tab's boards, and an API or MCP
  card with no status is made with none, so it waits as **not on board**. A Default State the type has turned off
  (in `excludedStatuses`) is ignored, as if absent; turning the Default State off in the editor clears it. An id no
  board names any more is kept: the card is made in it and shows as not on board until a board adds that status.
- **A built-in type's Default State** is a state _name_, since a document's state ids are its own (`todo~k3f9`):
  **Project** starts in **Backlog**; **Task**, **Action** and **Note** in **To Do**; **Idea** in **Ideas**
  (`BUILT_IN_DEFAULT_STATE_NAMES`, by type id, so it holds for a built-in type stored in a document's catalogue
  too). The editor resolves it to the document's state of that name (as names compare: "To do" and "TO DO"
  match) when it makes a card, and when none has that name (or the type turns it off) it falls back as a type
  without one does. A Default State chosen in the editor replaces it. The API and MCP do not see state names, so
  there a built-in type's card made without a status is made with none, as before.
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
- A type holds up to **24 fields** and up to **12 custom fields**, Parent not counted (it was a built-in field, so a
  type already at 12 keeps reading and saving once it gains Parent). A catalogue holds up to **32 types**.
- **Custom field kinds**: Text, Long Text (up to 2,000 characters), Number, Date, Checkbox, Link (an `https://`
  URL), Choice (one of up to 20 named options) and Card (a link to one card of another type, below). Every value
  is a plain string, number or true/false, which the
  item store keeps for any field. People are assigned with the built-in Assignee field, so there is no custom
  person kind. Their values are ordinary entries in the item's `fields`, under the custom
  field's id (`f-` and a slug of its name), so the store, agents and exports already carry them.
- **Card fields** link a card to one other card, of the card type the field names (`linkType`): an Objective's
  **Owner** links to a Person. The value is that card's id. **Parent** is one of them: Task (and the Bug and Story
  types a board preset brings) carries a Card field named **Parent**, linking to Projects, under the one custom id
  without `f-`, `parent`, so every card made before keeps its parent. Like any custom field it can be renamed,
  linked to another type or removed, and another type can add one. A document whose stored catalogue named
  `parent` as a built-in field reads it as this Card field. Every Card field uses one control and one way of listing
  what links where:
  - **The control** (the card panel): one bordered field the width of its row, showing the linked card's type
    glyph in its colour, its own colour dot when it has one, its number as a quiet tag and its full title (cut only
    at the field's end, the whole "#1 Title" in a tooltip), a chevron, and an open arrow at its end (inside the
    same border, tooltip "Open #1 Title") that opens the linked card in the panel. Empty, it reads **None**,
    muted; a link whose card is gone reads **Missing card**. Pressing it (or Enter, Space or an arrow key) drops
    a list under it: **None**, then the live cards of the linked type in number order (never the card itself, nor
    a trashed or archived card), each with its glyph, number and title; with more than 8 a filter leads the list
    (by number or title). The arrows move, Enter picks, Escape closes the list (not the card), and a press outside
    closes it. Its accessible name is the field's ("Parent", "Owner").
  - **On the linked card**: for every Card field that links to the card's type (Parent included: a Project's
    "Linked as Parent" lists the cards under it), a **Linked as {Field}** section ("Linked as Owner") listing the cards
    pointing here (glyph, number, title, Archived, status, assignee; pressed, each opens), its count, an empty
    note ("No cards link here as Owner yet."), and **New {Type}** for each type whose field links here: it makes
    a card of that type already linked, in its type's Default State (else the first status its type uses), and
    opens it. These sit on the type's first tab, before Comments.
  - **Filtering them**: a Linked as section whose cards hold more than one card type or state has a
    filter row above its list: a **Card Type** menu ("All card types", then each type the list holds) when it holds
    more than one, and a **State** menu ("All states", then each state it holds, "No status" last) when it holds
    more than one; both start at All, are each viewer's own and unsaved, and while one narrows the list "N of M"
    shows beside them. A filter matching nothing says "No cards match." with **Clear Filters**.
  - **On the card face**: a Card field placed by the type's Display reads its linked card's title with the linked
    type's glyph, in its colour.
  - **Boards** can lay their rows by a Card field (Swimlanes by a field): a row per linked card (named by its
    title, in number order) and **No {Field}**; dropping a card into a row sets the link.
  - Deleting, trashing or archiving a linked card never clears the links: they read **Missing card** until the
    card is back or the link is changed. A Card field whose type is gone from the catalogue keeps its `linkType`.
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
- **Edit Cards** opens it too: a button at the foot of the palette's Cards category (floating layout), and at
  the end of the Toolbar layout's strip while Cards is chosen.
- The panel is 34 rem (544 px) wide on desktop, two types to a row; on a phone the screen's width less a margin,
  one to a row. It lists the
  catalogue in two groups under small headings: **Built-In Types** (Project, Task, Note, Idea and Action, edited or
  not; with every built-in deleted, the group and its heading go) and **Your Types** (the ones this document added, in the order they were added; before there are any, the
  group says "Types you add show here." to someone who may edit).
- The panel lists the catalogue as small cards: each type's accent stripe, its glyph on a tint of its colour,
  its name with "N fields" (and "N custom") under it (no count badge: a type no card has yet is drawn a little
  grey, and the count is in its accessible name only), a **Duplicate** button (a copy
  icon, with a tooltip) and a pencil. A press anywhere on a row (or Enter on it) opens the type editor.
  **Duplicate** opens the type editor as a **new** type filled from that one: its name with " copy" (then
  " copy 2", " copy 3"... while the name is taken, shortened to fit 32 characters), and the same colour, glyph,
  fields, custom fields, tabs and Details name. Nothing is made until **Save**; **Cancel** drops it. With the
  catalogue full it is disabled and its tooltip says "The document has the most card types it can hold".
  The type editor's footer offers **Duplicate** too, for a type that exists. Telemetry: `Plan` ·
  `Duplicated` · `CardType` when a duplicate is saved. **Add Type** is a dashed tile at the end, with **Restore
  built-in types** under it once the catalogue is stored. The panel does not reorder types: the catalogue keeps
  its order (the built-ins first, then added types in the order they were added).
- Someone who may only view the document sees the list without the edit and add controls.

## Add New Card Type

- Wherever a card type can be added (the Card Types panel, a board's Add a Card menu, Setup Board) it is the same
  control: a full-width dashed row, a plus and **Add New Card Type**, quiet until hovered, when it takes the brand
  colour (border, tint and text). On a board it wears the board's colours; in a menu it is one of the menu's items.

## Card display

- A card face is drawn at its board's **card size** (Minimal, Compact or Detailed; [Plan board](plan-board.md#the-board-set-up)).
  What it shows at that size, and where, is its **type's Display** for that size, each field only when the card has
  a value for it. A board has no say over the fields (its old Show on Cards setting, kept in stored set-ups, is
  ignored).
- A Display only ever holds the **fields the type has** (Number and Type always): a new type's default places only
  its own fields (a type without a default of its own starts from every field a size draws, less the ones it lacks),
  and a field taken off the type leaves the card, and its Display preview, at once.
- Each size draws its fields in **slots**, each holding fields in order:
  - **Minimal**: **Before the Title** and **After the Title**, on its one line; it can draw Number, Priority, Due Date
    and Assignee. A built-in type's Minimal card shows none of them by default; a type of the person's own starts
    with its Number Before the Title and its Assignee After the Title (when it has one).
  - **Compact**: **Beside the Title** (before it), **Below the Title** (one row) and **Bottom Right** (that row's
    far end); it can draw Number, Type,
    Assignee, Priority, Start Date, Due Date, Votes and Comments.
  - **Detailed**: **Header** and **Header End** (one row above the title, at its start and its end), **Under the
    Title** (its own lines), **Footer** (one row at the foot) and **Bottom Right** (the footer's far end); it can
    draw every card field. Any field goes in any
    part of a size that draws it; the person chooses where.
    A type's Display is, per size, which fields sit in which slot (`display: { compact: { lead: ['key'], row: ['due']
} }`); a field in no slot is not shown.
- **Defaults**, for a size a type has not set:

  | Type                                        | Minimal    | Compact                                                       | Detailed                                                                                          |
  | ------------------------------------------- | ---------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
  | Project                                     | title only | Number, Type, Assignee, Priority, Start, Due, Comments        | Number, Type, Assignee, Priority, Labels, Start, Due, Checklist, Comments, Description            |
  | Task                                        | title only | Number, Type, Assignee, Priority, Due, Comments               | Number, Type, Assignee, Priority, Labels, Estimate, Due, Checklist, Comments, Description, Parent |
  | Note                                        | title only | Type, Votes, Comments                                         | Type, Votes, Comments, Description                                                                |
  | Idea                                        | title only | Type, Votes, Comments                                         | Type, Labels, Votes, Comments, Description                                                        |
  | Action                                      | title only | Number, Type, Assignee, Due, Comments                         | Number, Type, Assignee, Due, Checklist, Comments, Description                                     |
  | Any other (Bug, Story, a type someone adds) | title only | Number, Type, Assignee, Priority, Start, Due, Votes, Comments | every card field                                                                                  |

  Each default places its fields where they read best: Number and Type at the start (Beside the Title, or the
  Header), Priority at the Header End, Parent, Description and Labels Under the Title, the Assignee at the
  **Bottom Right** (Compact and Detailed; last After the Title on Minimal), the rest Below the Title or in the
  Footer. A built-in
  type's defaults are read from code by its id, so a document that stored its catalogue before Display
  existed gets them too.

## Editing a type

- **Add Type** and a row's edit open the **type editor**, a wide modal (60 rem, as the card panel; a sheet rising
  from the bottom on a phone) in four **tabs** under its title (one underline that slides to the chosen tab): **General**, **Fields**, **States** and **Display** (the tab's own word for the statuses
  a type uses; boards, cards and filters still say Status). Its title names the type as saved, "Edit {Name} Card
  Type" ("Edit Note Card Type"), or "New Card Type" for a new one. It opens
  on General. Arrow keys, Home and End move between the tabs. A tab holding what stops Save carries a small red
  dot (a clashing name is General's; a tab or custom field problem is Fields'; a missing name is not flagged, since
  a new type starts without one), and the problem is
  still named beside Save. The tabs edit one draft: switching loses nothing, and Save or Cancel acts on the whole.
  The title row ends with **Show Me**, **Help** (the Card Types help article) and a close cross, which acts as
  Cancel.
  - **Show Me** runs a guided tour of making a card type, there and then, on the editor itself; it is never offered
    or started on its own. It uses the shared tour (the step card, Back, Next and Skip, the ring around what it
    points at with room to breathe, drawn over the editor), and each step opens the editor tab it is about and points at a real
    control, which stays usable: the person types the name, picks a colour or adds a field while the step is up, and
    their edits stay in the draft. The steps: **Name It, Then Give It a Look** (the General tab's Name, Colour and Glyph together, the
    caret put in Name), **Lay Out Its Fields** (the Fields tab's layout), **Choose Its States** (the States tab),
    **Arrange the Card** (the Display tab), then **Save It** (Save), and a closing card with a link to the Card Types article.
    While it runs, Escape belongs to the tour (it never closes the editor). Telemetry: `UI` · `Started` ·
    `CardTypeTour`, and `UI` · `Ended` · `CardTypeTourCompleted` or `CardTypeTourSkipped`. Every
    button carries an icon: Save a tick, Cancel and the cross a cross, Delete a bin, Duplicate the copy
    icon, Back a left chevron, Add Field, Add Tab and Add Custom Field a plus.
  - **General**: **Name**, one field holding the glyph and the name (no Glyph row of its own): at its start the chosen
    glyph on a tint of the type's colour with a small chevron (named "Glyph: {Name}"), then the name typed after it,
    the field no wider than a 32-character name needs; and **Colour** (the twelve swatches, then **+** for a custom
    colour, which opens the custom colour picker in place (as in [Draw](../023-draw-mode/draw-mode.md)); a custom
    colour in force shows as a picked swatch before the +). The glyph opens a popover under it (above it when there is no room below), drawn over the editor so its
    scrolling body never clips it: **Search
    glyphs** (focused on open) and, on the same row, a **Glyph category** menu (**All glyphs**, then the eight
    categories: **Work**, **People**, **Communication**, **Planning**, **Ideas and Notes**, **Status and Signals**,
    **Business**, **Things**; it opens on the chosen glyph's), over one dense grid of that category's glyphs, small borderless tiles ten to a row, each with its name
    as a tooltip, the chosen one tinted and ringed in the type's colour. A search covers every category (the menu
    shows All glyphs), by a glyph's name and a few keywords each ("money" finds Coin and Wallet); with no match it says "No
    glyphs match “…”.". A pick closes the popover and hands focus back to the button, as do Escape (the editor
    stays open) and a press outside. One radio group, each tile named "{Name} glyph", the chosen one pressed as before.
  - **Fields**: the Fields and Tabs list below. **States**: the type's statuses (below).
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
    is always on this type"). The icon is the Add Field kind tiles' own (a custom field's kind: Link to Card a card;
    a built-in field the kind closest to it: Due Date a calendar, Estimate a #, Checklist a checkbox, Status,
    Priority, Colour and Labels a list, Title text, Description and Comments long text, Votes a #), the Assignee a
    person; its tooltip and accessible name name the kind ("Link to Card", "Date", "Person"). Dragging the handle (mouse, pen or touch alike) moves the field
    within its group: the row follows the pointer, the rows it passes slide aside, release places it and Escape
    puts it back. Title, Status and Votes have no handle, and every row keeps its slot so the names line up.
    The row ends with a custom field's **Edit** (a pencil), which opens its name, its options (Choice), its
    **Links To** (Card) in its row, and a **⋯** menu headed by the field's name: **Move
    Up** and **Move Down** (the keyboard's way to reorder), **Move to {group}** for each other group (Details
    first, then the tabs) and **Remove** (absent for a field the type always keeps). Title has no menu.
  - Each group ends with **Add Field**, a full-width dashed row (as **Add Type** in the panel), which opens a
    popover anchored to it (24 rem wide, over the editor, so it is never squeezed by the Details column), which offers the built-in fields the type lacks as chips, and **New
    Custom Field**: a name, then its kind as a grid of eight icon tiles, four to a row (Text, Long Text, Number,
    Date, Checkbox, Link, Choice, **Link to Card**; one radio group), then the options, one a line, for Choice, or for
    Link to Card **Links To** a card type (required), and a **Preview** of the field as the card's panel will show it:
    its name as typed ("Field name" until then) beside a sample value of its kind (Choice shows its first option,
    Link to Card the linked type's name). The field lands in that group
    (Votes always on the card). **Add Tab**, the same full-width dashed row under the groups, adds an unnamed tab.
  - **States**: every status the document's boards name, and any a card is in that no board names, grouped by the
    board that shows it: a group per board (All Cards and Archive boards aside), headed by the board's title as it
    is now (so a renamed board reads its new name) with "N of M states on", holding its statuses in column order (a status
    on two boards shows in both, and ticking it in one ticks it in both, as it is one status), then **No Board** for
    any status no board names. Each group is a grid of checkbox rows (three to a row on desktop, two on a tablet,
    one on a phone), each ticked while the type uses it (all ticked to start), with "N of M states on" and
    **Select All** and **Deselect All** above them (each disabled when it would change nothing). Unticking one
    leaves it out; Select All turns every listed status back on (a left-out status no board lists any more stays
    left out); Deselect All turns them off in board order as far as the cap allows. All may be off, and then a note
    says a card of this type stays in the state it is made in and can never be moved to another. With no columns
    on the tab's boards it says there are no states to choose from. At most 64 may be off: then every status still
    on is disabled, and a note says "A type can turn off at most 64 states. Turn one back on to turn off another."
    Under them, **Default State**: a menu of every state still on, each once and by its own name, in board order,
    after **None** (left out for a built-in type whose named state the document has: that state shows picked until
    another is chosen, and a pick is saved as picked), with a line saying
    "Cards made outside a board start here; a card added to a board takes that column's state."
  - **Display**: the card sizes as a segmented control (**Minimal**, **Compact**, **Detailed**; Compact to start; its
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
    without a name or a Choice without options, a tab without a name, or two tabs with one name, or more than 64
    statuses off (a type stored that way: "Too many states turned off: a type can turn off at most 64.", on the
    States tab).
  - **Delete** (one word, as is **Duplicate**, so a phone's footer keeps each on one line), at the foot, for a type that is not the catalogue's last.
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
  tile a small card with the type's colour stripe and its glyph on the face, and lands it in a board's column as the built-in ones do.
- **Cards** draw a type's colour (behind the card number) and glyph (an item's own [Colour](items.md#colour) is a dot beside them,
  never in their place); the item panel's type picker lists the catalogue; the Add a
  Card popover offers the types the board shows, and its title field's `name:` prefix matches a type's name
  (`customer call:` too).
- **A board's rows By Card Type** follow the catalogue's order and names.
- **Agents** read the catalogue with `list_items` and change it with `change_card_types`, naming types and fields
  as people do ([Plan for agents](plan-agents.md)); an agent naming a type the catalogue lacks is refused. An item
  stored with a type the catalogue lacks (made before that rule, or whose type was deleted) draws as "Item".

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
