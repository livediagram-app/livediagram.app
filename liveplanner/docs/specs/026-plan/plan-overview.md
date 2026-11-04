# Plan Overview

Every plan has an **Overview**: one page that says what the plan is, what is in it and what has happened in it
lately. It is the first entry in the tab bar, with a home glyph, before a divider and the plan's own tabs. It shows the
plan's name, description, who made it and who works on it; a tile for each tab showing a real preview of the tab as it
looks; a tile for each card type and where it is used; and the plan's recent activity.

## Domain language

| Term                   | Meaning                                                                                         | Not                    |
| ---------------------- | ----------------------------------------------------------------------------------------------- | ---------------------- |
| **Overview**           | The plan's built-in page, reached from the tab bar's first entry                                | home tab, summary tab  |
| **description**        | The plan's short text saying what it is for, edited in place on the Overview                    | notes, about, subtitle |
| **tab tile**           | One tab on the Overview: its preview, name and a line naming its kind and size                  | card, thumbnail        |
| **card type tile**     | One card type on the Overview: glyph, name, fields and cards, and the tabs whose boards take it | type card              |
| **activity**           | What people did to the plan's cards, newest first, as the item store records it                 | history, log, timeline |
| **people on the plan** | The plan's owner, everyone who made or last changed one of its cards, and anyone here right now | members, collaborators |

## A built-in page, not a tab

The Overview is part of every plan, not a tab stored in it.

- **Why**: a tab kind would have to be written into every existing plan (a migration over every stored plan, every
  offline copy and every exported file), and a tab can be deleted, renamed, duplicated, locked, moved into a folder,
  exported, copied into another plan, opened by a tab-scoped share link and changed by agents. None of that fits a
  page that describes the whole plan. As a page the editor draws from what it already holds, every plan, old and new,
  has it at once. The one thing stored about it is its style (see "Style"), kept with the plan as its description is.
- It has no element and never appears in the tab list agents, exports or Search read. Its edits (the name, the
  description, its style) take their turn in the editor's undo as any tab's do.
- It cannot be deleted, renamed, duplicated, locked, reordered or moved into a folder: its entry in the tab bar has
  no menu and cannot be dragged, and no tab can be dropped before it.
- **Opening**: pressing **Overview** in the tab bar opens it in the canvas's place; its entry is then the open one
  (the strip's sliding card moves to it) and no tab is. Pressing any tab (in the bar, on a tab tile, from Search, a
  link, a new tab) opens that tab and closes the Overview. The tab that was open stays the plan's open tab underneath:
  pressing it again opens it as it was.
- **A plan opens on its Overview**: opening a plan from the Explorer, recents, Start, a plain `/project/<id>`
  address or any flow that lands on an existing plan shows the Overview first, never the canvas; the plan's open tab
  underneath is its first tab, so pressing it (or any tab) closes the Overview as usual. A plan does not reopen on
  the tab last visited.
- **It opens on a tab instead when**:
  - the address names one (`#t=<tab id>`): a shared tab link, a card link, a Search or notification deep link. A
    named tab that is not in the plan (deleted, or outside a link's scope) opens the Overview;
  - the page is reloaded on a tab: the address carries the open tab (`#t=<tab id>`), so a reload keeps the person
    there;
  - it is an embed or a session confined to one tab, which have no Overview;
  - the plan was just made (from `/new`): its empty first tab opens on Start Planning, the first-run guidance a new
    plan needs ([New project route](../007-editor/new-project-route.md)), and a template's board opens as it was
    chosen. Reopened later, it opens on its Overview like any plan.
- **Its address**: while the Overview is open the address reads `#overview` in the tab pin's place, so a reload,
  Back and Forward come back to it, and a link with `#overview` opens it. It is written over the current entry as
  the tab pin is (switching between the Overview and tabs adds no history entries). A card opened over the Overview
  takes its own address (`#t=<tab>&item=<card>`) on a new entry, as on a tab, so Back closes it and the address is
  `#overview` again. Back or Forward onto `#overview` opens the Overview; onto a tab's pin with the Overview open,
  opens that tab.
- **Where it is not**: an embed and a session confined to one tab (a tab-scoped share link) have no Overview, as
  they see one tab; the bar there is as before.
- While the Overview is open the canvas under it is not drawn, and nothing on it changes from the keyboard (as when
  a board covers the canvas): undo, redo, Search and Escape still work.

## The tab bar

- **Overview** stands first in the strip, its home glyph before its name, then a thin divider, then the tabs and
  folders as before, then Add tab. It is a tab in the strip's toolbar (one Tab stop, reached by the arrow keys like
  every tab), drawn by the same tab shape, never dimmed, with no avatars and no menu button.
