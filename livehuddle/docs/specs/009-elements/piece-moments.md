# Piece moments

Status: **approved** (owner, Work Tracker #600, 2026-11-07). Small, occasional surprises the still pieces of a Space
play when your character walks right up to them: a tree you brush past rocks and drops a few leaves, a pebble plops
into a pond, a fire you stand at is stoked and throws up sparks. They are the [Office](office.md) and
[Social](social-pieces.md) pieces as they are, plus a moment now and then; nothing about them is stored.

## Why

A Space full of trees, ponds and fireplaces that never respond feels like a picture of a place. A real garden rustles
when you brush it. A moment that answers your walk, only sometimes, makes the Space feel alive and rewards wandering,
without asking anything of anyone or getting in the way of a meeting.

## The moments

Each moment is short (under three seconds), soft and drawn over the piece's own art. Nothing flashes, nothing makes a
sound, and the piece is back exactly as it was when the moment ends.

| Piece           | Moment                                                                                                                                      |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Tree            | **Brushed**: the tree rocks gently away from your side and settles, and five leaves (one turned yellow) flutter down to the ground and fade |
| Outdoor Plant   | **Rustled**: the bush shivers and a pink butterfly, then a little yellow one, flutter up out of it and away                                 |
| Plant           | **Rustled**: the pot plant shivers and one leaf drifts down beside its pot                                                                  |
| Pond            | **A pebble**: a pebble arcs in from your side, plops into the water with a few droplets, and two rings ripple out and fade                  |
| Fountain        | **A coin**: a coin flips up from your side, drops into the basin with a glint of light and a small ring on the water                        |
| Fireplace       | **Stoked**: the flames flare up and settle, a handful of sparks rise in the firebox, and the glow on the hearth brightens for a moment      |
| Campfire        | **Stoked**: the flames flare up and settle, sparks rise and drift above the fire, and the glow on the ground brightens                      |
| Vending Machine | **A can drops**: a can tips off a shelf behind the glass and drops to the pickup flap, and the little display blinks                        |

The side a moment plays from is yours: a tree rocks away from where you stand, and a pebble or a coin comes from your
side of the water.

A Fireplace or a Vending Machine plays its moment only facing down, on the front drawing its flames and shelves are
in; turned to show its back or its side ([furniture-facing.md](furniture-facing.md)) it stays still.

## When one plays

- **Walking right next to the piece**: your character's feet come within **24 px** of the piece's base (the strip
  from part way down its drawing to just below it; all round a pond or a campfire, which you walk round). The
  moment is decided on the step you arrive, never while you stand there.
- **Occasionally**: an arrival plays a moment **one time in two**. A piece that has stayed still twice in a row plays
  on your third arrival, so it is never one that "doesn't work".
- **Rested**: one piece asks again at most once every **20 seconds**, whatever the answer, and no moment plays within
  **4 seconds** of the last one anywhere on the tab, so a walk through a wood is a rustle now and then, not a cascade.
- **Only in Avatar mode**, walking. Out of it nothing plays. There is no press: walking up is the whole interaction
  (a click on a piece while walking still walks you to it, and arriving can play its moment).

## Who sees it

**Only you.** A moment plays on your screen alone; it is never sent to the room and never stored. Others see your
character walk up to the tree, not the leaves. Why: the moment is a small reward for your own walk, and sending one
would put a message on the room's presence fan-out for something that changes nothing about the Space. A shared
moment (one `piece-moment` presence op, rate-limited by the rests above) is a follow-up if the owner wants it
([Future work](../005-project-roadmap/future-work.md)).

## Share roles

Everyone who walks gets moments, alike: an **Editor**, a **Participant** and a **Viewer**. A moment changes nothing in
the document and sends nothing, so there is nothing to gate.

## Reduced motion

Under reduced motion (the system setting or the app's preference) **no moment plays**: nothing moves, and nothing
stands in for it. The pieces' own resting loops already hold still there ([Social pieces](social-pieces.md)).

## Cost

- **Nothing runs while nobody is near.** Each moment is a one-shot CSS animation on transform and opacity, mounted
  only when it plays; there is no loop, no timer and no JavaScript per frame.
- **Per step**: the pieces with a moment are picked out of the board once per change of the elements, and each step of
  your feet checks only those, one box test each, with no allocation. A step that changes nothing re-renders nothing;
  a moment re-renders only the one piece it plays on.

## Not in scope

- Sound, shared moments, moments on a press, and moments for other pieces (a bookshelf's book, the hammock swaying):
  follow-ups.
- A moment in an export or a still image.
