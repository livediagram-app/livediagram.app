# The flowchart

**Status in liveplanner: editing removed (2026-10-24).** No Plan tab holds flowcharts ([Plan mode](../026-plan/plan-mode.md)), so growth (Add Step / Add Branch), the step toolbar, the Flowchart menu, lanes and the re-layout on every commit are gone, with their wiring in `useEditorState`. The element kind stays in `packages/project` for the file format; this spec describes livediagram's behaviour.

## What

A **Flowchart**: a chart of **steps** joined by connectors, grown one step at a time and **laid out
again after every change**, so it is always clean and tidy and nobody ever drags a box into line.

It starts as one **Start** step, placed from the palette (Build → **Flowchart**). From a selected
step:

- **Tab** adds the **next step** after it, connected from it (on a step the keyboard's Tab walk just reached,
  Tab walks on instead, as on a mind node: [The mind node](mind-node.md)).
- **Enter** adds a **parallel step**: another step from the same step the selected one came from.

The same two actions are one click away: **Add Step** and **Add Branch** on the step's selection
toolbar, and on its quick-connect "+" ring. Each new step is a **Process**, selected and ready to
type into, exactly as a mind node is ([The mind node](mind-node.md): selection stays on the canvas,
typing opens the label editor with that first character, typing ahead is captured for the new step,
and Escape on the empty step a Tab made one time too many removes it).

Any step's **type** is changed from its toolbar's **Step Type** menu or the context menu's
**Flowchart** menu, so a Process becomes a Decision in one click.

## Why

[Purpose](../001-project-vision/purpose.md) names flowcharts first among the artifacts people make.
Today a flowchart is drawn shape by shape and arrow by arrow, then tidied by hand or with Auto Layout
([Layout cleanup](../008-canvas/layout-cleanup.md)). The mind node showed what growing a structure
from the keyboard is worth; a process flow is the other structure people most often talk through
live, and it needs the same: keep up with the speaker, and never spend a minute nudging boxes.

## Step types

The classic flowchart vocabulary (ISO 5807 / ANSI), drawn with shapes the palette already has:

| Step type      | Shape           | Size      | Meaning                                 |
| -------------- | --------------- | --------- | --------------------------------------- |
| Start / End    | `stadium`       | 200 × 64  | Where the flow begins or finishes       |
| Process        | `square`        | 200 × 72  | A step someone or something does        |
| Decision       | `diamond`       | 200 × 120 | A question with labelled exits          |
| Input / Output | `parallelogram` | 220 × 72  | Data entering or leaving the flow       |
| Project       | `project`      | 200 × 84  | A project the flow produces or reads   |
| Database       | `cylinder`      | 160 × 96  | Stored data                             |
| Preparation    | `hexagon`       | 200 × 72  | Setting up before a step                |
| Connector      | `circle`        | 56 × 56   | An on-page jump, labelled with a letter |

A step's type **is** its shape kind; there is no separate type field. Changing the type swaps the
kind and sets the type's size, keeping the label, colours and links, and the chart is laid out
again.

The palette places the first step as a **Start / End** labelled "Start". Every step added after it
is a **Process** until its type is changed.

## A new step looks like its type

A new step copies the look (what the format painter copies: colours and their theme binding, border,
corner radius, shadow and text styling, never the label, size or position) of the chart's most
recently added step **of the same type**, else it takes the element defaults. So a Process grown
from a bold Start is a plain Process, and a chart whose Processes were tinted keeps tinting them.
Changing a step's type keeps its own look.

## The element

A step is an ordinary shape of one of the kinds above, so validation, export, Mermaid, Markdown, the
MCP tools and the API schema already know how to read it. Three fields make it part of a chart:

```ts
flowchartId?: string;              // the chart it belongs to
flowDirection?: 'down' | 'right';  // which way the chart flows
flowLaneId?: ElementId;            // the swimlane it sits in
```

- `flowchartId` is the chart's identity, minted as the id of its first step and shared by every
  step and every lane of the chart. It is the **only** thing that makes a shape a step: a diamond
  without it is a diamond.
- `flowDirection` is written to **every** step of the chart together, so deleting any one step never
  loses it. Absent means the default: **down**, or **right** once the chart has swimlanes.
- `flowLaneId` names the lane a step sits in. Absent on a chart with lanes means the first lane.

