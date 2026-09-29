# The mind node

Status: shipped

## What

A **Mind node**: a labelled node that knows its parent, and grows a mind map
from the keyboard.

- **Tab** on a selected node adds a **child**.
- **Enter** adds a **sibling** directly after it.

The same two actions are one click away, for anyone who doesn't know the keys:
**Add child** and **Add sibling** buttons on the node's selection toolbar (after
Edit text), and the same two options on its quick-connect "+" ring. Each names
its shortcut in its hover card. The toolbar buttons are not offered on a locked
node (growing re-lays the map) or to a view-role visitor.

Each new node is placed in the map, connected to its parent with a pinned
arrow, selected, and put straight into label editing — so a whole branch is
typed without touching the mouse.

## Why this is the gap

[Purpose](../001-project-vision/purpose.md) opens with "diagrams **and mindmaps** in real time",
and lists as a core capability: _"hierarchical node/branch structures with quick
keyboard-driven expansion."_

What shipped before this was three mindmap **templates** and a radial auto-layout
([Layout cleanup](../008-canvas/layout-cleanup.md)). A template is a static picture you then
rearrange by hand. The value of a mind-mapping tool is not the picture — it is
being able to keep up with someone talking, which means Tab and Enter and never
reaching for the palette. Half the product's stated identity was a starter
image.

## The element

`shape: 'mind-node'` — a shape kind, not a new element type, for the reason
[The Page element](page-element.md) gives: a new `BoxedElement` member would mean teaching validation, both
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

### A tidy map stays tidy

A map built from the keyboard is laid out by its **flow** (below): every parent
sits centred on the block of its children, and siblings stack along the flow's
axis with no gaps and no overlaps. That is the picture every mind-mapping tool
draws, and it is what someone typing a branch expects to see after each
keystroke. A parent left at the top of an ever-longer column of children, which
is where free placement leaves it, reads as a list hanging off a box.

So growth first asks whether the map **is** tidy: whether every node already
sits where the tidy layout (`layoutMindTree` in
`packages/diagram/src/mind-layout.ts`) would put it, to within a pixel. If it
is, the new node joins the layout and the map is re-laid out around it:
siblings slide to make room, parents re-centre, and the node lands in its slot.
The root never moves. A map grown by Tab and Enter from a single node, or from
a mind-map template, is tidy by construction, so it stays tidy for as long as
nobody rearranges it.

The moment someone drags a node, the map is theirs. It is no longer tidy, and
growth falls back to **free placement** (below), which never moves an existing
node of that map. **Tidy Map** in the Mind Map menu section puts it back, and
from then on it stays tidy again.

Order is read from the map as drawn: siblings are ordered along the flow's
stacking axis (top to bottom for a tree, left to right for a downward map,
clockwise from the west around a bubble map's root, and clockwise from the
side facing away from its parent around a deeper node). A new **sibling** goes **directly after** the node Enter
was pressed on, the way an outliner inserts the next line, not at the end of
the list. A new **child** goes after the parent's last child.

### Free placement

In a map that is not tidy, a tree child goes to the **right** of its parent, at
`parent.x + width + 64` (the other flows place along their own axis, below).

Its `y` is the bottom of the lowest existing node in that parent's subtree,
plus a gap — not the parent's `y`. Stacking against the subtree rather than the
immediate children is what stops a new branch from landing on top of a
grandchild that had already grown down past its own parent.

A sibling is a child of the same parent, so it takes the same path.

### Always the end of the relationship, never the first free slot

In free placement a new node joins the **end** of the list it belongs to. For
a child that is the bottom of the parent's branch, as above. **Enter on a
root** makes another root at the bottom of the root stack — under every tree
sharing that column, not in the gap directly below the node you pressed Enter
on. Taking that gap wedges the new root between two trees and leaves the one
below with nowhere to put its own siblings. (A root has no parent to lay out
around, so this holds for tidy maps too.)

"Sharing that column" is a horizontal-overlap test against each tree's bounding
box, so a second mind map parked well off to the side is a separate map and
stays out of the sum.

### Making room

A grown map keeps its shape even when another tree is parked in the way: every
other tree it would collide with **slides down**, whole, so no branch is torn
away from its own parent. Trees are handled top-down and each displaced tree
becomes an obstacle itself, so one shove cascades through a column instead of
moving the pile-up one place down. The obstacles are every node the growth
added or moved: just the new node in free placement, and the re-laid-out nodes
in tidy growth.

Dropping the child below everything instead (the first fix) kept it clear and
put it nowhere near its parent, with its connector raking back across the map.
In free placement the node's own tree never moves — moving the branch you are
growing from would be absurd — so when a cousin in that same tree holds the
slot, the new node is the one that gives way.

