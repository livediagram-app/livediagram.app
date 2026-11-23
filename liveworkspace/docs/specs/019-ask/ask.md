# Ask AI

Owner, 2026-11-23: "In liveknowledge we have an ask tab, I love it and want to apply it across other apps". Every
other app (livediagram, liveplanner, livedocuments, livedesign, livehuddle) has an **Ask AI** tool in the footer's
[Tools](../004-index/footer-tools-menu.md): a question typed there is answered from the open item's own words, with
the places the answer came from. liveknowledge keeps its own Ask, a tab of its own with a search index, trust and
knowledge gaps ([search-and-ask.md](../../../../liveknowledge/docs/specs/030-knowledgebase/search-and-ask.md)); it has
no Ask AI row.

One package builds it for every app, `@liveworkspace/ask`: the pure part (bounds, passages, the request, the answer's
reader, shared with liveknowledge's Ask), the route (`/server`) and the tool (`/ui`). Each app keeps a thin door: its
route's line, its room's count method, and what its editor hands the tool.

## The tool

- **The row.** **Ask AI**, under **Find** after Search, with the sparkle glyph and the line "Ask a question, get an
  answer from this canvas." (the app's own noun). It shows whenever an item is open. Signed out, it carries the
  **Sign In** badge.
- **It opens inside Tools**, under the shared back bar ("Tools", the chip **Ask AI**), and Tools stays open while the
  person works on the canvas beside it (`keepOpen`), so going to a source leaves the chat where it was.
- **Signed out**: an empty state, **Sign In to Ask AI**, with a Sign In button that returns to the item.
- **First open**: **Ask About This Canvas**, one line on where answers come from, and up to three questions under
  **Try Asking**, in the app's own words; pressing one asks it.
- **The conversation** is a thread: the question as a bubble at the right in the brand's colour, the answer under it
  beside a small sparkle mark. While it streams the answer is plain text ("Reading…" until the first words), heard
  by a screen reader once it has ended. A finished answer is formatted (paragraphs, lists, bold and code) with its
  citation chips; nothing the model writes is ever HTML or a link.
- **Under a finished answer**: its **Sources** pill (the first three numbers stacked, then "3 Sources"), which AI
  answered ("Built-In AI", or the model's name), and **Copy Answer** (the answer without its markers).
- **A question that failed** shows the failure's fixed words in a warning callout with **Ask Again**. **Stop** ends
  a streaming answer and keeps what had arrived.
- **The field** is at the foot: Enter sends, Shift and Enter make a new line, 1,000 characters at most with a count
  from 900. Inside it, at the left, the AI pill (below); at the right **New Chat** (once there is a turn) and Send,
  which becomes Stop while an answer streams. Opening the tool puts the caret in the field.
- **The conversation is the page's**: kept in memory per item while the page is open, so closing Tools and opening it
  again finds the thread; a reload starts afresh. Nothing of it is stored in the browser or on the server. It keeps
  its 10 newest turns.

## Sources

Tools is 480 px wide: there is no room for liveknowledge's Sources rail. Pressing a citation chip or an answer's
Sources pill opens **Sources** in a popover beside Tools (the shared side popover: at Tools' right, else its left; a
drawer from the bottom on a phone).

- Every source the answer cites is a card, in the order cited: its number, its title, what it is ("Shape", "Sticky
  Note", "Card"), the tab it is on, its text with the question's words softly marked, and **Show in Canvas** (the
  app's noun).
- A pressed chip's card is **lit** (the brand's border and ring), brought into view and focused. The pill opens them
  with none lit.
- Pressing a card goes to its place: the tab opens and the element is selected (a card opens, in liveplanner). The
  popover and the chat stay open.

## What is sent

The editor already holds the item: the tabs its Search panel reads. Asking loads every tab (as Search does), and makes
a **passage** of each element that holds words: its label, a table's cells, and what the app adds (a card's title and
description in liveplanner). A passage carries its id, its tab's id and name, the element's id, its kind and a title.

- An item whose words fit the bounds is sent **whole**, in its own order, so "summarise this" is answered from all of
  it.
- A larger one sends the passages the question's words are found in, best first (a word in a title counts three
  times one in the text), then the rest in order, until the bounds are met. A follow-up is ranked with the earlier
  questions' words too, at a lower weight.
- Bounds: 200 passages, 24,000 characters of passage text, 2,000 a passage, 200 a title. The server holds them again.
- Earlier turns go as their question and answer alone (citations taken out); only the new question carries passages.

The words are the person's own item, sent by the person who can read it: the server reads no item. An item kept
Offline can be asked about for the same reason.

## The route

`POST /api/ask` on each app's api, the same in every app (`serveAsk`): `{ question, passages, turns?, teamId?, ai? }`.

