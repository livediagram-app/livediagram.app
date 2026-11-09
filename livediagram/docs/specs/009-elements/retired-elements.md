# Retired elements

Status: **implemented** (Work Tracker #650, 2026-11-09).

An element kind that moved to livehuddle ([Not in livediagram](../002-project-scope/not-in-livediagram.md)) still turns
up in documents saved before the move. livediagram keeps it exactly as stored and draws it as a **retired
placeholder**, so nothing is lost and nobody is confused by a blank space or a piece that does nothing.

## Which elements are retired

`isRetiredElement` (`@livediagram/document`, `retired-elements.ts`) answers it, and nothing else decides:

- a shape whose kind is one of `RETIRED_SHAPE_KINDS`: `chair`, `desk`, `sofa`, `fence`, `avatar-pad`, `room`,
  `meeting-table`, `plant`, `bookshelf`, `water-cooler`, `coffee-machine`, `rug`;
- a Selection Mode button (`mode-button`) whose mode is Avatar, stored as `mode: 'avatar'` or with no mode at all
  (absent always meant Avatar, the old default).

Each retired element has a **name** for its card, from `retiredElementName`: Chair, Desk, Sofa, Fence, Avatar Pad,
Room, Meeting Table, Plant, Bookshelf, Water Cooler, Coffee Machine, Rug, Avatar Button.

## What it looks like

- A rounded card filling the element's box, on the theme's muted surface with a dashed hairline border, so it reads as
  "something was here" and never as content the author drew. It follows the light and dark themes from the same tokens
  every card uses.
- Centred in it, top to bottom: a small glyph (the moved-out arrow), the element's **name** in the card's title weight,
  and the line **Moved to livehuddle** in the muted text colour. On a box too small for all three, the line goes first,
  then the glyph, so the name always shows.
- The element's own label, when it has one (a Room's name, a Chair's label), shows under the name instead of nothing,
  so a board with ten Rooms still tells them apart.
- Hovering shows a tooltip: "This piece lives in livehuddle now. It is kept here as saved; you can move or delete it."
- The export draws the same card (name and line), so an SVG, PNG or PDF of an old board matches the canvas.
- No animation, no sound, nothing pressable on its face: it is a placeholder, not a control.

## What people can do with it

It follows the ordinary element rules for its share role ([Share roles](../013-workspace/share-roles.md)):

| Role        | Select | Move, resize | Delete | Restyle, relabel | Add a new one |
| ----------- | ------ | ------------ | ------ | ---------------- | ------------- |
| Editor      | Yes    | Yes          | Yes    | No               | No            |
| Participant | Yes    | As any element the room lets them move | As any element they may delete | No | No |
| Viewer      | Yes    | No           | No     | No               | No            |

- Its context menu holds only the categories every element has (Layer, Size, Lock, Delete) and a **Moved to
  livehuddle** note; it offers no style, label or behaviour categories, because changing a piece that is not drawn
  here would change data you cannot see.
- Copy and paste, duplicate and undo carry it like any element, data unchanged: the one way it is ever "added" is as a
  copy of one already on a board.
- Nothing creates a new one: the palette, the templates, the search panel, Mermaid and the other imports, the MCP
  server, the CLI and the API's element create paths do not offer the retired kinds. The MCP and API refuse a create
  that names one with "`<Name>` moved to livehuddle and can no longer be added in livediagram." Reading a document that
  holds one (`read_document`, the CLI's views) lists it as `retired <kind>`.

## Stored data

The stored schema is unchanged: `validate.ts` still accepts every retired kind and its fields (`chairFacing`,
`roomDoor`, `mode: 'avatar'`), so a save writes them back as they were and livehuddle reads them the same.

## Performance

The placeholder is one memoised view with no effects and no per-frame work; a board of hundreds of retired pieces
costs what the same number of plain boxes does. It replaces the furniture drawings, which were heavier.
