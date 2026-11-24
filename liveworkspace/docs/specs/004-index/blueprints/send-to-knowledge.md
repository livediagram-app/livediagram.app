# Send to Knowledge Base: blueprint

Derived from [send-to-knowledge.md](../send-to-knowledge.md). The spec decides; this file adds engineering precision.
Nothing here is a new Worker, queue, secret or binding: the source app summarises on the AI it already has (Ask's key
rules, `AI` binding and counts), the index calls liveknowledge's internal door with the app's key and the person's
grant, and a person's writes count on `KIT_RUN_LIMITER` under a key of their own. The index gains one D1 migration
(`0034_knowledge_sends.sql`).

## Flow

```
source editor: captureKnowledgeSelection(...) → KnowledgeSendSelection; the picture drawn once (PNG ≤ 300,000 bytes)
         │ POST <app api>/documents/:id/knowledge-summary {tabId, selection, focus?, ai?}  (Write With AI)
         │   serveSelectionSummary: account? key (ownKeyOf) | built-in (spendAsk count) → callModel → clean
         │   → with Pro on, spend AI_CREDIT_COSTS.knowledgeSummary from askPayer(...) AFTER the answer
         │   ← 200 {markdown, provider, model} | 429 ai_credits_used {owner, used?, max?} | 4xx/5xx {error, message}
         ▼ preview (Insert / Edit / Cancel)
POST /api/index/knowledge-sends/sections  KnowledgeSendAsk ─▶ index (person, in person)
         │ limiter `knowledge-send:<person>`; source: loadItem(view); kb: loadItem(edit, whole item, liveknowledge, live)
         │ mintGrant(kb, person, edit) → callAppForJson(liveknowledge, /items/:kb/knowledge-send, {op:'write', …})
         ▼
liveknowledge door (index-app knowledgeSendDoor → grantWrites) → room.knowledgeSend → routes as the person:
         newPage? POST pages {title, parent}  →  PUT pages/<tab> {markdown, mode:'append', after?, picture?}
         picture: mediaClient.upload(owner = person) → image element in a parked object zone (withSectionPicture)
         ← {ok, page: {id, title}, link}
         ▼
index: one knowledge_sends row → 201 {send, link}

source opens: GET /api/index/items/:source/knowledge-sends            → {sends} whose knowledgebase the reader can open
kb opens:     GET /api/index/items/:kb/knowledge-sends?received=1    → {received} whose source the reader can open
headings:     GET /api/index/items/:kb/knowledge-sends/outline?page= → {headings} (Editor; door op 'outline')
agents:       liveknowledge api → POST /api/index/app/items/:kb/knowledge-sends {person, sentFrom, page, title}
```

## Wire (`@liveworkspace/index-client`, src/knowledge-sends.ts)

| Shape                        | Fields                                                                                                   |
| ---------------------------- | -------------------------------------------------------------------------------------------------------- |
| `KnowledgeSendItem`          | `id`, `kind`, `label`, `note?`, `in?`                                                                    |
| `KnowledgeSendLink`          | `from` (id or null), `to` (id or null), `label?`                                                         |
| `KnowledgeSendSelection`     | `items`, `links`, `cut?` (true when the editor left items out)                                           |
| `KnowledgeSendPlace`         | `{page, after?}` or `{newPage: {title, parent}}`                                                         |
| `KnowledgeSendPicture`       | `png` (base64, ≤ `KNOWLEDGE_SEND_PICTURE_BYTES_MAX` bytes decoded), `width`, `height`                    |
| `KnowledgeSendSource`        | `app`, `itemId`, `tabId`, `elementIds` (1 to 80)                                                         |
| `KnowledgeSendAsk`           | `knowledgebase`, `place`, `heading`, `markdown`, `picture?`, `source`                                    |
| `KnowledgeSend`              | `id`, `tabId`, `elementIds`, `knowledgebase: {id, title}`, `page: {id, title}`, `link` (the page), `at`  |
| `KnowledgeReceived`          | `id`, `page`, `place` (the link back), `source: {app, id, title}`                                        |
| `KnowledgeSendDoorCall`      | `{op: 'outline', person, page}` or `{op: 'write', person, place, heading, markdown, picture?, sentFrom}` |
| `KnowledgeSendDoorAnswer`    | `{ok: true, page, link}` / `{ok: true, headings}` / `{ok: false, code, reason}`                          |

- `readKnowledgeSendSelection` cuts to the caps (items, links, text) and drops a link whose ends name no item;
  `readKnowledgeSendAsk`, `readKnowledgeSendDoorCall` read every id at most 200 characters, the Markdown at most
  `KNOWLEDGE_SEND_MARKDOWN_MAX`, the picture's base64 length at most `ceil(bytes / 3) * 4`.
- `knowledgeSelectionText(selection)` is the model's material: one line an item ("[3] sticky "Charge card" (note:
  …) in [1]"), one an arrow ("[3] → [4] "yes""), "something outside the selection" for a `null` end. Pure, linear.
