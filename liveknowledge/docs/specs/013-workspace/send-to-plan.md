# Send to Plan

What liveknowledge sends with [Send to Plan](../../../../liveworkspace/docs/specs/004-index/send-to-plan.md) (Work Tracker 1365), where its entry and chip sit, and who sees them. The
picker, the card, sending again, the chip's states and the limits are the platform's; this file says only what is
liveknowledge's own.

## What it sends

- **Picked words**: while a page's text is edited, the text toolbar's **Send to Plan**: a TODO, a list item, a
  checklist item, a paragraph, or the whole text when nothing is picked.
- **A block of text**: the element menu's **Resources** category, **Send to Plan**; for a Participant or a Viewer, a
  **Send to Plan** button on the selection toolbar.
- **An element's thread**: the thread's header, **Send to Plan** beside Resolve; **a page's thread**: its card's
  **Send to Plan**. The words are the thread's first comment.

Each place's link opens this knowledgebase at the place (`#t=<tab>&el=<element>`, with `&open=comments` for a thread), as
an Inbox row does (lib/collab-deep-link.ts). The words are what the person sees, never the stored markup.

## The chip

- **On the page**, a chip at the top right corner of the block the words were sent from, at a steady size; not in
  an export, a thumbnail or an agent's read.
- **On a thread**, the thread's own chip in place of the button.

Clicking a chip opens the card in liveplanner in a new browser tab; a chip never takes the canvas's selection, drag or
keys.

## Who sees it

| Role                             | Entry                                | Chips |
| -------------------------------- | ------------------------------------ | ----- |
| Editor                           | Text toolbar, element menu (Resources), a thread's header | Yes   |
| Participant                      | Selection toolbar, a thread's header | Yes   |
| Viewer                           | Selection toolbar, a thread's header | Yes   |
| Guest, Offline, embed, Community | None (the platform's "Who may send") | No    |

A send needs only read access here: what decides is the person's Edit on the plan they pick, which the picker and the
index check. A chip shows only to a reader who can open its plan.

## Telemetry

The platform's `send_to_plan_*` events, with `app: liveknowledge`.
