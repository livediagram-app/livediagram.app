# Element tours

An **element tour** teaches one complex element type, on the element itself: what its parts mean, how to read it and
how to change it. It is started from the footer's Start Tour button while an element of that type is selected, and it
walks through the real element the person selected, not a sample.

It sits beside the [Avatar tour](../008-canvas/avatar-tour.md) and [Show Me](show-me.md) (started from a
button on one surface). Like every tour it never offers itself: the one way in is the Start Tour button
([Tours](editor-tour.md#where-it-appears)).

The toured kinds: the [Timeline](../009-elements/timeline.md); the [data charts](../009-elements/pie-chart.md); the
[stack](../009-elements/stack.md); the [lane](../009-elements/lane.md); the [boundary](../009-elements/boundary.md); the
[diagram key](../009-elements/diagram-key.md); and the [portal](../009-elements/portal-element.md). livediagram's tours
of the elements livehuddle does not have (the Sankey, the other concept graphics, the mind map, flowchart, org chart,
sequence diagram and entity) went with them ([Editor modes](editor-modes.md)).

## Domain language

| Term                  | Means                                                                                        |
| --------------------- | -------------------------------------------------------------------------------------------- |
| **Element tour**      | This pattern, and one tour of it (the **Timeline tour**)                                     |
| **Start Tour button** | The footer button that starts every tour ([Tours](editor-tour.md#where-it-appears))          |
| **Toured kind**       | An element type that has an element tour (`timeline`, `chart`, …)                            |
| **Selection toolbar** | The floating toolbar over a single selection ([Canvas](../008-canvas/canvas-and-palette.md)) |

## Naming

On the Start Tour button an element tour is named from its closing card's eyebrow, in title case, without the word
"tour": **Start Timeline Tour**, **Start Chart Tour**, **Start Diagram Key Tour** (`tourNameOf`). Its Settings
section is still called **Show Me**. "Element tour" is the code's and the specs' word only.

## On the Start Tour button

- **Most specific first.** While a toured element is selected its tour is the one the button offers, ahead of a tool
  in hand and the Workshop tour (`TOUR_OFFER_RANK.element`).
- **When it is on offer**, all of these hold:
  - exactly one element is selected, of a toured kind;
  - the person may edit it (an Editor, on an unlocked element);
  - the editor is usable: hydrated, no welcome overlay, no start panel open, not an embed, not on a phone (narrower
    than 640px, or a phone held sideways: `useIsMobileViewport`).
- **Gone once taken, back from Settings.** Starting an element's tour takes that kind off the button
  ([Tours](editor-tour.md#where-it-appears)): selecting another element of the kind offers the Workshop tour
  instead, if one is owed, or no button. Its switch in Settings' **Show Me** section (below) puts it back.
- **A press** starts the tour on its first step, on the selected element. A press while another tour is on screen
  does nothing. Deselecting the element takes its tour off the button.

## Remembering runs

- A synced user preference, `elementTourKinds`, lists the toured kinds whose tour has been started, so the record
  follows the account ([User preferences](user-preferences.md)). Until 25 October 2026 it listed the kinds whose
  offer had been answered (Play or Cancel) and hid the offer for them; from then until 1 November 2026 it only fed
  the Settings rows. Now it hides that kind's tour from the Start Tour button again, until its switch is turned on.
- `elementToursSeen` counts every kind as taken: **Show Me on Every Element** switched off writes it (with every kind
  listed), and so did the retired [Power user mode](power-user-mode.md)'s preset, which listed none. Turning a kind's
  switch back on lifts it, keeping every other kind answered.

## Settings

Settings' **Tours** category holds element tours in their own section, **Show Me**, below the Workshop tour's
**Offer Again** section. It is a closed accordion (people rarely look for it): its header names the section and
how many are on (`1 of 1 On`). Opened, it shows the section's line, then **Show Me on Every Element**, one switch
over them all (on while any is not yet taken; off marks every kind taken, on forgets every run), with one switch per
toured kind nested beneath it, named for the element alone: **Timeline**, linking the Timeline article.
On means "not yet taken": switching one on forgets its run and puts that kind's tour back on the Start Tour button
whenever such an element is selected; off takes it off the button. The accordion opens on its own when Settings is
opened on one of its rows (a search result) or on the section. The switch over them all is **Show Me on Every
Element**.

## Menu steps

A step whose copy names a part of the element's own menu ("In its menu, Tools › Rows…", "More, then Tools ›
Stack…") opens that menu on the element (`openElementMenu`, as a right-click does), opens each row of its path in
turn (an accordion section, or a flyout such as **Tools**), highlights the part the last row opened, and closes the
menu as the step ends, however it ends (`inTheMenu`, `menuStep`, `element-menu-tour.ts`). A path that cannot be
followed (a row missing) highlights the deepest part it reached.

## The page waits

While an element tour's step is up the page takes no clicks or wheel, only the step card does, as on the
[shared tour mechanics](editor-tour.md#the-page-waits).

## The tour

- **The shared tour**: the anchored step card with Back, Next and Skip, the ring with room to breathe, the dim
  around it, and a closing card, as [Show Me](show-me.md) draws them. No welcome card: the button already said what it starts.
  Steps count from 1.
- **On the element itself.** The steps ring the selected element's real parts and show what it says about them.
- **The steps are fixed when the button is pressed**, from the element as it is then: a part it does not have (no
  series on a pie chart) is left out, so the count is right from the first step.
- **Live.** What a step rings stays usable, and what the person does is kept.
- **Ending.** Done ends it as completed, Skip as skipped. It ends as skipped, with nothing remembered beyond the
  run being recorded, when the element goes (deleted, or no longer editable), or the person opens another tab.
- **Escape** belongs to the tour while a step is over a dialog the tour opened: the dialog does not close under it.

## The Timeline tour

On the selected Timeline, from `timeline-tour-steps.ts`.

1. **Along One Line**: rings the timeline, counting its milestones; they read left to right toward the arrow, taking
   turns above and below.
2. **What Happens**: rings the first milestone's name; click (tap) to type over it.
3. **And When**: rings the first milestone's when; click (tap) to change it.
4. **Reorder in the Menu** (only while More shows): rings More; Tools › Rows.
5. **Play It in Order**: plays **Build**, left to right, as a preview while the step is up.
6. **That Is a Timeline**: the closing card.

(The Add a Milestone step rang the "+" ring's **Add Milestone**; livehuddle has no "+" ring,
[Not in livehuddle](../002-project-scope/not-in-livehuddle.md#quick-connect).)

## Menu steps on the elements of round two

The chart, stack, lane, boundary and portal are edited mostly from their own section of the
element menu (More, then **Tools**). Their tours keep that step for everyone: it rings **More** while More shows, and
otherwise the element itself, with "Right-click it" in place of "More".
The tour points at the section by name; it never opens the menu itself.

## The Chart tour

On a selected data chart (`pie-chart`, `bar-chart` or `line-chart`, any of the seven chart types), from
`chart-tour-steps.ts`. Its words name the chart's own type and marks (slices, bars or points). A line, area or
scatter chart's numbers are edited in its **Chart Data** dialog, which the tour opens and carries on inside, as a tour
may carry on inside a dialog; every dialog step rings a real control (`data-tour-id`: `chart-data-table`,
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
3. **Carries What It Holds**: rings the stack; dragging it brings everything inside.
4. **The Stack Menu**: the menu step. Row, Column or Grid (with Columns), Gap, Padding, Align.
5. **That Is a Stack**: the closing card, with **Stacks Help**.

## The Lane tour

On a selected lane, from `lane-tour-steps.ts`. Its gutter carries `data-lane-gutter`.

1. **A Band for Each Role**: rings the lane; a role, a team or a system per lane, lanes butting edge to edge.
2. **The Title Gutter**: rings the gutter; double-click (double-tap) to name it, its colour is Heading under Colours.
3. **Drag the Seam** (rings the seam): more or less room for the title, snapping to the seams of the lanes around it.
4. **Carries Its Steps**: rings the lane; dragging it brings everything inside.
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

| Role        | Element tours                                                                                   |
| ----------- | ----------------------------------------------------------------------------------------------- |
| Editor      | On offer, on an unlocked element of a toured kind                                               |
| Participant | Never on offer: an element tour teaches editing the element, which is not a Participant's to do |
| Viewer      | Never on offer                                                                                  |

The gate is the toured kind's own edit check on the session's `can` (for a Timeline, a chart, a stack, a lane, a boundary, a
diagram key or a portal, an Editor on an unlocked element, since its rows, its data, its arrangement, its gutter, its
style, its meanings and its link are an Editor's), never `isReadOnly` alone.

## Telemetry ([Telemetry](../017-telemetry/telemetry.md))

Each toured kind has its own tokens, `<Kind>Tour` (`TimelineTour`, `ChartTour`, `StackTour`, `LaneTour`, `BoundaryTour`, `DiagramKeyTour`, `PortalTour`), named in its registry entry. The tokens of livediagram's tours of cut kinds (`SankeyTour`, `LayerStackTour`, `MindMapTour`, `EntityTour` and the rest) are not sent by livehuddle and stay explained for the shared dashboard's history:

- **Offer**: `UI` · `Opened` · `<Kind>TourOffer` the first time the Start Tour button shows that kind's tour in a
  page load. Until 25 October 2026 it counted the offer toolbar showing, and `UI` · `Closed` · `<Kind>TourOffer`
  counted **Cancel**; nothing sends Closed now, and its explanation stays for the history.
- **Start**: `UI` · `Started` · `<Kind>Tour` on a press of the button.
- **Stage views**: `UI` · `View` · `<Kind>TourStep<Id>` once per step entry: the Timeline's `TimelineTourStepLine`,
  `...Name`, `...When`, `...Add`, `...Rows`, `...Animate` and `...Outro`; the Chart's `ChartTourStepChart`,
  `...Readout`, `...Animate`, `...Menu`, `...Data`, `...Series`, `...AddRow`, `...Import` and `...Outro`; the Stack's
  `StackTourStepStack`, `...Child`, `...Drop`, `...Carry`, `...Menu` and `...Outro`; the Lane's
  `LaneTourStepLane`, `...Gutter`, `...Seam`, `...Carry`, `...Menu` and `...Outro`; the Boundary's
  `BoundaryTourStepZone`, `...Title`, `...Meta`, `...Menu` and `...Outro`; the Diagram Key's `DiagramKeyTourStepKey`,
  `...Meaning`, `...Empty`, `...Title` and `...Outro`; the Portal's `PortalTourStepPortal`, `...Travel`,
  `...Unlinked`, `...Menu`, `...Walk` and `...Outro`.
- **End**: `UI` · `Ended` · `<Kind>TourCompleted` | `<Kind>TourSkipped`.
- **Settings row**: `UI` · `Toggled` · `<Kind>TourSeenOn` | `<Kind>TourSeenOff`; the switch over them all
  `ElementToursSeenOn` | `ElementToursSeenOff`.

The dashboard charts them as one **Element Tours** stack on the Visitors tab (offered, declined (older rows), started and started
per element, steps, completed, skipped), as Show Me's is one stack.

## Adding an element tour

A new toured kind adds, in one change: its kind and name to `ELEMENT_TOUR_KINDS` / `ELEMENT_TOUR_NAMES` with its
edit gate (`apps/editor/lib/element-tours.ts`); its entry in `ELEMENT_TOUR_DEFS` (token, eyebrow, help article, steps,
what Done puts away; `apps/editor/components/tour/element-tour-defs.ts`); its steps file; its switch under Element
Tours in Settings; its token on the dashboard (liveworkspace/apps/site/app/telemetry/livehuddle/element-tour-kinds.ts, its steps in
`computed-emitters.ts`, its sentences in `event-explanations.ts`); its kind in the e2e fixture's taken list; its
help article's tour section; and a section here.

## Code

- `apps/editor/lib/element-tours.ts`: the toured kinds, their names, their edit gates, and the taken list.
- `../packages/workbench/src/lib/element-keyed-store.ts`: the per-element module store behind what a step shows.
- `apps/editor/components/tour/ElementTourHost.tsx`: publishes the tour to the Start Tour button (`useOfferTour`), runs it, ends it.
- `apps/editor/components/tour/element-tour-defs.ts`: one definition per toured kind.
- `apps/editor/components/tour/element-tour-api.ts`: what a step may do on its element.
- `apps/editor/components/tour/concept-element-tour-steps.ts`, `timeline-tour-steps.ts`: the Timeline tour's steps.
- `apps/editor/components/tour/chart-tour-steps.ts`, `stack-tour-steps.ts`, `lane-tour-steps.ts`,
  `boundary-tour-steps.ts`, `diagram-key-tour-steps.ts`, `portal-tour-steps.ts`: the round-two tours' steps;
  `menu-tour-step.ts`: their menu step.
- `../packages/workbench/src/lib/dialog-handle.ts`: the slot an open dialog registers its tabs and close in, for a tour that runs inside
  it (`chart-data-dialog-handle.ts`).
- `../packages/workbench/src/lib/concept-tour-preview.ts`: what a step shows on a Timeline or a chart: an animation previewed
  (a Timeline's Build, a chart's Grow).
