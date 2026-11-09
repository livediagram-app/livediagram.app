# Join and leave sounds blueprint

Derived from [Join and leave sounds](../join-and-leave-sounds.md).

## Files

| File                                                            | Role                                                                                                  |
| --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `apps/editor/lib/sounds/audio.ts`                               | The editor's one lazy `AudioContext`, `playTones`, `unlockAudioOnGesture` (the Timer chime's voice)   |
| `apps/editor/lib/sounds/quiet.ts`                               | Whether your status is Do Not Disturb, written by the characters layer, read at play time             |
| `apps/editor/lib/sounds/presence-chimes.ts`                     | `createPresenceChimes`: the roster watcher (people, seeding, flap debounce, burst) and the two chimes |
| `apps/editor/app/document/[id]/useRoomConnection.ts`            | One watcher per room effect run; every presence list goes through `update`; `dispose` on cleanup      |
| `apps/editor/components/canvas/CanvasCharactersLayer.tsx`       | Writes `setQuietForDoNotDisturb` from the walking status, clears it on unmount                        |
| `apps/editor/lib/timer-chime.ts`                                | Plays through `lib/sounds/audio.ts`, and re-exports `playTones` for the reception bell                |
| `apps/editor/lib/user-preferences.ts`                           | `joinLeaveSounds?: boolean`, missing means on                                                         |
| `apps/editor/components/dialogs/settings/settings-catalogue.ts` | The **Join and Leave Sounds** toggle row (Notifications, In the Editor)                               |

## Domain and naming

- **Person**: `personOf(p) = p.key ?? p.id`. The watcher keeps `present: Set<person>`; `self` is your own key.
- **Arrival**: a person in the new roster not in `present` and with no pending leave.
- **Leave**: a person in `present` absent from the new roster, still absent `JOIN_LEAVE_FLAP_MS` later.

## Behaviour and state

`createPresenceChimes({ selfKey, play, enabled, clock })`:

1. `update(participants)`: computes `next = Set(personOf(p))` without `selfKey`.
2. First call (`seeded === false`): `present = next`, `seeded = true`, nothing plays.
3. Later calls: for each person in `next` not in `present`: a pending leave timer for them is cleared (a flap); else
   it is an arrival. For each person in `present` not in `next`: a leave timer of `JOIN_LEAVE_FLAP_MS` is set (once
   per person); when it fires and the person is still not present, it is a leave. `present` becomes `next`.
4. A kind plays when `clock() - lastPlayed[kind] >= JOIN_LEAVE_BURST_MS` (leading edge), then `lastPlayed[kind]` is
   set; else nothing. Arrivals in one `update` count once.
5. `play(kind)` runs only when `enabled()` is true: `readUserPreferences().joinLeaveSounds !== false` and not
   `quietForDoNotDisturb()`.
6. `dispose()` clears every pending timer.

The room effect creates the watcher once per document, so a reconnect of your own socket keeps `present` and seeds
nothing again. `unlockAudioOnGesture()` is installed by the same effect and removed in its cleanup.

## Interfaces and contracts

- `playTones(notes, noteS, peak)` unchanged in shape; `audio()` returns the one context or null.
- `unlockAudioOnGesture(): () => void` adds capture `pointerdown` and `keydown` listeners on `window` that create and
  resume the context, then remove themselves; the returned function removes them too.

## Errors and edge cases

- No Web Audio, or a browser that refuses to start: `audio()` returns null, nothing plays, nothing throws.
- A roster with the same person on two sockets: one person, so the second socket's arrival and one socket's leave
  are silent.
- A roster arriving after `dispose`: the effect owning the watcher is gone; nothing calls it.

## Security and trust

Nothing is sent. The key is claimed by each client and grants nothing; a peer rotating it only makes the chime play
again, as a new arrival would.

## Performance and limits

- One `update` per presence list (the room sends one per join, leave and tab switch), O(n) in the roster (at most
  100 connections, `ROOM_MAX_CONNECTIONS`). No per-frame work, no subscription to cursors or avatars.
- Timers: at most one per person who left in the last 5 seconds, cleared on dispose.
- Budget test: 100 updates of a 100 person roster under 20 ms CPU (`cpuMsOf`).

## Presentation and UX

No visual. The Settings row: label "Join and Leave Sounds", description "A soft chime when someone arrives in the
Space you have open, and a softer one when they leave, even while this tab is in the background.", keywords "sound
chime audio join leave arrive enter knock bell ding quiet mute background tab".

## Accessibility

The chime is an extra cue; every arrival is already shown on the tab bar and in Collaborators. The switch is the
shared toggle row (label, description, keyboard).

## Observability

The watcher logs nothing per chime (a moment); a Web Audio failure is swallowed as the Timer's is. The setting's
flip is `UI · JoinLeaveSoundsOn` / `JoinLeaveSoundsOff`.

## Testing

`lib/sounds/presence-chimes.test.ts`: initial roster silent; arrival plays; self key excluded; same key on two
sockets silent; leave plays only after the flap window; reconnect inside the window silent; a burst plays once;
setting off silent; Do Not Disturb silent; dispose clears timers; the CPU budget. `settings-catalogue.test.ts` covers
the row; `lib/sounds/audio.test.ts` the unlock listeners. Roles: the watcher takes no role, pinned by a test that
feeds rosters of Editor, Participant and Viewer rows and hears all three.

## Constants and configuration

| Constant              | Value                                                              | Provenance                              | Safe range     |
| --------------------- | ------------------------------------------------------------------ | --------------------------------------- | -------------- |
| `JOIN_LEAVE_FLAP_MS`  | 5000                                                               | The spec's "still gone 5 seconds later" | 2000-15000     |
| `JOIN_LEAVE_BURST_MS` | 1000                                                               | The spec's "inside 1 second"            | 500-3000       |
| `ARRIVE_NOTES`        | G5 783.99 Hz at 0 s, C6 1046.5 Hz at 0.14 s; 0.6 s each, peak 0.08 | Softer than the Timer chime (0.12)      | peak 0.04-0.12 |
| `LEAVE_NOTES`         | C6 1046.5 Hz at 0 s, G5 783.99 Hz at 0.14 s; 0.6 s each, peak 0.05 | Softer than the arrival                 | peak 0.03-0.08 |

## Assets and external resources

None: the tones are synthesised.

## Defaults ledger

JL1 to JL3 in [DEFAULTS](DEFAULTS.md).
