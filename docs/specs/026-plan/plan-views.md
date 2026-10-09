# Plan views

A **plan view** is an element that reads the document's cards and shows them a way a board cannot: a live
figure on its own (a **metric**), or a chart of every card (a **visualisation**). Plan views sit
anywhere on the canvas, beside the boards, and change as the cards do. They hold no cards and take none:
a card is never dropped into one.

## Domain language

| Term              | Meaning                                                                       | Not                   |
| ----------------- | ----------------------------------------------------------------------------- | --------------------- |
| **plan view**     | The element: one view of the document's cards, of one view kind               | chart, report         |
| **view kind**     | What a plan view shows (Completion, Gantt Chart, ...)                         | view type             |
| **metric**        | A plan view that is a board widget kind, free on the canvas                   | board widget (header) |
| **visualisation** | A plan view that charts the cards (Gantt, calendar, workload, status, matrix) | dashboard             |
| **status phase**  | Where a status sits in the work: Not Started, In Progress or Done             | stage, state          |

## What a plan view reads

- **Every live card in the document**: not archived, not in the Trash, whatever board (or none) it is on,
  as an All Cards board sees them.
- **Status phases** come from the document's boards, the open tab's first and then every other tab's in tab
  order (not All Cards or Archive boards), so a dashboard tab with no board reads the phases of the boards
  beside it ([Plan templates](plan-templates.md#hand-offs)): a board's first column is
  Not Started, its done column and every column after it are Done, and the columns between are In Progress.
  A board without a done column has no Done. A status two boards name takes the phase the first board gives
  it. A card with no status, or one no board names, is Not Started.
- **Done** is the Done phase: what a board would count as done.
- Before the cards arrive a plan view says **Loading cards…**; outside the editor (an export, a share view
  without cards) it shows its empty state.

## Metrics

The **Metrics** palette category holds the board widget kinds that read out rather than narrow a
board ([Board widgets](board-widgets.md)), each free on the canvas:

| Metric      | Shows, over every live card                            |
| ----------- | ------------------------------------------------------ |
| Item Count  | How many cards there are                               |
| Completion  | The share done                                         |
| People      | The people with cards, most first                      |
| Card Types  | The split by type                                      |
| Priorities  | Cards per priority                                     |
| Due Soon    | Cards not done that are overdue, and due within a week |
| Unassigned  | Cards nobody has                                       |
| Points      | Estimate points done of the total                      |
| Top Voted   | The card with most votes (pressing it opens it)        |
| Stale Cards | Cards not done that nobody changed in 14 days          |

- Each is drawn exactly as in a board's header, on a small card of the canvas theme's board colours, sized to
  it (260 × 64 to start). Filter, Only Mine, Not on Board and WIP Alerts need a board and are
  not offered.
- A metric narrows nothing: pressing a person, a type or a priority does nothing. Completion with no
  Done phase reads **No done column**, and offers no set-up.

## Visualisations

The **Visualisations** palette category charts the cards. Each is resizable (720 × 400 to start; the Gantt
880 × 420), headed by its name and a count, and opens a card when its row, bar or entry is pressed.

| Visualisation      | Shows                                                                                       |
| ------------------ | ------------------------------------------------------------------------------------------- |
| Gantt Chart        | A row per card of its card types (Project by default) on a time axis: start to due as a bar |
| Due Calendar       | This month as a grid, each day listing the cards due that day                               |
| Cards by Field     | A bar per value of a field (Assignee by default), split Not Started, In Progress, Done      |
| Priority by Status | A grid of priority (Urgent to Low, then None) by status phase, each cell the cards in both  |
| Card Search        | The cards matching the filters in its top bar, a row each                                   |

- **Status Breakdown** (`status-mix`) is retired: the palette and the templates no longer offer it, and a new view
  element starts as Cards by Field. One already placed in a document still draws, as it did.

### Card types for every view

- Every metric and visualisation charts only the card types it shows. Its element menu's **View** flyout has
  **Card Types**, a tile per card type that can feed it (pressed while it shows that type), with a note saying
  which fields a type needs to be listed: a Gantt chart needs Start and Due ("Only card types with Start and Due
  fields show here."), a Due Calendar Due, Priority by Status and the Priorities metric Priority, the People and
  Unassigned metrics Assignee, the Due Soon metric Due, the Points metric Estimate and the Top Voted metric Votes;
  the rest list every type. At least one stays pressed.
- A view other than the Gantt chart shows every type it can until told otherwise, stored as the `types` it names
  only when that is not every listed type; the Gantt chart keeps its own default (Project). A named type that has
  lost a needed field is not listed and drops out of the view, but stays named, so it comes back when the type has
  the field again. Telemetry: `Plan` · `Changed` · `ViewTypes` (`GanttTypes` for a Gantt chart).

### Maximised view

- A visualisation can be maximised like a board ([Maximised board](plan-board.md#maximised-board)): in Plan mode
  its header ends with **Maximise View** (a maximise icon, with a tooltip). Maximised, it fills the canvas area,
  the editor's chrome staying as the person has it (as a maximised board does); everything in it works as on the canvas (the Gantt's scale, scrolling and date drags, the
  calendar's months, opening a card). **Restore View** in the same place, or **Escape** when no dialog is open,
  puts it back.
- Maximised, the view lays itself out at the canvas area's size (the Gantt's names column limit and axis labels, the
  calendar's fit), not the element's; restored, at the element's again. Maximising and restoring keep its state:
  the Gantt's scale, window and collapsed lanes, and a drag in progress, carry over.
- It is the person's own view: nothing is saved or sent, the element keeps its size and place, and it ends on its
  own when the view leaves the screen or Plan mode. A metric is too small to need it and has no button.
- Telemetry: `Plan` · `Toggled` · `ViewMaximised` and `ViewRestored`.

### Gantt Chart

- **Card types**: the chart draws the live cards of the card types it accepts, **Project** by default
  (`planView.types`, a list of card type ids; absent is `['project']`). Any type can be accepted, a custom one
  included: its cards' **Start** and **Due** draw the bar. The types are chosen in the chart's element menu (see
  [Card types](#card-types)). A type the catalogue no longer has accepts nothing (its id stays in the list, so the
  rows come back if the type does).
- A row per accepted card, in the chart's own **row order** when one is set (see [Row order](#row-order)), else
  earliest start (or due date) first, then by number; the row names it, its colour dot
  when it has a Colour, `#12` and its title, with its child cards' progress `done/total` (cards whose Parent field,
  `parent`, is the row's card).
- A card with a **start** and a **due date** is a bar between them, in its own
  [Colour](items.md#colour) when it has one, else its card type's colour, the share of its
  children done filled solid. One with only a due date is a milestone diamond on that day; only a start, a
  hollow diamond there. Neither: the row's timeline is empty. A start after the due date is drawn from the earlier date
  to the later one (the item panel says **Starts after it is due**).
- **Drawing dates** (to someone who may edit): on a card with neither date, its row's timeline draws them (no
  words say so; the dashed week under the pointer does). A card of a type whose panel does not offer Start or Due
  can still be drawn: the dates are stored on the card (any card may carry any built-in field) and drive its bar. Under the pointer a dashed week shows from the day it is over; a
  click gives the project that week (start on the day, due six days later), and a drag gives the days it spans
  (either way), named above it as it grows (**6 Oct → 12 Oct**). It is one change (start and due together), after
  which the bar's ends and body drag as any bar's. A press on that row's timeline draws; it does not open the card
  (its name does). Escape or a cancelled pointer drops the draw. Telemetry: `Plan` · `Changed` · `GanttDrawn`.
- A project not done whose due date has passed draws its bar or diamond in red (its edge; red wins over a
  project's Colour).
- **Dragging dates** (to someone who may edit): each end of a bar is a handle. Dragged sideways it moves that
  end's date (the start or the due date, whichever the end shows) by whole days, never past the other end; a
  diamond drags its one date the same way. The bar's body, between its ends, drags the whole bar: both dates
  move by the same days, so its length stays. While dragging, the bar or diamond follows the pointer and a label
  above it names the day (**12 Mar**), or a moved bar's two days (**6 Oct → 25 Oct**); letting go applies it as one change, undone in one step, and a
  drag that ends on the day it began changes nothing. A press without a drag still opens the card. The handles
  show a resize cursor and a grip on hover, the bar's body a grab cursor; a person who may not edit gets
  none of them.
- **Scale**: the chart shows a window of time at one of three scales, picked in its header: **Month** (35 days),
  **Quarter** (91 days) or **Year** (365 days). It opens on the smallest scale that holds every project's dates
  (from a week before the earliest to a week after the latest, today included), else Year, starting a week
  before the earliest date. The window ticks weeks (from Monday) up to 120 days, and months beyond; a line marks
  **today**. A bar or diamond outside the window is cut off at its edge.
- **Scrolling the timeline**: **‹** and **›** in the header step the window a third of its length earlier or
  later; a sideways scroll (a trackpad swipe, or Shift with the wheel) over the timeline moves it day by day;
  and dragging the axis (the dates strip) pans it. **Today** brings today back into view, a quarter of the way
  in, at the current scale. Changing the scale keeps the window's middle where it was.
- The scale and the window are the viewer's own, like the Due Calendar's month: never saved, never sent to
  others, and back to the opening fit when the chart is next drawn fresh. They answer only while the chart takes
  input (Plan mode); elsewhere the chart shows its opening fit and the canvas keeps the wheel.
- **Status**: a row shows its project's status after the title, before `done/total`: a small pill naming the
  status (as the boards name it), tinted by its status phase (Not Started, In Progress or Done, the phase colours
  of the views' key). The title truncates first so the pill stays whole; where the names column is under 160 px
  the pill is a dot of the phase colour with the status name in a tooltip. A project with no status shows none.
  The row's accessible name includes the status ("#12 Launch, In Review, 1 of 3 done").
- **Names column width**: the names column is at most 220 px and a third of the chart by default. Someone who
  may edit resizes it by dragging its right edge (a 6 px strip with a resize cursor and a 2 px line on hover and
  while dragging), or by focusing that edge (a vertical separator) and pressing **←** or **→** to step 16 px. It
  stays between 120 px and 60 % of the chart's width, and never more than 2000 px (what a saved width may be). While dragging the columns follow the pointer; letting go
  saves the width on the chart (`planView.namesWidth`, synced and undone as one change), and Escape drops the drag.
  A chart without one keeps the default.
- The header counts the rows: `3 cards`.
- Empty: **No cards of these types yet.**
- **Drags and draws pin the timeline**: from the moment a date drag or draw begins, the window and scale stay
  where the viewer sees them (as though the viewer had picked them), so a change that moves the chart's dates
  never shifts the timeline under the pointer. A drag that ends off its handle (the pointer ran past a clamped
  end) never opens the card the release lands on.

#### Swimlanes

- A Gantt chart can group its rows into **swimlanes** with the same choices as a board
  ([Swimlanes](plan-board.md#swimlanes-by-a-field)): **None** (the default), **Assignee**, **Type**,
  **Priority**, **Project**, **Status**, then any field a board can lane by. Lanes are named, ordered and
  coloured exactly as a board's (a person's avatar, a project's colour dot, Choice options in order, "No
  _field_" last); rows keep the chart's order inside their lane.
- The grouping belongs to the chart element (`planView.swimlaneBy`, and `swimlaneField` for a field): one
  change, synced to everyone and undone like any element edit.
- It is set from the chart's element menu: a **View** flyout (after Style) holding two collapsible rows,
  **Card Types** ([Card types](#card-types)) and **Swimlanes**, a tile grid like the board's. Telemetry: `Plan` ·
  `Changed` · `GanttSwimlanes`.
- Each lane is a header row across the chart (24 px): in the names column a chevron, the lane's avatar, glyph or
  colour dot, its name and its count of projects; the timeline side carries only the gridlines. A lane collapses
  on its own, per person, like a board's. A lane with no projects is left out (nothing is dropped into a Gantt
  lane). Everything else works inside a lane: dragging and drawing dates, opening a card, the scale and
  scrolling.

#### Row order

- Someone who may edit can **drag a row to a new place**. Hovering a row's name (or focusing it) shows a six-dot
  grip at its left edge (a grab cursor, a tooltip **Drag to Reorder**). Dragging the grip lifts the row: the name row
  and its timeline row follow the pointer up and down, and a line marks the gap it would drop into. Letting go
  places it there as one change, synced and undone like any element edit; letting go where it started, or
  Escape, changes nothing. A press on the grip never moves the chart element, opens the card or starts a date
  drag; the row's name still opens the card.
- **Keyboard**: with a row's name focused, **Alt+↑** and **Alt+↓** move it one place, announced ("Moved #12
  Launch to position 3 of 8").
- With **swimlanes** on, a row moves only within its lane: dragging past the lane's first or last row stops
  there, and the lanes keep their own order.
- The order belongs to the chart (`planView.rowOrder`, a list of card ids, at most 2000): the cards it names come
  first, in its order; cards it does not name (newly made, or newly accepted) follow in date order. A card that
  leaves the chart (deleted, archived, its type no longer accepted) is ignored, and dropped from the list on the
  next reorder.
- **Sort by Date**, an action row in the chart's **View** flyout (shown while an order is set), clears the order:
  the rows go back to date order.
- It works the same maximised. The chart does not scroll its rows (a chart taller than its rows is clipped, as
  before), so a drag never auto-scrolls.
- Telemetry: `Plan` · `Changed` · `GanttRowOrder` (a drag, a keyboard move, or Sort by Date).

#### Card types

- **Only card types with both a Start and a Due field** can be on a Gantt chart, since every card is drawn as a bar
  from one to the other. A Project always qualifies; another type does once both fields are added to it in Edit
  Card Type. A type the chart names that loses either field is not drawn until it has both again (the setting
  keeps naming it).
- The chart's **View** flyout has a collapsible **Card Types** row: an info note ("Only card types with Start and Due fields show here."), then a tile per qualifying type (its glyph in its colour and its name),
  pressed when the chart accepts it, as the board's **Card Types** tiles are. A press toggles it; the last one
  pressed cannot be let go (at least one type stays on).
- The choice belongs to the chart element (`planView.types`), one change, synced and undone like any element
  edit; choosing exactly Project again leaves the default (the setting is dropped). Telemetry: `Plan` · `Changed` ·
  `GanttTypes`.

### Due Calendar

- The month opens on today's, weeks from Monday; **‹** and **›** step a month (each viewer's own, unsaved),
  and **Today** comes back. Today's day is ringed.
- Each day lists its due cards as a type-coloured dot and title, done ones muted and struck through, as many
  as fit and then **+N more**.
- The header counts the cards due that month: `5 due`. No card due that month: **Nothing due this month.**

### Cards by Field

- Once **Workload by Person** (the same `workload` view, renamed). A row per value of the field it groups by, as a
  board's swimlanes group ([Swimlanes](plan-board.md#the-board-set-up)): **Assignee** unless set (a person's disc and
  name, most cards first), or Priority, Type, Status, Labels, Estimate, Start Date, Due Date or any grouping custom
  field (Parent among them). The empty group ("No assignee", "No priority"...) is last. Each bar is as long as its cards against
  the fullest row, split into Not Started, In Progress and Done, with the total at its end.
- Its element menu's **View** flyout has **Group By**, the board's Swimlanes grid without None, listing what the
  view's card types offer (stored as `swimlaneBy` and `swimlaneField`; Assignee is the default, not stored).
  Telemetry: `Plan` · `Changed` · `ViewGrouping`.
- A legend names the three phases. The header counts the cards: `14 cards`.
- Empty: **No cards yet. Add cards to a board to see how they split.**

### Status Breakdown (retired)

- Drawn only where one was placed before it was retired. A donut of every live card by status, in the order the document's boards name them (the open tab's first), then any other status, then
  **No status**; the legend gives each status its name (as a column calls it), colour and count. The donut's
  middle holds the total.
- The statuses take the tab theme's chart colours in turn, as a pie chart's slices do
  ([pie chart](../009-elements/pie-chart.md)), so a theme switch recolours both; **No status** is the muted ink.
- Empty: **No cards yet. Add cards to a board to see where they stand.**

### Priority by Status

- Rows Urgent, High, Medium, Low and **No Priority**; columns Not Started, In Progress and Done; each cell the
  cards in both, shaded by how many against the fullest cell, an empty cell blank.
- Empty: the Status Breakdown's copy.

### Card Search

- A filter bar along its top, then the matching cards, a row each (type glyph, number, title, state, assignee), in
  the document's order; a row opens its card as any view's entry does. The header counts them: `12 cards`.
- A **filter** is a field and a value, shown as a chip ("Card Type: Project", "State: Done", "Assignee: No
  assignee") with a cross that removes it; a card must match every filter. A field is any of a board's groupings
  (Card Type, State, Assignee, Priority) or lane fields (Labels, Estimate, Start Date, Due Date, any grouping
  custom field, Parent among them), and a value is one of its lanes, named and ordered as a board's swimlanes are, the empty one ("No
  assignee") included. At most 8 filters.
- **Add Filter** (a dashed pill with a plus) opens a popover drawn over the page, so it reads at its own size
  whatever the canvas zoom: first the fields still worth filtering, those the matching cards' types offer (all
  types when none match), Card Type only while they hold more than one type, less the fields already filtered;
  picking one shows its values among the matching cards ("State is", with a back arrow), each with its count, so no
  filter ever leaves nothing; picking a value adds the filter and closes it. A list longer than 8 has a box to
  narrow it. **Clear All** removes every filter.
- The filters are the view's own, saved with it (`filters`: `{ by, field?, key }`), so everyone sees the same
  search. Someone who may only view, or a view outside Plan mode, shows the chips without crosses or Add Filter.
- Empty: "No cards match these filters." (with filters), "No cards yet. Add cards to a board." (without).
  Telemetry: `Plan` · `Added` / `Removed` · `SearchFilter`.

## On the canvas

- A plan view is moved, resized, copied and deleted as any element. Its pressable parts take the pointer in Plan
  mode; in other modes a press selects the element. A double-click on an entry opens its card in any mode.
- **Small sizes and phones**: a view never spills from its box. Titles truncate with an ellipsis, rows clip,
  the calendar shows fewer entries a day, and the Gantt's names column narrows to a third of its width.
- Exports and thumbnails draw a plan view as a labelled box (its name), not the live chart.
- A plan view on a tab means the tab shows every card: a tab-scoped share link sees the cards it reads.

## Telemetry

- A plan view placed counts as `Element` · `Added` · `PlanView`, never the view kind.
