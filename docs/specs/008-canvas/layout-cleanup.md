# Layout cleanup

The tab / canvas context menu carries a **Cleanup** category (next to Look & Feel
and Font, see [Canvas and palette](canvas-and-palette.md)) holding the two layout
tidiers. They are complementary, not duplicates: one snaps current positions, the
other recomputes them from the graph. Both are editor-only (they mutate) and run a
single undoable operation.

## Auto-align (grid snap)

`autoAlignElements` (`apps/live/lib/auto-align.ts`). A **structure-blind grid
snap**: it rounds every boxed element's position and size to a fixed grid, and free
arrow endpoints to the same grid, so near-aligned shapes become exactly aligned and
small drift collapses. It never reads the arrow graph and never moves anything far —
the use case is "things are a few px off", not "this diagram has no layout". Idempotent
(running it twice changes nothing).

## Auto Layout (Tidy up)

`autoLayoutElements` (`packages/document/src/auto-layout.ts`, a pure transform over the
element model so importers and the editor share it — see GitHub issue #12). A
**structural layout**: it reads the arrow graph, splits it into connected components,
and computes brand-new positions — a layered (Sugiyama-style) layout for DAG-ish
components, with cycle-breaking for cyclic graphs; direction is inferred from the
elements' current rough positions. It can legitimately relocate an element across the
canvas. This is also the routine importers lean on (Markdown import, a future Mermaid
import) to place nodes they never drew.

- **Scope:** the whole active tab. Boxed elements that aren't wired to anything
  (loose stickies / text / images) pass through with their positions untouched;
  spacing respects element sizes.
- **Origin-preserving:** the laid-out block is pinned to the diagram's current
  top-left (the min x / y of the boxed elements) so it stays where the user is
  looking instead of jumping to the canvas origin.
- **Final snap:** the result is run through `autoAlignElements`, the same way the
  AI-apply / import-merge path already finishes, so the tidy output is also
  grid-aligned. The two tools compose: Auto Layout then Auto-align.
- One undoable op (`commit` snapshots the pre-layout state), so it can be
  undone in a single step.

### Fewer crossings

The flow layout ranks nodes, then orders each rank. The first order follows the
nodes' current positions, which respects a drawing the author (or a model)
already arranged. It is then refined by a few alternating barycentre sweeps
(each node moved toward the average position of its neighbours in the rank
above, then below), and the refined order is **kept only if it crosses fewer
edges** than the one it started from. A graph whose nodes all start at one point
(the MCP's graph input, an import) therefore gets a readable order instead of
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
runs down to the child's level and meets the child's top edge sideways. Laid-out
graph input (the MCP's `graph` / `mermaid`, [MCP server](../015-api/mcp-server.md))
gives each angled arrow two bends through `curvePoints` (down to half height,
across, down into the child), the shape an org chart is read in; one whose ends
already line up runs straight rather than drawing a zero-length elbow with a
sideways head (`arrow-orthogonal.ts`). The bends are ordinary curve points, so
the author can drag them like any other.

### Two-way edges bow apart

In laid-out graph input (a Mermaid import, the MCP's `graph` / `mermaid`), a
pair of straight arrows between the same two boxes in opposite directions (a
state diagram's Private -> Shared and Shared -> Private) is curved apart, each
bowing to its own side of the line between the boxes (`arrow-reciprocal.ts`):
at least `RECIPROCAL_BOW` (36), and for a labelled pair running up and down, far
enough for the two labels to sit side by side (a curve's label moves half its
bow), capped at 140. Drawn straight they lay on top of each other, only the
fan-out's few pixels apart, with their labels colliding. Arrows that already
carry a curve or a routing are left as they are.

### Layout styles

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

- The style lives in `AutoLayoutOptions` on `autoLayoutElements`: importers and the
  MCP server keep calling it with no style and get Smart, unchanged.
- **UI:** the Cleanup category shows a tile per style (Smart is the plain
  "Auto Layout" tile), and the command palette carries one command per style
  ("Auto Layout: Mindmap", ...). All styles are the same single undoable op.

### Hover to see it first

On a desktop pointer, hovering a Cleanup row lays the tab out **live behind the
menu**; the layout only sticks on click, and taking the pointer off the row puts
everything back. Five styles that can only be told apart by doing them is five
undos to find the one you wanted, and the names ("Tree", "Mindmap") describe a
shape the author has to imagine. Showing it is cheaper than explaining it.

It is the style-preset preview ([Style presets](../010-palette/style-presets.md)) one level up:
that one previews a look on the selected elements, this one previews a position
on all of them, and the rules are the same ones for the same reasons.

- The transforms live in `lib/tab-cleanup.ts` (`cleanupElements`), shared by the
  preview and the command, so a preview is byte-for-byte the layout its click
  commits.
- The first hover snapshots the tab. Every hover lays out from that snapshot, so
  sweeping down the rows shows each style cleanly rather than stacking them.
- Preview and revert go through `tickTabs`: present-only, no undo snapshot, no
  activity entry, and autosave skips the tick (`previewingRef`), so nothing
  ephemeral is ever persisted or logged.
- The click ends the preview first and commits second, in one React batch, so
  undo returns to the layout the author actually had rather than to the preview.
- **Mouse pointers only.** On touch a tap IS the commit, so a preview would be a
  flicker. The row also reverts if the menu closes or the section collapses with
  the pointer still on it, since `pointerleave` does not fire on unmount.
- Tree and Mindmap consume the same directed edge set as the layered layout; on a
  graph that isn't a tree (extra in-edges, cycles) they lay out a BFS/longest-path
  spanning tree and let the extra arrows re-anchor across it (deterministic, never
  an error).
- Telemetry: the existing `Tab` / `Aligned` event gains the style as its `type`
  (`Smart`, `FlowchartDown`, `FlowchartRight`, `Tree`, `Mindmap`; Auto-align keeps
  the bare event).

## Out of scope

Force-directed ("organic") layouts, routing arrow paths around obstacles, and any LLM
involvement (the AI "Clean" in [AI Assistance](../007-editor/ai-assistance.md) is the separate,
key-gated path; Auto Layout is the deterministic, offline-safe one every deployment
gets). See issue #12 for the fuller rationale and open questions.
