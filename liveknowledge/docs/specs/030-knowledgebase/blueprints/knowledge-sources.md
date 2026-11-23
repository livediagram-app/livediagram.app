# Sources: blueprint

Derived from [search-and-ask.md "Sources"](../search-and-ask.md#sources) and
[insights.md "Likely answered elsewhere"](../insights.md). The specs decide; this file adds engineering precision.

## Files

| File                                                  | Role                                                                                                         |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `packages/knowledge/src/sql/source-index.ts`          | `SOURCE_SCHEMA`, the caps, replace, delete and clear a source, `searchSourceChunks`, `question_likely` reads |
| `packages/knowledge/src/ask-sources.ts`               | The question's and a search's source search, a found chunk as a passage, `chooseAskPassagesWithSources`      |
| `packages/knowledge/src/ask-request.ts`               | A source chunk's `<passage source_app item place as_of>` block and the system prompt's line on it            |
| `packages/api-schema/src/knowledge-sources.ts`        | The wire: `KnowledgeSources`, `KnowledgeSourcesChange`, `AskSourceItem`, `KnowledgeLikelySource`, hits       |
| `apps/api/src/document-room/document-schema.ts`       | Step V46 (`sourceSchemaStep`): the tables; connected tabs queued so the backfill looks at the set            |
| `apps/api/src/knowledge/source-work.ts`               | The `source` work: `~sync` (the set) and one source's read; `takeSourceChange` for the index's signal        |
| `apps/api/src/knowledge/source-settings.ts`           | Connected Items and the team folder as `knowledge_settings` rows                                             |
| `apps/api/src/knowledge/ask-source-read.ts`           | Who may read sources, the reach filter, search hits, likely writes and the Insights read                     |
| `apps/api/src/routes/knowledge-sources-route.ts`      | `GET` and `PUT .../ai/sources`                                                                               |
| `apps/api/src/routes/knowledge-ask-route.ts`          | Pages and sources searched together, chosen, cited (`AskSource.source`), likely items kept                   |
| `apps/api/src/routes/knowledge-search-route.ts`       | `sources` after the results                                                                                  |
| `packages/agent-verbs/src/verbs/knowledge.ts`         | `search_pages` and `liveknowledge search` print the source hits                                              |
| `apps/editor/components/ask/AiSourcesSection.tsx`     | AI Settings > Sources                                                                                        |
| `apps/editor/components/ask/ItemSourceCard.tsx`       | A cited item's card in the Sources rail                                                                      |
| `apps/editor/lib/knowledge-ask/source-item.ts`        | The chip's words, the link that opens the item at its place, "As of"                                         |
| `apps/editor/lib/knowledge-ask/ask-trust.ts`          | The trust line counts connected items apart                                                                  |
| `apps/editor/components/insights/useConnectLikely.ts` | Connect on a likely item, through the shared `connectFile`                                                   |

## The room

- **Tables** (V46, IF NOT EXISTS): `source_items` (one a source: app, title, origin, state, chunks, chars,
  updated_at, version, read_at, tries), `source_passages` and `source_passages_fts` (external content, the pages'
  tokenizer), `question_likely` (one a question, at most `QUESTION_LIKELY_KEPT` (500)).
- **Work** (`knowledge_work` kind `source`, the alarm's, three a turn with the rest):
  - `~sync`: `sources(kb, folderId)` from the index, filtered by the settings; new ones inserted `waiting` and owed a
    read; changed or unread ones owed a read; gone ones deleted; past `SOURCES_MAX` (100) kept as `capped` with no
    chunks. Owed again a day on while any is listed. Owed `SOURCE_SYNC_SOON_MS` (5 s) after a connected tab settles
    (the knowledge index's `onRemoved`), after Sources changes, and after the index names an item not yet read.
  - `<item id>`: `text(kb, itemId, folderId)`; null drops it; a failure counts a try and retries after 15 minutes, at
    most 3; past `SOURCE_CHUNKS_MAX` (6,000) in all it is `capped`; else its chunks replace the old ones in one batch.
- **The signal** (`knowledgeSourceChanged` RPC, from the internal door): gone drops now; a known source is owed a read
  after `SOURCE_REFRESH_SETTLE_MS` (60 s, the earliest owed stands, so a burst is one read); an unknown one owes
  `~sync`. A room with no schema takes nothing.

## Answering

- `askSourcePassages`: nothing for a caller without an account of its own, on a share link, a page's link or a
  Community post (`mayReadSources`), or under a label scope. Else the question's content words, `any` mode, the best
  `ASK_SOURCE_CANDIDATES` (24), then one `reach` call; the index away answers none (pages alone, never a refusal).
- `chooseAskPassagesWithSources`: pages chosen within 24,000 less `ASK_MAX_SOURCE_CHARS` (8,000) when sources were
  found, then sources best first within what is left, at most `ASK_MAX_SOURCE_PASSAGES` (6), `ASK_MAX_PASSAGES` (12) in
  all, numbered on.
- Health is read for pages only; Page Answers counts pages only. A cited source carries `source: {app, itemId,
itemName, place, readAt}`; the editor builds its link.
- Gaps: after an answer, at most `LIKELY_GAPS_MAX` (3) `likely` calls, the kept sources excluded; the first item kept
  in `question_likely`. Insights reads them for the questions it lists and keeps those the reader reaches (one call).

## Editor

- AI Settings: `AiSourcesSection` reads `GET ai/sources` on open; the switch and the folder picker are the Editor's
  (`manageAi`); the folder list is the index's `listFolders({team})`, one page of 200, asked once.
- Ask: the chip's title is "Name (app)"; the trust line counts items apart; `ItemSourceCard` opens
  `sourceHref(...)` in a new tab with `noopener`.
- Insights: `QuestionRow` shows the likely note; Connect is the Editor's in a session that may change the tree
  (`useConnectLikely`), at View, one way, then Insights re-reads.

## Performance and limits

- Nothing on a request touches another app: Ask adds one FTS read and at most one index call (reach), plus at most
  three likely calls after a gapped answer. Insights adds one read and at most one index call.
- Storage: at most 6,000 chunks of at most 1,200 characters a knowledgebase (about 7 MB worst case).

## Testing

- knowledge: schema, replace and delete keep the FTS in step, search only finds read sources, the chooser's budgets.
- api: the settings writes, the work's sync and read (capped, failed, 404), the signal, the routes' roles (an Editor
  changes Sources; a Participant and a Viewer are refused; a guest and a link reader get pages only).
- editor: the section's states and roles, the card, the trust words, the likely note's Connect by role.
