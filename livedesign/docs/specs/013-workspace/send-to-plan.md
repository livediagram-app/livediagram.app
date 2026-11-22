# Send to Plan

What livedesign sends with [Send to Plan](../../../../liveworkspace/docs/specs/004-index/send-to-plan.md) (Work Tracker 1365), where its entry and chip sit, and who sees them. The
picker, the card, sending again, the chip's states and the limits are the platform's; this file says only what is
livedesign's own.

## What it sends

- **A sticky, a shape or a text element with words**: the element menu's **Resources** category, **Send to Plan**;
  for a Participant or a Viewer, a **Send to Plan** button on the selection toolbar beside Comments.
- **A selection of several**: the selection's menu, **Send to Plan**: one card each, or one card with a checklist.
- **A comment thread**: the thread's header, **Send to Plan** beside Resolve.

Each place's link opens this design at the place (`#t=<tab>&el=<element>`, with `&open=comments` for a thread), as
an Inbox row does (lib/collab-deep-link.ts). The words are what the person sees, never the stored markup.

## The chip

- **On the canvas**, a chip at the top right corner of each sent element, at a steady size whatever the zoom; not
  drawn in an export, a thumbnail or the photo editor.
- **In a thread's header**, the thread's own chip in place of the button.

Clicking a chip opens the card in liveplanner in a new browser tab; a chip never takes the canvas's selection, drag or
keys.

## Who sees it

| Role                             | Entry                                | Chips |
| -------------------------------- | ------------------------------------ | ----- |
| Editor                           | Element menu (Resources), the selection menu, a thread's header | Yes   |
| Participant                      | Selection toolbar, a thread's header | Yes   |
| Viewer                           | Selection toolbar, a thread's header | Yes   |
| Guest, Offline, embed, Community | None (the platform's "Who may send") | No    |

A send needs only read access here: what decides is the person's Edit on the plan they pick, which the picker and the
index check. A chip shows only to a reader who can open its plan.

## Telemetry

The platform's `send_to_plan_*` events, with `app: livedesign`.