Every move lands in the **same commit** as the add, so one keystroke is one
undo step.

## A new node looks like its level

A mind map's hierarchy is carried by how its levels look: a bold root, tinted
branches, plain leaves. A new node therefore copies the look of a node at **its
own level**: a sibling first, else a cousin at the same depth of the same map.
Only the first node of a new level falls back to its parent's look, and the
first child of a **root** takes the element's defaults instead, because a child
copying a bold root would give the map two roots.

"The look" is exactly what the format painter copies (`paintableBoxedFields`):
size, colours and their theme binding, border, corner radius, shadow and text
styling, never the label, position or links. Growing a template's branch
therefore gives a node that matches its siblings rather than a default box
among styled ones. It replaces the earlier rule, which inherited only the size
of the node grown from.

## Connectors

A grown node's connector copies the look of its **siblings' connectors**
(`paintableArrowFields`), else the connector into its parent, so a map drawn
with straight lines, dashes or arrowheads keeps growing that way. With nothing
to copy it is a **curved line with no arrowheads**: a mind map shows belonging,
not direction, and the curve is what keeps a fanned column of children legible.

The faces a connector joins are the **flow's**, not the nearest pair: a tree
leaves the parent's east face and enters the child's west face however far down
the column the child is. The nearest-pair chooser picked the parent's south
face for a third child, and the connector then ran behind the second child to
reach it. A balanced map uses east or west by the side the child is on, a
downward map south to north, and only the bubble flow, which fans in every
direction, asks the shared chooser (`bestAnchorTowards`). A re-layout
(tidy growth, Tidy Map, a flow change) re-anchors the map's connectors by the
same rule.

## Keyboard

Tab and Enter fire off the **selected** node, with no label editor open, and
again from inside the label editor so a chain of nodes is typed without pausing.

Tab is also the canvas's element-traversal key ([Canvas accessibility baseline](../004-interface-design/canvas-accessibility.md)),
and both listeners sit on `window`. The traversal one is mounted first, so it
consumed every Tab and pressing it on a mind node cycled the tab's elements
instead of growing a branch: the selected element now gets first refusal on the
key. Shift+Tab stays traversal, since only plain Tab grows.

### Typing ahead

Someone who knows the keystrokes types them faster than the editor re-renders:
"Tab, Marketing, Enter, Sales" arrives as one burst. Every key in that burst
belongs to a node that may not be on screen yet. Before this rule the early
ones went to the node being left, to the canvas as shortcuts, or nowhere:
labels came out blank, and a Tab pressed during the gap grew from the wrong
node, stacking two nodes on one spot.

So a growth opens a **handoff** (`apps/live/lib/mind-handoff.ts`): until the new
node's label editor has mounted and taken focus, every keystroke is captured
for it, as a queue of segments (the text for one node and the key that left
it). Characters and Backspace edit the open segment, which the editor types in
the moment it opens. A segment already ended by Tab or Enter never needs the
editor: it closes without committing, and a task later the editor state writes
that text as the node's label and grows the next node **in one commit**, while
the capture carries on collecting the rest of the burst for it. So a burst of
several nodes lands exactly as typed. Escape ends the typing: the text is kept,
or an empty node is removed as below.

Finishing the node from the editor state rather than replaying the key inside
the new editor is deliberate. The replay raced the editor's own mount: its
label commit read the tab through a ref refreshed only in a passive effect, so
it wrote back a snapshot from before the node existed, and a remount right
after mount could close the editor before the replay ran, dropping the rest of
the burst. Keys held with Cmd, Ctrl or Alt pass through untouched,
so undo still works mid-burst. A handoff that is never claimed (a peer removed
the node) lets go after 1.5 s and writes its buffer to the label, so nothing
typed is dropped.

For the same reason growth reads the map **as it stands in the commit**, not as
it was when the editor last rendered: two growths queued in one frame place
against each other rather than both taking the same slot.

### Escape keeps what you typed

In a mind node's label editor **Escape commits** rather than cancels. Escape is
how people leave a chain of typing, and the node they leave is the one they just
finished, so a cancel threw away the last thing they said.

An **empty** node that was empty when the edit began, has a parent and has no
children is not something anybody meant to keep: it is the Tab pressed one time
too many. Escape removes it with its connector and selects its parent, so the
keys carry on from there. If the map was tidy, it is laid out again without the
node, closing the gap its growth opened, so it stays tidy.

## Following the growth

