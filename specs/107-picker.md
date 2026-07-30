# 107 — Picker

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

- Pressing it **spins for about a second** and lands on the result. The spin is local animation over a result decided at press time — a peer never watches a different reel land on a different name.
- The result is **written to the element**, so everyone sees the same one. That makes it an ordinary edit: it syncs, it lands in the change log, and it undoes.
- **A read-only visitor can still press it**, and sees the spin and the result on their own screen; it simply isn't written back. Being able to roll for yourself is harmless, and the alternative — a dead control on a view link — is worse.
- **Participants** are read from live presence at press time, so it can only pick someone who is actually here. With nobody else in the room it picks you, because a picker that refuses to choose is a broken picker.
- Randomness comes from `apps/live/lib/random.ts` (`crypto.getRandomValues`), like every other roll in the editor.
- **Dragging it does not roll it** (`usePressWithoutDrag`).

## Configuring it

Right-click → **Tools › Picker**: choose the source, and — for a written list — edit the options, one per line. Switching source keeps whatever the other one held, so flipping to People and back doesn't lose a list someone typed.

## Telemetry

Per [spec/22](22-telemetry.md): adding one emits `Element·Added·Picker`; rolling or reconfiguring emits `Element·Changed·Picker`. The result itself is never sent — it is a name or a phrase the user wrote, which is content ([spec/22](22-telemetry.md) "never user content").

## Out of scope

- Weighted odds, or "don't repeat until everyone has been picked". Both are reasonable and both turn a die into a queue; a queue deserves its own element rather than a hidden mode of this one.
- Picking several at once (pairs, groups). The obvious next step if this gets used.
- Excluding specific people. Fine to add when someone asks; today the room is the room.
