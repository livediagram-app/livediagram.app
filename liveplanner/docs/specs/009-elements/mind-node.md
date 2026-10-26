# The mind node

**In liveplanner** a mind node is a model kind: `packages/project` holds its parent pointers, its tidy layout (`mind-layout.ts`), its growth placement (`mind-grow.ts`), its flows (`mind-flow.ts`) and its connectors (`mind-connector-route.ts`), and every export draws it. No Plan surface places one, and the editor offers no way to grow a map (no Tab / Enter growth, no quick-add Add Child / Add Sibling, no Mind Map menu, Tidy Map or Edit Outline). On the canvas a map moves as branches and deletes as branches, as below; an agent's elements reach the layout through the MCP.

## What

A **Mind node** (`shape: 'mind-node'`) is a labelled node that knows its parent (`mindParentId`), so a set of them is
a mind map: a tree of nodes joined by pinned connectors, laid out by the map's flow and spacing, both stored on its
root. The placement rules below are the model's (`mind-grow.ts`, `mind-layout.ts`): where a new child or sibling
lands, how a tidy map re-lays out around it, and how a hand-arranged one is left alone. In liveplanner they run when
an agent's elements reach the layout; the editor has no growth gesture.

## The element

`shape: 'mind-node'`: a shape kind, not a new element type, for the reason
[The Page element](page-element.md) gives: a new `BoxedElement` member would mean teaching validation, both
export renderers, Markdown, the MCP tools and the API
schema about something that behaves like a shape in all of them.

One new field:

```ts
mindParentId?: ElementId;
```

Absent = a root. It is the **only** thing that makes this more than a rounded
box, and it is deliberately not a `children[]` array: a child pointer is
single-valued, so it cannot disagree with itself, and a dangling id (a parent
gone some other way, an erased node) leaves a root rather than a corrupt tree
(see "Deleting" below).

The connector is an ordinary pinned arrow. The tree is not a second graph
model: it is the arrows you can already see, plus a pointer saying which node
owns which.

## Placement

Default size **250×80**: wide enough for a phrase. 170×48 fits a couple of words
and makes anything longer wrap or overflow, which is not what people type into a
mind map.

### A node grows to fit its label

A label with more lines than the node has room for (lines started with Shift+Enter, or a long
line wrapping) makes the node **taller**, never wider: the width is the map's rhythm, the
height is the content's. The lines are measured the way the label draws them (its size, font,
weight and formatting, at the node's width less its padding; a node sized **Auto** measures at
the size its editor types in), and the node's height becomes the lines' height plus its padding,
rounded up to a whole pixel.

- **While typing**, the node grows with each line, so the editor never types into hidden lines.
  Nothing is written per keystroke: the grown size is drawn locally until the edit commits.
- **On commit**, the grown height is written with the label, in the same commit (one undo step).
  The same holds for a label written by the typing-ahead handoff (below), which never opens an
  editor.
- The node grows **downward** (its top stays put). If the map was tidy before, it is laid out
  again around the taller node in the same commit, so siblings never overlap it and the map stays
  tidy; a hand-arranged map is left where it is.
- A node **never shrinks** on its own: deleting lines leaves the height it had, the way a resized
  node keeps the size it was given. Resizing it is how it gets shorter.
- A **Participant** writing on anyone's node grows it the same way: the taller height lands with the label in
  one change (`participant-content.ts`, the rule the editor and the room share), though a Participant never
  otherwise resizes a node it did not add ([Share roles](../013-workspace/share-roles.md)). The growth is bounded by the label: at most two lines of the largest label size per character it holds, so
  a changed letter can never stretch a node out of reach.

### A tidy map stays tidy

A grown map is laid out by its **flow** (below): every parent
sits centred on the block of its children, and siblings stack along the flow's
axis with no gaps and no overlaps. That is the picture every mind-mapping tool
draws, and it is what someone typing a branch expects to see after each
keystroke. A parent left at the top of an ever-longer column of children, which
is where free placement leaves it, reads as a list hanging off a box.

So growth first asks whether the map **is** tidy: whether every node already
sits where the tidy layout (`layoutMindTree` in
`packages/project/src/mind-layout.ts`) would put it, to within a pixel. If it
is, the new node joins the layout and the map is re-laid out around it:
siblings slide to make room, parents re-centre, and the node lands in its slot.
The root never moves. A map grown from a single node is tidy by construction, so it stays tidy for as long as
nobody rearranges it.

The moment someone drags a node, the map is theirs. It is no longer tidy, and
growth falls back to **free placement** (below), which never moves an existing
node of that map.

Order is read from the map as drawn: siblings are ordered along the flow's
stacking axis (top to bottom for a tree or a leftward map, left to right for a downward or upward map,
clockwise from the west around a bubble map's root, and clockwise from the
side facing away from its parent around a deeper node). A new **sibling** goes **directly after** the node Enter
was pressed on, the way an outliner inserts the next line, not at the end of
the list. A new **child** goes after the parent's last child.

### Free placement

In a map that is not tidy, a tree child goes to the **right** of its parent, at
`parent.x + width + 64` (the other flows place along their own axis, below).

