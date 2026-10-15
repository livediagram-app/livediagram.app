# Element tours

An **element tour** teaches one complex element type, on the element itself: what its parts mean, how to read it and
how to change it. It is offered from a small toolbar beside the selected element's toolbar, the first time a person
selects an element of that type, and it walks through the real element the person selected, not a sample.

It sits between the mode tours (the [Diagram tour](editor-tour.md) and its siblings, which offer themselves once
with a centred card) and [Show Me](show-me.md) (never offered, started from a button on one surface). An element
tour offers itself, but quietly: a small toolbar that waits beside the selection, never a card over the canvas.

The toured kinds: the [Sankey diagram](../009-elements/sankey.md), and the
[concept graphics](../009-elements/concept-graphics.md) layer stack, pyramid, funnel, cycle, hub and spoke, and onion.

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

## Share roles

| Role        | Element tours                                                                                  |
| ----------- | ---------------------------------------------------------------------------------------------- |
| Editor      | Offered, on an unlocked element of a toured kind                                               |
| Participant | Never offered: an element tour teaches editing the element, which is not a Participant's to do |
| Viewer      | Never offered                                                                                  |

The gate is the toured kind's own edit check on the session's `can` (for a Sankey, `canEditSankey`; for a concept
graphic, an Editor on an unlocked element, since its rows are structure), never `isReadOnly` alone.

## Telemetry ([Telemetry](../017-telemetry/telemetry.md))

Each toured kind has its own tokens, `<Kind>Tour` (`SankeyTour`, `LayerStackTour`, `PyramidTour`, `FunnelTour`, `CycleTour`, `HubTour`, `OnionTour`), named in its registry entry:

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
  `...Outro`.
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
  `layer-stack-tour-steps.ts`, `pyramid-tour-steps.ts`, `funnel-tour-steps.ts`, `cycle-tour-steps.ts`, `hub-tour-steps.ts`, `onion-tour-steps.ts`: each kind's own.
- `apps/live/lib/sankey-tour-focus.ts`: the band or node a step lifts on a Sankey.
- `apps/live/lib/concept-tour-preview.ts`: the animation a step previews on a concept graphic.
