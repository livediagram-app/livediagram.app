# Comparison and pricing tables

## What

Two additions to the Table ([Canvas and palette](../008-canvas/canvas-and-palette.md) "Table") that turn a grid of
words into the comparison and pricing tables decks and landing pages use:

1. **Ticks and crosses**: a cell holding just a tick or a cross draws it as a mark, a green tick or a rose cross on a
   soft disc, instead of a small character.
2. **A highlighted column**: one column can be marked as the recommended one. It is tinted, framed in the accent,
   and its header cell is filled with the accent.

Text cells stay text, so a row can mix marks and words ("✓", "✗", "Up to 5", "Unlimited").

## Why

A feature comparison is rows of yes and no, and a pricing table is the same grid with one plan pushed forward. The
table could hold "✓" and "✗" as characters, but they came out as small glyphs in the text colour, hard to scan, and
nothing could say which plan you recommend except a hand-coloured column that a theme change undid. The Pricing
Tiers and Three Options layouts build their own ticks and badges from loose shapes; a table is the right element
when the options are compared feature by feature.

## Marks

A cell is a **mark** when its whole text, trimmed, is one of:

| Mark    | Text                     | Drawn                                       |
| ------- | ------------------------ | ------------------------------------------- |
| `tick`  | `✓` `✔` `✅` `☑` `✓︎`     | a tick stroked in green on a 14% green disc |
| `cross` | `✗` `✘` `✕` `❌` `×` `☒` | a cross stroked in rose on a 14% rose disc  |

- The mark is the cell's text, so it is what a copy, a CSV, a Markdown or Word export, search and agents read. No new
  field is stored.
- Green is `#15803d` on light paper and `#4ade80` on dark; rose `#be123c` and `#fb7185`, each lifted until it meets
  **3:1** against the cell (a graphic, WCAG 1.4.11). A cell's own text colour, when set, paints the mark instead.
- The disc's diameter is the cell's font size × 1.5, capped by the cell's height less its padding, and it sits where
  the cell's alignment puts text.
- A screen reader reads a mark cell as "Yes" or "No" (`aria-label`).
- **Putting marks in.** Type the character, or use the cell's right-click menu: a **Marks** row of **Tick**,
  **Cross** and **Clear**, which set every selected cell at once (one undo step). Editing a mark cell shows its
  character, so it can be typed over.

## The highlighted column

`highlightColumn?: number` on the table: the index of the recommended column, absent for none.

- **Drawn**: the column's body cells take a wash of the accent (10%) under any zebra stripe; its header cell (in a
  table with a header row) is filled with the accent, its ink white or the table's ink, whichever meets 4.5:1; and a
  2 px accent frame runs round the whole column, over the grid lines. A cell's own background still wins.
- **Set** from the column's ⋯ menu: **Highlight Column** (or **Remove Highlight** on the highlighted column). Picking
  another column moves the highlight; there is at most one.
- **Kept in step**: inserting a column before it moves it right, deleting it removes the highlight, deleting a column
  before it moves it left, and moving it carries it.
- **Theme-safe**: the highlight is drawn from the table's accent (its stroke), so a theme change recolours it.
- **Validation**: a whole number within the table's columns; anything else is refused like any bad field.

## Templates and palette

- **Pricing Table** slide layout (Data): a title and a lead over one table, five features down the side and three plans
  across, a price row first, then ticks and crosses, the middle plan's column highlighted.
- No new page layout: the Compare category already holds its twelve (pages-mode.md "Layouts", at most twelve to a
  category), and its Pricing Tiers keeps its cards. A page gets a comparison by placing the Pricing Table slide's table,
  or any table with ticks typed in.
- The Tools palette's **Table** stays one tile; the layouts are the way in to a ready comparison.

## Roles

Marks are cell text, so whoever may write a table's cells may set them (an Editor, and a Participant, who may write any
table's cells, by typing the tick or cross: the cell menu with its Marks row is an Editor's, like the rest of the cell
styles). The highlight is the table's structure: an Editor's alone, like inserting or
deleting a column. A Viewer sees both and changes neither.

## Agents and export

- The MCP element docs say a cell of exactly "✓" or "✗" draws as a tick or a cross, and name `highlightColumn`.
- Every export (SVG, PNG, PDF and PowerPoint, which draws a table as a picture) draws the marks and the highlight
  from the same helpers as the canvas (`tableCellMark`, `tableMarkColours`, `tableHighlightColours`).

## Non-goals

- Partial marks (a half tick, "limited"): write the words.
- More than one highlighted column, or highlighted rows.
- A "Recommended" ribbon above the table: a Badge attached to the table does that.
