# Picker

Status: **implemented**.

A canvas element that **chooses at random when pressed**: one of the people in the room, or one of the options written on it. Who demos next, which idea to explore, whose turn it is to start.

## Why

Every session has a moment where someone has to pick, and picking by hand is either slow ("who hasn't gone yet?") or loaded (the same two people always volunteer). A visible, obviously-random choice settles it in a second and takes the decision off whoever is facilitating.

It belongs on the canvas rather than in a menu for the same reason the other Behaviour elements do: the canvas is the shared surface everyone is already looking at, so the roll is something the room watches together rather than a result one person reads out.

## The element

- A **shape kind**, `picker`: a card with the choice shown large, and a button that rolls.
- **`ShapeElement.pickerSource`**: `'participants'` (default) or `'options'`.
- **`ShapeElement.pickerOptions`**: the written list, used when the source is `options`. Empty falls back to "nothing to pick from" rather than picking nothing silently.
- **`ShapeElement.pickerResult`**: the last result, so the canvas still shows it after a reload and to anyone who joins later.
- **`ShapeElement.pickerRemoveDrawn`**: **Remove Once Drawn**, off by default. On, a name that has been drawn leaves the pool until a Reset, so nobody is picked twice in a round.
- **`ShapeElement.pickerDrawn`**: the names drawn since the last Reset, in the order they came out. Only written while Remove Once Drawn is on.
- **`ShapeElement.pickerRolledAt`**: when the last roll was pressed (epoch ms), written with the result. Every press writes a new one (past the last one even when the presser's clock runs behind), so the room can tell a second landing on the same name from no press at all. Cleared by a Reset. Not for agents to set.
  Through a Community post's link ([Community](../025-community/community.md) "Viewing a post's document"), and in a copy taken through it, a result and drawn names taken from the room (source Participants, or none set) are left out: they are people's names. Ones from written options stay.

## Rolling

- Pressing it **spins the candidates past and slows to a stop** on the result, over about a second and a half. The frames are spaced on a quadratic ease-out, so it reads as a wheel losing speed rather than a list being flicked at a constant rate: the last few names are the ones the room is actually watching. The spin is local animation over a result decided at press time, so a peer never watches a different reel land on a different name.
- **People spin past as themselves**: when the source is the room, each candidate is drawn with its participant avatar (their colour and initials, the same `ParticipantAvatar` the presence stack uses) beside the name. The stored result is matched back to whoever is still here, so the winner keeps their avatar after a reload and quietly loses it once they leave.
- The result is **written to the element**, so everyone sees the same one. That makes it an ordinary edit: it syncs and it undoes.
- **The whole room watches the spin, not just the presser.** A result arriving from anywhere but our own roll replays the reel locally and lands on what the element now says. Showing peers only the landing would throw away the one moment a picker has and the only reason to use one instead of saying a name out loud.

  Nothing extra goes over the wire beyond the press's stamp (`pickerRolledAt`): the element update the presser is already sending IS the cue, so this costs no new op, no ordering and nothing to persist. Every client runs its own reel from its own candidate list; they all end on the written result, so the guarantee above ("a peer never watches a different reel land on a different name") still holds.

  **The cue is the press, not the name.** The face keys the replay on the result AND its stamp, so the same name landing twice in a row (about half of all spins in a room of two) still replays for everyone. It tracks the last press it has accounted for as a VALUE rather than a "we just rolled" flag, so our own press is skipped by matching its landing, and a flag can never sit armed and swallow the next person's roll. An element written before the stamp existed keys on the result alone.

  **No frame shows the winner early.** The replay is worked out while the face renders the update, not after it paints, so a watcher's first frame of a new press is the reel already turning, never the winner standing still for a frame and then spinning. It also needs to know whether OUR roll is written at all (`shared`): a non-facilitator Editor's private roll changes no result, so arming a skip for it would eat somebody else's landing.

- **Only an Editor can spin it.** Choosing who goes next runs the session, so a Participant and a Viewer see the result land but have no spin button ([Share roles](../013-workspace/share-roles.md), decided 2026-10-10). Under a facilitator, an Editor who is not them spins for themselves and the room's answer stays the facilitator's.
- **Participants** are read from live presence at press time, so it can only pick someone who is actually here. With nobody else in the room it picks you, because a picker that refuses to choose is a broken picker. Candidates are keyed by participant id: you appear once even though you arrive from both local identity and presence, and two people who happen to share a name are still two candidates.
- Randomness comes from `../packages/workbench/src/lib/random.ts` (`crypto.getRandomValues`), like every other roll in the editor.
- **Dragging it does not roll it** (`usePressWithoutDrag`).

## Remove once drawn

For "everyone gets a turn": stand-up order, who presents next, working through a list of questions.

- **The pool is everyone minus who has been drawn.** A roll only lands on a name not in `pickerDrawn`, and the reel spins only through those names. Names are matched by their text, the same text `pickerResult` holds: two people in the room with the same name are one name once drawn, which is the honest reading of "that name has been picked".
- **The draw is one write.** The presser writes the result AND the drawn list in the same element update, so every client sees the same pick and the same names left, and nobody can see a result whose name is still in the pool. Two Editors pressing in the same instant (only possible with no facilitator) settle as any other edit to one element does: the later write wins, the room converges on its result and its pool, and the earlier name goes back in.
- **The card says what is left**: "5 of 8 left" in the corner, and drawn names stay listed under the reel, struck through, so the room can see who has had a turn. A long list folds into "+N more", and a small card shows only the count.
- **When every name is drawn the card says so**: "Everyone's had a turn" (the room) or "All drawn" (a list), with **Reset** in place of Spin for whoever may spin. Everyone else reads the same line and waits for the reset.
- **Reset puts every name back** and clears the result, so the next round starts from a full pool. It is a session event like the roll (not undoable, sent to the room the same way), and it sits with the Spin button whenever anything is drawn, and in the element's kind tools. Only whoever may spin may reset.
- **Turning the setting on or off starts a fresh round**: it clears `pickerDrawn`. **Editing the options does not**: a list edited mid-round keeps the names already drawn that are still on it (so fixing a typo in one option doesn't hand the others a second turn); a drawn name that has been deleted from the list simply stops counting. A person who leaves and comes back is still drawn.
- A private roll (an Editor rolling for themselves under somebody else's facilitation) skips drawn names too, but draws nothing.

## The look

A slot reel, the one picker you can read at a glance at any size and with any length of name. Directions weighed: a wheel of names (segment text turns sideways and shrinks past a dozen names, and its colours fight the tab theme), a card shuffle (charming, but the landing hides the candidates). The reel shows the pool, the motion and the winner at once.

- **The window**: the payline in the middle, a band tinted with the tab theme's accent (the element's stroke, like the collaboration panels' accent; with none, the brand sky, a step lighter on dark paper) with a notch at each end. The rows above and below show by half a row on a default card and a whole one on a big card, fading from half strength at the payline to nothing at the window's edge, so the reel reads as turning behind glass and a row cut by the window never reads as text sliced off.
- **The header**, pinned to the top: the label as a small kicker on the left; on the right a count, "8 to pick from", or "5 of 8 left" with Remove Once Drawn.
- **The button**: an accent pill with a shuffle glyph: **Spin**, **Spin Again** once there is a result, **Spinning…** while it turns. Reset sits beside it as a quiet round button when anything is drawn.
- **The spin**: the strip of names scrolls through the window on one transform, fast and then slowing (the same ease-out the frames had), settling a hair past the line and back. On landing the winner gives a small pop and the payline glows once. With reduced motion there is no scroll: the winner fades in.
- **Small and large**: the header stays at the top and the buttons at the foot, and the reel fills what is between. With no room for a row either side, only the payline stays. Too short to stack a header, a payline and a button (about 100px with the buttons), the card goes **compact**: one row, the payline beside a round Spin (and a round Reset), no header. The name grows with the card, up to a limit, so a picker made big for a room reads from across it.
- **Clear of the corner menu**: the element's `…` sits in the top-right corner for an Editor. The header keeps a gutter under it, and so does a compact card's row, so the payline never runs under it at any height. A Participant or Viewer has no `…`, and the count sits in the corner.
- **Long options read whole**: the name on the payline is set as large as fits and wraps onto as many lines as the payline holds. An option too long for one line takes the whole window (no rows above and below). A drawn chip too long for its pill shows the whole option in its tooltip.
- **Light, dark and every theme**: built from the element's own text colour and the theme accent, never fixed colours, so it follows the tab theme in light and dark.

## Configuring it

Right-click → **Picker**: choose the source, and, for a written list, edit the options, one per line. Switching source keeps whatever the other one held, so flipping to People and back doesn't lose a list someone typed. Below them, **Remove Once Drawn** turns the round on or off. The settings are an Editor's ([Share roles](../013-workspace/share-roles.md)); MCP and the API set the same fields (`pickerRemoveDrawn`).

## Telemetry

Per [Telemetry + public transparency dashboard](../017-telemetry/telemetry.md): adding one emits `Element·Added·Picker`; rolling, resetting or reconfiguring emits `Element·Changed·Picker`. The result itself is never sent: it is a name or a phrase the user wrote, which is content ([Telemetry + public transparency dashboard](../017-telemetry/telemetry.md) "never user content").

## Out of scope

- Weighted odds: a die that favours somebody is no longer obviously fair.
- Picking several at once (pairs, groups). The obvious next step if this gets used.
- Excluding specific people. Fine to add when someone asks; today the room is the room.
