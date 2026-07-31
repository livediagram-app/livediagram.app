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

A child goes to the **right** of its parent, at `parent.x + width + 64`.

Its `y` is the bottom of the lowest existing node in that parent's subtree,
plus a gap — not the parent's `y`. Stacking against the subtree rather than the
immediate children is what stops a new branch from landing on top of a
grandchild that had already grown down past its own parent.

A sibling is a child of the same parent, so it takes the same path. **Enter on
a root** makes another root, offset below it, since a root has no parent to
attach to.

## Deleting

Deleting a node leaves its children with a `mindParentId` pointing at nothing.
They become roots — their arrows are already gone (arrow cleanup on delete is
existing behaviour), so what remains on screen is exactly what the model says.

The alternative, cascading the delete to the subtree, was rejected: deleting one
node and silently losing nine is the kind of thing you only notice after the
undo stack has moved on.

## Discoverability

A selected mind node shows a small hint chip under it: `Tab child · Enter
sibling`. Keyboard-driven expansion is worthless if nobody finds it, and a
tooltip on a palette tile is read once, months before it matters.

The chip is suppressed while the label is being edited (the keys mean something
else there) and on touch viewports, where there is no keyboard to hint at.

## What it is not

Not an auto-layout. Nodes are placed where they fit and then stay put — a mind
map that silently re-flowed every existing node on each keystroke would fight
anyone who had arranged one deliberately. The radial / tree re-layouts remain
available on demand from Auto Layout ([spec/47](47-layout-cleanup.md)), which
is the right place for "tidy this up now".
