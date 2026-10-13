# Facilitate tour

A short, optional guided tour of [Facilitate mode](facilitate-mode.md), offered the first time a person works in
Facilitate. It is the [Diagram tour](../007-editor/editor-tour.md)'s sibling, as the
[Plan tour](../026-plan/plan-tour.md) is: the same welcome card, anchored step cards, glide, dimming ring, Skip,
Back and outro card, driven by the same engine. Where this spec is silent, the Plan tour's rules hold.

## Domain language

| Term                | Means                                                                                                  |
| ------------------- | ------------------------------------------------------------------------------------------------------ |
| **Facilitate tour** | This tour                                                                                              |
| **Diagram tour**    | The Diagram mode tour ("Getting started with Diagrams?"), [Diagram tour](../007-editor/editor-tour.md) |

## Where it appears

- **The first time a person is in Facilitate mode** on a tab they may edit: switching a tab to Facilitate,
  opening a document whose tab opens in Facilitate, or creating one from a Facilitate template (a retro, Blank
  Session). The editor has to be usable, as for the Diagram tour (hydrated, no welcome overlay, not read-only,
  not an embed), and the tab not locked.
- **Not before the synced preferences are in.** The offer does not fire until this person's preferences have
  arrived from the server (or failed to), so an answer given on another device holds on a new one.
- **On its own, whatever other tours the person has seen.** Until October 2026 a newcomer in Facilitate was
  offered the welcome tour first, with this tour's offer (**Show me Facilitate**) on its closing card. The
  welcome tour is now the Diagram tour and never runs in Facilitate, so this tour no longer waits for it: the
  first time someone is in Facilitate it offers itself, never at the same time as another tour.
- **Optional.** The offer is the opt-in: **Yes** starts it, **No** declines it.
- **Once ever per person**, through the synced `facilitateTourSeen` user preference
  ([User preferences](../007-editor/user-preferences.md)): taken, skipped mid-way or declined, it never offers
  itself again, on any device.
- **Replayable from Settings**: the **Facilitate Tour** switch in Settings' **Tours** category
  control, beside **Plan** and built the same way (on means "not seen yet"). Turning it on from off and closing Settings runs the
  tour straight away when the person is in Facilitate, or offers it the next time they enter Facilitate.

## Tour content

None. The tour points at the controls a facilitator uses and places nothing, so there is nothing to take away
and nothing in the document's history.

## The steps

A welcome card, three steps, then an outro card. The bookend cards sit outside the step count. The palette
itself is the Diagram tour's, so this tour does not repeat it. The exact strings live in `apps/live/components/tour/facilitate-tour-steps.ts`.

0. **Welcome to Facilitate** (the offer): centred card with its own illustration (a flipchart with two sticky
   notes and a timer), saying Facilitate is for running a session with a team and offering a quick look, then
   **No** and **Yes**.
1. **Collaborate**: opens the palette's category picker and rings the **Collaborate** band alone, from its
   heading to its last category. Ask, Tools, Record, React, Selection Mode and Navigate hold every element that
   comes alive with the room.
2. **Run the room**: highlights the Session strip. Timer, Vote and Poll run for everyone on the tab without
   placing anything on the canvas.
3. **Bring people in**: highlights the header's Share button. A Participant link lets people add notes, vote and
   answer without changing the rest of the board.
4. **You're ready to facilitate** (outro): a help-centre link to the Facilitate mode article (new tab) and
   **Start facilitating**, which completes the tour.

- Back from a step goes to the step before. Leaving a step closes what it opened (the category picker).
- A step whose target is missing on this surface (no Share button for this person, a phone layout without it) is
  left out up front, so the count stays honest; one that never appears is skipped, as in the Diagram tour.
- If the tour can no longer run where it started (the person's edit rights go, they leave Facilitate, or they
  open another tab) it ends as skipped.

## Share roles

Only someone who may edit the tab is offered the tour: an **Editor**. A **Participant** or a **Viewer** is never
offered it, since most of what it shows (the palette's full categories, the Session strip's set-up, Share) is
not theirs to use.

## Telemetry ([Telemetry](../017-telemetry/telemetry.md))

The Plan tour's funnel, with its own tokens:

- **Offer**: `UI` · `Opened` · `FacilitateTourOffer` when its welcome card shows; `UI` · `Closed` ·
  `FacilitateTourOffer` on No.
- **Start**: `UI` · `Started` · `FacilitateTour`. (`UI` · `Selected` · `FacilitateTourFromWelcome`, sent when the
  welcome tour's closing card started it, is retired with that card's offer and stays explained for the history.)
- **Stage views**: `UI` · `View` · `FacilitateTourStep<Id>` once per step entry (`FacilitateTourStepCollaborate`, `FacilitateTourStepSessionStrip`, `FacilitateTourStepShare`,
  `FacilitateTourStepOutro`).
- **End**: `UI` · `Ended` · `FacilitateTourCompleted` | `FacilitateTourSkipped`.
- **Settings row**: `UI` · `Toggled` · `FacilitateTourSeenOn` | `FacilitateTourSeenOff`.

## Power user mode

[Power user mode](../007-editor/power-user-mode.md) marks the Facilitate tour seen alongside the Diagram and Plan
tours.
