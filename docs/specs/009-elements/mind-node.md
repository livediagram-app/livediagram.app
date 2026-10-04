# The mind node

## What

A **Mind node**: a labelled node that knows its parent, and grows a mind map
from the keyboard.

- **Tab** on a selected node adds a **child**.
- **Enter** adds a **sibling** directly after it.

The same two actions are one click away, for anyone who doesn't know the keys:
**Add child** and **Add sibling** buttons on the node's selection toolbar (after
Edit text), and the same two options on its quick-connect "+" ring. On a mind
node the ring holds only those two and Duplicate: a free arrow, a freehand
sketch or a loose text label is not how a map grows, so Arrow, Pencil and Text
are left off it (they stay on every other element's ring). Each names
its shortcut in its hover card. The toolbar buttons are not offered on a locked
node (growing re-lays the map) or to a view-role visitor.

Each new node is placed in the map, connected to its parent with a pinned
arrow, selected, and put straight into label editing, so a whole branch is
typed without touching the mouse.

## Why this is the gap

[Purpose](../001-project-vision/purpose.md) opens with "diagrams **and mindmaps** in real time",
and lists as a core capability: _"hierarchical node/branch structures with quick
keyboard-driven expansion."_

Without it, a mind map comes only from three mindmap **templates** and a radial
auto-layout ([Layout cleanup](../008-canvas/layout-cleanup.md)). A template is a static picture you
then rearrange by hand. The value of a mind-mapping tool is not the picture; it
is being able to keep up with someone talking, which means Tab and Enter and
never reaching for the palette. Without growth, half the product's stated
identity is a starter image.

## The element

`shape: 'mind-node'`: a shape kind, not a new element type, for the reason
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
model: it is the arrows you can already see, plus a pointer saying which node
owns which.

## Placement

Default size **250×80**: wide enough for a phrase. 170×48 fits a couple of words
and makes anything longer wrap or overflow, which is not what people type into a
mind map.

### A tidy map stays tidy

A map built from the keyboard is laid out by its **flow** (below): every parent
sits centred on the block of its children, and siblings stack along the flow's
axis with no gaps and no overlaps. That is the picture every mind-mapping tool
draws, and it is what someone typing a branch expects to see after each
keystroke. A parent left at the top of an ever-longer column of children, which
is where free placement leaves it, reads as a list hanging off a box.

So growth first asks whether the map **is** tidy: whether every node already
sits where the tidy layout (`layoutMindTree` in
`packages/document/src/mind-layout.ts`) would put it, to within a pixel. If it
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

"The look" is exactly what the format painter copies (`paintableBoxedFields`):
size, colours and their theme binding, border, corner radius, shadow and text
styling, never the label, position or links. Growing a template's branch
therefore gives a node that matches its siblings rather than a default box
among styled ones.

## Connectors

A grown node's connector copies the look of its **siblings' connectors**
(`paintableArrowFields`), else the connector into its parent, so a map drawn
with straight lines, dashes or arrowheads keeps growing that way. With nothing
to copy it is a **curved line with no arrowheads**: a mind map shows belonging,
not direction, and the curve is what keeps a fanned column of children legible.

The faces a connector joins are the **flow's**, not the nearest pair: a tree
leaves the parent's east face and enters the child's west face however far down
the column the child is. The nearest-pair chooser would pick the parent's south
face for a third child, and the connector would then run behind the second
child to reach it. A balanced map uses east or west by the side the child is on, a
downward map south to north, and only the bubble flow, which fans in every
direction, asks the shared chooser (`bestAnchorTowards`). A re-layout
(tidy growth, Tidy Map, a flow change) re-anchors the map's connectors by the
same rule.

## Keyboard

Tab and Enter fire off the **selected** node, with no label editor open, and
again from inside the label editor so a chain of nodes is typed without pausing.

Tab is also the canvas's element-traversal key ([Canvas accessibility baseline](../004-interface-design/canvas-accessibility.md)),
and both listeners sit on `window`. The traversal one is mounted first, so the
selected element gets first refusal on the key; otherwise pressing Tab on a mind
node would cycle the tab's elements instead of growing a branch.
Shift+Tab stays traversal, since only plain Tab grows.

### Typing ahead

Someone who knows the keystrokes types them faster than the editor re-renders:
"Tab, Marketing, Enter, Sales" arrives as one burst. Every key in that burst
belongs to a node that may not be on screen yet. Left alone, the early ones
go to the node being left, to the canvas as shortcuts, or nowhere: labels come
out blank, and a Tab pressed during the gap grows from the wrong node,
stacking two nodes on one spot.

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
the new editor is deliberate. A replay races the editor's own mount: its
label commit reads the tab through a ref refreshed only in a passive effect, so
it writes back a snapshot from before the node existed, and a remount right
after mount can close the editor before the replay runs, dropping the rest of
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
finished, so a cancel would throw away the last thing they said.

An **empty** node that was empty when the edit began, has a parent and has no
children is not something anybody meant to keep: it is the Tab pressed one time
too many. Escape removes it with its connector and selects its parent, so the
keys carry on from there. If the map was tidy, it is laid out again without the
node, closing the gap its growth opened, so it stays tidy.

## Following the growth

The view follows the keyboard: a grown node that lands off screen, or under the
floating panels along the canvas's sides, is scrolled into view (the viewport's
`scrollIntoView`, with a side margin wide enough to clear the palette).
Otherwise a branch typed past the edge of the screen carries on out of sight,
with the editor typing into a box nobody can see.

