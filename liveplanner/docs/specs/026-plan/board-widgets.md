# Board widgets

A Plan board's header is a row of **widgets**: small, live read-outs and controls (completion, a filter, who is
on the board) that a team picks and orders for the board. Widgets are added from the **+** at the end of a board's
header; they are not in the palette.

## Domain language

| Term            | Meaning                                                                          | Not          |
| --------------- | -------------------------------------------------------------------------------- | ------------ |
| **widget**      | One read-out or control in a board's header, of one widget kind                  | gadget, card |
| **widget kind** | What a widget is (Completion, Filter, ...); a board holds each kind at most once | widget type  |
| **widget zone** | The part of a board's header that holds its widgets, after the title             | toolbar      |

## The header

- The header holds, left to right: the board's **title**, the **widget zone**, then the controls a board needs
  whatever its widgets are (**Reveal** on a hide-writing board, **Retry** when items failed to load).
- The widget zone is one row. Widgets keep their order; when they do not fit, the zone scrolls sideways.
- Widgets are drawn for the header: the same height (28 px), a quiet border, the board's own theme colours,
  each led by a picture of what it measures (its glyph, a ring, a split bar, column bars or pips).
- A board with no widgets shows nothing in the zone. Only while the board is selected does it say, to someone
  who may edit, **Add widgets to this board** in muted type, with an info glyph and the **+**; an unselected board's
  header stays clean. Maximised or filling its tab (where no selection shows), the widgets' place in the controls
  card keeps its **+** for someone who may edit, so the hairline before the cog never stands alone; someone who may not
  edit sees neither the zone nor its hairline there.
