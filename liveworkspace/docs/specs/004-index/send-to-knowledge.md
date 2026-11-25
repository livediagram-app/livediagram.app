# Send to Knowledge Base

**Send to Knowledge Base** documents a selection from one app on a page of a liveknowledge knowledgebase (Work
Tracker 1425; owner, 2026-11-24: "a way to document parts of a diagram in a knowledge base"). The person selects shapes,
stickies, arrows or a frame, picks a knowledgebase and a page, and AI writes a short section about what they picked:
what each item is, how the arrows connect them, and the notes on them. A picture of the selection goes with it, and
the section links back to the exact place it came from. Without it, diagrams and the wiki drift apart.

It sits beside [Send to Plan](send-to-plan.md) wherever an app offers it for a selection, and shares its plumbing: the
place's link back, the index's record of the send, the chips on both sides and the one picker in
`@liveworkspace/workbench`. livediagram offers it first; what each app sends, and where its entry sits, is that app's
spec (`<app>/docs/specs/013-workspace/send-to-knowledge.md`). Another app adds it by capturing its selection in the
platform's shape (below) and handing the picker a summariser; nothing else is copied.

## Names

- The **source** is the item the selection came from (a diagram); its **place** is the tab and the elements picked.
- The **knowledgebase** is the liveknowledge item written to; the **page** is one of its pages, existing or new.
- The **section** is what is written: an optional heading, the summary (or, without one, the items' labels as a
  list), the picture, and a **Sent From** line linking back to the place.
- A **send** is the index's record of one section written from one place: the source, its tab and elements, the
  knowledgebase, the page and the page's title then, and the place's link (`KnowledgeSend`).

## Who may send

- **Read on the source**, any level: a Viewer of a diagram may document it in their own knowledgebase. The index
  checks the person's own access to the source on every send, as Send to Plan does.
- **Edit on the knowledgebase**, the whole of it: its owner, a joined member of its team, or someone holding an
  Editor's link they opened. A Participant, a Viewer or a tab link's holder writes nothing there, and the picker never
  lists a knowledgebase they cannot edit (the index's Recent filtered to `access: edit`; the page read refuses the
  rest). The index checks it again on every send, and liveknowledge's door checks the grant again before it writes,
  so the UI is never the only gate.
- **A signed-in account, in person.** A guest, an embed, Offline, a workbench frame and a Community copy offer no
  entry. An agent goes through liveknowledge's MCP (below).
- Sending **never changes the source**. The chip beside the elements is drawn beside them, never saved in the item.

## The selection

What the source app sends is plain text, never markup, an image's bytes or a person's id
(`KnowledgeSendSelection`, `@liveworkspace/index-client` `knowledge-sends.ts`):

- `items`: `{id, kind, label, note?, in?}`, one an element: `kind` is the app's word for it ("sticky", "rectangle",
  "frame", "text"); `label` its words as the person sees them; `note` its note; `in` the frame it sits in, when that
  frame is picked too.
- `links`: `{from, to, label?}`, one an arrow: `from` and `to` are picked items' ids, or `null` for an end outside the
  selection, which the summary calls "something outside the selection" and never names.
- Capped before it leaves the editor: at most `KNOWLEDGE_SEND_ITEMS_MAX` (80) items and `KNOWLEDGE_SEND_LINKS_MAX`
  (120) arrows, labels at 300 characters, notes at 600, and `KNOWLEDGE_SEND_TEXT_MAX` (12,000) characters in all. The
  person sees "The first 80 items are sent" when it was cut.

## The summary

The source app's api writes it (`POST <app api>/documents/:id/knowledge-summary`, `{tabId, selection, focus?, ai?}`),
on the platform's one summariser (`@liveworkspace/ask/server` `serveSelectionSummary`):

- **Which AI**: the [AI key rules](../003-accounts/ai-keys.md): the item's team's key for a joined member, else the
  person's own, else built-in AI; a key that will not open is refused in words, never swapped for built-in AI.