## Moving a branch

Dragging a mind node carries its **whole subtree**, the way a frame carries its
contents. A branch is one idea: moving its heading and leaving its points
behind is never the intent, and re-dragging each of them would be the
workaround.
Resizing a node resizes only that node.

## Flows: the shape the map grows in

The arrangement a keyboard-driven outline wants is a child to the right,
siblings stacked down it. That is a **tree**, and it is only one of the shapes
people draw. There are four (`MindFlow` in
`packages/document/src/mind-flow.ts`), picked from the **Mind Map** section of a
selected node's menu:

- **Tree**: branches right, siblings stacked down. The default, so every map
  already drawn keeps its shape.
- **Balanced**: branches both ways off the root, the classic hand-drawn mind
  map. Only the root alternates: a branch keeps the side it started on, because
  flipping deeper down folds it back over its own parent. A new root child
  (Tab) goes to the side with less on it; a sibling (Enter) stays on the side
  of the node it was pressed on.
- **Downward**: branches below, siblings spread across. The tree on its side,
  which is what an org chart or a decision tree looks like.
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
stacks a column, so something in the way moves down; a downward map spreads a
row, so it moves right. Pushing the wrong way would shove a node straight into
the next sibling's slot.

## Tidy Map

**Tidy Map**, under the flow tiles in the Mind Map menu section, lays the
selected node's whole map out in its flow, keeping the root where it is and the
sibling order as drawn, and re-anchors its connectors. Other trees in the way
slide down, as they do for growth. It is the way back to a tidy map after
dragging nodes around, and from then on growth keeps it tidy.

Tidy Map always says what it did, in a notification at the foot of the screen: **Map tidied**
when nodes moved, or **Map already tidy** when the map was already laid out and nothing changed
(so a click that seems to do nothing is never a mystery). The notifications follow the "Show
notifications" preference, like every other confirmation.

## Edit Outline

A whole map can be written as text: an indented outline, edited in a dialog and applied back to
the map in one go. Restructuring a map by dragging node by node is slow; reading and rewriting it
as a list is how people already think about an outline.

**Where.** A map's **root** (the node `mindRootOf` names, so a node whose parent was deleted
counts as a root too) with at least one child carries an **Edit Outline** badge at its top-right,
always shown (not only when selected), in the same chip as its link, note, action and comment
badges: the first segment, left of the others, so a map announces it can be edited as a list. One click opens
the dialog. **Edit Outline** is also in a root's Mind Map menu section, under Tidy Map (the way
in for a root with no children yet). Beside the Edit Outline badge, a **Tidy Map** badge lays the map out tidily again, exactly as the Mind Map
menu's Tidy Map does (one undo step, `Element` · `Changed` · `MindTidy`). Not on other nodes: the
outline is the whole map, and the root is where a map begins. Not for a viewer, a locked node or a
node on a hidden or locked layer.

