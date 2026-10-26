# Element tours

An **element tour** teaches one complex element type, on the element itself: what its parts mean, how to read it and
how to change it. While an element of a toured kind is selected, the footer's Start Tour button offers its tour
("Start Sankey Tour"), and a press walks through the real element the person selected, not a sample.

It shares the button with the [Pages tour](pages-tour.md), and takes it while its element is selected: the
selected element's own tour is the most specific on offer ([Pages tour](pages-tour.md) "Where it appears", in
livediagram). [Show Me](show-me.md) is started from a button on one surface instead. Until 25 October 2026 an
element tour offered itself from a small toolbar beside the selection, the first time a person selected that kind;
nothing offers itself now.

The toured kinds: the [Sankey diagram](../009-elements/sankey.md), and the
[concept graphics](../009-elements/concept-graphics.md) layer stack, pyramid, funnel, cycle, hub and spoke, onion,
timeline and chevron process; the [data charts](../009-elements/pie-chart.md); and the [stack](../009-elements/stack.md).

## Domain language

| Term                  | Means                                                                                        |
| --------------------- | -------------------------------------------------------------------------------------------- |
| **Element tour**      | This pattern, and one tour of it (the **Sankey tour**)                                       |
| **Start Tour button** | The footer button, left of Search, that starts every tour ("Start Sankey Tour")              |
| **Toured kind**       | An element type that has an element tour (`sankey`, `chart`, …)                              |
| **Selection toolbar** | The floating toolbar over a single selection ([Canvas](../008-canvas/canvas-and-palette.md)) |

## Naming

On the Start Tour button an element tour is named from its card's eyebrow, in title case, "tour" dropped: **Start
Sankey Tour**, **Start Layer Stack Tour**, **Start Hub and Spoke Tour** (`tourNameOf`). Its Settings section is
**Show Me**. "Element tour" is the code's and the specs' word only.

## On the Start Tour button

- **When it is on offer**, all of these hold:
  - exactly one element is selected, of a toured kind;
  - the person may edit it (for a Sankey, `canEditSankey`: an Editor, on an unlocked diagram);
  - the editor is usable: hydrated, no welcome overlay, no start panel open, not an embed, not on a phone.
- **Whether taken or not.** A tour stays on offer after it has been taken: selecting the element again and pressing
  the button reruns it. Deselecting takes it off the button, and the mode's own tour (Pages) comes back.
- **On a phone** (narrower than 640px, or a phone held sideways: `useIsMobileViewport`) no element tour is on offer:
  the button offers the mode's tour, if any.
- **A press** starts the tour on its first step; there is no welcome card. A press while another tour is on screen
  does nothing.

## Remembering who has taken it

- A synced user preference, `elementTourKinds`, lists the toured kinds whose tour has been started, so the record
  follows the account ([User preferences](user-preferences.md)). It feeds the Settings rows only; it no longer
  hides the button.
- `elementToursSeen`, written only by [Power user mode](power-user-mode.md)'s preset, counts every kind as taken
  while the mode is on, as `pagesTourSeen` does for its kinds.

## Settings

Settings' **Tours** category holds element tours in their own section, **Show Me**, below the Pages tours'
**Offer Again** section. It is a closed accordion (people rarely look for it): its header names the section and
how many are on (`1 of 1 On`). Opened, it shows the section's line, then **Show Me on Every Element**, one switch
over them all ("Every element’s Show Me at once": on while any kind is untaken; off marks every kind taken, on
forgets every record), with one switch per toured kind nested beneath it, named for the element alone: **Sankey
Diagram**, linking the Sankey Diagram article. On means not yet taken. A switch changes the record only: the
tour is on the Start Tour button whenever its element is selected, either way. The accordion opens on its own when
Settings is opened on one of its rows (a search result) or on the section. Power user mode's readout lists the
switch over them all as **Show Me on Every Element**.

## Menu steps

