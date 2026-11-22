# Send to Plan

What liveplanner sends with [Send to Plan](../../../../liveworkspace/docs/specs/004-index/send-to-plan.md) (Work Tracker 1365), where its entry and chip sit, and who sees them. The
picker, the card, sending again, the chip's states and the limits are the platform's; this file says only what is
liveplanner's own.

## What it sends

- **A card's comment thread**: the thread's menu, **Send to Plan**: another plan's card from this one's discussion
  (a send to the same plan is allowed). The words are the thread's first comment.
- **A comment panel's thread on a board's canvas**: its header, **Send to Plan** beside Resolve.

Each place's link opens this plan at the place (`#t=<tab>&el=<element>`, with `&open=comments` for a thread), as
an Inbox row does (lib/collab-deep-link.ts). The words are what the person sees, never the stored markup.

## The chip

- **On the thread**, its chip beside the thread's title.

Clicking a chip opens the card in liveplanner in a new browser tab; a chip never takes the canvas's selection, drag or
keys.

## Who sees it

| Role                             | Entry                                | Chips |
| -------------------------------- | ------------------------------------ | ----- |
| Editor                           | A thread's menu | Yes   |
| Participant                      | A thread's menu | Yes   |
| Viewer                           | A thread's menu | Yes   |
| Guest, Offline, embed, Community | None (the platform's "Who may send") | No    |

A send needs only read access here: what decides is the person's Edit on the plan they pick, which the picker and the
index check. A chip shows only to a reader who can open its plan.

## Telemetry

The platform's `send_to_plan_*` events, with `app: liveplanner`.
