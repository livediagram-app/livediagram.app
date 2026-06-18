# Layout cleanup

The tab / canvas context menu carries a **Cleanup** category (next to Look & Feel
and Font, see [spec/09](09-canvas-and-command-palette.md)) holding the two layout
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

## Out of scope

Radial / force-directed layouts, routing arrow paths around obstacles, and any LLM
involvement (the AI "Clean" in [spec/25](25-ai-assistance.md) is the separate,
key-gated path; Auto Layout is the deterministic, offline-safe one every deployment
gets). See issue #12 for the fuller rationale and open questions.