- Its hover card (only when its name is cut short, as for any tab) is not needed: the name is never cut. It is named
  "Overview" for a screen reader, `aria-current="page"` while open.

## The page

One column of three bands on a phone, and on a wider screen the header across the top over two columns: the Tabs and
Card Types sections on the left, Recent Activity on the right (380 px wide). The page scrolls as a whole; it is
drawn in the Overview's style (see "Style"), by default its first tab's.

**Bands**: each section is a band of its own, so they stand apart at a glance.

- The bands alternate: Tabs on the page's own backdrop, Card Types on a soft wash of the accent (the theme's, so it
  follows every theme, light and dark), with a hairline of the accent at its top and bottom edges. Each band runs
  the full width of its column, with generous room above and below (32 px on a phone, 40 px wider).
- Below 1024 px Recent Activity is the third band, back on the backdrop, so the three read plain, washed, plain.
  From 1024 px it is a side panel the full height of the content: a quiet raised surface (white, or the dark
  surface, a little see-through over the backdrop) with a hairline on its left, beside both bands.
- Each band opens with its heading and a short muted line under it: Tabs, "Every tab in this plan"; Card Types,
  "The kinds of card this plan uses"; Recent Activity, "What people did to cards lately".
- The last band (and the panel) keeps room at its foot for the dock.

### Opening

