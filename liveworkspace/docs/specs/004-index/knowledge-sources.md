# Knowledge sources

A **knowledge source** is an item in another app that a liveknowledge knowledgebase reads to answer questions: a
livediagram architecture, a liveplanner plan, a livedocuments deck, a livedesign page or a livehuddle Space (Work
Tracker 1364, "Ask Across Every App"). Ask, Insights and the MCP `search_knowledge` tool answer from the
knowledgebase's own pages first and then from its sources, always naming each source and linking to the exact place in
its own app.

The platform holds the part every app would otherwise build again: one door that answers an item's **indexable
text**, a read on the index that checks the item is really one of the knowledgebase's sources, the signal that tells a
knowledgebase a source changed, and the check of each reader's own access at ask time. What the knowledgebase keeps
and how it answers is liveknowledge's spec
([search-and-ask.md "Sources"](../../../../liveknowledge/docs/specs/030-knowledgebase/search-and-ask.md#sources)).

## Names

- The **knowledgebase** is the liveknowledge item that reads; a **source** is the item it reads. Source apps:
  livediagram, liveplanner, livedocuments, livedesign and livehuddle (`KNOWLEDGE_SOURCE_APPS`).
- A source is **connected** when the knowledgebase holds a confirmed [connected tab](connected-tabs.md) standing for it
  (made from Connect File, a kit, or both ways from the source), and **in the folder** when the knowledgebase's
  Editors chose a team folder as a source and the item sits in it or in a folder inside it.
- An item's **indexable text** (`KnowledgeText`) is what an app gives for reading: its name and a list of **chunks**,
  each a short run of plain text with a **place**, where in the item it came from.
- A **place** (`KnowledgePlace`) is what a citation opens: `{tabId, elementIds}` for a canvas item (the shapes,
  connectors, text layers or notes the text came from) or `{tabId, cardId}` for a plan's card. It is turned into the
  editors' existing element deep link (`#t=<tab>&el=<element>`, `&item=<card>`).

## What each app gives

Read only, plain text, never markup, an image, a formula's text or a person's id:

| App           | Chunks                                                                                                 |
| ------------- | ------------------------------------------------------------------------------------------------------ |
| livediagram   | each tab's name, then its shapes' labels and notes, connector labels and text, grouped by tab          |
| liveplanner   | each card: its title, description, status, fields with a value, and its comments; each tab's name      |
| livedocuments | each tab's name, then its article text and its slides' text, grouped by page                           |
| livedesign    | each tab's name, then its text layers, grouped by page                                                 |
| livehuddle    | each Space's name, then its sticky notes, text and decision cards, and any notes written on its canvas |

A canvas app's text comes from its elements' text fields (`label`, `text`, `note`, `pageTitle`, `pageSubtitle`,
rich text runs, entity fields, article blocks), read by one shared walker in `@liveworkspace/index-app`
(`canvasKnowledgeText`); a plan's from its cards (`planKnowledgeText`). Each app's door reads its own whole-item file
(the export door's `file` format, which every app already serves) and hands it to the walker, so no app gains a new
read of its storage.

## The door

`GET /api/internal/items/:id/knowledge-text`, on the app's own index key (`INDEX_KEY`) and no other, answers
`{name, version, chunks: [{ref, title, text, place}]}`, or `404` for an item it does not have. `version` is the item's
last save (as the export door's). Chunks run in reading order, each at most `KNOWLEDGE_CHUNK_MAX_CHARS` (1,200), at
most `KNOWLEDGE_CHUNKS_PER_SOURCE` (200) and `KNOWLEDGE_SOURCE_MAX_CHARS` (60,000) in all: what is past the caps is
left out, last first. The platform's client is `@liveworkspace/app-doors` `readKnowledgeText`, which the index calls
with `APP_ORIGIN_<APP>` and `INDEX_KEY_<APP>`.

## The index's routes

All with liveknowledge's own app key (`/app/...`), for a knowledgebase item that is liveknowledge's; anything else is
`404`. Every answer is `Cache-Control: no-store`.

- `POST /app/items/:kb/knowledge-sources` `{folderId?}`: the knowledgebase's sources now, `{sources: [{itemId, app,
title, updatedAt, origin}]}`, `origin` `connected` or `folder`. Connected: the targets of its confirmed connections
  that are live items of a source app. In the folder: when `folderId` is a folder of the knowledgebase's own team
  (never a person's, never another team's), the live source-app items in it and in the folders inside it (eight
  levels at most). At most `KNOWLEDGE_SOURCES_MAX` (500), newest change first.
- `POST /app/items/:kb/knowledge-text` `{itemId, folderId?}`: the source's indexable text, read through its app's door,
  only when the item is one of the knowledgebase's sources now (the rule above). `404` otherwise, or when the item is
  in the Trash or gone; `503 source_unavailable` when the app did not answer.
- `POST /app/items/:kb/knowledge-reach` `{personId, teams, itemIds, folderId?}`: which of these items the person can
  open themselves, `{itemIds}`. Only sources of the knowledgebase are considered; each is kept by the access rule
  (`/items/lookup`'s: its owner, a joined member of its team, or a live link the person opened, never through a
  password or a sign-in rule they have not passed), never in the Trash. A guest's id (`guest_…`) answers none. At most
  `ITEM_LOOKUP_IDS_MAX` (200) ids.
- `POST /app/items/:kb/knowledge-likely` `{personId, teams, words, exclude}`: up to three items the person can open,
  in the knowledgebase's team (its owner's personal items for a personal knowledgebase), of a source app and not in
  `exclude`, whose title holds any of the words (at most 8 words of 3 or more letters): `{items: [{itemId, app,
title}]}`. For the Unanswered note ("Likely answered in Payments Architecture, which isn't connected").

## Keeping in step: the change signal

A knowledgebase refreshes a source when it changes, never by polling:

1. An item's summary push (`PUT /app/items/:id/summary`, every app's outbox after a save) that moves its `updatedAt`
   on, for a source app's item, looks for knowledgebases reading it: the live liveknowledge hosts of its confirmed
   connections, and, for a team item in a folder, the team's live knowledgebases whose summary names that folder or
   one above it as their source folder (`knowledgeFolder`). At most `KNOWLEDGE_WATCHERS_MAX` (20).
2. The index tells each, off the push's path (`waitUntil`), ten at a time:
   `POST /api/internal/items/:kb/knowledge-source-changed` `{app, itemId}` with liveknowledge's key.
3. Moving an item to the Trash tells them the same, with `gone: true`, so the knowledgebase drops the source at once.
4. The knowledgebase gathers changes for `KNOWLEDGE_REFRESH_SETTLE_MS` (60 s) per source, then reads the source's
   text again through the index; a `404` drops it.

A connected tab removed from the knowledgebase drops its source in the knowledgebase's own room, and a folder change
there reads the set again. A missed signal costs only freshness: the knowledgebase reads its set again daily and shows
"as of" on every source citation.

## Each reader's own access

Owner decision (Work Tracker 1364 "Access"): every answer is filtered by **the reader's own access at ask time**,
never the knowledgebase owner's and never a connected tab's pass.

- The knowledgebase keeps the chunks so it can search them without a call per question, but serves a chunk only to a
  reader the index says can open its item (`knowledge-reach`), asked once per question for the sources the search
  found, never cached across questions.
- A guest, a link visitor and anyone without a signed-in account get the knowledgebase's pages alone.
- A connected tab's pass is not counted: a reader who could open the item only through it has not opened it.
- An agent (an API token, the MCP) is filtered by the account it acts for, as a person is.

## Security

- **Narrow doors.** The text door is on the app's own key, answers one item's text under the caps, and is never
  reachable from a browser. The index reads it only for an item that is a source of the knowledgebase asking.
- **No new pass, nothing widened.** Indexing needs no reader; serving needs the reader's own access. A source's
  chunks never reach a reader who could not open the source.
- **Signals carry nothing.** A change signal names ids, never text.
- **Text is material, not instructions.** Chunks are fenced as passages are, and the model is told they are other
  people's writing ([search-and-ask.md "Sources"](../../../../liveknowledge/docs/specs/030-knowledgebase/search-and-ask.md#sources)).

## Performance

- A summary push that moved `updatedAt` costs two indexed reads (connections by target, the team's knowledgebases by
  scope and app) and nothing when no knowledgebase reads the item.
- `knowledge-sources` reads one folder tree (eight levels, one recursive query) and at most 500 items.
- `knowledge-reach` is `/items/lookup`'s cost: one read of the rows, one of the person's links.
- `knowledge-likely` is one read of the scope's live items by title, at most three answered.

## Telemetry

liveknowledge counts, with no names, ids or words: `UI·Used·AskSourceCited` (an answer cited a source),
`UI·Changed·Sources*` (an Editor changed Sources: `SourcesConnectedOn`, `SourcesConnectedOff`, `SourcesFolderOn`,
`SourcesFolderOff`), `UI·Opened·AskSourceItem` (a citation opened in its app) and `UI·Used·ConnectLikely` (Connect
pressed on an Unanswered note). Each is charted under Ask on liveknowledge's telemetry dashboard.

## The Cited by Ask bar

A source app's editor opened from a citation (`&ask=` and `&from=` beside its deep link) shows the shared
`AskCitationBar` (`@liveworkspace/workbench/components/ask/AskCitationBar`): drawn by the shared corner actions, so
livediagram, liveplanner, livedocuments, livedesign and livehuddle each show it with no code of their own. It reads
the fragment once as the editor opens, says "Cited by Ask: <question>", links **Back to the Answer** (the
knowledgebase's `?view=ask`) and closes. The question is the asker's own words, in their own address: never sent
anywhere by the bar.