The connectors are ordinary pinned arrows. The chart is not a second graph model: it is the steps
and the arrows between them that you can already see. That is what lets a flowchart **merge** (two
branches into one step) and **loop** (an arrow back to an earlier step), which a tree cannot.

## Connectors

A new step's connector is an **angled** arrow with an arrowhead at the step it enters, the
flowchart idiom; if the chart already has connectors, it copies their look (`paintableArrowFields`)
instead.

**Decisions label their exits.** A connector leaving a Decision is labelled **"Yes"** if no exit of
that Decision says Yes yet, else **"No"** if none says No; a third exit is unlabelled. The labels
are ordinary arrow labels: edit them to anything. The rule applies however the exit was made: Tab,
Add Step, the ring, or drawing an arrow from the Decision to another step of the chart.

**A Decision's exits leave by its corners.** An exit that carries straight on along the flow leaves by
the flow's face; one whose step lies beyond a side corner leaves by that corner (left or right flowing
down, top or bottom flowing right) and turns once into it. Every other connector runs straight when its ends line
up and otherwise bends twice: along the flow to halfway, across, and on into the step. A **loop** leaves by a side
(left or right flowing down, top or bottom flowing right), runs past the outside of every step between
its ends and comes back into the earlier step's same side, on whichever side makes the shorter trip. A connector made curved keeps its curve.

**No two exits of a Decision share a face.** On a chart without lanes the layout makes room for this
(below). On a laned chart, where the lanes decide where steps sit, two exits that would leave by the
same corner are split: the one whose step lies further along the flow leaves by the flow's face
instead and bends twice into its step, as any other connector does.

**Connecting existing steps** is drawing an arrow, as on any shape. An arrow pinned at both ends to
steps of the same chart joins the chart (a merge or a loop) and the chart is laid out again.

## The layout

The chart is laid out **every time its structure changes**: a step added, removed or retyped, a
connector between two of its steps added or removed, its direction changed, or a lane added, removed
or reassigned. One change is one commit and one undo step, layout included.

It is the **layered** layout Auto Layout already uses (Flowchart down / right in
[Layout cleanup](../008-canvas/layout-cleanup.md)): steps in ranks along the flow, each rank one past
its deepest predecessor, loops ignored for ranking (a loop is a connector back to a step already on the path from the first
step, followed in the order connectors were drawn), order within a
rank refined to cross fewer connectors, long connectors kept in a channel of their own, and every
connector re-anchored on the flow's faces. Four things differ from Auto Layout:

- **Sizes are kept.** Each step keeps its type's size (or the size someone gave it); Auto Layout's
  peer-size normalising would shrink a Decision to a Process.
- **The first step stays put.** The chart is translated so its first step (the one whose id is the
  `flowchartId`, else the earliest step in reading order) keeps its place. Growing a chart never makes
  it jump away from where it was started.
- **Order is kept.** A new step is ranked after the step it grew from and placed after that step's
  existing exits, so a Decision's Yes exit sits before its No exit (left of it flowing down, above it
  flowing right) and the order people read stays the order they built.
- **A Decision's steps sit beyond its corners.** On a chart without lanes, when a Decision has two or
  more exits, the step of its first exit (left flowing down, top flowing right) lies beyond its first
  corner and the step of its last exit beyond its other corner, so each leaves by its own corner and
  turns once. A step is moved out there together with the steps only it leads to; a move that would
  overlap another step, or move a locked one or the first step, is not made.

Only the chart's own steps, connectors and lanes move. Other elements on the tab are left where they
are.

**Dragging a step is allowed.** The chart is laid out again at its next structural change, and the
dragged step returns to its slot: the chart is always tidy, by design. **Tidy Flowchart** in the
Flowchart menu's Chart category lays it out on demand. A locked step, or one on a locked layer, keeps its
place and size, and the layout routes around it as Auto Layout does.

## Direction

**Down** (top to bottom) or **Right** (left to right), from the Flowchart menu's Direction category. A chart with no lanes flows down by default; a chart with lanes flows right by default. Choosing
a direction writes it to every step and lays the chart out again.

## The Flowchart menu

A selected step's or lane's context menu has one **Flowchart** row, a parent category that opens to the
side (a `MenuFlyoutSection`, the way the Mind Map and Sankey rows do). Inside it, up to three categories,
each a closed `MenuAccordionSection` like every element-menu section, so the menu never shows every list
at once. Each holds one of Plan mode's option lists (`OptionRows`): a bordered box, one full-width row per
choice, its icon at the left.

