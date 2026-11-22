# Show Me

**Show Me** is a guided tour of one surface, run there and then on the surface itself, when the person presses
the **Show Me** button. It is the on-the-spot cousin of the [Get Started tours](knowledge-tours.md), which
are started from the footer's Get Started button; Show Me is started from its own button on the surface it
teaches, and no tour offers itself. It exists for surfaces where people make something real in
several steps whose ideas are not visible at a glance.

## Domain language

| Term                | Means                                                                      |
| ------------------- | -------------------------------------------------------------------------- |
| **Show Me**         | This pattern, and the button that starts it. In the interface: **Show Me** |
| **Show Me surface** | A surface that carries a Show Me button (the list below)                   |

## Where it lives

| Surface                                                  | Where the button sits                            | Who sees it                                 |
| -------------------------------------------------------- | ------------------------------------------------ | ------------------------------------------- |
| [Share dialog](editor-app.md#share-dialog)               | The dialog's title row (not on the offline gate) | The owner (only the owner can open it)      |
| [Sankey Flows dialog](../009-elements/sankey.md#show-me) | The dialog's title row                           | An Editor (only an Editor opens the dialog) |

A new Show Me surface is added to this table, and its own spec says its steps. The page panel's Show Me went with the
[Pages tour](pages-tour.md), and Tab Style's with the dialog ([Not in liveknowledge](../002-project-scope/not-in-liveknowledge.md)).

## The button

- **Show Me**, with a footprints glyph, drawn like the labelled Help link (`HelpArticleLink` variant
  `labelled`) and placed immediately left of it; a surface with no Help link gains one beside it, linking the
  surface's help article. Order in a title row: Show Me, Help, then the close cross where there is one.
- On a phone the button is the glyph alone (its name kept for assistive tech), so a title row keeps its close
  cross on screen.
- Its hover card, like the Help link's, names it: **Show Me**, "A short tour of this, step by step." (`SHOW_ME_HINT`),
  so the glyph alone below `sm` still says what it does. It stays shut while the tour runs.
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
- **Only what is there.** Steps whose control the surface cannot show right now are left out when the tour starts, so the count
  is right from the first step; a target that still never appears skips its step.
- **Escape belongs to the tour** while it runs over a dialog (the Share dialog, the Sankey's Flows): it never
  closes the surface under it. The surface stops closing on Escape for the duration;
  the tour's own Skip ends it.
- **Ending.** Done ends it as completed, Skip as skipped; closing the surface under it (Cancel, a finished save)
  ends the tour with it and sends no Ended event. Nothing is remembered: Show Me runs again every time it is pressed, and Settings'
  Getting Started does not list it.
- **Layer.** Over a dialog the ring draws just above the dialog and below the menus its controls open, so those
  stay lit (`layer` `modal`); over the editor's own chrome it draws at the overlay layer.

## Share roles

Show Me adds no right of its own: it is shown wherever its surface is, to whoever can use that surface, and
points only at controls that person can use. Each surface's spec names who that is; the table above summarises.

## Telemetry ([Telemetry + public transparency dashboard](../017-telemetry/telemetry.md))

Each surface sends three literal events under its own token `<Surface>Tour`: `UI` · `Started` · `<Surface>Tour`
when the button is pressed, and `UI` · `Ended` · `<Surface>TourCompleted` or `<Surface>TourSkipped`. The tokens:
`ShareTour` and `SankeyFlowsTour` (`SlideTour`, `InfographicTour`, `ArticleTour` and `TabStyleTour` are retired). Each
has its stack (Started, Completed, Skipped) on the telemetry dashboard, and its explanations.

## Code

`apps/editor/components/tour/ShowMe.tsx` holds the button (`ShowMeButton`) and the running tour (`ShowMeStage`);
each surface keeps its steps in `<surface>-tour-steps.ts` and its literal telemetry in `<Surface>Tour.tsx`, so
the dashboard's emitter scan reads every event. The engine scrolls each step's control into view in its scrolling
panel (`revealInScrollers`, `tour-reveal.ts`, [How a tour runs](knowledge-tours.md#how-a-tour-runs)); a step never scrolls itself. A surface whose steps depend on
what is there fixes them when the button is pressed, so they never change mid-tour.