- `knowledgeSendFallback(selection)` is the Markdown Add Without Summary writes: a bullet list of the items' labels
  (a frame's contents nested under it), then "N arrows connect them." Never invents.
- `IndexClient.sendToKnowledge(ask)`, `knowledgeSends(sourceId, {share?, signal?})`,
  `knowledgeReceived(kbId, {signal?})`, `knowledgeOutline(kbId, pageId, {signal?})`.

## The index (liveworkspace/apps/index)

```
migrations/0034_knowledge_sends.sql   the table below
src/knowledge-sends.ts                the routes above
src/index.ts                          'knowledge-sends' (person) and items/:id/knowledge-sends; app route
```

`knowledge_sends`: `id` (`ks_` + 20 hex), `source_id` → items ON DELETE CASCADE, `source_tab_id`, `elements` (JSON
array of ids), `kb_id` → items ON DELETE CASCADE, `page_id`, `page_title`, `place_link`, `at`. Indexes
`(source_id, at DESC)` and `(kb_id, at DESC)`. No person, no words but the page's title.

- **Write**: one INSERT after the door answers `ok`. A source holds at most `PLAN_SENDS_PER_SOURCE_MAX` rows
  (`409 source_full`).
- **Reads**: the newest `KNOWLEDGE_SEND_READ_MAX` rows; each distinct other item (at most
  `KNOWLEDGE_SEND_ITEMS_CHECKED_MAX`) loaded on the reader's own access (no share code carries over), kept when open
  and neither trashed nor archived, with its current title.
- **Refusals**: 401/403 as Send to Plan's sender; 404 for a source or knowledgebase the person cannot reach; 403 for a
  tab-scoped or non-Editor knowledgebase grant; 400 for a body that does not read or a target that is not
  liveknowledge; 422 `knowledge_refused` `{code, reason}` for a door refusal; 503 `knowledge_unavailable` otherwise.

## The summariser (`@liveworkspace/ask/server`, serve-summary.ts)

`serveSelectionSummary(door: SummaryDoor)`: `door` is Ask's (`accountId`, `aiKey`, `builtIn`, `spend`, `credits`,
`headers`, `through`, `now`) plus `itemId`. Non-streamed JSON. Order: account → body (≤ 64 KiB, the selection read
by `readKnowledgeSendSelection`, at least one item) → key or built-in (Ask's count) → by-others count (Pro on, not
the payer) → `callModel` (≤ 1,500 tokens written) → `cleanSummary` → `spendSummary` (Pro on). A spend the month
refuses answers 429 `ai_credits_used` and the summary is dropped; the service refusing the request answers 503.
`cleanSummary` reads line by line (fences kept, `#`/`##` lowered to `###`, `![…](…)` and raw-HTML lines dropped,
`[[…]]` unwrapped, front matter dropped), cut at a line to 6,000 characters.

## liveknowledge

- `@liveknowledge/api-schema` `ArticleWrite` gains `after?` (a heading block's id, or its words for an agent) and
  `picture?` (`{imageId, width, height, alt?}`), both for `mode: 'append'`; `parsePagesRequest` reads them.
- `@liveknowledge/edit-operations` `applyArticleWrite`: an append with `after` splices the new blocks at the end of that
  heading's part (`sectionEndOf`); with `picture`, an object zone (aligned left, parked as an import's is, its `at`
  left of the first page until the editor first lays it out) and its image element follow the written blocks.
- `apps/api/src/document-room/knowledge-send-door.ts`: `op: 'outline'` (the stored tab's article headings) and
  `op: 'write'` through `route()` as the person (no `automation`), the picture uploaded first.
- `apps/api/src/routes/knowledge-agent-routes.ts`: `PUT pages/<tab>` passes `after`; `sentFrom` on create and write
  adds the Sent From line and records the send through the index's app route.
- Editor: `components/canvas/article/article-view-mount.ts` mounts the workbench's `knowledgeReceivedPlugin`
  (`send-to-knowledge/article-received.ts`), which draws the chip after a paragraph linking to a received place.

## The editors (packages/workbench src/components/send-to-knowledge)

| File                            | What                                                                                              |
| ------------------------------- | ------------------------------------------------------------------------------------------------- |
| `send-to-knowledge-entry.ts`    | The relay: `setKnowledgeSummariser`, `canSendKnowledgeHere`, `sendToKnowledge(request)`          |
| `knowledge-send-store.ts`       | The open item's sends, by element: read on open and after a send                                 |
| `knowledge-received-store.ts`   | A knowledgebase's received sends, by place link, for the page's chips                             |
| `article-received.ts`           | The ProseMirror plugin drawing the Sent From chip                                                 |
| `sent-knowledge-indicator.ts`   | The canvas indicator's glyph and hook                                                             |
| `KnowledgeWhere.tsx`            | Knowledgebase list, Existing Page (tree, search, Where) or New Page (title, parent)               |
| `KnowledgePreview.tsx`          | The preview: heading, summary rendered (or a text area under Edit), picture, Sent From            |
| `SendToKnowledgeDialog.tsx`     | The picker; loaded on its first open (`SendToPlanHost`'s lazy import)                             |
| `SendToKnowledgeButton.tsx`     | The toolbar button (liveknowledge's logo), `data-send-to-knowledge`                               |

## Tests

- index-client: the selection reader's caps, the text and the fallback, the ask and the door call.
- index: a send (an Editor's, refused for a Participant, a Viewer, a tab link, a trashed or non-liveknowledge target,
  a source the person cannot read), the door's refusal passed on, the row written, both reads filtered by access,
  the outline, the agent's record only with read on the source.
- index-app: the door refuses a grant that is not the person's Editor's on the whole item.
- ask: the summariser's key and built-in paths, the spend after a success only, 429 with no summary, refusals.
- liveknowledge: `after` and `picture` in an append; the door's outline and write; the agent's `sentFrom`.
- livediagram: `captureKnowledgeSelection` (frames, arrows' ends outside, caps, reading order), the summary route's
  account and read gates.
- workbench: the picker (lists only editable knowledgebases, existing and new page, preview Insert/Edit/Cancel, the
  credits notice's Add Without Summary), the stores, the chip plugin.