- **Chart**: **Add Lane** and **Tidy Flowchart**.
- **Step Type**: the eight step types, the step's own ticked. Only on a step, not a lane.
- **Direction**: **Down** and **Right**, the chart's own ticked.

## Swimlanes

Swimlanes are optional: a flowchart works without them, and gains them from **Add Lane**.

The lanes are ordinary [Lanes](lane.md) carrying the chart's `flowchartId`, so they look, title and
carry their contents exactly as any lane does.

- **Add Lane** on a chart without lanes wraps every step in **"Lane 1"** and adds an empty
  **"Lane 2"**; on a chart with lanes it adds the next lane at the end. Titles are edited like any
  lane's.
- Lanes run **across** the flow: horizontal rows when the chart flows right, vertical columns
  (title centred at the top) when it flows down. Changing direction turns the lanes. A lane whose title
  already runs the right way (a row's pinned left or right, a column's in a band at its top or bottom)
  keeps its own alignment.
- A new step lands in the **same lane** as the step it grew from. The step toolbar's **Lane** menu
  lists the chart's lanes by title and moves the step; **dragging a step into another lane** of the
  chart moves it too. Either way the chart is laid out again.
- The layout keeps every step inside its lane's band: ranks are shared across lanes, so a column of
  steps lines up through every lane, and each lane grows to fit its tallest stack of steps (never
  thinner than one holding a single Process). The lanes are stacked flush, in the order they are drawn, and all
  run the full length of the chart.
- **Reordering lanes** is dragging one past another: the order is read from the drawing at the next
  layout.
- **Deleting a lane** moves its steps into the first remaining lane. Deleting the last lane leaves an
  unlaned chart, which keeps its explicit direction if it had one.

## Removing steps

Deleting a step removes its connectors (existing behaviour) and lays the chart out again. Steps left
unconnected stay in the chart, ready to be joined again: on a chart without lanes they line up in a
column beside it (flowing down) or a row under it (flowing right); on a laned chart they sit at the
start of their lane. The first step never moves, connected or not.

## Share roles

[Share roles](../013-workspace/share-roles.md):

- **Editor**: everything above.
- **Participant**: grows the chart (Tab, Enter, Add Step, Add Branch) and writes on its steps, as
  a Participant grows a mind map; the growth's layout moves the chart's steps, connectors and lanes in
  the same change. A Participant does not change a step's type, the direction or the lanes, and does
  not use the quick-connect ring (an Editor's).
- **Viewer**: looks only. No step toolbar actions, no keys.

## Templates

The flowchart-family templates are live flowcharts: every step carries the chart's fields and the
whole chart is laid out by the flowchart layout, so Tab and Enter grow any template in place.

- **Flowchart**: the checkout flow, flowing down; its key stays an ordinary group of shapes beside
  it.
- **Swimlane**: a laned chart, flowing right.
- **Approval Workflow**: a laned chart, flowing right.
- **Decision Tree**: a chart of Decisions with Yes / No exits, flowing down.

The **Data flow** template keeps its own notation (a DFD's entities, processes and stores are not
flowchart steps) and is unchanged.

## Telemetry

`Element` · `Added` · `FlowchartStep` on every grown step; `Element` · `Changed` · `FlowchartStepType`
on a type change; `Element` · `Added` · `FlowchartLane` on Add Lane; `Element` · `Changed` ·
`FlowchartDirection` on a direction change. The palette tile records its placement as every tile does.

## Element tour

The first time an Editor selects a flowchart step (not on a phone), a small **Show Me** toolbar beside its selection toolbar offers the
[Flowchart tour](../007-editor/element-tours.md#the-flowchart-tour): Add Step and Add Branch (with Tab and Enter),
Step Type, Lane on a laned chart, and the Flowchart menu.

## What it is not

- Not UML activity diagram notation (fork / join bars, initial and final nodes). The classic set is
  what most people mean by a flowchart.
- No Subroutine (predefined process) step yet: it needs a new shape kind.
- Not a re-layout of anything else on the tab; a chart that grows into a note does not move the note.
- Mermaid import still produces ordinary shapes, not a live flowchart.
