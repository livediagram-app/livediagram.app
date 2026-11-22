# Knowledge package blueprint

Derived from [Search and Ask](../search-and-ask.md), [Verification](../verification.md),
[Links and embeds](../links-and-embeds.md), [AI Knowledge](../ai-knowledge.md) and
[Knowledgebase for agents](../../024-agents/knowledgebase-for-agents.md).

`@liveknowledge/knowledge` (`packages/knowledge`) is the engine under search, trust, links, Ask, the conflict
check and Describe to Set Up, on either of two providers' models ("Providers"). It is pure: it writes no storage, reads no environment and starts no timer. The room runs the SQL it makes; the
caller hands in `fetch`, the team's key and the clock. **Built: the package, the room's wiring and the api's
routes** ("Wiring" below); the editor's side is the [knowledge UI blueprint](knowledge-ui.md). The MCP tools are
the [agents blueprint](../../024-agents/blueprints/knowledgebase-for-agents.md)'s; the three emails are "The review
emails" below.

## Domain and naming

| Term (spec)         | Identifier                                                                                            |
| ------------------- | ----------------------------------------------------------------------------------------------------- |
| passage             | `Passage` (`passages.ts`); a found one is `FoundPassage` (`sql/search.ts`)                            |
| page (in the SQL)   | `tab`: the tab's id, as the specs' own table names have it (`page_links(from_tab, to_tab)`)           |
| page link           | a run with `PAGE_LINK_KEY` (`'page'`): `PageLinkRun`, `isPageLinkRun` (`page-links.ts`)               |
| knowledge fields    | `KnowledgeFields`: `owner`, `verifiedAt`, `verifiedBy`, `context` (a page's own)                      |
| Review Period       | `KnowledgeSettings`: `{ reviewEvery }`, `ReviewEvery`: the knowledgebase's, never a page's            |
| Verified and so on  | `TrustStateName`: `'verified'`, `'review-due'`, `'never-verified'`                                    |
| reader, asker       | `Reader`: `{ kind: 'person' }` or `{ kind: 'agent', name }`                                           |
| unanswered question | `QuestionGroup`, keyed by `questionKey(question)`                                                     |
| conflict            | `Conflict` (`a`, `b`: `ConflictSide`), a candidate pair is `ConflictCandidate`                        |
| the team's key      | `apiKey` in memory, an **envelope** once sealed (`sealApiKey`), a **hint** for Settings               |
| provider            | `ModelProviderId`: `'anthropic'` or `'openai'`; a `ModelProvider` holds its name, host and models     |
| a model call        | `callModel`, over a `ModelRequest` (`system`, `messages`, `maxTokens`, `effort`); never "Claude call" |
| a suggested page    | `SetupPage` in a `SetupSuggestion` (`setup-suggestion.ts`)                                            |

## Modules

Every module is one file under `packages/knowledge/src`, with its tests beside it.

| Module                | Holds                                                                                                                                                                                                                                                                                                               |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `hash.ts`             | `stableHash(...parts)`: 64 bits as 16 hex characters, synchronous, the same in a Worker, Node and a browser                                                                                                                                                                                                         |
| `writing-text.ts`     | `blockText(block)`, `writingText(flow)`: the words of a block and of a page, no Markdown syntax                                                                                                                                                                                                                     |
| `passages.ts`         | `pagePassages(tab, flow)`, `passagePieces(text)`, `MAX_PASSAGE_CHARS`                                                                                                                                                                                                                                               |
| `trust.ts`            | `parseKnowledgeFields`, `trustState(fields, every, now)`, `reviewDays(every)`, `verified(fields, person, now)`, `knowledgeHealth(pages, every, now)`; re-exports `KnowledgeSettings`, `parseKnowledgeSettings`, `storedKnowledgeSettings`, `isReviewEvery` from `@liveknowledge/document` (`knowledge-settings.ts`) |
| `page-shape.ts`       | `pageWords(blocks)`, `pageHeadingCount(blocks)`: the words reading time counts and the headings On This Page lists, one definition for the editor and the index                                                                                                                                                     |
| `page-health.ts`      | `pageHealth(facts, now)`, `wordBand(words)`, `healthFactsOf(row, every, now)`, `lowHealthPages`, `averageHealth`, `likelierRight`, the `HEALTH_*` constants and words                                                                                                                                               |
| `changed-since.ts`    | `changedFraction(before, after)`, `changedSinceVerified(before, after)`                                                                                                                                                                                                                                             |
| `page-links.ts`       | `PAGE_LINK_KEY`, `isPageLinkRun`, `isPageLinkTarget`, `pageLinkTargets(flow)`, `backlinks(tab, fromTabs, treeOrder)`                                                                                                                                                                                                |
| `context-budget.ts`   | `CONTEXT_BUDGET_TOKENS`, `estimateTokens(text)`, `fitsContextBudget`, `assembleContext(pages)`                                                                                                                                                                                                                      |
| `questions.ts`        | `wordsOf`, `contentWords`, `stemWord`, `questionKey`, `groupQuestions`                                                                                                                                                                                                                                              |
| `days.ts`             | `dayOf`, `hourOf`, `daysBefore`: the UTC windows the counts use                                                                                                                                                                                                                                                     |
| `key-seal.ts`         | `sealApiKey(secret, apiKey, boundTo)`, `openApiKey(secret, envelope, boundTo)`, `keyHint(apiKey)`, `KeySealError`                                                                                                                                                                                                   |
| `ask-limits.ts`       | the `ASK_*` constants, `askRefusal(question, used)`                                                                                                                                                                                                                                                                 |
| `ask-passages.ts`     | `askSearch(question, options)`, `chooseAskPassages(found)`                                                                                                                                                                                                                                                          |
| `ask-request.ts`      | `ASK_SYSTEM`, `askMessage`, `askRequest({ question, passages, turns })`: a `ModelRequest`, the same for both providers                                                                                                                                                                                              |
| `ask-answer.ts`       | `parseAskAnswer(reply, passages)`, `askAnswerStream(passages)` (`push`, `finish`)                                                                                                                                                                                                                                   |
| `claude-models.ts`    | `CLAUDE_MODELS`, `DEFAULT_CLAUDE_MODEL`, `claudeModel(id)`                                                                                                                                                                                                                                                          |
| `model-failure.ts`    | `ModelProviderId`, `ModelFailureKind`, `modelFailureWords(provider, kind)`, `ModelCallError`                                                                                                                                                                                                                        |
| `model-request.ts`    | `ModelRequest`, `ModelMessage`, `ModelEffort`, `fenced(text)`                                                                                                                                                                                                                                                       |
| `sse.ts`              | `eventData(body)`, `parseEvent(data)`: a server-sent event stream as its `data:` payloads, for both clients                                                                                                                                                                                                         |
| `claude-request.ts`   | `claudeRequest(...)`, the URL, API version and beta header                                                                                                                                                                                                                                                          |
| `claude-client.ts`    | `callClaude({ fetch, apiKey, request, onText, signal })`, `ClaudeCallError`, `claudeFailureKind`, `CLAUDE_FAILURE_WORDS`                                                                                                                                                                                            |
| `openai-models.ts`    | `OPENAI_MODELS`, `DEFAULT_OPENAI_MODEL`, `openAiModel(id)`                                                                                                                                                                                                                                                          |
| `openai-request.ts`   | `OPENAI_RESPONSES_URL`, `openAiRequest(model, request)`                                                                                                                                                                                                                                                             |
| `openai-client.ts`    | `callOpenAi({ fetch, apiKey, request, onText, signal })`, `OpenAiCallError`, `openAiFailureKind`, `openAiHeaders`                                                                                                                                                                                                   |
| `model-providers.ts`  | `MODEL_PROVIDERS`, `modelProvider(id)`, `isModelProviderId`, `isProviderModel`, `providerModel`, `callModel(...)`                                                                                                                                                                                                   |
| `setup-limits.ts`     | the `SETUP_*` constants, `setupRefusal(description, used)`                                                                                                                                                                                                                                                          |
| `setup-request.ts`    | `SETUP_SYSTEM`, `setupMessage(description, existing)`, `setupRequest({ description, existing })`                                                                                                                                                                                                                    |
| `setup-suggestion.ts` | `parseSetupSuggestion(reply)`, `SetupPage`, `SetupSuggestion`, `SETUP_MAX_REPLY_CHARS`                                                                                                                                                                                                                              |
| `conflicts.ts`        | the `CONFLICT_*` constants, `conflictCheckRefusal`, `conflictProbes`, `probeSearch`, `chooseConflictCandidates`, `conflictId`, `conflictClosed`                                                                                                                                                                     |
| `conflict-request.ts` | `CONFLICT_SYSTEM`, `conflictRequest({ candidates })` (a `ModelRequest`), `parseConflictVerdicts(reply, candidates)`                                                                                                                                                                                                 |
| `sql/statement.ts`    | `SqlStatement` (`{ sql, params }`), `MAX_BOUND_PARAMETERS`, `insertRows`                                                                                                                                                                                                                                            |
| `sql/schema.ts`       | `KNOWLEDGE_SCHEMA`, `TITLE_ORDINAL`, `SEARCH_TOKENIZER`                                                                                                                                                                                                                                                             |
| `sql/page-index.ts`   | `replacePageIndex(page)`, `deletePageIndex(tab)`, `putPageTrust`, `closeChangedConflicts`, `backlinkRows`                                                                                                                                                                                                           |
| `sql/search.ts`       | `searchTerms`, `ftsExpression`, `searchPassages(query, options)`, `searchByTerms`, `foundPassage(row)`                                                                                                                                                                                                              |
| `sql/reads.ts`        | `recordRead`, `pruneReads`, `countPageReads` + `pageReads`, `countAgentReads` + `agentReads`, `countDailyReads` + `dailyReads`, `countMostRead`                                                                                                                                                                     |
| `sql/questions.ts`    | `upsertQuestion`, `listQuestions`, `listQuestionAgents` + `questionGroups`, `dismissQuestion`, `pruneQuestions`                                                                                                                                                                                                     |
| `sql/conflicts.ts`    | `insertConflict`, `listConflicts` + `conflictOfRow`, `dismissConflict`, `knownConflictIds`, `lastConflictCheck`, `noteConflictCheck`                                                                                                                                                                                |
| `sql/counters.ts`     | `readCounter`, `bumpCounter`, `pruneCounters`, `askCounters(person, now)`, `setupCounters(person, now)`, the scope names                                                                                                                                                                                            |
| `sql/settings.ts`     | `readSetting`, `putSetting`, `putAiKey(envelope, hint, provider)`, `removeAiKey`, `removeAiModel`, the setting names                                                                                                                                                                                                |

**Markdown is not this package's.** A page as Markdown (the MCP's read, the Markdown export, the context pages) is
`articleToMarkdown(flow)` in `@liveknowledge/document` (`article-markdown-io.ts`), which already lives in a package and
is reused as it is: `assembleContext` takes each page's Markdown from the caller. Passages need words without syntax,
so `writing-text.ts` reads them from the block types with the document package's own `articleRunsText` and
`articleTableText`; it is not a second renderer.

## Passages

