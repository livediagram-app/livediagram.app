# Path tool

Status: specified

The **Path tool** is a vector pen for whiteboards, in the manner of Figma's and Illustrator's pen
tools: click to place corner points, drag to pull out curves, and edit every point and handle
afterwards. It is a new tool, built apart from the Shape Pen
([Two pens instead of a pen and a mode](../008-canvas/two-pens.md)), whose icon it varies.

## Why

Markers draw by hand and shapes are fixed forms. Between them sits the deliberate line: a clean
curve round a group of notes, a smooth arrow path, a custom outline traced over a sketch. The
polygon tool ([Multi-point line / polygon tool](../008-canvas/polygon-tool.md)) places straight
segments only and cannot be reshaped; the Path tool places true Bézier curves and keeps them
editable.

## Where it lives

- **Whiteboards only.** The Path tool is a dock button and a key on a whiteboard; diagram tabs do
  not offer it. A path element that reaches a diagram tab (paste, a tab that stops being a
  whiteboard) renders, selects, moves, styles and edits there like any element.
- **Dock:** after the three markers and before the eraser, labelled **Path tool**, key **P**
  (shown on the button and in `aria-keyshortcuts`). Its icon is the Shape Pen's nib varied: the nib
  over a curve with one anchor and its handle.
- **Key P** picks it from anywhere on a whiteboard (not while typing). On diagram tabs P stays the
  pencil.
- Picking it puts any marker, shape or eraser down, like every dock tool.

## The path element

A path is a new element type, `path`: an ordered list of **nodes** (anchor points), each with an
optional incoming and outgoing **handle**, and a `closed` flag. Freehand strokes keep their own type:
their points carry no handles and are not edited point by point.

- Nodes and handles are stored normalised to the element's box, like freehand points, so resizing
  scales the whole path, handles included. Rotation, lock, layers, opacity, links, comments and the
  rest of the boxed-element fields apply as to any boxed element.
- Each node has a **handle mode**:
  - **Corner**: no handles, or handles that move independently (a cusp).
  - **Mirrored**: both handles on one line, equal length (a smooth point).
  - **Aligned**: both handles on one line, lengths independent.
- A segment between two nodes is a cubic Bézier through their facing handles; with neither handle
  it is a straight line.
- At least **two nodes**; a closed path at least **three** or two with a handle. Anything less is
  never committed.
- The box always wraps the drawn curve (its extremes, not just its nodes and handles), so selection,
  hit-testing, snapping and export bounds match what is seen.

## Drawing

With the Path tool in hand:

- **Click** places a **corner** node.
- **Press and drag** places a **mirrored** node: the drag pulls out its outgoing handle and the
  incoming one mirrors it.
- **Alt (Option) while dragging** breaks the mirror: only the outgoing handle follows, the node
  becomes a corner with independent handles.
- **Shift** constrains the new segment's direction, and a dragged handle's angle, to 45° steps
  from the previous node.
- **Space held while dragging** moves the node being placed instead of its handle; releasing
  Space resumes the handle.
- A **rubber-band preview** runs from the last node to the pointer, curved by the last node's
  outgoing handle, in the style the path will land with.
- **Clicking the last node again** removes its outgoing handle, so the next segment leaves it as a
  straight line (a cusp).
- **Closing:** with at least two nodes, the pointer over the **first node** (within 8 screen px)
  shows a closing ring; a click closes the path, a drag closes it and shapes the closing segment's
  handle.
- **Backspace / Delete** removes the last placed node and keeps drawing; with none left, it cancels.
- **Finishing an open path:** **Enter**, **Escape**, **double-click**, or picking another tool
  commits it (two nodes or more). **Escape** with fewer than two nodes cancels; a further Escape
  puts the tool down.
- **Continuing a path:** with the tool in hand, the pointer over an **end node of an open path**
  shows a continue ring; a click resumes drawing from that end, appending to that same element.
  Clicking the other end node of the path being continued closes it.
- The tool **stays in hand** after a path is committed, so the next click starts a new path.
- Every committed path, continuation or close is **one undo step**.

## Editing

A path is edited in its own **edit mode**, as in Figma:

