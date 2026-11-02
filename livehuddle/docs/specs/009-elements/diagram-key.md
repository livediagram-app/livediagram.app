# The diagram key

## What

A **Diagram key**: a legend that builds itself from what the tab uses, each row with a meaning you type. A
`shape: 'diagram-key'`. It lists:

- **Line styles** used by the tab's arrows: one row per distinct pattern (solid, dashed, dotted and the rest), drawn as
  a short arrow in that pattern.
- **Tag colours** ([Tag colours](tag-colours.md)): one row per mapped tag, drawn as a small card edge in its colour,
  with the tag as its starting meaning.

Change a line's pattern on the canvas, or map a new tag, and the key gains the row; stop using one and the row goes.

## Why

Every architecture template that uses two kinds of line hand-builds a key from loose lines and text, and it goes stale
the moment the diagram changes. The canvas knows which styles are in use; the key should too, so only the meaning is
the author's to write.

## The element

- **Title** is the element's label ("Key" by default), drawn small and bold at the top.
- **Rows** are derived, in this order: line styles in the order of the arrows that first use them, then tag colours
  in the map's order. At most 12 rows; past that the key shows the first 12.
- **Meanings** are stored per row (`keyMeanings: Record<string, string>`, keyed `line:<pattern>` or `tag:<tag>`, each
  at most 60 characters). A row with no meaning shows a starting one: "Solid line", "Dashed line" and so on, or the tag
  itself. Click a meaning once the key is selected to write it in place; Enter commits, Escape restores.
- **Stored rows**: the rows are worked out at the editor's commit point, when anything on the tab changes, and stored on
  the key (`keyRows`), so an export, a thumbnail or an API reader draws the same rows without re-deriving them. An
  agent's write settles them the same way: a tab built from elements (`buildTab`) and an edit (the edit operations'
  finalise), so the MCP's preview of a key an agent drew lists its lines rather than the empty hint.
- A meaning whose row has gone is kept, so a style switched off and on again keeps its meaning; a key keeps at most 24
  meanings, the oldest unused ones dropped first.

## Size

A new key is 260 wide and grows to fit its rows (28 px a row under a 32 px title); resizing it only changes its width.

## Animation

A key takes the **Shape** set. It is reference, not story, so it offers no entrance of its own.

## Palette

| Mode     | Where                                   |
| -------- | --------------------------------------- |
| Diagram  | **Build**: Diagram Key, after Boundary  |
| Workshop | none (Search still finds and places it) |

## Share roles

| Role        | May              |
| ----------- | ---------------- |
| Editor      | Everything above |
| Participant | Look             |
| Viewer      | Look             |

## Agents

The MCP server and the REST API take `diagram-key` with `label` and `keyMeanings`; the rows are derived when the board
next loads or changes.

## Element tour

The **Diagram Key tour** is on the footer's **Start Diagram Key Tour** button while a diagram key is selected, for an Editor on an unlocked element, and walks through
it on the element itself ([Element tours](../007-editor/element-tours.md) "The Diagram Key tour").