- A passage is a heading and the blocks under it. Heading 1, 2 and 3 open a passage and set its **heading path**
  (`headings`, outermost first; a heading clears the deeper ones). The first passage of a section starts with the
  heading's own line, so a heading's words are searchable. Text before the first heading has an empty path.
- The Title block is left out: the page's title is indexed as a row of its own (below). Blocks without words (divider,
  page break, contents, zone) add nothing. A table reads as its cells, tab between cells, a line a row.
- At most `MAX_PASSAGE_CHARS` (1,200) characters. Blocks are joined with a line break while they fit; a block that
  would pass the limit starts the next passage. A block longer than a passage is cut by `passagePieces`: after the
  last sentence end (`.`, `!`, `?` before a space) or line break that fits, else after the last space, else at the
  limit, never between the halves of a surrogate pair.
- `id` is `stableHash(tab, heading path, n)`, `n` being the passage's place among the passages of the same heading
  path. Writing added under one heading therefore renames no passage under another. `ordinal` is its place on the
  page. `textHash` is `stableHash(text)`. `firstBlock` and `lastBlock` are the ids of the blocks it spans, to find it
  on the page (a citation's jump, "Fix the Other").
- A heading's text in the path is cut at `MAX_HEADING_PATH_CHARS` (120).

## Durable Object SQLite: what was confirmed

Confirmed from Cloudflare's documentation on 2026-11-20:

- **FTS5 is available** in SQLite-backed Durable Objects: "Durable Objects support a subset of SQLite extensions for
  added functionality, including: FTS5 module for full-text search (including `fts5vocab`), JSON extension, Math
  functions" ([SQLite storage API](https://developers.cloudflare.com/durable-objects/api/sqlite-storage-api/)). No
  fallback index is needed. The same page says writes to a virtual table count towards rows written (billing).
- **SQL limits** ([Durable Objects limits](https://developers.cloudflare.com/durable-objects/platform/limits/), "SQL
  storage limits"): 100 columns a table; 8 MB a string, BLOB or row; **100 KB a SQL statement; 100 bound parameters a
  query**; 32 arguments a SQL function; 50 bytes a `LIKE` or `GLOB` pattern.
- **Storage** (same page): 10 GB a Durable Object on Workers Paid, 1 GB on Free; past it writes fail with
  `SQLITE_FULL` while reads and deletes still work. CPU: 30 seconds a request by default.

Not confirmed from the documentation, and to be checked when the room is wired: that FTS5's `porter` tokenizer,
`bm25()`, `snippet()` and `highlight()` behave in workerd as they do in the SQLite the tests run (they are part of
FTS5 itself, and the tests run them for real on Node's `node:sqlite`, SQLite 3.51.3); and that the room's transaction
is `ctx.storage.transactionSync()` (SQL `BEGIN` is not run through `sql.exec`).

How the package stays inside the limits:

| Limit                 | Where it is held                                                                                                                            |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| 100 bound parameters  | `insertRows` batches every multi-row insert: 11 passages (9 columns) or 50 links a statement. Every other statement binds under 10 values.  |
| 100 KB a statement    | The longest statement made is an 11-row insert of placeholders, 423 bytes. Text is always bound, never written into SQL.                    |
| 8 MB a row            | A passage's text is at most 1,200 characters; a title 200 (`MAX_INDEXED_TITLE_CHARS`); a question 1,000; an agent's name 80.                |
| 32 function arguments | `snippet()` takes 6, `bm25()` 3.                                                                                                            |
| 10 GB an object       | Worst case, 500 pages of 400,000 characters: 200 MB of passage text, held once (the index is external-content), beside the tabs themselves. |

The test fixture (`src/__fixtures__/db.ts`) refuses a statement with more than 100 bound values or over 100 KB, so a
statement the platform would refuse fails a test.

## The schema

`KNOWLEDGE_SCHEMA` is a list of `CREATE ... IF NOT EXISTS` statements the room runs when it makes its own schema.

```sql
CREATE TABLE IF NOT EXISTS passages (
  id TEXT PRIMARY KEY, tab TEXT NOT NULL, ordinal INTEGER NOT NULL, headings TEXT NOT NULL,
  title TEXT NOT NULL, text TEXT NOT NULL, text_hash TEXT NOT NULL,
  first_block TEXT NOT NULL, last_block TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS passages_tab ON passages (tab, ordinal);
CREATE VIRTUAL TABLE IF NOT EXISTS passages_fts USING fts5(
  title, text, content='passages', content_rowid='rowid', tokenize='porter unicode61 remove_diacritics 2'
);
CREATE TABLE IF NOT EXISTS page_trust (
  tab TEXT PRIMARY KEY, title TEXT NOT NULL, verified_at INTEGER
);
CREATE INDEX IF NOT EXISTS page_trust_verified ON page_trust (verified_at);
CREATE TABLE IF NOT EXISTS page_links (
  from_tab TEXT NOT NULL, to_tab TEXT NOT NULL, PRIMARY KEY (from_tab, to_tab)
);
CREATE INDEX IF NOT EXISTS page_links_to ON page_links (to_tab);
CREATE TABLE IF NOT EXISTS page_reads (
  day TEXT NOT NULL, tab TEXT NOT NULL, reader_kind TEXT NOT NULL, agent TEXT NOT NULL DEFAULT '',
  reads INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (day, tab, reader_kind, agent)
);
CREATE TABLE IF NOT EXISTS questions (
  key TEXT PRIMARY KEY, question TEXT NOT NULL, asked INTEGER NOT NULL DEFAULT 0,
  people INTEGER NOT NULL DEFAULT 0, first_at INTEGER NOT NULL, last_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS question_agents (
  key TEXT NOT NULL, agent TEXT NOT NULL, asked INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (key, agent)
);
CREATE TABLE IF NOT EXISTS conflicts (
  id TEXT PRIMARY KEY, question TEXT NOT NULL,
  a_passage TEXT NOT NULL, a_tab TEXT NOT NULL, a_hash TEXT NOT NULL,
  b_passage TEXT NOT NULL, b_tab TEXT NOT NULL, b_hash TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'open', found_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS conflicts_a ON conflicts (a_tab);
CREATE INDEX IF NOT EXISTS conflicts_b ON conflicts (b_tab);
CREATE TABLE IF NOT EXISTS usage_counters (
  scope TEXT NOT NULL, period TEXT NOT NULL, used INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (scope, period)
);
CREATE TABLE IF NOT EXISTS conflict_checks (tab TEXT PRIMARY KEY, checked_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS knowledge_settings (name TEXT PRIMARY KEY, value TEXT NOT NULL);
```

- **`passages`** holds two kinds of row for a page. Its **title row**: `ordinal` `TITLE_ORDINAL` (-1), `title` set,
  `text` empty. Its **passages**: `ordinal` 0 onward, `title` empty, `text` set. One table, so one FTS5 index ranks
  both, and a title's words match only the title row (never every passage of the page).
- **`passages_fts`** is an external-content index over `passages`: it holds the words, the text stays once. It is
  kept in step by hand, inside `replacePageIndex` and `deletePageIndex` (no triggers): the page's rows are handed to
  the index's `'delete'` command before they leave `passages`, and inserted from `passages` after they are written.
- **`page_trust`** is what search needs of a page without reading its tab: its title and when it was verified.
  When its review is due is not stored. Whether it is verified is worked out in the query from `verified_at` and
  one bound value, `now` minus the knowledgebase's Review Period (null for Never, which no page is at or before):
  nothing is written when a review comes due, and nothing when the period changes. `page_trust_verified` makes
  the due pages, and the count of them (`countReviewDue(days, now)`), a range of an index.
- **`page_reads`**: `agent` is `''` for a person. No reader's identity is kept beyond an agent's name.
- **`questions`** has a row a group; `people` counts the asks by people, `question_agents` each agent's.
- **`conflicts`**: `state` is `'open'` or `'dismissed'` ("Not a Conflict" keeps the row, so the pair is never raised
  again). `id` is `conflictId(a, b)`, the same whichever passage comes first.
- **`usage_counters`**: `scope` is `ask:person:<account id>`, `ask:knowledgebase`, `setup:person:<account id>`,
  `setup:knowledgebase` or `conflicts:check`; `period` an
  hour (`2026-11-20T14`) or a day (`2026-11-20`), UTC.
- **`knowledge_settings`**: `ai_key` (the envelope), `ai_key_hint`, `ai_model`, `ai_provider` (`anthropic` or
  `openai`; no row is `anthropic`, the provider of every key stored before there was a choice, so the table needs no
  schema step and no stored knowledgebase is rewritten).

## Search

- **The query made safe** (`searchTerms`, `ftsExpression`): the first `SEARCH_MAX_QUERY_CHARS` (200) characters,
  NFKC-normalised and lowercased, are read as runs of letters and digits; at most `SEARCH_MAX_TERMS` (12) are kept.
  Each becomes a quoted string, so nothing a person types reaches FTS5 as an operator, a column filter, a `NEAR`
  group, a `^` or a `*`. Mode `all` (the search field) joins them with a space (every word is needed) and makes the
  last a prefix (`"deploy" "emerg"*`), for search as you type; mode `any` (a question's words, a conflict probe)
  joins them with `OR`. No words: `searchPassages` answers `undefined`, and the caller answers no results.
- **The statement** (`searchByTerms`) joins `passages_fts` to `passages` and `page_trust` and orders by: title rows
  first, then rows of verified pages, then `bm25(passages_fts, 10.0, 1.0)` (a title match weighs ten times a text
  match), then tab and ordinal so the order is stable. `LIMIT` is at most `SEARCH_MAX_RESULTS` (20).
- **A row** (`SearchRow`, read by `foundPassage`): the passage's id, tab, headings, text, text hash and blocks; the
  page's `title`; `trust` and `verifiedAt`; `snippet` (the matching lines, `snippet()` over the text, 24 tokens) and
  `titleMarked` (`highlight()` over the title), the matched words wrapped in `MATCH_START` (U+0002) and `MATCH_END`
  (U+0003). Control characters, so no writing can hold them and the client marks the words without parsing HTML.
- Options: `passagesOnly` (no title rows: Ask, the conflict check), `exceptTab` (the conflict check looks on other
  pages), `limit`, `mode`, `now`, and `reviewEvery` (required: the knowledgebase's Review Period, which every
  caller reads from the document and passes; `askSearch` and `probeSearch` take it too).

## Trust

- `parseKnowledgeFields` keeps what is valid and drops the rest: `owner` and `verifiedBy` are ids of 1 to 128
  characters; `verifiedAt` a positive finite number (epoch ms, floored); `context` only `true`. A `verifiedBy`
  without a `verifiedAt` is dropped. A stored `reviewEvery` is ignored and dropped: a page has no review period of
  its own, and liveknowledge has no stored data, so there is no migration.
- **The Review Period** is the knowledgebase's: `KnowledgeSettings = { reviewEvery }`, one of 30, 90, 180, 365 or
  `'never'` (`REVIEW_INTERVALS`), 90 by default (`DEFAULT_REVIEW_EVERY`, `DEFAULT_KNOWLEDGE_SETTINGS`).
  `parseKnowledgeSettings` reads an object or the JSON text a column holds and answers the default for anything
  else; `storedKnowledgeSettings` answers `null` for the default, so a knowledgebase that never chose stores
  nothing. The type and its parser live in `@liveknowledge/document` (`knowledge-settings.ts`), because the
  document's file envelope carries the settings and the document package cannot import this one.
- `trustState(fields, every, now)`: no `verifiedAt` is `never-verified`; else `reviewAt = verifiedAt + every days`
  and the state is `review-due` once `reviewAt <= now`, `verified` before. Under `'never'` a verified page is
  `verified` with no `reviewAt`. The period is a parameter, so no caller can forget it.
- `verified(fields, person, now)` is Verify: `verifiedAt` now, `verifiedBy` the person, who becomes the owner of a
  page with none.
- `changedSinceVerified(before, after)`: more than `CHANGED_SINCE_FRACTION` (a fifth) of the characters changed. Not a
  diff: both versions are cut into sentences, and the characters of the sentences both hold (a sentence written twice
  counts twice) are what did not change; the rest, over the longer version's length, is the fraction. Sentences that
  only moved do not count. One pass over each version. Bounded at `CHANGED_SINCE_MAX_CHARS` (400,000): what is past
  it is compared by its length alone.
- `knowledgeHealth(pages, every, now)`: the counts of each state and the total.

## Page Health

The Health Score ([Verification](../verification.md#health-score)), one pure function for the editor and the api.

- **`PageHealthFacts`** is everything the score reads, each a plain value: `state`, `reviewAt`, `reviewDays`
  (undefined under Never), `verifiedAt`, `owned`, `band` (`wordBand(words)`: `empty`, `few` under 20, `short` under
  50, `brief` under 300, `medium` up to 2,500, `long`), `headings`, `brokenLinks`, `backlinks`, `openConflicts`,
  `openThreads`, `suggestions`, `pendingApproval`, `reads`, `createdAt`, `updatedAt`. `backlinks` and `reads`
  undefined (Offline, or the editor before Page Health is read) count as full; the issue counts as none.
- **`pageHealth(facts, now)`** answers `{ score, label, reason, factors }`, each factor `{ factor, points, max,
raise?, gain?, fix? }` (`fix`: `verify`, `owner`, `heading`), in the spec's order. Each factor is rounded to a
  whole number before the sum, so the factors always add up to the score. Constant work: no input grows it.
  `reviewDays` undefined (a Review Period of Never) leaves Verification out, counts Freshness from `updatedAt`
  alone (`editedLately`) and scales each factor to `NEVER_MAX` (15, 15, 15, 15, 10, 20, 10), its gain with it.
- **`healthFactsOf(row, every, now)`** turns one row of the api's facts read into facts: `words` NULL (a page the
  backfill has not reached since schema step 38) reads as `chars / 6`; `headings` NULL as one heading.
- **`lowHealthPages(pages, limit = 5)`**: under `HEALTH_HEALTHY_MIN`, lowest first, then most read, then tree order.
  **`averageHealth(scores)`**: a whole number, undefined for none. **`likelierRight(a, b)`**: the side 10 or more
  points higher (`HEALTH_LIKELIER_MARGIN`), else undefined.
- **The api's facts read** (`apps/api/src/knowledge/page-health-read.ts`, `pageHealthFacts(env, documentId, now,
tabs?)`): one statement a call (the tab set chunked at 50, under the 100 bound values), every page of the
  knowledgebase or the given tabs, joining `tabs`, `document_tabs`, `page_trust`, `knowledge_pages` (`words`,
  `headings`, `owned`, schema step 38) and `page_authors`, with correlated counts over `page_links` (both ways, a
  broken link being a target not in `document_tabs`), `page_threads` (unresolved), `page_approvals` (pending),
  `conflicts` (open, either side), `suggestions` and `page_reads` (the last 7 days, on `page_reads_tab`). Each count
  is on an index the table already has. No page's writing is read.
- **Schema step 38** adds `words`, `headings` and `owned` to `knowledge_pages` (asking before each ALTER) and queues
  every indexed page for the backfill. `settlePage` writes them on every settle; a settle whose hashes match but whose
  shape or owner moved writes those three alone (an owner change is a write of the tab, so it settles).
- **Where it rides:** `GET pages/<tab>/health` answers `signals` (`openConflicts`, `openThreads`, `suggestions`,
  `backlinks`); the editor scores from them and its own state. `read_page`, `get_context`, an agent's search and
  Ask's passages carry `health` (the api scores them from one facts read for their tabs). `GET knowledge` scores
  every page once: `health.average`, `lowHealth` (5 rows), and each conflict side's `health`.
- **The editor** (`components/knowledge/PageHealthScore.tsx`, `usePageHealthScore.ts`): the facts are read from the
  chrome store as primitives (the band, the heading count, the broken link count, against the editor's tab ids), so
  a typing commit that crosses no band renders nothing; `pageHealth` runs in a `useMemo` over them and the clock.

## Links

- A page link is a run with `page: <tab id>` (`PAGE_LINK_KEY`). `isPageLinkRun` is the one guard: the id is a string
  of 1 to `MAX_PAGE_LINK_ID` (64) characters, as long as any id an article stores.
- `pageLinkTargets(flow)`: each linked page once, in the order first linked, from paragraphs, list items and table
  cells; at most `MAX_PAGE_LINKS` (500, the most pages a knowledgebase holds). A link to a page that no longer exists
  is still a link.
- `backlinks(tab, fromTabs, treeOrder)`: the link table's rows for a page (`backlinkRows(tab)`), in tree order, the
  page itself and pages gone from the tree left out. `treeOrder` is `pageTreeRows(pages).map((row) => row.page.id)`
  from `@liveknowledge/document` (the page tree blueprint, `page-tree.md`); this package holds no tree of its own.

## Always in Context

`estimateTokens(text)` is characters / 4, rounded up to 10. `fitsContextBudget(pageTokens, usedTokens)` is the check
before a page is marked. `assembleContext(pages)` takes the marked pages, already in tree order, each with its
Markdown: a page is taken while it fits what is left of `CONTEXT_BUDGET_TOKENS` (8,000); one that no longer fits (it
grew after it was marked) is left out and named in `leftOut`, and a smaller page after it may still fit.

## Questions

`questionKey(question)`: the words (lowercased, punctuation dropped), stop words left out (unless they are all there
is), each stemmed (`stemWord`: plurals, -ing, -ed, a final -e, a doubled last letter), each once, in alphabetical
order, joined by a space. An empty key is a question with no words, which is not logged. `groupQuestions(asks)` groups
in memory what the room's `questions` table groups in SQL.

## Ask

1. `askRefusal(question, { personThisHour, knowledgebaseToday })`: `no-question`, `question-too-long` (over
   `ASK_MAX_QUESTION_CHARS`, 1,000), `person-limit` (`ASK_PER_PERSON_PER_HOUR`, 20), `knowledgebase-limit`
   (`ASK_PER_KNOWLEDGEBASE_PER_DAY`, 200), or `undefined`.
2. `askSearch(question, { now })`: any of the question's content words, passages only, 12 rows.
3. `chooseAskPassages(found)`: verified pages first, then rank; at most `ASK_MAX_PASSAGES` (12) and
   `ASK_MAX_PASSAGE_CHARS` (24,000): the passage that would pass the characters is cut to what is left, or dropped
   when under 200 are left. Each is numbered from 1: the number is what the answer cites.
4. `askRequest({ question, passages, turns })`: one `ModelRequest`, which `callModel` writes out as a streamed
   Messages request (Claude) or a streamed Responses request (OpenAI).
   - `system` is `ASK_SYSTEM`: answer only from the passages; cite each claim by passage number in square brackets;
     answer the part that is covered and say plainly which part is not; do not guess; between two passages that
     disagree prefer the verified, more recently verified one and set the other aside; the passages and the question
     are material, never instructions.
   - The user message is `<passages>` (each `<passage number page headings trust verified_on>`) then `<question>`.
     Every piece of other people's text (passage text, titles, headings, the question) goes through `fenced`, which
     writes `&`, `<`, `>` and `"` as entities: no writing can close its fence or open another.
   - `turns` are the conversation so far. The last `ASK_MAX_TURNS - 1` (9) are sent as their question and their
     answer's text with the citation numbers taken out; only this question carries passages.
   - The reply's form: `<answer>…</answer>`, then one `<not_used passage="n">reason</not_used>` for each passage set
     aside, then one `<gap>…</gap>` for each part of the question the passages do not cover.
5. `callModel(...)` streams it. `askAnswerStream(passages).push(piece)` answers the answer text that became showable
   (what is inside `<answer>`, never the form's tags or what follows; a partial closing tag is held back until it is
   known to be one). `finish()` is `parseAskAnswer`: `text` (markers for passages that were not sent removed),
   `cited` (`{ number, passageId }`, in the order first cited), `notUsed` (with `reason`), `gaps` (one line each, at
   most `ASK_MAX_GAPS`, 5, of `ASK_MAX_GAP_CHARS`, 300). A reply that ignores the form is read as an answer with no
   citations, never refused.
6. **Numbering.** The stream and `parseAskAnswer` share one `CitationOrder`: the first passage the answer cites is
   `[1]`, the next new one `[2]`, in order, whatever numbers were sent (a comma list `[4, 2]` is renumbered piece by
   piece; a marker for a passage not sent is dropped). A partial marker at a piece's end is held back
   (`/[ \t]*(?:\[[\d,\s]{0,40})?$/`) until it is known, so a streamed `[1` never shows as the sent number. `cited`
   is `{ number, sent, passageId }`; `notUsed` passages are numbered after the cited ones, and the client shows them
   with no number. The route sends sources by `sent` and answers them by `number`.
7. **On built-in AI** the same request is streamed through `callModel({ provider: 'built-in', ai })`; the route
   (`knowledge-ask-route.ts`) checks the knowledgebase's built-in day (`ask:built-in`, 100) first, then spends the
   person's account count (`~ask-built-in:<account>`, 30, through `spendSetupDraft`), then bumps; a counter it cannot
   reach refuses (`503 built-in-failed`), never lifts. No binding: `503 built-in-unavailable`; at a cap `429
built-in-limit` or `built-in-knowledgebase-limit`. The done event carries `provider`. A request whose `ai` is
   `built-in` takes this path even when a key is stored (search-and-ask.md "Choosing which AI answers").

## The Claude API

Written from the `claude-api` skill's reference (model table cached 2026-11-03), by hand over `fetch` because the call
is made in a Worker with an injected `fetch`; no SDK is a dependency.

- `POST https://api.anthropic.com/v1/messages`, headers `x-api-key`, `anthropic-version: 2026-10-21`,
  `content-type: application/json`.
- Body: `model`, `max_tokens` (16,000 for both requests), `stream: true`, `system`, `messages`,
  `output_config: { effort }` (`medium` for Ask, `low` for a conflict check). No `thinking` field (every listed model
  thinks adaptively when it is left out, and some reject any other setting), no `temperature`, `top_p` or `top_k`
  (rejected), no assistant prefill (rejected), no forced tool (rejected).
- **Models** (`CLAUDE_MODELS`): `claude-fable-5-2` (the default), `claude-opus-5-5`, `claude-sonnet-5-5`,
  `claude-haiku-5-5`: the current generation of each line. A stored id that is none of them reads as the default.
- **Refusals.** A safety classifier may decline a request (HTTP 200, `stop_reason: "refusal"`): that is the failure
  kind `refused`. The API can answer on another model instead (`fallbacks: "default"` with
  `anthropic-beta: server-side-fallback-2026-07-01`), and the request and header know how to ask, but the switch
  (`ClaudeModel.fallbacks`) is **off for every model**: a fallback bills the team's own key at another model's
  rate, and a team must be able to predict what a question costs.
- **The stream** is server-sent events; the client reads each `data:` line's JSON by its `type`: `message_start`
  (the model that answered), `content_block_delta` with a `text_delta` (the text; thinking and signature deltas are
  ignored), `message_delta` (`stop_reason`), `message_stop`, and `error`. A stream that ends without `message_stop`
  is a failure.
- **Failures** are a `ClaudeCallError` with a `kind` and the HTTP status. The message is the kind's fixed words
  (`CLAUDE_FAILURE_WORDS`); the API's own message, the request and the key are never in it.

  | Kind                | From                                                                                          |
  | ------------------- | --------------------------------------------------------------------------------------------- |
  | `bad-key`           | 401 `authentication_error`, 403 `permission_error`                                            |
  | `no-credit`         | 402 `billing_error`; a 429 whose `error.details.error_code` is `enforced_spend_limit_reached` |
  | `rate-limited`      | 429 `rate_limit_error`                                                                        |
  | `overloaded`        | 529 `overloaded_error`, also when sent as an `error` event mid-stream                         |
  | `model-unavailable` | 404 `not_found_error` (a model the key's organisation cannot use)                             |
  | `refused`           | `stop_reason: "refusal"`                                                                      |
  | `other`             | anything else: no network, 400, 500, a body that is not JSON, a stream cut short              |

- The client does not retry. A caller may retry `overloaded` once after a pause; nothing else is worth retrying.
- Not sent: prompt caching (the system prompt is under the smallest cacheable prefix, and the passages differ with
  every question).

## Providers

Derived from [Search and Ask](../search-and-ask.md) "Providers". Built in the package, the api and AI Settings.
**No real model was called for either provider**: every test runs on faked `fetch`.

- **One interface.** `callModel({ provider, fetch, apiKey, model, request, onText, signal })` is the only call Ask,
  the conflict check and Describe to Set Up make. `request` is a `ModelRequest` (`system`, `messages`, `maxTokens`,
  `effort`): the prompts, the fenced material, the `[n]` markers and the reply's tagged form are built once and are
  the same bytes for both providers (`model-providers.test.ts` holds it: the system prompt and the messages sent to
  each are equal, and no prompt names a provider). `callModel` hands it to `claudeRequest` and `callClaude`, or to
  `openAiRequest` and `callOpenAi`. It answers `{ text, stopReason, model }` with `stopReason` `end_turn` or
  `max_tokens` whichever provider answered.
- **The Claude client is unchanged in behaviour**: the same request body, headers, stream reading and failure
  mapping as before (its tests are untouched but for their imports). `ClaudeCallError` is now a `ModelCallError`.
- **Failures** are one type, `ModelCallError` (`provider`, `kind`, `status`), with the same seven kinds for both.
  Its message is `modelFailureWords(provider, kind)`, fixed words naming the provider where it is the provider's own
  ("OpenAI did not accept the API key."). No key, request or upstream message is in it: tests search every error's
  message, stack and fields for the key string, for both providers.
- **`MODEL_PROVIDERS`**: `anthropic` ("Anthropic (Claude)", spoken "Claude", host `api.anthropic.com`, key prefix
  `sk-ant-`) and `openai` ("OpenAI", host `api.openai.com`, key prefix `sk-`), each with its models and default.
  `modelProvider(id)` reads anything else as `anthropic`. `providerModel(provider, id)` reads a model that is not the
  provider's own as that provider's default, so a request never names the other provider's model.
- **Keys are parameters.** Nothing in the package reads an environment; the key is in one header of one request
  (`x-api-key` for Claude, `Authorization: Bearer` for OpenAI) and nowhere else.
- **Built-in AI is the third provider** ([Search and Ask](../search-and-ask.md) "Built-in AI"). `ModelCaller` is
  `{ provider: 'built-in', ai }` or `{ provider: KeyProviderId, fetch, apiKey, model }`; `callModel` hands the first
  to `callBuiltIn` (`built-in-client.ts`): `builtInInput(request)` (the system prompt first, then the messages,
  `max_tokens` at most `BUILT_IN_MAX_TOKENS` 2,000, temperature 0.2, `stream: true`, thinking off), the binding's
  event stream read as `{ response }` or chat-completion pieces through to `[DONE]` (or one object, read by
  `builtInReplyText`), bounded by `BUILT_IN_TIMEOUT_MS` (60 s) and the caller's signal; after either, what arrives is
  dropped. Every failure is `ModelCallError('built-in', 'other')` with `BUILT_IN_FAILED_WORDS`, never the binding's
  own words. `BUILT_IN_MODEL` is `@cf/google/gemma-4-26b-a4b-it` (`SETUP_BUILT_IN_MODEL` is the same constant).
  `KeyProviderId` is `anthropic | openai`; `ModelProviderId` adds `built-in`; `isModelProviderId` accepts only a key
  provider, so a stored row can never name built-in AI.
- **Built-in limits** (`built-in-limits.ts`): `ASK_BUILT_IN_PER_PERSON_PER_DAY` 30 (per account, every
  knowledgebase), `ASK_BUILT_IN_PER_KNOWLEDGEBASE_PER_DAY` 100 (`ASK_BUILT_IN_SCOPE` `ask:built-in` in
  `usage_counters`), `CONFLICT_BUILT_IN_CHECKS_PER_DAY` 20.

### The api's door

`apps/api/src/knowledge/model-door.ts` (was `claude-door.ts`). `modelDoor(provider)` is `fetch` that refuses any
address but `https://<the provider's host>` on its default port; `modelDoorFor(env, provider)` adds the e2e
stand-in rule. The provider is the one `openAi()` read from the room's settings beside the key, never a value a
client sent, so a key reaches only its own provider's host: a Claude key cannot be sent to `api.openai.com` or the
reverse (`model-door.test.ts`: each provider's door refuses the other's API, a lookalike host, plain HTTP, another
port). Under the e2e stack's one var (`E2E_CLAUDE_STAND_IN`, kept by name; ignored unless it names plain HTTP on a
loopback port, in no `wrangler.toml` or hosted var) both hosts go to the stand-in, which tells them apart by path.

### The api's settings

`ai-settings.ts`: `readAiSettings` answers `{ provider, hasKey, keyHint, model, models, providers }` (`models` are
the stored provider's, `providers` each `{ id, label, keyPrefix }`). `storeAiKey(env, documentId, provider, key)`:
no provider is the stored one; a provider that is neither is `invalid-provider` (`400 invalid_provider`); another
provider than the stored one replaces the key and forgets the model in the same transaction. `storeAiModel`
refuses a model that is not the stored provider's. `openAi` answers `{ provider, apiKey, model }`. The provider is
logged with a failure's kind (`[knowledge] ask failed`), never the key.

## The OpenAI API

Read from OpenAI's documentation on **2026-11-20**; written by hand over `fetch`, as the Claude client is.

- **Which API:** the Responses API. "While Chat Completions remains supported, Responses is recommended for all new
  projects" ([Migrate to the Responses API](https://developers.openai.com/api/docs/guides/migrate-to-responses));
  "If you're building any text generation app, we recommend using the Responses API"
  ([Text generation](https://developers.openai.com/api/docs/guides/text)).
- **Request:** `POST https://api.openai.com/v1/responses`, headers `Authorization: Bearer <key>` and
  `content-type: application/json`. Body: `model`, `instructions` (the system prompt), `input` (the messages, each
  `{ role: 'user' | 'assistant', content }`), `max_output_tokens`, `stream: true`, `store: false` (responses are
  stored by default; a team's passages are not left there), `reasoning: { effort }` (`low`, `medium`: every listed
  model accepts them; some reject `none`,
  [Reasoning](https://developers.openai.com/api/docs/guides/reasoning)).
- **`max_output_tokens` counts reasoning tokens too** (the same page), as `max_tokens` does for Claude: 16,000 for
  Ask and the conflict check, 4,000 for a setup suggestion.
- **Models** (`OPENAI_MODELS`, from [Models](https://developers.openai.com/api/docs/models), "Flagship models"):
  `gpt-6.2-astra` (the default: "our most capable model"), `gpt-6.2-sol`, `gpt-6.1-terra`, `gpt-6-luna`.
- **The stream** is typed server-sent events
  ([Streaming](https://developers.openai.com/api/docs/guides/streaming-responses); the event shapes are from
  OpenAI's own SDK types, `openai-node` `src/resources/responses/responses.ts`, read the same day): the model is read
  from any event's `response.model`; `response.output_text.delta` carries the text in `delta`;
  `response.completed` ends an answer; `response.incomplete` with `incomplete_details.reason: "max_output_tokens"`
  is an answer cut off (`stopReason: 'max_tokens'`), with any other reason (`content_filter`) a refusal;
  `response.refusal.delta` is a refusal; `response.failed` carries `response.error.code`; `error` carries `code`.
  A stream that ends with none of the endings is a failure.
- **Failures** ([Error codes](https://developers.openai.com/api/docs/guides/error-codes); the body is
  `{ error: { message, type, param, code } }`):

  | Kind                | From                                                                                                                                                                                         |
  | ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
  | `bad-key`           | 401; `code: invalid_api_key`                                                                                                                                                                 |
  | `no-credit`         | a 429 whose `code` (or `type`) is `insufficient_quota`, `credit_balance_exhausted`, `organization_spend_limit_exceeded`, `project_spend_limit_exceeded`, `organization_usage_limit_exceeded` |
  | `rate-limited`      | any other 429; `rate_limit_exceeded`, `slow_down`, also from a failed response                                                                                                               |
  | `overloaded`        | 503; `server_is_overloaded`, `service_unavailable_error`, also as an `error` event mid-stream                                                                                                |
  | `model-unavailable` | 404; `model_not_found`                                                                                                                                                                       |
  | `refused`           | `response.refusal.delta`; `response.incomplete` not for the token ceiling; a failed response with `invalid_prompt`, `bio_policy` or `misalignment_policy_violation`                          |
  | `other`             | anything else: no network, 400, 403, 500, a body that is not JSON, a stream cut short                                                                                                        |

- **Not confirmed from the documentation read:** that a wrong key's body carries `code: invalid_api_key` and a
  missing model's `model_not_found` (the error page lists the 401 and names neither code; the status alone maps
  them, so the codes are a second way in, not the only one); and 403, which the page gives only for an unsupported
  country, is `other`.
- The client does not retry.

## Describe to Set Up

Derived from [Describe to set up](../describe-to-set-up.md) "The model". The editor's side is its own
[blueprint](describe-to-set-up.md).

1. `setupRefusal(description, { personThisHour, knowledgebaseToday })`: `no-description` (under
   `SETUP_MIN_DESCRIPTION_CHARS`, 20, after trimming), `description-too-long` (over 1,000), `person-limit` (5 an
   hour), `knowledgebase-limit` (20 a day), or `undefined`. `setupCounters(person, now)` are the reads and the
   writes, in scopes of their own (`setup:person:<id>`, `setup:knowledgebase`), so a suggestion never spends one of
   Ask's questions.
2. `setupRequest({ description, existing })`: one `ModelRequest`, `maxTokens` 4,000, effort `low`. `SETUP_SYSTEM`
   asks for a structure a team will review (6 to 20 pages for most, never more than 30, 3 levels, titles of 80,
   one-sentence summaries of 200, up to 6 headings of 80, no two siblings of one title, a name for the
   knowledgebase), as one JSON object `{ name, pages: [{ id, title, summary, headings, parent }] }` and nothing
   else, `parent` the `id` of the page above or `null`. The user message is `<existing_pages>` (when adding: each
   `<page depth="n">title</page>`, at most 500, titles cut at 80) then `<description>`, every piece through
   `fenced`: a description that writes `</description>` or instructions is data inside its fence.
3. `parseSetupSuggestion(reply)` answers `{ name, pages }` or `undefined`. The reply is read up to
   `SETUP_MAX_REPLY_CHARS` (60,000), from its first `{` to its last `}` (a code fence or a sentence around it is
   ignored). Each page: a title that is a non-empty string after cleaning, else the page is dropped; text is made
   one line (control characters and line breaks to spaces) and **cut** at its bound, never split inside a
   surrogate pair; headings that are not strings or are empty are dropped, the first 6 kept. Pages are placed
   depth first from the top in the reply's order, so a page whose parent is unknown or leads back to itself is
   never reached; a level past 3, a sibling's title (compared without case) and anything past 30 pages are left
   out with their subpages. The ids that come out are the suggestion's own (`p1`, `p2`, ... in tree order), each
   with `parent` and `depth`. No valid page: `undefined`, which the route answers as `no-structure`.
4. **A reply cut off** at the token ceiling does not parse as a whole. Each page is an object with no object inside
   it, so every complete `{...}` without a brace in it is then tried alone, and the name is read by its own
   pattern: the whole pages are saved and the cut one is lost.
5. **Trust.** The reply is untrusted text. Nothing in it is read as markup: a title of `<script>` is those
   characters, kept as they are, and the editor places them as text (`setup.test.ts`, the route's test and the
   editor's tests each hold it).

6. **Built-in AI** (`setup-built-in.ts`; owner, 2026-11-21: built-in by default, the team's key when set).
   `SETUP_BUILT_IN_MODEL` is liveplanner's Describe a Plan model, `@cf/google/gemma-4-26b-a4b-it`.
   `setupBuiltInInput({ description, existing }, refused?)` writes `setupRequest`'s request in Workers AI's chat
   shape: the system prompt as the first message, `max_tokens` 4,000, `temperature` 0, `response_format` a strict
   `json_schema` of the reply's shape (`SETUP_REPLY_SCHEMA`), and `chat_template_kwargs.enable_thinking` false. On
   the second ask `refused` (fixed words from the check, never the model's text) is added to the user message in
   `<previous_reply>`, fenced. `builtInReplyText(raw)` reads the binding's answer, whatever shape it comes in
   (`{ response }` as text or an object, `{ choices: [{ message: { content } }] }`, a string) into the text
   `parseSetupSuggestion` reads; anything else is `undefined`. `SETUP_BUILT_IN_ASKS` is 2;
   `SETUP_BUILT_IN_PER_PERSON_PER_DAY` is 10 (liveplanner's `PLAN_DRAFT_PER_DAY`).

**The route** (`routes/knowledge-setup-route.ts`): `POST setup/suggest`, a signed-in Editor in person
(`grant.role === 'edit'`, no token, an account), else `403`; `existing` read defensively (500 entries, titles of
80); the refusal before the key is opened. Then `openAi`: a key that opens runs **the team's key** (counted, then
`callModel` through the door with the request's signal; `502` `{ error: <kind>, provider, message }` for a failed
call); `unreadable` is refused as before (`409 ask_unavailable`); `no-key` and `no-secret` run **built-in AI**
(`knowledge/setup-built-in-ai.ts`):

- `builtInAi(env)`: the `AI` binding, or under the e2e stack alone the stand-in's `POST /workers-ai/run` (its origin
  `E2E_CLAUDE_STAND_IN`, checked by `model-door.ts` `standInOrigin`); none: `503 built-in-unavailable`.
- The account's count (`knowledge/setup-draft-count.ts`, after liveplanner's `plan-draft-count.ts`): one
  `DOCUMENT_ROOM` instance per account under a name no document id can take (`~setup-drafts:<account>`; document
  ids are UUIDs), holding one storage key `{ day, count }` and nothing else, reached by its `spendSetupDraft(day,
cap)` RPC, which counts and checks in one turn of the object. At the cap: `429 built-in-limit`. Unreachable:
  `503 built-in-failed` (a fault never lifts the cap). Then the room's hour and day counters are bumped.
- At most `SETUP_BUILT_IN_ASKS` asks (`askBuiltIn`, each bounded at `SETUP_BUILT_IN_TIMEOUT_MS`, 60 s): a reply that
  does not read is asked once more with why; the binding's error or the bound: `502 built-in-failed`; still no
  structure: `502 no-structure`.

`200` answers the suggestion with `provider`: `built-in`, `anthropic` or `openai`. Logs `[knowledge] setup
suggested` (provider, page count, model, asks), `setup no structure`, `setup failed` (kind): never the
description, a title or the key.

| Rule                                                            | Test                                                                                                              |
| --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| 20 to 1,000 characters; 5 an hour, 20 a day, apart from Ask     | `setup.test.ts`; `knowledge-setup-route.test.ts`                                                                  |
| The description and existing titles are fenced data             | `setup.test.ts`; the route's test                                                                                 |
| 30 pages, 3 levels, 80, 200, 6 headings of 80                   | `setup.test.ts` "reading a reply"                                                                                 |
| No duplicate sibling titles; parents resolved; the rest dropped | the same                                                                                                          |
| No valid page is a failure, never a raw error                   | the same; the route's test                                                                                        |
| Markup in a reply stays text                                    | the same; the route's test                                                                                        |
| Per role, per limit, per provider                               | `knowledge-setup-route.test.ts`                                                                                   |
| Built-in AI: no key, its asks, repair, cap, no binding, timeout | `knowledge-setup-route.test.ts`; `setup-built-in.test.ts`; `setup-built-in-ai.test.ts` (the client and the count) |

**Risk not ruled out:** thinking counts against the 4,000 token ceiling on both providers, so a long structure
from a model that thinks at length can be cut off. The prompt asks for a compact reply and effort is `low`; a cut
reply still yields its whole pages (step 4). Raise `SETUP_MAX_TOKENS` (and the spec's bound) if real replies are cut.

## Describe Structure

Derived from [Describe to set up](../describe-to-set-up.md) "Describe Structure on a page" (`page-structure.ts`,
`page-structure-blocks.ts`).

1. `structureRefusal({ title, purpose }, used)`: `purpose-too-long` (over 500 after trimming), `no-purpose` (no
   words and no title), `person-limit` (10 an hour), `knowledgebase-limit` (50 a day), or `undefined`.
   `structureCounters(person, now)` count in scopes of their own (`structure:person:<id>`, `structure:knowledgebase`).
2. `pageStructureRequest(input)`: one `ModelRequest`, `maxTokens` 2,000, effort `low`. `STRUCTURE_SYSTEM` asks for
   headings and a line under each, lists, tables and callouts only where they help, never content, as one JSON object
   `{ blocks: [{ kind, level, text, items }] }`. The user message is `<knowledgebase>`, `<page_tree>` (at most 200
   `<page depth="n">title</page>`, titles cut at 80), `<page_title>` and `<purpose>`, every piece through `fenced`.
   No page's writing is in it. `pageStructureBuiltInInput(input, refused?)` is the same in Workers AI's chat shape in
   JSON mode (`STRUCTURE_REPLY_SCHEMA`), the second ask carrying fixed words for why, never the reply.
3. `parsePageStructure(reply)`: the reply read up to 40,000 characters, from its first `{` to its last `}`, or (cut
   off) each complete brace-free object on its own. Each block's kind is one of seven; text is one plain line
   (`plainLine`, with a leading `#`, list marker or bold wrapping taken off), headings cut at 80, lines and callouts
   at 240, up to 8 list items of 120, a table 2 to 5 columns of 40. At most 48 blocks, 12 headings and 4,000
   characters: past a bound the rest is left out. No heading that reads: `undefined`.
4. `pageStructureArticleBlocks(blocks, newId)`: Heading 2 or 3 paragraphs, an italic body line, a quote for a callout,
   one list block per item (`bullet`, `numbered`, `todo`), a table of a header row and one empty row
   (`tableFromGrid`). Text only.

**The route** (`routes/knowledge-structure-route.ts`): `POST pages/<tab>/describe-structure` inside the page routes,
so a link to one page reaches only its own page and sees the tree's other pages nameless (left out of `<page_tree>`).
An API token: 403 `needs_a_person`; not `writesPages`: 403; no account: 403 `sign_in_required`. `ai: "built-in"` or no
key: built-in AI, `spendSetupDraft(..., 'structure')` (its own DOCUMENT_ROOM instance per account,
`~page-structure:<id>`, 10 a day; a fault refuses with `built-in-failed`), asked through `askBuiltInOnce` at most
twice. Otherwise `callModel` on the team's key through `modelDoorFor`. Answers `{ blocks, provider }`; writes
nothing; logs only counts, the provider and the kind.

## Conflicts

1. `conflictCheckRefusal({ hasAi, checksToday, perDay?, lastCheckedAt, now })`: `no-ai` (no key and no built-in
   AI), `checked-recently` (under `CONFLICT_PAGE_INTERVAL_MS`, 10 minutes, since the page's last check),
   `daily-limit` (`perDay`: `CONFLICT_CHECKS_PER_DAY`, 50, on a key; `CONFLICT_BUILT_IN_CHECKS_PER_DAY`, 20, on
   built-in AI), or `undefined`. A stored key that does not open is refused, never checked on built-in AI.
2. `conflictProbes(before, after)`: the passages of the save whose text hash is new (`before` is the page's rows as
   `{ id, textHash }`, read before the index is replaced), of at least 40 characters, longest first, at most
   `CONFLICT_MAX_PROBES` (5). When a page is verified with nothing changed, an empty `before` probes its longest five.
3. `probeSearch(probe, now)`: any of the probe's 8 longest content words, passages only, other pages only, 5 rows.
4. `chooseConflictCandidates(lookups, known)`: every probe with what its lookup found, best rank first, each pair
   once, pairs already stored (`knownConflictIds(tab)`: open or dismissed) left out, at most
   `CONFLICT_MAX_CANDIDATES` (5).
5. `conflictRequest({ candidates })`: one request for all the pairs, each `<pair number>` with `<first>` and
   `<second>` fenced as in Ask. `CONFLICT_SYSTEM` asks whether the two passages state opposite facts (both cannot be
   right at once), and has the model answer `<pair number="n" verdict="conflict">the question</pair>` or
   `verdict="consistent"`.
6. `parseConflictVerdicts(reply, candidates)`: a `Conflict` for each pair that was asked about, has the verdict
   `conflict` and a question (cut at 200 characters); anything else in the reply is ignored.
7. A conflict closes when either passage's text hash changed or the passage is gone: `closeChangedConflicts(tab)`, a
   statement inside `replacePageIndex` and `deletePageIndex`; `conflictClosed(conflict, textHashOf)` is the same rule
   in memory.

## Key sealing

- `sealApiKey(secret, apiKey, boundTo)`: the AES-256-GCM key is HKDF-SHA-256 of the secret's bytes (info
  `liveknowledge ai key v1`, empty salt); the IV is 12 random bytes, fresh for every seal; `boundTo` (the
  knowledgebase's id) is the additional authenticated data. The envelope is `v1.<iv>.<ciphertext and tag>`, each part
  base64url.
- `openApiKey(secret, envelope, boundTo)` fails closed with one `KeySealError` ("The stored key could not be read.")
  for a wrong secret, another knowledgebase's envelope, a changed or cut envelope and an unknown version.
- `keyHint(apiKey)` is its last 4 characters, or `''` for a value under 12 characters.
- A value that is empty or over `MAX_API_KEY_CHARS` (512) is refused before it is sealed. No error holds the key, the
  secret or the envelope.

## Wiring: what the room and its callers do

Built in `apps/api/src/knowledge/` and `apps/api/src/routes/knowledge-*.ts` ([api.md](../../015-api/api.md)
"Knowledge" lists the routes). `tab` is the tab's id.

- **The schema** is step 12 of the room's own (`document-schema.ts`, `knowledge/knowledge-schema.ts`):
  `KNOWLEDGE_SCHEMA`, then three tables of the room's. `knowledge_dirty (tab, queued, tries)`: the pages whose index
  is behind their tab. `knowledge_pages (tab, index_hash, trust_hash, chars, verified_print)`: what the index was
  last built from, the page's size, and the writing's print at Verify. `knowledge_work (kind, key, due_at,
payload)`: what the alarm owes.
- **How a write reaches the index.** Three triggers on `tabs` (insert, update of `data` or `name`, delete) mark the
  page in `knowledge_dirty`, so every writer is covered (the save, a seed, an import, a rename, a room op's swap, a
  revert, a delete) and a compare-and-swap that lost marks nothing. The room's database hooks
  (`withKnowledgeIndex`, over `@liveworkspace/index-app` `ItemDb`) settle the marked pages at the end of the
  batch's transaction, inside it (`ctx.storage.transactionSync`, confirmed: it is the only transaction the room
  uses), so a tab and its passages, links and trust land together or not at all. A single statement outside a
  batch (a rename) is settled straight after it in the same synchronous turn, which a Durable Object commits as
  one write.
- **A settle** (`settlePage`) reads the stored tab, takes `pagePassages`, `pageLinkTargets` and
  `parseKnowledgeFields`, and compares two hashes with `knowledge_pages`: `index_hash` (the title, the passages' ids
  and text hashes, the links) and `trust_hash` (`verifiedAt` alone). Both the same: nothing is written.
  Only the trust: `putPageTrust`. Else `replacePageIndex`. No tab: `deletePageIndex`. A page's writing is its
  articles' blocks in page order.
- **Bounds.** One write settles at most 12 pages inline (`SETTLE_INLINE_MAX`); more (an import of 500 pages) are
  queued and the alarm settles 12 a turn, a second apart (`SETTLE_BATCH`, `BACKFILL_GAP_MS`). The schema step queues
  every tab stored before it, so a room that predates the index is backfilled the same way, never in one
  transaction. A tab whose body cannot be read is tried three times, then left out until its next write.
- **Verify and the fields** (`page-knowledge.ts`): `json_set(data, '$.knowledge', ...)` at the revision read
  (`rev = rev + 1`), the trigger marks the page, the settle writes its trust row. Verify also keeps the writing's
  print (below). The whole-tab save keeps the stored fields (`keepStoredKnowledge`).
- **Changed since verified.** What is kept is `sealWritingPrint(writingPrint(text))` in
  `knowledge_pages.verified_print`: for each distinct sentence an 8 character hash and its characters, and how
  much lay past the bounds; never the words. About 13 bytes a sentence, at most 8,000 sentences
  (`WRITING_PRINT_MAX_SENTENCES`): 104 KB at worst, 16 KB for a 100,000 character page. Read with
  `changedSincePrint(openWritingPrint(stored), writingText(...))`.
- **Reads** (`countRead`): an agent's every read; a person's once a page a day, held by a `usage_counters` row
  keyed `read:<hash of the person and the page>` for the day, written only on the first open and pruned with the
  other counters. No reader's id is stored.
- **Search**: `searchPassages`, then `foundPassage`; a link confined to one page is shown that page's rows. The
  limiter is the Worker's binding `SEARCH_RATE_LIMITER`.
- **Ask** (`routes/knowledge-ask-route.ts`): the steps this blueprint gave, streamed as server-sent events. The
  counters are bumped before the model is called. The only way out is the model door ("Providers").
- **The key** (`ai-settings.ts`): `sealApiKey(env.AI_KEY_SECRET, key, documentId)`, stored with its hint and its
  provider in one transaction (`putAiKey`); another provider than the stored one also drops `ai_model`; no secret, no key or an envelope
  that does not open is `ask_unavailable` in words.
- **Conflict checks** (`conflict-check.ts`): a settle that indexed a page anew reads the page's passage hashes as
  they stood (only when a key is set) and the room owes a check in `knowledge_work`, due a minute on; saves inside
  that minute are one check against the first baseline. The alarm runs it outside any transaction, three pieces of
  work a turn; a page checked under 10 minutes ago is put off until the 10 minutes are up.
- **Once a day** (the room's upkeep): `pruneReads`, `pruneCounters`, `pruneQuestions`.
- **Bookkeeping is not an edit.** Reads, counters, questions, conflicts and the key are written through
  `env.KNOWLEDGE_DB`, the room's database with no write note, so none reaches History, Most Used or the outbox.
- **Page links**: `ArticleRun.page` is kept by `parseRun` (`@liveknowledge/document`; `ARTICLE_PAGE_LINK_KEY` is
  `PAGE_LINK_KEY`, pinned by a test). Markdown writes a link as `[[Title]]`; an agent's article write resolves
  `[[Title]]` to the first page of that title in tree order (`withPageLinksResolved`, `pageByTitleIn`); a Markdown
  export to files writes `[Title](relative/path.md)` (`withPageLinksAsFiles`, `pageFilePaths`, `relativePagePath`).

**Not built:** the Offline matcher; current titles in the pages view of `document-views` (`read_page` and
`GET pages/<page>` do print them, through `withPageLinkTitles`).

**Built since, in step 13** ([Knowledgebase for agents](../../024-agents/blueprints/knowledgebase-for-agents.md)):
`get_context` and the MCP's page tools, an agent's pending suggestions (`suggestions`, listed by `GET knowledge`),
scopes, and the Markdown export's `withPageLinksAsFiles` (the CLI's `export`).

## The review emails

Derived from [Verification](../verification.md) "Reminders" and [AI Knowledge](../ai-knowledge.md) "Pages that
disagree", "Knowledge Health". Built in the api; tested over the fake sender and the fake accounts service; never
sent from a deployed Worker.

| Where (`apps/api/src`)                 | What                                                                                          |
| -------------------------------------- | --------------------------------------------------------------------------------------------- |
| `email/brand-layout.ts`                | The product's email look and shell, shared by `templates.ts` and the review templates         |
| `email/knowledge-templates.ts`         | `reviewDueEmail`, `remindOwnersEmail`, `pagesDisagreeEmail`, `EMAIL_PAGES_LISTED`             |
| `email/notifications.ts`               | `notifyKnowledgeReviews(env, emails)`: the notifier's `notifyAccounts` behind the switch      |
| `knowledge/email-marks.ts`             | `knowledge_email_marks`, `claimMark`, `dropMark`, `marksOf`, `putMarks`, `reserveEmails`      |
| `knowledge/knowledge-emails.ts`        | `runReviewEmails`, `remindOwners`, `askConflictOwners`, `ownersWhoReach`, `runKnowledgeEmail` |
| `knowledge/knowledge-review-timing.ts` | `REVIEW_EMAIL_GAP_MS`, `REMIND_OWNERS_GAP_MS`, `REVIEW_CHECK_DELAY_MS`                        |
| `routes/knowledge-email-routes.ts`     | `POST conflicts/<id>/ask-owners`, `POST knowledge/remind-owners`                              |

- **The setting.** `notifyKnowledgeReviews`, liveknowledge's own scope at accounts, on unless stored `false`;
  declared in the editor's Settings catalogue (`emailSwitch`, "Knowledgebase Reviews") and copied to
  `@liveworkspace/settings`' catalogue of this app by its generator. `notifyRecipients` reads it with the
  addresses in two requests whatever the count.
- **Storage.** `knowledge_email_marks (kind, key, at, PRIMARY KEY (kind, key))`, schema step 14
  (`emailMarksSchemaStep`): `review-page` / the tab (`at` the `verifiedAt` whose review its owner was told of, so
  a change of Review Period never tells an owner twice of one review), `review-owner` /
  the owner (when last emailed), `remind` / `owners`, `ask` / the conflict's id. Ids and times, never an address
  or a word. The day's count is `usage_counters` scope `emails`, period the UTC day. All through `knowledgeDb`.
  Pruned daily: page marks whose tab is gone, ask marks whose conflict is gone (`pruneEmailMarks`).
- **Who is emailed** (`sendTo`): account ids only; `ownersWhoReach` keeps the knowledgebase's owner, the joined
  people of its team (one `teamPeople` read) and anyone the index grants as a delegate (one request each of the
  rest); a failed check is no. `reserveEmails(wanted)` takes what is left of `KNOWLEDGE_EMAILS_PER_DAY` (50) in one
  transaction and counts emails tried. `notifyKnowledgeReviews` then drops whoever turned the switch off or has
  no verified address, and answers the ids sent.
- **Review Due** (`runReviewEmails`, the alarm's `review-email` / `daily` work). The pages are the document's tab
  summaries (`parseKnowledgeFields`, `trustState` under the document's `knowledgeSettings.reviewEvery`, read once
  with the document): no page's writing is read. A due page is new while its mark is not its `verifiedAt`. Under
  Never no page is due and none has a `reviewAt`: nothing is sent and the check answers `null`, so nothing is
  armed. An owner with a new page and no email in `REVIEW_EMAIL_GAP_MS` (24 hours) gets
  `reviewDueEmail` of all their due pages; their pages are then marked, sent or not (the switch off, or no longer
  theirs to open, is settled too), and the owner is marked when sent. An owner inside the 24 hours, or held by
  the ceiling, keeps their pages unmarked. Answers when to run again: the earliest of the next `reviewAt` not yet
  due, an owner's 24 hours ending, and the next UTC day when the ceiling held someone; `null` (the row goes) when
  nothing is left to wait for or the deployment sends no email.
- **What owes the check.** `settlePage` answers `trust` or `indexed-trust` when a page's trust hash changed (a
  Verify; not a page first indexed unverified); `Settled.trust` counts them and
  `KnowledgeIndexEvents.onTrust` tells the room once a write, which owes the row at now plus
  `REVIEW_CHECK_DELAY_MS` (one minute) and wakes its alarm. The schema step owes it at once for a room that
  already holds a verified page. A change of the Review Period owes it too: `setKnowledgeSettings` calls the
  room's `REVIEW_PERIOD_CHANGED`, the same one row and wake. Never on a write's own path: the email is the
  alarm's.
- **Remind the Owners** (`remindOwners`): `unavailable` with email off; `nothing_due`; `no_owners`; else
  `claimMark('remind', 'owners', now, now - REMIND_OWNERS_GAP_MS)` (one statement: two presses send once), or
  `already_sent` with `sentAt` and `nextAt`. Each owner gets `remindOwnersEmail` of their Review Due and Never
  Verified pages. Nothing sent gives the mark back (`dropMark`) and answers `daily_limit` or `no_recipients`.
- **Ask Both Owners** (`askConflictOwners`): the conflict is read open, with both passages (`openConflicts`), else
  `404 conflict_unknown`; the owners are the two pages' (one email for one person); `claimMark('ask', id, now,
null)` takes the mark only when there is none, else `already_sent`. `GET knowledge` answers `askedAt` on the
  conflict and `reviewEmails: { available, remindedAt }`.
- **The routes** take a signed-in Editor in person (`role === 'edit'`, no token, an account); anyone else `403`.
  Each answers `200` with a `KnowledgeEmailResult`.
- **The emails.** Subjects in Title Case, one line, at most 80 characters (`subjectText`): "Pages Due for Review
  in <name>", "Pages to Review in <name>", "Two Pages Disagree in <name>". HTML through the shared shell, lime, with
  the settings link in the footer and as `List-Unsubscribe`; a plain-text alternative with the same links. Names,
  titles, the question and the passages are escaped (`xmlEscape`); a passage is one line of at most 280
  characters cut at a word (`mentionQuote`). A page's link is `<base>/document/<id>#t=<tab>`, the conflict's
  `<base>/document/<id>?view=ai`. `EMAIL_PAGES_LISTED` is 100: measured, a 500 page email of 100 rows and a count
  is under 60 KB, where 500 rows would pass the 102 KB at which Gmail clips. Telemetry kinds `ReviewDue`,
  `OwnersReminded`, `PagesDisagree`.
- **Cost.** A review check is one read of the document's outline, two reads of marks, one team read, at most one
  index request an owner outside the team, two accounts requests, one send an owner, and the marks written in
  batches of 33 (500 pages: 16 statements). Measured in `knowledge-email-routes.test.ts`: 500 due pages of one
  owner, one email, inside a 1.5 second CPU budget on the test database. **Not ruled out:** a knowledgebase whose
  owners are mostly outside its team costs an index request each a check (bounded by its owners, then by the 50 a
  day); and the alarm's turn does three pieces of work, so a review check queues behind conflict checks.
- **Observability.** `[knowledge] review emails` (owners, tried, sent, held, pages), `owners reminded`, `owners
asked`, `email asked` (the route's outcome), `email not sent` (`email_off`), `email work unknown`. Ids and
  counts, never an address or a title.

| Rule                                                                 | Test                                                 |
| -------------------------------------------------------------------- | ---------------------------------------------------- |
| One email an owner of all their due pages; a page told once a review | `routes/knowledge-email-routes.test.ts` "Review Due" |
| One a day an owner; 50 a knowledgebase a day; the rest the next day  | the same                                             |
| The setting off, an owner who cannot open it, a guest, email off     | the same                                             |
| 500 due pages are one email under 102 KB                             | the same; `email/knowledge-templates.test.ts`        |
| Remind: per role, once a week, each reason nothing was sent          | `routes/knowledge-email-routes.test.ts`              |
| Ask: per role, once a conflict, one person owning both, 404          | the same                                             |
| Escaping, one-line subjects, the text alternative, the excerpt's cut | `email/knowledge-templates.test.ts`                  |
| The three emails byte for byte                                       | `email/knowledge-templates.test.ts` (pinned hashes)  |
| What owes the review check                                           | `knowledge/review-check-owed.test.ts`                |
| The emails follow the knowledgebase's period; Never sends nothing    | `routes/knowledge-email-routes.test.ts`              |
| The period said in the email ("reviews pages every 90 days")         | `email/knowledge-templates.test.ts`                  |
| The notifier's door                                                  | `packages/index-app/src/notifier.test.ts`            |

**FTS5 in workerd: not confirmed by a test.** The api's tests run in Node on `node:sqlite` (the same FTS5 the
package's tests use), not in the Workers pool: `porter`, `bm25()`, `snippet()` and `highlight()` are proven there,
inside the real routes, and remain unproven in workerd itself.

## The Review Period in the room and the api

Spec: [Verification](../verification.md) "The Review Period". Built 2026-11-20.

- **Storage.** `document.knowledge_settings` (schema step 15, an `ALTER` that asks first): JSON of
  `{ reviewEvery }`, `NULL` for the default. Read with the document's row (`DOCUMENT_HEAD_COLS`), so
  `DocumentMeta.knowledgeSettings` and the document read's `knowledgeSettings` are always present, and every route
  and alarm turn has the period from the one read it already made: never a read a page.
- **The write** (`setKnowledgeSettings`, `document-content.ts`): `UPDATE document SET knowledge_settings, saved_at`
  on a started document. One row, whatever the knowledgebase holds: O(1). No tab, `page_trust` row,
  `knowledge_pages` row or passage is touched, and nothing is marked for the index (`trust_hash` does not hold the
  period). The last save moves, so the Drive file follows. It then calls `env.REVIEW_PERIOD_CHANGED`, which the
  room binds to the function that owes its review check.
- **Routes** (`routes/knowledge-settings-routes.ts`):

  | Route                                         | Who                                            | Answers                                                                |
  | --------------------------------------------- | ---------------------------------------------- | ---------------------------------------------------------------------- |
  | `GET knowledge-settings`                      | every role, whole knowledgebase                | `{ knowledgeSettings: { reviewEvery } }`                               |
  | `PUT knowledge-settings` `{ reviewEvery }`    | Editor (in person, or a token granted `write`) | the same; `400 invalid_review_every`, `400 invalid_body`, `403`, `405` |
  | `GET knowledge-settings/preview?reviewEvery=` | Editor                                         | `{ reviewEvery, reviewDue, reviewDueNow }`; `400 invalid_review_every` |

  A `PUT` of the period already set writes and relays nothing. After a write the room's editors are told with the
  `document-meta` op (`knowledgeSettings` beside the name and the tab list as it stands). A session's own
  `document-meta` never carries the settings: the room deletes the key from a client's op
  (`document-room-frames.ts`), so no peer hears a period that was not stored.

- **The preview** is `reviewDueCount` twice (the period asked about, the period held): each
  `SELECT COUNT(*) FROM page_trust WHERE verified_at IS NOT NULL AND verified_at <= ?`, a range of
  `page_trust_verified`, at most 500 rows. Never for `'never'`, which answers 0 without a read.
- **`PUT pages/<tab>/knowledge`** refuses a body holding `reviewEvery` with
  `400 review_period_is_the_knowledgebases` and a message naming `PUT /api/documents/<id>/knowledge-settings`.
- **What follows the period, each at read time:** `GET summary` (`reviewEvery`, the counts, `yoursToReview`, whose
  `reviewAt` is `verified_at` plus the period), `GET knowledge` (`reviewEvery`, Knowledge Health, each conflict
  side's trust), `GET pages` and `GET context` (`reviewEvery`, said once), a page's health and read, search's
  verified preference and an agent's `reviewAt`, Ask's passages, the conflict check's lookups (the period read
  once a check with `readDocumentMeta`), `write_page`'s refusal on a verified or due page, and the three emails.
- **It travels with the document.** A copy of the whole knowledgebase (`DocumentCopy.knowledgeSettings`, absent
  for the default and for a copy of one page), the file envelope (`document.knowledgeSettings`, so the export,
  the Drive file and a snapshot hold it; a snapshot's revert sets it back, to the default when the snapshot named
  none), an import of that file, and the create that syncs a knowledgebase kept Offline
  (`POST /api/documents` `knowledgeSettings`; an unknown period is left out). Version History is a page's: a page
  holds no period, so a restored version changes none.
- **Observability.** `[knowledge] review period` `{ documentId, reviewEvery, was }`.

| Rule                                                             | Test                                                                           |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Per role: read, set, preview                                     | `routes/knowledge-settings-routes.test.ts`                                     |
| A change writes the document's row and no other row              | the same, "writes one row and rewrites no page"                                |
| States, due dates, counts, Yours to Review, search, `write_page` | the same, "what follows the Review Period"                                     |
| The preview's counts; 500 verified pages within 50 ms of CPU     | the same, "preview"                                                            |
| Copy, file, snapshot, Offline sync                               | the same, "travels with the knowledgebase"                                     |
| A per-page `reviewEvery` is refused, saying where the setting is | `routes/knowledge-page-routes.test.ts`                                         |
| The envelope and the parser                                      | `packages/document`: `knowledge-settings.test.ts`, `document-envelope.test.ts` |

## Errors and edge cases

| Case                                                     | Handling                                                                                |
| -------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| A page with no words                                     | No passages; its title row is still indexed                                             |
| A query with no letters or digits                        | `searchPassages` answers `undefined`; no statement is run                               |
| A query of FTS5 syntax (`"`, `NEAR(`, `text:`, `*`, `^`) | Read as words; tests run each against SQLite                                            |
| A statement of the transaction fails                     | The room's transaction rolls back whole; a test holds it with the fixture               |
| Stored `headings` that are not a list of strings         | `foundPassage` answers an empty path                                                    |
| A `trust` value SQLite answers that is not 0, 1 or 2     | Reads as `never-verified`                                                               |
| A reply with citation numbers that were not sent         | The markers are removed and cite nothing                                                |
| A reply cut off (`stop_reason: "max_tokens"`)            | Returned with its `stopReason`; the parser reads what there is                          |
| A stream that ends without `message_stop`                | `ClaudeCallError('other')`                                                              |
| `fetch` throws                                           | `ClaudeCallError('other')`; the thrown error is not passed on (it may name the request) |
| An envelope of another version, cut or changed           | `KeySealError`, one message                                                             |
| Two questions of stop words only ("Why?", "How?")        | Keep their words, so they have keys of their own                                        |

## Security and trust

- **The key** exists in plain form only in the request that sets it and in `callClaude`'s `x-api-key` header. It is
  sealed under `AI_KEY_SECRET` bound to the knowledgebase's id, never logged, never in an error (tests search every
  error's message, stack and fields for it), never in a result.
- **Prompt injection.** Passages, titles, headings and questions are other people's writing. They are fenced with
  entities so none can close its fence, kept out of the system prompt, and the model is told they are material and
  never instructions. The model's reply is untrusted too: only numbers of passages that were sent become citations
  or conflicts; a verdict for a pair that was not asked about is ignored.
- **Query injection.** Search text is only ever a bound value, and the FTS5 expression is built from quoted words.
- **Scope.** Every passage a knowledgebase's room holds is one the asker can open: access is the knowledgebase's, not
  the page's. Ask through an anonymous share link is the room's to refuse.
- **Identity.** `page_reads` holds no person. `usage_counters` holds an account id in a scope for the hour it counts,
  and `pruneCounters` drops it within two days. `questions` holds the question's words and counts, and agents' names.
- **Rate limits** are the `ASK_*` and `CONFLICT_*` constants, counted in `usage_counters` and checked by the pure
  `askRefusal` and `conflictCheckRefusal`. Search's per-caller limit is the room's limiter.

## Performance and limits

Measured on an M-series Mac, Node 22, CPU time (not wall-clock), 2026-11-20:

| Work                                                                         | Measured                         | Held by                                         |
| ---------------------------------------------------------------------------- | -------------------------------- | ----------------------------------------------- |
| `pagePassages` on a 104,573 character page (122 passages)                    | 0.5 ms median, 1.7 ms worst of 9 | a CPU budget test: 50 ms (the spec's bound)     |
| `pagePassages` on one unbroken 400,000 character block                       | inside its budget                | a CPU budget test: 100 ms                       |
| `replacePageIndex` for that page: 18 statements, the longest 423 bytes       | 1.8 ms in `node:sqlite`          | the fixture's statement checks                  |
| `pageWords` and `pageHeadingCount` on a 100,000 word page (2026-11-21)       | 2.9 ms median, 6.4 ms worst      | a CPU budget test: 50 ms                        |
| `pageHealth` for one page                                                    | about 2 µs                       | constant work, no input grows it                |
| Every page's Health Score facts at 500 pages: one statement                  | 4.4 to 5.1 ms in `node:sqlite`   | page-health-read.test.ts (one prepare, budget)  |
| A 20-result agent search's scores: one statement                             | one prepare                      | page-health-read.test.ts                        |
| A search whose words match nearly every row of a 5,612 row index (500 pages) | 8.8 ms in `node:sqlite`          | `LIMIT` 20; not held by a budget test           |
| `changedFraction` on two 104,000 character versions                          | 3.3 ms                           | a CPU budget test at 400,000 characters: 150 ms |

- Every function is one pass over its input. `passagePieces` scans back at most one passage's length for a place to
  cut, and each cut moves forward, so a block of any length is linear.
- **Risks not ruled out.** (1) The SQLite numbers are Node's, not workerd's; a Durable Object bills rows read and
  written, and a save of a 100,000 character page writes about 123 rows to `passages` and as many to the index (an
  FTS5 write counts as rows written). (2) A search for a word on every page ranks every match before `LIMIT` cuts
  it; at 5,612 rows that is 8.8 ms here, and it grows with the index. If it bites, cap the candidates with a
  subquery over the index before the join. (3) `conflictProbes` reads the page's stored hashes before every save
  that may be followed by a check: one indexed read.

## Testing

- 100% of lines, branches, functions and statements, held by `vitest.config.ts`; `corepack pnpm --filter
@liveknowledge/knowledge test:coverage`.
- **The SQL is run, not only read:** `src/__fixtures__/db.ts` is a real SQLite with FTS5 (`node:sqlite`, in Node 22;
  no dependency added). The schema, every statement, the search ranking, the conflict closing and the pruning run
  against it. What it cannot show is workerd's own behaviour (above).
- **No model API is ever called.** `src/__fixtures__/claude.ts` and `src/__fixtures__/openai.ts` build each
  provider's server-sent event streams and error bodies in the documented shapes; a fake `fetch` records what was sent. The request shapes and the fallback beta are
  therefore unverified against the live API.
- Speed is held in CPU time (`@liveworkspace/vitest-config/cpu-time`), never wall-clock.

| Spec rule                                                            | Test                                             |
| -------------------------------------------------------------------- | ------------------------------------------------ |
| A passage is a heading and its blocks, at most 1,200 characters      | `passages.test.ts`                               |
| A 100,000 character page indexes within 50 ms of CPU                 | `passages.test.ts` "the cost of indexing a save" |
| A page's rows are rewritten with its links in one transaction        | `sql/page-index.test.ts`                         |
| Titles first, verified pages preferred, at most 20, 200 characters   | `sql/search.test.ts`                             |
| States worked out when read, from the fields, the period, the clock  | `trust.test.ts`, `sql/search.test.ts`            |
| A change of Review Period rewrites no row; the due count is indexed  | `sql/search.test.ts`, `sql/page-index.test.ts`   |
| More than a fifth changed adds "Changed since verified"              | `changed-since.test.ts`                          |
| A page link is a run with `page: <tab id>`; backlinks from the table | `page-links.test.ts`, `sql/page-index.test.ts`   |
| Reads by day, reader kind and agent, kept 90 days                    | `sql/bookkeeping.test.ts` "page reads"           |
| Like questions grouped, with how many times and by whom              | `questions.test.ts`, `sql/bookkeeping.test.ts`   |
| Tokens are characters / 4 rounded up to 10, against 8,000            | `context-budget.test.ts`                         |
| The Ask bounds; verified first; cites each claim; does not guess     | `ask.test.ts`                                    |
| The key is encrypted with AES-GCM and never sent back or logged      | `key-seal.test.ts`, `claude-client.test.ts`      |
| A failed or refused call says which, in words                        | `claude-client.test.ts`                          |
| 50 checks a day, 5 candidates, once per page per 10 minutes          | `conflicts.test.ts`                              |
| A conflict closes when either passage changes; dismissed for good    | `conflicts.test.ts`, `sql/bookkeeping.test.ts`   |

## Constants and configuration

| Constant                                                                               | Value                                           | From                                        |
| -------------------------------------------------------------------------------------- | ----------------------------------------------- | ------------------------------------------- |
| `MAX_PASSAGE_CHARS`                                                                    | 1,200                                           | search-and-ask.md "Search"                  |
| `SEARCH_MAX_QUERY_CHARS`, `SEARCH_MAX_RESULTS`                                         | 200, 20                                         | search-and-ask.md "Bounds"                  |
| `SEARCH_MAX_TERMS`                                                                     | 12                                              | default D1                                  |
| `MAX_BOUND_PARAMETERS`                                                                 | 100                                             | Cloudflare's limit                          |
| `ASK_PER_PERSON_PER_HOUR`, `ASK_PER_KNOWLEDGEBASE_PER_DAY`                             | 20, 200                                         | search-and-ask.md "Bounds"                  |
| `ASK_MAX_QUESTION_CHARS`, `ASK_MAX_PASSAGES`, `ASK_MAX_PASSAGE_CHARS`, `ASK_MAX_TURNS` | 1,000, 12, 24,000, 10                           | search-and-ask.md "Ask"                     |
| `ASK_MAX_TOKENS`, `CONFLICT_MAX_TOKENS`                                                | 16,000                                          | default D6                                  |
| `ASK_MAX_GAPS`, `ASK_MAX_GAP_CHARS`                                                    | 5, 300                                          | default D7                                  |
| `CONTEXT_BUDGET_TOKENS`                                                                | 8,000                                           | ai-knowledge.md "Always in Context"         |
| `REVIEW_INTERVALS`, `DEFAULT_REVIEW_EVERY`                                             | 30, 90, 180, 365, never; 90                     | verification.md "The fields"                |
| `CHANGED_SINCE_FRACTION`, `CHANGED_SINCE_MAX_CHARS`                                    | 0.2; 400,000                                    | verification.md; default D4                 |
| `CONFLICT_CHECKS_PER_DAY`, `CONFLICT_MAX_CANDIDATES`, `CONFLICT_PAGE_INTERVAL_MS`      | 50, 5, 600,000                                  | ai-knowledge.md "Pages that disagree"       |
| `CONFLICT_MAX_PROBES`                                                                  | 5                                               | default D8                                  |
| `READS_KEPT_DAYS`, `AGENT_SEEN_DAYS`, `AGENT_TOP_PAGES`                                | 90, 30, 3                                       | ai-knowledge.md "Reads", "Connected agents" |
| `MAX_QUESTIONS`, `QUESTIONS_LISTED`, `CONFLICTS_LISTED`                                | 500, 50, 50                                     | default D9                                  |
| `MAX_PAGE_LINKS`, `MAX_PAGE_LINK_ID`                                                   | 500, 64                                         | the page limit; an article id's length      |
| `CLAUDE_API_VERSION`, `CLAUDE_FALLBACK_BETA`                                           | `2026-10-21`, `server-side-fallback-2026-07-01` | the `claude-api` skill                      |

## Defaults ledger

Defaults applied where a spec is silent. They are listed here because the category's `DEFAULTS.md` was another
change's file while this was written; they move there when it is committed.

| #   | Spec silence                                               | Default applied                                                                                      |
| --- | ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| D1  | "A sensible number of terms" in a query                    | 12 (`SEARCH_MAX_TERMS`)                                                                              |
| D2  | How a passage's id stays stable                            | Hash of the page, the heading path and the place among that path's passages                          |
| D3  | How titles rank first                                      | A title row per page in the same index, ordered before passages, title weighted 10 in bm25           |
| D4  | How "a fifth of the characters" is measured without a diff | Characters of sentences not in both versions, over the longer version; bounded at 400,000 characters |
| D5  | Which models "the current Claude models" are               | The current generation of each line: Fable 5.2, Opus 5.5, Sonnet 5.5, Haiku 5.5                      |
| D6  | The answer's token ceiling and effort                      | 16,000 tokens; effort `medium` for Ask, `low` for a conflict check                                   |
| D7  | How many gaps one answer may log                           | 5, each one line of at most 300 characters                                                           |
| D8  | Which of a page's passages a conflict check looks up       | The 5 longest whose text changed in the save                                                         |
| D9  | How many unanswered questions are kept and listed          | 500 groups kept (oldest asked go first), 50 listed, 50 conflicts listed                              |
| D10 | Failure kinds beyond bad key, no credit and rate limit     | `overloaded`, `model-unavailable`, `refused`, `other`                                                |
| D11 | What a refused request does                                | The failure kind `refused`; server-side fallback is off for every model (owner, 2026-11-20)          |
| D12 | What the envelope is bound to                              | The knowledgebase's id, as AES-GCM additional data                                                   |
| D13 | Whether a dismissed conflict outlives a changed passage    | No: the row goes when either passage changes, since the pair dismissed no longer exists              |
| D14 | The heading line in a passage                              | The first passage of a section starts with its heading's text                                        |

## Where this differs from the specs

- **"Verified pages first" among passages, not among title rows.** Title rows are ordered by bm25 alone among
  themselves and come before every passage, as "page titles first, then passages" asks.
- **`people` is asks by people, not distinct people.** No reader's identity is kept, so two asks by one person
  count as two; the spec now reads "Asked 4 times by people and Coding Agent".
- **A page's size in tokens is its passages' characters** (`knowledge_pages.chars`, `tokensOfChars`), not its
  Markdown's: the index already holds the count, and no page is parsed to list the context pages.
- **An owner must be reachable by the index as a person.** `PUT pages/<tab>/knowledge` takes the caller, the
  knowledgebase's owner, or someone the index grants directly; a member who reaches it only through a team is
  refused (`owner_no_access`) until the index can say who may open an item.
- **Found but Not Used is the model's judgement.** The spec has a passage "set aside because it is stale and
  disagrees with a newer verified one"; the package asks the model to name such passages (`<not_used>`) and validates
  the numbers, and does not decide staleness itself.
- **The specs were not edited in this change**: every spec file of the category held another change's uncommitted
  edits while this was written.
