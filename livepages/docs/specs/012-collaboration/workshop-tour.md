# Workshop tour

A short, optional guided tour of [Workshop mode](workshop-mode.md), offered the first time a person works in
Workshop. It is the [Diagram tour](../007-editor/editor-tour.md)'s sibling, as the
[Plan tour](../026-plan/plan-tour.md) is: the same welcome card, anchored step cards, glide, dimming ring, Skip,
Back and outro card, driven by the same engine. Where this spec is silent, the Plan tour's rules hold.

## Domain language

| Term              | Means                                                                                                  |
| ----------------- | ------------------------------------------------------------------------------------------------------ |
| **Workshop tour** | This tour                                                                                              |
| **Diagram tour**  | The Diagram mode tour ("Getting started with Diagrams?"), [Diagram tour](../007-editor/editor-tour.md) |

## Where it appears

- **The first time a person is in Workshop mode** on a tab they may edit: switching a tab to Workshop,
  opening a document whose tab opens in Workshop, or creating one from a Workshop template (a retro, Blank
  Session). The editor has to be usable, as for the Diagram tour (hydrated, no welcome overlay, not read-only,
  not an embed), and the tab not locked.
- **Not before the synced preferences are in.** The offer does not fire until this person's preferences have
  arrived from the server (or failed to), so an answer given on another device holds on a new one.
- **On its own, whatever other tours the person has seen.** Until October 2026 a newcomer in Workshop was
  offered the welcome tour first, with this tour's offer (**Show me Workshop**) on its closing card. The
  welcome tour is now the Diagram tour and never runs in Workshop, so this tour no longer waits for it: the
  first time someone is in Workshop it offers itself, never at the same time as another tour.
- **Optional.** The offer is the opt-in: **Yes** starts it, **No** declines it.
- **Once ever per person**, through the synced `workshopTourSeen` user preference
  ([User preferences](../007-editor/user-preferences.md)): taken, skipped mid-way or declined, it never offers
  itself again, on any device.
- **Replayable from Settings**: the **Workshop Tour** switch in Settings' **Tours** category
  control, beside **Plan** and built the same way (on means "not seen yet"). Turning it on from off and closing Settings runs the
  tour straight away when the person is in Workshop, or offers it the next time they enter Workshop.

## Tour content

Two session elements, to show what each does: a **Timer** and a **Dot Vote** session button, placed in a
row in the middle of the view at their palette sizes and the tab's colours, with no undo step (`useTourSquare`), and
taken away when the tour ends, however it ends. Nothing reaches the document's history.

## The steps

A welcome card, five steps (four where there is no Share button), then an outro card. The bookend cards sit outside the step count. The palette
itself is the Diagram tour's, so this tour does not repeat it. The exact strings live in `apps/live/components/tour/workshop-tour-steps.ts`.

0. **Getting started with Workshop?** (the offer): centred card with its own illustration (a flipchart with two sticky
   notes and a timer), saying Workshop is for running a session with a team and offering a quick look, then
   **No** and **Yes**.
1. **Collaborate**: rings **Ask** and **Session** on the palette's category bar
   ([Toolbar layout](../007-editor/toolbar-layout.md#the-category-bar)), the session kit: Ask puts a question to
   the room, and Session holds the timers, reveals, records, reactions, selection modes and places to go. It opens
   nothing (the bar's buttons carry the anchors `bar-collab-ask` and `bar-session`).
2. **A Timer for the Room**: places the two session elements (Tour content) and highlights the Timer: it counts down
   for everyone, with pause, reset and more time on it.
3. **Dot Voting**: highlights the Vote: everyone gets dots to put on the notes they back; the counts show when it
   ends.
4. **Run the Room**: highlights the Session strip. Timer and Vote run for everyone on the tab without
   placing anything on the canvas.
5. **Bring People In**: opens the Share dialog and highlights it, closing it again after. A Participant link lets people add notes, vote and
   answer without changing the rest of the board.
6. **You're ready to run a workshop** (outro): a help-centre link to the Workshop mode article (new tab) and
   **Start**, which completes the tour.

- Back from a step goes to the step before. Leaving a step closes what it opened (the category picker).
- A step whose target is missing on this surface (no Share button for this person, a phone layout without it) is
  left out up front, so the count stays honest; one that never appears is skipped, as in the Diagram tour.
- If the tour can no longer run where it started (the person's edit rights go, they leave Workshop, or they
  open another tab) it ends as skipped.

## Share roles

Only someone who may edit the tab is offered the tour: an **Editor**. A **Participant** or a **Viewer** is never
offered it, since most of what it shows (the palette's full categories, the Session strip's set-up, Share) is
not theirs to use.

## Telemetry ([Telemetry](../017-telemetry/telemetry.md))

The Plan tour's funnel, with its own tokens:

- **Offer**: `UI` · `Opened` · `WorkshopTourOffer` when its welcome card shows; `UI` · `Closed` ·
  `WorkshopTourOffer` on No.
- **Start**: `UI` · `Started` · `WorkshopTour`. (`UI` · `Selected` · `WorkshopTourFromWelcome`, sent when the
  welcome tour's closing card started it, is retired with that card's offer and stays explained for the history.)
- **Stage views**: `UI` · `View` · `WorkshopTourStep<Id>` once per step entry (`WorkshopTourStepCollaborate`, `WorkshopTourStepSessionStrip`, `WorkshopTourStepShare`,
  `WorkshopTourStepOutro`).
- **End**: `UI` · `Ended` · `WorkshopTourCompleted` | `WorkshopTourSkipped`.
- **Settings row**: `UI` · `Toggled` · `WorkshopTourSeenOn` | `WorkshopTourSeenOff`.

## Power user mode

[Power user mode](../007-editor/power-user-mode.md) marks the Workshop tour seen alongside the Diagram and Plan
tours.