- Each time the Overview opens (from the tab bar, the address, or a plan opening on it) its content rises in: the
  header's text first, then its people with the Tabs and Recent Activity headings, then the tab tiles one after
  another with the Card Types heading, then the card type tiles; Recent Activity's entries fan in as that section
  says. Each piece fades and rises a few pixels, a beat (25 ms) after the one before, all of it settled within a
  quarter second (the motion budget's ceiling: a longer, half-second entrance was considered and is out of budget).
- Only the content moves, by opacity and transform: the bands' surfaces stand still and nothing shifts the layout.
- After it settles nothing animates again while the page stays open: re-renders, live changes and tiles added later
  appear in place (apart from a new activity entry, which slides in).
- A tab's preview that is drawn after the tile is up fades in over its loading sweep, once; it never pops.
- Under reduced motion it all simply appears.

### Header

- A band across the top, drawn in the Overview's theme (Style below) the way a board's header is: its paper, ink, muted
  ink and hairline are the board colours a board on a tab in that theme takes; its accent (the board's focus colour)
  washes in from the leading edge and colours the eyebrow; a 4 px rule along its top is the accent, or a multicolour
  theme's branch colours in order, and a multicolour theme also washes its trailing edge in its last branch colour.
  Every word on it reads at 4.5:1 or better on the paper and on either wash, in every theme and in light and dark (an
  ink, muted ink or accent that would not is leaned toward the ink until it does). Switching theme restyles it. It
  holds the eyebrow **Plan Overview**, the plan's name as the page
  heading, its description, and a line: **Created by {owner} on {date} · Edited {when}**.
  - No owner name known: **Created on {date}**. No creation date known (a plan never saved to the server): the
    created part is left out. Edited is the latest of the plan's last save, this browser's last save and the latest
    card change; none known: left out.
  - Dates read as "14 Oct" in the current year and "14 Oct 2025" otherwise; Edited reads relatively ("8 minutes
    ago", "Yesterday"), the exact moment on hover.
- **No description**: an Editor sees a quiet **Add a Description** button in its place, which starts editing the
  description in place; anyone else sees nothing there.
- In the band's bottom right corner, level with the dates line (on a narrow screen, on a line of its own, still
  on the right): **people on the plan** in a row, each a disc (initials on their colour) with their name under it, cut
  short to the disc's column with the full name on hover. At most five (three on a phone), then a **+N** disc
  labelled **More** that names the rest on hover. People are told apart by their id; the plan's owner first, then by
  their latest change, newest first.
- There are no buttons in the band: the name and description are edited where they stand (below), and sharing is
  the app header's Share, always in view above the Overview.

### Editing in place

For an Editor (whoever may edit the whole plan) the name and the description are edited where they are shown; anyone
else sees them as plain text.

- **Showing they can be edited**: on hover (and keyboard focus) each takes a soft background and a small pencil, with
  a tooltip, **Rename** on the name and **Edit Description** on the description. Each is a focusable control.
- **Starting**: a click, or Enter or F2 while focused, turns the name into a field of the same size and weight (the
  page does not move) and the description into a text box that grows with its lines. **Add a Description** starts
  editing an empty description.
- **Name**: Enter or leaving the field saves; Escape puts it back. An empty name is refused: the old name stays.
  Capped as names are ([Name length](../006-project/name-length.md)). Saved as the header's rename is.
- **Description**: Cmd or Ctrl + Enter, or leaving the box, saves; Enter starts a new line; Escape puts it back. At
  most 500 characters (the box stops there), with a count once past 400. Line breaks are kept; leading and trailing
  space is trimmed.
- Both show at once. A description that cannot be saved (offline, refused) shows "Couldn’t save the description" as
  a toast and goes back to what it was.
- **Undo**: a saved name or description is one step in the editor's undo, in turn with every other change (cards,
  tabs, card types), from the dock, the keyboard or the menu. Undo puts the earlier one back and saves it, Redo the
  later one: the name as the header's rename saves it, the description with a new write (the server keeps no
  history to step back through). An undone description that cannot be saved toasts "Couldn’t save the description"
  and stays as it was. Pressing Cmd or Ctrl + Z inside a field still undoes typing in that field.

### Tabs

- Headed **Tabs**, with nothing beside the heading: the Add Tab tile (below) is the one way to add a tab here.
- A grid of tab tiles, each at least 220 px wide, as many across as fit (five on a wide desktop, two or three at
  700 px, one on a phone), one per tab in the plan's order, folders flattened. A tile is a button: pressing it opens the tab.
- Each tile: a **preview** of the tab (16:10), then the tab's name (one line, cut short with its full name on hover)
  and a line naming its kind and size:

  | Tab                                           | Line                    |
  | --------------------------------------------- | ----------------------- |
  | Board tab                                     | Board · {n} Cards       |
  | A plan view filling a tab (Visualisation tab) | {View name} · {n} Cards |
  | Sheet tab                                     | Sheet                   |
  | Dashboard tab                                 | Dashboard · {n} Slots   |
  | Form tab                                      | Form · {n} Questions    |
  | A tab not started                             | Not Started             |

  A board's count is the cards it shows (its statuses and the card types it takes; trashed and, except on an Archive
  board, archived cards left out); a view's is the cards it reads.

- **The preview** is the tab itself, drawn as it looks in its own theme and backdrop, in the viewer's light or dark:
  a Board tab its board (columns, swimlanes, cards with their faces), a Sheet tab its cells, a Dashboard tab its rows
  and widgets, a Form tab its form, any other tab its drawing. A Board or Sheet tab is drawn as a 960 × 600 window
  would show it (small enough that a 220 px tile still reads its cards), a Dashboard tab its page 1440 px wide from
  the top, a Form tab its form; each scaled down to the
  tile from the top left (a form centred). The Overview never has a renderer of its own: a Board or Sheet tab is
  drawn by the very view its tab draws (as a Dashboard slot draws one), every other tab by the picture its image
  export draws (plan-tabs.md "Export").
