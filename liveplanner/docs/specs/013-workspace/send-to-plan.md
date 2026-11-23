# Send to Plan

What liveplanner sends with [Send to Plan](../../../../liveworkspace/docs/specs/004-index/send-to-plan.md) (Work Tracker 1365), where its entry and chip sit, and who sees them. The
picker, the card, sending again, the chip's states and the limits are the platform's; this file says only what is
liveplanner's own.

## What it sends

- **A comment panel's thread on a canvas**: its header, **Send to Plan** beside Resolve: another plan's card from this
  one's discussion (a send to the same plan is allowed). The words are the thread's first comment.
- **A card's own thread**: the thread's tile in the card panel, **Send to Plan** left of its ⋯ menu, for everyone who
  reads the card (a Viewer too, who has no ⋯ menu). The place is the card, its `part` the thread's id, with no tab:
  several threads share one card, and a thread shared by several cards is sent once from whichever shows it.

Each place's link opens this plan at the place (`#t=<tab>&el=<element>`, with `&open=comments` for a canvas thread;
`#item=<card>&thread=<id>` for a card's thread, which opens the card with that thread open), as an Inbox row does
(lib/collab-deep-link.ts). The words are what the person sees, never the stored markup.

## The chip

- **On the thread**, its chip in the header, in place of the button: a canvas thread's in the comment panel, a card's
  thread's on its tile, each thread its own.

Clicking a chip opens the card in liveplanner in a new browser tab; a chip never takes the canvas's selection, drag or
keys.

## Who sees it

| Role                             | Entry                                   | Chips |
| -------------------------------- | --------------------------------------- | ----- |
| Editor                           | A thread's header, a card thread's tile | Yes   |
| Participant                      | A thread's header, a card thread's tile | Yes   |
| Viewer                           | A thread's header, a card thread's tile | Yes   |
| Guest, Offline, embed, Community | None (the platform's "Who may send")    | No    |

A send needs only read access here: what decides is the person's Edit on the plan they pick, which the picker and the
index check. A chip shows only to a reader who can open its plan.

## Telemetry

The platform's Send to Plan events (`UI·Opened·SendToPlan`, `UI·Created·SendToPlan`, `UI·Refused·SendToPlan`, `UI·Opened·SentCard`), sent under this app's name.
