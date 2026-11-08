# The Receptionist: blueprint

Derived from [the Receptionist](../receptionist.md). The spec decides; this file only adds engineering precision.

## Files

| File                                                                | Role                                                                                            |
| ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `apps/editor/lib/receptionist/receptionist-day.ts`                  | His day: world (pad, area, stops, rooms, route grid), legs, seeded stops, routes, walking       |
| `apps/editor/lib/receptionist/receptionist-timeline.ts`             | His pose at a moment: his day, or a detour (greet, talk, lead), and when it next changes        |
| `apps/editor/lib/receptionist/receptionist-topics.ts`               | The fifteen topics, their targets, the role filter and telemetry tokens                         |
| `apps/editor/lib/receptionist/receptionist-store.ts`                | The bubble's state and the person, shared by the canvas layer and the host                      |
| `apps/editor/lib/receptionist/receptionist-look.ts`                 | His character and shirt colour                                                                  |
| `apps/editor/lib/reduced-motion.ts`                                 | Reduced motion as it changes (shared with the office dog)                                       |
| `apps/editor/components/canvas/receptionist/useReceptionist.ts`     | His world, his detour and his clock on this screen                                              |
| `apps/editor/components/canvas/receptionist/ReceptionistLayer.tsx`  | Draws him, the press that asks him, Escape and walking away                                     |
| `apps/editor/components/canvas/receptionist/ReceptionistBubble.tsx` | His bubble: the list, every topic, an answer; kept on screen                                    |
| `apps/editor/components/canvas/receptionist/TypedLine.tsx`          | His line typed out a letter at a time (`TYPE_CPS`), laid out whole from the start               |
| `apps/editor/components/palette/ReceptionistMenuSection.tsx`        | The Avatar Pad menu's Receptionist switch: asked to leave, or brought back                      |
| `apps/editor/lib/office/reception-bell.ts`                          | `onBellRung`: every ring on the tab, yours (`SELF_RINGER`) or anyone's                          |
| `apps/editor/components/canvas/receptionist/ReceptionistRing.tsx`   | The ring round the control an answer names                                                      |
| `apps/editor/components/tour/ReceptionistHost.tsx`                  | The person: role, heard topics, welcome or hello, the footer's Ask Receptionist, Settings rerun |

## Behaviour and state

- **One pure clock.** `receptionistPose(world, now, detour)` is the whole of where he is. `now` is cut into legs of
  `RECEPTIONIST_LEG_MS`; leg `n`'s stop is `receptionistStop(world, n)`, seeded by `hashId(padId) ^ n`, so every screen agrees
  with nothing sent. Each leg he walks from leg `n - 1`'s stop at `RECEPTIONIST_SPEED`, then does the stop's thing.
- **Detours are local.** A greeting (`greetDetour`, held `RECEPTIONIST_GREET_MS`), a talk (`talkDetour`, held until
  released) or a lead to a room (`leadDetour`) walks from wherever he is. When it ends, his day resumes from where
  the detour left him, within that leg.
- **A rung bell** (`bellDetour`) walks him behind that desk (`BEHIND_DESK`), else beside its front, the first spot
  with a route; held `RECEPTIONIST_GREET_MS` with a wave, as a greeting. Yours sets an `answeringYou` flag that opens
  his bubble (`'bell'`) when he stands there. A ring from someone else is skipped while your bubble is open.
- **Leaving** is `receptionistLeft: true` on his pad (an element field, validated and in the element format), so
  `receptionistWorld` returns null for everyone. The farewell shows for `FAREWELL_MS`, then the layer patches the pad.
- **The detour is keyed by his pad id**: an edit to the tab rebuilds the world and keeps the detour; another tab drops
  it. A greeting for you is a pending flag that outlives a pad change (a new Space draws the blank tab's pad first),
  so he greets you by whichever pad is his when you are there.
- **An open bubble holds him**: opening it turns a greeting's timed hold into an open one, released when it closes.
- **The store** (`receptionist-store.ts`, `useSyncExternalStore`) carries `asks` and `greets` as counters, so each ask and
  each greeting is acted on once. The host never resets it; it only closes the bubble when it unmounts.

## Performance and limits

- The route grid is built once per change to the elements, and only while you walk (`useReceptionistWorld`).
- Routes (per grid) and stops (per world) are cached in `WeakMap`s of at most 64 entries each, so the path search runs
  at most twice per leg, not per frame.
- His clock runs `requestAnimationFrame` only while he walks or plays a reaction; standing, one `setTimeout` wakes him
  at his next change (`receptionistNextChangeMs`). Under reduced motion he stands by his pad and no clock runs.
- `TypedLine` sets state only when the letter count changes (one render per letter, under two seconds per line), and
  lays the whole line out hidden beneath so the bubble's placement never re-measures as he types.
- Measured on the Virtual Office template (1440x900, dev build): 60 fps with a 17 ms worst frame while he walks.

## Presentation and UX

- The bubble sits above his name tag (`OVER_NAME`), at reading size (`scale(1 / zoom)`). It is nudged sideways to keep
  16 px inside the canvas and the window, its tail still on his head (`tailOffset`). It stays above him when it fits
  below the chrome along the top (`SPEECH_TOP_CLEAR`, as every speech bubble); otherwise it goes on whichever side of
  him has more room (under his feet without a tail), and the whole bubble scrolls when even that side is too short,
  keeping `SPEECH_TOP_CLEAR` off the bottom edge too, clear of the call dock.
- Topics are full-width rows (`ROW_H` 32 px, `ROW_GAP` 4 px) in a list capped at `VISIBLE_ROWS` (7) rows tall that
  scrolls past it, group headings sticky; a fade at its foot shows there is more until it is scrolled to the end. The
  bubble is a fixed `BUBBLE_W` (300 px) wide so every row is the same width. The action pills sit under the list.
- The Receptionist and his bubble are chrome over the canvas (`[data-receptionist]`, `[data-receptionist-bubble]` in `CHROME_OVER_CANVAS`): a
  press on them is never a walk.
- Replies are `relative` so their phone touch targets (`touch-target-y`) stay their own.

## Testing

| Behaviour                                          | Test                                             |
| -------------------------------------------------- | ------------------------------------------------ |
| World, stops, routes, walking                      | `lib/receptionist/receptionist-day.test.ts`      |
| Day pose, detours, next change                     | `lib/receptionist/receptionist-timeline.test.ts` |
| Topics, role filter, tokens                        | `lib/receptionist/receptionist-topics.test.ts`   |
| Store                                              | `lib/receptionist/receptionist-store.test.ts`    |
| Drawn, pressed, Escape, walking away, greeting     | `ReceptionistLayer.test.tsx`                     |
| Lists, answers, ring, heard, roles, kept on screen | `ReceptionistBubble.test.tsx`                    |
| Offer, welcome, hello, heard, Settings rerun       | `ReceptionistHost.test.tsx`                      |
| Typing, reduced motion                             | `TypedLine.test.tsx`                             |
| Bell rings told to the Receptionist                | `lib/office/reception-bell.test.ts`              |
| Pad menu switch                                    | `ReceptionistMenuSection.test.tsx`               |
| Role levels                                        | `lib/share-roles.test.ts`                        |
