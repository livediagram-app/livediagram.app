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
- A board with no widgets shows nothing in the zone; to someone who may edit, it says **Drag widgets here from
  the palette** in muted type.

## Widget kinds

| Kind       | Label        | Shows                                                                                                                           |
| ---------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| `count`    | Item Count   | Its glyph and how many items the board shows                                                                                    |
| `progress` | Completion   | A ring filled to the share of the board's items in its done column, the percent and `done · 9/14`; "No done column" without one |
| `filter`   | Filter       | A search box with its glyph, narrowing the cards to those whose text matches (the quick filter)                                 |
| `mine`     | Only Mine    | A toggle showing only the cards assigned to the viewer (signed-in or named viewers); tinted while on                            |
| `people`   | People       | The avatars of the people assigned cards on the board, up to five and "+n", and how many people                                 |
| `unplaced` | Not on Board | How many items have a status no column shows, amber while there are any; pressing it opens their list                           |
| `types`    | Card Types   | One bar split by type in each type's colour, then the three biggest types with their counts                                     |
| `wip`      | WIP Alerts   | A small bar per column, its cards against its limit (warning colour when over), and how many columns are over                   |
| `due`      | Due Soon     | Red and amber counts of cards overdue and due in the next 7 days; "Nothing due" with a green glyph otherwise                    |
| `votes`    | Votes Left   | The viewer's votes left as pips (a number past ten), on a board with voting on; nothing on any other board                      |

- A board holds each kind **at most once**: a filter is the board's filter, not one of several.
- The Filter and Only Mine widgets are each viewer's own and unsaved (the quick filter, see plan-board.md); taking
  either widget off the board clears that narrowing.

## Placing and arranging widgets

- **From the palette**: the **Widgets** category, after Boards, has a tile per kind. Dragged over a board's
  header, the zone highlights and a bar shows where the widget would go; dropped there, it is added at that
  place. Dropped anywhere else, nothing happens. A widget the board already has moves to the drop place instead.
- **Tapped** (a phone, or a press without a drag), a widget tile adds the widget to the end of the selected board,
  or the only board on the tab; with no board to choose, it says **Select a board to add the widget to**.
- **Reorder**: drag a widget left or right along the zone; the others make way at the bar, and it lands there.
  From the keyboard, a focused widget moves with Alt+← and Alt+→.
- **Remove**: a widget's × (shown on hover and focus, always on a touch screen), or Delete or Backspace while it
  is focused.
- Each placement, move and removal is one board edit: undoable, live for everyone, and saved with the board.
- Only someone who may edit the board places, moves or removes widgets; everyone sees and uses them.

## Defaults

- A new board from a template starts with **Item Count, Completion, Not on Board, Filter, Only Mine**, plus
  **Votes Left** on a board with voting on.
- A board saved before widgets existed shows that same default set, so it looks as it did.

## Telemetry

- A widget placed, moved or removed sends the set-up part `Widgets` (plan-mode.md "Telemetry"), never the kind.
