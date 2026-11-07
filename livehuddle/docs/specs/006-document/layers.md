# No layers

Status: removed (2026-11-05)

livehuddle has no layers. A Space's tab is one plane: every element is drawn, hit and exported in the tab's
`elements` order, and nothing is hidden or frozen as a group. There is no Layers panel, no Layers button in the
bottom-right cluster, no "Move to layer" tiles in the element menus, no "Hidden layers" export row, no layer
settings.

## Why

livehuddle is where a team meets ([Purpose](../001-project-vision/purpose.md)), not a design tool. Layers came over
from livediagram, where they give big diagrams structure. In a Space they were one more panel, and one more way for
a room, a fence or a portal to vanish from view without anyone meaning it to.

## Stacking

- Z-order is the tab's `elements` array: later paints on top, backdrops (rooms, rugs, boundaries, a stored frame) first, attached badges, step numbers and
  pointer notes last, as before.
- Among the backdrops the larger paints first, so a rug lies on its room's floor, with one exception for a garden:
  **Grass** paints first, then every **Garden Path** in array order, then the other floors (rooms, rugs, stages,
  ponds, doors), larger first. A path laid later lies on one laid earlier whatever their sizes, so a path that ends on
  another, or a round plaza where paths meet, covers what it should ([Garden Path](../009-elements/office.md#garden-path)).
  **Windows** paint last among the backdrops, in array order: over the room and rugs they sit on, under every piece of
  furniture, so a window's light lies on the floor ([Window](../009-elements/room-builder.md#window)).
- **Bring to Front / Send to Back** move the selection to the end / start of the array (`bringManyToFront` /
  `sendManyToBack`), in the element menu and the selection popover alike.

## Documents saved with layers

Tab bodies are opaque JSON ([Per-tab storage](per-tab-storage.md)), so a Space saved while layers existed may still
carry them. Nothing refuses such a tab, and no data migration runs:

- The stored-tab migration drops a tab's `layers` and every element's `layerId`
  (`dropRetiredLayers`, in `@livehuddle/document`); a tab's old `vote`, with any `voteLayerId` in it, goes with
  `dropRetiredVote` ([Not in livehuddle](../002-project-scope/not-in-livehuddle.md#the-vote)). A `tab-meta` patch from a client still running an old build may
  carry `layers`; it is stored as sent and dropped again on the next read. The tab is saved without them the next time
  it is saved.
- Every element is visible and free to pick: an element that sat on a hidden layer now shows, one on a locked layer
  can be selected, and a layer's opacity no longer dims it. An element's own `locked` and `opacity` are unchanged.
- Elements keep their array order, so a tab whose layer bands differed from its array order may stack a little
  differently.
