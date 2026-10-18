# Element tours

An **element tour** teaches one complex element type, on the element itself: what its parts mean, how to read it and
how to change it. It is offered from a small toolbar beside the selected element's toolbar, the first time a person
selects an element of that type, and it walks through the real element the person selected, not a sample.

It sits between the mode tours (the [Diagram tour](editor-tour.md) and its siblings, which offer themselves once
with a centred card) and [Show Me](show-me.md) (never offered, started from a button on one surface). An element
tour offers itself, but quietly: a small toolbar that waits beside the selection, never a card over the canvas.

The toured kinds: the [Sankey diagram](../009-elements/sankey.md), and the
[concept graphics](../009-elements/concept-graphics.md) layer stack, pyramid, funnel, cycle, hub and spoke, onion and chevron process; the
[mind node](../009-elements/mind-node.md); the [flowchart](../009-elements/flowchart.md) step; the
[org chart](../009-elements/org-chart.md)'s person node; the [sequence diagram](../009-elements/sequence-diagram.md); the
[data charts](../009-elements/pie-chart.md); the [stack](../009-elements/stack.md); the
[entity](../009-elements/entity.md); the [tab window](../009-elements/tab-window.md); the
[lane](../009-elements/lane.md); the [boundary](../009-elements/boundary.md); the
[diagram key](../009-elements/diagram-key.md); and the [portal](../009-elements/portal-element.md).

## Domain language

| Term                  | Means                                                                                           |
| --------------------- | ----------------------------------------------------------------------------------------------- |
| **Element tour**      | This pattern, and one tour of it (the **Sankey tour**)                                          |
| **Tour offer**        | The small toolbar that offers an element tour: the Tour glyph and word, **Play** and **Cancel** |
| **Toured kind**       | An element type that has an element tour (`sankey`, `chart`, …)                                 |
| **Selection toolbar** | The floating toolbar over a single selection ([Canvas](../008-canvas/canvas-and-palette.md))    |

## The tour offer

- **Where.** A separate small toolbar immediately to the right of the selection toolbar, on the same line, 8px apart,
  styled as that toolbar (white card, border, shadow, 32px buttons). It moves, flips above or below and is nudged
  inside the canvas with the selection toolbar, as one group.