**The dialog**, titled **Edit Outline**, is an outline editor: the map as a list of rows, one
row per node, the way a list is edited in a document. Structure is never typed as spaces: a row's
level is a property of the row, changed with keys or buttons, so it cannot be misaligned.

```
Team offsite
 • Venue
 │  • Lake District
 • Agenda
 │  • Day 1: planning
 │  • Day 2
 │    Workshops and the walk
```

- **Rows.** The first row is the root, a size larger, with no bullet; it cannot be indented, moved or
  removed. Every other row has a bullet and sits one step in per level under its parent, siblings
  in the map's order (as the layout reads it). Each level has its own colour from a ring of five
  (violet, sky, emerald, amber, rose, then round again): the bullet and the text are in it, and a
  thin guide line in the parent's colour runs down beside a parent's children, so the nesting
  reads as a tree at a glance. Every colour meets 4.5:1 in light and dark.
- **A node with several lines of text** is one row whose text wraps onto further lines inside it,
  under the one bullet. **Shift+Enter** starts a new line in the row (on a phone, the **Line
  Break** button). A long line also wraps; the row grows to fit.
- **Formatting.** Bold, italic and underline, on the selected text of a row: ⌘/Ctrl+B, I and
  U, or the toolbar's **Bold**, **Italic** and **Underline** buttons (on when the selection is
  already so). A row shows its node's bold, italic and underline as they are on the canvas,
  including a whole node made bold from its style; other formatting (colour, size, links) is not
  shown or edited here, and is kept.
- **Keys**, on the row being edited:
  - **Enter** starts a new node after it, at the same level, carrying the text after the caret.
    Enter on the root starts its first child. Enter on an empty row at a level below the first
    steps it out a level instead.
  - **Tab** / **Shift+Tab** move the row a level in or out, its children with it. A row can be at
    most one level below the row above it; a row on the first level cannot go out further.
  - **Backspace** at the start of a row: an empty row is removed (its children move up a level
    under the row above); a row with text joins onto the end of the row above.
  - **Delete** at the end of a row joins the next row onto it.
  - **↑** / **↓** on a row's first or last line move to the row above or below.
  - **Alt+↑** / **Alt+↓** move the row, children and all, past its neighbour at the same level.
- **Toolbar** above the rows, each button with a hover card naming its key: **Bold**,
  **Italic**, **Underline**, then **Outdent**, **Indent**, **Move Up**, **Move Down**, **Line
  Break**. They act on the row being edited (the
  last one focused) and keep the focus there; one that cannot act there is disabled.
- **Pasting** several lines into a row reads them as an outline, so a Markdown or plain indented
  list from elsewhere comes in as rows (the rules under "What it reads"):
  their nodes become rows from the pasted row on, the first in the pasted row's place when it is
  empty, nested from the pasted row's level.
- **Header**: beside the close button, a **Help** button opens the Edit Outline help article in a
  new tab.
- **Footer**: **Cancel** and **Save**. Escape cancels. ⌘/Ctrl+Enter saves. Beside the buttons a
  quiet line counts what Save will do: "3 added, 1 renamed, 2 removed", or "No changes".
