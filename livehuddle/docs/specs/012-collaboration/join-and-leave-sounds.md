# Join and leave sounds

A soft chime when another person arrives in the Space you have open, and a softer one when someone leaves, so you can
sit at your desk with the Space on another browser tab and still hear when somebody comes in to speak to you.

> "I want a sound effect when somebody joins or leaves a space. So if I sit at my desk on another browser tab, I can
> hear when somebody comes in to speak to me" (the owner, 2026-11-09)

## What you hear

- **Arrival**: a soft rising two-note chime (G5 then C6) when another person joins the Space's room.
- **Leaving**: a softer falling two-note chime (C6 then G5), quieter than the arrival, when another person has left.
- Both are drawn on your screen with Web Audio, like the Timer's chime and the reception bell
  ([Timer and Stopwatch](../009-elements/timer-and-stopwatch.md#the-chime)): no audio file, nothing sent for the
  sound itself, about two thirds of a second long at a low volume.

## When it plays

- **A person** is everyone the room lists but you: by their collaboration key (the per-browser id in their hello,
  [Participant responses](participant-responses.md)), or their presence id when they sent none. Two tabs of the same
  browser are one person: the second tab arriving, or one of the two closing, plays nothing.
- **Never for yourself**: your own key is left out, so your second tab of the same Space is silent too. Agents
  ([Agent presence](../024-agents/agent-presence.md)) are never people here, so an agent arriving plays nothing.
- **Not on your own arrival**: the first roster the room sends after you open the Space only learns who is already
  there. Reconnecting your own socket does not learn again: the people already known stay known, so nobody is
  greeted twice.
- **A reconnect is not a leave**: someone who drops off the roster plays the leave chime only if they are still gone
  5 seconds later (`JOIN_LEAVE_FLAP_MS`). Back inside that window (a network blip, a reload), nothing plays at all.
- **A burst plays once**: after one chime of a kind, more of the same kind inside 1 second (`JOIN_LEAVE_BURST_MS`)
  play nothing, so a team arriving together for a meeting is one chime, not five. An arrival plays at once (no waiting
  for the burst to end), so it is heard as the person lands.
- **In a background tab**: the point of it. The tab keeps its room open while hidden, and the chime is played from the
  room's message, not from a frame, so it sounds while you work in another tab.

## Unlocking sound

Browsers keep a page silent until the person has pressed something on it. The editor creates its one `AudioContext`
lazily and resumes it on your first press or key in the tab (`pointerdown` or `keydown`), after which the tab may play
sound even while hidden. A tab opened and never touched stays silent; nothing asks for permission and nothing is
shown about it.

## Settings

- **Join and Leave Sounds** (Settings, Account › Notifications, In the Editor; `joinLeaveSounds`, missing means on).
  A synced preference like every other ([User preferences](../007-editor/user-preferences.md)), so it follows you
  across devices. Off, neither chime plays; nothing else changes.
- **Do Not Disturb** ([Meeting rooms and the stage](meeting-rooms-and-stage.md#do-not-disturb-part-3-built)) quiets
  both chimes while it is your status, as it quiets knocks and the reception bell.

## Share roles

| Act                        | Editor | Participant | Viewer |
| -------------------------- | ------ | ----------- | ------ |
| Hear someone arrive or go  | Yes    | Yes         | Yes    |
| Be heard arriving or going | Yes    | Yes         | Yes    |
| Turn Join and Leave Sounds | Yes    | Yes         | Yes    |

Presence is everyone's ([Share roles](../013-workspace/share-roles.md)): the chime is a reading of the roster every
session already receives, so no `can` gates it; the setting is the listener's own.

## Telemetry ([Telemetry](../017-telemetry/telemetry.md))

The Settings switch fires `UI · JoinLeaveSoundsOn` / `UI · JoinLeaveSoundsOff`. A chime itself is not counted: it is
not something anyone did.

## Not in scope

- A tab title or favicon cue, and desktop notifications for arrivals (a nudge has one: [Nudge](nudge.md)).
- Choosing the sounds or their volume.
