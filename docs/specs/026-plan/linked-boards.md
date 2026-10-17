# Linked boards

A **linked board** is a Board tab that collects a kind of record people make on the canvas, so the record and its
card are one thing seen in two places. The **Actions board** collects every assigned action in the document
([Assigned actions](../012-collaboration/assigned-actions.md), [The Action Panel](../012-collaboration/action-panel.md)):
add an action anywhere and its card is on the board; move the card to Done and the action on the canvas is ticked.

The Decisions board (collecting [Decision records](../012-collaboration/decision-record.md)) is the next linked board
and builds on the same link; it is specified when it is built.

## Why

Actions are made where the conversation happens: on the diagram, beside the box they are about, on an Action panel
in a retro. Tracking them happens somewhere else: a board, with columns, filters and who has what. Until now the two
never met. Someone copied actions onto a board by hand, and the copies went stale the moment either side changed.

The canvas is where an action is **agreed**; the board is where it is **worked**. A linked board makes them the same
action, so nobody re-types it and neither place lies.

## Domain language

| Term              | Means                                                                                         | Never called              |
| ----------------- | --------------------------------------------------------------------------------------------- | ------------------------- |
| **linked board**  | A board whose setup `collects` a kind of canvas record                                        | synced board, auto board  |
| **Actions board** | The linked board that collects actions: the document's first board with `collects: 'actions'` | action list, to-do board  |
| **linked card**   | A card made for one canvas record, carrying its **link**                                      | mirror, copy, shadow card |
| **link**          | The card's `linked` field: which record it is for, and where that record was last seen        | source, reference, ref    |
| **Won't Do**      | An action's third status: decided against, closed without being done                          | cancelled, rejected       |

## The Actions board

- A Board tab named **Actions**, holding one board titled **Actions** with three columns in this order: **New**,
  **Done** (the done column) and **Won't Do**. Its cards are **Compact**, showing the card number, who has it and when
  it is due; it takes the **Action** card type only, and its header shows the Completion and Due Soon widgets.
- It is in the theme of the tab the first action was made on.
- Columns reuse the document's states of the same name ([One name, one state](plan-board.md#one-name-one-state)), so
  a document that already has a Done keeps one Done.
- It is an ordinary board in every other way: its columns can be renamed, added, removed and reordered; cards can be
  given due dates, checklists, labels and comments; it can be filtered and laned. A column someone adds before Done
  is another open column; one after Done closes the action as Won't Do.

### When it appears

- The **first time an action is added** to a document that has no Actions board, the Actions board tab is made after
  the last tab, in the same moment, and every action already in the document (on any loaded tab) gets its card. The
  person who added the action sees one notice: **Added to Your Actions Board** with **Open Board**.
- It is made once. Every later action, on any tab, goes to the same board.
- Deleting the Actions board tab stops nothing permanently: the next action added makes it again. Undo of that
  delete brings the tab back with its cards, which were never removed (cards outlive their boards).
- A document with no actions has no Actions board. Nothing is made by opening a document.

## The link

Each action has exactly one linked card, made of the **Action** type:

- The card's **id** is fixed by the action's id, so two people adding cards for the same action at once make one
  card, never two.
- Its **link** (`linked`) names the action and where it was last seen: its tab and its element. The action's own id
  is the key; the tab and element are a hint for finding it, kept current when an element moves to another tab.
- What each side owns:

| What                 | Owned by   | Edited on the card?                                                                      |
| -------------------- | ---------- | ---------------------------------------------------------------------------------------- |
| Name / title         | both       | Yes. Either edit reaches the other                                                       |
| Description          | both       | Yes. Either edit reaches the other                                                       |
| Status               | both       | Yes. Moving the card changes the action; ticking the action moves the card               |
| Assignee             | the action | No. The card shows who has it; the item panel says **Change on the Action** and opens it |
| Due, checklist, etc. | the card   | Yes. They are the board's, and the canvas does not show them                             |

