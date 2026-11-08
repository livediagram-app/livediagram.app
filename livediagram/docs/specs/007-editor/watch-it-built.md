# Watch It Built

Status: **approved** (owner, 2026-11-08, Work Tracker #58 "New & Improved Page Tours": direction E, Watch It Built,
picked from six designs; "the Tour offers to show us, and then the cursor moves to build a basic diagram and shows
things like the context menu / toolbar etc in action"). Replaces the six-step [Diagram tour](editor-tour.md#the-steps).

**Watch It Built** is the Diagram tab's tour. A cursor named **Example**, drawn exactly like a collaborator's, builds a
small diagram on the canvas in about half a minute, using the real chrome as it goes: the palette opens, shapes drop
in, the quick-connect ring joins them, a label is typed, the element menu opens and changes a colour, and the selection
toolbar shows above what is selected. A player bar under it has chapters, pause and **Your Turn**. Nothing it builds is
kept: Your Turn hands the canvas back exactly as it was.

## Why

The stepped tour told people where controls were in a row of cards, the look the owner wants gone (#58). Diagramming
is a handful of gestures, and the fastest way to learn a gesture is to see it done. A live cursor is native to a
multiplayer canvas, so the tour also previews working together.

## Domain language

| Term               | Means                                                                                                |
| ------------------ | ---------------------------------------------------------------------------------------------------- |
| **Watch It Built** | This tour. In the interface: **Watch It Built** on the footer button and in Settings' Getting Started category |
| **The replay**     | One run of it, from the press to its end                                                             |
| **Example**        | The replay's cursor and its name chip                                                                |
| **Demo elements**  | What the replay builds: drawn on the canvas, never part of the document                              |
| **A chapter**      | One named part of the replay: **Add**, **Connect**, **Label**, **Style**                             |
| **The player**     | The bar the replay shows under the canvas: pause or play, the chapters, **Your Turn**                |
| **welcome tour**   | Kept only in code identifiers and telemetry tokens, as before                                        |

## Where it appears

- **The footer's Start Tour button offers it**, at the Diagram tour's place and rank (`TOUR_OFFER_RANK.mode`), reading
  **Watch It Built**, under the same rules as every tour ([Diagram tour](editor-tour.md#where-it-appears)): only on a
  Diagram tab, to an Editor, once the editor is ready and the tab's start is done; never in read-only, an embed, a
  locked tab or for a Participant; gone once taken; back from Settings. It never starts or offers itself.
- **Taken** is the synced `tourSeen` preference, kept so nobody who took the stepped tour is offered it again. It is
  written as the replay starts. Settings' Tours row reads **Watch It Built** ("A cursor builds a small diagram so you
  can see how it is done").
- **One tour at a time**, as before. Leaving Diagram mid-replay or switching tab ends it. No dialog can open while it
  runs: the shield takes every press and key but the player's.

## The replay

- **A press starts it at once.** The canvas fades back (the person's elements at a quarter strength), the player appears
  low over the canvas with Example's line in it, and Example sets off. Nothing sits over the toolbar or palette, so
  every press Example makes is in view. The tab's empty-canvas card and tray stay away while the demo fills it. The demo
  is built round the middle of the view, in whatever space is there; the view never pans or zooms.
- **The chapters**, each a few seconds, in order. Each chapter's one short line sits in the player, after **Example**:

  | Chapter | What Example does, with the real chrome                                                                                                               | Example's line                                                |
  | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
  | Add     | Opens the palette's **Shapes** (the real flyout), drags a shape onto the canvas: "Order received" (a start). Then a second step                       | "Pick a shape from the palette and drop it on the canvas."    |
  | Connect | Selects the first shape: its handles and the **selection toolbar** show. Drags from the quick-connect ring onto the second shape: an arrow joins them | "Drag from the ring round a shape onto another to join them." |
  | Label   | Double-clicks the second shape: its label opens for editing and "Check stock" is typed, letter by letter                                              | "Double-click a shape to name it."                            |
  | Style   | Right-clicks it: the real **element menu** opens beside it, Example opens **Style**, then **Presets**, and picks **Success**: the shape turns green   | "Right-click anything for its colours and options."           |

  On a touch screen the words name taps and long-presses ("Tap a shape, then drag from its ring…", "Long-press
  anything…").

- **The chrome is real.** The palette flyout, the selection handles and toolbar, the quick-connect ring and the element
  menu are the editor's own components, shown on the demo elements, so what people see is exactly what they will use.
- **The page waits.** While the replay runs the canvas and chrome take no presses, wheel or keys (the shared tour
  shield), except the player and Escape. Escape ends the replay as skipped.
- **It ends**:
  - **Your Turn** (in the player, and after the last chapter, where the player holds on the finished diagram):
    the demo goes, the canvas comes back to full strength exactly as it was, and the tour is finished.
  - **Escape**, a change of tab or mode, or leaving the page: the same, recorded as skipped.

## The player

- A card centred under the canvas, above the bottom dock: Example's line for the chapter on top, then a round
  **Pause** / **Play** button, the four chapters (each a name over a thin progress line that fills as it plays), and
  **Your Turn** in green.
- **A chapter's name replays it**: pressing it starts that chapter from its beginning, with the demo set to how the
  chapters before it left it.
- After the last chapter the replay holds on the finished diagram, the play button reading **Replay**.
- Keyboard: Space pauses or plays, the left and right arrow keys go to the previous or next chapter, Escape ends.
  The player takes focus when it appears, so these work at once; its buttons have visible focus rings.

## Nothing is kept

The replay never changes the document:

- **Demo elements are never in the document's tabs.** They are drawn on the canvas beside the person's own, so autosave,
  the unload save, the offline copy, undo, export, the minimap's document and every collaborator never see them.
- **Its selection is its own.** Selecting a demo element shows the real handles and toolbar on this screen only; the
  person's selection, and what collaborators see of it, does not change.
- **Writes are refused while it runs.** Any edit that reaches the document while the replay runs is dropped (a second
  guard for an editor component that commits on its own, such as a label on blur).
- **Collaborators carry on.** Their edits arrive and draw as usual under the faded layer, and are there when the
  replay ends. They never see Example.
- **Nothing it presses is counted** as the person's use of a feature in telemetry.

## Motion

- Example moves at a person's pace (about 900 px a second, eased), pauses briefly before each press, and shows a small
  ring where it presses. A drag carries the shape under the cursor, as the real drag does.
- **Reduced motion** (the system's setting or the editor's own Reduce Motion): no gliding. Each chapter shows its end state, with the chrome it used open for a moment, and the
  player steps from chapter to chapter (the play button reads **Next**, then **Done** on the last chapter, which
  finishes the tour as Your Turn does).
- **On a phone** Example is a touch dot (a soft ring) instead of an arrow, and the player is narrower, chapter names
  shortened to fit (Add, Join, Label, Style). While the element menu is open (a sheet up from the bottom on a phone) the
  player moves to the top of the canvas, so the sheet's presets stay in view.

## Telemetry

The Diagram tour's events, kept so its funnel carries on: `UI·Opened·TourOffer` (the button first offering it in a
page load), `UI·Started·Tour` (a press, or a Settings rerun), `UI·View·TourStep<Chapter>` as each chapter starts
(`TourStepAdd`, `TourStepConnect`, `TourStepLabel`, `TourStepStyle`; a chapter press sends its chapter again), and
`UI·Ended·TourCompleted` (Your Turn) or `UI·Ended·TourSkipped`. The dashboard's Tour Steps ranking reads the four
chapters in order ([Telemetry](../017-telemetry/telemetry.md)); the six stepped-tour step tokens stop being sent and
leave the ranking.

## Out of scope

- The Draw and Workshop tours and the element tours keep the stepped engine for now (#58 covers them later).
- The demo cannot be kept as the person's own diagram. It is a demonstration, and the templates are where a diagram
  starts.