The view follows the keyboard: a grown node that lands off screen, or under the
floating panels along the canvas's sides, is scrolled into view (the viewport's
`scrollIntoView`, with a side margin wide enough to clear the palette). A branch
typed past the edge of the screen otherwise carried on out of sight, with the
editor typing into a box nobody could see.

## Moving a branch

Dragging a mind node carries its **whole subtree**, the way a frame carries its
contents. A branch is one idea: moving its heading and leaving its points
behind is never the intent, and re-dragging each of them was the workaround.
Resizing a node resizes only that node.

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
  flipping deeper down folds it back over its own parent. A new root child
  (Tab) goes to the side with less on it; a sibling (Enter) stays on the side
  of the node it was pressed on.
- **Downward** — branches below, siblings spread across. The tree on its side,
  which is what an org chart or a decision tree looks like.
- **Bubble** — branches fanned around the parent. Laid out tidily, the root's
  children share the full circle **equally**, starting from the root's west
  side and running clockwise, so a lone first branch points east. Weighting
  them by leaf count swung every other branch round the dial each time one of
  them grew a leaf. Every deeper level splits its parent's wedge by leaf count,
  and each ring grows until the nodes on it clear each other. In free
  placement each new child takes the next free angle either side of the
  direction the branch already runs in.

The flow is stored on the map's **root** (`mindFlow`) and read for the whole
tree: a map half tree and half bubble is not a map anyone meant to draw. So a
pick on any node sets its root's, and selecting several nodes of one map sets it
once.

Picking a flow **re-lays the map out** in it straight away, around the root
(which stays put). A flow that only changed where the next node would land left
the map looking exactly the same after the click, so the pick looked broken.
The flow change and the re-layout are one undo step.

The **keystrokes do not change**. Tab is still a child and Enter still a
sibling; the flow decides only where the node lands, and which faces its
connector leaves and enters through (see Connectors).

In free placement, collisions push along the flow's own stacking axis: a tree
stacks a column, so something in the way moves down; a downward map spreads a
row, so it moves right. Pushing the wrong way would shove a node straight into
the next sibling's slot.

## Tidy Map

**Tidy Map**, under the flow tiles in the Mind Map menu section, lays the
selected node's whole map out in its flow, keeping the root where it is and the
sibling order as drawn, and re-anchors its connectors. Other trees in the way
slide down, as they do for growth. It is the way back to a tidy map after
dragging nodes around, and from then on growth keeps it tidy.

## Round nodes

A mind node honours its **corner radius** setting; with none it is the soft
12 px box it always was. A square node with a full radius is a circle, which is
how the bubble map template draws its bubbles while staying a live map. The
exported SVG uses the same radius.

## Templates

Every mind-map template is built from mind nodes carrying their parent pointers
and the root's flow, and laid out by `layoutMindTree`, so a template is a live,
tidy map rather than a picture of one: select any node and Tab and Enter grow
it in place, and the new nodes look like the template's own.

- **Mind map**: the bubble flow; a root with four branches of two leaves each.
- **Tree mind map**: the tree flow; a bold root, four tinted branches, two small leaves each.
- **Bubble map**: the bubble flow with round nodes and a single ring.

## Deleting

Deleting a node leaves its children with a `mindParentId` pointing at nothing.
They become roots — their arrows are already gone (arrow cleanup on delete is
existing behaviour), so what remains on screen is exactly what the model says.

The alternative, cascading the delete to the subtree, was rejected: deleting one
node and silently losing nine is the kind of thing you only notice after the
undo stack has moved on.

## Discoverability

A selected mind node's quick-add **"+"** leads with **Add child** and **Add
sibling**, each naming its shortcut in the hover card ("Shortcut: Tab", "Shortcut:
Enter"). Keyboard-driven expansion is worthless if nobody finds it, and a
hover card on a palette tile is read once, months before it matters. The "+" is
where every other per-element action already lives, so the two that grow a
mind map belong there too, and the actions work by pointer as well as by key,
which the shortcuts alone never did.

This **replaces a hint chip** pinned under the selected node. It announced the
two shortcuts to everybody forever rather than to whoever was looking for
them; it was dark enough to read as an error state in light mode; and it hung
off the node's left edge rather than centred, because a centred one landed
underneath the very "+" the actions now live in.

## What it is not

Not an auto-layout of anything else on the tab. Tidy growth re-lays out only
the map being grown, and only while that map is still exactly as the layout
left it; a hand-arranged map is never re-flowed by a keystroke. Arbitrary
diagrams keep the radial / tree re-layouts in Auto Layout
([Layout cleanup](../008-canvas/layout-cleanup.md)).
