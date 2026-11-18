# Quick Style for a Space

The owner (2026-11-18): "quick style menu should appear in livehuddle when editing if I click an element or room that
has modifications, for example to choose the wall type or floor type for a room, like livediagram does for elements".
livediagram's colour-swatch panel stays gone ([not in livehuddle](../002-project-scope/not-in-livehuddle.md#quick-style));
this is a Space's own: the choices a room or a piece has, beside the selection, one click away.

## When it shows

- **Editing**: in Edit, not while walking, with nothing being dragged and no element menu open.
- **Editors only**: a Participant or a Viewer never sees it (they have no element menu Tools either).
- **What is selected**:
  - one or more **Rooms** (and nothing else): the room choices;
  - one or more pieces of **one kind with a type** (Doors, Rugs, Corridors, Meeting Tables) and nothing else: that
    kind's types;
  - anything else (a chair, a note, a room with a piece): no panel.
- **Not on a phone**: a phone's canvas has no room for it; the element menu's Tools carry the same choices.

## What it holds

The same choices as the element menu's **Tools** sections, set through the same actions, each one undoable change
applied to every selected room or piece:

| Selected | Rows                                                                                               |
| -------- | -------------------------------------------------------------------------------------------------- |
| Rooms    | **Walls**: Solid, Glass. **Floor**: its five types. **Floor Colour**: the nine floor colours.      |
| Pieces   | **Type**: the kind's types; a type too wide for a Door's wall is offered disabled, as in the menu. |

The first selected room's choices show as chosen; a type shows as chosen when every selected piece has it.

## Where it sits

At the canvas's left edge, vertically centred, clear of the palette strip and the bottom-right cluster, and on the
right edge instead when the left would cover the selection: the workbench's quick-style placement
(`@liveworkspace/workbench/hooks/ui/useQuickStylePlacement`, moved there from livediagram so both use one). A
selection's toolbar keeps off it. It is a panel, so the panel-opacity preference applies to it.

## Built in

`apps/editor/components/canvas/SpaceQuickStylePanel.tsx` (`spaceQuickStyleTarget` picks what it styles), mounted
beside `ClearStylesHost` in `EditorView`.
