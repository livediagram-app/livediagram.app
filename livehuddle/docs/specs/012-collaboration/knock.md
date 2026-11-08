# Knock

Knocking on a room before walking in on a meeting: a knock reaches the people inside a Room or an Office Pod as a
toast, "Sam is knocking", with **Let In** and **Not Now**. It is a moment, like a shove or a speech bubble: presence,
never stored, never logged, never replayed.

## Why

Rooms and pods are calls ([Meeting rooms and the stage](meeting-rooms-and-stage.md)), so walking into one walks into
a conversation. A [Room Sign](../009-elements/screen-and-room-sign.md#room-sign) tells you it is in use; a knock asks
whether to come in, and a closed pod (its door shut while both seats are held) has no other way to ask.

## Knocking

- **From a Room Sign**: its **Knock** button, while the room is In Use or Do Not Disturb.
- **At a closed Office Pod's door**: walking your character up to the doorway of a pod whose door is shut (your feet
  within 48 canvas px in front of the doorway, not seated) shows you a toast, "This Office Pod is closed", with a
  **Knock** button. It shows once each time you walk up, not again while you stand there.
- **Who may knock**: anyone walking in Avatar mode, any share role (a Viewer walks too). Someone already inside the
  room does not knock on it.
- **One knock per 10 seconds per person**: the button reads **Knocked** for ten seconds, and the room drops a second
  knock from the same person inside that window, so a held key or a script cannot ring a room.
- **The sound**: a knock is heard. The knocker hears two quick raps on the door as they knock, and everyone who is
  shown the knock (below) hears the same two raps as its toast appears. It is drawn on each screen with Web Audio,
  nothing is sent for it, and a browser that has not been pressed yet stays silent.

## Being knocked

- Everyone whose character stands inside that room (the innermost call they are in, as the Room Sign counts) sees an
  action toast: **"Sam is knocking"** with **Let In** and **Not Now**. It stays up as a toast with answers does (ten
  seconds, paused while hovered), and shows even with In-Editor Notifications off: it is a person asking you.
- **Someone on Do Not Disturb** ([Do Not Disturb](meeting-rooms-and-stage.md#do-not-disturb-part-3-built)) is not
  shown knocks.
- A second knock from the same person replaces the first toast in place, never stacks.
- **Not Now** tells the knocker "Sam says Not Now".
- **Let In** tells the knocker "Sam let you in". A room's doorway is always open, so in a room that is the whole of
  it: the knocker walks in.
- **Let In at a closed Office Pod** stands the person who pressed it up from their seat (they stay inside the pod).
  The pod's door rule is unchanged ([Office Pod](../009-elements/office.md#office-pod)): it is shut only while both
  seats are held, so with a seat free it opens for everyone, by presence, and the knocker walks in and may take the
  seat. Nobody opens a door the seats say is shut, so every machine still sees the same door.
- Several people inside: each sees the toast; each answer reaches the knocker, who sees the first and any after it.

## The wire

Two presence ops ([API](../015-api/api.md) room ops), in `PRESENCE_OP_KINDS`:

| Op                    | Shape                                 | Delivery                                                      |
| --------------------- | ------------------------------------- | ------------------------------------------------------------- |
| `avatar-knock`        | `{ tabId, roomId }`                   | Broadcast; each receiver checks it stands in `roomId`         |
| `avatar-knock-answer` | `{ tabId, targetId, roomId, answer }` | **Addressed** to `targetId`, as a shove is (`sendToPresence`) |

- `roomId` is the Room's or Office Pod's element id (at most 64 characters); `answer` is `'in'` or `'later'`.
- The room never knows who stands where, so the receivers decide who is inside; the knocker's name comes from the
  presence roster, never from the op.
- The room's gate parses both from any level and drops a malformed one; it drops an `avatar-knock` from a sender who
  knocked in the last 10 seconds (`KNOCK_THROTTLE_MS`), kept in memory only, per connection.
- Neither op is ordered, logged or replayed; neither touches the document.

## Share roles

| Act                    | Editor | Participant | Viewer |
| ---------------------- | ------ | ----------- | ------ |
| Knock                  | Yes    | Yes         | Yes    |
| See a knock and answer | Yes    | Yes         | Yes    |

Knocking and answering are presence (the walk is everyone's), so no `can` gates them beyond being in Avatar mode;
the room enforces only the shape and the throttle.

## Telemetry ([Telemetry](../017-telemetry/telemetry.md))

`Canvas · Used · Knock` on knocking, `Canvas · Used · KnockLetIn` and `Canvas · Used · KnockNotNow` on answering.
Never who knocked, who answered, or which room.

## Not in scope

- A knock that waits for an answer before the doorway lets you in (rooms stay open; only a pod's seats shut a door).
- A knock sent to people not in Avatar mode, or to a room on another tab.
- A doorbell sound, or a sound for the answers.
