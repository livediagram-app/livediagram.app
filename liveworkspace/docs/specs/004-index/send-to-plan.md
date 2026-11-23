# Send to Plan

**Send to Plan** turns anything that reads as a task, in any app, into a liveplanner card (Work Tracker 1365): a
sticky in a retro, a shape on a design, a paragraph or a checklist item in a document or a knowledgebase page, a
comment thread, an action from a huddle. Work gets found everywhere, and liveplanner is where it is tracked; without
this it stays where it was found, or is typed again.

The card links back to the exact place it came from, and the place shows the card's status, live, in a small chip.
The platform holds what every app would otherwise build again: the card made through liveplanner's own door as the
person, the link between the card and its source, the chip's live status, and the picker and chip themselves (one copy
in `@liveworkspace/workbench`). What each app sends, and where its entry and chip sit, is that app's spec
(`<app>/docs/specs/013-workspace/send-to-plan.md`); the card's Sent From row is liveplanner's
([items.md "Sent From"](../../../../liveplanner/docs/specs/026-plan/items.md#sent-from)).

## Names

- The **source** is the item the thing came from (a diagram, a design, a document, a knowledgebase, a Space, or a
  plan); its **place** is the exact thing in it: an element, the words picked in an element's text, an element's comment
  thread, a knowledgebase page's thread, a card's thread, or an element's assigned action.
- The **target** is the plan the card is made in, always a liveplanner item.
- A **send** is the index's record of one card made from one place: the source item and its place, the plan and its
  card, and the card's title, column and whether it is done, as the plan last said (`PlanSend`). One card made from
  several places (a selection sent as one card with a checklist) has one send per place.
- A place is named by its **ref**, `kind:tab:element:part` (`planSendRef`), the same for every app: `element` (a sticky
  or a shape), `text` (picked words in an element: `part` is a short hash of the words, so the same words sent again
  match), `thread` (an element's thread, `part` empty; a knowledgebase page's or a card's thread, `part` the thread id),
  `action` (`part` the action id).

## Who may send

- **Edit on the target**, the whole plan: its owner, a joined member of its team, or someone holding an Editor's link
  they opened. A tab-scoped link's holder, a Participant or a Viewer of the plan sends nothing to it.
- **Read on the source**, nothing more: a Viewer of a diagram sends its sticky to their own plan. The index checks the
  person's own access to the source (owner, team, a live link they opened, any level) on every send.
- **A signed-in account.** A guest has no plans of their own to keep the card in. An item kept Offline, an embed, a
  workbench frame and a Community copy offer no entry: none has the index to hand.
- Sending **never changes the source's content.** The chip is drawn beside the place; it is not part of the item, is not
  saved in it, and no export, copy, Community copy or agent's read of the item carries it.

## The picker

Opened from the place's menu (each app's spec says where), a dialog centred on screen, a bottom sheet on a phone:

1. **Plan**: the person's plans, most recent across every app first (the index's Recent, `app=liveplanner`), with a
   search, and **New Plan**, which makes an empty Kanban plan of the person's own (named as they type, "Plans from
   <source title>" by default) through liveplanner's template door and picks it. A plan they cannot edit is not listed:
   the boards read (below) refuses it, and the row says "You can't add cards to this plan".
2. **Board** and **Column**: the plan's boards and each one's columns, read through liveplanner's own door with the
   person's grant (`GET /items/:id/automation-target`, an Editor's alone). The first board and its first column are
   picked until the person picks another.
3. **The card**: its **Title**, from the words (below), editable; **Assignee**, the plan person a mention names, or
   anyone of the plan's people, or nobody; **Due**, a date the words name, or one picked, or none. A send of several
   places offers **One Card Each** (the default) or **One Card with a Checklist** (the first place's words the title,
   every place a checklist row).
4. **Send to Plan** makes the card(s) and closes; a toast says "Sent to <plan>" with **Open Card**.

The plan, board and column are **remembered per source item** in this browser (local storage, one entry per item, the
newest 50 kept): the next send from the same item opens on them. Every row and control is reachable by Tab, the lists by
the arrow keys, Enter sends from the title, Escape closes; on a phone the sheet fills the width and every target is at
least 44 px.

### From the words

The words are the place's own text, as the person sees it: a sticky's or a shape's label, the words picked, the
thread's first comment, the action's name. Read left to right by a tokenizer (never a regular expression with repeats):

