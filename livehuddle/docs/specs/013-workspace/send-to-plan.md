# Send to Plan

What livehuddle sends with [Send to Plan](../../../../liveworkspace/docs/specs/004-index/send-to-plan.md) (Work Tracker 1365), where its entry and chip sit, and who sees them. The
picker, the card, sending again, the chip's states and the limits are the platform's; this file says only what is
livehuddle's own.

## What it sends

livehuddle has no comments or actions ([Not in livehuddle](../002-project-scope/not-in-livehuddle.md)): a Space's
stickies are its meeting's action items, so they are what it sends.

- **A sticky**: the **Send to Plan** button on its selection toolbar. A Participant's or a Viewer's toolbar holds that
  button alone (every other button there is an Editor's), and shows only on a sticky with words while they may send.
- **A sticky read while walking**: a walking click opens the sticky's reader and selects nothing, so the reader's
  footer has **Send to Plan** (for a sticky or a text with words, every role that may send). The reader closes as the
  picker opens; once sent, the card's chip stands in the footer instead.
- **A selection of stickies**: the selection's toolbar, **Send to Plan**: one card each, or one card with a checklist.
- **Send All**: for an Editor, the tab menu's **Send Stickies to Plan**, every sticky on the tab with words, one card each, at most 20
  (the platform's `PLAN_SEND_CARDS_MAX`); a tab with more sends the first 20 in reading order and says so.

Each place's link opens this Space at the place (`#t=<tab>&el=<element>`, with `&open=comments` for a thread), as
an Inbox row does (lib/collab-deep-link.ts). The words are what the person sees, never the stored markup.

## The chip

- **On the wall**, a disc at the top right corner of each sent sticky: the plan glyph, a tick once the card is done,
  hidden below the zoom the other adornments hide at; not drawn in an export or a thumbnail.

Clicking a chip opens the card in liveplanner in a new browser tab; a chip never takes the canvas's selection, drag or
keys.

## Who sees it

| Role                             | Entry                                                                                  | Chips |
| -------------------------------- | -------------------------------------------------------------------------------------- | ----- |
| Editor                           | The selection toolbar, a walking reader's footer, the tab menu's Send Stickies to Plan | Yes   |
| Participant                      | The selection toolbar, one or several (Send to Plan alone); a walking reader's footer  | Yes   |
| Viewer                           | The selection toolbar, one or several (Send to Plan alone); a walking reader's footer  | Yes   |
| Guest, Offline, embed, Community | None (the platform's "Who may send")                                                   | No    |

A send needs only read access here: what decides is the person's Edit on the plan they pick, which the picker and the
index check. A chip shows only to a reader who can open its plan.

## Telemetry

The platform's Send to Plan events (`UI·Opened·SendToPlan`, `UI·Created·SendToPlan`, `UI·Refused·SendToPlan`, `UI·Opened·SentCard`), sent under this app's name.