- **What it holds.** The Tour glyph (footprints, as Show Me's) and the word **Tour**, then **Play** (a play glyph)
  and **Cancel** (a cross), each with a hover card: Play is **Take the Tour** ("A short tour of how a Sankey diagram
  works, on this one."), Cancel is **No Thanks** ("Hide this tour. Settings › Tours offers it again."). Play wears
  the tab's accent, as the primary choice.
- **On a phone** (narrower than 640px, or a phone held sideways: `useIsMobileViewport`) no element tour is offered at
  all: the selection toolbar alone fills the width there. Nothing is answered, so the offer still comes on a wider
  screen.
- **On a narrow canvas** (a tablet in a split view), when the two toolbars together are wider than the canvas less its
  margins, the offer wraps onto its own line, centred, on the far side from the element (above the selection toolbar
  when that sits above the element, below it when below), so it never covers the element and never runs off screen.
  Its buttons keep the selection toolbar's 44px touch targets.
- **When it shows**, all of these hold:
  - exactly one element is selected, of a toured kind, and its selection toolbar is showing;
  - the person may edit it (for a Sankey, `canEditSankey`: an Editor, on an unlocked diagram);
  - the person has not answered this kind's tour (below);
  - the editor is usable: hydrated, the synced preferences in, no welcome overlay, not an embed, not on a phone;
  - no guided tour is running (`useActiveTour`), no start panel is open, and no dialog is open (the modal guard,
    [Diagram tour](editor-tour.md) "Dialogs come first"): the offer comes back once the last dialog closes.
- **It fades in** with the selection toolbar, and away with it (a move, a quick-connect ring).
- **Play** answers the offer and starts the tour on its first step. **Cancel** answers it and the offer goes. Either
  way, the kind is never offered again, on any device, until Settings offers it again. Simply deselecting is not an
  answer: the offer comes back the next time an element of that kind is selected.

## Remembering answers

- A synced user preference, `elementTourKinds`, lists the toured kinds whose offer has been answered (Play or
  Cancel), so an answer follows the account ([User preferences](user-preferences.md)).
- `elementToursSeen`, written only by [Power user mode](power-user-mode.md)'s preset, counts every kind as answered
  while the mode is on, as `pagesTourSeen` does for its kinds.

## Settings

Settings' **Tours** category holds element tours in their own section, **Element Tours**, below the mode tours'
**Offer Again** section. It is a closed accordion (people rarely look for it): its header names the section and
how many element tours are on (`1 of 1 On`). Opened, it shows the section's line ("The first time you select a
complex element, a small Tour toolbar beside it offers to show how it works. Switch one back on to be offered it
again."), then **Element Tours**, one switch over them all ("Every element tour at once": on while any is still
offered; off answers every kind, on forgets every answer), with one switch per toured kind nested beneath it,
**Sankey Diagram Tour** ("The first time you select a Sankey diagram.", linking the Sankey Diagram article). On
means "offer it": switching one on forgets its answer, so the offer shows the next time such an element is
selected. The accordion opens on its own when Settings is opened on one of its rows (a search result) or on the
section. Power user mode's readout lists the switch over them all as **Element Tours**.

## The tour

- **The shared tour**: the anchored step card with Back, Next and Skip, the ring with room to breathe, the dim
  around it, and a closing card, as [Show Me](show-me.md) draws them. No welcome card: the offer was the welcome.
  Steps count from 1.
- **On the element itself.** The steps ring the selected element's real parts and show what it says about them.
- **The steps are fixed when Play is pressed**, from the element as it is then: a part it does not have (no
  leftovers, no flows) is left out, so the count is right from the first step.
- **Live.** What a step rings stays usable, and what the person does is kept.
- **Ending.** Done ends it as completed, Skip as skipped. It ends as skipped, with nothing remembered beyond the
  answer already given, when the element goes (deleted, or no longer editable), or the person opens another tab.
- **Escape** belongs to the tour while a step is over a dialog the tour opened: the dialog does not close under it.

## The Sankey tour

The steps, in order, each a line or two. The exact strings live in
`apps/live/components/tour/sankey-element-tour-steps.ts`.

1. **Bands Carry Amounts** (only with flows): rings the widest band and lifts it, its readout showing as a hover
   would. "Each band is as wide as the amount it carries, so the widest is where most of it goes. The readout gives
   its amount and its share."
2. **What Is Left Over** (only when a leftover band is drawn): rings the largest leftover band, lifted. "What a node
   keeps back runs on to Leftover, in grey. It is worked out, never typed, so it follows the amounts."
3. **Style It** (only while the selection toolbar's More button shows): rings More. "Under Sankey in the menu: band
   colours, columns, labels, the unit, and an animation."
4. **Write the Flows**: rings the whole diagram. "Double-click a Sankey (double-tap on a touch screen) to open its
   flows. Next opens them for you."
5. The Flows dialog opens, and the tour carries on inside it with the steps of its own
   [Show Me](../009-elements/sankey.md#show-me) (Your Nodes, Flows Step by Step, Add a Flow, In and Out Differ, Or
   Type Them, Import a File, Live Preview), left out as Show Me leaves them out. Each opens the dialog again if it
   was closed. Stepping Back onto a canvas step closes it.
6. **That Is a Sankey** (closing card): "Every change is one undo step. Show Me in the Flows dialog runs this part
   again." with **Done** and a link to the Sankey Diagram article (**Sankey Diagram Help**). Done closes the Flows
   dialog with the tour, storing what is being typed as the dialog's own Done does; Skip leaves it open.

The lift and the readout in steps 1 and 2 are the tour's: they win over a pointer left resting on another part (after pressing Next, say), since the step is about its part, and they go when the step does, when hovering works as ever.

## The Layer Stack tour

On the selected [layer stack](../009-elements/concept-graphics.md), each step a line or two. The strings live in
`apps/live/components/tour/layer-stack-tour-steps.ts`; the steps it is built from (a step on the graphic or a row, the
"+" ring, the More button, the closing card) in `concept-element-tour-steps.ts`, shared by every concept graphic's
tour.

1. **One Element, Many Layers**: rings the stack. Each band is a layer, top to bottom; a resize shares the height
   again and re-wraps the words, never stretching them.
2. **Type Over a Layer**: rings the top layer's name. Click (tap on a touch screen) to type over it; Enter keeps,
   Escape puts back.
3. **Side Notes** (only while a layer has a note): rings the first note. A note sits beside its layer, joined by a
   rule; with no notes the bands take the full width.
4. **Add a Layer**: opens the first "+" on screen (below, else right, above, left) and rings its **Add Layer**; up to
   eight. The ring closes again on leaving the step.
5. **Reorder in the Menu** (only while More shows): rings More. The Rows section (Tools) renames, notes, moves and
   removes layers, two at least.
6. **One Colour, a Whole Ramp**: rings the bottom layer. The top takes the accent and each below steps toward the
   fill; a colour change carries every band, their words kept readable.
7. **Build It Up**: rings the stack and plays its **Build** animation on it once, as a preview: never stored, so the
   document does not change, and gone with the step. Animation, then Concept: Build, or Pulse.
8. **That Is a Layer Stack** (closing card): it exports as drawn, every change one undo step; **Done** and the
   **Concept Graphics Help** link.

## The Pyramid tour

On the selected Pyramid or Inverted pyramid (a Funnel has its own tour), from `pyramid-tour-steps.ts`. The words follow
the variant: an Inverted pyramid's first tier is the widest, along the top, and it builds from the top down.

1. **Tiers Cut From One Triangle**: rings the pyramid. The first tier is the apex (Inverted: the widest, along the
   top); every tier is cut from one triangle, so the edges line up as one silhouette.
2. **Type Over a Tier**: rings the first tier's name. A name too long for its tier is shortened, never spilling out.
3. **Add a Tier**: the "+" ring open on **Add Tier**; a new tier at the base (Inverted: the point), up to six.
4. **Pyramid, Inverted or Funnel** (only while More shows): rings More. Shape switches between the three, keeping every
   tier; Rows reorders them.
5. **From the Accent Down**: rings the last tier. The apex (Inverted: the top) takes the accent, each tier after it
   steps toward the fill.
6. **Build It Up** (Inverted: **Build It Down**): plays Build on it as a preview, from the base up (Inverted: from the
   top down).
7. **That Is a Pyramid** (Inverted: **That Is an Inverted Pyramid**): the closing card.

## The Funnel tour

On the selected Funnel (a Pyramid in its Funnel variant), from `funnel-tour-steps.ts`.

1. **Narrowing Stage by Stage**: rings the funnel. Each band is a stage, the widest first, narrowing to a third of the
   width, so the drop-off reads at a glance.
2. **Type Over a Stage**: rings the first band's name.
3. **A Number on Each Band** (only while a band has a value): rings the first value. Each band can carry its number
   beside its name; cleared, the name takes the whole band.
4. **Add a Stage**: the "+" ring open on **Add Tier**; a new band at the bottom, up to six.
5. **Funnel, Pyramid or Inverted** (only while More shows): rings More. Shape switches between the three, keeping
   every band.
6. **From the Accent Down**: rings the last band; the widest takes the accent.
7. **Pour It In**: plays Build on it as a preview, from the top down.
8. **That Is a Funnel**: the closing card.

## The Cycle tour

On the selected Cycle, from `cycle-tour-steps.ts`.

1. **A Loop, Clockwise**: rings the cycle, counting its steps. The first sits at twelve o'clock, the rest clockwise,
   each arrow running to the next and the last back to the start.
2. **Where It Starts**: rings the first step, solid in the accent; click (tap) a step's name to type over it.
3. **Name the Loop**: rings the words in the middle (`data-tour-part="concept-centre"`, as on a Hub's hub);
   double-click (double-tap) to edit them.
4. **Add a Step**: the "+" ring open on **Add Step**; a new step at the end, up to eight, spaced evenly again.
5. **Reorder in the Menu** (only while More shows): rings More; Rows renames, moves and removes steps, three at least.
6. **Set It Turning**: plays **Flow**, the cycle's own loop, round its arrows as a preview while the step is up (a
   previewed loop keeps going; a previewed Build plays once).
7. **That Is a Cycle**: the closing card.

## The Hub and Spoke tour

On the selected Hub and spoke, from `hub-tour-steps.ts`.

1. **One Thing in the Middle**: rings the hub (`data-tour-part="concept-centre"`); what everything touches.
   Double-click (double-tap) to name it.
2. **Round It, Clockwise**: rings the graphic, counting its satellites, evenly round the hub from twelve o'clock.
3. **Type Over a Satellite**: rings the first satellite's name.
4. **Add a Satellite**: the "+" ring open on **Add Satellite**; up to eight, spread evenly again.
5. **Spokes or None** (only while More shows): rings More. Spokes turns the lines off, leaving the satellites
   floating; Rows reorders them.
6. **Light Them Up**: plays **Pulse** round the satellites as a preview while the step is up.
7. **That Is a Hub and Spoke**: the closing card.

## The Onion tour

On the selected Onion, from `onion-tour-steps.ts`.

1. **Nested, Not Overlapping**: rings the onion, counting its rings; each wraps everything inside it, and it is not a
   Venn.
2. **The Core**: rings the core's name, in the middle and solid in the accent; click (tap) to type over it.
3. **Outward From There**: rings the outermost ring's name; each ring after the core sits further out, its name along
   the top of its band.
4. **Add a Ring**: the "+" ring open on **Add Ring**; a new ring round the outside, up to six.
5. **Reorder in the Menu** (only while More shows): rings More; Rows from the core out, two at least.
6. **Ripple Outward**: plays **Pulse** from the core outward as a preview while the step is up.
7. **That Is an Onion**: the closing card.

## The Chevrons tour

On the selected Chevron process, from `chevrons-tour-steps.ts`. It has no menu step: a chevron process is edited on
the canvas, not in a Rows section.

1. **Stages, Left to Right**: rings the process, counting its stages, each pointing into the next.
2. **Type Over a Stage**: rings the first stage's name.
3. **Each Stage's Own Bar**: holds the middle stage's bar open (the first's on a two-stage process), as if the stage
   were pointed at, and rings it: move left or right, delete, and Add Note while no stage has a note. On a touch
   screen the words say every stage shows its bar (zoom in if the stages are small). A stage too small for its bar
   (zoomed out, a narrow phone) draws none, so the step rings the stage instead of waiting for it. The bar closes
   again on leaving the step.
4. **A Note Under Each** (only while a stage has a note): rings the first note.
5. **Add a Stage**: the "+" ring open on **Add Stage**; up to eight.
6. **Run the Pipeline**: plays **Pulse** along the stages as a preview while the step is up.
7. **That Is a Chevron Process**: the closing card.

## The Mind Map tour

On a selected mind node (not a person node: that is the org chart's), from `mind-node-tour-steps.ts`. It points at the
node and its selection toolbar; it never grows the map itself.

1. **A Node That Knows Its Parent**: rings the node; every node grown from it is joined to it, and the map keeps
   itself tidy.
2. **Grow a Child**: rings the toolbar's **Add Child**. With a keyboard: "Tab, or Add Child here", and typing names
   the new node; on a touch screen, the button alone.
3. **Add a Sibling**: rings **Add Sibling**. With a keyboard it names Enter and Shift+Enter (a new line while typing);
   on a touch screen, the button alone.
4. **Move a Whole Branch** (a node with nodes grown from it; otherwise **Branches Move as One**): rings the node;
   dragging it carries its branch.
5. **The Mind Map Menu** (only while More shows): rings More. Branching (the shape it grows in), Spacing, Tidy Map
   and Edit Outline.
6. **That Is a Mind Map**: the closing card, with **Mind Maps Help**.

The steps' environment carries the tab's elements, so a step can read past its own element (here, whether the node has
children).

## The Flowchart tour

On a selected flowchart step, from `flowchart-tour-steps.ts`. It points at the step and its toolbar; it never grows or
re-lays the chart itself.

1. **A Step in a Flowchart**: rings the step; every change lays the chart out again.
2. **The Next Step**: rings the toolbar's **Add Step** ("Tab, or Add Step here" with a keyboard; the button alone on a
   touch screen).
3. **Add a Branch**: rings **Add Branch** (Enter with a keyboard): a step beside this one, from the same step.
4. **Change Its Type**: rings **Step Type**; the type is the shape, the words are kept, the chart re-lays.
5. **Its Lane** (only on a chart with swimlanes): rings **Lane**.
6. **The Flowchart Menu** (only while More shows): rings More. Add Lane, Tidy Flowchart, Direction.
7. **That Is a Flowchart**: the closing card, with **Flowcharts Help**.

## The Org Chart tour

On a selected person node (a mind node with the person look), from `org-chart-tour-steps.ts`. It points at the node,
its parts (`data-tour-part="person-role"`, `"person-initials"`) and its toolbar; it never grows the chart itself.

1. **A Person in the Chart**: rings the node: name, role and initials; double-click (double-tap) to change the name.
2. **Their Role**: rings the role line; click (tap) to write it.
3. **Initials, Made for You**: rings the disc; the first letters of the name's first two words, following the name.
4. **Add a Report**: rings **Add Child** (Tab on a keyboard); a new person under this one, on the same trunk.
5. **Add a Peer**: rings **Add Sibling** (Enter on a keyboard); a new person reporting to the same manager.
6. **Move a Whole Team** (a person with reports; otherwise **Teams Move Together**): rings the node.
7. **The Mind Map Menu** (only while More shows): rings More; an org chart is a mind map flowing down: Tidy Map,
   Spacing, Edit Outline.
8. **That Is an Org Chart**: the closing card, with **Org Charts Help**.

## The Sequence tour

On a selected sequence diagram, from `sequence-tour-steps.ts`. Like the Sankey tour it reads the diagram on the canvas,
then opens its Sequence dialog and carries on inside it, every step ringing a real control (each anchor a
`data-tour-id`: `sequence-participants`, `-messages`, `-kind` on the first message's kind, `-add-message`, `-text`,
`-preview`, `-numbered`). Each dialog step opens the dialog (again, if it was closed) on the tab it is about; a canvas
step puts it away. While it runs, Escape is the tour's and never closes the dialog.

1. **Who Calls Whom**: rings the diagram; lifelines, a row per message, a bar while a call waits for its reply.
2. **The Sequence Menu** (only while More shows): rings More. Edit Sequence, Numbered, and Play under Animation.
3. **Write It as a List**: rings the diagram; double-click (double-tap) to write it. Next opens the dialog.
4. **The Participants**: the strip; rename, actor, move, remove with its messages.
5. **A Row a Message**: the messages. With a keyboard it names Enter (the next message, from whoever was called) and
   Backspace (an empty one removed); on a touch screen, the move arrows.
6. **Call, Async or Reply** (only with a message): the first message's kind button.
7. **Add a Message**: the Add Message row, up to sixty.
8. **Or Type It**: brings the Text tab forward and rings it; put back to the messages on leaving.
9. **Live Preview**: the preview.
10. **Number Them**: the Numbered switch.
11. **That Is a Sequence Diagram**: the closing card, with **Sequence Diagrams Help**. **Done** closes the dialog with
    the tour, storing what is being typed as the dialog's own Done does; Skip leaves it open.

## Menu steps on the elements of round two

The chart, stack, entity, tab window, lane, boundary and portal are edited mostly from their own section of the
element menu (More, then **Tools**). Their tours keep that step for everyone: it rings **More** while More shows, and
otherwise the element itself, with "Right-click it" in place of "More" (a power user on a desktop has no More button).
The tour points at the section by name; it never opens the menu itself.

## The Chart tour

On a selected data chart (`pie-chart`, `bar-chart` or `line-chart`, any of the seven chart types), from
`chart-tour-steps.ts`. Its words name the chart's own type and marks (slices, bars or points). A line, area or
scatter chart's numbers are edited in its **Chart Data** dialog, which the tour opens and carries on inside, as the
Sankey tour does with Flows; every dialog step rings a real control (`data-tour-id`: `chart-data-table`,
`chart-data-series`, `chart-data-add-row`, `chart-data-import`). A canvas step puts the dialog away. While it runs,
Escape is the tour's and never closes the dialog.

1. **Sized by Value**: rings the chart; each mark is drawn from a number, and it is one of seven chart types.
2. **Point for the Number** (not on a touch screen): rings the chart; hovering a mark reads its label and value.
3. **Make It Grow**: rings the chart and previews **Grow** on it, looping while the step is up, never stored. Grow and
   Pop play once as it appears; Spin and Pulse loop.
4. **The Chart's Own Menu**: the menu step. Chart Type (keeps the data), Data, Chart (the legend, Show Values, Show
   Axis), Presets (a palette). On a pie or column chart, Data is a row per mark; on a chart drawn from a Sheet, Data
   reads the Sheet and **Unlink From Sheet** keeps today's numbers.
5. **A Row per Category** (a line, area or scatter chart not drawn from a Sheet): opens **Chart Data** and rings its
   table; the chart behind redraws as the numbers change.
6. **Series Across the Top**: rings the series header row; rename, remove, or **+** for another series.
7. **Add a Row**: rings **+ Add row**: a category at the end, every series at 0.
8. **Or Import a CSV**: rings **Import CSV**: the header row names the series, the first column the categories.
9. **That Is a Chart**: the closing card, with **Data Elements Help**. **Done** closes Chart Data with the tour, storing
   what is being typed as the dialog's own Done does; Skip leaves it open.

## The Stack tour

On a selected stack, from `stack-tour-steps.ts`.

1. **It Lays Itself Out**: rings the stack; it keeps what it holds in its row, column or grid, an even gap apart, and
   hugs them.
2. **Drag to Reorder** (a stack holding something; rings its first child): drag one past its neighbour and it takes
   that slot, the rest reflowing. An empty stack instead has **Drop Things In** on the stack: what is dropped inside
   takes the next slot, and an empty stack keeps its size as a target.
3. **Carries What It Holds**: rings the stack; dragging it brings everything inside, as a frame does.
4. **The Stack Menu**: the menu step. Row, Column or Grid (with Columns), Gap, Padding, Align.
5. **That Is a Stack**: the closing card, with **Stacks Help**.

## The Entity tour

On a selected entity, from `entity-tour-steps.ts`. Its fields carry `data-entity-fields` for the tour to ring.

1. **A Title Over Its Fields**: rings the entity; one box for a UML class or an ER table.
2. **Rename It**: rings the entity; double-click (double-tap) types over the title, which formats like any label.
3. **name: Type** (an entity with fields): rings the fields; the type sits muted on the right, and a method is a row
   too (`render(): void`).
4. **Edit the Fields**: the menu step. Fields: a name and a type per row, a cross to remove one, Add Field, up to
   forty.
5. **Join Them Up**: rings the entity; a line between two entities takes the ER ends (one, many, zero or many) from
   its own menu.
6. **That Is an Entity**: the closing card, with **Entities Help**.

## The Tab Window tour

On a selected tab window, from `tab-window-tour-steps.ts`.

1. **Another Tab, Live**: rings the window; it shows a tab of this document, fitted, following every change there.
2. **Open It to Edit** (a window showing a tab): rings its **Open** button (`data-tab-window-open`); the window is a
   picture, so changes are made on the tab. A window with no tab yet instead has **Choose a Tab**, ringing its
   button (`data-tab-window-choose`): any tab but this one and Plan tabs.
3. **The Tab Window Menu**: the menu step. Shows (another tab) and Open.
4. **Any Size**: rings the window; resized, the tab stays fitted and never cropped.
5. **That Is a Tab Window**: the closing card, with **Tab Windows Help**.

## The Lane tour

On a selected lane, from `lane-tour-steps.ts`. Its gutter carries `data-lane-gutter`.

1. **A Band for Each Role**: rings the lane; a role, a team or a system per lane, lanes butting edge to edge.
2. **The Title Gutter**: rings the gutter; double-click (double-tap) to name it, its colour is Heading under Colours.
3. **Drag the Seam** (rings the seam): more or less room for the title, snapping to the seams of the lanes around it.
4. **Carries Its Steps**: rings the lane; dragging it brings everything inside, as a frame does.
5. **Rows or Columns**: the menu step. Centring the title at the top turns the lane into a column; Upright Title
   (Text) turns a side title to read bottom to top.
6. **That Is a Lane**: the closing card, with **Lanes Help**.

## The Boundary tour

On a selected boundary, from `boundary-tour-steps.ts`.

1. **A Zone That Holds Things**: rings the boundary; everything whose centre is inside moves with it, and nesting
   deepens the tint.
2. **Its Title**: rings the boundary; double-click (double-tap) to rename it, and an icon dropped on it goes before
   the title (Tab and Inset styles; the C4 style names the C4 corner title instead).
3. **The Meta Line** (a boundary showing one): rings it; a CIDR range or a C4 type, clicked (tapped) to type over.
4. **Three Styles**: the menu step. Tab, Inset (nested), C4, and Meta Line on or off.
5. **That Is a Boundary**: the closing card, with **Boundaries Help**.

## The Diagram Key tour

On a selected diagram key, from `diagram-key-tour-steps.ts`. It has no menu section, so no menu step.

1. **It Builds Itself**: rings the key; a row for every line style the tab's arrows use and every mapped tag colour.
2. **Say What It Means** (a key with rows): rings its first row's meaning (`data-key-meaning`); click (tap) the words to write the
   meaning, Enter keeps it, Escape puts it back. An empty key instead has **Nothing to Key Yet** on the key: two
   arrows in different line styles bring their rows.
3. **Its Title**: rings the key; "Key" by default, double-click (double-tap) to rename; it grows downward on its own.
4. **That Is a Diagram Key**: the closing card, with **Diagram Keys Help**.

## The Portal tour

On a selected portal, from `portal-tour-steps.ts`.

1. **A Way Through**: rings the portal; two linked portals are a shortcut across the canvas or to another tab.
2. **Step Through** (a linked portal, this one's link or one into it): rings it; a click (tap) comes out of the other,
   a drag only moves it. An unlinked portal instead has **Not Linked Yet**: a dim ring leads nowhere until linked.
3. **Link It**: the menu step. Portal: Name, Leads To (a link works both ways), Create Portal (a linked partner
   beside it).
4. **Walk Into It**: rings the portal; an Avatar-mode character walking in steps out of the other.
5. **That Is a Portal**: the closing card, with **Portals Help**.

## Share roles

| Role        | Element tours                                                                                  |
| ----------- | ---------------------------------------------------------------------------------------------- |
| Editor      | Offered, on an unlocked element of a toured kind                                               |
| Participant | Never offered: an element tour teaches editing the element, which is not a Participant's to do |
| Viewer      | Never offered                                                                                  |

The gate is the toured kind's own edit check on the session's `can` (for a Sankey, `canEditSankey`; for a concept
graphic, a mind node (a person node included) or a flowchart step, an Editor on an unlocked element; for a sequence
diagram, `canEditSequence`; for a chart, a stack, an entity, a tab window, a lane, a boundary, a diagram key or a
portal, an Editor on an unlocked element, since its data, its arrangement, its fields, the tab it shows, its gutter,
its style, its meanings and its link are an Editor's), never `isReadOnly` alone.

## Telemetry ([Telemetry](../017-telemetry/telemetry.md))

Each toured kind has its own tokens, `<Kind>Tour` (`SankeyTour`, `LayerStackTour`, `PyramidTour`, `FunnelTour`, `CycleTour`, `HubTour`, `OnionTour`, `ChevronsTour`, `MindMapTour`, `FlowchartTour`, `OrgChartTour`, `SequenceTour`, `ChartTour`, `StackTour`, `EntityTour`, `TabWindowTour`, `LaneTour`, `BoundaryTour`, `DiagramKeyTour`, `PortalTour`), named in its registry entry:

- **Offer**: `UI` · `Opened` · `<Kind>TourOffer` the first time the offer shows in a page load;
  `UI` · `Closed` · `<Kind>TourOffer` on Cancel.
- **Start**: `UI` · `Started` · `<Kind>Tour` on Play.
- **Stage views**: `UI` · `View` · `<Kind>TourStep<Id>` once per step entry: the Sankey's `SankeyTourStepBands`,
  `...Leftover`, `...Style`, `...Flows`, the dialog's `...FlowsNodes`, `...FlowsRows`, `...FlowsAdd`,
  `...FlowsBalance`, `...FlowsText`, `...FlowsImport`, `...FlowsPreview` and `...Outro`; the Layer Stack's
  `LayerStackTourStepLayers`, `...Edit`, `...Notes`, `...Add`, `...Rows`, `...Colours`, `...Animate` and `...Outro`;
  the Pyramid's `PyramidTourStepTiers`, `...Edit`, `...Add`, `...Shape`, `...Colours`, `...Animate` and `...Outro`;
  the Funnel's `FunnelTourStepStages`, `...Edit`, `...Values`, `...Add`, `...Shape`, `...Colours`, `...Animate` and
  `...Outro`; the Cycle's `CycleTourStepLoop`, `...First`, `...Centre`, `...Add`, `...Rows`, `...Animate` and
  `...Outro`; the Hub's `HubTourStepHub`, `...Satellites`, `...Edit`, `...Add`, `...Spokes`, `...Animate` and
  `...Outro`; the Onion's `OnionTourStepRings`, `...Core`, `...Outer`, `...Add`, `...Rows`, `...Animate` and
  `...Outro`; the Chevrons' `ChevronsTourStepStages`, `...Edit`, `...Bar`, `...Notes`, `...Add`, `...Animate` and
  `...Outro`; the Mind Map's `MindMapTourStepNode`, `...Child`, `...Sibling`, `...Branch`, `...Menu` and `...Outro`;
  the Flowchart's `FlowchartTourStepStep`, `...Next`, `...Branch`, `...Type`, `...Lane`, `...Menu` and `...Outro`;
  the Org Chart's `OrgChartTourStepPerson`, `...Role`, `...Initials`, `...Report`, `...Peer`, `...Team`, `...Menu` and
  `...Outro`; the Sequence's `SequenceTourStepDiagram`, `...Menu`, `...Write`, `...Participants`, `...Messages`,
  `...Kind`, `...Add`, `...Text`, `...Preview`, `...Numbered` and `...Outro`; the Chart's `ChartTourStepChart`,
  `...Readout`, `...Animate`, `...Menu`, `...Data`, `...Series`, `...AddRow`, `...Import` and `...Outro`; the Stack's
  `StackTourStepStack`, `...Child`, `...Drop`, `...Carry`, `...Menu` and `...Outro`; the Entity's
  `EntityTourStepEntity`, `...Title`, `...Rows`, `...Menu`, `...Relate` and `...Outro`; the Tab Window's
  `TabWindowTourStepWindow`, `...Open`, `...Choose`, `...Menu`, `...Size` and `...Outro`; the Lane's
  `LaneTourStepLane`, `...Gutter`, `...Seam`, `...Carry`, `...Menu` and `...Outro`; the Boundary's
  `BoundaryTourStepZone`, `...Title`, `...Meta`, `...Menu` and `...Outro`; the Diagram Key's `DiagramKeyTourStepKey`,
  `...Meaning`, `...Empty`, `...Title` and `...Outro`; the Portal's `PortalTourStepPortal`, `...Travel`,
  `...Unlinked`, `...Menu`, `...Walk` and `...Outro`.
- **End**: `UI` · `Ended` · `<Kind>TourCompleted` | `<Kind>TourSkipped`.
- **Settings row**: `UI` · `Toggled` · `<Kind>TourSeenOn` | `<Kind>TourSeenOff`; the switch over them all
  `ElementToursSeenOn` | `ElementToursSeenOff`.

The dashboard charts them as one **Element Tours** stack on the Visitors tab (offered, declined, started and started
per element, steps, completed, skipped), as Show Me's is one stack.

## Adding an element tour

A new toured kind adds, in one change: its kind and name to `ELEMENT_TOUR_KINDS` / `ELEMENT_TOUR_NAMES` with its
edit gate (`apps/live/lib/element-tours.ts`); its entry in `ELEMENT_TOUR_DEFS` (token, eyebrow, help article, steps,
what Done puts away; `apps/live/components/tour/element-tour-defs.ts`); its steps file; its switch under Element
Tours in Settings; its token on the dashboard (`apps/telemetry/app/element-tour-kinds.ts`, its steps in
`computed-emitters.ts`, its sentences in `event-explanations.ts`); its kind in the e2e fixture's answered list; its
help article's tour section; and a section here.

## Code

- `apps/live/lib/element-tours.ts`: the toured kinds, their names, their edit gates, and the answered list.
- `apps/live/lib/element-tour-offer.ts`: the offer the host publishes and the selection toolbar reads.
- `apps/live/lib/element-keyed-store.ts`: the per-element module store behind the offer and what a step shows.
- `apps/live/components/tour/ElementTourHost.tsx`: decides the offer, runs the tour, ends it.
- `apps/live/components/tour/element-tour-defs.ts`: one definition per toured kind.
- `apps/live/components/tour/element-tour-api.ts`: what a step may do on its element.
- `apps/live/components/tour/ElementTourOffer.tsx`: the offer toolbar.
- `apps/live/components/tour/sankey-element-tour-steps.ts`: the Sankey tour's steps.
- `apps/live/components/tour/concept-element-tour-steps.ts`: the steps every concept graphic's tour is built from;
  `layer-stack-tour-steps.ts`, `pyramid-tour-steps.ts`, `funnel-tour-steps.ts`, `cycle-tour-steps.ts`, `hub-tour-steps.ts`, `onion-tour-steps.ts`, `chevrons-tour-steps.ts`: each kind's own.
- `apps/live/components/tour/mind-node-tour-steps.ts`, `flowchart-tour-steps.ts`, `org-chart-tour-steps.ts`,
  `sequence-tour-steps.ts`: the Mind Map, Flowchart, Org Chart and Sequence tours' steps.
- `apps/live/components/tour/chart-tour-steps.ts`, `stack-tour-steps.ts`, `entity-tour-steps.ts`,
  `tab-window-tour-steps.ts`, `lane-tour-steps.ts`, `boundary-tour-steps.ts`, `diagram-key-tour-steps.ts`,
  `portal-tour-steps.ts`: the round-two tours' steps; `menu-tour-step.ts`: their menu step.
- `apps/live/lib/dialog-handle.ts`: the slot an open dialog registers its tabs and close in, for a tour that runs inside
  it (`sankey-flows-dialog-handle.ts`, `sequence-dialog-handle.ts`, `chart-data-dialog-handle.ts`).
- `apps/live/lib/sankey-tour-focus.ts`: the band or node a step lifts on a Sankey.
- `apps/live/lib/concept-tour-preview.ts`: what a step shows on a concept graphic or a chart: an animation previewed
  (a chart's Grow), or a chevron stage's bar held open.
