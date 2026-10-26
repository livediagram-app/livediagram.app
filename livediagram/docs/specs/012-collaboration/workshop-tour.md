# Workshop tour ("Start Workshop Tour")

A short, optional guided tour of [Workshop mode](workshop-mode.md), started from the footer's **Start Workshop Tour**
button. It is the [Diagram tour](../007-editor/editor-tour.md)'s sibling, as the
[Draw tour](../023-draw-mode/draw-tour.md) is: the same Start Tour button, anchored step cards, glide, dimming ring,
Skip, Back and closing card, driven by the same engine. Where this spec is silent, the Diagram tour's rules hold.

## Domain language

| Term              | Means                                                                                      |
| ----------------- | ------------------------------------------------------------------------------------------ |
| **Workshop tour** | This tour. On the Start Tour button: **Start Workshop Tour**                               |
| **Diagram tour**  | The Diagram mode tour ("Start Diagram Tour"), [Diagram tour](../007-editor/editor-tour.md) |

## Where it appears

- **On the Start Tour button, in Workshop mode.** The footer's button, left of Search
  ([Diagram tour](../007-editor/editor-tour.md) "Where it appears"), reads **Start Workshop Tour** while the open tab
  is in Workshop on a tab the person may edit, unless something more specific is on offer (a selected element's own
  tour). The editor has to be usable, as for the Diagram tour (hydrated, no welcome overlay, no start on screen, not
  read-only, not an embed), and the tab not locked.
- **Never on its own.** The tour does not offer or start itself. Until 25 October 2026 it offered itself, once ever,
  the first time a person was in Workshop ("Getting started with Workshop?", **No** / **Yes**); the button replaced
  that offer.
- **It stays on offer once taken.** Taken or skipped, the button still offers it; pressing again reruns it. A press
  starts the first step; a press while another tour is on screen does nothing.
- **Taken, on every device.** However a run ends, the synced `workshopTourSeen` user preference
  ([User preferences](../007-editor/user-preferences.md)) records it, for Settings' row only: it no longer hides the
  button.
- **Rerun from Settings**: the **Workshop Tour** switch in Settings' **Tours** category, beside **Diagram Tour** and
  built the same way (on means "not seen yet"). Turning it on from off and closing Settings runs the tour straight
  away when the person is in Workshop and it is on offer; otherwise the button is there when they get there.

## Tour content

Three session elements, to show what each does: a **Timer**, a **Dot Vote** and a **Poll** session button, placed in a
row in the middle of the view at their palette sizes and the tab's colours, with no undo step (`useTourSquare`), and
taken away when the tour ends, however it ends. Nothing reaches the document's history.

## The steps

Six steps, then an outro card, which sits outside the step count. There is no welcome card: a press of the button
starts the first step. The palette
itself is the Diagram tour's, so this tour does not repeat it. The exact strings live in `apps/editor/components/tour/workshop-tour-steps.ts`.

1. **Collaborate**: rings **Ask** and **Session** on the palette's category bar
   ([Toolbar layout](../007-editor/toolbar-layout.md#the-category-bar)), the session kit: Ask puts a question to
   the room, and Session holds the timers, reveals, records, reactions, selection modes and places to go. It opens
   nothing (the bar's buttons carry the anchors `bar-collab-ask` and `bar-session`).
2. **A Timer for the Room**: places the three session elements (Tour content) and highlights the Timer: it counts down
   for everyone, with pause, reset and more time on it.
3. **Dot Voting**: highlights the Vote: everyone gets dots to put on the notes they back; the counts show when it
   ends.
4. **A Live Poll**: highlights the Poll: a question to the room, answered live, as yes or no, choices, a rating or
   open.
5. **Run the Room**: highlights the Session strip. Timer, Vote and Poll run for everyone on the tab without
   placing anything on the canvas.
6. **Bring People In**: opens the Share dialog and highlights it, closing it again after. A Participant link lets people add notes, vote and
   answer without changing the rest of the board.
7. **You're ready to run a workshop** (outro): a help-centre link to the Workshop mode article (new tab) and
   **Start**, which completes the tour.

- Back from a step goes to the step before. Leaving a step closes what it opened (the category picker).
- A step whose target is missing on this surface (no Share button for this person, a phone layout without it) is
  left out up front, so the count stays honest; one that never appears is skipped, as in the Diagram tour.
- If the tour can no longer run where it started (the person's edit rights go, they leave Workshop, or they
  open another tab) it ends as skipped.

## Share roles

Only someone who may edit the tab sees the button for this tour: an **Editor**. A **Participant** or a **Viewer**
never does, since most of what it shows (the palette's full categories, the Session strip's set-up, Share) is
not theirs to use.

## Telemetry ([Telemetry](../017-telemetry/telemetry.md))

The Diagram tour's funnel, with its own tokens:

- **Offer**: `UI` · `Opened` · `WorkshopTourOffer` the first time the Start Tour button shows this tour in a page
  load. Until 25 October 2026 it counted the welcome card showing, and `UI` · `Closed` · `WorkshopTourOffer` counted
  **No**; nothing sends Closed now, and its explanation stays for the history.
- **Start**: `UI` · `Started` · `WorkshopTour` on a press of the button (or the Settings rerun). (`UI` · `Selected` · `WorkshopTourFromWelcome`, sent when the
  welcome tour's closing card started it, is retired with that card's offer and stays explained for the history.)
- **Stage views**: `UI` · `View` · `WorkshopTourStep<Id>` once per step entry (`WorkshopTourStepCollaborate`, `WorkshopTourStepSessionStrip`, `WorkshopTourStepShare`,
  `WorkshopTourStepOutro`).
- **End**: `UI` · `Ended` · `WorkshopTourCompleted` | `WorkshopTourSkipped`.
- **Settings row**: `UI` · `Toggled` · `WorkshopTourSeenOn` | `WorkshopTourSeenOff`.

## Power user mode

[Power user mode](../007-editor/power-user-mode.md) marks the Workshop tour seen alongside the Diagram, Draw and Avatar
tours.