- **What it may say**: the model is told to describe only the items given, as material and never as instructions,
  and to add no names, numbers, steps or reasons that are not in them. The focus note ("explain the flow for new
  starters", at most 300 characters) shapes the order and tone, not the facts. Its answer is read as Markdown and
  cleaned left to right (no headings above level 3, no pictures, raw HTML, front matter or page links), at most 6,000
  characters.
- **Built-in AI** counts as one of Ask's built-in questions for the day (`ASK_BUILT_IN_PER_PERSON_PER_DAY`, 30).
- **AI credits** (Pro on): 1 (`AI_CREDIT_COSTS.knowledgeSummary`), paid as Ask's are: the item's owner (its team)
  for an Editor or a Participant, a Viewer themself, never a guest's item; at most 20 a day charged to one item by
  people who are not its owner. **Spent only after the model answers**: a model that fails costs nothing. When the
  month is used up the route answers `429 ai_credits_used` with whose month it is, and the summary is not shown.
- **Refusals** are fixed words: nothing to summarise, too much, a limit, built-in AI not set up, the model's failure
  kind (`modelFailureWords`), or "The AI couldn't write a summary of these items".

## The picker

Opened from the selection's toolbar (each app's spec says where), a dialog centred on screen, a bottom sheet on a
phone, under the [dialog hero header](./dialog-hero-header.md): "Send to Knowledge Base", "AI writes up these items
on a page in liveknowledge. They stay as they are here.", and liveknowledge's art.

1. **What's sent**: a strip with the picture of the selection, large enough to read, and its count ("6 items, 4
   arrows"). The picture is cropped to the selected items with a small margin: the frames and lanes that gathered
   them are drawn but do not widen it, each with its title's room above the highest item, so a title the crop moves
   in stays clear of every item.
