# Picker

Status: **implemented**.

A canvas element that **chooses at random when pressed** — one of the people in the room, or one of the options written on it. Who demos next, which idea to explore, whose turn it is to start.

## Why

Every session has a moment where someone has to pick, and picking by hand is either slow ("who hasn't gone yet?") or loaded (the same two people always volunteer). A visible, obviously-random choice settles it in a second and takes the decision off whoever is facilitating.

It belongs on the canvas rather than in a menu for the same reason the other Behaviour elements do: the board is the shared surface everyone is already looking at, so the roll is something the room watches together rather than a result one person reads out.

## The element

- A **shape kind**, `picker`: a card with the choice shown large, and a button that rolls.
- **`ShapeElement.pickerSource`** — `'participants'` (default) or `'options'`.
- **`ShapeElement.pickerOptions`** — the written list, used when the source is `options`. Empty falls back to "nothing to pick from" rather than picking nothing silently.
- **`ShapeElement.pickerResult`** — the last result, so the board still shows it after a reload and to anyone who joins later.

## Rolling

- Pressing it **spins the candidates past and slows to a stop** on the result, over about a second and a half. The frames are spaced on a quadratic ease-out, so it reads as a wheel losing speed rather than a list being flicked at a constant rate — the last few names are the ones the room is actually watching. The spin is local animation over a result decided at press time, so a peer never watches a different reel land on a different name.
- **People spin past as themselves**: when the source is the room, each candidate is drawn with its participant avatar (their colour and initials, the same `ParticipantAvatar` the presence stack uses) beside the name. The stored result is matched back to whoever is still here, so the winner keeps their avatar after a reload and quietly loses it once they leave.
- The result is **written to the element**, so everyone sees the same one. That makes it an ordinary edit: it syncs, it lands in the change log, and it undoes.
- **The whole room watches the spin, not just the presser.** A result arriving from anywhere but our own roll replays the reel locally and lands on what the element now says. Peers used to get only the landing — the new name simply appeared — which threw away the one moment a picker has and the only reason to use one instead of saying a name out loud.

  Nothing extra goes over the wire: the element update the presser is already sending IS the cue, so this costs no new op, no ordering and nothing to persist. Every client runs its own reel from its own candidate list; they all end on the written result, so the guarantee above ("a peer never watches a different reel land on a different name") still holds.

  The face tracks the last result it has accounted for as a VALUE rather than a "we just rolled" flag, because a re-roll landing on the same name changes nothing on the element: a flag armed by that press would sit there and swallow the next person's roll. It also needs to know whether OUR roll is written at all (`shared`) — a view-role visitor's private roll changes no result, so arming a skip for it would eat somebody else's landing.

- **A read-only visitor can still press it**, and sees the spin and the result on their own screen; it simply isn't written back. Being able to roll for yourself is harmless, and the alternative — a dead control on a view link — is worse.
- **Participants** are read from live presence at press time, so it can only pick someone who is actually here. With nobody else in the room it picks you, because a picker that refuses to choose is a broken picker. Candidates are keyed by participant id: you appear once even though you arrive from both local identity and presence, and two people who happen to share a name are still two candidates.
- Randomness comes from `apps/live/lib/random.ts` (`crypto.getRandomValues`), like every other roll in the editor.
- **Dragging it does not roll it** (`usePressWithoutDrag`).

## Configuring it

Right-click → **Picker**: choose the source, and — for a written list — edit the options, one per line. Switching source keeps whatever the other one held, so flipping to People and back doesn't lose a list someone typed.

## Telemetry

Per [Telemetry + public transparency dashboard](../017-telemetry/telemetry.md): adding one emits `Element·Added·Picker`; rolling or reconfiguring emits `Element·Changed·Picker`. The result itself is never sent — it is a name or a phrase the user wrote, which is content ([Telemetry + public transparency dashboard](../017-telemetry/telemetry.md) "never user content").

## Out of scope

- Weighted odds, or "don't repeat until everyone has been picked". Both are reasonable and both turn a die into a queue; a queue deserves its own element rather than a hidden mode of this one.
- Picking several at once (pairs, groups). The obvious next step if this gets used.
- Excluding specific people. Fine to add when someone asks; today the room is the room.