- **Title**: the first line, at most 120 characters, cut at a word; mentions and the date words taken out.
- **Mention**: the first `@Name` (or a comment's structured mention) is matched to the plan's people by name, ignoring
  case; no match leaves the card unassigned and says "Nobody in this plan is called <name>".
- **Due**: the first date written: `2026-12-01`, `1 Dec`, `Dec 1`, `today`, `tomorrow`, or a weekday after "by" or
  "on" ("by Friday", the next one). A date before today is kept as written.
- **Description**: every word sent, then a line back: "From <source title>, <place> (<app>): <link>", the link opening
  the source at the exact place (`#t=<tab>&el=<element>`, with `&open=comments` or `&open=action` for a thread or an
  action; a plan card's thread as `#item=<card>&thread=<id>`), its app's own address (`appSiteOrigin`).

## The card

Made by liveplanner's door as the person who sent it (their stamp, the plan's history saying they made it, a rule there
hearing a person's create, never an automation's): the board's first card type it takes, in the column picked, with
the title, the description, the assignee and the due date; a checklist when one card was asked for. It also carries
**Sent From** (`sentFrom`): the source's app, item, place and words, which the card panel shows with the app's logo and
a link to the place. A plan that holds as many cards as it may, or a board gone since the picker read it, refuses with
its reason, and nothing is made.

## Sending again

A place already sent to a card that is not in the Trash offers the card instead: the picker opens on "Already sent to
<plan>" with **Open Card** first and **Send Again** beside it (a second card, a second send). The index refuses a second
send of the same place to the same plan unless it asks again (`again: true`), so two clicks never make two cards.

## The chip

Beside each sent place, in every app that shows it, a small chip: the plan's logo, the card's column and the plan's
name ("In Progress · Launch"), its title on hover. Clicking it opens the card in liveplanner in a new browser tab. When
the card is in a done column the chip ticks ("Done · Launch", a check where the logo was) and quietens. A card in the
Trash shows no chip, and the place may be sent again. A place sent to several cards shows the newest chip and "+N".

- **Only for those who may see the card.** A reader of the source sees a send's chip only when they can open its plan
  themselves; to anyone else the place shows nothing, so the plan's name and the card's progress never reach a reader
  who could not open them. The sender always can.
- **Live, never polled.** liveplanner tells the index when a sent card's title, column, done state or Trash changes,
  gathered for `PLAN_CARDS_SETTLE_MS` (1.5 s), as one call (`POST /app/items/:id/plan-cards`, at most
  `PLAN_CARDS_CHANGED_MAX` cards). The index updates the sends and tells each source item whose send changed (at most
  `PLAN_SEND_SOURCES_SIGNAL_MAX` (50) a call, ten at a time) through its app's `source-changed` door, naming the cards;
  that item's room tells its open sessions, and each reads its item's sends again with its own access. The signal names
  ids, never titles or columns.
- A missed signal costs only freshness: every open of the source reads its sends again.
- **Where it sits.** On a canvas, the chip is one of the element's own indicators (each app's
  `docs/specs/008-canvas/element-indicators.md`): the plan glyph, a tick once done, its title and where it stands on
  hover. In a thread's header it is the chip with its words. livehuddle, which has no element indicators, draws it as a
  disc on the sticky's top right corner.

## Agents

liveplanner's MCP and CLI make cards with a source: `change_items`' `add` takes `sentFrom` (`{app, itemId, tabId?,
elementId?, text}`). liveplanner keeps it on the card, and asks the index to record the send for the person whose
token it is; the index records it only when that person can read the source, so an agent never makes a chip appear on
an item its person could not open. Agents read a card's Sent From with the card.

## Limits

| Limit                          | Value | What it bounds                                        |
| ------------------------------ | ----- | ----------------------------------------------------- |
| `PLAN_SEND_CARDS_MAX`          | 20    | Cards one send makes (Send All on a huddle's actions) |
| `PLAN_SEND_CHECKLIST_MAX`      | 50    | Checklist rows on one card                            |
| `PLAN_SENDS_PER_SOURCE_MAX`    | 500   | Sends one source item holds; the next is refused      |
| `PLAN_SEND_READ_MAX`           | 200   | Sends a source's read answers, newest first           |
| `PLAN_SEND_PLANS_CHECKED_MAX`  | 20    | Plans a read checks the reader's access to            |
| `PLAN_CARDS_CHANGED_MAX`       | 100   | Cards in one of liveplanner's change calls            |
| `PLAN_SEND_SOURCES_SIGNAL_MAX` | 50    | Source items one change call tells                    |
| Sends a person                 | 10/m  | The kit run limiter (`KIT_RUN_LIMITER`), its own key  |

## Security

- **No backdoor.** The card is made by liveplanner's internal door, which checks the index's grant for the person at
  Editor on the whole plan before it writes, as a step in another app is ([automations.md "Steps in other
  apps"](../018-automations/automations.md)). The index mints that grant only after its own access check.
- **No new pass.** A send makes no share link and widens nothing: the source's chip shows to readers who can already
  open the plan, the card's Sent From link opens the source at whatever its reader's own access gives.
- **Nothing secret in the source.** A share code is never part of a send or a link.
- **Purges.** A send goes with its source item or its plan (the rows cascade from both). It holds no person.

## Telemetry

Each app sends Send to Plan's events under its own name through the workbench's `track`, in the UI category, typed by
the feature and never by a plan, an element or any words: `UI·Opened·SendToPlan` (the picker opened),
`UI·Created·SendToPlan` (a send made its cards), `UI·Refused·SendToPlan` (a send turned away or unable to reach the
plan) and `UI·Opened·SentCard` (a chip clicked). Charted on the site's telemetry page as the Send to Plan stack in every
app (`apps/site/app/telemetry/_shared/send-to-plan-metrics.ts`).