Its `y` is the bottom of the lowest existing node in that parent's subtree,
plus a gap, not the parent's `y`. Stacking against the subtree rather than the
immediate children is what stops a new branch from landing on top of a
grandchild that had already grown down past its own parent.

A sibling is a child of the same parent, so it takes the same path.

### Always the end of the relationship, never the first free slot

In free placement a new node joins the **end** of the list it belongs to. For
a child that is the bottom of the parent's branch, as above. **Enter on a
root** makes another root at the bottom of the root stack, under every tree
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

Dropping the child below everything instead would keep it clear and put it
nowhere near its parent, with its connector raking back across the map.
In free placement the node's own tree never moves (moving the branch you are
growing from would be absurd), so when a cousin in that same tree holds the
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

"The look" is the node's style: size, colours and their theme binding, border, corner radius, shadow and text
styling, never the label, position or links. Growing a template's branch
therefore gives a node that matches its siblings rather than a default box
among styled ones.

## Connectors

A grown node's connector copies the look of its **siblings' connectors**
(`mindStyleSource` names the one to copy), else the connector into its parent, so a map drawn
with straight lines, dashes or arrowheads keeps growing that way. With nothing
to copy it is a **curved line with no arrowheads**: a mind map shows belonging,
not direction, and the curve is what keeps a fanned column of children legible.

The faces a connector joins are the **flow's**, not the nearest pair: a tree
leaves the parent's east face and enters the child's west face however far down
the column the child is. The nearest-pair chooser would pick the parent's south
face for a third child, and the connector would then run behind the second
child to reach it. A leftward map leaves west and enters east, a balanced map uses east or west by the side
the child is on, a downward map south to north (an upward map north to south), and only the bubble flow, which fans in every
direction, asks the shared chooser (`bestAnchorTowards`). A re-layout
(tidy growth, a flow change) re-anchors the map's connectors by the
same rule.

A bubble map's spokes are drawn **straight in every finish**, not only in Professional. A curve leaves its
face square to it and bulges sideways, and in a fan that runs every way the bulge passed behind a sibling's card
(growing Travel's Hotel and Taxi on the Mind Map template made Taxi read as Hotel's child). A straight spoke from
face to face clears its siblings, since a ring only grows until its nodes clear each other. Like the Professional
routes, it is how the map is drawn, not what is stored, and a bow or bend dragged onto one spoke wins, as any
look picked on a connector does.

### In the Professional finish

The Professional finish ([Finish](../008-canvas/finish.md)) draws a map's connectors right-angled, and neat:

- **Tree, leftward and balanced:** every connector off one parent leaves the same point on the parent's side face,
  runs out to one shared **trunk** halfway across the gap between the parent and its nearest child on that
  side, runs along the trunk, and turns once more straight into the child's facing side. A column of siblings
  reads as one bracket, with no jogs at the card edges and no diagonals. A child level with its parent is
  one straight run. A child dragged further out still turns on the trunk, so the bracket holds.
- **Downward:** every connector leaves the middle of the parent's bottom, drops to one horizontal **bus**
  halfway down the gap to the nearest child, runs along it, and drops straight into the middle of each
  child's top. A child directly below is one straight drop. **Upward** is the same bus mirrored: up from
  the parent's top into each child's bottom.
- **Bubble:** straight spokes from face to face, as in every finish. A bubble map fans every way, so a right
  angle there would cross its own branches; a straight spoke is the neat line.

This is how the finish draws the map, not what is stored: the connectors stay curved, so switching the tab
back to Flexible or Sketch shows the curves, and growth under Professional copies the curved look and is
drawn the same right-angled way. Only a connector still in the map's **default look** (curved, never bowed
or bent by hand) is routed. One that was given another style (straight, angled), a bow or a bend keeps it,
because a pick on an element wins in every finish; one given its own Flexible finish keeps its curve, which
is how to keep a curve on a Professional tab. A connector whose faces were re-pinned so they no longer face
each other is drawn as a plain one-elbow angled line.

A routed connector has no bow, elbow or bend handles, and dragging its line does not bend it: the shape is
the map's, worked out from where the nodes are, so it follows every move. Its ends start and end exactly on
the faces rather than in the fan that spreads arrows sharing an anchor, which is what lets siblings share one
trunk. Routing is the same on the canvas and in every export, and costs one pass over the board per render
(a 2,000-node map routes in about 10 to 25 ms of CPU, about what the fan costs in Flexible).

## Following the growth

The viewport's `scrollIntoView` takes a `sideMargin` that widens its side band to clear the floating panels (capped at
a quarter of the canvas), for a reveal that should land in the open canvas, such as a grown node. No liveplanner
surface grows a node, so nothing passes it today.

## Moving a branch

Dragging a mind node carries its **whole subtree**, the way a frame carries its
contents. A branch is one idea: moving its heading and leaving its points
behind is never the intent, and re-dragging each of them would be the
workaround.
Resizing a node resizes only that node.

## Flows: the shape the map grows in