- **Enter** by double-clicking a path with Select, or pressing **Enter** with one path selected.
  **Leave** with **Escape**, **Enter**, or a click outside the path. The dock shows the edit mode
  by pressing Select with a path glyph; the rest of the canvas stays visible and inert.
- Edit mode shows every node; the handles of selected nodes and of their neighbours' facing sides.
- **Selecting nodes:** click a node; **Shift-click** adds or removes; drag on empty space inside
  edit mode draws a box that selects the nodes inside it (Shift adds). Escape with nodes selected
  first clears them, then leaves.
- **Moving:** drag selected nodes (their handles move with them); arrow keys nudge by 1 px,
  Shift + arrow by 10 px. Shift while dragging constrains to horizontal, vertical or 45°.
- **Handles:** drag a handle to reshape; its partner follows the node's mode (mirrored keeps angle
  and length, aligned keeps the angle). **Alt-drag** a handle breaks the pair (the node becomes a
  corner with independent handles).
- **Corner ↔ smooth:** double-click a node, or **Alt-click** it, toggles it: a smooth node loses
  its handles and becomes a corner; a corner gains mirrored handles that follow its neighbours
  (a third of the way to each, along the line between them).
- **Adding a node:** click on a segment. The node lands at that point on the curve and the curve's
  shape is kept exactly (the segment is split there, de Casteljau).
- **Bending a segment:** drag a segment itself (not near a node) to bend it through the pointer;
  both of its handles adjust. A straight segment gains handles as it bends.
- **Deleting nodes:** **Backspace / Delete** removes the selected nodes and joins their neighbours;
  a path left with fewer nodes than it needs is deleted.
- **Closing an open path:** select both of its end nodes and press **J**. Deleting nodes from a
  closed path keeps it closed.
- **Snapping:** a node dragged within 8 screen px of another node of the same path, or of its own
  original position on either axis, snaps and shows a guide.
- Every edit gesture (a drag, a toggle, an add, a delete) is **one undo step**; the whole edit mode
  session is several.

## Style

- A path is plain ink by default, like the dock shapes: the board's ink at the default border
  width, **no fill**.
- The **quick style panel** styles it as it does a shape: **Stroke**, **Background** (a fill, shown
  for a closed path only), **Stroke width** and **Stroke style**. With the Path tool in hand and
  nothing selected, it styles the **next path** ("Next path"), remembered in the board's own style
  memory like every other tool.
- Markers never colour it.

## Selecting and erasing

- A path is picked **by its drawn line** (6 screen px either side, like a marker stroke), and a
  filled path by its fill too; clicks elsewhere in its box pass through.
- The eraser removes a path whole in either mode (a partial erase of a path is not offered in round
  one).
- The Shift selection box and Shift-click behave as for every whiteboard element.

## Export, sharing and import

- Paths render in the SVG and PNG exports and in thumbnails exactly as on the canvas.
- Real-time collaboration, history, copy and paste, duplication and the document format carry
  paths like every element.
- The Excalidraw export writes a path as a `line` element sampled along its curve; import never
  creates paths.

## Accessibility

- The dock button is a toggle with its name ("Path tool") and key. While drawing, a polite live
  message says "Path started", "3 points", "Path closed", "Path finished".
- A path's accessible name is "Path, N points" (closed: "Closed path, N points").
- Edit mode is reachable from the keyboard (Enter), nodes move with the arrow keys, Escape leaves.
- Nodes and handles have at least 24 × 24 px hit targets on screen.

## Telemetry ([Telemetry](../017-telemetry/telemetry.md))

| Event                       | Action     | Type                   |
| --------------------------- | ---------- | ---------------------- |
| The Path tool picked        | `Selected` | `Whiteboard` · `Path`  |
| A path committed            | `Added`    | `Element` · `Path`     |
| A path edited in edit mode  | `Changed`  | `Element` · `PathEdit` |
| A path closed while editing | `Changed`  | `Element` · `PathJoin` |

## Non-goals (round one)

- Boolean operations, compound paths (several subpaths in one element), text on a path.
- Stroke caps, joins, arrowheads and variable width on paths.
- Pressure, and a pen-pressure-aware Path tool.
- The Path tool on diagram tabs.
- Partial erasing of paths.
