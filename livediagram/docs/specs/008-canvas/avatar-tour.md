# Avatar tour ("Start Avatar Tour")

A short, optional guided tour of [Avatar mode](avatar-mode.md), started from the footer's **Start Avatar Tour**
button. It is the [Draw tour](../023-draw-mode/draw-tour.md)'s sibling: the same Start Tour button, anchored step
cards, glide, dimming ring, Skip, Back and closing card, driven by the same engine. Where this spec is silent, the
Draw tour's rules hold.

## Domain language

| Term              | Means                                                                             |
| ----------------- | --------------------------------------------------------------------------------- |
| **Avatar tour**   | This tour. On the Start Tour button: **Start Avatar Tour**                        |
| **Avatar button** | The bottom-bar button that opens the Avatar panel ([Avatar mode](avatar-mode.md)) |
| **Avatar panel**  | The character sheet, a popover over the Avatar button                             |

## Where it appears

- **On the Start Tour button, in Avatar mode**, which a person enters by pressing a
  [Selection Mode button](../009-elements/mode-button.md) set to Avatar. The footer's button, left of Settings
  ([Diagram tour](../007-editor/editor-tour.md) "Where it appears"), reads **Start Avatar Tour** while the avatar is
  the tool in hand: ahead of the tab's mode tour, behind a selected element's own tour (`TOUR_OFFER_RANK.tool`). The
  editor has to be usable (hydrated, no welcome overlay, no start panel on screen, not an embed). Unlike the Draw tour
  it is on offer **whatever the person's role**: the mode is a Viewer's as much as an Editor's, and a read-only
  canvas is the mode's normal state, not a reason to hold off.
- **Never on its own.** Until 25 October 2026 it offered itself, once ever, the first time a person walked as an
  avatar ("Meet Your Avatar", **No** / **Yes**); the button replaced that offer.
- **It stays on offer once taken.** Pressing the button again reruns it; a press while another tour is on screen
  does nothing. A press starts the first step.
- **Taken, on every device.** However a run ends, the synced `avatarTourSeen` user preference
  ([User preferences](../007-editor/user-preferences.md)) records it, for Settings' row only.
- **Rerun from Settings**: the **Avatar Tour** switch in Settings' **Tours** category, beside **Draw**, built the
  same way (on means "not seen yet"). Turning it on from off and closing Settings runs the tour straight away when
  the person is in Avatar mode and it is on offer; otherwise the button is there when they get there.

## Tour content

None. The tour opens the Avatar panel to show it and, at the end or on a Skip, leaves it as it found it: closed if
the tour opened it, open again if the person had it open (the push step closes it to show the canvas); it changes no costume, plays no reaction,
sends no message and pushes nobody. There is nothing to take away and nothing in the document's history.

## The steps

Five steps, then an outro card, which sits outside the step count. There is no welcome card. Each step rings an
element by its `data-tour-id`. The exact strings live in `apps/editor/components/tour/avatar-tour-steps.ts`.

1. **Your Avatar**: rings the Avatar button (`avatar-button`). The character sheet and everything your character
   can do live here.
2. **Make It Yours**: opens the Avatar panel if it is closed and rings its character section (`avatar-character`):
   gender, clothing, hair and size, the dice for a whole new look, and a [status](avatar-mode.md#status) so people
   know whether you are free; on a desktop, that right-clicking your character swaps its gender. The shirt is always
   your colour, so people know which character is you.
3. **Behaviour and Reactions**: rings the panel's action rows (`avatar-actions`). Jumping jacks, a wave, a spin,
   a cheer or a dance, and confetti, hearts and more thrown around you.
4. **Say Something**: rings the panel's Send a Message button (`avatar-message`). Press Enter to type above your
   head (on a desktop), or use this button; the bubble floats up for everyone, up to 50 words. **Left out for a
   Viewer**, who may not speak, up front so the count stays honest.
5. **Give Someone a Push**: closes the panel and rings your own character (`avatar-self`). Click someone else's
   character to walk over and give them a playful push; arrow keys walk, Space hops.
6. **You're Ready to Roam** (outro): a help-centre link to the Avatar mode article (new tab) and **Start**,
   which completes the tour.

- A step whose target never appears is skipped, as in the Draw tour.
- Step 2 opens the panel the way a person would (pressing the Avatar button); step 5 closes it so the character is
  in view. Back from step 5 opens it again. Leaving the tour (Skip, the outro) closes it if the tour opened it.
- If the tour can no longer run where it started (the person leaves Avatar mode, or opens another tab) it ends as
  skipped.

## Phone

The same steps; step 4's body names the button only (a phone has no Enter key), and the cards sit above the
bottom bar as the other tours' do.

## Share roles

- **Editor** and **Participant**: every step.
- **Viewer**: every step but **Say Something**.

## Telemetry ([Telemetry](../017-telemetry/telemetry.md))

The Draw tour's funnel, with its own tokens:

- **Offer**: `UI` · `Opened` · `AvatarTourOffer` the first time the Start Tour button shows this tour in a page
  load. Until 25 October 2026 it counted the welcome card showing, and `UI` · `Closed` · `AvatarTourOffer` counted
  **No**; nothing sends Closed now.
- **Start**: `UI` · `Started` · `AvatarTour` on a press of the button (or the Settings rerun).
- **Stage views**: `UI` · `View` · `AvatarTourStep<Id>` once per step entry (`AvatarTourStepAvatarButton`,
  `AvatarTourStepCharacter`, `AvatarTourStepActions`, `AvatarTourStepMessage`, `AvatarTourStepPush`,
  `AvatarTourStepOutro`).
- **End**: `UI` · `Ended` · `AvatarTourCompleted` | `AvatarTourSkipped`.
- **Settings row**: `UI` · `Toggled` · `AvatarTourSeenOn` | `AvatarTourSeenOff`.

## Power user mode

[Power user mode](../007-editor/power-user-mode.md) marks the Avatar tour seen alongside the Diagram,
Workshop and Draw tours.
