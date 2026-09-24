# Layout cleanup

The tab / canvas context menu carries a **Cleanup** category (next to Look & Feel
and Font, see [spec/09](09-canvas-and-palette.md)) holding the two layout
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

`autoLayoutElements` (`packages/diagram/src/auto-layout.ts`, a pure transform over the
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
- One undoable op (`commit` snapshots the pre-layout state) and one activity-log
  entry, so it can be reverted in a single step.

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

It is the style-preset preview ([spec/48](48-style-presets.md)) one level up:
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
involvement (the AI "Clean" in [spec/25](25-ai-assistance.md) is the separate,
key-gated path; Auto Layout is the deterministic, offline-safe one every deployment
gets). See issue #12 for the fuller rationale and open questions.