- **Not on a phone**: below 640 px the header shows no widgets and their narrowing stands down
  ([Plan board](plan-board.md#on-a-phone)).
- The zone ends in a **+** (for someone who may edit, tooltip-free, named "Add a widget") that opens the widget
  gallery below it.
- A press on the zone's empty space selects (and moves) the board, as the rest of the header does.
- A board holds each kind **at most once**: a filter is the board's filter, not one of several.
- **Widgets that narrow the board**: pressing a person in People, a type in Card Types, the overdue or due-soon
  count in Due Soon, a priority in Priorities, or Unassigned shows only those cards; pressing it again shows all.
- **An empty board reads plainly**: People says "No people yet" and Unassigned "Nothing to assign" until the
  board has a card, so the two never contradict each other.
  One narrowing of each kind at a time, pressed while it is on. While anything narrows the board, Item Count reads
  `3 of 14 · Show all`, and pressing it clears every narrowing (the Filter text and Only Mine too).
- **Completion without a done column** offers **Set Done Column** to someone who may edit: it makes the board's
  last column count as done ([Done columns](plan-board.md#done-columns)).
- **Completion's percent** (and Points', and the dashboard tiles') is the share done, rounded, but reads 100% only when
  every card is done and 0% only when none is: 199 of 200 is 99%, 1 of 300 is 1%. Points counts points, not cards,
  so it reads 100% once every point is done (an unestimated card left open counts for nothing); a dashboard Sheet
  Metric's goal percent reads 100% only once its target is met.
- **Not done** means a card in a column that does not count as done ([Done columns](plan-board.md#done-columns)).
  Due Soon's overdue and due-soon counts, Stale Cards and their dashboard tiles count only those, and Due Soon's
  narrowing shows only those: a card in Done, Won't Do or any other done column is never overdue or stale. A board
  with no done column counts every card. Completion and Points count every done column's cards as done.
- Lone counts in widgets and column heads are badges: the figure in a small pill.
- The Filter and Only Mine widgets are each viewer's own and unsaved (the quick filter, see plan-board.md); taking
  either widget off the board clears that narrowing.

## Placing and arranging widgets

- **Add**: the zone's **+** opens the **widget gallery** under it (see below). Picking a widget adds it at the end
  of the header and closes the gallery; the + pressed again, Escape or a press outside closes it.
- **Reorder**: drag a widget left or right along the zone; the others make way at the bar, and it lands there.
  From the keyboard, a focused widget moves with Alt+← and Alt+→.
- **Remove**: a widget's × (only while the board is selected, and then only on hover over the widget, while it has keyboard focus, or once a touch has tapped it: a maximised or tab-filling board is always selected, and a × on every widget all the time read as clutter), or Delete or Backspace while it
  is focused.
  Once one is taken off, nothing of it stays selected: no widget keeps the tap or the focus. A tapped widget's × goes away
  again on a tap anywhere outside the widget zone, or Escape.
- Each placement, move and removal is one board edit: undoable, live for everyone, and saved with the board.
- Only someone who may edit the board places, moves or removes widgets; everyone sees and uses them.

## The widget gallery

**Add a Widget**, a 560 px popover, with the line "Widgets sit in the board’s header, live as its cards change." and a
**Find a widget** search beside the title (focused on open). Under it, every widget in three sections, each with its
line:

| Section         | Line                                                | Widgets                                                       |
| --------------- | --------------------------------------------------- | ------------------------------------------------------------- |
| Focus the Board | Narrow the cards to the ones that matter right now. | Filter, Only Mine, People, Priorities, Card Types, Unassigned |
| Track Progress  | See how the work is going at a glance.              | Item Count, Completion, Points, Due Soon, Top Voted           |
| Keep It Healthy | Catch what is stuck, overloaded or off the board.   | WIP Alerts, Stale Cards, Not on Board                         |

- Each widget is a **card** two to a row: a strip on top drawing the widget **live**, from this board's own cards in
  its own colours, exactly as it would sit in the header (inert there); under it its glyph, name and line.
- A widget already on the board is left out of the gallery (a section with none left goes too). The others are named
  "Add <name>" and lift a pixel on hover (not with reduced motion).
- The search narrows the cards to those whose name or line holds the text, dropping empty sections; with none left
  it shows the shared empty state, **No widgets match “<text>”**. With every widget on the board it says **No widgets
  left to add** ("Every widget is on this board."), as [Empty states](../004-interface-design/empty-states.md).
- The arrow keys move between the cards that can be picked (left and right one, up and down a row).

## Defaults

- A new board starts with **few** widgets, only ones that read true on that board from the start; the rest are a
  **+** away. The rules every board's defaults keep:
  - **Completion** only on a board with a done column (it would read 0% for ever, or ask to set one).
  - **WIP Alerts** only on a board whose columns have WIP limits.
  - No widget that repeats the board's rows: no People on a board laned by person, no Priorities on one laned by
    priority.
  - **Item Count** is left out where Completion already counts the cards.
  - **Only Mine** never by default: Filter and People already narrow.

  | Board      | Widgets                        | Why                                                             |
  | ---------- | ------------------------------ | --------------------------------------------------------------- |
  | Kanban     | Completion, WIP Alerts, Filter | Flow against its limits, and finding a card                     |
  | To-do List | Completion, Due Soon           | How much is done, and what is due; a short list needs no Filter |
  | Sprint     | Points, Completion, Filter     | Burn-up in points; its rows already show who has what           |
  | Bug Triage | Item Count, Unassigned, Filter | Bugs nobody owns; its rows already show severity                |
  | Retro      | Top Voted                      | Notes are hidden until revealed, so nothing else to read        |
  | Roadmap    | Item Count, Due Soon, Filter   | Dates; Now, Next and Later has no done column, so no Completion |
  | Week       | Item Count, Due Soon, Filter   | What is due this week; the days have no done column             |
  | All Cards  | Item Count, Card Types, Filter | Sweeping every card by kind                                     |
  | Archive    | Item Count, Filter             | Finding a card to restore                                       |
  | Blank      | None                           | A clean start: no columns yet, so nothing to measure or filter  |

- A Plan template's boards follow the same rules ([Plan templates](plan-templates.md)); a template board that
  names no widgets of its own takes its preset's.
- This sets what a **new** board starts with; a board already made keeps the widgets it has.
- A board saved before widgets existed (and so naming none) shows the default set: **Item Count, Completion, Not on Board, Filter, Only Mine**. A board
  that listed **Votes Left** (from when boards had their own voting) shows it no more.
- A board saved before widgets existed shows that same default set, so it looks as it did.

## Telemetry

- A widget placed, moved or removed sends the set-up part `Widgets` (plan-mode.md "Telemetry"), never the kind.