- A preview is a still picture: nothing in it can be pressed, focused, read out or animated, it sends no presence and
  writes nothing. It is drawn again only when what it shows changes (the tab, its cards, its Sheets' cells), never
  for a cursor or another tab.
- **Not started**: the tab's paper with "Nothing on this tab yet".
- Every tile in view shows its own preview at the same time and keeps it. A preview that fails as it draws shows
  "Couldn't load preview" in its own tile; the rest of the Overview carries on.
- A tab whose content has not arrived yet (tabs load as they are opened) shows the loading sweep and its line as
  **Loading…**. Opening the Overview asks for every tab not yet loaded, once, as Search does; a tab whose load fails
  shows "Couldn't load preview" in its preview and opens as any tab does (with its own Retry).
- **Add Tab** (a dashed last tile): an Editor's, as the tab bar's +. It adds a tab and opens
  it on Start Planning, closing the Overview.
  - The tile is the size of a tab's tile: a calm dashed tile, a plus in a soft brand circle over **Add Tab** and
    "Board, Sheet, Dashboard or Form" where a tab's preview is, and under it, where a tab's name is, a small icon
    chip per kind (**Add a Board**, **Add a Sheet**, **Add a Dashboard**, **Add a Form**, each named on hover). A
    chip adds a tab and opens its Start Planning on that kind's category; the rest of the tile is Add Tab. On hover
    the tile's border and wash brighten; nothing in it moves.
- **One tab**: its tile and the Add Tab tile. There is always at least one tab.

### Card Types

- Headed **Card Types**. A grid of card type tiles as wide as the tab tiles (about 300 px each: three or four across
  on a wide screen, two at 700 px, one on a phone), in the catalogue's order.
- Each tile, top to bottom:
  - **Its title**: the type's chip, the very one a board's header shows for it (plan-board.md "Card type chips": the
    small card in its colour with its glyph, then its name), drawn a size larger.
  - **A sample card**: one of the type's own cards as a board draws it (the real card face at Detailed size), scaled
    down, the one changed most recently. A type with no cards shows an example card instead, filled with placeholder
    values in each of its fields (as the card type editor's Display draws it), marked "Example". The sample is a
    picture: nothing in it can be pressed, focused or read out.
  - **Its fields**: a small chip per field the type offers (its kind's icon and the type's own name for it, built-in
    and custom alike), the title left out, at most five, then "+{n} More" naming the rest on hover.
  - **Its cards**: "{n} Cards" ("1 Card", "No Cards Yet"), and, when the type has a Due Date field and some of its
    cards are past due and not in a done column, "{n} Overdue" in red. Under it a thin bar split by status: a
    segment per status its cards are in, as wide as its share, in the column's colour (else grey for a first column,
    the brand colour for one in progress, green for a done one), each naming its status and count on hover
    ("Fixing: 4 Cards"). Trashed cards are never counted; archived ones are, in their status.
  - **Where it is used**: "On" and a small link per Board tab whose board takes it (up to three, then "+{n} More"),
    each opening that tab. A board takes a type when it names it among its card types or names none (and is not an
    Archive board). No board takes it: "Not on any board yet" in amber, and for an Editor **Add to a Board**, which
    adds the type to the plan's one board that names its types, or, when there are several, opens a small menu of
    them to pick from. A plan whose every board takes every type never reaches this.
- **Quick actions**, an Editor's, in the tile's top right on hover and keyboard focus (always shown on a touch
  screen): **Edit Card Type** (the type editor on the type), **Add Field** (the type editor on the type with its Add
  Field gallery open on Details) and **Add Card** (a card of the type added to the first board that takes it, as that
  board's header chip adds one, then opened to be named; left out when no board takes it). Each is a small icon
  button with a tooltip.
- Anyone else sees the same tile with no quick actions and no Add to a Board; the tab links still open their tabs.
- **Add Card Type**: a dashed last tile, an Editor's, drawn as the Add Tab tile is (a plus in a soft brand circle
  over its name), opening the card type editor on a new type (as the Card Types panel's Add New Card Type). Left out
  once the plan holds the most card types it can.
- **No card types**: "No Card Types Yet", with "Add a card type to give cards their own fields." for an Editor (and
  the Add Card Type tile), "This plan has no card types yet." for anyone else.

### Recent Activity

- Headed **Recent Activity**: a vertical rail of entries, newest first, eight shown; **See All** shows up to 30, then
  reads **Show Fewer**. Nothing past 30 is ever listed.
- An entry: the person's disc (their initials on their colour) with a small badge naming what was done (a plus for
  added, an arrow for moved, a pencil for changed, a bin for deleted, a sparkle for the plan made); then "{Person}
  {did what}" with the person and the card's title in bold; under it the card's type chip (as Card Types draws it,
  small) and, for a move, the column it went to as a pill after an arrow; then "{where} · {when}", the exact time on
  hover. The plan records only where a card is now, not where it came from, so a move names its new column alone.
  What can be said honestly from what the plan records:

  | Recorded                                  | Entry                          | Where                                                |
  | ----------------------------------------- | ------------------------------ | ---------------------------------------------------- |
  | A card made (its created time and author) | added {card title}             | The first Board tab whose board shows it, else Cards |
  | A card's last change that was a move      | moved {card title} to {Status} | as above                                             |
  | A card's last change otherwise            | changed {card title}           | as above                                             |
  | A card in the Trash                       | deleted {card title}           | Trash                                                |
  | The plan made                             | created the plan               | Plan                                                 |

  A card shows at most two entries (made, and its last change). A change counts as a move when the card's status
  stamp (`statusSince`) is the moment of its last change and that is later than when it was made.