The arrangement an outline wants is a child to the right,
siblings stacked down it. That is a **tree**, and it is only one of the shapes
people draw. There are six (`MindFlow` in
`packages/project/src/mind-flow.ts`), stored on the root (`mindFlow`):

- **Tree**: branches right, siblings stacked down. The default, so every map
  already drawn keeps its shape.
- **Balanced**: branches both ways off the root, the classic hand-drawn mind
  map. Only the root alternates: a branch keeps the side it started on, because
  flipping deeper down folds it back over its own parent. A new root child
  (Tab) goes to the side with less on it; a sibling (Enter) stays on the side
  of the node it was pressed on.
- **Downward**: branches below, siblings spread across. The tree on its side,
  which is what an org chart or a decision tree looks like.
- **Leftward**: branches left, siblings stacked down. The tree mirrored, for a
  map read right to left or one that sits against the right of the canvas.
- **Upward**: branches above, siblings spread across. The downward tree
  mirrored, for a goal tree that builds up to its root, the way a pyramid of
  reasons reads.
- **Bubble**: branches fanned around the parent. Laid out tidily, the root's
  children share the full circle **equally**, starting from the root's west
  side and running clockwise, so a lone first branch points east. Weighting
  them by leaf count would swing every other branch round the dial each time
  one of them grew a leaf. Every deeper level splits its parent's wedge by leaf count,
  and each ring grows until the nodes on it clear each other. In free
  placement each new child takes the next free angle either side of the
  direction the branch already runs in.

The flow is stored on the map's **root** (`mindFlow`) and read for the whole
tree: a map half tree and half bubble is not a map anyone meant to draw. So a
pick on any node sets its root's, and selecting several nodes of one map sets it
once.

Picking a flow **re-lays the map out** in it straight away, around the root
(which stays put). A flow that only changed where the next node would land
would leave the map looking exactly the same after the click, so the pick would
look broken.
The flow change and the re-layout are one undo step.

The **keystrokes do not change**. Tab is still a child and Enter still a
sibling; the flow decides only where the node lands, and which faces its
connector leaves and enters through (see Connectors).

In free placement, collisions push along the flow's own stacking axis: a tree
stacks a column, so something in the way moves down (a leftward map too); a
downward or upward map spreads a row, so it moves right. Pushing the wrong way would shove a node straight into
the next sibling's slot.

## Spacing

How far apart a map's nodes sit is the map's **spacing** (`MindSpacing` in
`packages/project/src/mind-flow.ts`), picked from **Spacing** in the Mind Map
menu. It scales both gaps the layout uses, parent to child along the flow and
sibling to sibling across it, by one factor:

| Spacing         | Factor | Parent to child | Between siblings |
| --------------- | ------ | --------------- | ---------------- |
| **Tight**       | 0.5    | 32              | 9                |
| **Compact**     | 0.75   | 48              | 14               |
| **Comfortable** | 1      | 64              | 18               |
| **Wide**        | 1.5    | 96              | 27               |

(Rounded to whole pixels. The downward and upward flows' level gap, a sibling gap plus half a child gap, scales
the same way.)

**Comfortable** is the default and is exactly the gaps maps have always had, so
every map already drawn keeps its shape. Like the flow, spacing is stored on the
map's **root** (`mindSpacing`, absent = Comfortable) and applies to the whole
map. A change re-lays the map out at once, around the root, in one undo step,
the same way a flow change does; growth uses it from then on, and in
free placement a new node lands the chosen gap from its parent and siblings.

## Round nodes

A mind node honours its **corner radius** setting; with none it is a soft
12 px box. A square node with a full radius is a circle, which is
how the bubble map template draws its bubbles while staying a live map. The
exported SVG uses the same radius.

The corner radius is **settable like a rectangle's**
([Corner radius](../008-canvas/corner-radius.md)): the context menu's Border
category offers the Radius grid (None, Small, Medium, Large, Full) on a mind
node, and a whiteboard's quick style panel offers its Corners row. An unset
node's grid highlights **Medium**, the preset that matches its 12 px default.

## Deleting

Deleting a node deletes its **branch**: every node under it and the connectors
between them go in the same undo step. A branch is one idea, the same reason it
moves as one (see "Moving a branch"), and a heading deleted from under its
points left those points floating as unconnected roots nobody meant to keep.
Undo brings the whole branch back.

- It applies to Delete / Backspace, the element menu's Delete, and a
  multi-selection's delete: each selected node takes its branch.
- **Cut** takes the branch too, and copies it first, so a paste puts the whole
  branch back. A plain **Copy** copies only what is selected.
- A **locked** node in the branch (or one on a locked layer) stays, as do the
  nodes under it, and becomes a root, as any protected element survives a
  delete.
- A child whose parent is gone becomes a root.

## What it is not

Not an auto-layout of anything else on the tab. Tidy growth re-lays out only
the map being grown, and only while that map is still exactly as the layout
left it; a hand-arranged map is never re-flowed by a keystroke. Arbitrary
diagrams keep the radial / tree re-layouts in Auto Layout
([Layout cleanup](../008-canvas/layout-cleanup.md)).
