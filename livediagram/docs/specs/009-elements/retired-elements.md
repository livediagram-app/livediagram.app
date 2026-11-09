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
- Centred in it, top to bottom: a small glyph (the moved-out arrow), a **title** in the card's title weight, and a
  caption in the muted text colour. The title is the element's own label when it has one (a Room's name, a Chair's
  label), else the piece's name; the caption is **Moved to livehuddle**, or `<Name> · Moved to livehuddle` under an own
  label, so a board with ten Rooms still tells them apart. On a smaller box the glyph goes first (under 96 x 88), then
  the caption (under 72 x 44), so the title always shows (`retiredPlaceholderPlan`).
- Hovering shows a hover card titled `<Name>: Moved to livehuddle`: "This piece lives in livehuddle now. It is kept
  here as saved; you can move or delete it."
- The export draws the same card (name and line), so an SVG, PNG or PDF of an old board matches the canvas.
- No animation, no sound, nothing pressable on its face: it is a placeholder, not a control.

## What people can do with it

It follows the ordinary element rules for its share role ([Share roles](../013-workspace/share-roles.md)):

| Role        | Select | Move, resize                           | Delete                         | Restyle, relabel | Add a new one |
| ----------- | ------ | -------------------------------------- | ------------------------------ | ---------------- | ------------- |
| Editor      | Yes    | Yes                                    | Yes                            | Stored only      | No            |
| Participant | Yes    | As any element the room lets them move | As any element they may delete | Stored only      | No            |
| Viewer      | Yes    | No                                     | No                             | No               | No            |

- Its context menu is the ordinary element menu (Layer, Rotation where the kind turns, Delete and the rest); a retired
  Avatar button has no Button section, so it cannot be pointed at a mode. A style or label change is stored as it is on
  any element (the placeholder shows a new label as its title) and reaches livehuddle unchanged; it never makes the
  piece work here. "Stored only" in the table means that.
- Copy and paste, duplicate and undo carry it like any element, data unchanged: the one way it is ever "added" is as a
  copy of one already on a board.
- Nothing creates a new one: the palette, the templates, the search panel, Mermaid and the other imports, the MCP
  server, the CLI and the API's element create paths do not offer the retired kinds. The MCP and API refuse a create
  that names one with a message saying it moved to livehuddle and can no longer be added here (`retiredKindRefusal`).
  Reading a document that holds one (`read_document`, the CLI's views) lists it by its stored kind, as saved.

## Stored data

The stored schema is unchanged: `validate.ts` still accepts every retired kind and its fields (`chairFacing`,
`roomDoor`, `mode: 'avatar'`), so a save writes them back as they were and livehuddle reads them the same.

## Performance

The placeholder is one memoised view with no effects and no per-frame work; a board of hundreds of retired pieces
costs what the same number of plain boxes does. It replaces the furniture drawings, which were heavier.