- The plan's own setup (the plan made) is a **setup** entry: its badge is the brand colour; card entries' badges
  are a quiet slate.
- **By day**: entries are grouped under **Today**, **Yesterday** or the date ("14 Oct", with the year when not this
  one), along a thin rail. Entries in a row by the same person show their disc once; the rest sit under it.
- **Motion**: when the Overview opens, and when See All shows more, the entries fan in: each fades and rises a few
  pixels (settling from a touch smaller), one beat (about 14 ms) after the one above, the whole cascade inside the motion budget. An entry that
  arrives while the page is open slides in at the top. Under reduced motion they simply appear.
- An entry about a card is one button across the row: on hover it takes a soft background, it has the pointer and a
  focus ring. Card types, tabs, forms and sharing keep no record of who changed them or when, so the Overview lists
  none of those.
- Pressing an entry about a card opens the card.
- **No activity**: the empty state "No Activity Yet", "Changes to cards will show here, as people add and move them."
- An agent's change (a card's author marked as an agent) reads as its author's name, as the card's own history does.

## The dock

The Overview keeps the editor's bottom-right dock: the same cluster a Board tab shows, in the same place (its corner,
at the corner buttons' UI scale; on a phone, the row across the foot), drawn over the Overview. It shows what belongs
to the whole plan and leaves out what belongs to one tab:

| Button                   | On the Overview                                          | Why                                                      |
| ------------------------ | -------------------------------------------------------- | -------------------------------------------------------- |
| Undo, Redo               | For whoever has them on a tab (an Editor, a Participant) | Undo works here as on any tab                            |
| Trash                    | An Editor's, off a phone (in its More Card Tools on one) | The plan's Trash, as on a Board tab                      |
| Card Types               | Yes                                                      | The plan's card types, as on a Board tab                 |
| Find a Card              | No                                                       | Search finds any card; the page already lists the latest |
| Style                    | An Editor's                                              | Opens the Overview's Style                               |
| Timer, Vote, Collaborate | No                                                       | They belong to one tab                                   |
| Zoom, Fit                | No (Exit Zen stays while Zen is on, as its way out)      | The Overview is a page, not a canvas                     |