- **On a phone** the dialog rises as a sheet (see live-app.md "Working dialogs rise as sheets on a
  phone"), and the toolbar is the way to indent, outdent and break a line.

**What it reads.** Pasted text, and the outline the rows are saved through (the root on the
first line, every other node a `- ` bullet two spaces deeper than its parent, a node's further
lines lined up under its text, its formatting as `**bold**`, `*italic*` and `<u>underline</u>`),
is read forgivingly, so a list pasted from elsewhere works:

- Blank lines are skipped. The first non-blank line is the root, whatever marks it (`- `, `# `,
  `1. ` or nothing).
- Bullets `- `, `* `, `+ ` and numbered items `1. ` / `1) ` nest by indentation (a tab counts as
  two spaces); a line with no marker counts as a bullet at its indentation, except a line
  directly under the root or a marked item (a bullet, number or heading) lined up with that line's
  text, which is a further line of its text.
- Headings nest by their `#` count: under a `#` root, `##` lines are its children, `###` lines
  theirs, and bullets under a heading nest one level below it.
- An indentation deeper than one level below the line above is read as one level below it, so a
  line can never skip a level. A second line at the root's level is read as a child of the root
  (a map has one root).
- Bold (`**bold**` or `__bold__`), italic (`_italic_` or `*italic*`) and underline
  (`<u>underline</u>`) become the node's formatting. Other inline Markdown is stripped, keeping
  its text: `` `code` ``, links and task boxes (`[ ]`, `[x]`).
- An outline whose root row is empty can't be saved: Save is disabled, with "Write the root first".

**Saving** applies the whole outline to the map, as one change (one undo step):

- **Lines keep their nodes.** Each line is matched to an existing node, so its colour, size,
  icon, comments, actions and links stay with it:
  1. a child line whose text equals an existing child's text, under the same parent;
  2. else any existing node of the map with that text, which then **moves** to its new parent;
  3. else, among the parent's still unmatched children, the one in the same place, which is then
     **renamed**.
     Text is compared line by line, each trimmed, case-sensitively. The root line always keeps
     the root.
- **New lines become new nodes**, looking like their level (the same rule as a node added from
  the keyboard: a sibling's look, else a cousin's at the same depth, else the parent's), joined
  to their parent by a connector that looks like their siblings'.
- **A node whose line is gone is removed**, with the connectors pinned to it. If any node would be
  removed, Save first asks, inside the dialog: "Remove N nodes?" ("Remove 1 node?"), naming up to
  three of them, with **Keep Editing** and **Remove** (destructive). Remove saves; Keep Editing
  goes back to the text.
- A renamed node takes the row's text with its bold, italic and underline. A node whose text is
  unchanged keeps its formatting; if only its bold, italic or underline changed, those change and
  everything else (colour, size, links) stays. Text is compared without formatting, so a
  formatting change is never a rename: the count line reads it as "1 restyled".
- A moved node's old connector goes and a new one joins it to its new parent, in its new
  siblings' connector look.
- **When the structure changes** (a node added, removed or moved, or siblings reordered), **the
  map is laid out again** in its flow, in the outline's order (the order is the outline's,
  never the old drawing's), with the root where it was, its connectors re-anchored and other trees
  in the way moved aside, exactly as Tidy Map does. A balanced map deals its branches to the side
  with less, in order.
- A save that only changes text or formatting leaves every node where it is: no layout runs, so
  a hand-arranged map keeps its arrangement.
- Nothing changes and nothing is committed when the outline matches the map.
- The save keeps every surviving node's id, so collaborators receive the changes as ordinary
  element edits.

**Telemetry**: `UI` · `Opened` · `MindOutline` when the dialog opens (as the other dialogs), and `Element` ·
`Changed` · `MindOutline` on a save that changes the map.

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

## Templates

Every mind-map template is built from mind nodes carrying their parent pointers
and the root's flow, and laid out by `layoutMindTree`, so a template is a live,
tidy map rather than a picture of one: select any node and Tab and Enter grow
it in place, and the new nodes look like the template's own.

- **Mind map**: the bubble flow; a team-offsite plan, a root with five branches, each in its own hue with a glyph, carrying two or three leaves.
- **Tree mind map**: the tree flow; a bold root, four tinted branches, two small leaves each.
- **Bubble map**: the bubble flow with round nodes and a single ring; a brand voice, one adjective and its proof line per bubble, each bubble in its own hue.

## Deleting

Deleting a node leaves its children with a `mindParentId` pointing at nothing.
They become roots: their arrows are already gone (arrow cleanup on delete is
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

There is **no hint chip** under the selected node. One would announce the two
shortcuts to everybody forever rather than to whoever is looking for them, and a
centred one would land underneath the very "+" the actions live in.

## What it is not

Not an auto-layout of anything else on the tab. Tidy growth re-lays out only
the map being grown, and only while that map is still exactly as the layout
left it; a hand-arranged map is never re-flowed by a keystroke. Arbitrary
diagrams keep the radial / tree re-layouts in Auto Layout
([Layout cleanup](../008-canvas/layout-cleanup.md)).
