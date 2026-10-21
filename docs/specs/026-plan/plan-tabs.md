# Plan tabs

Planning happens on tabs of three **kinds**: a **Board tab** (one board, always filling the tab), a **Sheet tab** (one Sheet, always filling the tab) and a **Dashboard tab** (rows of slots holding compact, live versions of the document's Board and Sheet tabs, plan views, charts and notes). Boards and Sheets are never small elements free on a canvas any more; a Dashboard is where they are seen side by side. A fourth Plan kind, the **Form tab** (one form, whose responses become cards on a Board tab), has its own spec: [Forms](../030-forms/forms.md). Each kind is a tab **Kind** ([Domain language](../003-system-architecture/domain-language.md)), and it brings its own behaviour.

## Domain language

| Term              | Meaning                                                                                       | Not                    |
| ----------------- | --------------------------------------------------------------------------------------------- | ---------------------- |
| **Board tab**     | A tab of kind `board`: one board, filling the tab                                             | board page, board mode |
| **Sheet tab**     | A tab of kind `sheet`: one Sheet, filling the tab                                             | spreadsheet tab        |
| **Dashboard tab** | A tab of kind `dashboard`: rows of slots                                                      | overview, report       |
| **row**           | One band of a dashboard, its slots side by side                                               | section                |
| **slot**          | One place in a row, holding one thing or empty                                                | cell, widget, panel    |
| **span**          | A slot's width, in twelfths of the row                                                        | weight, columns        |
| **slot content**  | What a slot holds: a Board or Sheet tab, a plan view, a chart from a Sheet, a note or a Title | item, block            |

## The kinds

- A Board, Sheet or Dashboard tab is always in **Plan** mode, whatever a stored or stale `opensIn` says. Its start's mode switch still shows, reading Plan, with no line under the modes. Picking another mode asks **Open a New <Mode> Tab?** ("A Dashboard is always in Plan. Its mode can’t change, but you can carry on in a new
  <Mode> tab.", or "A Board tab ...", "A Sheet tab ...") and **New <Mode> Tab** opens a new tab in that mode
  after the others; Shift+D does nothing there. No tab menu lists modes.
- The kind is chosen on **Start Planning** ([Plan mode](plan-mode.md#starting-a-board)), four tiles two by two:
  **Dashboard** a Dashboard tab, **Board** (then a preset) a Board tab, **Spreadsheet** (then a start) a Sheet tab,
  and a search reaches every template, another mode's included. The choice sets the tab's kind and adds its element in one change, one undo step.
  A Dashboard started on a tab still on its default name ("Tab 5") is named **Dashboard**; a name someone gave the tab
  stays.
- Its tab pill leads with its **kind's glyph** rather than the Plan mode's: a kanban for a Board tab, a grid for a
  Sheet tab, a layout of tiles for a Dashboard; tinted with the tab's accent as any pill's is.
- A tab's kind is stored on the tab (`kind`) and syncs as tab metadata. A Board or Sheet tab whose element is deleted
  shows Start Planning again; choosing anew sets the kind anew.

## Board tab and Sheet tab

- The one board (or Sheet) fills the tab ([Fill Tab](plan-board.md#fill-tab)) for everyone, always: there is no Fill
  Tab switch anywhere (not on Setup Board, Board Setup or Sheet Settings; a flag stored on an old board or Sheet still
  reads), no Maximise or Restore, no Focus and no Add to Slides, and Escape restores nothing. Its header holds the
  top row where there is room ([The header holds the top row](plan-board.md#maximised-board)).
- A Board tab's board fills the screen, so it starts with its cards **Detailed**, whatever its preset uses on a canvas
  (a Kanban's Compact): from Start Planning and from a template alike. Card Layout changes it as ever.
- A Board, Sheet or Dashboard tab shows no palette, as nothing in Plan does ([No palette](plan-mode.md#no-palette)); a
  Sheet tab's toolbar sits in the top row beside the menu box, in a card of its own
  ([Sheet](../029-sheets/sheet.md#sheet-tab)).
- Anything else added to a Board or Sheet tab (a paste, an agent) is hidden under the element, as for Fill Tab.
- **Import and Export** in a Board or Sheet tab's tab menu are only what fits its element, in place of the
  document's Import dialog: **Import CSV…** and **Export** (the Export dialog, with only the formats that suit the
  kind, its CSV among them: [Export](#export)), in that order. There is no separate Download CSV row: CSV is one of
  the Export dialog's formats.
  - A **Sheet tab**: **Import CSV…** (the Sheet's own file picker and import, for someone who may shape it; dimmed
    otherwise). Sheet Settings then leaves Import CSV… and Download CSV out; a Sheet on any other tab keeps them there.
  - A **Board tab**: **Import CSV…** (each row a new card on the board, for someone who may add cards: an Editor or a
    Participant; dimmed for a Viewer, and on an Archive board). The rules are the board's [CSV](plan-board.md#csv).

### Names

A Board tab and its board, and a Sheet tab and its sheet, share **one name**:

- **Made**: a tab still on its default name ("Tab 2", `isDefaultTabName`) takes the name of what fills it, as a
  default name names nothing. From Start Planning, a board is titled by its preset ("Bug Tracker") and a sheet by its
  start (Card Table, a sheet template's name such as Budget or Invoice, else Sheet), and the tab takes that title. A one-tab Board or Sheet template
  picked on a start names the tab after its board's title, else the template's own ("Bug Tracker"); a template of
  several tabs names each, as ever. A tab with a name of its own keeps it, and gives it to the board or sheet.
- **Tab renamed**: its board or sheet takes the name (in the same step for a board; a sheet's title is written to it,
  kept unique on the tab).
- **Board renamed** (its header, Board Setup): the tab takes the title in the same step, so one undo takes both back.
- **Sheet renamed** (its header, Sheet Settings, a collaborator, an agent, an undo): while the Sheet is drawn, the
  tab takes the new title, quietly (the sheet's own undo holds the rename), set by someone who may shape the Sheet.
  Opening a document never renames a tab whose name already differs.
- **A Visualisation tab and its chart** share one name too: renaming the tab gives the chart its own title (`planView
.title`, up to 80 characters, in place of the view's name: "Launch Plan", or "Launch Plan · Oct 2026" on a Due
  Calendar), and an Editor renames the chart with a click on its name in the menu box (Enter or leaving saves,
  Escape puts it back), the tab following in the same step. The field starts from the chart's name alone, never what
  it shows at the moment ("Due Calendar", not "Due Calendar · Oct 2026"). A Participant or a Viewer cannot rename it.
  A Visualisation tab started on a tab with a name of its own gives that name to its chart as its title.
- **Only a rename renames**: a board's or chart's other settings (a column, a card type, a filter) never rename its
  tab; only a change of its title does.
- **Duplicated**: the copy of a Board or Visualisation tab ("Bugs copy") titles its board or chart the same, so the
  copy and the original each keep their own name.
- A board renamed by an agent (`change_board`) changes the board alone; the tab follows the next time either is
  renamed in the editor.

## Only in Plan

A Plan board and a Sheet are placed only on a tab in Plan (`opensInOf(tab) === 'plan'`: a Board, Sheet or Dashboard
tab, or a general tab in Plan). A tab keeps its mode once it has content
([Editor modes](../007-editor/editor-modes.md#the-mode-switch)), and a board's cards and a Sheet's cells take input only
in Plan, so one on a Diagram, Draw, Workshop or Pages tab could never be worked there. Every way in keeps to it
(`tabTakesPlanOnly`, `planOnlyAddedOutsidePlan` and `withoutPlanOnly` in `packages/document/src/plan-only.ts`):

- **The palette, Search and a dropped CSV** are Plan mode's already: Search lists boards and Sheets in another mode
  greyed out, "Only in Plan Mode".
- **A paste** onto a tab in another mode leaves out every board and Sheet it holds, and the charts those Sheets draw,
  and pastes the rest. It says what it left out: "Boards and sheets stay on Plan tabs, so the board was left out"
  ("the sheet", "the boards", "the board and the sheets", ...). A paste holding nothing else pastes nothing, with the
  same notice. Logged as `[clipboard] plan work left out` with the counts.
- **An agent** is refused: `add_board` and `add_sheet` onto a tab in another mode answer `tab_not_plan`, before
  anything is made ([Plan agents](plan-agents.md), [Sheet store](../029-sheets/sheet-store.md#agents)), and any
  changeset (`update_document`, a template over an existing tab, the api) that would leave a new board or Sheet on
  such a tab is refused `invalid_value`, naming the elements, with the hint to add a Board or Sheet tab instead
  ([Agent changesets](../024-agents/agent-changesets.md#boards-and-sheets-only-in-plan)).
- Boards and Sheets a tab already holds are left alone.

## Dashboard tab

- The tab's `dashboard` holds its **rows**, top to bottom; each row its **slots**, left to right. Drawn over the
  canvas area as a page (the canvas is not panned, zoomed or drawn on), it scrolls vertically when taller than the
  window. The page is 24 px in from the canvas edges with 12 px between rows and slots.
- **Theme**: the Dashboard tab's theme draws everything on it. A slot card's border is the theme's stroke colour (the
  Default scheme, with none, keeps the soft neutral line), under a card style of its own. A Board or Sheet tab shown
  in a slot is drawn in the Dashboard's theme, its colours switched from its own tab's theme as a theme switch would
  (any it was given kept); only there: its own tab, and the element itself, keep their own.
- **Rows**: 1 to 12. A row's height is 120 to 1200 px (320 to start), changed by dragging the handle under the row.
- **Slots**: 1 to 4 per row. Spans are whole twelfths, at least 2, and a row's spans add to 12. Dragging the divider
  between two slots moves span from one to the other in twelfths; new rows start as two slots of 6.
- **From the keyboard**: a divider and a row's handle are focusable separators (shown while focused, with their value:
  the left slot's twelfths, the row's height). Left and Right move a divider a twelfth; Up and Down change a row's
  height by 20 px, 80 px with Shift. Each press is one undo step, held to what the content needs as a drag is.
- **No rows**: a Dashboard whose last row is removed shows **Start Planning** again; a choice there replaces it (the
  tab becomes the chosen kind, its layout gone, in one step).
- **A new Dashboard** starts from a preset layout chosen on Start Planning, every slot empty: **Two by Two** (two
  rows of two), **Overview** (a short row of four over a row of two), **Focus** (one tall row of 730 px, 8 and 4 twelfths),
  **Three Columns** (two rows of three), **Stacked** (three full-width rows) and **Report** (a short row of three, a
  full-width row, then a row of two). Everything can be changed afterwards.
- **Editing** (an Editor): an item in a slot has **one menu, its cog**; there is no ⋯ beside it. The slot's own
  settings are its **Slot** section, a collapsible section like every cog's: what the slot shows with a cog of its own
  (a board's **Board Settings**, a Sheet's **Sheet Settings**, a chart's **Chart Settings**) holds it last, after its
  own sections, one open at a time; anything else (a metric, a utility, an empty slot, a Diagram tab, a chart for
  someone who may not change it) has the slot's own cog, **Slot Settings**, opening on the Slot section. The Slot
  section holds **Add a Slot**, the slot drawn small (a tinted "This Slot" box) with a dashed button on each of its
  four sides, each an arrow pointing its way and its name: **Left** and **Right** (**Add Slot to the Left**, **Add
  Slot to the Right**) put an empty slot beside it in its row, **Above** and **Below** (**Add Row Above**, **Add Row
  Below**) a row of one slot above or below its row. The side under the pointer or keyboard focus lights in the brand
  colour as the new slot and its arrow bounces the way it points (3 px, looping while hovered; still with reduced
  motion). No line of description: a side that cannot be used stays dashed and dimmed, its tooltip (and its accessible
  description) saying why (the row holds four slots, the dashboard twelve rows, or what is here would be too small:
  What fits), and the cog closes once one is added; then an Editor's **Change Chart** or **Change Source** (a chart or
  a figure from a Sheet) as compact action buttons. The slot's own actions are a **toolbar** of icon buttons (each named
  in its tooltip) across the top of whichever cog the slot shows, above every section: **Open Tab** (a slot showing a
  tab, for anyone), then an Editor's **Move Up** and **Move Down** (stacked on a phone only: On a phone), **Duplicate Slot**, **Clear Slot** and **Remove Slot** (its span goes to its
  neighbour; a row's last slot takes the row with it). **Duplicate Slot** puts a copy just right of the slot, its
  space split as Add Slot to the Right splits it, or in a new row of one below its row when the row is full (or the
  slot too narrow to split); dimmed, its tooltip saying why, for an empty slot and for a Sheet that lives on the
  dashboard (two slots would share its cells); dimmed with nothing said when neither fits. The copy is the slot's
  content, one step: a board, chart or utility copied with its settings, a tab shown again. Clear Slot is dimmed on an
  empty slot. Where clearing or removing asks what goes with it, the question shows under the toolbar, with **Cancel**
  under its two answers. A Participant or a Viewer sees the toolbar with Open Tab alone and no Slot section, and no
  cog at all on a slot showing no tab. A row has no tools of its own, only its resize handle. A slot's grip, its floating cog, a row's dividers and its
  resize handle come in and go out softly with the pointer (micro, easing out): the grip and cog grow from 75% and 90% as
  they fade, a divider's or handle's bar from half its length. Resizing is eased too: on a wide page a row's slots
  change width (a divider dragged a span at a time, a slot added or removed) over the short motion token, and a row's
  height eases when it changes, except under its own drag, which follows the pointer. Under reduced motion all of it
  is immediate. On a touch screen nothing waits for a hover: each slot's grip, each divider and each row handle is
  shown all the time as a quiet marker (the grip at 70%, a divider's and a handle's bar at full length and 50%, fully
  shown while it is dragged), with a finger's reach round it (the grip's 44 px tap area; a divider 24 px wide and 64 px
  tall, a row handle 64 px wide and 24 px tall, each centred on the gap, so the slots' own edges stay theirs), and a
  finger on any of them carries or resizes rather than scrolling the page. Nothing is drawn round a slot's edges. Where the slot shows something with a header of its own (a board, a Sheet, a visualisation, a Diagram tab), its cog
  sits last among that header's controls; otherwise (a metric, a note, an empty slot) the Slot Settings cog floats at
  the slot's top right on hover.
  Each change is one undo step.
- **A new slot settles into place**: a slot added (Add a Slot, a new Dashboard's rows, or by a collaborator)
  fades up from 8 px low at 96% scale, at the long motion token; a new row's slots cascade left to right, landing by
  the motion ceiling. The slots a Dashboard opens with, or shows on switching to another Dashboard, draw still, and
  nothing moves under reduced motion.
- **Cards**, offered under Add to Slot's **Utilities** (written on the page itself, for anyone to read; an Editor writes them, each change one step; each fits
  any slot):
  - **Status**: On Track (green), At Risk (amber) or Off Track (red), its light and name large, a line of why ("Say why
    in a line or two…"), and "Updated 3 days ago" (the shared 30-second clock). An Editor picks the state from three
    buttons (a radio group) and types the line; either stamps the time.
  - **Checklist**: a heading ("Checklist") with "2 of 3" and a bar of the share done, then the items, each a tick and its
    text, struck through once done. An Editor ticks in place, types into an item (Enter saves what was typed and adds
    the next as one step, focusing it; Backspace on an empty one removes it and focuses the one above) and adds one at
    the foot (**Add Item**). Up to 30 items of 200 characters. Empty, an Editor sees a first item ready to type into (an empty tick and "Something to
    do", in place of Add Item): text left in it becomes the first item, Enter adds it and opens the next; nothing is
    kept while it is blank. Empty, a reader sees "Nothing on the list yet."
  - **Key Date**: a heading ("Key Date") over the days to its date, large: "12 days to go", "Tomorrow", "Today",
    "Yesterday", "3 days ago" (red once passed), and the date ("Sun 25 Oct 2026"). An Editor picks the date with the
    date field, saved as one step when the field is left or Enter pressed (the count follows as it is typed); a new
    one is two weeks out. No date: "No date set."
  - **Links**: a heading ("Links") over labelled links, each to a site (opened in a new browser tab, `noopener`; only
    http, https or mailto, "https://" added to a bare host, anything else refused as "Enter a web address, an email
    (mailto:) or a tab’s name") or to one of this document's tabs (opened here). Each link is a row: its kind's icon in
    a small well (a globe for a site, an envelope for an email, the tab's own tab-bar icon for a tab), its label and,
    muted under it, the site's host and path, the email's address ("Email" when that is the label), or "Tab in this
    document". A link with no label shows its site's host, its email's address or its tab's name. A row tints on hover;
    a site's row shows an external-link mark and an Editor's × on hover or focus only (always on a screen without
    hover). Up to 12 links. Empty: "No links yet."
  - **Add Link** (an Editor): opens a form straight under the links (never anywhere else in the card), with Label
    focused: **Label** (optional) and **Address** ("example.com or a tab"), the shared text fields, then Cancel and
    **Add Link**. In a card under 448 px wide (a container query on the card) Label sits over Address; wider, they
    share a row, Label a third. Address is a combobox listing the document's tabs, each with its tab-bar icon and name,
    narrowed as you type (names starting with the text first); ArrowDown and ArrowUp move through it, Enter or a click
    picks a tab, Enter with nothing highlighted adds the link, and Escape closes the list, then cancels the form. The
    list is drawn over the page (never clipped by a short slot). Everything under the heading scrolls when the slot is
    short, top-aligned, and the form scrolls into view as it opens.
  - A Viewer and a Participant read every card; a Participant does not tick a Checklist (the Dashboard is an Editor's
    to change).
- **Title**: a section's heading, written on the page: a big heading (22 px, 30 px once the slot is 448 px wide) over
  a description of up to three lines, drawn bare on the page (no card) and centred in the slot's height, so it reads as the
  heading of what follows. A new one starts as the dashboard's name. An Editor types into both in place ("Section
  Title" and "Add a description…" while empty); each lands as one step when the field is left, and a faint dashed
  outline on hover or while typing says it can be written in. Like a note it fits any slot. A note's or Title's text
  follows a change made elsewhere (a collaborator, an undo) unless it holds unsaved typing.
- **Card style**: an Editor styles a Utility (Note, Title, Status, Checklist, Key Date, Links) from its Slot Settings
  cog. The popover opens with a **Style** row, the element context menu's own (a side flyout of closed
  MenuAccordionSection rows, the same tiles, hover previews and Reset buttons), over the Slot section.
  The flyout holds only what a card in a slot can take:
  - **Presets**: the shapes' style presets (Theme, Soft, Tinted, Solid, Bold, the neutrals, the border looks and the
    status colours), each a whole look (fill, border colour, text colour, border weight and pattern), drawn for the
    tab's theme and the viewer's appearance, with **Reset to Default** (the Dashboard's own card, shadow included). A
    preset is stored by its id and resolved against the theme when drawn, so a styled card follows a theme change as
    a preset-styled shape does. Picking one replaces colours and border set by hand and keeps the shadow.
  - **Colours**: **Text**, **Background** and **Border** in the one colour picker, over the preset's, and **Reset to
    Theme** (clears the preset and the colours).
  - **Border**: Strength and Pattern. No Radius: the corners stay the Dashboard's, so the grid reads as one. A
    dash-dot or long-dash pattern is drawn dashed (CSS draws three patterns).
  - **Shadow**: the element presets and sliders (one undo step once a slider rests 400 ms); None removes the card's
    lift. Before a shadow is set the sliders read the card's own soft lift.
  - Not offered: Layer, Size, Rotation, Animation, Tools, Collaborate, Resources or Font (a slot places and sizes the
    card, cards hold no comments, and the cards share the tab's font).
  - A **Title** is drawn bare on the page, so its style is its text colour alone: its menu shows **Colours** (Text,
    Reset to Theme) in place of the Style row (a flyout of one section is promoted inline, as on the canvas).
  - Text: a text colour set by hand is kept; otherwise a preset's own, or (a fill set by hand) white or near-black,
    whichever reads on it. The card's quieter lines take that ink leaning 28% toward the fill while it still reads at
    4.5:1, else the ink. A card's own colours stay (a Status light, a link). A filled card draws its contents in its
    fill's appearance, light or dark, whatever the page's (theme.css: `.light` and `.dark` are appearance islands).
  - Hovering a preset, colour, border or shadow tile previews it on the card without writing; leaving reverts. Each
    pick is one change, one undo step. A change that changes nothing is no step.
  - Data: `style` on the Utility's slot content: `preset` (a preset id), `fill`, `stroke`, `text` (`#rrggbb` or
    `transparent`), `borderWidth`, `borderStyle`, `shadow` (offsets, blur, opacity, clamped, or `none`). Read safely
    with the layout (unknown fields and values dropped; a Title keeps `text` only; any other slot content drops it),
    so it survives moving, swapping, Duplicate, a JSON export and import, and every edit to the card. The image export
    draws the fill, border and inks (no shadow).
- **Filling a slot**: from its **Add to Slot** (below). Plan has no palette ([No palette](plan-mode.md#no-palette)),
  so everything a slot holds is picked there.
- **Something added while a Dashboard is open** (a shortcut such as N for a Note) does not land at a default: it waits
  for a click (`useArmedPlacement`), every place it could go drawn faintly and the one under the pointer strongly,
  under a banner "Click where the <name> goes, or press Enter for the first empty slot" (for a row, "the foot"; for a
  slot, "the last row with room") with **Cancel**. A click places it there; **Enter** or **Space** places it where a
  press with no pointer does (the first empty slot, a new row when none is; a row at the foot; a slot in the last row
  with room) and is said aloud ("Note placed in the first empty slot"); Escape or Cancel puts it away. One step.
- **A new board or Sheet is a tab of its own**: picking one under **New Board** or **New Sheet** makes a Board tab or
  a Sheet tab for it, as Start Planning makes one (its kind, opening in Plan, a board drawing its cards Detailed, a
  board bringing its preset's card types), named as Start Planning names it (the board's title, such as "Kanban"; the
  Sheet's, "Sheet" or its template's name), looking like the dashboard's tab, and placed straight after the dashboard
  in the tab bar. The slot shows that tab (as picking it under This Document’s Tabs does), and the new tab, the slot
  filled and the card types are one undo step. The Sheet is made on its own tab even though it is first drawn in the
  slot. The dashboard stays the open tab. Telemetry: `Plan · Created · BoardTab` or `SheetTab` with the slot's
  `Plan · Changed · DashboardContent`; no new values.
- **Add to Slot browses in two levels**, as the palette's Tools do. Its heading, **Add to Slot**, sits over both
  with one short line, "What fits here, as it will look.". It opens on its **categories**, only those with something
  that fits the slot: a grid of two columns of cards, each a small picture of what it holds (the slot pictures below,
  at three quarters: a diagram for This Document’s Tabs, a board, a sheet, a Completion tile for Metrics, a Gantt for
  Visualisations, a Trend for From a Sheet, a stack of cards for Utilities), its own glyph in a brand well, its name,
  how many choices it holds (the shared CountBadge) and a line of what is inside, in full, wrapping (never cut off).
  A card lifts on hover with a brand-tinted edge, shows a focus ring, and the cards cascade in when the picker
  opens (none under reduced motion). Under them, when anything was left out, the too-big line sits in a quiet
  footer with a resize glyph. Pressing a category (or Enter or Space on it) shows its choices, each drawn as it will
  look, under the palette's breadcrumb bar, **Add to Slot › Metrics**, which goes back to the categories. Escape or
  Backspace there goes back a level too; Escape on the categories closes it. Drilled in, the first choice takes
  focus; back, the category it came from, and the categories' scroll is put back. When only one category has
  anything for the slot, it opens on that category's choices, with no breadcrumb.
- **Moving between levels is smooth**: the picker keeps the side and edge it opened on (it never re-places or flips),
  its height eases to the new level's (short motion token, easing out), and the new level slides in from the right
  going in and from the left coming back, fading up (the wizard's tip-next and tip-prev); only one level is ever
  drawn. Under reduced motion the swap is instant.
- **What fits**: content goes only into a slot big enough to draw it well: a board (or Board tab) 480 by 440 px (its header, three
  columns and two or three cards: less shows one card and reads as cramped), a Sheet (or Sheet tab) 320 by 240, a visualisation 300 by 220; a metric or a note fits any slot. Add to Slot offers only what fits, saying "Only what looks good at this slot’s size, each
  shown as it will look here.", and when anything was left out, "Boards, sheets and charts need a bigger slot: drag
  the row’s lower edge to make it taller." (naming only those left out). Each choice is drawn as it will look: a board
  preset's picture, a sheet's, a metric as its tile, a chart as its chart, a note as a heading over lines.
- **What fits holds as the layout changes**: no change squeezes content that fits its slot below what it needs. A
  slot added beside it (Add a Slot, the Layout's Slot) is not offered there; a slot moved (by its grip or the
  arrow keys) cannot go where it, or the slot it swaps with, would be too small; dragging a row's lower edge stops at
  the height its tallest-needing content needs, and a divider stops at the width its slots' content needs. Content
  already too small (an older layout) does not block other changes. Below the condensed width nothing is checked
  (each slot takes half or all of the line).
- An **empty slot** shows the site's empty state at slot size: a gradient badge and **Empty Slot**, with no
  description, over an **Add to Slot** button (the dashed add row Add New Card Type wears, kept to 224 px in a wide
  slot) for an Editor; anyone else sees the badge and title alone. **Add to Slot** opens a picker of what a slot
  takes, by category: **This Document’s Tabs** (every tab but a Dashboard, see Showing a tab), **New Board** (each preset), **New
  Sheet**, **Card Metrics**, **Form Metrics** (only while the document has a Form tab), **Visualisations**, **From a Sheet** (Sheet Figure, Column Summary, Trend, Sheet Chart) and **Utilities** (Note, Title, Status, Checklist, Key Date, Links); picking
  one fills that slot. Each fill is one undo step, replacing what the slot held (an element it held leaves the tab
  with it).
- **Its name in the menu box**: as a maximised or tab-filling board's or Sheet's name rides there
  ([The name rides in the menu box](plan-board.md)), a Dashboard tab's name (no glyph) sits in the menu box beside the
  mode menu. For an Editor the name is a button (**Rename Dashboard**): a click, or Enter or Space on it, opens the
  field (Enter or leaving saves the trimmed name, up to 80 characters; Escape puts it back; focus returns to the name),
  and the tab bar follows. A phone's box has no room for it.
- **Look**: each slot is a translucent card over the canvas (white at 72%, slate 900 at 60% in dark), 16 px corners,
  a hairline edge and a soft shadow, lifting a little on hover; no backdrop blur (up to 48 slots would each
  recomposite on scroll).
- **Slot content** (`content`):
  - A **Sheet** made for a slot (its new Sheet tab) goes straight to work, never through Setup Sheet: **Empty Sheet** a blank grid, a
    [sheet template](../029-sheets/sheet.md#sheet-templates) already set up from it (the Banded look, its header
    frozen, no chart); only a Card Table still asks which cards.
  - **Board** or **Sheet** (a dashboard made before new ones became tabs): a board or Sheet that is an element of the
    dashboard itself; the slot still draws it live and interactive at the slot's size, its cog holding the slot's
    Slot section, and Clear Slot removes it. Nothing makes one any more: a new board or Sheet is a tab (Filling a slot).
  - **Tab**: an existing Board or Sheet tab, from the Tabs category, shown live in the slot; **Open Tab** in its menu goes to it
    (a double-click stays the content's own, a card's open). Until the tab's content arrives the slot says **Loading <name>…**, waiting as the Board or Sheet it was given (a tab not
    fetched yet has no kind of its own, so it is never shown as a Diagram tab meanwhile) and drawing it once it lands; if
    its fetch fails, **Couldn’t load <name>.** with **Retry** (Loading again until that fetch settles); loaded with
    nothing on it, **Nothing on <name> yet.** Each slot judges its own tab, so one slow tab never holds the others. A
    slot whose tab is gone says **This Board was deleted.** (or **This Sheet was
    deleted.**; the slot records which it was given) and offers Clear Slot.
  - **Visualisation** or **Metric**: a plan view ([Plan views](plan-views.md)) of the tile's view kind, an element on
    the dashboard tab drawn in the slot at the slot's size.
  - **Note**: a heading and short text, typed in place (each field one step when left).
- Elements on a Dashboard tab are only ever in a slot: never moved, resized, rotated, layered or animated; a slot's
  element is removed with the slot's Clear.
- Their copies on the canvas under the page draw nothing, so a slot's board, view or Sheet **maximised** has one
  header: one title in the menu box and one set of controls (never a slot's smaller ones).
- **Maximising from a slot** grows the board, view or Sheet out of the slot it is drawn in, and restoring shrinks it
  back into that slot, wherever the slot is on screen at that moment ([Maximised board](plan-board.md)); under
  reduced motion it switches at once, with no grow or shrink.

## Import and Export of a Dashboard

- **Import** on a Dashboard tab's tab menu opens the Import dialog straight at **JSON**, the only format it offers: a
  Dashboard tab's own `.json` export (Export's JSON), pasted or picked (the picker asks for `.json`). It replaces the
  dashboard's rows, slots and elements with the file's, in one undo step; the slots follow their elements' new ids.
- An imported or duplicated Dashboard's layout is its own: every row and slot takes a new id, a figure from a Sheet on
  the tab names the copy of that Sheet made with it (as a chart from it does), and a layout read with a repeated row or
  slot id gives the repeat a fresh one.
- Anything else is refused in the dialog, the dashboard left as it was: text that is not JSON (**File isn't valid
  JSON.**), JSON that is not a liveplanner tab, and a tab that is not a Dashboard (**This file isn't a Dashboard.
  Export a Dashboard tab as JSON, then import that.**).
- A slot showing another tab keeps naming it by id: in another document it reads as deleted until cleared.
- Import is an Editor's, as the tab menu is (a Viewer or Participant has no tab menu); a locked tab refuses it.

## Export

The Export dialog offers each tab only the formats that can carry what it is, and its images draw the tab as it is
laid out, never the canvas hidden under it:

| Kind          | Formats offered              |
| ------------- | ---------------------------- |
| Board tab     | PNG, SVG, PDF, Markdown, CSV |
| Sheet tab     | PNG, SVG, PDF, CSV           |
| Dashboard tab | PNG, SVG, PDF, JSON          |
| Form tab      | JSON                         |
| Any other tab | every format but CSV         |

**CSV** opens a text panel like JSON's and Markdown's (view, copy, **Download .csv**): a Board tab's cards the board
shows, a Sheet tab's cells as shown, both safe to open (a field a spreadsheet would run as a formula made inert).
Taking it counts as the board's or Sheet's own CSV export (`Plan · Exported · Csv`, `Sheet · Exported · Csv`). Any other tab has neither, so
it is not offered CSV: it used to be, and copied or downloaded an empty file. A **Form tab**'s form is no element, so
its canvas is empty: every picture and outline of it came out blank, and only the JSON, which carries the form, is
offered.

- **Images** (PNG, SVG, PDF) of a **Board tab** draw its board alone (header, columns, counts and card faces, from the
  document's items) at the board's size, in the viewer's appearance; of a **Sheet tab**, its Sheet alone with its
  charts at their anchors in its grid (as the Sheet shows them, not at their own canvas places), the Sheet grown to
  take in its charts (growing up to 4000 px a side; a Sheet already larger keeps its size), and the cells that fit
  worked out from the sheet store (as [Sheet](../029-sheets/sheet.md#exports-and-images) says). Anything else hidden under the board or Sheet stays out.
- An image of a **Dashboard tab** is its page: rows top to bottom, slots side by side, **1440 px** wide (the image's
  own 32 px margin round 1376 px of rows, 12 px between rows and slots, each row its own height; a row that fills the
  page is **720 px** tall), each slot a card in the page's look (white at 72%, slate 900 at 60% in dark, 16 px
  corners, a hairline edge) holding a picture of what it holds:
  - a Board or Sheet (its own, or a tab's) drawn as above at the slot's size; a Diagram tab's drawing fitted inside;
  - a plan view drawn as a chart, not a labelled box: a metric's figure, its line and its bars; Cards by Field's
    bars; Priority by Status's grid of counts; Status Breakdown's bar; a Gantt's bars over its weeks; a Calendar's
    month with the cards on their days; Card Search's list of cards. The same pictures stand for a plan view on any
    other tab's image;
  - a note, Title, Status, Checklist, Key Date or Links as it reads, without its editing controls; a figure or chart
    from a Sheet as its title and value when the Sheet is loaded.
  - a slot whose tab is still loading or gone, or that is empty, as its card with what it would say (**Loading <name>…**,
    **Nothing on <name> yet.**, **This Board was deleted.**, **This item was removed.**, **Empty Slot**).
- A **Visualisation tab** exports its one chart filling the page (1376 by 720 px inside the margin).
- The pictures are drawn from the same models as the live views. The Sheets are read when the Export dialog opens
  (the sheets engine loads then, and only for an image with a Sheet or a figure from one); the preview waits for them.
- **Isometric view** and **Background pattern** are not offered for a Board, Sheet or Dashboard tab (they are not
  drawn on a canvas); Hidden layers neither.
- **Markdown** of a Board tab is its board's outline (each column and its cards); **JSON** of a Dashboard tab is the
  file its Import reads back. Mermaid and Excalidraw carry diagrams, so no Plan tab offers them.
- Telemetry: the formats' existing `Document · Exported · <Format>`; no new values.

## Form Metrics

A slot can show a figure from one of the document's forms ([Forms](../030-forms/forms.md)): Add to Slot's **Form
Metrics**, offered only while the document has a Form tab. Six figures (`form-metric` content: `metric`, `formTabId`):

| Figure             | Shows                                                                                                                                                            |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Responses**      | Its responses so far, large, over "responses so far"                                                                                                             |
| **New Responses**  | How many are new to the reader ("new to you since you last looked")                                                                                              |
| **Form Status**    | A pill: **Accepting** (green), **Closed** (amber; also past its Close On or at its Response Limit), **Not Published**, **Suspended** (red), or **Draft** offline |
| **Response Limit** | "42 / 100" with a bar toward the limit (amber once reached) and how many to go; **No limit** without one                                                         |
| **Closes**         | Days until it closes ("3 days", **Today**), its date beneath; **Closed** once past; **No date** without one                                                      |
| **Form Link**      | The link to copy (**Copy**, an Editor's) once published; "Not published yet." before                                                                             |

Placed, it reads the document's first Form tab; an Editor changes the form from the select at the card's foot while
the document has more than one (the form's name shows there otherwise). Its figures are read live from the form's link
as the board's Form strip reads it, never marking responses seen, and the clock is read again each minute. A slot whose
form was deleted says "This form was deleted." with **Clear Slot**. An image export names the figure (the link is not
read for an export). Anyone may read it; only an Editor changes its form or copies its link.

## Figures from a Sheet

Add to Slot's **From a Sheet** fills a slot with a figure (or a chart: [Sheet Chart](#sheet-chart)) read live from one
of the document's Sheets: the same value
the Sheet shows, in its own number format, following every edit (a collaborator's too), and following its cells as
rows and columns are inserted, deleted or moved (they are named by stable row and column ids, `@liveplanner/sheets`
`sheet-metrics.ts`). Each fits any slot.

- **Sheet Figure**: one cell's value, large, named by the text to its left (else its column's header, else its
  address), with "<Sheet> · B6" under it. With a **target** cell it shows how far along it is: "of £2,000", a bar
  and its share ("82%"), in the brand colour, green at or past the target.
- **Column Summary**: a column's **Total**, **Average**, **Lowest**, **Highest** or **Count** of its numbers below
  its header row (rows a filter hides left out; at most 2,000 rows read), named "<Stat> of <Header>", formatted as
  the column's first number is, with a sparkline of the column under it where there is room.
- **A column's numbers** (for a summary and a trend) are its main table's: the header need not be the first row (a
  template's title sits above it), so the column is read as tables, each a header (a bold text cell, or the first
  text over the numbers) and the numbers under it down to a **total row** (a bold cell ruled above, or a row whose
  text to the left says Total, Subtotal or the like), which is left out, or to the next bold header. The table with
  the most numbers is the column's; text inside it (a "Done" in Days Left) is left out. On the Budget template, the
  Planned column totals 2,375 (the total row's own 2,375 not counted again).
- **Trend**: a column's last number, large, with the change from the one before it (an arrow, the change and its
  share: "▲ 120 (12%)", green up, red down, muted when unchanged or with one value) and a sparkline of the column.
- **Choosing the source**: a new one shows **Choose a Sheet** (an Editor's; "Waiting for its sheet." to anyone else)
  which opens its source picker, as does **Change Source** once set (an Editor's tile in the slot cog's Slot section,
  never a hover button, one menu per item): the document's Sheets
  (each its title and its tab's name; "No sheets in this document yet." when there are none), then, for a figure, the
  sheet's labelled numbers (numbers with text to their left, and ranges named for one cell; the foot of the sheet
  first, at most 12) or any cell typed as A1, and an optional target the same way; for a summary or a trend, the
  columns holding numbers (each its header and how many numbers) and, for a summary, the stat. Each choice is one
  step. The document's tabs are fetched as the picker opens, so every Sheet is offered.
- **Missing**: a sheet deleted says "This sheet was deleted." with Clear Slot; a cell or column whose row or column
  was deleted says "The cell it read was deleted." with Choose a Sheet; while the sheet loads, "Loading <Sheet>…".
  When its fetch fails (or, for a sheet no arrived tab places, the other tabs' fetches settle with some failed) it
  says **Couldn’t load <name>.** with **Retry**, which fetches again; a picker says the same of the sheet it shows,
  and with no Sheets found while a tab failed, **Couldn’t load this document’s sheets.** with Retry in place of
  "Finding this document’s sheets…". The tabs a Dashboard fetches for its Sheets record their failures as a shown
  tab's do.
- **Share roles**: an Editor chooses and changes the source; a Participant and a Viewer read the figure.

### Sheet Chart

From a Sheet's fourth choice, **Sheet Chart**, fills a slot with a bar, line or pie chart drawn live from a Sheet's
cells ([Charts](../029-sheets/sheet.md#charts)). It needs a chart's room (300 by 220 px, What fits), so Add to Slot
leaves it out of a smaller slot and names charts in its line.

- **Choosing the chart**: picked, Add to Slot gives way to **Choose a Chart**, anchored where it was: the document's
  Sheets (as a figure's picker lists them, each its title and its tab's name; "No sheets in this document yet."),
  then, for the Sheet picked:
  - **Its Charts**: the charts drawn from that Sheet on the document's other tabs (in the Sheet, or floating on a
    tab), each its type and range ("Column Chart · A1:C6"); "No charts from this sheet yet." when it has none. Picking
    one puts a copy of it in the slot: the same type, range, columns, style, legend and palette, reading the same
    cells.
  - **New Chart**: a **Range** typed as A1 ("A1:C6"; anything that is not a range of the sheet says "Not a range on
    this sheet"), a **Type** (the seven chart types, [Chart types](../009-elements/pie-chart.md#chart-types): **Column**, **Bar**,
    **Line**, **Area**, **Scatter**, **Pie**, **Doughnut**; Column to start) and **Add Chart**.
    Either fills the slot at once and closes the picker, one step. Closing it without a choice leaves the slot empty.
- **What it is**: a chart element on the dashboard tab, its `chartSource` naming the sheet and range (no
  `sheetAnchor`: it sits in the slot, not in a Sheet), drawn at the slot's size and read live: an edit to the cells,
  a collaborator's too, changes it. Its copy on the canvas under the page draws nothing. It keeps its last read as
  any chart from a Sheet does, and draws that read while the sheet loads or once the sheet or its range is gone;
  when the sheet's fetch fails, **Couldn’t load <name>.** with **Retry** sits over the foot of that read.
  Showing one fetches every tab's content, as a figure does, so the sheet it reads is found.
- **Changing it**: an Editor's **Change Chart**, a tile in the slot cog's Slot section (no button of its own, one
  menu per item), opens the same picker beside it; a choice
  replaces the slot's chart, one step. Clear Slot takes the chart off the dashboard; the Sheet and its own charts
  are untouched.
- **Share roles**: an Editor adds and changes it; a Participant and a Viewer see it, with no Change Chart.
- **Telemetry**: filling or changing it is `Plan · Changed · DashboardContent`, as every slot fill is.

## Dashboard Settings

An Editor's **Dashboard Settings** cog sits in a card of its own at the page's top right, 12 px from the corner at the
toolbar's UI scale, as the menu box sits at the top left (and as a board's or Sheet's cog sits in its header). While a
board, view or Sheet maximised from a slot covers the page, the cog is not shown (the covering element's own cog sits
in that corner); it is back the moment it is restored. It
opens the settings popover boards and Sheets use, built from the same parts as Sheet Settings (a labelled field,
compact action buttons with their icon left of their label, picture choices), its sections collapsible, one open at a time (Dashboard Setup when it opens), under a slim title row holding **Show Me** (below) and **Help** (the labelled Help link, to the Dashboards article):

- **Dashboard Setup**: **Name**, the tab's name typed in place (Enter or leaving saves it trimmed, up to 80
  characters; Escape puts it back; the tab bar and the menu box follow; untouched, it follows a rename made
  elsewhere); then two action buttons, **Add Row** (two
  empty slots at the foot; dimmed at 12 rows, with a line saying so; the cog closes and the page scrolls the new row
  into view, smoothly, at once under reduced motion) and **Clear Dashboard** (empties every slot, the
  rows and their sizes kept, after asking in a popover beside the button, "Empty every slot on this dashboard? Its rows
  and their sizes stay." (**Clear**, **Cancel**); dimmed while every slot is empty).
- **Background**: two swatches side by side, each its look drawn above its name and line: **Plain** (the canvas as it
  is) or **Tinted** (a soft wash of the theme's brand behind the slots, 7%, 9% in dark), the chosen one ringed. Kept on
  the layout as `background: 'tint'` (absent when plain), read safely (anything else is plain), and carried through
  every layout change.
- **Layouts**: start over from a layout: each preset of Start Planning (Two by Two, Overview, Focus, Three Columns,
  Stacked, Report) as a tile in a two-column grid, its rows drawn small above its name. Picked, its empty rows replace
  the dashboard's, the background kept, and the popover closes; when any slot holds something it asks first, beside
  the tile, "Start over as Focus? Current slots are removed." (**Start Over**, **Cancel**), and the
  slots' elements leave the tab with them (a Sheet's cells stay in the document).

Each change is one undo step. A Participant and a Viewer have no cog (the dashboard is an Editor's to change).

### Show Me

**Show Me** ([Show Me](../007-editor/show-me.md)) runs a guided tour of arranging and filling the dashboard, on the
page itself; it is never offered or started on its own. Pressing it closes the settings popover, then each step rings
a real control of the page, never a whole row or slot (a ring that size would light most of the page), and the page
stays usable (the Editor can fill a slot or drag a divider while the step is up). The steps: **Rows of Slots** (a
centred card, no ring: dividers and the bottom edge), **Fill a Slot** (the first empty slot's Add to Slot; only when
a slot is empty), **Change or Move a Slot** (the first filled slot's own cog, else its Move grip, both shown as on
hover while the step is up; only when a slot holds something), **Dashboard Settings** (the cog), then a
closing card, **That Is a Dashboard**, with a link to the Dashboards article. Which steps it has is fixed when it
starts, so filling the empty slot mid-tour keeps the count. Only an Editor has the cog, so only an Editor sees Show
Me; a locked tab has no cog, so none. Telemetry: `UI` · `Started` · `DashboardTour`, and `UI` · `Ended` ·
`DashboardTourCompleted` or `DashboardTourSkipped`. The same steps, behind a welcome card, are offered once as the Dashboards tour the first time an Editor has a
dashboard open ([Plan tour](plan-tour.md) "The Dashboards tour").

## A row that fills the page

A row may **fill the page** (`fill`): it takes the height the page has left (at least 24 rem) rather than its own,
has no resize handle, and is as tall as anything needs (What fits). A **Visualisation tab** is a Dashboard of one such
row holding one visualisation (Start Planning's Visualisations, [Plan mode](plan-mode.md#starting-a-board)): its
chart fills the tab as a Board tab's board does (`fill-tab.ts`, `View`), its header holding the top row (its title in
the menu box, its own controls in the card at the right, no Maximise), the page drawing nothing over it.

## On a phone

Below 640 px of page width (a phone, a narrow split) the dashboard **stacks**: every slot takes the whole width, one
under another in reading order (row by row, left to right), each at a height that suits what it holds rather than its
row's:

- a **Title** as tall as its text;
- a written card (**Note**, **Status**, **Checklist**, **Key Date**, **Links**) as tall as its content, never shorter
  than 168 px;
- a figure (a metric tile, a figure from a Sheet) a 176 px tile, and an empty slot 176 px (its Add to Slot);
- something worked in (a board, a Sheet, a visualisation or chart, a shown tab of any kind) two thirds of the screen
  (66 `svh`, never under 360 px), scrolling inside itself, so the next slot peeks in below. A finger on a board's empty
  space scrolls the board, and past its end the page, so a page of boards always scrolls (a finger on a card still
  picks it up); the board shows one column a screen ([Plan board](plan-board.md#on-a-phone)).

Only the drawing changes: the stored rows, spans and heights stay, and the same dashboard on a wide screen is as it was
laid out. Nothing is resized or carried there: no dividers, no row handle and no grip (the stack is only a way of
drawing the rows). A slot is reordered from its toolbar instead: **Move Up** and **Move Down** swap what it holds with
the slot before or after it in the stack's reading order (as the grip's drop on a slot does: the spans stay; one undo
step each; the cog closes, its slot now holding the other's content). The two cards glide past each other over the
long motion token, the moved one drawn above, and the moved slot scrolls into view; under reduced motion the swap is
instant. A separator in the toolbar sets the pair apart from the slot's own verbs. Each is dimmed, saying why, at either end of the
stack, and where the swap would squeeze either slot below what its content needs on a wide page (What fits). The page scrolls vertically and its end clears the bottom toolbar and the home indicator's safe area.
Nothing waits for a hover on a touch screen: a slot's floating cog and a link's × are always shown there, and the slot's
cog, Add to Slot (which offers everything, as the stacked slot takes the height its content needs) and the Dashboard
Settings cog in the top row all work by tap. A view's header gives way in a narrow slot: its own controls (a Gantt's
Today, steps and scale) scroll sideways while Maximise and the cog stay in reach. The canvas's zoom cluster, which
has nothing to offer a dashboard (zoom is off), is not shown on a touch screen, a tablet's as a phone's.

## Showing a tab

Add to Slot's **This Document’s Tabs** offers each of the document's tabs but a Dashboard, in tab-bar order, as a card named for the tab: a **Board** or **Sheet** tab, worked on in place in the slot, and any other tab as a **Diagram**. Picked, it shows that tab in the slot. The list follows the tab bar live (a tab added, renamed or deleted) and is left out while the document has no other tab. A tab may show in several slots and on several dashboards.

A **Diagram** slot is a card with the tab's mode icon and name over its drawing, live (each edit, a collaborator's
too, at a deferred priority) and still: drawn as the split view's other pane draws a tab, in this person's
appearance, fitted to the slot, as one image (it never scrolls or zooms the page, and runs nothing). Pressing it opens
the tab (**Open <name>**). It needs 320 by 220 px (What fits). Before the tab's content arrives it says "Loading
<name>…" (or offers Retry); a tab with nothing to draw (no elements, and neither in Pages nor a Form tab with its form)
says "Nothing on <name> yet."; a deleted one "This Diagram was deleted." The renderer loads only once a Diagram slot is shown.

## Moving a slot

An Editor moves a slot by its **grip** (**Move Slot**), a small handle just inside the middle of its top edge, shown on
hover. On a touch screen it is always shown, and a slot with no header of its own (a metric, a note, an empty slot)
carries it in its top left corner instead, clear of what the slot shows in its middle (a headed slot keeps it in the
middle, clear of its title).
Carried, the slot fades where it was and the zone under the pointer is drawn as a drop's is:

- over another slot's middle: the slot is outlined, and letting go **swaps** what the two hold (their spans stay);
- near a slot's side (within 72 px, or a fifth of its width), or between two slots: a bar in the gap, and the slot
  **moves into the row** there (within its own row it keeps its span; into another it takes half the wider
  neighbour's, its old row giving its span to its neighbour, or going when it was the last);
- near a row's top or bottom (24 px), or off every row: a bar between rows, and the slot becomes **a row of its own**,
  as wide as the page, at its old row's height.

Letting go over itself changes nothing; Escape, or the pointer cancelled (a touch the browser takes for a scroll), puts
it back, as does leaving the tab mid-move. A finger on the grip carries the slot, never scrolling the page. A row with
four slots takes no more; at twelve rows no bar is drawn between rows (a slot whose row stays would make a
thirteenth), so the slot cannot become a row of its own there. Carried within 56 px of the page's top or bottom edge,
the page scrolls that way, faster the closer (up to 14 px a frame), so a slot reaches a row out of view, by finger as
by mouse. Each move is one undo step.

From the keyboard, the grip is focusable (it shows while focused) and the **arrow keys** swap the slot with its
neighbour that way: left and right in its row, up and down with the slot in the row above or below whose middle is
nearest its own. Focus follows the slot; at an edge nothing happens.

## Clearing a slot

**Clear Slot** and **Remove Slot** take what the slot showed off the dashboard. Where more goes with it, the slot's menu
asks first, in place:

- A slot showing a **Board or Sheet tab**: "Delete the <name> tab too? Kept, it stays in the tab bar." with **Keep
  the Tab** and **Delete the Tab Too** (the tab's own delete, a step of its own).
- A slot holding a **Sheet**: "Delete this sheet’s cells too? Kept, they stay in this document." with **Keep Its
  Cells** and **Delete the Sheet Too** (its sheet released from the store, as deleting a Sheet does).
- Anything else (a board, a view, a note) clears at once: a board's cards are the document's and stay.

Closing the menu asks nothing and changes nothing.

## Metric tiles

A metric with room (in a slot, or sized up on the canvas) is a **tile** rather than the header widget it is at its
small canvas size. It reflows by size:

| Tier    | When                                | Shows                                                                |
| ------- | ----------------------------------- | -------------------------------------------------------------------- |
| Widget  | under 90 px tall                    | The board header's widget, as before                                 |
| Compact | 90 to 150 px tall                   | Its glyph and name on the left, the figure and its line on the right |
| Regular | taller, or narrower than 300 px     | Glyph and name, the figure, its line, and a strip of its picture     |
| Large   | 230 px tall and 300 px wide or more | The picture in full: beside the figure from 520 px wide, else under  |

The figure grows with the tile (30% of its height or 20% of its width, between 28 and 72 px), its unit after it in
the muted ink. Each metric's figure, line and picture:

| Metric      | Figure                 | Line                           | Picture                                         |
| ----------- | ---------------------- | ------------------------------ | ----------------------------------------------- |
| Item Count  | cards                  | Across every board             | One bar split Not Started, In Progress, Done    |
| Completion  | % done (green at 100%) | N of M cards done              | A ring (a meter in a strip)                     |
| People      | people                 | With cards, most first         | The five with most cards, each with their count |
| Card Types  | types                  | N cards                        | A bar per type in its colour                    |
| Priorities  | urgent (red when any)  | N with a priority              | A bar per priority in its colour                |
| Due Soon    | overdue (red when any) | N due in the next 7 days       | One bar split Overdue (red), Due soon (amber)   |
| Unassigned  | unassigned             | Of N cards                     | One bar split Unassigned, Assigned              |
| Points      | done/total pts         | N cards estimated              | A ring of the share done                        |
| Top Voted   | votes                  | The card's title               | The card, which opens it                        |
| Stale Cards | stale (amber when any) | Not done, unchanged in 14 days | The five oldest, each opening its card          |

With nothing to count a tile says so in its line and draws no picture; while the cards load it says Loading cards….

## Templates

The Plan templates ([Plan templates](plan-templates.md)) make their tabs in these kinds:

- A tab the catalogue gives a board is a **Board tab** of that board alone; one it gives a Sheet, a **Sheet tab**.
- Every metric, chart and rail note across the template's tabs is gathered on its **Dashboard**: the template's own
  dashboard tab (one with views and no board), else an **Overview** Dashboard added as the last tab. Its rows, top to
  bottom: each Board and Sheet tab of the template, two to a row (480 px); the metrics, four to a row (160 px); a
  Gantt chart alone in its row (440 px); the other charts two to a row (360 px); the rail notes, three to a row
  (240 px), each a note headed by its first line. At most 12 rows.
- A rail's facilitation tools (a timer, a vote, a picker, a temperature check) are not kept.
- A template of nothing (Blank Plan) makes an empty tab, which shows Start Planning.

## Converting old Plan tabs

When someone who may edit opens a tab in Plan mode of the general kind that holds only Plan elements (boards,
Sheets and plan views), it becomes the new model, in one change and one undo step, with a toast saying so (**This tab
was updated to the new Plan layout.**). An undo keeps the old tab for the rest of the session; it converts again the
next time the document is opened:

- One board (or Sheet) and nothing else: the tab becomes a Board (or Sheet) tab, Fill Tab on.
- Anything more: each board and Sheet moves to a new Board or Sheet tab of its own, named after its title, placed
  right after this tab in its order; this tab becomes a Dashboard whose rows hold, in the elements' reading order
  (top to bottom, then left to right), the new tabs two to a row (480 px), then the metrics four to a row (160 px),
  a Gantt alone (440 px), then the other visualisations two to a row (360 px), at most 12 rows.
- A tab with anything else on it (a shape, a note, a free card) is left as it is. A Viewer or Participant sees an old
  tab as it is; it converts when an Editor opens it.

## Share roles

| Role        | Board and Sheet tabs                 | Dashboard tab                                                   |
| ----------- | ------------------------------------ | --------------------------------------------------------------- |
| Editor      | Everything the board or Sheet offers | Rows, slots, spans, heights, content, card style; Open; Show Me |
| Participant | What the board or Sheet lets them do | Looks, and Open; changes nothing on the dashboard               |
| Viewer      | Looks                                | Looks, and Open                                                 |

A Dashboard's layout is tab metadata; only an Editor's change to it is accepted. Gated on the session's `can.level === 'edit'`,
never on `isReadOnly`.

A **locked tab** refuses every change, as every edit there is: an Editor sees its Dashboard as a Viewer does (no cog,
grip, edges or editing in a card), and the Dashboard's writes (a layout change, a slot's content, a new kind from Start
Planning) are refused even when something asks (`usePlanTabActions`). A board's cards and a Sheet's cells are the
document's, not the tab's, so a lock leaves them as the board or Sheet offers.

## Telemetry

- `Plan · Created · BoardTab`, `SheetTab`, `DashboardTab` when Start Planning makes one.
- `Plan · Changed · DashboardRow`, `DashboardSlot`, `DashboardContent` for a layout change (one per gesture), and
  `DashboardLook` for a background change, `DashboardCardStyle` for a Utility's style change (one per pick, or per
  slider gesture).
- `Plan · Opened · DashboardSettings` when the Dashboard Settings cog opens.
- `Plan · Changed · TabConverted` when an old tab converts.

## Limits

- 12 rows × 4 slots: at most 48 slots. A Board or Sheet slot draws the source tab's content at slot size; each is
  rendered only while on screen, so a tall dashboard costs only what is visible.
