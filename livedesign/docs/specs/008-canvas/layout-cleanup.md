# Layout cleanup

The two layout tidiers, **Auto Layout** (in each style) and **Auto-align**, are run from
the [command palette](../007-editor/command-palette.md)'s actions. A page's own **Tidy**, which aligns and spaces
what is on one page, is a separate tool ([Pages mode](../007-editor/pages-mode.md#tidy)). They are
complementary, not duplicates: one snaps current positions, the other recomputes them from the
graph. Both are editor-only (they mutate) and run a single undoable operation.

## Locked elements stay put

Neither tidier moves or resizes a **locked element** or anything on a **locked layer**
([Layers](../006-design/layers.md)): a lock means "protected from moves and resizes",
and a cleanup is a bulk move. `cleanupElements` (`lib/tab-cleanup.ts`) collects those ids
(`lockedElementIds`) and hands them to both passes. Auto-align leaves them unsnapped.
Auto Layout treats a locked box as scenery rather than a graph node, so arrows to it are
not edges and it is never placed, and a locked arrow keeps its anchors. The editor's Tidy Up
treats a locked box like any box it does not move: the laid-out block steps clear of it, and
arrows route around it. A box holding a
locked element is never a [unit](#what-moves-together).

## Auto-align (grid snap)

`autoAlignElements` (`apps/live/lib/auto-align.ts`, positions in `auto-align-lines.ts`). A
**grid snap that keeps what is already lined up**: so near-aligned shapes become exactly aligned
and small drift collapses, without breaking the alignment the author already has. It never reads
the arrow graph for structure and never moves anything far: the use case is "things are a few px
off", not "this diagram has no layout".

- **Sizes** round to the 10 px grid per element. A circle, diamond or actor drawn square stays
  square; one drawn otherwise keeps its own proportions (a flowchart's decision is a wide
  diamond, and squaring it doubled its height into the steps around it).
- **Positions snap by shared lines, not box by box.** Every box offers a start, centre and end line
  on each axis; lines of one kind within `ALIGN_TOLERANCE` (8 px) form a group, and two boxes an
  arrow runs straight between (bottom to top, or side to side) also join a centre group within
  `LINK_TOLERANCE` (16 px). Groups settle largest first onto a grid-snapped value (a centre onto
  the half grid, where a grid-sized box's centre lies), so boxes of different widths centred on
  one column stay centred and the arrows between them stay straight. Rounding each box's top-left
  on its own had put a 250-wide step and a 220-wide step 5 px off each other, leaning the arrow
  between them. A box in no group snaps its start.
- **Even spacing is kept.** Three or more boxes in one line across, drawn an even step apart (a
  key's rows), stay an even step apart; the step rounds to the grid only when that moves the last
  box no further than the tolerance.
- **Nothing breaks.** A snap that would make two boxes overlap that did not, or nudge a box part-way
  out of a lane or frame that held it, is undone for both.
- **Settled.** Passes repeat (at most 4) until one moves nothing, so running it twice changes
  nothing: the second press finds the tab already tidy.
- Free arrow endpoints snap to the grid; pinned ones follow their boxes.

## Auto Layout (Tidy up)

`autoLayoutElements` (`packages/design/src/auto-layout.ts`, a pure transform over the
element model so importers and the editor share it — see GitHub issue #12). A
**structural layout**: it reads the arrow graph, splits it into connected components,
and computes brand-new positions — a layered (Sugiyama-style) layout for DAG-ish
components, with cycle-breaking for cyclic graphs (when a loop stalls the order it resumes from the loop's entry: a
waiting node some placed node already feeds, with the fewest predecessors still to come, so a node or group the loop
does not hold is never ranked ahead of what feeds it); direction is inferred from the elements' current rough
positions. It can legitimately relocate an element across the
canvas.

- **Scope:** the whole active tab. Boxed elements that aren't wired to anything
  (loose stickies / text / images) pass through with their positions untouched;
  spacing respects element sizes.
- **The plain layout** (`autoLayoutElements` with no tidy profile) gets the layout described in the sections up to
  "Two-way edges bow apart", pinned to the origin the caller gives.
- **The editor's Tidy Up** runs the **tidy profile** instead (`tidyLayoutElements`,
  [below](#tidy-up-keeps-a-flowchart-a-flowchart)): an author's drawing carries intent a generated
  graph does not, and the plain layout trashed it.
- One undoable op (`commit` snapshots the pre-layout state), so it can be
  undone in a single step.

### Fewer crossings

The flow layout ranks nodes, then orders each rank. The first order follows the
nodes' current positions, which respects a drawing the author (or a model)
already arranged. It is then refined by a few alternating barycentre sweeps
(each node moved toward the average position of its neighbours in the rank
above, then below), and the refined order is **kept only if it crosses fewer
edges** than the one it started from. A graph whose nodes all start at one point
therefore gets a readable order instead of
its input order, and a hand-arranged one is only changed where that removes a
crossing.

### Long edges keep a lane

An edge that skips ranks (a branch that rejoins two ranks down) has no node in
the ranks it passes, so nothing kept a real node off its line: in a checkout
flow the "Yes" arrow from a decision ran straight through the "No" branch's box
to the step both lead to. The flow layout now splits such an edge into a chain
of **lane** nodes, one per rank it crosses (`LANE_WIDTH` = 32 across the rank,
nothing along it), which take part in ordering and placement like any node and
are dropped once placed (`auto-layout-long-edges.ts`). Only forward edges are
split; a back edge (a cycle) is drawn as it lands.

### Nodes sit by their neighbours

Ranks used to be packed and centred on the widest one, so a node sat wherever
its rank's width put it. Now each node is pulled toward the weighted mean
position of its neighbours in the adjacent rank, in alternating downward and
upward sweeps (four pairs, then one pass using both sides), and the wanted
positions are made legal (order kept, `SIBLING_GAP` between boxes) by isotonic
regression, the closest legal positions to the wanted ones
(`auto-layout-placement.ts`). An edge between two lane nodes pulls with weight
8, one lane end 2, a plain edge 1, so a long edge runs straight and the node it
skips moves aside. A final pass **straightens one-to-one links**: a node whose
only neighbour above has it as its only neighbour below sits right under it when
there is room, so a plain chain runs dead straight instead of drifting a few
pixels per rank.

### Edges use the flow faces

In the flow and tree layouts, an edge to a later rank leaves by the face that
points down the flow and lands on the opposite one (`s` to `n` top to bottom,
`e` to `w` left to right), however far across the rank its target sits. Picked
by angle alone, a parent with wide-spread children left by its side and entered
each child's side. Same-rank and backward edges, and every mindmap spoke, still
pick by angle (`reanchorArrow`'s `axis`).

### Angled lines bend twice

An angled arrow on its own is an L: from a parent's bottom to a child's top it
runs down to the child's level and meets the child's top edge sideways. The plain layout
gives each angled arrow two bends through `curvePoints` (down to half height,
across, down into the child), the shape an org chart is read in; one whose ends
already line up runs straight rather than drawing a zero-length elbow with a
sideways head (`arrow-orthogonal.ts`). An arrow with one end on a side across
the flow and the other along it (a group's edge leaving its frame's side, a
decision's exit from its top or bottom in a swimlane) bends once instead: out of
that side first, then along the flow into the other end, so it meets each end
square. The bends are ordinary curve points, so the author can drag them like any
other.

Elements an agent places itself (the MCP's raw `elements`, any layout) get the
same two bends on every angled arrow it gave no curve points whose ends face each
other across a gap: a bottom to a lower top, a top to a higher bottom, a right
side to a box further right, a left side to one further left. Such an arrow drew
as an L that ran its last stretch along the far box's edge. Its cross run sits half way between its ends when that
is clear, else at the clear level nearest half way: off every other box, off every container's border and the band
under its top edge its heading takes (a subnet's name and CIDR), and 16 px off any cross run placed before it whose
span overlaps or meets its own, so two never read as one line. An angled arrow whose two ends sit on the same side
of their boxes (a bottom to a bottom) loops out 24 px past the farther end and back, a U, where its L ran along the
boxes' own edges. An arrow whose ends
do not face each other keeps its L, which already meets both ends square.

### Two-way edges bow apart

In the plain layout's output, a
pair of straight arrows between the same two boxes in opposite directions (a
state diagram's Private -> Shared and Shared -> Private) is curved apart, each
bowing to its own side of the line between the boxes (`arrow-reciprocal.ts`):
at least `RECIPROCAL_BOW` (36), and for a labelled pair running up and down, far
enough for the two labels to sit side by side (a curve's label moves half its
bow), capped at 140. Drawn straight they lay on top of each other, only the
fan-out's few pixels apart, with their labels colliding. Arrows that already
carry a curve or a routing are left as they are.

### Tidy Up keeps a flowchart a flowchart

The editor's Auto Layout (`cleanupElements` → `tidyLayoutElements`, a separate entry so plain-layout callers never load it,
`auto-layout-tidy.ts`) reads the drawing as well as the graph. On the checkout template the
plain layout squared both decisions, straightened every elbow into a diagonal, ran the retry
loop back through the column it returns along, and landed the flow on top of the title. The tidy
profile:

- **Keeps sizes as drawn.** No peer sizing, no squared diamonds.
- **Reads the direction from the arrows' faces.** An arrow that lands on a top or bottom face runs
  down the flow whichever way it set off (a decision's answers leave by its sides and land on top
  of the steps below); one that lands on a side runs across; only an arrow without a landing face
  is judged by where its ends are. Arrows are counted, not summed, so one long loop arrow cannot
  tip a flowchart sideways. Arrows inside a [unit](#what-moves-together) do not vote.
- **Breaks loops where the drawing turns back** (`auto-layout-tidy-rank.ts`): a depth-first walk
  from the sources, children in drawn order down the flow, marks the edge that returns to a node
  still on the walk ("Try again") as the loop's way back, drawn against the flow.
- **Steps a decision's other answers aside.** A flowchart sets a No beside the question rather than
  a rank below: when a diamond has one exit drawn straight below it (within `IN_LINE_PX`, 12),
  that exit continues the column and each other exit with no other way in takes a side, one per
  side, on the side it was drawn. An exit the author already drew level with its node takes the
  side whatever the node. A yes / no tree drawn with both answers below stays a tree; an org
  chart's reports stay below their manager. Side steps share their decision's rank (zero-length
  edges in longest-path layering) and are held right beside it in placement.
- **Sizes gaps to the labels in them** (`auto-layout-tidy-flow.ts`): ranks `TIDY_RANK_GAP` (56)
  apart and neighbours `TIDY_SIBLING_GAP` (48), each widened to fit the arrow labels that sit
  there.
- **Routes every arrow square, around the boxes** ([below](#arrows-route-square-around-the-boxes)).
- **Lands where the flow starts.** The first shape in reading order stays where it is, its centre
  on the grid, and the block hangs off it; every centre lands on the grid, so boxes that share a
  line keep sharing it. The block then steps the shortest way (up and left cost three times as
  much: that is where a title sits) clear of every box it does not move and that no node already
  sat on (a title, a key, a legend), `TIDY_CLEARANCE` (24) away. Lanes and panels are cleared as
  one block, so nothing lands in the gaps between them.
- **Settles.** A layout reads the drawing it is given, so laying out its own result can refine it
  a little further. It runs until a pass moves nothing (`MAX_LAYOUT_PASSES`, 3), so one press lands
  on the settled layout and the next finds it already tidy; on a tab of more than
  `SETTLE_ELEMENT_LIMIT` (300) elements one pass is the press, to keep a hover quick.
- No final Auto-align: the profile is already on the grid by its centres, and snapping again would
  resize what the layout does not own (a key's miniatures).

### What moves together

`auto-layout-tidy-graph.ts` reads the tab as a graph of **nodes**, so moving a node never tears a
drawing apart:

- **A unit** is a box that holds wired shapes: a department panel, a lane, a group card, a state
  machine's composite state. It moves as one rigid block with everything inside it, keeping its
  inner layout; the arrows into it, or into the shapes it holds, are its edges, and an arrow
  inside it moves with it as drawn. Only the outermost such box is a unit, and one holding a
  locked element is not one.
- **A rider** goes with a free node: a smaller unwired box overlapping it (an icon badge, a "Usually
  1 day" chip, a caption laid over it), moved exactly as the node moved.
- **A dashed or dotted arrow** is a secondary link by convention (a dotted-line report, an async
  call): it is routed with the rest but does not shape the layout, unless every arrow is one.

### Arrows route square, around the boxes

`auto-layout-route.ts` gives each arrow between two nodes a route of right-angled legs, worked out
top to bottom (a left-to-right layout is transposed in and out). Candidates are tried in order and
the first that clears every box but its own two (`CLEARANCE`, 10) is kept; failing that, the one
through the fewest boxes:

- **Down the flow:** straight when the ends line up; a side step rejoining the column comes down and
  turns into the side of the box it joins; a decision's answer to a box wholly to one side leaves
  by that side's point and drops in; otherwise one jog in the gap between bands, through a long
  edge's lanes.
- **Across a band:** straight between the facing sides; over the top or under the bottom when the
  row between is full.
- **Back up the flow (a loop):** up from the top and into the facing side when the two are not in
  line; otherwise out past everything beside them (`LOOP_OFFSET`, 32), up, and back in; under the
  bottom as a last resort.
- An arrow pinned to a shape inside a unit routes from that shape. The result is ordinary arrow
  data: angled arrows threaded through their corners (`curvePoints`), with any dragged elbow,
  curve or label position cleared, since it fitted the old route. The mindmap keeps its straight
  spokes.

### A tidy never trashes the work

Every tidier is judged before it is offered (`lib/tidy-verdict.ts`, `assessCleanup`), on the tab as
the author has it. It is **not offered** when its result would:

| Verdict            | When                                                                                                                                                                                                                                   | Tile line                                  |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| `unchanged`        | No box moves and no arrow re-routes                                                                                                                                                                                                    | Already tidy                               |
| `leaves-container` | A shape that sat inside a bigger box comes out of it, the box staying behind                                                                                                                                                           | Would pull shapes out of their lanes       |
| `rearranges-lanes` | Lanes (two or more boxes holding wired shapes, alike in length, in line, stacked at most 48 px apart) reorder, fall out of line, or a gap between them changes by more than 16 px. Not judged for Auto-align, whose few px tidy a lane | Would rearrange your lanes                 |
| `covers`           | A moved box newly overlaps another box                                                                                                                                                                                                 | Would cover a shape / Would cover N shapes |
| `unsuited`         | Mindmap on a graph that loops back on itself (`tidyMindmapFits`)                                                                                                                                                                       | For ideas that branch, not loop            |

The command palette refuses the
command with an info notice naming the tidier (`verdictNotice`), and nothing is committed. So
lanes, which the layouts move only as rigid blocks, are protected: a swimlane offers Auto-align
and says why the layouts are not offered.

One layered layout can't express every diagram: a mindmap wants its root in the
middle, an org chart wants parents centred over their reports. So Auto Layout is a
family of **styles**, all sharing the same pipeline (graph extraction → per-component
positioning → origin pinning → arrow re-anchor → grid snap) and differing only in how
a component's nodes are positioned:

| Style                 | `AutoLayoutOptions`                  | Positioning                                                                                                                             |
| --------------------- | ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| **Smart** (default)   | `{}`                                 | The layered layout with direction auto-detected from the elements' current rough positions. What plain "Auto Layout" always did.        |
| **Flowchart (down)**  | `{ style: 'flow', direction: 'TB' }` | Layered, direction forced top-to-bottom.                                                                                                |
| **Flowchart (right)** | `{ style: 'flow', direction: 'LR' }` | Layered, direction forced left-to-right.                                                                                                |
| **Tree**              | `{ style: 'tree' }`                  | Tidy tree / org chart: a spanning tree from the roots (in-degree 0), each parent centred over its subtree, depth = rank, top-to-bottom. |
| **Mindmap**           | `{ style: 'mindmap' }`               | Radial: the highest-degree node sits at the centre, each subtree gets an angular wedge sized by its leaf count, depth = ring radius.    |

- The style lives in `AutoLayoutOptions` on `autoLayoutElements`: a caller that passes no style gets Smart.
- **UI:** the command palette carries one command per style (Smart is the plain "Auto Layout (tidy up)", then
  "Auto Layout: Mindmap", ...). All styles are the same single undoable op.
- **Mindmap order** is measured clockwise from 12 o'clock, where its first branch is placed, so a
  second tidy keeps the map still (measured from 9 o'clock, every tidy turned it a little).
- Tree and Mindmap consume the same directed edge set as the layered layout; on a
  graph that isn't a tree (extra in-edges, cycles) they lay out a BFS/longest-path
  spanning tree and let the extra arrows re-anchor across it (deterministic, never
  an error).
- Telemetry: the existing `Tab` / `Aligned` event gains the style as its `type`
  (`Smart`, `FlowchartDown`, `FlowchartRight`, `Tree`, `Mindmap`; Auto-align keeps
  the bare event).

## Out of scope

Force-directed ("organic") layouts, laying shapes out inside their lanes (a lane moves only as a
rigid block, so lane diagrams are offered Auto-align), routing the plain layout's arrows around
obstacles, and any LLM
involvement (the AI "Clean" in [AI Assistance](../007-editor/ai-assistance.md) is the separate,
key-gated path; Auto Layout is the deterministic, offline-safe one every deployment
gets). See issue #12 for the fuller rationale and open questions.
