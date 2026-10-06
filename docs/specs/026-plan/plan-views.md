# Plan views

A **plan view** is an element that reads the document's cards and shows them a way a board cannot: a live
figure on its own (a **metric**), or a chart of every card (a **visualisation**). Plan views sit
anywhere on the canvas, beside the boards, and change as the cards do. They hold no cards and take none:
a card is never dropped into one.

## Domain language

| Term              | Meaning                                                                       | Not                   |
| ----------------- | ----------------------------------------------------------------------------- | --------------------- |
| **plan view**     | The element: one view of the document's cards, of one view kind               | chart, report         |
| **view kind**     | What a plan view shows (Completion, Project Gantt Chart, ...)                 | view type             |
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
  it (260 × 64 to start). Filter, Only Mine, Not on Board, WIP Alerts and Votes Left need a board and are
  not offered.
- A metric narrows nothing: pressing a person, a type or a priority does nothing. Completion with no
  Done phase reads **No done column**, and offers no set-up.

## Visualisations

The **Visualisations** palette category charts the cards. Each is resizable (720 × 400 to start; the Gantt
880 × 420), headed by its name and a count, and opens a card when its row, bar or entry is pressed.

| Visualisation       | Shows                                                                                      |
| ------------------- | ------------------------------------------------------------------------------------------ |
| Project Gantt Chart | A row per Project card on a time axis: a bar from its start to its due date                |
| Due Calendar        | This month as a grid, each day listing the cards due that day                              |
| Workload by Person  | A bar per assignee (and Unassigned), split Not Started, In Progress, Done, with counts     |
| Status Breakdown    | A donut of the cards by status, with a legend of each status and its count                 |
| Priority by Status  | A grid of priority (Urgent to Low, then None) by status phase, each cell the cards in both |

### Project Gantt Chart

- A row per Project card (type `project`), earliest start (or due date) first, then by number; the row names
  it, `#12` and its title, with its child cards' progress `done/total` (cards whose `parent` is the project).
- A project with a **start** and a **due date** is a bar between them, in the Project colour, the share of its
  children done filled solid. One with only a due date is a milestone diamond on that day; only a start, a
  hollow diamond there. Neither: **No dates**, muted. A start after the due date is drawn from the earlier date
  to the later one (the item panel says **Starts after it is due**).
- A row with a due date but no start, or with neither, offers a quiet **Add a start date** (to someone who may
  edit) that opens the card, where Start sits before Due.
- A project not done whose due date has passed draws its bar or diamond in red.
- The axis runs from a week before the earliest date to a week after the latest (today included), at least 28
  days; it ticks weeks (from Monday) up to 120 days, and months beyond. A line marks **today**.
- The header counts the projects: `3 projects`.
- Empty: **No projects yet. Add a Project card to a board to see it here.**

### Due Calendar

- The month opens on today's, weeks from Monday; **‹** and **›** step a month (each viewer's own, unsaved),
  and **Today** comes back. Today's day is ringed.
- Each day lists its due cards as a type-coloured dot and title, done ones muted and struck through, as many
  as fit and then **+N more**.
- The header counts the cards due that month: `5 due`. No card due that month: **Nothing due this month.**

### Workload by Person

- A row per assignee, most cards first, then **Unassigned** last; each bar is as long as the person's cards
  against the busiest row, split into Not Started, In Progress and Done, with the total at its end.
- A legend names the three phases. The header counts the cards: `14 cards`.
- Empty: **No cards yet. Add cards to a board to see who has what.**

### Status Breakdown

- A donut of every live card by status, in the order the document's boards name them (the open tab's first), then any other status, then
  **No status**; the legend gives each status its name (as a column calls it), colour and count. The donut's
  middle holds the total.
- The statuses take the tab theme's chart colours in turn, as a pie chart's slices do
  ([pie chart](../009-elements/pie-chart.md)), so a theme switch recolours both; **No status** is the muted ink.
- Empty: **No cards yet. Add cards to a board to see where they stand.**

### Priority by Status

- Rows Urgent, High, Medium, Low and **No Priority**; columns Not Started, In Progress and Done; each cell the
  cards in both, shaded by how many against the fullest cell, an empty cell blank.
- Empty: the Status Breakdown's copy.

## On the canvas

- A plan view is moved, resized, copied and deleted as any element. Its pressable parts take the pointer in Plan
  mode; in other modes a press selects the element. A double-click on an entry opens its card in any mode.
- **Small sizes and phones**: a view never spills from its box. Titles truncate with an ellipsis, rows clip,
  the calendar shows fewer entries a day, and the Gantt's names column narrows to a third of its width.
- Exports and thumbnails draw a plan view as a labelled box (its name), not the live chart.
- A plan view on a tab means the tab shows every card: a tab-scoped share link sees the cards it reads.

## Telemetry

- A plan view placed counts as `Element` · `Added` · `PlanView`, never the view kind.
