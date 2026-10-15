# The stack

## What

A **Stack**: a container that arranges what you put in it, in a row, a column or a grid, with an even gap and padding,
and hugs its contents. A `shape: 'stack'`. Drop a card in and it takes a slot; take one out, resize one or drag one
between two others and the rest reflow, so a row of cards never needs nudging into line.

## Why

Most diagrams have a row or grid of like things: four services in a tier, six features on a slide, a column of steps.
Placing them evenly by hand is fiddly, and the first edit (a longer label, one more card) undoes it. Alignment guides
help once; a stack keeps the arrangement as the content changes.

## The element

- **What it holds**: the elements whose centre is inside it, the containers' rule ([The boundary](boundary.md) "A
  container"): a stack carries them when it is dragged and paints behind them. A stack nested in a frame, a boundary
  or another stack works as any nested container.
- **Order** is position: in a row, left to right by each child's centre; in a column, top to bottom; in a grid,
  reading order (top to bottom in rows, then left to right). Dragging a child past a sibling moves it to that slot.
  A mark is never a child: a badge, step or pointer note attached to something rides on its host, and a comment pin
  stays where it was put, so neither takes a slot.
- **Arrangement** (`stackDirection`): **Row** (the default), **Column** or **Grid**. A grid takes `stackColumns`
  (2 to 6, 2 by default); its cells are as wide as its widest child and as tall as its tallest.
- **Gap** (`stackGap`, 0 to 64 px, 16 by default) between children, and **Padding** (`stackPadding`, 0 to 64 px, 16 by
  default) inside the edge.
- **Align** (`stackAlign`): where children sit across the flow, **Start**, **Centre** (the default) or **End**.
- **Hugging**: after every change the stack resizes to fit its children plus its padding. An empty stack keeps the
  size it has, so it is a target to drop into. Its resize handles stay, for an empty one; a full one returns to hug.
- **The title** is the element's label, small at the top-left inside the edge; a titled stack keeps a 22 px band for it
  above its children. It is empty by default.

Reflow happens at the editor's commit point, as badges settle ([The badge](badge.md) "Attachment"): one pure step over
the board, so every way something is added, moved, resized or deleted (a drag, a paste, an agent's edit, an undo) lays
the stack out again, and every reader (an export, a thumbnail) sees the laid-out positions stored. Pinned arrows
follow their elements as they always do.

## Menu

A **Stack** section (Tools flyout), closed until opened: the three arrangements as tiles, **Columns** (Grid only, a
stepper), **Gap** and **Padding** as sliders, and **Align** as three tiles.

## Animation

When a stack reflows, each child glides from where it was to its new slot over 160 ms (CSS, on the canvas only; reduced
motion jumps straight there). A child being dragged does not glide. The stack itself takes the **Shape** set limited to
the motions that do not move it, like a boundary's.

## Palette

| Mode       | Where                                   |
| ---------- | --------------------------------------- |
| Diagram    | **Build**: Stack, after Frame           |
| Illustrate | **Build**: Stack                        |
| Plan       | none                                    |
| Facilitate | none (Search still finds and places it) |

A new stack is a row, 360 × 160, empty, drawn as a faint dashed outline so it reads as a target.

## Share roles

| Role        | May                                                                            |
| ----------- | ------------------------------------------------------------------------------ |
| Editor      | Everything above                                                               |
| Participant | Look; a Participant's own sticky dropped in a stack is laid out like any child |
| Viewer      | Look                                                                           |

## Agents

The MCP server and the REST API take `stack` with `stackDirection`, `stackColumns`, `stackGap`, `stackPadding` and
`stackAlign`. An agent places children anywhere inside it; the editor lays them out when the board next loads or
changes.
