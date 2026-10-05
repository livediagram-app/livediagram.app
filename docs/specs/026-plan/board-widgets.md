# Board widgets

A Plan board's header is a row of **widgets**: small, live read-outs and controls (completion, a filter, who is
on the board) that a team picks and orders for the board. Widgets come from the palette's **Widgets** category
and are placed by dragging them into a board's header.

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
- A board with no widgets shows nothing in the zone; to someone who may edit, it says **Drag Widgets here from
  the palette** in muted type, with an info glyph.
- The zone ends in a **+** (for someone who may edit) that switches the palette to its Widgets category.
- A press on the zone's empty space selects (and moves) the board, as the rest of the header does.
- A board holds each kind **at most once**: a filter is the board's filter, not one of several.
- **Widgets that narrow the board**: pressing a person in People, a type in Card Types, the overdue or due-soon
  count in Due Soon, a priority in Priorities, or Unassigned shows only those cards; pressing it again shows all.
- **An empty board reads plainly**: People says "No people yet" and Unassigned "Nothing to assign" until the
  board has a card, so the two never contradict each other.
  One narrowing of each kind at a time, pressed while it is on. While anything narrows the board, Item Count reads
  `3 of 14 · Show all`, and pressing it clears every narrowing (the Filter text and Only Mine too).
- **Completion without a done column** offers **Set Done Column** to someone who may edit: it makes the board's
  last column the done one.
- Lone counts in widgets and column heads are badges: the figure in a small pill.
- The Filter and Only Mine widgets are each viewer's own and unsaved (the quick filter, see plan-board.md); taking
  either widget off the board clears that narrowing.

## Placing and arranging widgets

- **From the palette**: the **Widgets** category, after Boards, has a tile per kind. Dragged over a board's
  header, the zone highlights and a bar shows where the widget would go; dropped there, it is added at that
  place. Dropped anywhere else, nothing happens. A widget the board already has moves to the drop place instead, and flashes.
- **Tapped** (a phone, or a press without a drag), a widget tile adds the widget to the end of the selected board,
  or the only board on the tab; with no board to choose, it says **Select a board to add the widget to**. A
  widget the board already has flashes, and the editor says **Completion is already on this board**.
- **Reorder**: drag a widget left or right along the zone; the others make way at the bar, and it lands there.
  From the keyboard, a focused widget moves with Alt+← and Alt+→.
- **Remove**: a widget's × (shown on hover and focus, always on a touch screen), or Delete or Backspace while it
  is focused.
- Each placement, move and removal is one board edit: undoable, live for everyone, and saved with the board.
- Only someone who may edit the board places, moves or removes widgets; everyone sees and uses them.

## Defaults

- A new board starts with widgets that suit its kind:

  | Board      | Widgets                                                                          | Why                                     |
  | ---------- | -------------------------------------------------------------------------------- | --------------------------------------- |
  | Kanban     | Item Count, Completion, WIP Alerts, Stale Cards, Not on Board, Filter, Only Mine | Flow: limits, and work that has stalled |
  | Sprint     | Points, Completion, People, Unassigned, Filter, Only Mine                        | Burn-up, and who has what               |
  | Bug Triage | Item Count, Priorities, Unassigned, Stale Cards, Filter                          | Severity, ownership, forgotten bugs     |
  | Retro      | Votes Left, Top Voted, Card Types, People                                        | Voting, and the shape of the notes      |
  | Roadmap    | Item Count, Completion, Due Soon, People, Filter                                 | Dates and progress                      |
  | Week       | Due Soon, Item Count, People, Only Mine, Filter                                  | What is due this week                   |
  | All Cards  | Item Count, Card Types, Priorities, Unassigned, Filter                           | Sweeping every card, finding orphans    |
  | Archive    | Item Count, Card Types, Filter                                                   | Finding a card to restore               |
  | Blank      | Item Count, Completion, People, Filter, Only Mine                                | A start to build on                     |

- A board saved before widgets existed (and so naming none) shows the default set: **Item Count, Completion, Not on Board, Filter, Only Mine**, plus
  **Votes Left** on a board with voting on.
- A board saved before widgets existed shows that same default set, so it looks as it did.

## Telemetry

- A widget placed, moved or removed sends the set-up part `Widgets` (plan-mode.md "Telemetry"), never the kind.