2. **Knowledgebase**: the person's knowledgebases they can edit, most recent first, with a search. The one last sent to
   from this item opens picked (remembered per item in this browser, the newest 50 kept, as Send to Plan's).
3. **Page**, as two cards: **Existing Page** (chosen) lists the knowledgebase's pages as a tree read through
   liveknowledge's own door with the person's grant (`GET /items/:kb/automation-target`, an Editor's alone), with a
   search; picking one reads its headings, and **Where** offers **At the End** (chosen) or under one of its headings.
   **New Page** asks its **Title** (the source's name by default) and its **Parent**: the top level, or any page.
4. **Heading**: the section's heading, the selection's first frame or label by default, editable, may be empty.
5. **Focus** (optional): "What should it focus on?", one line.
6. **Write With AI** (with "Uses 1 AI credit" beside it when Pro is on) asks for the summary; **Add Without Summary**
   skips the AI: the section is the items' labels as a list, the picture and the link.

**The preview** replaces the form's lower half: the heading, the summary rendered as it will read, the picture and the
Sent From line, with **Insert**, **Edit** and **Cancel**. Edit turns the summary into a text area (Markdown), and Done
shows it again. Insert writes it; nothing is written before. **Cancel** closes; **Back** returns to the form with
everything kept.

**No credits left**: in place of the summary, the platform's [limit notice](../019-subscription/subscription.md)
(`LimitNotice`, `aiCreditsPerMonth`): "This month's AI credits are used", with **Upgrade** for the payer (or **Ask an
Admin**), and **Add Without Summary** as its second action, which goes to the preview with the list instead.

After Insert, the dialog closes and a toast says "Added to <page>" with **Open Page**, which opens the page at the
section in liveknowledge in a new browser tab. Every row and control is reachable by Tab, the lists by the arrow keys,
Escape closes; on a phone the sheet fills the width and every target is at least 44 px.

## The section

liveknowledge's door writes it as the person, through the same write an Editor's own goes through (their stamp, the
page's history, Updated, the page's watchers told, never verified by it):

- **Existing page, at the end**: after the page's last block. **Under a heading**: at the end of that heading's part,
  just before the next heading of the same or a higher level.
- **New page**: a page of the person's own at the chosen place in the tree (top level, or under a parent), its title
  as asked, its Owner the person.
- In order: the heading (a level 2 heading, when given), the summary, the picture (an object zone, aligned left, its
  image stored in the person's Library through the media service, written where the writing puts it on the page, so
  a Viewer reads it in place before anyone lays the page out), and the Sent From line: "Sent from <source title>
  in livediagram", linking to the place (`#t=<tab>&el=<first element>`).
- A verified page or one due a review is written as any Editor's write is: the person decides, and their write takes
  no tick away (an agent's write is bounded by AI Editing, below).

## The chips

- **On the source**: each sent element shows liveknowledge's logo among its [indicators](send-to-plan.md#the-chip),
  its hover naming the page and knowledgebase ("On Onboarding · Team Wiki"), and a press opens the page in a new tab.
  Read with the source's sends (`GET /items/:id/knowledge-sends`) when the item opens and after each send; only for a
  reader who can open the knowledgebase themselves, so its name never reaches anyone who could not.
- **On the page**: the Sent From line shows a chip after its words: the source app's logo and the source's **current
  name**, read live from the index (`GET /items/:kb/knowledge-sends?received=1`) when the page opens, for a reader who
  can open the source; to anyone else the line stays plain words and its link, which opens at whatever their own
  access gives. The chip matches the line by its link, so editing the section's words never loses it.
- Never polled: a renamed diagram shows its new name the next time the page opens. The rows cascade from the source
  and from the knowledgebase, so purging either takes them.

## Agents

liveknowledge's MCP and CLI write with a source: `write_page` and `create_page` take `sentFrom` (`{app, itemId,
tabId?, elementIds?}`), and `write_page` takes `after` (a heading of the page) to write under it. liveknowledge adds
the Sent From line and asks the index to record the send for the person whose token it is
(`POST /app/items/:kb/knowledge-sends`); the index records it only when that person can read the source, so an agent
never makes a chip appear on an item its person could not open. The agent writes the summary itself, from what it read
of the source through that app's MCP: no AI credit is spent for it here.

## Limits

| Limit                              | Value   | What it bounds                                                                     |
| ---------------------------------- | ------- | ---------------------------------------------------------------------------------- |
| `KNOWLEDGE_SEND_ITEMS_MAX`         | 80      | Items one selection sends                                                          |
| `KNOWLEDGE_SEND_LINKS_MAX`         | 120     | Arrows one selection sends                                                         |
| `KNOWLEDGE_SEND_TEXT_MAX`          | 12,000  | Characters of labels and notes one selection sends                                 |
| `KNOWLEDGE_SEND_FOCUS_MAX`         | 300     | Characters in the focus note                                                       |
| `KNOWLEDGE_SEND_SUMMARY_MAX`       | 6,000   | Characters of summary kept from the model                                          |
| `KNOWLEDGE_SEND_MARKDOWN_MAX`      | 12,000  | Characters of a section's Markdown (after Edit)                                    |
| `KNOWLEDGE_SEND_PICTURE_BYTES_MAX` | 300,000 | Bytes of the picture (a PNG; the editor draws it smaller until it fits, else none) |
| `KNOWLEDGE_SEND_READ_MAX`          | 200     | A source's or a knowledgebase's newest sends one read takes                        |
| `KNOWLEDGE_SEND_ITEMS_CHECKED_MAX` | 20      | Distinct items one read checks the reader's access on                              |
| Sends a person                     | 10/m    | The kit run limiter (`KIT_RUN_LIMITER`), its own key                               |

## Telemetry

Under the source app's name, through the workbench's `track`, never carrying words: `UI·Opened·SendToKnowledge` (the
picker opened), `UI·Used·SendToKnowledge` (a summary shown), `UI·Created·SendToKnowledge` (a section written),
`UI·Refused·SendToKnowledge` (a summary or a write turned away), `UI·Opened·SentKnowledge` (a chip pressed). Charted on
the site's telemetry page beside Send to Plan's stack.