- **For a signed-in account only** (`403 ask_needs_account` otherwise): a guest or a link visitor would spend built-in
  AI for strangers.
- Answered as server-sent events: `delta` pieces of the answer, then one `done` (`text`, `sources`, `provider`,
  `model`), or one `error` (`kind`, `message`, and `aiKey` when a key failed). A refusal before the stream opens is
  JSON `{ error, message }`: `400 ask_invalid`, `422 ask_nothing_to_read`, `503 ask_unavailable`,
  `429 ask_built_in_limit`, `422 ai_key_failed`.
- The model is told to answer only from the passages, to cite each claim by passage number, to say what they do not
  cover, and to write no links. Passages and questions are fenced as material to read, never instructions. Only the
  numbers of passages that were sent become citations; they are renumbered 1 to n in the order first cited.
- Nothing logs the question, the passages, the answer or any part of a key: one line says how many passages were
  sent and cited, which provider and model, and how long it took.

## Choosing which AI answers

Ask AI follows [AI keys](../003-accounts/ai-keys.md) "Every AI feature honours the choice": the item's team's key for
a joined member, else the person's own, else built-in AI. Its source line is the **AI pill** in the field rather than
the row under it, since the tool is narrow.

- **The pill says which AI the next question runs on**: a sparkle and **Built-In AI**, or a key mark and the model
  with whose key it is ("Claude Fable 5.2 (Your Key)", "(Your Team's Key)"). A key that failed on the last question
  turns it amber, **Key Needs Attention**.
- **It opens Answer With**, a small menu over the field: **Built-In AI** ("Included with livediagram, with daily
  limits") and, where a key applies, the key ("Anthropic · Claude Fable 5.2 · No daily limits"). The one in use is
  ticked; picking the other switches, and applies to the next question, mid-chat too.
- **Its foot offers the way to a key**: **Use Your Own Key** with none saved, **Manage Keys** with one, **Fix Key**
  after a failure. Each opens the Settings panel on its AI category over Tools. A member of a team with a key sees no
  such action for the team's key.
- **The choice is the person's**, kept in this browser for the app (`liveworkspace:ask-ai:v1`); the key until they
  pick otherwise. Choosing built-in AI sends `ai: 'built-in'`.
- **A key that fails says so** and never falls back to built-in AI: the answer's callout has the provider's fixed
  words, and the pill offers Fix Key.
- Telemetry: `UI Used AskAi` (a question asked), `UI Opened AskAiSources`, `UI Opened AskAiSource`, `UI Used
AskAiCopy`, `UI Changed AskAiBuiltIn` / `AskAiKey`, and the source line's own `UI Opened AiSourceSettings` and
  `UI Added AiSourceKey`. None carries a question, an answer, a provider, a model or a key.

## Built-in AI's allowance

Built-in AI is the app's Workers AI binding, which the deployment pays for: **30 questions a person a UTC day, in each
app**, counted before the model is called. A question on a key counts toward none of it. At the cap the question is
refused with "You have used today's 30 built-in questions. Try again tomorrow, or use your own AI key." A count that
cannot be reached refuses the question rather than lifting the cap; a server with no `AI` binding says built-in AI is
not set up and points to a key.

The count lives in one instance of the app's existing item room Durable Object per account, named `~ask-ai:<account>`
(no item id starts with `~`): no new binding, class or migration. It holds only the day and how many.

## In each app

Each editor hands the tool its host (`AskHost`): the app, the open item's id, the account, the passages (read when a
question is asked), how to go to a source, and its suggested questions.

| App           | Passages from                                                         | A source opens                     |
| ------------- | --------------------------------------------------------------------- | ---------------------------------- |
| livediagram   | every tab's elements (labels, tables)                                 | its tab, the element selected      |
| liveplanner   | every tab's elements, and every card (title, description, its status) | the card, on the tab that shows it |
| livedocuments | every tab's elements                                                  | its tab, the element selected      |
| livedesign    | every tab's elements                                                  | its tab, the element selected      |
| livehuddle    | every tab's elements                                                  | its tab, the element selected      |

## Share roles

Asking reads the item and changes nothing, so every role that can open it may ask: **Editor**, **Participant** and
**Viewer** alike, once signed in. A guest and a visitor through a share link who is not signed in see the row badged
Sign In. What is sent is only what that person's editor holds, so a link confined to one tab asks about that tab
alone.

## What it costs

- **Nothing on load.** The Tools row is a small module of its own; the tool, the conversation and the popovers load
  when the row is first opened. The account's AI keys are read once then, as for every source line.
- **A question** loads the item's other tabs once (as opening Search does), walks its elements once, and sends at
  most 24,000 characters of passages. On the server: one accounts call for the key (unless built-in AI was chosen),
  one count on built-in AI, and one streamed model call.
