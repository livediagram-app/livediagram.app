# Send to Plan

What livehuddle sends with [Send to Plan](../../../../liveworkspace/docs/specs/004-index/send-to-plan.md) (Work Tracker 1365), where its entry and chip sit, and who sees them. The
picker, the card, sending again, the chip's states and the limits are the platform's; this file says only what is
livehuddle's own.

## What it sends

livehuddle has no comments or actions ([Not in livehuddle](../002-project-scope/not-in-livehuddle.md)): a Space's
stickies are its meeting's action items, so they are what it sends.

- **A sticky**: the element menu's **Send to Plan**; for a Participant or a Viewer, a **Send to Plan** button on the
  selection toolbar.
- **A selection of stickies**: the selection's menu, **Send to Plan**: one card each, or one card with a checklist.
- **Send All**: the tab menu's **Send Stickies to Plan**, every sticky on the tab with words, one card each, at most 20
  (the platform's `PLAN_SEND_CARDS_MAX`); a tab with more sends the first 20 in reading order and says so.

Each place's link opens this Space at the place (`#t=<tab>&el=<element>`, with `&open=comments` for a thread), as
an Inbox row does (lib/collab-deep-link.ts). The words are what the person sees, never the stored markup.

## The chip

- **On the wall**, a chip at the top right corner of each sent sticky, at a steady size; not drawn in an export or a
  thumbnail.

Clicking a chip opens the card in liveplanner in a new browser tab; a chip never takes the canvas's selection, drag or
keys.

## Who sees it

| Role                             | Entry                                | Chips |
| -------------------------------- | ------------------------------------ | ----- |
| Editor                           | Element menu, the selection menu, the tab menu's Send Stickies to Plan | Yes   |
| Participant                      | Selection toolbar, the tab menu's Send Stickies to Plan | Yes   |
| Viewer                           | Selection toolbar, the tab menu's Send Stickies to Plan | Yes   |
| Guest, Offline, embed, Community | None (the platform's "Who may send") | No    |

A send needs only read access here: what decides is the person's Edit on the plan they pick, which the picker and the
index check. A chip shows only to a reader who can open its plan.

## Telemetry

The platform's `send_to_plan_*` events, with `app: livehuddle`.