A step whose copy names a part of the element's own menu ("In its menu, Tools › Rows…", "More, then Tools ›
Stack…") opens that menu on the element (`openElementMenu`, as a right-click does), opens each row of its path in
turn (an accordion section, or a flyout such as **Tools**), highlights the part the last row opened, and closes the
menu as the step ends, however it ends (`inTheMenu`, `menuStep`, `element-menu-tour.ts`). A path that cannot be
followed (a row missing) highlights the deepest part it reached.

## The page waits

While an element tour's step is up the page takes no clicks or wheel, only the step card does, ([Pages
tour](pages-tour.md#the-page-waits)).

## The tour

- **The shared tour**: the anchored step card with Back, Next and Skip, the ring with room to breathe, the dim
  around it, and a closing card, as [Show Me](show-me.md) draws them. No welcome card: the button already said what it starts.
  Steps count from 1.
- **On the element itself.** The steps ring the selected element's real parts and show what it says about them.
- **The steps are fixed when the button is pressed**, from the element as it is then: a part it does not have (no
  leftovers, no flows) is left out, so the count is right from the first step.
- **Live.** What a step rings stays usable, and what the person does is kept.
- **Ending.** Done ends it as completed, Skip as skipped. It ends as skipped, with nothing remembered beyond the
  kind already recorded as taken, when the element goes (deleted, or no longer editable), or the person opens another tab.
- **Escape** belongs to the tour while a step is over a dialog the tour opened: the dialog does not close under it.

## The Sankey tour

The steps, in order, each a line or two. The exact strings live in
`apps/live/components/tour/sankey-element-tour-steps.ts`.

1. **Bands Carry Amounts** (only with flows): rings the widest band and lifts it, its readout showing as a hover
   would. "Each band is as wide as its amount, so the biggest flows stand out."
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
6. **That Is a Sankey** (closing card): "Undo takes back any change. Show Me in the Flows dialog runs this part
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
   design does not change, and gone with the step. Animation, then Concept: Build, or Pulse.
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

## The Timeline tour

On the selected Timeline, from `timeline-tour-steps.ts`.

1. **Along One Line**: rings the timeline, counting its milestones; they read left to right toward the arrow, taking
   turns above and below.
2. **What Happens**: rings the first milestone's name; click (tap) to type over it.
3. **And When**: rings the first milestone's when; click (tap) to change it.
4. **Add a Milestone**: the "+" ring open on **Add Milestone**; one at the end, up to eight.
5. **Reorder in the Menu** (only while More shows): rings More; Tools › Rows.
6. **Play It in Order**: plays **Build**, left to right, as a preview while the step is up.
7. **That Is a Timeline**: the closing card.

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

## Menu steps on the chart and stack

The chart and stack are edited mostly from their own section of the
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
   Axis), Presets (a palette). On a pie or column chart, Data is a row per mark.
5. **A Row per Category** (a line, area or scatter chart): opens **Chart Data** and rings its
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

## Share roles

| Role        | Element tours                                                                                   |
| ----------- | ----------------------------------------------------------------------------------------------- |
| Editor      | On offer, on an unlocked element of a toured kind                                               |
| Participant | Never on offer: an element tour teaches editing the element, which is not a Participant's to do |
| Viewer      | Never on offer                                                                                  |

