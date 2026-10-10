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
- **On the welcome tour's closing card, not after it.** Someone in Facilitate who has not done the welcome
  tour (`tourSeen` not set) and not answered this one is offered the **welcome tour first**, even when nothing
  else owed it to them (a Blank Session link skips the `/new` handoff). Its closing card, **You're ready to go**,
  then carries this tour's offer: **Show me Facilitate** (the primary button) starts it straight at its first
  step, with no welcome card of its own, and the welcome tour's **Start creating** beside it declines it.
  However the welcome tour ends there (finished, skipped or declined), this tour counts as answered, so no
  second card pops up afterwards.
- **Its own welcome card** is for someone who did the welcome tour before: the first time they are in
  Facilitate it offers itself, never at the same time as another tour.
- **Optional.** The offer is the opt-in: **Show me around** (or **Show me Facilitate**) starts it, **No
  thanks** (or **Start creating**) declines it.
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

A welcome card (left out when the welcome tour's closing card started it), three steps, then an outro card.
The bookend cards sit outside the step count. The palette itself is the welcome tour's, so this tour does not
repeat it. The exact strings live in `apps/live/components/tour/facilitate-tour-steps.ts`.

0. **Welcome to Facilitate** (the offer): centred card with its own illustration (a flipchart with two sticky
   notes and a timer), saying Facilitate is for running a session with a team and offering a quick look, then
   **No thanks** and **Show me around**.
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
  left out up front, so the count stays honest; one that never appears is skipped, as in the welcome tour.
- If the tour can no longer run where it started (the person's edit rights go, they leave Facilitate, or they
  open another tab) it ends as skipped.

## Share roles

Only someone who may edit the tab is offered the tour: an **Editor**. A **Participant** or a **Viewer** is never
offered it, since most of what it shows (the palette's full categories, the Session strip's set-up, Share) is
not theirs to use.

## Telemetry ([Telemetry](../017-telemetry/telemetry.md))

The Plan tour's funnel, with its own tokens:

- **Offer**: `UI` · `Opened` · `FacilitateTourOffer` when its welcome card shows, or the welcome tour's closing
  card shows with Show me Facilitate; `UI` · `Closed` · `FacilitateTourOffer` on No thanks, or on finishing the
  welcome tour without it.
- **Start**: `UI` · `Started` · `FacilitateTour`; from the welcome tour's closing card, `UI` · `Selected` ·
  `FacilitateTourFromWelcome` too.
- **Stage views**: `UI` · `View` · `FacilitateTourStep<Id>` once per step entry (`FacilitateTourStepCollaborate`, `FacilitateTourStepSessionStrip`, `FacilitateTourStepShare`,
  `FacilitateTourStepOutro`).
- **End**: `UI` · `Ended` · `FacilitateTourCompleted` | `FacilitateTourSkipped`.
- **Settings row**: `UI` · `Toggled` · `FacilitateTourSeenOn` | `FacilitateTourSeenOff`.

## Power user mode

[Power user mode](../007-editor/power-user-mode.md) marks the Facilitate tour seen alongside the welcome and Plan
tours.
