# Plan blueprint defaults

One row per default applied where a spec is silent or qualitative.

| #   | Blueprint     | Spec silence                                     | Default applied                                                       |
| --- | ------------- | ------------------------------------------------ | --------------------------------------------------------------------- |
| D1  | item-store    | Rank alphabet                                    | Base-36 fractional keys, first key `i`                                |
| D2  | item-store    | Order of two items with the same rank            | By key, ascending                                                     |
| D3  | item-store    | Who may restore a deleted item's key             | Anyone with edit, only while the key is free and below the next key   |
| D4  | item-store    | Undo of a field someone else changed since       | Writes the old value (last write wins), as canvas undo does           |
| D5  | plan-board    | Board and card default sizes                     | 1120×640 board, 240×120 card                                          |
| D6  | plan-board    | Default type of a typed title in Add a Card      | Task                                                                  |
| D7  | plan-board    | Column minimum width                             | 220 px; narrower boards scroll columns sideways                       |
| D8  | plan-board    | How item panel edits group for undo              | One step per field per 400 ms pause                                   |
| D9  | plan-mode     | Where Boards and Cards sit                       | Plan's only categories, under a Plan band heading; opens on Cards     |
| D10 | item-types    | A new type's starting look and fields            | Cyan, star glyph; Title, Status, Description, Assignee                |
| D11 | item-types    | Longest Choice option                            | 40 characters                                                         |
| D12 | item-types    | Field reordering in the type editor              | ↑ and ↓ buttons per row (drag is for the panel's type rows)           |
| D13 | plan-mode     | The gap a dragged palette card opens             | 56 px: the card does not exist yet, so it has no size to borrow       |
| D14 | plan-board    | A board's corner radius with none set            | 12 px                                                                 |
| D15 | plan-board    | Ink contrast before it is swapped                | 4.5:1 against the fill                                                |
| D16 | plan-mode     | Where the card menu opens from the keyboard      | Under the card's left edge                                            |
| D17 | board-widgets | Widget pill height                               | 28 px, the header's control height                                    |
| D18 | board-widgets | Distance before a press becomes a reorder        | 4 px                                                                  |
| D19 | board-widgets | "Due soon" horizon                               | 7 days, today included                                                |
| D20 | plan-board    | Wait before a description is saved               | 800 ms after the last keystroke, and at once on blur or close         |
| D21 | item-types    | A new tab's name                                 | "New Tab"                                                             |
| D22 | board-widgets | Days without a change before a card is stale     | 14                                                                    |
| D23 | board-widgets | What Set Done Column marks                       | The board's last column                                               |
| D24 | items         | Where archived cards go on an Archive board      | All in its one column, in rank order                                  |
| D25 | plan-views    | Plan view default sizes                          | Metric 260×64, Gantt 880×420, other visualisations 720×400            |
| D26 | plan-views    | Which statuses are not started, in progress      | A board's first column, then the columns before its done column       |
| D27 | plan-views    | Gantt axis padding and tick spacing              | A week each side, 28 days at least; weeks up to 120 days, then months |
| D28 | plan-tour     | How long to wait for items before the card steps | 3000 ms, then the card steps are skipped                              |
