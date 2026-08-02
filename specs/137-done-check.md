# 137 — The Done check

Everyone marks themselves finished; the card shows who has and who has not, and
flashes when the last person does.

Palette home: **Behaviour**. By the spec/110 rule it is arguably a Collaborate
element (it collects an answer from the room, like the roll call), and it is
built out of the Collaborate machinery below. It sits in Behaviour because that
is where it was asked for; if the two categories are ever reconciled, this is
the element to move.

## Built on `responses`, not a new field

The per-participant `responses` array (spec/122) already records **one value
per participant**, and already replaces rather than stacks. A done check is
that primitive with a single fixed value: being done is a flag, not a scale.

So there is no new storage, no new merge rule, no new realtime path:

- Marking yourself calls the same `respond(element, DONE_VALUE)` the estimate
  card calls.
- **Unmarking is the same call.** `respond` withdraws when you send the value
  you already sent, so marking and unmarking cannot drift apart — there is one
  code path, not two that have to agree.
- **Reset** is the existing `clearResponses`.

## The waiting list is live

`doneSplit(responses, participantIds)` derives who is waiting from **who is in
the room now**, not from everyone who was ever in it.

This is the decision that makes the card work. A card that waited on somebody
who closed their tab would never complete, and completing is the entire point —
the facilitator would be left staring at "3/4" with no fourth person to ask.

The flip side, deliberately: a response from someone who has since left is
**ignored, not deleted**. It comes back if they rejoin, which is what a
reconnect should do rather than silently unmarking somebody who dropped off
wifi for ten seconds.

An **empty room is never done**. With nobody present there is nothing to have
finished, and flashing "everyone's done" at an empty board would be celebrating
the absence of people.

## The flash

A pulse of a green ring around the card, not a colour wash: the card can be any
theme colour, and a wash would fight it.

It **runs out** after four cycles. A card left flashing forever is noise on a
board somebody walked away from, and the completed state is still perfectly
legible afterwards from the count, the "Everyone's done." line and the empty
waiting list. Under `prefers-reduced-motion` it is a steady ring instead — the
completion is information, so it stays visible; only the pulsing goes.

## The ellipsis menu

A small `…` in the card's title row (`headerExtra` on `CollabPanel`, added for
this):

- **Clear my mark** — only shown when you have one.
- **Reset everyone** — clears the round.

Inline rather than portalled: the card is already a pointer-active surface, and
a portalled menu would have to track a canvas element through pan, zoom and the
isometric transform to stay beside it. Its outside-click listener runs in the
**capture** phase, because the canvas swallows `pointerdown` on its own surface
and a bubbling listener never hears the click that should dismiss it.

## Reading the card

- Title row: the question, the `done/total` count, the menu.
- **Done** roster at full strength, **Waiting on** drawn back — a glance should
  land on who is finished, since that is what the facilitator is counting.
- Avatar gaps clear the presence ring (spec/136's lesson): the ring is a
  box-shadow outside each avatar's layout box and eats 4px of any gap beside it.
