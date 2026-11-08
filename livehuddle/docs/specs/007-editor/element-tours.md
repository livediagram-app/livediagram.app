# Element tours

An **element tour** teaches one complex element type, on the element itself: what its parts mean, how to read it and
how to change it. It is started from the footer's Start Tour button while an element of that type is selected, and it
walks through the real element the person selected, not a sample.

It sits beside the [Avatar tour](../008-canvas/avatar-tour.md) and [Show Me](show-me.md) (started from a
button on one surface). Like every tour it never offers itself: the one way in is the Start Tour button
([Tours](editor-tour.md#where-it-appears)).

The toured kind: the [portal](../009-elements/portal-element.md). livediagram's tours of the elements livehuddle does
not offer went with them: the Sankey, the other concept graphics, the mind map, flowchart, org chart, sequence diagram
and entity first, then the Timeline, the data charts, the stack, the lane, the boundary and the diagram key (Work
Tracker #514, with the diagram tools, [Not in livehuddle](../002-project-scope/not-in-livehuddle.md)). A stored answer
naming one of those kinds stays in `elementTourKinds`, unread.

## Domain language

| Term                  | Means                                                                                        |
| --------------------- | -------------------------------------------------------------------------------------------- |
| **Element tour**      | This pattern, and one tour of it (the **Portal tour**)                                       |
| **Start Tour button** | The footer button that starts every tour ([Tours](editor-tour.md#where-it-appears))          |
| **Toured kind**       | An element type that has an element tour (`portal`)                                          |
| **Selection toolbar** | The floating toolbar over a single selection ([Canvas](../008-canvas/canvas-and-palette.md)) |

## Naming

On the Start Tour button an element tour is named from its closing card's eyebrow, in title case, without the word
"tour": **Start Portal Tour** (`tourNameOf`). Its Settings
section is still called **Show Me**. "Element tour" is the code's and the specs' word only.

## On the Start Tour button

- **Most specific first.** While a toured element is selected its tour is the one the button offers, ahead of a tool
  in hand and the Avatar tour (`TOUR_OFFER_RANK.element`).
- **When it is on offer**, all of these hold:
  - exactly one element is selected, of a toured kind;
  - the person may edit it (an Editor);
  - the editor is usable: hydrated, no welcome overlay, no start panel open, not an embed, not on a phone (narrower
    than 640px, or a phone held sideways: `useIsMobileViewport`).
- **Gone once taken, back from Settings.** Starting an element's tour takes that kind off the button
  ([Tours](editor-tour.md#where-it-appears)): selecting another element of the kind offers the Avatar tour
  instead, if one is owed, or no button. Its switch in Settings' **Show Me** section (below) puts it back.
- **A press** starts the tour on its first step, on the selected element. A press while another tour is on screen
  does nothing. Deselecting the element takes its tour off the button.

## Remembering runs

- A synced user preference, `elementTourKinds`, lists the toured kinds whose tour has been started, so the record
  follows the account ([User preferences](user-preferences.md)). Until 25 October 2026 it listed the kinds whose
  offer had been answered (Play or Cancel) and hid the offer for them; from then until 1 November 2026 it only fed
  the Settings rows. Now it hides that kind's tour from the Start Tour button again, until its switch is turned on.
- `elementToursSeen` counts every kind as taken. Nothing writes it `true` now: the switch over them all, **Show Me on
  Every Element**, wrote it (with every kind listed) until 8 November 2026, when it went because the Portal is the
  only toured kind, and so did the retired [Power user mode](power-user-mode.md)'s preset, which listed none. A stored
  `true` still counts, so the Portal switch reads off for anyone who set it. Turning a kind's switch back on lifts it,
  keeping every other kind answered.

## Settings

Settings' **Getting Started** category holds element tours in their own section, **Show Me**, below the Avatar tour's
**Offer Again** section. It is a closed accordion (people rarely look for it): its header names the section and
how many are on (`1 of 1 On`). Opened, it shows the section's line, then one switch per toured kind, named for the
element alone: **Portal**, linking the Portals article. There is no switch over them all while the Portal is the
only toured kind (a second kind brings one back, nesting the kinds' switches under it).
On means "not yet taken": switching one on forgets its run and puts that kind's tour back on the Start Tour button
whenever such an element is selected; off takes it off the button. The accordion opens on its own when Settings is
opened on one of its rows (a search result) or on the section.

## Menu steps

A step whose copy names a part of the element's own menu ("More, then Tools › Portal…") opens that menu on the element (`openElementMenu`, as a right-click does), opens each row of its path in
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
- **The steps are fixed when the button is pressed**, from the element as it is then: a step for a state it is not
  in (Step Through on an unlinked portal) is left out, so the count is right from the first step.
- **Live.** What a step rings stays usable, and what the person does is kept.
- **Ending.** Done ends it as completed, Skip as skipped. It ends as skipped, with nothing remembered beyond the
  run being recorded, when the element goes (deleted, or no longer editable), or the person opens another tab.

## The Portal tour

On a selected portal, from `portal-tour-steps.ts`. The portal is edited mostly from its own section of the element
menu (More, then **Tools**), so the tour keeps that step for everyone: "More" while More shows, and otherwise
"Right-click it".

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
| Editor      | On offer, on an element of a toured kind                                                        |
| Participant | Never on offer: an element tour teaches editing the element, which is not a Participant's to do |
| Viewer      | Never on offer                                                                                  |

The gate is the toured kind's own edit check on the session's `can` (for a portal, an Editor, since its link
is an Editor's), never `isReadOnly` alone.

## Telemetry ([Telemetry](../017-telemetry/telemetry.md))

Each toured kind has its own tokens, `<Kind>Tour` (`PortalTour`), named in its registry entry. The tokens of the
tours that went (`TimelineTour`, `ChartTour`, `StackTour`, `LaneTour`, `BoundaryTour`, `DiagramKeyTour`, and
livediagram's `SankeyTour`, `LayerStackTour`, `MindMapTour`, `EntityTour` and the rest) are not sent by livehuddle and
stay explained for the shared dashboard's history:

- **Offer**: `UI` · `Opened` · `<Kind>TourOffer` the first time the Start Tour button shows that kind's tour in a
  page load. Until 25 October 2026 it counted the offer toolbar showing, and `UI` · `Closed` · `<Kind>TourOffer`
  counted **Cancel**; nothing sends Closed now, and its explanation stays for the history.
- **Start**: `UI` · `Started` · `<Kind>Tour` on a press of the button.
- **Stage views**: `UI` · `View` · `<Kind>TourStep<Id>` once per step entry: the Portal's `PortalTourStepPortal`,
  `...Travel`, `...Unlinked`, `...Menu`, `...Walk` and `...Outro`.
- **End**: `UI` · `Ended` · `<Kind>TourCompleted` | `<Kind>TourSkipped`.
- **Settings row**: `UI` · `Toggled` · `<Kind>TourSeenOn` | `<Kind>TourSeenOff`. The switch over them all sent
  `ElementToursSeenOn` | `ElementToursSeenOff` until it went on 8 November 2026; their explanations stay for the
  history.

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
- `apps/editor/components/tour/element-tour-parts.ts`: the steps every tour is built from (a step on the element, a
  menu step, the closing card); `menu-tour-step.ts`: the menu step's words.
- `apps/editor/components/tour/portal-tour-steps.ts`: the Portal tour's steps.
