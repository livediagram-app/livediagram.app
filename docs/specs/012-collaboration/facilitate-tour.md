# Facilitate tour

A short, optional guided tour of [Facilitate mode](facilitate-mode.md), offered the first time a person works in
Facilitate. It is the [welcome tour](../007-editor/editor-tour.md)'s sibling, as the
[Plan tour](../026-plan/plan-tour.md) is: the same welcome card, anchored step cards, glide, dimming ring, Skip,
Back and outro card, driven by the same engine. Where this spec is silent, the Plan tour's rules hold.

## Domain language

| Term                | Means                                                                                       |
| ------------------- | ------------------------------------------------------------------------------------------- |
| **Facilitate tour** | This tour                                                                                   |
| **welcome tour**    | The editor tour ("Show me around"), [Interactive editor tour](../007-editor/editor-tour.md) |

## Where it appears

- **The first time a person is in Facilitate mode** on a tab they may edit: switching a tab to Facilitate,
  opening a document whose tab opens in Facilitate, or creating one from a Facilitate template (a retro, Blank
  Session). The editor has to be usable, as for the welcome tour (hydrated, no welcome overlay, not read-only,
  not an embed), and the tab not locked.
- **After the welcome tour, never with it.** A person who has not done the welcome tour yet is offered it
  first; while it is on screen, or its offer is still owed, the Facilitate tour waits, and is offered as soon as
  the welcome tour ends (taken, skipped or declined) if the person is still in Facilitate. It never runs at
  the same time as the Plan tour either: one tour at a time.
- **Optional.** The offer is the opt-in: **Show me around** starts it, **No thanks** declines it, with equal
  weight.
- **Once ever per person**, through the synced `facilitateTourSeen` user preference
  ([User preferences](../007-editor/user-preferences.md)): taken, skipped mid-way or declined, it never offers
  itself again, on any device.
- **Replayable from Settings**: the Accessibility category's **Show Facilitate Tour** row, under **Show Plan
  Tour** and built the same way (on means "not seen yet"). Turning it on from off and closing Settings runs the
  tour straight away when the person is in Facilitate, or offers it the next time they enter Facilitate.

## Tour content

None. The tour points at the controls a facilitator uses and places nothing, so there is nothing to take away
and nothing in the document's history.

## The steps

A welcome card, five steps, then an outro card. The bookend cards sit outside the step count. The exact strings
live in `apps/live/components/tour/facilitate-tour-steps.ts`.

0. **Welcome to Facilitate** (the offer): centred card with its own illustration (a flipchart with two sticky
   notes and a timer), saying Facilitate is for running a session with a team and offering a quick look, then
   **No thanks** and **Show me around**.
1. **Your session kit**: highlights the palette strip. Popular holds what a session is run with: sticky notes,
   the timer, vote and poll buttons, a reveal zone, an agenda, an idea box and more.
2. **Collaborate**: opens the palette's category picker. Under Collaborate, Ask, Tools, Record, React,
   Selection Mode and Navigate hold every element that comes alive with the room.
3. **Run the room**: highlights the Session strip. Timer, Vote and Poll run for everyone on the tab without
   placing anything on the canvas.
4. **Bring people in**: highlights the header's Share button. A Participant link lets people add notes, vote and
   answer without changing the rest of the board.
5. **Switch modes**: highlights the mode switch. The mode is the tab's, so everyone on it follows; Diagram is a
   click away when the session is done.
6. **You're ready to facilitate** (outro): a help-centre link to the Facilitate mode article (new tab) and
   **Start facilitating**, which completes the tour.

- Back from a step goes to the step before. Leaving a step closes what it opened (the category picker).
- A step whose target is missing on this surface (no Share button for this person, a phone layout without it) is
  left out up front, so the count stays honest; one that never appears is skipped, as in the welcome tour.
- If the tour can no longer run where it started (the person's edit rights go, they leave Facilitate, or they
  open another tab) it ends as skipped.

## Share roles

Only someone who may edit the tab is offered the tour: an **Editor**. A **Participant** or a **Viewer** is never
offered it, since most of what it shows (the palette's full categories, the Session strip's set-up, Share) is
not theirs to use.

## Telemetry ([Telemetry](../017-telemetry/telemetry.md))

The Plan tour's funnel, with its own tokens:

- **Offer**: `UI` · `Opened` · `FacilitateTourOffer` when the welcome card shows; `UI` · `Closed` ·
  `FacilitateTourOffer` on No thanks.
- **Start**: `UI` · `Started` · `FacilitateTour`.
- **Stage views**: `UI` · `View` · `FacilitateTourStep<Id>` once per step entry (`FacilitateTourStepKit`,
  `FacilitateTourStepCollaborate`, `FacilitateTourStepSessionStrip`, `FacilitateTourStepShare`,
  `FacilitateTourStepModes`, `FacilitateTourStepOutro`).
- **End**: `UI` · `Ended` · `FacilitateTourCompleted` | `FacilitateTourSkipped`.
- **Settings row**: `UI` · `Toggled` · `FacilitateTourSeenOn` | `FacilitateTourSeenOff`.

## Power user mode

[Power user mode](../007-editor/power-user-mode.md) marks the Facilitate tour seen alongside the welcome and Plan
tours.
