# Future work

Status: **proposed**, awaiting the owner's approval (Work Tracker #99). None of this is in v1.

The card: "We intend to expand the feature set to include Video Calls, Audio Calls and Screen Sharing in future." This
page records what that needs, so v1 is built not to stand in its way. Each feature gets its own spec before any code.

## Audio calls

People near each other on the board hear each other: **proximity audio**. A character's position already rides the
room ([Avatar mode](../../../../livediagram/docs/specs/008-canvas/avatar-mode.md#realtime)), so the board can decide
who hears whom: everyone in the same [room](../../../../livediagram/docs/specs/009-elements/office.md#room), or within
a radius in the open, and everyone in the All-Hands Hall hearing the stage.

## Video calls

A small camera tile beside a character, or a face in the character's head, for the people one is talking to; the
same proximity rule picks whose video is sent.

## Screen sharing

One person shares a screen or a window into a frame on the board (an Editor's act, like Bring Focus), and everyone in
range watches it there.

## What the stack needs

Nothing in liveworkspace carries media today: the realtime room relays small JSON ops through one Durable Object, and
must never relay audio or video.

- **WebRTC** in the browser for capture and playback.
- **TURN**, so two browsers behind strict NATs or firewalls can still connect. Cloudflare's TURN service runs on the
  same account.
- **An SFU** (a selective forwarding unit), so a meeting of more than a handful does not need every browser to send
  its stream to every other: each browser sends once and the SFU forwards what each listener needs. Cloudflare
  Realtime's SFU is the one on the account; a self-hosted SFU is the alternative.
- **Signalling** over the existing room: who is in range of whom, which tracks to subscribe to, mute states. These
  are small ops and fit the room's presence channel (never stored, never replayed).
- **Short-lived credentials**: the api Worker mints a TURN credential and an SFU session per join, from secrets set
  on it. The secrets are the owner's to create.

## What it costs

TURN and SFU usage is billed by traffic on the Cloudflare account, unlike everything livehuddle does in v1. It needs
the owner's decision on spend and limits before it is built ([Open decisions](open-decisions.md) D4).

## Share roles

The proposal for the spec that builds it, in the [Share roles](../013-workspace/share-roles.md) ladder:

| Act                                 | Editor | Participant | Viewer |
| ----------------------------------- | ------ | ----------- | ------ |
| Hear others, see their video        | Yes    | Yes         | Yes    |
| Unmute, turn on a camera            | Yes    | Yes         | No     |
| Share a screen into a frame         | Yes    | No          | No     |
| Mute someone else, stop their share | Yes    | No          | No     |

## What v1 does to keep the way open

- Presence carries position, tab and status already; nothing in v1 assumes a meeting has no sound.
- Avatar Status keeps **In a Meeting**, which a call can later set for you.
- No v1 data model holds a call; a call is never stored, so adding one needs no migration.