- Each button's panel opens above it over the Overview, as on a tab. The page leaves room at its foot so its last
  row never sits under the dock.

## Style

The Overview is styled as a tab is: the dock's **Style** opens the same panel a tab's does, headed **Overview
Style**, with its Looks and the Colours, Text and Canvas rows (Finish is left out: the Overview draws no elements).
Every pick shows at once; closing just dismisses.

- **What it changes**: the page's backdrop (its colour and pattern, as a Board tab shows its canvas; an animated
  pattern shows still), the accent (the theme's, which retints the editor's chrome as a themed tab does while the
  Overview is open), the font of the page's text, and its text size (Small, Medium or Large scale the page's text;
  an exact size reads as the nearest of the three).
- **Readable**: the page's surfaces (tiles, entries; the header band is drawn in the theme, Header above) keep the app's own light and dark colour pairs,
  the pair that matches the backdrop: on a dark backdrop the page reads as dark, on a light one as light, whatever
  the viewer's chrome, so every text pair is one the palette guards already pass. A theme's backdrop follows the
  viewer's light or dark as on a tab.
- **Default**: an Overview never styled wears its plan's first tab's style (theme, backdrop, font and text size) and
  follows it as that changes. The first change in Overview Style starts from it and keeps the Overview's own from
  then on.
- **Who**: an Editor (whoever may edit the whole plan). A Participant or Viewer sees the Overview in its style, with
  no Style button.