The gate is the toured kind's own edit check on the session's `can` (for a Sankey, `canEditSankey`; for a concept
graphic, a chart or a stack, an Editor on an unlocked element, since its data and its arrangement are an Editor's),
never `isReadOnly` alone.

## Telemetry ([Telemetry](../017-telemetry/telemetry.md))

Each toured kind has its own tokens, `<Kind>Tour` (`SankeyTour`, `LayerStackTour`, `PyramidTour`, `FunnelTour`, `CycleTour`, `HubTour`, `OnionTour`, `ChevronsTour`, `TimelineTour`, `ChartTour`, `StackTour`), named in its registry entry:

- **Offer**: `UI` · `Opened` · `<Kind>TourOffer` the first time the Start Tour button shows that kind's tour in a
  page load. Until 25 October 2026 it counted the offer toolbar showing, and `UI` · `Closed` · `<Kind>TourOffer`
  counted **Cancel**; nothing sends Closed now.
- **Start**: `UI` · `Started` · `<Kind>Tour` on a press of the button.
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
  `...Outro`; the Timeline's `TimelineTourStepLine`, `...Name`, `...When`, `...Add`, `...Rows`, `...Animate` and
  `...Outro`; the Chart's `ChartTourStepChart`,
  `...Readout`, `...Animate`, `...Menu`, `...Data`, `...Series`, `...AddRow`, `...Import` and `...Outro`; the Stack's
  `StackTourStepStack`, `...Child`, `...Drop`, `...Carry`, `...Menu` and `...Outro`.
- **End**: `UI` · `Ended` · `<Kind>TourCompleted` | `<Kind>TourSkipped`.
- **Settings row**: `UI` · `Toggled` · `<Kind>TourSeenOn` | `<Kind>TourSeenOff`; the switch over them all
  `ElementToursSeenOn` | `ElementToursSeenOff`.

The dashboard charts them as one **Element Tours** stack on the Visitors tab (offered, declined until 25 October 2026, started and
started per element, steps, completed, skipped), as Show Me's is one stack.

## Adding an element tour

A new toured kind adds, in one change: its kind and name to `ELEMENT_TOUR_KINDS` / `ELEMENT_TOUR_NAMES` with its
edit gate (`apps/live/lib/element-tours.ts`); its entry in `ELEMENT_TOUR_DEFS` (token, eyebrow, help article, steps,
what Done puts away; `apps/live/components/tour/element-tour-defs.ts`); its steps file; its switch under Element
Tours in Settings; its token on the dashboard (`../liveworkspace/apps/site/app/telemetry/livedesign/element-tour-kinds.ts`, its steps in
`computed-emitters.ts`, its sentences in `event-explanations.ts`); its kind in the e2e fixture's answered list; its
help article's tour section; and a section here.

## Code

- `apps/live/lib/element-tours.ts`: the toured kinds, their names, their edit gates, and the answered list.
- `../packages/workbench/src/lib/element-keyed-store.ts`: the per-element module store behind what a step shows.
- `apps/live/components/tour/ElementTourHost.tsx`: puts the tour on the Start Tour button (`useOfferTour`), runs it, ends it.
- `apps/live/components/tour/element-tour-defs.ts`: one definition per toured kind.
- `../packages/workbench/src/components/tour/element-tour-api.ts`: what a step may do on its element.
- `apps/live/components/tour/sankey-element-tour-steps.ts`: the Sankey tour's steps.
- `apps/live/components/tour/concept-element-tour-steps.ts`: the steps every concept graphic's tour is built from;
  `layer-stack-tour-steps.ts`, `pyramid-tour-steps.ts`, `funnel-tour-steps.ts`, `cycle-tour-steps.ts`, `hub-tour-steps.ts`, `onion-tour-steps.ts`, `chevrons-tour-steps.ts`, `timeline-tour-steps.ts`: each kind's own.
- `apps/live/components/tour/chart-tour-steps.ts`, `stack-tour-steps.ts`: the Chart and Stack tours' steps;
  `menu-tour-step.ts`: their menu step.
- `../packages/workbench/src/lib/dialog-handle.ts`: the slot an open dialog registers its tabs and close in, for a tour that runs inside
  it (`sankey-flows-dialog-handle.ts`, `chart-data-dialog-handle.ts`).
- `../packages/workbench/src/lib/sankey-tour-focus.ts`: the band or node a step lifts on a Sankey.
- `../packages/workbench/src/lib/concept-tour-preview.ts`: what a step shows on a concept graphic or a chart: an animation previewed
  (a chart's Grow), or a chevron stage's bar held open.