- **Status**, card to action: a column before the done column is **open**, the done column is **done**, a column
  after it is **Won't Do**. Action to card: open goes to the board's first column (unless the card is already in an
  open column, where it stays), done to the done column, Won't Do to the first column after Done (or Done, on a board
  that has no column after it).
- A card in a status the Actions board does not show (moved there on another board, or in the Trash) does not change
  its action.
- **Deleting** the action deletes its card. **Deleting the card** (Delete, not Trash) deletes its action too, since
  they are one thing; the notice says **Deleted the Card and Its Action**. Trashing or archiving the card leaves the
  action where it is.
- Copying, duplicating or pasting an element never carries its actions ([Assigned actions](../012-collaboration/assigned-actions.md)
  §1), so it never carries a card.

### Keeping them together

- The person who changes either side writes both at once, so the board and the canvas move together for everyone in
  the room.
- Every Editor's editor also **heals** what it can see, a moment after things settle: an action with no card gets one;
  a card and action that disagree are put right by whichever changed last (each side keeps when it was last changed).
  This catches what no person's click did: a Participant moving a card (they may not change the canvas), an agent's
  change, a card made before the board existed, a write that failed.
- Healing only ever **adds cards and changes fields**. It never deletes, because an action on a tab not loaded yet is
  not a missing action.

## On the canvas

- An action has three statuses: **Open**, **Done** and **Won't Do**. Won't Do counts as closed everywhere open and
  closed are counted: the Action panel's open count and All Done chip, the Collaborate panel's Open and Resolved sides,
  the Inbox (never listed), the badge, the export.
- **Action panel rows**: the round check still completes and reopens. A Won't Do row shows a grey slashed circle in
  place of the check (pressing it reopens), its name struck through and muted, and **Won't Do** beside the assignee.
- **The action popover** and the **Assign Action dialog** (editing) offer **Won't Do** beside Mark Done; a closed
  action offers **Reopen**.
- **Where it went**: an Action panel on a document with an Actions board shows a small **Actions Board** chip in its
  header (the board's glyph and an arrow), and the popover a **View on Board** link. Both open the Actions board tab
  and open the action's card.

## On the board

- A linked card's item panel opens with a quiet banner: the action glyph, **Linked to an action on <tab name>**, and
  **Show on Canvas**, which opens that tab with the element selected and its action shown (the popover, or the panel
  scrolled to the row), as the Inbox's links do ([Inbox](../013-workspace/inbox.md) §1).
- Its Assignee field is read-only, with **Change on the Action** opening the Assign Action dialog for it.
- The card face is an ordinary Action card.

## The Inbox

A linked card is not listed in the Inbox as a card: its action already is, once ([Inbox](../013-workspace/inbox.md)
§2.4). The card's assignee is the action's assignee as Plan names people, so the board's Mine filter and
assignee lanes work.

## Share roles

| Role        | Actions board                                                                                                                                                                                         |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Editor      | Everything above. Adding the first action makes the board. Their editor heals.                                                                                                                        |
| Participant | Works the cards as any Plan card (move, edit title and description, comment). They may not change actions, so their card moves reach the canvas when an Editor's editor heals. Never makes the board. |
| Viewer      | Sees the board and the banner; Show on Canvas works; nothing is changed.                                                                                                                              |

## Agents

An agent sees linked cards as ordinary cards (`list_items`) carrying their `linked` field, and actions as ever
(`read_document`). Changing either through the tools is healed into the other by the next Editor's editor.

## Telemetry

- `Action` `Linked` `Board`: the Actions board was made.
- `Action` `Resolved` `WontDo`: an action was set to Won't Do (from the panel, popover or dialog).
- `Action` `Opened` `Board`: Actions Board chip or View on Board.
- `Card` `Opened` `Canvas`: Show on Canvas.

## Not in scope

- Picking which board collects actions, or more than one Actions board. The first one collects.
- Assigning from the card. Choosing an assignee needs the action's team picker and email toggle.
- Offline Mode documents: they have no item store sync to heal against; their actions and cards link the same way while
  the editor is open.