- **Undo**: each change is one undo step; a run of changes less than 0.4 s apart (a slider's drag) is one.
- **Saved** with the plan (see "The Overview's style" below) 0.4 s after the last change, so a drag writes once.
  A change that cannot be saved toasts "Couldn’t save the Overview's style" and goes back to what was saved.

## Share roles

[Share roles](../013-workspace/share-roles.md) apply to everything the Overview offers:

| Role        | Sees                                                                                                                                                                  | May                                                                                                                                                                                                              |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Editor      | Everything                                                                                                                                                            | Rename and describe in place; Add Tab; a card type's quick actions (Edit Card Type, Add Field, Add Card), Add to a Board, Add Card Type; open tabs and cards; Style; the dock's Undo, Redo, Trash and Card Types |
| Participant | Everything as plain text; no editing in place, Add Tab or Add Card Type, card type tiles without quick actions or Add to a Board; the Overview in its style, no Style | Open tabs and cards; the dock's Undo, Redo (its own changes) and Card Types                                                                                                                                      |
| Viewer      | As a Participant                                                                                                                                                      | Open tabs and cards; the dock's Card Types                                                                                                                                                                       |

The editor gates on the session's `can` (`can.level === 'edit'`) and, for Add Tab, on the tab structure being
writable (`isStructureReadOnly` false). The server refuses a description or style write from anyone who may not edit
the whole plan (`gateEdit`, never a tab-scoped grant).

## The description

- A plan's **description** is plain text, at most 500 characters (`PROJECT_DESCRIPTION_MAX`), empty by default. It is
  part of the plan, as its name and card types are: stored with the plan, read with it, and shown to everyone who can
  open it. A plan made before it existed has an empty one.
- **Stored** in the plan's own store (`plan.description`), written by `PUT /api/projects/:id/details` with
  `{ description }` for anyone who may edit the whole plan, which answers `{ description }` as stored (trimmed,
  capped). The project's read carries it (`description`). An offline plan keeps it in its browser record.
- **Live**: a write reaches every open editor of the plan as the room's `project-details` op (sent only by the api),
  so the Overview updates without a reload. A tab-scoped session does not receive it.
- A copy of a plan (Make a Copy, Duplicate) keeps its description. Exports, agents and the Explorer do not show it yet.

## The Overview's style

- The Overview's **style** is the part of a tab's style that a page can wear: `theme`, `backgroundPattern`,
  `backgroundColor`, `patternColor`, `backgroundOpacity`, `backgroundPatternScale`, `backgroundAnimationSpeed`,
  `font` and `defaultTextSize`, each as a tab holds it. None set (null) is the default: the first tab's.
- **Stored** in the plan's own store (`plan.overview_style`, JSON, null for none), written by
  `PUT /api/projects/:id/details` with `{ overviewStyle }` (null clears it), alone or beside `description`, for
  anyone who may edit the whole plan. Read through one normaliser (`readOverviewStyle`) on the api's write, the
  editor's save, the project's read and the room op: only the settings above, each checked (a known theme, pattern
  and font, a `#` colour, numbers in their sliders' ranges); anything else is dropped, and a style left empty is null.
  The answer carries it as stored. The project's read carries it (`overviewStyle`) when set. An offline plan keeps
  it in its browser record (syncing an offline plan to the cloud does not carry it yet: the cloud plan starts on its
  first tab's).
- **Live**: the room's `project-details` op carries it, as it carries the description; a tab-scoped session does not
  receive it.
- A whole-plan copy keeps it; a tab-scoped copy does not.

## Errors

- Anything that goes wrong on the Overview stays on the Overview: it stays open, and a fault in drawing it shows
  "Something went wrong in the Overview." with Try Again in the page's place, never the tab underneath with a notice
  at the foot of the editor. A fault in one tab's preview stays in that tile (above). A save that fails shows its
  toast over the Overview.

## Performance

- The Overview's code stays out of the editor's first load. As a plan usually opens on it, its code is fetched as
  the editor mounts, alongside the plan's own request (not in an embed, which has no Overview), so the page is in
  by the time the plan is. Until it lands the canvas's place is covered by the page's plain background: the canvas
  never shows before the Overview.
- Everything it shows is derived from what the editor already holds (tabs, cards, card types, presence), once per
  change of those, never per card or per frame. A plan at the item store's limit (2,000 cards) derives in well
  under a frame (budget: 16 ms in tests).
- Activity keeps the 30 newest entries without sorting every card's.
- Tab previews are drawn only for tiles near the screen (within 300 px), one tile per frame so opening never makes
  one long task, then kept: a preview is drawn once per change of what it shows, not per render of the page. Each
  is drawn at its window's size and scaled by the compositor, so its cost is the tab's own view at one
  screen's size. A Sheet's cells are read from the sheet store only for a Sheet whose tile is near the screen.
- A Board preview draws at most 10 cards in each cell (more than its window ever shows of one), its column counts
  still the whole board's, so a board of 2,000 cards previews as cheaply as a board of a screenful.
- Recent Activity animates only opacity and transform.
- The style is resolved once per change of it (or of the first tab's style while it follows that): one backdrop,
  one set of type sizes, no per-tile work. A style change writes once per pause (0.4 s), never per slider step.
- The dock is the canvas's own cluster: the Overview adds no second copy of it.

## Telemetry

- `UI` · `Opened` · `Overview` when the Overview is opened by pressing its entry. Opening a plan on its Overview,
  and Back, Forward or an address opening it, is not tracked: the plan's open is already `Project` · `Loaded`, and
  counting it would bury the presses.
- `Project` · `Changed` · `Description` when a description is saved (the closed actions already hold `Changed`).
- `Project` · `Changed` · `OverviewStyle` when the Overview's style is saved; `UI` · `Opened` · `OverviewStyle` when
  Style is opened on the Overview.
- Undo and Redo send `Project` · `Undone` and `Project` · `Redone`, as on any tab.
