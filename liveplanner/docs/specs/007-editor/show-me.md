# Show Me

**Show Me** is a guided tour of one surface, run there and then on the surface itself, when the person presses
the **Show Me** button. It is the on-demand cousin of the tours that offer themselves once (the
[Plan tour](../026-plan/plan-tour.md) and the Forms tour); Show Me never offers itself. It exists for surfaces where people make something real in
several steps whose ideas are not visible at a glance, and where a tour that offered itself would come at the
wrong moment. 
## Domain language

| Term                | Means                                                                            |
| ------------------- | -------------------------------------------------------------------------------- |
| **Show Me**         | This pattern, and the button that starts it. In the interface: **Show Me**       |
| **Show Me surface** | A surface that carries a Show Me button (the list below)                         |
| **mode tour**       | A tour that offers itself once (the Plan tour, the Forms tour); not this          |

## Where it lives

| Surface                                                             | Where the button sits                            | Who sees it                                  |
| ------------------------------------------------------------------- | ------------------------------------------------ | -------------------------------------------- |
| [Card type editor](../026-plan/item-types.md#editing-a-type)        | The editor's title row                           | Whoever can open the editor (an Editor)      |
| [Share dialog](editor-app.md#share-dialog)                            | The dialog's title row (not on the offline gate) | The owner (only the owner can open it)       |
| [Dashboard Settings](../026-plan/plan-tabs.md#dashboard-settings)   | The settings panel's title row                   | An Editor (only an Editor sees the settings) |
| [Sankey Flows dialog](../009-elements/sankey.md#show-me)            | The dialog's title row                           | An Editor (only an Editor opens the dialog)  |

A new Show Me surface is added to this table, and its own spec says its steps.

## The button

- **Show Me**, with a footprints glyph, drawn like the labelled Help link (`HelpArticleLink` variant
  `labelled`) and placed immediately left of it; a surface with no Help link gains one beside it, linking the
  surface's help article. Order in a title row: Show Me, Help, then the close cross where there is one.
- On a phone the button is the glyph alone (its name kept for assistive tech), so a title row keeps its close
  cross on screen.
- `aria-pressed` while its tour runs; pressing it again then does nothing.
- A surface whose steps load at the press ignores further presses until they arrive; if they fail to load (a
  dropped connection) nothing starts and the button can be pressed again.
- It is never pressed for the person, never pulses and never badges: nothing invites it beyond its label.

## The tour

- The shared tour (the step card with Back, Next and Skip, the ring around what it points at with room to
  breathe, the dim around it). It starts straight on its first step: no welcome card. Steps count from 1, and
  a closing card ends it, with **Done** and a link to the surface's help article ("<Topic> Help").
- **Live controls.** Each step points at a real control, which stays usable while the step is up: the person
  can type, pick or press as the tour goes, and what they do is kept. A step never changes anything on its own
  beyond opening the tab, section or selection it is about.
- **Only what is there.** Steps whose control the surface cannot show right now (a second tab's picker on a
  one-tab project, a box on a photo where nothing was found) are left out when the tour starts, so the count
  is right from the first step; a target that still never appears skips its step.
- **Escape belongs to the tour** while it runs over a dialog or an overlay (the card type editor, the Share dialog):
  it never closes the surface under it. The surface stops closing on Escape for the duration; the tour's own Skip
  ends it. A tour on the page itself (a dashboard) leaves Escape to the page.
- **Ending.** Done ends it as completed, Skip as skipped; closing the surface under it (Cancel, a finished save)
  ends the tour with it and sends no Ended event. So does losing it while it stays mounted: a dashboard covered by
  a maximised slot or no longer editable, a page deleted, locked or no longer editable; whatever a step was showing
  (a slot's grip and cog) is put back. Nothing is remembered: Show Me runs again every time it is pressed, and Settings' Show Tours does not list it.
- **Layer.** Over a dialog the ring draws just above the dialog and below the menus its controls open, so those
  stay lit (`layer` `modal`); over the editor's own chrome it draws at the overlay layer.

## Share roles

Show Me adds no right of its own: it is shown wherever its surface is, to whoever can use that surface, and
points only at controls that person can use. Each surface's spec names who that is; the table above summarises.

## Telemetry ([Telemetry + public transparency dashboard](../017-telemetry/telemetry.md))

Each surface sends three literal events under its own token `<Surface>Tour`: `UI` · `Started` · `<Surface>Tour`
when the button is pressed, and `UI` · `Ended` · `<Surface>TourCompleted` or `<Surface>TourSkipped`. The tokens:
`CardTypeTour`, `ShareTour`, `DashboardTour`, `SankeyFlowsTour` (with the Sankey element's code, which no Plan tab places). Each has its stack (Started,
Completed, Skipped) on the telemetry dashboard beside the card type tour's, and its explanations.

## Code

`apps/editor/components/tour/ShowMe.tsx` holds the button (`ShowMeButton`) and the running tour (`ShowMeStage`);
each surface keeps its steps in `<surface>-tour-steps.ts` and its literal telemetry in `<Surface>Tour.tsx`, so
the dashboard's emitter scan reads every event. The engine scrolls each step's control into view in its scrolling
panel (`revealInScrollers`, `tour-reveal.ts`, [Mechanics](editor-tour.md#mechanics)); a step never scrolls itself. A surface whose steps depend on what is there (a second tab, an empty slot, a box found) fixes
them when the button is pressed, so they never change mid-tour.
