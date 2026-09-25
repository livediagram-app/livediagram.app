# 118 — The mind node

Status: shipped

## What

A **Mind node**: a labelled node that knows its parent, and grows a mind map
from the keyboard.

- **Tab** on a selected node adds a **child** to its right.
- **Enter** adds a **sibling** below it.

Each new node is placed clear of its siblings, connected to its parent with a
pinned arrow, selected, and put straight into label editing — so a whole branch
is typed without touching the mouse.

## Why this is the gap

[spec/00](00-purpose.md) opens with "diagrams **and mindmaps** in real time",
and lists as a core capability: _"hierarchical node/branch structures with quick
keyboard-driven expansion."_

What shipped before this was three mindmap **templates** and a radial auto-layout
([spec/47](47-layout-cleanup.md)). A template is a static picture you then
rearrange by hand. The value of a mind-mapping tool is not the picture — it is
being able to keep up with someone talking, which means Tab and Enter and never
reaching for the palette. Half the product's stated identity was a starter
image.

## The element

`shape: 'mind-node'` — a shape kind, not a new element type, for the reason
spec/100 gives: a new `BoxedElement` member would mean teaching validation, both
export renderers, Mermaid, Markdown, Excalidraw, the MCP tools and the API
schema about something that behaves like a shape in all of them.

One new field:

```ts
mindParentId?: ElementId;
```

Absent = a root. It is the **only** thing that makes this more than a rounded
box, and it is deliberately not a `children[]` array: a child pointer is
single-valued, so it cannot disagree with itself, and deleting a parent leaves
dangling ids rather than a corrupt tree (see "Deleting" below).

The connector is an ordinary pinned arrow. The tree is not a second graph
model — it is the arrows you can already see, plus a pointer saying which node
owns which.

## Placement

Default size **250×80**. It was 170×48, which fitted a couple of words and made
anything longer wrap or overflow, which is not what people type into a mind map.

A child goes to the **right** of its parent, at `parent.x + width + 64`.

Its `y` is the bottom of the lowest existing node in that parent's subtree,
plus a gap — not the parent's `y`. Stacking against the subtree rather than the
immediate children is what stops a new branch from landing on top of a
grandchild that had already grown down past its own parent.

A sibling is a child of the same parent, so it takes the same path.

### Always the end of the relationship, never the first free slot

A new node joins the **end** of the list it belongs to. For a child that is the
bottom of the parent's branch, as above. **Enter on a root** makes another root
at the bottom of the root stack — under every tree sharing that column, not in
the gap directly below the node you pressed Enter on. Taking that gap wedges the
new root between two trees and leaves the one below with nowhere to put its own
siblings.

"Sharing that column" is a horizontal-overlap test against each tree's bounding
box, so a second mind map parked well off to the side is a separate map and
stays out of the sum.

### Making room

A child keeps its natural slot even when another tree is parked in it: every
other tree it would collide with **slides down**, whole, so no branch is torn
away from its own parent. Trees are handled top-down and each displaced tree
becomes an obstacle itself, so one shove cascades through a column instead of
moving the pile-up one place down.

Dropping the child below everything instead (the first fix) kept it clear and
put it nowhere near its parent, with its connector raking back across the map.
The node's own tree never moves — moving the branch you are growing from would
be absurd — so when a cousin in that same tree holds the slot, the new node is
the one that gives way.

The displacement lands in the **same commit** as the add, so one keystroke is
one undo step.

## Keyboard

Tab and Enter fire off the **selected** node, with no label editor open, and
again from inside the label editor so a chain of nodes is typed without pausing.

Tab is also the canvas's element-traversal key ([spec/71](71-canvas-accessibility.md)),
and both listeners sit on `window`. The traversal one is mounted first, so it
consumed every Tab and pressing it on a mind node cycled the tab's elements
instead of growing a branch: the selected element now gets first refusal on the
key. Shift+Tab stays traversal, since only plain Tab grows.

## Flows: the shape the map grows in

Growth started with one arrangement, the one a keyboard-driven outline wants: a
child to the right, siblings stacked down it. That is a **tree**, and it is only
one of the shapes people draw. Four ship (`MindFlow` in
`packages/diagram/src/mind-flow.ts`), picked from the **Mind Map** section of a
selected node's menu:

- **Tree** — branches right, siblings stacked down. The default, so every map
  already drawn keeps its shape.
- **Balanced** — branches both ways off the root, the classic hand-drawn mind
  map. Only the root alternates: a branch keeps the side it started on, because
  flipping deeper down folds it back over its own parent.
- **Downward** — branches below, siblings spread across. The tree on its side,
  which is what an org chart or a decision tree looks like.
- **Bubble** — branches fanned around the parent, each new child taking the next
  free angle either side of the direction the branch already runs in. Siblings
  therefore never collide by construction, which is why this flow needs no
  stacking rule.

The flow is stored on the map's **root** (`mindFlow`) and read for the whole
tree: a map half tree and half bubble is not a map anyone meant to draw. So a
pick on any node sets its root's, and selecting several nodes of one map sets it
once.

The **keystrokes do not change**. Tab is still a child and Enter still a
sibling; the flow decides only where the node lands, and which faces its
connector leaves and enters through. Those come from the shared anchor chooser
(`bestAnchorTowards`) rather than a hardcoded pair, so a tree runs east to west,
a downward map north to south, and a fanned one whichever way the child actually
went, without each flow having to say so.

Collisions push along the flow's own stacking axis: a tree stacks a column, so
something in the way moves down; a downward map spreads a row, so it moves right.
Pushing the wrong way would shove a node straight into the next sibling's slot.

## Deleting

Deleting a node leaves its children with a `mindParentId` pointing at nothing.
They become roots — their arrows are already gone (arrow cleanup on delete is
existing behaviour), so what remains on screen is exactly what the model says.

The alternative, cascading the delete to the subtree, was rejected: deleting one
node and silently losing nine is the kind of thing you only notice after the
undo stack has moved on.

## Discoverability

A selected mind node's quick-add **"+"** leads with **Add child** and **Add
sibling**, each naming its shortcut in the tooltip ("Shortcut: Tab", "Shortcut:
Enter"). Keyboard-driven expansion is worthless if nobody finds it, and a
tooltip on a palette tile is read once, months before it matters. The "+" is
where every other per-element action already lives, so the two that grow a
mind map belong there too, and the actions work by pointer as well as by key,
which the shortcuts alone never did.

This **replaces a hint chip** pinned under the selected node. It announced the
two shortcuts to everybody forever rather than to whoever was looking for
them; it was dark enough to read as an error state in light mode; and it hung
off the node's left edge rather than centred, because a centred one landed
underneath the very "+" the actions now live in.

## What it is not

Not an auto-layout. Nodes are placed where they fit and then stay put — a mind
map that silently re-flowed every existing node on each keystroke would fight
anyone who had arranged one deliberately. The radial / tree re-layouts remain
available on demand from Auto Layout ([spec/47](47-layout-cleanup.md)), which
is the right place for "tidy this up now".
