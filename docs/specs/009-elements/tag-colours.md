# Tag colours

## What

**Colour by tag**: a tab-level map from a card tag to a colour. A [Card](card.md) carrying a mapped tag takes that
colour as its [accent edge](../008-canvas/accent-edge.md), and the tag's chip is tinted with it, so colour-coding by
team, status or layer stays consistent: retag a card and its colour follows, change a tag's colour once and every card
with it changes.

## Why

Colour-coding a diagram by team or status is the most common reason people restyle nodes one at a time, and it drifts:
the fifth Payments card is a slightly different orange, and a card that moved to another team keeps its old colour.
Tags already say what a card belongs to; the colour should follow the tag, not the hand.

## The map

```ts
tagColours?: { tag: string; color: string }[]; // on the Tab, at most 12
```

- A tag matches case-insensitively, trimmed (`Platform` and `platform ` are one tag); the map keeps the casing it was
  first written with.
- One colour per tag; setting a tag's colour again replaces it; clearing it removes the row.
- A colour is a hex colour, as every element colour is.
- It belongs to the tab (it travels with the tab, is undone with it, and syncs to everyone on it).

## On a card

A card's **tag colour** is the colour of its first tag (in the card's tag order) that has one.

- With a tag colour, the card draws an accent edge in it: on the side its own `accentEdge` names, else the **left**.
  A card that has its own **Edge Colour** keeps it (an explicit pick wins over the map).
- Every tag chip with a colour is tinted with it: a light wash of the colour, its border and its text in the colour.
- Nothing is stored on the card: the tag and the tab's map decide at render, so the canvas, exports and thumbnails
  agree and a retag recolours at once.

To stop a card showing a tag's colour, clear that tag's colour (or remove the tag from the card).

## Editing

A **Tag Colours** block in the card's **Card** section lists the selected card's tags, each with a colour row (the
shared colour picker: [Colour picker](../004-interface-design/colour-picker.md)) and, once set, **Clear** beside it.
The picker's **No Colour** clears it the same way.
Picking a colour sets the tag's colour for the whole tab, in one history step. The [Diagram key](diagram-key.md) lists
the map.

## Share roles

| Role        | May                                       |
| ----------- | ----------------------------------------- |
| Editor      | Set and clear tag colours                 |
| Participant | Look (the map is structure, like a theme) |
| Viewer      | Look                                      |

## Agents

The MCP server and the REST API take `tagColours` on a tab; an agent colour-codes a diagram by tagging cards and
setting the map once.
