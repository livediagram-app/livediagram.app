# Element tours

An **element tour** teaches one complex element type, on the element itself: what its parts mean, how to read it and
how to change it. It is offered from a small toolbar beside the selected element's toolbar, the first time a person
selects an element of that type, and it walks through the real element the person selected, not a sample.

It sits between the mode tours (the [Diagram tour](editor-tour.md) and its siblings, which offer themselves once
with a centred card) and [Show Me](show-me.md) (never offered, started from a button on one surface). An element
tour offers itself, but quietly: a small toolbar that waits beside the selection, never a card over the canvas.

The first element tour is the [Sankey diagram](../009-elements/sankey.md)'s.

## Domain language

| Term                  | Means                                                                                           |
| --------------------- | ----------------------------------------------------------------------------------------------- |
| **Element tour**      | This pattern, and one tour of it (the **Sankey tour**)                                          |
| **Tour offer**        | The small toolbar that offers an element tour: the Tour glyph and word, **Play** and **Cancel** |
| **Toured kind**       | An element type that has an element tour (today: `sankey`)                                      |
| **Selection toolbar** | The floating toolbar over a single selection ([Canvas](../008-canvas/canvas-and-palette.md))    |

## The tour offer

- **Where.** A separate small toolbar immediately to the right of the selection toolbar, on the same line, 8px apart,
  styled as that toolbar (white card, border, shadow, 32px buttons). It moves, flips above or below and is nudged
  inside the canvas with the selection toolbar, as one group.
- **What it holds.** The Tour glyph (footprints, as Show Me's) and the word **Tour**, then **Play** (a play glyph)
  and **Cancel** (a cross), each with a hover card: Play is **Take the Tour** ("A short tour of how a Sankey diagram
  works, on this one."), Cancel is **No Thanks** ("Hide this tour. Settings › Tours offers it again."). Play wears
  the tab's accent, as the primary choice.
- **On a phone** the word Tour is kept for assistive technology only (`sr-only`), so the offer is three glyph
  buttons wide. When the two toolbars together are wider than the canvas less its margins, the offer wraps onto its
  own line, centred, on the far side from the element (above the selection toolbar when that sits above the
  element, below it when below), so it never covers the element and never runs off screen. Its buttons keep the
  selection toolbar's 44px touch targets.
- **When it shows**, all of these hold:
  - exactly one element is selected, of a toured kind, and its selection toolbar is showing;
  - the person may edit it (for a Sankey, `canEditSankey`: an Editor, on an unlocked diagram);
  - the person has not answered this kind's tour (below);
  - the editor is usable: hydrated, the synced preferences in, no welcome overlay, not an embed;
  - no guided tour is running (`useActiveTour`), and no start panel is open.
- **It fades in** with the selection toolbar, and away with it (a move, a quick-connect ring).
- **Play** answers the offer and starts the tour on its first step. **Cancel** answers it and the offer goes. Either
  way, the kind is never offered again, on any device, until Settings offers it again. Simply deselecting is not an
  answer: the offer comes back the next time an element of that kind is selected.

## Remembering answers

- A synced user preference, `elementTourKinds`, lists the toured kinds whose offer has been answered (Play or
  Cancel), so an answer follows the account ([User preferences](user-preferences.md)).
- `elementToursSeen`, written only by [Power user mode](power-user-mode.md)'s preset, counts every kind as answered
  while the mode is on, as `illustrateTourSeen` does for its kinds.

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
2. **Nodes Stand in Columns** (only with flows): rings the busiest node with flows in and out (else the largest),
   lifted with its readout. "A node is as tall as what passes through it. Columns step left to right from where the
   flows start."
3. **What Is Left Over** (only when a leftover band is drawn): rings the largest leftover band, lifted. "What a node
   keeps back runs on to Leftover, in grey. It is worked out, never typed, so it follows the amounts."
4. **Style It** (only while the selection toolbar's More button shows): rings More. "Under Sankey in the menu: band
   colours, columns, labels, the unit, and an animation."
5. **Write the Flows**: rings the whole diagram. "Double-click a Sankey (double-tap on a touch screen) to open its
   flows. Next opens them for you."
6. The Flows dialog opens, and the tour carries on inside it with the steps of its own
   [Show Me](../009-elements/sankey.md#show-me) (Your Nodes, Flows Step by Step, Add a Flow, In and Out Differ, Or
   Type Them, Import a File, Live Preview), left out as Show Me leaves them out. Each opens the dialog again if it
   was closed. Stepping Back onto a canvas step closes it.
7. **That Is a Sankey** (closing card): "Every change is one undo step. Show Me in the Flows dialog runs this part
   again." with **Done** and a link to the Sankey Diagram article (**Sankey Diagram Help**).

The lift and the readout in steps 1 to 3 are the tour's: they win over a pointer left resting on another part (after pressing Next, say), since the step is about its part, and they go when the step does, when hovering works as ever.

## Share roles

| Role        | Element tours                                                                                  |
| ----------- | ---------------------------------------------------------------------------------------------- |
| Editor      | Offered, on an unlocked element of a toured kind                                               |
| Participant | Never offered: an element tour teaches editing the element, which is not a Participant's to do |
| Viewer      | Never offered                                                                                  |

The gate is the toured kind's own edit check on the session's `can` (for a Sankey, `canEditSankey`), never
`isReadOnly` alone.

## Telemetry ([Telemetry](../017-telemetry/telemetry.md))

Each toured kind has its own literal tokens, `<Kind>Tour` (the Sankey's: `SankeyTour`):

- **Offer**: `UI` · `Opened` · `SankeyTourOffer` the first time the offer shows in a page load;
  `UI` · `Closed` · `SankeyTourOffer` on Cancel.
- **Start**: `UI` · `Started` · `SankeyTour` on Play.
- **Stage views**: `UI` · `View` · `SankeyTourStep<Id>` once per step entry (`SankeyTourStepBands`,
  `SankeyTourStepNodes`, `SankeyTourStepLeftover`, `SankeyTourStepStyle`, `SankeyTourStepFlows`, the dialog's
  `SankeyTourStepFlowsNodes`, `...FlowsRows`, `...FlowsAdd`, `...FlowsBalance`, `...FlowsText`, `...FlowsImport`,
  `...FlowsPreview`, and `SankeyTourStepOutro`).
- **End**: `UI` · `Ended` · `SankeyTourCompleted` | `SankeyTourSkipped`.
- **Settings row**: `UI` · `Toggled` · `SankeyTourSeenOn` | `SankeyTourSeenOff`.

## Adding an element tour

A new toured kind adds: its kind to `ELEMENT_TOUR_KINDS` (`apps/live/lib/element-tours.ts`) with its edit gate, its
steps file, its Settings row in Element Tours, its tokens on the telemetry dashboard, and a section here.

## Code

- `apps/live/lib/element-tours.ts`: the toured kinds, their edit gates, and the answered list.
- `apps/live/lib/element-tour-offer.ts`: the offer the host publishes and the selection toolbar reads.
- `apps/live/components/tour/ElementTourHost.tsx`: decides the offer, runs the tour, ends it.
- `apps/live/components/tour/ElementTourOffer.tsx`: the offer toolbar.
- `apps/live/components/tour/sankey-element-tour-steps.ts`: the Sankey tour's steps.
- `apps/live/lib/sankey-tour-focus.ts`: the band or node a step lifts on the canvas.
