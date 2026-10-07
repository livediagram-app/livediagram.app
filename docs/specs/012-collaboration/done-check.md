# The Done check

Everyone marks themselves finished; the card shows who has and who has not, and
flashes when the last person does.

Palette home: **Collaborate > Tools**, beside the timer, the Reveal and the
Picker. Behaviour and Collaborate are one category since the [Palette top-level categories and bands](../010-palette/palette-top-level-categories.md)
reconciliation; the Done check collects an answer from the room, like the roll
call, and is built out of the Collaborate machinery below.

## Built on `responses`, not a new field

The per-participant `responses` array ([Per-participant responses](participant-responses.md)) already records **one value
per participant**, and already replaces rather than stacks. A done check is
that primitive with a single fixed value: being done is a flag, not a scale.

The element is **fixed-size** like the mode and session buttons
(`FIXED_SIZE_SHAPES`, [Selection Mode button](../009-elements/mode-button.md)): no resize handles, and a multi-selection
scale leaves it alone. It is a roster and a button laid out for its own
content, and stretching it only spread the same three things over empty
card.

So there is no new storage, no new merge rule, no new realtime path:

- Marking yourself calls the same `respond(element, DONE_VALUE)` the estimate
  card calls.
- **Unmarking is the same call.** `respond` withdraws when you send the value
  you already sent, so marking and unmarking cannot drift apart — there is one
  code path, not two that have to agree.
- **Reset** is the existing `clearResponses`.

## The join runs on the collab key

Everything below joins a saved mark to a person in the roster, and that join is
the card. It runs on `participantKey` ([Per-participant responses](participant-responses.md)),
never on `Participant.id`.

It shipped keyed on `id` and the card did nothing: `id` is our own owner id for
ourselves and the room's per-socket presence id for everybody else ([Public API and API tokens](../015-api/public-api-and-tokens.md)
§6), so a peer's mark could never match a peer's roster entry. Every viewer saw
their own mark and no one else's, in both directions — a card whose entire
purpose is showing you the room's state, showing you only yourself.

## The waiting list is live

`doneSplit(responses, participantKeys)` derives who is waiting from **who is in
the room now**, not from everyone who was ever in it.

This is the decision that makes the card work. A card that waited on somebody
who closed their tab would never complete, and completing is the entire point —
the facilitator would be left staring at "3/4" with no fourth person to ask.

The flip side, deliberately: a response from someone who has since left is
**ignored, not deleted**. It comes back if they rejoin, which is what a
reconnect should do rather than silently unmarking somebody who dropped off
wifi for ten seconds.

An **empty room is never done**. With nobody present there is nothing to have
finished, and flashing "everyone's done" at an empty canvas would be celebrating
the absence of people.

## The flash, and the finish

A pulse of a green ring around the card, not a colour wash: the card can be any
theme colour, and a wash would fight it.

It **runs out** after four cycles. A card left flashing forever is noise on a
canvas somebody walked away from, and the completed state is still perfectly
legible afterwards from the ring, the "Everyone's done!" line and the empty
waiting list. Under `prefers-reduced-motion` it is a steady ring instead — the
completion is information, so it stays visible; only the pulsing goes.

When the last person marks themselves done **while the card is on screen**, a
short burst of confetti goes off from the ring, once. Not on a reload of a card
that was already complete: it celebrates the moment, not the state.

## The ellipsis menu

A small `…` leading the card's title (`headerExtra` on `CollabPanel`, added for
this):

- **Clear my mark** — only shown when you have one.
- **Reset everyone** — clears the round.

Inline rather than portalled: the card is already a pointer-active surface, and
a portalled menu would have to track a canvas element through pan, zoom and the
isometric transform to stay beside it. Its outside-click listener runs in the
**capture** phase, because the canvas swallows `pointerdown` on its own surface
and a bubbling listener never hears the click that should dismiss it.

## Reading the card

Built in the behaviour elements' current direction ([Participant responses](participant-responses.md): the paper
kit is being retired; the [Q&A board](qa-board.md) set the look). It replaced a feint-ruled "sheet"
with two plain avatar lists and a grey pill button.

- **Title row**: the `…` leading the question, the `done/total` count at the right.
- **The ring is the hero.** A progress ring in the tab theme's accent fills as
  people finish, easing to its new share, with the count large in the middle
  ("3/5"). Complete, it turns green, the count becomes a check and the card
  reads **Everyone's done!** above the rosters.
- **Beside it, the rosters.** **Done** at full strength, each avatar wearing a
  small green check; **Waiting** drawn back and gently breathing, so a glance
  lands on who is finished, since that is what the facilitator is counting.
  Each label carries its count as a badge ([Counts are badges](../004-interface-design/counts.md)).
- **The button** fills the foot: **I'm done** in the accent with a check, which
  pops when pressed; once you are done it turns quiet and reads **I'm not
  done**, the same press to take it back.
- **An empty room** says so plainly ("Nobody here yet" over "Share the document
  and the card fills itself in") rather than drawing an empty ring.
- Avatar gaps clear the presence ring (the ring is a box-shadow outside each
  avatar's layout box and eats 4px of any gap beside it).
- The card stays **fixed-size at 280x220**. Durations are canvas motion, in
  `qa-board.css`, and collapse under reduced motion. The export draws the same
  card: the ring, a check in it once anyone is done, a neutral disc with a
  green check per person done (an export has no names to show), and the button.
